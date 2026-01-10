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
import { isDatabaseAvailable } from "./db";

// Immediate startup logging
console.log(`[${new Date().toISOString()}] Starting server...`);
console.log(`[${new Date().toISOString()}] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[${new Date().toISOString()}] DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
console.log(`[${new Date().toISOString()}] PORT: ${process.env.PORT || '5000'}`);
console.log(`[${new Date().toISOString()}] Imports completed, setting up server...`);

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
