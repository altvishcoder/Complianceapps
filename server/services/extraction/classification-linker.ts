import { db } from '../../db';
import { classificationCodes, remedialActions, certificates, certificateTypes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExtractedCertificateData, DefectRecord, ApplianceRecord } from './types';
import { logger } from '../../logger';
import { determineComplianceOutcome, type ComplianceOutcome, type OutcomeRuleMatch } from './outcome-evaluator';

export interface ClassificationMatch {
  classificationCodeId: string;
  code: string;
  name: string;
  severity: string;
  actionSeverity: string | null;
  autoCreateAction: boolean;
  costEstimateLow: number | null;
  costEstimateHigh: number | null;
  actionRequired: string | null;
  timeframeHours: number | null;
  matchReason: string;
  sourceField: 'outcome' | 'defect' | 'appliance';
  sourceValue: string;
}

export interface RemedialActionInput {
  certificateId: string;
  propertyId: string;
  classificationCodeId: string;
  code: string;
  description: string;
  location: string;
  severity: 'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE' | 'ADVISORY';
  costEstimate: string | null;
  dueDate: Date;
  sourceField: string;
  sourceValue: string;
}

export interface LinkageResult {
  matches: ClassificationMatch[];
  actionsCreated: number;
  actionsSkipped: number;
  errors: string[];
}

export async function linkExtractionToClassifications(
  certificateId: string,
  extractionData: ExtractedCertificateData,
  certificateType: string
): Promise<LinkageResult> {
  const result: LinkageResult = {
    matches: [],
    actionsCreated: 0,
    actionsSkipped: 0,
    errors: [],
  };

  try {
    const certificate = await db.select().from(certificates).where(eq(certificates.id, certificateId)).limit(1);
    if (!certificate.length) {
      result.errors.push(`Certificate ${certificateId} not found`);
      return result;
    }

    const certRecord = certificate[0];
    const propertyId = certRecord.propertyId;

    const certTypeRecord = await db.select()
      .from(certificateTypes)
      .where(eq(certificateTypes.code, certificateType))
      .limit(1);
    
    const certificateTypeId = certTypeRecord[0]?.id;

    const allCodes = await db.select().from(classificationCodes)
      .where(
        certificateTypeId 
          ? eq(classificationCodes.certificateTypeId, certificateTypeId)
          : eq(classificationCodes.isActive, true)
      );

    const codeMap = new Map(allCodes.map(c => [c.code.toUpperCase(), c]));

    if (extractionData.outcome) {
      const outcomeMatches = matchOutcomeToClassifications(extractionData.outcome, codeMap);
      result.matches.push(...outcomeMatches);
    }

    if (extractionData.defects?.length) {
      for (const defect of extractionData.defects) {
        const defectMatches = matchDefectToClassifications(defect, codeMap);
        result.matches.push(...defectMatches);
      }
    }

    if (extractionData.appliances?.length) {
      for (const appliance of extractionData.appliances) {
        if (appliance.outcome && appliance.outcome !== 'PASS' && appliance.outcome !== 'N/A') {
          const applianceMatches = matchApplianceToClassifications(appliance, codeMap);
          result.matches.push(...applianceMatches);
        }
      }
    }

    for (const match of result.matches) {
      if (match.autoCreateAction) {
        try {
          const existingAction = await db.select()
            .from(remedialActions)
            .where(and(
              eq(remedialActions.certificateId, certificateId),
              eq(remedialActions.code, match.code)
            ))
            .limit(1);

          if (existingAction.length > 0) {
            result.actionsSkipped++;
            continue;
          }

          const severity = mapSeverity(match.actionSeverity || match.severity);
          const dueDate = calculateDueDate(severity, match.timeframeHours);
          const costEstimate = formatCostEstimate(match.costEstimateLow, match.costEstimateHigh);

          await db.insert(remedialActions).values({
            certificateId,
            propertyId,
            code: match.code,
            description: match.actionRequired || `${match.name} - ${match.matchReason}`,
            location: 'Property',
            severity,
            status: 'OPEN',
            costEstimate,
            dueDate: dueDate.toISOString().split('T')[0],
          });

          result.actionsCreated++;
          
          logger.info({
            certificateId,
            code: match.code,
            severity,
            sourceField: match.sourceField,
            sourceValue: match.sourceValue,
          }, 'Auto-created remedial action from classification code');

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to create action for ${match.code}: ${errorMsg}`);
          logger.error({ error, match }, 'Failed to create remedial action');
        }
      } else {
        result.actionsSkipped++;
      }
    }

    logger.info({
      certificateId,
      totalMatches: result.matches.length,
      actionsCreated: result.actionsCreated,
      actionsSkipped: result.actionsSkipped,
      errors: result.errors.length,
    }, 'Classification linking complete');

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Classification linking failed: ${errorMsg}`);
    logger.error({ error, certificateId }, 'Classification linking failed');
    return result;
  }
}

function matchOutcomeToClassifications(
  outcome: string,
  codeMap: Map<string, typeof classificationCodes.$inferSelect>
): ClassificationMatch[] {
  const matches: ClassificationMatch[] = [];
  const outcomeUpper = outcome.toUpperCase();

  const outcomeCodeMap: Record<string, string[]> = {
    'UNSATISFACTORY': ['UNSATISFACTORY', 'FAIL', 'C1', 'C2', 'ID', 'AR'],
    'FAIL': ['FAIL', 'UNSATISFACTORY', 'C1', 'C2'],
    'AT_RISK': ['AR', 'AT_RISK', 'C2'],
    'IMMEDIATELY_DANGEROUS': ['ID', 'C1', 'IMMEDIATELY_DANGEROUS'],
    'IMPROVEMENT_REQUIRED': ['C3', 'FI', 'IMPROVEMENT'],
    'NEEDS_ATTENTION': ['C2', 'C3', 'FI'],
  };

  const codesToCheck = outcomeCodeMap[outcomeUpper] || [];
  
  for (const codeKey of codesToCheck) {
    const code = codeMap.get(codeKey);
    if (code) {
      matches.push({
        classificationCodeId: code.id,
        code: code.code,
        name: code.name,
        severity: code.severity,
        actionSeverity: code.actionSeverity,
        autoCreateAction: code.autoCreateAction,
        costEstimateLow: code.costEstimateLow,
        costEstimateHigh: code.costEstimateHigh,
        actionRequired: code.actionRequired,
        timeframeHours: code.timeframeHours,
        matchReason: `Certificate outcome: ${outcome}`,
        sourceField: 'outcome',
        sourceValue: outcome,
      });
      break;
    }
  }

  return matches;
}

function matchDefectToClassifications(
  defect: DefectRecord,
  codeMap: Map<string, typeof classificationCodes.$inferSelect>
): ClassificationMatch[] {
  const matches: ClassificationMatch[] = [];

  if (defect.code) {
    const codeUpper = defect.code.toUpperCase();
    const code = codeMap.get(codeUpper);
    if (code) {
      matches.push({
        classificationCodeId: code.id,
        code: code.code,
        name: code.name,
        severity: code.severity,
        actionSeverity: code.actionSeverity,
        autoCreateAction: code.autoCreateAction,
        costEstimateLow: code.costEstimateLow,
        costEstimateHigh: code.costEstimateHigh,
        actionRequired: code.actionRequired,
        timeframeHours: code.timeframeHours,
        matchReason: `Defect code: ${defect.code}`,
        sourceField: 'defect',
        sourceValue: `${defect.code}: ${defect.description || 'No description'}`,
      });
    }
  }

  if (defect.priority && !matches.length) {
    const priorityCodeMap: Record<string, string[]> = {
      'IMMEDIATE': ['C1', 'ID', 'FD_FAIL'],
      'URGENT': ['C2', 'AR', 'FD_DEFECTIVE'],
      'PRIORITY': ['C3', 'FI'],
      'ROUTINE': ['C3', 'OBSERVATION'],
      'ADVISORY': ['FYI', 'OBSERVATION'],
    };

    const codesToCheck = priorityCodeMap[defect.priority.toUpperCase()] || [];
    for (const codeKey of codesToCheck) {
      const code = codeMap.get(codeKey);
      if (code) {
        matches.push({
          classificationCodeId: code.id,
          code: code.code,
          name: code.name,
          severity: code.severity,
          actionSeverity: code.actionSeverity,
          autoCreateAction: code.autoCreateAction,
          costEstimateLow: code.costEstimateLow,
          costEstimateHigh: code.costEstimateHigh,
          actionRequired: code.actionRequired,
          timeframeHours: code.timeframeHours,
          matchReason: `Defect priority: ${defect.priority}`,
          sourceField: 'defect',
          sourceValue: defect.description || 'Unknown defect',
        });
        break;
      }
    }
  }

  return matches;
}

function matchApplianceToClassifications(
  appliance: ApplianceRecord,
  codeMap: Map<string, typeof classificationCodes.$inferSelect>
): ClassificationMatch[] {
  const matches: ClassificationMatch[] = [];
  const outcomeUpper = appliance.outcome?.toUpperCase() || '';

  const outcomeCodeMap: Record<string, string[]> = {
    'FAIL': ['ID', 'C1', 'APPLIANCE_FAIL'],
    'AT_RISK': ['AR', 'C2', 'APPLIANCE_AT_RISK'],
    'NOT_TO_CURRENT_STANDARDS': ['NCS', 'C3', 'APPLIANCE_NCS'],
    'NCS': ['NCS', 'C3'],
    'ID': ['ID', 'C1'],
    'AR': ['AR', 'C2'],
  };

  const codesToCheck = outcomeCodeMap[outcomeUpper] || [];
  
  for (const codeKey of codesToCheck) {
    const code = codeMap.get(codeKey);
    if (code) {
      matches.push({
        classificationCodeId: code.id,
        code: code.code,
        name: code.name,
        severity: code.severity,
        actionSeverity: code.actionSeverity,
        autoCreateAction: code.autoCreateAction,
        costEstimateLow: code.costEstimateLow,
        costEstimateHigh: code.costEstimateHigh,
        actionRequired: code.actionRequired,
        timeframeHours: code.timeframeHours,
        matchReason: `Appliance outcome: ${appliance.outcome}`,
        sourceField: 'appliance',
        sourceValue: `${appliance.make || ''} ${appliance.model || ''} at ${appliance.location || 'unknown location'}`.trim(),
      });
      break;
    }
  }

  return matches;
}

function mapSeverity(severity: string): 'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE' | 'ADVISORY' {
  const severityUpper = severity?.toUpperCase() || 'ROUTINE';
  const validSeverities = ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY'];
  return validSeverities.includes(severityUpper) 
    ? severityUpper as 'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE' | 'ADVISORY'
    : 'ROUTINE';
}

function calculateDueDate(severity: string, timeframeHours: number | null): Date {
  const now = new Date();
  
  if (timeframeHours !== null && timeframeHours > 0) {
    return new Date(now.getTime() + timeframeHours * 60 * 60 * 1000);
  }

  const daysMap: Record<string, number> = {
    'IMMEDIATE': 1,
    'URGENT': 7,
    'PRIORITY': 28,
    'ROUTINE': 90,
    'ADVISORY': 180,
  };

  const days = daysMap[severity.toUpperCase()] || 90;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatCostEstimate(low: number | null, high: number | null): string | null {
  if (low === null && high === null) return null;
  
  const lowGBP = low ? (low / 100).toFixed(0) : '0';
  const highGBP = high ? (high / 100).toFixed(0) : lowGBP;
  
  return `£${lowGBP}-${highGBP}`;
}

export async function getClassificationCodesForCertificateType(
  certificateType: string
): Promise<typeof classificationCodes.$inferSelect[]> {
  const certTypeRecord = await db.select()
    .from(certificateTypes)
    .where(eq(certificateTypes.code, certificateType))
    .limit(1);

  if (!certTypeRecord.length) {
    return db.select().from(classificationCodes).where(eq(classificationCodes.isActive, true));
  }

  return db.select()
    .from(classificationCodes)
    .where(and(
      eq(classificationCodes.certificateTypeId, certTypeRecord[0].id),
      eq(classificationCodes.isActive, true)
    ));
}

export interface ComplianceEvaluationResult {
  outcome: ComplianceOutcome;
  confidence: number;
  legislation: string[];
  ruleMatches: OutcomeRuleMatch[];
  classificationMatches: ClassificationMatch[];
  actionsCreated: number;
  source: 'database_rules' | 'extracted_data' | 'classification_codes' | 'undetermined';
}

export async function evaluateComplianceAndLink(
  certificateId: string,
  extractionData: ExtractedCertificateData,
  certificateType: string
): Promise<ComplianceEvaluationResult> {
  const outcomeResult = await determineComplianceOutcome(certificateType, extractionData);
  
  const linkageResult = await linkExtractionToClassifications(
    certificateId,
    extractionData,
    certificateType
  );

  let finalOutcome = outcomeResult.outcome;
  let source: ComplianceEvaluationResult['source'] = outcomeResult.source;

  if (finalOutcome === 'UNDETERMINED' && linkageResult.matches.length > 0) {
    const hasUnsatisfactory = linkageResult.matches.some(
      m => m.severity === 'IMMEDIATE' || m.severity === 'URGENT'
    );
    const hasObservations = linkageResult.matches.some(
      m => m.severity === 'PRIORITY' || m.severity === 'ROUTINE'
    );

    if (hasUnsatisfactory) {
      finalOutcome = 'UNSATISFACTORY';
      source = 'classification_codes';
    } else if (hasObservations) {
      finalOutcome = 'SATISFACTORY_WITH_OBSERVATIONS';
      source = 'classification_codes';
    }
  }

  logger.info({
    certificateId,
    certificateType,
    outcome: finalOutcome,
    confidence: outcomeResult.confidence,
    ruleMatches: outcomeResult.ruleMatches.length,
    classificationMatches: linkageResult.matches.length,
    actionsCreated: linkageResult.actionsCreated,
    legislation: outcomeResult.legislation,
    source,
  }, 'Compliance evaluation complete');

  return {
    outcome: finalOutcome,
    confidence: outcomeResult.confidence,
    legislation: outcomeResult.legislation,
    ruleMatches: outcomeResult.ruleMatches,
    classificationMatches: linkageResult.matches,
    actionsCreated: linkageResult.actionsCreated,
    source,
  };
}

export { determineComplianceOutcome, type ComplianceOutcome, type OutcomeRuleMatch };
