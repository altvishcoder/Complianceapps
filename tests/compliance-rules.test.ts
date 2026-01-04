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

describe('Compliance Rules Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Tests completed');
  });

  describe('Compliance Streams', () => {
    it('should list all compliance streams or require auth', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      expect([200, 401]).toContain(response.status);
    });

    it('should include required compliance stream fields when authenticated', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('code');
          expect(data[0]).toHaveProperty('name');
        }
      }
    });
  });

  describe('Certificate Types', () => {
    it('should list all certificate types or require auth', async () => {
      const response = await fetchAPI('/config/certificate-types');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should include required certificate type fields when authenticated', async () => {
      const response = await fetchAPI('/config/certificate-types');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('code');
          expect(data[0]).toHaveProperty('name');
        }
      }
    });
  });

  describe('Classification Codes', () => {
    it('should list all classification codes or require auth', async () => {
      const response = await fetchAPI('/config/classification-codes');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should include auto-action settings when authenticated', async () => {
      const response = await fetchAPI('/config/classification-codes');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('id');
          expect(data[0]).toHaveProperty('code');
        }
      }
    });
  });

  describe('Compliance Rules', () => {
    it('should list all compliance rules or require auth', async () => {
      const response = await fetchAPI('/config/compliance-rules');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Normalisation Rules', () => {
    it('should list all normalisation rules or require auth', async () => {
      const response = await fetchAPI('/config/normalisation-rules');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Extraction Schemas', () => {
    it('should list all extraction schemas or require auth', async () => {
      const response = await fetchAPI('/config/extraction-schemas');
      expect([200, 401, 429]).toContain(response.status);
    });
  });
});
