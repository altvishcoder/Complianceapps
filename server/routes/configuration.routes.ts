import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireRole } from "../session";
import {
  insertComplianceStreamSchema,
  insertCertificateTypeSchema,
  insertComplianceRuleSchema,
  insertNormalisationRuleSchema,
} from "@shared/schema";

export const configurationRouter = Router();

const CONFIG_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'] as const;

// ===== CONFIGURATION - COMPLIANCE STREAMS =====
configurationRouter.get("/config/compliance-streams", async (req: Request, res: Response) => {
  try {
    const streams = await storage.listComplianceStreams();
    res.json(streams);
  } catch (error) {
    console.error("Error fetching compliance streams:", error);
    res.status(500).json({ error: "Failed to fetch compliance streams" });
  }
});

configurationRouter.get("/config/compliance-streams/:id", async (req: Request, res: Response) => {
  try {
    const stream = await storage.getComplianceStream(req.params.id);
    if (!stream) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    res.json(stream);
  } catch (error) {
    console.error("Error fetching compliance stream:", error);
    res.status(500).json({ error: "Failed to fetch compliance stream" });
  }
});

configurationRouter.post("/config/compliance-streams", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const data = insertComplianceStreamSchema.parse(req.body);
    const stream = await storage.createComplianceStream(data);
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

configurationRouter.patch("/config/compliance-streams/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const existingStream = await storage.getComplianceStream(req.params.id);
    if (!existingStream) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    
    const updateData = insertComplianceStreamSchema.partial().parse(req.body);
    if (existingStream.isSystem) {
      const allowedUpdates: any = {};
      if (updateData.isActive !== undefined) {
        allowedUpdates.isActive = updateData.isActive;
      }
      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(403).json({ error: "Cannot modify system stream properties other than isActive" });
      }
      const updated = await storage.updateComplianceStream(req.params.id, allowedUpdates);
      return res.json(updated);
    }
    
    const { isSystem: _, ...safeUpdateData } = updateData as any;
    const updated = await storage.updateComplianceStream(req.params.id, safeUpdateData);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error updating compliance stream:", error);
      res.status(500).json({ error: "Failed to update compliance stream" });
    }
  }
});

configurationRouter.delete("/config/compliance-streams/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const existingStream = await storage.getComplianceStream(req.params.id);
    if (!existingStream) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    
    if (existingStream.isSystem) {
      return res.status(403).json({ error: "Cannot delete system streams. Use isActive to disable." });
    }
    
    const deleted = await storage.deleteComplianceStream(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Compliance stream not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting compliance stream:", error);
    res.status(500).json({ error: "Failed to delete compliance stream" });
  }
});

// ===== CONFIGURATION - CERTIFICATE TYPES =====
configurationRouter.get("/config/certificate-types", async (req: Request, res: Response) => {
  try {
    const types = await storage.listCertificateTypes();
    res.json(types);
  } catch (error) {
    console.error("Error fetching certificate types:", error);
    res.status(500).json({ error: "Failed to fetch certificate types" });
  }
});

configurationRouter.get("/config/certificate-types/:id", async (req: Request, res: Response) => {
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

configurationRouter.post("/config/certificate-types", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.patch("/config/certificate-types/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.delete("/config/certificate-types/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

// ===== CONFIGURATION - COMPLIANCE RULES =====
configurationRouter.get("/config/compliance-rules", async (req: Request, res: Response) => {
  try {
    const complianceStreamId = req.query.complianceStreamId as string | undefined;
    const rules = await storage.listComplianceRules({ complianceStreamId });
    res.json(rules);
  } catch (error) {
    console.error("Error fetching compliance rules:", error);
    res.status(500).json({ error: "Failed to fetch compliance rules" });
  }
});

configurationRouter.get("/config/compliance-rules/:id", async (req: Request, res: Response) => {
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

configurationRouter.post("/config/compliance-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.patch("/config/compliance-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.delete("/config/compliance-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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
configurationRouter.get("/config/normalisation-rules", async (req: Request, res: Response) => {
  try {
    const complianceStreamId = req.query.complianceStreamId as string | undefined;
    const rules = await storage.listNormalisationRules({ complianceStreamId });
    res.json(rules);
  } catch (error) {
    console.error("Error fetching normalisation rules:", error);
    res.status(500).json({ error: "Failed to fetch normalisation rules" });
  }
});

configurationRouter.get("/config/normalisation-rules/:id", async (req: Request, res: Response) => {
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

configurationRouter.post("/config/normalisation-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.patch("/config/normalisation-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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

configurationRouter.delete("/config/normalisation-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req: Request, res: Response) => {
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
