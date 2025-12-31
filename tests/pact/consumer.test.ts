import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'ComplianceAI-Frontend',
  provider: 'ComplianceAI-API',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('ComplianceAI API Consumer Contract Tests', () => {
  describe('Authentication', () => {
    it('returns user on successful login', async () => {
      await provider
        .given('a user exists with username admin')
        .uponReceiving('a request to login')
        .withRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            username: 'admin',
            password: 'admin123',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: like('user-id-123'),
            username: like('admin'),
            email: like('admin@example.com'),
            name: like('Admin User'),
            role: like('ADMIN'),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('username');
      });
    });

    it('returns 401 on invalid credentials', async () => {
      await provider
        .given('no matching user exists')
        .uponReceiving('a login request with invalid credentials')
        .withRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            username: 'invalid',
            password: 'wrong',
          },
        })
        .willRespondWith({
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            message: like('Invalid credentials'),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'invalid', password: 'wrong' }),
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Properties', () => {
    it('returns list of properties', async () => {
      await provider
        .given('properties exist in the system')
        .uponReceiving('a request for properties')
        .withRequest({
          method: 'GET',
          path: '/api/properties',
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: eachLike({
            id: like('prop-123'),
            uprn: like('12345678901'),
            addressLine1: like('123 Test Street'),
            city: like('London'),
            postcode: like('SW1A 1AA'),
            propertyType: like('FLAT'),
            complianceStatus: like('COMPLIANT'),
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/properties`);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toHaveProperty('id');
        expect(body[0]).toHaveProperty('uprn');
      });
    });

    it('returns property by id', async () => {
      const propertyId = 'prop-123';
      
      await provider
        .given('a property exists with id prop-123')
        .uponReceiving('a request for a specific property')
        .withRequest({
          method: 'GET',
          path: `/api/properties/${propertyId}`,
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: like(propertyId),
            uprn: like('12345678901'),
            addressLine1: like('123 Test Street'),
            city: like('London'),
            postcode: like('SW1A 1AA'),
            propertyType: like('FLAT'),
            complianceStatus: like('COMPLIANT'),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/properties/${propertyId}`);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('id');
      });
    });
  });

  describe('Certificates', () => {
    it('returns list of certificates', async () => {
      await provider
        .given('certificates exist in the system')
        .uponReceiving('a request for certificates')
        .withRequest({
          method: 'GET',
          path: '/api/certificates',
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: eachLike({
            id: like('cert-123'),
            propertyId: like('prop-123'),
            type: like('GAS_SAFETY'),
            status: like('APPROVED'),
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/certificates`);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      });
    });
  });

  describe('Schemes', () => {
    it('returns list of schemes', async () => {
      await provider
        .given('schemes exist in the system')
        .uponReceiving('a request for schemes')
        .withRequest({
          method: 'GET',
          path: '/api/schemes',
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: eachLike({
            id: like('scheme-123'),
            name: like('Test Scheme'),
            reference: like('SCH001'),
            complianceStatus: like('COMPLIANT'),
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/schemes`);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      });
    });
  });

  describe('Remedial Actions', () => {
    it('returns list of remedial actions', async () => {
      await provider
        .given('remedial actions exist')
        .uponReceiving('a request for remedial actions')
        .withRequest({
          method: 'GET',
          path: '/api/remedial-actions',
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: eachLike({
            id: like('action-123'),
            certificateId: like('cert-123'),
            description: like('Replace boiler'),
            severity: like('URGENT'),
            status: like('OPEN'),
          }),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/remedial-actions`);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      });
    });
  });
});
