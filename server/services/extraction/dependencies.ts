import type { ExtractionTier, TierStatus, ExtractedCertificateData, CertificateTypeCode } from './types';
import type { FormatAnalysis } from './format-detector';
import type { QRMetadataResult } from './qr-metadata';
import type { TemplateExtractionResult as RealTemplateExtractionResult } from './template-patterns';
import { analyseDocument as realAnalyseDocument } from './format-detector';
import { extractQRAndMetadata as realExtractQRMetadata } from './qr-metadata';
import { extractWithTemplate as realExtractWithTemplate, type CustomPatternConfig } from './template-patterns';
import { extractWithClaudeText as realExtractWithClaudeText } from './claude-text';
import { extractWithAzureDI as realExtractWithAzureDI, isAzureDIConfigured as realIsAzureDIConfigured } from './azure-di';
import { extractWithClaudeVision as realExtractWithClaudeVision, extractWithClaudeVisionFromPDF as realExtractWithClaudeVisionFromPDF } from './claude-vision';
import { db } from '../../db';
import { factorySettings, extractionTierAudits } from '@shared/schema';
import { logger } from '../../logger';

type CustomPatternsByDocType = Record<string, CustomPatternConfig>;

export interface ExtractionSettings {
  aiEnabled: boolean;
  tier1Threshold: number;
  tier2Threshold: number;
  tier3Threshold: number;
  maxCostPerDocument: number;
  documentTypeThresholds: Record<string, number>;
  customPatterns: CustomPatternsByDocType;
}

export const DEFAULT_DOCUMENT_THRESHOLDS: Record<string, number> = {
  'FRA': 0.70,
  'FIRE_RISK_ASSESSMENT': 0.70,
  'BSC': 0.70,
  'BUILDING_SAFETY': 0.70,
  'FRAEW': 0.70,
  'ASB': 0.75,
  'ASBESTOS': 0.75,
};

export interface TemplateExtractionResult {
  data: ExtractedCertificateData;
  confidence: number;
  matchedFields: number;
}

export interface AIExtractionResult {
  success: boolean;
  data: ExtractedCertificateData;
  confidence: number;
  cost: number;
  error?: string;
  rawText?: string;
  structuredData?: Record<string, unknown>;
  pageCount?: number;
}

export interface TierAuditRecord {
  certificateId: string;
  extractionRunId: string | null;
  tier: ExtractionTier;
  status: TierStatus;
  confidence: number;
  processingTimeMs: number;
  extractedFieldCount: number;
  escalationReason: string | null;
  formatAnalysis?: FormatAnalysis;
  qrMetadata?: QRMetadataResult;
  rawOutput?: Record<string, unknown>;
}

export interface ExtractionDependencies {
  getSettings: () => Promise<ExtractionSettings>;
  analyseDocument: (buffer: Buffer, mimeType: string, filename: string) => Promise<FormatAnalysis>;
  extractQRMetadata: (buffer: Buffer, mimeType: string) => Promise<QRMetadataResult>;
  extractWithTemplate: (text: string, docType: CertificateTypeCode, customPatterns?: CustomPatternsByDocType) => RealTemplateExtractionResult;
  extractWithClaudeText: (text: string, docType: CertificateTypeCode | undefined) => Promise<AIExtractionResult>;
  extractWithAzureDI: (buffer: Buffer, mimeType: string) => Promise<AIExtractionResult>;
  isAzureDIConfigured: () => boolean;
  extractWithClaudeVision: (buffer: Buffer, mimeType: string, docType: CertificateTypeCode | undefined) => Promise<AIExtractionResult>;
  extractWithClaudeVisionFromPDF: (buffer: Buffer, docType: CertificateTypeCode | undefined) => Promise<AIExtractionResult>;
  recordTierAudit: (record: TierAuditRecord) => Promise<void>;
}

export const TIER_ORDER: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 1,
  'tier-1': 2,
  'tier-1.5': 3,
  'tier-2': 4,
  'tier-3': 5,
  'tier-4': 6,
};

export const TIER_COST_ESTIMATES: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0,
  'tier-1': 0,
  'tier-1.5': 0.003,
  'tier-2': 0.0015,
  'tier-3': 0.01,
  'tier-4': 0,
};

async function getProductionSettings(): Promise<ExtractionSettings> {
  try {
    const settings = await db
      .select()
      .from(factorySettings);

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const aiEnabled = 
      settingsMap.get('AI_EXTRACTION_ENABLED') === 'true' ||
      settingsMap.get('extraction.enableAIProcessing') === 'true';
    
    let documentTypeThresholds: Record<string, number> = { ...DEFAULT_DOCUMENT_THRESHOLDS };
    const docThresholdsJson = settingsMap.get('DOCUMENT_TYPE_THRESHOLDS');
    if (docThresholdsJson) {
      try {
        documentTypeThresholds = { ...documentTypeThresholds, ...JSON.parse(docThresholdsJson) };
      } catch (e) {
        logger.warn({ error: e }, 'Failed to parse DOCUMENT_TYPE_THRESHOLDS');
      }
    }
    
    let customPatterns: CustomPatternsByDocType = {};
    const customPatternsJson = settingsMap.get('CUSTOM_EXTRACTION_PATTERNS');
    if (customPatternsJson) {
      try {
        customPatterns = JSON.parse(customPatternsJson) as CustomPatternsByDocType;
      } catch (e) {
        logger.warn({ error: e }, 'Failed to parse CUSTOM_EXTRACTION_PATTERNS');
      }
    }
    
    return {
      aiEnabled,
      tier1Threshold: parseFloat(settingsMap.get('TIER1_CONFIDENCE_THRESHOLD') || settingsMap.get('extraction.tier1ConfidenceThreshold') || '0.85'),
      tier2Threshold: parseFloat(settingsMap.get('TIER2_CONFIDENCE_THRESHOLD') || settingsMap.get('extraction.tier2ConfidenceThreshold') || '0.80'),
      tier3Threshold: parseFloat(settingsMap.get('TIER3_CONFIDENCE_THRESHOLD') || settingsMap.get('extraction.tier3ConfidenceThreshold') || '0.70'),
      maxCostPerDocument: parseFloat(settingsMap.get('MAX_COST_PER_DOCUMENT') || settingsMap.get('extraction.maxCostPerDocument') || '0.05'),
      documentTypeThresholds,
      customPatterns,
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load extraction settings, using defaults');
    return {
      aiEnabled: false,
      tier1Threshold: 0.85,
      tier2Threshold: 0.80,
      tier3Threshold: 0.70,
      maxCostPerDocument: 0.05,
      documentTypeThresholds: { ...DEFAULT_DOCUMENT_THRESHOLDS },
      customPatterns: {},
    };
  }
}

async function recordProductionTierAudit(record: TierAuditRecord): Promise<void> {
  try {
    await db.insert(extractionTierAudits).values({
      certificateId: record.certificateId,
      extractionRunId: record.extractionRunId,
      tier: record.tier,
      tierOrder: TIER_ORDER[record.tier],
      attemptedAt: new Date(),
      completedAt: new Date(),
      processingTimeMs: record.processingTimeMs,
      status: record.status,
      confidence: record.confidence,
      cost: TIER_COST_ESTIMATES[record.tier],
      extractedFieldCount: record.extractedFieldCount,
      escalationReason: record.escalationReason,
      documentFormat: record.formatAnalysis?.format,
      documentClassification: record.formatAnalysis?.classification,
      pageCount: record.formatAnalysis?.pageCount,
      textQuality: record.formatAnalysis?.textQuality,
      qrCodesFound: record.qrMetadata?.qrCodes ?? null,
      metadataExtracted: record.qrMetadata?.metadata ?? null,
      rawOutput: record.rawOutput ?? null,
    });
  } catch (error) {
    logger.error({ error, certificateId: record.certificateId, tier: record.tier }, 'Failed to record tier audit');
  }
}

export function createProductionDependencies(): ExtractionDependencies {
  return {
    getSettings: getProductionSettings,
    analyseDocument: realAnalyseDocument,
    extractQRMetadata: realExtractQRMetadata,
    extractWithTemplate: realExtractWithTemplate,
    extractWithClaudeText: realExtractWithClaudeText,
    extractWithAzureDI: realExtractWithAzureDI,
    isAzureDIConfigured: realIsAzureDIConfigured,
    extractWithClaudeVision: realExtractWithClaudeVision,
    extractWithClaudeVisionFromPDF: realExtractWithClaudeVisionFromPDF,
    recordTierAudit: recordProductionTierAudit,
  };
}

export function createTestDependencies(overrides: Partial<ExtractionDependencies>): ExtractionDependencies {
  const defaultTestSettings: ExtractionSettings = {
    aiEnabled: true,
    tier1Threshold: 0.85,
    tier2Threshold: 0.80,
    tier3Threshold: 0.70,
    maxCostPerDocument: 0.05,
    documentTypeThresholds: { ...DEFAULT_DOCUMENT_THRESHOLDS },
    customPatterns: {},
  };

  const noopAuditRecord: TierAuditRecord[] = [];
  
  const defaults: ExtractionDependencies = {
    getSettings: async () => defaultTestSettings,
    analyseDocument: async (): Promise<FormatAnalysis> => ({
      format: 'pdf-native',
      classification: 'structured_certificate',
      pageCount: 1,
      hasTextLayer: true,
      isScanned: false,
      isHybrid: false,
      textQuality: 0.9,
      avgCharsPerPage: 2000,
      textContent: 'Test document content',
      detectedCertificateType: 'GAS',
    }),
    extractQRMetadata: async () => ({
      hasVerificationData: false,
      qrCodes: [],
      metadata: null,
      extractedData: {},
    }),
    extractWithTemplate: () => ({
      success: true,
      data: createEmptyExtractedData(),
      confidence: 0.5,
      matchedFields: 3,
      totalExpectedFields: 10,
    }),
    extractWithClaudeText: async () => ({
      success: true,
      data: createEmptyExtractedData(),
      confidence: 0.8,
      cost: 0.003,
    }),
    extractWithAzureDI: async () => ({
      success: true,
      data: createEmptyExtractedData(),
      confidence: 0.75,
      cost: 0.0015,
    }),
    isAzureDIConfigured: () => false,
    extractWithClaudeVision: async () => ({
      success: true,
      data: createEmptyExtractedData(),
      confidence: 0.85,
      cost: 0.01,
    }),
    extractWithClaudeVisionFromPDF: async () => ({
      success: true,
      data: createEmptyExtractedData(),
      confidence: 0.85,
      cost: 0.01,
    }),
    recordTierAudit: async (record) => {
      noopAuditRecord.push(record);
    },
  };

  return { ...defaults, ...overrides };
}

function createEmptyExtractedData(): ExtractedCertificateData {
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
    additionalFields: {},
  };
}

let currentDependencies: ExtractionDependencies | null = null;

export function setDependencies(deps: ExtractionDependencies): void {
  currentDependencies = deps;
}

export function getDependencies(): ExtractionDependencies {
  if (!currentDependencies) {
    currentDependencies = createProductionDependencies();
  }
  return currentDependencies;
}

export function resetDependencies(): void {
  currentDependencies = null;
}
