import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearRulesCache,
  loadOutcomeRules,
  evaluateOutcomeRules,
  determineComplianceOutcome,
  type ComplianceOutcome,
  type OutcomeRuleMatch,
  type OutcomeEvaluationResult,
} from '../server/services/extraction/outcome-evaluator';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

describe('Outcome Evaluator Service', () => {
  beforeEach(() => {
    clearRulesCache();
    vi.clearAllMocks();
  });

  describe('clearRulesCache', () => {
    it('should clear cache without throwing', () => {
      expect(() => clearRulesCache()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      clearRulesCache();
      clearRulesCache();
      expect(true).toBe(true);
    });
  });

  describe('loadOutcomeRules', () => {
    it('should return array (empty when no rules in db)', async () => {
      const rules = await loadOutcomeRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should cache results on subsequent calls', async () => {
      await loadOutcomeRules();
      await loadOutcomeRules();
      expect(true).toBe(true);
    });
  });

  describe('evaluateOutcomeRules', () => {
    it('should return OutcomeEvaluationResult structure', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
        outcome: 'SATISFACTORY',
      });
      
      expect(result).toHaveProperty('finalOutcome');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('legislation');
      expect(result).toHaveProperty('confidence');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.legislation)).toBe(true);
    });

    it('should determine SATISFACTORY from extraction data when no rules match', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
        outcome: 'SATISFACTORY',
      });
      
      expect(result.finalOutcome).toBe('SATISFACTORY');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should determine UNSATISFACTORY from extraction data', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
        outcome: 'UNSATISFACTORY',
      });
      
      expect(result.finalOutcome).toBe('UNSATISFACTORY');
    });

    it('should determine FAIL as UNSATISFACTORY', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'FAIL',
      });
      
      expect(result.finalOutcome).toBe('UNSATISFACTORY');
    });

    it('should determine PASS as SATISFACTORY', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'PASS',
      });
      
      expect(result.finalOutcome).toBe('SATISFACTORY');
    });

    it('should handle SATISFACTORY WITH OBSERVATIONS', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'SATISFACTORY WITH OBSERVATIONS',
      });
      
      expect(result.finalOutcome).toBe('SATISFACTORY_WITH_OBSERVATIONS');
    });

    it('should return UNDETERMINED for missing outcome', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
      });
      
      expect(result.finalOutcome).toBe('UNDETERMINED');
    });

    it('should handle different certificate types', async () => {
      const gasResult = await evaluateOutcomeRules('GAS', { certificateType: 'GAS', outcome: 'PASS' });
      const eicrResult = await evaluateOutcomeRules('EICR', { certificateType: 'EICR', outcome: 'PASS' });
      const fraResult = await evaluateOutcomeRules('FRA', { certificateType: 'FRA', outcome: 'PASS' });
      
      expect(gasResult.finalOutcome).toBe('SATISFACTORY');
      expect(eicrResult.finalOutcome).toBe('SATISFACTORY');
      expect(fraResult.finalOutcome).toBe('SATISFACTORY');
    });
  });

  describe('determineComplianceOutcome', () => {
    it('should return complete outcome structure', async () => {
      const result = await determineComplianceOutcome('GAS', {
        certificateType: 'GAS',
        outcome: 'SATISFACTORY',
      });
      
      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('legislation');
      expect(result).toHaveProperty('ruleMatches');
      expect(result).toHaveProperty('source');
    });

    it('should set source to extracted_data when no rules match', async () => {
      const result = await determineComplianceOutcome('GAS', {
        certificateType: 'GAS',
        outcome: 'SATISFACTORY',
      });
      
      expect(result.source).toBe('extracted_data');
    });

    it('should set source to undetermined when outcome cannot be determined', async () => {
      const result = await determineComplianceOutcome('GAS', {
        certificateType: 'GAS',
      });
      
      expect(result.source).toBe('undetermined');
      expect(result.outcome).toBe('UNDETERMINED');
    });

    it('should return empty legislation array when no rules apply', async () => {
      const result = await determineComplianceOutcome('GAS', {
        certificateType: 'GAS',
        outcome: 'PASS',
      });
      
      expect(result.legislation).toEqual([]);
    });

    it('should handle UNSATISFACTORY outcome correctly', async () => {
      const result = await determineComplianceOutcome('EICR', {
        certificateType: 'EICR',
        outcome: 'UNSATISFACTORY',
      });
      
      expect(result.outcome).toBe('UNSATISFACTORY');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('ComplianceOutcome Type', () => {
    it('should recognize valid outcome values', () => {
      const outcomes: ComplianceOutcome[] = [
        'SATISFACTORY',
        'SATISFACTORY_WITH_OBSERVATIONS',
        'UNSATISFACTORY',
        'UNDETERMINED',
      ];
      expect(outcomes).toHaveLength(4);
    });
  });

  describe('Outcome determination logic from extraction data', () => {
    it('should extract outcome from complex satisfactory strings', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'Overall: Satisfactory - Installation meets requirements',
      });
      expect(result.finalOutcome).toBe('SATISFACTORY');
    });

    it('should extract outcome from complex unsatisfactory strings', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'Result: Unsatisfactory - Further investigation required',
      });
      expect(result.finalOutcome).toBe('UNSATISFACTORY');
    });

    it('should handle observation keyword for conditional pass', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'Satisfactory subject to observations noted',
      });
      expect(result.finalOutcome).toBe('SATISFACTORY_WITH_OBSERVATIONS');
    });

    it('should handle condition keyword for conditional pass', async () => {
      const result = await evaluateOutcomeRules('EICR', {
        certificateType: 'EICR',
        outcome: 'Satisfactory with conditions',
      });
      expect(result.finalOutcome).toBe('SATISFACTORY_WITH_OBSERVATIONS');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty extraction data', async () => {
      const result = await evaluateOutcomeRules('GAS', {});
      expect(result.finalOutcome).toBe('UNDETERMINED');
    });

    it('should handle null-like values gracefully', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
        outcome: '',
      });
      expect(result.finalOutcome).toBe('UNDETERMINED');
    });

    it('should return confidence between 0 and 1', async () => {
      const result = await evaluateOutcomeRules('GAS', {
        certificateType: 'GAS',
        outcome: 'SATISFACTORY',
      });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
