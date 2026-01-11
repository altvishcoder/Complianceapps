import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { users, factorySettings, factorySettingsAudit, userFavorites } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";
import { validatePassword } from "../services/password-policy";
import { clearApiLimitsCache } from "../services/api-limits";
import { clearTierThresholdsCache } from "../services/risk-scoring";
import { 
  runBulkSeed, getProgress, cancelBulkSeed, 
  VOLUME_CONFIGS, calculateTotals, refreshMaterializedViewsAfterSeed,
  type VolumeTier 
} from "../demo-data/bulk-seeder";
import { getAIRegistry } from "../services/ai/providers";
import { getConfiguredProviders, auth } from "../auth";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { generateFullDemoData, generateBulkDemoData } from "../demo-data-generator";
import { fromNodeHeaders } from "better-auth/node";

export const adminRouter = Router();

const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
const ADMIN_ROLES = [...SUPER_ADMIN_ROLES, 'COMPLIANCE_MANAGER', 'ADMIN'];
const ADMIN_AND_ABOVE_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER'];

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || "org-001";
}

// ===== ADMIN / DEMO DATA MANAGEMENT =====

adminRouter.post("/wipe-data", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeProperties } = req.body || {};
    await storage.wipeData(includeProperties === true);
    res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
  } catch (error: any) {
    console.error("Failed to wipe data:", error);
    res.status(500).json({ error: "Failed to wipe data", details: error?.message });
  }
});

adminRouter.post("/seed-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    await storage.seedDemoData(orgId);
    res.json({ success: true, message: "Demo data seeded successfully" });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

adminRouter.post("/reset-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    console.log("Wiping existing data and regenerating full demo dataset...");
    await storage.wipeData(true);
    const stats = await generateFullDemoData(orgId);
    res.json({ 
      success: true, 
      message: "Demo data regenerated successfully",
      stats
    });
  } catch (error: any) {
    console.error("Failed to regenerate demo data:", error);
    const errorMessage = error?.message || "Unknown error";
    const errorDetail = error?.detail || error?.code || "";
    res.status(500).json({ 
      error: "Failed to regenerate demo data", 
      details: `${errorMessage}${errorDetail ? ` (${errorDetail})` : ""}` 
    });
  }
});

// ===== BULK SEEDING (High Volume) =====

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

let bulkSeedProgress: {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  tier: "small" | "medium" | "large" | null;
  currentEntity: string;
  currentCount: number;
  totalCount: number;
  percentage: number;
  startTime: number | null;
  estimatedTimeRemaining: number | null;
  error: string | null;
  entities: Record<string, { done: number; total: number }>;
} = {
  status: "idle",
  tier: null,
  currentEntity: "",
  currentCount: 0,
  totalCount: 0,
  percentage: 0,
  startTime: null,
  estimatedTimeRemaining: null,
  error: null,
  entities: {
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
  }
};

adminRouter.get("/bulk-seed/tiers", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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

adminRouter.get("/bulk-seed/progress", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  res.json(bulkSeedProgress);
});

adminRouter.post("/bulk-seed/cancel", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  if (bulkSeedProgress.status === "running") {
    bulkSeedProgress.status = "cancelled";
    res.json({ success: true, message: "Bulk seeding cancelled" });
  } else {
    res.json({ success: false, message: "No active bulk seed to cancel" });
  }
});

adminRouter.post("/bulk-seed", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    if (bulkSeedProgress.status === "running") {
      return res.status(409).json({ 
        error: "Bulk seeding already in progress", 
        tier: bulkSeedProgress.tier 
      });
    }
    
    const { tier = "medium", targetProperties, wipeFirst = true } = req.body || {};
    
    const tierConfig = BULK_SEED_TIERS[tier as keyof typeof BULK_SEED_TIERS] || BULK_SEED_TIERS.medium;
    const target = targetProperties || tierConfig.totals.properties;
    
    console.log(`Starting ${tier} bulk seed for ${target.toLocaleString()} properties...`);
    
    bulkSeedProgress = {
      status: "running",
      tier: tier as "small" | "medium" | "large",
      currentEntity: "Initializing",
      currentCount: 0,
      totalCount: tierConfig.totals.total,
      percentage: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: tierConfig.estimatedMinutes * 60,
      error: null,
      entities: {
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
      }
    };
    
    res.json({ 
      success: true, 
      message: `Started ${tierConfig.label} seeding`,
      tier: tier,
      totals: tierConfig.totals
    });
    
    const onProgress = (entity: string, done: number, total: number) => {
      bulkSeedProgress.currentEntity = entity;
      bulkSeedProgress.currentCount = done;
      
      if (entity === "schemes") bulkSeedProgress.entities.schemes.done = done;
      else if (entity === "blocks") bulkSeedProgress.entities.blocks.done = done;
      else if (entity === "properties") bulkSeedProgress.entities.properties.done = done;
      else if (entity === "components") bulkSeedProgress.entities.components.done = done;
      else if (entity === "certificates") bulkSeedProgress.entities.certificates.done = done;
      else if (entity === "remedials") bulkSeedProgress.entities.remedials.done = done;
      else if (entity === "riskSnapshots") bulkSeedProgress.entities.riskSnapshots.done = done;
      
      const propertiesDone = bulkSeedProgress.entities.properties.done;
      const riskSnapshotsDone = bulkSeedProgress.entities.riskSnapshots.done;
      const propertiesWeight = 0.9;
      const riskSnapshotsWeight = 0.1;
      
      const propertiesProgress = tierConfig.totals.properties > 0 
        ? (propertiesDone / tierConfig.totals.properties) * propertiesWeight 
        : 0;
      const riskSnapshotsProgress = tierConfig.totals.properties > 0 
        ? (riskSnapshotsDone / tierConfig.totals.properties) * riskSnapshotsWeight 
        : 0;
      
      bulkSeedProgress.percentage = Math.round((propertiesProgress + riskSnapshotsProgress) * 100);
      
      const elapsedMs = Date.now() - (bulkSeedProgress.startTime || Date.now());
      if (bulkSeedProgress.percentage > 0) {
        const estimatedTotalMs = (elapsedMs / bulkSeedProgress.percentage) * 100;
        const remainingMs = estimatedTotalMs - elapsedMs;
        bulkSeedProgress.estimatedTimeRemaining = Math.max(0, Math.round(remainingMs / 1000));
      }
    };
    
    const shouldCancel = () => bulkSeedProgress.status === "cancelled";
    
    (async () => {
      try {
        if (wipeFirst) {
          bulkSeedProgress.currentEntity = "Wiping existing data";
          await storage.wipeData(true);
        }
        
        if (shouldCancel()) {
          console.log("Bulk seed cancelled during wipe");
          bulkSeedProgress.currentEntity = "Cancelled";
          bulkSeedProgress.estimatedTimeRemaining = 0;
          return;
        }
        
        bulkSeedProgress.currentEntity = "Generating data";
        const startTime = Date.now();
        const stats = await generateBulkDemoData(orgId, target, onProgress, shouldCancel);
        
        if (stats.cancelled || shouldCancel()) {
          console.log("Bulk seed was cancelled");
          bulkSeedProgress.status = "cancelled";
          bulkSeedProgress.currentEntity = "Cancelled";
          bulkSeedProgress.estimatedTimeRemaining = 0;
          bulkSeedProgress.entities.schemes.done = stats.schemes;
          bulkSeedProgress.entities.blocks.done = stats.blocks;
          bulkSeedProgress.entities.properties.done = stats.properties;
          bulkSeedProgress.entities.components.done = stats.components;
          bulkSeedProgress.entities.certificates.done = stats.certificates;
          bulkSeedProgress.entities.remedials.done = stats.remedialActions;
          return;
        }
        
        bulkSeedProgress.status = "completed";
        bulkSeedProgress.currentEntity = "Complete";
        bulkSeedProgress.percentage = 100;
        bulkSeedProgress.entities.schemes.done = stats.schemes;
        bulkSeedProgress.entities.blocks.done = stats.blocks;
        bulkSeedProgress.entities.properties.done = stats.properties;
        bulkSeedProgress.entities.components.done = stats.components;
        bulkSeedProgress.entities.certificates.done = stats.certificates;
        bulkSeedProgress.entities.remedials.done = stats.remedialActions;
        bulkSeedProgress.estimatedTimeRemaining = 0;
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Bulk seed ${tier} completed in ${duration}s`);
      } catch (error: any) {
        bulkSeedProgress.status = "failed";
        bulkSeedProgress.error = error?.message || "Unknown error";
        console.error("Bulk seed failed:", error);
      }
    })();
    
  } catch (error: any) {
    console.error("Failed to start bulk seed:", error);
    bulkSeedProgress.status = "failed";
    bulkSeedProgress.error = error?.message || "Unknown error";
    res.status(500).json({ 
      error: "Failed to start bulk seed", 
      details: error?.message 
    });
  }
});

adminRouter.post("/seed-spaces", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const BLOCK_COMMUNAL_SPACES = [
      { name: "Main Stairwell", type: "CIRCULATION" as const },
      { name: "Plant Room", type: "UTILITY" as const },
      { name: "Bin Store", type: "STORAGE" as const },
    ];
    const SCHEME_COMMUNAL_SPACES = [
      { name: "Community Hall", type: "COMMUNAL_AREA" as const },
      { name: "Estate Grounds", type: "EXTERNAL" as const },
    ];
    const PROPERTY_ROOMS = ["Living Room", "Kitchen", "Bathroom", "Bedroom"];
    const ROOM_TYPES = ["ROOM", "ROOM", "UTILITY", "ROOM"] as const;
    
    const existingSpaces = await storage.listSpaces({});
    const schemeSpaceSchemeIds = new Set(existingSpaces.filter(s => s.schemeId && !s.blockId && !s.propertyId).map(s => s.schemeId!));
    const blockSpaceBlockIds = new Set(existingSpaces.filter(s => s.blockId && !s.propertyId).map(s => s.blockId!));
    const propertySpacePropertyIds = new Set(existingSpaces.filter(s => s.propertyId).map(s => s.propertyId!));
    
    const allSchemes = await storage.listSchemes(orgId);
    const allBlocks = await storage.listBlocks(orgId);
    const allProperties = await storage.listProperties(orgId);
    
    let created = { scheme: 0, block: 0, property: 0 };
    
    for (const scheme of allSchemes) {
      if (!schemeSpaceSchemeIds.has(scheme.id)) {
        for (const spaceTemplate of SCHEME_COMMUNAL_SPACES) {
          await storage.createSpace({
            schemeId: scheme.id,
            name: spaceTemplate.name,
            spaceType: spaceTemplate.type,
            description: `Estate-wide ${spaceTemplate.name.toLowerCase()}`,
            areaSqMeters: Math.floor(Math.random() * 200) + 50,
          });
          created.scheme++;
        }
      }
    }
    
    for (const block of allBlocks) {
      if (!blockSpaceBlockIds.has(block.id)) {
        for (let i = 0; i < BLOCK_COMMUNAL_SPACES.length; i++) {
          const spaceTemplate = BLOCK_COMMUNAL_SPACES[i];
          await storage.createSpace({
            blockId: block.id,
            name: spaceTemplate.name,
            spaceType: spaceTemplate.type,
            floor: i === 0 ? "All Floors" : "Ground",
            description: `Building communal ${spaceTemplate.name.toLowerCase()}`,
            areaSqMeters: Math.floor(Math.random() * 30) + 10,
          });
          created.block++;
        }
      }
    }
    
    for (const property of allProperties) {
      if (!propertySpacePropertyIds.has(property.id)) {
        for (let i = 0; i < PROPERTY_ROOMS.length; i++) {
          await storage.createSpace({
            propertyId: property.id,
            name: PROPERTY_ROOMS[i],
            spaceType: ROOM_TYPES[i],
            floor: String(Math.floor(i / 3)),
            areaSqMeters: Math.floor(Math.random() * 20) + 8,
          });
          created.property++;
        }
      }
    }
    
    res.json({
      success: true,
      created,
      total: created.scheme + created.block + created.property,
      existing: {
        schemes: schemeSpaceSchemeIds.size,
        blocks: blockSpaceBlockIds.size,
        properties: propertySpacePropertyIds.size,
      }
    });
  } catch (error: any) {
    console.error("Failed to seed spaces:", error);
    res.status(500).json({ error: "Failed to seed spaces", details: error?.message });
  }
});

adminRouter.post("/reclassify-certificates", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const allCertificates = await storage.listCertificates(orgId);
    let updated = 0;
    let skipped = 0;
    
    for (const cert of allCertificates) {
      if (cert.certificateType !== 'OTHER') {
        skipped++;
        continue;
      }
      
      const property = await storage.getProperty(cert.propertyId);
      const docType = (property?.extractedMetadata as any)?.documentType || 
                      (cert as any).extractedData?.documentType;
      
      if (!docType) {
        skipped++;
        continue;
      }
      
      const docTypeLower = docType.toLowerCase();
      let newType: 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER' | undefined;
      
      if (docTypeLower.includes('gas safety') || docTypeLower.includes('lgsr') || docTypeLower.includes('cp12') || docTypeLower.includes('landlord gas')) {
        newType = 'GAS_SAFETY';
      } else if (docTypeLower.includes('eicr') || docTypeLower.includes('electrical installation') || docTypeLower.includes('electrical condition')) {
        newType = 'EICR';
      } else if (docTypeLower.includes('fire risk') || docTypeLower.includes('fra') || docTypeLower.includes('fire safety')) {
        newType = 'FIRE_RISK_ASSESSMENT';
      } else if (docTypeLower.includes('asbestos')) {
        newType = 'ASBESTOS_SURVEY';
      } else if (docTypeLower.includes('legionella') || docTypeLower.includes('water hygiene') || docTypeLower.includes('water risk')) {
        newType = 'LEGIONELLA_ASSESSMENT';
      } else if (docTypeLower.includes('lift') || docTypeLower.includes('loler') || docTypeLower.includes('elevator')) {
        newType = 'LIFT_LOLER';
      } else if (docTypeLower.includes('energy performance') || docTypeLower.includes('epc')) {
        newType = 'EPC';
      }
      
      if (newType) {
        await storage.updateCertificate(cert.id, { certificateType: newType });
        updated++;
        console.log(`Reclassified certificate ${cert.id}: ${docType} -> ${newType}`);
      } else {
        skipped++;
      }
    }
    
    res.json({ success: true, updated, skipped, total: allCertificates.length });
  } catch (error) {
    console.error("Error reclassifying certificates:", error);
    res.status(500).json({ error: "Failed to reclassify certificates" });
  }
});

// ===== DATABASE OPTIMIZATION MANAGEMENT =====

adminRouter.get("/db-optimization/status", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getOptimizationStatus } = await import("../db-optimization");
    const status = await getOptimizationStatus();
    res.json(status);
  } catch (error) {
    console.error("Error getting optimization status:", error);
    res.status(500).json({ error: "Failed to get optimization status" });
  }
});

adminRouter.get("/db-optimization/categories", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getViewCategories } = await import("../db-optimization");
    const categories = getViewCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error getting view categories:", error);
    res.status(500).json({ error: "Failed to get view categories" });
  }
});

adminRouter.post("/db-optimization/refresh-view", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { viewName } = req.body;
    if (!viewName) {
      return res.status(400).json({ error: "View name is required" });
    }
    
    const { refreshMaterializedView, getAllViewNames } = await import("../db-optimization");
    const validViews = getAllViewNames();
    if (!validViews.includes(viewName)) {
      return res.status(400).json({ error: "Invalid view name" });
    }
    
    const result = await refreshMaterializedView(viewName);
    res.json(result);
  } catch (error) {
    console.error("Error refreshing view:", error);
    res.status(500).json({ error: "Failed to refresh view" });
  }
});

adminRouter.post("/db-optimization/refresh-all", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshAllMaterializedViews } = await import("../db-optimization");
    const result = await refreshAllMaterializedViews();
    res.json(result);
  } catch (error) {
    console.error("Error refreshing all views:", error);
    res.status(500).json({ error: "Failed to refresh all views" });
  }
});

adminRouter.post("/db-optimization/refresh-category", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }
    
    const { refreshViewsByCategory, getViewCategories } = await import("../db-optimization");
    const validCategories = Object.keys(getViewCategories());
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    
    const result = await refreshViewsByCategory(category);
    res.json(result);
  } catch (error) {
    console.error("Error refreshing category:", error);
    res.status(500).json({ error: "Failed to refresh category" });
  }
});

adminRouter.post("/db-optimization/apply-all", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applyAllOptimizations } = await import("../db-optimization");
    const result = await applyAllOptimizations();
    res.json(result);
  } catch (error) {
    console.error("Error applying optimizations:", error);
    res.status(500).json({ error: "Failed to apply optimizations" });
  }
});

adminRouter.get("/db-optimization/refresh-history", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { getRefreshHistory } = await import("../db-optimization");
    const result = await getRefreshHistory(limit);
    res.json(result);
  } catch (error) {
    console.error("Error getting refresh history:", error);
    res.status(500).json({ error: "Failed to get refresh history" });
  }
});

adminRouter.get("/db-optimization/freshness", requireRole(...ADMIN_AND_ABOVE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staleThresholdHours = parseInt(req.query.staleThresholdHours as string) || 6;
    const { getFreshnessStatus } = await import("../db-optimization");
    const result = await getFreshnessStatus(staleThresholdHours);
    res.json(result);
  } catch (error) {
    console.error("Error getting freshness status:", error);
    res.status(500).json({ error: "Failed to get freshness status" });
  }
});

adminRouter.get("/db-optimization/schedule", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getRefreshSchedule } = await import("../db-optimization");
    const schedule = await getRefreshSchedule();
    res.json({ schedule });
  } catch (error) {
    console.error("Error getting refresh schedule:", error);
    res.status(500).json({ error: "Failed to get refresh schedule" });
  }
});

adminRouter.post("/db-optimization/schedule", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const { 
      scheduleTime, 
      timezone = 'Europe/London', 
      isEnabled = true, 
      postIngestionEnabled, 
      staleThresholdHours,
      refreshAll,
      targetViews
    } = req.body;
    
    if (!scheduleTime) {
      return res.status(400).json({ error: "scheduleTime is required" });
    }
    
    const { upsertRefreshSchedule } = await import("../db-optimization");
    const schedule = await upsertRefreshSchedule({
      scheduleTime,
      timezone,
      isEnabled,
      postIngestionEnabled,
      staleThresholdHours,
      refreshAll,
      targetViews,
      updatedBy: session?.user?.id
    });
    
    try {
      const { updateMvRefreshSchedule } = await import("../job-queue");
      await updateMvRefreshSchedule(scheduleTime, timezone, isEnabled);
    } catch (jobError) {
      console.error("Failed to update job queue schedule:", jobError);
    }
    
    res.json({ schedule });
  } catch (error) {
    console.error("Error updating refresh schedule:", error);
    res.status(500).json({ error: "Failed to update refresh schedule" });
  }
});

// ===== USER MANAGEMENT =====

adminRouter.get("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const allUsers = await storage.listUsers(orgId);
    const safeUsers = allUsers.map(({ password, ...user }) => user);
    res.json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.post("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { username, email, name, password, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: "Password does not meet requirements",
        details: passwordValidation.errors
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [newUser] = await db.insert(users).values({
      username,
      email,
      name: name || username,
      password: hashedPassword,
      role: role || 'VIEWER',
      organisationId: orgId,
      isActive: true,
    }).returning();
    
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

adminRouter.patch("/users/:id", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, ...updates } = req.body;
    
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet requirements",
          details: passwordValidation.errors
        });
      }
      updates.password = await bcrypt.hash(password, 12);
    }
    
    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, req.params.id))
      .returning();
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

adminRouter.patch("/users/:id/role", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, requesterId } = req.body;
    if (!role || !requesterId) {
      return res.status(400).json({ error: "Role and requesterId are required" });
    }
    
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    
    const updatedUser = await storage.updateUserRole(req.params.id, role, requesterId);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { password, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (error: any) {
    console.error("Error updating user role:", error);
    res.status(400).json({ error: error.message || "Failed to update user role" });
  }
});

adminRouter.delete("/users/:id", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [deletedUser] = await db.delete(users)
      .where(eq(users.id, req.params.id))
      .returning();
    
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ===== USER FAVORITES =====

adminRouter.get("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const favorites = await db
      .select({ navigationItemId: userFavorites.navigationItemId })
      .from(userFavorites)
      .where(eq(userFavorites.userId, session.user.id));
    
    res.json({ favorites: favorites.map(f => f.navigationItemId) });
  } catch (error) {
    console.error("Error fetching user favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

adminRouter.post("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { navigationItemId } = req.body;
    if (!navigationItemId) {
      return res.status(400).json({ error: "navigationItemId is required" });
    }
    
    const existing = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, session.user.id),
        eq(userFavorites.navigationItemId, navigationItemId)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(userFavorites).values({
        userId: session.user.id,
        navigationItemId,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

adminRouter.delete("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { navigationItemId } = req.body;
    if (!navigationItemId) {
      return res.status(400).json({ error: "navigationItemId is required" });
    }
    
    await db
      .delete(userFavorites)
      .where(and(
        eq(userFavorites.userId, session.user.id),
        eq(userFavorites.navigationItemId, navigationItemId)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// ===== FACTORY SETTINGS =====

adminRouter.get("/factory-settings", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await db.select().from(factorySettings);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching factory settings:", error);
    res.status(500).json({ error: "Failed to fetch factory settings" });
  }
});

adminRouter.patch("/factory-settings/:key", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { value } = req.body;
    const key = req.params.key;
    
    const [existing] = await db.select().from(factorySettings).where(eq(factorySettings.key, key));
    
    if (!existing) {
      return res.status(404).json({ error: "Setting not found" });
    }
    
    const [updated] = await db.update(factorySettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(factorySettings.key, key))
      .returning();
    
    await db.insert(factorySettingsAudit).values({
      settingKey: key,
      previousValue: existing.value,
      newValue: value,
      changedBy: req.user?.id || 'system',
    });
    
    clearApiLimitsCache();
    clearTierThresholdsCache();
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating factory setting:", error);
    res.status(500).json({ error: "Failed to update factory setting" });
  }
});

adminRouter.get("/factory-settings/audit", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audit = await db.select().from(factorySettingsAudit).orderBy(factorySettingsAudit.changedAt);
    res.json(audit);
  } catch (error) {
    console.error("Error fetching factory settings audit:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ===== CLOUD CONFIGURATION =====

const AI_PROVIDER_INFO: Record<string, { 
  name: string; 
  description: string; 
  category: "cloud" | "offline"; 
  envVars: string[];
  capabilityDetails: Record<string, string>;
}> = {
  claude: {
    name: "Claude (Anthropic)",
    description: "Cloud LLM with vision capabilities for document analysis",
    category: "cloud",
    envVars: ["ANTHROPIC_API_KEY"],
    capabilityDetails: {
      text_extraction: "Claude 3.5 Haiku for structured data extraction",
      vision: "Claude 3.5 Sonnet for image/PDF analysis",
    },
  },
  azure_di: {
    name: "Azure Document Intelligence",
    description: "Microsoft's OCR and document analysis service",
    category: "cloud",
    envVars: ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_KEY"],
    capabilityDetails: {
      ocr: "High-accuracy text extraction from scanned documents",
      document_intelligence: "Pre-built models for invoices, receipts, IDs",
    },
  },
  tesseract: {
    name: "Tesseract.js",
    description: "Offline OCR engine for airgapped deployments",
    category: "offline",
    envVars: [],
    capabilityDetails: {
      ocr: "Local text extraction - no external API required",
    },
  },
  ollama: {
    name: "Ollama",
    description: "Local LLM server for airgapped/self-hosted deployments",
    category: "offline",
    envVars: ["OLLAMA_BASE_URL", "OLLAMA_MODEL"],
    capabilityDetails: {
      text_extraction: "Local LLM for document field extraction",
      vision: "Vision models like LLaVA for image analysis",
    },
  },
};

const STORAGE_PROVIDER_INFO: Record<string, { name: string; description: string; envVars: string[] }> = {
  replit: { 
    name: "Replit Object Storage", 
    description: "Built-in Replit storage with automatic management",
    envVars: ["DEFAULT_OBJECT_STORAGE_BUCKET_ID", "PUBLIC_OBJECT_SEARCH_PATHS", "PRIVATE_OBJECT_DIR"]
  },
  local: { 
    name: "Local Filesystem", 
    description: "Local file storage for development/airgapped",
    envVars: ["LOCAL_STORAGE_PATH"]
  },
  s3: { 
    name: "AWS S3", 
    description: "Amazon S3 or S3-compatible storage (MinIO)",
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET"]
  },
  azure_blob: { 
    name: "Azure Blob Storage", 
    description: "Microsoft Azure Blob Storage",
    envVars: ["AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER"]
  },
  gcs: { 
    name: "Google Cloud Storage", 
    description: "Google Cloud Storage buckets",
    envVars: ["GOOGLE_APPLICATION_CREDENTIALS", "GCS_BUCKET"]
  },
};

const SSO_PROVIDER_INFO: Record<string, { name: string; description: string; envVars: string[] }> = {
  "microsoft-entra": { 
    name: "Microsoft Entra ID", 
    description: "Azure Active Directory / Microsoft 365",
    envVars: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"]
  },
  google: { 
    name: "Google", 
    description: "Google Workspace / Gmail accounts",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
  },
  okta: { 
    name: "Okta", 
    description: "Okta Identity Platform",
    envVars: ["OKTA_DOMAIN", "OKTA_CLIENT_ID", "OKTA_CLIENT_SECRET", "OKTA_AUTH_SERVER"]
  },
  keycloak: { 
    name: "Keycloak", 
    description: "Open source identity and access management",
    envVars: ["KEYCLOAK_URL", "KEYCLOAK_REALM", "KEYCLOAK_CLIENT_ID", "KEYCLOAK_CLIENT_SECRET"]
  },
  "generic-oidc": { 
    name: "Generic OIDC", 
    description: "Any OpenID Connect compliant provider",
    envVars: ["OIDC_DISCOVERY_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_PROVIDER_ID"]
  },
};

adminRouter.get("/cloud-config", requireRole(...ADMIN_ROLES), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const aiRegistry = getAIRegistry();
    const aiProviders = aiRegistry.listProviders();
    
    const activeStorageProvider = process.env.STORAGE_PROVIDER || "replit";
    const storageProviders = Object.entries(STORAGE_PROVIDER_INFO).map(([id, info]) => {
      const isActive = id === activeStorageProvider;
      const envVarsSet = info.envVars.filter(v => !!process.env[v]);
      return {
        id,
        ...info,
        isActive,
        configured: isActive || envVarsSet.length === info.envVars.length,
        envVarsConfigured: envVarsSet.length,
        envVarsRequired: info.envVars.length,
      };
    });
    
    const configuredSSOProviders = getConfiguredProviders();
    const ssoProviders = Object.entries(SSO_PROVIDER_INFO).map(([id, info]) => {
      const isEnabled = configuredSSOProviders.includes(id);
      const envVarsSet = info.envVars.filter(v => !!process.env[v]);
      return {
        id,
        ...info,
        isEnabled,
        configured: envVarsSet.length >= 3,
        envVarsConfigured: envVarsSet.length,
        envVarsRequired: info.envVars.length,
      };
    });
    
    const enhancedAIProviders = aiProviders.map(p => {
      const providerInfo = AI_PROVIDER_INFO[p.type];
      const envVarsSet = providerInfo?.envVars.filter(v => !!process.env[v]) || [];
      return {
        ...p,
        displayName: providerInfo?.name || p.name,
        description: providerInfo?.description || "",
        category: providerInfo?.category || "cloud",
        envVars: providerInfo?.envVars || [],
        envVarsConfigured: envVarsSet.length,
        envVarsRequired: providerInfo?.envVars.length || 0,
        capabilityDetails: providerInfo?.capabilityDetails || {},
        health: aiRegistry.getHealth(p.type),
      };
    });
    
    res.json({
      storage: {
        activeProvider: activeStorageProvider,
        providers: storageProviders,
      },
      ai: {
        providers: enhancedAIProviders,
      },
      sso: {
        providers: ssoProviders,
        emailPasswordEnabled: true,
      },
    });
  } catch (error) {
    console.error("Error fetching cloud config:", error);
    res.status(500).json({ error: "Failed to fetch cloud configuration" });
  }
});

adminRouter.post("/cloud-config/health-check", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, providerId } = req.body;
    
    if (category === "ai") {
      const aiRegistry = getAIRegistry();
      await aiRegistry.ensureInitialized();
      const healthResults = await aiRegistry.healthCheckAll();
      
      const results: Record<string, any> = {};
      for (const [type, health] of Array.from(healthResults.entries())) {
        results[type] = health;
      }
      
      res.json({ 
        success: true, 
        category: "ai",
        results,
      });
    } else if (category === "storage") {
      const storageService = new ObjectStorageService();
      let healthy = false;
      let error: string | undefined;
      
      try {
        storageService.getPublicObjectSearchPaths();
        storageService.getPrivateObjectDir();
        healthy = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      
      res.json({
        success: true,
        category: "storage",
        results: {
          [process.env.STORAGE_PROVIDER || "replit"]: {
            isHealthy: healthy,
            lastChecked: new Date(),
            error,
          },
        },
      });
    } else {
      res.status(400).json({ error: "Invalid category. Use 'ai' or 'storage'" });
    }
  } catch (error) {
    console.error("Error running health check:", error);
    res.status(500).json({ error: "Failed to run health check" });
  }
});
