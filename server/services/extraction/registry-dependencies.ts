import type { ExtractionDependencies, AIExtractionResult, ExtractionSettings, TierAuditRecord } from './dependencies';
import { DEFAULT_DOCUMENT_THRESHOLDS, TIER_ORDER, TIER_COST_ESTIMATES } from './dependencies';
import type { CertificateTypeCode, ExtractedCertificateData } from './types';
import { analyseDocument as realAnalyseDocument } from './format-detector';
import { extractQRAndMetadata as realExtractQRMetadata } from './qr-metadata';
import { extractWithTemplate as realExtractWithTemplate, type CustomPatternConfig } from './template-patterns';
import { aiRegistry, AICapability, type ILLMProvider, type IVisionProvider, type IOCRProvider, type IDocumentIntelligenceProvider } from '../ai/providers';
import { db } from '../../db';
import { factorySettings, extractionTierAudits } from '@shared/schema';
import { logger } from '../../logger';

const CERTIFICATE_EXTRACTION_SCHEMA: Record<string, unknown> = {
  certificateType: { type: 'string', description: 'Type of certificate (e.g., GAS, EICR, EPC, FRA)' },
  certificateNumber: { type: 'string', description: 'Certificate reference number' },
  propertyAddress: { type: 'string', description: 'Full property address' },
  uprn: { type: 'string', description: 'Unique Property Reference Number' },
  inspectionDate: { type: 'string', description: 'Date of inspection (ISO format preferred)' },
  expiryDate: { type: 'string', description: 'Certificate expiry date' },
  nextInspectionDate: { type: 'string', description: 'Next scheduled inspection date' },
  outcome: { type: 'string', description: 'Certificate outcome (e.g., Pass, Fail, Satisfactory)' },
  engineerName: { type: 'string', description: 'Name of the engineer/inspector' },
  engineerRegistration: { type: 'string', description: 'Engineer registration number (e.g., Gas Safe ID)' },
  contractorName: { type: 'string', description: 'Name of the contractor company' },
  contractorRegistration: { type: 'string', description: 'Contractor registration number' },
  appliances: { type: 'array', description: 'List of appliances inspected (for gas certificates)' },
  defects: { type: 'array', description: 'List of defects or issues found' },
};

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

const VALID_OUTCOMES = ['PASS', 'FAIL', 'SATISFACTORY', 'UNSATISFACTORY', 'N/A'] as const;
type OutcomeType = typeof VALID_OUTCOMES[number] | null;

const KNOWN_FIELDS = new Set([
  'certificateType', 'certificateNumber', 'propertyAddress', 'uprn',
  'inspectionDate', 'expiryDate', 'nextInspectionDate', 'outcome',
  'engineerName', 'engineerRegistration', 'contractorName', 'contractorRegistration',
  'appliances', 'defects', 'additionalFields'
]);

function mapToExtractedData(data: Record<string, unknown>): ExtractedCertificateData {
  const rawOutcome = data.outcome as string | null;
  let outcome: OutcomeType = null;
  if (rawOutcome && VALID_OUTCOMES.includes(rawOutcome.toUpperCase() as typeof VALID_OUTCOMES[number])) {
    outcome = rawOutcome.toUpperCase() as typeof VALID_OUTCOMES[number];
  }
  
  const additionalFields: Record<string, string> = {};
  
  const providerAdditionalFields = data.additionalFields;
  if (providerAdditionalFields && typeof providerAdditionalFields === 'object' && !Array.isArray(providerAdditionalFields)) {
    for (const [key, value] of Object.entries(providerAdditionalFields as Record<string, unknown>)) {
      if (value !== null && value !== undefined) {
        additionalFields[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
  }
  
  for (const [key, value] of Object.entries(data)) {
    if (!KNOWN_FIELDS.has(key) && value !== null && value !== undefined) {
      additionalFields[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  
  return {
    certificateType: ((data.certificateType as string) || 'UNKNOWN') as CertificateTypeCode,
    certificateNumber: (data.certificateNumber as string) || null,
    propertyAddress: (data.propertyAddress as string) || null,
    uprn: (data.uprn as string) || null,
    inspectionDate: (data.inspectionDate as string) || null,
    expiryDate: (data.expiryDate as string) || null,
    nextInspectionDate: (data.nextInspectionDate as string) || null,
    outcome,
    engineerName: (data.engineerName as string) || null,
    engineerRegistration: (data.engineerRegistration as string) || null,
    contractorName: (data.contractorName as string) || null,
    contractorRegistration: (data.contractorRegistration as string) || null,
    appliances: Array.isArray(data.appliances) ? data.appliances : [],
    defects: Array.isArray(data.defects) ? data.defects : [],
    additionalFields,
  };
}

async function getRegistrySettings(): Promise<ExtractionSettings> {
  try {
    const settings = await db.select().from(factorySettings);
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const aiEnabled = 
      settingsMap.get('AI_EXTRACTION_ENABLED') === 'true' ||
      settingsMap.get('extraction.enableAIProcessing') === 'true';
    
    let documentTypeThresholds: Record<string, number> = { ...DEFAULT_DOCUMENT_THRESHOLDS };
    const docThresholdsJson = settingsMap.get('DOCUMENT_TYPE_THRESHOLDS');
    if (docThresholdsJson) {
      try {
        documentTypeThresholds = { ...documentTypeThresholds, ...JSON.parse(docThresholdsJson) };
      } catch {
        logger.warn('Failed to parse DOCUMENT_TYPE_THRESHOLDS');
      }
    }
    
    let customPatterns: Record<string, CustomPatternConfig> = {};
    const customPatternsJson = settingsMap.get('CUSTOM_EXTRACTION_PATTERNS');
    if (customPatternsJson) {
      try {
        customPatterns = JSON.parse(customPatternsJson) as Record<string, CustomPatternConfig>;
      } catch {
        logger.warn('Failed to parse CUSTOM_EXTRACTION_PATTERNS');
      }
    }
    
    return {
      aiEnabled,
      tier1Threshold: parseFloat(settingsMap.get('TIER1_CONFIDENCE_THRESHOLD') || '0.85'),
      tier2Threshold: parseFloat(settingsMap.get('TIER2_CONFIDENCE_THRESHOLD') || '0.80'),
      tier3Threshold: parseFloat(settingsMap.get('TIER3_CONFIDENCE_THRESHOLD') || '0.70'),
      maxCostPerDocument: parseFloat(settingsMap.get('MAX_COST_PER_DOCUMENT') || '0.05'),
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

async function recordRegistryTierAudit(record: TierAuditRecord): Promise<void> {
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

async function extractWithLLMViaRegistry(
  text: string,
  docType: CertificateTypeCode | undefined
): Promise<AIExtractionResult> {
  try {
    await aiRegistry.ensureInitialized();
    const providers = aiRegistry.getProvidersForCapability(AICapability.TEXT_EXTRACTION);
    
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (!health.isHealthy) {
        logger.debug({ provider: provider.type, reason: health.error }, 'Skipping unhealthy LLM provider');
        continue;
      }
      
      try {
        const llmProvider = provider as ILLMProvider;
        const result = await llmProvider.extractFromText(
          text,
          CERTIFICATE_EXTRACTION_SCHEMA,
          { documentType: docType }
        );
        
        logger.info({ provider: provider.type, confidence: result.confidence }, 'LLM extraction successful');
        
        return {
          success: result.success,
          data: mapToExtractedData(result.data),
          confidence: result.confidence,
          cost: result.cost || 0,
          rawText: result.rawResponse,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ provider: provider.type, error: lastError.message }, 'LLM provider failed, trying next');
      }
    }
    
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: lastError?.message || 'No healthy LLM providers available',
    };
  } catch (error) {
    logger.error({ error }, 'Registry LLM extraction failed');
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractWithDocumentIntelligenceViaRegistry(
  buffer: Buffer,
  mimeType: string
): Promise<AIExtractionResult> {
  try {
    await aiRegistry.ensureInitialized();
    const providers = aiRegistry.getProvidersForCapability(AICapability.DOCUMENT_INTELLIGENCE);
    
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (!health.isHealthy) {
        logger.debug({ provider: provider.type, reason: health.error }, 'Skipping unhealthy DI provider');
        continue;
      }
      
      try {
        const diProvider = provider as IDocumentIntelligenceProvider;
        const result = await diProvider.analyzeDocument(buffer, mimeType);
        
        logger.info({ provider: provider.type, confidence: result.confidence }, 'Document Intelligence extraction successful');
        
        return {
          success: result.success,
          data: mapToExtractedData(result.structuredData),
          confidence: result.confidence,
          cost: result.cost || 0,
          rawText: result.text,
          structuredData: result.structuredData,
          pageCount: result.pageCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ provider: provider.type, error: lastError.message }, 'DI provider failed, trying next');
      }
    }
    
    const ocrProviders = aiRegistry.getProvidersForCapability(AICapability.OCR);
    for (const provider of ocrProviders) {
      const health = await provider.healthCheck();
      if (!health.isHealthy) continue;
      
      try {
        const ocrProvider = provider as IOCRProvider;
        const result = await ocrProvider.extractText(buffer, mimeType);
        
        logger.info({ provider: provider.type, confidence: result.confidence }, 'OCR extraction successful');
        
        return {
          success: result.success,
          data: createEmptyExtractedData(),
          confidence: result.confidence,
          cost: result.cost || 0,
          rawText: result.text,
          pageCount: result.pageCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ provider: provider.type, error: lastError.message }, 'OCR provider failed, trying next');
      }
    }
    
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: lastError?.message || 'No healthy Document Intelligence or OCR providers available',
    };
  } catch (error) {
    logger.error({ error }, 'Registry DI/OCR extraction failed');
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractWithVisionViaRegistry(
  buffer: Buffer,
  mimeType: string,
  docType: CertificateTypeCode | undefined
): Promise<AIExtractionResult> {
  try {
    await aiRegistry.ensureInitialized();
    const providers = aiRegistry.getProvidersForCapability(AICapability.VISION);
    
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (!health.isHealthy) {
        logger.debug({ provider: provider.type, reason: health.error }, 'Skipping unhealthy vision provider');
        continue;
      }
      
      try {
        const visionProvider = provider as IVisionProvider;
        const result = await visionProvider.extractFromImage(
          buffer,
          mimeType,
          CERTIFICATE_EXTRACTION_SCHEMA,
          { documentType: docType }
        );
        
        logger.info({ provider: provider.type, confidence: result.confidence }, 'Vision extraction successful');
        
        return {
          success: result.success,
          data: mapToExtractedData(result.data),
          confidence: result.confidence,
          cost: result.cost || 0,
          rawText: result.rawResponse,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ provider: provider.type, error: lastError.message }, 'Vision provider failed, trying next');
      }
    }
    
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: lastError?.message || 'No healthy vision providers available',
    };
  } catch (error) {
    logger.error({ error }, 'Registry vision extraction failed');
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractWithVisionFromPDFViaRegistry(
  buffer: Buffer,
  docType: CertificateTypeCode | undefined
): Promise<AIExtractionResult> {
  try {
    await aiRegistry.ensureInitialized();
    const providers = aiRegistry.getProvidersForCapability(AICapability.VISION);
    
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (!health.isHealthy) {
        logger.debug({ provider: provider.type, reason: health.error }, 'Skipping unhealthy vision provider');
        continue;
      }
      
      try {
        const visionProvider = provider as IVisionProvider;
        
        if (typeof visionProvider.extractFromPDF !== 'function') {
          logger.debug({ provider: provider.type }, 'Provider does not support PDF extraction');
          continue;
        }
        
        const result = await visionProvider.extractFromPDF(
          buffer,
          CERTIFICATE_EXTRACTION_SCHEMA,
          { documentType: docType }
        );
        
        logger.info({ provider: provider.type, confidence: result.confidence }, 'Vision PDF extraction successful');
        
        return {
          success: result.success,
          data: mapToExtractedData(result.data),
          confidence: result.confidence,
          cost: result.cost || 0,
          rawText: result.rawResponse,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ provider: provider.type, error: lastError.message }, 'Vision PDF provider failed, trying next');
      }
    }
    
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: lastError?.message || 'No healthy vision providers available for PDF extraction',
    };
  } catch (error) {
    logger.error({ error }, 'Registry vision PDF extraction failed');
    return {
      success: false,
      data: createEmptyExtractedData(),
      confidence: 0,
      cost: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

let registryInitialized = false;

function isAnyAIProviderConfigured(): boolean {
  if (!registryInitialized) {
    aiRegistry.ensureInitialized().then(() => {
      registryInitialized = true;
    }).catch(() => {});
  }
  
  const diProviders = aiRegistry.getProvidersForCapability(AICapability.DOCUMENT_INTELLIGENCE);
  const ocrProviders = aiRegistry.getProvidersForCapability(AICapability.OCR);
  const llmProviders = aiRegistry.getProvidersForCapability(AICapability.TEXT_EXTRACTION);
  const visionProviders = aiRegistry.getProvidersForCapability(AICapability.VISION);
  const allProviders = [...diProviders, ...ocrProviders, ...llmProviders, ...visionProviders];
  return allProviders.some(p => p.isConfigured());
}

export function createRegistryDependencies(): ExtractionDependencies {
  return {
    getSettings: getRegistrySettings,
    analyseDocument: realAnalyseDocument,
    extractQRMetadata: realExtractQRMetadata,
    extractWithTemplate: realExtractWithTemplate,
    extractWithClaudeText: extractWithLLMViaRegistry,
    extractWithAzureDI: extractWithDocumentIntelligenceViaRegistry,
    isAzureDIConfigured: isAnyAIProviderConfigured,
    extractWithClaudeVision: extractWithVisionViaRegistry,
    extractWithClaudeVisionFromPDF: extractWithVisionFromPDFViaRegistry,
    recordTierAudit: recordRegistryTierAudit,
  };
}

export function getRegistryDependencies(): ExtractionDependencies {
  return createRegistryDependencies();
}
