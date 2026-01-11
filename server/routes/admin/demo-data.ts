import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { storage } from "../../storage";
import { generateFullDemoData } from "../../demo-data-generator";
import { SUPER_ADMIN_ROLES, ADMIN_ROLES, getOrgId } from "./utils";
import { db } from "../../db";
import { auditEvents, complianceStreams, certificateTypes, classificationCodes, componentTypes, extractionSchemas, complianceRules, normalisationRules } from "@shared/schema";
import { seedDatabase, getMigrationPreview, applyMigration } from "../../seed";
import { clearApiLimitsCache } from "../../services/api-limits";
import { clearTierThresholdsCache } from "../../services/risk-scoring";

export const adminDemoDataRouter = Router();

interface InitializationRequest {
  phrase: string;
  userEmail: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const initializationRequests = new Map<string, InitializationRequest>();

function generateConfirmationPhrase(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generateBlock = (length: number) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `INIT-${generateBlock(4)}-${generateBlock(4)}`;
}

function cleanupExpiredRequests() {
  const now = Date.now();
  const entries = Array.from(initializationRequests.entries());
  for (const [key, request] of entries) {
    if (request.expiresAt < now) {
      initializationRequests.delete(key);
    }
  }
}

adminDemoDataRouter.post("/initialize-system/request", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    cleanupExpiredRequests();
    
    const userId = req.user!.id;
    const userEmail = req.user!.email || 'unknown';
    
    const existingRequest = initializationRequests.get(userId);
    if (existingRequest && existingRequest.expiresAt > Date.now()) {
      return res.json({
        success: true,
        phrase: existingRequest.phrase,
        expiresAt: existingRequest.expiresAt,
        message: "Existing initialization request found"
      });
    }
    
    const phrase = generateConfirmationPhrase();
    const now = Date.now();
    const expiresAt = now + (10 * 60 * 1000);
    
    initializationRequests.set(userId, {
      phrase,
      userEmail,
      userId,
      createdAt: now,
      expiresAt
    });
    
    console.log(`[SYSTEM INIT] Initialization request created by ${userEmail} (${userId}). Phrase: ${phrase}`);
    
    res.json({
      success: true,
      phrase,
      expiresAt,
      message: "Initialization request created. This phrase expires in 10 minutes."
    });
  } catch (error) {
    console.error("Failed to create initialization request:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to create initialization request", details: errorMessage });
  }
});

adminDemoDataRouter.post("/initialize-system/confirm", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    cleanupExpiredRequests();
    
    const { phrase, confirmed } = req.body || {};
    const userId = req.user!.id;
    const userEmail = req.user!.email || 'unknown';
    const userName = req.user!.name || req.user!.username || 'Unknown';
    const orgId = getOrgId(req);
    
    if (!phrase || typeof phrase !== 'string') {
      return res.status(400).json({ error: "Confirmation phrase is required" });
    }
    
    if (confirmed !== true) {
      return res.status(400).json({ error: "You must confirm the operation by setting confirmed to true" });
    }
    
    const storedRequest = initializationRequests.get(userId);
    
    if (!storedRequest) {
      return res.status(400).json({ 
        error: "No initialization request found. Please request a new confirmation phrase.",
        code: "NO_REQUEST"
      });
    }
    
    if (storedRequest.expiresAt < Date.now()) {
      initializationRequests.delete(userId);
      return res.status(400).json({ 
        error: "Initialization request has expired. Please request a new confirmation phrase.",
        code: "EXPIRED"
      });
    }
    
    if (storedRequest.phrase.toUpperCase() !== phrase.toUpperCase().trim()) {
      return res.status(400).json({ 
        error: "Confirmation phrase does not match. Please enter the exact phrase shown.",
        code: "PHRASE_MISMATCH"
      });
    }
    
    console.log(`[SYSTEM INIT] Starting system initialization by ${userEmail} (${userId})`);
    
    try {
      await db.insert(auditEvents).values({
        organisationId: orgId,
        eventType: 'SETTINGS_CHANGED',
        entityType: 'SETTINGS',
        entityId: 'system-init',
        entityName: 'System Initialization',
        actorId: userId,
        actorName: userName,
        actorType: 'USER',
        message: `System initialization started by ${userName} (${userEmail})`,
        metadata: { 
          action: 'SYSTEM_INITIALIZATION_STARTED',
          phrase: storedRequest.phrase,
          requestedAt: new Date(storedRequest.createdAt).toISOString(),
          confirmedAt: new Date().toISOString()
        },
      });
    } catch (auditError) {
      console.error("Failed to create pre-initialization audit log:", auditError);
    }
    
    const progress: { step: string; status: 'pending' | 'running' | 'completed' | 'failed'; message?: string }[] = [
      { step: 'wipe_data', status: 'pending' },
      { step: 'seed_config', status: 'pending' },
      { step: 'create_audit', status: 'pending' }
    ];
    
    try {
      progress[0].status = 'running';
      console.log(`[SYSTEM INIT] Step 1: Wiping all data...`);
      await storage.wipeData(true);
      progress[0].status = 'completed';
      progress[0].message = 'All data wiped successfully';
      console.log(`[SYSTEM INIT] Step 1 completed: Data wiped`);
    } catch (error) {
      progress[0].status = 'failed';
      progress[0].message = error instanceof Error ? error.message : 'Failed to wipe data';
      console.error(`[SYSTEM INIT] Step 1 failed:`, error);
      return res.status(500).json({ 
        error: "System initialization failed at wipe_data step", 
        progress,
        details: error?.message 
      });
    }
    
    try {
      progress[1].status = 'running';
      console.log(`[SYSTEM INIT] Step 2: Seeding mandatory configuration...`);
      await seedDatabase();
      progress[1].status = 'completed';
      progress[1].message = 'Mandatory configuration seeded successfully';
      console.log(`[SYSTEM INIT] Step 2 completed: Config seeded`);
    } catch (error) {
      progress[1].status = 'failed';
      progress[1].message = error instanceof Error ? error.message : 'Failed to seed configuration';
      console.error(`[SYSTEM INIT] Step 2 failed:`, error);
      return res.status(500).json({ 
        error: "System initialization failed at seed_config step", 
        progress,
        details: error?.message 
      });
    }
    
    try {
      progress[2].status = 'running';
      console.log(`[SYSTEM INIT] Step 3: Creating completion audit log...`);
      await db.insert(auditEvents).values({
        organisationId: orgId,
        eventType: 'SETTINGS_CHANGED',
        entityType: 'SETTINGS',
        entityId: 'system-init',
        entityName: 'System Initialization',
        actorId: userId,
        actorName: userName,
        actorType: 'USER',
        message: `System initialization completed successfully by ${userName} (${userEmail})`,
        metadata: { 
          action: 'SYSTEM_INITIALIZATION_COMPLETED',
          phrase: storedRequest.phrase,
          completedAt: new Date().toISOString(),
          stepsCompleted: progress.filter(p => p.status === 'completed').length
        },
      });
      progress[2].status = 'completed';
      progress[2].message = 'Audit log created';
      console.log(`[SYSTEM INIT] Step 3 completed: Audit log created`);
    } catch (error) {
      progress[2].status = 'failed';
      progress[2].message = error instanceof Error ? error.message : 'Failed to create audit log';
      console.error(`[SYSTEM INIT] Step 3 failed (non-critical):`, error);
    }
    
    initializationRequests.delete(userId);
    
    console.log(`[SYSTEM INIT] System initialization completed successfully by ${userEmail}`);
    
    res.json({
      success: true,
      message: "System initialization completed successfully. All data has been wiped and mandatory configuration has been restored.",
      progress
    });
  } catch (error) {
    console.error("System initialization failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: "System initialization failed", 
      details: errorMessage 
    });
  }
});

adminDemoDataRouter.post("/initialize-system/cancel", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deleted = initializationRequests.delete(userId);
    
    res.json({
      success: true,
      message: deleted ? "Initialization request cancelled" : "No active initialization request found"
    });
  } catch (error) {
    console.error("Failed to cancel initialization request:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to cancel initialization request", details: errorMessage });
  }
});

adminDemoDataRouter.post("/wipe-data", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeProperties } = req.body || {};
    await storage.wipeData(includeProperties === true);
    res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
  } catch (error) {
    console.error("Failed to wipe data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to wipe data", details: errorMessage });
  }
});

adminDemoDataRouter.post("/seed-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    await storage.seedDemoData(orgId);
    res.json({ success: true, message: "Demo data seeded successfully" });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

adminDemoDataRouter.post("/reset-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error("Failed to regenerate demo data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetail = (error as { detail?: string; code?: string })?.detail || (error as { code?: string })?.code || "";
    res.status(500).json({ 
      error: "Failed to regenerate demo data", 
      details: `${errorMessage}${errorDetail ? ` (${errorDetail})` : ""}` 
    });
  }
});

adminDemoDataRouter.post("/seed-spaces", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error("Failed to seed spaces:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to seed spaces", details: errorMessage });
  }
});

adminDemoDataRouter.post("/reclassify-certificates", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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
      const extractedMeta = property?.extractedMetadata as { documentType?: string } | undefined;
      const certData = cert as { extractedData?: { documentType?: string } };
      const docType = extractedMeta?.documentType || certData.extractedData?.documentType;
      
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

adminDemoDataRouter.get("/migrate/preview", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`[MIGRATE] Preview requested by ${req.user?.email}`);
    const preview = await getMigrationPreview();
    res.json(preview);
  } catch (error) {
    console.error("Failed to get migration preview:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to get migration preview", details: errorMessage });
  }
});

adminDemoDataRouter.post("/migrate/apply", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email || 'unknown';
    const userName = req.user!.name || req.user!.username || 'Unknown';
    const orgId = getOrgId(req);
    
    console.log(`[MIGRATE] Apply requested by ${userEmail} (${userId})`);
    
    const preview = await getMigrationPreview();
    
    if (preview.totalPending === 0) {
      return res.json({ 
        success: true, 
        message: "No pending updates to apply",
        applied: { complianceStreams: 0, certificateTypes: 0, classificationCodes: 0, componentTypes: 0 }
      });
    }
    
    try {
      await db.insert(auditEvents).values({
        organisationId: orgId,
        eventType: 'SETTINGS_CHANGED',
        entityType: 'SETTINGS',
        entityId: 'system-migration',
        entityName: 'System Configuration Migration',
        actorId: userId,
        actorName: userName,
        actorType: 'USER',
        message: `Configuration migration started by ${userName} (${userEmail})`,
        metadata: { 
          action: 'MIGRATION_STARTED',
          pendingChanges: preview,
          startedAt: new Date().toISOString()
        },
      });
    } catch (auditError) {
      console.error("Failed to create pre-migration audit log:", auditError);
    }
    
    const result = await applyMigration();
    
    try {
      await db.insert(auditEvents).values({
        organisationId: orgId,
        eventType: 'SETTINGS_CHANGED',
        entityType: 'SETTINGS',
        entityId: 'system-migration',
        entityName: 'System Configuration Migration',
        actorId: userId,
        actorName: userName,
        actorType: 'USER',
        message: `Configuration migration completed by ${userName} (${userEmail}): ${result.totalApplied} items updated`,
        metadata: { 
          action: 'MIGRATION_COMPLETED',
          applied: result.applied,
          totalApplied: result.totalApplied,
          completedAt: new Date().toISOString()
        },
      });
    } catch (auditError) {
      console.error("Failed to create post-migration audit log:", auditError);
    }
    
    console.log(`[MIGRATE] Migration completed: ${result.totalApplied} items applied`);
    
    res.json({
      success: true,
      message: `Successfully applied ${result.totalApplied} configuration updates`,
      ...result
    });
  } catch (error) {
    console.error("Failed to apply migration:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to apply migration", details: errorMessage });
  }
});

adminDemoDataRouter.get("/factory-settings", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await storage.listFactorySettings();
    const grouped = settings.reduce((acc, setting) => {
      const category = setting.category || 'GENERAL';
      if (!acc[category]) acc[category] = [];
      acc[category].push(setting);
      return acc;
    }, {} as Record<string, typeof settings>);
    res.json({ settings, grouped });
  } catch (error) {
    console.error("Error listing factory settings:", error);
    res.status(500).json({ error: "Failed to list factory settings" });
  }
});

adminDemoDataRouter.get("/factory-settings/:key", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const setting = await storage.getFactorySetting(req.params.key);
    if (!setting) {
      return res.status(404).json({ error: "Setting not found" });
    }
    res.json(setting);
  } catch (error) {
    console.error("Error getting factory setting:", error);
    res.status(500).json({ error: "Failed to get factory setting" });
  }
});

adminDemoDataRouter.patch("/factory-settings/:key", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { value } = req.body;
    const userId = req.user?.id || 'system';
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: "Value is required" });
    }
    
    const existing = await storage.getFactorySetting(req.params.key);
    if (!existing) {
      return res.status(404).json({ error: "Setting not found" });
    }
    
    if (!existing.isEditable) {
      return res.status(403).json({ error: "This setting cannot be modified" });
    }
    
    if (existing.valueType === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return res.status(400).json({ error: "Value must be a valid number" });
      }
      if (existing.validationRules) {
        const rules = existing.validationRules as { min?: number; max?: number };
        if (rules.min !== undefined && numValue < rules.min) {
          return res.status(400).json({ error: `Value must be at least ${rules.min}` });
        }
        if (rules.max !== undefined && numValue > rules.max) {
          return res.status(400).json({ error: `Value must be at most ${rules.max}` });
        }
      }
    } else if (existing.valueType === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        return res.status(400).json({ error: "Value must be 'true' or 'false'" });
      }
    }
    
    await storage.createFactorySettingsAudit({
      settingId: existing.id,
      key: req.params.key,
      oldValue: existing.value,
      newValue: value,
      changedById: userId
    });
    
    const updated = await storage.updateFactorySetting(req.params.key, value, userId);
    
    if (existing.category === 'api_limits' || req.params.key.startsWith('api.')) {
      clearApiLimitsCache();
    }
    
    if (existing.category === 'risk_scoring' || req.params.key.startsWith('risk_tier_')) {
      clearTierThresholdsCache();
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating factory setting:", error);
    res.status(500).json({ error: "Failed to update factory setting" });
  }
});
