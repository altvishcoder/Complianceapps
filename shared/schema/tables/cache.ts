import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";

export const cacheLayerEnum = pgEnum('cache_layer', [
  'CLIENT',
  'API',
  'DATABASE',
  'MEMORY',
  'SESSION'
]);

export const cacheClearScopeEnum = pgEnum('cache_clear_scope', [
  'REGION',
  'CATEGORY',
  'LAYER',
  'ALL'
]);

export const cacheClearStatusEnum = pgEnum('cache_clear_status', [
  'SUCCESS',
  'PARTIAL',
  'FAILED',
  'DRY_RUN'
]);

export const cacheRegions = pgTable("cache_regions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  layer: cacheLayerEnum("layer").notNull(),
  category: text("category").notNull(),
  
  queryKeyPattern: text("query_key_pattern"),
  cacheKeyPattern: text("cache_key_pattern"),
  
  autoRefreshSeconds: integer("auto_refresh_seconds"),
  isAutoCleared: boolean("is_auto_cleared").notNull().default(false),
  isProtected: boolean("is_protected").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  metadata: json("metadata").$type<{
    estimatedEntries?: number;
    maxSizeBytes?: number;
    dependentRegions?: string[];
    refreshStrategy?: 'manual' | 'ttl' | 'event';
  }>(),
  
  lastClearedAt: timestamp("last_cleared_at"),
  lastClearedBy: varchar("last_cleared_by"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cacheStats = pgTable("cache_stats", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  regionId: varchar("region_id").notNull(),
  
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  
  hitCount: integer("hit_count").notNull().default(0),
  missCount: integer("miss_count").notNull().default(0),
  evictionCount: integer("eviction_count").notNull().default(0),
  
  estimatedEntries: integer("estimated_entries").notNull().default(0),
  estimatedSizeBytes: integer("estimated_size_bytes").notNull().default(0),
  
  avgResponseTimeMs: real("avg_response_time_ms"),
  
  source: text("source").notNull().default('system'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cacheClearAudit = pgTable("cache_clear_audit", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  scope: cacheClearScopeEnum("scope").notNull(),
  scopeIdentifier: text("scope_identifier"),
  
  initiatedBy: varchar("initiated_by").notNull(),
  initiatorRole: text("initiator_role").notNull(),
  initiatorIp: text("initiator_ip"),
  
  reason: text("reason").notNull(),
  confirmationToken: text("confirmation_token"),
  
  isDryRun: boolean("is_dry_run").notNull().default(false),
  status: cacheClearStatusEnum("status").notNull(),
  
  affectedRegions: json("affected_regions").$type<{
    regionId: string;
    regionName: string;
    layer: string;
    status: string;
    entriesCleared?: number;
    error?: string;
  }[]>(),
  
  totalEntriesCleared: integer("total_entries_cleared").notNull().default(0),
  executionTimeMs: integer("execution_time_ms"),
  
  beforeState: json("before_state").$type<{
    totalEntries: number;
    totalSizeBytes: number;
    byLayer: Record<string, number>;
  }>(),
  afterState: json("after_state").$type<{
    totalEntries: number;
    totalSizeBytes: number;
    byLayer: Record<string, number>;
  }>(),
  
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
