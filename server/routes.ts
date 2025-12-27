import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSchemeSchema, insertBlockSchema, insertPropertySchema, 
  insertCertificateSchema, insertExtractionSchema, insertRemedialActionSchema,
  extractionRuns, humanReviews, complianceRules, normalisationRules, certificates, properties, ingestionBatches
} from "@shared/schema";
import { z } from "zod";
import { processExtractionAndSave } from "./extraction";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";

const objectStorageService = new ObjectStorageService();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Hard-coded organisation ID for demo (in production this would come from auth)
  const ORG_ID = "default-org";
  
  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // ===== SCHEMES =====
  app.get("/api/schemes", async (req, res) => {
    try {
      const schemes = await storage.listSchemes(ORG_ID);
      res.json(schemes);
    } catch (error) {
      console.error("Error fetching schemes:", error);
      res.status(500).json({ error: "Failed to fetch schemes" });
    }
  });
  
  app.post("/api/schemes", async (req, res) => {
    try {
      const data = insertSchemeSchema.parse({ ...req.body, organisationId: ORG_ID });
      const scheme = await storage.createScheme(data);
      res.status(201).json(scheme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating scheme:", error);
        res.status(500).json({ error: "Failed to create scheme" });
      }
    }
  });
  
  // ===== BLOCKS =====
  app.get("/api/blocks", async (req, res) => {
    try {
      const schemeId = req.query.schemeId as string | undefined;
      const blocks = await storage.listBlocks(schemeId);
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching blocks:", error);
      res.status(500).json({ error: "Failed to fetch blocks" });
    }
  });
  
  app.post("/api/blocks", async (req, res) => {
    try {
      const data = insertBlockSchema.parse(req.body);
      const block = await storage.createBlock(data);
      res.status(201).json(block);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating block:", error);
        res.status(500).json({ error: "Failed to create block" });
      }
    }
  });
  
  // ===== PROPERTIES =====
  app.get("/api/properties", async (req, res) => {
    try {
      const blockId = req.query.blockId as string | undefined;
      const schemeId = req.query.schemeId as string | undefined;
      const properties = await storage.listProperties(ORG_ID, { blockId, schemeId });
      
      // Enrich properties with block and scheme information
      const enrichedProperties = await Promise.all(properties.map(async (prop) => {
        const block = await storage.getBlock(prop.blockId);
        const scheme = block ? await storage.getScheme(block.schemeId) : null;
        return {
          ...prop,
          block,
          scheme,
          fullAddress: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
        };
      }));
      
      res.json(enrichedProperties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });
  
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      // Get related data
      const block = await storage.getBlock(property.blockId);
      const scheme = block ? await storage.getScheme(block.schemeId) : null;
      const certificates = await storage.listCertificates(ORG_ID, { propertyId: property.id });
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId: property.id });
      
      res.json({
        ...property,
        block,
        scheme,
        certificates,
        actions,
      });
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });
  
  app.post("/api/properties", async (req, res) => {
    try {
      const data = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(data);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating property:", error);
        res.status(500).json({ error: "Failed to create property" });
      }
    }
  });
  
  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const updates = req.body;
      const property = await storage.updateProperty(req.params.id, updates);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });
  
  // Bulk delete properties
  app.post("/api/properties/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const deleted = await storage.bulkDeleteProperties(ids);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting properties:", error);
      res.status(500).json({ error: "Failed to delete properties" });
    }
  });
  
  // Bulk verify properties
  app.post("/api/properties/bulk-verify", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const verified = await storage.bulkVerifyProperties(ids);
      res.json({ success: true, verified });
    } catch (error) {
      console.error("Error bulk verifying properties:", error);
      res.status(500).json({ error: "Failed to verify properties" });
    }
  });
  
  // Bulk reject properties (delete properties and associated data)
  app.post("/api/properties/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const rejected = await storage.bulkRejectProperties(ids);
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting properties:", error);
      res.status(500).json({ error: "Failed to reject properties" });
    }
  });
  
  // Auto-create property from extracted address
  app.post("/api/properties/auto-create", async (req, res) => {
    try {
      const { addressLine1, city, postcode } = req.body;
      if (!addressLine1) {
        return res.status(400).json({ error: "Address is required" });
      }
      const property = await storage.getOrCreateAutoProperty(ORG_ID, { addressLine1, city, postcode });
      res.json(property);
    } catch (error) {
      console.error("Error auto-creating property:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });
  
  // ===== CERTIFICATES =====
  app.get("/api/certificates", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const certificates = await storage.listCertificates(ORG_ID, { propertyId, status });
      
      // Enrich with property and extraction data
      const enrichedCertificates = await Promise.all(certificates.map(async (cert) => {
        const property = await storage.getProperty(cert.propertyId);
        const extraction = await storage.getExtractionByCertificate(cert.id);
        return {
          ...cert,
          property,
          extractedData: extraction?.extractedData,
        };
      }));
      
      res.json(enrichedCertificates);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  
  app.get("/api/certificates/:id", async (req, res) => {
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
  
  app.post("/api/certificates", async (req, res) => {
    try {
      const { fileBase64, mimeType, batchId, ...certificateData } = req.body;
      
      const data = insertCertificateSchema.parse({
        ...certificateData,
        organisationId: ORG_ID,
        status: "PROCESSING",
        batchId: batchId || null,
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
          
          // Update batch progress on success
          if (data.batchId) {
            await db.update(ingestionBatches)
              .set({ 
                completedFiles: sql`${ingestionBatches.completedFiles} + 1`,
                status: 'PROCESSING'
              })
              .where(eq(ingestionBatches.id, data.batchId));
          }
        } catch (err) {
          console.error("Error in AI extraction:", err);
          
          // Update batch progress on failure
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
  
  app.patch("/api/certificates/:id", async (req, res) => {
    try {
      const updates = req.body;
      const certificate = await storage.updateCertificate(req.params.id, updates);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });
  
  // ===== REMEDIAL ACTIONS =====
  app.get("/api/actions", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId, status });
      
      // Enrich with property and certificate data
      const enrichedActions = await Promise.all(actions.map(async (action) => {
        const property = await storage.getProperty(action.propertyId);
        const certificate = await storage.getCertificate(action.certificateId);
        return {
          ...action,
          property,
          certificate,
        };
      }));
      
      res.json(enrichedActions);
    } catch (error) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });
  
  app.patch("/api/actions/:id", async (req, res) => {
    try {
      const updates = req.body;
      
      // Set resolvedAt when marking as completed
      if (updates.status === 'COMPLETED' || updates.status === 'completed') {
        updates.status = 'COMPLETED';
        updates.resolvedAt = new Date().toISOString();
      }
      
      const action = await storage.updateRemedialAction(req.params.id, updates);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(action);
    } catch (error) {
      console.error("Error updating action:", error);
      res.status(500).json({ error: "Failed to update action" });
    }
  });
  
  // ===== ADMIN / DEMO DATA MANAGEMENT =====
  
  // Wipe all data (certificates, actions, extractions)
  app.post("/api/admin/wipe-data", async (req, res) => {
    try {
      const { includeProperties } = req.body || {};
      await storage.wipeData(includeProperties === true);
      res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
    } catch (error) {
      console.error("Error wiping data:", error);
      res.status(500).json({ error: "Failed to wipe data" });
    }
  });
  
  // Seed demo data (schemes, blocks, properties)
  app.post("/api/admin/seed-demo", async (req, res) => {
    try {
      await storage.seedDemoData(ORG_ID);
      res.json({ success: true, message: "Demo data seeded successfully" });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });
  
  // Reset demo (wipe all + reseed)
  app.post("/api/admin/reset-demo", async (req, res) => {
    try {
      await storage.wipeData(true);
      await storage.seedDemoData(ORG_ID);
      res.json({ success: true, message: "Demo reset complete" });
    } catch (error) {
      console.error("Error resetting demo:", error);
      res.status(500).json({ error: "Failed to reset demo" });
    }
  });
  
  // Reclassify existing certificates based on extracted document type
  app.post("/api/admin/reclassify-certificates", async (req, res) => {
    try {
      const allCertificates = await storage.listCertificates(ORG_ID);
      let updated = 0;
      let skipped = 0;
      
      const typeMap: Record<string, 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER'> = {};
      
      for (const cert of allCertificates) {
        // Skip if already classified
        if (cert.certificateType !== 'OTHER') {
          skipped++;
          continue;
        }
        
        // Look for extracted document type in property metadata
        const property = await storage.getProperty(cert.propertyId);
        const docType = property?.extractedMetadata?.documentType || 
                        (cert as any).extractedData?.documentType;
        
        if (!docType) {
          skipped++;
          continue;
        }
        
        const docTypeLower = docType.toLowerCase();
        let newType: typeof typeMap[string] | undefined;
        
        if (docTypeLower.includes('gas safety') || docTypeLower.includes('lgsr') || docTypeLower.includes('cp12') || docTypeLower.includes('landlord gas')) {
          newType = 'GAS_SAFETY';
        } else if (docTypeLower.includes('eicr') || docTypeLower.includes('electrical installation') || docTypeLower.includes('electrical condition')) {
          newType = 'EICR';
        } else if (docTypeLower.includes('fire risk') || docTypeLower.includes('fra') || docTypeLower.includes('fire safety')) {
          newType = 'FIRE_RISK_ASSESSMENT';
        } else if (docTypeLower.includes('asbestos')) {
          newType = 'ASBESTOS_SURVEY';
        } else if (docTypeLower.includes('legionella') || docTypeLower.includes('water hygiene') || docTypeLower.includes('water risk')) {
          newType = 'LEGIONELLA_ASSESSMENT';
        } else if (docTypeLower.includes('lift') || docTypeLower.includes('loler') || docTypeLower.includes('elevator')) {
          newType = 'LIFT_LOLER';
        } else if (docTypeLower.includes('energy performance') || docTypeLower.includes('epc')) {
          newType = 'EPC';
        }
        
        if (newType) {
          await storage.updateCertificate(cert.id, { certificateType: newType });
          updated++;
          console.log(`Reclassified certificate ${cert.id}: ${docType} -> ${newType}`);
        } else {
          skipped++;
        }
      }
      
      res.json({ success: true, updated, skipped, total: allCertificates.length });
    } catch (error) {
      console.error("Error reclassifying certificates:", error);
      res.status(500).json({ error: "Failed to reclassify certificates" });
    }
  });

  // ===== LASHAN OWNED MODEL: MODEL INSIGHTS =====
  app.get("/api/model-insights", async (req, res) => {
    try {
      const allRuns = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      const allReviews = await db.select().from(humanReviews).orderBy(desc(humanReviews.reviewedAt));
      
      const totalRuns = allRuns.length;
      const approvedRuns = allRuns.filter(r => r.status === 'APPROVED').length;
      const accuracy = totalRuns > 0 ? approvedRuns / totalRuns : 0;
      
      const errorTags: Record<string, number> = {};
      allReviews.forEach(review => {
        (review.errorTags || []).forEach((tag: string) => {
          errorTags[tag] = (errorTags[tag] || 0) + 1;
        });
      });
      
      const topTags = Object.entries(errorTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count, trend: 0 }));
      
      const byDocType = Object.entries(
        allRuns.reduce((acc, run) => {
          if (!acc[run.documentType]) acc[run.documentType] = { total: 0, approved: 0 };
          acc[run.documentType].total++;
          if (run.status === 'APPROVED') acc[run.documentType].approved++;
          return acc;
        }, {} as Record<string, { total: number; approved: number }>)
      ).map(([type, data]) => ({
        type: type.replace(/_/g, ' '),
        accuracy: data.total > 0 ? (data.approved / data.total) * 100 : 0,
        count: data.total
      }));
      
      res.json({
        accuracy: {
          overall: accuracy,
          trend: 0,
          byDocType,
          byWeek: [],
        },
        errors: {
          topTags,
          recentExamples: allReviews.slice(0, 10).map(r => ({
            id: r.id,
            field: 'various',
            tag: (r.errorTags || [])[0] || 'unknown',
            docType: 'Certificate'
          })),
        },
        improvements: {
          queue: topTags.slice(0, 5).map((t, i) => ({
            id: `imp-${i}`,
            issue: `Fix ${t.tag} errors`,
            occurrences: t.count,
            suggestedFix: `Review and update extraction prompt to handle ${t.tag.replace(/_/g, ' ')} cases`,
            priority: i < 2 ? 'high' : 'medium'
          })),
          recentWins: [],
        },
        benchmarks: {
          latest: { score: accuracy * 100, date: new Date().toISOString(), passed: accuracy >= 0.8 },
          trend: [],
        },
        extractionStats: {
          total: totalRuns,
          pending: allRuns.filter(r => r.status === 'PENDING').length,
          approved: approvedRuns,
          awaitingReview: allRuns.filter(r => r.status === 'AWAITING_REVIEW').length,
          failed: allRuns.filter(r => r.status === 'VALIDATION_FAILED' || r.status === 'REJECTED').length,
        },
      });
    } catch (error) {
      console.error("Error fetching model insights:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });
  
  app.post("/api/model-insights/run-benchmark", async (req, res) => {
    try {
      const allRuns = await db.select().from(extractionRuns);
      const approved = allRuns.filter(r => r.status === 'APPROVED').length;
      const score = allRuns.length > 0 ? (approved / allRuns.length) * 100 : 0;
      res.json({ score, passed: score >= 80, date: new Date().toISOString() });
    } catch (error) {
      console.error("Error running benchmark:", error);
      res.status(500).json({ error: "Failed to run benchmark" });
    }
  });
  
  app.post("/api/model-insights/export-training-data", async (req, res) => {
    try {
      const reviews = await db.select().from(humanReviews).orderBy(desc(humanReviews.reviewedAt));
      const trainingData = reviews.map(r => JSON.stringify({
        input: {},
        output: r.approvedOutput,
        changes: r.fieldChanges,
        errorTags: r.errorTags,
      })).join('\n');
      
      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', 'attachment; filename=training-data.jsonl');
      res.send(trainingData || '{}');
    } catch (error) {
      console.error("Error exporting training data:", error);
      res.status(500).json({ error: "Failed to export" });
    }
  });
  
  // ===== LASHAN OWNED MODEL: EXTRACTION RUNS =====
  app.get("/api/extraction-runs", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      let query = db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      
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
  
  app.post("/api/extraction-runs/:id/approve", async (req, res) => {
    try {
      const { approvedOutput, errorTags, notes } = req.body;
      
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
        organisationId: ORG_ID,
        approvedOutput,
        errorTags: errorTags || [],
        wasCorrect: (errorTags || []).length === 0,
        changeCount: 0,
        reviewerNotes: notes,
      });
      
      // Create remedial actions from approved output if there are defects/findings
      if (updated.certificateId && approvedOutput) {
        const certificate = await storage.getCertificate(updated.certificateId);
        if (certificate) {
          const { generateRemedialActions } = await import("./extraction");
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
            
            await storage.createRemedialAction({
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
          }
          
          // Update certificate status and outcome if applicable
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
  
  app.post("/api/extraction-runs/:id/reject", async (req, res) => {
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
  
  // Reset specific extraction runs to awaiting review (with audit)
  // Migrate existing extraction runs to use normalized output
  app.post("/api/extraction-runs/migrate-normalize", async (req, res) => {
    try {
      const { normalizeExtractionOutput } = await import("./extraction");
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
  
  app.post("/api/extraction-runs/reset-to-review", async (req, res) => {
    try {
      const { ids } = req.body;
      
      let updated;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        // Reset only specified runs
        updated = [];
        for (const id of ids) {
          const [run] = await db.update(extractionRuns)
            .set({ status: 'AWAITING_REVIEW', updatedAt: new Date() })
            .where(eq(extractionRuns.id, id))
            .returning();
          if (run) updated.push(run);
        }
      } else {
        // Reset all approved runs (bulk operation for initial setup)
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
  // Create a new batch
  app.post("/api/batches", async (req, res) => {
    try {
      const { name, totalFiles } = req.body;
      const [batch] = await db.insert(ingestionBatches).values({
        organisationId: ORG_ID,
        name: name || `Batch ${new Date().toISOString()}`,
        totalFiles: totalFiles || 0,
        status: 'PENDING',
      }).returning();
      res.status(201).json(batch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ error: "Failed to create batch" });
    }
  });
  
  // Get batch progress
  app.get("/api/batches/:id", async (req, res) => {
    try {
      const [batch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, req.params.id));
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      
      // Get certificates in this batch
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
  
  // List active batches
  app.get("/api/batches", async (req, res) => {
    try {
      const batches = await db.select().from(ingestionBatches).orderBy(desc(ingestionBatches.createdAt)).limit(20);
      res.json(batches);
    } catch (error) {
      console.error("Error listing batches:", error);
      res.status(500).json({ error: "Failed to list batches" });
    }
  });
  
  // ===== LASHAN OWNED MODEL: COMPLIANCE RULES =====
  app.get("/api/compliance-rules", async (req, res) => {
    try {
      const rules = await db.select().from(complianceRules).orderBy(desc(complianceRules.createdAt));
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });
  
  app.post("/api/compliance-rules", async (req, res) => {
    try {
      const [rule] = await db.insert(complianceRules).values(req.body).returning();
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating compliance rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });
  
  app.patch("/api/compliance-rules/:id", async (req, res) => {
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
  
  app.delete("/api/compliance-rules/:id", async (req, res) => {
    try {
      await db.delete(complianceRules).where(eq(complianceRules.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });
  
  // ===== LASHAN OWNED MODEL: NORMALISATION RULES =====
  app.get("/api/normalisation-rules", async (req, res) => {
    try {
      const rules = await db.select().from(normalisationRules).orderBy(desc(normalisationRules.priority));
      res.json(rules);
    } catch (error) {
      console.error("Error fetching normalisation rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });
  
  app.post("/api/normalisation-rules", async (req, res) => {
    try {
      const [rule] = await db.insert(normalisationRules).values(req.body).returning();
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating normalisation rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });
  
  app.patch("/api/normalisation-rules/:id", async (req, res) => {
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
  
  app.delete("/api/normalisation-rules/:id", async (req, res) => {
    try {
      await db.delete(normalisationRules).where(eq(normalisationRules.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting normalisation rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });
  
  // ===== DASHBOARD STATS =====
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const allCertificates = await storage.listCertificates(ORG_ID);
      const allActions = await storage.listRemedialActions(ORG_ID);
      const allProperties = await storage.listProperties(ORG_ID);
      
      // Calculate compliance rate
      const totalCerts = allCertificates.length;
      const validCerts = allCertificates.filter(c => 
        c.status === 'APPROVED' || c.outcome === 'SATISFACTORY'
      ).length;
      const complianceRate = totalCerts > 0 ? ((validCerts / totalCerts) * 100).toFixed(1) : '0';
      
      // Active hazards (open remedial actions)
      const activeHazards = allActions.filter(a => a.status === 'OPEN').length;
      const immediateHazards = allActions.filter(a => 
        a.status === 'OPEN' && a.severity === 'IMMEDIATE'
      ).length;
      
      // Pending certificates (UPLOADED or PROCESSING or NEEDS_REVIEW status)
      const pendingCerts = allCertificates.filter(c => 
        c.status === 'UPLOADED' || c.status === 'PROCESSING' || c.status === 'NEEDS_REVIEW'
      ).length;
      
      // Compliance by type - use correct enum values: 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER'
      const certTypes = ['GAS_SAFETY', 'EICR', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'LIFT_LOLER', 'ASBESTOS_SURVEY'];
      const complianceByType = certTypes.map(type => {
        const typeCerts = allCertificates.filter(c => c.certificateType === type);
        const typeValid = typeCerts.filter(c => c.status === 'APPROVED' || c.outcome === 'SATISFACTORY').length;
        const typeInvalid = typeCerts.filter(c => c.outcome === 'UNSATISFACTORY').length;
        const typePending = typeCerts.filter(c => c.status === 'NEEDS_REVIEW' || c.status === 'PROCESSING').length;
        return {
          type: type.replace(/_/g, ' '),
          total: typeCerts.length,
          compliant: typeCerts.length > 0 ? Math.round((typeValid / typeCerts.length) * 100) : 0,
          nonCompliant: typeCerts.length > 0 ? Math.round((typeInvalid / typeCerts.length) * 100) : 0,
          pending: typeCerts.length > 0 ? Math.round((typePending / typeCerts.length) * 100) : 0,
        };
      }).filter(t => t.total > 0); // Only include types that have at least 1 certificate
      
      // Hazard distribution by category
      const hazardCategories = allActions.filter(a => a.status === 'OPEN').reduce((acc, action) => {
        const category = action.category || 'Other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      res.json({
        overallCompliance: complianceRate,
        activeHazards,
        immediateHazards,
        awaabsLawBreaches: 0, // Placeholder
        pendingCertificates: pendingCerts,
        totalProperties: allProperties.length,
        totalCertificates: totalCerts,
        complianceByType,
        hazardDistribution: Object.entries(hazardCategories).map(([name, value]) => ({ name, value })),
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  
  return httpServer;
}
