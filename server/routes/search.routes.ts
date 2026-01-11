import { Router, Request, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { addSSEClient, removeSSEClient } from "../events";

export const searchRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || req.session?.organisationId || ORG_ID;
}

// ===== GLOBAL SEARCH (PostgreSQL Full-Text Search) =====
searchRouter.get("/search", async (req, res) => {
  try {
    const query = (req.query.q as string || "").trim();
    if (!query || query.length < 2) {
      return res.json({ properties: [], certificates: [], actions: [] });
    }
    
    const searchTerms = query.split(/\s+/).filter(t => t.length > 0).map(t => `${t}:*`).join(' & ');
    
    const propertiesResult = await db.execute(sql`
      SELECT id, uprn, address_line1, city, postcode, compliance_status
      FROM properties
      WHERE 
        to_tsvector('english', COALESCE(address_line1, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(postcode, '') || ' ' || COALESCE(uprn, '')) 
        @@ to_tsquery('english', ${searchTerms})
      ORDER BY ts_rank(
        to_tsvector('english', COALESCE(address_line1, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(postcode, '') || ' ' || COALESCE(uprn, '')),
        to_tsquery('english', ${searchTerms})
      ) DESC
      LIMIT 10
    `);
    
    const certificatesResult = await db.execute(sql`
      SELECT c.id, c.certificate_type, c.status, c.file_name, p.address_line1
      FROM certificates c
      LEFT JOIN properties p ON c.property_id = p.id
      WHERE 
        to_tsvector('english', COALESCE(c.certificate_type::text, '') || ' ' || COALESCE(c.file_name, '') || ' ' || COALESCE(c.certificate_number, '')) 
        @@ to_tsquery('english', ${searchTerms})
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    const actionsResult = await db.execute(sql`
      SELECT a.id, a.description, a.severity, a.status, p.address_line1
      FROM remedial_actions a
      LEFT JOIN properties p ON a.property_id = p.id
      WHERE 
        to_tsvector('english', COALESCE(a.description, '') || ' ' || COALESCE(a.category, '') || ' ' || COALESCE(a.code, '')) 
        @@ to_tsquery('english', ${searchTerms})
      ORDER BY a.created_at DESC
      LIMIT 10
    `);
    
    res.json({
      properties: propertiesResult.rows || [],
      certificates: certificatesResult.rows || [],
      actions: actionsResult.rows || []
    });
  } catch (error) {
    console.error("Search error:", error);
    try {
      const query = `%${(req.query.q as string || "").trim()}%`;
      const propertiesResult = await db.execute(sql`
        SELECT id, uprn, address_line1, city, postcode, compliance_status
        FROM properties
        WHERE address_line1 ILIKE ${query} OR postcode ILIKE ${query} OR uprn ILIKE ${query}
        LIMIT 10
      `);
      res.json({
        properties: propertiesResult.rows || [],
        certificates: [],
        actions: []
      });
    } catch (fallbackError) {
      res.status(500).json({ error: "Search failed" });
    }
  }
});

// ===== SSE EVENTS FOR REAL-TIME UPDATES =====
searchRouter.get("/events", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const clientId = Date.now().toString();
  addSSEClient(clientId, res);
  
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
  
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
    removeSSEClient(clientId);
  });
});

// ===== ASSET HEALTH SUMMARY (Optimized aggregation) =====
searchRouter.get("/asset-health/summary", async (req: Request, res: Response) => {
  try {
    const organisationId = (req as AuthenticatedRequest).session?.organisationId || ORG_ID;
    const nowStr = new Date().toISOString().split('T')[0];
    const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await db.execute(sql`
      WITH property_compliance AS (
        SELECT 
          p.id as property_id,
          p.address_line1,
          p.block_id,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED' 
             AND (c.expiry_date IS NULL OR c.expiry_date > ${nowStr})), 0
          ) as compliant_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date <= ${nowStr}), 0
          ) as expired_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date > ${nowStr} 
             AND c.expiry_date <= ${thirtyDaysStr}), 0
          ) as expiring_certs
        FROM properties p
        INNER JOIN blocks b ON p.block_id = b.id
        INNER JOIN schemes s ON b.scheme_id = s.id
        WHERE s.organisation_id = ${organisationId}
      ),
      block_stats AS (
        SELECT 
          b.id as block_id,
          b.name as block_name,
          b.scheme_id,
          COUNT(DISTINCT pc.property_id) as total_properties,
          COUNT(DISTINCT CASE WHEN pc.expired_certs = 0 AND pc.compliant_certs > 0 THEN pc.property_id END) as compliant_properties,
          COUNT(DISTINCT CASE WHEN pc.expiring_certs > 0 AND pc.expired_certs = 0 THEN pc.property_id END) as at_risk_properties,
          COUNT(DISTINCT CASE WHEN pc.expired_certs > 0 THEN pc.property_id END) as expired_properties
        FROM blocks b
        LEFT JOIN property_compliance pc ON pc.block_id = b.id
        GROUP BY b.id, b.name, b.scheme_id
      ),
      scheme_stats AS (
        SELECT 
          s.id as scheme_id,
          s.name as scheme_name,
          COALESCE(SUM(bs.total_properties), 0)::int as total_properties,
          COALESCE(SUM(bs.compliant_properties), 0)::int as compliant_properties,
          COALESCE(SUM(bs.at_risk_properties), 0)::int as at_risk_properties,
          COALESCE(SUM(bs.expired_properties), 0)::int as expired_properties,
          COUNT(DISTINCT bs.block_id)::int as blocks_count
        FROM schemes s
        LEFT JOIN block_stats bs ON bs.scheme_id = s.id
        WHERE s.organisation_id = ${organisationId}
        GROUP BY s.id, s.name
      )
      SELECT 
        scheme_id,
        scheme_name,
        total_properties,
        compliant_properties,
        at_risk_properties,
        expired_properties,
        blocks_count,
        CASE 
          WHEN total_properties = 0 THEN 100
          ELSE ROUND((compliant_properties::decimal / NULLIF(total_properties, 0)) * 100, 1)
        END as compliance_rate
      FROM scheme_stats
      ORDER BY scheme_name
    `);

    interface SchemeRow {
      scheme_id: string;
      scheme_name: string;
      total_properties: string | number;
      compliant_properties: string | number;
      at_risk_properties: string | number;
      expired_properties: string | number;
      blocks_count: string | number;
      compliance_rate: string | number;
    }
    const schemes = (result.rows as SchemeRow[]).map((row) => ({
      id: row.scheme_id,
      name: row.scheme_name,
      totalProperties: parseInt(String(row.total_properties)) || 0,
      compliantProperties: parseInt(String(row.compliant_properties)) || 0,
      atRiskProperties: parseInt(String(row.at_risk_properties)) || 0,
      expiredProperties: parseInt(String(row.expired_properties)) || 0,
      blocksCount: parseInt(String(row.blocks_count)) || 0,
      complianceRate: parseFloat(String(row.compliance_rate)) || 100,
    }));

    const totals = schemes.reduce((acc, s) => ({
      totalProperties: acc.totalProperties + s.totalProperties,
      compliantProperties: acc.compliantProperties + s.compliantProperties,
      atRiskProperties: acc.atRiskProperties + s.atRiskProperties,
      expiredProperties: acc.expiredProperties + s.expiredProperties,
    }), { totalProperties: 0, compliantProperties: 0, atRiskProperties: 0, expiredProperties: 0 });

    res.json({
      schemes,
      totals: {
        ...totals,
        complianceRate: totals.totalProperties > 0 
          ? Math.round((totals.compliantProperties / totals.totalProperties) * 1000) / 10 
          : 100
      }
    });
  } catch (error) {
    console.error("Error fetching asset health summary:", error);
    res.status(500).json({ error: "Failed to fetch asset health summary" });
  }
});

// ===== ASSET HEALTH - BLOCKS BY SCHEME =====
searchRouter.get("/asset-health/schemes/:schemeId/blocks", async (req: Request, res: Response) => {
  try {
    const { schemeId } = req.params;
    const organisationId = (req as AuthenticatedRequest).session?.organisationId || ORG_ID;
    const nowStr = new Date().toISOString().split('T')[0];
    const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await db.execute(sql`
      WITH property_compliance AS (
        SELECT 
          p.id as property_id,
          p.block_id,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED' 
             AND (c.expiry_date IS NULL OR c.expiry_date > ${nowStr})), 0
          ) as compliant_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date <= ${nowStr}), 0
          ) as expired_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date > ${nowStr} 
             AND c.expiry_date <= ${thirtyDaysStr}), 0
          ) as expiring_certs
        FROM properties p
        INNER JOIN blocks b ON p.block_id = b.id
        INNER JOIN schemes s ON b.scheme_id = s.id
        WHERE b.scheme_id = ${schemeId}
        AND s.organisation_id = ${organisationId}
      )
      SELECT 
        b.id as block_id,
        b.name as block_name,
        COUNT(DISTINCT pc.property_id)::int as total_properties,
        COUNT(DISTINCT CASE WHEN pc.expired_certs = 0 AND pc.compliant_certs > 0 THEN pc.property_id END)::int as compliant_properties,
        COUNT(DISTINCT CASE WHEN pc.expiring_certs > 0 AND pc.expired_certs = 0 THEN pc.property_id END)::int as at_risk_properties,
        COUNT(DISTINCT CASE WHEN pc.expired_certs > 0 THEN pc.property_id END)::int as expired_properties,
        CASE 
          WHEN COUNT(DISTINCT pc.property_id) = 0 THEN 100
          ELSE ROUND((COUNT(DISTINCT CASE WHEN pc.expired_certs = 0 AND pc.compliant_certs > 0 THEN pc.property_id END)::decimal / 
                      NULLIF(COUNT(DISTINCT pc.property_id), 0)) * 100, 1)
        END as compliance_rate
      FROM blocks b
      LEFT JOIN property_compliance pc ON pc.block_id = b.id
      WHERE b.scheme_id = ${schemeId}
      GROUP BY b.id, b.name
      ORDER BY b.name
    `);

    interface BlockRow {
      block_id: string;
      block_name: string;
      total_properties: string | number;
      compliant_properties: string | number;
      at_risk_properties: string | number;
      expired_properties: string | number;
      compliance_rate: string | number;
    }
    const blocks = (result.rows as BlockRow[]).map((row) => ({
      id: row.block_id,
      name: row.block_name,
      totalProperties: parseInt(String(row.total_properties)) || 0,
      compliantProperties: parseInt(String(row.compliant_properties)) || 0,
      atRiskProperties: parseInt(String(row.at_risk_properties)) || 0,
      expiredProperties: parseInt(String(row.expired_properties)) || 0,
      complianceRate: parseFloat(String(row.compliance_rate)) || 100,
    }));

    const totals = blocks.reduce((acc, b) => ({
      totalProperties: acc.totalProperties + b.totalProperties,
      compliantProperties: acc.compliantProperties + b.compliantProperties,
      atRiskProperties: acc.atRiskProperties + b.atRiskProperties,
      expiredProperties: acc.expiredProperties + b.expiredProperties,
    }), { totalProperties: 0, compliantProperties: 0, atRiskProperties: 0, expiredProperties: 0 });

    res.json({
      blocks,
      totals: {
        ...totals,
        complianceRate: totals.totalProperties > 0 
          ? Math.round((totals.compliantProperties / totals.totalProperties) * 1000) / 10 
          : 100
      }
    });
  } catch (error) {
    console.error("Error fetching blocks for scheme:", error);
    res.status(500).json({ error: "Failed to fetch blocks for scheme" });
  }
});

// ===== ASSET HEALTH - PROPERTIES BY BLOCK =====
searchRouter.get("/asset-health/blocks/:blockId/properties", async (req: Request, res: Response) => {
  try {
    const { blockId } = req.params;
    const organisationId = (req as AuthenticatedRequest).session?.organisationId || ORG_ID;
    const nowStr = new Date().toISOString().split('T')[0];
    const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await db.execute(sql`
      SELECT 
        p.id as property_id,
        p.address_line1 as property_name,
        p.uprn,
        COALESCE(
          (SELECT COUNT(*) FROM certificates c 
           WHERE c.property_id = p.id 
           AND c.status = 'APPROVED' 
           AND (c.expiry_date IS NULL OR c.expiry_date > ${nowStr})), 0
        )::int as compliant_certs,
        COALESCE(
          (SELECT COUNT(*) FROM certificates c 
           WHERE c.property_id = p.id 
           AND c.status = 'APPROVED'
           AND c.expiry_date IS NOT NULL 
           AND c.expiry_date <= ${nowStr}), 0
        )::int as expired_certs,
        COALESCE(
          (SELECT COUNT(*) FROM certificates c 
           WHERE c.property_id = p.id 
           AND c.status = 'APPROVED'
           AND c.expiry_date IS NOT NULL 
           AND c.expiry_date > ${nowStr} 
           AND c.expiry_date <= ${thirtyDaysStr}), 0
        )::int as expiring_certs,
        CASE 
          WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND c.expiry_date IS NOT NULL AND c.expiry_date <= ${nowStr}) > 0 THEN 'expired'
          WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND c.expiry_date IS NOT NULL AND c.expiry_date > ${nowStr} AND c.expiry_date <= ${thirtyDaysStr}) > 0 THEN 'at_risk'
          WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND (c.expiry_date IS NULL OR c.expiry_date > ${nowStr})) > 0 THEN 'compliant'
          ELSE 'no_data'
        END as compliance_status
      FROM properties p
      INNER JOIN blocks b ON p.block_id = b.id
      INNER JOIN schemes s ON b.scheme_id = s.id
      WHERE p.block_id = ${blockId}
      AND s.organisation_id = ${organisationId}
      ORDER BY p.address_line1
      LIMIT 200
    `);

    interface PropertyRow {
      property_id: string;
      property_name: string;
      uprn: string;
      compliant_certs: string | number;
      expired_certs: string | number;
      expiring_certs: string | number;
      compliance_status: string;
    }
    const properties = (result.rows as PropertyRow[]).map((row) => ({
      id: row.property_id,
      name: row.property_name,
      uprn: row.uprn,
      compliantCerts: parseInt(String(row.compliant_certs)) || 0,
      expiredCerts: parseInt(String(row.expired_certs)) || 0,
      expiringCerts: parseInt(String(row.expiring_certs)) || 0,
      complianceStatus: row.compliance_status,
    }));

    const totals = {
      total: properties.length,
      compliant: properties.filter(p => p.complianceStatus === 'compliant').length,
      atRisk: properties.filter(p => p.complianceStatus === 'at_risk').length,
      expired: properties.filter(p => p.complianceStatus === 'expired').length,
      noData: properties.filter(p => p.complianceStatus === 'no_data').length,
    };

    res.json({ properties, totals });
  } catch (error) {
    console.error("Error fetching properties for block:", error);
    res.status(500).json({ error: "Failed to fetch properties for block" });
  }
});
