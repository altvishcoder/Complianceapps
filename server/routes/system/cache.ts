import { Router } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import * as cacheAdminService from "../../services/cache-admin";
import { getSSEClientCount } from "../../events";
import { SUPER_ADMIN_ROLES } from "./utils";

export const systemCacheRouter = Router();

systemCacheRouter.get("/admin/cache/overview", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const overview = await cacheAdminService.getCacheOverview();
    res.json(overview);
  } catch (error) {
    console.error("Error fetching cache overview:", error);
    res.status(500).json({ error: "Failed to fetch cache overview" });
  }
});

systemCacheRouter.get("/admin/cache/regions", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const { layer, category, activeOnly } = req.query;
    const regions = await cacheAdminService.getCacheRegions({
      layer: layer as cacheAdminService.CacheLayer | undefined,
      category: category as string | undefined,
      activeOnly: activeOnly !== 'false',
    });
    res.json(regions);
  } catch (error) {
    console.error("Error fetching cache regions:", error);
    res.status(500).json({ error: "Failed to fetch cache regions" });
  }
});

systemCacheRouter.post("/admin/cache/confirmation-token", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const token = cacheAdminService.generateConfirmationToken();
    res.json({ token, expiresIn: 300 });
  } catch (error) {
    console.error("Error generating confirmation token:", error);
    res.status(500).json({ error: "Failed to generate confirmation token" });
  }
});

systemCacheRouter.post("/admin/cache/preview", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const { scope, identifier, identifiers, reason } = req.body;
    
    if (!scope || !reason) {
      return res.status(400).json({ error: "Scope and reason are required" });
    }

    const result = await cacheAdminService.clearCache({
      scope,
      identifier,
      identifiers,
      reason,
      dryRun: true,
      userId: req.session.userId!,
      userRole: req.user?.role || 'UNKNOWN',
      userIp: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error("Error previewing cache clear:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to preview cache clear" });
  }
});

systemCacheRouter.post("/admin/cache/clear", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const { scope, identifier, identifiers, reason, confirmationToken } = req.body;
    
    if (!scope || !reason) {
      return res.status(400).json({ error: "Scope and reason are required" });
    }

    if (scope === 'ALL') {
      if (!confirmationToken) {
        return res.status(400).json({ error: "Confirmation token required for clearing all caches" });
      }
      if (!cacheAdminService.validateConfirmationToken(confirmationToken)) {
        return res.status(400).json({ error: "Invalid or expired confirmation token" });
      }
    }

    const result = await cacheAdminService.clearCache({
      scope,
      identifier,
      identifiers,
      reason,
      confirmationToken,
      dryRun: false,
      userId: req.session.userId!,
      userRole: req.user?.role || 'UNKNOWN',
      userIp: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to clear cache" });
  }
});

systemCacheRouter.get("/admin/cache/audit", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const { limit, userId } = req.query;
    const history = await cacheAdminService.getCacheClearHistory({
      limit: limit ? parseInt(limit as string) : 50,
      userId: userId as string | undefined,
    });
    res.json(history);
  } catch (error) {
    console.error("Error fetching cache audit history:", error);
    res.status(500).json({ error: "Failed to fetch cache audit history" });
  }
});

systemCacheRouter.post("/admin/cache/notify-clients", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const { regions } = req.body;
    
    if (!regions || !Array.isArray(regions)) {
      return res.status(400).json({ error: "Regions array required" });
    }

    cacheAdminService.broadcastCacheInvalidation(regions);
    
    const clientCount = getSSEClientCount();

    res.json({ 
      success: true, 
      message: `Cache invalidation notification sent for ${regions.length} regions`,
      clientsNotified: clientCount,
    });
  } catch (error) {
    console.error("Error notifying clients:", error);
    res.status(500).json({ error: "Failed to notify clients" });
  }
});

systemCacheRouter.get("/admin/cache/memory-stats", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const stats = cacheAdminService.memoryCache.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching memory stats:", error);
    res.status(500).json({ error: "Failed to fetch memory stats" });
  }
});
