import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../server/db', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve())
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    })),
  }
}));

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('CircuitBreaker Service', () => {
  let circuitBreaker: any;
  let withRetry: any;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../server/services/circuit-breaker');
    circuitBreaker = module.circuitBreaker;
    withRetry = module.withRetry;
    circuitBreaker.resetAll();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Circuit States', () => {
    it('starts in CLOSED state', () => {
      expect(circuitBreaker.getState('test-circuit')).toBe('CLOSED');
    });

    it('gets stats for a circuit', () => {
      const stats = circuitBreaker.getStats_public('test-circuit');
      expect(stats).toHaveProperty('state', 'CLOSED');
      expect(stats).toHaveProperty('failures', 0);
      expect(stats).toHaveProperty('successes', 0);
    });

    it('gets all stats', () => {
      circuitBreaker.getState('circuit-1');
      circuitBreaker.getState('circuit-2');
      const allStats = circuitBreaker.getAllStats();
      expect(allStats).toHaveProperty('circuit-1');
      expect(allStats).toHaveProperty('circuit-2');
    });

    it('gets all states for configured circuits', () => {
      const allStates = circuitBreaker.getAllStates();
      expect(Array.isArray(allStates)).toBe(true);
      expect(allStates.length).toBeGreaterThan(0);
      expect(allStates[0]).toHaveProperty('name');
      expect(allStates[0]).toHaveProperty('state');
      expect(allStates[0]).toHaveProperty('config');
    });

    it('resets a specific circuit', () => {
      circuitBreaker.getState('test-circuit');
      circuitBreaker.reset('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('CLOSED');
    });

    it('resets all circuits', () => {
      circuitBreaker.getState('circuit-1');
      circuitBreaker.getState('circuit-2');
      circuitBreaker.resetAll();
      const allStats = circuitBreaker.getAllStats();
      expect(Object.keys(allStats).length).toBe(0);
    });
  });

  describe('execute() method', () => {
    it('executes successful operations in CLOSED state', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute('test-circuit', operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('records success after successful execution', async () => {
      await circuitBreaker.execute('test-circuit', async () => 'ok');
      const stats = circuitBreaker.getStats_public('test-circuit');
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalCalls).toBe(1);
    });

    it('records failure when operation throws', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(circuitBreaker.execute('test-circuit', operation)).rejects.toThrow('fail');
      const stats = circuitBreaker.getStats_public('test-circuit');
      expect(stats.totalFailures).toBe(1);
    });

    it('uses fallback when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      const fallback = vi.fn().mockReturnValue('fallback-value');
      const result = await circuitBreaker.execute('test-circuit', operation, fallback);
      expect(result).toBe('fallback-value');
      expect(fallback).toHaveBeenCalled();
    });

    it('opens circuit after reaching failure threshold', async () => {
      circuitBreaker.configure('threshold-test', { failureThreshold: 3, resetTimeout: 60000 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute('threshold-test', operation)).rejects.toThrow();
      }
      
      expect(circuitBreaker.getState('threshold-test')).toBe('OPEN');
    });

    it('throws when circuit is OPEN and no fallback provided', async () => {
      circuitBreaker.configure('open-test', { failureThreshold: 1, resetTimeout: 60000 });
      await expect(circuitBreaker.execute('open-test', async () => { throw new Error('fail'); })).rejects.toThrow();
      
      await expect(circuitBreaker.execute('open-test', async () => 'ok')).rejects.toThrow('Circuit breaker open-test is OPEN');
    });

    it('uses fallback when circuit is OPEN', async () => {
      circuitBreaker.configure('fallback-test', { failureThreshold: 1, resetTimeout: 60000 });
      await expect(circuitBreaker.execute('fallback-test', async () => { throw new Error('fail'); })).rejects.toThrow();
      
      const fallback = () => 'fallback-result';
      const result = await circuitBreaker.execute('fallback-test', async () => 'ok', fallback);
      expect(result).toBe('fallback-result');
    });

    it('transitions to HALF_OPEN after reset timeout', async () => {
      circuitBreaker.configure('halfopen-test', { failureThreshold: 1, resetTimeout: 10 });
      await expect(circuitBreaker.execute('halfopen-test', async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(circuitBreaker.getState('halfopen-test')).toBe('OPEN');
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const operation = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute('halfopen-test', operation);
      expect(circuitBreaker.getState('halfopen-test')).toBe('HALF_OPEN');
    });

    it('closes circuit after success threshold in HALF_OPEN', async () => {
      circuitBreaker.configure('close-test', { failureThreshold: 1, successThreshold: 2, resetTimeout: 10 });
      await expect(circuitBreaker.execute('close-test', async () => { throw new Error('fail'); })).rejects.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      await circuitBreaker.execute('close-test', async () => 'ok');
      await circuitBreaker.execute('close-test', async () => 'ok');
      
      expect(circuitBreaker.getState('close-test')).toBe('CLOSED');
    });

    it('reopens circuit on failure in HALF_OPEN state', async () => {
      circuitBreaker.configure('reopen-test', { failureThreshold: 1, resetTimeout: 10 });
      await expect(circuitBreaker.execute('reopen-test', async () => { throw new Error('fail'); })).rejects.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      await circuitBreaker.execute('reopen-test', async () => 'ok');
      expect(circuitBreaker.getState('reopen-test')).toBe('HALF_OPEN');
      
      await expect(circuitBreaker.execute('reopen-test', async () => { throw new Error('fail again'); })).rejects.toThrow();
      expect(circuitBreaker.getState('reopen-test')).toBe('OPEN');
    });

    it('handles operation timeout', async () => {
      circuitBreaker.configure('timeout-test', { timeout: 50 });
      const slowOperation = () => new Promise(resolve => setTimeout(() => resolve('slow'), 200));
      
      await expect(circuitBreaker.execute('timeout-test', slowOperation)).rejects.toThrow('Operation timed out');
    });
  });

  describe('withRetry()', () => {
    it('returns result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetry(operation, 3, 10);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success');
      
      const result = await withRetry(operation, 3, 10);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('persistent-fail'));
      
      await expect(withRetry(operation, 2, 10)).rejects.toThrow('persistent-fail');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('configure()', () => {
    it('applies custom configuration', () => {
      circuitBreaker.configure('custom', {
        failureThreshold: 10,
        successThreshold: 5,
        timeout: 5000,
        resetTimeout: 10000,
      });
      
      const states = circuitBreaker.getAllStates();
      const custom = states.find((s: any) => s.name === 'custom');
      if (custom) {
        expect(custom.config.failureThreshold).toBe(10);
        expect(custom.config.successThreshold).toBe(5);
      }
    });
  });
});

describe('Password Policy Service', () => {
  let validatePassword: any;
  let getPasswordPolicyDescription: any;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../server/services/password-policy');
    validatePassword = module.validatePassword;
    getPasswordPolicyDescription = module.getPasswordPolicyDescription;
  });

  describe('validatePassword()', () => {
    it('accepts valid password', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects short password', () => {
      const result = validatePassword('Aa1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects password without uppercase', () => {
      const result = validatePassword('securepass123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects password without lowercase', () => {
      const result = validatePassword('SECUREPASS123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects password without number', () => {
      const result = validatePassword('SecurePass!!!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects password without special character', () => {
      const result = validatePassword('SecurePass123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*...)');
    });

    it('rejects password with too many consecutive characters', () => {
      const result = validatePassword('Seeeecure123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('consecutive identical characters'))).toBe(true);
    });

    it('rejects common weak passwords', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common or contains weak patterns');
    });

    it('accepts custom policy', () => {
      const customPolicy = {
        minLength: 4,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
        maxConsecutiveChars: 0,
      };
      const result = validatePassword('test', customPolicy);
      expect(result.isValid).toBe(true);
    });

    it('returns multiple errors for multiple violations', () => {
      const result = validatePassword('abc');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getPasswordPolicyDescription()', () => {
    it('returns array of policy rules', () => {
      const description = getPasswordPolicyDescription();
      expect(Array.isArray(description)).toBe(true);
      expect(description.length).toBeGreaterThan(0);
      expect(description.some((d: string) => d.includes('characters'))).toBe(true);
    });
  });
});

describe('Duplicate Detection Service', () => {
  let calculateFileHash: any;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../server/services/duplicate-detection');
    calculateFileHash = module.calculateFileHash;
  });

  describe('calculateFileHash()', () => {
    it('returns consistent hash for same content', () => {
      const buffer = Buffer.from('test content');
      const hash1 = calculateFileHash(buffer);
      const hash2 = calculateFileHash(buffer);
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different content', () => {
      const buffer1 = Buffer.from('content 1');
      const buffer2 = Buffer.from('content 2');
      expect(calculateFileHash(buffer1)).not.toBe(calculateFileHash(buffer2));
    });

    it('returns 64 character hex string (SHA256)', () => {
      const buffer = Buffer.from('test');
      const hash = calculateFileHash(buffer);
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('handles empty buffer', () => {
      const buffer = Buffer.from('');
      const hash = calculateFileHash(buffer);
      expect(hash).toHaveLength(64);
    });

    it('handles binary data', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const hash = calculateFileHash(buffer);
      expect(hash).toHaveLength(64);
    });
  });
});

describe('Cache Service', () => {
  let apiCache: any;
  let withCache: any;
  let CACHE_KEYS: any;
  let CACHE_TTL: any;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../server/services/cache');
    apiCache = module.apiCache;
    withCache = module.withCache;
    CACHE_KEYS = module.CACHE_KEYS;
    CACHE_TTL = module.CACHE_TTL;
    apiCache.clear();
  });

  describe('apiCache', () => {
    it('has required methods', () => {
      expect(typeof apiCache.get).toBe('function');
      expect(typeof apiCache.set).toBe('function');
      expect(typeof apiCache.delete).toBe('function');
      expect(typeof apiCache.clear).toBe('function');
    });

    it('sets and gets values', () => {
      apiCache.set('key1', 'value1');
      expect(apiCache.get('key1')).toBe('value1');
    });

    it('returns null for missing keys', () => {
      expect(apiCache.get('nonexistent')).toBeNull();
    });

    it('expires entries after TTL', async () => {
      apiCache.set('expiring', 'value', 50);
      expect(apiCache.get('expiring')).toBe('value');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(apiCache.get('expiring')).toBeNull();
    });

    it('deletes entries', () => {
      apiCache.set('key', 'value');
      apiCache.delete('key');
      expect(apiCache.get('key')).toBeNull();
    });

    it('clears all entries', () => {
      apiCache.set('key1', 'value1');
      apiCache.set('key2', 'value2');
      apiCache.clear();
      expect(apiCache.get('key1')).toBeNull();
      expect(apiCache.get('key2')).toBeNull();
    });

    it('clears by pattern', () => {
      apiCache.set('prefix_key1', 'value1');
      apiCache.set('prefix_key2', 'value2');
      apiCache.set('other_key', 'value3');
      apiCache.clearPattern('^prefix_');
      expect(apiCache.get('prefix_key1')).toBeNull();
      expect(apiCache.get('prefix_key2')).toBeNull();
      expect(apiCache.get('other_key')).toBe('value3');
    });

    it('reports stats correctly', () => {
      apiCache.set('key1', 'value1');
      apiCache.set('key2', 'value2');
      const stats = apiCache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('cleanup removes expired entries', async () => {
      apiCache.set('expired', 'value', 10);
      apiCache.set('valid', 'value', 5000);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const cleaned = apiCache.cleanup();
      
      expect(cleaned).toBe(1);
      expect(apiCache.get('valid')).toBe('value');
    });
  });

  describe('withCache()', () => {
    it('returns cached value on second call', async () => {
      const fetcher = vi.fn().mockResolvedValue('fetched-data');
      
      const result1 = await withCache('test-key', fetcher);
      const result2 = await withCache('test-key', fetcher);
      
      expect(result1).toBe('fetched-data');
      expect(result2).toBe('fetched-data');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('calls fetcher when cache misses', async () => {
      const fetcher = vi.fn().mockResolvedValue('new-data');
      
      const result = await withCache('new-key', fetcher);
      
      expect(result).toBe('new-data');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('CACHE_KEYS', () => {
    it('defines expected cache keys', () => {
      expect(CACHE_KEYS.CERTIFICATE_TYPES).toBeDefined();
      expect(CACHE_KEYS.COMPLIANCE_STREAMS).toBeDefined();
      expect(CACHE_KEYS.CLASSIFICATION_CODES).toBeDefined();
    });
  });

  describe('CACHE_TTL', () => {
    it('defines expected TTL values', () => {
      expect(CACHE_TTL.SHORT).toBe(60 * 1000);
      expect(CACHE_TTL.MEDIUM).toBe(5 * 60 * 1000);
      expect(CACHE_TTL.LONG).toBe(30 * 60 * 1000);
      expect(CACHE_TTL.VERY_LONG).toBe(60 * 60 * 1000);
    });
  });
});

console.log('Services tests loaded');
