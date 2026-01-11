import { 
  apiLogs, apiMetrics, webhookEndpoints, webhookEvents, webhookDeliveries, 
  incomingWebhookLogs, apiKeys, apiClients, uploadSessions, ingestionJobs, 
  rateLimitEntries, videos, aiSuggestions
} from "@shared/schema";
import type { 
  ApiLog, InsertApiLog,
  ApiMetric,
  WebhookEndpoint, InsertWebhookEndpoint,
  WebhookEvent, InsertWebhookEvent,
  WebhookDelivery, InsertWebhookDelivery,
  IncomingWebhookLog, InsertIncomingWebhookLog,
  ApiKey, InsertApiKey,
  ApiClient, InsertApiClient,
  UploadSession, InsertUploadSession,
  IngestionJob, InsertIngestionJob,
  Video, InsertVideo,
  AiSuggestion, InsertAiSuggestion
} from "@shared/schema";
import { db, eq, and, or, desc, sql, gte, lte } from "../base";
import type { IApiStorage } from "../interfaces";

export class ApiStorage implements IApiStorage {
  async listApiLogs(limit: number = 100, offset: number = 0): Promise<ApiLog[]> {
    return db.select().from(apiLogs)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  async createApiLog(log: InsertApiLog): Promise<ApiLog> {
    const [created] = await db.insert(apiLogs).values(log).returning();
    return created;
  }
  
  async getApiLogStats(): Promise<{ total: number; errors: number; avgDuration: number }> {
    const logs = await db.select().from(apiLogs);
    const total = logs.length;
    const errors = logs.filter(l => l.statusCode >= 400).length;
    const avgDuration = total > 0 ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / total) : 0;
    return { total, errors, avgDuration };
  }
  
  async listApiMetrics(startDate?: string, endDate?: string): Promise<ApiMetric[]> {
    const conditions = [];
    if (startDate) conditions.push(gte(apiMetrics.date, startDate));
    if (endDate) conditions.push(lte(apiMetrics.date, endDate));
    
    if (conditions.length > 0) {
      return db.select().from(apiMetrics)
        .where(and(...conditions))
        .orderBy(desc(apiMetrics.date));
    }
    return db.select().from(apiMetrics).orderBy(desc(apiMetrics.date));
  }
  
  async getOrCreateApiMetric(endpoint: string, method: string, date: string): Promise<ApiMetric> {
    const [existing] = await db.select().from(apiMetrics)
      .where(and(
        eq(apiMetrics.endpoint, endpoint),
        eq(apiMetrics.method, method),
        eq(apiMetrics.date, date)
      ));
    
    if (existing) return existing;
    
    const [created] = await db.insert(apiMetrics).values({
      endpoint,
      method,
      date,
      requestCount: 0,
      errorCount: 0,
      avgDuration: 0,
      p95Duration: 0,
      minDuration: 0,
      maxDuration: 0,
    }).returning();
    return created;
  }
  
  async updateApiMetric(id: string, updates: Partial<ApiMetric>): Promise<ApiMetric | undefined> {
    const [updated] = await db.update(apiMetrics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiMetrics.id, id))
      .returning();
    return updated || undefined;
  }
  
  async listWebhookEndpoints(organisationId: string): Promise<WebhookEndpoint[]> {
    return db.select().from(webhookEndpoints)
      .where(eq(webhookEndpoints.organisationId, organisationId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }
  
  async getWebhookEndpoint(id: string): Promise<WebhookEndpoint | undefined> {
    const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    return endpoint || undefined;
  }
  
  async createWebhookEndpoint(endpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint> {
    const [created] = await db.insert(webhookEndpoints).values(endpoint).returning();
    return created;
  }
  
  async updateWebhookEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | undefined> {
    const [updated] = await db.update(webhookEndpoints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteWebhookEndpoint(id: string): Promise<boolean> {
    const result = await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)).returning();
    return result.length > 0;
  }
  
  async getActiveWebhooksForEvent(eventType: string): Promise<WebhookEndpoint[]> {
    const endpoints = await db.select().from(webhookEndpoints)
      .where(eq(webhookEndpoints.status, 'ACTIVE'));
    return endpoints.filter(e => e.events.includes(eventType));
  }
  
  async listWebhookEvents(limit: number = 100): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }
  
  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const [created] = await db.insert(webhookEvents).values(event).returning();
    return created;
  }
  
  async markWebhookEventProcessed(id: string): Promise<boolean> {
    const [updated] = await db.update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.id, id))
      .returning();
    return !!updated;
  }
  
  async getPendingWebhookEvents(): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents)
      .where(eq(webhookEvents.processed, false))
      .orderBy(webhookEvents.createdAt);
  }
  
  async listWebhookDeliveries(webhookEndpointId?: string, limit: number = 100): Promise<WebhookDelivery[]> {
    if (webhookEndpointId) {
      return db.select().from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookEndpointId, webhookEndpointId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);
    }
    return db.select().from(webhookDeliveries)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }
  
  async createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery> {
    const [created] = await db.insert(webhookDeliveries).values(delivery).returning();
    return created;
  }
  
  async updateWebhookDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | undefined> {
    const [updated] = await db.update(webhookDeliveries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    return updated || undefined;
  }
  
  async listIncomingWebhookLogs(limit: number = 100): Promise<IncomingWebhookLog[]> {
    return db.select().from(incomingWebhookLogs)
      .orderBy(desc(incomingWebhookLogs.createdAt))
      .limit(limit);
  }
  
  async createIncomingWebhookLog(log: InsertIncomingWebhookLog): Promise<IncomingWebhookLog> {
    const [created] = await db.insert(incomingWebhookLogs).values(log).returning();
    return created;
  }
  
  async updateIncomingWebhookLog(id: string, updates: Partial<IncomingWebhookLog>): Promise<IncomingWebhookLog | undefined> {
    const [updated] = await db.update(incomingWebhookLogs)
      .set(updates)
      .where(eq(incomingWebhookLogs.id, id))
      .returning();
    return updated || undefined;
  }
  
  async listApiKeys(organisationId: string): Promise<ApiKey[]> {
    return db.select().from(apiKeys)
      .where(eq(apiKeys.organisationId, organisationId))
      .orderBy(desc(apiKeys.createdAt));
  }
  
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key || undefined;
  }
  
  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));
    return key || undefined;
  }
  
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
  }
  
  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db.update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }
  
  async listApiClients(organisationId: string): Promise<ApiClient[]> {
    return db.select().from(apiClients)
      .where(eq(apiClients.organisationId, organisationId))
      .orderBy(desc(apiClients.createdAt));
  }
  
  async getApiClient(id: string): Promise<ApiClient | undefined> {
    const [client] = await db.select().from(apiClients).where(eq(apiClients.id, id));
    return client || undefined;
  }
  
  async getApiClientByKey(apiKeyPrefix: string): Promise<ApiClient | undefined> {
    const [client] = await db.select().from(apiClients).where(eq(apiClients.apiKeyPrefix, apiKeyPrefix));
    return client || undefined;
  }
  
  async createApiClient(client: InsertApiClient): Promise<ApiClient> {
    const [created] = await db.insert(apiClients).values(client).returning();
    return created;
  }
  
  async updateApiClient(id: string, updates: Partial<ApiClient>): Promise<ApiClient | undefined> {
    const [updated] = await db.update(apiClients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiClients.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteApiClient(id: string): Promise<boolean> {
    const result = await db.delete(apiClients).where(eq(apiClients.id, id)).returning();
    return result.length > 0;
  }
  
  async incrementApiClientUsage(id: string): Promise<void> {
    await db.update(apiClients)
      .set({ 
        lastUsedAt: new Date(),
        requestCount: sql`${apiClients.requestCount} + 1`
      })
      .where(eq(apiClients.id, id));
  }
  
  async listUploadSessions(organisationId: string): Promise<UploadSession[]> {
    return db.select().from(uploadSessions)
      .where(eq(uploadSessions.organisationId, organisationId))
      .orderBy(desc(uploadSessions.createdAt));
  }
  
  async getUploadSession(id: string): Promise<UploadSession | undefined> {
    const [session] = await db.select().from(uploadSessions).where(eq(uploadSessions.id, id));
    return session || undefined;
  }
  
  async getUploadSessionByIdempotencyKey(key: string): Promise<UploadSession | undefined> {
    const [session] = await db.select().from(uploadSessions).where(eq(uploadSessions.idempotencyKey, key));
    return session || undefined;
  }
  
  async createUploadSession(session: InsertUploadSession): Promise<UploadSession> {
    const [created] = await db.insert(uploadSessions).values(session).returning();
    return created;
  }
  
  async updateUploadSession(id: string, updates: Partial<UploadSession>): Promise<UploadSession | undefined> {
    const [updated] = await db.update(uploadSessions)
      .set(updates)
      .where(eq(uploadSessions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async cleanupExpiredUploadSessions(): Promise<number> {
    const result = await db.delete(uploadSessions)
      .where(and(
        eq(uploadSessions.status, 'PENDING' as any),
        lte(uploadSessions.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }
  
  async listIngestionJobs(organisationId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]> {
    const conditions = [eq(ingestionJobs.organisationId, organisationId)];
    if (filters?.status) {
      conditions.push(eq(ingestionJobs.status, filters.status as any));
    }
    
    let query = db.select()
      .from(ingestionJobs)
      .where(and(...conditions))
      .orderBy(desc(ingestionJobs.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return query;
  }
  
  async listAllIngestionJobs(filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]> {
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(ingestionJobs.status, filters.status as any));
    }
    
    let query = db.select()
      .from(ingestionJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ingestionJobs.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return query;
  }
  
  async getIngestionJob(id: string): Promise<IngestionJob | undefined> {
    const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, id));
    return job || undefined;
  }
  
  async getIngestionJobByIdempotencyKey(key: string): Promise<IngestionJob | undefined> {
    const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.idempotencyKey, key));
    return job || undefined;
  }
  
  async createIngestionJob(job: InsertIngestionJob): Promise<IngestionJob> {
    const [created] = await db.insert(ingestionJobs).values(job).returning();
    return created;
  }
  
  async updateIngestionJob(id: string, updates: Partial<IngestionJob>): Promise<IngestionJob | undefined> {
    const [updated] = await db.update(ingestionJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ingestionJobs.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getNextPendingIngestionJob(): Promise<IngestionJob | undefined> {
    const [job] = await db.select()
      .from(ingestionJobs)
      .where(eq(ingestionJobs.status, 'PENDING'))
      .orderBy(ingestionJobs.createdAt)
      .limit(1);
    return job || undefined;
  }
  
  async deleteIngestionJobsByChannel(channel: string): Promise<number> {
    const result = await db.delete(ingestionJobs)
      .where(eq(ingestionJobs.channel, channel as any))
      .returning();
    return result.length;
  }
  
  async getIngestionStats(): Promise<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    recentErrors: IngestionJob[];
    throughputByHour: Array<{ hour: string; count: number }>;
    avgProcessingTime: number;
    successRate: number;
  }> {
    const allJobs = await db.select().from(ingestionJobs);
    
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    
    for (const job of allJobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      byType[job.contentType] = (byType[job.contentType] || 0) + 1;
      byChannel[job.channel] = (byChannel[job.channel] || 0) + 1;
    }
    
    const recentErrors = allJobs
      .filter(j => j.status === 'FAILED')
      .slice(0, 10);
    
    const throughputByHour: Array<{ hour: string; count: number }> = [];
    const completed = allJobs.filter(j => j.status === 'COMPLETED');
    const avgProcessingTime = completed.length > 0
      ? Math.round(completed.reduce((sum, j) => sum + (j.processingTimeMs || 0), 0) / completed.length)
      : 0;
    
    const total = allJobs.length;
    const successRate = total > 0 ? (completed.length / total) * 100 : 0;
    
    return { byStatus, byType, byChannel, recentErrors, throughputByHour, avgProcessingTime, successRate };
  }
  
  async checkAndIncrementRateLimit(clientId: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    await db.delete(rateLimitEntries)
      .where(lte(rateLimitEntries.expiresAt, now));
    
    const [existing] = await db.select()
      .from(rateLimitEntries)
      .where(and(
        eq(rateLimitEntries.clientId, clientId),
        gte(rateLimitEntries.windowStart, windowStart)
      ));
    
    if (existing) {
      const newCount = existing.requestCount + 1;
      const allowed = newCount <= limit;
      
      if (allowed) {
        await db.update(rateLimitEntries)
          .set({ requestCount: newCount, updatedAt: now })
          .where(eq(rateLimitEntries.id, existing.id));
      }
      
      return {
        allowed,
        remaining: Math.max(0, limit - newCount),
        resetAt: existing.expiresAt
      };
    }
    
    const expiresAt = new Date(now.getTime() + windowMs);
    await db.insert(rateLimitEntries).values({
      clientId,
      windowStart: now,
      requestCount: 1,
      expiresAt
    });
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: expiresAt
    };
  }
  
  async cleanupExpiredRateLimits(): Promise<number> {
    const result = await db.delete(rateLimitEntries)
      .where(lte(rateLimitEntries.expiresAt, new Date()))
      .returning();
    return result.length;
  }
  
  async listVideos(organisationId: string): Promise<Video[]> {
    return db.select().from(videos)
      .where(eq(videos.organisationId, organisationId))
      .orderBy(desc(videos.createdAt));
  }
  
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }
  
  async createVideo(video: InsertVideo): Promise<Video> {
    const [created] = await db.insert(videos).values(video).returning();
    return created;
  }
  
  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined> {
    const [updated] = await db.update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }
  
  async incrementVideoView(id: string): Promise<void> {
    await db.update(videos)
      .set({ viewCount: sql`${videos.viewCount} + 1` })
      .where(eq(videos.id, id));
  }
  
  async incrementVideoDownload(id: string): Promise<void> {
    await db.update(videos)
      .set({ downloadCount: sql`${videos.downloadCount} + 1` })
      .where(eq(videos.id, id));
  }
  
  async listAiSuggestions(organisationId: string, status?: string): Promise<AiSuggestion[]> {
    if (status) {
      return db.select().from(aiSuggestions)
        .where(and(eq(aiSuggestions.organisationId, organisationId), eq(aiSuggestions.status, status as any)))
        .orderBy(desc(aiSuggestions.createdAt));
    }
    return db.select().from(aiSuggestions)
      .where(eq(aiSuggestions.organisationId, organisationId))
      .orderBy(desc(aiSuggestions.createdAt));
  }
  
  async getAiSuggestion(id: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id));
    return suggestion || undefined;
  }
  
  async getAiSuggestionByKey(organisationId: string, suggestionKey: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.organisationId, organisationId),
        eq(aiSuggestions.suggestionKey, suggestionKey)
      ));
    return suggestion || undefined;
  }
  
  async createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion> {
    const [created] = await db.insert(aiSuggestions).values(suggestion).returning();
    return created;
  }
  
  async updateAiSuggestion(id: string, updates: Partial<AiSuggestion>): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteAiSuggestion(id: string): Promise<boolean> {
    const result = await db.delete(aiSuggestions).where(eq(aiSuggestions.id, id)).returning();
    return result.length > 0;
  }
  
  async dismissAiSuggestion(id: string, reason?: string): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ 
        status: 'DISMISSED' as any,
        dismissedAt: new Date(),
        dismissReason: reason,
        updatedAt: new Date()
      })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async resolveAiSuggestion(id: string, userId?: string): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ 
        status: 'RESOLVED' as any,
        resolvedAt: new Date(),
        actionedById: userId,
        progressPercent: 100,
        updatedAt: new Date()
      })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async autoResolveAiSuggestions(organisationId: string): Promise<number> {
    const activeSuggestions = await db.select().from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.organisationId, organisationId),
        eq(aiSuggestions.status, 'ACTIVE' as any)
      ));
    
    let resolvedCount = 0;
    for (const suggestion of activeSuggestions) {
      if (suggestion.currentValue !== null && suggestion.targetValue !== null) {
        if (suggestion.currentValue >= suggestion.targetValue) {
          await db.update(aiSuggestions)
            .set({ 
              status: 'AUTO_RESOLVED' as any,
              resolvedAt: new Date(),
              progressPercent: 100,
              updatedAt: new Date()
            })
            .where(eq(aiSuggestions.id, suggestion.id));
          resolvedCount++;
        }
      }
    }
    return resolvedCount;
  }
}

export const apiStorage = new ApiStorage();
