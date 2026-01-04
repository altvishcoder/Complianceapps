import { jobLogger } from "../logger";

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface TimeoutOptions {
  timeoutMs: number;
  timeoutMessage?: string;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

const DEFAULT_TIMEOUT_OPTIONS: TimeoutOptions = {
  timeoutMs: 30000,
  timeoutMessage: "Operation timed out",
};

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class NotImplementedError extends Error {
  constructor(message: string = "This feature is not yet implemented") {
    super(message);
    this.name = "NotImplementedError";
  }
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: Partial<TimeoutOptions> = {}
): Promise<T> {
  const { timeoutMs, timeoutMessage } = { ...DEFAULT_TIMEOUT_OPTIONS, ...options };

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

export async function withRetryAndTimeout<T>(
  operation: () => Promise<T>,
  retryOptions: Partial<RetryOptions> = {},
  timeoutOptions: Partial<TimeoutOptions> = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(operation, timeoutOptions),
    retryOptions
  );
}

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
};

export function getCircuitState(name: string): CircuitBreakerState {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, {
      state: "CLOSED",
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
    });
  }
  return circuitBreakers.get(name)!;
}

export async function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  options: Partial<CircuitBreakerOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  const circuit = getCircuitState(name);

  if (circuit.state === "OPEN") {
    const timeSinceLastFailure = Date.now() - circuit.lastFailureTime;
    if (timeSinceLastFailure >= opts.resetTimeoutMs) {
      circuit.state = "HALF_OPEN";
      circuit.successCount = 0;
      jobLogger.info({ circuitName: name }, "Circuit breaker entering half-open state");
    } else {
      throw new CircuitBreakerError(`Circuit breaker ${name} is open`);
    }
  }

  try {
    const result = await operation();

    if (circuit.state === "HALF_OPEN") {
      circuit.successCount++;
      if (circuit.successCount >= opts.halfOpenRequests) {
        circuit.state = "CLOSED";
        circuit.failures = 0;
        jobLogger.info({ circuitName: name }, "Circuit breaker closed after successful requests");
      }
    } else if (circuit.state === "CLOSED") {
      circuit.failures = 0;
    }

    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failures >= opts.failureThreshold) {
      circuit.state = "OPEN";
      jobLogger.warn(
        { circuitName: name, failures: circuit.failures },
        "Circuit breaker opened due to failures"
      );
    }

    throw error;
  }
}

export function resetCircuitBreaker(name: string): void {
  const circuit = getCircuitState(name);
  circuit.state = "CLOSED";
  circuit.failures = 0;
  circuit.successCount = 0;
  circuit.lastFailureTime = 0;
}

export function getAllCircuitStates(): Record<string, CircuitBreakerState> {
  const states: Record<string, CircuitBreakerState> = {};
  circuitBreakers.forEach((state, name) => {
    states[name] = { ...state };
  });
  return states;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  checkExists: (key: string) => Promise<boolean>,
  markComplete: (key: string) => Promise<void>
): Promise<T | null> {
  const exists = await checkExists(key);
  if (exists) {
    jobLogger.debug({ idempotencyKey: key }, "Operation already completed, skipping");
    return null;
  }

  const result = await operation();
  await markComplete(key);
  return result;
}

export async function withSafeDefaults<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    jobLogger.warn(
      { error, context },
      "Operation failed, using default value"
    );
    return defaultValue;
  }
}
