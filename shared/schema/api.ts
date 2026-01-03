import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";

export const apiClientStatusEnum = pgEnum('api_client_status', ['ACTIVE', 'SUSPENDED', 'REVOKED']);
export const uploadSessionStatusEnum = pgEnum('upload_session_status', ['PENDING', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'FAILED']);
export const ingestionJobStatusEnum = pgEnum('ingestion_job_status', ['QUEUED', 'UPLOADING', 'PROCESSING', 'EXTRACTING', 'COMPLETE', 'FAILED', 'CANCELLED']);
export const ingestionChannelEnum = pgEnum('ingestion_channel', ['MANUAL_UPLOAD', 'EXTERNAL_API', 'BULK_IMPORT', 'DEMO']);
export const webhookAuthTypeEnum = pgEnum('webhook_auth_type', ['NONE', 'API_KEY', 'BEARER', 'HMAC_SHA256']);
export const webhookStatusEnum = pgEnum('webhook_status', ['ACTIVE', 'PAUSED', 'FAILED', 'DISABLED']);
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', ['PENDING', 'SENT', 'FAILED', 'RETRYING']);

export const apiClients = pgTable("api_clients", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  apiKey: text("api_key").notNull().unique(),
  apiKeyPrefix: text("api_key_prefix").notNull(),
  apiSecret: text("api_secret"),
  scopes: text("scopes").array().notNull().default([]),
  rateLimitOverride: json("rate_limit_override"),
  status: apiClientStatusEnum("status").notNull().default('ACTIVE'),
  lastUsedAt: timestamp("last_used_at"),
  requestCount: integer("request_count").notNull().default(0),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const uploadSessions = pgTable("upload_sessions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  apiClientId: varchar("api_client_id").references(() => apiClients.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: text("content_type").notNull(),
  checksum: text("checksum"),
  uploadUrl: text("upload_url"),
  objectPath: text("object_path"),
  status: uploadSessionStatusEnum("status").notNull().default('PENDING'),
  expiresAt: timestamp("expires_at").notNull(),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const rateLimitEntries = pgTable("rate_limit_entries", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: varchar("client_id").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  windowStart: timestamp("window_start").notNull(),
  windowResetAt: timestamp("window_reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiLogs = pgTable("api_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code").notNull(),
  duration: integer("duration").notNull(),
  requestBody: json("request_body"),
  responseBody: json("response_body"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  userId: varchar("user_id").references(() => users.id),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiMetrics = pgTable("api_metrics", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  date: text("date").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  avgDuration: integer("avg_duration").notNull().default(0),
  p95Duration: integer("p95_duration").notNull().default(0),
  minDuration: integer("min_duration").notNull().default(0),
  maxDuration: integer("max_duration").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authType: webhookAuthTypeEnum("auth_type").notNull().default('NONE'),
  authValue: text("auth_value"),
  headers: json("headers"),
  events: text("events").array().notNull(),
  status: webhookStatusEnum("status").notNull().default('ACTIVE'),
  retryCount: integer("retry_count").notNull().default(3),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text("event_type").notNull(),
  payload: json("payload").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  webhookEndpointId: varchar("webhook_endpoint_id").references(() => webhookEndpoints.id, { onDelete: 'cascade' }).notNull(),
  eventId: varchar("event_id").references(() => webhookEvents.id).notNull(),
  status: webhookDeliveryStatusEnum("status").notNull().default('PENDING'),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const incomingWebhookLogs = pgTable("incoming_webhook_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull(),
  eventType: text("event_type"),
  payload: json("payload").notNull(),
  headers: json("headers"),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes").array().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiClient = typeof apiClients.$inferSelect;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;
export type ApiLog = typeof apiLogs.$inferSelect;
export type ApiMetric = typeof apiMetrics.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type IncomingWebhookLog = typeof incomingWebhookLogs.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
