import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertDataImportSchema } from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { 
  generateCSVTemplate, 
  parseCSV, 
  validateImportData, 
  processPropertyImport, 
  processComponentImport 
} from "../import-parser";

export const importsRouter = Router();

function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

importsRouter.use(requireAuth);

importsRouter.get("/imports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const imports = await storage.listDataImports(orgId);
    res.json(imports);
  } catch (error) {
    console.error("Error fetching imports:", error);
    res.status(500).json({ error: "Failed to fetch imports" });
  }
});

importsRouter.get("/imports/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const dataImport = await storage.getDataImport(req.params.id);
    if (!dataImport || dataImport.organisationId !== orgId) {
      return res.status(404).json({ error: "Import not found" });
    }
    const counts = await storage.getDataImportRowCounts(req.params.id);
    res.json({ ...dataImport, ...counts });
  } catch (error) {
    console.error("Error fetching import:", error);
    res.status(500).json({ error: "Failed to fetch import" });
  }
});

importsRouter.get("/imports/:id/rows", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const dataImport = await storage.getDataImport(req.params.id);
    if (!dataImport || dataImport.organisationId !== orgId) {
      return res.status(404).json({ error: "Import not found" });
    }
    
    const rows = await storage.listDataImportRows(req.params.id);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching import rows:", error);
    res.status(500).json({ error: "Failed to fetch import rows" });
  }
});

importsRouter.post("/imports", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id;
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const data = insertDataImportSchema.parse({
      ...req.body,
      organisationId: orgId,
      uploadedById: userId || "system",
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

importsRouter.patch("/imports/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const dataImport = await storage.getDataImport(req.params.id);
    if (!dataImport || dataImport.organisationId !== orgId) {
      return res.status(404).json({ error: "Import not found" });
    }
    
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

importsRouter.delete("/imports/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const dataImport = await storage.getDataImport(req.params.id);
    if (!dataImport || dataImport.organisationId !== orgId) {
      return res.status(404).json({ error: "Import not found" });
    }
    
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

importsRouter.get("/imports/templates/:type", async (req: AuthenticatedRequest, res: Response) => {
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
          { name: "hasGas", required: false, description: "true/false - property has gas supply" },
          { name: "hasElectricity", required: false, description: "true/false - property has electricity" },
          { name: "hasAsbestos", required: false, description: "true/false - asbestos present in property" },
          { name: "hasSprinklers", required: false, description: "true/false - sprinkler system installed" },
          { name: "vulnerableOccupant", required: false, description: "true/false - occupant requires priority servicing" },
          { name: "epcRating", required: false, description: "Energy Performance Certificate rating: A, B, C, D, E, F, G" },
          { name: "constructionYear", required: false, description: "Year property was built (e.g., 1985)" },
          { name: "numberOfFloors", required: false, description: "Number of floors in property" },
          { name: "localAuthority", required: false, description: "Local authority name" },
          { name: "blockReference", required: true, description: "Block reference code to link property" },
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
          { name: "accessNotes", required: false, description: "Access instructions for engineer" },
          { name: "installDate", required: false, description: "Installation date (YYYY-MM-DD)" },
          { name: "expectedReplacementDate", required: false, description: "Expected replacement date (YYYY-MM-DD)" },
          { name: "warrantyExpiry", required: false, description: "Warranty expiry date (YYYY-MM-DD)" },
          { name: "condition", required: false, description: "GOOD, FAIR, POOR, CRITICAL" },
          { name: "riskLevel", required: false, description: "Risk priority: HIGH, MEDIUM, LOW" },
          { name: "certificateRequired", required: false, description: "Certificate type code (e.g., GAS_SAFETY)" },
          { name: "lastServiceDate", required: false, description: "Last service date (YYYY-MM-DD)" },
          { name: "nextServiceDue", required: false, description: "Next service due date (YYYY-MM-DD)" },
        ]
      },
      geocoding: {
        columns: [
          { name: "propertyId", required: true, description: "Property ID (UUID) to update" },
          { name: "latitude", required: true, description: "Latitude coordinate (decimal degrees, e.g., 51.5074)" },
          { name: "longitude", required: true, description: "Longitude coordinate (decimal degrees, e.g., -0.1278)" },
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

importsRouter.get("/imports/templates/:type/download", async (req: AuthenticatedRequest, res: Response) => {
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

importsRouter.get("/imports/samples/:type/download", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.params.type as string;
    const fs = await import('fs');
    const path = await import('path');
    
    const sampleFiles: Record<string, string> = {
      properties: 'properties-sample.csv',
      components: 'components-sample.csv',
      geocoding: 'geocoding-sample.csv'
    };
    
    const filename = sampleFiles[type];
    if (!filename) {
      return res.status(404).json({ error: "Sample type not found", availableTypes: Object.keys(sampleFiles) });
    }
    
    const filePath = path.join(process.cwd(), 'public', 'samples', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Sample file not found" });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error downloading sample CSV:", error);
    res.status(500).json({ error: "Failed to download sample CSV" });
  }
});

importsRouter.post("/imports/:id/validate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const importId = req.params.id;
    const dataImport = await storage.getDataImport(importId);
    
    if (!dataImport || dataImport.organisationId !== orgId) {
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

importsRouter.post("/imports/:id/execute", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const importId = req.params.id;
    const dataImport = await storage.getDataImport(importId);
    
    if (!dataImport || dataImport.organisationId !== orgId) {
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
