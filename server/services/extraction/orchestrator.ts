import { db } from '../../db';
import { extractionTierAudits, factorySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  ExtractionTier,
  TierStatus,
  ExtractionResult,
  ExtractionOptions,
} from './types';
import type { FormatAnalysis } from './format-detector';
import type { QRMetadataResult } from './qr-metadata';
import { extractCertificateWithDI } from './orchestrator-di';
import { getDependencies, TIER_ORDER, TIER_COST_ESTIMATES } from './dependencies';
import { logger } from '../../logger';

export async function isAIProcessingEnabled(): Promise<boolean> {
  const settings = await db.select().from(factorySettings);
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  return settingsMap.get('AI_EXTRACTION_ENABLED') === 'true' ||
         settingsMap.get('extraction.enableAIProcessing') === 'true';
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
  return extractCertificateWithDI(certificateId, buffer, mimeType, filename, options, getDependencies());
}

export async function getTierAuditForCertificate(certificateId: string) {
  return db
    .select()
    .from(extractionTierAudits)
    .where(eq(extractionTierAudits.certificateId, certificateId))
    .orderBy(extractionTierAudits.tierOrder);
}
