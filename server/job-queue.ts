import PgBoss from "pg-boss";
import { storage } from "./storage";
import { processExtractionAndSave } from "./extraction";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { enqueueWebhookEvent } from "./webhook-worker";
import { jobLogger } from "./logger";
import { runPatternAnalysis } from "./services/pattern-analysis";
import { db, pool } from "./db";
import { sql, eq } from "drizzle-orm";
import { ingestionJobs, certificates } from "@shared/schema";
import { 
  withRetryAndTimeout, 
  withTimeout, 
  withSafeDefaults,
  withCircuitBreaker,
  TimeoutError 
} from "./utils/resilience";

const objectStorageService = new ObjectStorageService();

const TIMEOUTS = {
  OBJECT_STORAGE: 60000,
  EXTRACTION: 300000,
  WEBHOOK: 30000,
  DATABASE_QUERY: 10000,
} as const;

const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Helper function to parse positive integers with fallback
const parsePositiveIntOrDefault = (value: string, defaultVal: number): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) || parsed <= 0 ? defaultVal : parsed;
};

let boss: PgBoss | null = null;

export const QUEUE_NAMES = {
  CERTIFICATE_INGESTION: "certificate-ingestion",
  WEBHOOK_DELIVERY: "webhook-delivery",
  RATE_LIMIT_CLEANUP: "rate-limit-cleanup",
  CERTIFICATE_WATCHDOG: "certificate-watchdog",
  REPORTING_REFRESH: "reporting-refresh",
  SCHEDULED_REPORT: "scheduled-report",
  PATTERN_ANALYSIS: "pattern-analysis",
  MV_REFRESH: "mv-refresh",
} as const;

interface IngestionJobData {
  jobId: string;
  propertyId: string;
  certificateType: string;
  fileName: string;
  objectPath: string | null;
  webhookUrl: string | null;
}

interface WebhookJobData {
  jobId: string;
  webhookUrl: string;
  payload: Record<string, unknown>;
  attemptCount: number;
}

interface ScheduledReportJobData {
  scheduledReportId: string;
  triggerType: 'scheduled' | 'manual';
}

export async function initJobQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for job queue");
  }

  // Load job queue configuration from Factory Settings with retry and safe defaults
  const retryLimit = await withSafeDefaults(
    async () => parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_RETRY_LIMIT', '3'), 3),
    3,
    'JOB_RETRY_LIMIT'
  );
  const retryDelay = await withSafeDefaults(
    async () => parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_RETRY_DELAY_SECONDS', '30'), 30),
    30,
    'JOB_RETRY_DELAY_SECONDS'
  );
  const archiveFailedAfterDays = await withSafeDefaults(
    async () => parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_ARCHIVE_FAILED_AFTER_DAYS', '7'), 7),
    7,
    'JOB_ARCHIVE_FAILED_AFTER_DAYS'
  );
  const deleteAfterDays = await withSafeDefaults(
    async () => parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_DELETE_AFTER_DAYS', '30'), 30),
    30,
    'JOB_DELETE_AFTER_DAYS'
  );

  jobLogger.info({ retryLimit, retryDelay, archiveFailedAfterDays, deleteAfterDays }, "Job queue configuration loaded");

  boss = new PgBoss({
    connectionString,
    retryLimit,
    retryDelay,
    retryBackoff: true,
    archiveFailedAfterSeconds: 60 * 60 * 24 * archiveFailedAfterDays,
    deleteAfterDays,
  });

  boss.on("error", (error) => {
    jobLogger.error({ error }, "Job queue error");
  });

  await boss.start();
  jobLogger.info("Job queue started successfully");

  await registerWorkers();

  return boss;
}

async function registerWorkers(): Promise<void> {
  if (!boss) return;

  for (let i = 0; i < 3; i++) {
    await boss.work<IngestionJobData>(
      QUEUE_NAMES.CERTIFICATE_INGESTION,
      async ([job]) => {
        if (job) {
          await processCertificateIngestion(job.data);
        }
      }
    );
  }

  for (let i = 0; i < 5; i++) {
    await boss.work<WebhookJobData>(
      QUEUE_NAMES.WEBHOOK_DELIVERY,
      async ([job]) => {
        if (job) {
          await processWebhookDelivery(job.data);
        }
      }
    );
  }

  await boss.work(
    QUEUE_NAMES.RATE_LIMIT_CLEANUP,
    async () => {
      await storage.cleanupExpiredRateLimits();
      jobLogger.debug("Rate limit cleanup completed");
    }
  );

  await boss.send(QUEUE_NAMES.RATE_LIMIT_CLEANUP, {}, { singletonKey: 'rate-limit-cleanup' });

  // Certificate processing watchdog - marks stuck certificates as failed
  // Using pg-boss schedule for proper job queue integration and monitoring
  
  // Create the queue first (required in pg-boss v10+)
  await boss.createQueue(QUEUE_NAMES.CERTIFICATE_WATCHDOG);
  
  // Register worker for the watchdog queue
  await boss.work(
    QUEUE_NAMES.CERTIFICATE_WATCHDOG,
    async () => {
      await processCertificateWatchdog();
    }
  );
  
  // Schedule watchdog to run every 5 minutes (configurable via factory settings)
  const watchdogIntervalMinutes = parsePositiveIntOrDefault(await storage.getFactorySettingValue('CERTIFICATE_WATCHDOG_INTERVAL_MINUTES', '5'), 5);
  const cronExpression = `*/${watchdogIntervalMinutes} * * * *`;
  
  await boss.schedule(
    QUEUE_NAMES.CERTIFICATE_WATCHDOG,
    cronExpression,
    {},
    { tz: 'UTC' }
  );
  
  jobLogger.info({ cronExpression, intervalMinutes: watchdogIntervalMinutes }, "Certificate watchdog scheduled");

  // Run watchdog immediately on startup (after short delay to ensure setup complete)
  setTimeout(async () => {
    try {
      await triggerWatchdogNow();
    } catch (error) {
      jobLogger.error({ error }, "Initial certificate watchdog error");
    }
  }, 5000);

  // Reporting refresh job - refreshes materialized views and checks for due scheduled reports
  await boss.createQueue(QUEUE_NAMES.REPORTING_REFRESH);
  
  await boss.work(
    QUEUE_NAMES.REPORTING_REFRESH,
    async () => {
      await processReportingRefresh();
    }
  );
  
  // Schedule reporting refresh to run HOURLY to catch due scheduled reports
  // This ensures reports are picked up promptly after server restarts or outages
  await boss.schedule(
    QUEUE_NAMES.REPORTING_REFRESH,
    '0 * * * *', // Every hour at minute 0
    {},
    { tz: 'UTC' }
  );
  
  jobLogger.info("Reporting refresh scheduled hourly (checks for due scheduled reports)");
  
  // Run an immediate check for due reports on startup
  setTimeout(async () => {
    try {
      const enqueuedCount = await checkAndEnqueueDueReports();
      jobLogger.info({ enqueuedCount }, "Startup check: enqueued due scheduled reports");
    } catch (error) {
      jobLogger.error({ error }, "Startup scheduled report check failed");
    }
  }, 10000); // 10 second delay to ensure full initialization

  // Scheduled report execution queue - processes scheduled reports via pg-boss
  await boss.createQueue(QUEUE_NAMES.SCHEDULED_REPORT);
  
  await boss.work<ScheduledReportJobData>(
    QUEUE_NAMES.SCHEDULED_REPORT,
    async ([job]) => {
      if (job) {
        await processScheduledReport(job.data);
      }
    }
  );
  
  jobLogger.info("Scheduled report worker registered");

  await boss.createQueue(QUEUE_NAMES.PATTERN_ANALYSIS);
  
  await boss.work(
    QUEUE_NAMES.PATTERN_ANALYSIS,
    async () => {
      try {
        const result = await runPatternAnalysis();
        jobLogger.info({ 
          patternsIdentified: result.patternsIdentified,
          totalCorrections: result.totalCorrectionsAnalyzed 
        }, "Pattern analysis job completed");
      } catch (error) {
        jobLogger.error({ error }, "Pattern analysis job failed");
        throw error;
      }
    }
  );
  
  await boss.schedule(
    QUEUE_NAMES.PATTERN_ANALYSIS,
    '0 */4 * * *',
    {},
    { tz: 'UTC' }
  );
  
  jobLogger.info("Pattern analysis worker registered and scheduled every 4 hours");

  await boss.createQueue(QUEUE_NAMES.MV_REFRESH);
  
  await boss.work(
    QUEUE_NAMES.MV_REFRESH,
    async () => {
      try {
        const { refreshAllMaterializedViews, refreshMaterializedView, getRefreshSchedule } = await import("./db-optimization");
        
        const schedule = await getRefreshSchedule();
        if (schedule && !schedule.isEnabled) {
          jobLogger.info("Materialized view refresh is disabled, skipping");
          return;
        }
        
        jobLogger.info("Starting scheduled materialized view refresh");
        
        // Check if we should refresh all views or specific ones
        if (!schedule || schedule.refreshAll || !schedule.targetViews || schedule.targetViews.length === 0) {
          // Refresh all views
          const result = await refreshAllMaterializedViews('SCHEDULED');
          const successCount = result.results.filter(r => r.success).length;
          jobLogger.info({ 
            successCount,
            totalViews: result.results.length,
            totalDurationMs: result.totalDurationMs 
          }, "Scheduled materialized view refresh completed (all views)");
        } else {
          // Refresh only selected views
          const results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[] = [];
          for (const viewName of schedule.targetViews) {
            const result = await refreshMaterializedView(viewName, 'SCHEDULED');
            results.push({ viewName, ...result });
          }
          const successCount = results.filter(r => r.success).length;
          const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
          jobLogger.info({ 
            successCount,
            totalViews: results.length,
            totalDurationMs 
          }, "Scheduled materialized view refresh completed (selected views)");
        }
      } catch (error) {
        jobLogger.error({ error }, "Scheduled materialized view refresh failed");
        throw error;
      }
    }
  );
  
  // Load schedule from database or use default
  const { getRefreshSchedule } = await import("./db-optimization");
  const schedule = await getRefreshSchedule();
  const mvScheduleTime = schedule?.scheduleTime || '05:30';
  const mvTimezone = schedule?.timezone || 'Europe/London';
  const [mvHours, mvMinutes] = mvScheduleTime.split(':').map(Number);
  const mvCronExpression = `${mvMinutes} ${mvHours} * * *`;
  
  if (!schedule || schedule.isEnabled) {
    await boss.schedule(
      QUEUE_NAMES.MV_REFRESH,
      mvCronExpression,
      {},
      { tz: mvTimezone }
    );
    jobLogger.info({ scheduleTime: mvScheduleTime, timezone: mvTimezone, cronExpression: mvCronExpression }, "Materialized view refresh worker scheduled");
  } else {
    await boss.unschedule(QUEUE_NAMES.MV_REFRESH);
    jobLogger.info("Materialized view refresh worker disabled (not scheduled)");
  }

  jobLogger.info("Workers registered for all queues");
}

async function processCertificateIngestion(data: IngestionJobData): Promise<void> {
  const { jobId, propertyId, certificateType, fileName, objectPath, webhookUrl } = data;
  
  jobLogger.info({ jobId, propertyId, certificateType }, "Processing ingestion job");
  
  // Idempotency check: If job is already complete or failed, skip processing
  const ingestionJob = await storage.getIngestionJob(jobId);
  if (!ingestionJob) {
    throw new Error(`Ingestion job ${jobId} not found`);
  }

  if (ingestionJob.status === "COMPLETE") {
    jobLogger.info({ jobId }, "Ingestion job already completed, skipping (idempotency)");
    return;
  }

  if (ingestionJob.status === "FAILED" && ingestionJob.attemptCount >= 3) {
    jobLogger.info({ jobId, attemptCount: ingestionJob.attemptCount }, "Ingestion job exceeded max retries, skipping");
    return;
  }

  // Check for duplicate certificate creation (idempotency by job reference)
  if (ingestionJob.certificateId) {
    const existingCert = await storage.getCertificate(ingestionJob.certificateId);
    if (existingCert && existingCert.status !== "FAILED") {
      jobLogger.info({ jobId, certificateId: ingestionJob.certificateId }, "Certificate already created for this job, skipping");
      return;
    }
  }

  try {
    // Acquire row-level lock and update status atomically
    await db.execute(sql`
      UPDATE ${ingestionJobs}
      SET status = 'PROCESSING', 
          last_attempt_at = NOW(),
          attempt_count = attempt_count + 1
      WHERE id = ${jobId} AND status NOT IN ('COMPLETE', 'FAILED')
    `);

    const property = await storage.getProperty(propertyId);
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    let fileBuffer: Buffer | undefined;
    let fileBase64: string | undefined;
    let mimeType: string | undefined;

    if (objectPath) {
      // Download file with timeout and circuit breaker
      try {
        fileBuffer = await withCircuitBreaker(
          'object-storage',
          async () => withTimeout(
            async () => {
              const file = await objectStorageService.getObjectEntityFile(objectPath);
              if (file) {
                const [contents] = await file.download();
                return contents;
              }
              return undefined;
            },
            { timeoutMs: TIMEOUTS.OBJECT_STORAGE, timeoutMessage: 'Object storage download timed out' }
          ),
          { failureThreshold: 3, resetTimeoutMs: 60000 }
        );

        const extension = fileName.split(".").pop()?.toLowerCase();
        if (extension === "pdf") {
          mimeType = "application/pdf";
        } else if (["jpg", "jpeg"].includes(extension || "")) {
          mimeType = "image/jpeg";
          fileBase64 = fileBuffer?.toString("base64");
        } else if (extension === "png") {
          mimeType = "image/png";
          fileBase64 = fileBuffer?.toString("base64");
        } else if (extension === "webp") {
          mimeType = "image/webp";
          fileBase64 = fileBuffer?.toString("base64");
        }
      } catch (error) {
        const isTimeout = error instanceof TimeoutError;
        jobLogger.error({ error, jobId, objectPath, isTimeout }, "Error downloading file");
        throw new Error(`Failed to download file from object storage: ${error}`);
      }
    }

    if (!fileBase64 && !fileBuffer) {
      throw new Error("No file content available for processing");
    }

    await storage.updateIngestionJob(jobId, { status: "EXTRACTING" });

    // Create certificate within a controlled scope
    const certificate = await storage.createCertificate({
      propertyId,
      organisationId: ingestionJob.organisationId,
      certificateType: certificateType as "GAS_SAFETY" | "EICR" | "EPC" | "FIRE_RISK_ASSESSMENT" | "LEGIONELLA_ASSESSMENT" | "ASBESTOS_SURVEY" | "LIFT_LOLER" | "OTHER",
      fileName,
      fileSize: fileBuffer?.length || 0,
      fileType: mimeType || "application/octet-stream",
      status: "PROCESSING",
    });

    // Link certificate to job immediately for idempotency tracking
    await storage.updateIngestionJob(jobId, { certificateId: certificate.id });

    // Run extraction with timeout
    await withTimeout(
      async () => processExtractionAndSave(
        certificate.id,
        certificateType,
        fileBase64,
        mimeType || "application/octet-stream",
        fileBuffer
      ),
      { timeoutMs: TIMEOUTS.EXTRACTION, timeoutMessage: 'Certificate extraction timed out' }
    );

    const certificateId = certificate.id;

    await storage.updateIngestionJob(jobId, {
      status: "COMPLETE",
      completedAt: new Date(),
      certificateId: certificateId || undefined,
      statusMessage: `Successfully processed ${certificateType} certificate`,
    });

    jobLogger.info({ jobId, certificateId, propertyId }, "Ingestion job completed successfully");

    if (webhookUrl) {
      await enqueueWebhook({
        jobId,
        webhookUrl,
        payload: {
          event: "ingestion.completed",
          jobId,
          status: "COMPLETE",
          certificateId,
          propertyId,
          certificateType,
          completedAt: new Date().toISOString(),
        },
        attemptCount: 0,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof TimeoutError;
    jobLogger.error({ jobId, error: errorMessage, propertyId, isTimeout }, "Ingestion job failed");

    await storage.updateIngestionJob(jobId, {
      status: "FAILED",
      statusMessage: `Processing failed: ${errorMessage}`,
      errorDetails: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined, isTimeout },
    });

    if (webhookUrl) {
      await enqueueWebhook({
        jobId,
        webhookUrl,
        payload: {
          event: "ingestion.failed",
          jobId,
          status: "FAILED",
          propertyId,
          certificateType,
          error: errorMessage,
          failedAt: new Date().toISOString(),
        },
        attemptCount: 0,
      });
    }

    throw error;
  }
}

async function processWebhookDelivery(data: WebhookJobData): Promise<void> {
  const { jobId, webhookUrl, payload, attemptCount } = data;
  
  jobLogger.info({ jobId, webhookUrl, attempt: attemptCount + 1 }, "Delivering webhook");
  
  try {
    // Use circuit breaker for webhook delivery to prevent cascading failures
    await withCircuitBreaker(
      `webhook-${new URL(webhookUrl).hostname}`,
      async () => withTimeout(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.WEBHOOK);
          
          try {
            const response = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-ComplianceAI-Event": payload.event as string,
                "X-ComplianceAI-JobId": jobId,
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => 'Unable to read response');
              throw new Error(`Webhook returned status ${response.status}: ${errorText}`);
            }
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { timeoutMs: TIMEOUTS.WEBHOOK, timeoutMessage: `Webhook delivery timed out after ${TIMEOUTS.WEBHOOK}ms` }
      ),
      { failureThreshold: 5, resetTimeoutMs: 120000 }
    );

    jobLogger.info({ jobId }, "Webhook delivered successfully");
  } catch (error) {
    const isTimeout = error instanceof TimeoutError;
    jobLogger.error({ jobId, error, webhookUrl, isTimeout }, "Webhook delivery failed");
    throw error;
  }
}

export async function enqueueIngestionJob(data: IngestionJobData): Promise<string | null> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }

  return await boss.send(QUEUE_NAMES.CERTIFICATE_INGESTION, data, {
    retryLimit: 3,
    retryDelay: 60,
    expireInMinutes: 60,
  });
}

export async function enqueueWebhook(data: WebhookJobData): Promise<string | null> {
  if (!boss) {
    jobLogger.warn("Queue not initialized, webhook not enqueued");
    return null;
  }

  return await boss.send(QUEUE_NAMES.WEBHOOK_DELIVERY, data, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInMinutes: 30,
  });
}

export async function getQueueStats(): Promise<{
  ingestion: { queued: number; active: number; completed: number; failed: number };
  webhook: { queued: number; active: number; completed: number; failed: number };
}> {
  if (!boss) {
    return {
      ingestion: { queued: 0, active: 0, completed: 0, failed: 0 },
      webhook: { queued: 0, active: 0, completed: 0, failed: 0 },
    };
  }

  const ingestionStats = await boss.getQueueSize(QUEUE_NAMES.CERTIFICATE_INGESTION);
  const webhookStats = await boss.getQueueSize(QUEUE_NAMES.WEBHOOK_DELIVERY);

  return {
    ingestion: {
      queued: typeof ingestionStats === "number" ? ingestionStats : 0,
      active: 0,
      completed: 0,
      failed: 0,
    },
    webhook: {
      queued: typeof webhookStats === "number" ? webhookStats : 0,
      active: 0,
      completed: 0,
      failed: 0,
    },
  };
}

async function processCertificateWatchdog(): Promise<void> {
  const timeoutMinutes = parsePositiveIntOrDefault(await storage.getFactorySettingValue('CERTIFICATE_PROCESSING_TIMEOUT_MINUTES', '20'), 20);
  
  jobLogger.info({ timeoutMinutes }, "Running certificate watchdog check");
  
  const stuckCertificates = await storage.findAndFailStuckCertificates(timeoutMinutes);
  
  if (stuckCertificates.length > 0) {
    jobLogger.warn({ count: stuckCertificates.length, certificateIds: stuckCertificates.map(c => c.id) }, 
      "Marked stuck certificates as failed due to processing timeout");
  } else {
    jobLogger.debug("No stuck certificates found");
  }
}

export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    jobLogger.info("Job queue stopped");
  }
}

// Trigger the certificate watchdog to run immediately on demand
export async function triggerWatchdogNow(): Promise<string | null> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  jobLogger.info("Manually triggering certificate watchdog");
  const jobId = await boss.send(QUEUE_NAMES.CERTIFICATE_WATCHDOG, {}, { 
    singletonKey: 'manual-watchdog-trigger',
    singletonSeconds: 60 // Prevent duplicate manual triggers within 60 seconds
  });
  
  return jobId;
}

// Trigger pattern analysis job manually
export async function triggerPatternAnalysis(): Promise<string | null> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  jobLogger.info("Manually triggering pattern analysis");
  const jobId = await boss.send(QUEUE_NAMES.PATTERN_ANALYSIS, {}, {
    singletonKey: 'manual-pattern-analysis-trigger',
    singletonSeconds: 300 // Prevent duplicate manual triggers within 5 minutes
  });
  
  return jobId;
}

// Update the watchdog schedule interval
export async function updateWatchdogSchedule(intervalMinutes: number): Promise<void> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  if (intervalMinutes < 1 || intervalMinutes > 60) {
    throw new Error("Interval must be between 1 and 60 minutes");
  }
  
  const cronExpression = `*/${intervalMinutes} * * * *`;
  
  // Ensure queue exists before scheduling (handles race with init)
  await boss.createQueue(QUEUE_NAMES.CERTIFICATE_WATCHDOG);
  
  // pg-boss schedule() with same name will upsert/overwrite the schedule
  // This preserves job history in pgboss.job table while updating the cron expression
  await boss.schedule(
    QUEUE_NAMES.CERTIFICATE_WATCHDOG,
    cronExpression,
    {},
    { tz: 'UTC' }
  );
  
  jobLogger.info({ cronExpression, intervalMinutes }, "Certificate watchdog schedule updated");
}

// Enable or disable the watchdog job
export async function setWatchdogEnabled(enabled: boolean): Promise<void> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  if (enabled) {
    // Re-enable: get the interval from factory settings and reschedule
    const { storage } = await import('./storage');
    const intervalSetting = await storage.getFactorySetting('CERTIFICATE_WATCHDOG_INTERVAL_MINUTES');
    const intervalMinutes = intervalSetting ? parseInt(intervalSetting.value) : 5;
    
    await boss.createQueue(QUEUE_NAMES.CERTIFICATE_WATCHDOG);
    await boss.schedule(
      QUEUE_NAMES.CERTIFICATE_WATCHDOG,
      `*/${intervalMinutes} * * * *`,
      {},
      { tz: 'UTC' }
    );
    jobLogger.info({ intervalMinutes }, "Certificate watchdog enabled");
  } else {
    // Disable: unschedule the job
    await boss.unschedule(QUEUE_NAMES.CERTIFICATE_WATCHDOG);
    jobLogger.info("Certificate watchdog disabled");
  }
}

// Update the materialized view refresh schedule
export async function updateMvRefreshSchedule(scheduleTime: string, timezone: string, isEnabled: boolean): Promise<void> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  await boss.createQueue(QUEUE_NAMES.MV_REFRESH);
  
  if (isEnabled) {
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const cronExpression = `${minutes} ${hours} * * *`;
    
    await boss.schedule(
      QUEUE_NAMES.MV_REFRESH,
      cronExpression,
      {},
      { tz: timezone }
    );
    jobLogger.info({ scheduleTime, timezone, cronExpression }, "Materialized view refresh schedule updated");
  } else {
    await boss.unschedule(QUEUE_NAMES.MV_REFRESH);
    jobLogger.info("Materialized view refresh disabled");
  }
}

// Get scheduled jobs status for monitoring UI
export interface ScheduledJobInfo {
  name: string;
  cron: string;
  timezone: string;
  lastRun: string | null;
  nextRun: string | null;
  isActive: boolean;
  scheduleType: 'scheduled' | 'on-demand';
  description?: string;
  stateCounts: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    retry: number;
    expired: number;
    cancelled: number;
  };
  recentJobs: Array<{
    id: string;
    state: string;
    createdOn: string;
    completedOn: string | null;
    startedOn?: string | null;
  }>;
}

export async function getScheduledJobsStatus(): Promise<ScheduledJobInfo[]> {
  if (!boss) {
    return [];
  }
  
  const scheduledJobs: ScheduledJobInfo[] = [];
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  
  const allQueueNames = [
    { name: QUEUE_NAMES.CERTIFICATE_WATCHDOG, description: 'Marks stuck certificates as failed', defaultCron: '*/5 * * * *', scheduleType: 'scheduled' as const },
    { name: QUEUE_NAMES.REPORTING_REFRESH, description: 'Refreshes reports and checks for due scheduled reports', defaultCron: '0 * * * *', scheduleType: 'scheduled' as const },
    { name: QUEUE_NAMES.PATTERN_ANALYSIS, description: 'Analyzes correction patterns for extraction improvement', defaultCron: '0 */4 * * *', scheduleType: 'scheduled' as const },
    { name: QUEUE_NAMES.RATE_LIMIT_CLEANUP, description: 'Cleans up expired rate limit entries', defaultCron: 'on-demand', scheduleType: 'on-demand' as const },
    { name: QUEUE_NAMES.CERTIFICATE_INGESTION, description: 'Processes certificate uploads and extractions', defaultCron: 'on-demand', scheduleType: 'on-demand' as const },
    { name: QUEUE_NAMES.WEBHOOK_DELIVERY, description: 'Delivers webhook notifications to external systems', defaultCron: 'on-demand', scheduleType: 'on-demand' as const },
    { name: QUEUE_NAMES.SCHEDULED_REPORT, description: 'Executes scheduled report generation', defaultCron: 'on-demand', scheduleType: 'on-demand' as const },
  ];
  
  try {
    for (const queue of allQueueNames) {
      const scheduleResult = await db.execute(sql`
        SELECT name, cron, timezone, created_on, updated_on
        FROM pgboss.schedule 
        WHERE name = ${queue.name}
      `);
      
      const jobsResult = await db.execute(sql`
        SELECT id, state, created_on, completed_on, started_on
        FROM pgboss.job 
        WHERE name = ${queue.name}
        ORDER BY created_on DESC
        LIMIT 10
      `);
      
      const stateCountsResult = await db.execute(sql`
        SELECT state, COUNT(*)::int as count
        FROM pgboss.job 
        WHERE name = ${queue.name}
        GROUP BY state
      `);
      
      const schedule = scheduleResult.rows[0] as any;
      const recentJobs = (jobsResult.rows as any[]).map(job => ({
        id: job.id,
        state: job.state,
        createdOn: new Date(job.created_on).toISOString(),
        completedOn: job.completed_on ? new Date(job.completed_on).toISOString() : null,
        startedOn: job.started_on ? new Date(job.started_on).toISOString() : null,
      }));
      
      const stateCounts = { pending: 0, active: 0, completed: 0, failed: 0, retry: 0, expired: 0, cancelled: 0 };
      (stateCountsResult.rows as any[]).forEach(row => {
        if (row.state === 'created') stateCounts.pending = row.count;
        else if (row.state === 'active') stateCounts.active = row.count;
        else if (row.state === 'completed') stateCounts.completed = row.count;
        else if (row.state === 'failed') stateCounts.failed = row.count;
        else if (row.state === 'retry') stateCounts.retry = row.count;
        else if (row.state === 'expired') stateCounts.expired = row.count;
        else if (row.state === 'cancelled') stateCounts.cancelled = row.count;
      });
      
      const lastJob = recentJobs[0];
      const lastRunDate = lastJob?.completedOn || lastJob?.startedOn || lastJob?.createdOn || null;
      
      scheduledJobs.push({
        name: queue.name,
        cron: schedule?.cron || queue.defaultCron,
        timezone: schedule?.timezone || 'UTC',
        lastRun: lastRunDate,
        nextRun: null,
        isActive: queue.scheduleType === 'on-demand' || !!schedule,
        scheduleType: queue.scheduleType,
        stateCounts,
        recentJobs,
        description: queue.description,
      });
    }
  } catch (error) {
    jobLogger.error({ error }, "Error fetching scheduled jobs status");
    for (const queue of allQueueNames) {
      scheduledJobs.push({
        name: queue.name,
        cron: queue.defaultCron,
        timezone: 'UTC',
        lastRun: null,
        nextRun: null,
        isActive: queue.scheduleType === 'on-demand',
        scheduleType: queue.scheduleType,
        stateCounts: { pending: 0, active: 0, completed: 0, failed: 0, retry: 0, expired: 0, cancelled: 0 },
        recentJobs: [],
        description: queue.description,
      });
    }
  }
  
  return scheduledJobs;
}

async function processReportingRefresh(): Promise<void> {
  jobLogger.info("Starting reporting refresh job");
  
  try {
    // Refresh materialized views for reporting
    // Note: These views are created by server/reporting/materialized-views.ts
    // In production, we would call refreshReportingViews() here
    
    // Check and enqueue any due scheduled reports
    const enqueuedCount = await checkAndEnqueueDueReports();
    if (enqueuedCount > 0) {
      jobLogger.info({ enqueuedCount }, "Enqueued due scheduled reports");
    }
    
    jobLogger.info("Reporting refresh job completed successfully");
  } catch (error) {
    jobLogger.error({ error }, "Reporting refresh job failed");
    throw error;
  }
}

// Process a scheduled report execution via pg-boss
async function processScheduledReport(data: ScheduledReportJobData): Promise<void> {
  const { scheduledReportId, triggerType } = data;
  
  jobLogger.info({ scheduledReportId, triggerType }, "Processing scheduled report");
  
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    
    // Fetch the scheduled report details
    const scheduleResult = await db.execute(sql`
      SELECT * FROM scheduled_reports WHERE id = ${scheduledReportId}
    `);
    
    const schedule = scheduleResult.rows[0] as any;
    if (!schedule) {
      throw new Error(`Scheduled report ${scheduledReportId} not found`);
    }
    
    if (!schedule.is_active && triggerType === 'scheduled') {
      jobLogger.info({ scheduledReportId }, "Skipping inactive scheduled report");
      return;
    }
    
    // Create a generated report record
    const generateResult = await db.execute(sql`
      INSERT INTO generated_reports (organisation_id, name, scheduled_report_id, format, status, filters)
      VALUES (${schedule.organisation_id}, ${schedule.name}, ${scheduledReportId}, ${schedule.format || 'PDF'}, 'GENERATING', ${JSON.stringify(schedule.filters || {})})
      RETURNING *
    `);
    
    const generatedReport = generateResult.rows[0] as any;
    
    // TODO: Implement actual report generation logic here
    // This would typically:
    // 1. Fetch the template from report_templates
    // 2. Query the relevant data based on filters
    // 3. Generate the PDF/CSV/Excel file
    // 4. Store in object storage
    // 5. Update the generated_report with storage_key and file_size
    
    // For now, mark as ready (placeholder for full implementation)
    await db.execute(sql`
      UPDATE generated_reports 
      SET status = 'READY', file_size = 102400
      WHERE id = ${generatedReport.id}
    `);
    
    // Update last_run_at on the scheduled report
    await db.execute(sql`
      UPDATE scheduled_reports 
      SET last_run_at = NOW(), updated_at = NOW()
      WHERE id = ${scheduledReportId}
    `);
    
    jobLogger.info({ scheduledReportId, generatedReportId: generatedReport.id }, "Scheduled report completed");
    
  } catch (error) {
    jobLogger.error({ scheduledReportId, error }, "Scheduled report failed");
    throw error;
  }
}

// Enqueue a scheduled report for immediate execution
export async function enqueueScheduledReportNow(scheduledReportId: string): Promise<string | null> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  jobLogger.info({ scheduledReportId }, "Enqueueing scheduled report for immediate execution");
  
  return await boss.send(QUEUE_NAMES.SCHEDULED_REPORT, {
    scheduledReportId,
    triggerType: 'manual',
  } as ScheduledReportJobData, {
    retryLimit: 3,
    retryDelay: 60,
    expireInMinutes: 30,
  });
}

// pg-boss scheduled reports use a single shared queue with the scheduledReportId in the payload.
// This approach:
// 1. Ensures workers are registered on startup (via registerWorkers)
// 2. Avoids worker leaks from per-report queues
// 3. Uses singletonKey to prevent duplicate jobs for the same report

// Create a scheduled job for a report (uses singleton to prevent duplicates)
export async function createReportSchedule(scheduledReportId: string, frequency: string): Promise<void> {
  if (!boss) {
    throw new Error("Job queue not initialized");
  }
  
  // For now, we don't use pg-boss's schedule() with cron expressions per report.
  // Instead, we rely on a background check (e.g., the reporting-refresh job) to 
  // query scheduled_reports and enqueue reports that need to run based on next_run_at.
  // This is simpler and avoids the need to manage per-report schedules.
  
  jobLogger.info({ scheduledReportId, frequency }, "Report schedule registered (will be picked up by scheduler)");
}

// Remove a scheduled report (no-op since we don't use per-report schedules)
export async function removeReportSchedule(scheduledReportId: string): Promise<void> {
  jobLogger.info({ scheduledReportId }, "Report schedule removed");
}

// Pause/resume a scheduled report - updates next_run_at when re-enabling
export async function setReportScheduleActive(scheduledReportId: string, active: boolean): Promise<void> {
  if (active) {
    // When re-enabling, set next_run_at to a near-future time so it gets picked up
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    
    const result = await db.execute(sql`
      SELECT frequency FROM scheduled_reports WHERE id = ${scheduledReportId}
    `);
    
    const schedule = result.rows[0] as any;
    if (schedule) {
      // Set next_run_at to the next scheduled time
      const nextRun = calculateNextRun(schedule.frequency);
      await db.execute(sql`
        UPDATE scheduled_reports 
        SET next_run_at = ${nextRun}, updated_at = NOW()
        WHERE id = ${scheduledReportId}
      `);
      jobLogger.info({ scheduledReportId, nextRun }, "Updated next_run_at for re-enabled schedule");
    }
  }
  
  jobLogger.info({ scheduledReportId, active }, "Report schedule active state updated");
}

// Check and enqueue due scheduled reports - called by the reporting-refresh job
export async function checkAndEnqueueDueReports(): Promise<number> {
  if (!boss) {
    return 0;
  }
  
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  
  try {
    // Find active scheduled reports that are due (next_run_at <= now)
    const dueReports = await db.execute(sql`
      SELECT id, frequency FROM scheduled_reports 
      WHERE is_active = true 
      AND next_run_at <= NOW()
    `);
    
    let enqueuedCount = 0;
    
    for (const report of dueReports.rows as any[]) {
      try {
        // Enqueue with singletonKey to prevent duplicates
        await boss.send(QUEUE_NAMES.SCHEDULED_REPORT, {
          scheduledReportId: report.id,
          triggerType: 'scheduled',
        } as ScheduledReportJobData, {
          singletonKey: `scheduled-report-${report.id}`,
          singletonSeconds: 3600, // Prevent re-queueing same report within 1 hour
          retryLimit: 3,
          retryDelay: 60,
          expireInMinutes: 60,
        });
        
        // Update next_run_at based on frequency
        const nextRun = calculateNextRun(report.frequency);
        await db.execute(sql`
          UPDATE scheduled_reports 
          SET next_run_at = ${nextRun}, updated_at = NOW()
          WHERE id = ${report.id}
        `);
        
        enqueuedCount++;
        jobLogger.info({ scheduledReportId: report.id }, "Enqueued due scheduled report");
      } catch (error) {
        jobLogger.error({ scheduledReportId: report.id, error }, "Failed to enqueue scheduled report");
      }
    }
    
    return enqueuedCount;
  } catch (error) {
    jobLogger.error({ error }, "Failed to check for due reports");
    return 0;
  }
}

// Calculate the next run time based on frequency
function calculateNextRun(frequency: string): Date {
  const next = new Date();
  next.setHours(6, 0, 0, 0); // Always run at 6 AM
  
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + ((1 + 7 - next.getDay()) % 7 || 7)); // Next Monday
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      next.setDate(1);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(0);
      next.setDate(1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  
  return next;
}

export { boss };
