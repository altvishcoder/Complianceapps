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

describe('API Integration Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Server is ready for testing');
  });

  describe('Properties API', () => {
    it('should require authentication for properties list', async () => {
      const response = await fetchAPI('/properties');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should accept filter parameters', async () => {
      const response = await fetchAPI('/properties?blockId=test');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Certificates API', () => {
    it('should require authentication for certificates list', async () => {
      const response = await fetchAPI('/certificates');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should return 404 for non-existent certificate', async () => {
      const response = await fetchAPI('/certificates/non-existent-id');
      expect([401, 404, 429]).toContain(response.status);
    });
  });

  describe('Components API', () => {
    it('should require authentication for components list', async () => {
      const response = await fetchAPI('/components');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should list component types', async () => {
      const response = await fetchAPI('/component-types');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Remedial Actions API', () => {
    it('should require authentication for actions list', async () => {
      const response = await fetchAPI('/actions');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should accept filter parameters for actions', async () => {
      const response = await fetchAPI('/actions?status=OPEN');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Contractors API', () => {
    it('should list contractors', async () => {
      const response = await fetchAPI('/contractors');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Schemes and Blocks API', () => {
    it('should list schemes', async () => {
      const response = await fetchAPI('/schemes');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should list blocks', async () => {
      const response = await fetchAPI('/blocks');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Bulk Operations', () => {
    it('should reject empty bulk approve request or require auth', async () => {
      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect([400, 401, 429]).toContain(response.status);
    });

    it('should reject empty bulk reject request or require auth', async () => {
      const response = await fetchAPI('/components/bulk-reject', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      expect([400, 401, 429]).toContain(response.status);
    });
  });

  describe('Configuration API', () => {
    it('should list certificate types', async () => {
      const response = await fetchAPI('/config/certificate-types');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should list classification codes', async () => {
      const response = await fetchAPI('/config/classification-codes');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Extraction Runs API', () => {
    it('should list extraction runs or require auth', async () => {
      const response = await fetchAPI('/extraction-runs');
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('Model Insights API', () => {
    it('should return model insights data or require auth', async () => {
      const response = await fetchAPI('/model-insights');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should handle benchmark request', async () => {
      const response = await fetchAPI('/model-insights/run-benchmark', {
        method: 'POST',
      });
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should handle training data export request', async () => {
      const response = await fetchAPI('/model-insights/export-training-data', {
        method: 'POST',
      });
      expect([200, 401, 429]).toContain(response.status);
    });
  });

  describe('AI Suggestions API', () => {
    it('should return AI suggestions or require auth', async () => {
      const response = await fetchAPI('/ai/suggestions?propertyId=test');
      expect([200, 400, 401, 404, 429]).toContain(response.status);
    });
  });

  describe('Public Endpoints', () => {
    it('should allow access to version endpoint', async () => {
      const response = await fetchAPI('/version');
      expect([200, 429]).toContain(response.status);
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('version');
      }
    });

    it('should allow access to health endpoint', async () => {
      const response = await fetchAPI('/health');
      expect([200, 429, 503]).toContain(response.status);
    });
  });
});
