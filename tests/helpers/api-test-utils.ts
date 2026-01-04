import { expect } from 'vitest';

export const API_BASE = 'http://localhost:5000/api';

export async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

export interface RateLimitInfo {
  isRateLimited: boolean;
  hasValidHeaders: boolean;
  retryAfter?: string | null;
  policy?: string | null;
  limit?: string | null;
  remaining?: number;
  reset?: number;
}

export function parseRateLimitHeaders(response: Response): RateLimitInfo {
  const retryAfter = response.headers.get('retry-after');
  const rateLimitPolicy = response.headers.get('ratelimit-policy');
  const rateLimit = response.headers.get('ratelimit');
  
  let remaining: number | undefined;
  let reset: number | undefined;
  let limit: number | undefined;
  
  if (rateLimit) {
    const parts = rateLimit.split(',').map(p => p.trim());
    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key === 'remaining') remaining = parseInt(value);
      if (key === 'reset') reset = parseInt(value);
      if (key === 'limit') limit = parseInt(value);
    }
  }
  
  const isRateLimited = response.status === 429;
  const hasValidHeaders = !!(retryAfter || (rateLimitPolicy && rateLimit));
  
  return {
    isRateLimited,
    hasValidHeaders,
    retryAfter,
    policy: rateLimitPolicy,
    limit: rateLimit,
    remaining,
    reset,
  };
}

export function validateRateLimitResponse(response: Response, description: string): void {
  const info = parseRateLimitHeaders(response);
  
  expect(
    info.hasValidHeaders,
    `${description}: Rate limited (429) but missing required headers. ` +
    `Expected 'retry-after' or both 'ratelimit-policy' and 'ratelimit' headers.`
  ).toBe(true);
  
  if (info.retryAfter) {
    const retrySeconds = parseInt(info.retryAfter);
    expect(
      !isNaN(retrySeconds) && retrySeconds >= 0,
      `${description}: Invalid retry-after value: ${info.retryAfter}`
    ).toBe(true);
  }
  
  if (info.limit) {
    expect(info.limit).toContain('limit=');
    expect(info.limit).toContain('remaining=');
  }
}

export function assertValidResponse(
  response: Response, 
  expectedStatuses: number[], 
  description: string
): { isRateLimited: boolean; status: number } {
  const rateLimitInfo = parseRateLimitHeaders(response);
  
  if (response.status === 429) {
    validateRateLimitResponse(response, description);
    return { isRateLimited: true, status: 429 };
  }
  
  const isExpected = expectedStatuses.includes(response.status);
  expect(
    isExpected,
    `${description}: Expected status ${expectedStatuses.join(' or ')}, got ${response.status}`
  ).toBe(true);
  
  return { isRateLimited: false, status: response.status };
}

export async function waitForServer(maxAttempts = 15): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE}/version`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok || response.status === 429) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
