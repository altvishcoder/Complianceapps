import crypto from 'crypto';
import { db } from '../db';
import { certificates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingCertificateId: string | null;
  existingCertificate: typeof certificates.$inferSelect | null;
  fileHash: string;
}

export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function checkForDuplicate(
  buffer: Buffer,
  organisationId: string
): Promise<DuplicateCheckResult> {
  const fileHash = calculateFileHash(buffer);
  
  const existing = await db.select()
    .from(certificates)
    .where(
      and(
        eq(certificates.fileHash, fileHash),
        eq(certificates.organisationId, organisationId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    logger.info({ 
      fileHash, 
      existingCertificateId: existing[0].id,
      fileName: existing[0].fileName 
    }, 'Duplicate certificate detected');
    
    return {
      isDuplicate: true,
      existingCertificateId: existing[0].id,
      existingCertificate: existing[0],
      fileHash,
    };
  }
  
  return {
    isDuplicate: false,
    existingCertificateId: null,
    existingCertificate: null,
    fileHash,
  };
}

export async function updateCertificateHash(
  certificateId: string,
  fileHash: string
): Promise<void> {
  await db.update(certificates)
    .set({ fileHash })
    .where(eq(certificates.id, certificateId));
}

export interface DuplicateStats {
  totalCertificates: number;
  uniqueHashes: number;
  duplicateCount: number;
  duplicatesByType: Record<string, number>;
}

export async function getDuplicateStats(organisationId: string): Promise<DuplicateStats> {
  const allCerts = await db.select({
    id: certificates.id,
    fileHash: certificates.fileHash,
    certificateType: certificates.certificateType,
  })
    .from(certificates)
    .where(eq(certificates.organisationId, organisationId));
  
  const hashCounts = new Map<string, { count: number; types: string[] }>();
  
  for (const cert of allCerts) {
    if (cert.fileHash) {
      const existing = hashCounts.get(cert.fileHash) || { count: 0, types: [] };
      existing.count++;
      existing.types.push(cert.certificateType);
      hashCounts.set(cert.fileHash, existing);
    }
  }
  
  let duplicateCount = 0;
  const duplicatesByType: Record<string, number> = {};
  
  for (const [_, data] of hashCounts) {
    if (data.count > 1) {
      duplicateCount += data.count - 1;
      for (const type of data.types.slice(1)) {
        duplicatesByType[type] = (duplicatesByType[type] || 0) + 1;
      }
    }
  }
  
  return {
    totalCertificates: allCerts.length,
    uniqueHashes: hashCounts.size,
    duplicateCount,
    duplicatesByType,
  };
}
