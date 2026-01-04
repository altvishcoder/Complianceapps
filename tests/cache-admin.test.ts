import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
        returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../server/events', () => ({
  broadcastCacheInvalidation: vi.fn(),
}));

import {
  memoryCache,
  getDefaultCacheRegions,
  generateConfirmationToken,
  validateConfirmationToken,
  registerClientCacheCallback,
  broadcastCacheInvalidation,
} from '../server/services/cache-admin';

describe('Cache Admin Service', () => {
  describe('InMemoryCache', () => {
    beforeEach(() => {
      memoryCache.clear();
      memoryCache.resetStats();
    });

    it('should set and get values', () => {
      memoryCache.set('key1', { data: 'test' });
      const value = memoryCache.get<{ data: string }>('key1');
      expect(value).toEqual({ data: 'test' });
    });

    it('should return undefined for missing keys', () => {
      const value = memoryCache.get('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should handle TTL expiration', async () => {
      memoryCache.set('expiring', 'value', 0.1);
      
      expect(memoryCache.get('expiring')).toBe('value');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(memoryCache.get('expiring')).toBeUndefined();
    });

    it('should delete keys', () => {
      memoryCache.set('toDelete', 'value');
      expect(memoryCache.get('toDelete')).toBe('value');
      
      const deleted = memoryCache.delete('toDelete');
      expect(deleted).toBe(true);
      expect(memoryCache.get('toDelete')).toBeUndefined();
    });

    it('should clear all entries', () => {
      memoryCache.set('key1', 'value1');
      memoryCache.set('key2', 'value2');
      memoryCache.set('key3', 'value3');
      
      const cleared = memoryCache.clear();
      expect(cleared).toBe(3);
      expect(memoryCache.get('key1')).toBeUndefined();
    });

    it('should clear by prefix', () => {
      memoryCache.set('user:1', 'user1');
      memoryCache.set('user:2', 'user2');
      memoryCache.set('cache:1', 'cache1');
      
      const cleared = memoryCache.clearByPrefix('user:');
      expect(cleared).toBe(2);
      expect(memoryCache.get('user:1')).toBeUndefined();
      expect(memoryCache.get('cache:1')).toBe('cache1');
    });

    it('should track cache statistics', () => {
      memoryCache.set('statsKey', 'value');
      
      memoryCache.get('statsKey');
      memoryCache.get('statsKey');
      memoryCache.get('statsKey');
      memoryCache.get('missing');
      
      const stats = memoryCache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should reset statistics', () => {
      memoryCache.set('key', 'value');
      memoryCache.get('key');
      memoryCache.get('missing');
      
      memoryCache.resetStats();
      const stats = memoryCache.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should track evictions on TTL expiry', async () => {
      memoryCache.set('shortLived', 'value', 0.1);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      memoryCache.get('shortLived');
      
      const stats = memoryCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('getDefaultCacheRegions()', () => {
    it('should return array of cache regions', async () => {
      const regions = await getDefaultCacheRegions();
      
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });

    it('should include risk-related regions', async () => {
      const regions = await getDefaultCacheRegions();
      
      const riskRegions = regions.filter(r => r.category === 'risk');
      expect(riskRegions.length).toBeGreaterThan(0);
      expect(riskRegions.some(r => r.name === 'risk-portfolio')).toBe(true);
    });

    it('should include property regions', async () => {
      const regions = await getDefaultCacheRegions();
      
      const propertyRegions = regions.filter(r => r.category === 'property');
      expect(propertyRegions.length).toBeGreaterThan(0);
    });

    it('should have valid layer values', async () => {
      const regions = await getDefaultCacheRegions();
      const validLayers = ['CLIENT', 'API', 'DATABASE', 'MEMORY', 'SESSION'];
      
      regions.forEach(region => {
        expect(validLayers).toContain(region.layer);
      });
    });

    it('should mark system regions appropriately', async () => {
      const regions = await getDefaultCacheRegions();
      
      const systemRegions = regions.filter(r => r.isSystem);
      expect(systemRegions.some(r => r.name === 'navigation')).toBe(true);
    });
  });

  describe('Confirmation Token Management', () => {
    it('should generate valid confirmation tokens', () => {
      const token = generateConfirmationToken();
      
      expect(token).toMatch(/^CONFIRM-\d+-[A-Z0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateConfirmationToken();
      const token2 = generateConfirmationToken();
      
      expect(token1).not.toBe(token2);
    });

    it('should validate fresh tokens', () => {
      const token = generateConfirmationToken();
      
      expect(validateConfirmationToken(token)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(validateConfirmationToken('invalid')).toBe(false);
      expect(validateConfirmationToken('CONFIRM-')).toBe(false);
      expect(validateConfirmationToken('CONFIRM-abc-def')).toBe(false);
      expect(validateConfirmationToken('')).toBe(false);
    });

    it('should reject expired tokens', () => {
      const oldTimestamp = Date.now() - (6 * 60 * 1000);
      const expiredToken = `CONFIRM-${oldTimestamp}-ABC123`;
      
      expect(validateConfirmationToken(expiredToken)).toBe(false);
    });

    it('should accept tokens within 5 minute window', () => {
      const recentTimestamp = Date.now() - (4 * 60 * 1000);
      const recentToken = `CONFIRM-${recentTimestamp}-ABC123`;
      
      expect(validateConfirmationToken(recentToken)).toBe(true);
    });
  });

  describe('Client Cache Callbacks', () => {
    it('should register and unregister callbacks', () => {
      const callback = vi.fn();
      
      const unregister = registerClientCacheCallback(callback);
      expect(typeof unregister).toBe('function');
      
      unregister();
    });

    it('should invoke callbacks on cache invalidation', () => {
      const callback = vi.fn();
      const unregister = registerClientCacheCallback(callback);
      
      broadcastCacheInvalidation(['region1', 'region2']);
      
      expect(callback).toHaveBeenCalledWith(['region1', 'region2']);
      
      unregister();
    });

    it('should handle multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const unregister1 = registerClientCacheCallback(callback1);
      const unregister2 = registerClientCacheCallback(callback2);
      
      broadcastCacheInvalidation(['test-region']);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      
      unregister1();
      unregister2();
    });

    it('should not invoke unregistered callbacks', () => {
      const callback = vi.fn();
      const unregister = registerClientCacheCallback(callback);
      
      unregister();
      broadcastCacheInvalidation(['test-region']);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Cache Region Validation', () => {
  it('should have unique region names', async () => {
    const regions = await getDefaultCacheRegions();
    const names = regions.map(r => r.name);
    const uniqueNames = [...new Set(names)];
    
    expect(names.length).toBe(uniqueNames.length);
  });

  it('should have required fields in all regions', async () => {
    const regions = await getDefaultCacheRegions();
    
    regions.forEach(region => {
      expect(region.name).toBeDefined();
      expect(region.displayName).toBeDefined();
      expect(region.category).toBeDefined();
      expect(region.layer).toBeDefined();
    });
  });

  it('should have valid categories', async () => {
    const regions = await getDefaultCacheRegions();
    const validCategories = ['risk', 'property', 'certificate', 'asset', 'config', 'operations', 'ml', 'auth', 'api'];
    
    regions.forEach(region => {
      expect(validCategories).toContain(region.category);
    });
  });
});
