import { logger } from '../../logger';
import { circuitBreaker, withRetry } from '../circuit-breaker';
import type { ExtractedCertificateData, CertificateTypeCode } from './types';

export interface ServiceExtractionResult<T = unknown> {
  success: boolean;
  data: ExtractedCertificateData;
  rawData?: T;
  confidence: number;
  processingTimeMs: number;
  cost: number;
  error?: string;
}

export interface ExtractionContext {
  circuitName: string;
  operationName: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface ExtractionMetrics {
  startTime: number;
  inputSize?: number;
  mimeType?: string;
}

export function createEmptyExtractionData(): ExtractedCertificateData {
  return {
    certificateType: 'UNKNOWN',
    certificateNumber: null,
    propertyAddress: null,
    uprn: null,
    inspectionDate: null,
    expiryDate: null,
    nextInspectionDate: null,
    outcome: null,
    engineerName: null,
    engineerRegistration: null,
    contractorName: null,
    contractorRegistration: null,
    appliances: [],
    defects: [],
    additionalFields: {}
  };
}

export function createFailedResult<T>(
  error: string,
  startTime: number
): ServiceExtractionResult<T> {
  return {
    success: false,
    data: createEmptyExtractionData(),
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    cost: 0,
    error
  };
}

export function createSuccessResult<T>(
  data: ExtractedCertificateData,
  rawData: T,
  confidence: number,
  cost: number,
  startTime: number
): ServiceExtractionResult<T> {
  return {
    success: true,
    data,
    rawData,
    confidence,
    processingTimeMs: Date.now() - startTime,
    cost
  };
}

export async function executeWithResilience<T>(
  context: ExtractionContext,
  operation: () => Promise<T>
): Promise<T> {
  const { circuitName, operationName, maxRetries = 2, baseDelayMs = 1000 } = context;
  
  logger.info({ operation: operationName, circuit: circuitName }, `Starting ${operationName}`);
  
  return circuitBreaker.execute(
    circuitName,
    () => withRetry(operation, maxRetries, baseDelayMs)
  );
}

export function parseJsonResponse(text: string): Record<string, unknown> | null {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, text];
    const jsonStr = jsonMatch[1] || text;
    return JSON.parse(jsonStr.trim());
  } catch (error) {
    logger.warn({ error, textPreview: text.substring(0, 200) }, 'Failed to parse JSON response');
    return null;
  }
}

const VALID_OUTCOMES = ['PASS', 'FAIL', 'SATISFACTORY', 'UNSATISFACTORY', 'N/A'] as const;
type ValidOutcome = typeof VALID_OUTCOMES[number];

function isValidOutcome(value: unknown): value is ValidOutcome {
  return typeof value === 'string' && VALID_OUTCOMES.includes(value as ValidOutcome);
}

function isValidCertificateType(value: unknown): value is CertificateTypeCode {
  return typeof value === 'string' && value.length > 0;
}

export function mapToExtractedData(raw: Record<string, unknown>): ExtractedCertificateData {
  const rawCertType = raw.certificateType;
  const rawOutcome = raw.outcome;
  const rawAdditional = raw.additionalFields;
  
  const additionalFields: Record<string, string> = {};
  if (rawAdditional && typeof rawAdditional === 'object') {
    for (const [key, value] of Object.entries(rawAdditional as Record<string, unknown>)) {
      if (typeof value === 'string') {
        additionalFields[key] = value;
      } else if (value !== null && value !== undefined) {
        additionalFields[key] = String(value);
      }
    }
  }
  
  return {
    certificateType: isValidCertificateType(rawCertType) ? rawCertType as CertificateTypeCode : 'UNKNOWN',
    certificateNumber: (raw.certificateNumber as string) || null,
    propertyAddress: (raw.propertyAddress as string) || null,
    uprn: (raw.uprn as string) || null,
    inspectionDate: (raw.inspectionDate as string) || null,
    expiryDate: (raw.expiryDate as string) || null,
    nextInspectionDate: (raw.nextInspectionDate as string) || null,
    outcome: isValidOutcome(rawOutcome) ? rawOutcome : null,
    engineerName: (raw.engineerName as string) || null,
    engineerRegistration: (raw.engineerRegistration as string) || null,
    contractorName: (raw.contractorName as string) || null,
    contractorRegistration: (raw.contractorRegistration as string) || null,
    appliances: Array.isArray(raw.appliances) ? raw.appliances : [],
    defects: Array.isArray(raw.defects) ? raw.defects : [],
    additionalFields
  };
}

export function calculateConfidence(data: ExtractedCertificateData): number {
  const fields = [
    data.certificateType,
    data.certificateNumber,
    data.propertyAddress,
    data.inspectionDate,
    data.expiryDate,
    data.outcome,
    data.engineerName || data.contractorName
  ];
  
  const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return Math.min(0.95, (filledFields / fields.length) * 0.9 + 0.1);
}
