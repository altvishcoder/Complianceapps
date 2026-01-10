import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireRole, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { users, factorySettings, factorySettingsAudit } from "@shared/schema";
import { eq } from "drizzle-orm";
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
import { getConfiguredProviders } from "../auth";
import { ObjectStorageService } from "../replit_integrations/object_storage";

export const adminRouter = Router();

const ORG_ID = "org-001";
const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
const ADMIN_ROLES = [...SUPER_ADMIN_ROLES, 'COMPLIANCE_MANAGER', 'ADMIN'];

// ===== ADMIN / DEMO DATA MANAGEMENT =====
adminRouter.post("/wipe-data", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeProperties } = req.body || {};
    await storage.wipeData(includeProperties === true);
    res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
  } catch (error) {
    console.error("Error wiping data:", error);
    res.status(500).json({ error: "Failed to wipe data" });
  }
});

adminRouter.post("/seed-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await storage.seedDemoData(ORG_ID);
    res.json({ success: true, message: "Demo data seeded successfully" });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

adminRouter.post("/reset-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await storage.wipeData(true);
    await storage.seedDemoData(ORG_ID);
    res.json({ success: true, message: "Demo reset complete" });
  } catch (error) {
    console.error("Error resetting demo:", error);
    res.status(500).json({ error: "Failed to reset demo" });
  }
});

// ===== BULK SEEDING (High Volume) =====
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

adminRouter.post("/bulk-seed", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tier } = req.body;
    if (!tier || !VOLUME_CONFIGS[tier as VolumeTier]) {
      return res.status(400).json({ error: "Invalid tier. Must be 'small', 'medium', or 'large'" });
    }
    
    const progress = getProgress();
    if (progress.status === "running") {
      return res.status(409).json({ error: "Bulk seeding is already in progress" });
    }
    
    runBulkSeed(tier as VolumeTier, ORG_ID)
      .then(() => refreshMaterializedViewsAfterSeed())
      .catch(err => console.error("Bulk seed error:", err));
    
    res.json({ 
      success: true, 
      message: `Started ${tier} bulk seeding`,
      tier,
      totals: calculateTotals(VOLUME_CONFIGS[tier as VolumeTier]),
    });
  } catch (error) {
    console.error("Error starting bulk seed:", error);
    res.status(500).json({ error: "Failed to start bulk seeding" });
  }
});

adminRouter.get("/bulk-seed/progress", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(getProgress());
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

adminRouter.post("/bulk-seed/cancel", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    cancelBulkSeed();
    res.json({ success: true, message: "Cancel requested" });
  } catch (error) {
    console.error("Error cancelling bulk seed:", error);
    res.status(500).json({ error: "Failed to cancel bulk seeding" });
  }
});

// ===== USER MANAGEMENT =====
adminRouter.get("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      organisationId: users.organisationId,
      createdAt: users.createdAt,
    }).from(users);
    res.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.post("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
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
      organisationId: ORG_ID,
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
      changedBy: (req as any).user?.id || 'system',
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
