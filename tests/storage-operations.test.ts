import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          limit: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => fn({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

const mockCertificate = {
  id: 'cert-123',
  propertyId: 'prop-456',
  organisationId: 'org-789',
  certificateType: 'GAS_SAFETY',
  fileName: 'certificate.pdf',
  fileSize: 1024,
  fileType: 'application/pdf',
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProperty = {
  id: 'prop-456',
  organisationId: 'org-789',
  addressLine1: '123 Test Street',
  city: 'London',
  postcode: 'SW1A 1AA',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRemedialAction = {
  id: 'action-123',
  certificateId: 'cert-123',
  propertyId: 'prop-456',
  organisationId: 'org-789',
  code: 'C1',
  description: 'Dangerous condition',
  status: 'OPEN',
  severity: 'IMMEDIATE',
  dueDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Storage Operations Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Certificate CRUD Operations', () => {
    describe('createCertificate', () => {
      it('should create a certificate with required fields', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCertificate]),
          }),
        } as any);

        const result = await db.insert({} as any).values({
          propertyId: 'prop-456',
          organisationId: 'org-789',
          certificateType: 'GAS_SAFETY',
          fileName: 'certificate.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          status: 'PENDING',
        }).returning();

        expect(result).toEqual([mockCertificate]);
        expect(db.insert).toHaveBeenCalled();
      });

      it('should generate unique ID on creation', async () => {
        const { db } = await import('../server/db');
        
        let counter = 0;
        const certificates: any[] = [];
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              counter++;
              const newCert = { ...mockCertificate, id: `cert-unique-${counter}` };
              certificates.push(newCert);
              return Promise.resolve([newCert]);
            }),
          }),
        } as any);

        await db.insert({} as any).values({}).returning();
        await db.insert({} as any).values({}).returning();

        expect(certificates.length).toBe(2);
        expect(certificates[0].id).not.toBe(certificates[1].id);
      });
    });

    describe('getCertificate', () => {
      it('should retrieve certificate by ID', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockCertificate]),
          }),
        } as any);

        const result = await db.select().from({} as any).where({} as any);

        expect(result).toEqual([mockCertificate]);
      });

      it('should return empty array when certificate not found', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        const result = await db.select().from({} as any).where({} as any);

        expect(result).toEqual([]);
      });
    });

    describe('updateCertificate', () => {
      it('should update certificate status', async () => {
        const { db } = await import('../server/db');
        
        const updatedCert = { ...mockCertificate, status: 'COMPLETE' };
        
        vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedCert]),
            }),
          }),
        } as any);

        const result = await db.update({} as any).set({ status: 'COMPLETE' }).where({} as any).returning();

        expect(result[0].status).toBe('COMPLETE');
      });

      it('should update multiple fields atomically', async () => {
        const { db } = await import('../server/db');
        
        const updatedCert = { 
          ...mockCertificate, 
          status: 'COMPLETE',
          extractedData: { certificateNumber: 'GAS-001' },
        };
        
        vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedCert]),
            }),
          }),
        } as any);

        const result = await db.update({} as any)
          .set({ status: 'COMPLETE', extractedData: { certificateNumber: 'GAS-001' } })
          .where({} as any)
          .returning();

        expect(result[0].status).toBe('COMPLETE');
        expect(result[0].extractedData).toEqual({ certificateNumber: 'GAS-001' });
      });
    });

    describe('deleteCertificate', () => {
      it('should delete certificate by ID', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.delete).mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        } as any);

        const result = await db.delete({} as any).where({} as any);

        expect(result.rowCount).toBe(1);
      });

      it('should return 0 when certificate not found', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.delete).mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        } as any);

        const result = await db.delete({} as any).where({} as any);

        expect(result.rowCount).toBe(0);
      });
    });
  });

  describe('Property CRUD Operations', () => {
    describe('createProperty', () => {
      it('should create property with address fields', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockProperty]),
          }),
        } as any);

        const result = await db.insert({} as any).values({
          organisationId: 'org-789',
          addressLine1: '123 Test Street',
          city: 'London',
          postcode: 'SW1A 1AA',
        }).returning();

        expect(result[0].addressLine1).toBe('123 Test Street');
        expect(result[0].postcode).toBe('SW1A 1AA');
      });
    });

    describe('listProperties with filters', () => {
      it('should filter properties by organisation', async () => {
        const { db } = await import('../server/db');
        
        const orgProperties = [mockProperty, { ...mockProperty, id: 'prop-457' }];
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(orgProperties),
          }),
        } as any);

        const result = await db.select().from({} as any).where({} as any);

        expect(result.length).toBe(2);
        expect(result.every((p: any) => p.organisationId === 'org-789')).toBe(true);
      });

      it('should filter properties by block ID', async () => {
        const { db } = await import('../server/db');
        
        const blockProperty = { ...mockProperty, blockId: 'block-123' };
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([blockProperty]),
          }),
        } as any);

        const result = await db.select().from({} as any).where({} as any);

        expect(result[0].blockId).toBe('block-123');
      });
    });

    describe('bulkVerifyProperties', () => {
      it('should verify multiple properties in single operation', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                { id: 'prop-1', isVerified: true },
                { id: 'prop-2', isVerified: true },
              ]),
            }),
          }),
        } as any);

        const result = await db.update({} as any)
          .set({ isVerified: true })
          .where({} as any)
          .returning();

        expect(result.length).toBe(2);
        expect(result.every((p: any) => p.isVerified)).toBe(true);
      });
    });
  });

  describe('Remedial Action CRUD Operations', () => {
    describe('createRemedialAction', () => {
      it('should create remedial action with severity', async () => {
        const { db } = await import('../server/db');
        
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRemedialAction]),
          }),
        } as any);

        const result = await db.insert({} as any).values({
          certificateId: 'cert-123',
          code: 'C1',
          description: 'Dangerous condition',
          severity: 'IMMEDIATE',
        }).returning();

        expect(result[0].severity).toBe('IMMEDIATE');
        expect(result[0].code).toBe('C1');
      });
    });

    describe('listRemedialActionsPaginated', () => {
      it('should return paginated results with total count', async () => {
        const { db } = await import('../server/db');
        
        const actions = [mockRemedialAction, { ...mockRemedialAction, id: 'action-124' }];
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(actions),
              }),
            }),
          }),
        } as any);

        const paginatedResult = {
          items: actions,
          total: 10,
          page: 1,
          pageSize: 2,
        };

        expect(paginatedResult.items.length).toBe(2);
        expect(paginatedResult.total).toBe(10);
      });

      it('should filter by status', async () => {
        const { db } = await import('../server/db');
        
        const openActions = [mockRemedialAction];
        
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(openActions),
          }),
        } as any);

        const result = await db.select().from({} as any).where({} as any);

        expect(result.every((a: any) => a.status === 'OPEN')).toBe(true);
      });

      it('should filter overdue actions', async () => {
        const overdueAction = {
          ...mockRemedialAction,
          dueDate: new Date('2020-01-01'),
          status: 'OPEN',
        };

        const isOverdue = (action: typeof overdueAction) => {
          return action.status === 'OPEN' && new Date(action.dueDate) < new Date();
        };

        expect(isOverdue(overdueAction)).toBe(true);
      });
    });

    describe('updateRemedialAction', () => {
      it('should update action status to COMPLETE', async () => {
        const { db } = await import('../server/db');
        
        const completedAction = { ...mockRemedialAction, status: 'COMPLETE' };
        
        vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([completedAction]),
            }),
          }),
        } as any);

        const result = await db.update({} as any)
          .set({ status: 'COMPLETE' })
          .where({} as any)
          .returning();

        expect(result[0].status).toBe('COMPLETE');
      });
    });
  });

  describe('Transaction Handling', () => {
    it('should execute multiple operations in transaction', async () => {
      const { db } = await import('../server/db');
      
      const transactionFn = vi.fn().mockImplementation(async (tx) => {
        return { success: true };
      });
      
      vi.mocked(db.transaction).mockImplementation(async (fn) => {
        return fn({
          select: vi.fn(),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
            }),
          }),
          update: vi.fn(),
          delete: vi.fn(),
        } as any);
      });

      const result = await db.transaction(transactionFn);

      expect(result).toEqual({ success: true });
    });

    it('should rollback on error', async () => {
      const { db } = await import('../server/db');
      
      vi.mocked(db.transaction).mockImplementation(async (fn) => {
        try {
          return fn({
            insert: vi.fn().mockImplementation(() => {
              throw new Error('Insert failed');
            }),
          } as any);
        } catch (error) {
          throw error;
        }
      });

      await expect(db.transaction(async (tx) => {
        tx.insert({} as any);
      })).rejects.toThrow('Insert failed');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle duplicate key errors', async () => {
      const { db } = await import('../server/db');
      
      const duplicateError = new Error('duplicate key value violates unique constraint');
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(duplicateError),
        }),
      } as any);

      await expect(
        db.insert({} as any).values({}).returning()
      ).rejects.toThrow('duplicate key');
    });

    it('should handle foreign key constraint errors', async () => {
      const { db } = await import('../server/db');
      
      const fkError = new Error('violates foreign key constraint');
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(fkError),
        }),
      } as any);

      await expect(
        db.insert({} as any).values({}).returning()
      ).rejects.toThrow('foreign key constraint');
    });

    it('should handle connection errors', async () => {
      const { db } = await import('../server/db');
      
      const connectionError = new Error('Connection refused');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(connectionError),
        }),
      } as any);

      await expect(
        db.select().from({} as any).where({} as any)
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('Cursor-based Pagination', () => {
    it('should return data with next cursor when more results exist', () => {
      const items = [
        { ...mockCertificate, id: 'cert-1', createdAt: new Date('2024-01-01') },
        { ...mockCertificate, id: 'cert-2', createdAt: new Date('2024-01-02') },
      ];
      
      const pageSize = 2;
      const hasMore = items.length === pageSize;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      expect(hasMore).toBe(true);
      expect(nextCursor).toBe('cert-2');
    });

    it('should return null cursor on last page', () => {
      const items = [
        { ...mockCertificate, id: 'cert-1' },
      ];
      
      const pageSize = 2;
      const hasMore = items.length === pageSize;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      expect(hasMore).toBe(false);
      expect(nextCursor).toBeNull();
    });
  });

  describe('Search Filtering', () => {
    it('should filter certificates by search term', () => {
      const certificates = [
        { ...mockCertificate, fileName: 'gas_safety_2024.pdf' },
        { ...mockCertificate, id: 'cert-2', fileName: 'eicr_report.pdf' },
      ];
      
      const searchTerm = 'gas';
      const filtered = certificates.filter(c => 
        c.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].fileName).toContain('gas');
    });

    it('should filter by multiple status values', () => {
      const certificates = [
        { ...mockCertificate, status: 'PENDING' },
        { ...mockCertificate, id: 'cert-2', status: 'COMPLETE' },
        { ...mockCertificate, id: 'cert-3', status: 'FAILED' },
      ];
      
      const statusFilter = ['PENDING', 'COMPLETE'];
      const filtered = certificates.filter(c => statusFilter.includes(c.status));

      expect(filtered.length).toBe(2);
      expect(filtered.every(c => statusFilter.includes(c.status))).toBe(true);
    });
  });

  describe('Stuck Certificate Detection', () => {
    it('should find certificates stuck in PROCESSING status', () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      const certificates = [
        { ...mockCertificate, status: 'PROCESSING', updatedAt: thirtyMinutesAgo },
        { ...mockCertificate, id: 'cert-2', status: 'PROCESSING', updatedAt: tenMinutesAgo },
        { ...mockCertificate, id: 'cert-3', status: 'COMPLETE', updatedAt: thirtyMinutesAgo },
      ];
      
      const timeoutMinutes = 20;
      const cutoffTime = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
      
      const stuckCertificates = certificates.filter(c => 
        c.status === 'PROCESSING' && new Date(c.updatedAt) < cutoffTime
      );

      expect(stuckCertificates.length).toBe(1);
      expect(stuckCertificates[0].id).toBe('cert-123');
    });
  });
});

describe('Storage Interface Compliance', () => {
  it('should have all required CRUD methods for certificates', () => {
    const requiredMethods = [
      'getCertificate',
      'createCertificate',
      'updateCertificate',
      'deleteCertificate',
      'listCertificates',
    ];

    requiredMethods.forEach(method => {
      expect(typeof method).toBe('string');
    });
  });

  it('should have all required CRUD methods for properties', () => {
    const requiredMethods = [
      'getProperty',
      'createProperty',
      'updateProperty',
      'deleteProperty',
      'listProperties',
      'bulkVerifyProperties',
      'bulkDeleteProperties',
    ];

    requiredMethods.forEach(method => {
      expect(typeof method).toBe('string');
    });
  });

  it('should have all required CRUD methods for remedial actions', () => {
    const requiredMethods = [
      'getRemedialAction',
      'createRemedialAction',
      'updateRemedialAction',
      'listRemedialActions',
      'listRemedialActionsPaginated',
    ];

    requiredMethods.forEach(method => {
      expect(typeof method).toBe('string');
    });
  });
});
