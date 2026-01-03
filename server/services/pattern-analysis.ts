import { db } from '../db';
import { extractionCorrections } from '@shared/schema';
import { sql, desc, count, gte } from 'drizzle-orm';
import { logger } from '../logger';

const analysisLogger = logger.child({ component: 'pattern-analysis' });

export interface CorrectionPattern {
  id: string;
  fieldName: string;
  correctionType: string;
  certificateType: string | null;
  occurrenceCount: number;
  exampleOriginal: string | null;
  exampleCorrected: string | null;
  firstSeen: Date;
  lastSeen: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
  templateId: string | null;
  isAddressedInTemplate: boolean;
}

export interface PatternAnalysisResult {
  analysisId: string;
  analyzedAt: Date;
  totalCorrectionsAnalyzed: number;
  patternsIdentified: number;
  patterns: CorrectionPattern[];
  templateImprovementSuggestions: TemplateImprovementSuggestion[];
}

export interface TemplateImprovementSuggestion {
  templateId: string | null;
  certificateType: string | null;
  fieldName: string;
  issue: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  affectedExtractions: number;
}

function determineSeverity(occurrenceCount: number): 'low' | 'medium' | 'high' | 'critical' {
  if (occurrenceCount >= 50) return 'critical';
  if (occurrenceCount >= 20) return 'high';
  if (occurrenceCount >= 5) return 'medium';
  return 'low';
}

function generateSuggestedAction(correctionType: string, fieldName: string, occurrenceCount: number): string {
  const actions: Record<string, string> = {
    'WRONG_FORMAT': `Update extraction schema to include format validation for ${fieldName}. Consider adding regex pattern matching.`,
    'WRONG_VALUE': `Review extraction logic for ${fieldName}. May need to add context clues or field boundary detection.`,
    'MISSING': `Improve field detection for ${fieldName}. Consider adding fallback extraction patterns.`,
    'EXTRA_TEXT': `Add text cleanup/trimming rules for ${fieldName}. Consider prefix/suffix removal patterns.`,
    'PARTIAL': `Enhance field boundary detection for ${fieldName}. May need multi-line capture or delimiter handling.`,
  };
  
  return actions[correctionType] || `Review extraction rules for ${fieldName} field.`;
}

export async function runPatternAnalysis(): Promise<PatternAnalysisResult> {
  const analysisId = `analysis-${Date.now()}`;
  analysisLogger.info({ analysisId }, 'Starting pattern analysis');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const patternQuery = await db
      .select({
        fieldName: extractionCorrections.fieldName,
        correctionType: extractionCorrections.correctionType,
        certificateType: extractionCorrections.certificateType,
        templateId: extractionCorrections.templateId,
        count: count(),
        exampleOriginal: sql<string>`MIN(${extractionCorrections.originalValue})`,
        exampleCorrected: sql<string>`MIN(${extractionCorrections.correctedValue})`,
        firstSeen: sql<Date>`MIN(${extractionCorrections.createdAt})`,
        lastSeen: sql<Date>`MAX(${extractionCorrections.createdAt})`,
      })
      .from(extractionCorrections)
      .where(gte(extractionCorrections.createdAt, thirtyDaysAgo))
      .groupBy(
        extractionCorrections.fieldName,
        extractionCorrections.correctionType,
        extractionCorrections.certificateType,
        extractionCorrections.templateId
      )
      .having(sql`count(*) >= 2`)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    const patterns: CorrectionPattern[] = patternQuery.map((row, index) => {
      const occurrenceCount = Number(row.count);
      const severity = determineSeverity(occurrenceCount);
      
      return {
        id: `pattern-${index + 1}`,
        fieldName: row.fieldName,
        correctionType: row.correctionType,
        certificateType: row.certificateType,
        occurrenceCount,
        exampleOriginal: row.exampleOriginal,
        exampleCorrected: row.exampleCorrected,
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen,
        severity,
        suggestedAction: generateSuggestedAction(row.correctionType, row.fieldName, occurrenceCount),
        templateId: row.templateId,
        isAddressedInTemplate: false,
      };
    });

    const templateSuggestions: TemplateImprovementSuggestion[] = patterns
      .filter(p => p.severity === 'high' || p.severity === 'critical')
      .map(p => ({
        templateId: p.templateId,
        certificateType: p.certificateType,
        fieldName: p.fieldName,
        issue: `Field "${p.fieldName}" has ${p.occurrenceCount} ${p.correctionType.toLowerCase().replace('_', ' ')} corrections`,
        suggestion: p.suggestedAction,
        priority: p.severity,
        affectedExtractions: p.occurrenceCount,
      }));

    const totalCorrections = await db
      .select({ count: count() })
      .from(extractionCorrections)
      .where(gte(extractionCorrections.createdAt, thirtyDaysAgo));

    const result: PatternAnalysisResult = {
      analysisId,
      analyzedAt: new Date(),
      totalCorrectionsAnalyzed: Number(totalCorrections[0]?.count || 0),
      patternsIdentified: patterns.length,
      patterns,
      templateImprovementSuggestions: templateSuggestions,
    };

    analysisLogger.info({
      analysisId,
      totalCorrectionsAnalyzed: result.totalCorrectionsAnalyzed,
      patternsIdentified: result.patternsIdentified,
      highPriorityPatterns: patterns.filter(p => p.severity === 'high' || p.severity === 'critical').length,
    }, 'Pattern analysis completed');

    return result;
    
  } catch (error) {
    analysisLogger.error({ error, analysisId }, 'Pattern analysis failed');
    throw error;
  }
}

export async function getPatternSummary(): Promise<{
  lastAnalysis: Date | null;
  totalPatterns: number;
  criticalPatterns: number;
  highPatterns: number;
  topFields: Array<{ field: string; count: number }>;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topFieldsQuery = await db
      .select({
        field: extractionCorrections.fieldName,
        count: count(),
      })
      .from(extractionCorrections)
      .where(gte(extractionCorrections.createdAt, thirtyDaysAgo))
      .groupBy(extractionCorrections.fieldName)
      .orderBy(desc(count()))
      .limit(5);

    const patternCounts = await db
      .select({
        fieldName: extractionCorrections.fieldName,
        correctionType: extractionCorrections.correctionType,
        count: count(),
      })
      .from(extractionCorrections)
      .where(gte(extractionCorrections.createdAt, thirtyDaysAgo))
      .groupBy(extractionCorrections.fieldName, extractionCorrections.correctionType)
      .having(sql`count(*) >= 2`);

    let criticalCount = 0;
    let highCount = 0;

    patternCounts.forEach(p => {
      const c = Number(p.count);
      if (c >= 50) criticalCount++;
      else if (c >= 20) highCount++;
    });

    return {
      lastAnalysis: new Date(),
      totalPatterns: patternCounts.length,
      criticalPatterns: criticalCount,
      highPatterns: highCount,
      topFields: topFieldsQuery.map(f => ({ field: f.field, count: Number(f.count) })),
    };
  } catch (error) {
    analysisLogger.error({ error }, 'Failed to get pattern summary');
    return {
      lastAnalysis: null,
      totalPatterns: 0,
      criticalPatterns: 0,
      highPatterns: 0,
      topFields: [],
    };
  }
}
