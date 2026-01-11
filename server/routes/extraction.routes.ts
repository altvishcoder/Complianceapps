import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { 
  extractionRuns, 
  humanReviews, 
  complianceRules, 
  normalisationRules, 
  certificates, 
  properties, 
  ingestionBatches 
} from "@shared/schema";
import { storage } from "../storage";
import { enqueueWebhookEvent } from "../webhook-worker";

export const extractionRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

// ===== EXTRACTION RUNS =====
extractionRouter.get("/extraction-runs", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    
    let runs;
    if (status) {
      runs = await db.select().from(extractionRuns)
        .where(eq(extractionRuns.status, status as any))
        .orderBy(desc(extractionRuns.createdAt));
    } else {
      runs = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
    }
    
    const enrichedRuns = await Promise.all(runs.map(async (run) => {
      const cert = await db.select().from(certificates).where(eq(certificates.id, run.certificateId)).limit(1);
      const certificate = cert[0];
      let property = null;
      if (certificate) {
        const props = await db.select().from(properties).where(eq(properties.id, certificate.propertyId)).limit(1);
        property = props[0];
      }
      return {
        ...run,
        certificate: certificate ? {
          ...certificate,
          property: property ? {
            addressLine1: property.addressLine1,
            postcode: property.postcode,
          } : null,
        } : null,
      };
    }));
    
    res.json(enrichedRuns);
  } catch (error) {
    console.error("Error fetching extraction runs:", error);
    res.status(500).json({ error: "Failed to fetch extraction runs" });
  }
});

extractionRouter.post("/extraction-runs/:id/approve", async (req, res) => {
  try {
    const { approvedOutput, errorTags, notes } = req.body;
    const orgId = getOrgId(req as AuthenticatedRequest);
    
    const [updated] = await db.update(extractionRuns)
      .set({ 
        status: 'APPROVED', 
        finalOutput: approvedOutput,
        updatedAt: new Date() 
      })
      .where(eq(extractionRuns.id, req.params.id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Extraction run not found" });
    }
    
    await db.insert(humanReviews).values({
      extractionRunId: req.params.id,
      reviewerId: 'system',
      organisationId: orgId,
      approvedOutput,
      errorTags: errorTags || [],
      wasCorrect: (errorTags || []).length === 0,
      changeCount: 0,
      reviewerNotes: notes,
    });
    
    if (updated.certificateId && approvedOutput) {
      const certificate = await storage.getCertificate(updated.certificateId);
      if (certificate) {
        const { generateRemedialActions } = await import("../extraction");
        const remedialActions = generateRemedialActions(
          approvedOutput, 
          certificate.certificateType || updated.documentType,
          certificate.propertyId
        );
        
        const severityMap: Record<string, string> = {
          'IMMEDIATE': 'IMMEDIATE',
          'URGENT': 'URGENT',
          'ROUTINE': 'ROUTINE',
          'ADVISORY': 'ADVISORY'
        };
        
        for (const action of remedialActions) {
          const daysToAdd = action.severity === "IMMEDIATE" ? 1 : 
                            action.severity === "URGENT" ? 7 : 
                            action.severity === "ROUTINE" ? 30 : 90;
          
          const createdAction = await storage.createRemedialAction({
            certificateId: updated.certificateId,
            propertyId: certificate.propertyId,
            code: action.code,
            description: action.description,
            location: action.location,
            severity: severityMap[action.severity] as any,
            status: "OPEN",
            dueDate: new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            costEstimate: action.costEstimate
          });
          
          enqueueWebhookEvent('action.created', 'remedialAction', createdAction.id, {
            id: createdAction.id,
            propertyId: createdAction.propertyId,
            code: createdAction.code,
            description: createdAction.description,
            severity: createdAction.severity,
            status: createdAction.status,
            dueDate: createdAction.dueDate
          });
        }
        
        const outcome = approvedOutput.findings?.outcome || approvedOutput.inspection?.outcome;
        if (outcome) {
          await storage.updateCertificate(updated.certificateId, {
            status: 'APPROVED',
            outcome: outcome.toUpperCase().includes('UNSATISFACTORY') ? 'UNSATISFACTORY' : 'SATISFACTORY'
          });
        } else {
          await storage.updateCertificate(updated.certificateId, { status: 'APPROVED' });
        }
      }
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Error approving extraction:", error);
    res.status(500).json({ error: "Failed to approve" });
  }
});

extractionRouter.post("/extraction-runs/:id/reject", async (req, res) => {
  try {
    const { reason, errorTags } = req.body;
    
    const [updated] = await db.update(extractionRuns)
      .set({ status: 'REJECTED', updatedAt: new Date() })
      .where(eq(extractionRuns.id, req.params.id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Extraction run not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Error rejecting extraction:", error);
    res.status(500).json({ error: "Failed to reject" });
  }
});

extractionRouter.post("/extraction-runs/migrate-normalize", async (req, res) => {
  try {
    const { normalizeExtractionOutput } = await import("../extraction");
    const runs = await db.select().from(extractionRuns);
    let migrated = 0;
    
    for (const run of runs) {
      if (run.rawOutput && (!run.normalisedOutput || Object.keys(run.normalisedOutput as any).length === 0)) {
        const normalized = normalizeExtractionOutput(run.rawOutput as Record<string, any>);
        await db.update(extractionRuns)
          .set({ normalisedOutput: normalized, updatedAt: new Date() })
          .where(eq(extractionRuns.id, run.id));
        migrated++;
      }
    }
    
    res.json({ success: true, migrated, total: runs.length });
  } catch (error) {
    console.error("Error migrating extraction runs:", error);
    res.status(500).json({ error: "Failed to migrate" });
  }
});

extractionRouter.post("/extraction-runs/reset-to-review", async (req, res) => {
  try {
    const { ids } = req.body;
    
    let updated;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      updated = [];
      for (const id of ids) {
        const [run] = await db.update(extractionRuns)
          .set({ status: 'AWAITING_REVIEW', updatedAt: new Date() })
          .where(eq(extractionRuns.id, id))
          .returning();
        if (run) updated.push(run);
      }
    } else {
      updated = await db.update(extractionRuns)
        .set({ status: 'AWAITING_REVIEW', updatedAt: new Date() })
        .where(eq(extractionRuns.status, 'APPROVED'))
        .returning();
    }
    
    console.log(`Reset ${updated.length} extraction runs to AWAITING_REVIEW`);
    res.json({ success: true, count: updated.length });
  } catch (error) {
    console.error("Error resetting extraction runs:", error);
    res.status(500).json({ error: "Failed to reset" });
  }
});

// ===== INGESTION BATCHES =====
extractionRouter.post("/batches", async (req, res) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const { name, totalFiles } = req.body;
    const now = new Date();
    const defaultName = name || `Manual Upload - ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const [batch] = await db.insert(ingestionBatches).values({
      organisationId: orgId,
      name: defaultName,
      totalFiles: totalFiles || 0,
      status: totalFiles > 0 ? 'PROCESSING' : 'PENDING',
    }).returning();
    res.status(201).json(batch);
  } catch (error) {
    console.error("Error creating batch:", error);
    res.status(500).json({ error: "Failed to create batch" });
  }
});

extractionRouter.get("/batches/:id", async (req, res) => {
  try {
    const [batch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, req.params.id));
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    
    const batchCerts = await db.select().from(certificates).where(eq(certificates.batchId, req.params.id));
    
    const completed = batchCerts.filter(c => c.status === 'APPROVED' || c.status === 'NEEDS_REVIEW' || c.status === 'EXTRACTED').length;
    const failed = batchCerts.filter(c => c.status === 'FAILED' || c.status === 'REJECTED').length;
    const processing = batchCerts.filter(c => c.status === 'PROCESSING' || c.status === 'UPLOADED').length;
    
    res.json({
      ...batch,
      certificates: batchCerts,
      progress: {
        total: batchCerts.length,
        completed,
        failed,
        processing,
      },
    });
  } catch (error) {
    console.error("Error getting batch:", error);
    res.status(500).json({ error: "Failed to get batch" });
  }
});

extractionRouter.get("/batches", async (req, res) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const batches = await db.select().from(ingestionBatches)
      .where(eq(ingestionBatches.organisationId, orgId))
      .orderBy(desc(ingestionBatches.createdAt))
      .limit(50);
    res.json(batches);
  } catch (error) {
    console.error("Error listing batches:", error);
    res.status(500).json({ error: "Failed to list batches" });
  }
});

extractionRouter.patch("/batches/:id", async (req, res) => {
  try {
    const orgId = getOrgId(req as AuthenticatedRequest);
    const { name } = req.body;
    const batch = await storage.getIngestionBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    if (batch.organisationId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = await storage.updateIngestionBatch(req.params.id, { name });
    res.json(updated);
  } catch (error) {
    console.error("Error updating batch:", error);
    res.status(500).json({ error: "Failed to update batch" });
  }
});

// ===== COMPLIANCE RULES =====
extractionRouter.get("/compliance-rules", async (req, res) => {
  try {
    const rules = await db.select().from(complianceRules).orderBy(desc(complianceRules.createdAt));
    res.json(rules);
  } catch (error) {
    console.error("Error fetching compliance rules:", error);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

extractionRouter.post("/compliance-rules", async (req, res) => {
  try {
    const [rule] = await db.insert(complianceRules).values(req.body).returning();
    res.status(201).json(rule);
  } catch (error) {
    console.error("Error creating compliance rule:", error);
    res.status(500).json({ error: "Failed to create rule" });
  }
});

extractionRouter.patch("/compliance-rules/:id", async (req, res) => {
  try {
    const [updated] = await db.update(complianceRules)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(complianceRules.id, req.params.id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error updating compliance rule:", error);
    res.status(500).json({ error: "Failed to update rule" });
  }
});

extractionRouter.delete("/compliance-rules/:id", async (req, res) => {
  try {
    await db.delete(complianceRules).where(eq(complianceRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting compliance rule:", error);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

// ===== NORMALISATION RULES =====
extractionRouter.get("/normalisation-rules", async (req, res) => {
  try {
    const rules = await db.select().from(normalisationRules).orderBy(desc(normalisationRules.priority));
    res.json(rules);
  } catch (error) {
    console.error("Error fetching normalisation rules:", error);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

extractionRouter.post("/normalisation-rules", async (req, res) => {
  try {
    const [rule] = await db.insert(normalisationRules).values(req.body).returning();
    res.status(201).json(rule);
  } catch (error) {
    console.error("Error creating normalisation rule:", error);
    res.status(500).json({ error: "Failed to create rule" });
  }
});

extractionRouter.patch("/normalisation-rules/:id", async (req, res) => {
  try {
    const [updated] = await db.update(normalisationRules)
      .set(req.body)
      .where(eq(normalisationRules.id, req.params.id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error updating normalisation rule:", error);
    res.status(500).json({ error: "Failed to update rule" });
  }
});

extractionRouter.delete("/normalisation-rules/:id", async (req, res) => {
  try {
    await db.delete(normalisationRules).where(eq(normalisationRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting normalisation rule:", error);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});
