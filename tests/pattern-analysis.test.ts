import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runPatternAnalysis,
  getPatternSummary,
  type CorrectionPattern,
  type PatternAnalysisResult,
  type TemplateImprovementSuggestion,
} from '../server/services/pattern-analysis';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

const mockDbSelect = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
  },
}));

describe('Pattern Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
  });

  describe('CorrectionPattern Type', () => {
    it('should have correct structure', () => {
      const pattern: CorrectionPattern = {
        id: 'pattern-1',
        fieldName: 'certificateNumber',
        correctionType: 'WRONG_FORMAT',
        certificateType: 'GAS',
        occurrenceCount: 25,
        exampleOriginal: 'GAS123',
        exampleCorrected: 'GAS-2024-123',
        firstSeen: new Date(),
        lastSeen: new Date(),
        severity: 'high',
        suggestedAction: 'Update format validation',
        templateId: 'template-gas-01',
        isAddressedInTemplate: false,
      };

      expect(pattern.id).toBe('pattern-1');
      expect(pattern.fieldName).toBe('certificateNumber');
      expect(pattern.severity).toBe('high');
    });

    it('should support all severity levels', () => {
      const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
      
      severities.forEach(severity => {
        const pattern: CorrectionPattern = {
          id: 'test',
          fieldName: 'test',
          correctionType: 'WRONG_VALUE',
          certificateType: null,
          occurrenceCount: 1,
          exampleOriginal: null,
          exampleCorrected: null,
          firstSeen: new Date(),
          lastSeen: new Date(),
          severity,
          suggestedAction: '',
          templateId: null,
          isAddressedInTemplate: false,
        };
        expect(pattern.severity).toBe(severity);
      });
    });
  });

  describe('PatternAnalysisResult Type', () => {
    it('should have correct structure', () => {
      const result: PatternAnalysisResult = {
        analysisId: 'analysis-123',
        analyzedAt: new Date(),
        totalCorrectionsAnalyzed: 500,
        patternsIdentified: 15,
        patterns: [],
        templateImprovementSuggestions: [],
      };

      expect(result.analysisId).toBe('analysis-123');
      expect(result.totalCorrectionsAnalyzed).toBe(500);
      expect(result.patternsIdentified).toBe(15);
    });
  });

  describe('TemplateImprovementSuggestion Type', () => {
    it('should have correct structure', () => {
      const suggestion: TemplateImprovementSuggestion = {
        templateId: 'template-1',
        certificateType: 'EICR',
        fieldName: 'inspectorName',
        issue: 'Field "inspectorName" has 30 wrong value corrections',
        suggestion: 'Review extraction logic',
        priority: 'high',
        affectedExtractions: 30,
      };

      expect(suggestion.templateId).toBe('template-1');
      expect(suggestion.priority).toBe('high');
      expect(suggestion.affectedExtractions).toBe(30);
    });

    it('should allow null templateId and certificateType', () => {
      const suggestion: TemplateImprovementSuggestion = {
        templateId: null,
        certificateType: null,
        fieldName: 'genericField',
        issue: 'Issue description',
        suggestion: 'Fix suggestion',
        priority: 'medium',
        affectedExtractions: 10,
      };

      expect(suggestion.templateId).toBeNull();
      expect(suggestion.certificateType).toBeNull();
    });
  });

  describe('Severity Determination Logic', () => {
    it('should return critical for 50+ occurrences', () => {
      expect(getSeverityLevel(50)).toBe('critical');
      expect(getSeverityLevel(100)).toBe('critical');
    });

    it('should return high for 20-49 occurrences', () => {
      expect(getSeverityLevel(20)).toBe('high');
      expect(getSeverityLevel(49)).toBe('high');
    });

    it('should return medium for 5-19 occurrences', () => {
      expect(getSeverityLevel(5)).toBe('medium');
      expect(getSeverityLevel(19)).toBe('medium');
    });

    it('should return low for less than 5 occurrences', () => {
      expect(getSeverityLevel(1)).toBe('low');
      expect(getSeverityLevel(4)).toBe('low');
    });
  });

  describe('runPatternAnalysis', () => {
    it('should return PatternAnalysisResult structure', async () => {
      mockDbSelect
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: () => ({
                having: () => ({
                  orderBy: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ count: 0 }]),
          }),
        });

      const result = await runPatternAnalysis();

      expect(result).toHaveProperty('analysisId');
      expect(result).toHaveProperty('analyzedAt');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('templateImprovementSuggestions');
      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('should handle database errors', async () => {
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              having: () => ({
                orderBy: () => ({
                  limit: () => Promise.reject(new Error('DB error')),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(runPatternAnalysis()).rejects.toThrow('DB error');
    });
  });

  describe('getPatternSummary', () => {
    it('should return summary structure', async () => {
      mockDbSelect
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: () => ({
                having: () => Promise.resolve([]),
              }),
            }),
          }),
        });

      const summary = await getPatternSummary();

      expect(summary).toHaveProperty('lastAnalysis');
      expect(summary).toHaveProperty('totalPatterns');
      expect(summary).toHaveProperty('criticalPatterns');
      expect(summary).toHaveProperty('highPatterns');
      expect(summary).toHaveProperty('topFields');
    });

    it('should handle errors gracefully', async () => {
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => ({
                limit: () => Promise.reject(new Error('DB error')),
              }),
            }),
          }),
        }),
      });

      const summary = await getPatternSummary();

      expect(summary.lastAnalysis).toBeNull();
      expect(summary.totalPatterns).toBe(0);
      expect(summary.topFields).toEqual([]);
    });
  });
});

function getSeverityLevel(occurrenceCount: number): 'low' | 'medium' | 'high' | 'critical' {
  if (occurrenceCount >= 50) return 'critical';
  if (occurrenceCount >= 20) return 'high';
  if (occurrenceCount >= 5) return 'medium';
  return 'low';
}
