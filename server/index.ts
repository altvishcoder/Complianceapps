// FIRST LINE - Log before ANY imports to diagnose production startup issues
console.log(`[${new Date().toISOString()}] SERVER STARTING - before imports`);

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";

console.log(`[${new Date().toISOString()}] Core imports done, creating server...`);

const app = express();
const httpServer = createServer(app);
const port = parseInt(process.env.PORT || "5000", 10);
const isDevelopment = process.env.NODE_ENV !== 'production';

// Track initialization state
let isInitialized = false;

// Trust proxy for proper rate limiting behind Replit's load balancer
app.set('trust proxy', 1);

// Health check endpoint - MUST respond immediately for deployment health checks
// This is registered BEFORE any other middleware to ensure instant response
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    initialized: isInitialized,
    timestamp: new Date().toISOString()
  });
});

console.log(`[${new Date().toISOString()}] Health check registered, starting listen...`);

// Start listening IMMEDIATELY - no async operations before this
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    console.log(`[${new Date().toISOString()}] Server listening on port ${port}`);
    
    // Now load all modules and initialize in background
    initializeFullServer().catch(err => {
      console.error(`[${new Date().toISOString()}] Full initialization failed:`, err);
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

// Graceful shutdown
async function shutdown() {
  console.log(`[${new Date().toISOString()}] Shutting down...`);
  try {
    const { stopJobQueue } = await import("./job-queue");
    await stopJobQueue();
  } catch (e) {
    // Ignore - job queue may not be initialized
  }
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Full server initialization - runs AFTER server is listening
async function initializeFullServer() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Loading modules...`);
  console.log(`[${new Date().toISOString()}] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[${new Date().toISOString()}] DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
  
  try {
    // Dynamically import all modules
    const [
      { registerRoutes },
      { serveStatic },
      { seedDatabase },
      { initJobQueue },
      { httpLogger, logger },
      { initSentry, setupSentryErrorHandler },
      { startLogRotationScheduler },
      { createGlobalRateLimiter, seedApiLimitSettings },
      { loadSecurityConfig, loadCompressionConfig },
      helmet,
      compression,
    ] = await Promise.all([
      import("./routes"),
      import("./static"),
      import("./seed"),
      import("./job-queue"),
      import("./logger"),
      import("./sentry"),
      import("./services/log-rotation"),
      import("./services/api-limits"),
      import("./services/middleware-config"),
      import("helmet"),
      import("compression"),
    ]);
    
    console.log(`[${new Date().toISOString()}] Modules loaded in ${Date.now() - startTime}ms`);
    
    // Initialize Sentry
    initSentry(app);
    
    // Correlation ID middleware for request tracing
    app.use((req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
      req.headers['x-correlation-id'] = correlationId;
      res.setHeader('x-correlation-id', correlationId);
      next();
    });
    
    app.use(
      express.json({
        limit: '50mb',
        verify: (req, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );
    
    app.use(express.urlencoded({ extended: false, limit: '50mb' }));
    
    // API versioning middleware
    app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-API-Version', 'v1');
      next('route');
    });
    
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/v1/')) {
        req.url = req.url.replace('/api/v1/', '/api/');
        res.setHeader('X-API-Version', 'v1');
      } else if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
        res.setHeader('X-API-Deprecation-Warning', 'Unversioned API endpoints are deprecated. Use /api/v1/ prefix.');
      }
      next();
    });
    
    // Apply global rate limiting to API routes
    app.use('/api', createGlobalRateLimiter());
    
    // HTTP request logging
    app.use(httpLogger);
    
    // Register routes
    console.log(`[${new Date().toISOString()}] Registering routes...`);
    await registerRoutes(httpServer, app);
    console.log(`[${new Date().toISOString()}] Routes registered`);
    
    // Sentry error handler must be after routes
    setupSentryErrorHandler(app);
    
    // Error handler for unhandled errors
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      logger.error({ err, status }, "Unhandled error");
      res.status(status).json({ message });
    });
    
    // Setup static serving or Vite
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
      console.log(`[${new Date().toISOString()}] Static files configured`);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      console.log(`[${new Date().toISOString()}] Vite configured`);
    }
    
    // Seed database with initial data
    console.log(`[${new Date().toISOString()}] Seeding database...`);
    await seedDatabase();
    console.log(`[${new Date().toISOString()}] Database seeded`);
    
    // Seed API limit settings
    await seedApiLimitSettings();
    
    // Load security and compression config from Factory Settings
    const [securityConfig, compressionConfig] = await Promise.all([
      loadSecurityConfig(),
      loadCompressionConfig(),
    ]);
    
    // Apply helmet security headers
    app.use(helmet.default({
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
    
    // Apply response compression
    app.use(compression.default({
      threshold: compressionConfig.threshold,
      level: compressionConfig.level,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.default.filter(req, res);
      }
    }));
    
    logger.info({ securityConfig, compressionConfig }, 'Middleware configured from Factory Settings');
    
    // Initialize pg-boss job queue
    try {
      await initJobQueue();
      logger.info({ source: 'pg-boss' }, "pg-boss job queue initialized");
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to initialize pg-boss:`, error);
    }
    
    // Start log rotation scheduler
    startLogRotationScheduler();
    
    isInitialized = true;
    console.log(`[${new Date().toISOString()}] App fully initialized in ${Date.now() - startTime}ms`);
    logger.info({ startupTime: Date.now() - startTime }, `Server fully initialized on port ${port}`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Full initialization error:`, error);
    // Don't crash - server is already running and can serve health checks
  }
}

// Export log function for compatibility
export function log(message: string, source = "express") {
  console.log(`[${source}] ${message}`);
}
