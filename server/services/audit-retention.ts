import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';

const RETENTION_MONTHS = 12;

export async function archiveOldAuditEvents(): Promise<{ archivedCount: number; exportPath?: string }> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);
  
  try {
    // Count events to be archived
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM audit_events 
      WHERE created_at < ${cutoffDate}
    `);
    const count = Number((countResult.rows[0] as any)?.count || 0);
    
    if (count === 0) {
      logger.info('No audit events to archive');
      return { archivedCount: 0 };
    }
    
    // For now, we just delete old audit events
    // In production, you would export to cold storage (S3/GCS) before deleting
    await db.execute(sql`
      DELETE FROM audit_events 
      WHERE created_at < ${cutoffDate}
    `);
    
    logger.info({ archivedCount: count }, `Archived ${count} audit events older than ${RETENTION_MONTHS} months`);
    
    return { archivedCount: count };
  } catch (error) {
    logger.error({ error }, 'Failed to archive audit events');
    throw error;
  }
}

export async function getAuditStats(): Promise<{
  totalEvents: number;
  eventsLast30Days: number;
  eventsLast90Days: number;
  oldestEventDate: string | null;
  retentionMonths: number;
}> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const [totalResult, last30Result, last90Result, oldestResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM audit_events`),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_events WHERE created_at >= ${thirtyDaysAgo}`),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_events WHERE created_at >= ${ninetyDaysAgo}`),
      db.execute(sql`SELECT MIN(created_at) as oldest FROM audit_events`),
    ]);
    
    return {
      totalEvents: Number((totalResult.rows[0] as any)?.count || 0),
      eventsLast30Days: Number((last30Result.rows[0] as any)?.count || 0),
      eventsLast90Days: Number((last90Result.rows[0] as any)?.count || 0),
      oldestEventDate: (oldestResult.rows[0] as any)?.oldest?.toISOString() || null,
      retentionMonths: RETENTION_MONTHS,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get audit stats');
    throw error;
  }
}
