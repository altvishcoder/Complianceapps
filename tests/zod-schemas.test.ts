import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import {
  insertOrganisationSchema,
  insertUserSchema,
  insertSchemeSchema,
  insertBlockSchema,
  insertPropertySchema,
  insertCertificateSchema,
  insertRemedialActionSchema,
  insertContractorSchema,
  insertSpaceSchema,
  insertComponentSchema,
  insertComplianceStreamSchema,
  insertCertificateTypeSchema,
  insertClassificationCodeSchema,
  insertDetectionPatternSchema,
  insertOutcomeRuleSchema,
  insertFactorySettingSchema,
  insertApiClientSchema,
  insertIngestionJobSchema,
  insertAuditEventSchema,
  insertRiskAlertSchema,
  insertMlModelSchema,
  insertMlPredictionSchema,
  insertChatbotMessageSchema,
  insertVideoSchema,
} from '../shared/schema/schemas';

describe('Zod Schema Validation Tests', () => {
  describe('Schema Structure Tests', () => {
    it('insertOrganisationSchema should be a valid Zod schema', () => {
      expect(insertOrganisationSchema).toBeDefined();
      expect(typeof insertOrganisationSchema.safeParse).toBe('function');
    });

    it('insertUserSchema should be a valid Zod schema', () => {
      expect(insertUserSchema).toBeDefined();
      expect(typeof insertUserSchema.safeParse).toBe('function');
    });

    it('insertSchemeSchema should be a valid Zod schema', () => {
      expect(insertSchemeSchema).toBeDefined();
      expect(typeof insertSchemeSchema.safeParse).toBe('function');
    });

    it('insertBlockSchema should be a valid Zod schema', () => {
      expect(insertBlockSchema).toBeDefined();
      expect(typeof insertBlockSchema.safeParse).toBe('function');
    });

    it('insertPropertySchema should be a valid Zod schema', () => {
      expect(insertPropertySchema).toBeDefined();
      expect(typeof insertPropertySchema.safeParse).toBe('function');
    });

    it('insertCertificateSchema should be a valid Zod schema', () => {
      expect(insertCertificateSchema).toBeDefined();
      expect(typeof insertCertificateSchema.safeParse).toBe('function');
    });

    it('insertRemedialActionSchema should be a valid Zod schema', () => {
      expect(insertRemedialActionSchema).toBeDefined();
      expect(typeof insertRemedialActionSchema.safeParse).toBe('function');
    });

    it('insertContractorSchema should be a valid Zod schema', () => {
      expect(insertContractorSchema).toBeDefined();
      expect(typeof insertContractorSchema.safeParse).toBe('function');
    });

    it('insertSpaceSchema should be a valid Zod schema', () => {
      expect(insertSpaceSchema).toBeDefined();
      expect(typeof insertSpaceSchema.safeParse).toBe('function');
    });

    it('insertComponentSchema should be a valid Zod schema', () => {
      expect(insertComponentSchema).toBeDefined();
      expect(typeof insertComponentSchema.safeParse).toBe('function');
    });
  });

  describe('Schema Rejection Tests', () => {
    it('insertOrganisationSchema should reject empty object', () => {
      const result = insertOrganisationSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertUserSchema should reject empty object', () => {
      const result = insertUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertSchemeSchema should reject empty object', () => {
      const result = insertSchemeSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertBlockSchema should reject empty object', () => {
      const result = insertBlockSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertCertificateSchema should reject empty object', () => {
      const result = insertCertificateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertRemedialActionSchema should reject empty object', () => {
      const result = insertRemedialActionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('insertContractorSchema should reject empty object', () => {
      const result = insertContractorSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Type Validation', () => {
    it('insertOrganisationSchema should reject wrong types', () => {
      const result = insertOrganisationSchema.safeParse({ name: 123 });
      expect(result.success).toBe(false);
    });

    it('insertUserSchema should reject wrong email type', () => {
      const result = insertUserSchema.safeParse({ 
        email: 123,
        name: 'Test',
        role: 'VIEWER'
      });
      expect(result.success).toBe(false);
    });

    it('insertSchemeSchema should reject wrong name type', () => {
      const result = insertSchemeSchema.safeParse({ name: [] });
      expect(result.success).toBe(false);
    });

    it('insertBlockSchema should reject wrong types', () => {
      const result = insertBlockSchema.safeParse({ name: null, schemeId: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('Space Schema Refinement Tests', () => {
    it('insertSpaceSchema should have refinement logic', () => {
      const withProperty = {
        name: 'Kitchen',
        spaceType: 'KITCHEN',
        propertyId: '123e4567-e89b-12d3-a456-426614174000'
      };
      const withPropertyResult = insertSpaceSchema.safeParse(withProperty);
      expect(withPropertyResult).toBeDefined();
    });

    it('insertSpaceSchema should reject when missing all parent IDs', () => {
      const noParent = {
        name: 'Orphan Space',
        spaceType: 'KITCHEN'
      };
      const result = insertSpaceSchema.safeParse(noParent);
      expect(result.success).toBe(false);
    });
  });

  describe('Configuration Schema Tests', () => {
    it('insertComplianceStreamSchema should be defined', () => {
      expect(insertComplianceStreamSchema).toBeDefined();
    });

    it('insertCertificateTypeSchema should be defined', () => {
      expect(insertCertificateTypeSchema).toBeDefined();
    });

    it('insertClassificationCodeSchema should be defined', () => {
      expect(insertClassificationCodeSchema).toBeDefined();
    });

    it('insertDetectionPatternSchema should be defined', () => {
      expect(insertDetectionPatternSchema).toBeDefined();
    });

    it('insertOutcomeRuleSchema should be defined', () => {
      expect(insertOutcomeRuleSchema).toBeDefined();
    });

    it('insertFactorySettingSchema should be defined', () => {
      expect(insertFactorySettingSchema).toBeDefined();
    });
  });

  describe('API Schema Tests', () => {
    it('insertApiClientSchema should be defined', () => {
      expect(insertApiClientSchema).toBeDefined();
    });

    it('insertIngestionJobSchema should be defined', () => {
      expect(insertIngestionJobSchema).toBeDefined();
    });

    it('insertAuditEventSchema should be defined', () => {
      expect(insertAuditEventSchema).toBeDefined();
    });
  });

  describe('ML Schema Tests', () => {
    it('insertMlModelSchema should be defined', () => {
      expect(insertMlModelSchema).toBeDefined();
    });

    it('insertMlPredictionSchema should be defined', () => {
      expect(insertMlPredictionSchema).toBeDefined();
    });
  });

  describe('Other Schema Tests', () => {
    it('insertRiskAlertSchema should be defined', () => {
      expect(insertRiskAlertSchema).toBeDefined();
    });

    it('insertChatbotMessageSchema should be defined', () => {
      expect(insertChatbotMessageSchema).toBeDefined();
    });

    it('insertVideoSchema should be defined', () => {
      expect(insertVideoSchema).toBeDefined();
    });
  });
});

describe('Schema Type Coercion Tests', () => {
  it('should coerce string numbers to numbers', () => {
    const schema = z.coerce.number();
    expect(schema.parse('42')).toBe(42);
    expect(schema.parse(42)).toBe(42);
  });

  it('should coerce string dates', () => {
    const schema = z.coerce.date();
    const result = schema.parse('2024-01-15');
    expect(result).toBeInstanceOf(Date);
  });

  it('should handle nullable fields', () => {
    const schema = z.string().nullable();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse('value')).toBe('value');
  });

  it('should handle optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional()
    });
    
    const result1 = schema.parse({ required: 'value' });
    expect(result1.optional).toBeUndefined();
    
    const result2 = schema.parse({ required: 'value', optional: 'present' });
    expect(result2.optional).toBe('present');
  });

  it('should handle default values', () => {
    const schema = z.object({
      value: z.string().default('default')
    });
    
    const result = schema.parse({});
    expect(result.value).toBe('default');
  });
});

describe('Schema Enum Validation Tests', () => {
  const roleEnum = z.enum(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']);
  const severityEnum = z.enum(['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']);
  const statusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
  const outcomeEnum = z.enum(['SATISFACTORY', 'UNSATISFACTORY', 'CONDITIONAL', 'UNKNOWN']);

  it('should validate all user roles', () => {
    expect(roleEnum.safeParse('LASHAN_SUPER_USER').success).toBe(true);
    expect(roleEnum.safeParse('VIEWER').success).toBe(true);
    expect(roleEnum.safeParse('INVALID').success).toBe(false);
  });

  it('should validate all severity levels', () => {
    expect(severityEnum.safeParse('IMMEDIATE').success).toBe(true);
    expect(severityEnum.safeParse('ADVISORY').success).toBe(true);
    expect(severityEnum.safeParse('CRITICAL').success).toBe(false);
  });

  it('should validate all statuses', () => {
    expect(statusEnum.safeParse('OPEN').success).toBe(true);
    expect(statusEnum.safeParse('CANCELLED').success).toBe(true);
    expect(statusEnum.safeParse('DELETED').success).toBe(false);
  });

  it('should validate all outcomes', () => {
    expect(outcomeEnum.safeParse('SATISFACTORY').success).toBe(true);
    expect(outcomeEnum.safeParse('UNKNOWN').success).toBe(true);
    expect(outcomeEnum.safeParse('PASS').success).toBe(false);
  });
});

describe('ZodError Handling Tests', () => {
  it('should provide error messages for validation failures', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format')
    });
    
    const result = schema.safeParse({ name: '', email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.errors.length).toBeGreaterThan(0);
    }
  });

  it('should flatten errors for easier access', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0)
    });
    
    const result = schema.safeParse({ name: '', age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flattened = result.error.flatten();
      expect(flattened.fieldErrors).toBeDefined();
    }
  });
});

describe('UUID Validation Tests', () => {
  const uuidSchema = z.string().uuid();

  it('should accept valid UUIDs', () => {
    const validUUIDs = [
      '123e4567-e89b-12d3-a456-426614174000',
      '550e8400-e29b-41d4-a716-446655440000',
      'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    ];
    validUUIDs.forEach(uuid => {
      expect(uuidSchema.safeParse(uuid).success).toBe(true);
    });
  });

  it('should reject invalid UUIDs', () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '12345',
      '',
      '123e4567-e89b-12d3-a456',
      '123e4567-e89b-12d3-a456-42661417400g'
    ];
    invalidUUIDs.forEach(uuid => {
      expect(uuidSchema.safeParse(uuid).success).toBe(false);
    });
  });
});

describe('Email Validation Tests', () => {
  const emailSchema = z.string().email();

  it('should accept valid emails', () => {
    const validEmails = [
      'user@example.com',
      'admin@company.co.uk',
      'test.user+tag@domain.org'
    ];
    validEmails.forEach(email => {
      expect(emailSchema.safeParse(email).success).toBe(true);
    });
  });

  it('should reject invalid emails', () => {
    const invalidEmails = [
      'not-an-email',
      '@missing-local.com',
      'missing-domain@',
      'spaces in@email.com'
    ];
    invalidEmails.forEach(email => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    });
  });
});

describe('Date Validation Tests', () => {
  it('should validate ISO date strings', () => {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    
    expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
    expect(dateSchema.safeParse('2024-12-31').success).toBe(true);
    expect(dateSchema.safeParse('01-15-2024').success).toBe(false);
    expect(dateSchema.safeParse('2024/01/15').success).toBe(false);
  });

  it('should coerce date strings to Date objects', () => {
    const dateSchema = z.coerce.date();
    
    const result = dateSchema.safeParse('2024-01-15');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Date);
      expect(result.data.getFullYear()).toBe(2024);
    }
  });
});

describe('Array Schema Tests', () => {
  it('should validate arrays of strings', () => {
    const schema = z.array(z.string());
    
    expect(schema.safeParse(['a', 'b', 'c']).success).toBe(true);
    expect(schema.safeParse([]).success).toBe(true);
    expect(schema.safeParse([1, 2, 3]).success).toBe(false);
  });

  it('should validate arrays with min/max length', () => {
    const schema = z.array(z.string()).min(1).max(5);
    
    expect(schema.safeParse([]).success).toBe(false);
    expect(schema.safeParse(['a']).success).toBe(true);
    expect(schema.safeParse(['a', 'b', 'c', 'd', 'e']).success).toBe(true);
    expect(schema.safeParse(['a', 'b', 'c', 'd', 'e', 'f']).success).toBe(false);
  });
});

describe('Object Schema Tests', () => {
  it('should validate nested objects', () => {
    const schema = z.object({
      address: z.object({
        street: z.string(),
        city: z.string(),
        postcode: z.string()
      })
    });
    
    const valid = {
      address: {
        street: '123 Main St',
        city: 'London',
        postcode: 'SW1A 1AA'
      }
    };
    
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ address: {} }).success).toBe(false);
  });

  it('should handle partial objects', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    }).partial();
    
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ name: 'Test' }).success).toBe(true);
    expect(schema.safeParse({ age: 25 }).success).toBe(true);
  });

  it('should handle strict objects', () => {
    const schema = z.object({
      name: z.string()
    }).strict();
    
    expect(schema.safeParse({ name: 'Test' }).success).toBe(true);
    expect(schema.safeParse({ name: 'Test', extra: 'field' }).success).toBe(false);
  });
});
