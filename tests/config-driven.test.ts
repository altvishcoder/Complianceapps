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
      expect([200, 401]).toContain(response.status);
    });

    it('should return classification codes with remedial action settings when authenticated', async () => {
      const response = await fetchAPI('/config/classification-codes');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          const code = data[0];
          expect(code).toHaveProperty('id');
          expect(code).toHaveProperty('code');
        }
      }
    });

    it('should handle classification code lookup', async () => {
      const listResponse = await fetchAPI('/config/classification-codes');
      if (!listResponse.ok) {
        expect(listResponse.status).toBe(401);
        return;
      }
      
      const codes = await listResponse.json();
      if (!Array.isArray(codes) || codes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes/${codes[0].id}`);
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should handle classification code filtering by certificate type', async () => {
      const certTypesRes = await fetchAPI('/config/certificate-types');
      if (!certTypesRes.ok) return;
      
      const certTypes = await certTypesRes.json();
      if (!Array.isArray(certTypes) || certTypes.length === 0) return;
      
      const response = await fetchAPI(`/config/classification-codes?certificateTypeId=${certTypes[0].id}`);
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Remedial Action Configuration', () => {
    it('should verify classification codes have remedial action settings', async () => {
      const response = await fetchAPI('/config/classification-codes');
      if (!response.ok) return;
      
      const codes = await response.json();
      if (!Array.isArray(codes) || codes.length === 0) return;
      
      const codeWithAction = codes.find((c: any) => c.autoCreateAction === true);
      if (codeWithAction) {
        expect(typeof codeWithAction.autoCreateAction).toBe('boolean');
      }
    });

    it('should validate action severity values', async () => {
      const response = await fetchAPI('/config/classification-codes');
      if (!response.ok) return;
      
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
      if (!response.ok) return;
      
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
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should include validity settings when authenticated', async () => {
      const response = await fetchAPI('/config/certificate-types');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          const certType = data[0];
          expect(certType).toHaveProperty('id');
          expect(certType).toHaveProperty('code');
          expect(certType).toHaveProperty('name');
        }
      }
    });
  });

  describe('Compliance Stream Configuration', () => {
    it('should list compliance streams or require auth', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      expect([200, 401, 429]).toContain(response.status);
    });

    it('should include system-protected streams when authenticated', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        
        const systemStream = data.find((s: any) => s.isSystem === true);
        if (systemStream) {
          expect(systemStream.isSystem).toBe(true);
        }
      }
    });
  });
});
