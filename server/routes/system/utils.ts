import { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../session";
import { auth } from "../../auth";
import { fromNodeHeaders } from "better-auth/node";
import { storage } from "../../storage";

export const ORG_ID = "default-org";

export function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

export const ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
export const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];

export async function requireAdminRole(req: Request, res: Response): Promise<boolean> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const user = await storage.getUser(session.user.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return false;
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return false;
  }
  return true;
}
