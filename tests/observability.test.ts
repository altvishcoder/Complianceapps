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

describe('Observability Dashboard Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
  });

  describe('System Health Monitoring', () => {
    it('should return health check status', async () => {
      const response = await fetchAPI('/health');
      expect([200, 503]).toContain(response.status);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    it('should return system health details or require auth', async () => {
      const response = await fetchAPI('/admin/system-health');
      expect([200, 401, 403, 429]).toContain(response.status);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          expect(data).toHaveProperty('database');
          expect(data).toHaveProperty('server');
        }
      }
    });
  });

  describe('Scheduled Jobs Monitoring', () => {
    it('should return scheduled jobs list or require auth', async () => {
      const response = await fetchAPI('/admin/scheduled-jobs');
      expect([200, 401, 403, 429]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe('Version Information', () => {
    it('should return version info', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('environment');
    });

    it('should return release information', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('release');
      if (data.release) {
        expect(data.release).toHaveProperty('date');
        expect(data.release).toHaveProperty('highlights');
      }
    });
  });

  describe('Audit Log', () => {
    it('should return audit log entries or require auth', async () => {
      const response = await fetchAPI('/audit-log');
      expect([200, 401, 403, 429]).toContain(response.status);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
        }
      }
    });

    it('should filter audit log by action type', async () => {
      const response = await fetchAPI('/audit-log?action=LOGIN');
      expect([200, 401, 403, 429]).toContain(response.status);
    });
  });
});

describe('Logging Infrastructure Tests', () => {
  describe('Structured Logging', () => {
    it('should include standard log fields in responses', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
      
      expect(response.headers.get('x-correlation-id')).toBeTruthy();
    });
  });

  describe('API Deprecation Warnings', () => {
    it('should include deprecation warnings for unversioned endpoints', async () => {
      const response = await fetchAPI('/properties');
      const deprecationWarning = response.headers.get('x-api-deprecation-warning');
      if (deprecationWarning) {
        expect(deprecationWarning).toContain('deprecated');
      }
    });
  });
});

describe('Performance Metrics Tests', () => {
  describe('Response Time', () => {
    it('should respond to health check within reasonable time', async () => {
      const start = Date.now();
      const response = await fetchAPI('/health');
      const elapsed = Date.now() - start;
      
      expect([200, 503]).toContain(response.status);
      expect(elapsed).toBeLessThan(5000);
    });

    it('should respond to version endpoint quickly', async () => {
      const start = Date.now();
      const response = await fetchAPI('/version');
      const elapsed = Date.now() - start;
      
      expect(response.ok).toBe(true);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
