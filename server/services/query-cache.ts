import { db } from "../db";
import { cacheStats, cacheRegions, cacheClearAudit } from "@shared/schema/tables/cache";
import { sql, eq, desc } from "drizzle-orm";

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  memoryEstimateBytes: number;
}

interface RegionConfig {
  name: string;
  displayName: string;
  ttlSeconds: number;
  maxEntries: number;
  category: string;
}

const DEFAULT_REGIONS: RegionConfig[] = [
  { name: 'dashboard_stats', displayName: 'Dashboard Statistics', ttlSeconds: 300, maxEntries: 50, category: 'dashboard' },
  { name: 'sidebar_counts', displayName: 'Sidebar Counts', ttlSeconds: 60, maxEntries: 100, category: 'navigation' },
  { name: 'navigation', displayName: 'Navigation Data', ttlSeconds: 600, maxEntries: 10, category: 'navigation' },
  { name: 'compliance_summary', displayName: 'Compliance Summary', ttlSeconds: 300, maxEntries: 100, category: 'compliance' },
  { name: 'property_list', displayName: 'Property Lists', ttlSeconds: 120, maxEntries: 200, category: 'assets' },
  { name: 'certificate_list', displayName: 'Certificate Lists', ttlSeconds: 120, maxEntries: 200, category: 'compliance' },
  { name: 'user_preferences', displayName: 'User Preferences', ttlSeconds: 900, maxEntries: 500, category: 'user' },
  { name: 'config_data', displayName: 'Configuration Data', ttlSeconds: 1800, maxEntries: 100, category: 'config' },
];

class QueryCache {
  private cache: Map<string, Map<string, CacheEntry<unknown>>> = new Map();
  private stats: Map<string, CacheStats> = new Map();
  private regionConfigs: Map<string, RegionConfig> = new Map();
  private globalStats = { hits: 0, misses: 0, evictions: 0, startedAt: Date.now() };
  private statsFlushInterval: NodeJS.Timeout | null = null;
  private lastStatsPersist = Date.now();

  constructor() {
    for (const region of DEFAULT_REGIONS) {
      this.registerRegion(region);
    }
    this.statsFlushInterval = setInterval(() => this.persistStats(), 60000);
  }

  registerRegion(config: RegionConfig): void {
    this.regionConfigs.set(config.name, config);
    if (!this.cache.has(config.name)) {
      this.cache.set(config.name, new Map());
    }
    if (!this.stats.has(config.name)) {
      this.stats.set(config.name, { hits: 0, misses: 0, evictions: 0, entries: 0, memoryEstimateBytes: 0 });
    }
  }

  private generateKey(region: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params).sort().map(k => `${k}:${JSON.stringify(params[k])}`).join('|');
    return `${region}::${sortedParams}`;
  }

  private estimateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1024;
    }
  }

  get<T>(region: string, params: Record<string, unknown> = {}): T | null {
    const regionCache = this.cache.get(region);
    const regionStats = this.stats.get(region);
    
    if (!regionCache || !regionStats) {
      this.globalStats.misses++;
      return null;
    }

    const key = this.generateKey(region, params);
    const entry = regionCache.get(key);

    if (!entry) {
      regionStats.misses++;
      this.globalStats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      // Entry expired - subtract its memory and delete it
      regionStats.memoryEstimateBytes -= this.estimateSize(entry.data);
      if (regionStats.memoryEstimateBytes < 0) regionStats.memoryEstimateBytes = 0;
      regionCache.delete(key);
      regionStats.entries = regionCache.size;
      regionStats.evictions++; // Count as eviction (TTL-based)
      this.globalStats.evictions++;
      regionStats.misses++;
      this.globalStats.misses++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    regionStats.hits++;
    this.globalStats.hits++;

    return entry.data as T;
  }

  set<T>(region: string, params: Record<string, unknown>, data: T, ttlOverrideSeconds?: number): void {
    const config = this.regionConfigs.get(region);
    let regionCache = this.cache.get(region);
    let regionStats = this.stats.get(region);

    if (!config) {
      this.registerRegion({
        name: region,
        displayName: region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        ttlSeconds: ttlOverrideSeconds || 300,
        maxEntries: 100,
        category: 'dynamic'
      });
      regionCache = this.cache.get(region)!;
      regionStats = this.stats.get(region)!;
    }

    const ttlSeconds = ttlOverrideSeconds ?? config?.ttlSeconds ?? 300;
    const maxEntries = config?.maxEntries ?? 100;
    const key = this.generateKey(region, params);
    const now = Date.now();

    // Check if key already exists - if so, subtract old entry's memory
    const existingEntry = regionCache!.get(key);
    if (existingEntry) {
      regionStats!.memoryEstimateBytes -= this.estimateSize(existingEntry.data);
    }
    
    if (regionCache!.size >= maxEntries && !regionCache!.has(key)) {
      this.evictLRU(region);
    }

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt: now + (ttlSeconds * 1000),
      accessCount: 0,
      lastAccessedAt: now
    };

    regionCache!.set(key, entry);
    regionStats!.entries = regionCache!.size;
    regionStats!.memoryEstimateBytes += this.estimateSize(data);
    
    // Ensure memory estimate doesn't go negative
    if (regionStats!.memoryEstimateBytes < 0) {
      regionStats!.memoryEstimateBytes = 0;
    }
  }

  private evictLRU(region: string): void {
    const regionCache = this.cache.get(region);
    const regionStats = this.stats.get(region);
    if (!regionCache || regionCache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    Array.from(regionCache.entries()).forEach(([key, entry]) => {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      const entry = regionCache.get(oldestKey);
      regionCache.delete(oldestKey);
      if (regionStats && entry) {
        regionStats.evictions++;
        regionStats.entries = regionCache.size;
        regionStats.memoryEstimateBytes -= this.estimateSize(entry.data);
      }
      this.globalStats.evictions++;
    }
  }

  invalidate(region: string, params?: Record<string, any>): number {
    const regionCache = this.cache.get(region);
    if (!regionCache) return 0;
    const regionStats = this.stats.get(region);

    if (params) {
      const key = this.generateKey(region, params);
      // Get the entry before deleting to subtract its memory
      const entry = regionCache.get(key);
      const deleted = regionCache.delete(key);
      if (regionStats) {
        regionStats.entries = regionCache.size;
        if (deleted && entry) {
          regionStats.memoryEstimateBytes -= this.estimateSize(entry.data);
          if (regionStats.memoryEstimateBytes < 0) regionStats.memoryEstimateBytes = 0;
        }
      }
      return deleted ? 1 : 0;
    }

    const count = regionCache.size;
    regionCache.clear();
    if (regionStats) {
      regionStats.entries = 0;
      regionStats.memoryEstimateBytes = 0;
    }
    return count;
  }

  invalidateAll(): number {
    let totalCleared = 0;
    Array.from(this.cache.entries()).forEach(([region, regionCache]) => {
      totalCleared += regionCache.size;
      regionCache.clear();
      const regionStats = this.stats.get(region);
      if (regionStats) {
        regionStats.entries = 0;
        regionStats.memoryEstimateBytes = 0;
      }
    });
    return totalCleared;
  }

  invalidateByCategory(category: string): number {
    let totalCleared = 0;
    Array.from(this.regionConfigs.entries()).forEach(([regionName, config]) => {
      if (config.category === category) {
        totalCleared += this.invalidate(regionName);
      }
    });
    return totalCleared;
  }

  getStats(): {
    global: { hits: number; misses: number; evictions: number; hitRate: number; uptimeMs: number };
    regions: Array<{ name: string; displayName: string; category: string; ttlSeconds: number; stats: CacheStats; hitRate: number }>;
    totalEntries: number;
    totalMemoryBytes: number;
  } {
    const regions: Array<{ name: string; displayName: string; category: string; ttlSeconds: number; stats: CacheStats; hitRate: number }> = [];
    let totalEntries = 0;
    let totalMemoryBytes = 0;

    Array.from(this.regionConfigs.entries()).forEach(([name, config]) => {
      const stats = this.stats.get(name) || { hits: 0, misses: 0, evictions: 0, entries: 0, memoryEstimateBytes: 0 };
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
      
      regions.push({
        name,
        displayName: config.displayName,
        category: config.category,
        ttlSeconds: config.ttlSeconds,
        stats,
        hitRate
      });
      
      totalEntries += stats.entries;
      totalMemoryBytes += stats.memoryEstimateBytes;
    });

    const globalTotal = this.globalStats.hits + this.globalStats.misses;
    const globalHitRate = globalTotal > 0 ? (this.globalStats.hits / globalTotal) * 100 : 0;

    return {
      global: {
        hits: this.globalStats.hits,
        misses: this.globalStats.misses,
        evictions: this.globalStats.evictions,
        hitRate: globalHitRate,
        uptimeMs: Date.now() - this.globalStats.startedAt
      },
      regions: regions.sort((a, b) => b.stats.hits - a.stats.hits),
      totalEntries,
      totalMemoryBytes
    };
  }

  async persistStats(): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(this.lastStatsPersist);
      
      const entries = Array.from(this.stats.entries());
      for (let i = 0; i < entries.length; i++) {
        const [regionName, stats] = entries[i];
        if (stats.hits === 0 && stats.misses === 0) continue;
        
        let regionRecord = await db.select().from(cacheRegions).where(eq(cacheRegions.name, regionName)).limit(1);
        
        if (regionRecord.length === 0) {
          const config = this.regionConfigs.get(regionName);
          if (config) {
            const [created] = await db.insert(cacheRegions).values({
              name: config.name,
              displayName: config.displayName,
              description: `Query cache region for ${config.displayName}`,
              layer: 'MEMORY',
              category: config.category,
              autoRefreshSeconds: config.ttlSeconds,
              isSystem: true,
              isActive: true
            }).returning();
            regionRecord = [created];
          }
        }

        if (regionRecord.length > 0) {
          await db.insert(cacheStats).values({
            regionId: regionRecord[0].id,
            windowStart,
            windowEnd: now,
            hitCount: stats.hits,
            missCount: stats.misses,
            evictionCount: stats.evictions,
            estimatedEntries: stats.entries,
            estimatedSizeBytes: stats.memoryEstimateBytes,
            source: 'query_cache'
          });
        }
      }
      
      this.lastStatsPersist = Date.now();
    } catch (error) {
      console.error('[QueryCache] Failed to persist stats:', error);
    }
  }

  async clearWithAudit(
    scope: 'REGION' | 'CATEGORY' | 'ALL',
    identifier: string | null,
    initiatedBy: string,
    initiatorRole: string,
    reason: string,
    isDryRun: boolean = false
  ): Promise<{ success: boolean; entriesCleared: number; error?: string }> {
    const beforeState = this.getStats();
    let entriesCleared = 0;

    try {
      if (!isDryRun) {
        switch (scope) {
          case 'REGION':
            if (identifier) entriesCleared = this.invalidate(identifier);
            break;
          case 'CATEGORY':
            if (identifier) entriesCleared = this.invalidateByCategory(identifier);
            break;
          case 'ALL':
            entriesCleared = this.invalidateAll();
            break;
        }
      } else {
        switch (scope) {
          case 'REGION':
            entriesCleared = this.cache.get(identifier || '')?.size || 0;
            break;
          case 'CATEGORY':
            Array.from(this.regionConfigs.entries()).forEach(([name, config]) => {
              if (config.category === identifier) {
                entriesCleared += this.cache.get(name)?.size || 0;
              }
            });
            break;
          case 'ALL':
            entriesCleared = beforeState.totalEntries;
            break;
        }
      }

      const afterState = this.getStats();

      await db.insert(cacheClearAudit).values({
        scope,
        scopeIdentifier: identifier,
        initiatedBy,
        initiatorRole,
        reason,
        isDryRun,
        status: 'SUCCESS',
        totalEntriesCleared: entriesCleared,
        beforeState: {
          totalEntries: beforeState.totalEntries,
          totalSizeBytes: beforeState.totalMemoryBytes,
          byLayer: { MEMORY: beforeState.totalEntries }
        },
        afterState: {
          totalEntries: afterState.totalEntries,
          totalSizeBytes: afterState.totalMemoryBytes,
          byLayer: { MEMORY: afterState.totalEntries }
        }
      });

      return { success: true, entriesCleared };
    } catch (error: any) {
      await db.insert(cacheClearAudit).values({
        scope,
        scopeIdentifier: identifier,
        initiatedBy,
        initiatorRole,
        reason,
        isDryRun,
        status: 'FAILED',
        totalEntriesCleared: 0,
        errorMessage: error.message
      });
      return { success: false, entriesCleared: 0, error: error.message };
    }
  }

  async getHistoricalStats(hoursBack: number = 24): Promise<{
    windowStart: Date;
    windowEnd: Date;
    totalHits: number;
    totalMisses: number;
    avgHitRate: number;
  }[]> {
    try {
      const cutoff = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
      const result = await db.execute(sql`
        SELECT 
          date_trunc('hour', window_start) as hour,
          SUM(hit_count) as total_hits,
          SUM(miss_count) as total_misses
        FROM cache_stats
        WHERE window_start >= ${cutoff}
        GROUP BY date_trunc('hour', window_start)
        ORDER BY hour DESC
      `);
      
      return (result.rows as any[]).map(row => ({
        windowStart: new Date(row.hour),
        windowEnd: new Date(new Date(row.hour).getTime() + 3600000),
        totalHits: parseInt(row.total_hits || '0'),
        totalMisses: parseInt(row.total_misses || '0'),
        avgHitRate: row.total_hits && row.total_misses 
          ? (parseInt(row.total_hits) / (parseInt(row.total_hits) + parseInt(row.total_misses))) * 100 
          : 0
      }));
    } catch (error) {
      console.error('[QueryCache] Failed to get historical stats:', error);
      return [];
    }
  }

  shutdown(): void {
    if (this.statsFlushInterval) {
      clearInterval(this.statsFlushInterval);
      this.statsFlushInterval = null;
    }
    this.persistStats();
  }
}

export const queryCache = new QueryCache();

export async function withCache<T>(
  region: string,
  params: Record<string, any>,
  fetcher: () => Promise<T>,
  ttlOverrideSeconds?: number
): Promise<T> {
  const cached = queryCache.get<T>(region, params);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  queryCache.set(region, params, data, ttlOverrideSeconds);
  return data;
}
