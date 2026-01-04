import type {
  ExtractionTier,
  TierStatus,
  ExtractionResult,
  ExtractionOptions,
  TierAuditEntry,
  ExtractedCertificateData,
} from './types';
import type { FormatAnalysis } from './format-detector';
import type { QRMetadataResult } from './qr-metadata';
import { 
  getDependencies, 
  TIER_COST_ESTIMATES, 
  type ExtractionDependencies, 
  type ExtractionSettings,
  type TierAuditRecord,
} from './dependencies';
import { logger } from '../../logger';

function getTier1ThresholdForDocType(
  docType: string | undefined, 
  settings: ExtractionSettings
): number {
  if (docType && settings.documentTypeThresholds[docType.toUpperCase()]) {
    return settings.documentTypeThresholds[docType.toUpperCase()];
  }
  return settings.tier1Threshold;
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
  bestConfidence: number = 0,
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
    confidence: bestConfidence,
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

export async function extractCertificateWithDI(
  certificateId: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  options: ExtractionOptions = {},
  deps: ExtractionDependencies = getDependencies()
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const tierAudit: TierAuditEntry[] = [];
  let totalCost = 0;
  const warnings: string[] = [];

  const extractionSettings = await deps.getSettings();
  let aiEnabled = extractionSettings.aiEnabled;
  if (options.forceAI) {
    aiEnabled = true;
  }

  const maxCost = extractionSettings.maxCostPerDocument;

  logger.info({ certificateId, mimeType, filename, aiEnabled, maxCost }, 'Starting tiered extraction with DI');

  const tier0Start = Date.now();
  const formatAnalysis = await deps.analyseDocument(buffer, mimeType, filename);
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

  await deps.recordTierAudit({
    certificateId,
    extractionRunId: null,
    tier: 'tier-0',
    status: 'success',
    confidence: 1,
    processingTimeMs: tier0Time,
    extractedFieldCount: 0,
    escalationReason: null,
    formatAnalysis,
  });

  let qrMetadata: QRMetadataResult | undefined;
  if (formatAnalysis.isScanned || formatAnalysis.format === 'image') {
    const tier05Start = Date.now();
    qrMetadata = await deps.extractQRMetadata(buffer, mimeType);
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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-0.5',
        status: 'success',
        confidence: 0.95,
        processingTimeMs: tier05Time,
        extractedFieldCount: Object.keys(qrMetadata.extractedData).length,
        escalationReason: null,
        formatAnalysis,
        qrMetadata,
      });

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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-0.5',
      status: 'escalated',
      confidence: 0,
      processingTimeMs: tier05Time,
      extractedFieldCount: 0,
      escalationReason: 'No QR codes or verification data found',
      formatAnalysis,
      qrMetadata,
    });
  }

  if (formatAnalysis.hasTextLayer && formatAnalysis.textContent) {
    const tier1Start = Date.now();
    const templateResult = deps.extractWithTemplate(
      formatAnalysis.textContent,
      formatAnalysis.detectedCertificateType,
      extractionSettings.customPatterns
    );
    const tier1Time = Date.now() - tier1Start;

    const tier1Threshold = getTier1ThresholdForDocType(
      formatAnalysis.detectedCertificateType, 
      extractionSettings
    );

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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-1',
        status: 'success',
        confidence: templateResult.confidence,
        processingTimeMs: tier1Time,
        extractedFieldCount: templateResult.matchedFields,
        escalationReason: null,
        formatAnalysis,
      });

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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-1',
      status: 'escalated',
      confidence: templateResult.confidence,
      processingTimeMs: tier1Time,
      extractedFieldCount: templateResult.matchedFields,
      escalationReason: `Confidence ${templateResult.confidence.toFixed(2)} below threshold ${tier1Threshold}`,
      formatAnalysis,
    });

    if (!aiEnabled) {
      const skippedTiers: ExtractionTier[] = ['tier-1.5', 'tier-2', 'tier-3'];
      for (const tier of skippedTiers) {
        tierAudit.push({
          tier,
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

        await deps.recordTierAudit({
          certificateId,
          extractionRunId: null,
          tier,
          status: 'skipped',
          confidence: 0,
          processingTimeMs: 0,
          extractedFieldCount: 0,
          escalationReason: 'AI processing disabled in factory settings',
          formatAnalysis,
        });
      }

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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-4',
        status: 'success',
        confidence: templateResult.confidence,
        processingTimeMs: 0,
        extractedFieldCount: templateResult.matchedFields,
        escalationReason: 'AI processing disabled, routing to manual review',
        formatAnalysis,
      });

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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-4',
      status: 'success',
      confidence: 0,
      processingTimeMs: 0,
      extractedFieldCount: 0,
      escalationReason: 'AI processing disabled, no text layer available',
      formatAnalysis,
    });

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
    const claudeTextResult = await deps.extractWithClaudeText(
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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-1.5',
        status: 'escalated',
        confidence: claudeTextResult.confidence,
        processingTimeMs: tier15Time,
        extractedFieldCount: countFields(claudeTextResult.data),
        escalationReason: costExceededReason,
        formatAnalysis,
      });

      warnings.push(`Cost limit exceeded. Routing to manual review.`);
      
      const bestConf = Math.max(...tierAudit.map(t => t.confidence), claudeTextResult.confidence);
      return createManualReviewResult(
        startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit,
        bestConf, claudeTextResult.data
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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-1.5',
        status: 'success',
        confidence: claudeTextResult.confidence,
        processingTimeMs: tier15Time,
        extractedFieldCount: countFields(claudeTextResult.data),
        escalationReason: null,
        formatAnalysis,
      });

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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-1.5',
      status: tier15Status,
      confidence: claudeTextResult.confidence,
      processingTimeMs: tier15Time,
      extractedFieldCount: countFields(claudeTextResult.data),
      escalationReason: tier15Reason,
      formatAnalysis,
    });
  }

  if (totalCost > maxCost) {
    warnings.push(`Cost limit exceeded after Tier 1.5 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
    return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit);
  }

  if (deps.isAzureDIConfigured() && totalCost + TIER_COST_ESTIMATES['tier-2'] <= maxCost) {
    const tier2Start = Date.now();
    const azureResult = await deps.extractWithAzureDI(buffer, mimeType);
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
        rawOutput: azureResult.structuredData ?? null,
      });

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-2',
        status: 'success',
        confidence: azureResult.confidence,
        processingTimeMs: tier2Time,
        extractedFieldCount: countFields(azureResult.data),
        escalationReason: null,
        formatAnalysis,
      });

      return {
        success: true,
        data: azureResult.data,
        finalTier: 'tier-2',
        confidence: azureResult.confidence,
        totalProcessingTimeMs: Date.now() - startTime,
        totalCost,
        requiresReview: false,
        warnings,
        rawText: azureResult.rawText ?? null,
        documentFormat: formatAnalysis.format,
        documentClassification: formatAnalysis.classification,
        pageCount: azureResult.pageCount ?? formatAnalysis.pageCount,
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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-2',
      status: tier2Status,
      confidence: azureResult.confidence,
      processingTimeMs: tier2Time,
      extractedFieldCount: countFields(azureResult.data),
      escalationReason: tier2Reason,
      formatAnalysis,
    });

    if (totalCost > maxCost) {
      warnings.push(`Cost limit exceeded after Tier 2 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
      const bestConf = Math.max(...tierAudit.map(t => t.confidence), azureResult.confidence);
      return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit, bestConf, azureResult.data);
    }
  } else if (!deps.isAzureDIConfigured()) {
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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-2',
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      extractedFieldCount: 0,
      escalationReason: 'Azure Document Intelligence not configured',
      formatAnalysis,
    });
  } else {
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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-2',
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      extractedFieldCount: 0,
      escalationReason: budgetSkipReason,
      formatAnalysis,
    });
  }

  if (totalCost + TIER_COST_ESTIMATES['tier-3'] <= maxCost) {
    const tier3Start = Date.now();
    let visionResult;

    if (formatAnalysis.format === 'image' || mimeType.startsWith('image/')) {
      visionResult = await deps.extractWithClaudeVision(buffer, mimeType, formatAnalysis.detectedCertificateType);
    } else {
      visionResult = await deps.extractWithClaudeVisionFromPDF(buffer, formatAnalysis.detectedCertificateType);
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

      await deps.recordTierAudit({
        certificateId,
        extractionRunId: null,
        tier: 'tier-3',
        status: 'success',
        confidence: visionResult.confidence,
        processingTimeMs: tier3Time,
        extractedFieldCount: countFields(visionResult.data),
        escalationReason: null,
        formatAnalysis,
      });

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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-3',
      status: tier3Status,
      confidence: visionResult.confidence,
      processingTimeMs: tier3Time,
      extractedFieldCount: countFields(visionResult.data),
      escalationReason: tier3Reason,
      formatAnalysis,
    });

    if (totalCost > maxCost) {
      warnings.push(`Cost limit exceeded after Tier 3 (${totalCost.toFixed(4)} > ${maxCost}). Routing to manual review.`);
      const bestConf = Math.max(...tierAudit.map(t => t.confidence), visionResult.confidence);
      return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit, bestConf, visionResult.data);
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

    await deps.recordTierAudit({
      certificateId,
      extractionRunId: null,
      tier: 'tier-3',
      status: 'skipped',
      confidence: 0,
      processingTimeMs: 0,
      extractedFieldCount: 0,
      escalationReason: tier3BudgetReason,
      formatAnalysis,
    });
  }

  const extractionTiers = tierAudit.filter(t => !t.tier.startsWith('tier-0'));
  const bestConfidence = extractionTiers.length > 0 
    ? Math.max(...extractionTiers.map(t => t.confidence), 0) 
    : 0;
  const bestTier = extractionTiers.find(t => t.confidence === bestConfidence);
  
  tierAudit.push({
    tier: 'tier-4',
    attemptedAt: new Date(),
    completedAt: new Date(),
    status: 'success',
    confidence: bestConfidence,
    processingTimeMs: 0,
    cost: 0,
    extractedFieldCount: bestTier?.extractedFieldCount || 0,
    escalationReason: `All AI tiers exhausted. Best confidence: ${(bestConfidence * 100).toFixed(0)}% at ${bestTier?.tier || 'unknown'}`,
    rawOutput: null,
  });

  await deps.recordTierAudit({
    certificateId,
    extractionRunId: null,
    tier: 'tier-4',
    status: 'success',
    confidence: bestConfidence,
    processingTimeMs: 0,
    extractedFieldCount: bestTier?.extractedFieldCount || 0,
    escalationReason: `All AI tiers exhausted. Best: ${(bestConfidence * 100).toFixed(0)}% at ${bestTier?.tier || 'unknown'}`,
    formatAnalysis,
  });

  warnings.push(`Automatic extraction achieved ${(bestConfidence * 100).toFixed(0)}% confidence but requires manual review.`);

  return createManualReviewResult(startTime, totalCost, warnings, formatAnalysis, qrMetadata, tierAudit, bestConfidence);
}
