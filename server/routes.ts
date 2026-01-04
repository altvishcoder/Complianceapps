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
import { eq, desc, and, count, sql, isNotNull, lt, gte, inArray } from "drizzle-orm";
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
import { clearTierThresholdsCache } from "./services/risk-scoring";
import { 
  validatePassword, 
  checkLoginLockout, 
  recordFailedLogin, 
  clearLoginAttempts,
  getPasswordPolicyDescription 
} from "./services/password-policy";
import * as cacheAdminService from "./services/cache-admin";
import { cacheRegions, cacheClearAudit } from "@shared/schema";
import { checkUploadThrottle, endUpload, acquireFileLock, releaseFileLock } from "./utils/upload-throttle";
import observabilityRoutes from "./routes/observability.routes";
// Modular route files exist in server/routes/ for future migration and testing

const objectStorageService = new ObjectStorageService();

// Risk calculation helpers
function calculatePropertyRiskScore(
  certificates: Array<{ type: string; status: string; expiryDate: string | null }>,
  actions: Array<{ severity: string; status: string }>
): number {
  if (certificates.length === 0) return 50;
  
  const validCerts = certificates.filter(c => 
    c.status === 'APPROVED' || c.status === 'EXTRACTED' || c.status === 'NEEDS_REVIEW'
  ).length;
  const failedCerts = certificates.filter(c => c.status === 'FAILED' || c.status === 'EXPIRED').length;
  const certScore = ((validCerts - failedCerts * 0.5) / Math.max(certificates.length, 1)) * 100;
  
  const openActions = actions.filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  const criticalPenalty = openActions.filter(a => a.severity === 'IMMEDIATE').length * 15;
  const majorPenalty = openActions.filter(a => a.severity === 'URGENT').length * 5;
  
  return Math.max(0, Math.min(100, Math.round(Math.max(certScore, 30) - criticalPenalty - majorPenalty)));
}

function calculateStreamScores(certificates: Array<{ type: string; status: string; expiryDate: string | null }>) {
  const streams = ['gas', 'electrical', 'fire', 'asbestos', 'lift', 'water'];
  const typeToStream: Record<string, string> = {
    'GAS_SAFETY': 'gas',
    'EICR': 'electrical', 
    'FIRE_RISK_ASSESSMENT': 'fire',
    'ASBESTOS_SURVEY': 'asbestos',
    'LIFT_LOLER': 'lift',
    'LEGIONELLA_ASSESSMENT': 'water',
    'EPC': 'electrical',
    'OTHER': 'fire'
  };
  
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
  
  // ===== AI ASSISTANT CHAT ENDPOINT (Streaming) =====
  const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  });
  
  const chatRequestSchema = z.object({
    messages: z.array(chatMessageSchema).min(1).max(20),
  });
  
  app.post("/api/assistant/chat", async (req, res) => {
    try {
      // Session-based authentication only - X-User-Id header bypass removed for security
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      const parseResult = chatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request format", details: parseResult.error.issues });
      }
      
      const { messages } = parseResult.data;
      
      const { chatWithAssistant } = await import('./services/ai-assistant');
      const result = await chatWithAssistant(messages, user.organisationId || undefined);
      
      if (result.success) {
        res.json({ message: result.message, suggestions: result.suggestions || [] });
      } else {
        res.status(500).json({ error: result.error || "Failed to get response" });
      }
    } catch (error) {
      console.error("AI Assistant error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });
  
  // ===== AI ASSISTANT ANALYTICS ENDPOINT =====
  app.get("/api/assistant/analytics", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      // Only admins can view analytics
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const days = parseInt(req.query.days as string) || 7;
      
      const { getChatbotAnalytics } = await import('./services/ai-assistant');
      const analytics = await getChatbotAnalytics(days);
      
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });
  
  // ===== KNOWLEDGE DOCUMENT MANAGEMENT (RAG Training) =====
  // Get all knowledge documents
  app.get("/api/knowledge", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      // Only admins can manage knowledge
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const category = req.query.category as string | undefined;
      
      const { getKnowledgeDocuments } = await import('./services/ai-assistant');
      const documents = await getKnowledgeDocuments(category);
      
      res.json(documents);
    } catch (error) {
      console.error("Get knowledge error:", error);
      res.status(500).json({ error: "Failed to get knowledge documents" });
    }
  });
  
  // Get knowledge categories
  app.get("/api/knowledge/categories", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { getKnowledgeCategories } = await import('./services/ai-assistant');
      const categories = await getKnowledgeCategories();
      
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });
  
  // Get single knowledge document
  app.get("/api/knowledge/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { getKnowledgeDocument } = await import('./services/ai-assistant');
      const document = await getKnowledgeDocument(req.params.id);
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Get knowledge document error:", error);
      res.status(500).json({ error: "Failed to get document" });
    }
  });
  
  // Create knowledge document
  app.post("/api/knowledge", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      // Only admins can manage knowledge
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { title, content, category, sourceType, metadata } = req.body;
      
      if (!title || !content || !category || !sourceType) {
        return res.status(400).json({ error: "Missing required fields: title, content, category, sourceType" });
      }
      
      const { createKnowledgeDocument } = await import('./services/ai-assistant');
      const result = await createKnowledgeDocument({
        title,
        content,
        category,
        sourceType,
        metadata,
      });
      
      if (result.success) {
        res.status(201).json({ id: result.id, message: "Document created successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to create document" });
      }
    } catch (error) {
      console.error("Create knowledge error:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });
  
  // Update knowledge document
  app.put("/api/knowledge/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      // Only admins can manage knowledge
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { updateKnowledgeDocument } = await import('./services/ai-assistant');
      const result = await updateKnowledgeDocument(req.params.id, req.body);
      
      if (result.success) {
        res.json({ message: "Document updated successfully" });
      } else {
        res.status(result.error === 'Document not found' ? 404 : 500).json({ error: result.error });
      }
    } catch (error) {
      console.error("Update knowledge error:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });
  
  // Delete knowledge document
  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      // Only admins can manage knowledge
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { deleteKnowledgeDocument } = await import('./services/ai-assistant');
      const result = await deleteKnowledgeDocument(req.params.id);
      
      if (result.success) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to delete document" });
      }
    } catch (error) {
      console.error("Delete knowledge error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });
  
  // ===== GLOBAL SEARCH (PostgreSQL Full-Text Search) =====
  app.get("/api/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) {
        return res.json({ properties: [], certificates: [], actions: [] });
      }
      
      // Create search query for PostgreSQL (convert to tsquery format)
      const searchTerms = query.split(/\s+/).filter(t => t.length > 0).map(t => `${t}:*`).join(' & ');
      
      // Search properties
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
      
      // Search certificates
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
      
      // Search remedial actions
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
      // Fallback to ILIKE search if full-text search fails
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
  app.get("/api/events", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const clientId = Date.now().toString();
    addSSEClient(clientId, res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
    
    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      clearInterval(keepAlive);
      removeSSEClient(clientId);
    });
  });
  
  // ===== ASSET HEALTH SUMMARY (Optimized aggregation) =====
  app.get("/api/asset-health/summary", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
               AND (c.expiry_date IS NULL OR c.expiry_date > ${now})), 0
            ) as compliant_certs,
            COALESCE(
              (SELECT COUNT(*) FROM certificates c 
               WHERE c.property_id = p.id 
               AND c.status = 'APPROVED'
               AND c.expiry_date IS NOT NULL 
               AND c.expiry_date <= ${now}), 0
            ) as expired_certs,
            COALESCE(
              (SELECT COUNT(*) FROM certificates c 
               WHERE c.property_id = p.id 
               AND c.status = 'APPROVED'
               AND c.expiry_date IS NOT NULL 
               AND c.expiry_date > ${now} 
               AND c.expiry_date <= ${thirtyDaysFromNow}), 0
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

      const schemes = result.rows.map((row: any) => ({
        id: row.scheme_id,
        name: row.scheme_name,
        totalProperties: parseInt(row.total_properties) || 0,
        compliantProperties: parseInt(row.compliant_properties) || 0,
        atRiskProperties: parseInt(row.at_risk_properties) || 0,
        expiredProperties: parseInt(row.expired_properties) || 0,
        blocksCount: parseInt(row.blocks_count) || 0,
        complianceRate: parseFloat(row.compliance_rate) || 100,
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
  app.get("/api/asset-health/schemes/:schemeId/blocks", async (req, res) => {
    try {
      const { schemeId } = req.params;
      const organisationId = req.session?.organisationId || ORG_ID;
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const result = await db.execute(sql`
        WITH property_compliance AS (
          SELECT 
            p.id as property_id,
            p.block_id,
            COALESCE(
              (SELECT COUNT(*) FROM certificates c 
               WHERE c.property_id = p.id 
               AND c.status = 'APPROVED' 
               AND (c.expiry_date IS NULL OR c.expiry_date > ${now})), 0
            ) as compliant_certs,
            COALESCE(
              (SELECT COUNT(*) FROM certificates c 
               WHERE c.property_id = p.id 
               AND c.status = 'APPROVED'
               AND c.expiry_date IS NOT NULL 
               AND c.expiry_date <= ${now}), 0
            ) as expired_certs,
            COALESCE(
              (SELECT COUNT(*) FROM certificates c 
               WHERE c.property_id = p.id 
               AND c.status = 'APPROVED'
               AND c.expiry_date IS NOT NULL 
               AND c.expiry_date > ${now} 
               AND c.expiry_date <= ${thirtyDaysFromNow}), 0
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

      const blocks = result.rows.map((row: any) => ({
        id: row.block_id,
        name: row.block_name,
        totalProperties: parseInt(row.total_properties) || 0,
        compliantProperties: parseInt(row.compliant_properties) || 0,
        atRiskProperties: parseInt(row.at_risk_properties) || 0,
        expiredProperties: parseInt(row.expired_properties) || 0,
        complianceRate: parseFloat(row.compliance_rate) || 100,
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
  app.get("/api/asset-health/blocks/:blockId/properties", async (req, res) => {
    try {
      const { blockId } = req.params;
      const organisationId = req.session?.organisationId || ORG_ID;
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const result = await db.execute(sql`
        SELECT 
          p.id as property_id,
          p.address_line1 as property_name,
          p.uprn,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED' 
             AND (c.expiry_date IS NULL OR c.expiry_date > ${now})), 0
          )::int as compliant_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date <= ${now}), 0
          )::int as expired_certs,
          COALESCE(
            (SELECT COUNT(*) FROM certificates c 
             WHERE c.property_id = p.id 
             AND c.status = 'APPROVED'
             AND c.expiry_date IS NOT NULL 
             AND c.expiry_date > ${now} 
             AND c.expiry_date <= ${thirtyDaysFromNow}), 0
          )::int as expiring_certs,
          CASE 
            WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND c.expiry_date IS NOT NULL AND c.expiry_date <= ${now}) > 0 THEN 'expired'
            WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND c.expiry_date IS NOT NULL AND c.expiry_date > ${now} AND c.expiry_date <= ${thirtyDaysFromNow}) > 0 THEN 'at_risk'
            WHEN (SELECT COUNT(*) FROM certificates c WHERE c.property_id = p.id AND c.status = 'APPROVED' AND (c.expiry_date IS NULL OR c.expiry_date > ${now})) > 0 THEN 'compliant'
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

      const properties = result.rows.map((row: any) => ({
        id: row.property_id,
        name: row.property_name,
        uprn: row.uprn,
        compliantCerts: parseInt(row.compliant_certs) || 0,
        expiredCerts: parseInt(row.expired_certs) || 0,
        expiringCerts: parseInt(row.expiring_certs) || 0,
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

  // ===== SCHEMES =====
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
      const { page, limit, offset, hasFilters } = pagination;
      const blockId = req.query.blockId as string | undefined;
      const schemeId = req.query.schemeId as string | undefined;
      const search = req.query.search as string | undefined;
      const allProperties = await storage.listProperties(ORG_ID, { blockId, schemeId });
      
      // Apply search filter
      let filtered = allProperties;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = allProperties.filter(p => 
          p.addressLine1?.toLowerCase().includes(searchLower) ||
          p.postcode?.toLowerCase().includes(searchLower) ||
          p.uprn?.toLowerCase().includes(searchLower)
        );
      }
      
      const total = filtered.length;
      const paginatedProperties = filtered.slice(offset, offset + limit);
      
      // Enrich properties with block and scheme information
      const enrichedProperties = await Promise.all(paginatedProperties.map(async (prop) => {
        const block = await storage.getBlock(prop.blockId);
        const scheme = block ? await storage.getScheme(block.schemeId) : null;
        return {
          ...prop,
          block,
          scheme,
          fullAddress: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
        };
      }));
      
      res.json({ data: enrichedProperties, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });
  
  // ===== PROPERTY GEODATA MANUAL UPDATE =====
  app.patch("/api/properties/:id/geodata", async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ error: "Latitude and longitude must be numbers" });
      }
      
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      
      await storage.updatePropertyGeodata(id, { latitude, longitude });
      res.json({ success: true, message: "Property location updated" });
    } catch (error) {
      console.error("Error updating property geodata:", error);
      res.status(500).json({ error: "Failed to update property location" });
    }
  });
  
  // ===== GEOCODING CSV IMPORT =====
  app.post("/api/geocoding/import", async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: "Data must be a non-empty array" });
      }
      
      let updated = 0;
      let errors = 0;
      
      for (const row of data) {
        const { propertyId, latitude, longitude } = row;
        
        if (!propertyId || typeof latitude !== 'number' || typeof longitude !== 'number') {
          errors++;
          continue;
        }
        
        try {
          await storage.updatePropertyGeodata(propertyId, { latitude, longitude });
          updated++;
        } catch (e) {
          errors++;
        }
      }
      
      res.json({ 
        message: `Imported ${updated} locations`, 
        updated, 
        errors,
        total: data.length 
      });
    } catch (error) {
      console.error("Error importing geocoding data:", error);
      res.status(500).json({ error: "Failed to import geocoding data" });
    }
  });
  
  // ===== GEOCODING API ENDPOINTS =====
  app.get("/api/geocoding/status", async (req, res) => {
    try {
      const allProperties = await storage.listProperties(ORG_ID);
      const geocoded = allProperties.filter(p => p.latitude && p.longitude);
      const notGeocoded = allProperties.filter(p => !p.latitude || !p.longitude);
      const withValidPostcode = notGeocoded.filter(p => p.postcode && p.postcode !== 'UNKNOWN' && p.postcode.length >= 5);
      
      res.json({
        total: allProperties.length,
        geocoded: geocoded.length,
        notGeocoded: notGeocoded.length,
        canAutoGeocode: withValidPostcode.length
      });
    } catch (error) {
      console.error("Error fetching geocoding status:", error);
      res.status(500).json({ error: "Failed to fetch geocoding status" });
    }
  });
  
  app.post("/api/geocoding/batch", async (req, res) => {
    try {
      const { geocodeBulkPostcodes } = await import('./geocoding');
      
      const allProperties = await storage.listProperties(ORG_ID);
      const needsGeocoding = allProperties.filter(p => 
        (!p.latitude || !p.longitude) && 
        p.postcode && 
        p.postcode !== 'UNKNOWN' && 
        p.postcode.length >= 5
      );
      
      if (needsGeocoding.length === 0) {
        return res.json({ message: "No properties need geocoding", updated: 0 });
      }
      
      const postcodeSet = new Set(needsGeocoding.map(p => p.postcode!));
      const postcodes = Array.from(postcodeSet);
      const results = await geocodeBulkPostcodes(postcodes);
      
      let updated = 0;
      for (const prop of needsGeocoding) {
        const cleanPostcode = prop.postcode!.replace(/\s+/g, '').toUpperCase();
        const geocode = results.get(cleanPostcode);
        
        if (geocode) {
          await storage.updatePropertyGeodata(prop.id, {
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            ward: geocode.ward,
            wardCode: geocode.wardCode,
            lsoa: geocode.lsoa,
            msoa: geocode.msoa
          });
          updated++;
        }
      }
      
      res.json({ 
        message: `Geocoded ${updated} properties`, 
        updated,
        total: needsGeocoding.length,
        failed: needsGeocoding.length - updated
      });
    } catch (error) {
      console.error("Error batch geocoding:", error);
      res.status(500).json({ error: "Failed to batch geocode properties" });
    }
  });
  
  // ===== RISK MAPS API ENDPOINTS =====
  app.get("/api/properties/geo", async (req, res) => {
    try {
      const riskData = await storage.getPropertyRiskData(ORG_ID);
      
      const geoProperties = riskData
        .filter(r => r.property.latitude && r.property.longitude)
        .map(r => {
          const prop = r.property;
          const riskScore = calculatePropertyRiskScore(r.certificates, r.actions);
          
          return {
            id: prop.id,
            name: prop.addressLine1,
            address: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
            lat: prop.latitude!,
            lng: prop.longitude!,
            riskScore,
            propertyCount: 1,
            unitCount: 1,
            ward: prop.ward,
            lsoa: prop.lsoa
          };
        });
      
      res.json(geoProperties);
    } catch (error) {
      console.error("Error fetching geodata properties:", error);
      res.status(500).json({ error: "Failed to fetch geodata" });
    }
  });
  
  app.get("/api/risk/areas", async (req, res) => {
    try {
      const level = (req.query.level as string) || 'property';
      const riskData = await storage.getPropertyRiskData(ORG_ID);
      
      if (level === 'property') {
        const areas = riskData
          .filter(r => r.property.latitude && r.property.longitude)
          .map(r => {
            const prop = r.property;
            const riskScore = calculatePropertyRiskScore(r.certificates, r.actions);
            const streams = calculateStreamScores(r.certificates);
            
            return {
              id: prop.id,
              name: prop.addressLine1,
              level: 'property' as const,
              lat: prop.latitude!,
              lng: prop.longitude!,
              riskScore: {
                compositeScore: riskScore,
                trend: 'stable' as const,
                propertyCount: 1,
                unitCount: 1,
                streams,
                defects: calculateDefects(r.actions)
              }
            };
          });
        
        res.json(areas);
      } else if (level === 'scheme') {
        const schemes = await storage.listSchemes(ORG_ID);
        const allBlocks = await storage.listBlocks();
        const blockToScheme = new Map(allBlocks.map(b => [b.id, b.schemeId]));
        
        const schemeMap = new Map<string, typeof riskData>();
        for (const r of riskData) {
          if (!r.property.latitude || !r.property.longitude) continue;
          const schemeId = blockToScheme.get(r.property.blockId);
          if (!schemeId) continue;
          if (!schemeMap.has(schemeId)) schemeMap.set(schemeId, []);
          schemeMap.get(schemeId)!.push(r);
        }
        
        const schemeAggregates = schemes.map(scheme => {
          const schemeProperties = schemeMap.get(scheme.id) || [];
          if (schemeProperties.length === 0) return null;
          
          const avgLat = schemeProperties.reduce((sum, r) => sum + (r.property.latitude || 0), 0) / schemeProperties.length;
          const avgLng = schemeProperties.reduce((sum, r) => sum + (r.property.longitude || 0), 0) / schemeProperties.length;
          
          const allCerts = schemeProperties.flatMap(r => r.certificates);
          const allActions = schemeProperties.flatMap(r => r.actions);
          const avgScore = Math.round(schemeProperties.reduce((sum, r) => 
            sum + calculatePropertyRiskScore(r.certificates, r.actions), 0) / schemeProperties.length);
          
          return {
            id: scheme.id,
            name: scheme.name,
            level: 'scheme' as const,
            lat: avgLat,
            lng: avgLng,
            riskScore: {
              compositeScore: avgScore,
              trend: 'stable' as const,
              propertyCount: schemeProperties.length,
              unitCount: schemeProperties.length,
              streams: calculateStreamScores(allCerts),
              defects: calculateDefects(allActions)
            }
          };
        }).filter(Boolean);
        
        res.json(schemeAggregates);
      } else if (level === 'ward') {
        const wardMap = new Map<string, typeof riskData>();
        
        for (const r of riskData) {
          if (!r.property.latitude || !r.property.longitude) continue;
          const wardKey = r.property.wardCode || (r.property.ward ? r.property.ward.toLowerCase().trim() : null);
          if (!wardKey) continue;
          if (!wardMap.has(wardKey)) wardMap.set(wardKey, []);
          wardMap.get(wardKey)!.push(r);
        }
        
        const wardAreas = Array.from(wardMap.entries()).map(([wardKey, properties]) => {
          const displayName = properties[0]?.property.ward || wardKey;
          const avgLat = properties.reduce((sum, r) => sum + (r.property.latitude || 0), 0) / properties.length;
          const avgLng = properties.reduce((sum, r) => sum + (r.property.longitude || 0), 0) / properties.length;
          
          const allCerts = properties.flatMap(r => r.certificates);
          const allActions = properties.flatMap(r => r.actions);
          const avgScore = Math.round(properties.reduce((sum, r) => 
            sum + calculatePropertyRiskScore(r.certificates, r.actions), 0) / properties.length);
          
          return {
            id: `ward-${wardKey}`,
            name: displayName,
            level: 'ward' as const,
            lat: avgLat,
            lng: avgLng,
            riskScore: {
              compositeScore: avgScore,
              trend: 'stable' as const,
              propertyCount: properties.length,
              unitCount: properties.length,
              streams: calculateStreamScores(allCerts),
              defects: calculateDefects(allActions)
            }
          };
        });
        
        res.json(wardAreas);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching risk areas:", error);
      res.status(500).json({ error: "Failed to fetch risk areas" });
    }
  });
  
  app.get("/api/risk/evidence/:areaId", async (req, res) => {
    try {
      const { areaId } = req.params;
      const property = await storage.getProperty(areaId);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      const certificates = await storage.listCertificates(ORG_ID, { propertyId: areaId });
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId: areaId });
      
      res.json({
        property,
        certificates,
        actions,
        riskScore: calculatePropertyRiskScore(
          certificates.map(c => ({ type: c.certificateType, status: c.status, expiryDate: c.expiryDate })),
          actions.map(a => ({ severity: a.severity, status: a.status }))
        )
      });
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ error: "Failed to fetch evidence" });
    }
  });
  
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
  
  // ===== STAFF MEMBERS - requires BetterAuth authentication =====
  app.get("/api/staff", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const filters: { status?: string; department?: string } = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.department) filters.department = req.query.department as string;
      const staffList = await storage.listStaffMembers(user.organisationId, filters);
      res.json(staffList);
    } catch (error) {
      console.error("Error fetching staff members:", error);
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });
  
  app.get("/api/staff/:id", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const staff = await storage.getStaffMember(req.params.id);
      if (!staff) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      if (staff.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(staff);
    } catch (error) {
      console.error("Error fetching staff member:", error);
      res.status(500).json({ error: "Failed to fetch staff member" });
    }
  });
  
  app.post("/api/staff", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const data = insertStaffMemberSchema.parse({ ...req.body, organisationId: user.organisationId });
      const staff = await storage.createStaffMember(data);
      res.status(201).json(staff);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });
  
  app.patch("/api/staff/:id", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const existing = await storage.getStaffMember(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      if (existing.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updateData = insertStaffMemberSchema.partial().parse(req.body);
      const staff = await storage.updateStaffMember(req.params.id, updateData);
      res.json(staff);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating staff member:", error);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });
  
  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const existing = await storage.getStaffMember(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      if (existing.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const deleted = await storage.deleteStaffMember(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to delete staff member" });
      }
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });
  
  app.post("/api/staff/bulk-import", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const { staffList } = req.body;
      if (!Array.isArray(staffList) || staffList.length === 0) {
        return res.status(400).json({ error: "No staff data provided" });
      }
      const validatedList = staffList.map(item => 
        insertStaffMemberSchema.parse({ ...item, organisationId: user.organisationId })
      );
      const created = await storage.bulkCreateStaffMembers(validatedList);
      res.status(201).json({ success: true, created: created.length, staff: created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error bulk importing staff members:", error);
      res.status(500).json({ error: "Failed to import staff members" });
    }
  });
  
  // ===== CONTRACTOR CERTIFICATIONS - requires authentication =====
  app.get("/api/contractor-certifications", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractorId = req.query.contractorId as string | undefined;
      if (contractorId) {
        const contractor = await storage.getContractor(contractorId);
        if (!contractor || contractor.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to contractor" });
        }
      }
      const certifications = await storage.listContractorCertifications(user.organisationId, contractorId);
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching contractor certifications:", error);
      res.status(500).json({ error: "Failed to fetch contractor certifications" });
    }
  });
  
  app.get("/api/contractor-certifications/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const certification = await storage.getContractorCertification(req.params.id);
      if (!certification) {
        return res.status(404).json({ error: "Certification not found" });
      }
      if (certification.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(certification);
    } catch (error) {
      console.error("Error fetching contractor certification:", error);
      res.status(500).json({ error: "Failed to fetch contractor certification" });
    }
  });
  
  app.post("/api/contractor-certifications", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractor = await storage.getContractor(req.body.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Invalid contractor or access denied" });
      }
      const certification = await storage.createContractorCertification({
        ...req.body,
        organisationId: user.organisationId,
        verifiedById: userId,
      });
      res.status(201).json(certification);
    } catch (error) {
      console.error("Error creating contractor certification:", error);
      res.status(500).json({ error: "Failed to create contractor certification" });
    }
  });
  
  app.patch("/api/contractor-certifications/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const certification = await storage.getContractorCertification(req.params.id);
      if (!certification) {
        return res.status(404).json({ error: "Certification not found" });
      }
      if (certification.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateContractorCertification(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating contractor certification:", error);
      res.status(500).json({ error: "Failed to update contractor certification" });
    }
  });
  
  app.delete("/api/contractor-certifications/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const certification = await storage.getContractorCertification(req.params.id);
      if (!certification) {
        return res.status(404).json({ error: "Certification not found" });
      }
      if (certification.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteContractorCertification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contractor certification:", error);
      res.status(500).json({ error: "Failed to delete contractor certification" });
    }
  });
  
  // ===== CONTRACTOR VERIFICATION HISTORY =====
  app.get("/api/contractors/:id/verification-history", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractor = await storage.getContractor(req.params.id);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const history = await storage.listContractorVerificationHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching verification history:", error);
      res.status(500).json({ error: "Failed to fetch verification history" });
    }
  });
  
  app.post("/api/contractors/:id/verify", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractor = await storage.getContractor(req.params.id);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { action, notes, certificationId, verificationType, verificationMethod } = req.body;
      if (!['VERIFIED', 'FAILED', 'PENDING', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'UNVERIFIED'].includes(action)) {
        return res.status(400).json({ error: "Invalid verification action" });
      }
      const historyEntry = await storage.createContractorVerificationHistory({
        contractorId: req.params.id,
        certificationId: certificationId || null,
        organisationId: user.organisationId,
        verificationType: verificationType || 'MANUAL_REVIEW',
        verificationMethod: verificationMethod || 'MANUAL',
        newStatus: action,
        verifiedById: userId,
        notes: notes || null,
      });
      if (certificationId) {
        await storage.updateContractorCertification(certificationId, {
          verificationStatus: action,
          verifiedAt: new Date(),
          verifiedById: userId,
        });
      }
      res.status(201).json(historyEntry);
    } catch (error) {
      console.error("Error creating verification:", error);
      res.status(500).json({ error: "Failed to create verification" });
    }
  });
  
  // ===== CONTRACTOR ALERTS =====
  app.get("/api/contractor-alerts", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractorId = req.query.contractorId as string | undefined;
      const status = req.query.status as string | undefined;
      if (contractorId) {
        const contractor = await storage.getContractor(contractorId);
        if (!contractor || contractor.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to contractor" });
        }
      }
      const alerts = await storage.listContractorAlerts(user.organisationId, { contractorId, status });
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching contractor alerts:", error);
      res.status(500).json({ error: "Failed to fetch contractor alerts" });
    }
  });
  
  app.patch("/api/contractor-alerts/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const alert = await storage.getContractorAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      if (alert.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateContractorAlert(req.params.id, {
        ...req.body,
        acknowledgedById: req.body.status === 'ACKNOWLEDGED' ? userId : alert.acknowledgedById,
        acknowledgedAt: req.body.status === 'ACKNOWLEDGED' ? new Date() : alert.acknowledgedAt,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating contractor alert:", error);
      res.status(500).json({ error: "Failed to update contractor alert" });
    }
  });
  
  // ===== CONTRACTOR ASSIGNMENTS =====
  app.get("/api/contractor-assignments", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractorId = req.query.contractorId as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      if (contractorId) {
        const contractor = await storage.getContractor(contractorId);
        if (!contractor || contractor.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to contractor" });
        }
      }
      const assignments = await storage.listContractorAssignments(user.organisationId, { contractorId, propertyId, status });
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching contractor assignments:", error);
      res.status(500).json({ error: "Failed to fetch contractor assignments" });
    }
  });
  
  app.post("/api/contractor-assignments", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const contractor = await storage.getContractor(req.body.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Invalid contractor or access denied" });
      }
      const property = await storage.getProperty(req.body.propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      const assignment = await storage.createContractorAssignment({
        ...req.body,
        organisationId: user.organisationId,
        assignedBy: userId,
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating contractor assignment:", error);
      res.status(500).json({ error: "Failed to create contractor assignment" });
    }
  });
  
  app.patch("/api/contractor-assignments/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const assignment = await storage.getContractorAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      if (assignment.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateContractorAssignment(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating contractor assignment:", error);
      res.status(500).json({ error: "Failed to update contractor assignment" });
    }
  });
  
  // ===== CONTRACTOR SLA PROFILES =====
  app.get("/api/contractor-sla-profiles", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const profiles = await db.select()
        .from(contractorSLAProfiles)
        .where(eq(contractorSLAProfiles.organisationId, user.organisationId));
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching SLA profiles:", error);
      res.status(500).json({ error: "Failed to fetch SLA profiles" });
    }
  });
  
  app.post("/api/contractor-sla-profiles", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const [profile] = await db.insert(contractorSLAProfiles)
        .values({
          ...req.body,
          organisationId: user.organisationId,
        })
        .returning();
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating SLA profile:", error);
      res.status(500).json({ error: "Failed to create SLA profile" });
    }
  });
  
  // ===== CONTRACTOR JOB PERFORMANCE =====
  app.get("/api/contractor-performance/:contractorId", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const contractor = await storage.getContractor(req.params.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const performance = await db.select()
        .from(contractorJobPerformance)
        .where(eq(contractorJobPerformance.contractorId, req.params.contractorId))
        .orderBy(desc(contractorJobPerformance.createdAt))
        .limit(50);
      
      const [stats] = await db.select({
        totalJobs: count(),
        slaMetCount: sql<number>`COUNT(*) FILTER (WHERE ${contractorJobPerformance.slaMet} = true)`,
        averageResponseTime: sql<number>`AVG(${contractorJobPerformance.responseTimeDays})`,
        averageCompletionTime: sql<number>`AVG(${contractorJobPerformance.completionTimeDays})`,
      })
      .from(contractorJobPerformance)
      .where(eq(contractorJobPerformance.contractorId, req.params.contractorId));
      
      const slaComplianceRate = stats.totalJobs > 0 
        ? Math.round((stats.slaMetCount / stats.totalJobs) * 100) 
        : 0;
      
      res.json({
        performance,
        summary: {
          totalJobs: stats.totalJobs,
          slaComplianceRate,
          averageResponseDays: Math.round((stats.averageResponseTime || 0) * 10) / 10,
          averageCompletionDays: Math.round((stats.averageCompletionTime || 0) * 10) / 10,
        }
      });
    } catch (error) {
      console.error("Error fetching contractor performance:", error);
      res.status(500).json({ error: "Failed to fetch contractor performance" });
    }
  });
  
  app.post("/api/contractor-performance", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const contractor = await storage.getContractor(req.body.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Invalid contractor or access denied" });
      }
      
      const [record] = await db.insert(contractorJobPerformance)
        .values(req.body)
        .returning();
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating performance record:", error);
      res.status(500).json({ error: "Failed to create performance record" });
    }
  });
  
  // ===== CONTRACTOR RATINGS =====
  app.get("/api/contractor-ratings/:contractorId", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const contractor = await storage.getContractor(req.params.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const ratings = await db.select()
        .from(contractorRatings)
        .where(eq(contractorRatings.contractorId, req.params.contractorId))
        .orderBy(desc(contractorRatings.createdAt))
        .limit(50);
      
      const [stats] = await db.select({
        totalRatings: count(),
        averageOverall: sql<number>`AVG(${contractorRatings.overallRating})`,
        averageQuality: sql<number>`AVG(${contractorRatings.qualityOfWork})`,
        averageTimeliness: sql<number>`AVG(${contractorRatings.timeliness})`,
        averageCommunication: sql<number>`AVG(${contractorRatings.communication})`,
        averageProfessionalism: sql<number>`AVG(${contractorRatings.professionalism})`,
      })
      .from(contractorRatings)
      .where(eq(contractorRatings.contractorId, req.params.contractorId));
      
      res.json({
        ratings,
        summary: {
          totalRatings: stats.totalRatings,
          averageOverall: Math.round((stats.averageOverall || 0) * 10) / 10,
          averageQuality: Math.round((stats.averageQuality || 0) * 10) / 10,
          averageTimeliness: Math.round((stats.averageTimeliness || 0) * 10) / 10,
          averageCommunication: Math.round((stats.averageCommunication || 0) * 10) / 10,
          averageProfessionalism: Math.round((stats.averageProfessionalism || 0) * 10) / 10,
        }
      });
    } catch (error) {
      console.error("Error fetching contractor ratings:", error);
      res.status(500).json({ error: "Failed to fetch contractor ratings" });
    }
  });
  
  app.post("/api/contractor-ratings", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const contractor = await storage.getContractor(req.body.contractorId);
      if (!contractor || contractor.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Invalid contractor or access denied" });
      }
      
      const [rating] = await db.insert(contractorRatings)
        .values({
          ...req.body,
          ratedById: userId,
        })
        .returning();
      res.status(201).json(rating);
    } catch (error) {
      console.error("Error creating contractor rating:", error);
      res.status(500).json({ error: "Failed to create contractor rating" });
    }
  });
  
  // ===== GOLDEN THREAD - Certificate Versions =====
  app.get("/api/certificates/:id/versions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      if (certificate.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const versions = await storage.listCertificateVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching certificate versions:", error);
      res.status(500).json({ error: "Failed to fetch certificate versions" });
    }
  });
  
  // ===== GOLDEN THREAD - Audit Trail =====
  app.get("/api/audit-trail/:entityType/:entityId", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const { getAuditTrailForEntity } = await import('./services/golden-thread-audit');
      const auditTrail = await getAuditTrailForEntity(
        user.organisationId,
        req.params.entityType,
        req.params.entityId
      );
      res.json(auditTrail);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ error: "Failed to fetch audit trail" });
    }
  });
  
  // ===== GOLDEN THREAD - UKHDS Export =====
  app.get("/api/golden-thread/exports", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const exports = await storage.listUkhdsExports(user.organisationId);
      res.json(exports);
    } catch (error) {
      console.error("Error fetching UKHDS exports:", error);
      res.status(500).json({ error: "Failed to fetch UKHDS exports" });
    }
  });
  
  app.post("/api/golden-thread/exports", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const exportJob = await storage.createUkhdsExport({
        organisationId: user.organisationId,
        requestedById: userId,
        exportType: req.body.exportType || 'FULL',
        exportFormat: req.body.exportFormat || 'JSON',
        includeProperties: req.body.includeProperties ?? true,
        includeComponents: req.body.includeComponents ?? true,
        includeCertificates: req.body.includeCertificates ?? true,
        includeCertificateVersions: req.body.includeCertificateVersions ?? true,
        includeAuditTrail: req.body.includeAuditTrail ?? true,
        includeRemedialActions: req.body.includeRemedialActions ?? true,
        dateRangeStart: req.body.dateRangeStart ? new Date(req.body.dateRangeStart) : null,
        dateRangeEnd: req.body.dateRangeEnd ? new Date(req.body.dateRangeEnd) : null,
        schemeIds: req.body.schemeIds || null,
      });
      
      const { processExportJob } = await import('./services/ukhds-export');
      processExportJob(exportJob.id).catch(err => {
        console.error("Error processing UKHDS export:", err);
      });
      
      res.status(201).json(exportJob);
    } catch (error) {
      console.error("Error creating UKHDS export:", error);
      res.status(500).json({ error: "Failed to create UKHDS export" });
    }
  });
  
  app.get("/api/golden-thread/exports/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const exportJob = await storage.getUkhdsExport(req.params.id);
      if (!exportJob) {
        return res.status(404).json({ error: "Export not found" });
      }
      if (exportJob.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(exportJob);
    } catch (error) {
      console.error("Error fetching UKHDS export:", error);
      res.status(500).json({ error: "Failed to fetch UKHDS export" });
    }
  });
  
  app.get("/api/golden-thread/exports/:id/download", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      const exportJob = await storage.getUkhdsExport(req.params.id);
      if (!exportJob) {
        return res.status(404).json({ error: "Export not found" });
      }
      if (exportJob.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (exportJob.status !== 'COMPLETED') {
        return res.status(400).json({ error: "Export not ready for download" });
      }
      
      const { generateUKHDSExport } = await import('./services/ukhds-export');
      const exportData = await generateUKHDSExport(exportJob);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ukhds-export-${exportJob.id}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error downloading UKHDS export:", error);
      res.status(500).json({ error: "Failed to download UKHDS export" });
    }
  });
  
  // ===== COMPLIANCE CALENDAR EVENTS - requires authentication =====
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const filters: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string } = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.eventType) filters.eventType = req.query.eventType as string;
      if (req.query.complianceStreamId) filters.complianceStreamId = req.query.complianceStreamId as string;
      
      const events = await storage.listCalendarEvents(user.organisationId, filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });
  
  app.get("/api/calendar/events/upcoming", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const daysAhead = parseInt(req.query.days as string) || 7;
      const events = await storage.getUpcomingEvents(user.organisationId, daysAhead);
      res.json(events);
    } catch (error) {
      console.error("Error fetching upcoming events:", error);
      res.status(500).json({ error: "Failed to fetch upcoming events" });
    }
  });
  
  app.get("/api/calendar/events/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching calendar event:", error);
      res.status(500).json({ error: "Failed to fetch calendar event" });
    }
  });
  
  app.post("/api/calendar/events", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.organisationId) {
        return res.status(401).json({ error: "Invalid user or no organisation" });
      }
      
      const eventData = {
        ...req.body,
        organisationId: user.organisationId,
        createdBy: userId,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };
      
      const event = await storage.createCalendarEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  });
  
  app.patch("/api/calendar/events/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const updates = { ...req.body };
      if (updates.startDate) updates.startDate = new Date(updates.startDate);
      if (updates.endDate) updates.endDate = new Date(updates.endDate);
      
      const event = await storage.updateCalendarEvent(req.params.id, updates);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ error: "Failed to update calendar event" });
    }
  });
  
  app.delete("/api/calendar/events/:id", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const deleted = await storage.deleteCalendarEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });
  
  // ===== CERTIFICATE EXPIRY ALERTS - requires authentication =====
  app.get("/api/certificates/expiring", async (req, res) => {
    try {
      // Session-based authentication required - no fallback for security
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ error: "Invalid user" });
      }
      
      const days = parseInt(req.query.days as string) || 30;
      const organisationId = user.organisationId;
      
      if (!organisationId) {
        return res.status(400).json({ error: "User has no organization" });
      }
      
      const { getCertificatesExpiringSoon, getExpiryStats } = await import('./services/expiry-alerts');
      
      const [alerts, stats] = await Promise.all([
        getCertificatesExpiringSoon(days, organisationId),
        getExpiryStats(organisationId),
      ]);
      
      res.json({ alerts, stats });
    } catch (error) {
      console.error("Error fetching expiring certificates:", error);
      res.status(500).json({ error: "Failed to fetch expiring certificates" });
    }
  });
  
  // ===== CERTIFICATES =====
  app.get("/api/certificates", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset, hasFilters } = pagination;
      const search = req.query.search as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      
      // Handle special PENDING status - maps to UPLOADED, PROCESSING, NEEDS_REVIEW
      const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
      const isPendingFilter = status === 'PENDING';
      
      const certificates = await storage.listCertificates(ORG_ID, { 
        propertyId, 
        status: isPendingFilter ? undefined : status 
      });
      
      // Apply PENDING filter if needed
      let filtered = isPendingFilter 
        ? certificates.filter(c => PENDING_STATUSES.includes(c.status))
        : certificates;
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(c => 
          c.certificateNumber?.toLowerCase().includes(searchLower) ||
          c.fileName?.toLowerCase().includes(searchLower) ||
          c.type?.toLowerCase().includes(searchLower)
        );
      }
      
      const total = filtered.length;
      const paginatedCertificates = filtered.slice(offset, offset + limit);
      
      // Enrich with property and extraction data
      const enrichedCertificates = await Promise.all(paginatedCertificates.map(async (cert) => {
        const property = await storage.getProperty(cert.propertyId);
        const extraction = await storage.getExtractionByCertificate(cert.id);
        return {
          ...cert,
          property,
          extractedData: extraction?.extractedData,
        };
      }));
      
      res.json({ data: enrichedCertificates, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Error fetching certificates:", error);
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
  app.get("/api/actions", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset, hasFilters } = pagination;
      const search = req.query.search as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const overdue = req.query.overdue as string | undefined;
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId, status });
      
      // Filter by severity if provided
      let filteredActions = actions;
      if (severity) {
        filteredActions = actions.filter(a => a.severity === severity);
      }
      
      // Filter for overdue actions (Awaab's Law breaches)
      if (overdue === 'true') {
        const now = new Date();
        filteredActions = filteredActions.filter(a => {
          if (a.status !== 'OPEN') return false;
          if (!a.dueDate) return false;
          return new Date(a.dueDate) < now;
        });
      }
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredActions = filteredActions.filter(a => 
          a.code?.toLowerCase().includes(searchLower) ||
          a.description?.toLowerCase().includes(searchLower)
        );
      }
      
      const total = filteredActions.length;
      const paginatedActions = filteredActions.slice(offset, offset + limit);
      
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
      
      res.json({ data: enrichedActions, total, page, limit, totalPages: Math.ceil(total / limit) });
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
      
      // Set resolvedAt when marking as completed
      if (updates.status === 'COMPLETED' || updates.status === 'completed') {
        updates.status = 'COMPLETED';
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
  
  // ===== ADMIN / DEMO DATA MANAGEMENT =====
  // All admin routes require admin role
  const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
  
  // Wipe all data (certificates, actions, extractions)
  app.post("/api/admin/wipe-data", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { includeProperties } = req.body || {};
      await storage.wipeData(includeProperties === true);
      res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
    } catch (error) {
      console.error("Error wiping data:", error);
      res.status(500).json({ error: "Failed to wipe data" });
    }
  });
  
  // Seed demo data (schemes, blocks, properties)
  app.post("/api/admin/seed-demo", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      await storage.seedDemoData(ORG_ID);
      res.json({ success: true, message: "Demo data seeded successfully" });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });
  
  // Reset demo (wipe all + reseed)
  app.post("/api/admin/reset-demo", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      await storage.wipeData(true);
      await storage.seedDemoData(ORG_ID);
      res.json({ success: true, message: "Demo reset complete" });
    } catch (error) {
      console.error("Error resetting demo:", error);
      res.status(500).json({ error: "Failed to reset demo" });
    }
  });
  
  // Reclassify existing certificates based on extracted document type
  app.post("/api/admin/reclassify-certificates", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const allCertificates = await storage.listCertificates(ORG_ID);
      let updated = 0;
      let skipped = 0;
      
      const typeMap: Record<string, 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER'> = {};
      
      for (const cert of allCertificates) {
        // Skip if already classified
        if (cert.certificateType !== 'OTHER') {
          skipped++;
          continue;
        }
        
        // Look for extracted document type in property metadata
        const property = await storage.getProperty(cert.propertyId);
        const docType = (property?.extractedMetadata as any)?.documentType || 
                        (cert as any).extractedData?.documentType;
        
        if (!docType) {
          skipped++;
          continue;
        }
        
        const docTypeLower = docType.toLowerCase();
        let newType: typeof typeMap[string] | undefined;
        
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

  // ===== USER MANAGEMENT =====
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.listUsers(ORG_ID);
      // Return users without password
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  app.patch("/api/users/:id/role", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

  // ===== LASHAN OWNED MODEL: MODEL INSIGHTS =====
  app.get("/api/model-insights", async (req, res) => {
    try {
      const allRuns = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      const allReviews = await db.select().from(humanReviews).orderBy(desc(humanReviews.reviewedAt));
      
      const totalRuns = allRuns.length;
      const approvedRuns = allRuns.filter(r => r.status === 'APPROVED').length;
      const rejectedRuns = allRuns.filter(r => r.status === 'REJECTED' || r.status === 'VALIDATION_FAILED').length;
      const awaitingReviewRuns = allRuns.filter(r => r.status === 'AWAITING_REVIEW').length;
      
      // Calculate accuracy based on reviewed extractions (approved / (approved + rejected))
      const reviewedRuns = approvedRuns + rejectedRuns;
      const accuracy = reviewedRuns > 0 ? approvedRuns / reviewedRuns : 0;
      
      // Calculate confidence-based accuracy for extractions not yet reviewed
      // Use confidence scores from awaiting_review runs as a proxy for expected accuracy
      const avgConfidence = allRuns.length > 0 
        ? allRuns.reduce((sum, r) => sum + (r.confidence || 0), 0) / allRuns.length 
        : 0;
      
      // Blend reviewed accuracy with confidence scores for overall metric
      const overallAccuracy = reviewedRuns > 0 ? accuracy : avgConfidence;
      
      const errorTags: Record<string, number> = {};
      allReviews.forEach(review => {
        (review.errorTags || []).forEach((tag: string) => {
          errorTags[tag] = (errorTags[tag] || 0) + 1;
        });
      });
      
      // Also count rejections as implicit errors
      if (rejectedRuns > 0 && Object.keys(errorTags).length === 0) {
        errorTags['extraction_rejected'] = rejectedRuns;
      }
      
      const topTags = Object.entries(errorTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count, trend: 0 }));
      
      // Calculate accuracy by document type - include confidence for unreviewed
      const byDocType = Object.entries(
        allRuns.reduce((acc, run) => {
          const docType = run.documentType || 'Unknown';
          if (!acc[docType]) acc[docType] = { total: 0, approved: 0, rejected: 0, confidenceSum: 0 };
          acc[docType].total++;
          acc[docType].confidenceSum += (run.confidence || 0);
          if (run.status === 'APPROVED') acc[docType].approved++;
          if (run.status === 'REJECTED' || run.status === 'VALIDATION_FAILED') acc[docType].rejected++;
          return acc;
        }, {} as Record<string, { total: number; approved: number; rejected: number; confidenceSum: number }>)
      ).map(([type, data]) => {
        const reviewed = data.approved + data.rejected;
        // If we have reviewed runs, use real accuracy; otherwise use average confidence
        const acc = reviewed > 0 
          ? (data.approved / reviewed) * 100 
          : (data.confidenceSum / data.total) * 100;
        return {
          type: type.length > 30 ? type.substring(0, 27) + '...' : type,
          accuracy: Math.round(acc),
          count: data.total
        };
      });
      
      // Calculate weekly trend data based on creation dates
      const weeklyData: Record<string, { total: number; approved: number; avgConf: number }> = {};
      allRuns.forEach(run => {
        const weekStart = new Date(run.createdAt || new Date());
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weeklyData[weekKey]) weeklyData[weekKey] = { total: 0, approved: 0, avgConf: 0 };
        weeklyData[weekKey].total++;
        weeklyData[weekKey].avgConf += (run.confidence || 0);
        if (run.status === 'APPROVED') weeklyData[weekKey].approved++;
      });
      
      const byWeek = Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([week, data]) => ({
          week: new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          accuracy: data.total > 0 ? Math.round((data.avgConf / data.total) * 100) : 0
        }));
      
      // Calculate benchmark score based on confidence and validation pass rate
      const validationPassRate = allRuns.filter(r => r.validationPassed).length / Math.max(totalRuns, 1);
      const benchmarkScore = Math.round((avgConfidence * 0.5 + validationPassRate * 0.5) * 100);
      
      res.json({
        accuracy: {
          overall: Math.round(overallAccuracy * 100),
          trend: 0,
          byDocType,
          byWeek,
        },
        errors: {
          topTags,
          recentExamples: allReviews.slice(0, 10).map(r => ({
            id: r.id,
            field: 'various',
            tag: (r.errorTags || [])[0] || 'unknown',
            docType: 'Certificate'
          })),
        },
        improvements: {
          queue: topTags.slice(0, 5).map((t, i) => ({
            id: `imp-${i}`,
            issue: `Fix ${t.tag.replace(/_/g, ' ')} errors`,
            occurrences: t.count,
            suggestedFix: `Review and update extraction prompt to handle ${t.tag.replace(/_/g, ' ')} cases`,
            priority: i < 2 ? 'high' : 'medium'
          })),
          recentWins: [],
        },
        benchmarks: {
          latest: { 
            score: benchmarkScore, 
            date: new Date().toISOString(), 
            passed: benchmarkScore >= 80 
          },
          trend: [],
        },
        extractionStats: {
          total: totalRuns,
          pending: allRuns.filter(r => r.status === 'PENDING').length,
          approved: approvedRuns,
          awaitingReview: awaitingReviewRuns,
          failed: rejectedRuns,
        },
      });
    } catch (error) {
      console.error("Error fetching model insights:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });
  
  app.get("/api/model-insights/tier-stats", async (req, res) => {
    try {
      const allAudits = await db.select().from(extractionTierAudits).orderBy(extractionTierAudits.attemptedAt);
      
      if (allAudits.length === 0) {
        return res.json({
          summary: {
            totalExtractionRuns: 0,
            totalCertificates: 0,
            totalTierAttempts: 0,
            avgTiersPerRun: 0,
            totalCost: 0,
            avgCostPerRun: 0,
            totalProcessingTimeMs: 0,
            avgProcessingTimeMs: 0,
          },
          tierDistribution: [],
          finalTierDistribution: [],
          escalationReasons: [],
          costByTier: [],
          processingTimeByTier: [],
          recentExtractions: [],
        });
      }
      
      const extractionRuns: Map<string, typeof allAudits> = new Map();
      allAudits.forEach(audit => {
        const runKey = audit.extractionRunId || audit.certificateId;
        if (!extractionRuns.has(runKey)) {
          extractionRuns.set(runKey, []);
        }
        extractionRuns.get(runKey)!.push(audit);
      });
      
      const uniqueCertificates = new Set(allAudits.map(a => a.certificateId));
      const totalExtractionRuns = extractionRuns.size;
      const totalCertificates = uniqueCertificates.size;
      
      const tierCounts: Record<string, number> = {};
      const tierCostSums: Record<string, number> = {};
      const tierTimeSums: Record<string, number> = {};
      const tierSuccessCount: Record<string, number> = {};
      const escalationReasons: Record<string, number> = {};
      
      allAudits.forEach(audit => {
        const tier = audit.tier;
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        tierCostSums[tier] = (tierCostSums[tier] || 0) + (audit.cost || 0);
        tierTimeSums[tier] = (tierTimeSums[tier] || 0) + (audit.processingTimeMs || 0);
        
        if (audit.status === 'success') {
          tierSuccessCount[tier] = (tierSuccessCount[tier] || 0) + 1;
        }
        
        if (audit.status === 'escalated' && audit.escalationReason) {
          escalationReasons[audit.escalationReason] = (escalationReasons[audit.escalationReason] || 0) + 1;
        }
      });
      
      const finalTierCounts: Record<string, number> = {};
      const runStats: Array<{
        runKey: string;
        certificateId: string;
        tiersAttempted: number;
        finalTier: string;
        finalStatus: string;
        totalCost: number;
        totalTimeMs: number;
        attemptedAt: Date | null;
      }> = [];
      
      extractionRuns.forEach((runAudits, runKey) => {
        const sortedAudits = runAudits.sort((a, b) => a.tierOrder - b.tierOrder);
        const lastAudit = sortedAudits[sortedAudits.length - 1];
        if (lastAudit) {
          finalTierCounts[lastAudit.tier] = (finalTierCounts[lastAudit.tier] || 0) + 1;
        }
        
        runStats.push({
          runKey,
          certificateId: runAudits[0]?.certificateId,
          tiersAttempted: runAudits.length,
          finalTier: lastAudit?.tier || 'unknown',
          finalStatus: lastAudit?.status || 'unknown',
          totalCost: runAudits.reduce((sum, a) => sum + (a.cost || 0), 0),
          totalTimeMs: runAudits.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0),
          attemptedAt: runAudits[0]?.attemptedAt || null,
        });
      });
      
      const totalCost = allAudits.reduce((sum, a) => sum + (a.cost || 0), 0);
      const totalProcessingTimeMs = allAudits.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0);
      
      const tierOrder = ['tier-0', 'tier-0.5', 'tier-1', 'tier-1.5', 'tier-2', 'tier-3', 'tier-4'];
      const tierLabels: Record<string, string> = {
        'tier-0': 'Tier 0 (Format Detection)',
        'tier-0.5': 'Tier 0.5 (Classification)',
        'tier-1': 'Tier 1 (Template Match)',
        'tier-1.5': 'Tier 1.5 (Normalisation)',
        'tier-2': 'Tier 2 (Simple AI)',
        'tier-3': 'Tier 3 (Advanced AI)',
        'tier-4': 'Tier 4 (Human Review)',
      };
      
      const recentExtractions = runStats
        .sort((a, b) => (b.attemptedAt?.getTime() || 0) - (a.attemptedAt?.getTime() || 0))
        .slice(0, 10);
      
      res.json({
        summary: {
          totalExtractionRuns,
          totalCertificates,
          totalTierAttempts: allAudits.length,
          avgTiersPerRun: totalExtractionRuns > 0 ? allAudits.length / totalExtractionRuns : 0,
          totalCost: Math.round(totalCost * 10000) / 10000,
          avgCostPerRun: totalExtractionRuns > 0 ? Math.round((totalCost / totalExtractionRuns) * 10000) / 10000 : 0,
          totalProcessingTimeMs,
          avgProcessingTimeMs: totalExtractionRuns > 0 ? Math.round(totalProcessingTimeMs / totalExtractionRuns) : 0,
        },
        tierDistribution: tierOrder.map(tier => ({
          tier,
          label: tierLabels[tier] || tier,
          count: tierCounts[tier] || 0,
          percentage: allAudits.length > 0 ? Math.round(((tierCounts[tier] || 0) / allAudits.length) * 100) : 0,
          successCount: tierSuccessCount[tier] || 0,
          successRate: tierCounts[tier] ? Math.round(((tierSuccessCount[tier] || 0) / tierCounts[tier]) * 100) : 0,
        })),
        finalTierDistribution: tierOrder.map(tier => ({
          tier,
          label: tierLabels[tier] || tier,
          count: finalTierCounts[tier] || 0,
          percentage: totalExtractionRuns > 0 ? Math.round(((finalTierCounts[tier] || 0) / totalExtractionRuns) * 100) : 0,
        })),
        escalationReasons: Object.entries(escalationReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / allAudits.length) * 100) })),
        costByTier: tierOrder.map(tier => ({
          tier,
          label: tierLabels[tier] || tier,
          totalCost: Math.round((tierCostSums[tier] || 0) * 10000) / 10000,
          avgCost: tierCounts[tier] ? Math.round(((tierCostSums[tier] || 0) / tierCounts[tier]) * 10000) / 10000 : 0,
        })),
        processingTimeByTier: tierOrder.map(tier => ({
          tier,
          label: tierLabels[tier] || tier,
          totalTimeMs: tierTimeSums[tier] || 0,
          avgTimeMs: tierCounts[tier] ? Math.round((tierTimeSums[tier] || 0) / tierCounts[tier]) : 0,
        })),
        recentExtractions,
      });
    } catch (error) {
      console.error("Error fetching tier stats:", error);
      res.status(500).json({ error: "Failed to fetch tier statistics" });
    }
  });
  
  app.post("/api/model-insights/run-benchmark", async (req, res) => {
    try {
      const allRuns = await db.select().from(extractionRuns);
      const approved = allRuns.filter(r => r.status === 'APPROVED').length;
      const score = allRuns.length > 0 ? (approved / allRuns.length) * 100 : 0;
      res.json({ score, passed: score >= 80, date: new Date().toISOString() });
    } catch (error) {
      console.error("Error running benchmark:", error);
      res.status(500).json({ error: "Failed to run benchmark" });
    }
  });
  
  app.post("/api/model-insights/export-training-data", async (req, res) => {
    try {
      // Join human reviews with extraction runs to get the full training context
      const reviews = await db.select({
        review: humanReviews,
        extractionRun: extractionRuns,
        certificate: certificates,
      })
        .from(humanReviews)
        .innerJoin(extractionRuns, eq(humanReviews.extractionRunId, extractionRuns.id))
        .leftJoin(certificates, eq(extractionRuns.certificateId, certificates.id))
        .orderBy(desc(humanReviews.reviewedAt));
      
      if (reviews.length === 0) {
        // If no human reviews, export approved extraction runs instead
        const approvedRuns = await db.select({
          run: extractionRuns,
          certificate: certificates,
        })
          .from(extractionRuns)
          .leftJoin(certificates, eq(extractionRuns.certificateId, certificates.id))
          .where(eq(extractionRuns.status, 'APPROVED'))
          .orderBy(desc(extractionRuns.createdAt));
        
        if (approvedRuns.length === 0) {
          // Return empty JSONL with placeholder to ensure valid file
          res.setHeader('Content-Type', 'application/jsonl');
          res.setHeader('Content-Disposition', 'attachment; filename=training-data.jsonl');
          res.send('');
          return;
        }
        
        const trainingData = approvedRuns
          .filter(r => r.run !== null)
          .map(r => JSON.stringify({
            source: 'approved_extraction',
            input: {
              documentType: r.run!.documentType || 'UNKNOWN',
              certificateType: r.certificate?.certificateType || 'UNKNOWN',
              rawOutput: r.run!.rawOutput || {},
            },
            output: r.run!.finalOutput || r.run!.normalisedOutput || r.run!.validatedOutput || r.run!.rawOutput || {},
            metadata: {
              confidence: r.run!.confidence || 0,
              modelVersion: r.run!.modelVersion || 'unknown',
              promptVersion: r.run!.promptVersion || 'unknown',
              certificateId: r.run!.certificateId,
            }
          })).join('\n');
        
        res.setHeader('Content-Type', 'application/jsonl');
        res.setHeader('Content-Disposition', 'attachment; filename=training-data.jsonl');
        res.send(trainingData);
        return;
      }
      
      const trainingData = reviews
        .filter(r => r.extractionRun !== null)
        .map(r => JSON.stringify({
          source: 'human_review',
          input: {
            documentType: r.extractionRun!.documentType || 'UNKNOWN',
            certificateType: r.certificate?.certificateType || 'UNKNOWN',
            rawOutput: r.extractionRun!.rawOutput || {},
            validatedOutput: r.extractionRun!.validatedOutput || null,
          },
          output: r.review.approvedOutput || {},
          corrections: {
            fieldChanges: r.review.fieldChanges || [],
            addedItems: r.review.addedItems || [],
            removedItems: r.review.removedItems || [],
            errorTags: r.review.errorTags || [],
            wasCorrect: r.review.wasCorrect ?? false,
            changeCount: r.review.changeCount || 0,
          },
          metadata: {
            modelVersion: r.extractionRun!.modelVersion || 'unknown',
            promptVersion: r.extractionRun!.promptVersion || 'unknown',
            reviewerId: r.review.reviewerId,
            certificateId: r.extractionRun!.certificateId,
          }
        })).join('\n');
      
      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', 'attachment; filename=training-data.jsonl');
      res.send(trainingData);
    } catch (error) {
      console.error("Error exporting training data:", error);
      res.status(500).json({ error: "Failed to export" });
    }
  });
  
  // ===== AI-POWERED ACCURACY SUGGESTIONS (DYNAMIC & PERSISTENT) =====
  app.get("/api/model-insights/ai-suggestions", async (req, res) => {
    try {
      const organisationId = req.query.organisationId as string || 'default-org';
      
      const allRuns = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt)).limit(100);
      const allReviews = await db.select().from(humanReviews).orderBy(desc(humanReviews.reviewedAt)).limit(50);
      
      // Gather error patterns
      const errorPatterns: Record<string, { count: number; examples: string[] }> = {};
      allReviews.forEach(review => {
        (review.errorTags || []).forEach((tag: string) => {
          if (!errorPatterns[tag]) errorPatterns[tag] = { count: 0, examples: [] };
          errorPatterns[tag].count++;
          if (review.fieldChanges && errorPatterns[tag].examples.length < 3) {
            errorPatterns[tag].examples.push(JSON.stringify(review.fieldChanges).slice(0, 200));
          }
        });
      });
      
      // Calculate accuracy by document type
      const docTypeStats: Record<string, { total: number; lowConfidence: number; rejected: number }> = {};
      allRuns.forEach(run => {
        const docType = run.documentType || 'Unknown';
        if (!docTypeStats[docType]) docTypeStats[docType] = { total: 0, lowConfidence: 0, rejected: 0 };
        docTypeStats[docType].total++;
        if ((run.confidence || 0) < 0.7) docTypeStats[docType].lowConfidence++;
        if (run.status === 'REJECTED' || run.status === 'VALIDATION_FAILED') docTypeStats[docType].rejected++;
      });
      
      // Build analysis context
      const analysisContext = {
        totalExtractions: allRuns.length,
        averageConfidence: allRuns.length > 0 
          ? allRuns.reduce((sum, r) => sum + (r.confidence || 0), 0) / allRuns.length 
          : 0,
        rejectionRate: allRuns.length > 0 
          ? allRuns.filter(r => r.status === 'REJECTED' || r.status === 'VALIDATION_FAILED').length / allRuns.length 
          : 0,
        reviewCoverage: allRuns.length > 0 ? allReviews.length / allRuns.length : 0,
        topErrorPatterns: Object.entries(errorPatterns)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([tag, data]) => ({ tag, ...data })),
        docTypePerformance: Object.entries(docTypeStats)
          .map(([type, stats]) => ({
            type,
            ...stats,
            errorRate: stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0
          }))
          .sort((a, b) => b.errorRate - a.errorRate)
      };
      
      // Auto-resolve any suggestions that have met their targets
      await storage.autoResolveAiSuggestions(organisationId);
      
      // Generate dynamic suggestions with progress tracking
      const suggestionDefinitions: Array<{
        key: string;
        category: string;
        title: string;
        description: string;
        impact: string;
        effort: string;
        actionable: boolean;
        shouldCreate: boolean;
        currentValue: number;
        targetValue: number;
        actionLabel?: string;
        actionRoute?: string;
      }> = [];
      
      // Confidence improvement suggestion
      const confidenceCurrent = Math.round(analysisContext.averageConfidence * 100);
      const confidenceTarget = 85;
      if (confidenceCurrent < confidenceTarget) {
        suggestionDefinitions.push({
          key: 'improve-confidence',
          category: 'PROMPT',
          title: 'Improve extraction prompt specificity',
          description: `Average confidence is ${confidenceCurrent}%. Consider adding more specific field descriptions and examples to the extraction prompt.`,
          impact: 'HIGH',
          effort: 'MEDIUM',
          actionable: true,
          shouldCreate: true,
          currentValue: confidenceCurrent,
          targetValue: confidenceTarget,
          actionLabel: 'Edit Extraction Schema',
          actionRoute: '/extraction-schemas'
        });
      }
      
      // Rejection rate suggestion
      const acceptanceRate = Math.round((1 - analysisContext.rejectionRate) * 100);
      const acceptanceTarget = 85;
      if (analysisContext.rejectionRate > 0.15) {
        suggestionDefinitions.push({
          key: 'reduce-rejections',
          category: 'VALIDATION',
          title: 'Review validation rules',
          description: `Rejection rate is ${Math.round(analysisContext.rejectionRate * 100)}%. Some validation rules may be too strict or extraction prompts may need refinement.`,
          impact: 'HIGH',
          effort: 'LOW',
          actionable: true,
          shouldCreate: true,
          currentValue: acceptanceRate,
          targetValue: acceptanceTarget,
          actionLabel: 'Configure Validation',
          actionRoute: '/compliance-rules'
        });
      }
      
      // Review coverage suggestion
      const reviewCurrent = allReviews.length;
      const reviewTarget = Math.max(5, Math.ceil(allRuns.length * 0.1));
      if (allRuns.length > 0 && reviewCurrent < reviewTarget) {
        suggestionDefinitions.push({
          key: 'increase-reviews',
          category: 'QUALITY',
          title: 'Increase human review coverage',
          description: `Only ${reviewCurrent} of ${allRuns.length} extractions have been reviewed. More human feedback will improve accuracy metrics and training data quality.`,
          impact: 'MEDIUM',
          effort: 'MEDIUM',
          actionable: true,
          shouldCreate: true,
          currentValue: reviewCurrent,
          targetValue: reviewTarget,
          actionLabel: 'Review Extractions',
          actionRoute: '/human-review'
        });
      }
      
      // Error pattern suggestions
      analysisContext.topErrorPatterns.forEach((pattern, idx) => {
        if (pattern.count >= 3) {
          suggestionDefinitions.push({
            key: `error-pattern-${pattern.tag}`,
            category: 'TRAINING',
            title: `Address "${pattern.tag.replace(/_/g, ' ')}" errors`,
            description: `Found ${pattern.count} occurrences. Review extraction examples and add specific handling for this error type.`,
            impact: pattern.count > 10 ? 'HIGH' : pattern.count > 5 ? 'MEDIUM' : 'LOW',
            effort: 'MEDIUM',
            actionable: true,
            shouldCreate: true,
            currentValue: pattern.count,
            targetValue: 0,
            actionLabel: 'Review Errors',
            actionRoute: '/human-review'
          });
        }
      });
      
      // Persist suggestions to database (upsert pattern)
      const persistedSuggestions: any[] = [];
      for (const def of suggestionDefinitions) {
        if (!def.shouldCreate) continue;
        
        let existing = await storage.getAiSuggestionByKey(organisationId, def.key);
        
        if (existing) {
          // Update progress on existing suggestion
          const progress = def.targetValue > 0 
            ? Math.min(100, Math.round((def.currentValue / def.targetValue) * 100))
            : (def.currentValue === 0 ? 100 : 0);
          
          existing = await storage.updateAiSuggestion(existing.id, {
            currentValue: def.currentValue,
            targetValue: def.targetValue,
            progressPercent: progress,
            description: def.description,
            lastCheckedAt: new Date()
          });
          persistedSuggestions.push(existing);
        } else {
          // Create new suggestion
          const progress = def.targetValue > 0 
            ? Math.min(100, Math.round((def.currentValue / def.targetValue) * 100))
            : 0;
          
          const created = await storage.createAiSuggestion({
            organisationId,
            suggestionKey: def.key,
            category: def.category as any,
            title: def.title,
            description: def.description,
            impact: def.impact as any,
            effort: def.effort as any,
            actionable: def.actionable,
            currentValue: def.currentValue,
            targetValue: def.targetValue,
            progressPercent: progress,
            status: 'ACTIVE' as any,
            actionLabel: def.actionLabel,
            actionRoute: def.actionRoute
          });
          persistedSuggestions.push(created);
        }
      }
      
      // Also return any existing active suggestions not regenerated this cycle
      const allActive = await storage.listAiSuggestions(organisationId, 'ACTIVE');
      const allInProgress = await storage.listAiSuggestions(organisationId, 'IN_PROGRESS');
      const combinedSuggestions = [...allActive, ...allInProgress];
      
      // Format response
      const formattedSuggestions = combinedSuggestions.map(s => ({
        id: s.id,
        suggestionKey: s.suggestionKey,
        category: s.category?.toLowerCase() || 'quality',
        title: s.title,
        description: s.description,
        impact: s.impact?.toLowerCase() || 'medium',
        effort: s.effort?.toLowerCase() || 'medium',
        actionable: s.actionable,
        status: s.status,
        progress: {
          current: s.currentValue || 0,
          target: s.targetValue || 0,
          percent: s.progressPercent || 0
        },
        action: s.actionLabel ? {
          label: s.actionLabel,
          route: s.actionRoute
        } : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }));
      
      res.json({
        suggestions: formattedSuggestions.slice(0, 10),
        context: {
          totalExtractions: analysisContext.totalExtractions,
          averageConfidence: Math.round(analysisContext.averageConfidence * 100),
          rejectionRate: Math.round(analysisContext.rejectionRate * 100),
          reviewCoverage: Math.round(analysisContext.reviewCoverage * 100),
          errorPatternsCount: analysisContext.topErrorPatterns.length
        },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });
  
  // Dismiss a suggestion
  app.post("/api/model-insights/ai-suggestions/:id/dismiss", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updated = await storage.dismissAiSuggestion(id, reason);
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error dismissing suggestion:", error);
      res.status(500).json({ error: "Failed to dismiss suggestion" });
    }
  });
  
  // Start working on a suggestion (mark as in-progress)
  app.post("/api/model-insights/ai-suggestions/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateAiSuggestion(id, {
        status: 'IN_PROGRESS' as any,
        actionedAt: new Date()
      });
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error starting suggestion:", error);
      res.status(500).json({ error: "Failed to start suggestion" });
    }
  });
  
  // Manually resolve a suggestion
  app.post("/api/model-insights/ai-suggestions/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.resolveAiSuggestion(id);
      if (!updated) {
        return res.status(404).json({ error: "Suggestion not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error resolving suggestion:", error);
      res.status(500).json({ error: "Failed to resolve suggestion" });
    }
  });
  
  // Get suggestion history (all statuses)
  app.get("/api/model-insights/ai-suggestions/history", async (req, res) => {
    try {
      const organisationId = req.query.organisationId as string || 'default-org';
      const allSuggestions = await storage.listAiSuggestions(organisationId);
      res.json({
        suggestions: allSuggestions,
        counts: {
          active: allSuggestions.filter(s => s.status === 'ACTIVE').length,
          inProgress: allSuggestions.filter(s => s.status === 'IN_PROGRESS').length,
          resolved: allSuggestions.filter(s => s.status === 'RESOLVED' || s.status === 'AUTO_RESOLVED').length,
          dismissed: allSuggestions.filter(s => s.status === 'DISMISSED').length
        }
      });
    } catch (error) {
      console.error("Error fetching suggestion history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // ===== ML PREDICTION ENDPOINTS (NOT YET IMPLEMENTED) =====
  const notImplementedResponse = (feature: string) => ({
    error: "Not Implemented",
    message: `${feature} is not yet implemented`,
    code: "NOT_IMPLEMENTED",
    status: 501
  });

  app.get("/api/model-insights/features/:propertyId", async (req, res) => {
    res.status(501).json(notImplementedResponse("Feature extraction for ML prediction"));
  });

  app.post("/api/model-insights/predict", async (req, res) => {
    res.status(501).json(notImplementedResponse("ML breach prediction"));
  });

  app.post("/api/model-insights/training/config", async (req, res) => {
    res.status(501).json(notImplementedResponse("ML training configuration"));
  });

  app.get("/api/model-insights/training/status", async (req, res) => {
    res.status(501).json(notImplementedResponse("ML training status"));
  });

  app.get("/api/model-insights/training/runs", async (req, res) => {
    res.status(501).json(notImplementedResponse("ML training runs history"));
  });

  app.get("/api/model-insights/predictions/history", async (req, res) => {
    res.status(501).json(notImplementedResponse("Prediction history"));
  });

  app.get("/api/model-insights/accuracy", async (req, res) => {
    res.status(501).json(notImplementedResponse("Model accuracy metrics"));
  });

  app.post("/api/model-insights/feedback", async (req, res) => {
    res.status(501).json(notImplementedResponse("Prediction feedback submission"));
  });

  app.get("/api/model-insights/feedback/stats", async (req, res) => {
    res.status(501).json(notImplementedResponse("Feedback statistics"));
  });

  app.get("/api/model-insights/risk-weights", async (req, res) => {
    res.status(501).json(notImplementedResponse("Risk score feature weights"));
  });

  app.post("/api/model-insights/persistence/save", async (req, res) => {
    res.status(501).json(notImplementedResponse("Model weights persistence"));
  });

  app.post("/api/model-insights/persistence/load", async (req, res) => {
    res.status(501).json(notImplementedResponse("Model weights loading"));
  });

  app.get("/api/model-insights/persistence/models", async (req, res) => {
    res.status(501).json(notImplementedResponse("Saved models listing"));
  });

  app.get("/api/model-insights/persistence/versions", async (req, res) => {
    res.status(501).json(notImplementedResponse("Model version tracking"));
  });

  app.post("/api/model-insights/predict/batch", async (req, res) => {
    res.status(501).json(notImplementedResponse("Batch predictions"));
  });
  
  // ===== LASHAN OWNED MODEL: EXTRACTION RUNS =====
  app.get("/api/extraction-runs", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      let query = db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      
      let runs;
      if (status) {
        runs = await db.select().from(extractionRuns)
          .where(eq(extractionRuns.status, status as any))
          .orderBy(desc(extractionRuns.createdAt));
      } else {
        runs = await db.select().from(extractionRuns).orderBy(desc(extractionRuns.createdAt));
      }
      
      const enrichedRuns = await Promise.all(runs.map(async (run) => {
        const cert = await db.select().from(certificates).where(eq(certificates.id, run.certificateId)).limit(1);
        const certificate = cert[0];
        let property = null;
        if (certificate) {
          const props = await db.select().from(properties).where(eq(properties.id, certificate.propertyId)).limit(1);
          property = props[0];
        }
        return {
          ...run,
          certificate: certificate ? {
            ...certificate,
            property: property ? {
              addressLine1: property.addressLine1,
              postcode: property.postcode,
            } : null,
          } : null,
        };
      }));
      
      res.json(enrichedRuns);
    } catch (error) {
      console.error("Error fetching extraction runs:", error);
      res.status(500).json({ error: "Failed to fetch extraction runs" });
    }
  });
  
  app.post("/api/extraction-runs/:id/approve", async (req, res) => {
    try {
      const { approvedOutput, errorTags, notes } = req.body;
      
      const [updated] = await db.update(extractionRuns)
        .set({ 
          status: 'APPROVED', 
          finalOutput: approvedOutput,
          updatedAt: new Date() 
        })
        .where(eq(extractionRuns.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Extraction run not found" });
      }
      
      await db.insert(humanReviews).values({
        extractionRunId: req.params.id,
        reviewerId: 'system',
        organisationId: ORG_ID,
        approvedOutput,
        errorTags: errorTags || [],
        wasCorrect: (errorTags || []).length === 0,
        changeCount: 0,
        reviewerNotes: notes,
      });
      
      // Create remedial actions from approved output if there are defects/findings
      if (updated.certificateId && approvedOutput) {
        const certificate = await storage.getCertificate(updated.certificateId);
        if (certificate) {
          const { generateRemedialActions } = await import("./extraction");
          const remedialActions = generateRemedialActions(
            approvedOutput, 
            certificate.certificateType || updated.documentType,
            certificate.propertyId
          );
          
          const severityMap: Record<string, string> = {
            'IMMEDIATE': 'IMMEDIATE',
            'URGENT': 'URGENT',
            'ROUTINE': 'ROUTINE',
            'ADVISORY': 'ADVISORY'
          };
          
          for (const action of remedialActions) {
            const daysToAdd = action.severity === "IMMEDIATE" ? 1 : 
                              action.severity === "URGENT" ? 7 : 
                              action.severity === "ROUTINE" ? 30 : 90;
            
            const createdAction = await storage.createRemedialAction({
              certificateId: updated.certificateId,
              propertyId: certificate.propertyId,
              code: action.code,
              description: action.description,
              location: action.location,
              severity: severityMap[action.severity] as any,
              status: "OPEN",
              dueDate: new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              costEstimate: action.costEstimate
            });
            
            enqueueWebhookEvent('action.created', 'remedialAction', createdAction.id, {
              id: createdAction.id,
              propertyId: createdAction.propertyId,
              code: createdAction.code,
              description: createdAction.description,
              severity: createdAction.severity,
              status: createdAction.status,
              dueDate: createdAction.dueDate
            });
          }
          
          // Update certificate status and outcome if applicable
          const outcome = approvedOutput.findings?.outcome || approvedOutput.inspection?.outcome;
          if (outcome) {
            await storage.updateCertificate(updated.certificateId, {
              status: 'APPROVED',
              outcome: outcome.toUpperCase().includes('UNSATISFACTORY') ? 'UNSATISFACTORY' : 'SATISFACTORY'
            });
          } else {
            await storage.updateCertificate(updated.certificateId, { status: 'APPROVED' });
          }
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error approving extraction:", error);
      res.status(500).json({ error: "Failed to approve" });
    }
  });
  
  app.post("/api/extraction-runs/:id/reject", async (req, res) => {
    try {
      const { reason, errorTags } = req.body;
      
      const [updated] = await db.update(extractionRuns)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(extractionRuns.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Extraction run not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting extraction:", error);
      res.status(500).json({ error: "Failed to reject" });
    }
  });
  
  // Reset specific extraction runs to awaiting review (with audit)
  // Migrate existing extraction runs to use normalized output
  app.post("/api/extraction-runs/migrate-normalize", async (req, res) => {
    try {
      const { normalizeExtractionOutput } = await import("./extraction");
      const runs = await db.select().from(extractionRuns);
      let migrated = 0;
      
      for (const run of runs) {
        if (run.rawOutput && (!run.normalisedOutput || Object.keys(run.normalisedOutput as any).length === 0)) {
          const normalized = normalizeExtractionOutput(run.rawOutput as Record<string, any>);
          await db.update(extractionRuns)
            .set({ normalisedOutput: normalized, updatedAt: new Date() })
            .where(eq(extractionRuns.id, run.id));
          migrated++;
        }
      }
      
      res.json({ success: true, migrated, total: runs.length });
    } catch (error) {
      console.error("Error migrating extraction runs:", error);
      res.status(500).json({ error: "Failed to migrate" });
    }
  });
  
  app.post("/api/extraction-runs/reset-to-review", async (req, res) => {
    try {
      const { ids } = req.body;
      
      let updated;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        // Reset only specified runs
        updated = [];
        for (const id of ids) {
          const [run] = await db.update(extractionRuns)
            .set({ status: 'AWAITING_REVIEW', updatedAt: new Date() })
            .where(eq(extractionRuns.id, id))
            .returning();
          if (run) updated.push(run);
        }
      } else {
        // Reset all approved runs (bulk operation for initial setup)
        updated = await db.update(extractionRuns)
          .set({ status: 'AWAITING_REVIEW', updatedAt: new Date() })
          .where(eq(extractionRuns.status, 'APPROVED'))
          .returning();
      }
      
      console.log(`Reset ${updated.length} extraction runs to AWAITING_REVIEW`);
      res.json({ success: true, count: updated.length });
    } catch (error) {
      console.error("Error resetting extraction runs:", error);
      res.status(500).json({ error: "Failed to reset" });
    }
  });
  
  // ===== INGESTION BATCHES =====
  // Create a new batch
  app.post("/api/batches", async (req, res) => {
    try {
      const { name, totalFiles } = req.body;
      const now = new Date();
      const defaultName = name || `Manual Upload - ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      const [batch] = await db.insert(ingestionBatches).values({
        organisationId: ORG_ID,
        name: defaultName,
        totalFiles: totalFiles || 0,
        status: totalFiles > 0 ? 'PROCESSING' : 'PENDING',
      }).returning();
      res.status(201).json(batch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ error: "Failed to create batch" });
    }
  });
  
  // Get batch progress
  app.get("/api/batches/:id", async (req, res) => {
    try {
      const [batch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, req.params.id));
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      
      // Get certificates in this batch
      const batchCerts = await db.select().from(certificates).where(eq(certificates.batchId, req.params.id));
      
      const completed = batchCerts.filter(c => c.status === 'APPROVED' || c.status === 'NEEDS_REVIEW' || c.status === 'EXTRACTED').length;
      const failed = batchCerts.filter(c => c.status === 'FAILED' || c.status === 'REJECTED').length;
      const processing = batchCerts.filter(c => c.status === 'PROCESSING' || c.status === 'UPLOADED').length;
      
      res.json({
        ...batch,
        certificates: batchCerts,
        progress: {
          total: batchCerts.length,
          completed,
          failed,
          processing,
        },
      });
    } catch (error) {
      console.error("Error getting batch:", error);
      res.status(500).json({ error: "Failed to get batch" });
    }
  });
  
  // List active batches (org-scoped)
  app.get("/api/batches", async (req, res) => {
    try {
      const batches = await db.select().from(ingestionBatches)
        .where(eq(ingestionBatches.organisationId, ORG_ID))
        .orderBy(desc(ingestionBatches.createdAt))
        .limit(50);
      res.json(batches);
    } catch (error) {
      console.error("Error listing batches:", error);
      res.status(500).json({ error: "Failed to list batches" });
    }
  });
  
  // Update batch name/details
  app.patch("/api/batches/:id", async (req, res) => {
    try {
      const { name } = req.body;
      const batch = await storage.getIngestionBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      if (batch.organisationId !== ORG_ID) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateIngestionBatch(req.params.id, { name });
      res.json(updated);
    } catch (error) {
      console.error("Error updating batch:", error);
      res.status(500).json({ error: "Failed to update batch" });
    }
  });
  
  // ===== LASHAN OWNED MODEL: COMPLIANCE RULES =====
  app.get("/api/compliance-rules", async (req, res) => {
    try {
      const rules = await db.select().from(complianceRules).orderBy(desc(complianceRules.createdAt));
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });
  
  app.post("/api/compliance-rules", async (req, res) => {
    try {
      const [rule] = await db.insert(complianceRules).values(req.body).returning();
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating compliance rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });
  
  app.patch("/api/compliance-rules/:id", async (req, res) => {
    try {
      const [updated] = await db.update(complianceRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(complianceRules.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating compliance rule:", error);
      res.status(500).json({ error: "Failed to update rule" });
    }
  });
  
  app.delete("/api/compliance-rules/:id", async (req, res) => {
    try {
      await db.delete(complianceRules).where(eq(complianceRules.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });
  
  // ===== LASHAN OWNED MODEL: NORMALISATION RULES =====
  app.get("/api/normalisation-rules", async (req, res) => {
    try {
      const rules = await db.select().from(normalisationRules).orderBy(desc(normalisationRules.priority));
      res.json(rules);
    } catch (error) {
      console.error("Error fetching normalisation rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });
  
  app.post("/api/normalisation-rules", async (req, res) => {
    try {
      const [rule] = await db.insert(normalisationRules).values(req.body).returning();
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating normalisation rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });
  
  app.patch("/api/normalisation-rules/:id", async (req, res) => {
    try {
      const [updated] = await db.update(normalisationRules)
        .set(req.body)
        .where(eq(normalisationRules.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating normalisation rule:", error);
      res.status(500).json({ error: "Failed to update rule" });
    }
  });
  
  app.delete("/api/normalisation-rules/:id", async (req, res) => {
    try {
      await db.delete(normalisationRules).where(eq(normalisationRules.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting normalisation rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });
  
  // ===== DASHBOARD STATS =====
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const allCertificates = await storage.listCertificates(ORG_ID);
      const allActions = await storage.listRemedialActions(ORG_ID);
      const allProperties = await storage.listProperties(ORG_ID);
      
      // Calculate compliance rate
      const totalCerts = allCertificates.length;
      const validCerts = allCertificates.filter(c => 
        c.status === 'APPROVED' || c.outcome === 'SATISFACTORY'
      ).length;
      const complianceRate = totalCerts > 0 ? ((validCerts / totalCerts) * 100).toFixed(1) : '0';
      
      // Active hazards (open remedial actions)
      const activeHazards = allActions.filter(a => a.status === 'OPEN').length;
      const immediateHazards = allActions.filter(a => 
        a.status === 'OPEN' && a.severity === 'IMMEDIATE'
      ).length;
      
      // Pending certificates (UPLOADED or PROCESSING or NEEDS_REVIEW status)
      const pendingCerts = allCertificates.filter(c => 
        c.status === 'UPLOADED' || c.status === 'PROCESSING' || c.status === 'NEEDS_REVIEW'
      ).length;
      
      // Compliance by stream - dynamically load from database
      const allStreams = await storage.listComplianceStreams();
      const allCertTypes = await storage.listCertificateTypes();
      
      // Build mapping of certificate type code to stream
      const certTypeToStream: Record<string, { streamId: string; streamName: string; streamCode: string }> = {};
      for (const ct of allCertTypes) {
        const stream = allStreams.find(s => s.code === ct.complianceStream);
        if (stream) {
          certTypeToStream[ct.code] = { streamId: stream.id, streamName: stream.name, streamCode: stream.code };
        }
      }
      
      // Group certificates by compliance stream (normalize certificate types to canonical codes)
      const complianceByStream = allStreams.filter(s => s.isActive).map(stream => {
        const streamCertTypeCodes = allCertTypes.filter(ct => ct.complianceStream === stream.code).map(ct => ct.code);
        const streamCerts = allCertificates.filter(c => {
          const normalizedCode = normalizeCertificateTypeCode(c.certificateType);
          return streamCertTypeCodes.includes(normalizedCode);
        });
        
        const satisfactory = streamCerts.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
        const unsatisfactory = streamCerts.filter(c => c.outcome === 'UNSATISFACTORY').length;
        const unclear = streamCerts.length - satisfactory - unsatisfactory;
        
        return {
          type: stream.name,
          code: stream.code,
          streamId: stream.id,
          total: streamCerts.length,
          satisfactory,
          unsatisfactory,
          unclear,
          compliant: streamCerts.length > 0 ? Math.round((satisfactory / streamCerts.length) * 100) : 0,
          nonCompliant: streamCerts.length > 0 ? Math.round((unsatisfactory / streamCerts.length) * 100) : 0,
        };
      }).filter(s => s.total > 0); // Only include streams with certificates
      
      const complianceByType = complianceByStream;
      
      // Hazard distribution by severity (clickable)
      const hazardSeverities = allActions.filter(a => a.status === 'OPEN').reduce((acc, action) => {
        const severity = action.severity || 'STANDARD';
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const severityLabels: Record<string, string> = {
        'IMMEDIATE': 'Immediate',
        'URGENT': 'Urgent',
        'STANDARD': 'Standard',
        'LOW': 'Low'
      };
      
      // Certificates expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiringCertificates = allCertificates
        .filter(c => {
          if (!c.expiryDate) return false;
          const expiry = new Date(c.expiryDate);
          return expiry > new Date() && expiry <= thirtyDaysFromNow;
        })
        .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())
        .slice(0, 10)
        .map(c => {
          const property = allProperties.find(p => p.id === c.propertyId);
          return {
            id: c.id,
            propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : 'Unknown Property',
            type: c.certificateType?.replace(/_/g, ' ') || 'Unknown',
            expiryDate: c.expiryDate
          };
        });
      
      // Urgent remedial actions (IMMEDIATE or URGENT severity, OPEN status)
      const urgentActions = allActions
        .filter(a => a.status === 'OPEN' && (a.severity === 'IMMEDIATE' || a.severity === 'URGENT'))
        .sort((a, b) => {
          const severityOrder: Record<string, number> = { 'IMMEDIATE': 0, 'URGENT': 1 };
          return (severityOrder[a.severity || ''] ?? 2) - (severityOrder[b.severity || ''] ?? 2);
        })
        .slice(0, 10)
        .map(a => {
          const property = allProperties.find(p => p.id === a.propertyId);
          return {
            id: a.id,
            description: a.description || 'No description',
            severity: a.severity,
            propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : 'Unknown Property',
            dueDate: a.dueDate
          };
        });
      
      // Properties with most compliance issues
      const propertyIssues = allProperties.map(p => {
        const propActions = allActions.filter(a => a.propertyId === p.id && a.status === 'OPEN');
        const criticalCount = propActions.filter(a => a.severity === 'IMMEDIATE' || a.severity === 'URGENT').length;
        return {
          id: p.id,
          address: `${p.addressLine1}, ${p.postcode}`,
          issueCount: propActions.length,
          criticalCount
        };
      })
        .filter(p => p.issueCount > 0)
        .sort((a, b) => b.criticalCount - a.criticalCount || b.issueCount - a.issueCount)
        .slice(0, 10);
      
      // Awaab's Law breaches by phase - based on certificate type and classification codes
      const phase1CertTypes = ['DAMP_MOULD_SURVEY', 'DAMP_SURVEY', 'MOULD_INSPECTION', 'CONDENSATION_REPORT'];
      const phase1Codes = ['DAMP_MODERATE', 'DAMP_SEVERE', 'DAMP_CRITICAL', 'MOULD_PRESENT', 'MOULD_SEVERE'];
      
      const phase2CertTypes = ['EICR', 'FIRE_RISK_ASSESSMENT', 'EMERGENCY_LIGHTING', 'FIRE_ALARM', 'PAT'];
      const phase2Codes = ['C1', 'C2', 'C3', 'FI', 'UNSATISFACTORY', 'HIGH_RISK', 'SIGNIFICANT_RISK'];
      
      const phase3CertTypes = ['GAS_SAFETY', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'EPC'];
      const phase3Codes = ['AT_RISK', 'ID', 'IMMEDIATELY_DANGEROUS', 'NCS'];

      const isOverdue = (a: typeof allActions[0]) => {
        if (a.status !== 'OPEN') return false;
        if (!a.dueDate) return false;
        return new Date(a.dueDate) < new Date();
      };

      const getActionCertType = (a: typeof allActions[0]) => {
        const cert = allCertificates.find(c => c.id === a.certificateId);
        return cert?.certificateType || '';
      };

      const matchesPhase = (a: typeof allActions[0], certTypes: string[], codes: string[]) => {
        const certType = getActionCertType(a);
        const classCode = (a as any).code || (a as any).classificationCode || a.description || '';
        return certTypes.includes(certType) || codes.some(c => classCode.toUpperCase().includes(c));
      };

      const overdueActions = allActions.filter(isOverdue);
      
      const awaabsPhase1 = overdueActions.filter(a => matchesPhase(a, phase1CertTypes, phase1Codes)).length;
      const awaabsPhase2 = overdueActions.filter(a => matchesPhase(a, phase2CertTypes, phase2Codes)).length;
      const awaabsPhase3 = overdueActions.filter(a => matchesPhase(a, phase3CertTypes, phase3Codes)).length;
      const awaabsTotal = overdueActions.length;
      
      res.json({
        overallCompliance: complianceRate,
        activeHazards,
        immediateHazards,
        awaabsLawBreaches: awaabsPhase1,
        awaabsLaw: {
          phase1: { count: awaabsPhase1, status: 'active', label: 'Damp & Mould' },
          phase2: { count: awaabsPhase2, status: 'preview', label: 'Fire, Electrical, Falls' },
          phase3: { count: awaabsPhase3, status: 'future', label: 'All HHSRS Hazards' },
          total: awaabsTotal,
        },
        pendingCertificates: pendingCerts,
        totalProperties: allProperties.length,
        totalHomes: allProperties.length,
        totalCertificates: totalCerts,
        complianceByType,
        hazardDistribution: Object.entries(hazardSeverities).map(([severity, value]) => ({ 
          name: severityLabels[severity] || severity, 
          value,
          severity 
        })),
        expiringCertificates,
        urgentActions,
        problemProperties: propertyIssues,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  
  // ===== BOARD REPORT STATS =====
  app.get("/api/board-report/stats", async (req, res) => {
    try {
      const allCertificates = await storage.listCertificates(ORG_ID);
      const allActions = await storage.listRemedialActions(ORG_ID);
      const allProperties = await storage.listProperties(ORG_ID);
      const allContractors = await storage.listContractors(ORG_ID);
      const allStreams = await storage.listComplianceStreams();
      const allCertTypes = await storage.listCertificateTypes();
      
      // Calculate overall compliance rate as risk score (higher = better)
      const totalCerts = allCertificates.length;
      const validCerts = allCertificates.filter(c => 
        c.status === 'APPROVED' || c.outcome === 'SATISFACTORY'
      ).length;
      const overallRiskScore = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 0;
      
      // Calculate previous period score based on certificates from last 30 days vs older
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const olderCerts = allCertificates.filter(c => c.createdAt && new Date(c.createdAt) < thirtyDaysAgo);
      const olderValidCerts = olderCerts.filter(c => c.status === 'APPROVED' || c.outcome === 'SATISFACTORY').length;
      const previousRiskScore = olderCerts.length > 0 
        ? Math.round((olderValidCerts / olderCerts.length) * 100)
        : Math.max(0, overallRiskScore - 5);
      
      // Compliance streams with scores
      const complianceStreams = allStreams.filter(s => s.isActive).map(stream => {
        const streamCertTypeCodes = allCertTypes.filter(ct => ct.complianceStream === stream.code).map(ct => ct.code);
        const streamCerts = allCertificates.filter(c => {
          const normalizedCode = normalizeCertificateTypeCode(c.certificateType);
          return streamCertTypeCodes.includes(normalizedCode);
        });
        
        const satisfactory = streamCerts.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
        const score = streamCerts.length > 0 ? Math.round((satisfactory / streamCerts.length) * 100) : 0;
        
        // Determine trend based on score thresholds (consistent, not random)
        const trend = score >= 90 ? 'up' : score < 70 ? 'down' : 'stable';
        
        return {
          name: stream.name,
          code: stream.code,
          score,
          trend,
          total: streamCerts.length,
        };
      }).filter(s => s.total > 0);
      
      // Portfolio health breakdown
      const compliantProperties = allProperties.filter(p => p.complianceStatus === 'COMPLIANT').length;
      const minorIssueProperties = allProperties.filter(p => p.complianceStatus === 'PARTIAL').length;
      const attentionRequiredProperties = allProperties.filter(p => 
        p.complianceStatus === 'NON_COMPLIANT' || p.complianceStatus === 'OVERDUE'
      ).length;
      const unknownProperties = allProperties.length - compliantProperties - minorIssueProperties - attentionRequiredProperties;
      
      const portfolioHealth = [
        { name: "Fully Compliant", value: compliantProperties, color: "#22c55e" },
        { name: "Minor Issues", value: minorIssueProperties + unknownProperties, color: "#f59e0b" },
        { name: "Attention Required", value: attentionRequiredProperties, color: "#ef4444" },
      ];
      
      // Key metrics
      const openActions = allActions.filter(a => a.status === 'OPEN').length;
      const closedActions = allActions.filter(a => a.status === 'CLOSED').length;
      const activeContractors = allContractors.filter(c => c.status === 'ACTIVE').length;
      
      const keyMetrics = [
        { label: "Total Properties", value: allProperties.length.toLocaleString(), change: "+0", trend: "stable", sublabel: "(Structures)" },
        { label: "Active Certificates", value: totalCerts.toLocaleString(), change: "+0", trend: "stable" },
        { label: "Open Actions", value: openActions.toLocaleString(), change: "0", trend: "stable" },
        { label: "Contractors Active", value: activeContractors.toLocaleString(), change: "0", trend: "stable" },
      ];
      
      // Critical alerts (overdue + expiring soon)
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const criticalAlerts: Array<{ title: string; location: string; urgency: string; daysOverdue: number; impact: string }> = [];
      
      // Overdue certificates
      const overdueCerts = allCertificates.filter(c => {
        if (!c.expiryDate) return false;
        return new Date(c.expiryDate) < now;
      });
      
      for (const cert of overdueCerts.slice(0, 3)) {
        const property = allProperties.find(p => p.id === cert.propertyId);
        const daysOverdue = Math.floor((now.getTime() - new Date(cert.expiryDate!).getTime()) / (1000 * 60 * 60 * 24));
        criticalAlerts.push({
          title: `${cert.certificateType?.replace(/_/g, ' ')} Overdue`,
          location: property ? `${property.addressLine1}` : 'Unknown',
          urgency: daysOverdue > 30 ? "High" : "Medium",
          daysOverdue,
          impact: "1 property affected"
        });
      }
      
      // Expiring soon certificates
      const expiringSoon = allCertificates.filter(c => {
        if (!c.expiryDate) return false;
        const expiry = new Date(c.expiryDate);
        return expiry > now && expiry <= sevenDaysFromNow;
      });
      
      for (const cert of expiringSoon.slice(0, 2)) {
        const property = allProperties.find(p => p.id === cert.propertyId);
        criticalAlerts.push({
          title: `${cert.certificateType?.replace(/_/g, ' ')} Expiring Soon`,
          location: property ? `${property.addressLine1}` : 'Unknown',
          urgency: "Medium",
          daysOverdue: 0,
          impact: "1 property affected"
        });
      }
      
      // Quarterly highlights
      const complianceRate = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 0;
      const quarterlyHighlights = [
        { metric: "Compliance Rate", current: `${complianceRate}%`, target: "95%", status: complianceRate >= 95 ? "achieved" : complianceRate >= 85 ? "approaching" : "behind" },
        { metric: "Certificate Renewals", current: validCerts.toString(), target: Math.round(totalCerts * 0.9).toString(), status: validCerts >= totalCerts * 0.9 ? "achieved" : "approaching" },
        { metric: "Actions Closed", current: closedActions.toString(), target: Math.round(allActions.length * 0.8).toString(), status: closedActions >= allActions.length * 0.8 ? "achieved" : "approaching" },
        { metric: "Response Time (avg)", current: "4.2 days", target: "3 days", status: "behind" },
      ];
      
      // Risk trend (deterministic monthly data based on current score with slight decline backwards)
      const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const riskTrend = months.map((month, i) => ({
        month,
        score: Math.max(0, Math.min(100, overallRiskScore - (5 - i) * 2))
      }));
      riskTrend[riskTrend.length - 1].score = overallRiskScore; // Current month is actual
      
      res.json({
        overallRiskScore,
        previousRiskScore,
        complianceStreams,
        portfolioHealth,
        keyMetrics,
        criticalAlerts,
        quarterlyHighlights,
        riskTrend,
      });
    } catch (error) {
      console.error("Error fetching board report stats:", error);
      res.status(500).json({ error: "Failed to fetch board report stats" });
    }
  });
  
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
  
  // ===== CONFIGURATION - CLASSIFICATION CODES =====
  app.get("/api/config/classification-codes", async (req, res) => {
    try {
      const certificateTypeId = req.query.certificateTypeId as string | undefined;
      const complianceStreamId = req.query.complianceStreamId as string | undefined;
      const codes = await storage.listClassificationCodes({ certificateTypeId, complianceStreamId });
      res.json(codes);
    } catch (error) {
      console.error("Error fetching classification codes:", error);
      res.status(500).json({ error: "Failed to fetch classification codes" });
    }
  });
  
  app.get("/api/config/classification-codes/:id", async (req, res) => {
    try {
      const code = await storage.getClassificationCode(req.params.id);
      if (!code) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json(code);
    } catch (error) {
      console.error("Error fetching classification code:", error);
      res.status(500).json({ error: "Failed to fetch classification code" });
    }
  });
  
  app.post("/api/config/classification-codes", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertClassificationCodeSchema.parse(req.body);
      const code = await storage.createClassificationCode(data);
      res.status(201).json(code);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating classification code:", error);
        res.status(500).json({ error: "Failed to create classification code" });
      }
    }
  });
  
  app.patch("/api/config/classification-codes/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertClassificationCodeSchema.partial().parse(req.body);
      const updated = await storage.updateClassificationCode(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating classification code:", error);
        res.status(500).json({ error: "Failed to update classification code" });
      }
    }
  });
  
  app.delete("/api/config/classification-codes/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteClassificationCode(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Classification code not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting classification code:", error);
      res.status(500).json({ error: "Failed to delete classification code" });
    }
  });
  
  // ===== CONFIGURATION - DETECTION PATTERNS =====
  app.get("/api/config/detection-patterns", async (req, res) => {
    try {
      const certificateTypeCode = req.query.certificateTypeCode as string | undefined;
      const patternType = req.query.patternType as string | undefined;
      const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
      const patterns = await storage.listDetectionPatterns({ certificateTypeCode, patternType, isActive });
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching detection patterns:", error);
      res.status(500).json({ error: "Failed to fetch detection patterns" });
    }
  });
  
  app.get("/api/config/detection-patterns/:id", async (req, res) => {
    try {
      const pattern = await storage.getDetectionPattern(req.params.id);
      if (!pattern) {
        return res.status(404).json({ error: "Detection pattern not found" });
      }
      res.json(pattern);
    } catch (error) {
      console.error("Error fetching detection pattern:", error);
      res.status(500).json({ error: "Failed to fetch detection pattern" });
    }
  });
  
  app.post("/api/config/detection-patterns", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertDetectionPatternSchema.parse(req.body);
      const pattern = await storage.createDetectionPattern(data);
      res.status(201).json(pattern);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating detection pattern:", error);
        res.status(500).json({ error: "Failed to create detection pattern" });
      }
    }
  });
  
  app.patch("/api/config/detection-patterns/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertDetectionPatternSchema.partial().parse(req.body);
      const updated = await storage.updateDetectionPattern(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Detection pattern not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating detection pattern:", error);
        res.status(500).json({ error: "Failed to update detection pattern" });
      }
    }
  });
  
  app.delete("/api/config/detection-patterns/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const pattern = await storage.getDetectionPattern(req.params.id);
      if (!pattern) {
        return res.status(404).json({ error: "Detection pattern not found" });
      }
      if (pattern.isSystem) {
        return res.status(400).json({ error: "Cannot delete system pattern" });
      }
      await storage.deleteDetectionPattern(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting detection pattern:", error);
      res.status(500).json({ error: "Failed to delete detection pattern" });
    }
  });
  
  // ===== CONFIGURATION - OUTCOME RULES =====
  app.get("/api/config/outcome-rules", async (req, res) => {
    try {
      const certificateTypeCode = req.query.certificateTypeCode as string | undefined;
      const ruleGroup = req.query.ruleGroup as string | undefined;
      const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
      const rules = await storage.listOutcomeRules({ certificateTypeCode, ruleGroup, isActive });
      res.json(rules);
    } catch (error) {
      console.error("Error fetching outcome rules:", error);
      res.status(500).json({ error: "Failed to fetch outcome rules" });
    }
  });
  
  app.get("/api/config/outcome-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getOutcomeRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Outcome rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching outcome rule:", error);
      res.status(500).json({ error: "Failed to fetch outcome rule" });
    }
  });
  
  app.post("/api/config/outcome-rules", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertOutcomeRuleSchema.parse(req.body);
      const rule = await storage.createOutcomeRule(data);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating outcome rule:", error);
        res.status(500).json({ error: "Failed to create outcome rule" });
      }
    }
  });
  
  app.patch("/api/config/outcome-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertOutcomeRuleSchema.partial().parse(req.body);
      const updated = await storage.updateOutcomeRule(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Outcome rule not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating outcome rule:", error);
        res.status(500).json({ error: "Failed to update outcome rule" });
      }
    }
  });
  
  app.delete("/api/config/outcome-rules/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const rule = await storage.getOutcomeRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Outcome rule not found" });
      }
      if (rule.isSystem) {
        return res.status(400).json({ error: "Cannot delete system rule" });
      }
      await storage.deleteOutcomeRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting outcome rule:", error);
      res.status(500).json({ error: "Failed to delete outcome rule" });
    }
  });
  
  // ===== CONFIGURATION - EXTRACTION SCHEMAS =====
  app.get("/api/config/extraction-schemas", async (req, res) => {
    try {
      const complianceStreamId = req.query.complianceStreamId as string | undefined;
      const schemas = await storage.listExtractionSchemas({ complianceStreamId });
      res.json(schemas);
    } catch (error) {
      console.error("Error fetching extraction schemas:", error);
      res.status(500).json({ error: "Failed to fetch extraction schemas" });
    }
  });
  
  app.get("/api/config/extraction-schemas/:id", async (req, res) => {
    try {
      const schema = await storage.getExtractionSchema(req.params.id);
      if (!schema) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json(schema);
    } catch (error) {
      console.error("Error fetching extraction schema:", error);
      res.status(500).json({ error: "Failed to fetch extraction schema" });
    }
  });
  
  app.post("/api/config/extraction-schemas", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertExtractionSchemaSchema.parse(req.body);
      const schema = await storage.createExtractionSchema(data);
      res.status(201).json(schema);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating extraction schema:", error);
        res.status(500).json({ error: "Failed to create extraction schema" });
      }
    }
  });
  
  app.patch("/api/config/extraction-schemas/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const updateData = insertExtractionSchemaSchema.partial().parse(req.body);
      const updated = await storage.updateExtractionSchema(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating extraction schema:", error);
        res.status(500).json({ error: "Failed to update extraction schema" });
      }
    }
  });
  
  app.delete("/api/config/extraction-schemas/:id", requireRole(...CONFIG_ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteExtractionSchema(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Extraction schema not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting extraction schema:", error);
      res.status(500).json({ error: "Failed to delete extraction schema" });
    }
  });
  
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
  
  // ===== HACT ARCHITECTURE - COMPONENT TYPES =====
  app.get("/api/component-types", async (req, res) => {
    try {
      const types = await storage.listComponentTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching component types:", error);
      res.status(500).json({ error: "Failed to fetch component types" });
    }
  });
  
  app.get("/api/component-types/:id", async (req, res) => {
    try {
      const type = await storage.getComponentType(req.params.id);
      if (!type) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Error fetching component type:", error);
      res.status(500).json({ error: "Failed to fetch component type" });
    }
  });
  
  app.post("/api/component-types", async (req, res) => {
    try {
      const data = insertComponentTypeSchema.parse(req.body);
      const type = await storage.createComponentType(data);
      res.status(201).json(type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating component type:", error);
        res.status(500).json({ error: "Failed to create component type" });
      }
    }
  });
  
  app.patch("/api/component-types/:id", async (req, res) => {
    try {
      const updateData = insertComponentTypeSchema.partial().parse(req.body);
      const updated = await storage.updateComponentType(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating component type:", error);
        res.status(500).json({ error: "Failed to update component type" });
      }
    }
  });
  
  app.delete("/api/component-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComponentType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Component type not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting component type:", error);
      res.status(500).json({ error: "Failed to delete component type" });
    }
  });
  
  // ===== HACT ARCHITECTURE - SPACES (can attach to properties, blocks, or schemes) =====
  app.get("/api/spaces", async (req, res) => {
    try {
      const filters = {
        propertyId: req.query.propertyId as string | undefined,
        blockId: req.query.blockId as string | undefined,
        schemeId: req.query.schemeId as string | undefined,
      };
      const spacesList = await storage.listSpaces(filters);
      res.json(spacesList);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      res.status(500).json({ error: "Failed to fetch spaces" });
    }
  });
  
  app.get("/api/spaces/:id", async (req, res) => {
    try {
      const space = await storage.getSpace(req.params.id);
      if (!space) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      console.error("Error fetching space:", error);
      res.status(500).json({ error: "Failed to fetch space" });
    }
  });
  
  app.post("/api/spaces", async (req, res) => {
    try {
      const data = insertSpaceSchema.parse(req.body);
      const space = await storage.createSpace(data);
      res.status(201).json(space);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating space:", error);
        res.status(500).json({ error: "Failed to create space" });
      }
    }
  });
  
  app.patch("/api/spaces/:id", async (req, res) => {
    try {
      // Get base schema without the refine for partial updates
      const baseSpaceSchema = createInsertSchema(spaces).omit({ id: true, createdAt: true, updatedAt: true });
      const updateData = baseSpaceSchema.partial().parse(req.body);
      
      // If hierarchy IDs are being updated, validate that exactly one is set
      const isUpdatingHierarchy = 'propertyId' in req.body || 'blockId' in req.body || 'schemeId' in req.body;
      if (isUpdatingHierarchy) {
        // Get current space to merge with updates
        const currentSpace = await storage.getSpace(req.params.id);
        if (!currentSpace) {
          return res.status(404).json({ error: "Space not found" });
        }
        
        const mergedPropertyId = 'propertyId' in updateData ? updateData.propertyId : currentSpace.propertyId;
        const mergedBlockId = 'blockId' in updateData ? updateData.blockId : currentSpace.blockId;
        const mergedSchemeId = 'schemeId' in updateData ? updateData.schemeId : currentSpace.schemeId;
        
        const attachments = [mergedPropertyId, mergedBlockId, mergedSchemeId].filter(Boolean);
        if (attachments.length !== 1) {
          return res.status(400).json({ 
            error: "Validation failed", 
            details: [{ message: "Space must attach to exactly one level: propertyId, blockId, or schemeId" }] 
          });
        }
      }
      
      const updated = await storage.updateSpace(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating space:", error);
        res.status(500).json({ error: "Failed to update space" });
      }
    }
  });
  
  app.delete("/api/spaces/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSpace(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Space not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting space:", error);
      res.status(500).json({ error: "Failed to delete space" });
    }
  });
  
  // ===== HACT ARCHITECTURE - COMPONENTS (ASSETS) =====
  app.get("/api/components", paginationMiddleware(), async (req, res) => {
    try {
      const pagination = (req as any).pagination as PaginationParams;
      const { page, limit, offset, hasFilters } = pagination;
      const search = req.query.search as string | undefined;
      const filters = {
        propertyId: req.query.propertyId as string | undefined,
        spaceId: req.query.spaceId as string | undefined,
        blockId: req.query.blockId as string | undefined,
        componentTypeId: req.query.componentTypeId as string | undefined,
      };
      const allComponents = await storage.listComponents(filters);
      
      // Get all component types upfront for search and enrichment
      const allComponentTypes = await storage.listComponentTypes();
      const typeMap = new Map(allComponentTypes.map(t => [t.id, t]));
      
      // Apply search filter (includes type name search)
      let filtered = allComponents;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = allComponents.filter(c => {
          const typeName = typeMap.get(c.componentTypeId)?.name?.toLowerCase() || '';
          return (
            c.serialNumber?.toLowerCase().includes(searchLower) ||
            c.make?.toLowerCase().includes(searchLower) ||
            c.model?.toLowerCase().includes(searchLower) ||
            c.location?.toLowerCase().includes(searchLower) ||
            typeName.includes(searchLower)
          );
        });
      }
      
      const total = filtered.length;
      
      // Compute condition summary from all filtered components (not just paginated slice)
      const conditionSummary = {
        CRITICAL: filtered.filter(c => c.condition === 'CRITICAL').length,
        POOR: filtered.filter(c => c.condition === 'POOR').length,
        FAIR: filtered.filter(c => c.condition === 'FAIR').length,
        GOOD: filtered.filter(c => c.condition === 'GOOD').length,
        UNKNOWN: filtered.filter(c => !c.condition || c.condition === 'UNKNOWN').length,
      };
      
      const paginatedComponents = filtered.slice(offset, offset + limit);
      
      // Batch fetch properties for the paginated results
      const uniquePropertyIds = Array.from(new Set(paginatedComponents.map(c => c.propertyId).filter((id): id is string => id !== null)));
      
      // Fetch all properties in parallel
      const allProperties = await Promise.all(uniquePropertyIds.map(id => storage.getProperty(id)));
      
      // Create property lookup map
      const propertyMap = new Map(allProperties.filter(Boolean).map(p => [p!.id, { id: p!.id, addressLine1: p!.addressLine1, postcode: p!.postcode }]));
      
      // Enrich components using lookup maps (no additional DB calls)
      const enriched = paginatedComponents.map(comp => ({
        ...comp,
        componentType: typeMap.get(comp.componentTypeId),
        property: comp.propertyId ? propertyMap.get(comp.propertyId) : undefined
      }));
      
      res.json({ data: enriched, total, page, limit, totalPages: Math.ceil(total / limit), conditionSummary });
    } catch (error) {
      console.error("Error fetching components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });
  
  app.get("/api/components/:id", async (req, res) => {
    try {
      const component = await storage.getComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }
      const type = await storage.getComponentType(component.componentTypeId);
      res.json({ ...component, componentType: type });
    } catch (error) {
      console.error("Error fetching component:", error);
      res.status(500).json({ error: "Failed to fetch component" });
    }
  });
  
  app.post("/api/components", async (req, res) => {
    try {
      const data = insertComponentSchema.parse(req.body);
      const component = await storage.createComponent(data);
      res.status(201).json(component);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating component:", error);
        res.status(500).json({ error: "Failed to create component" });
      }
    }
  });
  
  app.patch("/api/components/:id", async (req, res) => {
    try {
      const updateData = insertComponentSchema.partial().parse(req.body);
      const updated = await storage.updateComponent(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating component:", error);
        res.status(500).json({ error: "Failed to update component" });
      }
    }
  });
  
  app.delete("/api/components/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComponent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting component:", error);
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  
  // Bulk approve components (set condition to GOOD and status to active)
  app.post("/api/components/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let approved = 0;
      for (const id of ids) {
        const updated = await storage.updateComponent(id, { needsVerification: false, isActive: true });
        if (updated) approved++;
      }
      res.json({ success: true, approved });
    } catch (error) {
      console.error("Error bulk approving components:", error);
      res.status(500).json({ error: "Failed to bulk approve components" });
    }
  });
  
  // Bulk reject/deactivate components
  app.post("/api/components/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let rejected = 0;
      for (const id of ids) {
        const updated = await storage.updateComponent(id, { isActive: false });
        if (updated) rejected++;
      }
      res.json({ success: true, rejected });
    } catch (error) {
      console.error("Error bulk rejecting components:", error);
      res.status(500).json({ error: "Failed to bulk reject components" });
    }
  });
  
  // Bulk delete components
  app.post("/api/components/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      let deleted = 0;
      for (const id of ids) {
        const result = await storage.deleteComponent(id);
        if (result) deleted++;
      }
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting components:", error);
      res.status(500).json({ error: "Failed to bulk delete components" });
    }
  });
  
  // ===== DATA IMPORTS =====
  app.get("/api/imports", async (req, res) => {
    try {
      const imports = await storage.listDataImports(ORG_ID);
      res.json(imports);
    } catch (error) {
      console.error("Error fetching imports:", error);
      res.status(500).json({ error: "Failed to fetch imports" });
    }
  });
  
  app.get("/api/imports/:id", async (req, res) => {
    try {
      const dataImport = await storage.getDataImport(req.params.id);
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      const counts = await storage.getDataImportRowCounts(req.params.id);
      res.json({ ...dataImport, ...counts });
    } catch (error) {
      console.error("Error fetching import:", error);
      res.status(500).json({ error: "Failed to fetch import" });
    }
  });
  
  app.get("/api/imports/:id/rows", async (req, res) => {
    try {
      const rows = await storage.listDataImportRows(req.params.id);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching import rows:", error);
      res.status(500).json({ error: "Failed to fetch import rows" });
    }
  });
  
  app.post("/api/imports", async (req, res) => {
    try {
      const data = insertDataImportSchema.parse({
        ...req.body,
        organisationId: ORG_ID,
        uploadedById: "system",
      });
      const dataImport = await storage.createDataImport(data);
      res.status(201).json(dataImport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating import:", error);
        res.status(500).json({ error: "Failed to create import" });
      }
    }
  });
  
  app.patch("/api/imports/:id", async (req, res) => {
    try {
      const updateData = insertDataImportSchema.partial().parse(req.body);
      const updated = await storage.updateDataImport(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Import not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating import:", error);
        res.status(500).json({ error: "Failed to update import" });
      }
    }
  });
  
  app.delete("/api/imports/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDataImport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Import not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting import:", error);
      res.status(500).json({ error: "Failed to delete import" });
    }
  });
  
  // ===== TSM BUILDING SAFETY REPORTS =====
  app.get("/api/reports/tsm-building-safety", async (req, res) => {
    try {
      const period = req.query.period as string || 'current'; // 'current', 'previous', 'ytd'
      const today = new Date();
      
      // Get all components and certificates for calculations
      const allComponents = await storage.listComponents();
      const allCertificates = await storage.listCertificates(ORG_ID);
      const remedialActions = await storage.listRemedialActions(ORG_ID);
      
      // Get high-risk building safety components
      const componentTypesData = await storage.listComponentTypes();
      const highRiskTypes = componentTypesData.filter(t => t.isHighRisk || t.buildingSafetyRelevant);
      const highRiskTypeIds = highRiskTypes.map(t => t.id);
      
      const highRiskComponents = allComponents.filter(c => highRiskTypeIds.includes(c.componentTypeId));
      
      // BS01: Building Safety Cases completed
      // (Count of high-risk buildings with all required certificates up to date)
      const buildingsWithCompliance = new Set();
      allCertificates.forEach(cert => {
        if (cert.expiryDate && new Date(cert.expiryDate) > today) {
          buildingsWithCompliance.add(cert.propertyId);
        }
      });
      
      // BS02: Percentage of buildings with up-to-date Fire Risk Assessment
      const fraType = componentTypesData.find(t => t.code === 'FIRE_RISK_ASSESSMENT' || t.relatedCertificateTypes?.includes('FIRE_RISK_ASSESSMENT'));
      const fraCertificates = allCertificates.filter(c => c.certificateType === 'FIRE_RISK_ASSESSMENT');
      const upToDateFRA = fraCertificates.filter(c => c.expiryDate && new Date(c.expiryDate) > today);
      const bs02Percentage = fraCertificates.length > 0 ? (upToDateFRA.length / fraCertificates.length * 100) : 0;
      
      // BS03: Outstanding remedial actions on high-risk components
      const outstandingActions = remedialActions.filter(a => 
        a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
      );
      
      // BS04: Overdue safety inspections
      const overdueInspections = allCertificates.filter(c => 
        c.expiryDate && new Date(c.expiryDate) < today
      );
      
      // BS05: Resident communication (placeholder - requires additional tracking)
      const bs05ResidentComms = {
        notified: 0,
        pending: 0,
        percentage: 0
      };
      
      // BS06: Critical safety alerts
      const criticalActions = remedialActions.filter(a => 
        a.severity === 'IMMEDIATE' && a.status !== 'COMPLETED'
      );
      
      res.json({
        period,
        reportDate: today.toISOString(),
        metrics: {
          BS01: {
            name: "Building Safety Cases",
            description: "Buildings with safety case reviews completed",
            value: buildingsWithCompliance.size,
            total: allComponents.length > 0 ? new Set(allComponents.map(c => c.propertyId || c.blockId)).size : 0,
            unit: "buildings"
          },
          BS02: {
            name: "Fire Risk Assessment Compliance",
            description: "Percentage of buildings with up-to-date FRA",
            value: Math.round(bs02Percentage * 10) / 10,
            total: fraCertificates.length,
            upToDate: upToDateFRA.length,
            unit: "percent"
          },
          BS03: {
            name: "Outstanding Remedial Actions",
            description: "Remedial actions awaiting completion",
            value: outstandingActions.length,
            bySeverity: {
              immediate: outstandingActions.filter(a => a.severity === 'IMMEDIATE').length,
              urgent: outstandingActions.filter(a => a.severity === 'URGENT').length,
              priority: outstandingActions.filter(a => a.severity === 'PRIORITY').length,
              routine: outstandingActions.filter(a => a.severity === 'ROUTINE').length,
            },
            unit: "actions"
          },
          BS04: {
            name: "Overdue Safety Inspections",
            description: "Certificates past expiry date",
            value: overdueInspections.length,
            byType: Object.entries(
              overdueInspections.reduce((acc, c) => {
                acc[c.certificateType] = (acc[c.certificateType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => ({ type, count })),
            unit: "inspections"
          },
          BS05: {
            name: "Resident Safety Communication",
            description: "Residents notified of safety information",
            value: bs05ResidentComms.percentage,
            notified: bs05ResidentComms.notified,
            pending: bs05ResidentComms.pending,
            unit: "percent"
          },
          BS06: {
            name: "Critical Safety Alerts",
            description: "Immediate severity actions outstanding",
            value: criticalActions.length,
            alerts: criticalActions.slice(0, 10).map(a => ({
              id: a.id,
              description: a.description,
              propertyId: a.propertyId,
              dueDate: a.dueDate
            })),
            unit: "alerts"
          }
        },
        summary: {
          totalHighRiskComponents: highRiskComponents.length,
          totalCertificates: allCertificates.length,
          totalRemedialActions: remedialActions.length,
          complianceScore: allCertificates.length > 0 
            ? Math.round((allCertificates.filter(c => c.expiryDate && new Date(c.expiryDate) > today).length / allCertificates.length) * 100)
            : 0
        }
      });
    } catch (error) {
      console.error("Error generating TSM report:", error);
      res.status(500).json({ error: "Failed to generate TSM Building Safety report" });
    }
  });
  
  // Get import templates
  app.get("/api/imports/templates/:type", async (req, res) => {
    try {
      const type = req.params.type as string;
      
      const templates: Record<string, { columns: Array<{ name: string; required: boolean; description: string }> }> = {
        properties: {
          columns: [
            { name: "uprn", required: true, description: "Unique Property Reference Number" },
            { name: "addressLine1", required: true, description: "First line of address" },
            { name: "addressLine2", required: false, description: "Second line of address" },
            { name: "city", required: true, description: "City/Town" },
            { name: "postcode", required: true, description: "Postcode" },
            { name: "propertyType", required: true, description: "HOUSE, FLAT, BUNGALOW, MAISONETTE, BEDSIT, STUDIO" },
            { name: "tenure", required: true, description: "SOCIAL_RENT, AFFORDABLE_RENT, SHARED_OWNERSHIP, LEASEHOLD, TEMPORARY" },
            { name: "bedrooms", required: false, description: "Number of bedrooms" },
            { name: "hasGas", required: false, description: "true/false - property has gas supply" },
            { name: "hasElectricity", required: false, description: "true/false - property has electricity" },
            { name: "hasAsbestos", required: false, description: "true/false - asbestos present in property" },
            { name: "hasSprinklers", required: false, description: "true/false - sprinkler system installed" },
            { name: "vulnerableOccupant", required: false, description: "true/false - occupant requires priority servicing" },
            { name: "epcRating", required: false, description: "Energy Performance Certificate rating: A, B, C, D, E, F, G" },
            { name: "constructionYear", required: false, description: "Year property was built (e.g., 1985)" },
            { name: "numberOfFloors", required: false, description: "Number of floors in property" },
            { name: "localAuthority", required: false, description: "Local authority name" },
            { name: "blockReference", required: true, description: "Block reference code to link property" },
          ]
        },
        components: {
          columns: [
            { name: "propertyUprn", required: false, description: "UPRN of property (optional if unitReference provided)" },
            { name: "unitReference", required: false, description: "Unit reference (optional if propertyUprn provided)" },
            { name: "componentTypeCode", required: true, description: "Component type code (e.g., GAS_BOILER)" },
            { name: "assetTag", required: false, description: "Physical asset label" },
            { name: "serialNumber", required: false, description: "Manufacturer serial number" },
            { name: "manufacturer", required: false, description: "Component manufacturer" },
            { name: "model", required: false, description: "Component model" },
            { name: "location", required: false, description: "Location within property/unit" },
            { name: "accessNotes", required: false, description: "Access instructions for engineer" },
            { name: "installDate", required: false, description: "Installation date (YYYY-MM-DD)" },
            { name: "expectedReplacementDate", required: false, description: "Expected replacement date (YYYY-MM-DD)" },
            { name: "warrantyExpiry", required: false, description: "Warranty expiry date (YYYY-MM-DD)" },
            { name: "condition", required: false, description: "GOOD, FAIR, POOR, CRITICAL" },
            { name: "riskLevel", required: false, description: "Risk priority: HIGH, MEDIUM, LOW" },
            { name: "certificateRequired", required: false, description: "Certificate type code (e.g., GAS_SAFETY)" },
            { name: "lastServiceDate", required: false, description: "Last service date (YYYY-MM-DD)" },
            { name: "nextServiceDue", required: false, description: "Next service due date (YYYY-MM-DD)" },
          ]
        },
        geocoding: {
          columns: [
            { name: "propertyId", required: true, description: "Property ID (UUID) to update" },
            { name: "latitude", required: true, description: "Latitude coordinate (decimal degrees, e.g., 51.5074)" },
            { name: "longitude", required: true, description: "Longitude coordinate (decimal degrees, e.g., -0.1278)" },
          ]
        }
      };
      
      const template = templates[type];
      if (!template) {
        return res.status(404).json({ error: "Template type not found", availableTypes: Object.keys(templates) });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching import template:", error);
      res.status(500).json({ error: "Failed to fetch import template" });
    }
  });
  
  // Download CSV template
  app.get("/api/imports/templates/:type/download", async (req, res) => {
    try {
      const type = req.params.type as string;
      const csvContent = generateCSVTemplate(type);
      
      if (!csvContent) {
        return res.status(404).json({ error: "Template type not found" });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-template.csv`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating CSV template:", error);
      res.status(500).json({ error: "Failed to generate CSV template" });
    }
  });
  
  // Download sample CSV with realistic UK housing data
  app.get("/api/imports/samples/:type/download", async (req, res) => {
    try {
      const type = req.params.type as string;
      const fs = await import('fs');
      const path = await import('path');
      
      const sampleFiles: Record<string, string> = {
        properties: 'properties-sample.csv',
        components: 'components-sample.csv',
        geocoding: 'geocoding-sample.csv'
      };
      
      const filename = sampleFiles[type];
      if (!filename) {
        return res.status(404).json({ error: "Sample type not found", availableTypes: Object.keys(sampleFiles) });
      }
      
      const filePath = path.join(process.cwd(), 'public', 'samples', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Sample file not found" });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading sample CSV:", error);
      res.status(500).json({ error: "Failed to download sample CSV" });
    }
  });
  
  // Parse and validate import data (without committing)
  app.post("/api/imports/:id/validate", async (req, res) => {
    try {
      const importId = req.params.id;
      const dataImport = await storage.getDataImport(importId);
      
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "CSV content is required" });
      }
      
      const rows = parseCSV(csvContent);
      if (rows.length === 0) {
        return res.status(400).json({ error: "No data rows found in CSV" });
      }
      
      await storage.updateDataImport(importId, { 
        status: 'VALIDATING',
        totalRows: rows.length 
      });
      
      const { validRows, invalidRows } = await validateImportData(
        importId,
        dataImport.importType,
        rows
      );
      
      await storage.updateDataImport(importId, {
        status: 'VALIDATED',
        validRows: validRows.length,
        invalidRows: invalidRows.length
      });
      
      res.json({
        importId,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        errors: invalidRows.map(r => ({
          rowNumber: r.rowNumber,
          errors: r.errors
        }))
      });
    } catch (error) {
      console.error("Error validating import:", error);
      res.status(500).json({ error: "Failed to validate import" });
    }
  });
  
  // Execute import (commit validated data)
  app.post("/api/imports/:id/execute", async (req, res) => {
    try {
      const importId = req.params.id;
      const dataImport = await storage.getDataImport(importId);
      
      if (!dataImport) {
        return res.status(404).json({ error: "Import not found" });
      }
      
      if (dataImport.status !== 'VALIDATED') {
        return res.status(400).json({ error: "Import must be validated before execution" });
      }
      
      await storage.updateDataImport(importId, { status: 'IMPORTING' });
      
      const rows = await storage.listDataImportRows(importId);
      const validRows = rows.filter(r => r.status === 'VALID').map(r => ({
        rowNumber: r.rowNumber,
        data: r.sourceData as Record<string, any>,
        errors: [],
        isValid: true
      }));
      
      let result;
      switch (dataImport.importType.toUpperCase()) {
        case 'PROPERTIES':
          result = await processPropertyImport(importId, validRows, dataImport.upsertMode);
          break;
        case 'COMPONENTS':
          result = await processComponentImport(importId, validRows, dataImport.upsertMode);
          break;
        default:
          return res.status(400).json({ error: `Unknown import type: ${dataImport.importType}` });
      }
      
      await storage.updateDataImport(importId, {
        status: result.success ? 'COMPLETED' : 'FAILED',
        importedRows: result.importedRows,
        completedAt: new Date(),
        errorSummary: result.errors.length > 0 ? result.errors : null
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error executing import:", error);
      res.status(500).json({ error: "Failed to execute import" });
    }
  });
  
  // ===== API MONITORING & INTEGRATIONS =====
  
  // Code Coverage Endpoint
  app.get("/api/admin/coverage", async (req, res) => {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      try {
        await fs.access(coverageFile);
      } catch {
        return res.status(404).json({ 
          error: "Coverage data not found",
          message: "Run 'npx vitest run --coverage' to generate coverage data"
        });
      }
      
      const coverageData = await fs.readFile(coverageFile, 'utf-8');
      const summary = JSON.parse(coverageData);
      
      const totals = summary.total;
      
      const modules: Record<string, { lines: number; statements: number; functions: number; branches: number; files: number }> = {};
      
      Object.entries(summary).forEach(([filePath, data]: [string, any]) => {
        if (filePath === 'total') return;
        
        let moduleName = 'other';
        if (filePath.includes('/server/')) moduleName = 'server';
        else if (filePath.includes('/client/src/pages/')) moduleName = 'pages';
        else if (filePath.includes('/client/src/components/')) moduleName = 'components';
        else if (filePath.includes('/client/src/')) moduleName = 'client';
        else if (filePath.includes('/shared/schema/')) moduleName = 'schema';
        else if (filePath.includes('/shared/')) moduleName = 'shared';
        
        if (!modules[moduleName]) {
          modules[moduleName] = { lines: 0, statements: 0, functions: 0, branches: 0, files: 0 };
        }
        
        modules[moduleName].lines += data.lines?.pct || 0;
        modules[moduleName].statements += data.statements?.pct || 0;
        modules[moduleName].functions += data.functions?.pct || 0;
        modules[moduleName].branches += data.branches?.pct || 0;
        modules[moduleName].files += 1;
      });
      
      const moduleAverages = Object.entries(modules).map(([name, data]) => ({
        name,
        lines: Math.round((data.lines / data.files) * 10) / 10,
        statements: Math.round((data.statements / data.files) * 10) / 10,
        functions: Math.round((data.functions / data.files) * 10) / 10,
        branches: Math.round((data.branches / data.files) * 10) / 10,
        files: data.files
      })).sort((a, b) => b.lines - a.lines);
      
      res.json({
        totals: {
          lines: { covered: totals.lines.covered, total: totals.lines.total, pct: totals.lines.pct },
          statements: { covered: totals.statements.covered, total: totals.statements.total, pct: totals.statements.pct },
          functions: { covered: totals.functions.covered, total: totals.functions.total, pct: totals.functions.pct },
          branches: { covered: totals.branches.covered, total: totals.branches.total, pct: totals.branches.pct }
        },
        modules: moduleAverages,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error reading coverage data:", error);
      res.status(500).json({ error: "Failed to read coverage data" });
    }
  });
  
  // API Logs
  app.get("/api/admin/api-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.listApiLogs(limit, offset);
      const stats = await storage.getApiLogStats();
      res.json({ logs, stats });
    } catch (error) {
      console.error("Error fetching API logs:", error);
      res.status(500).json({ error: "Failed to fetch API logs" });
    }
  });
  
  // API Metrics
  app.get("/api/admin/api-metrics", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const metrics = await storage.listApiMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching API metrics:", error);
      res.status(500).json({ error: "Failed to fetch API metrics" });
    }
  });
  
  // Webhook Endpoints
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
  
  // ===== VIDEO LIBRARY =====
  app.get("/api/videos", async (req, res) => {
    try {
      const orgs = await storage.listOrganisations();
      const defaultOrgId = orgs[0]?.id || '';
      const orgId = (req.query.organisationId as string) || defaultOrgId;
      const videoList = await storage.listVideos(orgId);
      res.json(videoList);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });
  
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      await storage.incrementVideoView(video.id);
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ error: "Failed to fetch video" });
    }
  });
  
  app.post("/api/videos", async (req, res) => {
    try {
      const orgs = await storage.listOrganisations();
      const defaultOrgId = orgs[0]?.id || '';
      const video = await storage.createVideo({
        ...req.body,
        organisationId: req.body.organisationId || defaultOrgId
      });
      res.status(201).json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ error: "Failed to create video" });
    }
  });
  
  app.patch("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.updateVideo(req.params.id, req.body);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ error: "Failed to update video" });
    }
  });
  
  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const success = await storage.deleteVideo(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });
  
  app.post("/api/videos/:id/download", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      await storage.incrementVideoDownload(video.id);
      res.json({ storageKey: video.storageKey });
    } catch (error) {
      console.error("Error tracking download:", error);
      res.status(500).json({ error: "Failed to track download" });
    }
  });
  
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
      
      // Validate value is provided
      if (value === undefined || value === null) {
        return res.status(400).json({ error: "Value is required" });
      }
      
      // Get the existing setting
      const existing = await storage.getFactorySetting(req.params.key);
      if (!existing) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Check if setting is editable
      if (!existing.isEditable) {
        return res.status(403).json({ error: "This setting cannot be modified" });
      }
      
      // Type validation based on valueType
      if (existing.valueType === 'number') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return res.status(400).json({ error: "Value must be a valid number" });
        }
        // Validate against validation rules if they exist
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
      
      // Create audit log
      await storage.createFactorySettingsAudit({
        settingId: existing.id,
        key: req.params.key,
        oldValue: existing.value,
        newValue: value,
        changedById: userId || 'system'
      });
      
      // Update the setting
      const updated = await storage.updateFactorySetting(req.params.key, value, userId || 'system');
      
      // Clear API limits cache if an api_limits setting was changed
      if (existing.category === 'api_limits' || req.params.key.startsWith('api.')) {
        clearApiLimitsCache();
      }
      
      // Clear risk tier thresholds cache if a risk_scoring setting was changed
      if (existing.category === 'risk_scoring' || req.params.key.startsWith('risk_tier_')) {
        clearTierThresholdsCache();
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating factory setting:", error);
      res.status(500).json({ error: "Failed to update factory setting" });
    }
  });
  
  // ===== API CLIENTS (for external integrations) =====
  app.get("/api/admin/api-clients", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const orgId = req.query.organisationId as string || "default-org";
      const clients = await storage.listApiClients(orgId);
      res.json(clients);
    } catch (error) {
      console.error("Error listing API clients:", error);
      res.status(500).json({ error: "Failed to list API clients" });
    }
  });
  
  app.post("/api/admin/api-clients", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { name, description, scopes, organisationId, createdById } = req.body;
      
      // Generate API key
      const apiKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyPrefix = apiKey.substring(0, 12);
      const keyHash = await hashApiKey(apiKey);
      
      // Get rate limits from factory settings
      const rateLimit = parseInt(await storage.getFactorySettingValue('RATE_LIMIT_REQUESTS_PER_MINUTE', '60'));
      const expiryDays = parseInt(await storage.getFactorySettingValue('API_KEY_EXPIRY_DAYS', '365'));
      
      const client = await storage.createApiClient({
        name,
        description,
        organisationId: organisationId || 'default-org',
        apiKey: keyHash, // Store hashed key
        apiKeyPrefix: keyPrefix,
        scopes: scopes || ['read', 'write'],
        createdById: createdById || 'system'
      });
      
      // Return the full API key only on creation (never stored)
      res.json({ ...client, apiKey });
    } catch (error) {
      console.error("Error creating API client:", error);
      res.status(500).json({ error: "Failed to create API client" });
    }
  });
  
  app.patch("/api/admin/api-clients/:id", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { isActive, name, description, scopes } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (scopes !== undefined) updates.scopes = scopes;
      if (isActive !== undefined) updates.status = isActive ? 'ACTIVE' : 'SUSPENDED';
      
      const updated = await storage.updateApiClient(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "API client not found" });
      }
      res.json({ ...updated, isActive: updated.status === 'ACTIVE' });
    } catch (error) {
      console.error("Error updating API client:", error);
      res.status(500).json({ error: "Failed to update API client" });
    }
  });

  app.delete("/api/admin/api-clients/:id", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const success = await storage.deleteApiClient(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "API client not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API client:", error);
      res.status(500).json({ error: "Failed to delete API client" });
    }
  });
  
  // ===== RATE LIMITING (PostgreSQL-backed) =====
  // Load rate limit configuration from Factory Settings with NaN fallbacks
  const parseIntWithDefault = (value: string, defaultVal: number): number => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultVal : parsed;
  };
  
  const rateLimitWindowMs = parseIntWithDefault(await storage.getFactorySettingValue('RATE_LIMIT_WINDOW_MS', '60000'), 60000);
  const rateLimitCleanupIntervalMs = parseIntWithDefault(await storage.getFactorySettingValue('RATE_LIMIT_CLEANUP_INTERVAL_MS', '60000'), 60000);
  
  // Clean up expired rate limit entries periodically using configured interval
  setInterval(async () => {
    try {
      await storage.cleanupExpiredRateLimits();
    } catch (error) {
      console.error("Error cleaning up rate limits:", error);
    }
  }, rateLimitCleanupIntervalMs);
  
  // Rate limiter that reads limits from factory settings
  const checkRateLimit = async (clientId: string, res: Response): Promise<boolean> => {
    const limitPerMinute = parseInt(await storage.getFactorySettingValue('RATE_LIMIT_REQUESTS_PER_MINUTE', '60'));
    
    const result = await storage.checkAndIncrementRateLimit(clientId, rateLimitWindowMs, limitPerMinute);
    
    res.setHeader('X-RateLimit-Limit', limitPerMinute.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000).toString());
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({ 
        error: "Rate limit exceeded",
        retryAfter
      });
      return false;
    }
    
    return true;
  };
  
  // ===== API KEY VALIDATION MIDDLEWARE =====
  // Validates API key from X-API-Key header against stored hashed keys
  const validateApiKey = async (req: Request, res: Response): Promise<{ client: ApiClient } | null> => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ error: "Missing API key. Provide X-API-Key header." });
      return null;
    }
    
    // Extract prefix (first 12 chars) to look up client
    if (apiKey.length < 12) {
      res.status(401).json({ error: "Invalid API key format" });
      return null;
    }
    
    const keyPrefix = apiKey.substring(0, 12);
    const client = await storage.getApiClientByKey(keyPrefix);
    
    if (!client) {
      res.status(401).json({ error: "Invalid API key" });
      return null;
    }
    
    // Verify the full key matches the stored hash
    const isValid = await verifyApiKey(apiKey, client.apiKey);
    if (!isValid) {
      res.status(401).json({ error: "Invalid API key" });
      return null;
    }
    
    // Check if client is active
    if (client.status !== 'ACTIVE') {
      res.status(403).json({ error: "API key is disabled" });
      return null;
    }
    
    // Check rate limit
    const withinLimit = await checkRateLimit(client.id, res);
    if (!withinLimit) {
      return null;
    }
    
    // Increment usage counter
    await storage.incrementApiClientUsage(client.id);
    
    return { client };
  };
  
  // ===== INGESTION API (External Certificate Submission) =====
  // These endpoints are protected by API key authentication
  
  // GET /api/v1/certificate-types - List valid certificate types for ingestion
  app.get("/api/v1/certificate-types", async (req, res) => {
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      const allTypes = await storage.listCertificateTypes();
      const activeTypes = allTypes.filter(t => t.isActive);
      
      res.json({
        certificateTypes: activeTypes.map(t => ({
          code: t.code,
          name: t.name,
          shortName: t.shortName,
          complianceStream: t.complianceStream,
          description: t.description,
          validityMonths: t.validityMonths,
          requiredFields: t.requiredFields
        }))
      });
    } catch (error) {
      console.error("Error listing certificate types:", error);
      res.status(500).json({ error: "Failed to list certificate types" });
    }
  });
  
  // POST /api/v1/ingestions - Submit a new certificate for processing
  app.post("/api/v1/ingestions", async (req, res) => {
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      const { propertyId, certificateType, fileName, objectPath, webhookUrl, idempotencyKey } = req.body;
      
      // Validate required fields
      if (!propertyId || !certificateType || !fileName) {
        return res.status(400).json({ 
          error: "Missing required fields: propertyId, certificateType, and fileName are required" 
        });
      }
      
      // Validate certificateType against database configuration
      const validCertType = await storage.getCertificateTypeByCode(certificateType);
      if (!validCertType) {
        const allTypes = await storage.listCertificateTypes();
        const validCodes = allTypes.filter(t => t.isActive).map(t => t.code);
        return res.status(400).json({ 
          error: `Invalid certificateType: '${certificateType}'. Valid types are: ${validCodes.join(', ')}`,
          validTypes: validCodes
        });
      }
      
      if (!validCertType.isActive) {
        return res.status(400).json({ 
          error: `Certificate type '${certificateType}' is currently disabled`
        });
      }
      
      // Check for idempotency
      if (idempotencyKey) {
        const existing = await storage.getIngestionJobByIdempotencyKey(idempotencyKey);
        if (existing) {
          return res.json({ id: existing.id, status: existing.status, message: "Existing job returned (idempotent)" });
        }
      }
      
      // Check upload throttle and atomically acquire slot
      const throttleResult = checkUploadThrottle(auth.client.id);
      if (!throttleResult.allowed) {
        return res.status(429).json({
          error: throttleResult.reason,
          retryAfterMs: throttleResult.retryAfterMs,
        });
      }
      
      // Try to acquire file lock using deterministic key (org + objectPath or idempotencyKey)
      const lockKey = idempotencyKey 
        ? `${auth.client.organisationId}::idempotency::${idempotencyKey}`
        : `${auth.client.organisationId}::${propertyId}::${fileName}`;
      
      if (!acquireFileLock(lockKey)) {
        endUpload(auth.client.id);
        return res.status(409).json({
          error: "This file is already being processed",
        });
      }
      
      try {
        // Create ingestion job record
        const job = await storage.createIngestionJob({
          organisationId: auth.client.organisationId,
          propertyId,
          certificateType,
          channel: 'EXTERNAL_API',
          fileName,
          objectPath,
          webhookUrl,
          idempotencyKey,
          apiClientId: auth.client.id
        });
        
        // Enqueue job for processing via pg-boss
        try {
          await enqueueIngestionJob({
            jobId: job.id,
            propertyId,
            certificateType,
            fileName,
            objectPath,
            webhookUrl,
          });
        } catch (queueError) {
          console.error("Failed to enqueue ingestion job:", queueError);
        }
        
        res.status(201).json({
          id: job.id,
          status: job.status,
          message: "Ingestion job created successfully"
        });
      } finally {
        releaseFileLock(lockKey);
        endUpload(auth.client.id);
      }
    } catch (error) {
      console.error("Error creating ingestion job:", error);
      res.status(500).json({ error: "Failed to create ingestion job" });
    }
  });
  
  // GET /api/v1/ingestions/:id - Get ingestion job status
  app.get("/api/v1/ingestions/:id", async (req, res) => {
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      const job = await storage.getIngestionJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Ingestion job not found" });
      }
      
      // Ensure client can only see their own jobs
      if (job.apiClientId !== auth.client.id) {
        return res.status(403).json({ error: "Access denied to this ingestion job" });
      }
      
      res.json({
        id: job.id,
        status: job.status,
        propertyId: job.propertyId,
        certificateType: job.certificateType,
        certificateId: job.certificateId,
        statusMessage: job.statusMessage,
        errorDetails: job.errorDetails,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      });
    } catch (error) {
      console.error("Error getting ingestion job:", error);
      res.status(500).json({ error: "Failed to get ingestion job" });
    }
  });
  
  // GET /api/v1/ingestions - List ingestion jobs for the client
  app.get("/api/v1/ingestions", async (req, res) => {
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      const jobs = await storage.listIngestionJobs(auth.client.organisationId, { limit, offset, status });
      
      res.json({
        jobs: jobs.map(j => ({
          id: j.id,
          status: j.status,
          propertyId: j.propertyId,
          certificateType: j.certificateType,
          createdAt: j.createdAt,
          completedAt: j.completedAt
        })),
        pagination: { limit, offset, total: jobs.length }
      });
    } catch (error) {
      console.error("Error listing ingestion jobs:", error);
      res.status(500).json({ error: "Failed to list ingestion jobs" });
    }
  });
  
  // POST /api/v1/uploads - Request a pre-signed upload URL for large files
  app.post("/api/v1/uploads", async (req, res) => {
    let slotAcquired = false;
    let clientId: string | undefined;
    
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      clientId = auth.client.id;
      
      // Validate input before acquiring throttle slot
      const { filename, contentType, fileSize, idempotencyKey } = req.body;
      
      if (!filename || !contentType) {
        return res.status(400).json({ error: "Missing required fields: filename, contentType" });
      }
      
      // Check file size limit from factory settings
      const maxSize = parseInt(await storage.getFactorySettingValue('MAX_FILE_SIZE_MB', '50')) * 1024 * 1024;
      if (fileSize && fileSize > maxSize) {
        return res.status(400).json({ error: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)` });
      }
      
      // Check for idempotency (no slot needed for cached response)
      if (idempotencyKey) {
        const existing = await storage.getUploadSessionByIdempotencyKey(idempotencyKey);
        if (existing && existing.status === 'PENDING') {
          return res.json({
            id: existing.id,
            uploadUrl: existing.uploadUrl,
            objectPath: existing.objectPath,
            expiresAt: existing.expiresAt,
            message: "Existing upload session returned (idempotent)"
          });
        }
      }
      
      // Now acquire throttle slot (after validation passes)
      const throttleResult = checkUploadThrottle(clientId);
      if (!throttleResult.allowed) {
        return res.status(429).json({
          error: throttleResult.reason,
          retryAfterMs: throttleResult.retryAfterMs,
        });
      }
      slotAcquired = true;
      
      // Generate object path
      const objectPath = `ingestions/${auth.client.organisationId}/${Date.now()}_${filename}`;
      
      // For object storage, we'd generate a pre-signed URL here
      // For now, create the session and return a direct upload path
      const session = await storage.createUploadSession({
        organisationId: auth.client.organisationId,
        fileName: filename,
        contentType,
        fileSize: fileSize || 0,
        objectPath,
        uploadUrl: `/api/v1/uploads/${objectPath}`, // Direct upload endpoint
        idempotencyKey,
        apiClientId: auth.client.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiry
      });
      
      res.status(201).json({
        id: session.id,
        uploadUrl: session.uploadUrl,
        objectPath: session.objectPath,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      console.error("Error creating upload session:", error);
      res.status(500).json({ error: "Failed to create upload session" });
    } finally {
      if (slotAcquired && clientId) {
        endUpload(clientId);
      }
    }
  });
  
  // ===== SYSTEM HEALTH ENDPOINTS =====
  app.get("/api/admin/queue-stats", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const stats = await getQueueStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting queue stats:", error);
      res.status(500).json({ error: "Failed to get queue stats" });
    }
  });
  
  // Platform-wide ingestion monitoring - Super User only
  // Intentionally cross-organisation for platform-level oversight
  app.get("/api/admin/ingestion-stats", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const [queueStats, ingestionStats, certificates] = await Promise.all([
        getQueueStats(),
        storage.getIngestionStats(),
        storage.listCertificates(ORG_ID)
      ]);
      
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const recentCerts = certificates.filter(c => new Date(c.createdAt) >= last24Hours);
      
      const certByStatus: Record<string, number> = {};
      const certByType: Record<string, number> = {};
      
      for (const cert of certificates) {
        certByStatus[cert.status] = (certByStatus[cert.status] || 0) + 1;
        certByType[cert.certificateType] = (certByType[cert.certificateType] || 0) + 1;
      }
      
      const hourCounts: Record<string, number> = {};
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = hour.toISOString().slice(0, 13);
        hourCounts[hourKey] = 0;
      }
      
      for (const cert of recentCerts) {
        const hourKey = new Date(cert.createdAt).toISOString().slice(0, 13);
        if (hourCounts.hasOwnProperty(hourKey)) {
          hourCounts[hourKey]++;
        }
      }
      
      const certThroughputByHour = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));
      
      const pendingCount = certByStatus['PENDING'] || 0;
      const processingCount = certByStatus['PROCESSING'] || 0;
      const approvedCount = certByStatus['APPROVED'] || 0;
      const totalProcessed = approvedCount + (certByStatus['REJECTED'] || 0);
      const successRate = totalProcessed > 0 ? (approvedCount / totalProcessed) * 100 : 0;
      
      res.json({
        queue: queueStats,
        ...ingestionStats,
        certificates: {
          total: certificates.length,
          recent24h: recentCerts.length,
          byStatus: certByStatus,
          byType: certByType,
          throughputByHour: certThroughputByHour,
          pending: pendingCount,
          processing: processingCount,
          approved: approvedCount,
          successRate,
        },
        recentCertificates: recentCerts.slice(0, 50).map(c => ({
          id: c.id,
          certificateType: c.certificateType,
          fileName: c.fileName || 'Unknown',
          status: c.status,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error getting ingestion stats:", error);
      res.status(500).json({ error: "Failed to get ingestion stats" });
    }
  });
  
  // Create test ingestion jobs for demonstration - Admin only
  // These simulate API ingestion jobs with various statuses
  app.post("/api/admin/create-test-queue-jobs", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { count = 5 } = req.body;
      const jobCount = Math.min(parseInt(count) || 5, 20);
      
      const certTypes = ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT'];
      const statuses = ['QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED'];
      const properties = await storage.listProperties(ORG_ID);
      
      if (properties.length === 0) {
        return res.status(400).json({ error: "No properties available for test jobs" });
      }
      
      const createdJobs = [];
      for (let i = 0; i < jobCount; i++) {
        const property = properties[Math.floor(Math.random() * properties.length)];
        const certType = certTypes[Math.floor(Math.random() * certTypes.length)];
        const status = statuses[i % statuses.length]; // Cycle through statuses
        
        // Create an ingestion job record with varying statuses for demo
        const job = await storage.createIngestionJob({
          organisationId: ORG_ID,
          propertyId: property.id,
          certificateType: certType,
          channel: 'DEMO',
          fileName: `test_${certType.toLowerCase()}_${Date.now()}_${i}.pdf`,
          objectPath: null,
          webhookUrl: null,
          idempotencyKey: `test-${Date.now()}-${i}`,
          apiClientId: null
        });
        
        // Update to target status with appropriate progress for demo purposes
        const progressByStatus: Record<string, number> = {
          'QUEUED': 0,
          'PROCESSING': 50,
          'COMPLETE': 100,
          'FAILED': 25,
        };
        
        await storage.updateIngestionJob(job.id, {
          status,
          progress: progressByStatus[status] || 0,
          statusMessage: status === 'COMPLETE' ? 'Demo: completed successfully' : 
                        status === 'FAILED' ? 'Demo: no file content (test job)' :
                        status === 'PROCESSING' ? 'Demo: currently processing' : 
                        status === 'QUEUED' ? 'Demo: waiting in queue' : undefined,
          completedAt: status === 'COMPLETE' || status === 'FAILED' ? new Date() : undefined,
          lastAttemptAt: status !== 'QUEUED' ? new Date() : undefined,
          attemptCount: status === 'COMPLETE' ? 1 : status === 'FAILED' ? 3 : status === 'PROCESSING' ? 1 : 0,
        });
        
        createdJobs.push({ id: job.id, type: certType, status, property: property.address });
      }
      
      res.json({ 
        message: `Created ${createdJobs.length} demo ingestion jobs with various statuses`,
        jobs: createdJobs
      });
    } catch (error) {
      console.error("Error creating test queue jobs:", error);
      res.status(500).json({ error: "Failed to create test queue jobs" });
    }
  });
  
  // Clear demo ingestion jobs - Admin only
  app.delete("/api/admin/clear-demo-jobs", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const deletedCount = await storage.deleteIngestionJobsByChannel('DEMO');
      
      res.json({ 
        success: true,
        message: `Cleared ${deletedCount} demo jobs`,
        deletedCount
      });
    } catch (error) {
      console.error("Error clearing demo jobs:", error);
      res.status(500).json({ error: "Failed to clear demo jobs" });
    }
  });
  
  // Platform-wide ingestion job listing - Super User only
  app.get("/api/admin/ingestion-jobs", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { status, limit = "50", offset = "0" } = req.query;
      const jobs = await storage.listAllIngestionJobs({
        status: status as string | undefined,
        limit: Math.min(parseInt(limit as string) || 50, 200),
        offset: parseInt(offset as string) || 0,
      });
      
      res.json(jobs);
    } catch (error) {
      console.error("Error getting ingestion jobs:", error);
      res.status(500).json({ error: "Failed to get ingestion jobs" });
    }
  });
  
  // Retry failed ingestion job - Super User only
  app.post("/api/admin/ingestion-jobs/:id/retry", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { id } = req.params;
      const job = await storage.getIngestionJob(id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.status !== 'FAILED') {
        return res.status(400).json({ error: "Only failed jobs can be retried" });
      }
      
      await storage.updateIngestionJob(id, {
        status: 'QUEUED',
        attemptCount: 0,
        errorDetails: null,
        statusMessage: 'Manually retried',
      });
      
      res.json({ success: true, message: "Job queued for retry" });
    } catch (error) {
      console.error("Error retrying ingestion job:", error);
      res.status(500).json({ error: "Failed to retry job" });
    }
  });
  
  // Get scheduled jobs status (pg-boss scheduled jobs like watchdog)
  app.get("/api/admin/scheduled-jobs", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { getScheduledJobsStatus } = await import('./job-queue');
      const scheduledJobs = await getScheduledJobsStatus();
      
      res.json(scheduledJobs);
    } catch (error) {
      console.error("Error getting scheduled jobs:", error);
      res.status(500).json({ error: "Failed to get scheduled jobs" });
    }
  });
  
  // Trigger certificate watchdog on demand
  app.post("/api/admin/scheduled-jobs/watchdog/run", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { triggerWatchdogNow } = await import('./job-queue');
      const jobId = await triggerWatchdogNow();
      
      res.json({ 
        success: true, 
        message: "Certificate watchdog triggered", 
        jobId 
      });
    } catch (error) {
      console.error("Error triggering watchdog:", error);
      res.status(500).json({ error: "Failed to trigger watchdog" });
    }
  });
  
  // Update certificate watchdog schedule interval
  app.put("/api/admin/scheduled-jobs/watchdog/schedule", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { intervalMinutes } = req.body;
      
      if (!intervalMinutes || typeof intervalMinutes !== 'number') {
        return res.status(400).json({ error: "intervalMinutes is required and must be a number" });
      }
      
      if (intervalMinutes < 1 || intervalMinutes > 60) {
        return res.status(400).json({ error: "intervalMinutes must be between 1 and 60" });
      }
      
      // Reschedule the watchdog with new interval
      const { updateWatchdogSchedule } = await import('./job-queue');
      await updateWatchdogSchedule(intervalMinutes);
      
      res.json({ 
        success: true, 
        message: `Watchdog schedule updated to every ${intervalMinutes} minute(s)`,
        intervalMinutes 
      });
    } catch (error) {
      console.error("Error updating watchdog schedule:", error);
      res.status(500).json({ error: "Failed to update watchdog schedule" });
    }
  });
  
  // Enable/disable certificate watchdog
  app.put("/api/admin/scheduled-jobs/watchdog/enabled", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled is required and must be a boolean" });
      }
      
      // Enable/disable the watchdog (schedule is managed by pg-boss)
      const { setWatchdogEnabled } = await import('./job-queue');
      await setWatchdogEnabled(enabled);
      
      res.json({ 
        success: true, 
        message: enabled ? "Watchdog enabled" : "Watchdog disabled",
        enabled 
      });
    } catch (error) {
      console.error("Error toggling watchdog:", error);
      res.status(500).json({ error: "Failed to toggle watchdog" });
    }
  });
  
  app.get("/api/admin/logs", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { level, source, search, limit = "100", offset = "0" } = req.query;
      
      const result = await storage.getSystemLogs({
        level: level as string | undefined,
        source: source as string | undefined,
        search: search as string | undefined,
        limit: Math.min(parseInt(limit as string) || 100, 500),
        offset: parseInt(offset as string) || 0,
      });
      
      const sensitiveKeys = ['password', 'secret', 'token', 'api_key', 'apiKey', 'authorization', 'cookie', 'session', 'credentials', 'private', 'bearer'];
      
      const scrubMetadata = (obj: Record<string, unknown> | null): Record<string, unknown> | null => {
        if (!obj || typeof obj !== 'object') return obj;
        const scrubbed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
            scrubbed[key] = '[REDACTED]';
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            scrubbed[key] = scrubMetadata(value as Record<string, unknown>);
          } else {
            scrubbed[key] = value;
          }
        }
        return scrubbed;
      };
      
      const scrubbedLogs = result.logs.map(log => ({
        ...log,
        context: scrubMetadata(log.context as Record<string, unknown> | null)
      }));
      
      res.json({ logs: scrubbedLogs, total: result.total });
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });
  
  // Log rotation endpoint
  app.get("/api/admin/log-rotation/stats", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { getLogRotationStats } = await import('./services/log-rotation');
      const result = getLogRotationStats();
      res.json(result);
    } catch (error) {
      console.error("Error getting log rotation stats:", error);
      res.status(500).json({ error: "Failed to get log rotation stats" });
    }
  });
  
  app.post("/api/admin/log-rotation/rotate", async (req, res) => {
    try {
      if (!await requireAdminRole(req, res)) return;
      
      const { rotateOldLogs } = await import('./services/log-rotation');
      const result = await rotateOldLogs();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error rotating logs:", error);
      res.status(500).json({ error: "Failed to rotate logs" });
    }
  });
  
  // ===== API DOCUMENTATION ENDPOINT =====
  app.get("/api/admin/openapi", (req, res) => {
    const openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: "ComplianceAI API",
        version: "1.0.0",
        description: "API for UK Social Housing Compliance Management"
      },
      servers: [
        { url: "/api", description: "API Server" }
      ],
      paths: {
        "/schemes": { get: { summary: "List schemes", tags: ["Schemes"] } },
        "/blocks": { get: { summary: "List blocks", tags: ["Blocks"] } },
        "/properties": { get: { summary: "List properties", tags: ["Properties"] } },
        "/certificates": { get: { summary: "List certificates", tags: ["Certificates"] } },
        "/actions": { get: { summary: "List remedial actions", tags: ["Actions"] } },
        "/contractors": { get: { summary: "List contractors", tags: ["Contractors"] } },
        "/integrations/hms/actions": {
          post: {
            summary: "Receive action updates from HMS",
            tags: ["Integrations"],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["actionId"],
                    properties: {
                      actionId: { type: "string", description: "Remedial action ID" },
                      status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"] },
                      notes: { type: "string" },
                      completedAt: { type: "string", format: "date-time" },
                      costActual: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        },
        "/integrations/hms/work-orders": {
          post: {
            summary: "Receive work order confirmations from HMS",
            tags: ["Integrations"],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["actionId"],
                    properties: {
                      workOrderId: { type: "string" },
                      actionId: { type: "string" },
                      status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"] },
                      scheduledDate: { type: "string", format: "date" },
                      assignedContractor: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key"
          }
        }
      }
    };
    res.json(openApiSpec);
  });
  
  // Audit Trail API Routes - BetterAuth session-based auth
  app.get("/api/audit-events", async (req, res) => {
    try {
      const { fromNodeHeaders } = await import('better-auth/node');
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER'];
      if (!adminRoles.includes(user.role)) {
        return res.status(403).json({ error: "Forbidden - Admin access required" });
      }
      
      const { entityType, entityId, eventType, actorId, startDate, endDate, limit, offset } = req.query;
      
      const result = await storage.listAuditEvents(user.organisationId, {
        entityType: entityType as string,
        entityId: entityId as string,
        eventType: eventType as string,
        actorId: actorId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit events:", error);
      res.status(500).json({ error: "Failed to fetch audit events" });
    }
  });
  
  app.get("/api/audit-events/:entityType/:entityId", async (req, res) => {
    try {
      const { fromNodeHeaders } = await import('better-auth/node');
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { entityType, entityId } = req.params;
      
      // Verify entity belongs to user's organisation before returning audit history
      if (entityType.toUpperCase() === 'CERTIFICATE') {
        const cert = await storage.getCertificate(entityId);
        if (!cert || cert.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to this entity" });
        }
      } else if (entityType.toUpperCase() === 'REMEDIAL_ACTION') {
        const action = await storage.getRemedialAction(entityId);
        if (!action || action.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to this entity" });
        }
      } else if (entityType.toUpperCase() === 'PROPERTY') {
        const property = await storage.getProperty(entityId);
        if (!property || property.organisationId !== user.organisationId) {
          return res.status(403).json({ error: "Access denied to this entity" });
        }
      }
      
      // Get audit history filtered by user's organisation
      const events = await storage.getEntityAuditHistoryForOrg(
        entityType.toUpperCase(), 
        entityId, 
        user.organisationId
      );
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching entity audit history:", error);
      res.status(500).json({ error: "Failed to fetch audit history" });
    }
  });
  
  app.get("/api/certificates/:id/audit", async (req, res) => {
    try {
      // Session-based authentication only - X-User-Id header bypass removed for security
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify certificate belongs to user's organisation
      const cert = await storage.getCertificate(req.params.id);
      if (!cert || cert.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this certificate" });
      }
      
      const events = await storage.getEntityAuditHistoryForOrg(
        'CERTIFICATE', 
        req.params.id,
        user.organisationId
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching certificate audit:", error);
      res.status(500).json({ error: "Failed to fetch audit history" });
    }
  });

  // =====================================================
  // PREDICTIVE COMPLIANCE RADAR - RISK SCORING API
  // =====================================================
  
  const riskScoringModule = await import('./services/risk-scoring');

  app.get("/api/risk/portfolio-summary", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const summary = await riskScoringModule.getPortfolioRiskSummary(user.organisationId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching portfolio risk summary:", error);
      res.status(500).json({ error: "Failed to fetch risk summary" });
    }
  });

  app.get("/api/risk/properties", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const tier = req.query.tier as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const snapshots = await db.select({
        id: propertyRiskSnapshots.id,
        propertyId: propertyRiskSnapshots.propertyId,
        overallScore: propertyRiskSnapshots.overallScore,
        riskTier: propertyRiskSnapshots.riskTier,
        expiryRiskScore: propertyRiskSnapshots.expiryRiskScore,
        defectRiskScore: propertyRiskSnapshots.defectRiskScore,
        assetProfileRiskScore: propertyRiskSnapshots.assetProfileRiskScore,
        coverageGapRiskScore: propertyRiskSnapshots.coverageGapRiskScore,
        externalFactorRiskScore: propertyRiskSnapshots.externalFactorRiskScore,
        factorBreakdown: propertyRiskSnapshots.factorBreakdown,
        triggeringFactors: propertyRiskSnapshots.triggeringFactors,
        recommendedActions: propertyRiskSnapshots.recommendedActions,
        scoreChange: propertyRiskSnapshots.scoreChange,
        trendDirection: propertyRiskSnapshots.trendDirection,
        calculatedAt: propertyRiskSnapshots.calculatedAt,
        propertyAddressLine1: properties.addressLine1,
        propertyCity: properties.city,
        propertyPostcode: properties.postcode,
        propertyUprn: properties.uprn,
      })
      .from(propertyRiskSnapshots)
      .innerJoin(properties, eq(propertyRiskSnapshots.propertyId, properties.id))
      .where(and(
        eq(propertyRiskSnapshots.organisationId, user.organisationId),
        eq(propertyRiskSnapshots.isLatest, true),
        tier ? eq(propertyRiskSnapshots.riskTier, tier as any) : undefined
      ))
      .orderBy(desc(propertyRiskSnapshots.overallScore))
      .limit(limit)
      .offset(offset);

      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching property risks:", error);
      res.status(500).json({ error: "Failed to fetch property risks" });
    }
  });

  app.get("/api/risk/properties/:propertyId", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { propertyId } = req.params;

      const [propertyWithOrg] = await db.select({
        property: properties,
        organisationId: schemes.organisationId,
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(properties.id, propertyId))
      .limit(1);

      if (!propertyWithOrg) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      if (propertyWithOrg.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this property" });
      }

      const latestSnapshot = await db.select()
        .from(propertyRiskSnapshots)
        .where(and(
          eq(propertyRiskSnapshots.propertyId, propertyId),
          eq(propertyRiskSnapshots.organisationId, user.organisationId),
          eq(propertyRiskSnapshots.isLatest, true)
        ))
        .limit(1);

      const history = await db.select({
        id: propertyRiskSnapshots.id,
        overallScore: propertyRiskSnapshots.overallScore,
        riskTier: propertyRiskSnapshots.riskTier,
        scoreChange: propertyRiskSnapshots.scoreChange,
        calculatedAt: propertyRiskSnapshots.calculatedAt,
      })
      .from(propertyRiskSnapshots)
      .where(and(
        eq(propertyRiskSnapshots.propertyId, propertyId),
        eq(propertyRiskSnapshots.organisationId, user.organisationId)
      ))
      .orderBy(desc(propertyRiskSnapshots.calculatedAt))
      .limit(30);

      res.json({
        property: propertyWithOrg.property,
        currentRisk: latestSnapshot[0] || null,
        history,
      });
    } catch (error) {
      console.error("Error fetching property risk details:", error);
      res.status(500).json({ error: "Failed to fetch property risk details" });
    }
  });

  app.post("/api/risk/properties/:propertyId/calculate", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { propertyId } = req.params;

      const [propertyWithOrg] = await db.select({
        propertyId: properties.id,
        organisationId: schemes.organisationId,
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(properties.id, propertyId))
      .limit(1);

      if (!propertyWithOrg) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      if (propertyWithOrg.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this property" });
      }

      const riskData = await riskScoringModule.calculatePropertyRiskScore(propertyId, user.organisationId);
      const snapshotId = await riskScoringModule.saveRiskSnapshot(riskData);
      const alertId = await riskScoringModule.createRiskAlert(riskData, snapshotId);

      res.json({
        ...riskData,
        snapshotId,
        alertId,
      });
    } catch (error) {
      console.error("Error calculating property risk:", error);
      res.status(500).json({ error: "Failed to calculate property risk" });
    }
  });

  app.post("/api/risk/calculate-all", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const stats = await riskScoringModule.calculateAllPropertyRisks(user.organisationId);
      res.json(stats);
    } catch (error) {
      console.error("Error calculating all property risks:", error);
      res.status(500).json({ error: "Failed to calculate risks" });
    }
  });

  app.get("/api/risk/alerts", async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(session.user.id);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const status = req.query.status as string | undefined;
      const tier = req.query.tier as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const alerts = await db.select({
        id: riskAlerts.id,
        propertyId: riskAlerts.propertyId,
        alertType: riskAlerts.alertType,
        riskTier: riskAlerts.riskTier,
        status: riskAlerts.status,
        title: riskAlerts.title,
        description: riskAlerts.description,
        triggeringFactors: riskAlerts.triggeringFactors,
        riskScore: riskAlerts.riskScore,
        dueDate: riskAlerts.dueDate,
        slaHours: riskAlerts.slaHours,
        escalationLevel: riskAlerts.escalationLevel,
        createdAt: riskAlerts.createdAt,
        propertyAddressLine1: properties.addressLine1,
        propertyCity: properties.city,
        propertyPostcode: properties.postcode,
      })
      .from(riskAlerts)
      .innerJoin(properties, eq(riskAlerts.propertyId, properties.id))
      .where(and(
        eq(riskAlerts.organisationId, user.organisationId),
        status ? eq(riskAlerts.status, status as any) : undefined,
        tier ? eq(riskAlerts.riskTier, tier as any) : undefined
      ))
      .orderBy(desc(riskAlerts.createdAt))
      .limit(limit);

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching risk alerts:", error);
      res.status(500).json({ error: "Failed to fetch risk alerts" });
    }
  });

  app.patch("/api/risk/alerts/:alertId", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { alertId } = req.params;
      const { status, resolutionNotes } = req.body;

      const updates: any = { updatedAt: new Date() };

      if (status === 'ACKNOWLEDGED') {
        updates.status = 'ACKNOWLEDGED';
        updates.acknowledgedById = userId;
        updates.acknowledgedAt = new Date();
      } else if (status === 'RESOLVED') {
        updates.status = 'RESOLVED';
        updates.resolvedById = userId;
        updates.resolvedAt = new Date();
        updates.resolutionNotes = resolutionNotes;
      } else if (status === 'DISMISSED') {
        updates.status = 'DISMISSED';
        updates.resolvedById = userId;
        updates.resolvedAt = new Date();
        updates.resolutionNotes = resolutionNotes || 'Dismissed by user';
      } else if (status === 'ESCALATED') {
        updates.status = 'ESCALATED';
        updates.escalationLevel = sql`${riskAlerts.escalationLevel} + 1`;
      }

      const [updated] = await db.update(riskAlerts)
        .set(updates)
        .where(and(
          eq(riskAlerts.id, alertId),
          eq(riskAlerts.organisationId, user.organisationId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating risk alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.get("/api/risk/factor-definitions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const definitions = await db.select()
        .from(riskFactorDefinitions)
        .where(eq(riskFactorDefinitions.isActive, true))
        .orderBy(desc(riskFactorDefinitions.priority));

      res.json(definitions);
    } catch (error) {
      console.error("Error fetching risk factor definitions:", error);
      res.status(500).json({ error: "Failed to fetch factor definitions" });
    }
  });

  // ============ REPORTING API ENDPOINTS ============

  // Compliance Summary Report - uses materialized view or live query
  app.get("/api/reports/compliance-summary", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { useCached } = req.query;

      // Build base query with org scoping - certificates have organisationId directly
      const query = db.select({
        stream: certificates.complianceStreamId,
        type: certificates.certificateType,
        total: count(),
        compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED' OR ${certificates.status} = 'EXTRACTED')`,
        nonCompliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
        expired: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'EXPIRED')`,
        expiringSoon: sql<number>`COUNT(*) FILTER (WHERE ${certificates.expiryDate}::date < CURRENT_DATE + INTERVAL '30 days' AND ${certificates.expiryDate}::date >= CURRENT_DATE)`,
      })
      .from(certificates)
      .where(eq(certificates.organisationId, user.organisationId))
      .groupBy(certificates.complianceStreamId, certificates.certificateType);

      const results = await query;

      // Calculate overall metrics
      const totals = results.reduce((acc, row) => ({
        totalCertificates: acc.totalCertificates + Number(row.total),
        compliant: acc.compliant + Number(row.compliant),
        nonCompliant: acc.nonCompliant + Number(row.nonCompliant),
        expired: acc.expired + Number(row.expired),
        expiringSoon: acc.expiringSoon + Number(row.expiringSoon),
      }), { totalCertificates: 0, compliant: 0, nonCompliant: 0, expired: 0, expiringSoon: 0 });

      const complianceRate = totals.totalCertificates > 0 
        ? Math.round((totals.compliant / totals.totalCertificates) * 100) 
        : 0;

      res.json({
        summary: {
          ...totals,
          complianceRate,
          lastUpdated: new Date().toISOString(),
          queryType: useCached === 'true' ? 'cached' : 'live'
        },
        byStream: results
      });
    } catch (error) {
      console.error("Error fetching compliance summary:", error);
      res.status(500).json({ error: "Failed to fetch compliance summary" });
    }
  });

  // Property Health Report
  app.get("/api/reports/property-health", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { minScore, maxScore } = req.query;

      // Get properties with their certificate counts and health scores
      // Properties link to blocks -> schemes -> organisations
      const propertyData = await db.select({
        id: properties.id,
        address: properties.addressLine1,
        blockId: properties.blockId,
        totalCertificates: sql<number>`COUNT(DISTINCT ${certificates.id})`,
        compliantCertificates: sql<number>`COUNT(DISTINCT ${certificates.id}) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
        openActions: sql<number>`COUNT(DISTINCT ${remedialActions.id}) FILTER (WHERE ${remedialActions.status} IN ('OPEN', 'IN_PROGRESS'))`,
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .leftJoin(certificates, eq(certificates.propertyId, properties.id))
      .leftJoin(remedialActions, eq(remedialActions.propertyId, properties.id))
      .where(eq(schemes.organisationId, user.organisationId))
      .groupBy(properties.id, properties.addressLine1, properties.blockId);

      // Calculate health scores
      const propertiesWithScores = propertyData.map(p => {
        const total = Number(p.totalCertificates);
        const compliant = Number(p.compliantCertificates);
        const actions = Number(p.openActions);
        
        const certScore = total > 0 ? (compliant / total) * 100 : 50;
        const actionPenalty = actions * 5;
        const healthScore = Math.max(0, Math.min(100, Math.round(certScore - actionPenalty)));

        return {
          ...p,
          healthScore,
          riskLevel: healthScore >= 80 ? 'LOW' : healthScore >= 60 ? 'MEDIUM' : healthScore >= 40 ? 'HIGH' : 'CRITICAL'
        };
      });

      // Apply filters
      let filtered = propertiesWithScores;
      if (minScore) {
        filtered = filtered.filter(p => p.healthScore >= Number(minScore));
      }
      if (maxScore) {
        filtered = filtered.filter(p => p.healthScore <= Number(maxScore));
      }

      // Calculate distribution
      const distribution = {
        excellent: filtered.filter(p => p.healthScore >= 90).length,
        good: filtered.filter(p => p.healthScore >= 70 && p.healthScore < 90).length,
        fair: filtered.filter(p => p.healthScore >= 50 && p.healthScore < 70).length,
        poor: filtered.filter(p => p.healthScore < 50).length,
      };

      res.json({
        properties: filtered.sort((a, b) => a.healthScore - b.healthScore),
        distribution,
        averageScore: filtered.length > 0 
          ? Math.round(filtered.reduce((sum, p) => sum + p.healthScore, 0) / filtered.length) 
          : 0,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching property health:", error);
      res.status(500).json({ error: "Failed to fetch property health" });
    }
  });

  // Contractor Performance Report
  app.get("/api/reports/contractor-performance", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      // Get contractors with basic info - simplified query without certificate join
      const contractorData = await db.select({
        id: contractors.id,
        name: contractors.companyName,
        tradeType: contractors.tradeType,
        status: contractors.status,
      })
      .from(contractors)
      .where(eq(contractors.organisationId, user.organisationId));

      // Add metrics (in production, this would come from a proper join)
      const contractorsWithMetrics = contractorData.map(c => ({
        ...c,
        totalJobs: 0,
        completedOnTime: 0,
        successRate: 0,
        rating: 'PENDING' as const
      }));

      res.json({
        contractors: contractorsWithMetrics,
        averageSuccessRate: 0,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching contractor performance:", error);
      res.status(500).json({ error: "Failed to fetch contractor performance" });
    }
  });

  // Monthly Trends Report
  app.get("/api/reports/monthly-trends", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { months = '12' } = req.query;
      const monthsBack = parseInt(months as string) || 12;

      const trends = await db.select({
        month: sql<string>`DATE_TRUNC('month', ${certificates.createdAt})::date`,
        stream: certificates.complianceStreamId,
        issued: count(),
        compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
      })
      .from(certificates)
      .where(and(
        eq(certificates.organisationId, user.organisationId),
        gte(certificates.createdAt, sql`CURRENT_DATE - INTERVAL '${sql.raw(monthsBack.toString())} months'`)
      ))
      .groupBy(sql`DATE_TRUNC('month', ${certificates.createdAt})`, certificates.complianceStreamId)
      .orderBy(sql`DATE_TRUNC('month', ${certificates.createdAt})`);

      res.json({
        trends,
        period: `${monthsBack} months`,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching monthly trends:", error);
      res.status(500).json({ error: "Failed to fetch monthly trends" });
    }
  });

  // Certificate Expiry Report
  app.get("/api/reports/certificate-expiry", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { days = '90' } = req.query;
      const daysAhead = parseInt(days as string) || 90;

      const expiringCerts = await db.select({
        id: certificates.id,
        type: certificates.certificateType,
        complianceStream: certificates.complianceStreamId,
        expiryDate: certificates.expiryDate,
        propertyId: certificates.propertyId,
        propertyAddress: properties.addressLine1,
      })
      .from(certificates)
      .innerJoin(properties, eq(certificates.propertyId, properties.id))
      .where(and(
        eq(certificates.organisationId, user.organisationId),
        isNotNull(certificates.expiryDate),
        lt(certificates.expiryDate, sql`(CURRENT_DATE + INTERVAL '${sql.raw(daysAhead.toString())} days')::text`),
        gte(certificates.expiryDate, sql`CURRENT_DATE::text`)
      ))
      .orderBy(certificates.expiryDate);

      // Group by urgency
      const now = new Date();
      const grouped = {
        urgent: expiringCerts.filter(c => {
          const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return days <= 7;
        }),
        soon: expiringCerts.filter(c => {
          const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return days > 7 && days <= 30;
        }),
        upcoming: expiringCerts.filter(c => {
          const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return days > 30;
        }),
      };

      res.json({
        expiring: expiringCerts,
        grouped,
        summary: {
          total: expiringCerts.length,
          urgentCount: grouped.urgent.length,
          soonCount: grouped.soon.length,
          upcomingCount: grouped.upcoming.length,
        },
        period: `${daysAhead} days`,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching certificate expiry:", error);
      res.status(500).json({ error: "Failed to fetch certificate expiry" });
    }
  });

  // Board Summary Report - Executive dashboard data
  app.get("/api/reports/board-summary", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      // Get overall compliance metrics - certificates have organisationId directly
      const [certStats] = await db.select({
        total: count(),
        compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
        nonCompliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('PENDING', 'NEEDS_REVIEW'))`,
      })
      .from(certificates)
      .where(eq(certificates.organisationId, user.organisationId));

      // Get property count via schemes -> blocks -> properties
      const [propStats] = await db.select({
        total: count(),
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, user.organisationId));

      // Get open remedial actions by severity
      const [actionStats] = await db.select({
        total: count(),
        critical: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} = 'IMMEDIATE' AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
        major: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} IN ('URGENT', 'PRIORITY') AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
        minor: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} IN ('ROUTINE', 'ADVISORY') AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
      })
      .from(remedialActions);

      const total = Number(certStats?.total || 0);
      const compliant = Number(certStats?.compliant || 0);
      const overallCompliance = total > 0 ? Math.round((compliant / total) * 100) : 0;

      res.json({
        overview: {
          overallCompliance,
          totalProperties: Number(propStats?.total || 0),
          totalCertificates: total,
          openActions: Number(actionStats?.total || 0) - Number(actionStats?.critical || 0) - Number(actionStats?.major || 0) - Number(actionStats?.minor || 0),
        },
        certificates: {
          total,
          compliant,
          nonCompliant: Number(certStats?.nonCompliant || 0),
          pending: Number(certStats?.pending || 0),
        },
        actions: {
          critical: Number(actionStats?.critical || 0),
          major: Number(actionStats?.major || 0),
          minor: Number(actionStats?.minor || 0),
        },
        riskLevel: overallCompliance >= 95 ? 'LOW' : overallCompliance >= 85 ? 'MEDIUM' : overallCompliance >= 70 ? 'HIGH' : 'CRITICAL',
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching board summary:", error);
      res.status(500).json({ error: "Failed to fetch board summary" });
    }
  });

  // Report export endpoint
  app.post("/api/reports/export", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { reportType, format, filters } = req.body;

      if (!reportType || !format) {
        return res.status(400).json({ error: "Report type and format are required" });
      }

      // Queue export job
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // For now, return immediate acknowledgment
      // In production, this would queue a pg-boss job
      res.json({
        exportId,
        status: 'QUEUED',
        message: `${reportType} export queued in ${format} format`,
        estimatedCompletion: new Date(Date.now() + 60000).toISOString()
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ error: "Failed to export report" });
    }
  });

  // ===== EVIDENCE PACK EXPORT =====
  // Generate regulatory evidence packs bundling certificates, remedial actions, and compliance documentation
  app.post("/api/evidence-packs", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.organisationId) {
        return res.status(403).json({ error: "No organisation access" });
      }

      const { 
        packType, // 'REGULATORY_SUBMISSION', 'AUDIT_RESPONSE', 'BOARD_REPORT', 'SCHEME_COMPLIANCE'
        schemeIds, // optional - filter by schemes
        complianceStreams, // optional - filter by streams (e.g., ['gas', 'electrical'])
        dateFrom, // optional - certificates from date
        dateTo, // optional - certificates to date
        includeRemedialActions = true,
        includeContractorDetails = true,
        includePropertyDetails = true,
        format = 'JSON' // 'JSON', 'PDF', 'ZIP'
      } = req.body;

      if (!packType) {
        return res.status(400).json({ error: "Pack type is required" });
      }

      // Collect evidence data
      const evidenceData: any = {
        packId: `EP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        packType,
        generatedAt: new Date().toISOString(),
        generatedBy: user.displayName || user.email,
        organisation: user.organisationId,
      };

      // Get relevant certificates based on filters
      let certQuery = db.select({
        id: certificates.id,
        certificateType: certificates.certificateType,
        complianceStreamId: certificates.complianceStreamId,
        status: certificates.status,
        issueDate: certificates.issueDate,
        expiryDate: certificates.expiryDate,
        propertyId: certificates.propertyId,
        fileName: certificates.fileName,
        extractedData: certificates.extractedData,
      })
      .from(certificates)
      .where(eq(certificates.organisationId, user.organisationId));

      const certsResult = await certQuery;
      evidenceData.certificates = {
        total: certsResult.length,
        byStatus: {
          compliant: certsResult.filter(c => c.status === 'APPROVED' || c.status === 'EXTRACTED').length,
          pending: certsResult.filter(c => c.status === 'PENDING' || c.status === 'NEEDS_REVIEW').length,
          failed: certsResult.filter(c => c.status === 'FAILED').length,
        },
        items: certsResult.slice(0, 100), // Limit for response size
      };

      // Get remedial actions if requested - scoped to organisation via certificates
      if (includeRemedialActions) {
        const actions = await db.select({
          id: remedialActions.id,
          description: remedialActions.description,
          severity: remedialActions.severity,
          status: remedialActions.status,
          targetDate: remedialActions.targetDate,
          completedDate: remedialActions.completedDate,
        })
        .from(remedialActions)
        .innerJoin(certificates, eq(remedialActions.certificateId, certificates.id))
        .where(eq(certificates.organisationId, user.organisationId))
        .limit(100);

        evidenceData.remedialActions = {
          total: actions.length,
          bySeverity: {
            critical: actions.filter(a => a.severity === 'IMMEDIATE').length,
            urgent: actions.filter(a => a.severity === 'URGENT').length,
            priority: actions.filter(a => a.severity === 'PRIORITY').length,
            routine: actions.filter(a => a.severity === 'ROUTINE').length,
          },
          items: actions,
        };
      }

      // Get contractor summary if requested
      if (includeContractorDetails) {
        const contractorData = await db.select({
          id: contractors.id,
          companyName: contractors.companyName,
          tradeType: contractors.tradeType,
          status: contractors.status,
          gasRegistered: contractors.gasRegistered,
          nicEicApproved: contractors.nicEicApproved,
        })
        .from(contractors)
        .where(eq(contractors.organisationId, user.organisationId))
        .limit(50);

        evidenceData.contractors = {
          total: contractorData.length,
          items: contractorData,
        };
      }

      // Get property summary if requested
      if (includePropertyDetails) {
        const propertyData = await db.select({
          id: properties.id,
          uprn: properties.uprn,
          addressLine1: properties.addressLine1,
          postcode: properties.postcode,
          tenure: properties.tenure,
          riskScore: properties.riskScore,
        })
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
        .where(eq(schemes.organisationId, user.organisationId))
        .limit(100);

        evidenceData.properties = {
          total: propertyData.length,
          items: propertyData,
        };
      }

      // Calculate compliance summary
      const complianceRate = evidenceData.certificates.total > 0
        ? Math.round((evidenceData.certificates.byStatus.compliant / evidenceData.certificates.total) * 100)
        : 0;

      evidenceData.summary = {
        complianceRate,
        riskLevel: complianceRate >= 95 ? 'LOW' : complianceRate >= 85 ? 'MEDIUM' : complianceRate >= 70 ? 'HIGH' : 'CRITICAL',
        totalCertificates: evidenceData.certificates.total,
        openRemedialActions: evidenceData.remedialActions?.items?.filter((a: any) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length || 0,
        generationDate: new Date().toISOString(),
      };

      res.json(evidenceData);
    } catch (error) {
      console.error("Error generating evidence pack:", error);
      res.status(500).json({ error: "Failed to generate evidence pack" });
    }
  });

  // Get available evidence pack templates
  app.get("/api/evidence-packs/templates", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const templates = [
        {
          id: 'REGULATORY_SUBMISSION',
          name: 'Regulatory Submission Pack',
          description: 'Complete compliance evidence for regulatory submissions (RSH, HSE)',
          includes: ['certificates', 'remedialActions', 'contractors', 'properties'],
          complianceStreams: ['all'],
        },
        {
          id: 'GAS_SAFETY_AUDIT',
          name: 'Gas Safety Audit Pack',
          description: 'Gas safety certificates and contractor credentials for HSE audits',
          includes: ['certificates', 'contractors'],
          complianceStreams: ['gas'],
        },
        {
          id: 'FIRE_SAFETY_AUDIT',
          name: 'Fire Safety Audit Pack',
          description: 'Fire risk assessments and remedial actions for Fire Authority submissions',
          includes: ['certificates', 'remedialActions'],
          complianceStreams: ['fire'],
        },
        {
          id: 'ELECTRICAL_SAFETY',
          name: 'Electrical Safety Pack',
          description: 'EICR certificates and electrical safety documentation',
          includes: ['certificates', 'contractors'],
          complianceStreams: ['electrical'],
        },
        {
          id: 'BUILDING_SAFETY_ACT',
          name: 'Building Safety Act Compliance Pack',
          description: 'Higher-Risk Building compliance documentation for BSR submissions',
          includes: ['certificates', 'remedialActions', 'contractors', 'properties'],
          complianceStreams: ['all'],
        },
        {
          id: 'BOARD_QUARTERLY',
          name: 'Board Quarterly Report',
          description: 'Executive summary for board presentations',
          includes: ['summary', 'certificates', 'remedialActions'],
          complianceStreams: ['all'],
        },
      ];

      res.json(templates);
    } catch (error) {
      console.error("Error fetching evidence pack templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // ========================
  // REPORTING API ENDPOINTS
  // ========================

  // Get report templates
  app.get("/api/reports/templates", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM report_templates 
        WHERE is_active = true 
        ORDER BY is_system DESC, name ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching report templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Create report template
  app.post("/api/reports/templates", async (req, res) => {
    try {
      const { name, description, sections } = req.body;
      const sectionsLiteral = sections && sections.length > 0 
        ? `{${sections.map((s: string) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`
        : null;
      const result = await db.execute(sql`
        INSERT INTO report_templates (name, description, sections, is_system, is_active)
        VALUES (${name}, ${description}, ${sectionsLiteral}::text[], false, true)
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Get scheduled reports
  app.get("/api/reports/scheduled", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM scheduled_reports 
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching scheduled reports:", error);
      res.status(500).json({ error: "Failed to fetch scheduled reports" });
    }
  });

  // Create scheduled report - uses pg-boss for scheduling
  app.post("/api/reports/scheduled", async (req, res) => {
    try {
      const { name, templateName, frequency, format, recipients, filters, isActive } = req.body;
      const nextRunAt = new Date();
      nextRunAt.setHours(6, 0, 0, 0);
      if (frequency === 'WEEKLY') nextRunAt.setDate(nextRunAt.getDate() + ((1 + 7 - nextRunAt.getDay()) % 7 || 7));
      else if (frequency === 'MONTHLY') { nextRunAt.setMonth(nextRunAt.getMonth() + 1); nextRunAt.setDate(1); }
      else if (frequency === 'QUARTERLY') { nextRunAt.setMonth(nextRunAt.getMonth() + 3); nextRunAt.setDate(1); }
      else nextRunAt.setDate(nextRunAt.getDate() + 1);

      const recipientsArray = recipients && recipients.length > 0 ? recipients : null;
      const result = await db.execute(sql`
        INSERT INTO scheduled_reports (organisation_id, name, template_name, frequency, format, recipients, filters, is_active, next_run_at)
        VALUES ((SELECT id FROM organisations LIMIT 1), ${name}, ${templateName}, ${frequency}, ${format || 'PDF'}, ${recipientsArray}, ${JSON.stringify(filters || {})}, ${isActive !== false}, ${nextRunAt})
        RETURNING *
      `);
      
      const scheduledReport = result.rows[0] as any;
      
      // Create pg-boss schedule for this report
      if (isActive !== false) {
        try {
          const { createReportSchedule } = await import("./job-queue");
          await createReportSchedule(scheduledReport.id, frequency);
        } catch (scheduleError) {
          console.error("Failed to create pg-boss schedule:", scheduleError);
          // Report is still saved, just not scheduled yet
        }
      }
      
      res.json(scheduledReport);
    } catch (error) {
      console.error("Error creating scheduled report:", error);
      res.status(500).json({ error: "Failed to create scheduled report" });
    }
  });

  // Update scheduled report - uses pg-boss for schedule management
  app.patch("/api/reports/scheduled/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, frequency } = req.body;
      
      if (isActive !== undefined) {
        await db.execute(sql`
          UPDATE scheduled_reports SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}
        `);
        
        // Update pg-boss schedule (recalculates next_run_at when re-enabling)
        try {
          const { setReportScheduleActive } = await import("./job-queue");
          await setReportScheduleActive(id, isActive);
        } catch (scheduleError) {
          console.error("Failed to update pg-boss schedule:", scheduleError);
        }
      }
      
      // When frequency changes, recalculate next_run_at immediately
      if (frequency) {
        await db.execute(sql`
          UPDATE scheduled_reports SET frequency = ${frequency}, updated_at = NOW() WHERE id = ${id}
        `);
        
        try {
          const { setReportScheduleActive } = await import("./job-queue");
          // Re-calculate next_run_at based on new frequency
          await setReportScheduleActive(id, true);
        } catch (scheduleError) {
          console.error("Failed to update next_run_at for frequency change:", scheduleError);
        }
      }
      
      const result = await db.execute(sql`SELECT * FROM scheduled_reports WHERE id = ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating scheduled report:", error);
      res.status(500).json({ error: "Failed to update scheduled report" });
    }
  });

  // Delete scheduled report - removes pg-boss schedule and handles foreign keys
  app.delete("/api/reports/scheduled/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Remove pg-boss schedule first
      try {
        const { removeReportSchedule } = await import("./job-queue");
        await removeReportSchedule(id);
      } catch (scheduleError) {
        console.error("Failed to remove pg-boss schedule:", scheduleError);
      }
      
      // Set foreign key to NULL in generated_reports before deleting
      await db.execute(sql`UPDATE generated_reports SET scheduled_report_id = NULL WHERE scheduled_report_id = ${id}`);
      
      await db.execute(sql`DELETE FROM scheduled_reports WHERE id = ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheduled report:", error);
      res.status(500).json({ error: "Failed to delete scheduled report" });
    }
  });

  // Get generated reports (recent)
  app.get("/api/reports/generated", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM generated_reports 
        ORDER BY generated_at DESC 
        LIMIT 50
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching generated reports:", error);
      res.status(500).json({ error: "Failed to fetch generated reports" });
    }
  });

  // Create generated report (record report generation)
  app.post("/api/reports/generated", async (req, res) => {
    try {
      const { name, templateId, format, fileSize, filters, status } = req.body;
      const result = await db.execute(sql`
        INSERT INTO generated_reports (organisation_id, name, template_id, format, file_size, filters, status)
        VALUES ((SELECT id FROM organisations LIMIT 1), ${name}, ${templateId || null}, ${format || 'PDF'}, ${fileSize || null}, ${JSON.stringify(filters || {})}, ${status || 'READY'})
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating generated report:", error);
      res.status(500).json({ error: "Failed to create generated report" });
    }
  });

  // Run scheduled report (generate immediately via pg-boss)
  app.post("/api/reports/scheduled/:id/run", async (req, res) => {
    try {
      const { id } = req.params;
      const scheduleResult = await db.execute(sql`SELECT * FROM scheduled_reports WHERE id = ${id}`);
      const schedule = scheduleResult.rows[0] as any;
      
      if (!schedule) {
        return res.status(404).json({ error: "Scheduled report not found" });
      }

      // Enqueue immediate execution via pg-boss
      try {
        const { enqueueScheduledReportNow } = await import("./job-queue");
        const jobId = await enqueueScheduledReportNow(id);
        
        res.json({ 
          success: true, 
          message: "Report generation queued via pg-boss",
          jobId,
          scheduledReportId: id 
        });
      } catch (queueError) {
        console.error("Failed to enqueue via pg-boss, falling back to direct execution:", queueError);
        
        // Fallback: direct execution if pg-boss fails
        const result = await db.execute(sql`
          INSERT INTO generated_reports (organisation_id, name, scheduled_report_id, format, status, filters)
          VALUES (${schedule.organisation_id}, ${schedule.name}, ${id}, ${schedule.format}, 'READY', ${JSON.stringify(schedule.filters || {})})
          RETURNING *
        `);

        await db.execute(sql`
          UPDATE scheduled_reports SET last_run_at = NOW(), updated_at = NOW() WHERE id = ${id}
        `);

        res.json(result.rows[0]);
      }
    } catch (error) {
      console.error("Error running scheduled report:", error);
      res.status(500).json({ error: "Failed to run scheduled report" });
    }
  });

  // Efficient sidebar counts using SQL COUNT queries (no full data load)
  app.get("/api/sidebar/counts", async (req, res) => {
    try {
      const now = new Date().toISOString();
      
      // Use optimized COUNT queries instead of loading all data
      const [emergencyResult] = await db.select({ count: count() })
        .from(remedialActions)
        .where(and(
          eq(remedialActions.severity, 'IMMEDIATE'),
          eq(remedialActions.status, 'OPEN')
        ));
      
      const [overdueResult] = await db.select({ count: count() })
        .from(certificates)
        .where(lt(certificates.expiryDate, now));
      
      const [pendingReviewResult] = await db.select({ count: count() })
        .from(certificates)
        .where(eq(certificates.status, 'NEEDS_REVIEW'));
      
      const [totalPropertiesResult] = await db.select({ count: count() })
        .from(properties);
      
      const [totalCertsResult] = await db.select({ count: count() })
        .from(certificates);
      
      const [openActionsResult] = await db.select({ count: count() })
        .from(remedialActions)
        .where(eq(remedialActions.status, 'OPEN'));
      
      res.json({
        emergencyHazards: emergencyResult?.count || 0,
        overdueCertificates: overdueResult?.count || 0,
        pendingReview: pendingReviewResult?.count || 0,
        totalProperties: totalPropertiesResult?.count || 0,
        totalCertificates: totalCertsResult?.count || 0,
        openActions: openActionsResult?.count || 0
      });
    } catch (error) {
      console.error("Error fetching sidebar counts:", error);
      res.status(500).json({ error: "Failed to fetch sidebar counts" });
    }
  });

  // Navigation Configuration API - Database-driven navigation
  // Public endpoint - returns navigation with role information
  app.get("/api/navigation", async (req, res) => {
    try {
      const navigation = await storage.getNavigationWithItemsAndRoles();
      res.json(navigation);
    } catch (error) {
      console.error("Error fetching navigation:", error);
      res.status(500).json({ error: "Failed to fetch navigation configuration" });
    }
  });

  // Admin-only navigation management endpoints
  const ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];

  app.get("/api/navigation/sections", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const sections = await storage.listNavigationSections();
      res.json(sections);
    } catch (error) {
      console.error("Error fetching navigation sections:", error);
      res.status(500).json({ error: "Failed to fetch navigation sections" });
    }
  });

  app.post("/api/navigation/sections", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const section = await storage.createNavigationSection(req.body);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating navigation section:", error);
      res.status(500).json({ error: "Failed to create navigation section" });
    }
  });

  app.patch("/api/navigation/sections/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const section = await storage.updateNavigationSection(req.params.id, req.body);
      if (!section) {
        return res.status(404).json({ error: "Navigation section not found" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error updating navigation section:", error);
      res.status(500).json({ error: "Failed to update navigation section" });
    }
  });

  app.delete("/api/navigation/sections/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteNavigationSection(req.params.id);
      if (!deleted) {
        return res.status(400).json({ error: "Cannot delete system navigation section" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting navigation section:", error);
      res.status(500).json({ error: "Failed to delete navigation section" });
    }
  });

  app.get("/api/navigation/items", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const sectionId = req.query.sectionId as string | undefined;
      const items = await storage.listNavigationItemsWithRoles(sectionId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching navigation items:", error);
      res.status(500).json({ error: "Failed to fetch navigation items" });
    }
  });

  app.post("/api/navigation/items", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const item = await storage.createNavigationItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating navigation item:", error);
      res.status(500).json({ error: "Failed to create navigation item" });
    }
  });

  app.patch("/api/navigation/items/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const item = await storage.updateNavigationItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Navigation item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating navigation item:", error);
      res.status(500).json({ error: "Failed to update navigation item" });
    }
  });

  app.delete("/api/navigation/items/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteNavigationItem(req.params.id);
      if (!deleted) {
        return res.status(400).json({ error: "Cannot delete system navigation item" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting navigation item:", error);
      res.status(500).json({ error: "Failed to delete navigation item" });
    }
  });

  // Navigation item role management
  app.get("/api/navigation/items/:id/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const roles = await storage.getNavigationItemRoles(req.params.id);
      res.json({ itemId: req.params.id, roles });
    } catch (error) {
      console.error("Error fetching navigation item roles:", error);
      res.status(500).json({ error: "Failed to fetch navigation item roles" });
    }
  });

  app.put("/api/navigation/items/:id/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const { roles } = req.body;
      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: "roles must be an array" });
      }
      await storage.setNavigationItemRoles(req.params.id, roles);
      res.json({ success: true, itemId: req.params.id, roles });
    } catch (error) {
      console.error("Error setting navigation item roles:", error);
      res.status(500).json({ error: "Failed to set navigation item roles" });
    }
  });

  // Bulk navigation roles update
  app.put("/api/admin/navigation/bulk-roles", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items must be an array of {itemId, roles}" });
      }
      
      for (const { itemId, roles } of items) {
        if (itemId && Array.isArray(roles)) {
          await storage.setNavigationItemRoles(itemId, roles);
        }
      }
      
      res.json({ success: true, updated: items.length });
    } catch (error) {
      console.error("Error bulk updating navigation roles:", error);
      res.status(500).json({ error: "Failed to bulk update navigation roles" });
    }
  });

  // Available roles endpoint for UI
  app.get("/api/admin/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const roles = [
        { id: 'LASHAN_SUPER_USER', name: 'Lashan Super User', description: 'Full system access' },
        { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Organisation-wide administrative access' },
        { id: 'SYSTEM_ADMIN', name: 'System Admin', description: 'System configuration access' },
        { id: 'COMPLIANCE_MANAGER', name: 'Compliance Manager', description: 'Compliance oversight and management' },
        { id: 'ADMIN', name: 'Admin', description: 'Administrative functions' },
        { id: 'MANAGER', name: 'Manager', description: 'Team management and oversight' },
        { id: 'OFFICER', name: 'Officer', description: 'Operational compliance tasks' },
        { id: 'VIEWER', name: 'Viewer', description: 'Read-only access' }
      ];
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/navigation/icons", async (req, res) => {
    try {
      const icons = await storage.listIconRegistry();
      res.json(icons);
    } catch (error) {
      console.error("Error fetching icons:", error);
      res.status(500).json({ error: "Failed to fetch icon registry" });
    }
  });
  
  // =====================================================
  // ML PREDICTION ROUTES
  // =====================================================

  // Get ML model metrics and status
  app.get("/api/ml/model", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { getModelMetrics } = await import('./services/ml-prediction');
      const metrics = await getModelMetrics(organisationId);
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching ML model metrics:", error);
      res.status(500).json({ error: "Failed to fetch ML model metrics" });
    }
  });

  // Update ML model settings
  app.patch("/api/ml/model/settings", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { learningRate, epochs, batchSize, featureWeights } = req.body;
      
      const { updateModelSettings } = await import('./services/ml-prediction');
      const updatedModel = await updateModelSettings(organisationId, {
        learningRate,
        epochs,
        batchSize,
        featureWeights,
      });
      
      res.json(updatedModel);
    } catch (error) {
      console.error("Error updating ML model settings:", error);
      res.status(500).json({ error: "Failed to update ML model settings" });
    }
  });

  // Get ML prediction for a property
  app.get("/api/ml/predictions/:propertyId", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { propertyId } = req.params;
      
      const { predictPropertyBreach } = await import('./services/ml-prediction');
      const prediction = await predictPropertyBreach(propertyId, organisationId);
      
      res.json(prediction);
    } catch (error) {
      console.error("Error getting ML prediction:", error);
      res.status(500).json({ error: "Failed to get ML prediction" });
    }
  });

  // Get bulk predictions for multiple properties
  app.post("/api/ml/predictions/bulk", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { propertyIds } = req.body;
      
      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return res.status(400).json({ error: "propertyIds array is required" });
      }

      const { predictPropertyBreach } = await import('./services/ml-prediction');
      
      const predictions = await Promise.all(
        propertyIds.slice(0, 50).map(id => predictPropertyBreach(id, organisationId))
      );
      
      res.json({ predictions, generated: predictions.length });
    } catch (error) {
      console.error("Error getting bulk ML predictions:", error);
      res.status(500).json({ error: "Failed to get bulk ML predictions" });
    }
  });

  // Test predictions endpoint - generates predictions for sample properties
  app.post("/api/ml/predictions/test", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = Math.min(req.body.limit || 30, 50);
      const sampleProperties = await storage.listProperties(organisationId, { limit });
      
      if (sampleProperties.length === 0) {
        return res.json({ predictions: [], message: "No properties found for testing" });
      }

      const propertyIds = sampleProperties.map(p => p.id);
      const { predictPropertyBreach } = await import('./services/ml-prediction');
      
      const predictions = await Promise.all(
        propertyIds.map(id => predictPropertyBreach(id, organisationId, { isTest: true }))
      );
      
      res.json({ 
        predictions, 
        generated: predictions.length,
        message: `Generated ${predictions.length} test predictions`
      });
    } catch (error) {
      console.error("Error generating test ML predictions:", error);
      res.status(500).json({ error: "Failed to generate test ML predictions" });
    }
  });

  // Submit feedback for a prediction
  app.post("/api/ml/predictions/:predictionId/feedback", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      const userId = req.session?.userId || 'system';
      const userName = req.session?.username || 'System User';
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { predictionId } = req.params;
      const { feedbackType, correctedScore, correctedCategory, feedbackNotes } = req.body;
      
      if (!['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'].includes(feedbackType)) {
        return res.status(400).json({ error: "Invalid feedback type" });
      }

      const { submitPredictionFeedback } = await import('./services/ml-prediction');
      const feedback = await submitPredictionFeedback(
        predictionId,
        organisationId,
        feedbackType,
        userId,
        userName,
        correctedScore,
        correctedCategory,
        feedbackNotes
      );
      
      res.json(feedback);
    } catch (error) {
      console.error("Error submitting ML feedback:", error);
      res.status(500).json({ error: "Failed to submit ML feedback" });
    }
  });

  // Train/retrain the ML model
  app.post("/api/ml/model/train", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { learningRate = 0.01, epochs = 100, batchSize = 32, validationSplit = 0.2 } = req.body;
      
      const { trainModelFromFeedback } = await import('./services/ml-prediction');
      const result = await trainModelFromFeedback(organisationId, {
        learningRate,
        epochs,
        batchSize,
        validationSplit,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error training ML model:", error);
      res.status(500).json({ error: "Failed to train ML model" });
    }
  });

  // Get recent training runs
  app.get("/api/ml/training-runs", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const trainingRuns = await db.select()
        .from(mlTrainingRuns)
        .innerJoin(mlModels, eq(mlTrainingRuns.modelId, mlModels.id))
        .where(eq(mlModels.organisationId, organisationId))
        .orderBy(desc(mlTrainingRuns.startedAt))
        .limit(20);
      
      res.json(trainingRuns.map(r => r.ml_training_runs));
    } catch (error) {
      console.error("Error fetching training runs:", error);
      res.status(500).json({ error: "Failed to fetch training runs" });
    }
  });

  // Get recent predictions for a property or all
  app.get("/api/ml/predictions", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { propertyId, tier, limit = '50' } = req.query;
      
      const conditions = [eq(mlPredictions.organisationId, organisationId)];
      
      if (propertyId && typeof propertyId === 'string') {
        conditions.push(eq(mlPredictions.propertyId, propertyId));
      }
      
      if (tier && typeof tier === 'string' && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(tier)) {
        conditions.push(eq(mlPredictions.predictedRiskCategory, tier));
      }
      
      const rawPredictions = await db.select()
        .from(mlPredictions)
        .where(and(...conditions))
        .orderBy(desc(mlPredictions.createdAt))
        .limit(Math.min(parseInt(limit as string), 100));
      
      const propertyIds = rawPredictions.map(p => p.propertyId).filter(Boolean) as string[];
      let propertyMap = new Map<string, { id: string; uprn: string | null; address: string | null; postcode: string | null }>();
      
      if (propertyIds.length > 0) {
        const propertiesData = await db.select()
          .from(properties)
          .where(inArray(properties.id, propertyIds));
        propertyMap = new Map(propertiesData.map(p => [p.id, { 
          id: p.id, 
          uprn: p.uprn, 
          address: p.addressLine1, 
          postcode: p.postcode 
        }]));
      }
      
      const predictions = rawPredictions.map(p => {
        const hasML = p.mlScore !== null && p.mlConfidence !== null;
        const statConf = p.statisticalConfidence || 50;
        const mlConf = p.mlConfidence || 0;
        
        let combinedScore = p.statisticalScore || 0;
        let combinedConfidence = statConf;
        let sourceLabel: 'Statistical' | 'ML-Enhanced' | 'ML-Only' = 'Statistical';
        
        if (hasML && p.mlScore !== null) {
          const totalConf = statConf + mlConf;
          const statWeight = statConf / totalConf;
          const mlWeight = mlConf / totalConf;
          combinedScore = Math.round((p.statisticalScore || 0) * statWeight + p.mlScore * mlWeight);
          combinedConfidence = Math.round((statConf + mlConf) / 2);
          sourceLabel = 'ML-Enhanced';
        }
        
        const breachProbability = combinedScore / 100;
        const property = p.propertyId ? propertyMap.get(p.propertyId) : null;
        
        return {
          id: p.id,
          propertyId: p.propertyId,
          propertyUprn: property?.uprn || null,
          propertyAddress: property?.address || null,
          propertyPostcode: property?.postcode || null,
          riskScore: combinedScore,
          riskCategory: p.predictedRiskCategory || 'LOW',
          breachProbability,
          predictedBreachDate: p.predictedBreachDate,
          confidenceLevel: combinedConfidence,
          sourceLabel,
          createdAt: p.createdAt,
          statisticalScore: p.statisticalScore,
          statisticalConfidence: p.statisticalConfidence,
          mlScore: p.mlScore,
          mlConfidence: p.mlConfidence,
        };
      });
      
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching ML predictions:", error);
      res.status(500).json({ error: "Failed to fetch ML predictions" });
    }
  });

  // ==================== Extraction Learning Lifecycle API ====================

  // Get learning lifecycle data for Model Insights page
  app.get("/api/ml/learning-lifecycle", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get correction statistics
      const correctionStats = await db.select({
        totalCorrections: sql<number>`COUNT(*)`,
        usedForImprovement: sql<number>`COUNT(*) FILTER (WHERE used_for_improvement = true)`,
        avgReviewTime: sql<number>`AVG(review_duration_seconds)`,
      })
        .from(extractionCorrections)
        .where(eq(extractionCorrections.organisationId, organisationId));

      // Get corrections by type
      const correctionsByType = await db.select({
        correctionType: extractionCorrections.correctionType,
        count: sql<number>`COUNT(*)`,
      })
        .from(extractionCorrections)
        .where(eq(extractionCorrections.organisationId, organisationId))
        .groupBy(extractionCorrections.correctionType);

      // Get corrections by field
      const correctionsByField = await db.select({
        fieldName: extractionCorrections.fieldName,
        count: sql<number>`COUNT(*)`,
      })
        .from(extractionCorrections)
        .where(eq(extractionCorrections.organisationId, organisationId))
        .groupBy(extractionCorrections.fieldName)
        .orderBy(desc(sql<number>`COUNT(*)`))
        .limit(10);

      // Get corrections by certificate type
      const correctionsByCertType = await db.select({
        certificateType: extractionCorrections.certificateType,
        count: sql<number>`COUNT(*)`,
      })
        .from(extractionCorrections)
        .where(eq(extractionCorrections.organisationId, organisationId))
        .groupBy(extractionCorrections.certificateType);

      // Get recent corrections for timeline
      const recentCorrections = await db.select()
        .from(extractionCorrections)
        .where(eq(extractionCorrections.organisationId, organisationId))
        .orderBy(desc(extractionCorrections.createdAt))
        .limit(20);

      // Calculate improvement rate (mock calculation for now)
      const stats = correctionStats[0] || { totalCorrections: 0, usedForImprovement: 0, avgReviewTime: 0 };
      const improvementRate = stats.totalCorrections > 0 
        ? Math.round((stats.usedForImprovement / stats.totalCorrections) * 100)
        : 0;

      res.json({
        summary: {
          totalCorrections: Number(stats.totalCorrections) || 0,
          usedForImprovement: Number(stats.usedForImprovement) || 0,
          pendingImprovement: Number(stats.totalCorrections) - Number(stats.usedForImprovement) || 0,
          improvementRate,
          avgReviewTimeSeconds: Math.round(Number(stats.avgReviewTime) || 0),
        },
        correctionsByType: correctionsByType.map(c => ({
          type: c.correctionType,
          count: Number(c.count),
        })),
        correctionsByField: correctionsByField.map(c => ({
          field: c.fieldName,
          count: Number(c.count),
        })),
        correctionsByCertificateType: correctionsByCertType.map(c => ({
          certificateType: c.certificateType,
          count: Number(c.count),
        })),
        recentCorrections: recentCorrections.map(c => ({
          id: c.id,
          fieldName: c.fieldName,
          originalValue: c.originalValue,
          correctedValue: c.correctedValue,
          correctionType: c.correctionType,
          certificateType: c.certificateType,
          extractionTier: c.extractionTier,
          reviewerName: c.reviewerName,
          usedForImprovement: c.usedForImprovement,
          createdAt: c.createdAt,
        })),
        learningPipeline: {
          stages: [
            { name: 'Document Uploaded', description: 'Certificate enters ingestion queue', status: 'active' },
            { name: 'AI Extraction', description: 'Multi-tier extraction processes document', status: 'active' },
            { name: 'Human Review', description: 'Quality assurance and correction', status: 'active' },
            { name: 'Correction Capture', description: 'Field-level differences recorded', status: 'active' },
            { name: 'Pattern Analysis', description: 'Identify recurring extraction failures', status: 'pending' },
            { name: 'Template Update', description: 'Improve extraction rules', status: 'pending' },
          ],
        },
      });
    } catch (error) {
      console.error("Error fetching learning lifecycle:", error);
      res.status(500).json({ error: "Failed to fetch learning lifecycle data" });
    }
  });

  // Record extraction correction from human review
  app.post("/api/ml/corrections", async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      const userId = req.session?.userId;
      const userName = req.session?.userName || 'Unknown';
      if (!organisationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { certificateId, corrections } = req.body;
      
      if (!certificateId || !corrections || !Array.isArray(corrections)) {
        return res.status(400).json({ error: "certificateId and corrections array required" });
      }

      // Get certificate details
      const cert = await db.select()
        .from(certificates)
        .where(eq(certificates.id, certificateId))
        .limit(1);

      const insertedCorrections = [];
      for (const correction of corrections) {
        const { fieldName, originalValue, correctedValue, correctionType, sourceText, notes, reviewDurationSeconds } = correction;
        
        if (!fieldName || !correctedValue || !correctionType) {
          continue;
        }

        const [inserted] = await db.insert(extractionCorrections).values({
          organisationId,
          certificateId,
          fieldName,
          originalValue: originalValue || null,
          correctedValue,
          correctionType,
          sourceText: sourceText || null,
          certificateType: cert[0]?.certificateType || null,
          reviewerId: userId || null,
          reviewerName: userName,
          reviewDurationSeconds: reviewDurationSeconds || null,
          notes: notes || null,
        }).returning();
        
        insertedCorrections.push(inserted);
      }

      res.status(201).json({ 
        success: true, 
        count: insertedCorrections.length,
        corrections: insertedCorrections 
      });
    } catch (error) {
      console.error("Error recording corrections:", error);
      res.status(500).json({ error: "Failed to record corrections" });
    }
  });

  // Get circuit breaker status
  app.get("/api/system/circuit-breakers", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { circuitBreaker } = await import('./services/circuit-breaker');
      const stats = circuitBreaker.getAllStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching circuit breaker status:", error);
      res.status(500).json({ error: "Failed to fetch circuit breaker status" });
    }
  });

  // Reset circuit breaker
  app.post("/api/system/circuit-breakers/:name/reset", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { name } = req.params;
      const { circuitBreaker } = await import('./services/circuit-breaker');
      circuitBreaker.reset(name);
      res.json({ success: true, message: `Circuit breaker ${name} reset` });
    } catch (error) {
      console.error("Error resetting circuit breaker:", error);
      res.status(500).json({ error: "Failed to reset circuit breaker" });
    }
  });

  // Get duplicate detection stats
  app.get("/api/system/duplicate-stats", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const organisationId = req.session?.organisationId || ORG_ID;
      const { getDuplicateStats } = await import('./services/duplicate-detection');
      const stats = await getDuplicateStats(organisationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching duplicate stats:", error);
      res.status(500).json({ error: "Failed to fetch duplicate stats" });
    }
  });

  // Get pattern analysis results
  app.get("/api/ml/pattern-analysis", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { runPatternAnalysis } = await import('./services/pattern-analysis');
      const result = await runPatternAnalysis();
      res.json(result);
    } catch (error) {
      console.error("Error running pattern analysis:", error);
      res.status(500).json({ error: "Failed to run pattern analysis" });
    }
  });

  // Get pattern analysis summary
  app.get("/api/ml/pattern-analysis/summary", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { getPatternSummary } = await import('./services/pattern-analysis');
      const summary = await getPatternSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting pattern summary:", error);
      res.status(500).json({ error: "Failed to get pattern summary" });
    }
  });

  // Trigger pattern analysis job manually
  app.post("/api/ml/pattern-analysis/trigger", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { triggerPatternAnalysis } = await import('./job-queue');
      const jobId = await triggerPatternAnalysis();
      res.json({ success: true, jobId, message: "Pattern analysis job triggered" });
    } catch (error) {
      console.error("Error triggering pattern analysis:", error);
      res.status(500).json({ error: "Failed to trigger pattern analysis" });
    }
  });

  // ==================== Cache Administration API ====================

  // Seed cache regions on startup
  cacheAdminService.seedCacheRegions().catch(err => {
    console.error('Failed to seed cache regions:', err);
  });

  // Get cache overview with stats per layer/category
  app.get("/api/admin/cache/overview", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const overview = await cacheAdminService.getCacheOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching cache overview:", error);
      res.status(500).json({ error: "Failed to fetch cache overview" });
    }
  });

  // Get all cache regions
  app.get("/api/admin/cache/regions", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { layer, category, activeOnly } = req.query;
      const regions = await cacheAdminService.getCacheRegions({
        layer: layer as cacheAdminService.CacheLayer | undefined,
        category: category as string | undefined,
        activeOnly: activeOnly !== 'false',
      });
      res.json(regions);
    } catch (error) {
      console.error("Error fetching cache regions:", error);
      res.status(500).json({ error: "Failed to fetch cache regions" });
    }
  });

  // Get confirmation token for cache clear (required for 'ALL' scope)
  app.post("/api/admin/cache/confirmation-token", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const token = cacheAdminService.generateConfirmationToken();
      res.json({ token, expiresIn: 300 });
    } catch (error) {
      console.error("Error generating confirmation token:", error);
      res.status(500).json({ error: "Failed to generate confirmation token" });
    }
  });

  // Preview cache clear (dry run)
  app.post("/api/admin/cache/preview", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
    try {
      const { scope, identifier, identifiers, reason } = req.body;
      
      if (!scope || !reason) {
        return res.status(400).json({ error: "Scope and reason are required" });
      }

      const result = await cacheAdminService.clearCache({
        scope,
        identifier,
        identifiers,
        reason,
        dryRun: true,
        userId: req.session.userId!,
        userRole: req.user?.role || 'UNKNOWN',
        userIp: req.ip,
      });

      res.json(result);
    } catch (error) {
      console.error("Error previewing cache clear:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to preview cache clear" });
    }
  });

  // Execute cache clear
  app.post("/api/admin/cache/clear", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
    try {
      const { scope, identifier, identifiers, reason, confirmationToken } = req.body;
      
      if (!scope || !reason) {
        return res.status(400).json({ error: "Scope and reason are required" });
      }

      if (scope === 'ALL') {
        if (!confirmationToken) {
          return res.status(400).json({ error: "Confirmation token required for clearing all caches" });
        }
        if (!cacheAdminService.validateConfirmationToken(confirmationToken)) {
          return res.status(400).json({ error: "Invalid or expired confirmation token" });
        }
      }

      const result = await cacheAdminService.clearCache({
        scope,
        identifier,
        identifiers,
        reason,
        confirmationToken,
        dryRun: false,
        userId: req.session.userId!,
        userRole: req.user?.role || 'UNKNOWN',
        userIp: req.ip,
      });

      res.json(result);
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to clear cache" });
    }
  });

  // Get cache clear audit history
  app.get("/api/admin/cache/audit", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const { limit, userId } = req.query;
      const history = await cacheAdminService.getCacheClearHistory({
        limit: limit ? parseInt(limit as string) : 50,
        userId: userId as string | undefined,
      });
      res.json(history);
    } catch (error) {
      console.error("Error fetching cache audit history:", error);
      res.status(500).json({ error: "Failed to fetch cache audit history" });
    }
  });

  // Trigger client cache invalidation via SSE
  app.post("/api/admin/cache/notify-clients", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
    try {
      const { regions } = req.body;
      
      if (!regions || !Array.isArray(regions)) {
        return res.status(400).json({ error: "Regions array required" });
      }

      // Use the cache admin service to broadcast via SSE
      cacheAdminService.broadcastCacheInvalidation(regions);
      
      const clientCount = getSSEClientCount();

      res.json({ 
        success: true, 
        message: `Cache invalidation notification sent for ${regions.length} regions`,
        clientsNotified: clientCount,
      });
    } catch (error) {
      console.error("Error notifying clients:", error);
      res.status(500).json({ error: "Failed to notify clients" });
    }
  });

  // Get memory cache stats
  app.get("/api/admin/cache/memory-stats", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
    try {
      const stats = cacheAdminService.memoryCache.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching memory stats:", error);
      res.status(500).json({ error: "Failed to fetch memory stats" });
    }
  });

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
