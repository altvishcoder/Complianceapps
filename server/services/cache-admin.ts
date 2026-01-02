import { db } from '../db';
import { cacheRegions, cacheStats, cacheClearAudit, users } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { logger } from '../logger';
import { broadcastCacheInvalidation as sseBroadcastInvalidation } from '../events';

export type CacheLayer = 'CLIENT' | 'API' | 'DATABASE' | 'MEMORY' | 'SESSION';
export type CacheClearScope = 'REGION' | 'CATEGORY' | 'LAYER' | 'ALL';

interface InMemoryCacheEntry {
  key: string;
  value: unknown;
  expiresAt?: number;
  createdAt: number;
  hits: number;
}

class InMemoryCache {
  private cache: Map<string, InMemoryCacheEntry> = new Map();
  private stats = { hits: 0, misses: 0, evictions: 0 };

  set(key: string, value: unknown, ttlSeconds?: number): void {
    const entry: InMemoryCacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      hits: 0,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    };
    this.cache.set(key, entry);
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }
    entry.hits++;
    this.stats.hits++;
    return entry.value as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  clearByPrefix(prefix: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getStats(): { size: number; hits: number; misses: number; evictions: number } {
    return { size: this.cache.size, ...this.stats };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }
}

export const memoryCache = new InMemoryCache();

const clientCacheInvalidationCallbacks: Set<(regions: string[]) => void> = new Set();

export function registerClientCacheCallback(callback: (regions: string[]) => void): () => void {
  clientCacheInvalidationCallbacks.add(callback);
  return () => clientCacheInvalidationCallbacks.delete(callback);
}

function notifyClientCacheInvalidation(regions: string[]): void {
  sseBroadcastInvalidation(regions);
  
  clientCacheInvalidationCallbacks.forEach(cb => {
    try {
      cb(regions);
    } catch (e) {
      logger.error({ error: e }, 'Client cache callback error');
    }
  });
  
  logger.info({ regions, count: regions.length }, 'Client cache invalidation broadcast');
}

export function broadcastCacheInvalidation(regions: string[]): void {
  notifyClientCacheInvalidation(regions);
}

export async function getDefaultCacheRegions() {
  return [
    { name: 'risk-portfolio', displayName: 'Risk Portfolio Summary', category: 'risk', layer: 'CLIENT' as const, queryKeyPattern: '/api/risk/portfolio-summary', description: 'Portfolio-wide risk summary data' },
    { name: 'risk-properties', displayName: 'Property Risk Scores', category: 'risk', layer: 'CLIENT' as const, queryKeyPattern: '/api/risk/properties', description: 'Individual property risk scores' },
    { name: 'risk-alerts', displayName: 'Risk Alerts', category: 'risk', layer: 'CLIENT' as const, queryKeyPattern: '/api/risk/alerts', description: 'Active risk alerts and notifications' },
    { name: 'properties', displayName: 'Property List', category: 'property', layer: 'CLIENT' as const, queryKeyPattern: '/api/properties', description: 'Property listing and details' },
    { name: 'certificates', displayName: 'Certificates', category: 'certificate', layer: 'CLIENT' as const, queryKeyPattern: '/api/certificates', description: 'Compliance certificates data' },
    { name: 'asset-health', displayName: 'Asset Health', category: 'asset', layer: 'CLIENT' as const, queryKeyPattern: '/api/asset-health', description: 'Asset health dashboard data' },
    { name: 'schemes', displayName: 'Schemes', category: 'property', layer: 'CLIENT' as const, queryKeyPattern: '/api/schemes', description: 'Property schemes/estates' },
    { name: 'blocks', displayName: 'Blocks', category: 'property', layer: 'CLIENT' as const, queryKeyPattern: '/api/blocks', description: 'Building blocks within schemes' },
    { name: 'components', displayName: 'Components', category: 'asset', layer: 'CLIENT' as const, queryKeyPattern: '/api/components', description: 'Asset components (boilers, etc.)' },
    { name: 'navigation', displayName: 'Navigation', category: 'config', layer: 'CLIENT' as const, queryKeyPattern: '/api/navigation', description: 'Navigation menu structure', isSystem: true },
    { name: 'sidebar-counts', displayName: 'Sidebar Counts', category: 'config', layer: 'CLIENT' as const, queryKeyPattern: '/api/sidebar/counts', description: 'Sidebar badge counts' },
    { name: 'remedial-actions', displayName: 'Remedial Actions', category: 'operations', layer: 'CLIENT' as const, queryKeyPattern: '/api/remedial-actions', description: 'Remedial action items' },
    { name: 'ml-predictions', displayName: 'ML Predictions', category: 'ml', layer: 'CLIENT' as const, queryKeyPattern: 'ml-predictions', description: 'Machine learning predictions' },
    { name: 'ml-model-metrics', displayName: 'ML Model Metrics', category: 'ml', layer: 'CLIENT' as const, queryKeyPattern: 'ml-model-metrics', description: 'ML model performance metrics' },
    { name: 'memory-risk', displayName: 'Risk Calculations', category: 'risk', layer: 'MEMORY' as const, cacheKeyPattern: 'risk:*', description: 'Cached risk calculation results' },
    { name: 'memory-config', displayName: 'Configuration', category: 'config', layer: 'MEMORY' as const, cacheKeyPattern: 'config:*', description: 'Cached configuration values', isProtected: true },
    { name: 'session-store', displayName: 'User Sessions', category: 'auth', layer: 'SESSION' as const, description: 'Active user sessions', isProtected: true, isSystem: true },
  ];
}

export async function seedCacheRegions(): Promise<number> {
  const defaults = await getDefaultCacheRegions();
  let created = 0;

  for (const region of defaults) {
    const existing = await db.select({ id: cacheRegions.id })
      .from(cacheRegions)
      .where(eq(cacheRegions.name, region.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(cacheRegions).values({
        name: region.name,
        displayName: region.displayName,
        description: region.description,
        layer: region.layer,
        category: region.category,
        queryKeyPattern: region.queryKeyPattern,
        cacheKeyPattern: region.cacheKeyPattern,
        isProtected: region.isProtected ?? false,
        isSystem: region.isSystem ?? false,
      });
      created++;
    }
  }

  logger.info({ created }, 'Cache regions seeded');
  return created;
}

export async function getCacheRegions(options?: { layer?: CacheLayer; category?: string; activeOnly?: boolean }) {
  let query = db.select().from(cacheRegions);
  
  const conditions = [];
  if (options?.layer) {
    conditions.push(eq(cacheRegions.layer, options.layer));
  }
  if (options?.category) {
    conditions.push(eq(cacheRegions.category, options.category));
  }
  if (options?.activeOnly !== false) {
    conditions.push(eq(cacheRegions.isActive, true));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return query;
}

export async function getCacheOverview() {
  const regions = await db.select().from(cacheRegions).where(eq(cacheRegions.isActive, true));
  
  const byLayer: Record<string, { count: number; regions: string[] }> = {
    CLIENT: { count: 0, regions: [] },
    API: { count: 0, regions: [] },
    DATABASE: { count: 0, regions: [] },
    MEMORY: { count: 0, regions: [] },
    SESSION: { count: 0, regions: [] },
  };

  const byCategory: Record<string, { count: number; regions: string[] }> = {};

  for (const region of regions) {
    if (byLayer[region.layer]) {
      byLayer[region.layer].count++;
      byLayer[region.layer].regions.push(region.name);
    }
    
    if (!byCategory[region.category]) {
      byCategory[region.category] = { count: 0, regions: [] };
    }
    byCategory[region.category].count++;
    byCategory[region.category].regions.push(region.name);
  }

  const memoryStats = memoryCache.getStats();

  const recentStats = await db.select()
    .from(cacheStats)
    .where(gte(cacheStats.windowStart, new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .orderBy(desc(cacheStats.windowStart))
    .limit(100);

  const totalHits = recentStats.reduce((sum, s) => sum + s.hitCount, 0);
  const totalMisses = recentStats.reduce((sum, s) => sum + s.missCount, 0);
  const hitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

  return {
    totalRegions: regions.length,
    byLayer,
    byCategory,
    memoryCache: memoryStats,
    last24Hours: {
      totalHits,
      totalMisses,
      hitRate: Math.round(hitRate * 10) / 10,
      statsCount: recentStats.length,
    },
  };
}

interface ClearCacheOptions {
  scope: CacheClearScope;
  identifier?: string;
  identifiers?: string[];
  reason: string;
  dryRun?: boolean;
  confirmationToken?: string;
  userId: string;
  userRole: string;
  userIp?: string;
}

interface ClearCacheResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'DRY_RUN';
  affectedRegions: Array<{
    regionId: string;
    regionName: string;
    layer: string;
    status: string;
    entriesCleared?: number;
    error?: string;
  }>;
  totalEntriesCleared: number;
  executionTimeMs: number;
  auditId?: string;
}

export async function clearCache(options: ClearCacheOptions): Promise<ClearCacheResult> {
  const startTime = Date.now();
  
  let regionsToCllear: typeof cacheRegions.$inferSelect[] = [];
  
  switch (options.scope) {
    case 'REGION':
      if (!options.identifier && !options.identifiers?.length) {
        throw new Error('Region identifier required');
      }
      const regionIds = options.identifiers || [options.identifier!];
      for (const id of regionIds) {
        const [region] = await db.select().from(cacheRegions)
          .where(eq(cacheRegions.id, id))
          .limit(1);
        if (region) regionsToCllear.push(region);
      }
      break;
      
    case 'CATEGORY':
      if (!options.identifier) {
        throw new Error('Category identifier required');
      }
      regionsToCllear = await db.select().from(cacheRegions)
        .where(and(
          eq(cacheRegions.category, options.identifier),
          eq(cacheRegions.isActive, true)
        ));
      break;
      
    case 'LAYER':
      if (!options.identifier) {
        throw new Error('Layer identifier required');
      }
      regionsToCllear = await db.select().from(cacheRegions)
        .where(and(
          eq(cacheRegions.layer, options.identifier as CacheLayer),
          eq(cacheRegions.isActive, true)
        ));
      break;
      
    case 'ALL':
      if (!options.confirmationToken) {
        throw new Error('Confirmation token required for clearing all caches');
      }
      regionsToCllear = await db.select().from(cacheRegions)
        .where(eq(cacheRegions.isActive, true));
      break;
  }

  if (options.dryRun) {
    const result: ClearCacheResult = {
      status: 'DRY_RUN',
      affectedRegions: regionsToCllear.map(r => ({
        regionId: r.id,
        regionName: r.name,
        layer: r.layer,
        status: 'would_clear',
      })),
      totalEntriesCleared: 0,
      executionTimeMs: Date.now() - startTime,
    };

    await db.insert(cacheClearAudit).values({
      scope: options.scope,
      scopeIdentifier: options.identifier,
      initiatedBy: options.userId,
      initiatorRole: options.userRole,
      initiatorIp: options.userIp,
      reason: options.reason,
      isDryRun: true,
      status: 'DRY_RUN',
      affectedRegions: result.affectedRegions,
      totalEntriesCleared: 0,
      executionTimeMs: result.executionTimeMs,
    });

    return result;
  }

  const affectedRegions: ClearCacheResult['affectedRegions'] = [];
  let totalCleared = 0;
  const clientRegionsToInvalidate: string[] = [];

  for (const region of regionsToCllear) {
    try {
      let entriesCleared = 0;

      switch (region.layer) {
        case 'CLIENT':
          clientRegionsToInvalidate.push(region.queryKeyPattern || region.name);
          entriesCleared = 1;
          break;

        case 'MEMORY':
          if (region.cacheKeyPattern) {
            const prefix = region.cacheKeyPattern.replace('*', '');
            entriesCleared = memoryCache.clearByPrefix(prefix);
          } else {
            entriesCleared = memoryCache.clear();
          }
          break;

        case 'SESSION':
          const sessionResult = await db.execute(sql`
            DELETE FROM sessions 
            WHERE expires_at < NOW() 
            RETURNING id
          `);
          entriesCleared = sessionResult.rowCount || 0;
          break;

        case 'DATABASE':
        case 'API':
          entriesCleared = 0;
          break;
      }

      await db.update(cacheRegions)
        .set({ 
          lastClearedAt: new Date(),
          lastClearedBy: options.userId,
          updatedAt: new Date(),
        })
        .where(eq(cacheRegions.id, region.id));

      affectedRegions.push({
        regionId: region.id,
        regionName: region.name,
        layer: region.layer,
        status: 'cleared',
        entriesCleared,
      });
      totalCleared += entriesCleared;

    } catch (error) {
      affectedRegions.push({
        regionId: region.id,
        regionName: region.name,
        layer: region.layer,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (clientRegionsToInvalidate.length > 0) {
    notifyClientCacheInvalidation(clientRegionsToInvalidate);
  }

  const hasFailures = affectedRegions.some(r => r.status === 'failed');
  const allFailed = affectedRegions.every(r => r.status === 'failed');

  const result: ClearCacheResult = {
    status: allFailed ? 'FAILED' : hasFailures ? 'PARTIAL' : 'SUCCESS',
    affectedRegions,
    totalEntriesCleared: totalCleared,
    executionTimeMs: Date.now() - startTime,
  };

  const [audit] = await db.insert(cacheClearAudit).values({
    scope: options.scope,
    scopeIdentifier: options.identifier,
    initiatedBy: options.userId,
    initiatorRole: options.userRole,
    initiatorIp: options.userIp,
    reason: options.reason,
    confirmationToken: options.confirmationToken,
    isDryRun: false,
    status: result.status,
    affectedRegions: result.affectedRegions,
    totalEntriesCleared: result.totalEntriesCleared,
    executionTimeMs: result.executionTimeMs,
  }).returning({ id: cacheClearAudit.id });

  result.auditId = audit.id;

  logger.info({
    scope: options.scope,
    identifier: options.identifier,
    userId: options.userId,
    regionsCleared: affectedRegions.filter(r => r.status === 'cleared').length,
    totalEntriesCleared: totalCleared,
    executionTimeMs: result.executionTimeMs,
  }, 'Cache cleared');

  return result;
}

export async function getCacheClearHistory(options?: { limit?: number; userId?: string }) {
  let query = db.select({
    audit: cacheClearAudit,
    userName: users.name,
  })
  .from(cacheClearAudit)
  .leftJoin(users, eq(cacheClearAudit.initiatedBy, users.id))
  .orderBy(desc(cacheClearAudit.createdAt))
  .limit(options?.limit || 50);

  if (options?.userId) {
    query = query.where(eq(cacheClearAudit.initiatedBy, options.userId)) as typeof query;
  }

  return query;
}

export async function recordCacheStats(regionName: string, stats: { hits: number; misses: number; evictions?: number; entries?: number; sizeBytes?: number }) {
  const [region] = await db.select({ id: cacheRegions.id })
    .from(cacheRegions)
    .where(eq(cacheRegions.name, regionName))
    .limit(1);

  if (!region) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);

  await db.insert(cacheStats).values({
    regionId: region.id,
    windowStart,
    windowEnd: now,
    hitCount: stats.hits,
    missCount: stats.misses,
    evictionCount: stats.evictions || 0,
    estimatedEntries: stats.entries || 0,
    estimatedSizeBytes: stats.sizeBytes || 0,
  });
}

export function generateConfirmationToken(): string {
  return `CONFIRM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export function validateConfirmationToken(token: string): boolean {
  if (!token.startsWith('CONFIRM-')) return false;
  const parts = token.split('-');
  if (parts.length !== 3) return false;
  const timestamp = parseInt(parts[1], 10);
  const maxAge = 5 * 60 * 1000;
  return Date.now() - timestamp < maxAge;
}
