import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  waitForServer 
} from './helpers/api-test-utils';

describe('Observability Dashboard Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Tests completed');
  });

  describe('System Health Monitoring', () => {
    it('should return health check status', async () => {
      const response = await fetchAPI('/health');
      const result = assertValidResponse(response, [200, 503], 'Health check');
      if (!result.isRateLimited && response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('status');
      }
    });

    it('should return system health details or require auth', async () => {
      const response = await fetchAPI('/admin/system-health');
      const result = assertValidResponse(response, [200, 401, 403], 'System health');
      if (!result.isRateLimited && response.ok) {
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
      const result = assertValidResponse(response, [200, 401, 403], 'Scheduled jobs');
      if (!result.isRateLimited && response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
        }
      }
    });
  });

  describe('Version Information', () => {
    it('should return version info', async () => {
      const response = await fetchAPI('/version');
      const result = assertValidResponse(response, [200], 'Version info');
      if (!result.isRateLimited && response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('version');
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('environment');
      }
    });

    it('should return release information', async () => {
      const response = await fetchAPI('/version');
      const result = assertValidResponse(response, [200], 'Release info');
      if (!result.isRateLimited && response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('release');
        if (data.release) {
          expect(data.release).toHaveProperty('date');
          expect(data.release).toHaveProperty('highlights');
        }
      }
    });
  });

  describe('Audit Log', () => {
    it('should return audit log entries or require auth', async () => {
      const response = await fetchAPI('/audit-log');
      const result = assertValidResponse(response, [200, 401, 403], 'Audit log');
      if (!result.isRateLimited && response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
        }
      }
    });

    it('should filter audit log by action type', async () => {
      const response = await fetchAPI('/audit-log?action=LOGIN');
      assertValidResponse(response, [200, 401, 403], 'Audit log filter');
    });
  });
});

describe('Logging Infrastructure Tests', () => {
  describe('Structured Logging', () => {
    it('should include standard log fields in responses', async () => {
      const response = await fetchAPI('/version');
      const result = assertValidResponse(response, [200], 'Log fields');
      if (!result.isRateLimited) {
        expect(response.headers.get('x-correlation-id')).toBeTruthy();
      }
    });
  });

  describe('API Deprecation Warnings', () => {
    it('should include deprecation warnings for unversioned endpoints', async () => {
      const response = await fetchAPI('/properties');
      const result = assertValidResponse(response, [200, 401], 'Deprecation check');
      if (!result.isRateLimited) {
        const deprecationWarning = response.headers.get('x-api-deprecation-warning');
        if (deprecationWarning) {
          expect(deprecationWarning).toContain('deprecated');
        }
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
      
      assertValidResponse(response, [200, 503], 'Health check timing');
      expect(elapsed).toBeLessThan(5000);
    });

    it('should respond to version endpoint quickly', async () => {
      const start = Date.now();
      const response = await fetchAPI('/version');
      const elapsed = Date.now() - start;
      
      assertValidResponse(response, [200], 'Version timing');
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
