import { storage } from "./storage";
import { processExtractionAndSave } from "./extraction";
import { ObjectStorageService } from "./replit_integrations/object_storage";

const objectStorageService = new ObjectStorageService();

interface WorkerConfig {
  pollIntervalMs: number;
  maxConcurrentJobs: number;
  enableWebhooks: boolean;
}

let isRunning = false;
let activeJobs = 0;

export async function startIngestionWorker(): Promise<void> {
  if (isRunning) {
    console.log("[Ingestion Worker] Already running");
    return;
  }
  
  isRunning = true;
  console.log("[Ingestion Worker] Starting background ingestion worker");
  
  const pollIntervalMs = parseInt(await storage.getFactorySettingValue('INGESTION_POLL_INTERVAL_MS', '5000'));
  const maxConcurrentJobs = parseInt(await storage.getFactorySettingValue('INGESTION_MAX_CONCURRENT_JOBS', '3'));
  
  pollAndProcess({ pollIntervalMs, maxConcurrentJobs, enableWebhooks: true });
}

export function stopIngestionWorker(): void {
  isRunning = false;
  console.log("[Ingestion Worker] Stopping background ingestion worker");
}

async function pollAndProcess(config: WorkerConfig): Promise<void> {
  while (isRunning) {
    try {
      if (activeJobs < config.maxConcurrentJobs) {
        const job = await storage.getNextPendingIngestionJob();
        
        if (job) {
          activeJobs++;
          processJob(job.id, config.enableWebhooks).finally(() => {
            activeJobs--;
          });
        }
      }
    } catch (error) {
      console.error("[Ingestion Worker] Error polling for jobs:", error);
    }
    
    await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
  }
}

async function processJob(jobId: string, enableWebhooks: boolean): Promise<void> {
  const job = await storage.getIngestionJob(jobId);
  if (!job) return;
  
  console.log(`[Ingestion Worker] Processing job ${jobId} for property ${job.propertyId}`);
  
  try {
    await storage.updateIngestionJob(jobId, { 
      status: 'PROCESSING',
      lastAttemptAt: new Date(),
      attemptCount: job.attemptCount + 1
    });
    
    if (!job.propertyId) {
      throw new Error('Property ID is required for processing');
    }
    
    const property = await storage.getProperty(job.propertyId);
    if (!property) {
      throw new Error(`Property ${job.propertyId} not found`);
    }
    
    let fileBuffer: Buffer | undefined;
    let fileBase64: string | undefined;
    let mimeType: string | undefined;
    
    if (job.objectPath) {
      try {
        const file = await objectStorageService.getObjectEntityFile(job.objectPath);
        if (file) {
          const [contents] = await file.download();
          fileBuffer = contents;
        }
        
        const extension = job.fileName.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') {
          mimeType = 'application/pdf';
        } else if (['jpg', 'jpeg'].includes(extension || '')) {
          mimeType = 'image/jpeg';
          fileBase64 = fileBuffer?.toString('base64');
        } else if (extension === 'png') {
          mimeType = 'image/png';
          fileBase64 = fileBuffer?.toString('base64');
        } else if (extension === 'webp') {
          mimeType = 'image/webp';
          fileBase64 = fileBuffer?.toString('base64');
        }
      } catch (error) {
        console.error(`[Ingestion Worker] Error downloading file: ${error}`);
        throw new Error(`Failed to download file from storage: ${job.objectPath}`);
      }
    }
    
    const certificate = await storage.createCertificate({
      organisationId: job.organisationId,
      propertyId: job.propertyId,
      certificateType: job.certificateType,
      status: 'PROCESSING',
      fileType: mimeType || 'application/pdf',
      fileName: job.fileName,
      fileSize: fileBuffer?.length || 0
    });
    
    console.log(`[Ingestion Worker] Created certificate ${certificate.id} for job ${jobId}`);
    
    await storage.updateIngestionJob(jobId, {
      status: 'EXTRACTING',
      certificateId: certificate.id
    });
    
    await processExtractionAndSave(
      certificate.id,
      job.certificateType,
      fileBase64,
      mimeType,
      mimeType === 'application/pdf' ? fileBuffer : undefined
    );
    
    const updatedCertificate = await storage.getCertificate(certificate.id);
    
    await storage.updateIngestionJob(jobId, {
      status: 'COMPLETE',
      completedAt: new Date(),
      statusMessage: `Certificate ${certificate.id} processed successfully`
    });
    
    console.log(`[Ingestion Worker] Completed job ${jobId}`);
    
    if (enableWebhooks && job.webhookUrl) {
      try {
        await sendWebhookCallback(job.webhookUrl, {
          jobId: job.id,
          status: 'COMPLETE',
          certificateId: certificate.id,
          propertyId: job.propertyId,
          certificateType: job.certificateType
        });
        await storage.updateIngestionJob(jobId, { webhookDelivered: true });
      } catch (webhookError) {
        console.error(`[Ingestion Worker] Webhook callback failed: ${webhookError}`);
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Ingestion Worker] Job ${jobId} failed: ${errorMessage}`);
    
    await storage.updateIngestionJob(jobId, {
      status: 'FAILED',
      completedAt: new Date(),
      statusMessage: errorMessage,
      errorDetails: { error: errorMessage, timestamp: new Date().toISOString() }
    });
    
    if (job.webhookUrl) {
      try {
        await sendWebhookCallback(job.webhookUrl, {
          jobId: job.id,
          status: 'FAILED',
          error: errorMessage,
          propertyId: job.propertyId,
          certificateType: job.certificateType
        });
        await storage.updateIngestionJob(jobId, { webhookDelivered: true });
      } catch (webhookError) {
        console.error(`[Ingestion Worker] Webhook callback failed: ${webhookError}`);
      }
    }
  }
}

async function sendWebhookCallback(url: string, payload: Record<string, any>): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ComplianceAI-Ingestion-Worker/1.0'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
  }
}

export async function triggerJobProcessing(jobId: string): Promise<void> {
  const enableWebhooks = (await storage.getFactorySettingValue('WEBHOOK_ENABLED', 'true')) === 'true';
  await processJob(jobId, enableWebhooks);
}
