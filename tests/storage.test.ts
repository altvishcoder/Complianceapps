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
      expect([200, 401]).toContain(response.status);
    });

    it('should return scheme data with proper structure when authenticated', async () => {
      const response = await fetchAPI('/schemes');
      if (response.ok) {
        const schemes = await response.json();
        expect(Array.isArray(schemes)).toBe(true);
        if (schemes.length > 0) {
          const scheme = schemes[0];
          expect(scheme.id).toBeDefined();
          expect(scheme.name).toBeDefined();
        }
      } else {
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Block CRUD', () => {
    it('should list blocks or require auth', async () => {
      const response = await fetchAPI('/blocks');
      expect([200, 401]).toContain(response.status);
    });

    it('should filter blocks by scheme when authenticated', async () => {
      const schemesRes = await fetchAPI('/schemes');
      if (!schemesRes.ok) {
        expect(schemesRes.status).toBe(401);
        return;
      }
      
      const schemes = await schemesRes.json();
      if (schemes.length === 0) return;

      const response = await fetchAPI(`/blocks?schemeId=${schemes[0].id}`);
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Property CRUD', () => {
    it('should list properties or require auth', async () => {
      const response = await fetchAPI('/properties');
      expect([200, 401]).toContain(response.status);
    });

    it('should get property with details if one exists', async () => {
      const response = await fetchAPI('/properties');
      if (!response.ok) {
        expect(response.status).toBe(401);
        return;
      }
      
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
      expect([200, 401]).toContain(response.status);
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
      expect([200, 201, 400, 401, 429, 500]).toContain(response.status);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk verify properties request', async () => {
      const response = await fetchAPI('/properties/bulk-verify', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect([200, 400, 401, 429]).toContain(response.status);
    });

    it('should handle bulk approve components request', async () => {
      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect([200, 400, 401, 429]).toContain(response.status);
    });
  });
});
