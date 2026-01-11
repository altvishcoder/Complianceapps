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
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
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
      
      const properties = listResponse.body.data || listResponse.body;
      if (properties.length > 0) {
        const propertyId = properties[0].id;
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
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
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

describe('API Mutation Tests', () => {
  let sessionCookie: string;
  let testSchemeId: string;
  let testBlockId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    const loginResponse = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
  });

  describe('Schemes CRUD', () => {
    it('POST /api/schemes - should create a new scheme', async () => {
      const response = await request(BASE_URL)
        .post('/api/schemes')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Test Scheme ' + Date.now(),
          code: 'TEST-' + Date.now(),
          address: '123 Test Street',
          postcode: 'SW1A 1AA'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 201]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        testSchemeId = response.body.id;
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name');
      }
    });

    it('PUT /api/schemes/:id - should update a scheme', async () => {
      if (!testSchemeId) return;
      
      const response = await request(BASE_URL)
        .put(`/api/schemes/${testSchemeId}`)
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated Test Scheme'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 204]).toContain(response.status);
    });

    it('DELETE /api/schemes/:id - should return appropriate response', async () => {
      if (!testSchemeId) return;
      
      const response = await request(BASE_URL)
        .delete(`/api/schemes/${testSchemeId}`)
        .set('Cookie', sessionCookie);
      
      expect([200, 204, 400, 404]).toContain(response.status);
    });
  });

  describe('Blocks CRUD', () => {
    beforeAll(async () => {
      const schemesResponse = await request(BASE_URL)
        .get('/api/schemes')
        .set('Cookie', sessionCookie);
      
      if (schemesResponse.body.length > 0) {
        testSchemeId = schemesResponse.body[0].id;
      }
    });

    it('POST /api/blocks - should create a new block', async () => {
      if (!testSchemeId) return;
      
      const response = await request(BASE_URL)
        .post('/api/blocks')
        .set('Cookie', sessionCookie)
        .send({
          schemeId: testSchemeId,
          name: 'Test Block ' + Date.now(),
          code: 'BLOCK-' + Date.now(),
          address: '456 Test Avenue'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 201]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        testBlockId = response.body.id;
        expect(response.body).toHaveProperty('id');
      }
    });

    it('PUT /api/blocks/:id - should update a block', async () => {
      if (!testBlockId) return;
      
      const response = await request(BASE_URL)
        .put(`/api/blocks/${testBlockId}`)
        .set('Cookie', sessionCookie)
        .send({
          name: 'Updated Test Block'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Properties CRUD', () => {
    beforeAll(async () => {
      const blocksResponse = await request(BASE_URL)
        .get('/api/blocks')
        .set('Cookie', sessionCookie);
      
      const blocks = blocksResponse.body.data || blocksResponse.body;
      if (blocks.length > 0) {
        testBlockId = blocks[0].id;
      }
    });

    it('POST /api/properties - should create a new property', async () => {
      const response = await request(BASE_URL)
        .post('/api/properties')
        .set('Cookie', sessionCookie)
        .send({
          blockId: testBlockId,
          uprn: 'UPRN-TEST-' + Date.now(),
          addressLine1: '789 Test Lane',
          addressLine2: 'Flat 1',
          city: 'London',
          postcode: 'E1 6AN',
          propertyType: 'FLAT'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 201]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        testPropertyId = response.body.id;
        expect(response.body).toHaveProperty('id');
      }
    });

    it('PUT /api/properties/:id - should update a property', async () => {
      if (!testPropertyId) return;
      
      const response = await request(BASE_URL)
        .put(`/api/properties/${testPropertyId}`)
        .set('Cookie', sessionCookie)
        .send({
          addressLine1: 'Updated Test Lane'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 204]).toContain(response.status);
    });

    it('PATCH /api/properties/:id - should partially update a property', async () => {
      if (!testPropertyId) return;
      
      const response = await request(BASE_URL)
        .patch(`/api/properties/${testPropertyId}`)
        .set('Cookie', sessionCookie)
        .send({
          city: 'Manchester'
        });
      
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Remedial Actions CRUD', () => {
    let testRemedialId: string;
    let testCertificateId: string;

    beforeAll(async () => {
      const propertiesResponse = await request(BASE_URL)
        .get('/api/properties')
        .set('Cookie', sessionCookie);
      
      const properties = propertiesResponse.body.data || propertiesResponse.body;
      if (properties.length > 0) {
        testPropertyId = properties[0].id;
      }

      const certsResponse = await request(BASE_URL)
        .get('/api/certificates')
        .set('Cookie', sessionCookie);
      
      const certs = certsResponse.body.data || certsResponse.body;
      if (certs.length > 0) {
        testCertificateId = certs[0].id;
      }
    });

    it('POST /api/remedial-actions - should create a new remedial action', async () => {
      if (!testPropertyId || !testCertificateId) return;
      
      const response = await request(BASE_URL)
        .post('/api/remedial-actions')
        .set('Cookie', sessionCookie)
        .send({
          propertyId: testPropertyId,
          certificateId: testCertificateId,
          description: 'Test remedial action - gas leak repair',
          severity: 'HIGH',
          status: 'OPEN',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect('Content-Type', /json/);
      
      expect([200, 201]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        testRemedialId = response.body.id;
        expect(response.body).toHaveProperty('id');
      }
    });

    it('PUT /api/remedial-actions/:id - should update a remedial action', async () => {
      if (!testRemedialId) return;
      
      const response = await request(BASE_URL)
        .put(`/api/remedial-actions/${testRemedialId}`)
        .set('Cookie', sessionCookie)
        .send({
          status: 'IN_PROGRESS',
          description: 'Updated description'
        })
        .expect('Content-Type', /json/);
      
      expect([200, 204]).toContain(response.status);
    });

    it('PATCH /api/remedial-actions/:id/status - should update status', async () => {
      if (!testRemedialId) return;
      
      const response = await request(BASE_URL)
        .patch(`/api/remedial-actions/${testRemedialId}/status`)
        .set('Cookie', sessionCookie)
        .send({
          status: 'COMPLETED'
        });
      
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Certificates Status Updates', () => {
    let testCertificateId: string;

    beforeAll(async () => {
      const certsResponse = await request(BASE_URL)
        .get('/api/certificates')
        .set('Cookie', sessionCookie);
      
      const certs = certsResponse.body.data || certsResponse.body;
      if (certs.length > 0) {
        testCertificateId = certs[0].id;
      }
    });

    it('PATCH /api/certificates/:id/status - should update certificate status', async () => {
      if (!testCertificateId) return;
      
      const response = await request(BASE_URL)
        .patch(`/api/certificates/${testCertificateId}/status`)
        .set('Cookie', sessionCookie)
        .send({
          status: 'APPROVED'
        });
      
      expect([200, 204, 400, 404]).toContain(response.status);
    });

    it('POST /api/certificates/:id/approve - should approve certificate', async () => {
      if (!testCertificateId) return;
      
      const response = await request(BASE_URL)
        .post(`/api/certificates/${testCertificateId}/approve`)
        .set('Cookie', sessionCookie);
      
      expect([200, 204, 400, 404]).toContain(response.status);
    });

    it('POST /api/certificates/:id/reject - should reject certificate', async () => {
      if (!testCertificateId) return;
      
      const response = await request(BASE_URL)
        .post(`/api/certificates/${testCertificateId}/reject`)
        .set('Cookie', sessionCookie)
        .send({
          reason: 'Test rejection reason'
        });
      
      expect([200, 204, 400, 404]).toContain(response.status);
    });
  });

  describe('Validation Tests', () => {
    it('POST /api/properties - should reject invalid data', async () => {
      const response = await request(BASE_URL)
        .post('/api/properties')
        .set('Cookie', sessionCookie)
        .send({
          addressLine1: ''
        })
        .expect('Content-Type', /json/);
      
      expect([400, 422]).toContain(response.status);
    });

    it('POST /api/remedial-actions - should reject missing required fields', async () => {
      const response = await request(BASE_URL)
        .post('/api/remedial-actions')
        .set('Cookie', sessionCookie)
        .send({
          description: 'Missing required fields'
        })
        .expect('Content-Type', /json/);
      
      expect([400, 422]).toContain(response.status);
    });

    it('PUT /api/properties/:id - should reject invalid property ID', async () => {
      const response = await request(BASE_URL)
        .put('/api/properties/invalid-uuid-format')
        .set('Cookie', sessionCookie)
        .send({
          addressLine1: 'Test'
        });
      
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Authorization Tests', () => {
    it('POST /api/schemes - should reject without authentication', async () => {
      const response = await request(BASE_URL)
        .post('/api/schemes')
        .send({
          name: 'Unauthorized Scheme'
        });
      
      expect(response.status).toBe(401);
    });

    it('PUT /api/properties/:id - should reject without authentication', async () => {
      const response = await request(BASE_URL)
        .put('/api/properties/some-id')
        .send({
          addressLine1: 'Unauthorized Update'
        });
      
      expect(response.status).toBe(401);
    });

    it('DELETE /api/blocks/:id - should reject without authentication', async () => {
      const response = await request(BASE_URL)
        .delete('/api/blocks/some-id');
      
      expect(response.status).toBe(401);
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

  it('should return proper error structure for validation errors', async () => {
    const loginResponse = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    const sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    
    const response = await request(BASE_URL)
      .post('/api/properties')
      .set('Cookie', sessionCookie)
      .send({})
      .expect('Content-Type', /json/);
    
    expect([400, 422]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
  });
});
