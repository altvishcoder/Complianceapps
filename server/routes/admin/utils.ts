import type { AuthenticatedRequest } from "../../session";

export const SUPER_ADMIN_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
export const ADMIN_ROLES = [...SUPER_ADMIN_ROLES, 'COMPLIANCE_MANAGER', 'ADMIN'];
export const ADMIN_AND_ABOVE_ROLES = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER'];

export function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || "org-001";
}
