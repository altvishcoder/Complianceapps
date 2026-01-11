import { Router } from "express";
import { integrationsMonitoringRouter } from "./monitoring";
import { integrationsOutboundRouter } from "./outbound";
import { integrationsInboundRouter } from "./inbound";

export const integrationsRouter = Router();

integrationsRouter.use(integrationsMonitoringRouter);
integrationsRouter.use(integrationsOutboundRouter);
integrationsRouter.use(integrationsInboundRouter);

export { integrationsMonitoringRouter } from "./monitoring";
export { integrationsOutboundRouter } from "./outbound";
export { integrationsInboundRouter } from "./inbound";
export * from "./utils";
