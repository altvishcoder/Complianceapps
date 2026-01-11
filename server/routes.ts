import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./openapi";
import { storage } from "./storage";
import { requireRole } from "./session";
import { componentTypes } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getQueueStats } from "./job-queue";
import { getApiLimitsConfig } from "./services/api-limits";
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
import { configurationRouter } from "./routes/configuration.routes";
import { assistantRouter } from "./routes/assistant.routes";
import { searchRouter } from "./routes/search.routes";
import { goldenThreadRouter } from "./routes/golden-thread.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { systemRouter } from "./routes/system.routes";
import { geoRouter } from "./routes/geo.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { staffRouter } from "./routes/staff.routes";
import { hierarchyRouter } from "./routes/hierarchy.routes";
import { authEndpointsRouter } from "./routes/auth-endpoints.routes";
import { brandingRouter } from "./routes/branding.routes";

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
  
  await seedDefaultComponentTypes();
  
  registerObjectStorageRoutes(app);
  
  // Mount domain routers
  app.use('/api/observability', observabilityRoutes);
  app.use('/api/admin', adminRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api', propertiesRouter);
  app.use('/api/certificates', certificatesRouter);
  app.use('/api/contractors', contractorsRouter);
  app.use('/api/actions', remedialRouter);
  app.use('/api', mlRouter);
  app.use('/api', importsRouter);
  app.use('/api/components', componentsRouter);
  app.use('/api', extractionRouter);
  app.use('/api', configRouter);
  app.use('/api', configurationRouter);
  app.use('/api', assistantRouter);
  app.use('/api', searchRouter);
  app.use('/api', goldenThreadRouter);
  app.use('/api', integrationsRouter);
  app.use('/api', systemRouter);
  app.use('/api', geoRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', staffRouter);
  app.use('/api', hierarchyRouter);
  app.use('/api', authEndpointsRouter);
  app.use('/api', brandingRouter);

  // OpenAPI/Swagger documentation
  let cachedOpenApiSpec = generateOpenAPIDocument();
  let lastSpecGeneration = new Date();
  
  const getOpenApiSpec = () => {
    const now = new Date();
    if (now.getTime() - lastSpecGeneration.getTime() > 60000) {
      cachedOpenApiSpec = generateOpenAPIDocument();
      lastSpecGeneration = now;
    }
    return cachedOpenApiSpec;
  };
  
  app.use('/api/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
    swaggerUi.setup(getOpenApiSpec(), {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'ComplianceAI API Documentation',
    })(req, res, next);
  });
  
  app.get('/api/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });
  
  app.post('/api/openapi/refresh', (_req, res) => {
    cachedOpenApiSpec = generateOpenAPIDocument();
    lastSpecGeneration = new Date();
    res.json({ 
      success: true, 
      message: 'OpenAPI specification refreshed',
      generatedAt: lastSpecGeneration.toISOString()
    });
  });
  
  app.get('/api/openapi/status', (_req, res) => {
    res.json({
      lastGenerated: lastSpecGeneration.toISOString(),
      endpointCount: Object.keys(cachedOpenApiSpec.paths || {}).length,
      version: cachedOpenApiSpec.info?.version || '1.0.0'
    });
  });

  const ORG_ID = "default-org";
  const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
  
  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, { status: string; latency?: number; details?: any }> = {};
    const startTime = Date.now();
    
    try {
      const dbStart = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'unhealthy', details: 'Database connection failed' };
    }
    
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
    
    const memUsage = process.memoryUsage();
    checks.memory = {
      status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
      details: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      }
    };
    
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
  
  // Version endpoints
  app.get("/api/version", async (_req, res) => {
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
  
  app.get("/api/version/releases", async (_req, res) => {
    try {
      const { RELEASE_NOTES } = await import("@shared/version");
      res.json(RELEASE_NOTES);
    } catch (error) {
      console.error("Error fetching release notes:", error);
      res.status(500).json({ error: "Failed to fetch release notes" });
    }
  });

  app.get("/api/version/api-info", (_req, res) => {
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

  // API limits config
  app.get("/api/config/limits", async (_req, res) => {
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
  
  // Webhook Endpoints (Admin)
  app.get("/api/admin/webhooks", async (_req, res) => {
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
  app.get("/api/admin/api-keys", async (_req, res) => {
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
  
  // HMS Integration Endpoints
  app.post("/api/integrations/hms/actions", async (req, res) => {
    try {
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: req.body.eventType || 'action_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { actionId, status, completedAt, costActual } = req.body;
      
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
  
  app.post("/api/integrations/hms/work-orders", async (req, res) => {
    try {
      const log = await storage.createIncomingWebhookLog({
        source: 'HMS',
        eventType: 'work_order_update',
        payload: req.body,
        headers: req.headers as any
      });
      
      const { workOrderId, actionId, status, scheduledDate } = req.body;
      
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

  return httpServer;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
