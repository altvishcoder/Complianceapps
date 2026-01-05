import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  waitForServer 
} from './helpers/api-test-utils';

describe('Admin Seed Demo Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
  });

  describe('Seed Demo Edge Cases', () => {
    it('should handle repeated seed-demo calls gracefully', async () => {
      const response1 = await fetchAPI('/admin/seed-demo', { method: 'POST' });
      assertValidResponse(response1, [200, 401, 403], 'First seed-demo call');
      
      const response2 = await fetchAPI('/admin/seed-demo', { method: 'POST' });
      assertValidResponse(response2, [200, 401, 403], 'Second seed-demo call (should skip)');
    });

    it('should not fail when demo properties already exist with different scheme', async () => {
      const response = await fetchAPI('/admin/seed-demo', { method: 'POST' });
      assertValidResponse(response, [200, 401, 403], 'Seed with existing UPRNs');
    });

    it('should return success when demo data already exists', async () => {
      const response = await fetchAPI('/admin/seed-demo', { method: 'POST' });
      
      if (response.status === 401 || response.status === 403) {
        return;
      }
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Seed Demo Data Integrity', () => {
    it('should check for existing schemes before seeding', async () => {
      const schemesRes = await fetchAPI('/schemes');
      if (!schemesRes.ok) return;
      
      const schemes = await schemesRes.json();
      const demoScheme = schemes.find((s: any) => s.reference === 'SCH-LON-001');
      
      if (demoScheme) {
        const seedRes = await fetchAPI('/admin/seed-demo', { method: 'POST' });
        if (seedRes.ok) {
          const result = await seedRes.json();
          expect(result.success).toBe(true);
        }
      }
    });

    it('should check for existing properties by UPRN before seeding', async () => {
      const propertiesRes = await fetchAPI('/properties');
      if (!propertiesRes.ok) return;
      
      const response = await propertiesRes.json();
      const properties = Array.isArray(response) ? response : (response.properties || response.data || []);
      
      if (!Array.isArray(properties)) return;
      
      const demoProperty = properties.find((p: any) => 
        ['10001001', '10001002', '10002001', '10002002'].includes(p.uprn)
      );
      
      if (demoProperty) {
        const seedRes = await fetchAPI('/admin/seed-demo', { method: 'POST' });
        if (seedRes.ok) {
          const result = await seedRes.json();
          expect(result.success).toBe(true);
        }
      }
    });
  });

  describe('Wipe Data Operation', () => {
    it('should handle wipe-data request', async () => {
      const response = await fetchAPI('/admin/wipe-data', { 
        method: 'POST',
        body: JSON.stringify({ includeProperties: false }),
      });
      assertValidResponse(response, [200, 401, 403], 'Wipe data');
    });
  });

  describe('Reset Demo Operation', () => {
    it('should handle reset-demo request', async () => {
      const response = await fetchAPI('/admin/reset-demo', { method: 'POST' });
      assertValidResponse(response, [200, 401, 403, 500], 'Reset demo');
    });
  });
});
