import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { getAIRegistry } from "../../services/ai/providers";
import { getConfiguredProviders } from "../../auth";
import { ObjectStorageService } from "../../replit_integrations/object_storage";
import { ADMIN_ROLES } from "./utils";

export const adminCloudConfigRouter = Router();

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

adminCloudConfigRouter.get("/cloud-config", requireRole(...ADMIN_ROLES), async (_req: AuthenticatedRequest, res: Response) => {
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

adminCloudConfigRouter.post("/cloud-config/health-check", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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
