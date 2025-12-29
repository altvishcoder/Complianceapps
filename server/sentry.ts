import * as Sentry from "@sentry/node";
import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry(app: Express): void {
  if (!SENTRY_DSN) {
    logger.info("Sentry DSN not configured, skipping error tracking setup");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.npm_package_version || "1.0.0",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    integrations: [
      Sentry.expressIntegration({ app }),
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["x-api-key"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  logger.info({ dsn: SENTRY_DSN.substring(0, 20) + "..." }, "Sentry initialized with Express integration");
}

export function setupSentryErrorHandler(app: Express): void {
  if (!SENTRY_DSN) {
    return;
  }
  Sentry.setupExpressErrorHandler(app);
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) {
    logger.error({ error, ...context }, "Error captured (Sentry not configured)");
    return;
  }
  
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!SENTRY_DSN) {
    logger.info({ message }, "Message captured (Sentry not configured)");
    return;
  }
  
  Sentry.captureMessage(message, level);
}
