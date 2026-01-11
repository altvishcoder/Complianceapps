import { Router, Request, Response } from "express";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../session";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users, type ApiClient } from "@shared/schema";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";
import { enqueueIngestionJob, getQueueStats } from "../job-queue";
import { checkUploadThrottle, endUpload, acquireFileLock, releaseFileLock } from "../utils/upload-throttle";
import { clearApiLimitsCache } from "../services/api-limits";
import { clearTierThresholdsCache } from "../services/risk-scoring";

export const integrationsRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyApiKey(providedKey: string, storedHash: string): Promise<boolean> {
  const providedHash = await hashApiKey(providedKey);
  return providedHash === storedHash;
}

const requireAdminRole = async (req: Request, res: Response): Promise<boolean> => {
  const adminToken = process.env.ADMIN_API_TOKEN;
  const providedToken = req.headers['x-admin-token'] as string;
  
  if (adminToken && adminToken !== providedToken) {
    res.status(401).json({ error: "Invalid or missing admin token" });
    return false;
  }
  
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

// ===== API MONITORING & INTEGRATIONS =====

integrationsRouter.get("/admin/coverage", async (req, res) => {
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

integrationsRouter.get("/admin/api-logs", async (req, res) => {
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

integrationsRouter.get("/admin/api-metrics", async (req, res) => {
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

integrationsRouter.get("/admin/webhooks", async (req, res) => {
  try {
    const webhooks = await storage.listWebhookEndpoints(ORG_ID);
    res.json(webhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

integrationsRouter.post("/admin/webhooks", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.patch("/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.delete("/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.post("/admin/webhooks/:id/test", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.get("/admin/webhook-deliveries", async (req, res) => {
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

integrationsRouter.get("/admin/webhook-events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await storage.listWebhookEvents(limit);
    res.json(events);
  } catch (error) {
    console.error("Error fetching webhook events:", error);
    res.status(500).json({ error: "Failed to fetch webhook events" });
  }
});

integrationsRouter.get("/admin/incoming-webhooks", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await storage.listIncomingWebhookLogs(limit);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching incoming webhooks:", error);
    res.status(500).json({ error: "Failed to fetch incoming webhooks" });
  }
});

integrationsRouter.get("/admin/api-keys", async (req, res) => {
  try {
    const keys = await storage.listApiKeys(ORG_ID);
    res.json(keys.map(k => ({ ...k, keyHash: undefined })));
  } catch (error) {
    console.error("Error fetching API keys:", error);
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

integrationsRouter.post("/admin/api-keys", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.delete("/admin/api-keys/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
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

integrationsRouter.post("/integrations/hms/actions", async (req, res) => {
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

integrationsRouter.post("/integrations/hms/work-orders", async (req, res) => {
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

integrationsRouter.get("/videos", async (req, res) => {
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

integrationsRouter.get("/videos/:id", async (req, res) => {
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

integrationsRouter.post("/videos", async (req, res) => {
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

integrationsRouter.patch("/videos/:id", async (req, res) => {
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

integrationsRouter.delete("/videos/:id", async (req, res) => {
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

integrationsRouter.post("/videos/:id/download", async (req, res) => {
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

// ===== API CLIENTS (for external integrations) =====

integrationsRouter.get("/admin/api-clients", async (req, res) => {
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

integrationsRouter.post("/admin/api-clients", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { name, description, scopes, organisationId, createdById } = req.body;
    
    const apiKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPrefix = apiKey.substring(0, 12);
    const keyHash = await hashApiKey(apiKey);
    
    const rateLimit = parseInt(await storage.getFactorySettingValue('RATE_LIMIT_REQUESTS_PER_MINUTE', '60'));
    const expiryDays = parseInt(await storage.getFactorySettingValue('API_KEY_EXPIRY_DAYS', '365'));
    
    const client = await storage.createApiClient({
      name,
      description,
      organisationId: organisationId || 'default-org',
      apiKey: keyHash,
      apiKeyPrefix: keyPrefix,
      scopes: scopes || ['read', 'write'],
      createdById: createdById || 'system'
    });
    
    res.json({ ...client, apiKey });
  } catch (error) {
    console.error("Error creating API client:", error);
    res.status(500).json({ error: "Failed to create API client" });
  }
});

integrationsRouter.patch("/admin/api-clients/:id", async (req, res) => {
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

integrationsRouter.delete("/admin/api-clients/:id", async (req, res) => {
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

const parseIntWithDefault = (value: string, defaultVal: number): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultVal : parsed;
};

let rateLimitWindowMs = 60000;
let rateLimitCleanupIntervalMs = 60000;
let cleanupIntervalId: NodeJS.Timeout | null = null;

async function initRateLimiting() {
  rateLimitWindowMs = parseIntWithDefault(await storage.getFactorySettingValue('RATE_LIMIT_WINDOW_MS', '60000'), 60000);
  rateLimitCleanupIntervalMs = parseIntWithDefault(await storage.getFactorySettingValue('RATE_LIMIT_CLEANUP_INTERVAL_MS', '60000'), 60000);
  
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }
  
  cleanupIntervalId = setInterval(async () => {
    try {
      await storage.cleanupExpiredRateLimits();
    } catch (error) {
      console.error("Error cleaning up rate limits:", error);
    }
  }, rateLimitCleanupIntervalMs);
}

initRateLimiting().catch(console.error);

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

const validateApiKey = async (req: Request, res: Response): Promise<{ client: ApiClient } | null> => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ error: "Missing API key. Provide X-API-Key header." });
    return null;
  }
  
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
  
  const isValid = await verifyApiKey(apiKey, client.apiKey);
  if (!isValid) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }
  
  if (client.status !== 'ACTIVE') {
    res.status(403).json({ error: "API key is disabled" });
    return null;
  }
  
  const withinLimit = await checkRateLimit(client.id, res);
  if (!withinLimit) {
    return null;
  }
  
  await storage.incrementApiClientUsage(client.id);
  
  return { client };
};

// ===== INGESTION API (External Certificate Submission) =====

integrationsRouter.get("/v1/certificate-types", async (req, res) => {
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

integrationsRouter.post("/v1/ingestions", async (req, res) => {
  try {
    const auth = await validateApiKey(req, res);
    if (!auth) return;
    
    const { propertyId, certificateType, fileName, objectPath, webhookUrl, idempotencyKey } = req.body;
    
    if (!propertyId || !certificateType || !fileName) {
      return res.status(400).json({ 
        error: "Missing required fields: propertyId, certificateType, and fileName are required" 
      });
    }
    
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
    
    if (idempotencyKey) {
      const existing = await storage.getIngestionJobByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json({ id: existing.id, status: existing.status, message: "Existing job returned (idempotent)" });
      }
    }
    
    const throttleResult = checkUploadThrottle(auth.client.id);
    if (!throttleResult.allowed) {
      return res.status(429).json({
        error: throttleResult.reason,
        retryAfterMs: throttleResult.retryAfterMs,
      });
    }
    
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

integrationsRouter.get("/v1/ingestions/:id", async (req, res) => {
  try {
    const auth = await validateApiKey(req, res);
    if (!auth) return;
    
    const job = await storage.getIngestionJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Ingestion job not found" });
    }
    
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

integrationsRouter.get("/v1/ingestions", async (req, res) => {
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

integrationsRouter.post("/v1/uploads", async (req, res) => {
  let slotAcquired = false;
  let clientId: string | undefined;
  
  try {
    const auth = await validateApiKey(req, res);
    if (!auth) return;
    
    clientId = auth.client.id;
    
    const { filename, contentType, fileSize, idempotencyKey } = req.body;
    
    if (!filename || !contentType) {
      return res.status(400).json({ error: "Missing required fields: filename, contentType" });
    }
    
    const maxSize = parseInt(await storage.getFactorySettingValue('MAX_FILE_SIZE_MB', '50')) * 1024 * 1024;
    if (fileSize && fileSize > maxSize) {
      return res.status(400).json({ error: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)` });
    }
    
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
    
    const throttleResult = checkUploadThrottle(clientId);
    if (!throttleResult.allowed) {
      return res.status(429).json({
        error: throttleResult.reason,
        retryAfterMs: throttleResult.retryAfterMs,
      });
    }
    slotAcquired = true;
    
    const objectPath = `ingestions/${auth.client.organisationId}/${Date.now()}_${filename}`;
    
    const session = await storage.createUploadSession({
      organisationId: auth.client.organisationId,
      fileName: filename,
      contentType,
      fileSize: fileSize || 0,
      objectPath,
      uploadUrl: `/api/v1/uploads/${objectPath}`,
      idempotencyKey,
      apiClientId: auth.client.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
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
