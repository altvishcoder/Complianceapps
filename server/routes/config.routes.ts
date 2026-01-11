import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../session";
import {
  insertClassificationCodeSchema,
  insertDetectionPatternSchema,
  insertOutcomeRuleSchema,
  insertExtractionSchemaSchema,
  insertComponentTypeSchema,
  insertSpaceSchema,
  spaces,
} from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";

export const configRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

const CONFIG_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'ORG_ADMIN'] as const;

// ===== CONFIGURATION - CLASSIFICATION CODES =====
configRouter.get("/config/classification-codes", async (req: Request, res: Response) => {
  try {
    const certificateTypeId = req.query.certificateTypeId as string | undefined;
    const complianceStreamId = req.query.complianceStreamId as string | undefined;
    const codes = await storage.listClassificationCodes({ certificateTypeId, complianceStreamId });
    res.json(codes);
  } catch (error) {
    console.error("Error fetching classification codes:", error);
    res.status(500).json({ error: "Failed to fetch classification codes" });
  }
});

configRouter.get("/config/classification-codes/:id", async (req: Request, res: Response) => {
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

configRouter.post("/config/classification-codes", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configRouter.patch("/config/classification-codes/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configRouter.delete("/config/classification-codes/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

// ===== CONFIGURATION - DETECTION PATTERNS =====
configRouter.get("/config/detection-patterns", async (req: Request, res: Response) => {
  try {
    const certificateTypeCode = req.query.certificateTypeCode as string | undefined;
    const patternType = req.query.patternType as string | undefined;
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
    const patterns = await storage.listDetectionPatterns({ certificateTypeCode, patternType, isActive });
    res.json(patterns);
  } catch (error) {
    console.error("Error fetching detection patterns:", error);
    res.status(500).json({ error: "Failed to fetch detection patterns" });
  }
});

configRouter.get("/config/detection-patterns/:id", async (req: Request, res: Response) => {
  try {
    const pattern = await storage.getDetectionPattern(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: "Detection pattern not found" });
    }
    res.json(pattern);
  } catch (error) {
    console.error("Error fetching detection pattern:", error);
    res.status(500).json({ error: "Failed to fetch detection pattern" });
  }
});

configRouter.post("/config/detection-patterns", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const data = insertDetectionPatternSchema.parse(req.body);
    const pattern = await storage.createDetectionPattern(data);
    res.status(201).json(pattern);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating detection pattern:", error);
      res.status(500).json({ error: "Failed to create detection pattern" });
    }
  }
});

configRouter.patch("/config/detection-patterns/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const updateData = insertDetectionPatternSchema.partial().parse(req.body);
    const updated = await storage.updateDetectionPattern(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: "Detection pattern not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error updating detection pattern:", error);
      res.status(500).json({ error: "Failed to update detection pattern" });
    }
  }
});

configRouter.delete("/config/detection-patterns/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const pattern = await storage.getDetectionPattern(req.params.id);
    if (!pattern) {
      return res.status(404).json({ error: "Detection pattern not found" });
    }
    if (pattern.isSystem) {
      return res.status(400).json({ error: "Cannot delete system pattern" });
    }
    await storage.deleteDetectionPattern(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting detection pattern:", error);
    res.status(500).json({ error: "Failed to delete detection pattern" });
  }
});

// ===== CONFIGURATION - OUTCOME RULES =====
configRouter.get("/config/outcome-rules", async (req: Request, res: Response) => {
  try {
    const certificateTypeCode = req.query.certificateTypeCode as string | undefined;
    const ruleGroup = req.query.ruleGroup as string | undefined;
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
    const rules = await storage.listOutcomeRules({ certificateTypeCode, ruleGroup, isActive });
    res.json(rules);
  } catch (error) {
    console.error("Error fetching outcome rules:", error);
    res.status(500).json({ error: "Failed to fetch outcome rules" });
  }
});

configRouter.get("/config/outcome-rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await storage.getOutcomeRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Outcome rule not found" });
    }
    res.json(rule);
  } catch (error) {
    console.error("Error fetching outcome rule:", error);
    res.status(500).json({ error: "Failed to fetch outcome rule" });
  }
});

configRouter.post("/config/outcome-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const data = insertOutcomeRuleSchema.parse(req.body);
    const rule = await storage.createOutcomeRule(data);
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating outcome rule:", error);
      res.status(500).json({ error: "Failed to create outcome rule" });
    }
  }
});

configRouter.patch("/config/outcome-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const updateData = insertOutcomeRuleSchema.partial().parse(req.body);
    const updated = await storage.updateOutcomeRule(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: "Outcome rule not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error updating outcome rule:", error);
      res.status(500).json({ error: "Failed to update outcome rule" });
    }
  }
});

configRouter.delete("/config/outcome-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const rule = await storage.getOutcomeRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Outcome rule not found" });
    }
    if (rule.isSystem) {
      return res.status(400).json({ error: "Cannot delete system rule" });
    }
    await storage.deleteOutcomeRule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting outcome rule:", error);
    res.status(500).json({ error: "Failed to delete outcome rule" });
  }
});

// ===== CONFIGURATION - EXTRACTION SCHEMAS =====
configRouter.get("/config/extraction-schemas", async (req: Request, res: Response) => {
  try {
    const complianceStreamId = req.query.complianceStreamId as string | undefined;
    const schemas = await storage.listExtractionSchemas({ complianceStreamId });
    res.json(schemas);
  } catch (error) {
    console.error("Error fetching extraction schemas:", error);
    res.status(500).json({ error: "Failed to fetch extraction schemas" });
  }
});

configRouter.get("/config/extraction-schemas/:id", async (req: Request, res: Response) => {
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

configRouter.post("/config/extraction-schemas", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configRouter.patch("/config/extraction-schemas/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configRouter.delete("/config/extraction-schemas/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

// ===== HACT ARCHITECTURE - COMPONENT TYPES =====
configRouter.get("/component-types", async (req: Request, res: Response) => {
  try {
    const types = await storage.listComponentTypes();
    res.json(types);
  } catch (error) {
    console.error("Error fetching component types:", error);
    res.status(500).json({ error: "Failed to fetch component types" });
  }
});

configRouter.get("/component-types/:id", async (req: Request, res: Response) => {
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

configRouter.post("/component-types", async (req: Request, res: Response) => {
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

configRouter.patch("/component-types/:id", async (req: Request, res: Response) => {
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

configRouter.delete("/component-types/:id", async (req: Request, res: Response) => {
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

// ===== HACT ARCHITECTURE - SPACES (can attach to properties, blocks, or schemes) =====
configRouter.get("/spaces", async (req: Request, res: Response) => {
  try {
    const filters = {
      propertyId: req.query.propertyId as string | undefined,
      blockId: req.query.blockId as string | undefined,
      schemeId: req.query.schemeId as string | undefined,
    };
    const spacesList = await storage.listSpaces(filters);
    res.json(spacesList);
  } catch (error) {
    console.error("Error fetching spaces:", error);
    res.status(500).json({ error: "Failed to fetch spaces" });
  }
});

configRouter.get("/spaces/:id", async (req: Request, res: Response) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }
    res.json(space);
  } catch (error) {
    console.error("Error fetching space:", error);
    res.status(500).json({ error: "Failed to fetch space" });
  }
});

configRouter.post("/spaces", async (req: Request, res: Response) => {
  try {
    const data = insertSpaceSchema.parse(req.body);
    const space = await storage.createSpace(data);
    res.status(201).json(space);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating space:", error);
      res.status(500).json({ error: "Failed to create space" });
    }
  }
});

configRouter.patch("/spaces/:id", async (req: Request, res: Response) => {
  try {
    const baseSpaceSchema = createInsertSchema(spaces).omit({ id: true, createdAt: true, updatedAt: true });
    const updateData = baseSpaceSchema.partial().parse(req.body);
    
    const isUpdatingHierarchy = 'propertyId' in req.body || 'blockId' in req.body || 'schemeId' in req.body;
    if (isUpdatingHierarchy) {
      const currentSpace = await storage.getSpace(req.params.id);
      if (!currentSpace) {
        return res.status(404).json({ error: "Space not found" });
      }
      
      const mergedPropertyId = 'propertyId' in updateData ? updateData.propertyId : currentSpace.propertyId;
      const mergedBlockId = 'blockId' in updateData ? updateData.blockId : currentSpace.blockId;
      const mergedSchemeId = 'schemeId' in updateData ? updateData.schemeId : currentSpace.schemeId;
      
      const attachments = [mergedPropertyId, mergedBlockId, mergedSchemeId].filter(Boolean);
      if (attachments.length !== 1) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: [{ message: "Space must attach to exactly one level: propertyId, blockId, or schemeId" }] 
        });
      }
    }
    
    const updated = await storage.updateSpace(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: "Space not found" });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error updating space:", error);
      res.status(500).json({ error: "Failed to update space" });
    }
  }
});

configRouter.delete("/spaces/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteSpace(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Space not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting space:", error);
    res.status(500).json({ error: "Failed to delete space" });
  }
});
