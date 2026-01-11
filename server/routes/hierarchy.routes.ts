import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSchemeSchema, insertBlockSchema, insertOrganisationSchema } from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "../session";

export const hierarchyRouter = Router();

function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// ===== SCHEMES =====
hierarchyRouter.get("/schemes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req) || "default-org";
    const schemes = await storage.listSchemes(orgId);
    res.json(schemes);
  } catch (error) {
    console.error("Error fetching schemes:", error);
    res.status(500).json({ error: "Failed to fetch schemes" });
  }
});

hierarchyRouter.post("/schemes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req) || "default-org";
    const data = insertSchemeSchema.parse({ ...req.body, organisationId: orgId });
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

hierarchyRouter.patch("/schemes/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scheme = await storage.updateScheme(req.params.id, req.body);
    if (!scheme) {
      return res.status(404).json({ error: "Scheme not found" });
    }
    res.json(scheme);
  } catch (error) {
    console.error("Error updating scheme:", error);
    res.status(500).json({ error: "Failed to update scheme" });
  }
});

hierarchyRouter.delete("/schemes/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await storage.deleteScheme(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Scheme not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheme:", error);
    res.status(500).json({ error: "Failed to delete scheme" });
  }
});

// ===== BLOCKS =====
hierarchyRouter.get("/blocks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schemeId = req.query.schemeId as string | undefined;
    const blocks = await storage.listBlocks(schemeId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

hierarchyRouter.post("/blocks", async (req: AuthenticatedRequest, res: Response) => {
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

hierarchyRouter.patch("/blocks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const block = await storage.updateBlock(req.params.id, req.body);
    if (!block) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json(block);
  } catch (error) {
    console.error("Error updating block:", error);
    res.status(500).json({ error: "Failed to update block" });
  }
});

hierarchyRouter.delete("/blocks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await storage.deleteBlock(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Block not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting block:", error);
    res.status(500).json({ error: "Failed to delete block" });
  }
});

// ===== HIERARCHY STATS =====
hierarchyRouter.get("/hierarchy/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await storage.getHierarchyStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching hierarchy stats:", error);
    res.status(500).json({ error: "Failed to fetch hierarchy stats" });
  }
});

// ===== ORGANISATIONS =====
hierarchyRouter.get("/organisations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await storage.listOrganisations();
    res.json(orgs);
  } catch (error) {
    console.error("Error fetching organisations:", error);
    res.status(500).json({ error: "Failed to fetch organisations" });
  }
});

hierarchyRouter.get("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await storage.getOrganisation(req.params.id);
    if (!org) {
      return res.status(404).json({ error: "Organisation not found" });
    }
    res.json(org);
  } catch (error) {
    console.error("Error fetching organisation:", error);
    res.status(500).json({ error: "Failed to fetch organisation" });
  }
});

hierarchyRouter.post("/organisations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = insertOrganisationSchema.parse(req.body);
    const org = await storage.createOrganisation(data);
    res.status(201).json(org);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating organisation:", error);
      res.status(500).json({ error: "Failed to create organisation" });
    }
  }
});

hierarchyRouter.patch("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await storage.updateOrganisation(req.params.id, req.body);
    if (!org) {
      return res.status(404).json({ error: "Organisation not found" });
    }
    res.json(org);
  } catch (error) {
    console.error("Error updating organisation:", error);
    res.status(500).json({ error: "Failed to update organisation" });
  }
});

hierarchyRouter.delete("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await storage.deleteOrganisation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Organisation not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting organisation:", error);
    res.status(500).json({ error: "Failed to delete organisation" });
  }
});
