import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiCache,
  withCache,
  CACHE_KEYS,
  CACHE_TTL,
  startCacheCleanup,
  stopCacheCleanup,
} from '../server/services/cache';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Cache Service', () => {
  beforeEach(() => {
    apiCache.clear();
  });

  describe('apiCache', () => {
    describe('set and get', () => {
      it('should store and retrieve values', () => {
        apiCache.set('test-key', { data: 'test-value' });
        
        const result = apiCache.get('test-key');
        
        expect(result).toEqual({ data: 'test-value' });
      });

      it('should return null for non-existent keys', () => {
        const result = apiCache.get('non-existent');
        
        expect(result).toBeNull();
      });

      it('should store different data types', () => {
        apiCache.set('string', 'hello');
        apiCache.set('number', 42);
        apiCache.set('array', [1, 2, 3]);
        apiCache.set('object', { nested: { value: true } });
        
        expect(apiCache.get('string')).toBe('hello');
        expect(apiCache.get('number')).toBe(42);
        expect(apiCache.get('array')).toEqual([1, 2, 3]);
        expect(apiCache.get('object')).toEqual({ nested: { value: true } });
      });

      it('should overwrite existing values', () => {
        apiCache.set('key', 'original');
        apiCache.set('key', 'updated');
        
        expect(apiCache.get('key')).toBe('updated');
      });
    });

    describe('TTL expiration', () => {
      it('should return null for expired entries', async () => {
        apiCache.set('expiring', 'value', 50);
        
        expect(apiCache.get('expiring')).toBe('value');
        
        await new Promise(resolve => setTimeout(resolve, 60));
        
        expect(apiCache.get('expiring')).toBeNull();
      });

      it('should use custom TTL when provided', () => {
        apiCache.set('custom-ttl', 'value', 1000);
        
        expect(apiCache.get('custom-ttl')).toBe('value');
      });
    });

    describe('delete', () => {
      it('should remove entry', () => {
        apiCache.set('to-delete', 'value');
        expect(apiCache.get('to-delete')).toBe('value');
        
        apiCache.delete('to-delete');
        
        expect(apiCache.get('to-delete')).toBeNull();
      });

      it('should handle deleting non-existent keys', () => {
        expect(() => apiCache.delete('non-existent')).not.toThrow();
      });
    });

    describe('clear', () => {
      it('should remove all entries', () => {
        apiCache.set('key1', 'value1');
        apiCache.set('key2', 'value2');
        apiCache.set('key3', 'value3');
        
        apiCache.clear();
        
        expect(apiCache.get('key1')).toBeNull();
        expect(apiCache.get('key2')).toBeNull();
        expect(apiCache.get('key3')).toBeNull();
      });
    });

    describe('clearPattern', () => {
      it('should clear entries matching pattern', () => {
        apiCache.set('user:1', 'data1');
        apiCache.set('user:2', 'data2');
        apiCache.set('org:1', 'data3');
        
        apiCache.clearPattern('^user:');
        
        expect(apiCache.get('user:1')).toBeNull();
        expect(apiCache.get('user:2')).toBeNull();
        expect(apiCache.get('org:1')).toBe('data3');
      });

      it('should handle complex patterns', () => {
        apiCache.set('certificate_GAS_123', 'data1');
        apiCache.set('certificate_EICR_456', 'data2');
        apiCache.set('property_123', 'data3');
        
        apiCache.clearPattern('certificate_');
        
        expect(apiCache.get('certificate_GAS_123')).toBeNull();
        expect(apiCache.get('certificate_EICR_456')).toBeNull();
        expect(apiCache.get('property_123')).toBe('data3');
      });
    });

    describe('getStats', () => {
      it('should return size and keys', () => {
        apiCache.set('key1', 'value1');
        apiCache.set('key2', 'value2');
        
        const stats = apiCache.getStats();
        
        expect(stats.size).toBe(2);
        expect(stats.keys).toContain('key1');
        expect(stats.keys).toContain('key2');
      });

      it('should return empty stats for empty cache', () => {
        const stats = apiCache.getStats();
        
        expect(stats.size).toBe(0);
        expect(stats.keys).toEqual([]);
      });
    });

    describe('cleanup', () => {
      it('should remove expired entries', async () => {
        apiCache.set('short', 'value', 30);
        apiCache.set('long', 'value', 60000);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const cleaned = apiCache.cleanup();
        
        expect(cleaned).toBe(1);
        expect(apiCache.get('short')).toBeNull();
        expect(apiCache.get('long')).toBe('value');
      });

      it('should return 0 when nothing to clean', () => {
        apiCache.set('valid', 'value', 60000);
        
        const cleaned = apiCache.cleanup();
        
        expect(cleaned).toBe(0);
      });
    });
  });

  describe('withCache', () => {
    it('should cache result of fetcher', async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { data: 'fetched' };
      };
      
      const result1 = await withCache('cached-key', fetcher);
      const result2 = await withCache('cached-key', fetcher);
      
      expect(result1).toEqual({ data: 'fetched' });
      expect(result2).toEqual({ data: 'fetched' });
      expect(callCount).toBe(1);
    });

    it('should call fetcher again after cache expires', async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { count: callCount };
      };
      
      const result1 = await withCache('expiring-key', fetcher, 30);
      expect(result1).toEqual({ count: 1 });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const result2 = await withCache('expiring-key', fetcher, 30);
      expect(result2).toEqual({ count: 2 });
      expect(callCount).toBe(2);
    });

    it('should use default TTL when not specified', async () => {
      const fetcher = async () => ({ data: 'test' });
      
      const result = await withCache('default-ttl-key', fetcher);
      
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('CACHE_KEYS', () => {
    it('should have predefined cache keys', () => {
      expect(CACHE_KEYS.CERTIFICATE_TYPES).toBe('certificate_types');
      expect(CACHE_KEYS.COMPLIANCE_STREAMS).toBe('compliance_streams');
      expect(CACHE_KEYS.CLASSIFICATION_CODES).toBe('classification_codes');
      expect(CACHE_KEYS.EXTRACTION_SCHEMAS).toBe('extraction_schemas');
      expect(CACHE_KEYS.COMPLIANCE_RULES).toBe('compliance_rules');
      expect(CACHE_KEYS.COMPONENT_TYPES).toBe('component_types');
    });
  });

  describe('CACHE_TTL', () => {
    it('should have correct TTL values in milliseconds', () => {
      expect(CACHE_TTL.SHORT).toBe(60 * 1000);
      expect(CACHE_TTL.MEDIUM).toBe(5 * 60 * 1000);
      expect(CACHE_TTL.LONG).toBe(30 * 60 * 1000);
      expect(CACHE_TTL.VERY_LONG).toBe(60 * 60 * 1000);
    });

    it('should have SHORT as 1 minute', () => {
      expect(CACHE_TTL.SHORT).toBe(60000);
    });

    it('should have MEDIUM as 5 minutes', () => {
      expect(CACHE_TTL.MEDIUM).toBe(300000);
    });

    it('should have LONG as 30 minutes', () => {
      expect(CACHE_TTL.LONG).toBe(1800000);
    });

    it('should have VERY_LONG as 1 hour', () => {
      expect(CACHE_TTL.VERY_LONG).toBe(3600000);
    });
  });

  describe('Cache Cleanup Lifecycle', () => {
    it('should start cleanup without error', () => {
      expect(() => startCacheCleanup()).not.toThrow();
    });

    it('should stop cleanup without error', () => {
      expect(() => stopCacheCleanup()).not.toThrow();
    });

    it('should handle multiple start calls', () => {
      startCacheCleanup();
      startCacheCleanup();
      expect(() => stopCacheCleanup()).not.toThrow();
    });

    it('should handle stop when not started', () => {
      stopCacheCleanup();
      expect(() => stopCacheCleanup()).not.toThrow();
    });
  });
});
