import { db } from '../../db';
import { certificateOutcomeRules } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ExtractedCertificateData, DefectRecord, ApplianceRecord } from './types';
import { logger } from '../../logger';

export type ComplianceOutcome = 'SATISFACTORY' | 'SATISFACTORY_WITH_OBSERVATIONS' | 'UNSATISFACTORY' | 'UNDETERMINED';

export interface OutcomeRuleMatch {
  ruleId: string;
  ruleName: string;
  ruleGroup: string | null;
  outcome: ComplianceOutcome;
  priority: number;
  legislation: string | null;
  matchReason: string;
  fieldPath: string;
  matchedValue: string;
}

export interface OutcomeEvaluationResult {
  finalOutcome: ComplianceOutcome;
  matches: OutcomeRuleMatch[];
  legislation: string[];
  confidence: number;
}

interface CachedRule {
  id: string;
  certificateTypeCode: string;
  ruleName: string;
  ruleGroup: string | null;
  fieldPath: string;
  operator: string;
  value: string | null;
  outcome: string;
  priority: number;
  description: string | null;
  legislation: string | null;
}

let rulesCache: CachedRule[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000;

export async function loadOutcomeRules(): Promise<CachedRule[]> {
  const now = Date.now();
  if (rulesCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return rulesCache;
  }

  try {
    const rules = await db.select({
      id: certificateOutcomeRules.id,
      certificateTypeCode: certificateOutcomeRules.certificateTypeCode,
      ruleName: certificateOutcomeRules.ruleName,
      ruleGroup: certificateOutcomeRules.ruleGroup,
      fieldPath: certificateOutcomeRules.fieldPath,
      operator: certificateOutcomeRules.operator,
      value: certificateOutcomeRules.value,
      outcome: certificateOutcomeRules.outcome,
      priority: certificateOutcomeRules.priority,
      description: certificateOutcomeRules.description,
      legislation: certificateOutcomeRules.legislation,
    })
    .from(certificateOutcomeRules)
    .where(eq(certificateOutcomeRules.isActive, true))
    .orderBy(desc(certificateOutcomeRules.priority));

    rulesCache = rules;
    cacheTimestamp = now;
    
    logger.debug({ ruleCount: rules.length }, 'Loaded outcome rules from database');
    return rules;
  } catch (error) {
    logger.error({ error }, 'Failed to load outcome rules from database');
    return rulesCache || [];
  }
}

export function clearRulesCache(): void {
  rulesCache = null;
  cacheTimestamp = 0;
}

function getFieldValue(data: ExtractedCertificateData, fieldPath: string): any {
  const paths = fieldPath.split('.');
  let value: any = data;
  
  for (const path of paths) {
    if (value === null || value === undefined) {
      return null;
    }
    value = value[path];
  }
  
  return value;
}

function evaluateOperator(
  fieldValue: any,
  operator: string,
  ruleValue: string | null,
  fieldPath: string,
  data: ExtractedCertificateData
): { matches: boolean; matchedValue: string } {
  if (fieldValue === null || fieldValue === undefined) {
    return { matches: false, matchedValue: '' };
  }

  const stringValue = String(fieldValue).toUpperCase();
  const ruleValueUpper = ruleValue?.toUpperCase() || '';

  switch (operator) {
    case 'CONTAINS':
      return {
        matches: stringValue.includes(ruleValueUpper),
        matchedValue: stringValue,
      };
      
    case 'EQUALS':
      return {
        matches: stringValue === ruleValueUpper,
        matchedValue: stringValue,
      };
      
    case 'STARTS_WITH':
      return {
        matches: stringValue.startsWith(ruleValueUpper),
        matchedValue: stringValue,
      };
      
    case 'ENDS_WITH':
      return {
        matches: stringValue.endsWith(ruleValueUpper),
        matchedValue: stringValue,
      };
      
    case 'IS_TRUE':
      return {
        matches: fieldValue === true || stringValue === 'TRUE' || stringValue === 'YES' || stringValue === '1',
        matchedValue: stringValue,
      };
      
    case 'IS_FALSE':
      return {
        matches: fieldValue === false || stringValue === 'FALSE' || stringValue === 'NO' || stringValue === '0',
        matchedValue: stringValue,
      };
      
    case 'GREATER_THAN':
      const numValue = parseFloat(stringValue);
      const threshold = parseFloat(ruleValueUpper);
      return {
        matches: !isNaN(numValue) && !isNaN(threshold) && numValue > threshold,
        matchedValue: stringValue,
      };
      
    case 'LESS_THAN':
      const numVal = parseFloat(stringValue);
      const thresh = parseFloat(ruleValueUpper);
      return {
        matches: !isNaN(numVal) && !isNaN(thresh) && numVal < thresh,
        matchedValue: stringValue,
      };
      
    case 'ARRAY_ANY_MATCH':
      if (Array.isArray(fieldValue)) {
        for (const item of fieldValue) {
          const itemStr = typeof item === 'object' 
            ? JSON.stringify(item).toUpperCase() 
            : String(item).toUpperCase();
          
          if (ruleValue) {
            if (itemStr.includes(ruleValueUpper)) {
              return { matches: true, matchedValue: itemStr };
            }
          } else {
            if (fieldPath === 'defects' && item.code) {
              const code = String(item.code).toUpperCase();
              if (code === 'ID' || code === 'AR' || code === 'NCS' ||
                  code === 'C1' || code === 'C2' || code === 'C3' || code === 'FI') {
                return { matches: true, matchedValue: code };
              }
            }
            if (fieldPath === 'observations' && item.code) {
              const code = String(item.code).toUpperCase();
              if (code === 'C1' || code === 'C2' || code === 'C3' || code === 'FI') {
                return { matches: true, matchedValue: code };
              }
            }
            if (fieldPath === 'appliances') {
              const outcome = item.outcome?.toUpperCase();
              if (outcome === 'FAIL' || outcome === 'UNSAFE' || outcome === 'ID' || outcome === 'AR') {
                return { matches: true, matchedValue: outcome };
              }
            }
            if (fieldPath === 'materials' && item.condition) {
              const condition = String(item.condition).toUpperCase();
              if (condition.includes('POOR') || condition.includes('DAMAGED') || condition.includes('HIGH')) {
                return { matches: true, matchedValue: condition };
              }
            }
          }
        }
        return { matches: false, matchedValue: '' };
      }
      return { matches: false, matchedValue: '' };
      
    case 'REGEX':
      try {
        const regex = new RegExp(ruleValue || '', 'i');
        return {
          matches: regex.test(String(fieldValue)),
          matchedValue: stringValue,
        };
      } catch (e) {
        return { matches: false, matchedValue: '' };
      }
      
    default:
      return {
        matches: stringValue.includes(ruleValueUpper),
        matchedValue: stringValue,
      };
  }
}

export async function evaluateOutcomeRules(
  certificateType: string,
  extractionData: ExtractedCertificateData
): Promise<OutcomeEvaluationResult> {
  const rules = await loadOutcomeRules();
  
  const applicableRules = rules.filter(r => 
    r.certificateTypeCode === certificateType
  );

  const matches: OutcomeRuleMatch[] = [];
  const legislationSet = new Set<string>();

  for (const rule of applicableRules) {
    const fieldValue = getFieldValue(extractionData, rule.fieldPath);
    const evaluation = evaluateOperator(
      fieldValue,
      rule.operator,
      rule.value,
      rule.fieldPath,
      extractionData
    );

    if (evaluation.matches) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.ruleName,
        ruleGroup: rule.ruleGroup,
        outcome: rule.outcome as ComplianceOutcome,
        priority: rule.priority,
        legislation: rule.legislation,
        matchReason: rule.description || `Rule "${rule.ruleName}" matched`,
        fieldPath: rule.fieldPath,
        matchedValue: evaluation.matchedValue,
      });

      if (rule.legislation) {
        legislationSet.add(rule.legislation);
      }
    }
  }

  matches.sort((a, b) => b.priority - a.priority);

  let finalOutcome: ComplianceOutcome = 'UNDETERMINED';
  let confidence = 0;

  if (matches.length > 0) {
    const unsatisfactoryMatch = matches.find(m => m.outcome === 'UNSATISFACTORY');
    const observationsMatch = matches.find(m => m.outcome === 'SATISFACTORY_WITH_OBSERVATIONS');
    const satisfactoryMatch = matches.find(m => m.outcome === 'SATISFACTORY');

    if (unsatisfactoryMatch) {
      finalOutcome = 'UNSATISFACTORY';
      confidence = Math.min(1, unsatisfactoryMatch.priority / 100);
    } else if (observationsMatch) {
      finalOutcome = 'SATISFACTORY_WITH_OBSERVATIONS';
      confidence = Math.min(1, observationsMatch.priority / 100);
    } else if (satisfactoryMatch) {
      finalOutcome = 'SATISFACTORY';
      confidence = Math.min(1, satisfactoryMatch.priority / 100);
    } else {
      finalOutcome = matches[0].outcome;
      confidence = Math.min(1, matches[0].priority / 100);
    }
  } else {
    if (extractionData.outcome) {
      const outcomeUpper = extractionData.outcome.toUpperCase();
      if (outcomeUpper.includes('UNSATISFACTORY') || outcomeUpper.includes('FAIL')) {
        finalOutcome = 'UNSATISFACTORY';
        confidence = 0.7;
      } else if (outcomeUpper.includes('SATISFACTORY')) {
        if (outcomeUpper.includes('OBSERVATION') || outcomeUpper.includes('CONDITION')) {
          finalOutcome = 'SATISFACTORY_WITH_OBSERVATIONS';
          confidence = 0.7;
        } else {
          finalOutcome = 'SATISFACTORY';
          confidence = 0.7;
        }
      } else if (outcomeUpper.includes('PASS')) {
        finalOutcome = 'SATISFACTORY';
        confidence = 0.7;
      }
    }
  }

  logger.info({
    certificateType,
    ruleCount: applicableRules.length,
    matchCount: matches.length,
    finalOutcome,
    confidence,
    legislation: Array.from(legislationSet),
  }, 'Outcome rules evaluation complete');

  return {
    finalOutcome,
    matches,
    legislation: Array.from(legislationSet),
    confidence,
  };
}

export async function determineComplianceOutcome(
  certificateType: string,
  extractionData: ExtractedCertificateData
): Promise<{
  outcome: ComplianceOutcome;
  confidence: number;
  legislation: string[];
  ruleMatches: OutcomeRuleMatch[];
  source: 'database_rules' | 'extracted_data' | 'undetermined';
}> {
  const evaluation = await evaluateOutcomeRules(certificateType, extractionData);

  if (evaluation.matches.length > 0) {
    return {
      outcome: evaluation.finalOutcome,
      confidence: evaluation.confidence,
      legislation: evaluation.legislation,
      ruleMatches: evaluation.matches,
      source: 'database_rules',
    };
  }

  if (evaluation.finalOutcome !== 'UNDETERMINED') {
    return {
      outcome: evaluation.finalOutcome,
      confidence: evaluation.confidence,
      legislation: [],
      ruleMatches: [],
      source: 'extracted_data',
    };
  }

  return {
    outcome: 'UNDETERMINED',
    confidence: 0,
    legislation: [],
    ruleMatches: [],
    source: 'undetermined',
  };
}
