import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { v4 as uuidv4 } from "uuid";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { initJobQueue, stopJobQueue } from "./job-queue";
import { httpLogger, logger } from "./logger";
import { initSentry, setupSentryErrorHandler } from "./sentry";
import { startLogRotationScheduler } from "./services/log-rotation";
import { createGlobalRateLimiter, seedApiLimitSettings } from "./services/api-limits";
import { loadSecurityConfig, loadCompressionConfig } from "./services/middleware-config";

const app = express();
const httpServer = createServer(app);

const isDevelopment = process.env.NODE_ENV !== 'production';

// Trust proxy for proper rate limiting behind Replit's load balancer
app.set('trust proxy', 1);

// Correlation ID middleware for request tracing
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

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
  
  // Load security and compression config from Factory Settings
  const [securityConfig, compressionConfig] = await Promise.all([
    loadSecurityConfig(),
    loadCompressionConfig(),
  ]);
  
  // Apply helmet security headers - strict in production, relaxed in development
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : (securityConfig.cspEnabled ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com"],
        styleSrc: ["'self'", "https://unpkg.com", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false),
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity: {
      maxAge: securityConfig.hstsMaxAge,
      includeSubDomains: securityConfig.hstsIncludeSubdomains,
      preload: securityConfig.hstsPreload,
    },
    xXssProtection: securityConfig.xssProtection,
  }));
  
  // Apply response compression with configurable threshold
  app.use(compression({
    threshold: compressionConfig.threshold,
    level: compressionConfig.level,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
  
  logger.info({ securityConfig, compressionConfig }, 'Middleware configured from Factory Settings');
  
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
