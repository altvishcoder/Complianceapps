import { db } from '../db';
import { fieldConfidenceScores, autoApprovalThresholds, confidenceBaselines, humanReviews } from '@shared/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { logger } from '../logger';

export interface FieldConfidence {
  fieldName: string;
  confidence: number;
  extractedValue: string | null;
}

export async function recordFieldConfidenceScores(
  extractionRunId: string,
  certificateType: string,
  fields: FieldConfidence[]
): Promise<void> {
  if (fields.length === 0) return;

  try {
    await db.insert(fieldConfidenceScores).values(
      fields.map(field => ({
        extractionRunId,
        certificateType,
        fieldName: field.fieldName,
        confidenceScore: field.confidence,
        extractedValue: field.extractedValue,
        wasCorrected: false,
      }))
    );
    
    logger.debug({ extractionRunId, fieldCount: fields.length }, 'Recorded field confidence scores');
  } catch (error) {
    logger.error({ error, extractionRunId }, 'Failed to record field confidence scores');
  }
}

export async function recordFieldCorrection(
  extractionRunId: string,
  fieldName: string,
  correctedValue: string,
  correctionReason?: string
): Promise<void> {
  try {
    await db.update(fieldConfidenceScores)
      .set({
        correctedValue,
        wasCorrected: true,
        correctionReason,
      })
      .where(and(
        eq(fieldConfidenceScores.extractionRunId, extractionRunId),
        eq(fieldConfidenceScores.fieldName, fieldName)
      ));
    
    logger.debug({ extractionRunId, fieldName }, 'Recorded field correction');
  } catch (error) {
    logger.error({ error, extractionRunId, fieldName }, 'Failed to record field correction');
  }
}

export async function updateConfidenceBaselines(): Promise<void> {
  try {
    const stats = await db.execute(sql`
      INSERT INTO confidence_baselines (id, certificate_type, field_name, sample_count, avg_confidence, median_confidence, correction_count, accuracy_rate, recommended_threshold, last_updated_at)
      SELECT 
        gen_random_uuid()::varchar,
        certificate_type,
        field_name,
        count(*)::integer as sample_count,
        avg(confidence_score)::real as avg_confidence,
        percentile_cont(0.5) within group (order by confidence_score)::real as median_confidence,
        sum(case when was_corrected then 1 else 0 end)::integer as correction_count,
        (1.0 - (sum(case when was_corrected then 1 else 0 end)::float / nullif(count(*), 0)))::real as accuracy_rate,
        CASE 
          WHEN (1.0 - (sum(case when was_corrected then 1 else 0 end)::float / nullif(count(*), 0))) >= 0.95 THEN 0.85
          WHEN (1.0 - (sum(case when was_corrected then 1 else 0 end)::float / nullif(count(*), 0))) >= 0.90 THEN 0.90
          ELSE 0.95
        END::real as recommended_threshold,
        now() as last_updated_at
      FROM field_confidence_scores
      GROUP BY certificate_type, field_name
      HAVING count(*) >= 10
      ON CONFLICT (certificate_type, field_name) 
      DO UPDATE SET
        sample_count = EXCLUDED.sample_count,
        avg_confidence = EXCLUDED.avg_confidence,
        median_confidence = EXCLUDED.median_confidence,
        correction_count = EXCLUDED.correction_count,
        accuracy_rate = EXCLUDED.accuracy_rate,
        recommended_threshold = EXCLUDED.recommended_threshold,
        last_updated_at = EXCLUDED.last_updated_at
    `);
    
    logger.info('Updated confidence baselines from field score data');
  } catch (error) {
    logger.warn({ error }, 'Failed to update confidence baselines - table may need unique constraint');
  }
}

export interface AutoApprovalResult {
  canAutoApprove: boolean;
  reason: string;
  fieldsBelowThreshold: string[];
  overallConfidence: number;
}

export async function checkAutoApprovalEligibility(
  certificateType: string,
  fieldConfidences: FieldConfidence[],
  organisationId?: string
): Promise<AutoApprovalResult> {
  try {
    const thresholds = await db.select()
      .from(autoApprovalThresholds)
      .where(and(
        eq(autoApprovalThresholds.certificateType, certificateType),
        eq(autoApprovalThresholds.isEnabled, true),
        organisationId 
          ? eq(autoApprovalThresholds.organisationId, organisationId)
          : sql`${autoApprovalThresholds.organisationId} IS NULL`
      ));
    
    if (thresholds.length === 0) {
      return {
        canAutoApprove: false,
        reason: 'No auto-approval thresholds configured for this certificate type',
        fieldsBelowThreshold: [],
        overallConfidence: calculateOverallConfidence(fieldConfidences),
      };
    }
    
    const thresholdMap = new Map<string, number>();
    let globalThreshold = 0.9;
    
    for (const threshold of thresholds) {
      if (threshold.fieldName) {
        thresholdMap.set(threshold.fieldName, threshold.minConfidenceThreshold);
      } else {
        globalThreshold = threshold.minConfidenceThreshold;
      }
    }
    
    const fieldsBelowThreshold: string[] = [];
    
    for (const field of fieldConfidences) {
      const requiredThreshold = thresholdMap.get(field.fieldName) || globalThreshold;
      if (field.confidence < requiredThreshold) {
        fieldsBelowThreshold.push(field.fieldName);
      }
    }
    
    const overallConfidence = calculateOverallConfidence(fieldConfidences);
    
    if (fieldsBelowThreshold.length > 0) {
      return {
        canAutoApprove: false,
        reason: `${fieldsBelowThreshold.length} field(s) below confidence threshold`,
        fieldsBelowThreshold,
        overallConfidence,
      };
    }
    
    return {
      canAutoApprove: true,
      reason: 'All fields meet confidence thresholds',
      fieldsBelowThreshold: [],
      overallConfidence,
    };
  } catch (error) {
    logger.error({ error, certificateType }, 'Failed to check auto-approval eligibility');
    return {
      canAutoApprove: false,
      reason: 'Error checking auto-approval eligibility',
      fieldsBelowThreshold: [],
      overallConfidence: 0,
    };
  }
}

function calculateOverallConfidence(fields: FieldConfidence[]): number {
  if (fields.length === 0) return 0;
  return fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
}

export async function getConfidenceStats(certificateType?: string): Promise<{
  totalSamples: number;
  avgAccuracy: number;
  fieldStats: Array<{
    fieldName: string;
    sampleCount: number;
    avgConfidence: number;
    accuracyRate: number;
    recommendedThreshold: number;
  }>;
}> {
  try {
    const baselines = await db.select()
      .from(confidenceBaselines)
      .where(certificateType ? eq(confidenceBaselines.certificateType, certificateType) : sql`1=1`);
    
    const totalSamples = baselines.reduce((sum, b) => sum + b.sampleCount, 0);
    const avgAccuracy = baselines.length > 0
      ? baselines.reduce((sum, b) => sum + (b.accuracyRate || 0), 0) / baselines.length
      : 0;
    
    return {
      totalSamples,
      avgAccuracy,
      fieldStats: baselines.map(b => ({
        fieldName: b.fieldName,
        sampleCount: b.sampleCount,
        avgConfidence: b.avgConfidence,
        accuracyRate: b.accuracyRate || 0,
        recommendedThreshold: b.recommendedThreshold || 0.9,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get confidence stats');
    return { totalSamples: 0, avgAccuracy: 0, fieldStats: [] };
  }
}
