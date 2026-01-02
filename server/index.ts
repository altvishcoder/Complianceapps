import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { initJobQueue, stopJobQueue } from "./job-queue";
import { httpLogger, logger } from "./logger";
import { initSentry, setupSentryErrorHandler } from "./sentry";
import { setupSession } from "./session";
import { startLogRotationScheduler } from "./services/log-rotation";
import { createGlobalRateLimiter, seedApiLimitSettings } from "./services/api-limits";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Setup session middleware (must be before routes)
setupSession(app);

// Apply global rate limiting to API routes only (not static assets)
app.use('/api', createGlobalRateLimiter());

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

app.use(httpLogger);

(async () => {
  // Initialize Sentry first (must be before Express routes)
  initSentry(app);
  
  // Seed database with initial data
  await seedDatabase();
  
  // Seed API limit settings
  await seedApiLimitSettings();
  
  // Initialize pg-boss job queue
  try {
    await initJobQueue();
    log("pg-boss job queue initialized", "pg-boss");
  } catch (error) {
    log(`Failed to initialize pg-boss: ${error}`, "pg-boss");
  }
  
  // Start log rotation scheduler
  startLogRotationScheduler();
  
  await registerRoutes(httpServer, app);

  // Sentry error handler must be after routes but before other error handlers
  setupSentryErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status }, "Unhandled error");
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
