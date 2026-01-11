import { Router, Response } from "express";
import { requireRole, type AuthenticatedRequest } from "../../session";
import { storage } from "../../storage";
import { db } from "../../db";
import { users, factorySettings, factorySettingsAudit, userFavorites } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { validatePassword } from "../../services/password-policy";
import { clearApiLimitsCache } from "../../services/api-limits";
import { clearTierThresholdsCache } from "../../services/risk-scoring";
import { auth } from "../../auth";
import { fromNodeHeaders } from "better-auth/node";
import { SUPER_ADMIN_ROLES, ADMIN_ROLES, getOrgId } from "./utils";

export const adminUsersRouter = Router();

adminUsersRouter.get("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const allUsers = await storage.listUsers(orgId);
    const safeUsers = allUsers.map(({ password, ...user }) => user);
    res.json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminUsersRouter.post("/users", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
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
      username: username || email,
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      role: role || 'VIEWER',
      organisationId: orgId,
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

adminUsersRouter.patch("/users/:id", requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

adminUsersRouter.patch("/users/:id/role", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, requesterId } = req.body;
    if (!role || !requesterId) {
      return res.status(400).json({ error: "Role and requesterId are required" });
    }
    
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    
    const updatedUser = await storage.updateUserRole(req.params.id, role, requesterId);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { password, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (error: any) {
    console.error("Error updating user role:", error);
    res.status(400).json({ error: error.message || "Failed to update user role" });
  }
});

adminUsersRouter.delete("/users/:id", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
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

adminUsersRouter.get("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const favorites = await db
      .select({ navigationItemId: userFavorites.navigationItemId })
      .from(userFavorites)
      .where(eq(userFavorites.userId, session.user.id));
    
    res.json({ favorites: favorites.map(f => f.navigationItemId) });
  } catch (error) {
    console.error("Error fetching user favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

adminUsersRouter.post("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { navigationItemId } = req.body;
    if (!navigationItemId) {
      return res.status(400).json({ error: "navigationItemId is required" });
    }
    
    const existing = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, session.user.id),
        eq(userFavorites.navigationItemId, navigationItemId)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(userFavorites).values({
        userId: session.user.id,
        navigationItemId,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

adminUsersRouter.delete("/user/favorites", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { navigationItemId } = req.body;
    if (!navigationItemId) {
      return res.status(400).json({ error: "navigationItemId is required" });
    }
    
    await db
      .delete(userFavorites)
      .where(and(
        eq(userFavorites.userId, session.user.id),
        eq(userFavorites.navigationItemId, navigationItemId)
      ));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

adminUsersRouter.get("/factory-settings", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await db.select().from(factorySettings);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching factory settings:", error);
    res.status(500).json({ error: "Failed to fetch factory settings" });
  }
});

adminUsersRouter.patch("/factory-settings/:key", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
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
      settingId: existing.id,
      key: key,
      oldValue: existing.value,
      newValue: value,
      changedById: req.user?.id || 'system',
    });
    
    clearApiLimitsCache();
    clearTierThresholdsCache();
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating factory setting:", error);
    res.status(500).json({ error: "Failed to update factory setting" });
  }
});

adminUsersRouter.get("/factory-settings/audit", requireRole('LASHAN_SUPER_USER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audit = await db.select().from(factorySettingsAudit).orderBy(factorySettingsAudit.changedAt);
    res.json(audit);
  } catch (error) {
    console.error("Error fetching factory settings audit:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});
