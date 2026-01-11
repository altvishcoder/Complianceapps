import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";

export const goldenThreadRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

// ===== GOLDEN THREAD - Certificate Versions =====
goldenThreadRouter.get("/certificates/:id/versions", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const certificate = await storage.getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    if (certificate.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const versions = await storage.listCertificateVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    console.error("Error fetching certificate versions:", error);
    res.status(500).json({ error: "Failed to fetch certificate versions" });
  }
});

// ===== GOLDEN THREAD - Audit Trail =====
goldenThreadRouter.get("/audit-trail/:entityType/:entityId", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const { getAuditTrailForEntity } = await import('../services/golden-thread-audit');
    const auditTrail = await getAuditTrailForEntity(
      user.organisationId,
      req.params.entityType,
      req.params.entityId
    );
    res.json(auditTrail);
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

// ===== GOLDEN THREAD - UKHDS Export =====
goldenThreadRouter.get("/golden-thread/exports", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const exports = await storage.listUkhdsExports(user.organisationId);
    res.json(exports);
  } catch (error) {
    console.error("Error fetching UKHDS exports:", error);
    res.status(500).json({ error: "Failed to fetch UKHDS exports" });
  }
});

goldenThreadRouter.post("/golden-thread/exports", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const exportJob = await storage.createUkhdsExport({
      organisationId: user.organisationId,
      requestedById: userId,
      exportType: req.body.exportType || 'FULL',
      exportFormat: req.body.exportFormat || 'JSON',
      includeProperties: req.body.includeProperties ?? true,
      includeComponents: req.body.includeComponents ?? true,
      includeCertificates: req.body.includeCertificates ?? true,
      includeCertificateVersions: req.body.includeCertificateVersions ?? true,
      includeAuditTrail: req.body.includeAuditTrail ?? true,
      includeRemedialActions: req.body.includeRemedialActions ?? true,
      dateRangeStart: req.body.dateRangeStart ? new Date(req.body.dateRangeStart) : null,
      dateRangeEnd: req.body.dateRangeEnd ? new Date(req.body.dateRangeEnd) : null,
      schemeIds: req.body.schemeIds || null,
    });
    
    const { processExportJob } = await import('../services/ukhds-export');
    processExportJob(exportJob.id).catch(err => {
      console.error("Error processing UKHDS export:", err);
    });
    
    res.status(201).json(exportJob);
  } catch (error) {
    console.error("Error creating UKHDS export:", error);
    res.status(500).json({ error: "Failed to create UKHDS export" });
  }
});

goldenThreadRouter.get("/golden-thread/exports/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const exportJob = await storage.getUkhdsExport(req.params.id);
    if (!exportJob) {
      return res.status(404).json({ error: "Export not found" });
    }
    if (exportJob.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(exportJob);
  } catch (error) {
    console.error("Error fetching UKHDS export:", error);
    res.status(500).json({ error: "Failed to fetch UKHDS export" });
  }
});

goldenThreadRouter.get("/golden-thread/exports/:id/download", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    const exportJob = await storage.getUkhdsExport(req.params.id);
    if (!exportJob) {
      return res.status(404).json({ error: "Export not found" });
    }
    if (exportJob.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (exportJob.status !== 'COMPLETED') {
      return res.status(400).json({ error: "Export not ready for download" });
    }
    
    const { generateUKHDSExport } = await import('../services/ukhds-export');
    const exportData = await generateUKHDSExport(exportJob);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ukhds-export-${exportJob.id}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error("Error downloading UKHDS export:", error);
    res.status(500).json({ error: "Failed to download UKHDS export" });
  }
});

// ===== COMPLIANCE CALENDAR EVENTS =====
interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate?: Date | null;
  eventType?: string;
  [key: string]: unknown;
}
let calendarEventsCache: { data: CalendarEvent[]; timestamp: number; orgId: string; filterKey: string } | null = null;
const CALENDAR_CACHE_TTL = 60000;

goldenThreadRouter.get("/calendar/events", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    
    const filters: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string } = {};
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.eventType) filters.eventType = req.query.eventType as string;
    if (req.query.complianceStreamId) filters.complianceStreamId = req.query.complianceStreamId as string;
    
    const filterKey = JSON.stringify(filters);
    const now = Date.now();
    
    if (calendarEventsCache && 
        calendarEventsCache.orgId === user.organisationId &&
        calendarEventsCache.filterKey === filterKey &&
        (now - calendarEventsCache.timestamp) < CALENDAR_CACHE_TTL) {
      return res.json(calendarEventsCache.data);
    }
    
    const events = await storage.listCalendarEvents(user.organisationId, filters);
    
    calendarEventsCache = {
      data: events,
      timestamp: now,
      orgId: user.organisationId,
      filterKey
    };
    
    res.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

goldenThreadRouter.get("/calendar/events/upcoming", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    
    const daysAhead = parseInt(req.query.days as string) || 7;
    const events = await storage.getUpcomingEvents(user.organisationId, daysAhead);
    res.json(events);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
});

goldenThreadRouter.get("/calendar/events/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const event = await storage.getCalendarEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Error fetching calendar event:", error);
    res.status(500).json({ error: "Failed to fetch calendar event" });
  }
});

goldenThreadRouter.post("/calendar/events", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.organisationId) {
      return res.status(401).json({ error: "Invalid user or no organisation" });
    }
    
    const eventData = {
      ...req.body,
      organisationId: user.organisationId,
      createdBy: userId,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    };
    
    const event = await storage.createCalendarEvent(eventData);
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

goldenThreadRouter.patch("/calendar/events/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const updates = { ...req.body };
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);
    
    const event = await storage.updateCalendarEvent(req.params.id, updates);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Error updating calendar event:", error);
    res.status(500).json({ error: "Failed to update calendar event" });
  }
});

goldenThreadRouter.delete("/calendar/events/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const deleted = await storage.deleteCalendarEvent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
});

// ===== CERTIFICATE EXPIRY ALERTS =====
goldenThreadRouter.get("/certificates/expiring", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const days = parseInt(req.query.days as string) || 30;
    const organisationId = user.organisationId;
    
    if (!organisationId) {
      return res.status(400).json({ error: "User has no organization" });
    }
    
    const { getCertificatesExpiringSoon, getExpiryStats } = await import('../services/expiry-alerts');
    
    const [alerts, stats] = await Promise.all([
      getCertificatesExpiringSoon(days, organisationId),
      getExpiryStats(organisationId),
    ]);
    
    res.json({ alerts, stats });
  } catch (error) {
    console.error("Error fetching expiring certificates:", error);
    res.status(500).json({ error: "Failed to fetch expiring certificates" });
  }
});
