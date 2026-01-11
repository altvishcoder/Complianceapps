import { Router, Request, Response } from "express";
import { z } from "zod";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";
import { storage } from "../storage";
import { db } from "../db";
import { 
  users, 
  insertStaffMemberSchema,
  contractorSLAProfiles,
  contractorJobPerformance,
  contractorRatings
} from "@shared/schema";
import { eq, desc, count, sql } from "drizzle-orm";

export const staffRouter = Router();

async function getOrgId(req: Request): Promise<{ userId: string; organisationId: string } | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user || !user.organisationId) return null;
  
  return { userId: user.id, organisationId: user.organisationId };
}

function getSessionUserId(req: Request): string | undefined {
  return (req.session as any)?.userId;
}

async function getSessionOrgId(req: Request): Promise<{ userId: string; organisationId: string } | null> {
  const userId = getSessionUserId(req);
  if (!userId) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.organisationId) return null;
  
  return { userId: user.id, organisationId: user.organisationId };
}

// ===== STAFF MEMBERS - requires BetterAuth authentication =====
staffRouter.get("/staff", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const filters: { status?: string; department?: string } = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.department) filters.department = req.query.department as string;
    const staffList = await storage.listStaffMembers(orgInfo.organisationId, filters);
    res.json(staffList);
  } catch (error) {
    console.error("Error fetching staff members:", error);
    res.status(500).json({ error: "Failed to fetch staff members" });
  }
});

staffRouter.get("/staff/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const staff = await storage.getStaffMember(req.params.id);
    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    if (staff.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(staff);
  } catch (error) {
    console.error("Error fetching staff member:", error);
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

staffRouter.post("/staff", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const data = insertStaffMemberSchema.parse({ ...req.body, organisationId: orgInfo.organisationId });
    const staff = await storage.createStaffMember(data);
    res.status(201).json(staff);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating staff member:", error);
    res.status(500).json({ error: "Failed to create staff member" });
  }
});

staffRouter.patch("/staff/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const existing = await storage.getStaffMember(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    if (existing.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updateData = insertStaffMemberSchema.partial().parse(req.body);
    const staff = await storage.updateStaffMember(req.params.id, updateData);
    res.json(staff);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error updating staff member:", error);
    res.status(500).json({ error: "Failed to update staff member" });
  }
});

staffRouter.delete("/staff/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const existing = await storage.getStaffMember(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    if (existing.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteStaffMember(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  } catch (error) {
    console.error("Error deleting staff member:", error);
    res.status(500).json({ error: "Failed to delete staff member" });
  }
});

staffRouter.post("/staff/bulk-import", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { staffList } = req.body;
    if (!Array.isArray(staffList) || staffList.length === 0) {
      return res.status(400).json({ error: "No staff data provided" });
    }
    const validatedList = staffList.map(item => 
      insertStaffMemberSchema.parse({ ...item, organisationId: orgInfo.organisationId })
    );
    const created = await storage.bulkCreateStaffMembers(validatedList);
    res.status(201).json({ success: true, created: created.length, staff: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error bulk importing staff members:", error);
    res.status(500).json({ error: "Failed to import staff members" });
  }
});

// ===== CONTRACTOR CERTIFICATIONS - requires authentication =====
staffRouter.get("/contractor-certifications", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractorId = req.query.contractorId as string | undefined;
    if (contractorId) {
      const contractor = await storage.getContractor(contractorId);
      if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
        return res.status(403).json({ error: "Access denied to contractor" });
      }
    }
    const certifications = await storage.listContractorCertifications(orgInfo.organisationId, contractorId);
    res.json(certifications);
  } catch (error) {
    console.error("Error fetching contractor certifications:", error);
    res.status(500).json({ error: "Failed to fetch contractor certifications" });
  }
});

staffRouter.get("/contractor-certifications/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const certification = await storage.getContractorCertification(req.params.id);
    if (!certification) {
      return res.status(404).json({ error: "Certification not found" });
    }
    if (certification.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(certification);
  } catch (error) {
    console.error("Error fetching contractor certification:", error);
    res.status(500).json({ error: "Failed to fetch contractor certification" });
  }
});

staffRouter.post("/contractor-certifications", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractor = await storage.getContractor(req.body.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Invalid contractor or access denied" });
    }
    const certification = await storage.createContractorCertification({
      ...req.body,
      organisationId: orgInfo.organisationId,
      verifiedById: orgInfo.userId,
    });
    res.status(201).json(certification);
  } catch (error) {
    console.error("Error creating contractor certification:", error);
    res.status(500).json({ error: "Failed to create contractor certification" });
  }
});

staffRouter.patch("/contractor-certifications/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const certification = await storage.getContractorCertification(req.params.id);
    if (!certification) {
      return res.status(404).json({ error: "Certification not found" });
    }
    if (certification.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = await storage.updateContractorCertification(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating contractor certification:", error);
    res.status(500).json({ error: "Failed to update contractor certification" });
  }
});

staffRouter.delete("/contractor-certifications/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const certification = await storage.getContractorCertification(req.params.id);
    if (!certification) {
      return res.status(404).json({ error: "Certification not found" });
    }
    if (certification.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    await storage.deleteContractorCertification(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting contractor certification:", error);
    res.status(500).json({ error: "Failed to delete contractor certification" });
  }
});

// ===== CONTRACTOR VERIFICATION HISTORY =====
staffRouter.get("/contractors/:id/verification-history", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const history = await storage.listContractorVerificationHistory(req.params.id);
    res.json(history);
  } catch (error) {
    console.error("Error fetching verification history:", error);
    res.status(500).json({ error: "Failed to fetch verification history" });
  }
});

staffRouter.post("/contractors/:id/verify", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { action, notes, certificationId, verificationType, verificationMethod } = req.body;
    if (!['VERIFIED', 'FAILED', 'PENDING', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'UNVERIFIED'].includes(action)) {
      return res.status(400).json({ error: "Invalid verification action" });
    }
    const historyEntry = await storage.createContractorVerificationHistory({
      contractorId: req.params.id,
      certificationId: certificationId || null,
      organisationId: orgInfo.organisationId,
      verificationType: verificationType || 'MANUAL_REVIEW',
      verificationMethod: verificationMethod || 'MANUAL',
      newStatus: action,
      verifiedById: orgInfo.userId,
      notes: notes || null,
    });
    if (certificationId) {
      await storage.updateContractorCertification(certificationId, {
        verificationStatus: action,
        verifiedAt: new Date(),
        verifiedById: orgInfo.userId,
      });
    }
    res.status(201).json(historyEntry);
  } catch (error) {
    console.error("Error creating verification:", error);
    res.status(500).json({ error: "Failed to create verification" });
  }
});

// ===== CONTRACTOR ALERTS =====
staffRouter.get("/contractor-alerts", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractorId = req.query.contractorId as string | undefined;
    const status = req.query.status as string | undefined;
    if (contractorId) {
      const contractor = await storage.getContractor(contractorId);
      if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
        return res.status(403).json({ error: "Access denied to contractor" });
      }
    }
    const alerts = await storage.listContractorAlerts(orgInfo.organisationId, { contractorId, status });
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching contractor alerts:", error);
    res.status(500).json({ error: "Failed to fetch contractor alerts" });
  }
});

staffRouter.patch("/contractor-alerts/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const alert = await storage.getContractorAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    if (alert.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = await storage.updateContractorAlert(req.params.id, {
      ...req.body,
      acknowledgedById: req.body.status === 'ACKNOWLEDGED' ? orgInfo.userId : alert.acknowledgedById,
      acknowledgedAt: req.body.status === 'ACKNOWLEDGED' ? new Date() : alert.acknowledgedAt,
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating contractor alert:", error);
    res.status(500).json({ error: "Failed to update contractor alert" });
  }
});

// ===== CONTRACTOR ASSIGNMENTS =====
staffRouter.get("/contractor-assignments", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractorId = req.query.contractorId as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as string | undefined;
    if (contractorId) {
      const contractor = await storage.getContractor(contractorId);
      if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
        return res.status(403).json({ error: "Access denied to contractor" });
      }
    }
    const assignments = await storage.listContractorAssignments(orgInfo.organisationId, { contractorId, propertyId, status });
    res.json(assignments);
  } catch (error) {
    console.error("Error fetching contractor assignments:", error);
    res.status(500).json({ error: "Failed to fetch contractor assignments" });
  }
});

staffRouter.post("/contractor-assignments", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const contractor = await storage.getContractor(req.body.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Invalid contractor or access denied" });
    }
    const property = await storage.getProperty(req.body.propertyId);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    const assignment = await storage.createContractorAssignment({
      ...req.body,
      organisationId: orgInfo.organisationId,
      assignedBy: orgInfo.userId,
    });
    res.status(201).json(assignment);
  } catch (error) {
    console.error("Error creating contractor assignment:", error);
    res.status(500).json({ error: "Failed to create contractor assignment" });
  }
});

staffRouter.patch("/contractor-assignments/:id", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const assignment = await storage.getContractorAssignment(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    if (assignment.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = await storage.updateContractorAssignment(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating contractor assignment:", error);
    res.status(500).json({ error: "Failed to update contractor assignment" });
  }
});

// ===== CONTRACTOR SLA PROFILES =====
staffRouter.get("/contractor-sla-profiles", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const profiles = await db.select()
      .from(contractorSLAProfiles)
      .where(eq(contractorSLAProfiles.organisationId, orgInfo.organisationId));
    res.json(profiles);
  } catch (error) {
    console.error("Error fetching SLA profiles:", error);
    res.status(500).json({ error: "Failed to fetch SLA profiles" });
  }
});

staffRouter.post("/contractor-sla-profiles", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const [profile] = await db.insert(contractorSLAProfiles)
      .values({
        ...req.body,
        organisationId: orgInfo.organisationId,
      })
      .returning();
    res.status(201).json(profile);
  } catch (error) {
    console.error("Error creating SLA profile:", error);
    res.status(500).json({ error: "Failed to create SLA profile" });
  }
});

// ===== CONTRACTOR JOB PERFORMANCE =====
staffRouter.get("/contractor-performance/:contractorId", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const contractor = await storage.getContractor(req.params.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const performance = await db.select()
      .from(contractorJobPerformance)
      .where(eq(contractorJobPerformance.contractorId, req.params.contractorId))
      .orderBy(desc(contractorJobPerformance.createdAt))
      .limit(50);
    
    const [stats] = await db.select({
      totalJobs: count(),
      slaMetCount: sql<number>`COUNT(*) FILTER (WHERE ${contractorJobPerformance.slaStatus} IN ('COMPLETED', 'ON_TRACK'))`,
      averageResponseTime: sql<number>`AVG(${contractorJobPerformance.responseTimeMinutes})`,
      averageCompletionTime: sql<number>`AVG(${contractorJobPerformance.completionTimeMinutes})`,
    })
    .from(contractorJobPerformance)
    .where(eq(contractorJobPerformance.contractorId, req.params.contractorId));
    
    const slaComplianceRate = stats.totalJobs > 0 
      ? Math.round((stats.slaMetCount / stats.totalJobs) * 100) 
      : 0;
    
    res.json({
      performance,
      summary: {
        totalJobs: stats.totalJobs,
        slaComplianceRate,
        averageResponseMinutes: Math.round(stats.averageResponseTime || 0),
        averageCompletionMinutes: Math.round(stats.averageCompletionTime || 0),
      }
    });
  } catch (error) {
    console.error("Error fetching contractor performance:", error);
    res.status(500).json({ error: "Failed to fetch contractor performance" });
  }
});

staffRouter.post("/contractor-performance", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const contractor = await storage.getContractor(req.body.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Invalid contractor or access denied" });
    }
    
    const [record] = await db.insert(contractorJobPerformance)
      .values(req.body)
      .returning();
    res.status(201).json(record);
  } catch (error) {
    console.error("Error creating performance record:", error);
    res.status(500).json({ error: "Failed to create performance record" });
  }
});

// ===== CONTRACTOR RATINGS =====
staffRouter.get("/contractor-ratings/:contractorId", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const contractor = await storage.getContractor(req.params.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const ratings = await db.select()
      .from(contractorRatings)
      .where(eq(contractorRatings.contractorId, req.params.contractorId))
      .orderBy(desc(contractorRatings.createdAt))
      .limit(50);
    
    const [stats] = await db.select({
      totalRatings: count(),
      averageOverall: sql<number>`AVG(${contractorRatings.overallRating})`,
      averageQuality: sql<number>`AVG(${contractorRatings.qualityRating})`,
      averageTimeliness: sql<number>`AVG(${contractorRatings.timelinessRating})`,
      averageCommunication: sql<number>`AVG(${contractorRatings.communicationRating})`,
      averageSafety: sql<number>`AVG(${contractorRatings.safetyRating})`,
    })
    .from(contractorRatings)
    .where(eq(contractorRatings.contractorId, req.params.contractorId));
    
    res.json({
      ratings,
      summary: {
        totalRatings: stats.totalRatings,
        averageOverall: Math.round((stats.averageOverall || 0) * 10) / 10,
        averageQuality: Math.round((stats.averageQuality || 0) * 10) / 10,
        averageTimeliness: Math.round((stats.averageTimeliness || 0) * 10) / 10,
        averageCommunication: Math.round((stats.averageCommunication || 0) * 10) / 10,
        averageSafety: Math.round((stats.averageSafety || 0) * 10) / 10,
      }
    });
  } catch (error) {
    console.error("Error fetching contractor ratings:", error);
    res.status(500).json({ error: "Failed to fetch contractor ratings" });
  }
});

staffRouter.post("/contractor-ratings", async (req: Request, res: Response) => {
  try {
    const orgInfo = await getSessionOrgId(req);
    if (!orgInfo) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const contractor = await storage.getContractor(req.body.contractorId);
    if (!contractor || contractor.organisationId !== orgInfo.organisationId) {
      return res.status(403).json({ error: "Invalid contractor or access denied" });
    }
    
    const [rating] = await db.insert(contractorRatings)
      .values({
        ...req.body,
        ratedById: orgInfo.userId,
      })
      .returning();
    res.status(201).json(rating);
  } catch (error) {
    console.error("Error creating contractor rating:", error);
    res.status(500).json({ error: "Failed to create contractor rating" });
  }
});
