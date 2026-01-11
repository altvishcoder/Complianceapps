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
import { isDatabaseAvailable, pool } from "./db";

// Immediate startup logging
console.log(`[${new Date().toISOString()}] Starting server...`);
console.log(`[${new Date().toISOString()}] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[${new Date().toISOString()}] DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
console.log(`[${new Date().toISOString()}] PORT: ${process.env.PORT || '5000'}`);
console.log(`[${new Date().toISOString()}] Imports completed, setting up server...`);

// P0 SECURITY: Validate auth secrets in production
const isProduction = process.env.NODE_ENV === 'production';
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET;
const INSECURE_DEFAULT = 'development-only-secret-change-in-production';

if (isProduction) {
  if (!authSecret || authSecret === INSECURE_DEFAULT) {
    console.error(`[${new Date().toISOString()}] CRITICAL SECURITY ERROR:`);
    console.error(`  BETTER_AUTH_SECRET or SESSION_SECRET must be set in production.`);
    console.error(`  Generate a secure random secret (minimum 32 characters).`);
    console.error(`  Example: openssl rand -base64 32`);
    console.error(`  Set it in your environment: BETTER_AUTH_SECRET=your-secure-secret`);
    process.exit(1);
  }
  console.log(`[${new Date().toISOString()}] Auth secrets: validated`);
} else {
  if (!authSecret || authSecret === INSECURE_DEFAULT) {
    console.warn(`[${new Date().toISOString()}] WARNING: Using insecure default auth secret (development only)`);
  } else {
    console.log(`[${new Date().toISOString()}] Auth secrets: configured`);
  }
}

const app = express();
const httpServer = createServer(app);

const isDevelopment = process.env.NODE_ENV !== 'production';

// Track initialization state
let isInitialized = false;
let frontendReady = false;

// Trust proxy for proper rate limiting behind Replit's load balancer
app.set('trust proxy', 1);

// Health check endpoint - MUST respond immediately for deployment health checks
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    initialized: isInitialized,
    database: isDatabaseAvailable() ? 'available' : 'unavailable',
    timestamp: new Date().toISOString()
  });
});

// Kubernetes/Load Balancer readiness check endpoint - unauthenticated for external health checks
app.get('/api/ready', async (_req: Request, res: Response) => {
  const CHECK_TIMEOUT_MS = 5000;
  
  interface ReadinessCheck {
    status: "ok" | "error" | "skipped";
    latencyMs?: number;
    error?: string;
  }
  
  const withTimeout = <T>(operation: () => Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      operation()
        .then((result) => { clearTimeout(timer); resolve(result); })
        .catch((error) => { clearTimeout(timer); reject(error); });
    });
  };
  
  const checkDatabase = async (): Promise<ReadinessCheck> => {
    const start = Date.now();
    try {
      if (!isDatabaseAvailable()) {
        return { status: "error", error: "Database not configured" };
      }
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await withTimeout(
        () => db.execute(sql`SELECT 1`),
        CHECK_TIMEOUT_MS,
        "Database check timed out"
      );
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", latencyMs: Date.now() - start, error: message };
    }
  };
  
  const checkJobQueue = async (): Promise<ReadinessCheck> => {
    const start = Date.now();
    try {
      const { getJobQueue, getQueueStats } = await import("./job-queue");
      const boss = getJobQueue();
      if (!boss) {
        return { status: "skipped", error: "Job queue not initialized" };
      }
      await withTimeout(
        async () => getQueueStats(),
        CHECK_TIMEOUT_MS,
        "Job queue check timed out"
      );
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", latencyMs: Date.now() - start, error: message };
    }
  };
  
  const checkStorage = async (): Promise<ReadinessCheck> => {
    const start = Date.now();
    try {
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
      
      if (!privateDir && !publicPaths) {
        return { status: "skipped", error: "Object storage not configured" };
      }
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", latencyMs: Date.now() - start, error: message };
    }
  };
  
  const checkAIProviders = async (): Promise<ReadinessCheck> => {
    const start = Date.now();
    try {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      const azureKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
      
      if (!anthropicKey && !openaiKey && !azureKey) {
        return { status: "skipped", error: "No AI providers configured" };
      }
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", latencyMs: Date.now() - start, error: message };
    }
  };
  
  try {
    const [database, jobQueue, storage, ai] = await Promise.all([
      checkDatabase(),
      checkJobQueue(),
      checkStorage(),
      checkAIProviders(),
    ]);
    
    const checks = { database, jobQueue, storage, ai };
    const failed: string[] = [];
    
    if (database.status === "error") failed.push("database");
    if (jobQueue.status === "error") failed.push("jobQueue");
    if (storage.status === "error") failed.push("storage");
    
    const ready = failed.length === 0;
    const { APP_VERSION } = await import("@shared/version");
    
    const response: {
      ready: boolean;
      timestamp: string;
      version: string;
      checks: typeof checks;
      failed?: string[];
    } = {
      ready,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      checks,
    };
    
    if (!ready) {
      response.failed = failed;
    }
    
    res.status(ready ? 200 : 503).json(response);
  } catch (error) {
    console.error("Readiness check failed:", error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      version: "unknown",
      checks: {
        database: { status: "error", error: "Check failed" },
        jobQueue: { status: "error", error: "Check failed" },
        storage: { status: "error", error: "Check failed" },
      },
      failed: ["database", "jobQueue", "storage"],
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

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

// Middleware to handle frontend routes before Vite/static is ready
app.use((req: Request, res: Response, next: NextFunction) => {
  // Let API routes, health check, and static assets through
  if (req.path.startsWith('/api/') || 
      req.path === '/health' || 
      req.path.startsWith('/src/') ||
      req.path.startsWith('/@') ||
      req.path.startsWith('/node_modules/') ||
      req.path.includes('.')) {
    return next();
  }
  
  // If frontend is ready, proceed normally
  if (frontendReady) {
    return next();
  }
  
  // Return a loading page for frontend routes while initializing
  res.status(200).set({ 'Content-Type': 'text/html' }).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SocialComply - Loading</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background: #0f172a; 
            color: #e2e8f0;
          }
          .loader { text-align: center; }
          .spinner { 
            width: 40px; 
            height: 40px; 
            border: 3px solid #334155; 
            border-top: 3px solid #3b82f6; 
            border-radius: 50%; 
            animation: spin 1s linear infinite; 
            margin: 0 auto 16px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          p { margin: 0; opacity: 0.8; }
          .refresh { margin-top: 16px; font-size: 12px; opacity: 0.5; }
        </style>
        <script>setTimeout(() => location.reload(), 2000);</script>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <p>Starting up...</p>
          <p class="refresh">Refreshing automatically...</p>
        </div>
      </body>
    </html>
  `);
});

// API versioning middleware - rewrites /api/v1/* to /api/* and adds version headers
app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-API-Version', 'v1');
  req.url = req.url; // Keep the URL as-is, route handlers will match both patterns
  next('route'); // Skip to next route handler
});

// Rewrite /api/v1/* requests to /api/* for backward compatibility with existing handlers
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/v1/')) {
    req.url = req.url.replace('/api/v1/', '/api/');
    res.setHeader('X-API-Version', 'v1');
  } else if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
    res.setHeader('X-API-Deprecation-Warning', 'Unversioned API endpoints are deprecated. Use /api/v1/ prefix.');
  }
  next();
});

// Apply global rate limiting to API routes only (not static assets)
app.use('/api', createGlobalRateLimiter());

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

app.use(httpLogger);

// Background initialization function (runs after server starts)
async function initializeApp() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting app initialization...`);
  
  try {
    // Seed database with initial data
    console.log(`[${new Date().toISOString()}] Seeding database...`);
    await seedDatabase();
    console.log(`[${new Date().toISOString()}] Database seeded in ${Date.now() - startTime}ms`);
    
    // Note: Database optimizations (indexes, materialized views) are managed via migrations
    // Use the DB Optimization admin page to manually apply/refresh when needed
    
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
      console.error(`[${new Date().toISOString()}] Failed to initialize pg-boss:`, error);
    }
    
    // Start log rotation scheduler
    startLogRotationScheduler();
    
    isInitialized = true;
    console.log(`[${new Date().toISOString()}] App fully initialized in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Initialization error:`, error);
    // Don't crash - server is already running and can serve health checks
  }
}

// Start server IMMEDIATELY - no async operations before listen
const port = parseInt(process.env.PORT || "5000", 10);

// Initialize Sentry (sync operation)
initSentry(app);

// Note: RFC 7807 error handler is registered after routes in the async init block
// This fallback catches errors before routes are fully registered
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  logger.error({ err, status }, "Unhandled error");
  res.status(status).json({ 
    type: 'https://api.socialcomply.io/errors/internal-error',
    title: 'Internal Server Error',
    status,
    detail: message,
    timestamp: new Date().toISOString()
  });
});

// Start listening IMMEDIATELY
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    console.log(`[${new Date().toISOString()}] Server listening on port ${port}`);
    log(`serving on port ${port}`);
    
    // Now do all async initialization AFTER server is listening
    (async () => {
      try {
        console.log(`[${new Date().toISOString()}] Starting async initialization...`);
        
        // Register routes (includes database operations)
        await registerRoutes(httpServer, app);
        console.log(`[${new Date().toISOString()}] Routes registered`);

        // Sentry error handler must be after routes
        setupSentryErrorHandler(app);

        // Setup static serving or Vite
        if (process.env.NODE_ENV === "production") {
          serveStatic(app);
          console.log(`[${new Date().toISOString()}] Static files configured`);
        } else {
          const { setupVite } = await import("./vite");
          await setupVite(httpServer, app);
          console.log(`[${new Date().toISOString()}] Vite configured`);
        }
        
        // Mark frontend as ready - stops showing loading page
        frontendReady = true;
        console.log(`[${new Date().toISOString()}] Frontend ready`);
        
        // Background initialization (seeding, job queue, etc.)
        await initializeApp();
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Async initialization failed:`, error);
        // Don't exit - server is already running for health checks
      }
    })();
  },
);

// Handle server errors
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`[${new Date().toISOString()}] Server error:`, error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown handling
let isShuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 30000;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[${new Date().toISOString()}] Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`[${new Date().toISOString()}] Received ${signal}, starting graceful shutdown...`);

  // Set a forced exit timeout
  const forceExitTimeout = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Step 1: Stop accepting new HTTP requests
    console.log(`[${new Date().toISOString()}] Stopping HTTP server (no new connections)...`);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          console.error(`[${new Date().toISOString()}] Error closing HTTP server:`, err);
          reject(err);
        } else {
          console.log(`[${new Date().toISOString()}] HTTP server closed, all in-flight requests completed`);
          resolve();
        }
      });
    });

    // Step 2: Stop the pg-boss job queue
    console.log(`[${new Date().toISOString()}] Stopping job queue...`);
    try {
      await stopJobQueue();
      console.log(`[${new Date().toISOString()}] Job queue stopped`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error stopping job queue:`, err);
    }

    // Step 3: Close the database connection pool
    console.log(`[${new Date().toISOString()}] Closing database connection pool...`);
    try {
      if (pool) {
        await pool.end();
        console.log(`[${new Date().toISOString()}] Database connection pool closed`);
      } else {
        console.log(`[${new Date().toISOString()}] No database pool to close`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error closing database pool:`, err);
    }

    clearTimeout(forceExitTimeout);
    console.log(`[${new Date().toISOString()}] Graceful shutdown completed successfully`);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimeout);
    console.error(`[${new Date().toISOString()}] Error during graceful shutdown:`, error);
    process.exit(1);
  }
}

// Handle SIGTERM (from orchestrators like Kubernetes, Docker, systemd)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// Handle SIGINT (Ctrl+C in terminal)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});
