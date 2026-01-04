import { describe, it, expect } from 'vitest';
import {
  calculateCompositeScore,
  calculateStreamCompliance,
  determineTrend,
  mapDefectCodeToSeverity,
  aggregateRiskScores,
  STREAM_WEIGHTS,
  DEFECT_PENALTIES,
} from '../client/src/lib/risk/calculator';
import type { StreamScore, DefectCounts, RiskScore } from '../client/src/lib/risk/types';

describe('Risk Calculator', () => {
  describe('STREAM_WEIGHTS', () => {
    it('should have weights for all compliance streams', () => {
      expect(STREAM_WEIGHTS.gas).toBe(0.25);
      expect(STREAM_WEIGHTS.electrical).toBe(0.20);
      expect(STREAM_WEIGHTS.fire).toBe(0.25);
      expect(STREAM_WEIGHTS.asbestos).toBe(0.15);
      expect(STREAM_WEIGHTS.lift).toBe(0.10);
      expect(STREAM_WEIGHTS.water).toBe(0.05);
    });

    it('should sum to 1.0', () => {
      const total = Object.values(STREAM_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(total).toBe(1.0);
    });
  });

  describe('DEFECT_PENALTIES', () => {
    it('should have correct penalty values', () => {
      expect(DEFECT_PENALTIES.critical).toBe(15);
      expect(DEFECT_PENALTIES.major).toBe(5);
      expect(DEFECT_PENALTIES.minor).toBe(1);
    });
  });

  describe('calculateStreamCompliance', () => {
    it('should return 1 when total is 0', () => {
      expect(calculateStreamCompliance(0, 0)).toBe(1);
    });

    it('should return correct ratio', () => {
      expect(calculateStreamCompliance(8, 10)).toBe(0.8);
      expect(calculateStreamCompliance(10, 10)).toBe(1);
      expect(calculateStreamCompliance(0, 10)).toBe(0);
      expect(calculateStreamCompliance(5, 20)).toBe(0.25);
    });
  });

  describe('determineTrend', () => {
    it('should return stable when previousScore is null', () => {
      expect(determineTrend(80, null)).toBe('stable');
    });

    it('should return stable when previousScore is undefined', () => {
      expect(determineTrend(80, undefined)).toBe('stable');
    });

    it('should return improving when score increased by more than 2', () => {
      expect(determineTrend(85, 80)).toBe('improving');
      expect(determineTrend(90, 85)).toBe('improving');
    });

    it('should return deteriorating when score decreased by more than 2', () => {
      expect(determineTrend(75, 80)).toBe('deteriorating');
      expect(determineTrend(70, 85)).toBe('deteriorating');
    });

    it('should return stable when change is within threshold', () => {
      expect(determineTrend(81, 80)).toBe('stable');
      expect(determineTrend(79, 80)).toBe('stable');
      expect(determineTrend(82, 80)).toBe('stable');
      expect(determineTrend(78, 80)).toBe('stable');
    });
  });

  describe('mapDefectCodeToSeverity', () => {
    describe('gas stream codes', () => {
      it('should map ID to critical', () => {
        expect(mapDefectCodeToSeverity('ID', 'gas')).toBe('critical');
        expect(mapDefectCodeToSeverity('id', 'gas')).toBe('critical');
        expect(mapDefectCodeToSeverity('Immediately Dangerous', 'gas')).toBe('critical');
      });

      it('should map AR to major', () => {
        expect(mapDefectCodeToSeverity('AR', 'gas')).toBe('major');
        expect(mapDefectCodeToSeverity('At Risk', 'gas')).toBe('major');
      });

      it('should map NCS to minor', () => {
        expect(mapDefectCodeToSeverity('NCS', 'gas')).toBe('minor');
        expect(mapDefectCodeToSeverity('Not to Current Standards', 'gas')).toBe('minor');
      });
    });

    describe('electrical stream codes', () => {
      it('should map C1 to critical', () => {
        expect(mapDefectCodeToSeverity('C1', 'electrical')).toBe('critical');
        expect(mapDefectCodeToSeverity('Code 1', 'electrical')).toBe('critical');
      });

      it('should map C2 to major', () => {
        expect(mapDefectCodeToSeverity('C2', 'electrical')).toBe('major');
        expect(mapDefectCodeToSeverity('Code 2', 'electrical')).toBe('major');
      });

      it('should map C3 and FI to minor', () => {
        expect(mapDefectCodeToSeverity('C3', 'electrical')).toBe('minor');
        expect(mapDefectCodeToSeverity('FI', 'electrical')).toBe('minor');
        expect(mapDefectCodeToSeverity('Further Investigation', 'electrical')).toBe('minor');
      });
    });

    describe('fire stream codes', () => {
      it('should map high risk codes to critical', () => {
        expect(mapDefectCodeToSeverity('INTOLERABLE', 'fire')).toBe('critical');
        expect(mapDefectCodeToSeverity('HIGH', 'fire')).toBe('critical');
      });

      it('should map medium risk codes to major', () => {
        expect(mapDefectCodeToSeverity('SUBSTANTIAL', 'fire')).toBe('major');
        expect(mapDefectCodeToSeverity('MEDIUM', 'fire')).toBe('major');
      });

      it('should map low risk codes to minor', () => {
        expect(mapDefectCodeToSeverity('TOLERABLE', 'fire')).toBe('minor');
        expect(mapDefectCodeToSeverity('LOW', 'fire')).toBe('minor');
        expect(mapDefectCodeToSeverity('ADVISORY', 'fire')).toBe('minor');
      });
    });

    describe('generic codes', () => {
      it('should map CRITICAL/URGENT to critical', () => {
        expect(mapDefectCodeToSeverity('CRITICAL ISSUE', 'asbestos')).toBe('critical');
        expect(mapDefectCodeToSeverity('URGENT REPAIR', 'lift')).toBe('critical');
      });

      it('should map MAJOR/SIGNIFICANT to major', () => {
        expect(mapDefectCodeToSeverity('MAJOR DEFECT', 'water')).toBe('major');
        expect(mapDefectCodeToSeverity('SIGNIFICANT DAMAGE', 'asbestos')).toBe('major');
      });

      it('should default to minor for unknown codes', () => {
        expect(mapDefectCodeToSeverity('UNKNOWN', 'gas')).toBe('minor');
        expect(mapDefectCodeToSeverity('OBSERVATION', 'fire')).toBe('minor');
      });
    });
  });

  describe('calculateCompositeScore', () => {
    it('should return 100 when no streams', () => {
      const defects: DefectCounts = { critical: 0, major: 0, minor: 0 };
      expect(calculateCompositeScore([], defects)).toBe(100);
    });

    it('should calculate weighted score from streams', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 1, total: 10, compliant: 10, overdueCount: 0, dueSoonCount: 0 },
        { stream: 'electrical', compliance: 1, total: 10, compliant: 10, overdueCount: 0, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 0, major: 0, minor: 0 };
      expect(calculateCompositeScore(streams, defects)).toBe(100);
    });

    it('should apply defect penalties', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 1, total: 10, compliant: 10, overdueCount: 0, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 1, major: 0, minor: 0 };
      expect(calculateCompositeScore(streams, defects)).toBe(85);
    });

    it('should apply multiple defect penalties', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 1, total: 10, compliant: 10, overdueCount: 0, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 1, major: 2, minor: 5 };
      const expected = 100 - 15 - 10 - 5;
      expect(calculateCompositeScore(streams, defects)).toBe(expected);
    });

    it('should not go below 0', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 0.1, total: 10, compliant: 1, overdueCount: 9, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 10, major: 10, minor: 10 };
      expect(calculateCompositeScore(streams, defects)).toBe(0);
    });

    it('should not exceed 100', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 1.5, total: 10, compliant: 15, overdueCount: 0, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 0, major: 0, minor: 0 };
      expect(calculateCompositeScore(streams, defects)).toBeLessThanOrEqual(100);
    });

    it('should handle partial compliance', () => {
      const streams: StreamScore[] = [
        { stream: 'gas', compliance: 0.5, total: 10, compliant: 5, overdueCount: 5, dueSoonCount: 0 },
        { stream: 'electrical', compliance: 0.8, total: 10, compliant: 8, overdueCount: 2, dueSoonCount: 0 },
      ];
      const defects: DefectCounts = { critical: 0, major: 0, minor: 0 };
      const result = calculateCompositeScore(streams, defects);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });
  });

  describe('aggregateRiskScores', () => {
    it('should return default score for empty array', () => {
      const result = aggregateRiskScores([]);
      expect(result.compositeScore).toBe(100);
      expect(result.streams).toEqual([]);
      expect(result.defects).toEqual({ critical: 0, major: 0, minor: 0 });
      expect(result.trend).toBe('stable');
      expect(result.propertyCount).toBe(0);
      expect(result.unitCount).toBe(0);
    });

    it('should aggregate property and unit counts', () => {
      const scores: RiskScore[] = [
        {
          compositeScore: 80,
          streams: [],
          defects: { critical: 0, major: 0, minor: 0 },
          trend: 'stable',
          propertyCount: 10,
          unitCount: 50,
        },
        {
          compositeScore: 90,
          streams: [],
          defects: { critical: 0, major: 0, minor: 0 },
          trend: 'stable',
          propertyCount: 15,
          unitCount: 75,
        },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.propertyCount).toBe(25);
      expect(result.unitCount).toBe(125);
    });

    it('should aggregate defects', () => {
      const scores: RiskScore[] = [
        {
          compositeScore: 80,
          streams: [],
          defects: { critical: 2, major: 3, minor: 5 },
          trend: 'stable',
          propertyCount: 10,
          unitCount: 50,
        },
        {
          compositeScore: 90,
          streams: [],
          defects: { critical: 1, major: 2, minor: 3 },
          trend: 'stable',
          propertyCount: 15,
          unitCount: 75,
        },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.defects.critical).toBe(3);
      expect(result.defects.major).toBe(5);
      expect(result.defects.minor).toBe(8);
    });

    it('should aggregate stream scores', () => {
      const scores: RiskScore[] = [
        {
          compositeScore: 80,
          streams: [
            { stream: 'gas', compliance: 0.8, total: 10, compliant: 8, overdueCount: 2, dueSoonCount: 1 },
          ],
          defects: { critical: 0, major: 0, minor: 0 },
          trend: 'stable',
          propertyCount: 10,
          unitCount: 50,
        },
        {
          compositeScore: 90,
          streams: [
            { stream: 'gas', compliance: 0.9, total: 10, compliant: 9, overdueCount: 1, dueSoonCount: 0 },
          ],
          defects: { critical: 0, major: 0, minor: 0 },
          trend: 'stable',
          propertyCount: 15,
          unitCount: 75,
        },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.streams).toHaveLength(1);
      const gasStream = result.streams.find(s => s.stream === 'gas');
      expect(gasStream).toBeDefined();
      expect(gasStream!.total).toBe(20);
      expect(gasStream!.compliant).toBe(17);
      expect(gasStream!.overdueCount).toBe(3);
      expect(gasStream!.dueSoonCount).toBe(1);
    });

    it('should determine aggregate trend as improving', () => {
      const scores: RiskScore[] = [
        { compositeScore: 80, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'improving', propertyCount: 1, unitCount: 1 },
        { compositeScore: 85, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'improving', propertyCount: 1, unitCount: 1 },
        { compositeScore: 90, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'improving', propertyCount: 1, unitCount: 1 },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.trend).toBe('improving');
    });

    it('should determine aggregate trend as deteriorating', () => {
      const scores: RiskScore[] = [
        { compositeScore: 80, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'deteriorating', propertyCount: 1, unitCount: 1 },
        { compositeScore: 75, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'deteriorating', propertyCount: 1, unitCount: 1 },
        { compositeScore: 70, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'deteriorating', propertyCount: 1, unitCount: 1 },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.trend).toBe('deteriorating');
    });

    it('should determine aggregate trend as stable when mixed', () => {
      const scores: RiskScore[] = [
        { compositeScore: 80, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'improving', propertyCount: 1, unitCount: 1 },
        { compositeScore: 75, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'deteriorating', propertyCount: 1, unitCount: 1 },
        { compositeScore: 85, streams: [], defects: { critical: 0, major: 0, minor: 0 }, trend: 'stable', propertyCount: 1, unitCount: 1 },
      ];
      const result = aggregateRiskScores(scores);
      expect(result.trend).toBe('stable');
    });
  });
});
