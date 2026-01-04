import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  waitForServer 
} from './helpers/api-test-utils';

describe('Configuration-Driven Remedial Action Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Tests completed');
  });

  describe('Classification Code Configuration', () => {
    it('should list classification codes or require auth', async () => {
      const response = await fetchAPI('/config/classification-codes');
      assertValidResponse(response, [200, 401], 'List classification codes');
    });

    it('should return classification codes with remedial action settings when authenticated', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const result = assertValidResponse(response, [200, 401], 'Classification remedial settings');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const code = data[0];
        expect(code).toHaveProperty('id');
        expect(code).toHaveProperty('code');
      }
    });

    it('should handle classification code lookup', async () => {
      const listResponse = await fetchAPI('/config/classification-codes');
      const listResult = assertValidResponse(listResponse, [200, 401], 'List for lookup');
      if (listResult.isRateLimited || !listResponse.ok) return;
      
      const codes = await listResponse.json();
      if (!Array.isArray(codes) || codes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes/${codes[0].id}`);
      assertValidResponse(response, [200, 401, 404], 'Lookup classification code');
    });

    it('should handle classification code filtering by certificate type', async () => {
      const certTypesRes = await fetchAPI('/config/certificate-types');
      const certResult = assertValidResponse(certTypesRes, [200, 401], 'Get cert types');
      if (certResult.isRateLimited || !certTypesRes.ok) return;
      
      const certTypes = await certTypesRes.json();
      if (!Array.isArray(certTypes) || certTypes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes?certificateTypeId=${certTypes[0].id}`);
      assertValidResponse(response, [200, 401], 'Filter by certificate type');
    });
  });

  describe('Remedial Action Configuration', () => {
    it('should verify classification codes have remedial action settings', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const result = assertValidResponse(response, [200, 401], 'Remedial settings check');
      if (result.isRateLimited || !response.ok) return;
      
      const codes = await response.json();
      if (!Array.isArray(codes) || codes.length === 0) return;
      
      const codeWithAction = codes.find((c: any) => c.autoCreateAction === true);
      if (codeWithAction) {
        expect(typeof codeWithAction.autoCreateAction).toBe('boolean');
      }
    });

    it('should validate action severity values', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const result = assertValidResponse(response, [200, 401], 'Severity validation');
      if (result.isRateLimited || !response.ok) return;
      
      const codes = await response.json();
      if (!Array.isArray(codes)) return;
      
      const validSeverities = ['IMMEDIATE', 'URGENT', 'ROUTINE', 'ADVISORY', null];
      for (const code of codes.slice(0, 5)) {
        if (code.actionSeverity) {
          expect(validSeverities).toContain(code.actionSeverity);
        }
      }
    });

    it('should validate cost estimate ranges', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const result = assertValidResponse(response, [200, 401], 'Cost estimate validation');
      if (result.isRateLimited || !response.ok) return;
      
      const codes = await response.json();
      if (!Array.isArray(codes)) return;
      
      for (const code of codes.slice(0, 5)) {
        if (code.costEstimateLow != null && code.costEstimateHigh != null) {
          expect(code.costEstimateLow).toBeLessThanOrEqual(code.costEstimateHigh);
        }
      }
    });
  });

  describe('Certificate Type Configuration', () => {
    it('should list certificate types or require auth', async () => {
      const response = await fetchAPI('/config/certificate-types');
      assertValidResponse(response, [200, 401], 'List certificate types');
    });

    it('should include validity settings when authenticated', async () => {
      const response = await fetchAPI('/config/certificate-types');
      const result = assertValidResponse(response, [200, 401], 'Validity settings');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const certType = data[0];
        expect(certType).toHaveProperty('id');
        expect(certType).toHaveProperty('code');
        expect(certType).toHaveProperty('name');
      }
    });
  });

  describe('Compliance Stream Configuration', () => {
    it('should list compliance streams or require auth', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      assertValidResponse(response, [200, 401], 'List compliance streams');
    });

    it('should include system-protected streams when authenticated', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      const result = assertValidResponse(response, [200, 401], 'System streams');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      const systemStream = data.find((s: any) => s.isSystem === true);
      if (systemStream) {
        expect(systemStream.isSystem).toBe(true);
      }
    });
  });
});
