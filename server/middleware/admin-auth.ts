import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";
import { logger } from "../logger";

export async function requireAdminRole(req: Request, res: Response): Promise<boolean> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (!session || !session.user) {
      res.status(401).json({ error: "Not authenticated" });
      return false;
    }
    
    const role = (session.user as { role?: string }).role;
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER'];
    
    if (!role || !adminRoles.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error({ error }, 'Admin role check failed');
    res.status(500).json({ error: "Authentication check failed" });
    return false;
  }
}

export async function requireSuperAdminRole(req: Request, res: Response): Promise<boolean> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (!session || !session.user) {
      res.status(401).json({ error: "Not authenticated" });
      return false;
    }
    
    const role = (session.user as { role?: string }).role;
    const superAdminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN'];
    
    if (!role || !superAdminRoles.includes(role)) {
      res.status(403).json({ error: "Super admin access required" });
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error({ error }, 'Super admin role check failed');
    res.status(500).json({ error: "Authentication check failed" });
    return false;
  }
}

export function adminAuthMiddleware(allowedRoles: string[] = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER']) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      
      if (!session || !session.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const role = (session.user as { role?: string }).role;
      
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      (req as unknown as { user: typeof session.user }).user = session.user;
      next();
    } catch (error) {
      logger.error({ error }, 'Admin auth middleware failed');
      res.status(500).json({ error: "Authentication check failed" });
    }
  };
}

export function requireAdminAuth(allowedRoles: string[] = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER']) {
  return adminAuthMiddleware(allowedRoles);
}
