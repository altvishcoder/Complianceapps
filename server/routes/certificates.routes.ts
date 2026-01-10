import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCertificateSchema, ingestionBatches } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { processExtractionAndSave } from "../extraction";
import { enqueueWebhookEvent } from "../webhook-worker";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";

export const certificatesRouter = Router();

// Apply requireAuth middleware to all routes in this router
certificatesRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// ===== CERTIFICATES =====
certificatesRouter.get("/", paginationMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    
    const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
    const isPendingFilter = status === 'PENDING';
    
    const certificates = await storage.listCertificates(orgId, { 
      propertyId, 
      status: isPendingFilter ? undefined : status 
    });
    
    let filtered = isPendingFilter 
      ? certificates.filter(c => PENDING_STATUSES.includes(c.status))
      : certificates;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.certificateNumber?.toLowerCase().includes(searchLower) ||
        c.fileName?.toLowerCase().includes(searchLower) ||
        c.certificateType?.toLowerCase().includes(searchLower)
      );
    }
    
    const total = filtered.length;
    const paginatedCertificates = filtered.slice(offset, offset + limit);
    
    const enrichedCertificates = await Promise.all(paginatedCertificates.map(async (cert) => {
      const property = await storage.getProperty(cert.propertyId);
      const extraction = await storage.getExtractionByCertificate(cert.id);
      return {
        ...cert,
        property,
        extractedData: extraction?.extractedData,
      };
    }));
    
    res.json({ data: enrichedCertificates, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
});

certificatesRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const orgId = getOrgId(req);
    const property = await storage.getProperty(certificate.propertyId);
    const extraction = await storage.getExtractionByCertificate(certificate.id);
    const actions = orgId ? await storage.listRemedialActions(orgId, { certificateId: certificate.id }) : [];
    
    res.json({
      ...certificate,
      property,
      extractedData: extraction?.extractedData,
      actions,
    });
  } catch (error) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({ error: "Failed to fetch certificate" });
  }
});

certificatesRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const data = insertCertificateSchema.parse({ ...req.body, organisationId: orgId });
    const certificate = await storage.createCertificate(data);
    
    enqueueWebhookEvent('certificate.created', 'certificate', certificate.id, {
      id: certificate.id,
      propertyId: certificate.propertyId,
      certificateType: certificate.certificateType,
      status: certificate.status
    });
    
    await recordAudit({
      organisationId: orgId,
      eventType: 'CERTIFICATE_UPLOADED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.certificateType,
      propertyId: certificate.propertyId,
      afterState: certificate,
      message: `Certificate "${certificate.certificateType}" created`,
      context: extractAuditContext(req),
    });
    
    res.status(201).json(certificate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating certificate:", error);
      res.status(500).json({ error: "Failed to create certificate" });
    }
  }
});

certificatesRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const beforeCert = await storage.getCertificate(req.params.id);
    if (!beforeCert) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const certificate = await storage.updateCertificate(req.params.id, req.body);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    enqueueWebhookEvent('certificate.updated', 'certificate', certificate.id, {
      id: certificate.id,
      propertyId: certificate.propertyId,
      certificateType: certificate.certificateType,
      status: certificate.status
    });
    
    await recordAudit({
      organisationId: orgId,
      eventType: 'CERTIFICATE_STATUS_CHANGED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.certificateType,
      propertyId: certificate.propertyId,
      beforeState: beforeCert,
      afterState: certificate,
      changes: getChanges(beforeCert, certificate),
      message: `Certificate "${certificate.certificateType}" updated`,
      context: extractAuditContext(req),
    });
    
    res.json(certificate);
  } catch (error) {
    console.error("Error updating certificate:", error);
    res.status(500).json({ error: "Failed to update certificate" });
  }
});

certificatesRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const updated = await storage.updateCertificate(req.params.id, { status: 'DELETED' as any });
    if (!updated) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    enqueueWebhookEvent('certificate.deleted', 'certificate', req.params.id, {
      id: req.params.id,
      propertyId: certificate.propertyId,
      certificateType: certificate.certificateType
    });
    
    await recordAudit({
      organisationId: orgId,
      eventType: 'CERTIFICATE_DELETED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.certificateType,
      propertyId: certificate.propertyId,
      beforeState: certificate,
      message: `Certificate "${certificate.certificateType}" deleted`,
      context: extractAuditContext(req),
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ error: "Failed to delete certificate" });
  }
});

// ===== REPROCESS CERTIFICATE =====
certificatesRouter.post("/:id/reprocess", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    await storage.updateCertificate(req.params.id, { status: 'PROCESSING' });
    
    await processExtractionAndSave(certificate.id, certificate.certificateType);
    
    res.json({ 
      success: true, 
      message: "Extraction completed"
    });
  } catch (error) {
    console.error("Error reprocessing certificate:", error);
    res.status(500).json({ error: "Failed to reprocess certificate" });
  }
});

// ===== INGESTION BATCHES =====
certificatesRouter.get("/ingestion/batches", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const batches = await db.select()
      .from(ingestionBatches)
      .where(eq(ingestionBatches.organisationId, orgId))
      .orderBy(sql`created_at DESC`)
      .limit(50);
    
    res.json(batches);
  } catch (error) {
    console.error("Error fetching ingestion batches:", error);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});

certificatesRouter.get("/ingestion/batches/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [batch] = await db.select()
      .from(ingestionBatches)
      .where(eq(ingestionBatches.id, req.params.id));
    
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    
    res.json(batch);
  } catch (error) {
    console.error("Error fetching batch:", error);
    res.status(500).json({ error: "Failed to fetch batch" });
  }
});
