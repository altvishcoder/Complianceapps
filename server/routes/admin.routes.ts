import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireRole, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { users, factorySettings, factorySettingsAudit } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { recordAudit, extractAuditContext, getChanges } from "../services/audit";
import { validatePassword } from "../services/password-policy";
import { clearApiLimitsCache } from "../services/api-limits";
import { clearTierThresholdsCache } from "../services/risk-scoring";

export const adminRouter = Router();

const ORG_ID = "org-001";
const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
const ADMIN_ROLES = [...SUPER_ADMIN_ROLES, 'COMPLIANCE_MANAGER', 'ADMIN'];

// ===== ADMIN / DEMO DATA MANAGEMENT =====
adminRouter.post("/wipe-data", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeProperties } = req.body || {};
    await storage.wipeData(includeProperties === true);
    res.json({ success: true, message: includeProperties ? "All data wiped including properties" : "Certificates and actions wiped" });
  } catch (error) {
    console.error("Error wiping data:", error);
    res.status(500).json({ error: "Failed to wipe data" });
  }
});

adminRouter.post("/seed-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await storage.seedDemoData(ORG_ID);
    res.json({ success: true, message: "Demo data seeded successfully" });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

adminRouter.post("/reset-demo", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await storage.wipeData(true);
    await storage.seedDemoData(ORG_ID);
    res.json({ success: true, message: "Demo reset complete" });
  } catch (error) {
    console.error("Error resetting demo:", error);
    res.status(500).json({ error: "Failed to reset demo" });
  }
});

// ===== USER MANAGEMENT =====
adminRouter.get("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      organisationId: users.organisationId,
      createdAt: users.createdAt,
    }).from(users);
    res.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.post("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, name, password, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: "Password does not meet requirements",
        details: passwordValidation.errors
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [newUser] = await db.insert(users).values({
      username,
      email,
      name: name || username,
      password: hashedPassword,
      role: role || 'VIEWER',
      organisationId: ORG_ID,
      isActive: true,
    }).returning();
    
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

adminRouter.patch("/users/:id", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, ...updates } = req.body;
    
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet requirements",
          details: passwordValidation.errors
        });
      }
      updates.password = await bcrypt.hash(password, 12);
    }
    
    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, req.params.id))
      .returning();
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

adminRouter.delete("/users/:id", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [deletedUser] = await db.delete(users)
      .where(eq(users.id, req.params.id))
      .returning();
    
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ===== FACTORY SETTINGS =====
adminRouter.get("/factory-settings", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await db.select().from(factorySettings);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching factory settings:", error);
    res.status(500).json({ error: "Failed to fetch factory settings" });
  }
});

adminRouter.patch("/factory-settings/:key", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { value } = req.body;
    const key = req.params.key;
    
    const [existing] = await db.select().from(factorySettings).where(eq(factorySettings.key, key));
    
    if (!existing) {
      return res.status(404).json({ error: "Setting not found" });
    }
    
    const [updated] = await db.update(factorySettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(factorySettings.key, key))
      .returning();
    
    await db.insert(factorySettingsAudit).values({
      settingKey: key,
      previousValue: existing.value,
      newValue: value,
      changedBy: (req as any).user?.id || 'system',
    });
    
    clearApiLimitsCache();
    clearTierThresholdsCache();
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating factory setting:", error);
    res.status(500).json({ error: "Failed to update factory setting" });
  }
});

adminRouter.get("/factory-settings/audit", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audit = await db.select().from(factorySettingsAudit).orderBy(factorySettingsAudit.changedAt);
    res.json(audit);
  } catch (error) {
    console.error("Error fetching factory settings audit:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});
