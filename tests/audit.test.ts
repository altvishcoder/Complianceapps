import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordAudit,
  getChanges,
  extractAuditContext,
} from '../server/services/audit';

vi.mock('../server/storage', () => ({
  storage: {
    recordAuditEvent: vi.fn().mockResolvedValue({ id: 'audit-123' }),
  },
}));

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChanges', () => {
    it('should return null when before is null', () => {
      const result = getChanges(null, { name: 'test' });
      expect(result).toBeNull();
    });

    it('should return null when after is null', () => {
      const result = getChanges({ name: 'test' }, null);
      expect(result).toBeNull();
    });

    it('should return null when both are null', () => {
      const result = getChanges(null, null);
      expect(result).toBeNull();
    });

    it('should return null when no changes detected', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John', age: 30 };
      
      const result = getChanges(before, after);
      expect(result).toBeNull();
    });

    it('should detect single field change', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'Jane', age: 30 };
      
      const result = getChanges(before, after);
      
      expect(result).toEqual({
        name: { from: 'John', to: 'Jane' },
      });
    });

    it('should detect multiple field changes', () => {
      const before = { name: 'John', age: 30, city: 'London' };
      const after = { name: 'Jane', age: 31, city: 'London' };
      
      const result = getChanges(before, after);
      
      expect(result).toEqual({
        name: { from: 'John', to: 'Jane' },
        age: { from: 30, to: 31 },
      });
    });

    it('should detect added fields', () => {
      const before = { name: 'John' };
      const after = { name: 'John', age: 30 };
      
      const result = getChanges(before, after);
      
      expect(result).toEqual({
        age: { from: undefined, to: 30 },
      });
    });

    it('should detect removed fields', () => {
      const before = { name: 'John', age: 30 };
      const after = { name: 'John' };
      
      const result = getChanges(before, after);
      
      expect(result).toEqual({
        age: { from: 30, to: undefined },
      });
    });

    it('should handle empty objects', () => {
      const before = {};
      const after = { name: 'John' };
      
      const result = getChanges(before, after);
      
      expect(result).toEqual({
        name: { from: undefined, to: 'John' },
      });
    });

    it('should handle nested value changes as full replacement', () => {
      const before = { config: { theme: 'dark' } };
      const after = { config: { theme: 'light' } };
      
      const result = getChanges(before, after);
      
      expect(result).not.toBeNull();
    });
  });

  describe('extractAuditContext', () => {
    it('should extract session-based user info', () => {
      const req = {
        session: {
          userId: 'user-123',
          username: 'john.doe',
        },
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      };
      
      const context = extractAuditContext(req);
      
      expect(context.actorId).toBe('user-123');
      expect(context.actorName).toBe('john.doe');
      expect(context.actorType).toBe('USER');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.userAgent).toBe('Mozilla/5.0');
    });

    it('should handle missing session', () => {
      const req = {
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Test Agent',
        },
      };
      
      const context = extractAuditContext(req);
      
      expect(context.actorId).toBeUndefined();
      expect(context.actorName).toBeUndefined();
      expect(context.actorType).toBe('USER');
    });

    it('should use x-forwarded-for when ip is missing', () => {
      const req = {
        session: {},
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Test',
        },
      };
      
      const context = extractAuditContext(req);
      
      expect(context.ipAddress).toBe('1.2.3.4');
    });

    it('should handle empty headers', () => {
      const req = {
        session: { userId: 'user-1' },
        headers: {},
      };
      
      const context = extractAuditContext(req);
      
      expect(context.actorId).toBe('user-1');
      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('recordAudit', () => {
    it('should record audit event with all parameters', async () => {
      const result = await recordAudit({
        organisationId: 'org-123',
        eventType: 'CERTIFICATE_UPLOADED',
        entityType: 'CERTIFICATE',
        entityId: 'cert-456',
        entityName: 'Gas Safety Certificate',
        message: 'Certificate uploaded successfully',
        propertyId: 'prop-789',
        certificateId: 'cert-456',
        context: {
          actorId: 'user-111',
          actorName: 'John Doe',
          actorType: 'USER',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        },
      });
      
      expect(result).not.toBeNull();
    });

    it('should record audit event with minimal parameters', async () => {
      const result = await recordAudit({
        organisationId: 'org-123',
        eventType: 'PROPERTY_CREATED',
        entityType: 'PROPERTY',
        entityId: 'prop-123',
        message: 'Property created',
      });
      
      expect(result).not.toBeNull();
    });

    it('should handle before/after state for changes', async () => {
      const result = await recordAudit({
        organisationId: 'org-123',
        eventType: 'PROPERTY_UPDATED',
        entityType: 'PROPERTY',
        entityId: 'prop-123',
        message: 'Property address updated',
        beforeState: { address: '123 Old Street' },
        afterState: { address: '456 New Street' },
        changes: { address: { from: '123 Old Street', to: '456 New Street' } },
      });
      
      expect(result).not.toBeNull();
    });
  });

  describe('Event Types', () => {
    const eventTypes = [
      'CERTIFICATE_UPLOADED',
      'CERTIFICATE_PROCESSED',
      'CERTIFICATE_STATUS_CHANGED',
      'CERTIFICATE_APPROVED',
      'CERTIFICATE_REJECTED',
      'PROPERTY_CREATED',
      'USER_LOGIN',
      'SETTINGS_CHANGED',
    ];

    eventTypes.forEach(eventType => {
      it(`should support ${eventType} event type`, async () => {
        const result = await recordAudit({
          organisationId: 'org-123',
          eventType: eventType as any,
          entityType: 'CERTIFICATE',
          entityId: 'entity-123',
          message: `${eventType} event`,
        });
        
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Entity Types', () => {
    const entityTypes = [
      'CERTIFICATE',
      'PROPERTY',
      'COMPONENT',
      'REMEDIAL_ACTION',
      'USER',
      'ORGANISATION',
      'API_KEY',
      'SETTINGS',
    ];

    entityTypes.forEach(entityType => {
      it(`should support ${entityType} entity type`, async () => {
        const result = await recordAudit({
          organisationId: 'org-123',
          eventType: 'SETTINGS_CHANGED',
          entityType: entityType as any,
          entityId: 'entity-123',
          message: `Entity ${entityType}`,
        });
        
        expect(result).not.toBeNull();
      });
    });
  });
});
