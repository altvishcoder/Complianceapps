import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSchemeSchema, insertBlockSchema, insertPropertySchema, insertOrganisationSchema, properties, blocks, schemes } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";

export const propertiesRouter = Router();

// Apply requireAuth middleware to all routes in this router
propertiesRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// ===== SCHEMES =====
propertiesRouter.get("/schemes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    const schemes = await storage.listSchemes(orgId);
    res.json(schemes);
  } catch (error) {
    console.error("Error fetching schemes:", error);
    res.status(500).json({ error: "Failed to fetch schemes" });
  }
});

propertiesRouter.post("/schemes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
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

propertiesRouter.patch("/schemes/:id", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.delete("/schemes/:id", async (req: AuthenticatedRequest, res: Response) => {
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
propertiesRouter.get("/blocks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schemeId = req.query.schemeId as string | undefined;
    const blocks = await storage.listBlocks(schemeId);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

propertiesRouter.post("/blocks", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.patch("/blocks/:id", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.delete("/blocks/:id", async (req: AuthenticatedRequest, res: Response) => {
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
propertiesRouter.get("/organisations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await storage.listOrganisations();
    res.json(orgs);
  } catch (error) {
    console.error("Error fetching organisations:", error);
    res.status(500).json({ error: "Failed to fetch organisations" });
  }
});

propertiesRouter.post("/organisations", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.get("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.patch("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.delete("/organisations/:id", async (req: AuthenticatedRequest, res: Response) => {
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
propertiesRouter.get("/properties", paginationMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const blockId = req.query.blockId as string | undefined;
    const schemeId = req.query.schemeId as string | undefined;
    const search = req.query.search as string | undefined;
    const complianceStatus = req.query.complianceStatus as string | undefined;
    
    const { data, total } = await storage.listPropertiesPaginated(orgId, {
      blockId,
      schemeId,
      search,
      complianceStatus,
      limit,
      offset,
    });
    
    const enrichedProperties = data.map(prop => ({
      ...prop,
      fullAddress: `${prop.addressLine1}, ${prop.city || ''}, ${prop.postcode}`,
    }));
    
    res.json({ data: enrichedProperties, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// ===== PROPERTY STATS =====
propertiesRouter.get("/properties/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const result = await db.execute(sql`
      SELECT total_properties, no_gas_safety_cert, unverified, non_compliant, scheme_count
      FROM mv_property_stats
      WHERE organisation_id = ${orgId}
      LIMIT 1
    `);
    
    const row = (result.rows as any[])[0];
    
    if (row) {
      res.json({
        totalProperties: parseInt(row.total_properties || '0'),
        noGasSafetyCert: parseInt(row.no_gas_safety_cert || '0'),
        unverified: parseInt(row.unverified || '0'),
        nonCompliant: parseInt(row.non_compliant || '0'),
        schemeCount: parseInt(row.scheme_count || '0'),
      });
    } else {
      const stats = await db.select({
        totalProperties: sql<number>`COUNT(*)`,
        noGasSafetyCert: sql<number>`SUM(CASE WHEN ${properties.hasGas} = true AND ${properties.complianceStatus} != 'COMPLIANT' THEN 1 ELSE 0 END)`,
        unverified: sql<number>`SUM(CASE WHEN ${properties.linkStatus} = 'UNVERIFIED' THEN 1 ELSE 0 END)`,
        nonCompliant: sql<number>`SUM(CASE WHEN ${properties.complianceStatus} IN ('NON_COMPLIANT', 'OVERDUE') THEN 1 ELSE 0 END)`,
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, orgId));
      
      const schemeCount = await db.select({ count: sql<number>`COUNT(DISTINCT ${schemes.id})` })
        .from(schemes)
        .where(eq(schemes.organisationId, orgId));
      
      res.json({
        totalProperties: Number(stats[0]?.totalProperties ?? 0),
        noGasSafetyCert: Number(stats[0]?.noGasSafetyCert ?? 0),
        unverified: Number(stats[0]?.unverified ?? 0),
        nonCompliant: Number(stats[0]?.nonCompliant ?? 0),
        schemeCount: Number(schemeCount[0]?.count ?? 0),
      });
    }
  } catch (error) {
    console.error("Error fetching property stats:", error);
    res.status(500).json({ error: "Failed to fetch property statistics" });
  }
});

propertiesRouter.get("/properties/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const property = await storage.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    
    const block = property.blockId ? await storage.getBlock(property.blockId) : null;
    const scheme = block?.schemeId ? await storage.getScheme(block.schemeId) : null;
    const certificates = await storage.listCertificates(orgId, { propertyId: property.id });
    const actions = await storage.listRemedialActions(orgId, { propertyId: property.id });
    const componentsList = await storage.listComponents({ propertyId: property.id });
    
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

propertiesRouter.post("/properties", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const data = insertPropertySchema.parse({ ...req.body, organisationId: orgId });
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

propertiesRouter.patch("/properties/:id", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.delete("/properties/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await storage.deleteProperty(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ error: "Failed to delete property" });
  }
});

propertiesRouter.post("/properties/bulk-delete", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.post("/properties/:id/verify", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    const verified = await storage.bulkVerifyProperties([id]);
    if (verified === 0) {
      return res.status(404).json({ error: "Property not found or already verified" });
    }
    res.json({ success: true, verified });
  } catch (error) {
    console.error("Error verifying property:", error);
    res.status(500).json({ error: "Failed to verify property" });
  }
});

propertiesRouter.post("/properties/bulk-verify", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.post("/properties/bulk-reject", async (req: AuthenticatedRequest, res: Response) => {
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

propertiesRouter.post("/properties/auto-create", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const { addressLine1, city, postcode } = req.body;
    if (!addressLine1) {
      return res.status(400).json({ error: "Address is required" });
    }
    const property = await storage.getOrCreateAutoProperty(orgId, { addressLine1, city, postcode });
    res.json(property);
  } catch (error) {
    console.error("Error auto-creating property:", error);
    res.status(500).json({ error: "Failed to create property" });
  }
});
