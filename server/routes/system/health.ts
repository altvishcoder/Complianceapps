import { Router, Request, Response } from "express";
import { db, isDatabaseAvailable } from "../../db";
import { sql } from "drizzle-orm";
import { APP_VERSION, APP_NAME, RELEASE_NOTES } from "@shared/version";
import { getQueueStats, getJobQueue } from "../../job-queue";
import { requireAdminRole } from "./utils";
import { withTimeout, TimeoutError } from "../../utils/resilience";

const CHECK_TIMEOUT_MS = 5000;

export const systemHealthRouter = Router();

systemHealthRouter.get("/health", async (req: Request, res: Response) => {
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

interface ReadinessCheck {
  status: "ok" | "error" | "skipped";
  latencyMs?: number;
  error?: string;
}

interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  version: string;
  checks: {
    database: ReadinessCheck;
    jobQueue: ReadinessCheck;
    storage: ReadinessCheck;
    ai?: ReadinessCheck;
  };
  failed?: string[];
}

async function checkDatabase(): Promise<ReadinessCheck> {
  const start = Date.now();
  try {
    if (!isDatabaseAvailable()) {
      return { status: "error", error: "Database not configured" };
    }
    await withTimeout(
      () => db.execute(sql`SELECT 1`),
      { timeoutMs: CHECK_TIMEOUT_MS, timeoutMessage: "Database check timed out" }
    );
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof TimeoutError 
      ? "Database check timed out" 
      : (error instanceof Error ? error.message : "Unknown error");
    return { status: "error", latencyMs: Date.now() - start, error: message };
  }
}

async function checkJobQueue(): Promise<ReadinessCheck> {
  const start = Date.now();
  try {
    const boss = getJobQueue();
    if (!boss) {
      return { status: "skipped", error: "Job queue not initialized" };
    }
    await withTimeout(
      async () => {
        const stats = await getQueueStats();
        return stats;
      },
      { timeoutMs: CHECK_TIMEOUT_MS, timeoutMessage: "Job queue check timed out" }
    );
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof TimeoutError 
      ? "Job queue check timed out" 
      : (error instanceof Error ? error.message : "Unknown error");
    return { status: "error", latencyMs: Date.now() - start, error: message };
  }
}

async function checkStorage(): Promise<ReadinessCheck> {
  const start = Date.now();
  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    
    if (!privateDir && !publicPaths) {
      return { status: "skipped", error: "Object storage not configured" };
    }
    
    const { ObjectStorageService } = await import("../../replit_integrations/object_storage");
    const storageService = new ObjectStorageService();
    
    await withTimeout(
      async () => {
        storageService.getPrivateObjectDir();
        return true;
      },
      { timeoutMs: CHECK_TIMEOUT_MS, timeoutMessage: "Storage check timed out" }
    );
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof TimeoutError 
      ? "Storage check timed out" 
      : (error instanceof Error ? error.message : "Unknown error");
    return { status: "error", latencyMs: Date.now() - start, error: message };
  }
}

async function checkAIProviders(): Promise<ReadinessCheck> {
  const start = Date.now();
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const azureKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    if (!anthropicKey && !openaiKey && !azureKey) {
      return { status: "skipped", error: "No AI providers configured" };
    }
    
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof TimeoutError 
      ? "AI provider check timed out" 
      : (error instanceof Error ? error.message : "Unknown error");
    return { status: "error", latencyMs: Date.now() - start, error: message };
  }
}

systemHealthRouter.get("/ready", async (req: Request, res: Response) => {
  try {
    const [database, jobQueue, storage, ai] = await Promise.all([
      checkDatabase(),
      checkJobQueue(),
      checkStorage(),
      checkAIProviders(),
    ]);
    
    const checks = { database, jobQueue, storage, ai };
    const failed: string[] = [];
    
    if (database.status === "error") failed.push("database");
    if (jobQueue.status === "error") failed.push("jobQueue");
    if (storage.status === "error") failed.push("storage");
    
    const ready = failed.length === 0;
    
    const response: ReadinessResponse = {
      ready,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      checks,
    };
    
    if (!ready) {
      response.failed = failed;
    }
    
    res.status(ready ? 200 : 503).json(response);
  } catch (error) {
    console.error("Readiness check failed:", error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      checks: {
        database: { status: "error", error: "Check failed" },
        jobQueue: { status: "error", error: "Check failed" },
        storage: { status: "error", error: "Check failed" },
      },
      failed: ["database", "jobQueue", "storage"],
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

systemHealthRouter.get("/version", async (req: Request, res: Response) => {
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

systemHealthRouter.get("/version/releases", async (req: Request, res: Response) => {
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

systemHealthRouter.get("/version/api-info", (req: Request, res: Response) => {
  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    apiVersion: "v1",
    documentation: "/api/docs",
    openapi: "/api/openapi.json",
  });
});

systemHealthRouter.get("/stats", async (req: Request, res: Response) => {
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

systemHealthRouter.get("/memory", (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
    unit: 'MB',
  });
});

systemHealthRouter.get("/admin/queue-stats", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting queue stats:", error);
    res.status(500).json({ error: "Failed to get queue stats" });
  }
});
