import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertRemedialActionSchema } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { enqueueWebhookEvent } from "../webhook-worker";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";

export const remedialRouter = Router();

// Apply requireAuth middleware to all routes in this router
remedialRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// ===== REMEDIAL ACTIONS =====
remedialRouter.get("/", paginationMiddleware(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const pagination = (req as any).pagination as PaginationParams;
    const { page, limit, offset } = pagination;
    const search = req.query.search as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const overdue = req.query.overdue as string | undefined;
    
    const actions = await storage.listRemedialActions(orgId, { propertyId, status });
    
    let filteredActions = actions;
    if (severity) {
      filteredActions = actions.filter(a => a.severity === severity);
    }
    
    if (overdue === 'true') {
      const now = new Date();
      filteredActions = filteredActions.filter(a => {
        if (a.status !== 'OPEN') return false;
        if (!a.dueDate) return false;
        return new Date(a.dueDate) < now;
      });
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredActions = filteredActions.filter(a => 
        a.code?.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower)
      );
    }
    
    const total = filteredActions.length;
    const paginatedActions = filteredActions.slice(offset, offset + limit);
    
    const schemes = await storage.listSchemes(orgId);
    const blocks = await storage.listBlocks(orgId);
    const schemeMap = new Map(schemes.map(s => [s.id, s.name]));
    const blockMap = new Map(blocks.map(b => [b.id, { name: b.name, schemeId: b.schemeId }]));
    
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
    
    res.json({ data: enrichedActions, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.status(500).json({ error: "Failed to fetch actions" });
  }
});

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

remedialRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
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

remedialRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const updates = req.body;
    const beforeAction = await storage.getRemedialAction(req.params.id);
    if (!beforeAction) {
      return res.status(404).json({ error: "Action not found" });
    }
    
    if (updates.status === 'COMPLETED' || updates.status === 'completed') {
      updates.status = 'COMPLETED';
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
