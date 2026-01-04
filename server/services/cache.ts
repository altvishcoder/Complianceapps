import { logger } from '../logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const apiCache = new MemoryCache();

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const cleaned = apiCache.cleanup();
    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cache cleanup completed');
    }
  }, 5 * 60 * 1000);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

startCacheCleanup();

// Cache keys for commonly cached data
export const CACHE_KEYS = {
  CERTIFICATE_TYPES: 'certificate_types',
  COMPLIANCE_STREAMS: 'compliance_streams',
  CLASSIFICATION_CODES: 'classification_codes',
  EXTRACTION_SCHEMAS: 'extraction_schemas',
  COMPLIANCE_RULES: 'compliance_rules',
  COMPONENT_TYPES: 'component_types',
} as const;

// TTL values in milliseconds
export const CACHE_TTL = {
  SHORT: 60 * 1000,           // 1 minute
  MEDIUM: 5 * 60 * 1000,      // 5 minutes
  LONG: 30 * 60 * 1000,       // 30 minutes
  VERY_LONG: 60 * 60 * 1000,  // 1 hour
} as const;

// Helper function to cache API responses
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = CACHE_TTL.MEDIUM
): Promise<T> {
  const cached = apiCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  const data = await fetcher();
  apiCache.set(key, data, ttlMs);
  return data;
}
