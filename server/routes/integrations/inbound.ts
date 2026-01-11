import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import { type ApiClient } from "@shared/schema";
import { enqueueIngestionJob } from "../../job-queue";
import { checkUploadThrottle, endUpload, acquireFileLock, releaseFileLock } from "../../utils/upload-throttle";
import { verifyApiKey, parseIntWithDefault } from "./utils";

export const integrationsInboundRouter = Router();

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

integrationsInboundRouter.post("/integrations/hms/actions", async (req, res) => {
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
    
    const updates: Partial<{ status: string; resolvedAt: Date; costEstimate: string }> = {};
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

integrationsInboundRouter.post("/integrations/hms/work-orders", async (req, res) => {
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
    
    const updates: Partial<{ status: string; resolvedAt: Date; dueDate: string }> = {};
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

integrationsInboundRouter.get("/admin/incoming-webhooks", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await storage.listIncomingWebhookLogs(limit);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching incoming webhooks:", error);
    res.status(500).json({ error: "Failed to fetch incoming webhooks" });
  }
});

integrationsInboundRouter.get("/videos", async (req, res) => {
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

integrationsInboundRouter.get("/videos/:id", async (req, res) => {
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

integrationsInboundRouter.post("/videos", async (req, res) => {
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

integrationsInboundRouter.patch("/videos/:id", async (req, res) => {
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

integrationsInboundRouter.delete("/videos/:id", async (req, res) => {
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

integrationsInboundRouter.post("/videos/:id/download", async (req, res) => {
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

integrationsInboundRouter.get("/v1/certificate-types", async (req, res) => {
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

integrationsInboundRouter.post("/v1/ingestions", async (req, res) => {
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

integrationsInboundRouter.get("/v1/ingestions/:id", async (req, res) => {
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

integrationsInboundRouter.get("/v1/ingestions", async (req, res) => {
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

integrationsInboundRouter.post("/v1/uploads", async (req, res) => {
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
