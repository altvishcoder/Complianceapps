import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { remedialActions, insertRemedialActionSchema } from "@shared/schema";
import { sql } from "drizzle-orm";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { enqueueWebhookEvent } from "../webhook-worker";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";

export const remedialRouter = Router();

// Apply requireAuth middleware to all routes in this router
remedialRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || "org-001";
}

// ===== REMEDIAL ACTIONS =====

// Lightweight stats-only endpoint for hero stats (no data fetching)
remedialRouter.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    // Get remedial action stats from materialized view (fast) with fallback to direct query
    const { getRemedialStats } = await import('../reporting/materialized-views');
    let stats = await getRemedialStats(orgId);
    
    // Fallback to direct query if materialized view not available
    if (!stats) {
      const [actionStats] = await db.select({
        totalOpen: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND due_date::date < CURRENT_DATE)`,
        immediate: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND severity = 'IMMEDIATE')`,
        inProgress: sql<number>`COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE status = 'COMPLETED')`,
      })
      .from(remedialActions);
      
      stats = {
        totalOpen: Number(actionStats?.totalOpen || 0),
        overdue: Number(actionStats?.overdue || 0),
        immediate: Number(actionStats?.immediate || 0),
        inProgress: Number(actionStats?.inProgress || 0),
        completed: Number(actionStats?.completed || 0),
      };
    }
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching action stats:", error);
    res.status(500).json({ error: "Failed to fetch action stats" });
  }
});

// List remedial actions with pagination and filtering
remedialRouter.get("/", paginationMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const overdue = req.query.overdue === 'true';
    const awaabs = req.query.awaabs === 'true';
    const phase = req.query.phase ? parseInt(req.query.phase as string, 10) : undefined;
    const certificateType = req.query.certificateType as string | undefined;
    const excludeCompleted = req.query.excludeCompleted === 'true';
    
    // Use database-level pagination for efficiency
    const { items: paginatedActions, total } = await storage.listRemedialActionsPaginated(orgId, {
      limit,
      offset,
      status,
      severity,
      search,
      overdue,
      propertyId,
      awaabs,
      phase,
      certificateType,
      excludeCompleted,
    });
    
    // Pre-fetch all schemes and blocks for efficiency
    const schemes = await storage.listSchemes(orgId);
    const blocks = await storage.listBlocks(orgId);
    const schemeMap = new Map(schemes.map(s => [s.id, s.name]));
    const blockMap = new Map(blocks.map(b => [b.id, { name: b.name, schemeId: b.schemeId }]));
    
    // Enrich with property, certificate, scheme, and block data
    const enrichedActions = await Promise.all(paginatedActions.map(async (action) => {
      const property = await storage.getProperty(action.propertyId);
      const certificate = await storage.getCertificate(action.certificateId);
      
      let schemeName = '';
      let blockName = '';
      
      if (property?.blockId) {
        const blockInfo = blockMap.get(property.blockId);
        if (blockInfo) {
          blockName = blockInfo.name;
          schemeName = blockInfo.schemeId ? schemeMap.get(blockInfo.schemeId) || '' : '';
        }
      }
      
      return {
        ...action,
        property: property ? {
          ...property,
          schemeName,
          blockName,
        } : undefined,
        certificate,
        schemeName,
        blockName,
        propertyAddress: property?.addressLine1 || 'Unknown Property',
      };
    }));
    
    // Get remedial action stats from materialized view (fast) with fallback to direct query
    const { getRemedialStats } = await import('../reporting/materialized-views');
    let stats = await getRemedialStats(orgId);
    
    // Fallback to direct query if materialized view not available
    if (!stats) {
      const [actionStats] = await db.select({
        totalOpen: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND due_date::date < CURRENT_DATE)`,
        immediate: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND severity = 'IMMEDIATE')`,
        inProgress: sql<number>`COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE status = 'COMPLETED')`,
      })
      .from(remedialActions);
      
      stats = {
        totalOpen: Number(actionStats?.totalOpen || 0),
        overdue: Number(actionStats?.overdue || 0),
        immediate: Number(actionStats?.immediate || 0),
        inProgress: Number(actionStats?.inProgress || 0),
        completed: Number(actionStats?.completed || 0),
      };
    }
    
    res.json({ data: enrichedActions, total, page, limit, totalPages: Math.ceil(total / limit), stats });
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.status(500).json({ error: "Failed to fetch actions" });
  }
});

// Get single remedial action
remedialRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const action = await storage.getRemedialAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    const property = await storage.getProperty(action.propertyId);
    const certificate = await storage.getCertificate(action.certificateId);
    
    res.json({
      ...action,
      property,
      certificate,
    });
  } catch (error) {
    console.error("Error fetching action:", error);
    res.status(500).json({ error: "Failed to fetch action" });
  }
});

// Create remedial action
remedialRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    const data = insertRemedialActionSchema.parse(req.body);
    const action = await storage.createRemedialAction(data);
    
    enqueueWebhookEvent('action.created', 'remedialAction', action.id, {
      id: action.id,
      propertyId: action.propertyId,
      code: action.code,
      description: action.description,
      severity: action.severity,
      status: action.status,
      dueDate: action.dueDate
    });
    
    await recordAudit({
      organisationId: orgId,
      eventType: 'REMEDIAL_ACTION_CREATED',
      entityType: 'REMEDIAL_ACTION',
      entityId: action.id,
      entityName: action.description,
      propertyId: action.propertyId,
      certificateId: action.certificateId,
      afterState: action,
      message: `Remedial action "${action.code}" created`,
      context: extractAuditContext(req),
    });
    
    res.status(201).json(action);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating action:", error);
      res.status(500).json({ error: "Failed to create action" });
    }
  }
});

// Update remedial action
remedialRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    
    const updates = req.body;
    const beforeAction = await storage.getRemedialAction(req.params.id);
    if (!beforeAction) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    // Normalize status to uppercase enum values (OPEN, IN_PROGRESS, SCHEDULED, COMPLETED, CANCELLED)
    if (updates.status) {
      const statusMap: Record<string, string> = {
        'open': 'OPEN',
        'in_progress': 'IN_PROGRESS',
        'in-progress': 'IN_PROGRESS',
        'scheduled': 'SCHEDULED',
        'completed': 'COMPLETED',
        'cancelled': 'CANCELLED',
        'canceled': 'CANCELLED',
      };
      updates.status = statusMap[updates.status.toLowerCase()] || updates.status.toUpperCase();
    }
    
    // Set resolvedAt when marking as completed
    if (updates.status === 'COMPLETED') {
      updates.resolvedAt = new Date().toISOString();
    }
    
    const action = await storage.updateRemedialAction(req.params.id, updates);
    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    const eventType = updates.status === 'COMPLETED' ? 'action.completed' : 'action.updated';
    enqueueWebhookEvent(eventType, 'remedialAction', action.id, {
      id: action.id,
      propertyId: action.propertyId,
      code: action.code,
      description: action.description,
      severity: action.severity,
      status: action.status,
      dueDate: action.dueDate
    });
    
    // Record audit event
    const auditEventType = updates.status === 'COMPLETED' ? 'REMEDIAL_ACTION_COMPLETED' : 'REMEDIAL_ACTION_UPDATED';
    await recordAudit({
      organisationId: orgId,
      eventType: auditEventType,
      entityType: 'REMEDIAL_ACTION',
      entityId: action.id,
      entityName: action.description,
      propertyId: action.propertyId,
      certificateId: action.certificateId,
      beforeState: beforeAction,
      afterState: action,
      changes: getChanges(beforeAction, action),
      message: updates.status === 'COMPLETED' 
        ? `Remedial action "${action.code}" marked complete`
        : `Remedial action "${action.code}" updated`,
      context: extractAuditContext(req),
    });
    
    res.json(action);
  } catch (error) {
    console.error("Error updating action:", error);
    res.status(500).json({ error: "Failed to update action" });
  }
});

// Delete (cancel) remedial action
remedialRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const action = await storage.getRemedialAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    const updated = await storage.updateRemedialAction(req.params.id, { status: 'CANCELLED' });
    if (!updated) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    enqueueWebhookEvent('action.deleted', 'remedialAction', req.params.id, {
      id: req.params.id,
      propertyId: action.propertyId,
      code: action.code
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting action:", error);
    res.status(500).json({ error: "Failed to delete action" });
  }
});
