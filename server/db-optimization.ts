import { db } from "./db";
import { sql, desc, eq } from "drizzle-orm";
import { 
  performanceIndexDefinitions, 
  allMaterializedViewDefinitions,
  allMaterializedViewIndexDefinitions,
  expiryTrackerTableDefinition,
  riskSnapshotTableDefinition,
  assetHealthSummaryTableDefinition,
  auditArchivalTableDefinition,
  archiveOldAuditEventsSQL,
  purgeOldArchivesSQL,
  materializedViewCategories
} from "@shared/schema/tables/performance-indexes";
import { mvRefreshHistory, mvRefreshSchedule } from "@shared/schema/tables/cache";

const optimizationLogger = {
  info: (msg: string, data?: any) => console.log(`[DB-OPT] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[DB-OPT ERROR] ${msg}`, error || ''),
};

type RefreshTrigger = 'MANUAL' | 'SCHEDULED' | 'POST_INGESTION' | 'SYSTEM';

async function getViewRowCount(viewName: string): Promise<number> {
  try {
    const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${viewName}`));
    return parseInt((result.rows?.[0] as any)?.count || '0');
  } catch {
    return 0;
  }
}

async function logRefreshHistory(
  viewName: string,
  category: string | null,
  status: 'SUCCESS' | 'FAILED' | 'RUNNING',
  trigger: RefreshTrigger,
  startedAt: Date,
  durationMs: number,
  rowCountBefore: number,
  rowCountAfter: number,
  initiatedBy?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await db.insert(mvRefreshHistory).values({
      viewName,
      category,
      status,
      trigger,
      startedAt,
      completedAt: new Date(),
      durationMs,
      rowCountBefore,
      rowCountAfter,
      rowDelta: rowCountAfter - rowCountBefore,
      initiatedBy,
      errorMessage,
    });
  } catch (error) {
    optimizationLogger.error('Failed to log refresh history', error);
  }
}

export async function applyPerformanceIndexes(): Promise<{ success: boolean; applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;
  
  try {
    optimizationLogger.info("Applying performance indexes...");
    
    const statements = performanceIndexDefinitions
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
        applied++;
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          errors.push(`Index error: ${error.message}`);
        }
      }
    }
    
    optimizationLogger.info(`Applied ${applied} performance indexes`);
    return { success: true, applied, errors };
  } catch (error: any) {
    optimizationLogger.error("Failed to apply performance indexes", error);
    return { success: false, applied, errors: [error.message] };
  }
}

export async function createMaterializedViews(): Promise<{ success: boolean; created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  
  try {
    optimizationLogger.info("Creating materialized views...");
    
    const viewStatements = allMaterializedViewDefinitions
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of viewStatements) {
      try {
        await db.execute(sql.raw(statement));
        created++;
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          errors.push(`View error: ${error.message}`);
        }
      }
    }
    
    const indexStatements = allMaterializedViewIndexDefinitions
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of indexStatements) {
      try {
        await db.execute(sql.raw(statement));
        created++;
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          errors.push(`View index error: ${error.message}`);
        }
      }
    }
    
    optimizationLogger.info(`Created ${created} materialized views/indexes`);
    return { success: true, created, errors };
  } catch (error: any) {
    optimizationLogger.error("Failed to create materialized views", error);
    return { success: false, created, errors: [error.message] };
  }
}

export async function createOptimizationTables(): Promise<{ success: boolean; created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  
  try {
    optimizationLogger.info("Creating optimization tables...");
    
    const allDefinitions = [
      expiryTrackerTableDefinition,
      riskSnapshotTableDefinition,
      assetHealthSummaryTableDefinition,
      auditArchivalTableDefinition
    ];
    
    for (const definition of allDefinitions) {
      const statements = definition
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
          created++;
        } catch (error: any) {
          if (!error.message?.includes('already exists')) {
            errors.push(`Table error: ${error.message}`);
          }
        }
      }
    }
    
    optimizationLogger.info(`Created ${created} optimization table/index objects`);
    return { success: true, created, errors };
  } catch (error: any) {
    optimizationLogger.error("Failed to create optimization tables", error);
    return { success: false, created, errors: [error.message] };
  }
}

export async function refreshMaterializedView(
  viewName: string, 
  trigger: RefreshTrigger = 'MANUAL',
  initiatedBy?: string,
  allowBlockingRefresh: boolean = false
): Promise<{ success: boolean; durationMs: number; rowCount: number; wasBlocking?: boolean }> {
  const startTime = new Date();
  const startMs = Date.now();
  const category = getViewCategory(viewName);
  const rowCountBefore = await getViewRowCount(viewName);
  
  try {
    // Always try CONCURRENTLY first (non-blocking, requires unique index)
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`));
    const durationMs = Date.now() - startMs;
    const rowCountAfter = await getViewRowCount(viewName);
    
    await logRefreshHistory(viewName, category, 'SUCCESS', trigger, startTime, durationMs, rowCountBefore, rowCountAfter, initiatedBy);
    
    optimizationLogger.info(`Refreshed ${viewName} in ${durationMs}ms (${rowCountAfter} rows, delta: ${rowCountAfter - rowCountBefore})`);
    return { success: true, durationMs, rowCount: rowCountAfter, wasBlocking: false };
  } catch (error: any) {
    // CONCURRENTLY requires a unique index - if missing, only allow blocking refresh if explicitly permitted
    if (error.message?.includes('CONCURRENTLY') || error.message?.includes('unique index')) {
      if (allowBlockingRefresh) {
        optimizationLogger.info(`${viewName}: CONCURRENT refresh unavailable, using blocking refresh (allowed by caller)`);
        try {
          await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${viewName}`));
          const durationMs = Date.now() - startMs;
          const rowCountAfter = await getViewRowCount(viewName);
          
          await logRefreshHistory(viewName, category, 'SUCCESS', trigger, startTime, durationMs, rowCountBefore, rowCountAfter, initiatedBy);
          return { success: true, durationMs, rowCount: rowCountAfter, wasBlocking: true };
        } catch (retryError: any) {
          const durationMs = Date.now() - startMs;
          await logRefreshHistory(viewName, category, 'FAILED', trigger, startTime, durationMs, rowCountBefore, 0, initiatedBy, retryError.message);
          optimizationLogger.error(`Failed blocking refresh of ${viewName}`, retryError);
          return { success: false, durationMs, rowCount: 0 };
        }
      } else {
        // Don't fallback to blocking - return error so caller knows view needs unique index
        const durationMs = Date.now() - startMs;
        const errorMsg = `CONCURRENT refresh failed for ${viewName} - requires unique index. Blocking refresh disabled to prevent table locks at scale.`;
        await logRefreshHistory(viewName, category, 'FAILED', trigger, startTime, durationMs, rowCountBefore, 0, initiatedBy, errorMsg);
        optimizationLogger.error(errorMsg);
        return { success: false, durationMs, rowCount: 0 };
      }
    }
    const durationMs = Date.now() - startMs;
    await logRefreshHistory(viewName, category, 'FAILED', trigger, startTime, durationMs, rowCountBefore, 0, initiatedBy, error.message);
    optimizationLogger.error(`Failed to refresh ${viewName}`, error);
    return { success: false, durationMs, rowCount: 0 };
  }
}

export async function getOptimizationStatus(): Promise<{
  indexes: { name: string; tableName: string; size: string }[];
  materializedViews: { name: string; rowCount: number; lastRefresh: string | null; lastDurationMs: number | null }[];
  optimizationTables: { name: string; rowCount: number }[];
}> {
  try {
    // Get performance indexes (idx_*) with sizes
    const indexResult = await db.execute(sql`
      SELECT 
        i.indexname as name, 
        i.tablename as table_name, 
        COALESCE(pg_size_pretty(pg_relation_size(c.oid)), '0 bytes') as size
      FROM pg_indexes i
      LEFT JOIN pg_class c ON c.relname = i.indexname AND c.relkind = 'i'
      WHERE i.schemaname = 'public' 
      AND i.indexname LIKE 'idx_%'
      ORDER BY i.tablename, i.indexname
    `);
    
    // Get materialized views from pg_matviews (correct catalog for MVs)
    const viewResult = await db.execute(sql`
      SELECT matviewname as name
      FROM pg_matviews
      WHERE schemaname = 'public'
      AND matviewname LIKE 'mv_%'
      ORDER BY matviewname
    `);
    
    // Get optimization tables with row counts from pg_stat_user_tables
    const tableResult = await db.execute(sql`
      SELECT relname as name, COALESCE(n_live_tup, 0) as row_count
      FROM pg_stat_user_tables
      WHERE relname IN ('certificate_expiry_tracker', 'risk_snapshots', 'asset_health_summary')
    `);
    
    const lastRefreshResult = await db.execute(sql`
      SELECT DISTINCT ON (view_name) 
        view_name, 
        completed_at, 
        duration_ms,
        status
      FROM mv_refresh_history
      WHERE status = 'SUCCESS'
      ORDER BY view_name, completed_at DESC
    `);
    
    const lastRefreshMap = new Map<string, { completedAt: string; durationMs: number; rowCount: number }>();
    for (const row of (lastRefreshResult.rows || []) as any[]) {
      lastRefreshMap.set(row.view_name, {
        completedAt: row.completed_at,
        durationMs: row.duration_ms,
        rowCount: parseInt(row.row_count_after) || 0
      });
    }
    
    // Get actual row counts for each materialized view
    const viewsWithCounts: { name: string; rowCount: number; lastRefresh: string | null; lastDurationMs: number | null }[] = [];
    for (const row of (viewResult.rows || []) as any[]) {
      const viewName = row.name;
      const refreshInfo = lastRefreshMap.get(viewName);
      let rowCount = refreshInfo?.rowCount || 0;
      
      // If no refresh history, try to get current row count directly
      if (rowCount === 0) {
        try {
          const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${viewName}`));
          rowCount = parseInt((countResult.rows?.[0] as any)?.cnt || '0');
        } catch {
          rowCount = 0;
        }
      }
      
      viewsWithCounts.push({
        name: viewName,
        rowCount,
        lastRefresh: refreshInfo?.completedAt || null,
        lastDurationMs: refreshInfo?.durationMs || null
      });
    }
    
    return {
      indexes: (indexResult.rows || []).map((r: any) => ({
        name: r.name,
        tableName: r.table_name,
        size: r.size || '0 bytes'
      })),
      materializedViews: viewsWithCounts,
      optimizationTables: (tableResult.rows || []).map((r: any) => ({
        name: r.name,
        rowCount: parseInt(r.row_count) || 0
      }))
    };
  } catch (error) {
    optimizationLogger.error("Failed to get optimization status", error);
    return { indexes: [], materializedViews: [], optimizationTables: [] };
  }
}

export async function applyAllOptimizations(): Promise<{
  success: boolean;
  indexes: { applied: number; errors: string[] };
  views: { created: number; errors: string[] };
  tables: { created: number; errors: string[] };
}> {
  optimizationLogger.info("Applying all database optimizations...");
  
  const indexResult = await applyPerformanceIndexes();
  const viewResult = await createMaterializedViews();
  const tableResult = await createOptimizationTables();
  
  const overallSuccess = indexResult.success && viewResult.success && tableResult.success;
  
  optimizationLogger.info(`Database optimizations complete. Success: ${overallSuccess}`);
  
  return {
    success: overallSuccess,
    indexes: { applied: indexResult.applied, errors: indexResult.errors },
    views: { created: viewResult.created, errors: viewResult.errors },
    tables: { created: tableResult.created, errors: tableResult.errors }
  };
}

// Get all materialized view categories with their views
export function getViewCategories(): typeof materializedViewCategories {
  return materializedViewCategories;
}

// Get all materialized view names
export function getAllViewNames(): string[] {
  return Object.values(materializedViewCategories).flatMap(cat => cat.views);
}

// Get category for a view name
export function getViewCategory(viewName: string): string | null {
  for (const [key, cat] of Object.entries(materializedViewCategories)) {
    if (cat.views.includes(viewName)) {
      return key;
    }
  }
  return null;
}

// Refresh all materialized views with optional staggering to prevent load spikes
export async function refreshAllMaterializedViews(
  trigger: RefreshTrigger = 'MANUAL',
  initiatedBy?: string,
  options: { staggerDelayMs?: number; allowBlockingRefresh?: boolean } = {}
): Promise<{
  success: boolean;
  results: { viewName: string; success: boolean; durationMs: number; rowCount: number; wasBlocking?: boolean }[];
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const allViews = getAllViewNames();
  const results: { viewName: string; success: boolean; durationMs: number; rowCount: number; wasBlocking?: boolean }[] = [];
  const staggerDelayMs = options.staggerDelayMs ?? 0;
  const allowBlockingRefresh = options.allowBlockingRefresh ?? false;
  
  optimizationLogger.info(`Refreshing all ${allViews.length} materialized views (stagger: ${staggerDelayMs}ms, allowBlocking: ${allowBlockingRefresh})...`);
  
  for (let i = 0; i < allViews.length; i++) {
    const viewName = allViews[i];
    
    // Apply stagger delay between views (skip first one)
    if (staggerDelayMs > 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, staggerDelayMs));
    }
    
    const result = await refreshMaterializedView(viewName, trigger, initiatedBy, allowBlockingRefresh);
    results.push({ viewName, ...result });
  }
  
  const totalDurationMs = Date.now() - startTime;
  const allSuccess = results.every(r => r.success);
  
  optimizationLogger.info(`Refreshed all views in ${totalDurationMs}ms. Success: ${allSuccess}`);
  
  return { success: allSuccess, results, totalDurationMs };
}

// Refresh views staggered by category (core first, then hierarchy, etc.)
// This approach reduces DB load by refreshing one category at a time with delays
export async function refreshViewsStaggeredByCategory(
  trigger: RefreshTrigger = 'SCHEDULED',
  initiatedBy?: string,
  delayBetweenCategoriesMs: number = 5000
): Promise<{
  success: boolean;
  categoryResults: { category: string; results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[] }[];
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const categories = Object.keys(materializedViewCategories);
  const categoryResults: { category: string; results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[] }[] = [];
  
  optimizationLogger.info(`Starting staggered refresh across ${categories.length} categories (${delayBetweenCategoriesMs}ms delay between categories)...`);
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    
    // Apply delay between categories (skip first one)
    if (delayBetweenCategoriesMs > 0 && i > 0) {
      optimizationLogger.info(`Waiting ${delayBetweenCategoriesMs}ms before refreshing category: ${category}`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenCategoriesMs));
    }
    
    const result = await refreshViewsByCategory(category, trigger, initiatedBy);
    categoryResults.push({ category, results: result.results });
  }
  
  const totalDurationMs = Date.now() - startTime;
  const allSuccess = categoryResults.every(cr => cr.results.every(r => r.success));
  
  optimizationLogger.info(`Staggered refresh complete in ${totalDurationMs}ms. Success: ${allSuccess}`);
  
  return { success: allSuccess, categoryResults, totalDurationMs };
}

// Refresh views by category
export async function refreshViewsByCategory(
  category: string,
  trigger: RefreshTrigger = 'MANUAL',
  initiatedBy?: string
): Promise<{
  success: boolean;
  category: string;
  results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[];
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const categoryData = materializedViewCategories[category as keyof typeof materializedViewCategories];
  
  if (!categoryData) {
    return {
      success: false,
      category,
      results: [],
      totalDurationMs: 0
    };
  }
  
  const results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[] = [];
  
  optimizationLogger.info(`Refreshing ${categoryData.views.length} views in category: ${category}...`);
  
  for (const viewName of categoryData.views) {
    const result = await refreshMaterializedView(viewName, trigger, initiatedBy);
    results.push({ viewName, ...result });
  }
  
  const totalDurationMs = Date.now() - startTime;
  const allSuccess = results.every(r => r.success);
  
  return { success: allSuccess, category, results, totalDurationMs };
}

// Get refresh history
export async function getRefreshHistory(limit: number = 50): Promise<{
  history: {
    id: string;
    viewName: string;
    category: string | null;
    status: string;
    trigger: string;
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    rowCountBefore: number | null;
    rowCountAfter: number | null;
    rowDelta: number | null;
    initiatedBy: string | null;
    errorMessage: string | null;
  }[];
}> {
  try {
    const history = await db.select().from(mvRefreshHistory).orderBy(desc(mvRefreshHistory.createdAt)).limit(limit);
    return { history: history as any };
  } catch (error) {
    optimizationLogger.error('Failed to get refresh history', error);
    return { history: [] };
  }
}

// Get last refresh times for all views
export async function getLastRefreshTimes(): Promise<Map<string, { timestamp: Date; durationMs: number }>> {
  const result = new Map<string, { timestamp: Date; durationMs: number }>();
  try {
    const lastRefreshResult = await db.execute(sql`
      SELECT DISTINCT ON (view_name) 
        view_name, 
        completed_at, 
        duration_ms
      FROM mv_refresh_history
      WHERE status = 'SUCCESS'
      ORDER BY view_name, completed_at DESC
    `);
    
    for (const row of (lastRefreshResult.rows || []) as any[]) {
      result.set(row.view_name, {
        timestamp: new Date(row.completed_at),
        durationMs: row.duration_ms
      });
    }
  } catch (error) {
    optimizationLogger.error('Failed to get last refresh times', error);
  }
  return result;
}

// Get overall freshness status
export async function getFreshnessStatus(staleThresholdHours: number = 6): Promise<{
  isStale: boolean;
  oldestRefresh: Date | null;
  viewsNeverRefreshed: string[];
  staleViews: string[];
  freshViews: string[];
}> {
  const allViews = getAllViewNames();
  const lastRefreshTimes = await getLastRefreshTimes();
  const now = new Date();
  const thresholdMs = staleThresholdHours * 60 * 60 * 1000;
  
  const viewsNeverRefreshed: string[] = [];
  const staleViews: string[] = [];
  const freshViews: string[] = [];
  let oldestRefresh: Date | null = null;
  
  for (const viewName of allViews) {
    const refreshInfo = lastRefreshTimes.get(viewName);
    if (!refreshInfo) {
      viewsNeverRefreshed.push(viewName);
    } else {
      const age = now.getTime() - refreshInfo.timestamp.getTime();
      if (age > thresholdMs) {
        staleViews.push(viewName);
      } else {
        freshViews.push(viewName);
      }
      if (!oldestRefresh || refreshInfo.timestamp < oldestRefresh) {
        oldestRefresh = refreshInfo.timestamp;
      }
    }
  }
  
  const isStale = viewsNeverRefreshed.length > 0 || staleViews.length > 0;
  
  return {
    isStale,
    oldestRefresh,
    viewsNeverRefreshed,
    staleViews,
    freshViews
  };
}

// Schedule management
export async function getRefreshSchedule(): Promise<typeof mvRefreshSchedule.$inferSelect | null> {
  try {
    const schedules = await db.select().from(mvRefreshSchedule).limit(1);
    return schedules[0] || null;
  } catch (error) {
    optimizationLogger.error('Failed to get refresh schedule', error);
    return null;
  }
}

// ============================================================================
// Audit Event Archival Functions
// ============================================================================

export async function archiveOldAuditEvents(
  daysOld: number = 90,
  initiatedBy?: string
): Promise<{ success: boolean; archivedCount: number; deletedCount: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    optimizationLogger.info(`Archiving audit events older than ${daysOld} days...`);
    
    // Get count of events to archive
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM audit_events 
      WHERE created_at < NOW() - INTERVAL '${sql.raw(daysOld.toString())} days'
    `);
    const toArchiveCount = parseInt((countResult.rows?.[0] as any)?.count || '0');
    
    if (toArchiveCount === 0) {
      optimizationLogger.info('No audit events to archive');
      return { success: true, archivedCount: 0, deletedCount: 0 };
    }
    
    // Execute archive SQL
    const archiveSQL = archiveOldAuditEventsSQL(daysOld);
    const statements = archiveSQL.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
    
    let archivedCount = 0;
    let deletedCount = 0;
    
    for (const statement of statements) {
      const result = await db.execute(sql.raw(statement));
      if (statement.toLowerCase().includes('insert into')) {
        archivedCount = result.rowCount || 0;
      } else if (statement.toLowerCase().includes('delete from')) {
        deletedCount = result.rowCount || 0;
      }
    }
    
    const durationMs = Date.now() - startTime;
    optimizationLogger.info(`Archived ${archivedCount} events, deleted ${deletedCount} from main table in ${durationMs}ms`);
    
    return { success: true, archivedCount, deletedCount };
  } catch (error: any) {
    optimizationLogger.error('Failed to archive audit events', error);
    return { success: false, archivedCount: 0, deletedCount: 0, error: error.message };
  }
}

export async function purgeOldArchivedEvents(
  daysOld: number = 730
): Promise<{ success: boolean; purgedCount: number; error?: string }> {
  try {
    optimizationLogger.info(`Purging archived events older than ${daysOld} days...`);
    
    const purgeSQL = purgeOldArchivesSQL(daysOld);
    const result = await db.execute(sql.raw(purgeSQL));
    const purgedCount = result.rowCount || 0;
    
    optimizationLogger.info(`Purged ${purgedCount} archived events`);
    return { success: true, purgedCount };
  } catch (error: any) {
    optimizationLogger.error('Failed to purge archived events', error);
    return { success: false, purgedCount: 0, error: error.message };
  }
}

export async function getAuditEventStats(): Promise<{
  mainTableCount: number;
  archiveTableCount: number;
  oldestMainEvent: Date | null;
  oldestArchiveEvent: Date | null;
}> {
  try {
    const [mainCount, archiveCount, oldestMain, oldestArchive] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM audit_events`),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_events_archive`).catch(() => ({ rows: [{ count: 0 }] })),
      db.execute(sql`SELECT MIN(created_at) as oldest FROM audit_events`),
      db.execute(sql`SELECT MIN(created_at) as oldest FROM audit_events_archive`).catch(() => ({ rows: [{ oldest: null }] })),
    ]);
    
    return {
      mainTableCount: parseInt((mainCount.rows?.[0] as any)?.count || '0'),
      archiveTableCount: parseInt((archiveCount.rows?.[0] as any)?.count || '0'),
      oldestMainEvent: (oldestMain.rows?.[0] as any)?.oldest || null,
      oldestArchiveEvent: (oldestArchive.rows?.[0] as any)?.oldest || null,
    };
  } catch (error) {
    optimizationLogger.error('Failed to get audit event stats', error);
    return { mainTableCount: 0, archiveTableCount: 0, oldestMainEvent: null, oldestArchiveEvent: null };
  }
}

export async function upsertRefreshSchedule(schedule: {
  scheduleTime: string;
  timezone?: string;
  isEnabled?: boolean;
  postIngestionEnabled?: boolean;
  staleThresholdHours?: number;
  refreshAll?: boolean;
  targetViews?: string[] | null;
  updatedBy?: string;
}): Promise<typeof mvRefreshSchedule.$inferSelect | null> {
  try {
    const existing = await getRefreshSchedule();
    
    if (existing) {
      // When refreshAll is true, clear targetViews; otherwise preserve or update them
      const shouldRefreshAll = schedule.refreshAll ?? existing.refreshAll;
      const newTargetViews = shouldRefreshAll ? null : (schedule.targetViews ?? existing.targetViews);
      
      const [updated] = await db.update(mvRefreshSchedule)
        .set({
          scheduleTime: schedule.scheduleTime,
          timezone: schedule.timezone || existing.timezone,
          isEnabled: schedule.isEnabled ?? existing.isEnabled,
          postIngestionEnabled: schedule.postIngestionEnabled ?? existing.postIngestionEnabled,
          staleThresholdHours: schedule.staleThresholdHours ?? existing.staleThresholdHours,
          refreshAll: shouldRefreshAll,
          targetViews: newTargetViews,
          updatedBy: schedule.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(mvRefreshSchedule.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(mvRefreshSchedule).values({
        name: 'default',
        description: 'Default daily refresh schedule',
        scheduleTime: schedule.scheduleTime,
        timezone: schedule.timezone || 'Europe/London',
        isEnabled: schedule.isEnabled ?? true,
        postIngestionEnabled: schedule.postIngestionEnabled ?? false,
        staleThresholdHours: schedule.staleThresholdHours ?? 6,
        refreshAll: schedule.refreshAll ?? true,
        targetViews: schedule.targetViews ?? null,
        createdBy: schedule.updatedBy
      }).returning();
      return created;
    }
  } catch (error) {
    optimizationLogger.error('Failed to upsert refresh schedule', error);
    return null;
  }
}
