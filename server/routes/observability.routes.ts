import { Router, Request, Response } from 'express';
import { circuitBreaker } from '../services/circuit-breaker';
import { getQueueStats } from '../job-queue';
import { db } from '../db';
import { extractionRuns, certificates, humanReviews } from '@shared/schema';
import { sql, gte, count, avg } from 'drizzle-orm';
import { requireAdminAuth } from '../middleware/admin-auth';
import { logger } from '../logger';

const router = Router();

interface CircuitBreakerStatus {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  totalCalls: number;
  totalFailures: number;
  lastFailureTime: number | null;
  config: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
  };
}

router.get('/circuit-breakers', requireAdminAuth(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const states = circuitBreaker.getAllStates();
    res.json({ 
      success: true, 
      data: states,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch circuit breaker states' 
    });
  }
});

router.get('/queue-metrics', requireAdminAuth(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const metrics = await getQueueStats();
    res.json({ 
      success: true, 
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch queue metrics' 
    });
  }
});

router.get('/processing-metrics', requireAdminAuth(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [extractionStats, certificateStats, reviewStats] = await Promise.all([
      db.select({
        totalRuns: count(),
        avgProcessingTime: avg(extractionRuns.processingTimeMs),
        avgConfidence: avg(extractionRuns.confidence),
      })
      .from(extractionRuns)
      .where(gte(extractionRuns.createdAt, last24Hours)),
      
      db.select({
        total: count(),
        uploaded: sql<number>`count(*) filter (where ${certificates.status} = 'UPLOADED')`,
        processing: sql<number>`count(*) filter (where ${certificates.status} = 'PROCESSING')`,
        extracted: sql<number>`count(*) filter (where ${certificates.status} = 'EXTRACTED')`,
        needsReview: sql<number>`count(*) filter (where ${certificates.status} = 'NEEDS_REVIEW')`,
        approved: sql<number>`count(*) filter (where ${certificates.status} = 'APPROVED')`,
        failed: sql<number>`count(*) filter (where ${certificates.status} = 'FAILED')`,
      })
      .from(certificates)
      .where(gte(certificates.createdAt, last24Hours)),
      
      db.select({
        totalReviews: count(),
        correctCount: sql<number>`count(*) filter (where ${humanReviews.wasCorrect} = true)`,
        avgChangeCount: avg(humanReviews.changeCount),
        avgReviewTime: avg(humanReviews.reviewTimeSeconds),
      })
      .from(humanReviews)
      .where(gte(humanReviews.reviewedAt, last24Hours)),
    ]);

    res.json({
      success: true,
      data: {
        extraction: extractionStats[0],
        certificates: certificateStats[0],
        reviews: reviewStats[0],
        period: '24h',
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch processing metrics' 
    });
  }
});

router.get('/confidence-baselines', requireAdminAuth(['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const baselines = await db.execute(sql`
      SELECT 
        certificate_type,
        field_name,
        count(*) as sample_count,
        avg(confidence_score) as avg_confidence,
        percentile_cont(0.5) within group (order by confidence_score) as median_confidence,
        sum(case when was_corrected then 1 else 0 end) as correction_count,
        1.0 - (sum(case when was_corrected then 1 else 0 end)::float / nullif(count(*), 0)) as accuracy_rate
      FROM field_confidence_scores
      GROUP BY certificate_type, field_name
      HAVING count(*) >= 10
      ORDER BY certificate_type, field_name
    `);

    res.json({
      success: true,
      data: baselines.rows || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch confidence baselines');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch confidence baselines',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
