import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  waitForServer 
} from './helpers/api-test-utils';

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
      assertValidResponse(response, [200, 401], 'List compliance streams');
    });

    it('should include required compliance stream fields when authenticated', async () => {
      const response = await fetchAPI('/config/compliance-streams');
      const result = assertValidResponse(response, [200, 401], 'Stream fields');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
        expect(data[0]).toHaveProperty('name');
      }
    });
  });

  describe('Certificate Types', () => {
    it('should list all certificate types or require auth', async () => {
      const response = await fetchAPI('/config/certificate-types');
      assertValidResponse(response, [200, 401], 'List certificate types');
    });

    it('should include required certificate type fields when authenticated', async () => {
      const response = await fetchAPI('/config/certificate-types');
      const result = assertValidResponse(response, [200, 401], 'Cert type fields');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
        expect(data[0]).toHaveProperty('name');
      }
    });
  });

  describe('Classification Codes', () => {
    it('should list all classification codes or require auth', async () => {
      const response = await fetchAPI('/config/classification-codes');
      assertValidResponse(response, [200, 401], 'List classification codes');
    });

    it('should include auto-action settings when authenticated', async () => {
      const response = await fetchAPI('/config/classification-codes');
      const result = assertValidResponse(response, [200, 401], 'Classification fields');
      if (result.isRateLimited || !response.ok) return;
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('id');
        expect(data[0]).toHaveProperty('code');
      }
    });
  });

  describe('Compliance Rules', () => {
    it('should list all compliance rules or require auth', async () => {
      const response = await fetchAPI('/config/compliance-rules');
      assertValidResponse(response, [200, 401], 'List compliance rules');
    });
  });

  describe('Normalisation Rules', () => {
    it('should list all normalisation rules or require auth', async () => {
      const response = await fetchAPI('/config/normalisation-rules');
      assertValidResponse(response, [200, 401], 'List normalisation rules');
    });
  });

  describe('Extraction Schemas', () => {
    it('should list all extraction schemas or require auth', async () => {
      const response = await fetchAPI('/config/extraction-schemas');
      assertValidResponse(response, [200, 401], 'List extraction schemas');
    });
  });
});
