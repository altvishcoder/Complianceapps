import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { storage } from "../../storage";
import { db } from "../../db";
import { bulkSeedJobs } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { VOLUME_CONFIGS, calculateTotals } from "../../demo-data/bulk-seeder";
import { generateBulkDemoData } from "../../demo-data-generator";
import { SUPER_ADMIN_ROLES, getOrgId } from "./utils";

export const adminBulkSeedRouter = Router();

const BULK_SEED_TIERS = {
  small: {
    tier: "small" as const,
    label: "Small (5K)",
    description: "Quick test dataset - 5,000 properties, 50K certs, 500K remedials",
    estimatedMinutes: 15,
    config: { schemeCount: 10, blocksPerScheme: 10, propertiesPerBlock: 50, componentsPerProperty: 3, certificatesPerProperty: 10, remedialsPerCertificate: 10 },
    totals: { schemes: 10, blocks: 100, properties: 5000, spaces: 5000, components: 15000, certificates: 50000, remedials: 500000, contractors: 20, staffMembers: 50, total: 575170 }
  },
  medium: {
    tier: "medium" as const,
    label: "Medium (25K)",
    description: "Standard load test - 25,000 properties, 250K certs, 2.5M remedials",
    estimatedMinutes: 45,
    config: { schemeCount: 50, blocksPerScheme: 10, propertiesPerBlock: 50, componentsPerProperty: 3, certificatesPerProperty: 10, remedialsPerCertificate: 10 },
    totals: { schemes: 50, blocks: 500, properties: 25000, spaces: 25000, components: 75000, certificates: 250000, remedials: 2500000, contractors: 50, staffMembers: 150, total: 2875750 }
  },
  large: {
    tier: "large" as const,
    label: "Large (50K)",
    description: "Enterprise scale test - 50,000 properties, 500K certs, 5M remedials",
    estimatedMinutes: 90,
    config: { schemeCount: 100, blocksPerScheme: 10, propertiesPerBlock: 50, componentsPerProperty: 3, certificatesPerProperty: 10, remedialsPerCertificate: 10 },
    totals: { schemes: 100, blocks: 1000, properties: 50000, spaces: 50000, components: 150000, certificates: 500000, remedials: 5000000, contractors: 80, staffMembers: 300, total: 5751380 }
  }
};

const DEFAULT_ENTITY_PROGRESS = {
  schemes: { done: 0, total: 0 },
  blocks: { done: 0, total: 0 },
  properties: { done: 0, total: 0 },
  spaces: { done: 0, total: 0 },
  components: { done: 0, total: 0 },
  certificates: { done: 0, total: 0 },
  remedials: { done: 0, total: 0 },
  contractors: { done: 0, total: 0 },
  staff: { done: 0, total: 0 },
  riskSnapshots: { done: 0, total: 0 }
};

async function getOrCreateJob(orgId: string) {
  const [existing] = await db.select().from(bulkSeedJobs)
    .where(eq(bulkSeedJobs.organisationId, orgId))
    .orderBy(desc(bulkSeedJobs.createdAt))
    .limit(1);
  
  if (existing) return existing;
  
  const [newJob] = await db.insert(bulkSeedJobs).values({
    organisationId: orgId,
    status: 'idle',
    entityProgress: DEFAULT_ENTITY_PROGRESS,
  }).returning();
  
  return newJob;
}

async function updateJobProgress(orgId: string, updates: Partial<typeof bulkSeedJobs.$inferInsert>) {
  await db.update(bulkSeedJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(bulkSeedJobs.organisationId, orgId));
}

adminBulkSeedRouter.get("/bulk-seed/tiers", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tiers = Object.entries(VOLUME_CONFIGS).map(([key, config]) => ({
      tier: key,
      label: config.label,
      description: config.description,
      estimatedMinutes: config.estimatedMinutes,
      totals: calculateTotals(config),
    }));
    res.json(tiers);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    res.status(500).json({ error: "Failed to fetch volume tiers" });
  }
});

adminBulkSeedRouter.get("/bulk-seed/progress", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const job = await getOrCreateJob(orgId);
    
    res.json({
      status: job.status,
      tier: job.tier,
      currentEntity: job.currentEntity || "",
      currentCount: job.currentCount || 0,
      totalCount: job.totalCount || 0,
      percentage: job.percentage || 0,
      startTime: job.startedAt?.getTime() || null,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
      error: job.error,
      entities: job.entityProgress || DEFAULT_ENTITY_PROGRESS,
    });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

adminBulkSeedRouter.post("/bulk-seed/cancel", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const job = await getOrCreateJob(orgId);
    
    if (job.status === "running") {
      await updateJobProgress(orgId, { status: "cancelled" });
      res.json({ success: true, message: "Bulk seeding cancelled" });
    } else {
      res.json({ success: false, message: "No active bulk seed to cancel" });
    }
  } catch (error) {
    console.error("Error cancelling:", error);
    res.status(500).json({ error: "Failed to cancel" });
  }
});

adminBulkSeedRouter.post("/bulk-seed", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id;
    
    const job = await getOrCreateJob(orgId);
    
    if (job.status === "running") {
      return res.status(409).json({ 
        error: "Bulk seeding already in progress", 
        tier: job.tier 
      });
    }
    
    const { tier = "medium", targetProperties, wipeFirst = true } = req.body || {};
    
    const tierConfig = BULK_SEED_TIERS[tier as keyof typeof BULK_SEED_TIERS] || BULK_SEED_TIERS.medium;
    const target = targetProperties || tierConfig.totals.properties;
    
    console.log(`Starting ${tier} bulk seed for ${target.toLocaleString()} properties...`);
    
    const initialProgress: Record<string, { done: number; total: number }> = {
      schemes: { done: 0, total: tierConfig.totals.schemes },
      blocks: { done: 0, total: tierConfig.totals.blocks },
      properties: { done: 0, total: tierConfig.totals.properties },
      spaces: { done: 0, total: tierConfig.totals.spaces },
      components: { done: 0, total: tierConfig.totals.components },
      certificates: { done: 0, total: tierConfig.totals.certificates },
      remedials: { done: 0, total: tierConfig.totals.remedials },
      contractors: { done: 0, total: tierConfig.totals.contractors },
      staff: { done: 0, total: tierConfig.totals.staffMembers },
      riskSnapshots: { done: 0, total: tierConfig.totals.properties }
    };
    
    await updateJobProgress(orgId, {
      status: "running",
      tier: tier,
      currentEntity: "Initializing",
      currentCount: 0,
      totalCount: tierConfig.totals.total,
      percentage: 0,
      startedAt: new Date(),
      estimatedTimeRemaining: tierConfig.estimatedMinutes * 60,
      error: null,
      entityProgress: initialProgress,
      startedById: userId,
    });
    
    res.json({ 
      success: true, 
      message: `Started ${tierConfig.label} seeding`,
      tier: tier,
      totals: tierConfig.totals
    });
    
    const onProgress = async (entity: string, done: number, total: number) => {
      const [currentJob] = await db.select().from(bulkSeedJobs)
        .where(eq(bulkSeedJobs.organisationId, orgId))
        .limit(1);
      
      if (!currentJob) return;
      
      const entityProgress = (currentJob.entityProgress || {}) as Record<string, { done: number; total: number }>;
      
      if (entityProgress[entity]) {
        entityProgress[entity].done = done;
      }
      
      const propertiesDone = entityProgress.properties?.done || 0;
      const riskSnapshotsDone = entityProgress.riskSnapshots?.done || 0;
      const propertiesWeight = 0.9;
      const riskSnapshotsWeight = 0.1;
      
      const propertiesProgress = tierConfig.totals.properties > 0 
        ? (propertiesDone / tierConfig.totals.properties) * propertiesWeight 
        : 0;
      const riskSnapshotsProgress = tierConfig.totals.properties > 0 
        ? (riskSnapshotsDone / tierConfig.totals.properties) * riskSnapshotsWeight 
        : 0;
      
      const percentage = Math.round((propertiesProgress + riskSnapshotsProgress) * 100);
      
      const elapsedMs = Date.now() - (currentJob.startedAt?.getTime() || Date.now());
      let estimatedTimeRemaining = currentJob.estimatedTimeRemaining;
      if (percentage > 0) {
        const estimatedTotalMs = (elapsedMs / percentage) * 100;
        const remainingMs = estimatedTotalMs - elapsedMs;
        estimatedTimeRemaining = Math.max(0, Math.round(remainingMs / 1000));
      }
      
      await updateJobProgress(orgId, {
        currentEntity: entity,
        currentCount: done,
        percentage,
        estimatedTimeRemaining,
        entityProgress,
      });
    };
    
    let isCancelled = false;
    
    const checkCancelStatus = async () => {
      const [currentJob] = await db.select().from(bulkSeedJobs)
        .where(eq(bulkSeedJobs.organisationId, orgId))
        .limit(1);
      isCancelled = currentJob?.status === "cancelled";
      return isCancelled;
    };
    
    const shouldCancel = () => isCancelled;
    
    (async () => {
      try {
        if (wipeFirst) {
          await updateJobProgress(orgId, { currentEntity: "Wiping existing data" });
          await storage.wipeData(true);
        }
        
        if (await checkCancelStatus()) {
          console.log("Bulk seed cancelled during wipe");
          await updateJobProgress(orgId, { 
            currentEntity: "Cancelled",
            estimatedTimeRemaining: 0
          });
          return;
        }
        
        const cancelCheckInterval = setInterval(async () => {
          await checkCancelStatus();
        }, 5000);
        
        await updateJobProgress(orgId, { currentEntity: "Generating data" });
        const startTime = Date.now();
        const stats = await generateBulkDemoData(orgId, target, onProgress, shouldCancel);
        
        clearInterval(cancelCheckInterval);
        
        if (stats.cancelled || shouldCancel()) {
          console.log("Bulk seed was cancelled");
          const [job] = await db.select().from(bulkSeedJobs)
            .where(eq(bulkSeedJobs.organisationId, orgId))
            .limit(1);
          const entityProgress = (job?.entityProgress || {}) as Record<string, { done: number; total: number }>;
          entityProgress.schemes = { ...entityProgress.schemes, done: stats.schemes };
          entityProgress.blocks = { ...entityProgress.blocks, done: stats.blocks };
          entityProgress.properties = { ...entityProgress.properties, done: stats.properties };
          entityProgress.components = { ...entityProgress.components, done: stats.components };
          entityProgress.certificates = { ...entityProgress.certificates, done: stats.certificates };
          entityProgress.remedials = { ...entityProgress.remedials, done: stats.remedialActions };
          
          await updateJobProgress(orgId, {
            status: "cancelled",
            currentEntity: "Cancelled",
            estimatedTimeRemaining: 0,
            entityProgress,
          });
          return;
        }
        
        const [job] = await db.select().from(bulkSeedJobs)
          .where(eq(bulkSeedJobs.organisationId, orgId))
          .limit(1);
        const entityProgress = (job?.entityProgress || {}) as Record<string, { done: number; total: number }>;
        entityProgress.schemes = { ...entityProgress.schemes, done: stats.schemes };
        entityProgress.blocks = { ...entityProgress.blocks, done: stats.blocks };
        entityProgress.properties = { ...entityProgress.properties, done: stats.properties };
        entityProgress.components = { ...entityProgress.components, done: stats.components };
        entityProgress.certificates = { ...entityProgress.certificates, done: stats.certificates };
        entityProgress.remedials = { ...entityProgress.remedials, done: stats.remedialActions };
        
        await updateJobProgress(orgId, {
          status: "completed",
          currentEntity: "Complete",
          percentage: 100,
          estimatedTimeRemaining: 0,
          completedAt: new Date(),
          entityProgress,
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Bulk seed ${tier} completed in ${duration}s`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await updateJobProgress(orgId, {
          status: "failed",
          error: errorMessage,
        });
        console.error("Bulk seed failed:", error);
      }
    })();
    
  } catch (error: unknown) {
    console.error("Failed to start bulk seed:", error);
    const errorMessage = error instanceof Error ? error.message : undefined;
    res.status(500).json({ 
      error: "Failed to start bulk seed", 
      details: errorMessage 
    });
  }
});
