import { Router, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertContractorSchema, insertStaffMemberSchema } from "@shared/schema";
import { paginationMiddleware, type PaginationParams } from "../services/api-limits";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../session";

export const contractorsRouter = Router();

// Apply requireAuth middleware to all routes in this router
contractorsRouter.use(requireAuth as any);

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// ===== CONTRACTORS =====
contractorsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    const contractors = await storage.listContractors(orgId);
    res.json(contractors);
  } catch (error) {
    console.error("Error fetching contractors:", error);
    res.status(500).json({ error: "Failed to fetch contractors" });
  }
});

contractorsRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) {
      return res.status(404).json({ error: "Contractor not found" });
    }
    res.json(contractor);
  } catch (error) {
    console.error("Error fetching contractor:", error);
    res.status(500).json({ error: "Failed to fetch contractor" });
  }
});

contractorsRouter.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    const data = insertContractorSchema.parse({ ...req.body, organisationId: orgId });
    const contractor = await storage.createContractor(data);
    res.status(201).json(contractor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
    }
  }
});

contractorsRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractor = await storage.updateContractor(req.params.id, req.body);
    if (!contractor) {
      return res.status(404).json({ error: "Contractor not found" });
    }
    res.json(contractor);
  } catch (error) {
    console.error("Error updating contractor:", error);
    res.status(500).json({ error: "Failed to update contractor" });
  }
});

contractorsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) {
      return res.status(404).json({ error: "Contractor not found" });
    }
    await storage.updateContractor(req.params.id, { status: 'SUSPENDED' });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting contractor:", error);
    res.status(500).json({ error: "Failed to delete contractor" });
  }
});

// ===== STAFF MEMBERS =====
contractorsRouter.get("/staff", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    const staff = await storage.listStaffMembers(orgId);
    res.json(staff);
  } catch (error) {
    console.error("Error fetching staff members:", error);
    res.status(500).json({ error: "Failed to fetch staff members" });
  }
});

contractorsRouter.get("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await storage.getStaffMember(req.params.id);
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    res.json(staff);
  } catch (error) {
    console.error("Error fetching staff member:", error);
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

contractorsRouter.post("/staff", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    const data = insertStaffMemberSchema.parse({ ...req.body, organisationId: orgId });
    const staff = await storage.createStaffMember(data);
    res.status(201).json(staff);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  }
});

contractorsRouter.patch("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await storage.updateStaffMember(req.params.id, req.body);
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    res.json(staff);
  } catch (error) {
    console.error("Error updating staff member:", error);
    res.status(500).json({ error: "Failed to update staff member" });
  }
});

contractorsRouter.delete("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await storage.getStaffMember(req.params.id);
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    await storage.updateStaffMember(req.params.id, { status: 'INACTIVE' });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff member:", error);
    res.status(500).json({ error: "Failed to delete staff member" });
  }
});
