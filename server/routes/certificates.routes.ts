import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCertificateSchema, ingestionBatches } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { processExtractionAndSave } from "../extraction";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { enqueueWebhookEvent } from "../webhook-worker";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";

export const certificatesRouter = Router();

const ORG_ID = "org-001";
const objectStorageService = new ObjectStorageService();

// ===== CERTIFICATES =====
certificatesRouter.get("/", paginationMiddleware(), async (req: Request, res: Response) => {
  try {
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    
    const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
    const isPendingFilter = status === 'PENDING';
    
    const certificates = await storage.listCertificates(ORG_ID, { 
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

certificatesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const property = await storage.getProperty(certificate.propertyId);
    const extraction = await storage.getExtractionByCertificate(certificate.id);
    const actions = await storage.listRemedialActions(ORG_ID, { certificateId: certificate.id });
    
    res.json({
      ...certificate,
      property,
      extraction,
      extractedData: extraction?.extractedData,
      actions,
    });
  } catch (error) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({ error: "Failed to fetch certificate" });
  }
});

certificatesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { fileBase64, mimeType, batchId, ...certificateData } = req.body;
    
    let finalBatchId = batchId;
    if (!batchId) {
      const now = new Date();
      const batchName = `Manual Upload - ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      const batch = await storage.createIngestionBatch({
        organisationId: ORG_ID,
        name: batchName,
        totalFiles: 1,
        completedFiles: 0,
        failedFiles: 0,
        status: 'PROCESSING',
      });
      finalBatchId = batch.id;
    }
    
    const data = insertCertificateSchema.parse({
      ...certificateData,
      organisationId: ORG_ID,
      status: "PROCESSING",
      batchId: finalBatchId,
    });
    
    const certificate = await storage.createCertificate(data);
    
    await recordAudit({
      organisationId: certificate.organisationId,
      eventType: 'CERTIFICATE_UPLOADED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.fileName,
      propertyId: certificate.propertyId,
      afterState: certificate,
      message: `Certificate "${certificate.fileName}" uploaded for processing`,
      context: extractAuditContext(req),
    });
    
    (async () => {
      try {
        let pdfBuffer: Buffer | undefined;
        
        if (certificate.fileType === 'application/pdf' && certificate.storageKey) {
          try {
            const file = await objectStorageService.getObjectEntityFile(certificate.storageKey);
            const chunks: Buffer[] = [];
            const stream = file.createReadStream();
            
            await new Promise<void>((resolve, reject) => {
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', () => resolve());
              stream.on('error', reject);
            });
            
            pdfBuffer = Buffer.concat(chunks);
          } catch (downloadErr) {
            console.error("Failed to download PDF from storage:", downloadErr);
          }
        }
        
        await processExtractionAndSave(
          certificate.id, 
          certificate.certificateType,
          fileBase64,
          mimeType,
          pdfBuffer
        );
        
        if (data.batchId) {
          await db.update(ingestionBatches)
            .set({ 
              completedFiles: sql`${ingestionBatches.completedFiles} + 1`,
              status: 'PROCESSING'
            })
            .where(eq(ingestionBatches.id, data.batchId));
          
          const [freshBatch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, data.batchId));
          
          if (freshBatch && freshBatch.completedFiles + freshBatch.failedFiles >= freshBatch.totalFiles) {
            await db.update(ingestionBatches)
              .set({ status: freshBatch.failedFiles > 0 ? 'PARTIAL' : 'COMPLETED', updatedAt: new Date() })
              .where(eq(ingestionBatches.id, data.batchId));
          }
        }
      } catch (err) {
        console.error("Error in AI extraction:", err);
        
        if (data.batchId) {
          await db.update(ingestionBatches)
            .set({ 
              failedFiles: sql`${ingestionBatches.failedFiles} + 1`,
              status: 'PROCESSING'
            })
            .where(eq(ingestionBatches.id, data.batchId));
        }
      }
    })();
    
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

certificatesRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const beforeCertificate = await storage.getCertificate(req.params.id);
    if (!beforeCertificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const certificate = await storage.updateCertificate(req.params.id, req.body);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    enqueueWebhookEvent('certificate.updated', 'certificate', certificate.id, {
      id: certificate.id,
      propertyId: certificate.propertyId,
      type: certificate.certificateType,
      status: certificate.status,
      outcome: certificate.outcome
    });
    
    await recordAudit({
      organisationId: certificate.organisationId,
      eventType: 'CERTIFICATE_STATUS_CHANGED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.fileName,
      propertyId: certificate.propertyId,
      beforeState: beforeCertificate,
      afterState: certificate,
      changes: getChanges(beforeCertificate, certificate),
      message: `Certificate "${certificate.fileName}" updated`,
      context: extractAuditContext(req),
    });
    
    res.json(certificate);
  } catch (error) {
    console.error("Error updating certificate:", error);
    res.status(500).json({ error: "Failed to update certificate" });
  }
});

certificatesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const deleted = await storage.deleteCertificate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    enqueueWebhookEvent('certificate.deleted', 'certificate', req.params.id, {
      id: req.params.id,
      propertyId: certificate.propertyId,
      type: certificate.certificateType
    });
    
    await recordAudit({
      organisationId: certificate.organisationId,
      eventType: 'CERTIFICATE_DELETED',
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.fileName,
      propertyId: certificate.propertyId,
      beforeState: certificate,
      message: `Certificate "${certificate.fileName}" deleted`,
      context: extractAuditContext(req),
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ error: "Failed to delete certificate" });
  }
});
