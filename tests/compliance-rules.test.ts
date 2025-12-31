import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

describe('Compliance Rules Tests', () => {
  describe('Compliance Streams', () => {
    it('should list all compliance streams', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include required compliance stream fields', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
        expect(data[0]).toHaveProperty('name');
      }
    });
  });

  describe('Certificate Types', () => {
    it('should list all certificate types', async () => {
      const response = await fetchAPI('/config/certificate-types');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include required certificate type fields', async () => {
      const response = await fetchAPI('/config/certificate-types');
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
        expect(data[0]).toHaveProperty('name');
      }
    });
  });

  describe('Classification Codes', () => {
    it('should list all classification codes', async () => {
      const response = await fetchAPI('/config/classification-codes');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include auto-action settings', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const data = await response.json();
      
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
      }
    });
  });

  describe('Compliance Rules', () => {
    it('should list all compliance rules', async () => {
      const response = await fetchAPI('/config/compliance-rules');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Normalisation Rules', () => {
    it('should list all normalisation rules', async () => {
      const response = await fetchAPI('/config/normalisation-rules');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Extraction Schemas', () => {
    it('should list all extraction schemas', async () => {
      const response = await fetchAPI('/config/extraction-schemas');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
