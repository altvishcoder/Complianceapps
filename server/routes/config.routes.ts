import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import {
  insertComplianceStreamSchema,
  insertCertificateTypeSchema,
  insertClassificationCodeSchema,
  insertDetectionPatternSchema,
  insertOutcomeRuleSchema,
  insertExtractionSchemaSchema,
  insertComplianceRuleSchema,
  insertNormalisationRuleSchema,
  complianceStreams,
  certificateTypes,
  classificationCodes,
  certificateDetectionPatterns,
  certificateOutcomeRules,
  extractionSchemas,
  complianceRules,
  normalisationRules,
} from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";

export const configRouter = Router();

// ===== COMPLIANCE STREAMS =====
configRouter.get("/streams", async (req: Request, res: Response) => {
  try {
    const streams = await db.select().from(complianceStreams).orderBy(asc(complianceStreams.displayOrder));
    res.json(streams);
  } catch (error) {
    console.error("Error fetching compliance streams:", error);
    res.status(500).json({ error: "Failed to fetch compliance streams" });
  }
});

configRouter.post("/streams", async (req: Request, res: Response) => {
  try {
    const data = insertComplianceStreamSchema.parse(req.body);
    const [stream] = await db.insert(complianceStreams).values(data).returning();
    res.status(201).json(stream);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating compliance stream:", error);
      res.status(500).json({ error: "Failed to create compliance stream" });
    }
  }
});

configRouter.patch("/streams/:id", async (req: Request, res: Response) => {
  try {
    const [stream] = await db.update(complianceStreams)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(complianceStreams.id, req.params.id))
      .returning();
    
    if (!stream) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    res.json(stream);
  } catch (error) {
    console.error("Error updating compliance stream:", error);
    res.status(500).json({ error: "Failed to update compliance stream" });
  }
});

configRouter.delete("/streams/:id", async (req: Request, res: Response) => {
  try {
    const [stream] = await db.select().from(complianceStreams).where(eq(complianceStreams.id, req.params.id));
    
    if (!stream) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    
    if (stream.isSystem) {
      return res.status(400).json({ error: "Cannot delete system compliance stream" });
    }
    
    await db.delete(complianceStreams).where(eq(complianceStreams.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting compliance stream:", error);
    res.status(500).json({ error: "Failed to delete compliance stream" });
  }
});

// ===== CERTIFICATE TYPES =====
configRouter.get("/certificate-types", async (req: Request, res: Response) => {
  try {
    const types = await db.select().from(certificateTypes).orderBy(asc(certificateTypes.displayOrder));
    res.json(types);
  } catch (error) {
    console.error("Error fetching certificate types:", error);
    res.status(500).json({ error: "Failed to fetch certificate types" });
  }
});

configRouter.post("/certificate-types", async (req: Request, res: Response) => {
  try {
    const data = insertCertificateTypeSchema.parse(req.body);
    const [type] = await db.insert(certificateTypes).values(data).returning();
    res.status(201).json(type);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating certificate type:", error);
      res.status(500).json({ error: "Failed to create certificate type" });
    }
  }
});

configRouter.patch("/certificate-types/:id", async (req: Request, res: Response) => {
  try {
    const [type] = await db.update(certificateTypes)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(certificateTypes.id, req.params.id))
      .returning();
    
    if (!type) {
      return res.status(404).json({ error: "Certificate type not found" });
    }
    res.json(type);
  } catch (error) {
    console.error("Error updating certificate type:", error);
    res.status(500).json({ error: "Failed to update certificate type" });
  }
});

configRouter.delete("/certificate-types/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(certificateTypes).where(eq(certificateTypes.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting certificate type:", error);
    res.status(500).json({ error: "Failed to delete certificate type" });
  }
});

// ===== CLASSIFICATION CODES =====
configRouter.get("/classification-codes", async (req: Request, res: Response) => {
  try {
    const codes = await db.select().from(classificationCodes);
    res.json(codes);
  } catch (error) {
    console.error("Error fetching classification codes:", error);
    res.status(500).json({ error: "Failed to fetch classification codes" });
  }
});

configRouter.post("/classification-codes", async (req: Request, res: Response) => {
  try {
    const data = insertClassificationCodeSchema.parse(req.body);
    const [code] = await db.insert(classificationCodes).values(data).returning();
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

configRouter.patch("/classification-codes/:id", async (req: Request, res: Response) => {
  try {
    const [code] = await db.update(classificationCodes)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(classificationCodes.id, req.params.id))
      .returning();
    
    if (!code) {
      return res.status(404).json({ error: "Classification code not found" });
    }
    res.json(code);
  } catch (error) {
    console.error("Error updating classification code:", error);
    res.status(500).json({ error: "Failed to update classification code" });
  }
});

configRouter.delete("/classification-codes/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(classificationCodes).where(eq(classificationCodes.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting classification code:", error);
    res.status(500).json({ error: "Failed to delete classification code" });
  }
});

// ===== DETECTION PATTERNS =====
configRouter.get("/detection-patterns", async (req: Request, res: Response) => {
  try {
    const patterns = await db.select().from(certificateDetectionPatterns).orderBy(desc(certificateDetectionPatterns.priority));
    res.json(patterns);
  } catch (error) {
    console.error("Error fetching detection patterns:", error);
    res.status(500).json({ error: "Failed to fetch detection patterns" });
  }
});

configRouter.post("/detection-patterns", async (req: Request, res: Response) => {
  try {
    const data = insertDetectionPatternSchema.parse(req.body);
    const [pattern] = await db.insert(certificateDetectionPatterns).values(data).returning();
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

configRouter.patch("/detection-patterns/:id", async (req: Request, res: Response) => {
  try {
    const [pattern] = await db.update(certificateDetectionPatterns)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(certificateDetectionPatterns.id, req.params.id))
      .returning();
    
    if (!pattern) {
      return res.status(404).json({ error: "Detection pattern not found" });
    }
    res.json(pattern);
  } catch (error) {
    console.error("Error updating detection pattern:", error);
    res.status(500).json({ error: "Failed to update detection pattern" });
  }
});

configRouter.delete("/detection-patterns/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(certificateDetectionPatterns).where(eq(certificateDetectionPatterns.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting detection pattern:", error);
    res.status(500).json({ error: "Failed to delete detection pattern" });
  }
});

// ===== OUTCOME RULES =====
configRouter.get("/outcome-rules", async (req: Request, res: Response) => {
  try {
    const rules = await db.select().from(certificateOutcomeRules).orderBy(desc(certificateOutcomeRules.priority));
    res.json(rules);
  } catch (error) {
    console.error("Error fetching outcome rules:", error);
    res.status(500).json({ error: "Failed to fetch outcome rules" });
  }
});

configRouter.post("/outcome-rules", async (req: Request, res: Response) => {
  try {
    const data = insertOutcomeRuleSchema.parse(req.body);
    const [rule] = await db.insert(certificateOutcomeRules).values(data).returning();
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

configRouter.patch("/outcome-rules/:id", async (req: Request, res: Response) => {
  try {
    const [rule] = await db.update(certificateOutcomeRules)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(certificateOutcomeRules.id, req.params.id))
      .returning();
    
    if (!rule) {
      return res.status(404).json({ error: "Outcome rule not found" });
    }
    res.json(rule);
  } catch (error) {
    console.error("Error updating outcome rule:", error);
    res.status(500).json({ error: "Failed to update outcome rule" });
  }
});

configRouter.delete("/outcome-rules/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(certificateOutcomeRules).where(eq(certificateOutcomeRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting outcome rule:", error);
    res.status(500).json({ error: "Failed to delete outcome rule" });
  }
});

// ===== EXTRACTION SCHEMAS =====
configRouter.get("/extraction-schemas", async (req: Request, res: Response) => {
  try {
    const schemas = await db.select().from(extractionSchemas);
    res.json(schemas);
  } catch (error) {
    console.error("Error fetching extraction schemas:", error);
    res.status(500).json({ error: "Failed to fetch extraction schemas" });
  }
});

configRouter.post("/extraction-schemas", async (req: Request, res: Response) => {
  try {
    const data = insertExtractionSchemaSchema.parse(req.body);
    const [schema] = await db.insert(extractionSchemas).values(data).returning();
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

configRouter.patch("/extraction-schemas/:id", async (req: Request, res: Response) => {
  try {
    const [schema] = await db.update(extractionSchemas)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(extractionSchemas.id, req.params.id))
      .returning();
    
    if (!schema) {
      return res.status(404).json({ error: "Extraction schema not found" });
    }
    res.json(schema);
  } catch (error) {
    console.error("Error updating extraction schema:", error);
    res.status(500).json({ error: "Failed to update extraction schema" });
  }
});

configRouter.delete("/extraction-schemas/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(extractionSchemas).where(eq(extractionSchemas.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting extraction schema:", error);
    res.status(500).json({ error: "Failed to delete extraction schema" });
  }
});

// ===== COMPLIANCE RULES =====
configRouter.get("/compliance-rules", async (req: Request, res: Response) => {
  try {
    const rules = await db.select().from(complianceRules);
    res.json(rules);
  } catch (error) {
    console.error("Error fetching compliance rules:", error);
    res.status(500).json({ error: "Failed to fetch compliance rules" });
  }
});

configRouter.post("/compliance-rules", async (req: Request, res: Response) => {
  try {
    const data = insertComplianceRuleSchema.parse(req.body);
    const [rule] = await db.insert(complianceRules).values(data).returning();
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

configRouter.patch("/compliance-rules/:id", async (req: Request, res: Response) => {
  try {
    const [rule] = await db.update(complianceRules)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(complianceRules.id, req.params.id))
      .returning();
    
    if (!rule) {
      return res.status(404).json({ error: "Compliance rule not found" });
    }
    res.json(rule);
  } catch (error) {
    console.error("Error updating compliance rule:", error);
    res.status(500).json({ error: "Failed to update compliance rule" });
  }
});

configRouter.delete("/compliance-rules/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(complianceRules).where(eq(complianceRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting compliance rule:", error);
    res.status(500).json({ error: "Failed to delete compliance rule" });
  }
});

// ===== NORMALISATION RULES =====
configRouter.get("/normalisation-rules", async (req: Request, res: Response) => {
  try {
    const rules = await db.select().from(normalisationRules);
    res.json(rules);
  } catch (error) {
    console.error("Error fetching normalisation rules:", error);
    res.status(500).json({ error: "Failed to fetch normalisation rules" });
  }
});

configRouter.post("/normalisation-rules", async (req: Request, res: Response) => {
  try {
    const data = insertNormalisationRuleSchema.parse(req.body);
    const [rule] = await db.insert(normalisationRules).values(data).returning();
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

configRouter.patch("/normalisation-rules/:id", async (req: Request, res: Response) => {
  try {
    const [rule] = await db.update(normalisationRules)
      .set(req.body)
      .where(eq(normalisationRules.id, req.params.id))
      .returning();
    
    if (!rule) {
      return res.status(404).json({ error: "Normalisation rule not found" });
    }
    res.json(rule);
  } catch (error) {
    console.error("Error updating normalisation rule:", error);
    res.status(500).json({ error: "Failed to update normalisation rule" });
  }
});

configRouter.delete("/normalisation-rules/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(normalisationRules).where(eq(normalisationRules.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting normalisation rule:", error);
    res.status(500).json({ error: "Failed to delete normalisation rule" });
  }
});
