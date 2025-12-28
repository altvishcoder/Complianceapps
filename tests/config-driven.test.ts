import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

describe('Configuration-Driven Remedial Action Tests', () => {
  let testCertificateTypeId: string;
  let testClassificationCodes: { id: string; code: string }[] = [];

  beforeAll(async () => {
    const certTypeRes = await fetchAPI('/config/certificate-types', {
      method: 'POST',
      body: JSON.stringify({
        code: 'TEST_TYPE_' + Date.now(),
        name: 'Test Certificate Type',
        shortName: 'Test',
        complianceStream: 'OTHER',
        validityMonths: 12,
        warningDays: 30,
      }),
    });
    
    if (certTypeRes.ok) {
      const certType = await certTypeRes.json();
      testCertificateTypeId = certType.id;
      
      const c1Res = await fetchAPI('/config/classification-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: 'C1',
          name: 'Danger Present',
          certificateTypeId: testCertificateTypeId,
          severity: 'CRITICAL',
          description: 'Danger present - immediate action required',
          actionRequired: 'Isolate and repair immediately',
          timeframeHours: 24,
          autoCreateAction: true,
          actionSeverity: 'IMMEDIATE',
          costEstimateLow: 15000,
          costEstimateHigh: 40000,
        }),
      });
      if (c1Res.ok) {
        const c1 = await c1Res.json();
        testClassificationCodes.push({ id: c1.id, code: 'C1' });
      }
      
      const c2Res = await fetchAPI('/config/classification-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: 'C2',
          name: 'Potentially Dangerous',
          certificateTypeId: testCertificateTypeId,
          severity: 'HIGH',
          description: 'Potentially dangerous - urgent action required',
          actionRequired: 'Schedule repair within 28 days',
          timeframeHours: 672,
          autoCreateAction: true,
          actionSeverity: 'URGENT',
          costEstimateLow: 8000,
          costEstimateHigh: 25000,
        }),
      });
      if (c2Res.ok) {
        const c2 = await c2Res.json();
        testClassificationCodes.push({ id: c2.id, code: 'C2' });
      }
      
      const c3Res = await fetchAPI('/config/classification-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: 'C3',
          name: 'Improvement Recommended',
          certificateTypeId: testCertificateTypeId,
          severity: 'LOW',
          description: 'Improvement recommended - no immediate action',
          actionRequired: 'Consider improvement during next inspection',
          timeframeHours: null,
          autoCreateAction: false,
          actionSeverity: 'ADVISORY',
          costEstimateLow: 5000,
          costEstimateHigh: 15000,
        }),
      });
      if (c3Res.ok) {
        const c3 = await c3Res.json();
        testClassificationCodes.push({ id: c3.id, code: 'C3' });
      }
    }
  });

  afterAll(async () => {
    for (const code of testClassificationCodes) {
      await fetchAPI(`/config/classification-codes/${code.id}`, { method: 'DELETE' });
    }
    if (testCertificateTypeId) {
      await fetchAPI(`/config/certificate-types/${testCertificateTypeId}`, { method: 'DELETE' });
    }
  });

  describe('Classification Code Configuration', () => {
    it('should create classification codes with remedial action settings', async () => {
      expect(testClassificationCodes.length).toBeGreaterThan(0);
    });

    it('should retrieve classification codes with new fields', async () => {
      if (testClassificationCodes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes/${testClassificationCodes[0].id}`);
      expect(response.ok).toBe(true);
      const code = await response.json();
      expect(code.autoCreateAction).toBeDefined();
      expect(code.actionSeverity).toBeDefined();
      expect(code.costEstimateLow).toBeDefined();
      expect(code.costEstimateHigh).toBeDefined();
    });

    it('should update classification code remedial action settings', async () => {
      if (testClassificationCodes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes/${testClassificationCodes[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          actionSeverity: 'URGENT',
          costEstimateLow: 20000,
          costEstimateHigh: 50000,
        }),
      });
      expect(response.ok).toBe(true);
      const updated = await response.json();
      expect(updated.actionSeverity).toBe('URGENT');
      expect(updated.costEstimateLow).toBe(20000);
      expect(updated.costEstimateHigh).toBe(50000);
    });

    it('should list classification codes for certificate type', async () => {
      if (!testCertificateTypeId) return;
      
      const response = await fetchAPI(`/config/classification-codes?certificateTypeId=${testCertificateTypeId}`);
      expect(response.ok).toBe(true);
      const codes = await response.json();
      expect(Array.isArray(codes)).toBe(true);
    });
  });

  describe('Remedial Action Configuration', () => {
    it('should have autoCreateAction flag that controls action generation', async () => {
      const c3Code = testClassificationCodes.find(c => c.code === 'C3');
      if (!c3Code) return;
      
      const response = await fetchAPI(`/config/classification-codes/${c3Code.id}`);
      const code = await response.json();
      expect(code.autoCreateAction).toBe(false);
    });

    it('should have severity override in actionSeverity field', async () => {
      const c1Code = testClassificationCodes.find(c => c.code === 'C1');
      if (!c1Code) return;
      
      const response = await fetchAPI(`/config/classification-codes/${c1Code.id}`);
      const code = await response.json();
      expect(['IMMEDIATE', 'URGENT', 'ROUTINE', 'ADVISORY']).toContain(code.actionSeverity);
    });

    it('should have cost estimate range in pence', async () => {
      const c2Code = testClassificationCodes.find(c => c.code === 'C2');
      if (!c2Code) return;
      
      const response = await fetchAPI(`/config/classification-codes/${c2Code.id}`);
      const code = await response.json();
      expect(typeof code.costEstimateLow).toBe('number');
      expect(typeof code.costEstimateHigh).toBe('number');
      expect(code.costEstimateLow).toBeLessThan(code.costEstimateHigh);
    });
  });
});
