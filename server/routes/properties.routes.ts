import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSchemeSchema, insertBlockSchema, insertPropertySchema, insertOrganisationSchema } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const propertiesRouter = Router();

const ORG_ID = "org-001";

// ===== SCHEMES =====
propertiesRouter.get("/schemes", async (req: Request, res: Response) => {
  try {
    const schemes = await storage.listSchemes(ORG_ID);
    res.json(schemes);
  } catch (error) {
    console.error("Error fetching schemes:", error);
    res.status(500).json({ error: "Failed to fetch schemes" });
  }
});

propertiesRouter.post("/schemes", async (req: Request, res: Response) => {
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

propertiesRouter.patch("/schemes/:id", async (req: Request, res: Response) => {
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

propertiesRouter.delete("/schemes/:id", async (req: Request, res: Response) => {
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
propertiesRouter.get("/blocks", async (req: Request, res: Response) => {
  try {
    const schemeId = req.query.schemeId as string | undefined;
    const blocks = await storage.listBlocks(schemeId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

propertiesRouter.post("/blocks", async (req: Request, res: Response) => {
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

propertiesRouter.patch("/blocks/:id", async (req: Request, res: Response) => {
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

propertiesRouter.delete("/blocks/:id", async (req: Request, res: Response) => {
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

// ===== ORGANISATIONS =====
propertiesRouter.get("/organisations", async (req: Request, res: Response) => {
  try {
    const orgs = await storage.listOrganisations();
    res.json(orgs);
  } catch (error) {
    console.error("Error fetching organisations:", error);
    res.status(500).json({ error: "Failed to fetch organisations" });
  }
});

propertiesRouter.get("/organisations/:id", async (req: Request, res: Response) => {
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

propertiesRouter.post("/organisations", async (req: Request, res: Response) => {
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

propertiesRouter.patch("/organisations/:id", async (req: Request, res: Response) => {
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

propertiesRouter.delete("/organisations/:id", async (req: Request, res: Response) => {
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

// ===== PROPERTIES =====
propertiesRouter.get("/properties", paginationMiddleware(), async (req: Request, res: Response) => {
  try {
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const blockId = req.query.blockId as string | undefined;
    const schemeId = req.query.schemeId as string | undefined;
    
    const properties = await storage.listProperties(ORG_ID, { blockId, search });
    
    let filtered = properties;
    if (schemeId) {
      const blocks = await storage.listBlocks(schemeId);
      const blockIds = new Set(blocks.map(b => b.id));
      filtered = properties.filter(p => p.blockId && blockIds.has(p.blockId));
    }
    
    const total = filtered.length;
    const paginatedProperties = filtered.slice(offset, offset + limit);
    
    res.json({ data: paginatedProperties, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

propertiesRouter.get("/properties/:id", async (req: Request, res: Response) => {
  try {
    const property = await storage.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    
    const certificates = await storage.listCertificates(ORG_ID, { propertyId: property.id });
    const actions = await storage.listRemedialActions(ORG_ID, { propertyId: property.id });
    
    res.json({
      ...property,
      certificates,
      actions,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ error: "Failed to fetch property" });
  }
});

propertiesRouter.post("/properties", async (req: Request, res: Response) => {
  try {
    const data = insertPropertySchema.parse({ ...req.body, organisationId: ORG_ID });
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

propertiesRouter.patch("/properties/:id", async (req: Request, res: Response) => {
  try {
    const property = await storage.updateProperty(req.params.id, req.body);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(property);
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: "Failed to update property" });
  }
});

propertiesRouter.post("/properties/bulk-delete", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Property IDs array is required" });
    }
    
    let deleted = 0;
    for (const id of ids) {
      const result = await storage.deleteProperty(id);
      if (result) deleted++;
    }
    
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting properties:", error);
    res.status(500).json({ error: "Failed to delete properties" });
  }
});
