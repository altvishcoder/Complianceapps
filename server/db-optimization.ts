import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  performanceIndexDefinitions, 
  allMaterializedViewDefinitions,
  allMaterializedViewIndexDefinitions,
  expiryTrackerTableDefinition,
  riskSnapshotTableDefinition,
  assetHealthSummaryTableDefinition,
  materializedViewCategories
} from "@shared/schema/tables/performance-indexes";

const optimizationLogger = {
  info: (msg: string, data?: any) => console.log(`[DB-OPT] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[DB-OPT ERROR] ${msg}`, error || ''),
};

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
      assetHealthSummaryTableDefinition
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

export async function refreshMaterializedView(viewName: string): Promise<{ success: boolean; durationMs: number }> {
  const startTime = Date.now();
  try {
    await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`));
    const durationMs = Date.now() - startTime;
    optimizationLogger.info(`Refreshed ${viewName} in ${durationMs}ms`);
    return { success: true, durationMs };
  } catch (error: any) {
    if (error.message?.includes('CONCURRENTLY')) {
      try {
        await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${viewName}`));
        const durationMs = Date.now() - startTime;
        return { success: true, durationMs };
      } catch (retryError: any) {
        optimizationLogger.error(`Failed to refresh ${viewName}`, retryError);
        return { success: false, durationMs: Date.now() - startTime };
      }
    }
    optimizationLogger.error(`Failed to refresh ${viewName}`, error);
    return { success: false, durationMs: Date.now() - startTime };
  }
}

export async function getOptimizationStatus(): Promise<{
  indexes: { name: string; tableName: string; size: string }[];
  materializedViews: { name: string; rowCount: number; lastRefresh: string | null }[];
  optimizationTables: { name: string; rowCount: number }[];
}> {
  try {
    const indexResult = await db.execute(sql`
      SELECT indexname as name, tablename as table_name, pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_indexes
      JOIN pg_class ON pg_class.relname = indexname
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);
    
    const viewResult = await db.execute(sql`
      SELECT relname as name, n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE relname LIKE 'mv_%'
    `);
    
    const tableResult = await db.execute(sql`
      SELECT relname as name, n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE relname IN ('certificate_expiry_tracker', 'risk_snapshots', 'asset_health_summary')
    `);
    
    return {
      indexes: (indexResult.rows || []).map((r: any) => ({
        name: r.name,
        tableName: r.table_name,
        size: r.size || 'unknown'
      })),
      materializedViews: (viewResult.rows || []).map((r: any) => ({
        name: r.name,
        rowCount: parseInt(r.row_count) || 0,
        lastRefresh: null
      })),
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

// Refresh all materialized views
export async function refreshAllMaterializedViews(): Promise<{
  success: boolean;
  results: { viewName: string; success: boolean; durationMs: number }[];
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const allViews = getAllViewNames();
  const results: { viewName: string; success: boolean; durationMs: number }[] = [];
  
  optimizationLogger.info(`Refreshing all ${allViews.length} materialized views...`);
  
  for (const viewName of allViews) {
    const result = await refreshMaterializedView(viewName);
    results.push({ viewName, ...result });
  }
  
  const totalDurationMs = Date.now() - startTime;
  const allSuccess = results.every(r => r.success);
  
  optimizationLogger.info(`Refreshed all views in ${totalDurationMs}ms. Success: ${allSuccess}`);
  
  return { success: allSuccess, results, totalDurationMs };
}

// Refresh views by category
export async function refreshViewsByCategory(category: string): Promise<{
  success: boolean;
  category: string;
  results: { viewName: string; success: boolean; durationMs: number }[];
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
  
  const results: { viewName: string; success: boolean; durationMs: number }[] = [];
  
  optimizationLogger.info(`Refreshing ${categoryData.views.length} views in category: ${category}...`);
  
  for (const viewName of categoryData.views) {
    const result = await refreshMaterializedView(viewName);
    results.push({ viewName, ...result });
  }
  
  const totalDurationMs = Date.now() - startTime;
  const allSuccess = results.every(r => r.success);
  
  return { success: allSuccess, category, results, totalDurationMs };
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
