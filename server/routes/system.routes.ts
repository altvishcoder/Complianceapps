import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { APP_VERSION, APP_NAME, RELEASE_NOTES } from "@shared/version";

export const systemRouter = Router();

// ===== HEALTH CHECK =====
systemRouter.get("/health", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ===== VERSION INFO =====
systemRouter.get("/version", async (req: Request, res: Response) => {
  const startTime = process.hrtime();
  
  try {
    res.json({
      version: APP_VERSION,
      name: APP_NAME,
      environment: process.env.NODE_ENV || 'development',
      buildTime: new Date().toISOString(),
      uptime: process.uptime(),
      releaseHighlights: RELEASE_NOTES[APP_VERSION]?.highlights || [],
    });
  } catch (error) {
    console.error("Error fetching version:", error);
    res.status(500).json({ error: "Failed to fetch version information" });
  }
});

systemRouter.get("/version/releases", async (req: Request, res: Response) => {
  try {
    res.json({
      current: APP_VERSION,
      releases: RELEASE_NOTES,
    });
  } catch (error) {
    console.error("Error fetching releases:", error);
    res.status(500).json({ error: "Failed to fetch release information" });
  }
});

systemRouter.get("/version/api-info", (req: Request, res: Response) => {
  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    apiVersion: "v1",
    documentation: "/api/docs",
    openapi: "/api/openapi.json",
  });
});

// ===== SYSTEM STATS =====
systemRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM schemes) as scheme_count,
        (SELECT COUNT(*) FROM blocks) as block_count,
        (SELECT COUNT(*) FROM properties) as property_count,
        (SELECT COUNT(*) FROM certificates) as certificate_count,
        (SELECT COUNT(*) FROM remedial_actions) as action_count,
        (SELECT COUNT(*) FROM users) as user_count
    `);
    
    const row = result.rows[0] as any;
    
    res.json({
      schemes: parseInt(row?.scheme_count || '0'),
      blocks: parseInt(row?.block_count || '0'),
      properties: parseInt(row?.property_count || '0'),
      certificates: parseInt(row?.certificate_count || '0'),
      actions: parseInt(row?.action_count || '0'),
      users: parseInt(row?.user_count || '0'),
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    res.status(500).json({ error: "Failed to fetch system stats" });
  }
});

// ===== MEMORY USAGE =====
systemRouter.get("/memory", (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
    unit: 'MB',
  });
});
