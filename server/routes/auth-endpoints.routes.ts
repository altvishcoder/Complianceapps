import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { toNodeHandler } from "better-auth/node";
import { 
  validatePassword, 
  getPasswordPolicyDescription 
} from "../services/password-policy";

export const authEndpointsRouter = Router();

authEndpointsRouter.post("/auth/change-password", async (req: Request, res: Response) => {
  try {
    const { userId, currentPassword, newPassword, requestingUserId } = req.body;
    
    if (!userId || !newPassword || !requestingUserId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const [requestingUser] = await db.select().from(users).where(eq(users.id, requestingUserId));
    if (!requestingUser) {
      return res.status(404).json({ error: "Requesting user not found" });
    }
    
    if (targetUser.role === 'LASHAN_SUPER_USER') {
      if (requestingUser.id !== targetUser.id) {
        return res.status(403).json({ error: "Only Lashan can change this password" });
      }
    }
    
    if (userId === requestingUserId) {
      if (!currentPassword) {
        return res.status(401).json({ error: "Current password is required" });
      }
      if (!targetUser.password) {
        return res.status(401).json({ error: "User has no password set" });
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, targetUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }
    
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: "Password does not meet security requirements",
        requirements: passwordValidation.errors
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

authEndpointsRouter.get("/auth/password-policy", (req: Request, res: Response) => {
  res.json({
    requirements: getPasswordPolicyDescription(),
  });
});

authEndpointsRouter.all("/auth/*", toNodeHandler(auth));
