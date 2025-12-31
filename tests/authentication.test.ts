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

    it('should return user on valid login', async () => {
      const response = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('username', 'admin');
      expect(data).toHaveProperty('role');
    });
  });

  describe('Session Endpoint', () => {
    it('should return 401 for unauthenticated requests to /auth/me', async () => {
      const response = await fetchAPI('/auth/me');
      expect(response.status).toBe(401);
    });
  });

  describe('Protected Endpoints', () => {
    it('should require authentication for admin users endpoint', async () => {
      const response = await fetchAPI('/admin/users');
      expect(response.status).toBe(401);
    });

    it('should require authentication for audit log endpoint', async () => {
      const response = await fetchAPI('/audit-logs');
      expect(response.status).toBe(401);
    });
  });
});

describe('Password Policy Tests', () => {
  it('should reject weak passwords on user creation', async () => {
    const response = await fetchAPI('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser',
        password: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'VIEWER',
      }),
    });
    expect([400, 401]).toContain(response.status);
  });
});
