import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  circuitBreaker,
  withRetry,
  type CircuitBreakerConfig,
} from '../server/services/circuit-breaker';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Circuit Breaker Unit Tests', () => {
  beforeEach(() => {
    circuitBreaker.resetAll();
  });

  describe('CircuitBreakerConfig Type', () => {
    it('should have correct structure', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 30000,
        resetTimeout: 60000,
      };

      expect(config.failureThreshold).toBe(5);
      expect(config.successThreshold).toBe(2);
      expect(config.timeout).toBe(30000);
      expect(config.resetTimeout).toBe(60000);
    });
  });

  describe('configure', () => {
    it('should configure a custom circuit breaker', () => {
      circuitBreaker.configure('custom-circuit', {
        failureThreshold: 10,
        timeout: 5000,
      });

      const stats = circuitBreaker.getStats_public('custom-circuit');
      expect(stats.state).toBe('CLOSED');
    });
  });

  describe('getState', () => {
    it('should return CLOSED for new circuits', () => {
      const state = circuitBreaker.getState('new-circuit');
      expect(state).toBe('CLOSED');
    });
  });

  describe('getStats_public', () => {
    it('should return initial stats for new circuits', () => {
      const stats = circuitBreaker.getStats_public('stats-test');

      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.state).toBe('CLOSED');
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute operation successfully', async () => {
      const result = await circuitBreaker.execute(
        'success-test',
        async () => 'success'
      );

      expect(result).toBe('success');
    });

    it('should increment totalCalls on execution', async () => {
      await circuitBreaker.execute('call-count', async () => 'done');
      await circuitBreaker.execute('call-count', async () => 'done');

      const stats = circuitBreaker.getStats_public('call-count');
      expect(stats.totalCalls).toBe(2);
    });

    it('should record successes', async () => {
      await circuitBreaker.execute('success-record', async () => 'ok');
      
      const stats = circuitBreaker.getStats_public('success-record');
      expect(stats.totalSuccesses).toBe(1);
    });

    it('should record failures', async () => {
      try {
        await circuitBreaker.execute(
          'failure-record',
          async () => { throw new Error('fail'); }
        );
      } catch (e) {}

      const stats = circuitBreaker.getStats_public('failure-record');
      expect(stats.totalFailures).toBe(1);
    });

    it('should use fallback on failure', async () => {
      const result = await circuitBreaker.execute(
        'fallback-test',
        async () => { throw new Error('fail'); },
        () => 'fallback-value'
      );

      expect(result).toBe('fallback-value');
    });

    it('should open circuit after threshold failures', async () => {
      circuitBreaker.configure('threshold-test', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        resetTimeout: 5000,
      });

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(
            'threshold-test',
            async () => { throw new Error('fail'); }
          );
        } catch (e) {}
      }

      const state = circuitBreaker.getState('threshold-test');
      expect(state).toBe('OPEN');
    });

    it('should throw when circuit is open without fallback', async () => {
      circuitBreaker.configure('open-test', {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 1000,
        resetTimeout: 60000,
      });

      try {
        await circuitBreaker.execute(
          'open-test',
          async () => { throw new Error('fail'); }
        );
      } catch (e) {}

      await expect(
        circuitBreaker.execute('open-test', async () => 'should-not-run')
      ).rejects.toThrow('Circuit breaker open-test is OPEN');
    });

    it('should use fallback when circuit is open', async () => {
      circuitBreaker.configure('open-fallback', {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 1000,
        resetTimeout: 60000,
      });

      try {
        await circuitBreaker.execute(
          'open-fallback',
          async () => { throw new Error('fail'); }
        );
      } catch (e) {}

      const result = await circuitBreaker.execute(
        'open-fallback',
        async () => 'should-not-run',
        () => 'open-fallback-value'
      );

      expect(result).toBe('open-fallback-value');
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all circuits', async () => {
      await circuitBreaker.execute('circuit-a', async () => 'a');
      await circuitBreaker.execute('circuit-b', async () => 'b');

      const allStats = circuitBreaker.getAllStats();

      expect(allStats['circuit-a']).toBeDefined();
      expect(allStats['circuit-b']).toBeDefined();
    });
  });

  describe('getAllStates', () => {
    it('should return array of configured circuits', () => {
      const states = circuitBreaker.getAllStates();

      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);

      const names = states.map(s => s.name);
      expect(names).toContain('claude-vision');
      expect(names).toContain('claude-text');
      expect(names).toContain('azure-di');
    });

    it('should include config for each circuit', () => {
      const states = circuitBreaker.getAllStates();
      
      states.forEach(state => {
        expect(state.config).toBeDefined();
        expect(state.config.failureThreshold).toBeGreaterThan(0);
        expect(state.config.timeout).toBeGreaterThan(0);
      });
    });
  });

  describe('reset', () => {
    it('should reset a specific circuit', async () => {
      await circuitBreaker.execute('reset-test', async () => 'ok');
      
      circuitBreaker.reset('reset-test');
      
      const stats = circuitBreaker.getStats_public('reset-test');
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('should reset all circuits', async () => {
      await circuitBreaker.execute('reset-all-a', async () => 'a');
      await circuitBreaker.execute('reset-all-b', async () => 'b');

      circuitBreaker.resetAll();

      const allStats = circuitBreaker.getAllStats();
      expect(Object.keys(allStats).length).toBe(0);
    });
  });

  describe('Default configurations', () => {
    it('should have claude-vision configured with 60s timeout', () => {
      const states = circuitBreaker.getAllStates();
      const claudeVision = states.find(s => s.name === 'claude-vision');

      expect(claudeVision).toBeDefined();
      expect(claudeVision?.config.timeout).toBe(60000);
      expect(claudeVision?.config.resetTimeout).toBe(120000);
    });

    it('should have azure-di configured with 120s timeout', () => {
      const states = circuitBreaker.getAllStates();
      const azureDi = states.find(s => s.name === 'azure-di');

      expect(azureDi).toBeDefined();
      expect(azureDi?.config.timeout).toBe(120000);
    });

    it('should have object-storage configured', () => {
      const states = circuitBreaker.getAllStates();
      const objectStorage = states.find(s => s.name === 'object-storage');

      expect(objectStorage).toBeDefined();
      expect(objectStorage?.config.failureThreshold).toBe(5);
    });

    it('should have webhook-delivery configured', () => {
      const states = circuitBreaker.getAllStates();
      const webhook = states.find(s => s.name === 'webhook-delivery');

      expect(webhook).toBeDefined();
      expect(webhook?.config.successThreshold).toBe(3);
    });
  });
});

describe('withRetry Function', () => {
  it('should return result on first success', async () => {
    const result = await withRetry(async () => 'immediate-success');
    expect(result).toBe('immediate-success');
  });

  it('should retry on failure and succeed', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'eventual-success';
      },
      3,
      10,
      1
    );

    expect(result).toBe('eventual-success');
    expect(attempts).toBe(2);
  });

  it('should throw after max retries exhausted', async () => {
    await expect(
      withRetry(
        async () => { throw new Error('always-fails'); },
        2,
        10,
        1
      )
    ).rejects.toThrow('always-fails');
  });

  it('should attempt operation maxRetries + 1 times', async () => {
    let attempts = 0;
    
    try {
      await withRetry(
        async () => {
          attempts++;
          throw new Error('fail');
        },
        3,
        10,
        1
      );
    } catch (e) {}

    expect(attempts).toBe(4);
  });

  it('should handle synchronous errors', async () => {
    await expect(
      withRetry(
        async () => { throw new TypeError('type error'); },
        1,
        10,
        1
      )
    ).rejects.toThrow('type error');
  });
});
