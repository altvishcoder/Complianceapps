import PgBoss from "pg-boss";
import { storage } from "./storage";
import { processExtractionAndSave } from "./extraction";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { enqueueWebhookEvent } from "./webhook-worker";

const objectStorageService = new ObjectStorageService();

let boss: PgBoss | null = null;

export const QUEUE_NAMES = {
  CERTIFICATE_INGESTION: "certificate-ingestion",
  WEBHOOK_DELIVERY: "webhook-delivery",
  RATE_LIMIT_CLEANUP: "rate-limit-cleanup",
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

  boss = new PgBoss({
    connectionString,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    archiveFailedAfterSeconds: 60 * 60 * 24 * 7,
    deleteAfterDays: 30,
  });

  boss.on("error", (error) => {
    console.error("[pg-boss] Error:", error);
  });

  await boss.start();
  console.log("[pg-boss] Job queue started successfully");

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
      console.log("[pg-boss] Rate limit cleanup completed");
    }
  );

  await boss.send(QUEUE_NAMES.RATE_LIMIT_CLEANUP, {}, { singletonKey: 'rate-limit-cleanup' });

  console.log("[pg-boss] Workers registered for all queues");
}

async function processCertificateIngestion(data: IngestionJobData): Promise<void> {
  const { jobId, propertyId, certificateType, fileName, objectPath, webhookUrl } = data;
  
  console.log(`[pg-boss] Processing ingestion job ${jobId} for property ${propertyId}`);
  
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
        console.error(`[pg-boss] Error downloading file: ${error}`);
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

    console.log(`[pg-boss] Job ${jobId} completed successfully, certificate ID: ${certificateId}`);

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
    console.error(`[pg-boss] Job ${jobId} failed: ${errorMessage}`);

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
  
  console.log(`[pg-boss] Delivering webhook for job ${jobId}, attempt ${attemptCount + 1}`);
  
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

    console.log(`[pg-boss] Webhook delivered successfully for job ${jobId}`);
  } catch (error) {
    console.error(`[pg-boss] Webhook delivery failed: ${error}`);
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
    console.warn("[pg-boss] Queue not initialized, webhook not enqueued");
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

export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    console.log("[pg-boss] Job queue stopped");
  }
}

export { boss };
