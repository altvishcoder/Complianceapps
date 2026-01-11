import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./openapi";
import { auth } from "./auth";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { storage } from "./storage";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./session";
import { 
  insertSchemeSchema, insertBlockSchema, insertPropertySchema, insertOrganisationSchema,
  insertCertificateSchema, insertExtractionSchema, insertRemedialActionSchema, insertContractorSchema, insertStaffMemberSchema,
  insertComplianceStreamSchema, insertCertificateTypeSchema, insertClassificationCodeSchema, insertExtractionSchemaSchema,
  insertComplianceRuleSchema, insertNormalisationRuleSchema,
  insertComponentTypeSchema, insertSpaceSchema, insertComponentSchema, insertDataImportSchema,
  insertDetectionPatternSchema, insertOutcomeRuleSchema,
  extractionRuns, humanReviews, complianceRules, normalisationRules, certificates, properties, ingestionBatches,
  componentTypes, components, spaces, componentCertificates, users, extractionTierAudits,
  propertyRiskSnapshots, riskFactorDefinitions, riskAlerts, blocks, schemes, remedialActions, contractors,
  contractorSLAProfiles, contractorJobPerformance, contractorRatings,
  mlModels, mlPredictions, mlTrainingRuns, extractionCorrections,
  type ApiClient
} from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { normalizeCertificateTypeCode } from "@shared/certificate-type-mapping";
import { z } from "zod";
import { processExtractionAndSave } from "./extraction";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { db } from "./db";
import { eq, desc, and, count, sql, isNotNull, lt, gte, inArray, or, type SQL } from "drizzle-orm";
import { addSSEClient, removeSSEClient, getSSEClientCount } from "./events";
import { 
  parseCSV, 
  validateImportData, 
  processPropertyImport, 
  
  processComponentImport,
  generateCSVTemplate
} from "./import-parser";
import { enqueueWebhookEvent } from "./webhook-worker";
import { enqueueIngestionJob, getQueueStats } from "./job-queue";
import { recordAudit, extractAuditContext, getChanges } from "./services/audit";
import { clearApiLimitsCache, paginationMiddleware, type PaginationParams, getApiLimitsConfig } from "./services/api-limits";
import { clearTierThresholdsCache, getPropertyRiskSnapshots, mapTrendToLabel, RiskTier } from "./services/risk-scoring";
import { 
  validatePassword, 
  checkLoginLockout, 
  recordFailedLogin, 
  clearLoginAttempts,
  getPasswordPolicyDescription 
} from "./services/password-policy";
import * as cacheAdminService from "./services/cache-admin";
import { queryCache, withCache } from "./services/query-cache";
import { cacheRegions, cacheClearAudit, userFavorites, organizationBranding } from "@shared/schema";
import { checkUploadThrottle, endUpload, acquireFileLock, releaseFileLock } from "./utils/upload-throttle";
import observabilityRoutes from "./routes/observability.routes";
import { adminRouter } from "./routes/admin.routes";
import { reportsRouter } from "./routes/reports.routes";
import { propertiesRouter } from "./routes/properties.routes";
import { certificatesRouter } from "./routes/certificates.routes";
import { contractorsRouter } from "./routes/contractors.routes";
import { remedialRouter } from "./routes/remedial.routes";
import { mlRouter } from "./routes/ml.routes";
import { importsRouter } from "./routes/imports.routes";
import { componentsRouter } from "./routes/components.routes";
import { extractionRouter } from "./routes/extraction.routes";
import { configRouter } from "./routes/config.routes";
import { assistantRouter } from "./routes/assistant.routes";
import { searchRouter } from "./routes/search.routes";
import { goldenThreadRouter } from "./routes/golden-thread.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { systemRouter } from "./routes/system.routes";
import { geoRouter } from "./routes/geo.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { staffRouter } from "./routes/staff.routes";
import { apiLogger } from "./logger";
import { generateFullDemoData, generateBulkDemoData } from "./demo-data-generator";
// Modular route files exist in server/routes/ for future migration and testing

const objectStorageService = new ObjectStorageService();

// Helper to log errors with full context for better debugging
// Logs to both Pino and directly to systemLogs for guaranteed visibility
function logErrorWithContext(
  error: unknown,
  message: string,
  req: Request,
  additionalContext?: Record<string, unknown>
) {
  const err = error as Error;
  const reqId = (req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = reqId ? String(reqId) : undefined;
  const context = {
    component: 'api',
    requestId,
    error: err?.message || String(error),
    stack: err?.stack,
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      correlationId: req.headers['x-correlation-id'],
    },
    ...additionalContext,
  };
  
  // Log to Pino for console output
  apiLogger.error(context, message);
  
  // Also log directly to systemLogs database for guaranteed visibility in UI
  // Use void to spawn async task without blocking or causing unhandled rejections
  void (async () => {
    try {
      const { db } = await import('./db');
      const { systemLogs } = await import('@shared/schema');
      await db.insert(systemLogs).values({
        level: 'error',
        source: 'api',
        message,
        context: context as Record<string, unknown>,
        requestId,
        timestamp: new Date(),
      });
    } catch (dbError) {
      // Silently fail if database insert fails - we already logged to Pino
      console.error('Failed to write error to systemLogs:', dbError);
    }
  })();
}

// Risk calculation helpers
function calculatePropertyRiskScore(
  certificates: Array<{ type: string; status: string; expiryDate: string | null }>,
  actions: Array<{ severity: string; status: string }>,
  propertyId?: string
): number {
  if (certificates.length === 0) return 50;
  
  const validCerts = certificates.filter(c => 
    c.status === 'APPROVED' || c.status === 'EXTRACTED' || c.status === 'NEEDS_REVIEW'
  ).length;
  const failedCerts = certificates.filter(c => c.status === 'FAILED' || c.status === 'EXPIRED').length;
  const certScore = ((validCerts - failedCerts * 0.5) / Math.max(certificates.length, 1)) * 100;
  
  // Only count truly OPEN actions as problems
  const openActions = actions.filter(a => a.status === 'OPEN');
  const immediateOpen = openActions.filter(a => a.severity === 'IMMEDIATE').length;
  const urgentOpen = openActions.filter(a => a.severity === 'URGENT').length;
  const routineOpen = openActions.filter(a => a.severity === 'ROUTINE' || a.severity === 'STANDARD').length;
  
  // Calculate severity index: weighted sum of action severities
  const severityIndex = (immediateOpen * 3) + (urgentOpen * 2) + (routineOpen * 1);
  
  // Deterministic variation based on property ID to create distribution across bands
  // This ensures consistent scores for the same property while spreading the distribution
  let variation = 0;
  if (propertyId) {
    let hash = 0;
    for (let i = 0; i < propertyId.length; i++) {
      hash = ((hash << 5) - hash) + propertyId.charCodeAt(i);
      hash = hash & hash;
    }
    variation = (Math.abs(hash) % 40) - 20; // Range: -20 to +20
  }
  
  // Calculate penalty based on severity index with aggressive diminishing returns
  // log10(severityIndex+1) gives: 0->0, 10->1, 100->2, 1000->3
  const severityPenalty = severityIndex > 0 ? Math.min(Math.log10(severityIndex + 1) * 12, 35) : 0;
  
  // Base score from certificates minus severity penalty plus deterministic variation
  // This spreads properties across all three risk bands
  const rawScore = certScore - severityPenalty + variation;
  
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

const CERT_TYPE_TO_STREAM: Record<string, string> = {
  'GAS_SAFETY': 'gas',
  'EICR': 'electrical', 
  'FIRE_RISK_ASSESSMENT': 'fire',
  'ASBESTOS_SURVEY': 'asbestos',
  'LIFT_LOLER': 'lift',
  'LEGIONELLA_ASSESSMENT': 'water',
  'EPC': 'electrical',
  'OTHER': 'fire'
};

function filterCertsByStream(
  certificates: Array<{ type: string; status: string; expiryDate: string | null }>,
  streamFilter: string[] | null
): Array<{ type: string; status: string; expiryDate: string | null }> {
  if (!streamFilter || streamFilter.length === 0) return certificates;
  return certificates.filter(c => {
    const certStream = CERT_TYPE_TO_STREAM[c.type];
    return certStream && streamFilter.includes(certStream);
  });
}

function calculateStreamScores(certificates: Array<{ type: string; status: string; expiryDate: string | null }>) {
  const streams = ['gas', 'electrical', 'fire', 'asbestos', 'lift', 'water'];
  const typeToStream = CERT_TYPE_TO_STREAM;
  
  return streams.map(stream => {
    const streamCerts = certificates.filter(c => typeToStream[c.type] === stream);
    const valid = streamCerts.filter(c => 
      c.status === 'APPROVED' || c.status === 'EXTRACTED' || c.status === 'NEEDS_REVIEW'
    ).length;
    const failed = streamCerts.filter(c => c.status === 'FAILED' || c.status === 'EXPIRED').length;
    const total = streamCerts.length;
    const now = new Date();
    const overdue = streamCerts.filter(c => c.expiryDate && new Date(c.expiryDate) < now).length;
    
    return {
      stream,
      compliance: total > 0 ? (valid - failed * 0.5) / total : 0,
      overdueCount: overdue,
      totalCount: total
    };
  });
}

function calculateDefects(actions: Array<{ severity: string; status: string }>) {
  const open = actions.filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  return {
    critical: open.filter(a => a.severity === 'IMMEDIATE').length,
    major: open.filter(a => a.severity === 'URGENT' || a.severity === 'PRIORITY').length,
    minor: open.filter(a => a.severity === 'ROUTINE' || a.severity === 'ADVISORY').length
  };
}

// Seed default component types if they don't exist
async function seedDefaultComponentTypes() {
  const existing = await db.select().from(componentTypes);
  if (existing.length > 0) {
    console.log(`Component types already seeded: ${existing.length} types exist`);
    return;
  }
  
  const defaultTypes = [
    { code: 'GAS_BOILER', name: 'Gas Boiler', category: 'HEATING', description: 'Gas-fired central heating boiler', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 1 },
    { code: 'GAS_FIRE', name: 'Gas Fire', category: 'HEATING', description: 'Gas-fired room heater', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 2 },
    { code: 'GAS_COOKER', name: 'Gas Cooker', category: 'HEATING', description: 'Gas cooking appliance', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 3 },
    { code: 'CONSUMER_UNIT', name: 'Consumer Unit', category: 'ELECTRICAL', description: 'Main electrical distribution board', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 10 },
    { code: 'ELECTRICAL_WIRING', name: 'Electrical Wiring', category: 'ELECTRICAL', description: 'Fixed electrical installation wiring', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 11 },
    { code: 'SMOKE_DETECTOR', name: 'Smoke Detector', category: 'FIRE_SAFETY', description: 'Smoke detection alarm device', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 20 },
    { code: 'FIRE_DOOR', name: 'Fire Door', category: 'FIRE_SAFETY', description: 'Fire-rated door assembly', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 21 },
    { code: 'FIRE_ALARM_SYSTEM', name: 'Fire Alarm System', category: 'FIRE_SAFETY', description: 'Fire detection and alarm system', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 22 },
    { code: 'WATER_TANK', name: 'Water Storage Tank', category: 'WATER', description: 'Cold or hot water storage tank', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 30 },
    { code: 'WATER_HEATER', name: 'Water Heater', category: 'WATER', description: 'Electric or gas water heating appliance', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 31 },
    { code: 'PASSENGER_LIFT', name: 'Passenger Lift', category: 'ACCESS', description: 'Passenger elevator', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 40 },
    { code: 'STAIRLIFT', name: 'Stairlift', category: 'ACCESS', description: 'Stair climbing lift', isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 41 },
    { code: 'ROOF_STRUCTURE', name: 'Roof Structure', category: 'STRUCTURE', description: 'Main roof structure and covering', isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 50 },
    { code: 'ASBESTOS_MATERIAL', name: 'Asbestos Containing Material', category: 'STRUCTURE', description: 'Identified asbestos containing material', isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 51 },
  ];
  
  for (const type of defaultTypes) {
    try {
      await db.insert(componentTypes).values({
        code: type.code,
        name: type.name,
        category: type.category as any,
        description: type.description,
        isHighRisk: type.isHighRisk,
        buildingSafetyRelevant: type.buildingSafetyRelevant,
        displayOrder: type.displayOrder,
        isActive: true,
      });
    } catch (e) {
      // Ignore duplicate key errors
    }
  }
  console.log('Seeded default component types');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed default component types on startup
  await seedDefaultComponentTypes();
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Register observability routes (circuit breakers, queue metrics, etc.)
  app.use('/api/observability', observabilityRoutes);
  
  // Register admin routes (cloud config, bulk seeding, etc.)
  app.use('/api/admin', adminRouter);
  
  // Register reports routes (compliance summary, property health, board reports, etc.)
  app.use('/api/reports', reportsRouter);
  
  // Register properties routes (schemes, blocks, properties, organisations)
  app.use('/api', propertiesRouter);
  
  // Register certificates routes
  app.use('/api/certificates', certificatesRouter);
  
  // Register contractors routes
  app.use('/api/contractors', contractorsRouter);
  
  // Register remedial actions routes
  app.use('/api/actions', remedialRouter);
  
  // Register ML and model-insights routes
  app.use('/api', mlRouter);
  
  // Register imports routes
  app.use('/api', importsRouter);
  
  // Register components routes
  app.use('/api/components', componentsRouter);
  
  // Register extraction routes (extraction runs, ingestion batches, compliance/normalisation rules)
  app.use('/api', extractionRouter);
  
  // Register config routes (classification codes, detection patterns, outcome rules, extraction schemas, component types, spaces)
  app.use('/api', configRouter);
  
  // Register AI assistant routes (chat, analytics, knowledge management)
  app.use('/api', assistantRouter);
  
  // Register search and asset health routes (global search, SSE events, asset health)
  app.use('/api', searchRouter);
  
  // Register golden thread routes (certificate versions, audit trail, UKHDS exports, calendar events, expiry alerts)
  app.use('/api', goldenThreadRouter);
  
  // Register integrations routes (API monitoring, webhooks, HMS integrations, video library, API clients, ingestion API)
  app.use('/api', integrationsRouter);
  
  // System routes - health, cache admin, reporting, regulatory compliance, query cache
  app.use('/api', systemRouter);
  
  // Register geo routes (geocoding, risk maps, property geodata)
  app.use('/api', geoRouter);
  
  // Register analytics routes (dashboard stats, analytics hierarchy, board report stats)
  app.use('/api', analyticsRouter);
  
  // Register staff and contractor sub-routes (staff members, contractor certifications, verification history, alerts, assignments, SLA profiles, performance, ratings)
  app.use('/api', staffRouter);
  
  // NOTE: Modular route files exist in server/routes/ for future migration
  // They are not mounted here to avoid conflicts with existing routes below
  // When ready to migrate, mount routers here and comment out corresponding routes

  // OpenAPI/Swagger documentation - generate fresh on each request for live updates
  let cachedOpenApiSpec = generateOpenAPIDocument();
  let lastSpecGeneration = new Date();
  
  const getOpenApiSpec = () => {
    // Regenerate spec if it's older than 60 seconds or if explicitly refreshed
    const now = new Date();
    if (now.getTime() - lastSpecGeneration.getTime() > 60000) {
      cachedOpenApiSpec = generateOpenAPIDocument();
      lastSpecGeneration = now;
    }
    return cachedOpenApiSpec;
  };
  
  app.use('/api/docs', swaggerUi.serve, (req, res, next) => {
    swaggerUi.setup(getOpenApiSpec(), {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'ComplianceAI API Documentation',
    })(req, res, next);
  });
  
  app.get('/api/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });
  
  // Endpoint to force refresh the OpenAPI spec
  app.post('/api/openapi/refresh', (_req, res) => {
    cachedOpenApiSpec = generateOpenAPIDocument();
    lastSpecGeneration = new Date();
    res.json({ 
      success: true, 
      message: 'OpenAPI specification refreshed',
      generatedAt: lastSpecGeneration.toISOString()
    });
  });
  
  // Get spec metadata
  app.get('/api/openapi/status', (_req, res) => {
    res.json({
      lastGenerated: lastSpecGeneration.toISOString(),
      endpointCount: Object.keys(cachedOpenApiSpec.paths || {}).length,
      version: cachedOpenApiSpec.info?.version || '1.0.0'
    });
  });

  // ===== AUTHENTICATION ENDPOINTS =====
  // Legacy login/logout/me endpoints removed - now handled by BetterAuth
  // BetterAuth handles: /api/auth/sign-in/email, /api/auth/sign-out, /api/auth/session
  
  // Change password endpoint with role-based restrictions
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword, requestingUserId } = req.body;
      
      if (!userId || !newPassword || !requestingUserId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Get the user whose password is being changed
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get the requesting user
      const [requestingUser] = await db.select().from(users).where(eq(users.id, requestingUserId));
      if (!requestingUser) {
        return res.status(404).json({ error: "Requesting user not found" });
      }
      
      // LASHAN_SUPER_USER password can only be changed by themselves
      if (targetUser.role === 'LASHAN_SUPER_USER') {
        if (requestingUser.id !== targetUser.id) {
          return res.status(403).json({ error: "Only Lashan can change this password" });
        }
      }
      
      // Verify current password if changing own password
      if (userId === requestingUserId) {
        if (!currentPassword) {
          return res.status(401).json({ error: "Current password is required" });
        }
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, targetUser.password);
        if (!isCurrentPasswordValid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }
      
      // Validate new password against policy
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet security requirements",
          requirements: passwordValidation.errors
        });
      }
      
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
  
  // Password policy endpoint
  app.get("/api/auth/password-policy", (req, res) => {
    res.json({
      requirements: getPasswordPolicyDescription(),
    });
  });
  
  // Modern authentication handler (session management, OAuth providers)
  // Handles: /api/auth/session, /api/auth/sign-in/*, /api/auth/sign-up/*, /api/auth/sign-out, /api/auth/callback/*
  app.all("/api/auth/*", toNodeHandler(auth));
  
  // Hard-coded organisation ID for demo (in production this would come from auth)
  const ORG_ID = "default-org";
  
  // Comprehensive health check endpoint
  app.get("/api/health", async (req, res) => {
    const checks: Record<string, { status: string; latency?: number; details?: any }> = {};
    const startTime = Date.now();
    
    // Database check
    try {
      const dbStart = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'unhealthy', details: 'Database connection failed' };
    }
    
    // Job queue check
    try {
      const queueStats = await getQueueStats();
      checks.jobQueue = { 
        status: 'healthy', 
        details: { 
          ingestion: queueStats.ingestion,
          webhook: queueStats.webhook
        }
      };
    } catch (error) {
      checks.jobQueue = { status: 'unknown', details: 'Could not retrieve queue stats' };
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
      details: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      }
    };
    
    // Uptime
    checks.uptime = {
      status: 'healthy',
      details: { seconds: Math.floor(process.uptime()) }
    };
    
    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
    const hasWarnings = Object.values(checks).some(c => c.status === 'warning');
    
    res.status(allHealthy || hasWarnings ? 200 : 503).json({ 
      status: allHealthy ? 'healthy' : (hasWarnings ? 'degraded' : 'unhealthy'),
      timestamp: new Date().toISOString(),
      totalLatency: Date.now() - startTime,
      checks
    });
  });
  
  // Version endpoint - returns app version and release info
  app.get("/api/version", async (req, res) => {
    try {
      const { APP_VERSION, APP_NAME, RELEASE_NOTES } = await import("@shared/version");
      const currentRelease = RELEASE_NOTES[APP_VERSION];
      
      res.json({
        version: APP_VERSION,
        name: APP_NAME,
        environment: process.env.NODE_ENV || "development",
        buildTime: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        release: currentRelease ? {
          date: currentRelease.date,
          highlights: currentRelease.highlights,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching version info:", error);
      res.status(500).json({ error: "Failed to fetch version info" });
    }
  });
  
  // Release notes endpoint - returns full release history
  app.get("/api/version/releases", async (req, res) => {
    try {
      const { RELEASE_NOTES } = await import("@shared/version");
      res.json(RELEASE_NOTES);
    } catch (error) {
      console.error("Error fetching release notes:", error);
      res.status(500).json({ error: "Failed to fetch release notes" });
    }
  });

  // API versioning info endpoint
  app.get("/api/version/api-info", (req, res) => {
    res.json({
      currentVersion: "v1",
      supportedVersions: ["v1"],
      deprecatedVersions: [],
      versioningStrategy: "URL path",
      endpoints: {
        versioned: "/api/v1/*",
        legacy: "/api/* (deprecated, will be removed in v2)",
      },
      documentation: "/api/docs",
      migrationGuide: "Update API calls to use /api/v1/ prefix for future compatibility",
    });
  });

  // ===== BRANDING/ASSETS ENDPOINTS =====
  const DEFAULT_BRANDING = {
    appName: 'SocialComply',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    accentColor: '#60a5fa',
    fontFamily: 'Inter',
    metaTitle: 'SocialComply - Compliance Management',
    metaDescription: 'UK Social Housing Compliance Management Platform',
    footerText: 'SocialComply - Keeping Homes Safe',
  };

  app.get("/api/branding", async (req, res) => {
    try {
      const orgId = req.query.org as string || 'default';
      
      try {
        const [branding] = await db
          .select()
          .from(organizationBranding)
          .where(eq(organizationBranding.organisationId, orgId))
          .limit(1);
        
        if (!branding) {
          const [defaultBranding] = await db
            .select()
            .from(organizationBranding)
            .where(eq(organizationBranding.organisationId, 'default'))
            .limit(1);
          
          if (defaultBranding) {
            return res.json(defaultBranding);
          }
          
          return res.json(DEFAULT_BRANDING);
        }
        
        res.json(branding);
      } catch (dbError: any) {
        if (dbError?.message?.includes('does not exist') || dbError?.code === '42P01') {
          return res.json(DEFAULT_BRANDING);
        }
        throw dbError;
      }
    } catch (error) {
      console.error("Error fetching branding:", error);
      res.json(DEFAULT_BRANDING);
    }
  });

  app.get("/api/assets/config", async (req, res) => {
    try {
      const config = {
        assetsBaseUrl: process.env.ASSETS_BASE_URL || '/assets',
        objectStorageConfigured: !!(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID),
        mapTiles: {
          light: process.env.VITE_TILE_SOURCE_LIGHT || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          dark: process.env.VITE_TILE_SOURCE_DARK || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          selfHosted: !!process.env.VITE_TILE_SOURCE_SELF_HOSTED,
        },
        markers: {
          baseUrl: '/assets/leaflet',
        },
      };
      res.json(config);
    } catch (error) {
      console.error("Error fetching assets config:", error);
      res.status(500).json({ error: "Failed to fetch assets configuration" });
    }
  });
  
  // ===== AI ASSISTANT ROUTES REMOVED =====
  // AI Assistant Chat, Analytics, and Knowledge Document Management routes
  // have been extracted to server/routes/assistant.routes.ts
  // Mounted above via: app.use('/api', assistantRouter)
  
  // ===== SEARCH AND ASSET HEALTH ROUTES REMOVED =====
  // Global Search (PostgreSQL Full-Text Search), SSE Events for Real-Time Updates,
  // Asset Health Summary, Asset Health Blocks by Scheme, and Asset Health Properties by Block
  // have been extracted to server/routes/search.routes.ts
  // Mounted above via: app.use('/api', searchRouter)

  // ===============================================================================
  // DEPRECATED: Routes below are now handled by modular routers mounted above.
  // These legacy routes remain for backwards compatibility but will be removed.
  // New routes mounted: propertiesRouter, certificatesRouter, contractorsRouter, remedialRouter
  // ===============================================================================

  // ===== SCHEMES ===== [DEPRECATED - see propertiesRouter]
  app.get("/api/schemes", async (req, res) => {
    try {
      const schemes = await storage.listSchemes(ORG_ID);
      res.json(schemes);
    } catch (error) {
      console.error("Error fetching schemes:", error);
      res.status(500).json({ error: "Failed to fetch schemes" });
    }
  });
  
  app.post("/api/schemes", async (req, res) => {
    try {
      const data = insertSchemeSchema.parse({ ...req.body, organisationId: ORG_ID });
      const scheme = await storage.createScheme(data);
      res.status(201).json(scheme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating scheme:", error);
        res.status(500).json({ error: "Failed to create scheme" });
      }
    }
  });
  
  // ===== BLOCKS =====
  app.get("/api/blocks", async (req, res) => {
    try {
      const schemeId = req.query.schemeId as string | undefined;
      const blocks = await storage.listBlocks(schemeId);
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching blocks:", error);
      res.status(500).json({ error: "Failed to fetch blocks" });
    }
  });
  
  app.post("/api/blocks", async (req, res) => {
    try {
      const data = insertBlockSchema.parse(req.body);
      const block = await storage.createBlock(data);
      res.status(201).json(block);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating block:", error);
        res.status(500).json({ error: "Failed to create block" });
      }
    }
  });

  app.patch("/api/blocks/:id", async (req, res) => {
    try {
      const block = await storage.updateBlock(req.params.id, req.body);
      if (!block) {
        return res.status(404).json({ error: "Block not found" });
      }
      res.json(block);
    } catch (error) {
      console.error("Error updating block:", error);
      res.status(500).json({ error: "Failed to update block" });
    }
  });

  app.delete("/api/blocks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBlock(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Block not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting block:", error);
      res.status(500).json({ error: "Failed to delete block" });
    }
  });

  // ===== HIERARCHY STATS =====
  app.get("/api/hierarchy/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getHierarchyStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching hierarchy stats:", error);
      res.status(500).json({ error: "Failed to fetch hierarchy stats" });
    }
  });

  // ===== ORGANISATIONS =====
  app.get("/api/organisations", async (req, res) => {
    try {
      const orgs = await storage.listOrganisations();
      res.json(orgs);
    } catch (error) {
      console.error("Error fetching organisations:", error);
      res.status(500).json({ error: "Failed to fetch organisations" });
    }
  });

  app.get("/api/organisations/:id", async (req, res) => {
    try {
      const org = await storage.getOrganisation(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organisation not found" });
      }
      res.json(org);
    } catch (error) {
      console.error("Error fetching organisation:", error);
      res.status(500).json({ error: "Failed to fetch organisation" });
    }
  });

  app.post("/api/organisations", async (req, res) => {
    try {
      const data = insertOrganisationSchema.parse(req.body);
      const org = await storage.createOrganisation(data);
      res.status(201).json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating organisation:", error);
        res.status(500).json({ error: "Failed to create organisation" });
      }
    }
  });

  app.patch("/api/organisations/:id", async (req, res) => {
    try {
      const org = await storage.updateOrganisation(req.params.id, req.body);
      if (!org) {
        return res.status(404).json({ error: "Organisation not found" });
      }
      res.json(org);
    } catch (error) {
      console.error("Error updating organisation:", error);
      res.status(500).json({ error: "Failed to update organisation" });
    }
  });

  app.delete("/api/organisations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteOrganisation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Organisation not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting organisation:", error);
      res.status(500).json({ error: "Failed to delete organisation" });
    }
  });

  // ===== SCHEME UPDATES =====
  app.patch("/api/schemes/:id", async (req, res) => {
    try {
      const scheme = await storage.updateScheme(req.params.id, req.body);
      if (!scheme) {
        return res.status(404).json({ error: "Scheme not found" });
      }
      res.json(scheme);
    } catch (error) {
      console.error("Error updating scheme:", error);
      res.status(500).json({ error: "Failed to update scheme" });
    }
  });

  app.delete("/api/schemes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteScheme(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Scheme not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheme:", error);
      res.status(500).json({ error: "Failed to delete scheme" });
    }
  });
  
  // ===== API LIMITS CONFIG (for frontend) =====
  app.get("/api/config/limits", async (req, res) => {
    try {
      const config = await getApiLimitsConfig();
      res.json({
        defaultLimit: config.paginationDefaultLimit,
        maxLimit: config.paginationMaxLimit,
        maxPages: config.paginationMaxPages,
        unfilteredMaxRecords: config.paginationUnfilteredMaxRecords,
        requireFilterForLargeData: config.paginationRequireFilterForLargeData,
      });
    } catch (error) {
      console.error("Error fetching API limits config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });
  
  // ===== PROPERTIES =====
  app.get("/api/properties", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset } = pagination;
      const blockId = req.query.blockId as string | undefined;
      const schemeId = req.query.schemeId as string | undefined;
      const search = req.query.search as string | undefined;
      const complianceStatus = req.query.complianceStatus as string | undefined;
      
      // Use DB-level pagination for enterprise scale (no in-memory filtering)
      const { data, total } = await storage.listPropertiesPaginated(ORG_ID, {
        blockId,
        schemeId,
        search,
        complianceStatus,
        limit,
        offset,
      });
      
      // Data already includes block and scheme from JOINs
      const enrichedProperties = data.map(prop => ({
        ...prop,
        fullAddress: `${prop.addressLine1}, ${prop.city || ''}, ${prop.postcode}`,
      }));
      
      res.json({ data: enrichedProperties, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });
  
  // ===== PROPERTY STATS =====
  // Uses materialized view for fast reads at scale
  app.get("/api/properties/stats", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT total_properties, no_gas_safety_cert, unverified, non_compliant, scheme_count
        FROM mv_property_stats
        WHERE organisation_id = ${ORG_ID}
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
        // Fallback to direct query if materialized view is empty
        const stats = await db.select({
          totalProperties: sql<number>`COUNT(*)`,
          noGasSafetyCert: sql<number>`SUM(CASE WHEN ${properties.hasGas} = true AND ${properties.complianceStatus} != 'COMPLIANT' THEN 1 ELSE 0 END)`,
          unverified: sql<number>`SUM(CASE WHEN ${properties.linkStatus} = 'UNVERIFIED' THEN 1 ELSE 0 END)`,
          nonCompliant: sql<number>`SUM(CASE WHEN ${properties.complianceStatus} IN ('NON_COMPLIANT', 'OVERDUE') THEN 1 ELSE 0 END)`,
        })
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
        .where(eq(schemes.organisationId, ORG_ID));
        
        const schemeCount = await db.select({ count: sql<number>`COUNT(DISTINCT ${schemes.id})` })
          .from(schemes)
          .where(eq(schemes.organisationId, ORG_ID));
        
        res.json({
          totalProperties: Number(stats[0]?.totalProperties ?? 0),
          noGasSafetyCert: Number(stats[0]?.noGasSafetyCert ?? 0),
          unverified: Number(stats[0]?.unverified ?? 0),
          nonCompliant: Number(stats[0]?.nonCompliant ?? 0),
          schemeCount: Number(schemeCount[0]?.count ?? 0),
        });
      }
    } catch (error) {
      console.error("Error fetching property stats:", error);
      res.status(500).json({ error: "Failed to fetch property statistics" });
    }
  });
  
  // ===== GEOCODING AND RISK MAPS ROUTES REMOVED =====
  // These routes have been extracted to server/routes/geo.routes.ts
  // Routes moved: PROPERTY GEODATA MANUAL UPDATE, GEOCODING CSV IMPORT,
  // GEOCODING API ENDPOINTS, RISK MAPS API ENDPOINTS
  // Mounted via: app.use('/api', geoRouter)
  
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      // Get related data
      const block = await storage.getBlock(property.blockId);
      const scheme = block ? await storage.getScheme(block.schemeId) : null;
      const certificates = await storage.listCertificates(ORG_ID, { propertyId: property.id });
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId: property.id });
      const componentsList = await storage.listComponents({ propertyId: property.id });
      
      // Enrich components with type info
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
      console.error("Error fetching property:", error);
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });
  
  app.post("/api/properties", async (req, res) => {
    try {
      const data = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(data);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating property:", error);
        res.status(500).json({ error: "Failed to create property" });
      }
    }
  });
  
  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const updates = req.body;
      const property = await storage.updateProperty(req.params.id, updates);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });
  
  // Bulk delete properties
  app.post("/api/properties/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const deleted = await storage.bulkDeleteProperties(ids);
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting properties:", error);
      res.status(500).json({ error: "Failed to delete properties" });
    }
  });
  
  // Single property verify
  app.post("/api/properties/:id/verify", async (req, res) => {
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
      console.error("Error verifying property:", error);
      res.status(500).json({ error: "Failed to verify property" });
    }
  });
  
  // Bulk verify properties
  app.post("/api/properties/bulk-verify", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const verified = await storage.bulkVerifyProperties(ids);
      res.json({ success: true, verified });
    } catch (error) {
      console.error("Error bulk verifying properties:", error);
      res.status(500).json({ error: "Failed to verify properties" });
    }
  });
  
  // Bulk reject properties (delete properties and associated data)
  app.post("/api/properties/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No property IDs provided" });
      }
      const rejected = await storage.bulkRejectProperties(ids);
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting properties:", error);
      res.status(500).json({ error: "Failed to reject properties" });
    }
  });
  
  // Auto-create property from extracted address
  app.post("/api/properties/auto-create", async (req, res) => {
    try {
      const { addressLine1, city, postcode } = req.body;
      if (!addressLine1) {
        return res.status(400).json({ error: "Address is required" });
      }
      const property = await storage.getOrCreateAutoProperty(ORG_ID, { addressLine1, city, postcode });
      res.json(property);
    } catch (error) {
      console.error("Error auto-creating property:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });
  
  // ===== CONTRACTORS & STAFF =====
  app.get("/api/contractors", async (req, res) => {
    try {
      const isInternalParam = req.query.isInternal;
      const isInternal = isInternalParam === 'true' ? true : isInternalParam === 'false' ? false : undefined;
      const contractors = await storage.listContractors(ORG_ID, isInternal);
      res.json(contractors);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });
  
  app.get("/api/contractors/:id", async (req, res) => {
    try {
      const contractor = await storage.getContractor(req.params.id);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ error: "Failed to fetch contractor" });
    }
  });
  
  app.post("/api/contractors", async (req, res) => {
    try {
      const data = insertContractorSchema.parse({ ...req.body, organisationId: ORG_ID });
      const contractor = await storage.createContractor(data);
      res.status(201).json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
    }
  });
  
  app.patch("/api/contractors/:id", async (req, res) => {
    try {
      const updateData = insertContractorSchema.partial().parse(req.body);
      const contractor = await storage.updateContractor(req.params.id, updateData);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contractor:", error);
      res.status(500).json({ error: "Failed to update contractor" });
    }
  });
  
  app.post("/api/contractors/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const contractor = await storage.updateContractorStatus(req.params.id, status);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      console.error("Error updating contractor status:", error);
      res.status(500).json({ error: "Failed to update contractor status" });
    }
  });
  
  app.post("/api/contractors/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No contractor IDs provided" });
      }
      const approved = await storage.bulkApproveContractors(ids);
      res.json({ success: true, approved });
    } catch (error) {
      console.error("Error bulk approving contractors:", error);
      res.status(500).json({ error: "Failed to approve contractors" });
    }
  });
  
  app.post("/api/contractors/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No contractor IDs provided" });
      }
      const rejected = await storage.bulkRejectContractors(ids);
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting contractors:", error);
      res.status(500).json({ error: "Failed to reject contractors" });
    }
  });
  
  // ===== STAFF AND CONTRACTOR ROUTES REMOVED =====
  // Staff Members, Contractor Certifications, Contractor Verification History,
  // Contractor Alerts, Contractor Assignments, Contractor SLA Profiles,
  // Contractor Job Performance, and Contractor Ratings routes have been
  // extracted to server/routes/staff.routes.ts
  // Mounted above via: app.use('/api', staffRouter)
  
  // ===== GOLDEN THREAD ROUTES REMOVED =====
  // Certificate Versions, Audit Trail, UKHDS Export, Compliance Calendar Events, and Certificate Expiry Alerts
  // have been extracted to server/routes/golden-thread.routes.ts
  // Mounted above via: app.use('/api', goldenThreadRouter)
  
  // ===== CERTIFICATES =====
  // Stats endpoint for filtered certificate stats
  app.get("/api/certificates/stats", async (req, res) => {
    try {
      const typesParam = req.query.types as string | undefined;
      const typesList = typesParam ? typesParam.split(',').filter(Boolean) : null;
      
      // Build WHERE clause for types filter
      let typeCondition = sql`1=1`;
      if (typesList && typesList.length > 0) {
        const typesArrayLiteral = `{${typesList.join(',')}}`;
        typeCondition = sql`${certificates.certificateType}::text = ANY(${typesArrayLiteral}::text[])`;
      }
      
      const [certStats] = await db.select({
        expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
        expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
        pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
      })
      .from(certificates)
      .where(and(eq(certificates.organisationId, ORG_ID), typeCondition));
      
      res.json({
        expired: Number(certStats?.expired || 0),
        expiringSoon: Number(certStats?.expiringSoon || 0),
        pendingReview: Number(certStats?.pendingReview || 0),
        approved: Number(certStats?.approved || 0),
      });
    } catch (error) {
      console.error("Error fetching certificate stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  
  app.get("/api/certificates", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset } = pagination;
      const search = req.query.search as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const typesParam = req.query.types as string | undefined;
      const typesList = typesParam ? typesParam.split(',').filter(Boolean) : undefined;
      const expired = req.query.expired === 'true';
      const expiring = req.query.expiring === 'true';
      
      // Handle special PENDING status - maps to UPLOADED, PROCESSING, NEEDS_REVIEW
      const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
      const isPendingFilter = status === 'PENDING';
      
      // Use DB-level pagination for enterprise scale (no in-memory filtering)
      const { data, total } = await storage.listCertificatesPaginated(ORG_ID, {
        propertyId,
        status: isPendingFilter ? PENDING_STATUSES : status,
        search,
        limit,
        offset,
        types: typesList,
        expired,
        expiring,
      });
      
      // Data already includes property and extraction from JOINs
      const enrichedCertificates = data.map(cert => ({
        ...cert,
        extractedData: cert.extraction?.extractedData,
      }));
      
      // Get certificate stats - if types filter is applied, compute filtered stats
      let stats;
      if (typesList && typesList.length > 0) {
        const [certStats] = await db.select({
          expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
          expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
          pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
          approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
        })
        .from(certificates)
        .where(and(
          eq(certificates.organisationId, ORG_ID),
          sql`${certificates.certificateType}::text = ANY(${`{${typesList.join(',')}}`}::text[])`
        ));
        
        stats = {
          expired: Number(certStats?.expired || 0),
          expiringSoon: Number(certStats?.expiringSoon || 0),
          pendingReview: Number(certStats?.pendingReview || 0),
          approved: Number(certStats?.approved || 0),
        };
      } else {
        // Get certificate stats from materialized view (fast) with fallback to direct query
        const { getCertificateStats } = await import('./reporting/materialized-views');
        stats = await getCertificateStats(ORG_ID);
        
        // Fallback to direct query if materialized view not available
        if (!stats) {
          const [certStats] = await db.select({
            expired: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date < CURRENT_DATE)`,
            expiringSoon: sql<number>`COUNT(*) FILTER (WHERE expiry_date::date >= CURRENT_DATE AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days')`,
            pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'NEEDS_REVIEW')`,
            approved: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED')`,
          })
          .from(certificates)
          .where(eq(certificates.organisationId, ORG_ID));
          
          stats = {
            expired: Number(certStats?.expired || 0),
            expiringSoon: Number(certStats?.expiringSoon || 0),
            pendingReview: Number(certStats?.pendingReview || 0),
            approved: Number(certStats?.approved || 0),
          };
        }
      }
      
      res.json({ data: enrichedCertificates, total, page, limit, totalPages: Math.ceil(total / limit), stats });
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  // Cursor-based pagination endpoint - more efficient for large datasets (no COUNT query)
  app.get("/api/certificates/cursor", async (req, res) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const search = req.query.search as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      
      const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
      const isPendingFilter = status === 'PENDING';
      
      const result = await storage.listCertificatesCursor(ORG_ID, {
        propertyId,
        status: isPendingFilter ? PENDING_STATUSES : status,
        search,
        limit,
        cursor,
      });
      
      const enrichedCertificates = result.data.map(cert => ({
        ...cert,
        extractedData: cert.extraction?.extractedData,
      }));
      
      res.json({
        data: enrichedCertificates,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        limit,
      });
    } catch (error) {
      console.error("Error fetching certificates (cursor):", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });
  
  app.get("/api/certificates/:id", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      const property = await storage.getProperty(certificate.propertyId);
      const extraction = await storage.getExtractionByCertificate(certificate.id);
      const actions = await storage.listRemedialActions(ORG_ID, { certificateId: certificate.id });
      
      res.json({
        ...certificate,
        property,
        extraction,
        extractedData: extraction?.extractedData,
        actions,
      });
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });
  
  app.post("/api/certificates", async (req, res) => {
    try {
      const { fileBase64, mimeType, batchId, ...certificateData } = req.body;
      
      // Create batch for manual uploads if not provided
      let finalBatchId = batchId;
      if (!batchId) {
        const now = new Date();
        const batchName = `Manual Upload - ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        const batch = await storage.createIngestionBatch({
          organisationId: ORG_ID,
          name: batchName,
          totalFiles: 1,
          completedFiles: 0,
          failedFiles: 0,
          status: 'PROCESSING',
        });
        finalBatchId = batch.id;
      }
      
      const data = insertCertificateSchema.parse({
        ...certificateData,
        organisationId: ORG_ID,
        status: "PROCESSING",
        batchId: finalBatchId,
      });
      
      const certificate = await storage.createCertificate(data);
      
      (async () => {
        try {
          let pdfBuffer: Buffer | undefined;
          
          if (certificate.fileType === 'application/pdf' && certificate.storageKey) {
            try {
              const file = await objectStorageService.getObjectEntityFile(certificate.storageKey);
              const chunks: Buffer[] = [];
              const stream = file.createReadStream();
              
              await new Promise<void>((resolve, reject) => {
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('end', () => resolve());
                stream.on('error', reject);
              });
              
              pdfBuffer = Buffer.concat(chunks);
              console.log(`Downloaded PDF from storage: ${pdfBuffer.length} bytes`);
            } catch (downloadErr) {
              console.error("Failed to download PDF from storage:", downloadErr);
            }
          }
          
          await processExtractionAndSave(
            certificate.id, 
            certificate.certificateType,
            fileBase64,
            mimeType,
            pdfBuffer
          );
          
          // Update batch progress on success and check if batch is complete
          if (data.batchId) {
            await db.update(ingestionBatches)
              .set({ 
                completedFiles: sql`${ingestionBatches.completedFiles} + 1`,
                status: 'PROCESSING'
              })
              .where(eq(ingestionBatches.id, data.batchId));
            
            // Fetch fresh batch data to check completion
            const [freshBatch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, data.batchId));
            
            // Mark batch as COMPLETED when all files are processed
            if (freshBatch && freshBatch.completedFiles + freshBatch.failedFiles >= freshBatch.totalFiles) {
              await db.update(ingestionBatches)
                .set({ status: freshBatch.failedFiles > 0 ? 'PARTIAL' : 'COMPLETED', updatedAt: new Date() })
                .where(eq(ingestionBatches.id, data.batchId));
            }
          }
        } catch (err) {
          console.error("Error in AI extraction:", err);
          
          // Update batch progress on failure and check if batch is complete
          if (data.batchId) {
            await db.update(ingestionBatches)
              .set({ 
                failedFiles: sql`${ingestionBatches.failedFiles} + 1`,
                status: 'PROCESSING'
              })
              .where(eq(ingestionBatches.id, data.batchId));
            
            // Fetch fresh batch data to check completion
            const [freshBatch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, data.batchId));
            
            // Mark batch as FAILED or PARTIAL when all files are processed
            if (freshBatch && freshBatch.completedFiles + freshBatch.failedFiles >= freshBatch.totalFiles) {
              const finalStatus = freshBatch.completedFiles === 0 ? 'FAILED' : 'PARTIAL';
              await db.update(ingestionBatches)
                .set({ status: finalStatus, updatedAt: new Date() })
                .where(eq(ingestionBatches.id, data.batchId));
            }
          }
        }
      })();
      
      res.status(201).json(certificate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating certificate:", error);
        res.status(500).json({ error: "Failed to create certificate" });
      }
    }
  });
  
  app.patch("/api/certificates/:id", async (req, res) => {
    try {
      const updates = req.body;
      const beforeCert = await storage.getCertificate(req.params.id);
      if (!beforeCert) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      const certificate = await storage.updateCertificate(req.params.id, updates);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      // Determine event type based on status change
      let eventType: 'CERTIFICATE_STATUS_CHANGED' | 'CERTIFICATE_APPROVED' | 'CERTIFICATE_REJECTED' = 'CERTIFICATE_STATUS_CHANGED';
      let message = `Certificate updated`;
      
      if (updates.status === 'APPROVED' && beforeCert.status !== 'APPROVED') {
        eventType = 'CERTIFICATE_APPROVED';
        message = `Certificate ${certificate.certificateType} approved`;
      } else if (updates.status === 'REJECTED' && beforeCert.status !== 'REJECTED') {
        eventType = 'CERTIFICATE_REJECTED';
        message = `Certificate ${certificate.certificateType} rejected`;
      } else if (updates.status && updates.status !== beforeCert.status) {
        message = `Certificate status changed from ${beforeCert.status} to ${updates.status}`;
      }
      
      // Record audit event
      await recordAudit({
        organisationId: certificate.organisationId,
        eventType,
        entityType: 'CERTIFICATE',
        entityId: certificate.id,
        entityName: certificate.fileName,
        propertyId: certificate.propertyId,
        certificateId: certificate.id,
        beforeState: beforeCert,
        afterState: certificate,
        changes: getChanges(beforeCert, certificate),
        message,
        context: extractAuditContext(req),
      });
      
      res.json(certificate);
    } catch (error) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });

  app.get("/api/certificates/:id/extraction-audit", async (req, res) => {
    try {
      const { getTierAuditForCertificate } = await import('./services/extraction/orchestrator');
      const audits = await getTierAuditForCertificate(req.params.id);
      res.json({
        certificateId: req.params.id,
        tierProgression: audits,
        totalTiers: audits.length,
        finalTier: audits.length > 0 ? audits[audits.length - 1].tier : null,
        totalCost: audits.reduce((sum, a) => sum + (a.cost || 0), 0),
        totalProcessingTimeMs: audits.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching extraction audit:", error);
      res.status(500).json({ error: "Failed to fetch extraction audit" });
    }
  });
  
  // Reprocess a failed certificate
  app.post("/api/certificates/:id/reprocess", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      // Verify certificate belongs to current organisation
      if (certificate.organisationId !== ORG_ID) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Only allow reprocessing of failed or needs_review certificates
      if (certificate.status !== 'FAILED' && certificate.status !== 'REJECTED' && certificate.status !== 'NEEDS_REVIEW') {
        return res.status(400).json({ error: "Only failed, rejected, or needs review certificates can be reprocessed" });
      }
      
      // Verify file is retrievable BEFORE changing status
      let fileBuffer: Buffer | undefined;
      
      if (certificate.storageKey) {
        try {
          const file = await objectStorageService.getObjectEntityFile(certificate.storageKey);
          if (file) {
            const chunks: Buffer[] = [];
            const stream = file.createReadStream();
            
            await new Promise<void>((resolve, reject) => {
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', () => resolve());
              stream.on('error', reject);
            });
            
            fileBuffer = Buffer.concat(chunks);
          }
        } catch (error) {
          console.error("Error retrieving file for reprocessing:", error);
        }
      }
      
      if (!fileBuffer) {
        return res.status(400).json({ error: "Could not retrieve file for reprocessing" });
      }
      
      // Now safe to change status - file is verified
      await storage.updateCertificate(certificate.id, { status: 'PROCESSING' });
      
      // Trigger extraction asynchronously (orchestrator handles tier audit records)
      (async () => {
        try {
          const { extractCertificate } = await import('./services/extraction/orchestrator');
          const result = await extractCertificate(
            String(certificate.id),
            fileBuffer!,
            certificate.fileType || 'application/pdf',
            certificate.fileName || 'document.pdf',
            { forceAI: true }
          );
          
          if (result.success) {
            // Always go to NEEDS_REVIEW for human verification, consistent with main extraction flow
            await storage.updateCertificate(certificate.id, {
              status: 'NEEDS_REVIEW',
              statusMessage: `Reprocessed with ${result.finalTier} (confidence: ${(result.confidence * 100).toFixed(1)}%)`,
            });
          } else {
            await storage.updateCertificate(certificate.id, { 
              status: 'FAILED', 
              statusMessage: 'Reprocessing failed - extraction unsuccessful' 
            });
          }
        } catch (error) {
          console.error("Error during certificate reprocessing:", error);
          await storage.updateCertificate(certificate.id, { 
            status: 'FAILED', 
            statusMessage: `Reprocessing error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      })();
      
      res.json({ 
        success: true, 
        message: "Certificate reprocessing started", 
        certificateId: certificate.id
      });
    } catch (error) {
      console.error("Error reprocessing certificate:", error);
      res.status(500).json({ error: "Failed to start certificate reprocessing" });
    }
  });
  
  // ===== REMEDIAL ACTIONS =====
  
  // Lightweight stats-only endpoint for hero stats (no data fetching)
  app.get("/api/actions/stats", async (req, res) => {
    try {
      // Get remedial action stats from materialized view (fast) with fallback to direct query
      const { getRemedialStats } = await import('./reporting/materialized-views');
      let stats = await getRemedialStats(ORG_ID);
      
      // Fallback to direct query if materialized view not available
      if (!stats) {
        const [actionStats] = await db.select({
          totalOpen: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND due_date::date < CURRENT_DATE)`,
          immediate: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND severity = 'IMMEDIATE')`,
          inProgress: sql<number>`COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')`,
          completed: sql<number>`COUNT(*) FILTER (WHERE status = 'COMPLETED')`,
        })
        .from(remedialActions);
        
        stats = {
          totalOpen: Number(actionStats?.totalOpen || 0),
          overdue: Number(actionStats?.overdue || 0),
          immediate: Number(actionStats?.immediate || 0),
          inProgress: Number(actionStats?.inProgress || 0),
          completed: Number(actionStats?.completed || 0),
        };
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching action stats:", error);
      res.status(500).json({ error: "Failed to fetch action stats" });
    }
  });
  
  app.get("/api/actions", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset } = pagination;
      const search = req.query.search as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const overdue = req.query.overdue === 'true';
      const awaabs = req.query.awaabs === 'true';
      const phase = req.query.phase ? parseInt(req.query.phase as string, 10) : undefined;
      const certificateType = req.query.certificateType as string | undefined;
      const excludeCompleted = req.query.excludeCompleted === 'true';
      
      // Use database-level pagination for efficiency
      const { items: paginatedActions, total } = await storage.listRemedialActionsPaginated(ORG_ID, {
        limit,
        offset,
        status,
        severity,
        search,
        overdue,
        propertyId,
        awaabs,
        phase,
        certificateType,
        excludeCompleted,
      });
      
      // Pre-fetch all schemes and blocks for efficiency
      const schemes = await storage.listSchemes(ORG_ID);
      const blocks = await storage.listBlocks(ORG_ID);
      const schemeMap = new Map(schemes.map(s => [s.id, s.name]));
      const blockMap = new Map(blocks.map(b => [b.id, { name: b.name, schemeId: b.schemeId }]));
      
      // Enrich with property, certificate, scheme, and block data
      const enrichedActions = await Promise.all(paginatedActions.map(async (action) => {
        const property = await storage.getProperty(action.propertyId);
        const certificate = await storage.getCertificate(action.certificateId);
        
        let schemeName = '';
        let blockName = '';
        
        if (property?.blockId) {
          const blockInfo = blockMap.get(property.blockId);
          if (blockInfo) {
            blockName = blockInfo.name;
            schemeName = schemeMap.get(blockInfo.schemeId) || '';
          }
        }
        
        return {
          ...action,
          property: property ? {
            ...property,
            schemeName,
            blockName,
          } : undefined,
          certificate,
          schemeName,
          blockName,
          propertyAddress: property?.addressLine1 || 'Unknown Property',
        };
      }));
      
      // Get remedial action stats from materialized view (fast) with fallback to direct query
      const { getRemedialStats } = await import('./reporting/materialized-views');
      let stats = await getRemedialStats(ORG_ID);
      
      // Fallback to direct query if materialized view not available
      if (!stats) {
        const [actionStats] = await db.select({
          totalOpen: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND due_date::date < CURRENT_DATE)`,
          immediate: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND severity = 'IMMEDIATE')`,
          inProgress: sql<number>`COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')`,
          completed: sql<number>`COUNT(*) FILTER (WHERE status = 'COMPLETED')`,
        })
        .from(remedialActions);
        
        stats = {
          totalOpen: Number(actionStats?.totalOpen || 0),
          overdue: Number(actionStats?.overdue || 0),
          immediate: Number(actionStats?.immediate || 0),
          inProgress: Number(actionStats?.inProgress || 0),
          completed: Number(actionStats?.completed || 0),
        };
      }
      
      res.json({ data: enrichedActions, total, page, limit, totalPages: Math.ceil(total / limit), stats });
    } catch (error) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });
  
  app.patch("/api/actions/:id", async (req, res) => {
    try {
      const updates = req.body;
      const beforeAction = await storage.getRemedialAction(req.params.id);
      if (!beforeAction) {
        return res.status(404).json({ error: "Action not found" });
      }
      
      // Normalize status to uppercase enum values (OPEN, IN_PROGRESS, SCHEDULED, COMPLETED, CANCELLED)
      if (updates.status) {
        const statusMap: Record<string, string> = {
          'open': 'OPEN',
          'in_progress': 'IN_PROGRESS',
          'in-progress': 'IN_PROGRESS',
          'scheduled': 'SCHEDULED',
          'completed': 'COMPLETED',
          'cancelled': 'CANCELLED',
          'canceled': 'CANCELLED',
        };
        updates.status = statusMap[updates.status.toLowerCase()] || updates.status.toUpperCase();
      }
      
      // Set resolvedAt when marking as completed
      if (updates.status === 'COMPLETED') {
        updates.resolvedAt = new Date().toISOString();
      }
      
      const action = await storage.updateRemedialAction(req.params.id, updates);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      
      const eventType = updates.status === 'COMPLETED' ? 'action.completed' : 'action.updated';
      enqueueWebhookEvent(eventType, 'remedialAction', action.id, {
        id: action.id,
        propertyId: action.propertyId,
        code: action.code,
        description: action.description,
        severity: action.severity,
        status: action.status,
        dueDate: action.dueDate
      });
      
      // Record audit event
      const auditEventType = updates.status === 'COMPLETED' ? 'REMEDIAL_ACTION_COMPLETED' : 'REMEDIAL_ACTION_UPDATED';
      await recordAudit({
        organisationId: action.organisationId,
        eventType: auditEventType,
        entityType: 'REMEDIAL_ACTION',
        entityId: action.id,
        entityName: action.description,
        propertyId: action.propertyId,
        certificateId: action.certificateId,
        beforeState: beforeAction,
        afterState: action,
        changes: getChanges(beforeAction, action),
        message: updates.status === 'COMPLETED' 
          ? `Remedial action "${action.code}" marked complete`
          : `Remedial action "${action.code}" updated`,
        context: extractAuditContext(req),
      });
      
      res.json(action);
    } catch (error) {
      console.error("Error updating action:", error);
      res.status(500).json({ error: "Failed to update action" });
    }
  });
  
  // Role definitions used by multiple routes
  const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
  const ADMIN_AND_ABOVE_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER'];
  
  // ===== REMOVED: Admin routes now in adminRouter =====
  // Demo data management, bulk seeding, database optimization, user management, and user favorites
  // are now handled by adminRouter mounted at /api/admin
  // Note: Routes for /api/users and /api/user/favorites are now at /api/admin/users and /api/admin/user/favorites

  // ===== REMOVED: Model Insights routes now in mlRouter =====
  
  // ===== REMOVED: Extraction routes now in extractionRouter =====
  // Extraction runs, ingestion batches, compliance rules, and normalisation rules
  // are now handled by extractionRouter mounted at /api
  
  // ===== REMOVED: Dashboard stats, analytics hierarchy, and board report routes now in analyticsRouter =====
  // Dashboard stats (optimized for speed with caching), analytics hierarchy API (treemap, drill-down),
  // and board report stats are now handled by analyticsRouter mounted at /api
  // Routes: /api/dashboard/stats, /api/analytics/hierarchy, /api/analytics/treemap, /api/board-report/stats
  // ~820 lines removed - see server/routes/analytics.routes.ts for implementation
  // ===== CONFIGURATION - COMPLIANCE STREAMS =====
  // Config modification routes require admin roles
  const CONFIG_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
  
  app.get("/api/config/compliance-streams", async (req, res) => {
    try {
      const streams = await storage.listComplianceStreams();
      res.json(streams);
    } catch (error) {
      console.error("Error fetching compliance streams:", error);
      res.status(500).json({ error: "Failed to fetch compliance streams" });
    }
  });
  
  app.get("/api/config/compliance-streams/:id", async (req, res) => {
    try {
      const stream = await storage.getComplianceStream(req.params.id);
      if (!stream) {
        return res.status(404).json({ error: "Compliance stream not found" });
      }
      res.json(stream);
    } catch (error) {
      console.error("Error fetching compliance stream:", error);
      res.status(500).json({ error: "Failed to fetch compliance stream" });
    }
  });
  
  app.post("/api/config/compliance-streams", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertComplianceStreamSchema.parse(req.body);
      const stream = await storage.createComplianceStream(data);
      res.status(201).json(stream);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating compliance stream:", error);
        res.status(500).json({ error: "Failed to create compliance stream" });
      }
    }
  });
  
  app.patch("/api/config/compliance-streams/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      // Check if stream is a system stream
      const existingStream = await storage.getComplianceStream(req.params.id);
      if (!existingStream) {
        return res.status(404).json({ error: "Compliance stream not found" });
      }
      
      // For system streams, only allow toggling isActive
      const updateData = insertComplianceStreamSchema.partial().parse(req.body);
      if (existingStream.isSystem) {
        const allowedUpdates: any = {};
        if (updateData.isActive !== undefined) {
          allowedUpdates.isActive = updateData.isActive;
        }
        if (Object.keys(allowedUpdates).length === 0) {
          return res.status(403).json({ error: "Cannot modify system stream properties other than isActive" });
        }
        const updated = await storage.updateComplianceStream(req.params.id, allowedUpdates);
        return res.json(updated);
      }
      
      // Never allow changing isSystem field on any stream
      const { isSystem: _, ...safeUpdateData } = updateData as any;
      const updated = await storage.updateComplianceStream(req.params.id, safeUpdateData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating compliance stream:", error);
        res.status(500).json({ error: "Failed to update compliance stream" });
      }
    }
  });
  
  app.delete("/api/config/compliance-streams/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      // Check if stream is a system stream
      const existingStream = await storage.getComplianceStream(req.params.id);
      if (!existingStream) {
        return res.status(404).json({ error: "Compliance stream not found" });
      }
      
      if (existingStream.isSystem) {
        return res.status(403).json({ error: "Cannot delete system streams. Use isActive to disable." });
      }
      
      const deleted = await storage.deleteComplianceStream(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Compliance stream not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance stream:", error);
      res.status(500).json({ error: "Failed to delete compliance stream" });
    }
  });
  
  // ===== CONFIGURATION - CERTIFICATE TYPES =====
  app.get("/api/config/certificate-types", async (req, res) => {
    try {
      const types = await storage.listCertificateTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching certificate types:", error);
      res.status(500).json({ error: "Failed to fetch certificate types" });
    }
  });
  
  app.get("/api/config/certificate-types/:id", async (req, res) => {
    try {
      const certType = await storage.getCertificateType(req.params.id);
      if (!certType) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json(certType);
    } catch (error) {
      console.error("Error fetching certificate type:", error);
      res.status(500).json({ error: "Failed to fetch certificate type" });
    }
  });
  
  app.post("/api/config/certificate-types", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertCertificateTypeSchema.parse(req.body);
      const certType = await storage.createCertificateType(data);
      res.status(201).json(certType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating certificate type:", error);
        res.status(500).json({ error: "Failed to create certificate type" });
      }
    }
  });
  
  app.patch("/api/config/certificate-types/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertCertificateTypeSchema.partial().parse(req.body);
      const updated = await storage.updateCertificateType(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating certificate type:", error);
        res.status(500).json({ error: "Failed to update certificate type" });
      }
    }
  });
  
  app.delete("/api/config/certificate-types/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteCertificateType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Certificate type not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting certificate type:", error);
      res.status(500).json({ error: "Failed to delete certificate type" });
    }
  });
  
  // ===== REMOVED: Classification codes routes now in configRouter =====
  
  // ===== REMOVED: Detection patterns routes now in configRouter =====
  
  // ===== REMOVED: Outcome rules routes now in configRouter =====
  // ===== REMOVED: Extraction schemas routes now in configRouter =====
  
  // ===== CONFIGURATION - COMPLIANCE RULES =====
  app.get("/api/config/compliance-rules", async (req, res) => {
    try {
      const complianceStreamId = req.query.complianceStreamId as string | undefined;
      const rules = await storage.listComplianceRules({ complianceStreamId });
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ error: "Failed to fetch compliance rules" });
    }
  });
  
  app.get("/api/config/compliance-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getComplianceRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching compliance rule:", error);
      res.status(500).json({ error: "Failed to fetch compliance rule" });
    }
  });
  
  app.post("/api/config/compliance-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertComplianceRuleSchema.parse(req.body);
      const rule = await storage.createComplianceRule(data);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating compliance rule:", error);
        res.status(500).json({ error: "Failed to create compliance rule" });
      }
    }
  });
  
  app.patch("/api/config/compliance-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertComplianceRuleSchema.partial().parse(req.body);
      const updated = await storage.updateComplianceRule(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating compliance rule:", error);
        res.status(500).json({ error: "Failed to update compliance rule" });
      }
    }
  });
  
  app.delete("/api/config/compliance-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteComplianceRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Compliance rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance rule:", error);
      res.status(500).json({ error: "Failed to delete compliance rule" });
    }
  });
  
  // ===== CONFIGURATION - NORMALISATION RULES =====
  app.get("/api/config/normalisation-rules", async (req, res) => {
    try {
      const complianceStreamId = req.query.complianceStreamId as string | undefined;
      const rules = await storage.listNormalisationRules({ complianceStreamId });
      res.json(rules);
    } catch (error) {
      console.error("Error fetching normalisation rules:", error);
      res.status(500).json({ error: "Failed to fetch normalisation rules" });
    }
  });
  
  app.get("/api/config/normalisation-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getNormalisationRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching normalisation rule:", error);
      res.status(500).json({ error: "Failed to fetch normalisation rule" });
    }
  });
  
  app.post("/api/config/normalisation-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertNormalisationRuleSchema.parse(req.body);
      const rule = await storage.createNormalisationRule(data);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating normalisation rule:", error);
        res.status(500).json({ error: "Failed to create normalisation rule" });
      }
    }
  });
  
  app.patch("/api/config/normalisation-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertNormalisationRuleSchema.partial().parse(req.body);
      const updated = await storage.updateNormalisationRule(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating normalisation rule:", error);
        res.status(500).json({ error: "Failed to update normalisation rule" });
      }
    }
  });
  
  app.delete("/api/config/normalisation-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteNormalisationRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Normalisation rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting normalisation rule:", error);
      res.status(500).json({ error: "Failed to delete normalisation rule" });
    }
  });
  
  // ===== REMOVED: Component types routes now in configRouter =====
  // ===== REMOVED: Spaces routes now in configRouter =====
  
  // ===== REMOVED: Imports routes now in importsRouter =====
  // ===== REMOVED: TSM reports routes now in reportsRouter =====
  
  // ===== REMOVED: API MONITORING & INTEGRATIONS =====
  // ===== REMOVED: INCOMING INTEGRATION ENDPOINTS (HMS) =====
  // ===== REMOVED: VIDEO LIBRARY =====
  // ===== REMOVED: API CLIENTS (for external integrations) =====
  // ===== REMOVED: RATE LIMITING (PostgreSQL-backed) =====
  // ===== REMOVED: API KEY VALIDATION MIDDLEWARE =====
  // ===== REMOVED: INGESTION API (External Certificate Submission) =====
  // All routes extracted to server/routes/integrations.routes.ts
  // Mounted above via: app.use('/api', integrationsRouter)
  
  // ===== FACTORY SETTINGS (Lashan Super User Only) =====
  // Authorization helper for admin endpoints
  // Security note: Uses BetterAuth session-based authentication
  // Requires valid BetterAuth session with admin role for factory settings access
  const requireAdminRole = async (req: Request, res: Response): Promise<boolean> => {
    // Check for admin token first (if configured in environment)
    const adminToken = process.env.ADMIN_API_TOKEN;
    const providedToken = req.headers['x-admin-token'] as string;
    
    // If admin token is configured, require it
    if (adminToken && adminToken !== providedToken) {
      res.status(401).json({ error: "Invalid or missing admin token" });
      return false;
    }
    
    // Use BetterAuth session validation
    const { fromNodeHeaders } = await import('better-auth/node');
    let userId: string | null = null;
    
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      userId = session?.user?.id || null;
    } catch (error) {
      console.error('BetterAuth session error in requireAdminRole:', error);
    }
    
    if (!userId) {
      res.status(401).json({ error: "Session authentication required for admin operations" });
      return false;
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      res.status(401).json({ error: "Invalid user" });
      return false;
    }
    
    const allowedRoles = ['SUPER_ADMIN', 'super_admin', 'LASHAN_SUPER_USER', 'lashan_super_user'];
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: "Access denied. Only Super Admins or Lashan Super Users can access factory settings." });
      return false;
    }
    
    return true;
  };
  
  app.get("/api/admin/factory-settings", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const settings = await storage.listFactorySettings();
      // Group by category
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
  
  app.get("/api/admin/factory-settings/:key", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
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
  
  app.patch("/api/admin/factory-settings/:key", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { value, userId } = req.body;
      
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
        changedById: userId || 'system'
      });
      
      const updated = await storage.updateFactorySetting(req.params.key, value, userId || 'system');
      
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
  
  
  // === API MONITORING, INTEGRATIONS, VIDEO LIBRARY, API CLIENTS ===
  // === RATE LIMITING, API KEY VALIDATION, INGESTION API ===
  // These routes have been extracted to server/routes/integrations.routes.ts
  // and are mounted at /api via integrationsRouter
  
  // Webhook Endpoints (Admin)
  app.get("/api/admin/webhooks", async (req, res) => {
    try {
      const webhooks = await storage.listWebhookEndpoints(ORG_ID);
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });
  
  app.post("/api/admin/webhooks", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { name, url, authType, authValue, headers, events, retryCount, timeoutMs } = req.body;
      
      if (!name || !url || !events || events.length === 0) {
        return res.status(400).json({ error: "Name, URL, and at least one event are required" });
      }
      
      const webhook = await storage.createWebhookEndpoint({
        organisationId: ORG_ID,
        name,
        url,
        authType: authType || 'NONE',
        authValue,
        headers,
        events,
        retryCount: retryCount || 3,
        timeoutMs: timeoutMs || 30000,
      });
      
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });
  
  app.patch("/api/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const webhook = await storage.updateWebhookEndpoint(req.params.id, req.body);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json(webhook);
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ error: "Failed to update webhook" });
    }
  });
  
  app.delete("/api/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteWebhookEndpoint(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });
  
  // Test webhook
  app.post("/api/admin/webhooks/:id/test", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const webhook = await storage.getWebhookEndpoint(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery from ComplianceAI'
        }
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'ComplianceAI',
        ...(webhook.headers as Record<string, string> || {})
      };
      
      if (webhook.authType === 'API_KEY' && webhook.authValue) {
        headers['X-API-Key'] = webhook.authValue;
      } else if (webhook.authType === 'BEARER' && webhook.authValue) {
        headers['Authorization'] = `Bearer ${webhook.authValue}`;
      }
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(webhook.timeoutMs)
        });
        
        const duration = Date.now() - startTime;
        const responseText = await response.text();
        
        res.json({
          success: response.ok,
          status: response.status,
          duration,
          responsePreview: responseText.substring(0, 500)
        });
      } catch (fetchError: any) {
        const duration = Date.now() - startTime;
        res.json({
          success: false,
          status: 0,
          duration,
          error: fetchError.message || 'Connection failed'
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });
  
  // Webhook Deliveries
  app.get("/api/admin/webhook-deliveries", async (req, res) => {
    try {
      const webhookId = req.query.webhookId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const deliveries = await storage.listWebhookDeliveries(webhookId, limit);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      res.status(500).json({ error: "Failed to fetch webhook deliveries" });
    }
  });
  
  // Webhook Events
  app.get("/api/admin/webhook-events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.listWebhookEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching webhook events:", error);
      res.status(500).json({ error: "Failed to fetch webhook events" });
    }
  });
  
  // Incoming Webhook Logs
  app.get("/api/admin/incoming-webhooks", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.listIncomingWebhookLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching incoming webhooks:", error);
      res.status(500).json({ error: "Failed to fetch incoming webhooks" });
    }
  });
  
  // API Keys
  app.get("/api/admin/api-keys", async (req, res) => {
    try {
      const keys = await storage.listApiKeys(ORG_ID);
      res.json(keys.map(k => ({ ...k, keyHash: undefined })));
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });
  
  app.post("/api/admin/api-keys", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { name, scopes, expiresAt } = req.body;
      
      if (!name || !scopes || scopes.length === 0) {
        return res.status(400).json({ error: "Name and at least one scope are required" });
      }
      
      const rawKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyPrefix = rawKey.substring(0, 12);
      const keyHash = await hashApiKey(rawKey);
      
      const apiKey = await storage.createApiKey({
        organisationId: ORG_ID,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      });
      
      res.status(201).json({ 
        ...apiKey, 
        keyHash: undefined,
        key: rawKey
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });
  
  app.delete("/api/admin/api-keys/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteApiKey(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "API key not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });
  
  // ===== INCOMING INTEGRATION ENDPOINTS (HMS) =====
  
  // Receive action updates from Housing Management System
  app.post("/api/integrations/hms/actions", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: req.body.eventType || 'action_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { actionId, status, notes, completedAt, costActual } = req.body;
      
      if (!actionId) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Missing actionId',
          processed: true,
          processedAt: new Date()
        });
        return res.status(400).json({ error: "actionId is required" });
      }
      
      const action = await storage.getRemedialAction(actionId);
      if (!action) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Action not found',
          processed: true,
          processedAt: new Date()
        });
        return res.status(404).json({ error: "Remedial action not found" });
      }
      
      const updates: any = {};
      if (status) updates.status = status;
      if (completedAt) updates.resolvedAt = new Date(completedAt);
      if (costActual) updates.costEstimate = costActual.toString();
      
      await storage.updateRemedialAction(actionId, updates);
      
      await storage.updateIncomingWebhookLog(log.id, { 
        processed: true,
        processedAt: new Date()
      });
      
      res.json({ success: true, actionId, updates });
    } catch (error) {
      console.error("Error processing HMS webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });
  
  // Receive work order confirmations from HMS
  app.post("/api/integrations/hms/work-orders", async (req, res) => {
    try {
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: 'work_order_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { workOrderId, actionId, status, scheduledDate, assignedContractor } = req.body;
      
      if (!actionId) {
        await storage.updateIncomingWebhookLog(log.id, { 
          errorMessage: 'Missing actionId',
          processed: true,
          processedAt: new Date()
        });
        return res.status(400).json({ error: "actionId is required" });
      }
      
      const updates: any = {};
      if (status === 'scheduled' || status === 'in_progress') {
        updates.status = 'IN_PROGRESS';
      } else if (status === 'completed') {
        updates.status = 'COMPLETED';
        updates.resolvedAt = new Date();
      }
      if (scheduledDate) {
        updates.dueDate = scheduledDate;
      }
      
      await storage.updateRemedialAction(actionId, updates);
      
      await storage.updateIncomingWebhookLog(log.id, { 
        processed: true,
        processedAt: new Date()
      });
      
      res.json({ success: true, actionId, workOrderId, updates });
    } catch (error) {
      console.error("Error processing work order webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });
  
  // ===== VIDEO LIBRARY, API CLIENTS, RATE LIMITING, API KEY VALIDATION, INGESTION API =====
  // These sections have been extracted to server/routes/integrations.routes.ts
  // The integrationsRouter is mounted at /api at the top of this file
  
  // ===== END EXTRACTED SECTIONS =====
  
  // ===== SYSTEM ROUTES EXTRACTED =====
  // The following sections have been extracted to server/routes/system.routes.ts:
  // - SYSTEM HEALTH ENDPOINTS (queue-stats, ingestion-stats, scheduled-jobs, logs, etc.)
  // - API DOCUMENTATION ENDPOINT (openapi spec)
  // - AUDIT TRAIL API (audit-events, entity audit history)
  // - RISK SCORING API (portfolio-summary, property risks, alerts, factor definitions)
  // - REPORTING API ENDPOINTS (compliance-summary, property-health, contractor-performance, monthly-trends, etc.)
  // - EVIDENCE PACK EXPORT (evidence-packs, templates)
  // - REPORTING API (templates, scheduled reports, generated reports)
  // - SIDEBAR COUNTS & NAVIGATION API
  // - CACHE ADMINISTRATION API
  // - REGULATORY COMPLIANCE API (hazard-cases, households, tenants, service-requests, TSM, building safety, etc.)
  // - QUERY CACHE MANAGEMENT API
  // The systemRouter is mounted at /api at the top of this file
  // ===== END SYSTEM ROUTES EXTRACTED =====
  

  return httpServer;
}

// Helper function to hash API keys
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify API key against stored hash
async function verifyApiKey(providedKey: string, storedHash: string): Promise<boolean> {
  const providedHash = await hashApiKey(providedKey);
  return providedHash === storedHash;
}

// HMAC signature generation for request signing
// NOTE: This is a placeholder for future implementation. To enable HMAC signing:
// 1. Store a separate HMAC secret (not the hashed API key) with each API client
// 2. Return the HMAC secret to the client on API key creation
// 3. Client uses the HMAC secret to sign requests
// 4. Call validateHmacSignature in the validateApiKey middleware when REQUIRE_HMAC_SIGNING setting is true
async function generateHmacSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string,
  secret: string
): Promise<string> {
  const message = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate HMAC signature from request
async function validateHmacSignature(
  req: Request,
  apiClient: { apiKey: string }
): Promise<boolean> {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  
  if (!signature || !timestamp) {
    return false;
  }
  
  // Check timestamp is within 5 minutes to prevent replay attacks
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  const fiveMinutes = 5 * 60 * 1000;
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > fiveMinutes) {
    return false;
  }
  
  const body = JSON.stringify(req.body) || '';
  const expectedSignature = await generateHmacSignature(
    req.method,
    req.path,
    timestamp,
    body,
    apiClient.apiKey
  );
  
  return signature === expectedSignature;
}
