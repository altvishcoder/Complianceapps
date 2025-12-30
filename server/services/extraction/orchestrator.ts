import { db } from '../../db';
import { extractionTierAudits, factorySettings, extractionRuns, certificates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  ExtractionTier,
  TierStatus,
  ExtractionResult,
  ExtractionOptions,
  TierAuditEntry,
  DocumentFormat,
  DocumentClassification,
  ExtractedCertificateData,
  TIER_CONFIDENCE_THRESHOLDS,
  TIER_COSTS,
} from './types';
import { analyseDocument, type FormatAnalysis } from './format-detector';
import { extractQRAndMetadata, type QRMetadataResult } from './qr-metadata';
import { extractWithTemplate } from './template-patterns';
import { logger } from '../../logger';

const TIER_ORDER: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 1,
  'tier-1': 2,
  'tier-1.5': 3,
  'tier-2': 4,
  'tier-3': 5,
  'tier-4': 6,
};

const DEFAULT_CONFIDENCE_THRESHOLDS: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0.95,
  'tier-1': 0.85,
  'tier-1.5': 0.80,
  'tier-2': 0.80,
  'tier-3': 0.70,
  'tier-4': 0,
};

const TIER_COST_ESTIMATES: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0,
  'tier-1': 0,
  'tier-1.5': 0.003,
  'tier-2': 0.0015,
  'tier-3': 0.01,
  'tier-4': 0,
};

interface ExtractionSettings {
  aiEnabled: boolean;
  tier1Threshold: number;
  tier2Threshold: number;
  tier3Threshold: number;
  maxCostPerDocument: number;
}

async function getExtractionSettings(): Promise<ExtractionSettings> {
  try {
    const settings = await db
      .select()
      .from(factorySettings)
      .where(eq(factorySettings.category, 'EXTRACTION'));

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    return {
      aiEnabled: settingsMap.get('extraction.enableAIProcessing') === 'true',
      tier1Threshold: parseFloat(settingsMap.get('extraction.tier1ConfidenceThreshold') || '0.85'),
      tier2Threshold: parseFloat(settingsMap.get('extraction.tier2ConfidenceThreshold') || '0.80'),
      tier3Threshold: parseFloat(settingsMap.get('extraction.tier3ConfidenceThreshold') || '0.70'),
      maxCostPerDocument: parseFloat(settingsMap.get('extraction.maxCostPerDocument') || '0.05'),
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load extraction settings, using defaults');
    return {
      aiEnabled: false,
      tier1Threshold: 0.85,
      tier2Threshold: 0.80,
      tier3Threshold: 0.70,
      maxCostPerDocument: 0.05,
    };
  }
}

export async function isAIProcessingEnabled(): Promise<boolean> {
  const settings = await getExtractionSettings();
  return settings.aiEnabled;
}

export async function recordTierAudit(
  certificateId: string,
  extractionRunId: string | null,
  tier: ExtractionTier,
  status: TierStatus,
  confidence: number,
  processingTimeMs: number,
  extractedFieldCount: number,
  escalationReason: string | null,
  formatAnalysis?: FormatAnalysis,
  qrMetadata?: QRMetadataResult,
  rawOutput?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(extractionTierAudits).values({
      certificateId,
      extractionRunId,
      tier,
      tierOrder: TIER_ORDER[tier],
      attemptedAt: new Date(),
      completedAt: new Date(),
      processingTimeMs,
      status,
      confidence,
      cost: TIER_COST_ESTIMATES[tier],
      extractedFieldCount,
      escalationReason,
      documentFormat: formatAnalysis?.format,
      documentClassification: formatAnalysis?.classification,
      pageCount: formatAnalysis?.pageCount,
      textQuality: formatAnalysis?.textQuality,
      qrCodesFound: qrMetadata?.qrCodes ?? null,
      metadataExtracted: qrMetadata?.metadata ?? null,
      rawOutput: rawOutput ?? null,
    });
  } catch (error) {
    logger.error({ error, certificateId, tier }, 'Failed to record tier audit');
  }
}

export async function extractCertificate(
  certificateId: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const tierAudit: TierAuditEntry[] = [];
  let totalCost = 0;
  const warnings: string[] = [];

  const extractionSettings = await getExtractionSettings();
  let aiEnabled = extractionSettings.aiEnabled;
  if (options.forceAI) {
    aiEnabled = true;
  }

  const tier1Threshold = extractionSettings.tier1Threshold;
  const maxCost = extractionSettings.maxCostPerDocument;

  logger.info({ certificateId, mimeType, filename, aiEnabled, tier1Threshold, maxCost }, 'Starting tiered extraction');

  const tier0Start = Date.now();
  const formatAnalysis = await analyseDocument(buffer, mimeType, filename);
  const tier0Time = Date.now() - tier0Start;

  tierAudit.push({
    tier: 'tier-0',
    attemptedAt: new Date(tier0Start),
    completedAt: new Date(),
    status: 'success',
    confidence: 1,
    processingTimeMs: tier0Time,
    cost: 0,
    extractedFieldCount: 0,
    escalationReason: null,
    rawOutput: formatAnalysis as unknown as Record<string, unknown>,
  });

  await recordTierAudit(
    certificateId,
    null,
    'tier-0',
    'success',
    1,
    tier0Time,
    0,
    null,
    formatAnalysis
  );

  let qrMetadata: QRMetadataResult | undefined;
  if (formatAnalysis.isScanned || formatAnalysis.format === 'image') {
    const tier05Start = Date.now();
    qrMetadata = await extractQRAndMetadata(buffer, mimeType);
    const tier05Time = Date.now() - tier05Start;

    if (qrMetadata.hasVerificationData) {
      tierAudit.push({
        tier: 'tier-0.5',
        attemptedAt: new Date(tier05Start),
        completedAt: new Date(),
        status: 'success',
        confidence: 0.95,
        processingTimeMs: tier05Time,
        cost: 0,
        extractedFieldCount: Object.keys(qrMetadata.extractedData).length,
        escalationReason: null,
        rawOutput: qrMetadata as unknown as Record<string, unknown>,
      });

      await recordTierAudit(
        certificateId,
        null,
        'tier-0.5',
        'success',
        0.95,
        tier05Time,
        Object.keys(qrMetadata.extractedData).length,
        null,
        formatAnalysis,
        qrMetadata
      );

      return {
        success: true,
        data: {
          certificateType: formatAnalysis.detectedCertificateType,
          certificateNumber: qrMetadata.extractedData.verificationCode || null,
          propertyAddress: null,
          uprn: null,
          inspectionDate: qrMetadata.extractedData.photoDate || null,
          expiryDate: null,
          nextInspectionDate: null,
          outcome: null,
          engineerName: null,
          engineerRegistration: qrMetadata.extractedData.gasSafeId || null,
          contractorName: null,
          contractorRegistration: null,
          appliances: [],
          defects: [],
          additionalFields: qrMetadata.extractedData,
        },
        finalTier: 'tier-0.5',
        confidence: 0.95,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost: 0,
        requiresReview: false,
        warnings,
        rawText: null,
        documentFormat: formatAnalysis.format,
        documentClassification: formatAnalysis.classification,
        pageCount: formatAnalysis.pageCount,
        qrCodes: qrMetadata.qrCodes,
        metadata: qrMetadata.metadata,
        tierAudit,
      };
    }

    tierAudit.push({
      tier: 'tier-0.5',
      attemptedAt: new Date(tier05Start),
      completedAt: new Date(),
      status: 'escalated',
      confidence: 0,
      processingTimeMs: tier05Time,
      cost: 0,
      extractedFieldCount: 0,
      escalationReason: 'No QR codes or verification data found',
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId,
      null,
      'tier-0.5',
      'escalated',
      0,
      tier05Time,
      0,
      'No QR codes or verification data found',
      formatAnalysis,
      qrMetadata
    );
  }

  if (formatAnalysis.hasTextLayer && formatAnalysis.textContent) {
    const tier1Start = Date.now();
    const templateResult = extractWithTemplate(
      formatAnalysis.textContent,
      formatAnalysis.detectedCertificateType
    );
    const tier1Time = Date.now() - tier1Start;

    if (templateResult.confidence >= tier1Threshold) {
      tierAudit.push({
        tier: 'tier-1',
        attemptedAt: new Date(tier1Start),
        completedAt: new Date(),
        status: 'success',
        confidence: templateResult.confidence,
        processingTimeMs: tier1Time,
        cost: 0,
        extractedFieldCount: templateResult.matchedFields,
        escalationReason: null,
        rawOutput: templateResult.data as unknown as Record<string, unknown>,
      });

      await recordTierAudit(
        certificateId,
        null,
        'tier-1',
        'success',
        templateResult.confidence,
        tier1Time,
        templateResult.matchedFields,
        null,
        formatAnalysis
      );

      return {
        success: true,
        data: templateResult.data as ExtractedCertificateData,
        finalTier: 'tier-1',
        confidence: templateResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost: 0,
        requiresReview: false,
        warnings,
        rawText: formatAnalysis.textContent,
        documentFormat: formatAnalysis.format,
        documentClassification: formatAnalysis.classification,
        pageCount: formatAnalysis.pageCount,
        qrCodes: qrMetadata?.qrCodes || [],
        metadata: qrMetadata?.metadata || null,
        tierAudit,
      };
    }

    tierAudit.push({
      tier: 'tier-1',
      attemptedAt: new Date(tier1Start),
      completedAt: new Date(),
      status: 'escalated',
      confidence: templateResult.confidence,
      processingTimeMs: tier1Time,
      cost: 0,
      extractedFieldCount: templateResult.matchedFields,
      escalationReason: `Confidence ${templateResult.confidence.toFixed(2)} below threshold ${tier1Threshold}`,
      rawOutput: templateResult.data as unknown as Record<string, unknown>,
    });

    await recordTierAudit(
      certificateId,
      null,
      'tier-1',
      'escalated',
      templateResult.confidence,
      tier1Time,
      templateResult.matchedFields,
      `Confidence ${templateResult.confidence.toFixed(2)} below threshold ${tier1Threshold}`,
      formatAnalysis
    );

    if (!aiEnabled) {
      tierAudit.push({
        tier: 'tier-1.5',
        attemptedAt: new Date(),
        completedAt: new Date(),
        status: 'skipped',
        confidence: 0,
        processingTimeMs: 0,
        cost: 0,
        extractedFieldCount: 0,
        escalationReason: 'AI processing disabled in factory settings',
        rawOutput: null,
      });

      await recordTierAudit(
        certificateId,
        null,
        'tier-1.5',
        'skipped',
        0,
        0,
        0,
        'AI processing disabled in factory settings',
        formatAnalysis
      );

      tierAudit.push({
        tier: 'tier-2',
        attemptedAt: new Date(),
        completedAt: new Date(),
        status: 'skipped',
        confidence: 0,
        processingTimeMs: 0,
        cost: 0,
        extractedFieldCount: 0,
        escalationReason: 'AI processing disabled in factory settings',
        rawOutput: null,
      });

      tierAudit.push({
        tier: 'tier-3',
        attemptedAt: new Date(),
        completedAt: new Date(),
        status: 'skipped',
        confidence: 0,
        processingTimeMs: 0,
        cost: 0,
        extractedFieldCount: 0,
        escalationReason: 'AI processing disabled in factory settings',
        rawOutput: null,
      });

      tierAudit.push({
        tier: 'tier-4',
        attemptedAt: new Date(),
        completedAt: new Date(),
        status: 'success',
        confidence: 0,
        processingTimeMs: 0,
        cost: 0,
        extractedFieldCount: templateResult.matchedFields,
        escalationReason: 'AI processing disabled, routing to manual review',
        rawOutput: templateResult.data as unknown as Record<string, unknown>,
      });

      await recordTierAudit(
        certificateId,
        null,
        'tier-4',
        'success',
        templateResult.confidence,
        0,
        templateResult.matchedFields,
        'AI processing disabled, routing to manual review',
        formatAnalysis
      );

      warnings.push('AI processing is disabled. Certificate requires manual review.');

      return {
        success: false,
        data: templateResult.data as ExtractedCertificateData,
        finalTier: 'tier-4',
        confidence: templateResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost: 0,
        requiresReview: true,
        warnings,
        rawText: formatAnalysis.textContent,
        documentFormat: formatAnalysis.format,
        documentClassification: formatAnalysis.classification,
        pageCount: formatAnalysis.pageCount,
        qrCodes: qrMetadata?.qrCodes || [],
        metadata: qrMetadata?.metadata || null,
        tierAudit,
      };
    }
  }

  if (!aiEnabled) {
    tierAudit.push({
      tier: 'tier-4',
      attemptedAt: new Date(),
      completedAt: new Date(),
      status: 'success',
      confidence: 0,
      processingTimeMs: 0,
      cost: 0,
      extractedFieldCount: 0,
      escalationReason: 'AI processing disabled, no text layer available',
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId,
      null,
      'tier-4',
      'success',
      0,
      0,
      0,
      'AI processing disabled, no text layer available',
      formatAnalysis
    );

    warnings.push('AI processing is disabled and document has no text layer. Manual review required.');

    return {
      success: false,
      data: {
        certificateType: formatAnalysis.detectedCertificateType,
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
      },
      finalTier: 'tier-4',
      confidence: 0,
      totalProcessingTimeMs: Date.now() - startTime,
      totalCost: 0,
      requiresReview: true,
      warnings,
      rawText: null,
      documentFormat: formatAnalysis.format,
      documentClassification: formatAnalysis.classification,
      pageCount: formatAnalysis.pageCount,
      qrCodes: qrMetadata?.qrCodes || [],
      metadata: qrMetadata?.metadata || null,
      tierAudit,
    };
  }

  tierAudit.push({
    tier: 'tier-4',
    attemptedAt: new Date(),
    completedAt: new Date(),
    status: 'success',
    confidence: 0,
    processingTimeMs: 0,
    cost: 0,
    extractedFieldCount: 0,
    escalationReason: 'AI tiers not fully implemented yet',
    rawOutput: null,
  });

  await recordTierAudit(
    certificateId,
    null,
    'tier-4',
    'success',
    0,
    0,
    0,
    'AI tiers not fully implemented yet',
    formatAnalysis
  );

  warnings.push('AI processing tiers (1.5, 2, 3) are being implemented. Manual review required.');

  return {
    success: false,
    data: {
      certificateType: formatAnalysis.detectedCertificateType,
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
    },
    finalTier: 'tier-4',
    confidence: 0,
    totalProcessingTimeMs: Date.now() - startTime,
    totalCost: totalCost,
    requiresReview: true,
    warnings,
    rawText: formatAnalysis.textContent,
    documentFormat: formatAnalysis.format,
    documentClassification: formatAnalysis.classification,
    pageCount: formatAnalysis.pageCount,
    qrCodes: qrMetadata?.qrCodes || [],
    metadata: qrMetadata?.metadata || null,
    tierAudit,
  };
}

export async function getTierAuditForCertificate(certificateId: string) {
  return db
    .select()
    .from(extractionTierAudits)
    .where(eq(extractionTierAudits.certificateId, certificateId))
    .orderBy(extractionTierAudits.tierOrder);
}
