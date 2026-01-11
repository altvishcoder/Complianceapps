import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { auth } from "../../auth";
import { fromNodeHeaders } from "better-auth/node";
import { SUPER_ADMIN_ROLES, ADMIN_AND_ABOVE_ROLES } from "./utils";

export const adminDbOptimizationRouter = Router();

adminDbOptimizationRouter.get("/db-optimization/status", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getOptimizationStatus } = await import("../../db-optimization");
    const status = await getOptimizationStatus();
    res.json(status);
  } catch (error) {
    console.error("Error getting optimization status:", error);
    res.status(500).json({ error: "Failed to get optimization status" });
  }
});

adminDbOptimizationRouter.get("/db-optimization/categories", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getViewCategories } = await import("../../db-optimization");
    const categories = getViewCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error getting view categories:", error);
    res.status(500).json({ error: "Failed to get view categories" });
  }
});

adminDbOptimizationRouter.post("/db-optimization/refresh-view", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { viewName } = req.body;
    if (!viewName) {
      return res.status(400).json({ error: "View name is required" });
    }
    
    const { refreshMaterializedView, getAllViewNames } = await import("../../db-optimization");
    const validViews = getAllViewNames();
    if (!validViews.includes(viewName)) {
      return res.status(400).json({ error: "Invalid view name" });
    }
    
    const result = await refreshMaterializedView(viewName);
    res.json(result);
  } catch (error) {
    console.error("Error refreshing view:", error);
    res.status(500).json({ error: "Failed to refresh view" });
  }
});

adminDbOptimizationRouter.post("/db-optimization/refresh-all", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshAllMaterializedViews } = await import("../../db-optimization");
    const result = await refreshAllMaterializedViews();
    res.json(result);
  } catch (error) {
    console.error("Error refreshing all views:", error);
    res.status(500).json({ error: "Failed to refresh all views" });
  }
});

adminDbOptimizationRouter.post("/db-optimization/refresh-category", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }
    
    const { refreshViewsByCategory, getViewCategories } = await import("../../db-optimization");
    const validCategories = Object.keys(getViewCategories());
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    
    const result = await refreshViewsByCategory(category);
    res.json(result);
  } catch (error) {
    console.error("Error refreshing category:", error);
    res.status(500).json({ error: "Failed to refresh category" });
  }
});

adminDbOptimizationRouter.post("/db-optimization/apply-all", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applyAllOptimizations } = await import("../../db-optimization");
    const result = await applyAllOptimizations();
    res.json(result);
  } catch (error) {
    console.error("Error applying optimizations:", error);
    res.status(500).json({ error: "Failed to apply optimizations" });
  }
});

adminDbOptimizationRouter.get("/db-optimization/refresh-history", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { getRefreshHistory } = await import("../../db-optimization");
    const result = await getRefreshHistory(limit);
    res.json(result);
  } catch (error) {
    console.error("Error getting refresh history:", error);
    res.status(500).json({ error: "Failed to get refresh history" });
  }
});

adminDbOptimizationRouter.get("/db-optimization/freshness", requireRole(...ADMIN_AND_ABOVE_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staleThresholdHours = parseInt(req.query.staleThresholdHours as string) || 6;
    const { getFreshnessStatus } = await import("../../db-optimization");
    const result = await getFreshnessStatus(staleThresholdHours);
    res.json(result);
  } catch (error) {
    console.error("Error getting freshness status:", error);
    res.status(500).json({ error: "Failed to get freshness status" });
  }
});

adminDbOptimizationRouter.get("/db-optimization/schedule", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getRefreshSchedule } = await import("../../db-optimization");
    const schedule = await getRefreshSchedule();
    res.json({ schedule });
  } catch (error) {
    console.error("Error getting refresh schedule:", error);
    res.status(500).json({ error: "Failed to get refresh schedule" });
  }
});

adminDbOptimizationRouter.post("/db-optimization/schedule", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const { 
      scheduleTime, 
      timezone = 'Europe/London', 
      isEnabled = true, 
      postIngestionEnabled, 
      staleThresholdHours,
      refreshAll,
      targetViews
    } = req.body;
    
    if (!scheduleTime) {
      return res.status(400).json({ error: "scheduleTime is required" });
    }
    
    const { upsertRefreshSchedule } = await import("../../db-optimization");
    const schedule = await upsertRefreshSchedule({
      scheduleTime,
      timezone,
      isEnabled,
      postIngestionEnabled,
      staleThresholdHours,
      refreshAll,
      targetViews,
      updatedBy: session?.user?.id
    });
    
    try {
      const { updateMvRefreshSchedule } = await import("../../job-queue");
      await updateMvRefreshSchedule(scheduleTime, timezone, isEnabled);
    } catch (jobError) {
      console.error("Failed to update job queue schedule:", jobError);
    }
    
    res.json({ schedule });
  } catch (error) {
    console.error("Error updating refresh schedule:", error);
    res.status(500).json({ error: "Failed to update refresh schedule" });
  }
});
