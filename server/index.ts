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

// Immediate startup logging
console.log(`[${new Date().toISOString()}] Starting server...`);
console.log(`[${new Date().toISOString()}] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[${new Date().toISOString()}] DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);

const app = express();
const httpServer = createServer(app);

const isDevelopment = process.env.NODE_ENV !== 'production';

// Track initialization state
let isInitialized = false;

// Trust proxy for proper rate limiting behind Replit's load balancer
app.set('trust proxy', 1);

// Health check endpoint - MUST respond immediately for deployment health checks
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    initialized: isInitialized,
    timestamp: new Date().toISOString()
  });
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

(async () => {
  try {
    // Initialize Sentry first (must be before Express routes)
    initSentry(app);
    
    // Register routes BEFORE starting server
    await registerRoutes(httpServer, app);

    // Sentry error handler must be after routes but before other error handlers
    setupSentryErrorHandler(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      logger.error({ err, status }, "Unhandled error");
      res.status(status).json({ message });
    });

    // Setup static serving or Vite
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    const port = parseInt(process.env.PORT || "5000", 10);
    
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        console.log(`[${new Date().toISOString()}] Server listening on port ${port}`);
        log(`serving on port ${port}`);
        
        // Start background initialization AFTER server is listening
        initializeApp().catch(err => {
          console.error(`[${new Date().toISOString()}] Background initialization failed:`, err);
        });
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
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to start server:`, error);
    process.exit(1);
  }
})();
