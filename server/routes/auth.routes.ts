import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "../services/audit";
import { 
  validatePassword, 
  checkLoginLockout, 
  recordFailedLogin, 
  clearLoginAttempts,
  getPasswordPolicyDescription 
} from "../services/password-policy";
import { getConfiguredProviders } from "../auth";

export const authRouter = Router();

const PROVIDER_DISPLAY_INFO: Record<string, { name: string; icon: string }> = {
  "microsoft-entra": { name: "Microsoft", icon: "microsoft" },
  "google": { name: "Google", icon: "google" },
  "okta": { name: "Okta", icon: "okta" },
  "keycloak": { name: "Keycloak", icon: "keycloak" },
  "generic-oidc": { name: "SSO", icon: "key" },
};

authRouter.get("/providers", (_req: Request, res: Response) => {
  const providers = getConfiguredProviders();
  const providerInfo = providers.map(id => ({
    id,
    ...PROVIDER_DISPLAY_INFO[id] || { name: id, icon: "key" },
    authUrl: `/api/auth/oauth/${id}/authorize`,
  }));
  
  res.json({ 
    providers: providerInfo,
    emailPasswordEnabled: true,
  });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    const lockoutCheck = await checkLoginLockout(username);
    if (lockoutCheck.isLocked) {
      return res.status(429).json({ 
        error: `Account temporarily locked due to too many failed attempts. Try again in ${lockoutCheck.remainingMinutes} minute(s).`,
        lockedUntil: lockoutCheck.remainingMinutes
      });
    }
    
    const [user] = await db.select().from(users).where(eq(users.username, username));
    
    if (!user) {
      await recordFailedLogin(username);
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    if (!user.password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const lockoutResult = await recordFailedLogin(username);
      if (lockoutResult.isLocked) {
        return res.status(429).json({ 
          error: `Account locked due to too many failed attempts. Try again in ${lockoutResult.remainingMinutes} minute(s).`,
          lockedUntil: lockoutResult.remainingMinutes
        });
      }
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    await clearLoginAttempts(username);
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.organisationId = user.organisationId;
    
    await recordAudit({
      organisationId: user.organisationId,
      eventType: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.name || user.username,
      message: `User ${user.username} logged in`,
      context: {
        actorId: user.id,
        actorName: user.name || user.username,
        actorType: 'USER',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      },
    });
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to process login" });
  }
});

authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;
    const organisationId = req.session?.organisationId;
    
    if (userId && organisationId) {
      await recordAudit({
        organisationId,
        eventType: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: userId,
        entityName: username || 'Unknown',
        message: `User ${username} logged out`,
        context: {
          actorId: userId,
          actorName: username || 'Unknown',
          actorType: 'USER',
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
          userAgent: req.headers['user-agent'] as string,
        },
      });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to process logout" });
  }
});

authRouter.get("/me", async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      }
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

authRouter.post("/change-password", async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (!user.password) {
      return res.status(401).json({ error: "Cannot change password for SSO accounts" });
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: "New password does not meet requirements",
        details: passwordValidation.errors
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
    
    await recordAudit({
      organisationId: user.organisationId,
      eventType: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      entityName: user.name || user.username,
      message: `User ${user.username} changed their password`,
      context: {
        actorId: user.id,
        actorName: user.name || user.username,
        actorType: 'USER',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      },
    });
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

authRouter.get("/password-policy", (_req: Request, res: Response) => {
  res.json({
    description: getPasswordPolicyDescription(),
    rules: [
      "Minimum 8 characters",
      "At least one uppercase letter",
      "At least one lowercase letter", 
      "At least one number",
      "At least one special character (!@#$%^&*)"
    ]
  });
});
