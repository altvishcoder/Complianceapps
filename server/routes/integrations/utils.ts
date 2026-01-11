import { Request, Response } from "express";
import { storage } from "../../storage";
import { auth } from "../../auth";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthenticatedRequest } from "../../session";

export const ORG_ID = "default-org";

export const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];

export function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyApiKey(providedKey: string, storedHash: string): Promise<boolean> {
  const providedHash = await hashApiKey(providedKey);
  return providedHash === storedHash;
}

export const requireAdminRole = async (req: Request, res: Response): Promise<boolean> => {
  const adminToken = process.env.ADMIN_API_TOKEN;
  const providedToken = req.headers['x-admin-token'] as string;
  
  if (adminToken && adminToken !== providedToken) {
    res.status(401).json({ error: "Invalid or missing admin token" });
    return false;
  }
  
  let userId: string | null = null;
  
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    userId = session?.user?.id || null;
  } catch (error) {
    console.error('BetterAuth session error in requireAdminRole:', error);
  }
  
  if (!userId) {
    res.status(401).json({ error: "Session authentication required for admin operations" });
    return false;
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    res.status(401).json({ error: "Invalid user" });
    return false;
  }
  
  const allowedRoles = ['SUPER_ADMIN', 'super_admin', 'LASHAN_SUPER_USER', 'lashan_super_user'];
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: "Access denied. Only Super Admins or Lashan Super Users can access factory settings." });
    return false;
  }
  
  return true;
};

export const parseIntWithDefault = (value: string, defaultVal: number): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultVal : parsed;
};
