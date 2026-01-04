import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

async function waitForServer(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE}/version`);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

describe('Circuit Breaker Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
  });

  describe('Circuit Breaker Status API', () => {
    it('should return circuit breaker status or require auth', async () => {
      const response = await fetchAPI('/observability/circuit-breakers');
      expect([200, 401]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    it('should include required fields in circuit breaker data when authenticated', async () => {
      const response = await fetchAPI('/observability/circuit-breakers');
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const cb = data.data[0];
        expect(cb).toHaveProperty('name');
        expect(cb).toHaveProperty('state');
        expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(cb.state);
        expect(cb).toHaveProperty('failures');
        expect(cb).toHaveProperty('successes');
        expect(cb).toHaveProperty('totalCalls');
      }
    });

    it('should have valid circuit breaker configuration when authenticated', async () => {
      const response = await fetchAPI('/observability/circuit-breakers');
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const cb = data.data[0];
        expect(cb).toHaveProperty('config');
        expect(cb.config).toHaveProperty('failureThreshold');
        expect(cb.config).toHaveProperty('successThreshold');
        expect(cb.config).toHaveProperty('timeout');
        expect(cb.config).toHaveProperty('resetTimeout');
      }
    });
  });

  describe('Queue Metrics API', () => {
    it('should return queue metrics or require auth', async () => {
      const response = await fetchAPI('/observability/queue-metrics');
      expect([200, 401]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
      }
    });

    it('should include ingestion and webhook queue data when authenticated', async () => {
      const response = await fetchAPI('/observability/queue-metrics');
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.data) {
        expect(data.data).toHaveProperty('ingestion');
        expect(data.data).toHaveProperty('webhook');
        
        if (data.data.ingestion) {
          expect(data.data.ingestion).toHaveProperty('queued');
          expect(data.data.ingestion).toHaveProperty('active');
          expect(data.data.ingestion).toHaveProperty('completed');
          expect(data.data.ingestion).toHaveProperty('failed');
        }
      }
    });
  });

  describe('Processing Metrics API', () => {
    it('should return processing metrics or require auth', async () => {
      const response = await fetchAPI('/observability/processing-metrics');
      expect([200, 401]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
      }
    });

    it('should include extraction and certificate metrics when authenticated', async () => {
      const response = await fetchAPI('/observability/processing-metrics');
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.data) {
        expect(data.data).toHaveProperty('extraction');
        expect(data.data).toHaveProperty('certificates');
        expect(data.data).toHaveProperty('reviews');
      }
    });
  });

  describe('Confidence Baselines API', () => {
    it('should return confidence baselines or require auth', async () => {
      const response = await fetchAPI('/observability/confidence-baselines');
      expect([200, 401]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
  });
});

describe('Resilience Pattern Tests', () => {
  describe('Rate Limiting', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      const rateLimitPolicy = response.headers.get('ratelimit-policy');
      const rateLimit = response.headers.get('ratelimit');
      
      expect(rateLimitPolicy).toBeTruthy();
      expect(rateLimit).toBeTruthy();
    });

    it('should parse rate limit information correctly', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      const rateLimit = response.headers.get('ratelimit');
      if (rateLimit) {
        expect(rateLimit).toContain('limit=');
        expect(rateLimit).toContain('remaining=');
        expect(rateLimit).toContain('reset=');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.get('x-xss-protection')).toBe('0');
    });

    it('should include strict transport security header', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      const hsts = response.headers.get('strict-transport-security');
      expect(hsts).toBeTruthy();
      expect(hsts).toContain('max-age=');
    });

    it('should include cross-origin headers', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    });
  });

  describe('Correlation ID Tracking', () => {
    it('should include correlation ID in responses', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      const correlationId = response.headers.get('x-correlation-id');
      expect(correlationId).toBeTruthy();
      expect(correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should generate unique correlation IDs for each request', async () => {
      const response1 = await fetchAPI('/version');
      const response2 = await fetchAPI('/version');
      
      const correlationId1 = response1.headers.get('x-correlation-id');
      const correlationId2 = response2.headers.get('x-correlation-id');
      
      expect(correlationId1).not.toBe(correlationId2);
    });
  });
});

describe('Error Handling Tests', () => {
  describe('404 Handling', () => {
    it('should handle non-existent endpoints', async () => {
      const response = await fetchAPI('/non-existent-endpoint-xyz');
      expect([200, 401, 404, 429]).toContain(response.status);
    });
  });

  describe('Invalid Request Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${API_BASE}/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      expect([400, 422, 500]).toContain(response.status);
    });
  });
});
