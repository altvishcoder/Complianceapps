import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordFieldConfidenceScores,
  recordFieldCorrection,
  checkAutoApprovalEligibility,
  getConfidenceStats,
  type FieldConfidence,
  type AutoApprovalResult,
} from '../server/services/confidence-scoring';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
    select: () => mockDbSelect(),
  },
}));

describe('Confidence Scoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReset();
    mockDbUpdate.mockReset();
    mockDbSelect.mockReset();
  });

  describe('FieldConfidence Type', () => {
    it('should have correct structure', () => {
      const field: FieldConfidence = {
        fieldName: 'certificateNumber',
        confidence: 0.95,
        extractedValue: 'GAS-2024-001',
      };
      
      expect(field.fieldName).toBe('certificateNumber');
      expect(field.confidence).toBe(0.95);
      expect(field.extractedValue).toBe('GAS-2024-001');
    });

    it('should allow null extractedValue', () => {
      const field: FieldConfidence = {
        fieldName: 'optionalField',
        confidence: 0.5,
        extractedValue: null,
      };
      
      expect(field.extractedValue).toBeNull();
    });
  });

  describe('AutoApprovalResult Type', () => {
    it('should have correct structure for approval', () => {
      const result: AutoApprovalResult = {
        canAutoApprove: true,
        reason: 'All fields meet confidence thresholds',
        fieldsBelowThreshold: [],
        overallConfidence: 0.95,
      };
      
      expect(result.canAutoApprove).toBe(true);
      expect(result.fieldsBelowThreshold).toHaveLength(0);
    });

    it('should have correct structure for rejection', () => {
      const result: AutoApprovalResult = {
        canAutoApprove: false,
        reason: '2 field(s) below confidence threshold',
        fieldsBelowThreshold: ['certificateNumber', 'expiryDate'],
        overallConfidence: 0.75,
      };
      
      expect(result.canAutoApprove).toBe(false);
      expect(result.fieldsBelowThreshold).toHaveLength(2);
    });
  });

  describe('recordFieldConfidenceScores', () => {
    it('should return early for empty fields array', async () => {
      await recordFieldConfidenceScores('run-123', 'GAS', []);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should insert fields when array is not empty', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const fields: FieldConfidence[] = [
        { fieldName: 'certificateNumber', confidence: 0.95, extractedValue: 'GAS-001' },
      ];

      await recordFieldConfidenceScores('run-123', 'GAS', fields);
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should handle insert errors gracefully', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('DB error')),
      });

      const fields: FieldConfidence[] = [
        { fieldName: 'test', confidence: 0.9, extractedValue: 'value' },
      ];

      await expect(recordFieldConfidenceScores('run-123', 'GAS', fields)).resolves.not.toThrow();
    });
  });

  describe('recordFieldCorrection', () => {
    it('should update field with correction', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await recordFieldCorrection('run-123', 'certificateNumber', 'CORRECTED-VALUE', 'Typo');
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      await expect(recordFieldCorrection('run-123', 'field', 'value')).resolves.not.toThrow();
    });
  });

  describe('checkAutoApprovalEligibility', () => {
    it('should return cannot approve when no thresholds configured', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await checkAutoApprovalEligibility('GAS', [
        { fieldName: 'test', confidence: 0.95, extractedValue: 'value' },
      ]);

      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain('No auto-approval thresholds configured');
    });

    it('should return overallConfidence even when no thresholds', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await checkAutoApprovalEligibility('GAS', [
        { fieldName: 'field1', confidence: 0.9, extractedValue: 'v1' },
        { fieldName: 'field2', confidence: 0.8, extractedValue: 'v2' },
      ]);

      expect(result.overallConfidence).toBeCloseTo(0.85, 2);
    });

    it('should handle errors and return safe defaults', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const result = await checkAutoApprovalEligibility('GAS', []);

      expect(result.canAutoApprove).toBe(false);
      expect(result.reason).toContain('Error');
    });
  });

  describe('getConfidenceStats', () => {
    it('should return empty stats when no baselines exist', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const stats = await getConfidenceStats('GAS');

      expect(stats.totalSamples).toBe(0);
      expect(stats.avgAccuracy).toBe(0);
      expect(stats.fieldStats).toEqual([]);
    });

    it('should aggregate baseline statistics', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { fieldName: 'field1', sampleCount: 100, avgConfidence: 0.9, accuracyRate: 0.95, recommendedThreshold: 0.85 },
            { fieldName: 'field2', sampleCount: 50, avgConfidence: 0.85, accuracyRate: 0.92, recommendedThreshold: 0.90 },
          ]),
        }),
      });

      const stats = await getConfidenceStats('GAS');

      expect(stats.totalSamples).toBe(150);
      expect(stats.avgAccuracy).toBeCloseTo(0.935, 2);
      expect(stats.fieldStats).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const stats = await getConfidenceStats();

      expect(stats.totalSamples).toBe(0);
      expect(stats.avgAccuracy).toBe(0);
      expect(stats.fieldStats).toEqual([]);
    });
  });

  describe('Overall Confidence Calculation', () => {
    it('should calculate average of field confidences', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const fields: FieldConfidence[] = [
        { fieldName: 'field1', confidence: 0.9, extractedValue: null },
        { fieldName: 'field2', confidence: 0.8, extractedValue: null },
        { fieldName: 'field3', confidence: 0.7, extractedValue: null },
      ];

      const result = await checkAutoApprovalEligibility('GAS', fields);
      expect(result.overallConfidence).toBeCloseTo(0.8, 2);
    });

    it('should return 0 for empty fields', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await checkAutoApprovalEligibility('GAS', []);
      expect(result.overallConfidence).toBe(0);
    });
  });
});
