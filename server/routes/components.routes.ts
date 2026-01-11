import { Router, Response } from "express";
import { z } from "zod";
import { eq, desc, and, or, sql, inArray, type SQL } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { components, properties, blocks, schemes, insertComponentSchema } from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";

export const componentsRouter = Router();

function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

async function isComponentInOrg(componentId: string, orgId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT c.id FROM components c
    LEFT JOIN properties p ON c.property_id = p.id
    LEFT JOIN blocks b ON COALESCE(c.block_id, p.block_id) = b.id
    LEFT JOIN schemes s ON b.scheme_id = s.id
    WHERE c.id = ${componentId} AND s.organisation_id = ${orgId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

async function isPropertyInOrg(propertyId: string, orgId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT p.id FROM properties p
    LEFT JOIN blocks b ON p.block_id = b.id
    LEFT JOIN schemes s ON b.scheme_id = s.id
    WHERE p.id = ${propertyId} AND s.organisation_id = ${orgId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

async function isBlockInOrg(blockId: string, orgId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT b.id FROM blocks b
    LEFT JOIN schemes s ON b.scheme_id = s.id
    WHERE b.id = ${blockId} AND s.organisation_id = ${orgId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

componentsRouter.use(requireAuth as any);

componentsRouter.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const result = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total, 
        COUNT(CASE WHEN c.condition = 'CRITICAL' THEN 1 END)::int as critical,
        COUNT(CASE WHEN c.condition = 'POOR' THEN 1 END)::int as poor,
        COUNT(CASE WHEN c.condition = 'FAIR' THEN 1 END)::int as fair,
        COUNT(CASE WHEN c.condition = 'GOOD' THEN 1 END)::int as good,
        COUNT(CASE WHEN c.condition IS NULL THEN 1 END)::int as unknown
      FROM components c
      LEFT JOIN properties p ON c.property_id = p.id
      LEFT JOIN blocks b ON COALESCE(c.block_id, p.block_id) = b.id
      LEFT JOIN schemes s ON b.scheme_id = s.id
      WHERE s.organisation_id = ${orgId}
    `);
    
    const row = (result.rows as any[])[0] || {};
    res.json({
      total: parseInt(row.total || '0'),
      conditionSummary: {
        CRITICAL: parseInt(row.critical || '0'),
        POOR: parseInt(row.poor || '0'),
        FAIR: parseInt(row.fair || '0'),
        GOOD: parseInt(row.good || '0'),
        UNKNOWN: parseInt(row.unknown || '0'),
      }
    });
  } catch (error) {
    console.error("Error fetching component stats:", error);
    res.status(500).json({ error: "Failed to fetch component stats" });
  }
});

componentsRouter.get("/", paginationMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const filters = {
      propertyId: req.query.propertyId as string | undefined,
      spaceId: req.query.spaceId as string | undefined,
      blockId: req.query.blockId as string | undefined,
      componentTypeId: req.query.componentTypeId as string | undefined,
    };
    
    const allComponentTypes = await storage.listComponentTypes();
    const typeMap = new Map(allComponentTypes.map(t => [t.id, t]));
    
    let searchClause = sql``;
    if (search) {
      const searchLower = search.toLowerCase();
      const searchPattern = `%${searchLower}%`;
      const matchingTypeIds = allComponentTypes
        .filter(t => t.name.toLowerCase().includes(searchLower))
        .map(t => t.id);
      
      if (matchingTypeIds.length > 0) {
        searchClause = sql` AND (
          LOWER(c.serial_number) LIKE ${searchPattern} OR
          LOWER(c.manufacturer) LIKE ${searchPattern} OR
          LOWER(c.model) LIKE ${searchPattern} OR
          LOWER(c.location) LIKE ${searchPattern} OR
          c.component_type_id = ANY(${matchingTypeIds}::text[])
        )`;
      } else {
        searchClause = sql` AND (
          LOWER(c.serial_number) LIKE ${searchPattern} OR
          LOWER(c.manufacturer) LIKE ${searchPattern} OR
          LOWER(c.model) LIKE ${searchPattern} OR
          LOWER(c.location) LIKE ${searchPattern}
        )`;
      }
    }
    
    let filterClause = sql``;
    if (filters.propertyId) filterClause = sql`${filterClause} AND c.property_id = ${filters.propertyId}`;
    if (filters.spaceId) filterClause = sql`${filterClause} AND c.space_id = ${filters.spaceId}`;
    if (filters.blockId) filterClause = sql`${filterClause} AND c.block_id = ${filters.blockId}`;
    if (filters.componentTypeId) filterClause = sql`${filterClause} AND c.component_type_id = ${filters.componentTypeId}`;
    
    const [countResult, summaryResult, paginatedResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int as count FROM components c
        LEFT JOIN properties p ON c.property_id = p.id
        LEFT JOIN blocks b ON COALESCE(c.block_id, p.block_id) = b.id
        LEFT JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${orgId} ${filterClause} ${searchClause}
      `),
      db.execute(sql`
        SELECT c.condition, COUNT(*)::int as count FROM components c
        LEFT JOIN properties p ON c.property_id = p.id
        LEFT JOIN blocks b ON COALESCE(c.block_id, p.block_id) = b.id
        LEFT JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${orgId} ${filterClause} ${searchClause}
        GROUP BY c.condition
      `),
      db.execute(sql`
        SELECT c.* FROM components c
        LEFT JOIN properties p ON c.property_id = p.id
        LEFT JOIN blocks b ON COALESCE(c.block_id, p.block_id) = b.id
        LEFT JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${orgId} ${filterClause} ${searchClause}
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)
    ]);
    
    const total = (countResult.rows[0] as any)?.count ?? 0;
    const conditionSummary = {
      CRITICAL: 0, POOR: 0, FAIR: 0, GOOD: 0, UNKNOWN: 0
    };
    for (const row of summaryResult.rows as any[]) {
      const cond = row.condition || 'UNKNOWN';
      if (cond in conditionSummary) {
        conditionSummary[cond as keyof typeof conditionSummary] = parseInt(row.count);
      }
    }
    
    const paginatedComponents = paginatedResult.rows as any[];
    const uniquePropertyIds = Array.from(new Set(paginatedComponents.map(c => c.property_id).filter((id): id is string => id !== null)));
    const allProperties = uniquePropertyIds.length > 0 
      ? await Promise.all(uniquePropertyIds.map(id => storage.getProperty(id)))
      : [];
    const propertyMap = new Map(allProperties.filter(Boolean).map(p => [p!.id, { id: p!.id, addressLine1: p!.addressLine1, postcode: p!.postcode }]));
    
    const enriched = paginatedComponents.map(comp => ({
      id: comp.id,
      componentTypeId: comp.component_type_id,
      propertyId: comp.property_id,
      spaceId: comp.space_id,
      blockId: comp.block_id,
      serialNumber: comp.serial_number,
      manufacturer: comp.manufacturer,
      model: comp.model,
      location: comp.location,
      condition: comp.condition,
      isActive: comp.is_active,
      needsVerification: comp.needs_verification,
      createdAt: comp.created_at,
      updatedAt: comp.updated_at,
      componentType: typeMap.get(comp.component_type_id),
      property: comp.property_id ? propertyMap.get(comp.property_id) : undefined
    }));
    
    res.json({ data: enriched, total, page, limit, totalPages: Math.ceil(total / limit), conditionSummary });
  } catch (error) {
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components" });
  }
});

componentsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const component = await storage.getComponent(req.params.id);
    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    if (!(await isComponentInOrg(req.params.id, orgId))) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    const type = await storage.getComponentType(component.componentTypeId);
    res.json({ ...component, componentType: type });
  } catch (error) {
    console.error("Error fetching component:", error);
    res.status(500).json({ error: "Failed to fetch component" });
  }
});

componentsRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const data = insertComponentSchema.parse(req.body);
    
    if (data.propertyId) {
      if (!(await isPropertyInOrg(data.propertyId, orgId))) {
        return res.status(400).json({ error: "Property not found or access denied" });
      }
    }
    
    if (data.blockId) {
      if (!(await isBlockInOrg(data.blockId, orgId))) {
        return res.status(400).json({ error: "Block not found or access denied" });
      }
    }
    
    if (!data.propertyId && !data.blockId) {
      return res.status(400).json({ error: "Either propertyId or blockId must be provided" });
    }
    
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

componentsRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    if (!(await isComponentInOrg(req.params.id, orgId))) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    const updateData = insertComponentSchema.partial().parse(req.body);
    
    if (updateData.propertyId) {
      if (!(await isPropertyInOrg(updateData.propertyId, orgId))) {
        return res.status(400).json({ error: "Property not found or access denied" });
      }
    }
    
    if (updateData.blockId) {
      if (!(await isBlockInOrg(updateData.blockId, orgId))) {
        return res.status(400).json({ error: "Block not found or access denied" });
      }
    }
    
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

componentsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    if (!(await isComponentInOrg(req.params.id, orgId))) {
      return res.status(404).json({ error: "Component not found" });
    }
    
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

componentsRouter.post("/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { id } = req.params;
    if (!(await isComponentInOrg(id, orgId))) {
      return res.status(404).json({ error: "Component not found" });
    }
    
    const updated = await storage.updateComponent(id, { needsVerification: false, isActive: true });
    if (!updated) {
      return res.status(404).json({ error: "Component not found" });
    }
    res.json({ success: true, approved: 1 });
  } catch (error) {
    console.error("Error approving component:", error);
    res.status(500).json({ error: "Failed to approve component" });
  }
});

componentsRouter.post("/bulk-approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }
    
    let approved = 0;
    for (const id of ids) {
      if (!(await isComponentInOrg(id, orgId))) continue;
      const updated = await storage.updateComponent(id, { needsVerification: false, isActive: true });
      if (updated) approved++;
    }
    res.json({ success: true, approved });
  } catch (error) {
    console.error("Error bulk approving components:", error);
    res.status(500).json({ error: "Failed to bulk approve components" });
  }
});

componentsRouter.post("/bulk-reject", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }
    
    let rejected = 0;
    for (const id of ids) {
      if (!(await isComponentInOrg(id, orgId))) continue;
      const updated = await storage.updateComponent(id, { isActive: false });
      if (updated) rejected++;
    }
    res.json({ success: true, rejected });
  } catch (error) {
    console.error("Error bulk rejecting components:", error);
    res.status(500).json({ error: "Failed to bulk reject components" });
  }
});

componentsRouter.post("/bulk-delete", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }
    
    let deleted = 0;
    for (const id of ids) {
      if (!(await isComponentInOrg(id, orgId))) continue;
      const result = await storage.deleteComponent(id);
      if (result) deleted++;
    }
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error bulk deleting components:", error);
    res.status(500).json({ error: "Failed to bulk delete components" });
  }
});
