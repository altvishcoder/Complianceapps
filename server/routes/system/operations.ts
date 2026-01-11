import { Router } from "express";
import { db } from "../../db";
import { eq, and, count, sql, lt } from "drizzle-orm";
import { requireRole } from "../../session";
import { storage } from "../../storage";
import { certificates, properties, remedialActions } from "@shared/schema";
import { withCache } from "../../services/query-cache";
import { requireAdminRole, ORG_ID, ADMIN_ROLES } from "./utils";

export const systemOperationsRouter = Router();

systemOperationsRouter.get("/admin/ingestion-stats", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { getQueueStats } = await import('../../job-queue');
    const [queueStats, ingestionStats, allCertificates] = await Promise.all([
      getQueueStats(),
      storage.getIngestionStats(),
      storage.listCertificates(ORG_ID)
    ]);
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentCerts = allCertificates.filter(c => new Date(c.createdAt) >= last24Hours);
    
    const certByStatus: Record<string, number> = {};
    const certByType: Record<string, number> = {};
    
    for (const cert of allCertificates) {
      certByStatus[cert.status] = (certByStatus[cert.status] || 0) + 1;
      certByType[cert.certificateType] = (certByType[cert.certificateType] || 0) + 1;
    }
    
    const hourCounts: Record<string, number> = {};
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = hour.toISOString().slice(0, 13);
      hourCounts[hourKey] = 0;
    }
    
    for (const cert of recentCerts) {
      const hourKey = new Date(cert.createdAt).toISOString().slice(0, 13);
      if (hourCounts.hasOwnProperty(hourKey)) {
        hourCounts[hourKey]++;
      }
    }
    
    const certThroughputByHour = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));
    
    const pendingCount = certByStatus['PENDING'] || 0;
    const processingCount = certByStatus['PROCESSING'] || 0;
    const approvedCount = certByStatus['APPROVED'] || 0;
    const totalProcessed = approvedCount + (certByStatus['REJECTED'] || 0);
    const successRate = totalProcessed > 0 ? (approvedCount / totalProcessed) * 100 : 0;
    
    res.json({
      queue: queueStats,
      ...ingestionStats,
      certificates: {
        total: allCertificates.length,
        recent24h: recentCerts.length,
        byStatus: certByStatus,
        byType: certByType,
        throughputByHour: certThroughputByHour,
        pending: pendingCount,
        processing: processingCount,
        approved: approvedCount,
        successRate,
      },
      recentCertificates: recentCerts.slice(0, 50).map(c => ({
        id: c.id,
        certificateType: c.certificateType,
        fileName: c.fileName || 'Unknown',
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting ingestion stats:", error);
    res.status(500).json({ error: "Failed to get ingestion stats" });
  }
});

systemOperationsRouter.post("/admin/create-test-queue-jobs", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { count: countParam = 5 } = req.body;
    const jobCount = Math.min(parseInt(countParam) || 5, 20);
    
    const certTypes = ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT'];
    const statuses = ['QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED'];
    const allProperties = await storage.listProperties(ORG_ID);
    
    if (allProperties.length === 0) {
      return res.status(400).json({ error: "No properties available for test jobs" });
    }
    
    const createdJobs = [];
    for (let i = 0; i < jobCount; i++) {
      const property = allProperties[Math.floor(Math.random() * allProperties.length)];
      const certType = certTypes[Math.floor(Math.random() * certTypes.length)];
      const status = statuses[i % statuses.length];
      
      const job = await storage.createIngestionJob({
        organisationId: ORG_ID,
        propertyId: property.id,
        certificateType: certType as "GAS_SAFETY" | "EICR" | "EPC" | "FIRE_RISK_ASSESSMENT" | "LEGIONELLA_ASSESSMENT" | "ASBESTOS_SURVEY" | "LIFT_LOLER" | "OTHER",
        channel: 'DEMO',
        fileName: `test_${certType.toLowerCase()}_${Date.now()}_${i}.pdf`,
        objectPath: null,
        webhookUrl: null,
        idempotencyKey: `test-${Date.now()}-${i}`,
        apiClientId: null
      });
      
      const progressByStatus: Record<string, number> = {
        'QUEUED': 0,
        'PROCESSING': 50,
        'COMPLETE': 100,
        'FAILED': 25,
      };
      
      await storage.updateIngestionJob(job.id, {
        status: status as "QUEUED" | "UPLOADING" | "EXTRACTING" | "PROCESSING" | "COMPLETE" | "FAILED" | "CANCELLED",
        progress: progressByStatus[status] || 0,
        statusMessage: status === 'COMPLETE' ? 'Demo: completed successfully' : 
                      status === 'FAILED' ? 'Demo: no file content (test job)' :
                      status === 'PROCESSING' ? 'Demo: currently processing' : 
                      status === 'QUEUED' ? 'Demo: waiting in queue' : undefined,
        completedAt: status === 'COMPLETE' || status === 'FAILED' ? new Date() : undefined,
        lastAttemptAt: status !== 'QUEUED' ? new Date() : undefined,
        attemptCount: status === 'COMPLETE' ? 1 : status === 'FAILED' ? 3 : status === 'PROCESSING' ? 1 : 0,
      });
      
      createdJobs.push({ id: job.id, type: certType, status, property: property.addressLine1 });
    }
    
    res.json({ 
      message: `Created ${createdJobs.length} demo ingestion jobs with various statuses`,
      jobs: createdJobs
    });
  } catch (error) {
    console.error("Error creating test queue jobs:", error);
    res.status(500).json({ error: "Failed to create test queue jobs" });
  }
});

systemOperationsRouter.delete("/admin/clear-demo-jobs", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const deletedCount = await storage.deleteIngestionJobsByChannel('DEMO');
    
    res.json({ 
      success: true,
      message: `Cleared ${deletedCount} demo jobs`,
      deletedCount
    });
  } catch (error) {
    console.error("Error clearing demo jobs:", error);
    res.status(500).json({ error: "Failed to clear demo jobs" });
  }
});

systemOperationsRouter.get("/admin/ingestion-jobs", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { status, limit = "50", offset = "0" } = req.query;
    const jobs = await storage.listAllIngestionJobs({
      status: status as string | undefined,
      limit: Math.min(parseInt(limit as string) || 50, 200),
      offset: parseInt(offset as string) || 0,
    });
    
    res.json(jobs);
  } catch (error) {
    console.error("Error getting ingestion jobs:", error);
    res.status(500).json({ error: "Failed to get ingestion jobs" });
  }
});

systemOperationsRouter.post("/admin/ingestion-jobs/:id/retry", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { id } = req.params;
    const job = await storage.getIngestionJob(id);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (job.status !== 'FAILED') {
      return res.status(400).json({ error: "Only failed jobs can be retried" });
    }
    
    await storage.updateIngestionJob(id, {
      status: 'QUEUED',
      attemptCount: 0,
      errorDetails: null,
      statusMessage: 'Manually retried',
    });
    
    res.json({ success: true, message: "Job queued for retry" });
  } catch (error) {
    console.error("Error retrying ingestion job:", error);
    res.status(500).json({ error: "Failed to retry job" });
  }
});

systemOperationsRouter.get("/admin/scheduled-jobs", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { getScheduledJobsStatus } = await import('../../job-queue');
    const scheduledJobs = await getScheduledJobsStatus();
    
    res.json(scheduledJobs);
  } catch (error) {
    console.error("Error getting scheduled jobs:", error);
    res.status(500).json({ error: "Failed to get scheduled jobs" });
  }
});

systemOperationsRouter.post("/admin/scheduled-jobs/watchdog/run", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { triggerWatchdogNow } = await import('../../job-queue');
    const jobId = await triggerWatchdogNow();
    
    res.json({ 
      success: true, 
      message: "Certificate watchdog triggered", 
      jobId 
    });
  } catch (error) {
    console.error("Error triggering watchdog:", error);
    res.status(500).json({ error: "Failed to trigger watchdog" });
  }
});

systemOperationsRouter.put("/admin/scheduled-jobs/watchdog/schedule", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { intervalMinutes } = req.body;
    
    if (!intervalMinutes || typeof intervalMinutes !== 'number') {
      return res.status(400).json({ error: "intervalMinutes is required and must be a number" });
    }
    
    if (intervalMinutes < 1 || intervalMinutes > 60) {
      return res.status(400).json({ error: "intervalMinutes must be between 1 and 60" });
    }
    
    const { updateWatchdogSchedule } = await import('../../job-queue');
    await updateWatchdogSchedule(intervalMinutes);
    
    res.json({ 
      success: true, 
      message: `Watchdog schedule updated to every ${intervalMinutes} minute(s)`,
      intervalMinutes 
    });
  } catch (error) {
    console.error("Error updating watchdog schedule:", error);
    res.status(500).json({ error: "Failed to update watchdog schedule" });
  }
});

systemOperationsRouter.put("/admin/scheduled-jobs/watchdog/enabled", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "enabled is required and must be a boolean" });
    }
    
    const { setWatchdogEnabled } = await import('../../job-queue');
    await setWatchdogEnabled(enabled);
    
    res.json({ 
      success: true, 
      message: enabled ? "Watchdog enabled" : "Watchdog disabled",
      enabled 
    });
  } catch (error) {
    console.error("Error toggling watchdog:", error);
    res.status(500).json({ error: "Failed to toggle watchdog" });
  }
});

systemOperationsRouter.get("/admin/logs", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { level, source, search, limit = "100", offset = "0" } = req.query;
    
    const result = await storage.getSystemLogs({
      level: level as string | undefined,
      source: source as string | undefined,
      search: search as string | undefined,
      limit: Math.min(parseInt(limit as string) || 100, 500),
      offset: parseInt(offset as string) || 0,
    });
    
    const sensitiveKeys = ['password', 'secret', 'token', 'api_key', 'apiKey', 'authorization', 'cookie', 'session', 'credentials', 'private', 'bearer'];
    
    const scrubMetadata = (obj: Record<string, unknown> | null): Record<string, unknown> | null => {
      if (!obj || typeof obj !== 'object') return obj;
      const scrubbed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          scrubbed[key] = '[REDACTED]';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          scrubbed[key] = scrubMetadata(value as Record<string, unknown>);
        } else {
          scrubbed[key] = value;
        }
      }
      return scrubbed;
    };
    
    const scrubbedLogs = result.logs.map(log => ({
      ...log,
      context: scrubMetadata(log.context as Record<string, unknown> | null)
    }));
    
    res.json({ logs: scrubbedLogs, total: result.total });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

systemOperationsRouter.get("/admin/log-rotation/stats", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { getLogRotationStats } = await import('../../services/log-rotation');
    const result = getLogRotationStats();
    res.json(result);
  } catch (error) {
    console.error("Error getting log rotation stats:", error);
    res.status(500).json({ error: "Failed to get log rotation stats" });
  }
});

systemOperationsRouter.post("/admin/log-rotation/rotate", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { rotateOldLogs } = await import('../../services/log-rotation');
    const result = await rotateOldLogs();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error rotating logs:", error);
    res.status(500).json({ error: "Failed to rotate logs" });
  }
});

systemOperationsRouter.get("/admin/openapi", (req, res) => {
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "ComplianceAI API",
      version: "1.0.0",
      description: "API for UK Social Housing Compliance Management"
    },
    servers: [
      { url: "/api", description: "API Server" }
    ],
    paths: {
      "/schemes": { get: { summary: "List schemes", tags: ["Schemes"] } },
      "/blocks": { get: { summary: "List blocks", tags: ["Blocks"] } },
      "/properties": { get: { summary: "List properties", tags: ["Properties"] } },
      "/certificates": { get: { summary: "List certificates", tags: ["Certificates"] } },
      "/actions": { get: { summary: "List remedial actions", tags: ["Actions"] } },
      "/contractors": { get: { summary: "List contractors", tags: ["Contractors"] } },
      "/integrations/hms/actions": {
        post: {
          summary: "Receive action updates from HMS",
          tags: ["Integrations"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actionId"],
                  properties: {
                    actionId: { type: "string", description: "Remedial action ID" },
                    status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"] },
                    notes: { type: "string" },
                    completedAt: { type: "string", format: "date-time" },
                    costActual: { type: "number" }
                  }
                }
              }
            }
          }
        }
      },
      "/integrations/hms/work-orders": {
        post: {
          summary: "Receive work order confirmations from HMS",
          tags: ["Integrations"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actionId"],
                  properties: {
                    workOrderId: { type: "string" },
                    actionId: { type: "string" },
                    status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"] },
                    scheduledDate: { type: "string", format: "date" },
                    assignedContractor: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      }
    }
  };
  res.json(openApiSpec);
});

systemOperationsRouter.get("/sidebar/counts", async (req, res) => {
  try {
    const counts = await withCache('sidebar_counts', {}, async () => {
      const now = new Date().toISOString();
      
      const [emergencyResult, overdueResult, pendingReviewResult, totalPropertiesResult, totalCertsResult, openActionsResult] = await Promise.all([
        db.select({ count: count() })
          .from(remedialActions)
          .where(and(
            eq(remedialActions.severity, 'IMMEDIATE'),
            eq(remedialActions.status, 'OPEN')
          )),
        db.select({ count: count() })
          .from(certificates)
          .where(lt(certificates.expiryDate, now)),
        db.select({ count: count() })
          .from(certificates)
          .where(eq(certificates.status, 'NEEDS_REVIEW')),
        db.select({ count: count() })
          .from(properties),
        db.select({ count: count() })
          .from(certificates),
        db.select({ count: count() })
          .from(remedialActions)
          .where(eq(remedialActions.status, 'OPEN'))
      ]);
      
      return {
        emergencyHazards: emergencyResult[0]?.count || 0,
        overdueCertificates: overdueResult[0]?.count || 0,
        pendingReview: pendingReviewResult[0]?.count || 0,
        totalProperties: totalPropertiesResult[0]?.count || 0,
        totalCertificates: totalCertsResult[0]?.count || 0,
        openActions: openActionsResult[0]?.count || 0
      };
    }, 60);
    
    res.json(counts);
  } catch (error) {
    console.error("Error fetching sidebar counts:", error);
    res.status(500).json({ error: "Failed to fetch sidebar counts" });
  }
});

systemOperationsRouter.get("/navigation", async (req, res) => {
  try {
    const navigation = await withCache('navigation', {}, async () => {
      return await storage.getNavigationWithItems();
    }, 600);
    res.json(navigation);
  } catch (error) {
    console.error("Error fetching navigation:", error);
    res.status(500).json({ error: "Failed to fetch navigation configuration" });
  }
});

systemOperationsRouter.get("/navigation/sections", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const sections = await storage.listNavigationSections();
    res.json(sections);
  } catch (error) {
    console.error("Error fetching navigation sections:", error);
    res.status(500).json({ error: "Failed to fetch navigation sections" });
  }
});

systemOperationsRouter.post("/navigation/sections", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const section = await storage.createNavigationSection(req.body);
    res.status(201).json(section);
  } catch (error) {
    console.error("Error creating navigation section:", error);
    res.status(500).json({ error: "Failed to create navigation section" });
  }
});

systemOperationsRouter.patch("/navigation/sections/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const section = await storage.updateNavigationSection(req.params.id, req.body);
    if (!section) {
      return res.status(404).json({ error: "Navigation section not found" });
    }
    res.json(section);
  } catch (error) {
    console.error("Error updating navigation section:", error);
    res.status(500).json({ error: "Failed to update navigation section" });
  }
});

systemOperationsRouter.delete("/navigation/sections/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const deleted = await storage.deleteNavigationSection(req.params.id);
    if (!deleted) {
      return res.status(400).json({ error: "Cannot delete system navigation section" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting navigation section:", error);
    res.status(500).json({ error: "Failed to delete navigation section" });
  }
});

systemOperationsRouter.get("/navigation/items", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const sectionId = req.query.sectionId as string | undefined;
    const items = await storage.listNavigationItemsWithRoles(sectionId);
    res.json(items);
  } catch (error) {
    console.error("Error fetching navigation items:", error);
    res.status(500).json({ error: "Failed to fetch navigation items" });
  }
});

systemOperationsRouter.post("/navigation/items", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const item = await storage.createNavigationItem(req.body);
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating navigation item:", error);
    res.status(500).json({ error: "Failed to create navigation item" });
  }
});

systemOperationsRouter.patch("/navigation/items/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const item = await storage.updateNavigationItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "Navigation item not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("Error updating navigation item:", error);
    res.status(500).json({ error: "Failed to update navigation item" });
  }
});

systemOperationsRouter.delete("/navigation/items/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const deleted = await storage.deleteNavigationItem(req.params.id);
    if (!deleted) {
      return res.status(400).json({ error: "Cannot delete system navigation item" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting navigation item:", error);
    res.status(500).json({ error: "Failed to delete navigation item" });
  }
});

systemOperationsRouter.get("/navigation/items/:id/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const roles = await storage.getNavigationItemRoles(req.params.id);
    res.json({ itemId: req.params.id, roles });
  } catch (error) {
    console.error("Error fetching navigation item roles:", error);
    res.status(500).json({ error: "Failed to fetch navigation item roles" });
  }
});

systemOperationsRouter.put("/navigation/items/:id/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ error: "roles must be an array" });
    }
    await storage.setNavigationItemRoles(req.params.id, roles);
    res.json({ success: true, itemId: req.params.id, roles });
  } catch (error) {
    console.error("Error setting navigation item roles:", error);
    res.status(500).json({ error: "Failed to set navigation item roles" });
  }
});

systemOperationsRouter.put("/admin/navigation/bulk-roles", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array of {itemId, roles}" });
    }
    
    for (const { itemId, roles } of items) {
      if (itemId && Array.isArray(roles)) {
        await storage.setNavigationItemRoles(itemId, roles);
      }
    }
    
    res.json({ success: true, updated: items.length });
  } catch (error) {
    console.error("Error bulk updating navigation roles:", error);
    res.status(500).json({ error: "Failed to bulk update navigation roles" });
  }
});

systemOperationsRouter.get("/admin/roles", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const roles = [
      { id: 'LASHAN_SUPER_USER', name: 'Lashan Super User', description: 'Full system access' },
      { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Organisation-wide administrative access' },
      { id: 'SYSTEM_ADMIN', name: 'System Admin', description: 'System configuration access' },
      { id: 'COMPLIANCE_MANAGER', name: 'Compliance Manager', description: 'Compliance oversight and management' },
      { id: 'ADMIN', name: 'Admin', description: 'Administrative functions' },
      { id: 'MANAGER', name: 'Manager', description: 'Team management and oversight' },
      { id: 'OFFICER', name: 'Officer', description: 'Operational compliance tasks' },
      { id: 'VIEWER', name: 'Viewer', description: 'Read-only access' }
    ];
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

systemOperationsRouter.get("/navigation/icons", async (req, res) => {
  try {
    const icons = await storage.listIconRegistry();
    res.json(icons);
  } catch (error) {
    console.error("Error fetching icons:", error);
    res.status(500).json({ error: "Failed to fetch icons" });
  }
});
