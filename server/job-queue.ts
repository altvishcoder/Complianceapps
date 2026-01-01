import PgBoss from "pg-boss";
import { storage } from "./storage";
import { processExtractionAndSave } from "./extraction";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { enqueueWebhookEvent } from "./webhook-worker";
import { jobLogger } from "./logger";

const objectStorageService = new ObjectStorageService();

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

export async function initJobQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for job queue");
  }

  // Load job queue configuration from Factory Settings
  const retryLimit = parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_RETRY_LIMIT', '3'), 3);
  const retryDelay = parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_RETRY_DELAY_SECONDS', '30'), 30);
  const archiveFailedAfterDays = parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_ARCHIVE_FAILED_AFTER_DAYS', '7'), 7);
  const deleteAfterDays = parsePositiveIntOrDefault(await storage.getFactorySettingValue('JOB_DELETE_AFTER_DAYS', '30'), 30);

  boss = new PgBoss({
    connectionString,
    retryLimit,
    retryDelay,
    retryBackoff: true,
    archiveFailedAfterSeconds: 60 * 60 * 24 * archiveFailedAfterDays,
    deleteAfterDays,
  });

  boss.on("error", (error) => {
    jobLogger.error({ error }, "pg-boss error");
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

  jobLogger.info("Workers registered for all queues");
}

async function processCertificateIngestion(data: IngestionJobData): Promise<void> {
  const { jobId, propertyId, certificateType, fileName, objectPath, webhookUrl } = data;
  
  jobLogger.info({ jobId, propertyId, certificateType }, "Processing ingestion job");
  
  const ingestionJob = await storage.getIngestionJob(jobId);
  if (!ingestionJob) {
    throw new Error(`Ingestion job ${jobId} not found`);
  }

  try {
    await storage.updateIngestionJob(jobId, {
      status: "PROCESSING",
      lastAttemptAt: new Date(),
      attemptCount: ingestionJob.attemptCount + 1,
    });

    const property = await storage.getProperty(propertyId);
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    let fileBuffer: Buffer | undefined;
    let fileBase64: string | undefined;
    let mimeType: string | undefined;

    if (objectPath) {
      try {
        const file = await objectStorageService.getObjectEntityFile(objectPath);
        if (file) {
          const [contents] = await file.download();
          fileBuffer = contents;
        }

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
        jobLogger.error({ error, jobId, objectPath }, "Error downloading file");
        throw new Error(`Failed to download file from object storage: ${error}`);
      }
    }

    if (!fileBase64 && !fileBuffer) {
      throw new Error("No file content available for processing");
    }

    await storage.updateIngestionJob(jobId, { status: "EXTRACTING" });

    const certificate = await storage.createCertificate({
      propertyId,
      organisationId: ingestionJob.organisationId,
      certificateType: certificateType as "GAS_SAFETY" | "EICR" | "EPC" | "FIRE_RISK_ASSESSMENT" | "LEGIONELLA_ASSESSMENT" | "ASBESTOS_SURVEY" | "LIFT_LOLER" | "OTHER",
      fileName,
      fileSize: fileBuffer?.length || 0,
      fileType: mimeType || "application/octet-stream",
      status: "PROCESSING",
    });

    await processExtractionAndSave(
      certificate.id,
      certificateType,
      fileBase64,
      mimeType || "application/octet-stream",
      fileBuffer
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
    jobLogger.error({ jobId, error: errorMessage, propertyId }, "Ingestion job failed");

    await storage.updateIngestionJob(jobId, {
      status: "FAILED",
      statusMessage: `Processing failed: ${errorMessage}`,
      errorDetails: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
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
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ComplianceAI-Event": payload.event as string,
        "X-ComplianceAI-JobId": jobId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}: ${await response.text()}`);
    }

    jobLogger.info({ jobId }, "Webhook delivered successfully");
  } catch (error) {
    jobLogger.error({ jobId, error, webhookUrl }, "Webhook delivery failed");
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

// Get scheduled jobs status for monitoring UI
export interface ScheduledJobInfo {
  name: string;
  cron: string;
  timezone: string;
  lastRun: Date | null;
  nextRun: Date | null;
  recentJobs: Array<{
    id: string;
    state: string;
    createdOn: Date;
    completedOn: Date | null;
  }>;
}

export async function getScheduledJobsStatus(): Promise<ScheduledJobInfo[]> {
  if (!boss) {
    return [];
  }
  
  const scheduledJobs: ScheduledJobInfo[] = [];
  
  // Query pg-boss schedule table directly for schedule info
  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  
  try {
    // Get schedule info
    const scheduleResult = await db.execute(sql`
      SELECT name, cron, timezone, created_on, updated_on
      FROM pgboss.schedule 
      WHERE name = ${QUEUE_NAMES.CERTIFICATE_WATCHDOG}
    `);
    
    // Get recent job history for the watchdog
    const jobsResult = await db.execute(sql`
      SELECT id, state, createdon, completedon
      FROM pgboss.job 
      WHERE name = ${QUEUE_NAMES.CERTIFICATE_WATCHDOG}
      ORDER BY createdon DESC
      LIMIT 10
    `);
    
    const schedule = scheduleResult.rows[0] as any;
    const recentJobs = (jobsResult.rows as any[]).map(job => ({
      id: job.id,
      state: job.state,
      createdOn: new Date(job.createdon),
      completedOn: job.completedon ? new Date(job.completedon) : null,
    }));
    
    if (schedule) {
      // Calculate next run based on cron expression
      const lastCompletedJob = recentJobs.find(j => j.state === 'completed');
      
      scheduledJobs.push({
        name: QUEUE_NAMES.CERTIFICATE_WATCHDOG,
        cron: schedule.cron || '*/5 * * * *',
        timezone: schedule.timezone || 'UTC',
        lastRun: lastCompletedJob?.completedOn || null,
        nextRun: null, // pg-boss handles this internally
        recentJobs,
      });
    } else {
      // Schedule might not exist yet, return with empty info
      scheduledJobs.push({
        name: QUEUE_NAMES.CERTIFICATE_WATCHDOG,
        cron: '*/5 * * * *',
        timezone: 'UTC',
        lastRun: null,
        nextRun: null,
        recentJobs,
      });
    }
  } catch (error) {
    jobLogger.error({ error }, "Error fetching scheduled jobs status");
    // Return minimal info if tables don't exist yet
    scheduledJobs.push({
      name: QUEUE_NAMES.CERTIFICATE_WATCHDOG,
      cron: '*/5 * * * *',
      timezone: 'UTC',
      lastRun: null,
      nextRun: null,
      recentJobs: [],
    });
  }
  
  return scheduledJobs;
}

export { boss };
