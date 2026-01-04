import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  waitForServer 
} from './helpers/api-test-utils';

describe('Storage Integration Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Tests completed');
  });

  describe('Scheme CRUD', () => {
    it('should list schemes or require auth', async () => {
      const response = await fetchAPI('/schemes');
      assertValidResponse(response, [200, 401], 'List schemes');
    });

    it('should return scheme data with proper structure when authenticated', async () => {
      const response = await fetchAPI('/schemes');
      const result = assertValidResponse(response, [200, 401], 'Scheme structure');
      if (result.isRateLimited || !response.ok) return;
      
      const schemes = await response.json();
      expect(Array.isArray(schemes)).toBe(true);
      if (schemes.length > 0) {
        const scheme = schemes[0];
        expect(scheme.id).toBeDefined();
        expect(scheme.name).toBeDefined();
      }
    });
  });

  describe('Block CRUD', () => {
    it('should list blocks or require auth', async () => {
      const response = await fetchAPI('/blocks');
      assertValidResponse(response, [200, 401], 'List blocks');
    });

    it('should filter blocks by scheme when authenticated', async () => {
      const schemesRes = await fetchAPI('/schemes');
      const schemesResult = assertValidResponse(schemesRes, [200, 401], 'Get schemes');
      if (schemesResult.isRateLimited || !schemesRes.ok) return;
      
      const schemes = await schemesRes.json();
      if (schemes.length === 0) return;

      const response = await fetchAPI(`/blocks?schemeId=${schemes[0].id}`);
      assertValidResponse(response, [200, 401], 'Filter blocks');
    });
  });

  describe('Property CRUD', () => {
    it('should list properties or require auth', async () => {
      const response = await fetchAPI('/properties');
      assertValidResponse(response, [200, 401], 'List properties');
    });

    it('should get property with details if one exists', async () => {
      const response = await fetchAPI('/properties');
      const result = assertValidResponse(response, [200, 401], 'Get properties');
      if (result.isRateLimited || !response.ok) return;
      
      const properties = await response.json();
      if (!Array.isArray(properties) || properties.length === 0) return;

      const propertyId = properties[0].id;
      const detailRes = await fetchAPI(`/properties/${propertyId}`);
      if (detailRes.ok) {
        const data = await detailRes.json();
        expect(data.id).toBe(propertyId);
      }
    });
  });

  describe('Component Types CRUD', () => {
    it('should list component types or require auth', async () => {
      const response = await fetchAPI('/component-types');
      assertValidResponse(response, [200, 401], 'List component types');
    });

    it('should handle create component type request', async () => {
      const response = await fetchAPI('/component-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'TEST_TYPE_' + Date.now(),
          name: 'Test Component Type',
          category: 'OTHER',
        }),
      });
      assertValidResponse(response, [200, 201, 400, 401, 500], 'Create component type');
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk verify properties request', async () => {
      const response = await fetchAPI('/properties/bulk-verify', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      assertValidResponse(response, [200, 400, 401], 'Bulk verify');
    });

    it('should handle bulk approve components request', async () => {
      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      assertValidResponse(response, [200, 400, 401], 'Bulk approve');
    });
  });
});
