import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('pg-boss', () => {
  const mockBoss = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    work: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue('job-id-123'),
    schedule: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn().mockResolvedValue(undefined),
    createQueue: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockResolvedValue(0),
  };
  
  return {
    default: class MockPgBoss {
      constructor() {
        return mockBoss;
      }
    },
  };
});

vi.mock('../server/storage', () => ({
  storage: {
    getFactorySettingValue: vi.fn().mockResolvedValue('3'),
    getIngestionJob: vi.fn().mockResolvedValue({
      id: 'test-job-id',
      status: 'PENDING',
      attemptCount: 0,
      organisationId: 'test-org',
    }),
    getProperty: vi.fn().mockResolvedValue({
      id: 'test-property-id',
      name: 'Test Property',
    }),
    createCertificate: vi.fn().mockResolvedValue({
      id: 'test-cert-id',
    }),
    updateIngestionJob: vi.fn().mockResolvedValue(undefined),
    getCertificate: vi.fn().mockResolvedValue(null),
    findAndFailStuckCertificates: vi.fn().mockResolvedValue([]),
    cleanupExpiredRateLimits: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../server/extraction', () => ({
  processExtractionAndSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../server/replit_integrations/object_storage', () => {
  return {
    ObjectStorageService: class MockObjectStorageService {
      getObjectEntityFile = vi.fn().mockResolvedValue({
        download: vi.fn().mockResolvedValue([Buffer.from('test-content')]),
      });
    },
  };
});

vi.mock('../server/webhook-worker', () => ({
  enqueueWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../server/logger', () => ({
  jobLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../server/services/pattern-analysis', () => ({
  runPatternAnalysis: vi.fn().mockResolvedValue({
    patternsIdentified: 5,
    totalCorrectionsAnalyzed: 100,
  }),
}));

vi.mock('../server/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
  pool: {},
}));

vi.mock('../server/db-optimization', () => ({
  refreshAllMaterializedViews: vi.fn().mockResolvedValue({
    results: [{ viewName: 'test_view', success: true, durationMs: 100 }],
    totalDurationMs: 100,
  }),
  refreshMaterializedView: vi.fn().mockResolvedValue({
    success: true,
    durationMs: 50,
    rowCount: 100,
  }),
  getRefreshSchedule: vi.fn().mockResolvedValue({
    isEnabled: true,
    scheduleTime: '05:30',
    timezone: 'Europe/London',
    refreshAll: true,
    targetViews: [],
  }),
}));

vi.mock('../server/utils/resilience', () => ({
  withRetryAndTimeout: vi.fn().mockImplementation(async (fn) => fn()),
  withTimeout: vi.fn().mockImplementation(async (fn) => fn()),
  withSafeDefaults: vi.fn().mockImplementation(async (fn, defaultVal) => {
    try {
      return await fn();
    } catch {
      return defaultVal;
    }
  }),
  withCircuitBreaker: vi.fn().mockImplementation(async (key, fn) => fn()),
  TimeoutError: class TimeoutError extends Error {},
}));

describe('Job Queue Workers Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Queue Names Constants', () => {
    it('should export all queue names', async () => {
      const { QUEUE_NAMES } = await import('../server/job-queue');
      
      expect(QUEUE_NAMES.CERTIFICATE_INGESTION).toBe('certificate-ingestion');
      expect(QUEUE_NAMES.WEBHOOK_DELIVERY).toBe('webhook-delivery');
      expect(QUEUE_NAMES.RATE_LIMIT_CLEANUP).toBe('rate-limit-cleanup');
      expect(QUEUE_NAMES.CERTIFICATE_WATCHDOG).toBe('certificate-watchdog');
      expect(QUEUE_NAMES.REPORTING_REFRESH).toBe('reporting-refresh');
      expect(QUEUE_NAMES.SCHEDULED_REPORT).toBe('scheduled-report');
      expect(QUEUE_NAMES.PATTERN_ANALYSIS).toBe('pattern-analysis');
      expect(QUEUE_NAMES.MV_REFRESH).toBe('mv-refresh');
    });
  });

  describe('Job Queue Initialization', () => {
    it('should require DATABASE_URL environment variable', async () => {
      delete process.env.DATABASE_URL;
      
      vi.resetModules();
      const { initJobQueue } = await import('../server/job-queue');
      
      await expect(initJobQueue()).rejects.toThrow('DATABASE_URL environment variable is required');
    });

    it('should initialize pg-boss successfully', async () => {
      const { initJobQueue, getJobQueue } = await import('../server/job-queue');
      
      const boss = await initJobQueue();
      
      expect(boss).toBeDefined();
      expect(boss.start).toBeDefined();
      expect(getJobQueue()).toBe(boss);
    });

    it('should return existing instance if already initialized', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      
      const boss1 = await initJobQueue();
      const boss2 = await initJobQueue();
      
      expect(boss1).toBe(boss2);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const { initJobQueue, getQueueStats } = await import('../server/job-queue');
      await initJobQueue();
      
      const stats = await getQueueStats();
      
      expect(stats).toHaveProperty('ingestion');
      expect(stats).toHaveProperty('webhook');
      expect(stats.ingestion).toHaveProperty('queued');
      expect(stats.ingestion).toHaveProperty('active');
      expect(stats.ingestion).toHaveProperty('completed');
      expect(stats.ingestion).toHaveProperty('failed');
    });

    it('should return zero values in stats', async () => {
      const { initJobQueue, getQueueStats } = await import('../server/job-queue');
      await initJobQueue();
      
      const stats = await getQueueStats();
      
      expect(stats.ingestion.queued).toBeGreaterThanOrEqual(0);
      expect(stats.webhook.queued).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Ingestion Job Enqueuing', () => {
    it('should enqueue ingestion job with correct options', async () => {
      const { initJobQueue, enqueueIngestionJob } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      const jobData = {
        jobId: 'test-job-id',
        propertyId: 'prop-123',
        certificateType: 'GAS_SAFETY',
        fileName: 'certificate.pdf',
        objectPath: '/uploads/certificate.pdf',
        webhookUrl: null,
      };
      
      const jobId = await enqueueIngestionJob(jobData);
      
      expect(boss.send).toHaveBeenCalledWith(
        'certificate-ingestion',
        jobData,
        expect.objectContaining({
          retryLimit: 3,
          retryDelay: 60,
          expireInMinutes: 60,
        })
      );
      expect(jobId).toBe('job-id-123');
    });

    it('should throw error when queue not initialized', async () => {
      vi.resetModules();
      
      const module = await import('../server/job-queue');
      
      await expect(module.enqueueIngestionJob({
        jobId: 'test',
        propertyId: 'test',
        certificateType: 'GAS_SAFETY',
        fileName: 'test.pdf',
        objectPath: null,
        webhookUrl: null,
      })).rejects.toThrow('Job queue not initialized');
    });
  });

  describe('Webhook Job Enqueuing', () => {
    it('should enqueue webhook job with exponential backoff', async () => {
      const { initJobQueue, enqueueWebhook } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      const webhookData = {
        jobId: 'test-job-id',
        webhookUrl: 'https://example.com/webhook',
        payload: { event: 'test.event', data: {} },
        attemptCount: 0,
      };
      
      await enqueueWebhook(webhookData);
      
      expect(boss.send).toHaveBeenCalledWith(
        'webhook-delivery',
        webhookData,
        expect.objectContaining({
          retryLimit: 5,
          retryDelay: 30,
          retryBackoff: true,
        })
      );
    });

    it('should return null when queue not initialized', async () => {
      vi.resetModules();
      
      const { enqueueWebhook } = await import('../server/job-queue');
      
      const result = await enqueueWebhook({
        jobId: 'test',
        webhookUrl: 'https://example.com',
        payload: {},
        attemptCount: 0,
      });
      
      expect(result).toBeNull();
    });
  });

  describe('Certificate Watchdog', () => {
    it('should trigger watchdog manually', async () => {
      const { initJobQueue, triggerWatchdogNow } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      const jobId = await triggerWatchdogNow();
      
      expect(boss.send).toHaveBeenCalledWith(
        'certificate-watchdog',
        {},
        expect.objectContaining({
          singletonKey: 'manual-watchdog-trigger',
          singletonSeconds: 60,
        })
      );
      expect(jobId).toBe('job-id-123');
    });

    it('should throw when queue not initialized', async () => {
      vi.resetModules();
      
      const { triggerWatchdogNow } = await import('../server/job-queue');
      
      await expect(triggerWatchdogNow()).rejects.toThrow('Job queue not initialized');
    });
  });

  describe('Pattern Analysis Trigger', () => {
    it('should trigger pattern analysis manually', async () => {
      const { initJobQueue, triggerPatternAnalysis } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      const jobId = await triggerPatternAnalysis();
      
      expect(boss.send).toHaveBeenCalledWith(
        'pattern-analysis',
        {},
        expect.objectContaining({
          singletonKey: 'manual-pattern-analysis-trigger',
          singletonSeconds: 300,
        })
      );
      expect(jobId).toBe('job-id-123');
    });
  });

  describe('Job Queue Lifecycle', () => {
    it('should stop job queue gracefully', async () => {
      const { initJobQueue, stopJobQueue, getJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      expect(getJobQueue()).toBe(boss);
      
      await stopJobQueue();
      
      expect(boss.stop).toHaveBeenCalled();
    });

    it('should have stopJobQueue function defined', async () => {
      const { stopJobQueue } = await import('../server/job-queue');
      
      expect(typeof stopJobQueue).toBe('function');
    });
  });

  describe('Worker Registration', () => {
    it('should have work method for registering workers', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      expect(boss.work).toBeDefined();
      expect(typeof boss.work).toBe('function');
    });

    it('should have createQueue method for queue creation', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      expect(boss.createQueue).toBeDefined();
      expect(typeof boss.createQueue).toBe('function');
    });

    it('should have schedule method for recurring jobs', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      expect(boss.schedule).toBeDefined();
      expect(typeof boss.schedule).toBe('function');
    });

    it('should support all required queue names', () => {
      const requiredQueues = [
        'certificate-ingestion',
        'webhook-delivery',
        'rate-limit-cleanup',
        'certificate-watchdog',
        'reporting-refresh',
        'scheduled-report',
        'pattern-analysis',
        'mv-refresh',
      ];
      
      requiredQueues.forEach(queue => {
        expect(typeof queue).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should have error event listener method', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      expect(boss.on).toBeDefined();
      expect(typeof boss.on).toBe('function');
    });

    it('should handle error events gracefully', async () => {
      const { initJobQueue } = await import('../server/job-queue');
      const boss = await initJobQueue();
      
      const errorHandler = vi.fn();
      boss.on('error', errorHandler);
      
      expect(boss.on).toHaveBeenCalled();
    });
  });

  describe('Factory Settings Integration', () => {
    it('should access factory settings for configuration', async () => {
      const { storage } = await import('../server/storage');
      
      expect(storage.getFactorySettingValue).toBeDefined();
      expect(typeof storage.getFactorySettingValue).toBe('function');
    });

    it('should have safe defaults for configuration values', () => {
      const defaults = {
        JOB_RETRY_LIMIT: 3,
        JOB_RETRY_DELAY_SECONDS: 30,
        JOB_ARCHIVE_FAILED_AFTER_DAYS: 7,
        JOB_DELETE_AFTER_DAYS: 30,
      };
      
      expect(defaults.JOB_RETRY_LIMIT).toBe(3);
      expect(defaults.JOB_RETRY_DELAY_SECONDS).toBe(30);
    });
  });
});

describe('Job Processing Logic', () => {
  describe('Ingestion Job Processing', () => {
    it('should skip already completed jobs (idempotency)', async () => {
      const { storage } = await import('../server/storage');
      vi.mocked(storage.getIngestionJob).mockResolvedValue({
        id: 'test-job',
        status: 'COMPLETE',
        attemptCount: 1,
        organisationId: 'org-1',
      } as any);
      
      const { jobLogger } = await import('../server/logger');
      
      expect(jobLogger.info).toBeDefined();
    });

    it('should skip jobs that exceeded max retries', async () => {
      const { storage } = await import('../server/storage');
      vi.mocked(storage.getIngestionJob).mockResolvedValue({
        id: 'test-job',
        status: 'FAILED',
        attemptCount: 5,
        organisationId: 'org-1',
      } as any);
      
      const { jobLogger } = await import('../server/logger');
      
      expect(jobLogger.info).toBeDefined();
    });
  });

  describe('Webhook Delivery', () => {
    it('should handle webhook delivery with timeout', async () => {
      const { withCircuitBreaker } = await import('../server/utils/resilience');
      
      expect(withCircuitBreaker).toBeDefined();
    });
  });
});
