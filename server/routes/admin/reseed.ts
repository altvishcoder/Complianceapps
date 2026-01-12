import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { SUPER_ADMIN_ROLES } from "./utils";
import type { SeedResult } from "../../seed";

export const adminReseedRouter = Router();

adminReseedRouter.post("/reseed-config", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`🔄 Manual configuration reseed triggered by user: ${req.user?.email}`);
    
    const { seedConfiguration } = await import("../../seed");
    
    const startTime = Date.now();
    const results: SeedResult[] = await seedConfiguration();
    const duration = Date.now() - startTime;
    
    const failed = results.filter((r: SeedResult) => !r.success);
    const succeeded = results.filter((r: SeedResult) => r.success);
    
    console.log(`✓ Manual reseed completed in ${duration}ms - ${succeeded.length} succeeded, ${failed.length} failed`);
    
    res.json({
      success: failed.length === 0,
      message: failed.length === 0 
        ? `All ${succeeded.length} configuration sections reseeded successfully` 
        : `Reseeded with ${failed.length} errors`,
      duration,
      results,
      summary: {
        total: results.length,
        succeeded: succeeded.length,
        failed: failed.length
      }
    });
  } catch (error) {
    console.error("❌ Manual configuration reseed failed:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to reseed configuration",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
