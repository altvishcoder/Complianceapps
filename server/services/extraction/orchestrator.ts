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
import { extractWithClaudeText } from './claude-text';
import { extractWithAzureDI, isAzureDIConfigured } from './azure-di';
import { extractWithClaudeVision, extractWithClaudeVisionFromPDF } from './claude-vision';
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

      await recordTierAudit(
        certificateId,
        null,
        'tier-2',
        'skipped',
        0,
        0,
        0,
        'AI processing disabled in factory settings',
        formatAnalysis
      );

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

      await recordTierAudit(
        certificateId,
        null,
        'tier-3',
        'skipped',
        0,
        0,
        0,
        'AI processing disabled in factory settings',
        formatAnalysis
      );

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

  const tier15Threshold = extractionSettings.tier1Threshold;
  const tier2Threshold = extractionSettings.tier2Threshold;
  const tier3Threshold = extractionSettings.tier3Threshold;

  if (formatAnalysis.hasTextLayer && formatAnalysis.textContent) {
    const tier15Start = Date.now();
    const claudeTextResult = await extractWithClaudeText(
      formatAnalysis.textContent,
      formatAnalysis.detectedCertificateType
    );
    const tier15Time = Date.now() - tier15Start;
    totalCost += claudeTextResult.cost;

    if (totalCost > maxCost) {
      const costExceededReason = `Cost limit exceeded (${totalCost.toFixed(4)} > ${maxCost})`;
      
      tierAudit.push({
        tier: 'tier-1.5',
        attemptedAt: new Date(tier15Start),
        completedAt: new Date(),
        status: 'escalated',
        confidence: claudeTextResult.confidence,
        processingTimeMs: tier15Time,
        cost: claudeTextResult.cost,
        extractedFieldCount: countFields(claudeTextResult.data),
        escalationReason: costExceededReason,
        rawOutput: null,
      });

      await recordTierAudit(
        certificateId, null, 'tier-1.5', 'escalated',
        claudeTextResult.confidence, tier15Time, countFields(claudeTextResult.data),
        costExceededReason, formatAnalysis
      );

      warnings.push(`Cost limit exceeded. Routing to manual review.`);

      return createManualReviewResult(
        startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit,
        claudeTextResult.data
      );
    }

    if (claudeTextResult.success && claudeTextResult.confidence >= tier15Threshold) {
      tierAudit.push({
        tier: 'tier-1.5',
        attemptedAt: new Date(tier15Start),
        completedAt: new Date(),
        status: 'success',
        confidence: claudeTextResult.confidence,
        processingTimeMs: tier15Time,
        cost: claudeTextResult.cost,
        extractedFieldCount: countFields(claudeTextResult.data),
        escalationReason: null,
        rawOutput: claudeTextResult.data as unknown as Record<string, unknown>,
      });

      await recordTierAudit(
        certificateId, null, 'tier-1.5', 'success',
        claudeTextResult.confidence, tier15Time, countFields(claudeTextResult.data),
        null, formatAnalysis
      );

      return {
        success: true,
        data: claudeTextResult.data,
        finalTier: 'tier-1.5',
        confidence: claudeTextResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost,
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

    const tier15Status: TierStatus = claudeTextResult.success ? 'escalated' : 'failed';
    const tier15Reason = claudeTextResult.error || `Confidence ${claudeTextResult.confidence.toFixed(2)} below threshold`;
    
    tierAudit.push({
      tier: 'tier-1.5',
      attemptedAt: new Date(tier15Start),
      completedAt: new Date(),
      status: tier15Status,
      confidence: claudeTextResult.confidence,
      processingTimeMs: tier15Time,
      cost: claudeTextResult.cost,
      extractedFieldCount: countFields(claudeTextResult.data),
      escalationReason: tier15Reason,
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-1.5', tier15Status,
      claudeTextResult.confidence, tier15Time, countFields(claudeTextResult.data),
      tier15Reason, formatAnalysis
    );
  }

  if (totalCost > maxCost) {
    warnings.push(`Cost limit exceeded after Tier 1.5 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
    return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit);
  }

  if (isAzureDIConfigured() && totalCost + TIER_COST_ESTIMATES['tier-2'] <= maxCost) {
    const tier2Start = Date.now();
    const azureResult = await extractWithAzureDI(buffer, mimeType);
    const tier2Time = Date.now() - tier2Start;
    totalCost += azureResult.cost;

    if (azureResult.success && azureResult.confidence >= tier2Threshold) {
      tierAudit.push({
        tier: 'tier-2',
        attemptedAt: new Date(tier2Start),
        completedAt: new Date(),
        status: 'success',
        confidence: azureResult.confidence,
        processingTimeMs: tier2Time,
        cost: azureResult.cost,
        extractedFieldCount: countFields(azureResult.data),
        escalationReason: null,
        rawOutput: azureResult.structuredData,
      });

      await recordTierAudit(
        certificateId, null, 'tier-2', 'success',
        azureResult.confidence, tier2Time, countFields(azureResult.data),
        null, formatAnalysis
      );

      return {
        success: true,
        data: azureResult.data,
        finalTier: 'tier-2',
        confidence: azureResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost,
        requiresReview: false,
        warnings,
        rawText: azureResult.rawText,
        documentFormat: formatAnalysis.format,
        documentClassification: formatAnalysis.classification,
        pageCount: azureResult.pageCount,
        qrCodes: qrMetadata?.qrCodes || [],
        metadata: qrMetadata?.metadata || null,
        tierAudit,
      };
    }

    const tier2Status: TierStatus = azureResult.success ? 'escalated' : 'failed';
    const tier2Reason = azureResult.error || `Confidence ${azureResult.confidence.toFixed(2)} below threshold`;

    tierAudit.push({
      tier: 'tier-2',
      attemptedAt: new Date(tier2Start),
      completedAt: new Date(),
      status: tier2Status,
      confidence: azureResult.confidence,
      processingTimeMs: tier2Time,
      cost: azureResult.cost,
      extractedFieldCount: countFields(azureResult.data),
      escalationReason: tier2Reason,
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-2', tier2Status,
      azureResult.confidence, tier2Time, countFields(azureResult.data),
      tier2Reason, formatAnalysis
    );

    if (totalCost > maxCost) {
      warnings.push(`Cost limit exceeded after Tier 2 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
      return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit, azureResult.data);
    }
  } else if (!isAzureDIConfigured()) {
    tierAudit.push({
      tier: 'tier-2',
      attemptedAt: new Date(),
      completedAt: new Date(),
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      cost: 0,
      extractedFieldCount: 0,
      escalationReason: 'Azure Document Intelligence not configured',
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-2', 'skipped',
      0, 0, 0, 'Azure Document Intelligence not configured', formatAnalysis
    );
  } else if (isAzureDIConfigured()) {
    const budgetSkipReason = `Insufficient budget remaining (${(maxCost - totalCost).toFixed(4)} < ${TIER_COST_ESTIMATES['tier-2']})`;
    
    tierAudit.push({
      tier: 'tier-2',
      attemptedAt: new Date(),
      completedAt: new Date(),
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      cost: 0,
      extractedFieldCount: 0,
      escalationReason: budgetSkipReason,
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-2', 'skipped',
      0, 0, 0, budgetSkipReason, formatAnalysis
    );
  }

  if (totalCost + TIER_COST_ESTIMATES['tier-3'] <= maxCost) {
    const tier3Start = Date.now();
    let visionResult;

    if (formatAnalysis.format === 'image' || mimeType.startsWith('image/')) {
      visionResult = await extractWithClaudeVision(buffer, mimeType, formatAnalysis.detectedCertificateType);
    } else {
      visionResult = await extractWithClaudeVisionFromPDF(buffer, formatAnalysis.detectedCertificateType);
    }

    const tier3Time = Date.now() - tier3Start;
    totalCost += visionResult.cost;

    if (visionResult.success && visionResult.confidence >= tier3Threshold) {
      tierAudit.push({
        tier: 'tier-3',
        attemptedAt: new Date(tier3Start),
        completedAt: new Date(),
        status: 'success',
        confidence: visionResult.confidence,
        processingTimeMs: tier3Time,
        cost: visionResult.cost,
        extractedFieldCount: countFields(visionResult.data),
        escalationReason: null,
        rawOutput: visionResult.data as unknown as Record<string, unknown>,
      });

      await recordTierAudit(
        certificateId, null, 'tier-3', 'success',
        visionResult.confidence, tier3Time, countFields(visionResult.data),
        null, formatAnalysis
      );

      return {
        success: true,
        data: visionResult.data,
        finalTier: 'tier-3',
        confidence: visionResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost,
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

    const tier3Status: TierStatus = visionResult.success ? 'escalated' : 'failed';
    const tier3Reason = visionResult.error || `Confidence ${visionResult.confidence.toFixed(2)} below threshold`;

    tierAudit.push({
      tier: 'tier-3',
      attemptedAt: new Date(tier3Start),
      completedAt: new Date(),
      status: tier3Status,
      confidence: visionResult.confidence,
      processingTimeMs: tier3Time,
      cost: visionResult.cost,
      extractedFieldCount: countFields(visionResult.data),
      escalationReason: tier3Reason,
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-3', tier3Status,
      visionResult.confidence, tier3Time, countFields(visionResult.data),
      tier3Reason, formatAnalysis
    );

    if (totalCost > maxCost) {
      warnings.push(`Cost limit exceeded after Tier 3 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
      return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit, visionResult.data);
    }
  } else {
    const tier3BudgetReason = `Insufficient budget remaining (${(maxCost - totalCost).toFixed(4)} < ${TIER_COST_ESTIMATES['tier-3']})`;
    
    tierAudit.push({
      tier: 'tier-3',
      attemptedAt: new Date(),
      completedAt: new Date(),
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      cost: 0,
      extractedFieldCount: 0,
      escalationReason: tier3BudgetReason,
      rawOutput: null,
    });

    await recordTierAudit(
      certificateId, null, 'tier-3', 'skipped',
      0, 0, 0, tier3BudgetReason, formatAnalysis
    );
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
    escalationReason: 'All AI tiers exhausted or confidence too low',
    rawOutput: null,
  });

  await recordTierAudit(
    certificateId, null, 'tier-4', 'success',
    0, 0, 0, 'All AI tiers exhausted', formatAnalysis
  );

  warnings.push('Automatic extraction did not achieve sufficient confidence. Manual review required.');

  return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit);
}

function countFields(data: ExtractedCertificateData): number {
  let count = 0;
  const fields = ['certificateNumber', 'propertyAddress', 'inspectionDate', 'expiryDate', 'outcome', 'engineerName', 'engineerRegistration'];
  for (const field of fields) {
    if (data[field as keyof ExtractedCertificateData]) count++;
  }
  if (data.appliances?.length) count++;
  if (data.defects?.length) count++;
  return count;
}

function createManualReviewResult(
  startTime: number,
  totalCost: number,
  warnings: string[],
  formatAnalysis: FormatAnalysis,
  qrMetadata: QRMetadataResult | undefined,
  tierAudit: TierAuditEntry[],
  partialData?: ExtractedCertificateData
): ExtractionResult {
  return {
    success: false,
    data: partialData || {
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
    totalCost,
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
