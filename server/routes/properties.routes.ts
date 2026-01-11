import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertPropertySchema, properties, blocks, schemes } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { handleRouteError } from "../errors";

export const propertiesRouter = Router();

// Apply requireAuth middleware to all routes in this router
propertiesRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// Note: Schemes, blocks, and organisations endpoints have been moved to hierarchy.routes.ts

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
    handleRouteError(error, req, res, "Properties");
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
    handleRouteError(error, req, res, "Property Statistics");
  }
});

// ===== PROPERTY GEO DATA (must be before /:id route) =====
propertiesRouter.get("/properties/geo", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const result = await db.execute(sql`
      SELECT 
        p.id,
        p.address_line1 as name,
        CONCAT(p.address_line1, ', ', COALESCE(p.city, ''), ', ', p.postcode) as address,
        p.latitude as lat,
        p.longitude as lng,
        COALESCE(rs.overall_score, 75) as "riskScore",
        1 as "propertyCount",
        1 as "unitCount",
        p.ward,
        p.lsoa
      FROM properties p
      LEFT JOIN property_risk_snapshots rs ON rs.property_id = p.id AND rs.is_latest = true
      INNER JOIN blocks b ON p.block_id = b.id
      INNER JOIN schemes s ON b.scheme_id = s.id
      WHERE s.organisation_id = ${orgId}
        AND p.latitude IS NOT NULL 
        AND p.longitude IS NOT NULL
    `);
    
    const geoProperties = (result.rows as any[]).map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      riskScore: Number(row.riskScore),
      propertyCount: 1,
      unitCount: 1,
      ward: row.ward,
      lsoa: row.lsoa
    }));
    
    res.json(geoProperties);
  } catch (error) {
    handleRouteError(error, req, res, "Property Geodata");
  }
});

// ===== PROPERTY GEO HEATMAP (grid-aggregated for performance) =====
propertiesRouter.get("/properties/geo/heatmap", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const rawGridSize = parseInt(req.query.gridSize as string) || 50;
    const gridSize = Math.max(5, Math.min(200, rawGridSize));
    
    const result = await db.execute(sql`
      WITH bounds AS (
        SELECT 
          MIN(p.latitude) as min_lat,
          MAX(p.latitude) as max_lat,
          MIN(p.longitude) as min_lng,
          MAX(p.longitude) as max_lng,
          COUNT(*) as total_count
        FROM properties p
        INNER JOIN blocks b ON p.block_id = b.id
        INNER JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${orgId}
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
      ),
      grid_params AS (
        SELECT 
          min_lat,
          max_lat,
          min_lng,
          max_lng,
          total_count,
          CASE 
            WHEN max_lat = min_lat THEN 0.01
            ELSE GREATEST((max_lat - min_lat) / ${gridSize}, 0.0001)
          END as lat_step,
          CASE 
            WHEN max_lng = min_lng THEN 0.01
            ELSE GREATEST((max_lng - min_lng) / ${gridSize}, 0.0001)
          END as lng_step
        FROM bounds
        WHERE total_count > 0
      ),
      property_data AS (
        SELECT 
          p.latitude,
          p.longitude,
          COALESCE(rs.overall_score, 75) as risk_score
        FROM properties p
        LEFT JOIN property_risk_snapshots rs ON rs.property_id = p.id AND rs.is_latest = true
        INNER JOIN blocks b ON p.block_id = b.id
        INNER JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${orgId}
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
      ),
      grid_cells AS (
        SELECT 
          FLOOR((pd.latitude - gp.min_lat) / gp.lat_step) as grid_row,
          FLOOR((pd.longitude - gp.min_lng) / gp.lng_step) as grid_col,
          gp.min_lat + (FLOOR((pd.latitude - gp.min_lat) / gp.lat_step) + 0.5) * gp.lat_step as cell_lat,
          gp.min_lng + (FLOOR((pd.longitude - gp.min_lng) / gp.lng_step) + 0.5) * gp.lng_step as cell_lng,
          pd.risk_score,
          gp.lat_step,
          gp.lng_step
        FROM property_data pd
        CROSS JOIN grid_params gp
      )
      SELECT 
        cell_lat as lat,
        cell_lng as lng,
        ROUND(AVG(risk_score)::numeric, 1) as avg_risk,
        MIN(risk_score) as min_risk,
        MAX(risk_score) as max_risk,
        COUNT(*) as property_count,
        lat_step,
        lng_step
      FROM grid_cells
      WHERE grid_row IS NOT NULL AND grid_col IS NOT NULL
      GROUP BY grid_row, grid_col, cell_lat, cell_lng, lat_step, lng_step
      ORDER BY avg_risk DESC
    `);
    
    const rows = result.rows as any[];
    
    if (rows.length === 0) {
      return res.json({ 
        cells: [], 
        bounds: null,
        cellSize: { latStep: 0, lngStep: 0 },
        stats: { totalCells: 0, totalProperties: 0, avgRisk: 0 }
      });
    }
    
    const cells = rows.map(row => ({
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      avgRisk: parseFloat(row.avg_risk),
      minRisk: parseFloat(row.min_risk),
      maxRisk: parseFloat(row.max_risk),
      count: parseInt(row.property_count)
    }));
    
    const firstRow = rows[0];
    const totalProperties = cells.reduce((sum, c) => sum + c.count, 0);
    const weightedAvg = cells.reduce((sum, c) => sum + c.avgRisk * c.count, 0) / totalProperties;
    
    res.json({
      cells,
      cellSize: {
        latStep: parseFloat(firstRow.lat_step),
        lngStep: parseFloat(firstRow.lng_step)
      },
      stats: {
        totalCells: cells.length,
        totalProperties,
        avgRisk: Math.round(weightedAvg * 10) / 10
      }
    });
  } catch (error) {
    handleRouteError(error, req, res, "Property Heatmap");
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
    handleRouteError(error, req, res, "Property");
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
    handleRouteError(error, req, res, "Property");
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
    handleRouteError(error, req, res, "Property");
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
    handleRouteError(error, req, res, "Property");
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
    handleRouteError(error, req, res, "Properties");
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
    handleRouteError(error, req, res, "Property");
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
    handleRouteError(error, req, res, "Properties");
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
    handleRouteError(error, req, res, "Properties");
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
    handleRouteError(error, req, res, "Property");
  }
});
