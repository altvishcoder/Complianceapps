import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSchemeSchema, insertBlockSchema, insertPropertySchema, 
  insertCertificateSchema, insertExtractionSchema, insertRemedialActionSchema 
} from "@shared/schema";
import { z } from "zod";
import { processExtractionAndSave } from "./extraction";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

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
      const { fileBase64, mimeType, ...certificateData } = req.body;
      
      const data = insertCertificateSchema.parse({
        ...certificateData,
        organisationId: ORG_ID,
        status: "PROCESSING",
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
        } catch (err) {
          console.error("Error in AI extraction:", err);
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
  
  return httpServer;
}
