import { db } from '../db';
import { certificates, users, properties } from '@shared/schema';
import { sql, and, eq, lte, gte, isNotNull } from 'drizzle-orm';
import { logger } from '../logger';

interface ExpiryAlert {
  certificateId: string;
  certificateType: string;
  propertyAddress: string;
  propertyId: string;
  expiryDate: string;
  daysUntilExpiry: number;
  organisationId: string;
}

export async function getCertificatesExpiringSoon(daysAhead: number = 30, organisationId?: string): Promise<ExpiryAlert[]> {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  if (!organisationId) {
    logger.warn('getCertificatesExpiringSoon called without organisationId - returning empty results for security');
    return [];
  }
  
  try {
    const results = await db.execute(sql`
      SELECT 
        c.id as certificate_id,
        c.type as certificate_type,
        c.expiry_date,
        c.organisation_id,
        p.id as property_id,
        p.address as property_address
      FROM certificates c
      LEFT JOIN properties p ON c.property_id = p.id
      WHERE c.expiry_date IS NOT NULL
        AND c.expiry_date >= ${now}
        AND c.expiry_date <= ${futureDate}
        AND c.status != 'EXPIRED'
        AND c.organisation_id = ${organisationId}
      ORDER BY c.expiry_date ASC
    `);
    
    return (results.rows as any[]).map(row => ({
      certificateId: row.certificate_id,
      certificateType: row.certificate_type,
      propertyAddress: row.property_address || 'Unknown',
      propertyId: row.property_id,
      expiryDate: row.expiry_date?.toISOString?.() || row.expiry_date,
      daysUntilExpiry: Math.ceil((new Date(row.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      organisationId: row.organisation_id,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get expiring certificates');
    throw error;
  }
}

export async function getExpiryAlertsByOrganisation(organisationId: string, daysAhead: number = 30): Promise<ExpiryAlert[]> {
  return getCertificatesExpiringSoon(daysAhead, organisationId);
}

export async function getExpiryStats(organisationId?: string): Promise<{
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  expiredCount: number;
}> {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);
  
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);
  
  try {
    const orgFilter = organisationId ? sql`AND c.organisation_id = ${organisationId}` : sql``;
    
    const [in7Result, in30Result, in90Result, expiredResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as count FROM certificates c
        WHERE c.expiry_date IS NOT NULL 
          AND c.expiry_date >= ${now}
          AND c.expiry_date <= ${in7Days}
          ${orgFilter}
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM certificates c
        WHERE c.expiry_date IS NOT NULL 
          AND c.expiry_date >= ${now}
          AND c.expiry_date <= ${in30Days}
          ${orgFilter}
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM certificates c
        WHERE c.expiry_date IS NOT NULL 
          AND c.expiry_date >= ${now}
          AND c.expiry_date <= ${in90Days}
          ${orgFilter}
      `),
      db.execute(sql`
        SELECT COUNT(*) as count FROM certificates c
        WHERE (c.expiry_date IS NOT NULL AND c.expiry_date < ${now})
          OR c.status = 'EXPIRED'
          ${orgFilter}
      `),
    ]);
    
    return {
      expiringIn7Days: Number((in7Result.rows[0] as any)?.count || 0),
      expiringIn30Days: Number((in30Result.rows[0] as any)?.count || 0),
      expiringIn90Days: Number((in90Result.rows[0] as any)?.count || 0),
      expiredCount: Number((expiredResult.rows[0] as any)?.count || 0),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get expiry stats');
    throw error;
  }
}

export async function markExpiredCertificates(): Promise<number> {
  const now = new Date();
  
  try {
    const result = await db.execute(sql`
      UPDATE certificates 
      SET status = 'EXPIRED'
      WHERE expiry_date IS NOT NULL 
        AND expiry_date < ${now}
        AND status != 'EXPIRED'
      RETURNING id
    `);
    
    const count = result.rows.length;
    if (count > 0) {
      logger.info({ count }, `Marked ${count} certificates as expired`);
    }
    
    return count;
  } catch (error) {
    logger.error({ error }, 'Failed to mark expired certificates');
    throw error;
  }
}
