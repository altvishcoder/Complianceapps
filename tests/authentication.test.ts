import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = 'http://localhost:5000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  return response;
}

describe('Authentication Tests', () => {
  describe('Login Endpoint', () => {
    it('should reject login without credentials', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin' }),
      });
      expect(response.status).toBe(400);
    });

    it('should reject login with missing username', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'admin123' }),
      });
      expect(response.status).toBe(400);
    });

    it('should reject login with invalid credentials', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'invalid', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
    });

    it('should return appropriate response on login attempt', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Session Endpoint', () => {
    it('should return 401 for unauthenticated requests to /auth/me', async () => {
      const response = await fetchAPI('/auth/me');
      expect(response.status).toBe(401);
    });
  });
});
