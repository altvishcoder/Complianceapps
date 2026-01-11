import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCertificateSchema, ingestionBatches, certificates } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq, sql, and } from "drizzle-orm";
import { processExtractionAndSave } from "../extraction";
import { enqueueWebhookEvent } from "../webhook-worker";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { handleRouteError } from "../errors";

export const certificatesRouter = Router();

const objectStorageService = new ObjectStorageService();

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || "default-org";
}

certificatesRouter.get("/stats", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const typesParam = req.query.types as string | undefined;
    const typesList = typesParam ? typesParam.split(',').filter(Boolean) : null;
    
    let typeCondition = sql`1=1`;
    if (typesList && typesList.length > 0) {
      const typesArrayLiteral = `{${typesList.join(',')}}`;
      typeCondition = sql`${certificates.certificateType}::text = ANY(${typesArrayLiteral}::text[])`;
    }
    
    const [certStats] = await db.select({
      expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
      expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
      pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
    })
    .from(certificates)
    .where(and(eq(certificates.organisationId, orgId), typeCondition));
    
    res.json({
      expired: Number(certStats?.expired || 0),
      expiringSoon: Number(certStats?.expiringSoon || 0),
      pendingReview: Number(certStats?.pendingReview || 0),
      approved: Number(certStats?.approved || 0),
    });
  } catch (error) {
    handleRouteError(error, req, res, "Certificate Statistics");
  }
});

certificatesRouter.get("/", paginationMiddleware(), async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    const typesParam = req.query.types as string | undefined;
    const typesList = typesParam ? typesParam.split(',').filter(Boolean) : undefined;
    const expired = req.query.expired === 'true';
    const expiring = req.query.expiring === 'true';
    
    const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
    const isPendingFilter = status === 'PENDING';
    
    const { data, total } = await storage.listCertificatesPaginated(orgId, {
      propertyId,
      status: isPendingFilter ? PENDING_STATUSES : status,
      search,
      limit,
      offset,
      types: typesList,
      expired,
      expiring,
    });
    
    const enrichedCertificates = data.map(cert => ({
      ...cert,
      extractedData: cert.extraction?.extractedData,
    }));
    
    let stats;
    if (typesList && typesList.length > 0) {
      const [certStats] = await db.select({
        expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
        expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
        pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
      })
      .from(certificates)
      .where(and(
        eq(certificates.organisationId, orgId),
        sql`${certificates.certificateType}::text = ANY(${`{${typesList.join(',')}}`}::text[])`
      ));
      
      stats = {
        expired: Number(certStats?.expired || 0),
        expiringSoon: Number(certStats?.expiringSoon || 0),
        pendingReview: Number(certStats?.pendingReview || 0),
        approved: Number(certStats?.approved || 0),
      };
    } else {
      const { getCertificateStats } = await import('../reporting/materialized-views');
      stats = await getCertificateStats(orgId);
      
      if (!stats) {
        const [certStats] = await db.select({
          expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
          expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
          pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
          approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
        })
        .from(certificates)
        .where(eq(certificates.organisationId, orgId));
        
        stats = {
          expired: Number(certStats?.expired || 0),
          expiringSoon: Number(certStats?.expiringSoon || 0),
          pendingReview: Number(certStats?.pendingReview || 0),
          approved: Number(certStats?.approved || 0),
        };
      }
    }
    
    res.json({ data: enrichedCertificates, total, page, limit, totalPages: Math.ceil(total / limit), stats });
  } catch (error) {
    handleRouteError(error, req, res, "Certificates");
  }
});

certificatesRouter.get("/cursor", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    
    const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
    const isPendingFilter = status === 'PENDING';
    
    const result = await storage.listCertificatesCursor(orgId, {
      propertyId,
      status: isPendingFilter ? PENDING_STATUSES : status,
      search,
      limit,
      cursor,
    });
    
    const enrichedCertificates = result.data.map(cert => ({
      ...cert,
      extractedData: cert.extraction?.extractedData,
    }));
    
    res.json({
      data: enrichedCertificates,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      limit,
    });
  } catch (error) {
    handleRouteError(error, req, res, "Certificates");
  }
});

certificatesRouter.get("/:id", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const property = await storage.getProperty(certificate.propertyId);
    const extraction = await storage.getExtractionByCertificate(certificate.id);
    const actions = await storage.listRemedialActions(orgId, { certificateId: certificate.id });
    
    res.json({
      ...certificate,
      property,
      extraction,
      extractedData: extraction?.extractedData,
      actions,
    });
  } catch (error) {
    handleRouteError(error, req, res, "Certificate");
  }
});

certificatesRouter.post("/", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const { fileBase64, mimeType, batchId, ...certificateData } = req.body;
    
    let finalBatchId = batchId;
    if (!batchId) {
      const now = new Date();
      const batchName = `Manual Upload - ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      const batch = await storage.createIngestionBatch({
        organisationId: orgId,
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
      organisationId: orgId,
      status: "PROCESSING",
      batchId: finalBatchId,
    });
    
    const certificate = await storage.createCertificate(data);
    
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
            console.log(`Downloaded PDF from storage: ${pdfBuffer.length} bytes`);
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
          
          const [freshBatch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, data.batchId));
          
          if (freshBatch && freshBatch.completedFiles + freshBatch.failedFiles >= freshBatch.totalFiles) {
            const finalStatus = freshBatch.completedFiles === 0 ? 'FAILED' : 'PARTIAL';
            await db.update(ingestionBatches)
              .set({ status: finalStatus, updatedAt: new Date() })
              .where(eq(ingestionBatches.id, data.batchId));
          }
        }
      }
    })();
    
    res.status(201).json(certificate);
  } catch (error) {
    handleRouteError(error, req, res, "Certificate");
  }
});

certificatesRouter.patch("/:id", async (req, res: Response) => {
  try {
    const updates = req.body;
    const beforeCert = await storage.getCertificate(req.params.id);
    if (!beforeCert) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const certificate = await storage.updateCertificate(req.params.id, updates);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    let eventType: 'CERTIFICATE_STATUS_CHANGED' | 'CERTIFICATE_APPROVED' | 'CERTIFICATE_REJECTED' = 'CERTIFICATE_STATUS_CHANGED';
    let message = `Certificate updated`;
    
    if (updates.status === 'APPROVED' && beforeCert.status !== 'APPROVED') {
      eventType = 'CERTIFICATE_APPROVED';
      message = `Certificate ${certificate.certificateType} approved`;
    } else if (updates.status === 'REJECTED' && beforeCert.status !== 'REJECTED') {
      eventType = 'CERTIFICATE_REJECTED';
      message = `Certificate ${certificate.certificateType} rejected`;
    } else if (updates.status && updates.status !== beforeCert.status) {
      message = `Certificate status changed from ${beforeCert.status} to ${updates.status}`;
    }
    
    await recordAudit({
      organisationId: certificate.organisationId,
      eventType,
      entityType: 'CERTIFICATE',
      entityId: certificate.id,
      entityName: certificate.fileName,
      propertyId: certificate.propertyId,
      certificateId: certificate.id,
      beforeState: beforeCert,
      afterState: certificate,
      changes: getChanges(beforeCert, certificate),
      message,
      context: extractAuditContext(req),
    });
    
    res.json(certificate);
  } catch (error) {
    handleRouteError(error, req, res, "Certificate");
  }
});

certificatesRouter.delete("/:id", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
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
    handleRouteError(error, req, res, "Certificate");
  }
});

certificatesRouter.get("/:id/extraction-audit", async (req, res: Response) => {
  try {
    const { getTierAuditForCertificate } = await import('../services/extraction/orchestrator');
    const audits = await getTierAuditForCertificate(req.params.id);
    res.json({
      certificateId: req.params.id,
      tierProgression: audits,
      totalTiers: audits.length,
      finalTier: audits.length > 0 ? audits[audits.length - 1].tier : null,
      totalCost: audits.reduce((sum, a) => sum + (a.cost || 0), 0),
      totalProcessingTimeMs: audits.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0),
    });
  } catch (error) {
    handleRouteError(error, req, res, "Extraction Audit");
  }
});

certificatesRouter.post("/:id/reprocess", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    if (certificate.organisationId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (certificate.status !== 'FAILED' && certificate.status !== 'REJECTED' && certificate.status !== 'NEEDS_REVIEW') {
      return res.status(400).json({ error: "Only failed, rejected, or needs review certificates can be reprocessed" });
    }
    
    let fileBuffer: Buffer | undefined;
    
    if (certificate.storageKey) {
      try {
        const file = await objectStorageService.getObjectEntityFile(certificate.storageKey);
        if (file) {
          const chunks: Buffer[] = [];
          const stream = file.createReadStream();
          
          await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => resolve());
            stream.on('error', reject);
          });
          
          fileBuffer = Buffer.concat(chunks);
        }
      } catch (error) {
        console.error("Error retrieving file for reprocessing:", error);
      }
    }
    
    if (!fileBuffer) {
      return res.status(400).json({ error: "Could not retrieve file for reprocessing" });
    }
    
    await storage.updateCertificate(certificate.id, { status: 'PROCESSING' });
    
    (async () => {
      try {
        const { extractCertificate } = await import('../services/extraction/orchestrator');
        const result = await extractCertificate(
          String(certificate.id),
          fileBuffer!,
          certificate.fileType || 'application/pdf',
          certificate.fileName || 'document.pdf',
          { forceAI: true }
        );
        
        if (result.success) {
          await storage.updateCertificate(certificate.id, {
            status: 'NEEDS_REVIEW',
          } as any);
        } else {
          await storage.updateCertificate(certificate.id, { 
            status: 'FAILED', 
          } as any);
        }
      } catch (error) {
        console.error("Error during certificate reprocessing:", error);
        await storage.updateCertificate(certificate.id, { 
          status: 'FAILED', 
        } as any);
      }
    })();
    
    res.json({ 
      success: true, 
      message: "Certificate reprocessing started", 
      certificateId: certificate.id
    });
  } catch (error) {
    handleRouteError(error, req, res, "Certificate Reprocessing");
  }
});

certificatesRouter.get("/ingestion/batches", async (req, res: Response) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    
    const batches = await db.select()
      .from(ingestionBatches)
      .where(eq(ingestionBatches.organisationId, orgId))
      .orderBy(sql`created_at DESC`)
      .limit(50);
    
    res.json(batches);
  } catch (error) {
    handleRouteError(error, req, res, "Ingestion Batches");
  }
});

certificatesRouter.get("/ingestion/batches/:id", async (req, res: Response) => {
  try {
    const [batch] = await db.select()
      .from(ingestionBatches)
      .where(eq(ingestionBatches.id, req.params.id));
    
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    
    res.json(batch);
  } catch (error) {
    handleRouteError(error, req, res, "Ingestion Batch");
  }
});
