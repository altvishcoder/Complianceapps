import { Router } from "express";
import { adminDemoDataRouter } from "./demo-data";
import { adminBulkSeedRouter } from "./bulk-seed";
import { adminUsersRouter } from "./users";
import { adminDbOptimizationRouter } from "./db-optimization";
import { adminCloudConfigRouter } from "./cloud-config";

export const adminRouter = Router();

adminRouter.use(adminDemoDataRouter);
adminRouter.use(adminBulkSeedRouter);
adminRouter.use(adminUsersRouter);
adminRouter.use(adminDbOptimizationRouter);
adminRouter.use(adminCloudConfigRouter);

export { adminDemoDataRouter } from "./demo-data";
export { adminBulkSeedRouter } from "./bulk-seed";
export { adminUsersRouter } from "./users";
export { adminDbOptimizationRouter } from "./db-optimization";
export { adminCloudConfigRouter } from "./cloud-config";
export * from "./utils";
