import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSchemeSchema, insertBlockSchema, insertPropertySchema, 
  insertCertificateSchema, insertExtractionSchema, insertRemedialActionSchema, insertContractorSchema,
  insertCertificateTypeSchema, insertClassificationCodeSchema, insertExtractionSchemaSchema,
  insertComplianceRuleSchema, insertNormalisationRuleSchema,
  insertComponentTypeSchema, insertUnitSchema, insertComponentSchema, insertDataImportSchema,
  extractionRuns, humanReviews, complianceRules, normalisationRules, certificates, properties, ingestionBatches,
  componentTypes, components, units, componentCertificates
} from "@shared/schema";
import { z } from "zod";
import { processExtractionAndSave } from "./extraction";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { db } from "./db";
import { eq, desc, and, count, sql, isNotNull, lt, gte } from "drizzle-orm";
import { addSSEClient, removeSSEClient } from "./events";
import { 
  parseCSV, 
  validateImportData, 
  processPropertyImport, 
  processUnitImport, 
  processComponentImport,
  generateCSVTemplate
} from "./import-parser";
import { enqueueWebhookEvent } from "./webhook-worker";

const objectStorageService = new ObjectStorageService();

// Seed default component types if they don't exist
async function seedDefaultComponentTypes() {
  const existing = await db.select().from(componentTypes);
  if (existing.length > 0) {
    console.log(`Component types already seeded: ${existing.length} types exist`);
    return;
  }
  
  const defaultTypes = [
    { code: 'GAS_BOILER', name: 'Gas Boiler', category: 'HEATING', description: 'Gas-fired central heating boiler', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 1 },
    { code: 'GAS_FIRE', name: 'Gas Fire', category: 'HEATING', description: 'Gas-fired room heater', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 2 },
    { code: 'GAS_COOKER', name: 'Gas Cooker', category: 'HEATING', description: 'Gas cooking appliance', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 3 },
    { code: 'CONSUMER_UNIT', name: 'Consumer Unit', category: 'ELECTRICAL', description: 'Main electrical distribution board', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 10 },
    { code: 'ELECTRICAL_WIRING', name: 'Electrical Wiring', category: 'ELECTRICAL', description: 'Fixed electrical installation wiring', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 11 },
    { code: 'SMOKE_DETECTOR', name: 'Smoke Detector', category: 'FIRE_SAFETY', description: 'Smoke detection alarm device', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 20 },
    { code: 'FIRE_DOOR', name: 'Fire Door', category: 'FIRE_SAFETY', description: 'Fire-rated door assembly', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 21 },
    { code: 'FIRE_ALARM_SYSTEM', name: 'Fire Alarm System', category: 'FIRE_SAFETY', description: 'Fire detection and alarm system', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 22 },
    { code: 'WATER_TANK', name: 'Water Storage Tank', category: 'WATER', description: 'Cold or hot water storage tank', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 30 },
    { code: 'WATER_HEATER', name: 'Water Heater', category: 'WATER', description: 'Electric or gas water heating appliance', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 31 },
    { code: 'PASSENGER_LIFT', name: 'Passenger Lift', category: 'ACCESS', description: 'Passenger elevator', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 40 },
    { code: 'STAIRLIFT', name: 'Stairlift', category: 'ACCESS', description: 'Stair climbing lift', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 41 },
    { code: 'ROOF_STRUCTURE', name: 'Roof Structure', category: 'STRUCTURE', description: 'Main roof structure and covering', isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 50 },
    { code: 'ASBESTOS_MATERIAL', name: 'Asbestos Containing Material', category: 'STRUCTURE', description: 'Identified asbestos containing material', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 51 },
  ];
  
  for (const type of defaultTypes) {
    try {
      await db.insert(componentTypes).values({
        code: type.code,
        name: type.name,
        category: type.category as any,
        description: type.description,
        isHighRisk: type.isHighRisk,
        buildingSafetyRelevant: type.buildingSafetyRelevant,
        displayOrder: type.displayOrder,
        isActive: true,
      });
    } catch (e) {
      // Ignore duplicate key errors
    }
  }
  console.log('Seeded default component types');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed default component types on startup
  await seedDefaultComponentTypes();
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Hard-coded organisation ID for demo (in production this would come from auth)
  const ORG_ID = "default-org";
  
  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // ===== SSE EVENTS FOR REAL-TIME UPDATES =====
  app.get("/api/events", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const clientId = Date.now().toString();
    addSSEClient(clientId, res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
    
    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      clearInterval(keepAlive);
      removeSSEClient(clientId);
    });
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
      const componentsList = await storage.listComponents({ propertyId: property.id });
      
      // Enrich components with type info
      const components = await Promise.all(componentsList.map(async (comp) => {
        const type = await storage.getComponentType(comp.componentTypeId);
        return { ...comp, componentType: type };
      }));
      
      res.json({
        ...property,
        block,
        scheme,
        certificates,
        actions,
        components,
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
  
  // ===== CONTRACTORS =====
  app.get("/api/contractors", async (req, res) => {
    try {
      const contractors = await storage.listContractors(ORG_ID);
      res.json(contractors);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });
  
  app.get("/api/contractors/:id", async (req, res) => {
    try {
      const contractor = await storage.getContractor(req.params.id);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ error: "Failed to fetch contractor" });
    }
  });
  
  app.post("/api/contractors", async (req, res) => {
    try {
      const data = insertContractorSchema.parse({ ...req.body, organisationId: ORG_ID });
      const contractor = await storage.createContractor(data);
      res.status(201).json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
    }
  });
  
  app.patch("/api/contractors/:id", async (req, res) => {
    try {
      const updateData = insertContractorSchema.partial().parse(req.body);
      const contractor = await storage.updateContractor(req.params.id, updateData);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contractor:", error);
      res.status(500).json({ error: "Failed to update contractor" });
    }
  });
  
  app.post("/api/contractors/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const contractor = await storage.updateContractorStatus(req.params.id, status);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      console.error("Error updating contractor status:", error);
      res.status(500).json({ error: "Failed to update contractor status" });
    }
  });
  
  app.post("/api/contractors/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No contractor IDs provided" });
      }
      const approved = await storage.bulkApproveContractors(ids);
      res.json({ success: true, approved });
    } catch (error) {
      console.error("Error bulk approving contractors:", error);
      res.status(500).json({ error: "Failed to approve contractors" });
    }
  });
  
  app.post("/api/contractors/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No contractor IDs provided" });
      }
      const rejected = await storage.bulkRejectContractors(ids);
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting contractors:", error);
      res.status(500).json({ error: "Failed to reject contractors" });
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
      
      const eventType = updates.status === 'COMPLETED' ? 'action.completed' : 'action.updated';
      enqueueWebhookEvent(eventType, 'remedialAction', action.id, {
        id: action.id,
        propertyId: action.propertyId,
        code: action.code,
        description: action.description,
        severity: action.severity,
        status: action.status,
        dueDate: action.dueDate
      });
      
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
        const docType = (property?.extractedMetadata as any)?.documentType || 
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

  // ===== USER MANAGEMENT =====
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.listUsers(ORG_ID);
      // Return users without password
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  app.patch("/api/users/:id/role", async (req, res) => {
    try {
      const { role, requesterId } = req.body;
      if (!role || !requesterId) {
        return res.status(400).json({ error: "Role and requesterId are required" });
      }
      
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const updatedUser = await storage.updateUserRole(req.params.id, role, requesterId);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(400).json({ error: error.message || "Failed to update user role" });
    }
  });

  // ===== LASHAN OWNED MODEL: MODEL INSIGHTS =====
  app.get("/api/model-insights", async (req, res) => {
    try {
      const allRuns = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      const allReviews = await db.select().from(humanReviews).orderBy(desc(humanReviews.reviewedAt));
      
      const totalRuns = allRuns.length;
      const approvedRuns = allRuns.filter(r => r.status === 'APPROVED').length;
      const rejectedRuns = allRuns.filter(r => r.status === 'REJECTED' || r.status === 'VALIDATION_FAILED').length;
      const awaitingReviewRuns = allRuns.filter(r => r.status === 'AWAITING_REVIEW').length;
      
      // Calculate accuracy based on reviewed extractions (approved / (approved + rejected))
      const reviewedRuns = approvedRuns + rejectedRuns;
      const accuracy = reviewedRuns > 0 ? approvedRuns / reviewedRuns : 0;
      
      // Calculate confidence-based accuracy for extractions not yet reviewed
      // Use confidence scores from awaiting_review runs as a proxy for expected accuracy
      const avgConfidence = allRuns.length > 0 
        ? allRuns.reduce((sum, r) => sum + (r.confidence || 0), 0) / allRuns.length 
        : 0;
      
      // Blend reviewed accuracy with confidence scores for overall metric
      const overallAccuracy = reviewedRuns > 0 ? accuracy : avgConfidence;
      
      const errorTags: Record<string, number> = {};
      allReviews.forEach(review => {
        (review.errorTags || []).forEach((tag: string) => {
          errorTags[tag] = (errorTags[tag] || 0) + 1;
        });
      });
      
      // Also count rejections as implicit errors
      if (rejectedRuns > 0 && Object.keys(errorTags).length === 0) {
        errorTags['extraction_rejected'] = rejectedRuns;
      }
      
      const topTags = Object.entries(errorTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count, trend: 0 }));
      
      // Calculate accuracy by document type - include confidence for unreviewed
      const byDocType = Object.entries(
        allRuns.reduce((acc, run) => {
          const docType = run.documentType || 'Unknown';
          if (!acc[docType]) acc[docType] = { total: 0, approved: 0, rejected: 0, confidenceSum: 0 };
          acc[docType].total++;
          acc[docType].confidenceSum += (run.confidence || 0);
          if (run.status === 'APPROVED') acc[docType].approved++;
          if (run.status === 'REJECTED' || run.status === 'VALIDATION_FAILED') acc[docType].rejected++;
          return acc;
        }, {} as Record<string, { total: number; approved: number; rejected: number; confidenceSum: number }>)
      ).map(([type, data]) => {
        const reviewed = data.approved + data.rejected;
        // If we have reviewed runs, use real accuracy; otherwise use average confidence
        const acc = reviewed > 0 
          ? (data.approved / reviewed) * 100 
          : (data.confidenceSum / data.total) * 100;
        return {
          type: type.length > 30 ? type.substring(0, 27) + '...' : type,
          accuracy: Math.round(acc),
          count: data.total
        };
      });
      
      // Calculate weekly trend data based on creation dates
      const weeklyData: Record<string, { total: number; approved: number; avgConf: number }> = {};
      allRuns.forEach(run => {
        const weekStart = new Date(run.createdAt || new Date());
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weeklyData[weekKey]) weeklyData[weekKey] = { total: 0, approved: 0, avgConf: 0 };
        weeklyData[weekKey].total++;
        weeklyData[weekKey].avgConf += (run.confidence || 0);
        if (run.status === 'APPROVED') weeklyData[weekKey].approved++;
      });
      
      const byWeek = Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([week, data]) => ({
          week: new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          accuracy: data.total > 0 ? Math.round((data.avgConf / data.total) * 100) : 0
        }));
      
      // Calculate benchmark score based on confidence and validation pass rate
      const validationPassRate = allRuns.filter(r => r.validationPassed).length / Math.max(totalRuns, 1);
      const benchmarkScore = Math.round((avgConfidence * 0.5 + validationPassRate * 0.5) * 100);
      
      res.json({
        accuracy: {
          overall: Math.round(overallAccuracy * 100),
          trend: 0,
          byDocType,
          byWeek,
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
            issue: `Fix ${t.tag.replace(/_/g, ' ')} errors`,
            occurrences: t.count,
            suggestedFix: `Review and update extraction prompt to handle ${t.tag.replace(/_/g, ' ')} cases`,
            priority: i < 2 ? 'high' : 'medium'
          })),
          recentWins: [],
        },
        benchmarks: {
          latest: { 
            score: benchmarkScore, 
            date: new Date().toISOString(), 
            passed: benchmarkScore >= 80 
          },
          trend: [],
        },
        extractionStats: {
          total: totalRuns,
          pending: allRuns.filter(r => r.status === 'PENDING').length,
          approved: approvedRuns,
          awaitingReview: awaitingReviewRuns,
          failed: rejectedRuns,
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
      
      // Compliance by type - use correct enum values
      const certTypes = ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'LIFT_LOLER', 'ASBESTOS_SURVEY'];
      const complianceByType = certTypes.map(type => {
        const typeCerts = allCertificates.filter(c => c.certificateType === type);
        // Count certificates with clear outcomes
        const satisfactory = typeCerts.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
        const unsatisfactory = typeCerts.filter(c => c.outcome === 'UNSATISFACTORY').length;
        // Certificates without clear outcome yet (still processing or failed)
        const unclear = typeCerts.length - satisfactory - unsatisfactory;
        
        return {
          type: type.replace(/_/g, ' '),
          total: typeCerts.length,
          satisfactory,
          unsatisfactory,
          unclear,
          // Compliance rate based on certificates with outcomes
          compliant: typeCerts.length > 0 ? Math.round((satisfactory / typeCerts.length) * 100) : 0,
          nonCompliant: typeCerts.length > 0 ? Math.round((unsatisfactory / typeCerts.length) * 100) : 0,
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
  
  // ===== CONFIGURATION - CERTIFICATE TYPES =====
  app.get("/api/config/certificate-types", async (req, res) => {
    try {
      const types = await storage.listCertificateTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching certificate types:", error);
      res.status(500).json({ error: "Failed to fetch certificate types" });
    }
  });
  
  app.get("/api/config/certificate-types/:id", async (req, res) => {
    try {
      const certType = await storage.getCertificateType(req.params.id);
      if (!certType) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json(certType);
    } catch (error) {
      console.error("Error fetching certificate type:", error);
      res.status(500).json({ error: "Failed to fetch certificate type" });
    }
  });
  
  app.post("/api/config/certificate-types", async (req, res) => {
    try {
      const data = insertCertificateTypeSchema.parse(req.body);
      const certType = await storage.createCertificateType(data);
      res.status(201).json(certType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating certificate type:", error);
        res.status(500).json({ error: "Failed to create certificate type" });
      }
    }
  });
  
  app.patch("/api/config/certificate-types/:id", async (req, res) => {
    try {
      const updateData = insertCertificateTypeSchema.partial().parse(req.body);
      const updated = await storage.updateCertificateType(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating certificate type:", error);
        res.status(500).json({ error: "Failed to update certificate type" });
      }
    }
  });
  
  app.delete("/api/config/certificate-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCertificateType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting certificate type:", error);
      res.status(500).json({ error: "Failed to delete certificate type" });
    }
  });
  
  // ===== CONFIGURATION - CLASSIFICATION CODES =====
  app.get("/api/config/classification-codes", async (req, res) => {
    try {
      const certificateTypeId = req.query.certificateTypeId as string | undefined;
      const codes = await storage.listClassificationCodes(certificateTypeId);
      res.json(codes);
    } catch (error) {
      console.error("Error fetching classification codes:", error);
      res.status(500).json({ error: "Failed to fetch classification codes" });
    }
  });
  
  app.get("/api/config/classification-codes/:id", async (req, res) => {
    try {
      const code = await storage.getClassificationCode(req.params.id);
      if (!code) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json(code);
    } catch (error) {
      console.error("Error fetching classification code:", error);
      res.status(500).json({ error: "Failed to fetch classification code" });
    }
  });
  
  app.post("/api/config/classification-codes", async (req, res) => {
    try {
      const data = insertClassificationCodeSchema.parse(req.body);
      const code = await storage.createClassificationCode(data);
      res.status(201).json(code);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating classification code:", error);
        res.status(500).json({ error: "Failed to create classification code" });
      }
    }
  });
  
  app.patch("/api/config/classification-codes/:id", async (req, res) => {
    try {
      const updateData = insertClassificationCodeSchema.partial().parse(req.body);
      const updated = await storage.updateClassificationCode(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating classification code:", error);
        res.status(500).json({ error: "Failed to update classification code" });
      }
    }
  });
  
  app.delete("/api/config/classification-codes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClassificationCode(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting classification code:", error);
      res.status(500).json({ error: "Failed to delete classification code" });
    }
  });
  
  // ===== CONFIGURATION - EXTRACTION SCHEMAS =====
  app.get("/api/config/extraction-schemas", async (req, res) => {
    try {
      const schemas = await storage.listExtractionSchemas();
      res.json(schemas);
    } catch (error) {
      console.error("Error fetching extraction schemas:", error);
      res.status(500).json({ error: "Failed to fetch extraction schemas" });
    }
  });
  
  app.get("/api/config/extraction-schemas/:id", async (req, res) => {
    try {
      const schema = await storage.getExtractionSchema(req.params.id);
      if (!schema) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json(schema);
    } catch (error) {
      console.error("Error fetching extraction schema:", error);
      res.status(500).json({ error: "Failed to fetch extraction schema" });
    }
  });
  
  app.post("/api/config/extraction-schemas", async (req, res) => {
    try {
      const data = insertExtractionSchemaSchema.parse(req.body);
      const schema = await storage.createExtractionSchema(data);
      res.status(201).json(schema);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating extraction schema:", error);
        res.status(500).json({ error: "Failed to create extraction schema" });
      }
    }
  });
  
  app.patch("/api/config/extraction-schemas/:id", async (req, res) => {
    try {
      const updateData = insertExtractionSchemaSchema.partial().parse(req.body);
      const updated = await storage.updateExtractionSchema(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating extraction schema:", error);
        res.status(500).json({ error: "Failed to update extraction schema" });
      }
    }
  });
  
  app.delete("/api/config/extraction-schemas/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExtractionSchema(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting extraction schema:", error);
      res.status(500).json({ error: "Failed to delete extraction schema" });
    }
  });
  
  // ===== CONFIGURATION - COMPLIANCE RULES =====
  app.get("/api/config/compliance-rules", async (req, res) => {
    try {
      const rules = await storage.listComplianceRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ error: "Failed to fetch compliance rules" });
    }
  });
  
  app.get("/api/config/compliance-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getComplianceRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching compliance rule:", error);
      res.status(500).json({ error: "Failed to fetch compliance rule" });
    }
  });
  
  app.post("/api/config/compliance-rules", async (req, res) => {
    try {
      const data = insertComplianceRuleSchema.parse(req.body);
      const rule = await storage.createComplianceRule(data);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating compliance rule:", error);
        res.status(500).json({ error: "Failed to create compliance rule" });
      }
    }
  });
  
  app.patch("/api/config/compliance-rules/:id", async (req, res) => {
    try {
      const updateData = insertComplianceRuleSchema.partial().parse(req.body);
      const updated = await storage.updateComplianceRule(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating compliance rule:", error);
        res.status(500).json({ error: "Failed to update compliance rule" });
      }
    }
  });
  
  app.delete("/api/config/compliance-rules/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComplianceRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance rule:", error);
      res.status(500).json({ error: "Failed to delete compliance rule" });
    }
  });
  
  // ===== CONFIGURATION - NORMALISATION RULES =====
  app.get("/api/config/normalisation-rules", async (req, res) => {
    try {
      const rules = await storage.listNormalisationRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching normalisation rules:", error);
      res.status(500).json({ error: "Failed to fetch normalisation rules" });
    }
  });
  
  app.get("/api/config/normalisation-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getNormalisationRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching normalisation rule:", error);
      res.status(500).json({ error: "Failed to fetch normalisation rule" });
    }
  });
  
  app.post("/api/config/normalisation-rules", async (req, res) => {
    try {
      const data = insertNormalisationRuleSchema.parse(req.body);
      const rule = await storage.createNormalisationRule(data);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating normalisation rule:", error);
        res.status(500).json({ error: "Failed to create normalisation rule" });
      }
    }
  });
  
  app.patch("/api/config/normalisation-rules/:id", async (req, res) => {
    try {
      const updateData = insertNormalisationRuleSchema.partial().parse(req.body);
      const updated = await storage.updateNormalisationRule(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating normalisation rule:", error);
        res.status(500).json({ error: "Failed to update normalisation rule" });
      }
    }
  });
  
  app.delete("/api/config/normalisation-rules/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteNormalisationRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting normalisation rule:", error);
      res.status(500).json({ error: "Failed to delete normalisation rule" });
    }
  });
  
  // ===== HACT ARCHITECTURE - COMPONENT TYPES =====
  app.get("/api/component-types", async (req, res) => {
    try {
      const types = await storage.listComponentTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching component types:", error);
      res.status(500).json({ error: "Failed to fetch component types" });
    }
  });
  
  app.get("/api/component-types/:id", async (req, res) => {
    try {
      const type = await storage.getComponentType(req.params.id);
      if (!type) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Error fetching component type:", error);
      res.status(500).json({ error: "Failed to fetch component type" });
    }
  });
  
  app.post("/api/component-types", async (req, res) => {
    try {
      const data = insertComponentTypeSchema.parse(req.body);
      const type = await storage.createComponentType(data);
      res.status(201).json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating component type:", error);
        res.status(500).json({ error: "Failed to create component type" });
      }
    }
  });
  
  app.patch("/api/component-types/:id", async (req, res) => {
    try {
      const updateData = insertComponentTypeSchema.partial().parse(req.body);
      const updated = await storage.updateComponentType(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating component type:", error);
        res.status(500).json({ error: "Failed to update component type" });
      }
    }
  });
  
  app.delete("/api/component-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComponentType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting component type:", error);
      res.status(500).json({ error: "Failed to delete component type" });
    }
  });
  
  // ===== HACT ARCHITECTURE - UNITS =====
  app.get("/api/units", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const unitsList = await storage.listUnits(propertyId);
      res.json(unitsList);
    } catch (error) {
      console.error("Error fetching units:", error);
      res.status(500).json({ error: "Failed to fetch units" });
    }
  });
  
  app.get("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.getUnit(req.params.id);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      console.error("Error fetching unit:", error);
      res.status(500).json({ error: "Failed to fetch unit" });
    }
  });
  
  app.post("/api/units", async (req, res) => {
    try {
      const data = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(data);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating unit:", error);
        res.status(500).json({ error: "Failed to create unit" });
      }
    }
  });
  
  app.patch("/api/units/:id", async (req, res) => {
    try {
      const updateData = insertUnitSchema.partial().parse(req.body);
      const updated = await storage.updateUnit(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating unit:", error);
        res.status(500).json({ error: "Failed to update unit" });
      }
    }
  });
  
  app.delete("/api/units/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUnit(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting unit:", error);
      res.status(500).json({ error: "Failed to delete unit" });
    }
  });
  
  // ===== HACT ARCHITECTURE - COMPONENTS (ASSETS) =====
  app.get("/api/components", async (req, res) => {
    try {
      const filters = {
        propertyId: req.query.propertyId as string | undefined,
        unitId: req.query.unitId as string | undefined,
        blockId: req.query.blockId as string | undefined,
        componentTypeId: req.query.componentTypeId as string | undefined,
      };
      const componentsList = await storage.listComponents(filters);
      
      // Enrich with component type and property info
      const enriched = await Promise.all(componentsList.map(async (comp) => {
        const type = await storage.getComponentType(comp.componentTypeId);
        const property = comp.propertyId ? await storage.getProperty(comp.propertyId) : undefined;
        return { ...comp, componentType: type, property: property ? { id: property.id, addressLine1: property.addressLine1, postcode: property.postcode } : undefined };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });
  
  app.get("/api/components/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      const type = await storage.getComponentType(component.componentTypeId);
      res.json({ ...component, componentType: type });
    } catch (error) {
      console.error("Error fetching component:", error);
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });
  
  app.post("/api/components", async (req, res) => {
    try {
      const data = insertComponentSchema.parse(req.body);
      const component = await storage.createComponent(data);
      res.status(201).json(component);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating component:", error);
        res.status(500).json({ error: "Failed to create component" });
      }
    }
  });
  
  app.patch("/api/components/:id", async (req, res) => {
    try {
      const updateData = insertComponentSchema.partial().parse(req.body);
      const updated = await storage.updateComponent(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating component:", error);
        res.status(500).json({ error: "Failed to update component" });
      }
    }
  });
  
  app.delete("/api/components/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComponent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting component:", error);
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  
  // Bulk approve components (set condition to GOOD and status to active)
  app.post("/api/components/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let approved = 0;
      for (const id of ids) {
        const updated = await storage.updateComponent(id, { needsVerification: false, isActive: true });
        if (updated) approved++;
      }
      res.json({ success: true, approved });
    } catch (error) {
      console.error("Error bulk approving components:", error);
      res.status(500).json({ error: "Failed to bulk approve components" });
    }
  });
  
  // Bulk reject/deactivate components
  app.post("/api/components/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let rejected = 0;
      for (const id of ids) {
        const updated = await storage.updateComponent(id, { isActive: false });
        if (updated) rejected++;
      }
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting components:", error);
      res.status(500).json({ error: "Failed to bulk reject components" });
    }
  });
  
  // Bulk delete components
  app.post("/api/components/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let deleted = 0;
      for (const id of ids) {
        const result = await storage.deleteComponent(id);
        if (result) deleted++;
      }
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting components:", error);
      res.status(500).json({ error: "Failed to bulk delete components" });
    }
  });
  
  // ===== DATA IMPORTS =====
  app.get("/api/imports", async (req, res) => {
    try {
      const imports = await storage.listDataImports(ORG_ID);
      res.json(imports);
    } catch (error) {
      console.error("Error fetching imports:", error);
      res.status(500).json({ error: "Failed to fetch imports" });
    }
  });
  
  app.get("/api/imports/:id", async (req, res) => {
    try {
      const dataImport = await storage.getDataImport(req.params.id);
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      const counts = await storage.getDataImportRowCounts(req.params.id);
      res.json({ ...dataImport, ...counts });
    } catch (error) {
      console.error("Error fetching import:", error);
      res.status(500).json({ error: "Failed to fetch import" });
    }
  });
  
  app.get("/api/imports/:id/rows", async (req, res) => {
    try {
      const rows = await storage.listDataImportRows(req.params.id);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching import rows:", error);
      res.status(500).json({ error: "Failed to fetch import rows" });
    }
  });
  
  app.post("/api/imports", async (req, res) => {
    try {
      const data = insertDataImportSchema.parse({
        ...req.body,
        organisationId: ORG_ID,
        uploadedById: "system",
      });
      const dataImport = await storage.createDataImport(data);
      res.status(201).json(dataImport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating import:", error);
        res.status(500).json({ error: "Failed to create import" });
      }
    }
  });
  
  app.patch("/api/imports/:id", async (req, res) => {
    try {
      const updateData = insertDataImportSchema.partial().parse(req.body);
      const updated = await storage.updateDataImport(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Import not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating import:", error);
        res.status(500).json({ error: "Failed to update import" });
      }
    }
  });
  
  app.delete("/api/imports/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDataImport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Import not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting import:", error);
      res.status(500).json({ error: "Failed to delete import" });
    }
  });
  
  // ===== TSM BUILDING SAFETY REPORTS =====
  app.get("/api/reports/tsm-building-safety", async (req, res) => {
    try {
      const period = req.query.period as string || 'current'; // 'current', 'previous', 'ytd'
      const today = new Date();
      
      // Get all components and certificates for calculations
      const allComponents = await storage.listComponents();
      const allCertificates = await storage.listCertificates(ORG_ID);
      const remedialActions = await storage.listRemedialActions(ORG_ID);
      
      // Get high-risk building safety components
      const componentTypesData = await storage.listComponentTypes();
      const highRiskTypes = componentTypesData.filter(t => t.isHighRisk || t.buildingSafetyRelevant);
      const highRiskTypeIds = highRiskTypes.map(t => t.id);
      
      const highRiskComponents = allComponents.filter(c => highRiskTypeIds.includes(c.componentTypeId));
      
      // BS01: Building Safety Cases completed
      // (Count of high-risk buildings with all required certificates up to date)
      const buildingsWithCompliance = new Set();
      allCertificates.forEach(cert => {
        if (cert.expiryDate && new Date(cert.expiryDate) > today) {
          buildingsWithCompliance.add(cert.propertyId);
        }
      });
      
      // BS02: Percentage of buildings with up-to-date Fire Risk Assessment
      const fraType = componentTypesData.find(t => t.code === 'FIRE_RISK_ASSESSMENT' || t.relatedCertificateTypes?.includes('FIRE_RISK_ASSESSMENT'));
      const fraCertificates = allCertificates.filter(c => c.certificateType === 'FIRE_RISK_ASSESSMENT');
      const upToDateFRA = fraCertificates.filter(c => c.expiryDate && new Date(c.expiryDate) > today);
      const bs02Percentage = fraCertificates.length > 0 ? (upToDateFRA.length / fraCertificates.length * 100) : 0;
      
      // BS03: Outstanding remedial actions on high-risk components
      const outstandingActions = remedialActions.filter(a => 
        a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
      );
      
      // BS04: Overdue safety inspections
      const overdueInspections = allCertificates.filter(c => 
        c.expiryDate && new Date(c.expiryDate) < today
      );
      
      // BS05: Resident communication (placeholder - requires additional tracking)
      const bs05ResidentComms = {
        notified: 0,
        pending: 0,
        percentage: 0
      };
      
      // BS06: Critical safety alerts
      const criticalActions = remedialActions.filter(a => 
        a.severity === 'IMMEDIATE' && a.status !== 'COMPLETED'
      );
      
      res.json({
        period,
        reportDate: today.toISOString(),
        metrics: {
          BS01: {
            name: "Building Safety Cases",
            description: "Buildings with safety case reviews completed",
            value: buildingsWithCompliance.size,
            total: allComponents.length > 0 ? new Set(allComponents.map(c => c.propertyId || c.blockId)).size : 0,
            unit: "buildings"
          },
          BS02: {
            name: "Fire Risk Assessment Compliance",
            description: "Percentage of buildings with up-to-date FRA",
            value: Math.round(bs02Percentage * 10) / 10,
            total: fraCertificates.length,
            upToDate: upToDateFRA.length,
            unit: "percent"
          },
          BS03: {
            name: "Outstanding Remedial Actions",
            description: "Remedial actions awaiting completion",
            value: outstandingActions.length,
            bySeverity: {
              immediate: outstandingActions.filter(a => a.severity === 'IMMEDIATE').length,
              urgent: outstandingActions.filter(a => a.severity === 'URGENT').length,
              priority: outstandingActions.filter(a => a.severity === 'PRIORITY').length,
              routine: outstandingActions.filter(a => a.severity === 'ROUTINE').length,
            },
            unit: "actions"
          },
          BS04: {
            name: "Overdue Safety Inspections",
            description: "Certificates past expiry date",
            value: overdueInspections.length,
            byType: Object.entries(
              overdueInspections.reduce((acc, c) => {
                acc[c.certificateType] = (acc[c.certificateType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => ({ type, count })),
            unit: "inspections"
          },
          BS05: {
            name: "Resident Safety Communication",
            description: "Residents notified of safety information",
            value: bs05ResidentComms.percentage,
            notified: bs05ResidentComms.notified,
            pending: bs05ResidentComms.pending,
            unit: "percent"
          },
          BS06: {
            name: "Critical Safety Alerts",
            description: "Immediate severity actions outstanding",
            value: criticalActions.length,
            alerts: criticalActions.slice(0, 10).map(a => ({
              id: a.id,
              description: a.description,
              propertyId: a.propertyId,
              dueDate: a.dueDate
            })),
            unit: "alerts"
          }
        },
        summary: {
          totalHighRiskComponents: highRiskComponents.length,
          totalCertificates: allCertificates.length,
          totalRemedialActions: remedialActions.length,
          complianceScore: allCertificates.length > 0 
            ? Math.round((allCertificates.filter(c => c.expiryDate && new Date(c.expiryDate) > today).length / allCertificates.length) * 100)
            : 0
        }
      });
    } catch (error) {
      console.error("Error generating TSM report:", error);
      res.status(500).json({ error: "Failed to generate TSM Building Safety report" });
    }
  });
  
  // Get import templates
  app.get("/api/imports/templates/:type", async (req, res) => {
    try {
      const type = req.params.type as string;
      
      const templates: Record<string, { columns: Array<{ name: string; required: boolean; description: string }> }> = {
        properties: {
          columns: [
            { name: "uprn", required: true, description: "Unique Property Reference Number" },
            { name: "addressLine1", required: true, description: "First line of address" },
            { name: "addressLine2", required: false, description: "Second line of address" },
            { name: "city", required: true, description: "City/Town" },
            { name: "postcode", required: true, description: "Postcode" },
            { name: "propertyType", required: true, description: "HOUSE, FLAT, BUNGALOW, MAISONETTE, BEDSIT, STUDIO" },
            { name: "tenure", required: true, description: "SOCIAL_RENT, AFFORDABLE_RENT, SHARED_OWNERSHIP, LEASEHOLD, TEMPORARY" },
            { name: "bedrooms", required: false, description: "Number of bedrooms" },
            { name: "hasGas", required: false, description: "true/false" },
            { name: "blockReference", required: true, description: "Block reference code to link property" },
          ]
        },
        units: {
          columns: [
            { name: "propertyUprn", required: true, description: "UPRN of parent property" },
            { name: "name", required: true, description: "Unit name (e.g., Kitchen, Communal Hall)" },
            { name: "reference", required: false, description: "Unit reference code" },
            { name: "unitType", required: true, description: "DWELLING, COMMUNAL_AREA, PLANT_ROOM, etc." },
            { name: "floor", required: false, description: "Floor level (Ground, 1st, etc.)" },
            { name: "description", required: false, description: "Description of the unit" },
          ]
        },
        components: {
          columns: [
            { name: "propertyUprn", required: false, description: "UPRN of property (optional if unitReference provided)" },
            { name: "unitReference", required: false, description: "Unit reference (optional if propertyUprn provided)" },
            { name: "componentTypeCode", required: true, description: "Component type code (e.g., GAS_BOILER)" },
            { name: "assetTag", required: false, description: "Physical asset label" },
            { name: "serialNumber", required: false, description: "Manufacturer serial number" },
            { name: "manufacturer", required: false, description: "Component manufacturer" },
            { name: "model", required: false, description: "Component model" },
            { name: "location", required: false, description: "Location within property/unit" },
            { name: "installDate", required: false, description: "Installation date (YYYY-MM-DD)" },
            { name: "condition", required: false, description: "GOOD, FAIR, POOR, CRITICAL" },
          ]
        }
      };
      
      const template = templates[type];
      if (!template) {
        return res.status(404).json({ error: "Template type not found", availableTypes: Object.keys(templates) });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching import template:", error);
      res.status(500).json({ error: "Failed to fetch import template" });
    }
  });
  
  // Download CSV template
  app.get("/api/imports/templates/:type/download", async (req, res) => {
    try {
      const type = req.params.type as string;
      const csvContent = generateCSVTemplate(type);
      
      if (!csvContent) {
        return res.status(404).json({ error: "Template type not found" });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-template.csv`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating CSV template:", error);
      res.status(500).json({ error: "Failed to generate CSV template" });
    }
  });
  
  // Parse and validate import data (without committing)
  app.post("/api/imports/:id/validate", async (req, res) => {
    try {
      const importId = req.params.id;
      const dataImport = await storage.getDataImport(importId);
      
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "CSV content is required" });
      }
      
      const rows = parseCSV(csvContent);
      if (rows.length === 0) {
        return res.status(400).json({ error: "No data rows found in CSV" });
      }
      
      await storage.updateDataImport(importId, { 
        status: 'VALIDATING',
        totalRows: rows.length 
      });
      
      const { validRows, invalidRows } = await validateImportData(
        importId,
        dataImport.importType,
        rows
      );
      
      await storage.updateDataImport(importId, {
        status: 'VALIDATED',
        validRows: validRows.length,
        invalidRows: invalidRows.length
      });
      
      res.json({
        importId,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        errors: invalidRows.map(r => ({
          rowNumber: r.rowNumber,
          errors: r.errors
        }))
      });
    } catch (error) {
      console.error("Error validating import:", error);
      res.status(500).json({ error: "Failed to validate import" });
    }
  });
  
  // Execute import (commit validated data)
  app.post("/api/imports/:id/execute", async (req, res) => {
    try {
      const importId = req.params.id;
      const dataImport = await storage.getDataImport(importId);
      
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      
      if (dataImport.status !== 'VALIDATED') {
        return res.status(400).json({ error: "Import must be validated before execution" });
      }
      
      await storage.updateDataImport(importId, { status: 'IMPORTING' });
      
      const rows = await storage.listDataImportRows(importId);
      const validRows = rows.filter(r => r.status === 'VALID').map(r => ({
        rowNumber: r.rowNumber,
        data: r.sourceData as Record<string, any>,
        errors: [],
        isValid: true
      }));
      
      let result;
      switch (dataImport.importType.toUpperCase()) {
        case 'PROPERTIES':
          result = await processPropertyImport(importId, validRows, dataImport.upsertMode);
          break;
        case 'UNITS':
          result = await processUnitImport(importId, validRows, dataImport.upsertMode);
          break;
        case 'COMPONENTS':
          result = await processComponentImport(importId, validRows, dataImport.upsertMode);
          break;
        default:
          return res.status(400).json({ error: `Unknown import type: ${dataImport.importType}` });
      }
      
      await storage.updateDataImport(importId, {
        status: result.success ? 'COMPLETED' : 'FAILED',
        importedRows: result.importedRows,
        completedAt: new Date(),
        errorSummary: result.errors.length > 0 ? result.errors : null
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error executing import:", error);
      res.status(500).json({ error: "Failed to execute import" });
    }
  });
  
  // ===== API MONITORING & INTEGRATIONS =====
  
  // API Logs
  app.get("/api/admin/api-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.listApiLogs(limit, offset);
      const stats = await storage.getApiLogStats();
      res.json({ logs, stats });
    } catch (error) {
      console.error("Error fetching API logs:", error);
      res.status(500).json({ error: "Failed to fetch API logs" });
    }
  });
  
  // API Metrics
  app.get("/api/admin/api-metrics", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const metrics = await storage.listApiMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching API metrics:", error);
      res.status(500).json({ error: "Failed to fetch API metrics" });
    }
  });
  
  // Webhook Endpoints
  app.get("/api/admin/webhooks", async (req, res) => {
    try {
      const webhooks = await storage.listWebhookEndpoints(ORG_ID);
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });
  
  app.post("/api/admin/webhooks", async (req, res) => {
    try {
      const { name, url, authType, authValue, headers, events, retryCount, timeoutMs } = req.body;
      
      if (!name || !url || !events || events.length === 0) {
        return res.status(400).json({ error: "Name, URL, and at least one event are required" });
      }
      
      const webhook = await storage.createWebhookEndpoint({
        organisationId: ORG_ID,
        name,
        url,
        authType: authType || 'NONE',
        authValue,
        headers,
        events,
        retryCount: retryCount || 3,
        timeoutMs: timeoutMs || 30000,
      });
      
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });
  
  app.patch("/api/admin/webhooks/:id", async (req, res) => {
    try {
      const webhook = await storage.updateWebhookEndpoint(req.params.id, req.body);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json(webhook);
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ error: "Failed to update webhook" });
    }
  });
  
  app.delete("/api/admin/webhooks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWebhookEndpoint(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });
  
  // Test webhook
  app.post("/api/admin/webhooks/:id/test", async (req, res) => {
    try {
      const webhook = await storage.getWebhookEndpoint(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery from ComplianceAI'
        }
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'ComplianceAI',
        ...(webhook.headers as Record<string, string> || {})
      };
      
      if (webhook.authType === 'API_KEY' && webhook.authValue) {
        headers['X-API-Key'] = webhook.authValue;
      } else if (webhook.authType === 'BEARER' && webhook.authValue) {
        headers['Authorization'] = `Bearer ${webhook.authValue}`;
      }
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(webhook.timeoutMs)
        });
        
        const duration = Date.now() - startTime;
        const responseText = await response.text();
        
        res.json({
          success: response.ok,
          status: response.status,
          duration,
          responsePreview: responseText.substring(0, 500)
        });
      } catch (fetchError: any) {
        const duration = Date.now() - startTime;
        res.json({
          success: false,
          status: 0,
          duration,
          error: fetchError.message || 'Connection failed'
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });
  
  // Webhook Deliveries
  app.get("/api/admin/webhook-deliveries", async (req, res) => {
    try {
      const webhookId = req.query.webhookId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const deliveries = await storage.listWebhookDeliveries(webhookId, limit);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      res.status(500).json({ error: "Failed to fetch webhook deliveries" });
    }
  });
  
  // Webhook Events
  app.get("/api/admin/webhook-events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.listWebhookEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching webhook events:", error);
      res.status(500).json({ error: "Failed to fetch webhook events" });
    }
  });
  
  // Incoming Webhook Logs
  app.get("/api/admin/incoming-webhooks", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.listIncomingWebhookLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching incoming webhooks:", error);
      res.status(500).json({ error: "Failed to fetch incoming webhooks" });
    }
  });
  
  // API Keys
  app.get("/api/admin/api-keys", async (req, res) => {
    try {
      const keys = await storage.listApiKeys(ORG_ID);
      res.json(keys.map(k => ({ ...k, keyHash: undefined })));
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });
  
  app.post("/api/admin/api-keys", async (req, res) => {
    try {
      const { name, scopes, expiresAt } = req.body;
      
      if (!name || !scopes || scopes.length === 0) {
        return res.status(400).json({ error: "Name and at least one scope are required" });
      }
      
      const rawKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyPrefix = rawKey.substring(0, 12);
      const keyHash = await hashApiKey(rawKey);
      
      const apiKey = await storage.createApiKey({
        organisationId: ORG_ID,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      });
      
      res.status(201).json({ 
        ...apiKey, 
        keyHash: undefined,
        key: rawKey
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });
  
  app.delete("/api/admin/api-keys/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteApiKey(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "API key not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });
  
  // ===== INCOMING INTEGRATION ENDPOINTS (HMS) =====
  
  // Receive action updates from Housing Management System
  app.post("/api/integrations/hms/actions", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: req.body.eventType || 'action_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { actionId, status, notes, completedAt, costActual } = req.body;
      
      if (!actionId) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Missing actionId',
          processed: true,
          processedAt: new Date()
        });
        return res.status(400).json({ error: "actionId is required" });
      }
      
      const action = await storage.getRemedialAction(actionId);
      if (!action) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Action not found',
          processed: true,
          processedAt: new Date()
        });
        return res.status(404).json({ error: "Remedial action not found" });
      }
      
      const updates: any = {};
      if (status) updates.status = status;
      if (completedAt) updates.resolvedAt = new Date(completedAt);
      if (costActual) updates.costEstimate = costActual.toString();
      
      await storage.updateRemedialAction(actionId, updates);
      
      await storage.updateIncomingWebhookLog(log.id, { 
        processed: true,
        processedAt: new Date()
      });
      
      res.json({ success: true, actionId, updates });
    } catch (error) {
      console.error("Error processing HMS webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });
  
  // Receive work order confirmations from HMS
  app.post("/api/integrations/hms/work-orders", async (req, res) => {
    try {
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: 'work_order_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { workOrderId, actionId, status, scheduledDate, assignedContractor } = req.body;
      
      if (!actionId) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Missing actionId',
          processed: true,
          processedAt: new Date()
        });
        return res.status(400).json({ error: "actionId is required" });
      }
      
      const updates: any = {};
      if (status === 'scheduled' || status === 'in_progress') {
        updates.status = 'IN_PROGRESS';
      } else if (status === 'completed') {
        updates.status = 'COMPLETED';
        updates.resolvedAt = new Date();
      }
      if (scheduledDate) {
        updates.dueDate = scheduledDate;
      }
      
      await storage.updateRemedialAction(actionId, updates);
      
      await storage.updateIncomingWebhookLog(log.id, { 
        processed: true,
        processedAt: new Date()
      });
      
      res.json({ success: true, actionId, workOrderId, updates });
    } catch (error) {
      console.error("Error processing work order webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });
  
  // ===== VIDEO LIBRARY =====
  app.get("/api/videos", async (req, res) => {
    try {
      const orgs = await storage.listOrganisations();
      const defaultOrgId = orgs[0]?.id || '';
      const orgId = (req.query.organisationId as string) || defaultOrgId;
      const videoList = await storage.listVideos(orgId);
      res.json(videoList);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });
  
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      await storage.incrementVideoView(video.id);
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ error: "Failed to fetch video" });
    }
  });
  
  app.post("/api/videos", async (req, res) => {
    try {
      const orgs = await storage.listOrganisations();
      const defaultOrgId = orgs[0]?.id || '';
      const video = await storage.createVideo({
        ...req.body,
        organisationId: req.body.organisationId || defaultOrgId
      });
      res.status(201).json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ error: "Failed to create video" });
    }
  });
  
  app.patch("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.updateVideo(req.params.id, req.body);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ error: "Failed to update video" });
    }
  });
  
  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const success = await storage.deleteVideo(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });
  
  app.post("/api/videos/:id/download", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      await storage.incrementVideoDownload(video.id);
      res.json({ storageKey: video.storageKey });
    } catch (error) {
      console.error("Error tracking download:", error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });
  
  // ===== API DOCUMENTATION ENDPOINT =====
  app.get("/api/admin/openapi", (req, res) => {
    const openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: "ComplianceAI API",
        version: "1.0.0",
        description: "API for UK Social Housing Compliance Management"
      },
      servers: [
        { url: "/api", description: "API Server" }
      ],
      paths: {
        "/schemes": { get: { summary: "List schemes", tags: ["Schemes"] } },
        "/blocks": { get: { summary: "List blocks", tags: ["Blocks"] } },
        "/properties": { get: { summary: "List properties", tags: ["Properties"] } },
        "/certificates": { get: { summary: "List certificates", tags: ["Certificates"] } },
        "/actions": { get: { summary: "List remedial actions", tags: ["Actions"] } },
        "/contractors": { get: { summary: "List contractors", tags: ["Contractors"] } },
        "/integrations/hms/actions": {
          post: {
            summary: "Receive action updates from HMS",
            tags: ["Integrations"],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["actionId"],
                    properties: {
                      actionId: { type: "string", description: "Remedial action ID" },
                      status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"] },
                      notes: { type: "string" },
                      completedAt: { type: "string", format: "date-time" },
                      costActual: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        },
        "/integrations/hms/work-orders": {
          post: {
            summary: "Receive work order confirmations from HMS",
            tags: ["Integrations"],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["actionId"],
                    properties: {
                      workOrderId: { type: "string" },
                      actionId: { type: "string" },
                      status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"] },
                      scheduledDate: { type: "string", format: "date" },
                      assignedContractor: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key"
          }
        }
      }
    };
    res.json(openApiSpec);
  });
  
  return httpServer;
}

// Helper function to hash API keys
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
