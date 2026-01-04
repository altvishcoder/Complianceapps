import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../server/storage', () => ({
  storage: {
    createAuditFieldChanges: vi.fn(),
    listAuditFieldChanges: vi.fn().mockResolvedValue([]),
  },
}));

const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    insert: () => mockDbInsert(),
    select: () => mockDbSelect(),
  },
}));

import {
  recordFieldLevelAudit,
  recordPropertyUpdate,
  recordComponentUpdate,
  recordBlockUpdate,
  recordSchemeUpdate,
  recordCertificateUpdate,
  recordRemedialActionUpdate,
  getAuditTrailForEntity,
} from '../server/services/golden-thread-audit';

describe('Golden Thread Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReset();
    mockDbSelect.mockReset();
  });

  const mockContext = {
    organisationId: 'org-123',
    actorId: 'user-456',
    actorName: 'John Doe',
    actorType: 'USER' as const,
    ipAddress: '192.168.1.1',
    userAgent: 'TestAgent/1.0',
  };

  describe('recordFieldLevelAudit', () => {
    it('should return null when no changes detected', async () => {
      const beforeState = { name: 'Test', status: 'active' };
      const afterState = { name: 'Test', status: 'active' };

      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test Property',
        'PROPERTY_UPDATED',
        beforeState,
        afterState
      );

      expect(result).toBeNull();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should record audit event when changes detected', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-789' }]),
        }),
      });

      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test Property',
        'PROPERTY_UPDATED',
        { name: 'Old Name' },
        { name: 'New Name' }
      );

      expect(result).toBe('audit-789');
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should ignore system fields in change detection', async () => {
      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test',
        'PROPERTY_UPDATED',
        { id: '1', createdAt: new Date(), updatedAt: new Date() },
        { id: '1', createdAt: new Date(), updatedAt: new Date() }
      );

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Insert failed')),
        }),
      });

      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test',
        'PROPERTY_UPDATED',
        { name: 'Old' },
        { name: 'New' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordPropertyUpdate', () => {
    it('should call recordFieldLevelAudit with properties table', async () => {
      const result = await recordPropertyUpdate(
        mockContext,
        'prop-123',
        'Test Property',
        { addressLine1: 'Old Address' },
        { addressLine1: 'Old Address' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordComponentUpdate', () => {
    it('should call recordFieldLevelAudit with components table', async () => {
      const result = await recordComponentUpdate(
        mockContext,
        'comp-123',
        'Gas Boiler',
        { status: 'active' },
        { status: 'active' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordBlockUpdate', () => {
    it('should call recordFieldLevelAudit with blocks table', async () => {
      const result = await recordBlockUpdate(
        mockContext,
        'block-123',
        'Block A',
        { name: 'Block A' },
        { name: 'Block A' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordSchemeUpdate', () => {
    it('should call recordFieldLevelAudit with schemes table', async () => {
      const result = await recordSchemeUpdate(
        mockContext,
        'scheme-123',
        'Main Scheme',
        { reference: 'REF001' },
        { reference: 'REF001' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordCertificateUpdate', () => {
    it('should call recordFieldLevelAudit with certificates table', async () => {
      const result = await recordCertificateUpdate(
        mockContext,
        'cert-123',
        'Gas Safety Certificate',
        { status: 'VALID' },
        { status: 'VALID' }
      );

      expect(result).toBeNull();
    });
  });

  describe('recordRemedialActionUpdate', () => {
    it('should call recordFieldLevelAudit with remedial_actions table', async () => {
      const result = await recordRemedialActionUpdate(
        mockContext,
        'action-123',
        'Fix boiler',
        { status: 'OPEN' },
        { status: 'OPEN' }
      );

      expect(result).toBeNull();
    });
  });

  describe('getAuditTrailForEntity', () => {
    it('should return audit events with field changes', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { id: 'event-1', entityId: 'entity-1', message: 'Updated' },
            ]),
          }),
        }),
      });

      const trail = await getAuditTrailForEntity('org-123', 'PROPERTY', 'prop-123');

      expect(Array.isArray(trail)).toBe(true);
    });

    it('should return empty array when no events found', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const trail = await getAuditTrailForEntity('org-123', 'PROPERTY', 'prop-456');

      expect(trail).toEqual([]);
    });
  });

  describe('Field Change Detection', () => {
    it('should detect added fields', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
        }),
      });

      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test',
        'PROPERTY_UPDATED',
        {},
        { newField: 'value' }
      );

      expect(result).toBe('audit-1');
    });

    it('should detect removed fields', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-2' }]),
        }),
      });

      const result = await recordFieldLevelAudit(
        mockContext,
        'properties',
        'prop-123',
        'Test',
        'PROPERTY_UPDATED',
        { oldField: 'value' },
        {}
      );

      expect(result).toBe('audit-2');
    });
  });

  describe('Significant Fields', () => {
    it('should mark significant property fields', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-3' }]),
        }),
      });

      await recordPropertyUpdate(
        mockContext,
        'prop-123',
        'Test',
        { hasGas: false },
        { hasGas: true }
      );

      expect(mockDbInsert).toHaveBeenCalled();
    });
  });
});
