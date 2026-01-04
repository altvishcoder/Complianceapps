import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  validatePropertyRow,
  validateUnitRow,
  validateComponentRow,
} from '../server/import-parser';

describe('Import Parser', () => {
  describe('parseCSV', () => {
    it('should return empty array for content with only header', () => {
      const content = 'header1,header2,header3';
      expect(parseCSV(content)).toEqual([]);
    });

    it('should return empty array for empty content', () => {
      expect(parseCSV('')).toEqual([]);
    });

    it('should parse simple CSV', () => {
      const content = `name,age,city
John,30,London
Jane,25,Manchester`;
      const result = parseCSV(content);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'John', age: '30', city: 'London' });
      expect(result[1]).toEqual({ name: 'Jane', age: '25', city: 'Manchester' });
    });

    it('should handle quoted values', () => {
      const content = `name,address,notes
"John Smith","123 Main St, London","Has pets, needs notice"
Jane,"456 Oak Ave",Simple`;
      const result = parseCSV(content);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Smith');
      expect(result[0].address).toBe('123 Main St, London');
      expect(result[0].notes).toBe('Has pets, needs notice');
    });

    it('should handle empty values', () => {
      const content = `a,b,c
1,,3
,2,`;
      const result = parseCSV(content);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ a: '1', b: '', c: '3' });
      expect(result[1]).toEqual({ a: '', b: '2', c: '' });
    });

    it('should handle escaped quotes', () => {
      const content = `text
"He said ""hello"""`;
      const result = parseCSV(content);
      expect(result).toHaveLength(1);
      expect(result[0].text).toContain('He said');
      expect(result[0].text).toContain('hello');
    });

    it('should include rows with only header values', () => {
      const content = `name
John

Jane`;
      const result = parseCSV(content);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('John');
      expect(result[1].name).toBe('');
      expect(result[2].name).toBe('Jane');
    });
  });

  describe('validatePropertyRow', () => {
    it('should validate a complete property row', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
        bedrooms: '2',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require UPRN', () => {
      const row = {
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'uprn')).toBe(true);
    });

    it('should require addressLine1', () => {
      const row = {
        uprn: '100012345678',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'addressLine1')).toBe(true);
    });

    it('should require city', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'city')).toBe(true);
    });

    it('should require postcode', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'postcode')).toBe(true);
    });

    it('should validate propertyType against allowed values', () => {
      const validTypes = ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO'];
      for (const type of validTypes) {
        const row = {
          uprn: '100012345678',
          addressLine1: '123 Test Street',
          city: 'London',
          postcode: 'SW1A 1AA',
          propertyType: type,
          tenure: 'SOCIAL_RENT',
          blockReference: 'BLK-001',
        };
        const result = validatePropertyRow(row, 1);
        expect(result.errors.some(e => e.field === 'propertyType')).toBe(false);
      }
    });

    it('should reject invalid propertyType', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'MANSION',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'propertyType')).toBe(true);
    });

    it('should validate tenure against allowed values', () => {
      const validTenures = ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY'];
      for (const tenure of validTenures) {
        const row = {
          uprn: '100012345678',
          addressLine1: '123 Test Street',
          city: 'London',
          postcode: 'SW1A 1AA',
          propertyType: 'FLAT',
          tenure,
          blockReference: 'BLK-001',
        };
        const result = validatePropertyRow(row, 1);
        expect(result.errors.some(e => e.field === 'tenure')).toBe(false);
      }
    });

    it('should reject invalid tenure', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'FREEHOLD',
        blockReference: 'BLK-001',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'tenure')).toBe(true);
    });

    it('should require blockReference', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'blockReference')).toBe(true);
    });

    it('should validate bedrooms as number when provided', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
        bedrooms: 'two',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.errors.some(e => e.field === 'bedrooms')).toBe(true);
    });

    it('should accept numeric bedrooms', () => {
      const row = {
        uprn: '100012345678',
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        propertyType: 'FLAT',
        tenure: 'SOCIAL_RENT',
        blockReference: 'BLK-001',
        bedrooms: '3',
      };
      const result = validatePropertyRow(row, 1);
      expect(result.errors.some(e => e.field === 'bedrooms')).toBe(false);
    });

    it('should include row number in result', () => {
      const row = { uprn: '123' };
      const result = validatePropertyRow(row, 42);
      expect(result.rowNumber).toBe(42);
    });
  });

  describe('validateUnitRow', () => {
    it('should validate a complete unit row', () => {
      const row = {
        propertyUprn: '100012345678',
        name: 'Kitchen',
        unitType: 'KITCHEN',
      };
      const result = validateUnitRow(row, 1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require propertyUprn', () => {
      const row = {
        name: 'Kitchen',
        unitType: 'KITCHEN',
      };
      const result = validateUnitRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'propertyUprn')).toBe(true);
    });

    it('should require name', () => {
      const row = {
        propertyUprn: '100012345678',
        unitType: 'KITCHEN',
      };
      const result = validateUnitRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should validate unitType against allowed values', () => {
      const validTypes = ['KITCHEN', 'BEDROOM', 'BATHROOM', 'LIVING_ROOM', 'COMMUNAL', 'HALLWAY', 'STORAGE', 'UTILITY'];
      for (const unitType of validTypes) {
        const row = {
          propertyUprn: '100012345678',
          name: 'Test Unit',
          unitType,
        };
        const result = validateUnitRow(row, 1);
        expect(result.errors.some(e => e.field === 'unitType')).toBe(false);
      }
    });

    it('should reject invalid unitType', () => {
      const row = {
        propertyUprn: '100012345678',
        name: 'Test Unit',
        unitType: 'GARAGE',
      };
      const result = validateUnitRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'unitType')).toBe(true);
    });
  });

  describe('validateComponentRow', () => {
    it('should validate a complete component row with propertyUprn', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
        condition: 'GOOD',
        installDate: '2020-01-15',
      };
      const result = validateComponentRow(row, 1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete component row with unitReference', () => {
      const row = {
        unitReference: 'UNIT-001',
        componentTypeCode: 'SMOKE_ALARM',
        condition: 'FAIR',
      };
      const result = validateComponentRow(row, 1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require either propertyUprn or unitReference', () => {
      const row = {
        componentTypeCode: 'BOILER',
        condition: 'GOOD',
      };
      const result = validateComponentRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'propertyUprn')).toBe(true);
    });

    it('should require componentTypeCode', () => {
      const row = {
        propertyUprn: '100012345678',
        condition: 'GOOD',
      };
      const result = validateComponentRow(row, 1);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'componentTypeCode')).toBe(true);
    });

    it('should validate condition against allowed values', () => {
      const validConditions = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];
      for (const condition of validConditions) {
        const row = {
          propertyUprn: '100012345678',
          componentTypeCode: 'BOILER',
          condition,
        };
        const result = validateComponentRow(row, 1);
        expect(result.errors.some(e => e.field === 'condition')).toBe(false);
      }
    });

    it('should reject invalid condition', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
        condition: 'EXCELLENT',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'condition')).toBe(true);
    });

    it('should allow missing condition', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'condition')).toBe(false);
    });

    it('should validate installDate format', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
        installDate: '2020-01-15',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'installDate')).toBe(false);
    });

    it('should reject invalid date format', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
        installDate: '15/01/2020',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'installDate')).toBe(true);
    });

    it('should reject invalid date values', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
        installDate: '2020-13-45',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'installDate')).toBe(true);
    });

    it('should allow missing installDate', () => {
      const row = {
        propertyUprn: '100012345678',
        componentTypeCode: 'BOILER',
      };
      const result = validateComponentRow(row, 1);
      expect(result.errors.some(e => e.field === 'installDate')).toBe(false);
    });
  });
});
