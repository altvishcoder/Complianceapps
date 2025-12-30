import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

describe('API Integration Tests', () => {
  describe('Properties API', () => {
    it('should list properties', async () => {
      const response = await fetchAPI('/properties');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter properties by block', async () => {
      const response = await fetchAPI('/properties?blockId=test');
      expect(response.ok).toBe(true);
    });
  });

  describe('Certificates API', () => {
    it('should list certificates', async () => {
      const response = await fetchAPI('/certificates');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return 404 for non-existent certificate', async () => {
      const response = await fetchAPI('/certificates/non-existent-id');
      expect(response.status).toBe(404);
    });
  });

  describe('Components API', () => {
    it('should list components', async () => {
      const response = await fetchAPI('/components');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should list component types', async () => {
      const response = await fetchAPI('/component-types');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Remedial Actions API', () => {
    it('should list actions', async () => {
      const response = await fetchAPI('/actions');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter actions by status', async () => {
      const response = await fetchAPI('/actions?status=OPEN');
      expect(response.ok).toBe(true);
    });
  });

  describe('Contractors API', () => {
    it('should list contractors', async () => {
      const response = await fetchAPI('/contractors');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Schemes and Blocks API', () => {
    it('should list schemes', async () => {
      const response = await fetchAPI('/schemes');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should list blocks', async () => {
      const response = await fetchAPI('/blocks');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should reject empty bulk approve request', async () => {
      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect(response.status).toBe(400);
    });

    it('should reject empty bulk reject request', async () => {
      const response = await fetchAPI('/components/bulk-reject', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe('Configuration API', () => {
    it('should list certificate types', async () => {
      const response = await fetchAPI('/config/certificate-types');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should list classification codes', async () => {
      const response = await fetchAPI('/config/classification-codes');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Extraction Runs API', () => {
    it('should list extraction runs', async () => {
      const response = await fetchAPI('/extraction-runs');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Model Insights API', () => {
    it('should return model insights data', async () => {
      const response = await fetchAPI('/model-insights');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('accuracy');
      expect(data).toHaveProperty('extractionStats');
    });

    it('should run benchmark and return score', async () => {
      const response = await fetchAPI('/model-insights/run-benchmark', {
        method: 'POST',
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('score');
      expect(data).toHaveProperty('passed');
      expect(data).toHaveProperty('date');
    });

    it('should export training data as JSONL with valid structure', async () => {
      const response = await fetchAPI('/model-insights/export-training-data', {
        method: 'POST',
      });
      expect(response.ok).toBe(true);
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/jsonl');
      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toContain('training-data.jsonl');
      
      const body = await response.text();
      if (body.trim().length > 0) {
        const lines = body.trim().split('\n');
        for (const line of lines) {
          const parsed = JSON.parse(line);
          expect(parsed).toHaveProperty('source');
          expect(parsed).toHaveProperty('input');
          expect(parsed.input).toHaveProperty('documentType');
          expect(parsed.input).toHaveProperty('certificateType');
          expect(parsed).toHaveProperty('output');
          expect(parsed).toHaveProperty('metadata');
        }
      }
    });

    it('should return AI suggestions', async () => {
      const response = await fetchAPI('/model-insights/ai-suggestions');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('suggestions');
    });
  });
});
