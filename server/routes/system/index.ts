import { Router } from "express";
import { systemHealthRouter } from "./health";
import { systemOperationsRouter } from "./operations";
import { systemCacheRouter } from "./cache";
import { systemComplianceRouter } from "./compliance";

export const systemRouter = Router();

systemRouter.use(systemHealthRouter);
systemRouter.use(systemOperationsRouter);
systemRouter.use(systemCacheRouter);
systemRouter.use(systemComplianceRouter);

export { systemHealthRouter } from "./health";
export { systemOperationsRouter } from "./operations";
export { systemCacheRouter } from "./cache";
export { systemComplianceRouter } from "./compliance";
export { getOrgId, requireAdminRole, ADMIN_ROLES, SUPER_ADMIN_ROLES, ORG_ID } from "./utils";
