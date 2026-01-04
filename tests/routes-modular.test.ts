import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

vi.mock('../server/storage', () => ({
  storage: {
    listSchemes: vi.fn(),
    createScheme: vi.fn(),
    updateScheme: vi.fn(),
    deleteScheme: vi.fn(),
    listBlocks: vi.fn(),
    createBlock: vi.fn(),
    updateBlock: vi.fn(),
    deleteBlock: vi.fn(),
    listOrganisations: vi.fn(),
    getOrganisation: vi.fn(),
    createOrganisation: vi.fn(),
    updateOrganisation: vi.fn(),
    deleteOrganisation: vi.fn(),
    listProperties: vi.fn(),
    getProperty: vi.fn(),
    createProperty: vi.fn(),
    updateProperty: vi.fn(),
    deleteProperty: vi.fn(),
    listCertificates: vi.fn(),
    getCertificate: vi.fn(),
    createCertificate: vi.fn(),
    updateCertificate: vi.fn(),
    deleteCertificate: vi.fn(),
    getExtractionByCertificate: vi.fn(),
    listRemedialActions: vi.fn(),
    getRemedialAction: vi.fn(),
    createRemedialAction: vi.fn(),
    updateRemedialAction: vi.fn(),
    deleteRemedialAction: vi.fn(),
    listContractors: vi.fn(),
    getContractor: vi.fn(),
    createContractor: vi.fn(),
    updateContractor: vi.fn(),
    deleteContractor: vi.fn(),
    createIngestionBatch: vi.fn(),
  }
}));

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    execute: vi.fn(),
  }
}));

vi.mock('../server/services/api-limits', () => ({
  paginationMiddleware: () => (req: any, res: any, next: any) => {
    req.pagination = { page: 1, limit: 10, offset: 0, hasFilters: false };
    next();
  },
  getApiLimitsConfig: vi.fn().mockResolvedValue({}),
  clearApiLimitsCache: vi.fn(),
  PaginationParams: {}
}));

vi.mock('../server/services/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
  extractAuditContext: vi.fn().mockReturnValue({}),
  getChanges: vi.fn().mockReturnValue([]),
}));

vi.mock('../server/webhook-worker', () => ({
  enqueueWebhookEvent: vi.fn(),
}));

vi.mock('../server/extraction', () => ({
  processExtractionAndSave: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../server/replit_integrations/object_storage', () => {
  return {
    ObjectStorageService: class MockObjectStorageService {
      getObjectEntityFile = vi.fn();
    },
  };
});

const { storage } = await import('../server/storage');

describe('Modular Route Handlers', () => {
  
  describe('Properties Router', () => {
    let app: Express;
    
    beforeAll(async () => {
      const { propertiesRouter } = await import('../server/routes/properties.routes');
      app = express();
      app.use(express.json());
      app.use('/api', propertiesRouter);
    });
    
    beforeEach(() => {
      vi.clearAllMocks();
    });
    
    describe('Schemes endpoints', () => {
      it('GET /api/schemes returns empty array when no schemes', async () => {
        vi.mocked(storage.listSchemes).mockResolvedValue([]);
        const response = await request(app).get('/api/schemes');
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
      
      it('GET /api/schemes returns schemes list', async () => {
        const mockSchemes = [
          { id: '1', name: 'Scheme A', code: 'SA' },
          { id: '2', name: 'Scheme B', code: 'SB' }
        ];
        vi.mocked(storage.listSchemes).mockResolvedValue(mockSchemes as any);
        const response = await request(app).get('/api/schemes');
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
      });
      
      it('POST /api/schemes creates a new scheme', async () => {
        const newScheme = { id: '1', name: 'New Scheme', reference: 'SCH-001', organisationId: 'org-001' };
        vi.mocked(storage.createScheme).mockResolvedValue(newScheme as any);
        
        const response = await request(app)
          .post('/api/schemes')
          .send({ name: 'New Scheme', reference: 'SCH-001' });
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('New Scheme');
      });
      
      it('POST /api/schemes returns 400 for invalid data', async () => {
        const response = await request(app)
          .post('/api/schemes')
          .send({});
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
      
      it('PATCH /api/schemes/:id updates a scheme', async () => {
        const updatedScheme = { id: '1', name: 'Updated Scheme', code: 'US' };
        vi.mocked(storage.updateScheme).mockResolvedValue(updatedScheme as any);
        
        const response = await request(app)
          .patch('/api/schemes/1')
          .send({ name: 'Updated Scheme' });
        
        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Updated Scheme');
      });
      
      it('PATCH /api/schemes/:id returns 404 for non-existent scheme', async () => {
        vi.mocked(storage.updateScheme).mockResolvedValue(null);
        
        const response = await request(app)
          .patch('/api/schemes/nonexistent')
          .send({ name: 'Updated' });
        
        expect(response.status).toBe(404);
      });
      
      it('DELETE /api/schemes/:id deletes a scheme', async () => {
        vi.mocked(storage.deleteScheme).mockResolvedValue(true);
        
        const response = await request(app).delete('/api/schemes/1');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      it('DELETE /api/schemes/:id returns 404 for non-existent scheme', async () => {
        vi.mocked(storage.deleteScheme).mockResolvedValue(false);
        
        const response = await request(app).delete('/api/schemes/nonexistent');
        expect(response.status).toBe(404);
      });
    });
    
    describe('Blocks endpoints', () => {
      it('GET /api/blocks returns blocks list', async () => {
        const mockBlocks = [{ id: '1', name: 'Block A' }];
        vi.mocked(storage.listBlocks).mockResolvedValue(mockBlocks as any);
        
        const response = await request(app).get('/api/blocks');
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
      });
      
      it('GET /api/blocks accepts schemeId filter', async () => {
        vi.mocked(storage.listBlocks).mockResolvedValue([]);
        
        await request(app).get('/api/blocks?schemeId=scheme-1');
        expect(storage.listBlocks).toHaveBeenCalledWith('scheme-1');
      });
      
      it('POST /api/blocks creates a new block', async () => {
        const newBlock = { id: '1', name: 'New Block', reference: 'BLK-001', schemeId: 'scheme-1' };
        vi.mocked(storage.createBlock).mockResolvedValue(newBlock as any);
        
        const response = await request(app)
          .post('/api/blocks')
          .send({ name: 'New Block', reference: 'BLK-001', schemeId: 'scheme-1' });
        
        expect(response.status).toBe(201);
      });
      
      it('PATCH /api/blocks/:id updates a block', async () => {
        const updatedBlock = { id: '1', name: 'Updated Block' };
        vi.mocked(storage.updateBlock).mockResolvedValue(updatedBlock as any);
        
        const response = await request(app)
          .patch('/api/blocks/1')
          .send({ name: 'Updated Block' });
        
        expect(response.status).toBe(200);
      });
      
      it('DELETE /api/blocks/:id deletes a block', async () => {
        vi.mocked(storage.deleteBlock).mockResolvedValue(true);
        
        const response = await request(app).delete('/api/blocks/1');
        expect(response.status).toBe(200);
      });
    });
    
    describe('Organisations endpoints', () => {
      it('GET /api/organisations returns organisations list', async () => {
        const mockOrgs = [{ id: '1', name: 'Org A' }];
        vi.mocked(storage.listOrganisations).mockResolvedValue(mockOrgs as any);
        
        const response = await request(app).get('/api/organisations');
        expect(response.status).toBe(200);
      });
      
      it('GET /api/organisations/:id returns single organisation', async () => {
        const mockOrg = { id: '1', name: 'Org A' };
        vi.mocked(storage.getOrganisation).mockResolvedValue(mockOrg as any);
        
        const response = await request(app).get('/api/organisations/1');
        expect(response.status).toBe(200);
      });
      
      it('GET /api/organisations/:id returns 404 for non-existent org', async () => {
        vi.mocked(storage.getOrganisation).mockResolvedValue(null);
        
        const response = await request(app).get('/api/organisations/nonexistent');
        expect(response.status).toBe(404);
      });
    });
    
    describe('Properties endpoints', () => {
      it('GET /api/properties returns paginated properties', async () => {
        const mockProperties = [{ id: '1', addressLine1: '123 Main St' }];
        vi.mocked(storage.listProperties).mockResolvedValue(mockProperties as any);
        
        const response = await request(app).get('/api/properties');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
      });
      
      it('GET /api/properties/:id returns property with certificates and actions', async () => {
        const mockProperty = { id: '1', addressLine1: '123 Main St' };
        vi.mocked(storage.getProperty).mockResolvedValue(mockProperty as any);
        vi.mocked(storage.listCertificates).mockResolvedValue([]);
        vi.mocked(storage.listRemedialActions).mockResolvedValue([]);
        
        const response = await request(app).get('/api/properties/1');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('certificates');
        expect(response.body).toHaveProperty('actions');
      });
      
      it('GET /api/properties/:id returns 404 for non-existent property', async () => {
        vi.mocked(storage.getProperty).mockResolvedValue(null);
        
        const response = await request(app).get('/api/properties/nonexistent');
        expect(response.status).toBe(404);
      });
      
      it('POST /api/properties/bulk-delete deletes multiple properties', async () => {
        vi.mocked(storage.deleteProperty).mockResolvedValue(true);
        
        const response = await request(app)
          .post('/api/properties/bulk-delete')
          .send({ ids: ['1', '2', '3'] });
        
        expect(response.status).toBe(200);
        expect(response.body.deleted).toBe(3);
      });
      
      it('POST /api/properties/bulk-delete returns 400 for empty ids', async () => {
        const response = await request(app)
          .post('/api/properties/bulk-delete')
          .send({ ids: [] });
        
        expect(response.status).toBe(400);
      });
    });
  });
  
  describe('Certificates Router', () => {
    let app: Express;
    
    beforeAll(async () => {
      const { certificatesRouter } = await import('../server/routes/certificates.routes');
      app = express();
      app.use(express.json());
      app.use('/api/certificates', certificatesRouter);
    });
    
    beforeEach(() => {
      vi.clearAllMocks();
    });
    
    it('GET /api/certificates returns paginated certificates', async () => {
      vi.mocked(storage.listCertificates).mockResolvedValue([]);
      
      const response = await request(app).get('/api/certificates');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });
    
    it('GET /api/certificates/:id returns certificate with related data', async () => {
      const mockCert = { id: '1', propertyId: 'prop-1', certificateType: 'GAS_SAFETY' };
      vi.mocked(storage.getCertificate).mockResolvedValue(mockCert as any);
      vi.mocked(storage.getProperty).mockResolvedValue({ id: 'prop-1' } as any);
      vi.mocked(storage.getExtractionByCertificate).mockResolvedValue(null);
      vi.mocked(storage.listRemedialActions).mockResolvedValue([]);
      
      const response = await request(app).get('/api/certificates/1');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('property');
    });
    
    it('GET /api/certificates/:id returns 404 for non-existent certificate', async () => {
      vi.mocked(storage.getCertificate).mockResolvedValue(null);
      
      const response = await request(app).get('/api/certificates/nonexistent');
      expect(response.status).toBe(404);
    });
    
    it('PATCH /api/certificates/:id updates a certificate', async () => {
      const mockCert = { id: '1', status: 'UPLOADED', organisationId: 'org-001' };
      vi.mocked(storage.getCertificate).mockResolvedValue(mockCert as any);
      vi.mocked(storage.updateCertificate).mockResolvedValue({ ...mockCert, status: 'APPROVED' } as any);
      
      const response = await request(app)
        .patch('/api/certificates/1')
        .send({ status: 'APPROVED' });
      
      expect(response.status).toBe(200);
    });
    
    it('DELETE /api/certificates/:id deletes a certificate', async () => {
      vi.mocked(storage.getCertificate).mockResolvedValue({ id: '1', propertyId: 'p1' } as any);
      vi.mocked(storage.deleteCertificate).mockResolvedValue(true);
      
      const response = await request(app).delete('/api/certificates/1');
      expect(response.status).toBe(200);
    });
  });
  
  describe('Remedial Router', () => {
    let app: Express;
    
    beforeAll(async () => {
      const { remedialRouter } = await import('../server/routes/remedial.routes');
      app = express();
      app.use(express.json());
      app.use('/api/actions', remedialRouter);
    });
    
    beforeEach(() => {
      vi.clearAllMocks();
    });
    
    it('GET /api/actions returns paginated actions', async () => {
      vi.mocked(storage.listRemedialActions).mockResolvedValue([]);
      vi.mocked(storage.listSchemes).mockResolvedValue([]);
      vi.mocked(storage.listBlocks).mockResolvedValue([]);
      
      const response = await request(app).get('/api/actions');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    it('GET /api/actions filters by severity', async () => {
      const actions = [
        { id: '1', severity: 'IMMEDIATE', status: 'OPEN' },
        { id: '2', severity: 'ROUTINE', status: 'OPEN' }
      ];
      vi.mocked(storage.listRemedialActions).mockResolvedValue(actions as any);
      vi.mocked(storage.listSchemes).mockResolvedValue([]);
      vi.mocked(storage.listBlocks).mockResolvedValue([]);
      vi.mocked(storage.getProperty).mockResolvedValue(null);
      vi.mocked(storage.getCertificate).mockResolvedValue(null);
      
      const response = await request(app).get('/api/actions?severity=IMMEDIATE');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
    
    it('GET /api/actions/:id returns action with related data', async () => {
      const mockAction = { id: '1', propertyId: 'prop-1', certificateId: 'cert-1' };
      vi.mocked(storage.getRemedialAction).mockResolvedValue(mockAction as any);
      vi.mocked(storage.getProperty).mockResolvedValue({ id: 'prop-1' } as any);
      vi.mocked(storage.getCertificate).mockResolvedValue({ id: 'cert-1' } as any);
      
      const response = await request(app).get('/api/actions/1');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('property');
      expect(response.body).toHaveProperty('certificate');
    });
    
    it('PATCH /api/actions/:id sets resolvedAt when completing', async () => {
      const mockAction = { id: '1', status: 'OPEN', organisationId: 'org-001' };
      vi.mocked(storage.getRemedialAction).mockResolvedValue(mockAction as any);
      vi.mocked(storage.updateRemedialAction).mockImplementation(async (id, updates) => {
        return { ...mockAction, ...updates } as any;
      });
      
      const response = await request(app)
        .patch('/api/actions/1')
        .send({ status: 'COMPLETED' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
    });
  });
  
  describe('Contractors Router', () => {
    let app: Express;
    
    beforeAll(async () => {
      const { contractorsRouter } = await import('../server/routes/contractors.routes');
      app = express();
      app.use(express.json());
      app.use('/api/contractors', contractorsRouter);
    });
    
    beforeEach(() => {
      vi.clearAllMocks();
    });
    
    it('GET /api/contractors returns contractors list', async () => {
      const mockContractors = [{ id: '1', name: 'Contractor A' }];
      vi.mocked(storage.listContractors).mockResolvedValue(mockContractors as any);
      
      const response = await request(app).get('/api/contractors');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
    
    it('GET /api/contractors/:id returns single contractor', async () => {
      const mockContractor = { id: '1', name: 'Contractor A' };
      vi.mocked(storage.getContractor).mockResolvedValue(mockContractor as any);
      
      const response = await request(app).get('/api/contractors/1');
      expect(response.status).toBe(200);
    });
    
    it('GET /api/contractors/:id returns 404 for non-existent contractor', async () => {
      vi.mocked(storage.getContractor).mockResolvedValue(null);
      
      const response = await request(app).get('/api/contractors/nonexistent');
      expect(response.status).toBe(404);
    });
    
    it('POST /api/contractors creates a new contractor', async () => {
      const newContractor = { id: '1', companyName: 'New Contractor', tradeType: 'Gas', contactEmail: 'test@example.com' };
      vi.mocked(storage.createContractor).mockResolvedValue(newContractor as any);
      
      const response = await request(app)
        .post('/api/contractors')
        .send({ companyName: 'New Contractor', tradeType: 'Gas', contactEmail: 'test@example.com' });
      
      expect(response.status).toBe(201);
    });
    
    it('PATCH /api/contractors/:id updates a contractor', async () => {
      const updated = { id: '1', name: 'Updated Contractor' };
      vi.mocked(storage.updateContractor).mockResolvedValue(updated as any);
      
      const response = await request(app)
        .patch('/api/contractors/1')
        .send({ name: 'Updated Contractor' });
      
      expect(response.status).toBe(200);
    });
    
    it('DELETE /api/contractors/:id deletes a contractor', async () => {
      vi.mocked(storage.deleteContractor).mockResolvedValue(true);
      
      const response = await request(app).delete('/api/contractors/1');
      expect(response.status).toBe(200);
    });
  });
  
  describe('System Router', () => {
    let app: Express;
    
    beforeAll(async () => {
      const { db } = await import('../server/db');
      vi.mocked(db.execute).mockResolvedValue({ rows: [{ scheme_count: '5', block_count: '10', property_count: '100', certificate_count: '500', action_count: '50', user_count: '10' }] } as any);
      
      const { systemRouter } = await import('../server/routes/system.routes');
      app = express();
      app.use(express.json());
      app.use('/api', systemRouter);
    });
    
    beforeEach(() => {
      vi.clearAllMocks();
    });
    
    it('GET /api/health returns healthy status', async () => {
      const { db } = await import('../server/db');
      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as any);
      
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
    
    it('GET /api/version returns version info', async () => {
      const response = await request(app).get('/api/version');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name');
    });
    
    it('GET /api/version/releases returns release notes', async () => {
      const response = await request(app).get('/api/version/releases');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('releases');
    });
    
    it('GET /api/version/api-info returns API info', async () => {
      const response = await request(app).get('/api/version/api-info');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apiVersion');
      expect(response.body).toHaveProperty('documentation');
    });
    
    it('GET /api/memory returns memory usage', async () => {
      const response = await request(app).get('/api/memory');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('heapUsed');
      expect(response.body).toHaveProperty('unit');
    });
    
    it('GET /api/stats returns system stats', async () => {
      const { db } = await import('../server/db');
      vi.mocked(db.execute).mockResolvedValue({ 
        rows: [{ 
          scheme_count: '5', 
          block_count: '10', 
          property_count: '100', 
          certificate_count: '500', 
          action_count: '50', 
          user_count: '10' 
        }] 
      } as any);
      
      const response = await request(app).get('/api/stats');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schemes');
      expect(response.body).toHaveProperty('properties');
    });
  });
});
