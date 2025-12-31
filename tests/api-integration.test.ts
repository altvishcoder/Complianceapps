import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

describe('API Integration Tests', () => {
  describe('Authentication Endpoints', () => {
    it('POST /api/auth/login - should return 401 for invalid credentials', async () => {
      const response = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'invalid', password: 'wrong' })
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('POST /api/auth/login - should return user on valid login', async () => {
      const response = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', 'admin');
    });

    it('GET /api/auth/me - should return 401 without session', async () => {
      const response = await request(BASE_URL)
        .get('/api/auth/me')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(401);
    });

    it('POST /api/auth/logout - should logout successfully', async () => {
      const agent = request.agent(BASE_URL);
      
      await agent
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      const response = await agent.post('/api/auth/logout');
      expect(response.status).toBe(200);
    });
  });

  describe('Properties Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/properties - should return properties list', async () => {
      const response = await request(BASE_URL)
        .get('/api/properties')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/properties - should return 401 without auth', async () => {
      const response = await request(BASE_URL)
        .get('/api/properties');
      
      expect(response.status).toBe(401);
    });

    it('GET /api/properties/:id - should return property details', async () => {
      const listResponse = await request(BASE_URL)
        .get('/api/properties')
        .set('Cookie', sessionCookie);
      
      if (listResponse.body.length > 0) {
        const propertyId = listResponse.body[0].id;
        const response = await request(BASE_URL)
          .get(`/api/properties/${propertyId}`)
          .set('Cookie', sessionCookie)
          .expect('Content-Type', /json/);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', propertyId);
      }
    });
  });

  describe('Certificates Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/certificates - should return certificates list', async () => {
      const response = await request(BASE_URL)
        .get('/api/certificates')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/certificates - should filter by type', async () => {
      const response = await request(BASE_URL)
        .get('/api/certificates?type=GAS_SAFETY')
        .set('Cookie', sessionCookie);
      
      expect(response.status).toBe(200);
    });

    it('GET /api/certificates - should filter by status', async () => {
      const response = await request(BASE_URL)
        .get('/api/certificates?status=APPROVED')
        .set('Cookie', sessionCookie);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Schemes Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/schemes - should return schemes list', async () => {
      const response = await request(BASE_URL)
        .get('/api/schemes')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Blocks Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/blocks - should return blocks list', async () => {
      const response = await request(BASE_URL)
        .get('/api/blocks')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Remedial Actions Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/remedial-actions - should return actions list', async () => {
      const response = await request(BASE_URL)
        .get('/api/remedial-actions')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/remedial-actions - should filter by status', async () => {
      const response = await request(BASE_URL)
        .get('/api/remedial-actions?status=OPEN')
        .set('Cookie', sessionCookie);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Dashboard Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/dashboard/stats - should return dashboard stats', async () => {
      const response = await request(BASE_URL)
        .get('/api/dashboard/stats')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Config Endpoints', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      
      sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    });

    it('GET /api/config/compliance-streams - should return compliance streams', async () => {
      const response = await request(BASE_URL)
        .get('/api/config/compliance-streams')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/config/certificate-types - should return certificate types', async () => {
      const response = await request(BASE_URL)
        .get('/api/config/certificate-types')
        .set('Cookie', sessionCookie)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

describe('API Error Handling', () => {
  it('should return 404 for non-existent endpoint', async () => {
    const response = await request(BASE_URL)
      .get('/api/non-existent-endpoint');
    
    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid request body', async () => {
    const response = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ invalid: 'data' })
      .expect('Content-Type', /json/);
    
    expect([400, 401]).toContain(response.status);
  });
});
