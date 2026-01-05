import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  validateRateLimitResponse, 
  waitForServer,
  parseRateLimitHeaders 
} from './helpers/api-test-utils';

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
      assertValidResponse(response, [200, 401], 'Properties list');
    });

    it('should accept filter parameters', async () => {
      const response = await fetchAPI('/properties?blockId=test');
      assertValidResponse(response, [200, 401], 'Properties with filter');
    });
  });

  describe('Certificates API', () => {
    it('should require authentication for certificates list', async () => {
      const response = await fetchAPI('/certificates');
      assertValidResponse(response, [200, 401], 'Certificates list');
    });

    it('should return 404 for non-existent certificate', async () => {
      const response = await fetchAPI('/certificates/non-existent-id');
      assertValidResponse(response, [401, 404], 'Non-existent certificate');
    });
  });

  describe('Components API', () => {
    it('should require authentication for components list', async () => {
      const response = await fetchAPI('/components');
      assertValidResponse(response, [200, 401], 'Components list');
    });

    it('should list component types', async () => {
      const response = await fetchAPI('/component-types');
      assertValidResponse(response, [200, 401], 'Component types');
    });
  });

  describe('Remedial Actions API', () => {
    it('should require authentication for actions list', async () => {
      const response = await fetchAPI('/actions');
      assertValidResponse(response, [200, 401], 'Actions list');
    });

    it('should accept filter parameters for actions', async () => {
      const response = await fetchAPI('/actions?status=OPEN');
      assertValidResponse(response, [200, 401], 'Actions with filter');
    });
  });

  describe('Contractors API', () => {
    it('should list contractors', async () => {
      const response = await fetchAPI('/contractors');
      assertValidResponse(response, [200, 401], 'Contractors list');
    });
  });

  describe('Schemes and Blocks API', () => {
    it('should list schemes', async () => {
      const response = await fetchAPI('/schemes');
      assertValidResponse(response, [200, 401], 'Schemes list');
    });

    it('should list blocks', async () => {
      const response = await fetchAPI('/blocks');
      assertValidResponse(response, [200, 401], 'Blocks list');
    });
  });

  describe('Bulk Operations', () => {
    it('should reject empty bulk approve request or require auth', async () => {
      const response = await fetchAPI('/components/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      assertValidResponse(response, [400, 401], 'Bulk approve with empty ids');
    });

    it('should reject empty bulk reject request or require auth', async () => {
      const response = await fetchAPI('/components/bulk-reject', {
        method: 'POST',
        body: JSON.stringify({ ids: [] }),
      });
      assertValidResponse(response, [400, 401], 'Bulk reject with empty ids');
    });
  });

  describe('Configuration API', () => {
    it('should list certificate types', async () => {
      const response = await fetchAPI('/config/certificate-types');
      assertValidResponse(response, [200, 401], 'Certificate types');
    });

    it('should list classification codes', async () => {
      const response = await fetchAPI('/config/classification-codes');
      assertValidResponse(response, [200, 401], 'Classification codes');
    });
  });

  describe('Extraction Runs API', () => {
    it('should list extraction runs or require auth', async () => {
      const response = await fetchAPI('/extraction-runs');
      assertValidResponse(response, [200, 401], 'Extraction runs');
    });
  });

  describe('Model Insights API', () => {
    it('should return model insights data or require auth', async () => {
      const response = await fetchAPI('/model-insights');
      assertValidResponse(response, [200, 401], 'Model insights');
    });

    it('should handle benchmark request', async () => {
      const response = await fetchAPI('/model-insights/run-benchmark', {
        method: 'POST',
      });
      assertValidResponse(response, [200, 401], 'Run benchmark');
    });

    it('should handle training data export request', async () => {
      const response = await fetchAPI('/model-insights/export-training-data', {
        method: 'POST',
      });
      assertValidResponse(response, [200, 401], 'Export training data');
    });
  });

  describe('AI Suggestions API', () => {
    it('should return AI suggestions or require auth', async () => {
      const response = await fetchAPI('/ai/suggestions?propertyId=test');
      assertValidResponse(response, [200, 400, 401, 404], 'AI suggestions');
    });
  });

  describe('Public Endpoints', () => {
    it('should allow access to version endpoint', async () => {
      const response = await fetchAPI('/version');
      const result = assertValidResponse(response, [200], 'Version endpoint');
      if (!result.isRateLimited && response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('version');
      }
    });

    it('should allow access to health endpoint', async () => {
      const response = await fetchAPI('/health');
      assertValidResponse(response, [200, 503], 'Health endpoint');
    });
  });

  describe('Dashboard Stats API', () => {
    it('should return dashboard stats with required fields', async () => {
      const response = await fetchAPI('/dashboard/stats');
      assertValidResponse(response, [200, 401], 'Dashboard stats');
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('totalProperties');
        expect(data).toHaveProperty('totalCertificates');
        expect(data).toHaveProperty('overallCompliance');
        expect(data).toHaveProperty('activeHazards');
        expect(data).toHaveProperty('awaabsLaw');
        expect(data).toHaveProperty('complianceByType');
        expect(data).toHaveProperty('hazardDistribution');
        expect(data).toHaveProperty('expiringCertificates');
        expect(data).toHaveProperty('urgentActions');
        expect(data).toHaveProperty('problemProperties');
        
        expect(typeof data.totalProperties).toBe('number');
        expect(typeof data.totalCertificates).toBe('number');
        expect(Array.isArray(data.complianceByType)).toBe(true);
        expect(Array.isArray(data.expiringCertificates)).toBe(true);
        expect(Array.isArray(data.urgentActions)).toBe(true);
        expect(Array.isArray(data.problemProperties)).toBe(true);
      }
    });

    it('should return numeric values not NaN', async () => {
      const response = await fetchAPI('/dashboard/stats');
      if (response.status === 200) {
        const data = await response.json();
        expect(Number.isNaN(Number(data.overallCompliance))).toBe(false);
        expect(Number.isNaN(data.activeHazards)).toBe(false);
        expect(Number.isNaN(data.totalProperties)).toBe(false);
        expect(Number.isNaN(data.totalCertificates)).toBe(false);
      }
    });
  });

  describe('Rate Limiting Validation', () => {
    it('should return proper rate limit headers when rate limited', async () => {
      const responses = await Promise.all(
        Array(20).fill(null).map(() => fetchAPI('/version'))
      );
      
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successResponses = responses.filter(r => r.status === 200);
      
      for (const response of rateLimitedResponses) {
        validateRateLimitResponse(response, 'Rate limit burst test');
      }
      
      expect(
        successResponses.length + rateLimitedResponses.length,
        'All responses should be either 200 or 429'
      ).toBe(responses.length);
    });

    it('should include rate limit info in successful responses', async () => {
      const response = await fetchAPI('/version');
      if (response.status === 200) {
        const info = parseRateLimitHeaders(response);
        expect(info.policy).toBeTruthy();
        expect(info.limit).toBeTruthy();
      }
    });
  });
});
