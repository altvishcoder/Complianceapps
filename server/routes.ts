import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./openapi";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { storage } from "./storage";
import { 
  insertSchemeSchema, insertBlockSchema, insertPropertySchema, insertOrganisationSchema,
  insertCertificateSchema, insertExtractionSchema, insertRemedialActionSchema, insertContractorSchema,
  insertComplianceStreamSchema, insertCertificateTypeSchema, insertClassificationCodeSchema, insertExtractionSchemaSchema,
  insertComplianceRuleSchema, insertNormalisationRuleSchema,
  insertComponentTypeSchema, insertUnitSchema, insertComponentSchema, insertDataImportSchema,
  insertDetectionPatternSchema, insertOutcomeRuleSchema,
  extractionRuns, humanReviews, complianceRules, normalisationRules, certificates, properties, ingestionBatches,
  componentTypes, components, units, componentCertificates, users, extractionTierAudits,
  propertyRiskSnapshots, riskFactorDefinitions, riskAlerts, blocks, schemes,
  type ApiClient
} from "@shared/schema";
import { normalizeCertificateTypeCode } from "@shared/certificate-type-mapping";
import { z } from "zod";
import { processExtractionAndSave } from "./extraction";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { db } from "./db";
import { eq, desc, and, count, sql, isNotNull, lt, gte } from "drizzle-orm";
import { addSSEClient, removeSSEClient } from "./events";
import { 
  parseCSV, 
  validateImportData, 
  processPropertyImport, 
  processUnitImport, 
  processComponentImport,
  generateCSVTemplate
} from "./import-parser";
import { enqueueWebhookEvent } from "./webhook-worker";
import { enqueueIngestionJob, getQueueStats } from "./job-queue";
import { recordAudit, extractAuditContext, getChanges } from "./services/audit";
import { 
  validatePassword, 
  checkLoginLockout, 
  recordFailedLogin, 
  clearLoginAttempts,
  getPasswordPolicyDescription 
} from "./services/password-policy";

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

  // OpenAPI/Swagger documentation
  const openApiSpec = generateOpenAPIDocument();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ComplianceAI API Documentation',
  }));
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // ===== AUTHENTICATION ENDPOINTS =====
  
  // Login endpoint with session creation and lockout protection
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Check for account lockout
      const lockoutCheck = await checkLoginLockout(username);
      if (lockoutCheck.isLocked) {
        return res.status(429).json({ 
          error: `Account temporarily locked due to too many failed attempts. Try again in ${lockoutCheck.remainingMinutes} minute(s).`,
          lockedUntil: lockoutCheck.remainingMinutes
        });
      }
      
      // Find user by username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        // Record failed attempt for non-existent users too (prevent user enumeration)
        await recordFailedLogin(username);
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      // Compare password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        const lockoutResult = await recordFailedLogin(username);
        if (lockoutResult.isLocked) {
          return res.status(429).json({ 
            error: `Account locked due to too many failed attempts. Try again in ${lockoutResult.remainingMinutes} minute(s).`,
            lockedUntil: lockoutResult.remainingMinutes
          });
        }
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      // Successful login - clear any failed attempts
      await clearLoginAttempts(username);
      
      // Create session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.organisationId = user.organisationId;
      
      // Record login audit event
      await recordAudit({
        organisationId: user.organisationId,
        eventType: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        entityName: user.name || user.username,
        message: `User ${user.username} logged in`,
        context: {
          actorId: user.id,
          actorName: user.name || user.username,
          actorType: 'USER',
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
          userAgent: req.headers['user-agent'] as string,
        },
      });
      
      // Return user data (excluding password)
      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          organisationId: user.organisationId
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const userId = req.session?.userId;
      const username = req.session?.username;
      const organisationId = req.session?.organisationId;
      
      if (userId && username) {
        // Record logout audit event
        await recordAudit({
          organisationId: organisationId || null,
          eventType: 'USER_LOGOUT',
          entityType: 'USER',
          entityId: userId,
          entityName: username,
          message: `User ${username} logged out`,
          context: {
            actorId: userId,
            actorName: username,
            actorType: 'USER',
            ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
            userAgent: req.headers['user-agent'] as string,
          },
        });
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie('compliance.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });
  
  // Get current user endpoint - session only (no header fallback for security)
  app.get("/api/auth/me", async (req, res) => {
    try {
      // Session-based authentication only - X-User-Id header bypass removed for security
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          organisationId: user.organisationId
        }
      });
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  
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
  app.all("/api/auth/*splat", toNodeHandler(auth));
  
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
  
  // ===== PROPERTIES =====
  app.get("/api/properties", async (req, res) => {
    try {
      const blockId = req.query.blockId as string | undefined;
      const schemeId = req.query.schemeId as string | undefined;
      const properties = await storage.listProperties(ORG_ID, { blockId, schemeId });
      
      // Enrich properties with block and scheme information
      const enrichedProperties = await Promise.all(properties.map(async (prop) => {
        const block = await storage.getBlock(prop.blockId);
        const scheme = block ? await storage.getScheme(block.schemeId) : null;
        return {
          ...prop,
          block,
          scheme,
          fullAddress: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
        };
      }));
      
      res.json(enrichedProperties);
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
  
  // ===== CONTRACTORS =====
  app.get("/api/contractors", async (req, res) => {
    try {
      const contractors = await storage.listContractors(ORG_ID);
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
  app.get("/api/certificates", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const certificates = await storage.listCertificates(ORG_ID, { propertyId, status });
      
      // Enrich with property and extraction data
      const enrichedCertificates = await Promise.all(certificates.map(async (cert) => {
        const property = await storage.getProperty(cert.propertyId);
        const extraction = await storage.getExtractionByCertificate(cert.id);
        return {
          ...cert,
          property,
          extractedData: extraction?.extractedData,
        };
      }));
      
      res.json(enrichedCertificates);
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
      
      const data = insertCertificateSchema.parse({
        ...certificateData,
        organisationId: ORG_ID,
        status: "PROCESSING",
        batchId: batchId || null,
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
          
          // Update batch progress on success
          if (data.batchId) {
            await db.update(ingestionBatches)
              .set({ 
                completedFiles: sql`${ingestionBatches.completedFiles} + 1`,
                status: 'PROCESSING'
              })
              .where(eq(ingestionBatches.id, data.batchId));
          }
        } catch (err) {
          console.error("Error in AI extraction:", err);
          
          // Update batch progress on failure
          if (data.batchId) {
            await db.update(ingestionBatches)
              .set({ 
                failedFiles: sql`${ingestionBatches.failedFiles} + 1`,
                status: 'PROCESSING'
              })
              .where(eq(ingestionBatches.id, data.batchId));
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
  
  // ===== REMEDIAL ACTIONS =====
  app.get("/api/actions", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const actions = await storage.listRemedialActions(ORG_ID, { propertyId, status });
      
      // Filter by severity if provided
      let filteredActions = actions;
      if (severity) {
        filteredActions = actions.filter(a => a.severity === severity);
      }
      
      // Pre-fetch all schemes and blocks for efficiency
      const schemes = await storage.listSchemes(ORG_ID);
      const blocks = await storage.listBlocks(ORG_ID);
      const schemeMap = new Map(schemes.map(s => [s.id, s.name]));
      const blockMap = new Map(blocks.map(b => [b.id, { name: b.name, schemeId: b.schemeId }]));
      
      // Enrich with property, certificate, scheme, and block data
      const enrichedActions = await Promise.all(filteredActions.map(async (action) => {
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
      
      res.json(enrichedActions);
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
  
  // Wipe all data (certificates, actions, extractions)
  app.post("/api/admin/wipe-data", async (req, res) => {
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
  app.post("/api/admin/seed-demo", async (req, res) => {
    try {
      await storage.seedDemoData(ORG_ID);
      res.json({ success: true, message: "Demo data seeded successfully" });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });
  
  // Reset demo (wipe all + reseed)
  app.post("/api/admin/reset-demo", async (req, res) => {
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
  app.post("/api/admin/reclassify-certificates", async (req, res) => {
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
  
  app.patch("/api/users/:id/role", async (req, res) => {
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
      const [batch] = await db.insert(ingestionBatches).values({
        organisationId: ORG_ID,
        name: name || `Batch ${new Date().toISOString()}`,
        totalFiles: totalFiles || 0,
        status: 'PENDING',
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
  
  // List active batches
  app.get("/api/batches", async (req, res) => {
    try {
      const batches = await db.select().from(ingestionBatches).orderBy(desc(ingestionBatches.createdAt)).limit(20);
      res.json(batches);
    } catch (error) {
      console.error("Error listing batches:", error);
      res.status(500).json({ error: "Failed to list batches" });
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
      
      // Awaab's Law breaches - actions that are overdue based on severity timescales
      const awaabsBreaches = allActions.filter(a => {
        if (a.status !== 'OPEN') return false;
        if (!a.dueDate) return false;
        const target = new Date(a.dueDate);
        return target < new Date();
      }).length;
      
      res.json({
        overallCompliance: complianceRate,
        activeHazards,
        immediateHazards,
        awaabsLawBreaches: awaabsBreaches,
        pendingCertificates: pendingCerts,
        totalProperties: allProperties.length,
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
  
  // ===== CONFIGURATION - COMPLIANCE STREAMS =====
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
  
  app.post("/api/config/compliance-streams", async (req, res) => {
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
  
  app.patch("/api/config/compliance-streams/:id", async (req, res) => {
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
  
  app.delete("/api/config/compliance-streams/:id", async (req, res) => {
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
  
  app.post("/api/config/certificate-types", async (req, res) => {
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
  
  app.patch("/api/config/certificate-types/:id", async (req, res) => {
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
  
  app.delete("/api/config/certificate-types/:id", async (req, res) => {
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
  
  app.post("/api/config/classification-codes", async (req, res) => {
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
  
  app.patch("/api/config/classification-codes/:id", async (req, res) => {
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
  
  app.delete("/api/config/classification-codes/:id", async (req, res) => {
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
  
  app.post("/api/config/detection-patterns", async (req, res) => {
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
  
  app.patch("/api/config/detection-patterns/:id", async (req, res) => {
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
  
  app.delete("/api/config/detection-patterns/:id", async (req, res) => {
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
  
  app.post("/api/config/outcome-rules", async (req, res) => {
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
  
  app.patch("/api/config/outcome-rules/:id", async (req, res) => {
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
  
  app.delete("/api/config/outcome-rules/:id", async (req, res) => {
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
  
  app.post("/api/config/extraction-schemas", async (req, res) => {
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
  
  app.patch("/api/config/extraction-schemas/:id", async (req, res) => {
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
  
  app.delete("/api/config/extraction-schemas/:id", async (req, res) => {
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
  
  app.post("/api/config/compliance-rules", async (req, res) => {
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
  
  app.patch("/api/config/compliance-rules/:id", async (req, res) => {
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
  
  app.delete("/api/config/compliance-rules/:id", async (req, res) => {
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
  
  app.post("/api/config/normalisation-rules", async (req, res) => {
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
  
  app.patch("/api/config/normalisation-rules/:id", async (req, res) => {
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
  
  app.delete("/api/config/normalisation-rules/:id", async (req, res) => {
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
  
  // ===== HACT ARCHITECTURE - UNITS =====
  app.get("/api/units", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const unitsList = await storage.listUnits(propertyId);
      res.json(unitsList);
    } catch (error) {
      console.error("Error fetching units:", error);
      res.status(500).json({ error: "Failed to fetch units" });
    }
  });
  
  app.get("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.getUnit(req.params.id);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      console.error("Error fetching unit:", error);
      res.status(500).json({ error: "Failed to fetch unit" });
    }
  });
  
  app.post("/api/units", async (req, res) => {
    try {
      const data = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(data);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error creating unit:", error);
        res.status(500).json({ error: "Failed to create unit" });
      }
    }
  });
  
  app.patch("/api/units/:id", async (req, res) => {
    try {
      const updateData = insertUnitSchema.partial().parse(req.body);
      const updated = await storage.updateUnit(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        console.error("Error updating unit:", error);
        res.status(500).json({ error: "Failed to update unit" });
      }
    }
  });
  
  app.delete("/api/units/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUnit(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting unit:", error);
      res.status(500).json({ error: "Failed to delete unit" });
    }
  });
  
  // ===== HACT ARCHITECTURE - COMPONENTS (ASSETS) =====
  app.get("/api/components", async (req, res) => {
    try {
      const filters = {
        propertyId: req.query.propertyId as string | undefined,
        unitId: req.query.unitId as string | undefined,
        blockId: req.query.blockId as string | undefined,
        componentTypeId: req.query.componentTypeId as string | undefined,
      };
      const componentsList = await storage.listComponents(filters);
      
      // Enrich with component type and property info
      const enriched = await Promise.all(componentsList.map(async (comp) => {
        const type = await storage.getComponentType(comp.componentTypeId);
        const property = comp.propertyId ? await storage.getProperty(comp.propertyId) : undefined;
        return { ...comp, componentType: type, property: property ? { id: property.id, addressLine1: property.addressLine1, postcode: property.postcode } : undefined };
      }));
      
      res.json(enriched);
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
        units: {
          columns: [
            { name: "propertyUprn", required: true, description: "UPRN of parent property" },
            { name: "name", required: true, description: "Unit name (e.g., Kitchen, Communal Hall)" },
            { name: "reference", required: false, description: "Unit reference code" },
            { name: "unitType", required: true, description: "DWELLING, COMMUNAL_AREA, PLANT_ROOM, etc." },
            { name: "floor", required: false, description: "Floor level (Ground, 1st, etc.)" },
            { name: "description", required: false, description: "Description of the unit" },
            { name: "areaSqMeters", required: false, description: "Area of room/unit in square meters" },
            { name: "isAccessible", required: false, description: "true/false - wheelchair accessible" },
            { name: "fireCompartment", required: false, description: "Fire compartmentation zone identifier" },
            { name: "asbestosPresent", required: false, description: "true/false - asbestos present in unit" },
            { name: "hactLocationCode", required: false, description: "HACT/UKHDS location code" },
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
        units: 'units-sample.csv',
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
        case 'UNITS':
          result = await processUnitImport(importId, validRows, dataImport.upsertMode);
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
  
  app.post("/api/admin/webhooks", async (req, res) => {
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
  
  app.patch("/api/admin/webhooks/:id", async (req, res) => {
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
  
  app.delete("/api/admin/webhooks/:id", async (req, res) => {
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
  app.post("/api/admin/webhooks/:id/test", async (req, res) => {
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
  
  app.post("/api/admin/api-keys", async (req, res) => {
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
  
  app.delete("/api/admin/api-keys/:id", async (req, res) => {
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
  // Security note: In production, this should use proper session-based authentication
  // Currently requires both valid user ID AND admin token for defense-in-depth
  const requireAdminRole = async (req: Request, res: Response): Promise<boolean> => {
    // Check for admin token first (if configured in environment)
    const adminToken = process.env.ADMIN_API_TOKEN;
    const providedToken = req.headers['x-admin-token'] as string;
    
    // If admin token is configured, require it
    if (adminToken && adminToken !== providedToken) {
      res.status(401).json({ error: "Invalid or missing admin token" });
      return false;
    }
    
    // Session-based authentication only - X-User-Id header bypass removed for security
    const userId = req.session?.userId;
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
    try {
      const auth = await validateApiKey(req, res);
      if (!auth) return;
      
      const { filename, contentType, fileSize, idempotencyKey } = req.body;
      
      if (!filename || !contentType) {
        return res.status(400).json({ error: "Missing required fields: filename, contentType" });
      }
      
      // Check file size limit from factory settings
      const maxSize = parseInt(await storage.getFactorySettingValue('MAX_FILE_SIZE_MB', '50')) * 1024 * 1024;
      if (fileSize && fileSize > maxSize) {
        return res.status(400).json({ error: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)` });
      }
      
      // Check for idempotency
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
      
      // Update factory setting
      await storage.setFactorySetting('CERTIFICATE_WATCHDOG_INTERVAL_MINUTES', String(intervalMinutes));
      
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
  
  // Audit Trail API Routes - session-based auth only
  app.get("/api/audit-events", async (req, res) => {
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
      // Session-based authentication only - X-User-Id header bypass removed for security
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
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
