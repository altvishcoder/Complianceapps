import { logger } from '../logger';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // Time in ms before attempting to close circuit
  resetTimeout: number; // Time in ms to wait before retrying after open
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  resetTimeout: 60000, // 1 minute
};

const MAX_CIRCUITS = 100;

class CircuitBreaker {
  private circuits: Map<string, CircuitStats> = new Map();
  private configs: Map<string, CircuitBreakerConfig> = new Map();

  private getStats(name: string): CircuitStats {
    if (!this.circuits.has(name)) {
      if (this.circuits.size >= MAX_CIRCUITS) {
        const oldestKey = this.circuits.keys().next().value;
        if (oldestKey) {
          this.circuits.delete(oldestKey);
          logger.warn({ circuit: oldestKey, maxCircuits: MAX_CIRCUITS }, 'Evicted oldest circuit to prevent memory bloat');
        }
      }
      this.circuits.set(name, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        totalCalls: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      });
    }
    return this.circuits.get(name)!;
  }

  private getConfig(name: string): CircuitBreakerConfig {
    return this.configs.get(name) || DEFAULT_CONFIG;
  }

  configure(name: string, config: Partial<CircuitBreakerConfig>): void {
    this.configs.set(name, { ...DEFAULT_CONFIG, ...config });
  }

  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const stats = this.getStats(name);
    const config = this.getConfig(name);

    stats.totalCalls++;

    if (stats.state === 'OPEN') {
      const timeSinceFailure = Date.now() - stats.lastFailureTime;
      
      if (timeSinceFailure >= config.resetTimeout) {
        stats.state = 'HALF_OPEN';
        stats.successes = 0;
        logger.info({ circuit: name }, 'Circuit breaker transitioning to HALF_OPEN');
      } else {
        logger.warn({ circuit: name, resetIn: config.resetTimeout - timeSinceFailure }, 'Circuit breaker is OPEN');
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker ${name} is OPEN. Service temporarily unavailable.`);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation, config.timeout);
      this.recordSuccess(name);
      return result;
    } catch (error) {
      this.recordFailure(name);
      
      if (fallback) {
        logger.warn({ circuit: name, error: (error as Error).message }, 'Operation failed, using fallback');
        return fallback();
      }
      throw error;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      ),
    ]);
  }

  private recordSuccess(name: string): void {
    const stats = this.getStats(name);
    const config = this.getConfig(name);

    stats.successes++;
    stats.totalSuccesses++;
    stats.failures = 0;

    if (stats.state === 'HALF_OPEN' && stats.successes >= config.successThreshold) {
      stats.state = 'CLOSED';
      logger.info({ circuit: name }, 'Circuit breaker CLOSED after successful recovery');
    }
  }

  private recordFailure(name: string): void {
    const stats = this.getStats(name);
    const config = this.getConfig(name);

    stats.failures++;
    stats.totalFailures++;
    stats.lastFailureTime = Date.now();
    stats.successes = 0;

    if (stats.state === 'HALF_OPEN') {
      stats.state = 'OPEN';
      logger.warn({ circuit: name }, 'Circuit breaker OPEN after failure in HALF_OPEN state');
    } else if (stats.failures >= config.failureThreshold) {
      stats.state = 'OPEN';
      logger.warn({ circuit: name, failures: stats.failures }, 'Circuit breaker OPEN due to failure threshold');
    }
  }

  getState(name: string): CircuitState {
    return this.getStats(name).state;
  }

  getStats_public(name: string): CircuitStats {
    return { ...this.getStats(name) };
  }

  getAllStats(): Record<string, CircuitStats> {
    const result: Record<string, CircuitStats> = {};
    this.circuits.forEach((stats, name) => {
      result[name] = { ...stats };
    });
    return result;
  }

  getAllStates(): Array<{
    name: string;
    state: CircuitState;
    failures: number;
    successes: number;
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
    lastFailureTime: number;
    config: CircuitBreakerConfig;
  }> {
    const result: Array<{
      name: string;
      state: CircuitState;
      failures: number;
      successes: number;
      totalCalls: number;
      totalFailures: number;
      totalSuccesses: number;
      lastFailureTime: number;
      config: CircuitBreakerConfig;
    }> = [];
    
    const configuredCircuits = ['claude-vision', 'claude-text', 'azure-di', 'object-storage', 'webhook-delivery'];
    
    for (const name of configuredCircuits) {
      const stats = this.getStats(name);
      const config = this.getConfig(name);
      result.push({
        name,
        state: stats.state,
        failures: stats.failures,
        successes: stats.successes,
        totalCalls: stats.totalCalls,
        totalFailures: stats.totalFailures,
        totalSuccesses: stats.totalSuccesses,
        lastFailureTime: stats.lastFailureTime,
        config,
      });
    }
    
    return result;
  }

  reset(name: string): void {
    this.circuits.delete(name);
    logger.info({ circuit: name }, 'Circuit breaker reset');
  }

  resetAll(): void {
    this.circuits.clear();
    logger.info('All circuit breakers reset');
  }
}

export const circuitBreaker = new CircuitBreaker();

circuitBreaker.configure('claude-vision', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000, // 60 seconds for vision API
  resetTimeout: 120000, // 2 minutes
});

circuitBreaker.configure('claude-text', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000, // 30 seconds for text API
  resetTimeout: 120000, // 2 minutes
});

circuitBreaker.configure('azure-di', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 120000, // 120 seconds for Azure DI (polling-based)
  resetTimeout: 180000, // 3 minutes
});

circuitBreaker.configure('object-storage', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 60 seconds for object storage
  resetTimeout: 60000, // 1 minute
});

circuitBreaker.configure('webhook-delivery', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds for webhooks
  resetTimeout: 120000, // 2 minutes
});

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
        const jitter = Math.random() * 500;
        logger.warn({ 
          attempt: attempt + 1, 
          maxRetries, 
          delay: delay + jitter,
          error: lastError.message 
        }, 'Operation failed, retrying with exponential backoff');
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }
  
  throw lastError;
}
