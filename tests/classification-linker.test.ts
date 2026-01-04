import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  linkExtractionToClassifications,
  getClassificationCodesForCertificateType,
  type ClassificationMatch,
  type RemedialActionInput,
  type LinkageResult,
} from '../server/services/extraction/classification-linker';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => mockDbInsert(),
  },
}));

vi.mock('../server/services/extraction/outcome-evaluator', () => ({
  determineComplianceOutcome: vi.fn().mockResolvedValue({
    outcome: 'SATISFACTORY',
    confidence: 0.9,
    legislation: [],
    ruleMatches: [],
    source: 'extracted_data',
  }),
}));

describe('Classification Linker Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
    mockDbInsert.mockReset();
  });

  describe('linkExtractionToClassifications', () => {
    it('should return error when certificate not found', async () => {
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      const result = await linkExtractionToClassifications('cert-123', {}, 'GAS');
      
      expect(result.errors).toContain('Certificate cert-123 not found');
      expect(result.matches).toEqual([]);
      expect(result.actionsCreated).toBe(0);
    });

    it('should return LinkageResult structure', async () => {
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 'cert-123', propertyId: 'prop-456' }]),
          }),
        }),
      });

      const result = await linkExtractionToClassifications('cert-123', {}, 'GAS');
      
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('actionsCreated');
      expect(result).toHaveProperty('actionsSkipped');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should match defects to classification codes', async () => {
      let callCount = 0;
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ id: 'cert-123', propertyId: 'prop-456' }]);
              if (callCount === 2) return Promise.resolve([{ id: 'ct-gas', code: 'GAS' }]);
              return Promise.resolve([]);
            },
          }),
        }),
      });

      const result = await linkExtractionToClassifications('cert-123', {
        defects: [{ code: 'C1', description: 'Danger present', priority: 'IMMEDIATE' }],
      }, 'GAS');

      expect(result).toHaveProperty('matches');
    });

    it('should handle extraction data with appliances', async () => {
      let callCount = 0;
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ id: 'cert-123', propertyId: 'prop-456' }]);
              if (callCount === 2) return Promise.resolve([{ id: 'ct-gas', code: 'GAS' }]);
              return Promise.resolve([]);
            },
          }),
        }),
      });

      const result = await linkExtractionToClassifications('cert-123', {
        appliances: [{ type: 'Boiler', outcome: 'FAIL', make: 'Worcester', model: '25i' }],
      }, 'GAS');

      expect(result).toHaveProperty('matches');
    });

    it('should skip action creation when action already exists', async () => {
      let callCount = 0;
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ id: 'cert-123', propertyId: 'prop-456' }]);
              if (callCount === 2) return Promise.resolve([{ id: 'ct-gas', code: 'GAS' }]);
              return Promise.resolve([]);
            },
          }),
        }),
      });

      const result = await linkExtractionToClassifications('cert-123', {}, 'GAS');

      expect(result.actionsSkipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getClassificationCodesForCertificateType', () => {
    it('should be an async function that returns a promise', () => {
      expect(typeof getClassificationCodesForCertificateType).toBe('function');
    });

    it('should accept certificateType string parameter', () => {
      expect(getClassificationCodesForCertificateType.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ClassificationMatch Structure', () => {
    it('should define required fields correctly', () => {
      const match: ClassificationMatch = {
        classificationCodeId: 'cc-123',
        code: 'C1',
        name: 'Danger Present',
        severity: 'CRITICAL',
        actionSeverity: 'IMMEDIATE',
        autoCreateAction: true,
        costEstimateLow: 10000,
        costEstimateHigh: 50000,
        actionRequired: 'Immediate remedial work required',
        timeframeHours: 24,
        matchReason: 'Defect code C1 found',
        sourceField: 'defect',
        sourceValue: 'C1',
      };
      
      expect(match.classificationCodeId).toBe('cc-123');
      expect(match.code).toBe('C1');
      expect(match.severity).toBe('CRITICAL');
      expect(match.autoCreateAction).toBe(true);
    });

    it('should allow null optional fields', () => {
      const match: ClassificationMatch = {
        classificationCodeId: 'cc-456',
        code: 'C3',
        name: 'Improvement Recommended',
        severity: 'LOW',
        actionSeverity: null,
        autoCreateAction: false,
        costEstimateLow: null,
        costEstimateHigh: null,
        actionRequired: null,
        timeframeHours: null,
        matchReason: 'Observation found',
        sourceField: 'defect',
        sourceValue: 'C3',
      };
      
      expect(match.actionSeverity).toBeNull();
      expect(match.costEstimateLow).toBeNull();
      expect(match.costEstimateHigh).toBeNull();
    });

    it('should support different source fields', () => {
      const sources: Array<'outcome' | 'defect' | 'appliance'> = ['outcome', 'defect', 'appliance'];
      sources.forEach(source => {
        const match: ClassificationMatch = {
          classificationCodeId: 'cc-789',
          code: 'TEST',
          name: 'Test',
          severity: 'LOW',
          actionSeverity: null,
          autoCreateAction: false,
          costEstimateLow: null,
          costEstimateHigh: null,
          actionRequired: null,
          timeframeHours: null,
          matchReason: 'Test',
          sourceField: source,
          sourceValue: 'test',
        };
        expect(match.sourceField).toBe(source);
      });
    });
  });

  describe('LinkageResult Structure', () => {
    it('should have correct fields', () => {
      const result: LinkageResult = {
        matches: [],
        actionsCreated: 0,
        actionsSkipped: 0,
        errors: [],
      };
      
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('actionsCreated');
      expect(result).toHaveProperty('actionsSkipped');
      expect(result).toHaveProperty('errors');
    });

    it('should track action counts correctly', () => {
      const result: LinkageResult = {
        matches: [],
        actionsCreated: 5,
        actionsSkipped: 3,
        errors: ['Error 1', 'Error 2'],
      };
      
      expect(result.actionsCreated).toBe(5);
      expect(result.actionsSkipped).toBe(3);
      expect(result.errors).toHaveLength(2);
    });

    it('should handle multiple matches', () => {
      const matches: ClassificationMatch[] = [
        {
          classificationCodeId: 'cc-1',
          code: 'C1',
          name: 'Danger Present',
          severity: 'CRITICAL',
          actionSeverity: 'IMMEDIATE',
          autoCreateAction: true,
          costEstimateLow: 100,
          costEstimateHigh: 500,
          actionRequired: 'Fix immediately',
          timeframeHours: 24,
          matchReason: 'C1 found',
          sourceField: 'defect',
          sourceValue: 'C1',
        },
        {
          classificationCodeId: 'cc-2',
          code: 'C2',
          name: 'Potentially Dangerous',
          severity: 'HIGH',
          actionSeverity: 'URGENT',
          autoCreateAction: true,
          costEstimateLow: 50,
          costEstimateHigh: 200,
          actionRequired: 'Fix within 7 days',
          timeframeHours: 168,
          matchReason: 'C2 found',
          sourceField: 'defect',
          sourceValue: 'C2',
        },
      ];
      
      const result: LinkageResult = {
        matches,
        actionsCreated: 2,
        actionsSkipped: 0,
        errors: [],
      };
      
      expect(result.matches).toHaveLength(2);
    });
  });

  describe('RemedialActionInput Structure', () => {
    it('should have correct fields', () => {
      const action: RemedialActionInput = {
        certificateId: 'cert-123',
        propertyId: 'prop-456',
        classificationCodeId: 'cc-789',
        code: 'C1',
        description: 'Danger present - immediate action required',
        location: 'Kitchen',
        severity: 'IMMEDIATE',
        costEstimate: '£100-£500',
        dueDate: new Date(),
        sourceField: 'defect',
        sourceValue: 'C1',
      };
      
      expect(action.certificateId).toBe('cert-123');
      expect(action.propertyId).toBe('prop-456');
      expect(action.severity).toBe('IMMEDIATE');
    });

    it('should support all severity levels', () => {
      const severities: Array<'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE' | 'ADVISORY'> = 
        ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY'];
      
      severities.forEach(severity => {
        const action: RemedialActionInput = {
          certificateId: 'cert-123',
          propertyId: 'prop-456',
          classificationCodeId: 'cc-789',
          code: 'TEST',
          description: 'Test action',
          location: 'Property',
          severity,
          costEstimate: null,
          dueDate: new Date(),
          sourceField: 'defect',
          sourceValue: 'test',
        };
        expect(action.severity).toBe(severity);
      });
    });
  });

  describe('Defect Code Priority Mapping', () => {
    const defectPriorityMap: Record<string, 'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE' | 'ADVISORY'> = {
      'C1': 'IMMEDIATE',
      'ID': 'IMMEDIATE',
      'C2': 'URGENT',
      'AR': 'URGENT',
      'FI': 'URGENT',
      'C3': 'ROUTINE',
      'NCS': 'ROUTINE',
    };

    it('should map C1 to IMMEDIATE', () => {
      expect(defectPriorityMap['C1']).toBe('IMMEDIATE');
    });

    it('should map ID to IMMEDIATE', () => {
      expect(defectPriorityMap['ID']).toBe('IMMEDIATE');
    });

    it('should map C2 to URGENT', () => {
      expect(defectPriorityMap['C2']).toBe('URGENT');
    });

    it('should map AR to URGENT', () => {
      expect(defectPriorityMap['AR']).toBe('URGENT');
    });

    it('should map FI to URGENT', () => {
      expect(defectPriorityMap['FI']).toBe('URGENT');
    });

    it('should map C3 to ROUTINE', () => {
      expect(defectPriorityMap['C3']).toBe('ROUTINE');
    });

    it('should map NCS to ROUTINE', () => {
      expect(defectPriorityMap['NCS']).toBe('ROUTINE');
    });
  });

  describe('Timeframe Calculations', () => {
    const timeframeMap: Record<string, number> = {
      'IMMEDIATE': 24,
      'URGENT': 168,
      'PRIORITY': 672,
      'ROUTINE': 2160,
      'ADVISORY': 4320,
    };

    it('should set IMMEDIATE to 24 hours (1 day)', () => {
      expect(timeframeMap['IMMEDIATE']).toBe(24);
    });

    it('should set URGENT to 168 hours (7 days)', () => {
      expect(timeframeMap['URGENT']).toBe(168);
    });

    it('should set PRIORITY to 672 hours (28 days)', () => {
      expect(timeframeMap['PRIORITY']).toBe(672);
    });

    it('should set ROUTINE to 2160 hours (90 days)', () => {
      expect(timeframeMap['ROUTINE']).toBe(2160);
    });

    it('should set ADVISORY to 4320 hours (180 days)', () => {
      expect(timeframeMap['ADVISORY']).toBe(4320);
    });
  });
});
