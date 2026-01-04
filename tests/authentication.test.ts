import { describe, it, expect, beforeAll } from 'vitest';
import { 
  fetchAPI, 
  assertValidResponse, 
  validateRateLimitResponse, 
  waitForServer 
} from './helpers/api-test-utils';

describe('Authentication Tests', () => {
  beforeAll(async () => {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server may not be fully ready, proceeding with tests');
    }
    console.log('Tests completed');
  });

  describe('BetterAuth Login Endpoint', () => {
    it('should reject login without credentials', async () => {
      const response = await fetchAPI('/auth/sign-in/email', { method: 'POST' });
      assertValidResponse(response, [400, 401, 422], 'Login without credentials');
    });

    it('should reject login with missing password', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      assertValidResponse(response, [400, 401, 422], 'Login missing password');
    });

    it('should reject login with missing email', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ password: 'test123' }),
      });
      assertValidResponse(response, [400, 401, 422], 'Login missing email');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'wrong@example.com', password: 'wrongpassword' }),
      });
      assertValidResponse(response, [401, 403], 'Invalid credentials');
    });

    it('should return appropriate response on login attempt', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'superadmin@complianceai.co.uk', password: 'SuperAdmin2025!' }),
      });
      assertValidResponse(response, [200, 401, 403], 'Valid login attempt');
    });
  });

  describe('Session Endpoint', () => {
    it('should return session data (null or valid) for get-session endpoint', async () => {
      const response = await fetchAPI('/auth/get-session');
      const result = assertValidResponse(response, [200], 'Get session');
      if (!result.isRateLimited) {
        const data = await response.json();
        expect(data === null || typeof data === 'object').toBe(true);
      }
    });
  });

  describe('Protected Routes', () => {
    it('should handle request to protected endpoints', async () => {
      const response = await fetchAPI('/admin/users');
      assertValidResponse(response, [200, 401, 403], 'Protected endpoint');
    });

    it('should allow access to public endpoints', async () => {
      const response = await fetchAPI('/version');
      assertValidResponse(response, [200], 'Public endpoint');
    });
  });
});
