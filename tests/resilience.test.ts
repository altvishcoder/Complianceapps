import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withTimeout,
  withRetry,
  withRetryAndTimeout,
  withCircuitBreaker,
  withIdempotency,
  withSafeDefaults,
  getCircuitState,
  resetCircuitBreaker,
  getAllCircuitStates,
  TimeoutError,
  CircuitBreakerError,
  NotImplementedError,
} from '../server/utils/resilience';

vi.mock('../server/logger', () => ({
  jobLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Resilience Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetCircuitBreaker('test-circuit');
  });

  describe('TimeoutError', () => {
    it('should create error with message and timeout', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      expect(error.message).toBe('Operation timed out');
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('CircuitBreakerError', () => {
    it('should create error with message', () => {
      const error = new CircuitBreakerError('Circuit is open');
      expect(error.message).toBe('Circuit is open');
      expect(error.name).toBe('CircuitBreakerError');
    });
  });

  describe('NotImplementedError', () => {
    it('should create error with default message', () => {
      const error = new NotImplementedError();
      expect(error.message).toBe('This feature is not yet implemented');
      expect(error.name).toBe('NotImplementedError');
    });

    it('should create error with custom message', () => {
      const error = new NotImplementedError('Custom not implemented');
      expect(error.message).toBe('Custom not implemented');
    });
  });

  describe('withTimeout', () => {
    it('should resolve when operation completes before timeout', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const promise = withTimeout(operation, { timeoutMs: 5000 });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBe('success');
    });

    it('should reject with TimeoutError when operation times out', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      const promise = withTimeout(operation, { timeoutMs: 1000 });
      vi.advanceTimersByTime(1001);
      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it('should use default timeout options', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      const promise = withTimeout(operation);
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBe('result');
    });

    it('should propagate operation errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const promise = withTimeout(operation, { timeoutMs: 5000 });
      await expect(promise).rejects.toThrow('Operation failed');
    });

    it('should include custom timeout message', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      const promise = withTimeout(operation, { 
        timeoutMs: 1000, 
        timeoutMessage: 'Custom timeout message' 
      });
      vi.advanceTimersByTime(1001);
      await expect(promise).rejects.toThrow('Custom timeout message');
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetry(operation, { maxAttempts: 3 });
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      vi.useRealTimers();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success');
      const result = await withRetry(operation, { 
        maxAttempts: 3, 
        initialDelayMs: 10 
      });
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));
      await expect(withRetry(operation, { 
        maxAttempts: 3, 
        initialDelayMs: 10 
      })).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      vi.useRealTimers();
      const onRetry = vi.fn();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      await withRetry(operation, { 
        maxAttempts: 3, 
        initialDelayMs: 10,
        onRetry 
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should use exponential backoff', async () => {
      vi.useRealTimers();
      const startTime = Date.now();
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      await withRetry(operation, { 
        maxAttempts: 3, 
        initialDelayMs: 50,
        backoffMultiplier: 2
      });
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(140);
    });
  });

  describe('withRetryAndTimeout', () => {
    it('should combine retry and timeout', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetryAndTimeout(
        operation,
        { maxAttempts: 2 },
        { timeoutMs: 5000 }
      );
      expect(result).toBe('success');
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute operation when circuit is closed', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withCircuitBreaker('test-circuit', operation);
      expect(result).toBe('success');
    });

    it('should track failures and open circuit', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      for (let i = 0; i < 5; i++) {
        try {
          await withCircuitBreaker('test-circuit', operation, { failureThreshold: 5 });
        } catch {}
      }
      const state = getCircuitState('test-circuit');
      expect(state.state).toBe('OPEN');
    });

    it('should reject immediately when circuit is open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      for (let i = 0; i < 5; i++) {
        try {
          await withCircuitBreaker('test-circuit', operation, { failureThreshold: 5 });
        } catch {}
      }
      await expect(
        withCircuitBreaker('test-circuit', vi.fn().mockResolvedValue('success'))
      ).rejects.toThrow(CircuitBreakerError);
    });

    it('should transition to half-open after reset timeout', async () => {
      vi.useRealTimers();
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      for (let i = 0; i < 5; i++) {
        try {
          await withCircuitBreaker('test-circuit', operation, { 
            failureThreshold: 5,
            resetTimeoutMs: 100 
          });
        } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 150));
      const successOp = vi.fn().mockResolvedValue('success');
      const result = await withCircuitBreaker('test-circuit', successOp, { resetTimeoutMs: 100 });
      expect(result).toBe('success');
      const state = getCircuitState('test-circuit');
      expect(['HALF_OPEN', 'CLOSED']).toContain(state.state);
    });

    it('should reset failures on success in closed state', async () => {
      const failOp = vi.fn().mockRejectedValue(new Error('Fail'));
      const successOp = vi.fn().mockResolvedValue('success');
      try {
        await withCircuitBreaker('test-circuit', failOp, { failureThreshold: 5 });
      } catch {}
      await withCircuitBreaker('test-circuit', successOp, { failureThreshold: 5 });
      const state = getCircuitState('test-circuit');
      expect(state.failures).toBe(0);
    });
  });

  describe('getCircuitState', () => {
    it('should return initial state for new circuit', () => {
      const state = getCircuitState('new-circuit');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successCount).toBe(0);
    });

    it('should return existing state for known circuit', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      try {
        await withCircuitBreaker('test-circuit', operation);
      } catch {}
      const state = getCircuitState('test-circuit');
      expect(state.failures).toBe(1);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit to initial state', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      for (let i = 0; i < 5; i++) {
        try {
          await withCircuitBreaker('test-circuit', operation, { failureThreshold: 5 });
        } catch {}
      }
      resetCircuitBreaker('test-circuit');
      const state = getCircuitState('test-circuit');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.lastFailureTime).toBe(0);
    });
  });

  describe('getAllCircuitStates', () => {
    it('should return all circuit states', async () => {
      await withCircuitBreaker('circuit-a', vi.fn().mockResolvedValue('a'));
      await withCircuitBreaker('circuit-b', vi.fn().mockResolvedValue('b'));
      const states = getAllCircuitStates();
      expect(states).toHaveProperty('circuit-a');
      expect(states).toHaveProperty('circuit-b');
    });

    it('should return copies of states', async () => {
      await withCircuitBreaker('test-circuit', vi.fn().mockResolvedValue('x'));
      const states = getAllCircuitStates();
      states['test-circuit'].failures = 999;
      const freshState = getCircuitState('test-circuit');
      expect(freshState.failures).not.toBe(999);
    });
  });

  describe('withIdempotency', () => {
    it('should execute operation if key does not exist', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      const checkExists = vi.fn().mockResolvedValue(false);
      const markComplete = vi.fn().mockResolvedValue(undefined);
      const result = await withIdempotency('key1', operation, checkExists, markComplete);
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
      expect(markComplete).toHaveBeenCalledWith('key1');
    });

    it('should skip operation if key exists', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      const checkExists = vi.fn().mockResolvedValue(true);
      const markComplete = vi.fn().mockResolvedValue(undefined);
      const result = await withIdempotency('key1', operation, checkExists, markComplete);
      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('withSafeDefaults', () => {
    it('should return operation result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withSafeDefaults(operation, 'default');
      expect(result).toBe('success');
    });

    it('should return default value on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      const result = await withSafeDefaults(operation, 'default');
      expect(result).toBe('default');
    });

    it('should work with complex default values', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      const defaultValue = { items: [], count: 0 };
      const result = await withSafeDefaults(operation, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should pass context to logger', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));
      await withSafeDefaults(operation, 'default', 'test-context');
    });
  });
});
