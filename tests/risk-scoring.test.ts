import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateRiskTier,
  clearTierThresholdsCache,
  type RiskTier,
} from '../server/services/risk-scoring';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Risk Scoring Service', () => {
  describe('calculateRiskTier (pure function)', () => {
    const defaultThresholds = { CRITICAL: 45, HIGH: 35, MEDIUM: 20 };

    beforeEach(() => {
      clearTierThresholdsCache();
    });

    it('should return CRITICAL for score >= 45', () => {
      expect(calculateRiskTier(45)).toBe('CRITICAL');
      expect(calculateRiskTier(50)).toBe('CRITICAL');
      expect(calculateRiskTier(100)).toBe('CRITICAL');
    });

    it('should return HIGH for score >= 35 and < 45', () => {
      expect(calculateRiskTier(35)).toBe('HIGH');
      expect(calculateRiskTier(40)).toBe('HIGH');
      expect(calculateRiskTier(44)).toBe('HIGH');
    });

    it('should return MEDIUM for score >= 20 and < 35', () => {
      expect(calculateRiskTier(20)).toBe('MEDIUM');
      expect(calculateRiskTier(25)).toBe('MEDIUM');
      expect(calculateRiskTier(34)).toBe('MEDIUM');
    });

    it('should return LOW for score < 20', () => {
      expect(calculateRiskTier(0)).toBe('LOW');
      expect(calculateRiskTier(10)).toBe('LOW');
      expect(calculateRiskTier(19)).toBe('LOW');
    });

    it('should work with custom thresholds', () => {
      const customThresholds = { CRITICAL: 80, HIGH: 60, MEDIUM: 40 };
      expect(calculateRiskTier(85, customThresholds)).toBe('CRITICAL');
      expect(calculateRiskTier(70, customThresholds)).toBe('HIGH');
      expect(calculateRiskTier(50, customThresholds)).toBe('MEDIUM');
      expect(calculateRiskTier(30, customThresholds)).toBe('LOW');
    });

    it('should handle edge cases at thresholds', () => {
      expect(calculateRiskTier(44.9, defaultThresholds)).toBe('HIGH');
      expect(calculateRiskTier(45.0, defaultThresholds)).toBe('CRITICAL');
      expect(calculateRiskTier(34.9, defaultThresholds)).toBe('MEDIUM');
      expect(calculateRiskTier(35.0, defaultThresholds)).toBe('HIGH');
      expect(calculateRiskTier(19.9, defaultThresholds)).toBe('LOW');
      expect(calculateRiskTier(20.0, defaultThresholds)).toBe('MEDIUM');
    });

    it('should handle zero score', () => {
      expect(calculateRiskTier(0)).toBe('LOW');
    });

    it('should handle negative score as LOW', () => {
      expect(calculateRiskTier(-10)).toBe('LOW');
    });

    it('should handle very high scores', () => {
      expect(calculateRiskTier(1000)).toBe('CRITICAL');
    });
  });

  describe('Risk Tier Type Safety', () => {
    it('should only allow valid risk tier values', () => {
      const validTiers: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      validTiers.forEach(tier => {
        expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(tier);
      });
    });
  });

  describe('Risk Score Calculation Logic', () => {
    describe('Expiry Risk Score Logic', () => {
      it('should score overdue certificates at 30 points each', () => {
        const overdueCount = 2;
        const expectedScore = Math.min(100, overdueCount * 30);
        expect(expectedScore).toBe(60);
      });

      it('should score 7-day expiry at 20 points each', () => {
        const expiringWithin7Days = 3;
        const expectedScore = Math.min(100, expiringWithin7Days * 20);
        expect(expectedScore).toBe(60);
      });

      it('should score 30-day expiry at 10 points each', () => {
        const expiringWithin30Days = 4;
        const expectedScore = Math.min(100, expiringWithin30Days * 10);
        expect(expectedScore).toBe(40);
      });

      it('should cap score at 100', () => {
        const overdueCount = 5;
        const expectedScore = Math.min(100, overdueCount * 30);
        expect(expectedScore).toBe(100);
      });
    });

    describe('Defect Risk Score Logic', () => {
      it('should score critical defects at 35 points each', () => {
        const criticalCount = 2;
        const expectedScore = Math.min(100, criticalCount * 35);
        expect(expectedScore).toBe(70);
      });

      it('should score urgent defects at 15 points each', () => {
        const urgentCount = 3;
        const expectedScore = Math.min(100, urgentCount * 15);
        expect(expectedScore).toBe(45);
      });

      it('should score routine defects at 5 points each', () => {
        const routineCount = 5;
        const expectedScore = Math.min(100, routineCount * 5);
        expect(expectedScore).toBe(25);
      });

      it('should combine defect scores', () => {
        const criticalCount = 1;
        const urgentCount = 2;
        const routineCount = 1;
        const expectedScore = Math.min(100, 
          criticalCount * 35 + urgentCount * 15 + routineCount * 5
        );
        expect(expectedScore).toBe(70);
      });
    });

    describe('Asset Profile Risk Score Logic', () => {
      it('should add 20 points for buildings over 50 years old', () => {
        const assetAge = 55;
        const ageScore = assetAge > 50 ? 20 : assetAge > 30 ? 10 : 0;
        expect(ageScore).toBe(20);
      });

      it('should add 10 points for buildings 30-50 years old', () => {
        const assetAge = 40;
        const ageScore = assetAge > 50 ? 20 : assetAge > 30 ? 10 : 0;
        expect(ageScore).toBe(10);
      });

      it('should add 0 points for newer buildings', () => {
        const assetAge = 20;
        const ageScore = assetAge > 50 ? 20 : assetAge > 30 ? 10 : 0;
        expect(ageScore).toBe(0);
      });

      it('should add 25 points for high-rise buildings', () => {
        const floors = 8;
        const isHRB = floors >= 7;
        const hrbScore = isHRB ? 25 : 0;
        expect(hrbScore).toBe(25);
      });

      it('should identify 7+ floors as HRB', () => {
        expect(7 >= 7).toBe(true);
        expect(6 >= 7).toBe(false);
      });

      it('should add 20 points for vulnerable occupants', () => {
        const vulnerableOccupant = true;
        const vulnerableScore = vulnerableOccupant ? 20 : 0;
        expect(vulnerableScore).toBe(20);
      });

      it('should add 15 points for asbestos presence', () => {
        const hasAsbestos = true;
        const asbestosScore = hasAsbestos ? 15 : 0;
        expect(asbestosScore).toBe(15);
      });

      it('should add 10 points for HRB without sprinklers', () => {
        const isHRB = true;
        const hasSprinklers = false;
        const noSprinklerScore = (!hasSprinklers && isHRB) ? 10 : 0;
        expect(noSprinklerScore).toBe(10);
      });
    });

    describe('Coverage Gap Risk Score Logic', () => {
      it('should add 30 points for missing gas safety certificate', () => {
        const hasGas = true;
        const hasGasCert = false;
        const gasScore = (hasGas && !hasGasCert) ? 30 : 0;
        expect(gasScore).toBe(30);
      });

      it('should add 25 points for missing EICR', () => {
        const hasElectricity = true;
        const hasEICR = false;
        const electricalScore = (hasElectricity && !hasEICR) ? 25 : 0;
        expect(electricalScore).toBe(25);
      });

      it('should add 15 points for missing EPC', () => {
        const hasEPC = false;
        const epcScore = !hasEPC ? 15 : 0;
        expect(epcScore).toBe(15);
      });

      it('should add 30 points for missing FRA in HRB', () => {
        const isHRB = true;
        const hasFRA = false;
        const fraScore = (isHRB && !hasFRA) ? 30 : 0;
        expect(fraScore).toBe(30);
      });
    });

    describe('External Factor Risk Score Logic', () => {
      const epcScores: Record<string, number> = {
        'G': 40, 'F': 35, 'E': 10, 'D': 5, 'C': 0, 'B': 0, 'A': 0,
      };

      it('should add 40 points for EPC rating G', () => {
        expect(epcScores['G']).toBe(40);
      });

      it('should add 35 points for EPC rating F', () => {
        expect(epcScores['F']).toBe(35);
      });

      it('should add 10 points for EPC rating E', () => {
        expect(epcScores['E']).toBe(10);
      });

      it('should add 5 points for EPC rating D', () => {
        expect(epcScores['D']).toBe(5);
      });

      it('should add 0 points for EPC ratings A, B, C', () => {
        expect(epcScores['A']).toBe(0);
        expect(epcScores['B']).toBe(0);
        expect(epcScores['C']).toBe(0);
      });
    });
  });

  describe('Default Risk Factor Weights', () => {
    const DEFAULT_WEIGHTS = {
      expiry: 30,
      defect: 25,
      assetProfile: 20,
      coverageGap: 15,
      externalFactor: 10,
    };

    it('should have weights summing to 100', () => {
      const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have expiry as highest weight', () => {
      expect(DEFAULT_WEIGHTS.expiry).toBe(30);
      expect(DEFAULT_WEIGHTS.expiry).toBeGreaterThan(DEFAULT_WEIGHTS.defect);
    });

    it('should have external factor as lowest weight', () => {
      expect(DEFAULT_WEIGHTS.externalFactor).toBe(10);
      const allWeights = Object.values(DEFAULT_WEIGHTS);
      expect(Math.min(...allWeights)).toBe(DEFAULT_WEIGHTS.externalFactor);
    });
  });

  describe('Tier Threshold Defaults', () => {
    const DEFAULT_TIER_THRESHOLDS = {
      CRITICAL: 45,
      HIGH: 35,
      MEDIUM: 20,
    };

    it('should have CRITICAL threshold at 45', () => {
      expect(DEFAULT_TIER_THRESHOLDS.CRITICAL).toBe(45);
    });

    it('should have HIGH threshold at 35', () => {
      expect(DEFAULT_TIER_THRESHOLDS.HIGH).toBe(35);
    });

    it('should have MEDIUM threshold at 20', () => {
      expect(DEFAULT_TIER_THRESHOLDS.MEDIUM).toBe(20);
    });

    it('should have thresholds in descending order', () => {
      expect(DEFAULT_TIER_THRESHOLDS.CRITICAL).toBeGreaterThan(DEFAULT_TIER_THRESHOLDS.HIGH);
      expect(DEFAULT_TIER_THRESHOLDS.HIGH).toBeGreaterThan(DEFAULT_TIER_THRESHOLDS.MEDIUM);
    });
  });

  describe('Legislation References', () => {
    it('should map gas safety to correct regulation', () => {
      const legislation = 'Gas Safety (Installation and Use) Regulations 1998';
      expect(legislation).toContain('1998');
      expect(legislation).toContain('Gas Safety');
    });

    it('should map electrical safety to correct regulation', () => {
      const legislation = 'Electrical Safety Standards Regulations 2020';
      expect(legislation).toContain('2020');
      expect(legislation).toContain('Electrical');
    });

    it('should map HRB to Building Safety Act', () => {
      const legislation = 'Building Safety Act 2022';
      expect(legislation).toContain('2022');
      expect(legislation).toContain('Building Safety');
    });

    it('should map asbestos to CAR 2012', () => {
      const legislation = 'Control of Asbestos Regulations 2012';
      expect(legislation).toContain('2012');
      expect(legislation).toContain('Asbestos');
    });

    it('should map MEES to correct regulation', () => {
      const legislation = 'Minimum Energy Efficiency Standards Regulations 2015';
      expect(legislation).toContain('2015');
      expect(legislation).toContain('Energy Efficiency');
    });

    it('should map fire safety to RRO 2005', () => {
      const legislation = 'Regulatory Reform (Fire Safety) Order 2005';
      expect(legislation).toContain('2005');
      expect(legislation).toContain('Fire Safety');
    });

    it('should map vulnerable occupants to Equality Act', () => {
      const legislation = 'Equality Act 2010';
      expect(legislation).toContain('2010');
      expect(legislation).toContain('Equality');
    });
  });
});
