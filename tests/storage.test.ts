import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

describe('Storage Integration Tests', () => {
  describe('Scheme CRUD', () => {
    it('should list schemes', async () => {
      const response = await fetchAPI('/schemes');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return scheme data with proper structure', async () => {
      const response = await fetchAPI('/schemes');
      const schemes = await response.json();
      if (schemes.length === 0) return;
      
      const scheme = schemes[0];
      expect(scheme.id).toBeDefined();
      expect(scheme.name).toBeDefined();
    });
  });

  describe('Block CRUD', () => {
    it('should list blocks', async () => {
      const response = await fetchAPI('/blocks');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter blocks by scheme', async () => {
      const schemesRes = await fetchAPI('/schemes');
      const schemes = await schemesRes.json();
      if (schemes.length === 0) return;

      const response = await fetchAPI(`/blocks?schemeId=${schemes[0].id}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Property CRUD', () => {
    it('should list properties', async () => {
      const response = await fetchAPI('/properties');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should get property with details if one exists', async () => {
      const response = await fetchAPI('/properties');
      const properties = await response.json();
      if (properties.length === 0) return;

      const propertyId = properties[0].id;
      const detailRes = await fetchAPI(`/properties/${propertyId}`);
      expect(detailRes.ok).toBe(true);
      const data = await detailRes.json();
      expect(data.id).toBe(propertyId);
      expect(data.certificates).toBeDefined();
      expect(data.actions).toBeDefined();
      expect(data.components).toBeDefined();
    });
  });

  describe('Component Types CRUD', () => {
    it('should list component types', async () => {
      const response = await fetchAPI('/component-types');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create a component type', async () => {
      const response = await fetchAPI('/component-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'TEST_TYPE_' + Date.now(),
          name: 'Test Component Type',
          category: 'OTHER',
        }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.id).toBeDefined();
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk verify properties', async () => {
      const propsRes = await fetchAPI('/properties');
      const props = await propsRes.json();
      
      if (props.length === 0) return;
      
      const unverifiedProps = props.filter((p: any) => p.needsVerification);
      if (unverifiedProps.length === 0) return;

      const response = await fetchAPI('/properties/bulk-verify', {
        method: 'POST',
        body: JSON.stringify({ ids: [unverifiedProps[0].id] }),
      });
      expect(response.ok).toBe(true);
    });

    it('should bulk approve components', async () => {
      const compsRes = await fetchAPI('/components');
      const comps = await compsRes.json();
      
      if (comps.length === 0) return;
      
      const unverifiedComps = comps.filter((c: any) => c.needsVerification);
      if (unverifiedComps.length === 0) return;

      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [unverifiedComps[0].id] }),
      });
      expect(response.ok).toBe(true);
    });
  });
});
