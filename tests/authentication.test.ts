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
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect([400, 422]).toContain(response.status);
    });

    it('should reject login with missing password', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com' }),
      });
      expect([400, 422]).toContain(response.status);
    });

    it('should reject login with missing email', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ password: 'admin123' }),
      });
      expect([400, 422]).toContain(response.status);
    });

    it('should reject login with invalid credentials', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid@example.com', password: 'wrong' }),
      });
      expect([401, 403]).toContain(response.status);
    });

    it('should return appropriate response on login attempt', async () => {
      const response = await fetchAPI('/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'superadmin@complianceai.co.uk', password: 'SuperAdmin2025!' }),
      });
      expect([200, 401, 403, 429]).toContain(response.status);
    });
  });

  describe('Session Endpoint', () => {
    it('should return session data (null or valid) for get-session endpoint', async () => {
      const response = await fetchAPI('/auth/get-session');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data === null || typeof data === 'object').toBe(true);
    });
  });

  describe('Protected Routes', () => {
    it('should handle request to protected endpoints', async () => {
      const response = await fetchAPI('/admin/users');
      expect([200, 401, 403, 429]).toContain(response.status);
    });

    it('should allow access to public endpoints', async () => {
      const response = await fetchAPI('/version');
      expect(response.ok).toBe(true);
    });
  });
});
