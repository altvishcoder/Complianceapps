import pino from "pino";
import pinoHttp from "pino-http";
import { db } from "./db";
import { systemLogs } from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'api_key', 'apikey', 'authorization', 'cookie', 'session'];

function scrubSensitive(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  const objRef = obj as object;
  if (seen.has(objRef)) return '[Circular]';
  seen.add(objRef);
  
  if (Array.isArray(obj)) return obj.slice(0, 10).map(item => scrubSensitive(item, seen));
  
  const result: Record<string, unknown> = {};
  const entries = Object.entries(obj as Record<string, unknown>).slice(0, 50);
  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubSensitive(value, seen);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const logBuffer: Array<{
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: 'api' | 'job-queue' | 'extraction' | 'webhook' | 'http' | 'system';
  message: string;
  context: unknown;
  requestId?: string;
  timestamp: Date;
}> = [];

let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_SIZE = 100;

async function flushLogs() {
  if (logBuffer.length === 0) return;
  
  const logsToWrite = logBuffer.splice(0, logBuffer.length);
  
  try {
    await db.insert(systemLogs).values(
      logsToWrite.map(log => ({
        level: log.level,
        source: log.source,
        message: log.message,
        context: scrubSensitive(log.context) as Record<string, unknown>,
        requestId: log.requestId,
        timestamp: log.timestamp,
      }))
    );
  } catch (error) {
    console.error('Failed to flush logs to database:', error);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, FLUSH_INTERVAL);
}

function addLogToBuffer(
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  source: 'api' | 'job-queue' | 'extraction' | 'webhook' | 'http' | 'system',
  message: string,
  context: unknown,
  requestId?: string
) {
  logBuffer.push({
    level,
    source,
    message,
    context,
    requestId,
    timestamp: new Date(),
  });
  
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  } else {
    scheduleFlush();
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
  base: {
    service: "complianceai",
    env: process.env.NODE_ENV || "development",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  hooks: {
    logMethod(inputArgs, method, level) {
      const levelName = pino.levels.labels[level] as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
      
      if (levelName === 'info' || levelName === 'warn' || levelName === 'error' || levelName === 'fatal') {
        const [first, ...rest] = inputArgs;
        let message = '';
        let context: unknown = {};
        
        if (typeof first === 'string') {
          message = first;
          context = rest[0] || {};
        } else if (typeof first === 'object' && first !== null) {
          context = first;
          message = typeof rest[0] === 'string' ? rest[0] : JSON.stringify(first);
        }
        
        const source = (context as Record<string, unknown>)?.component as 'api' | 'job-queue' | 'extraction' | 'webhook' | 'http' | 'system' || 'system';
        const requestId = (context as Record<string, unknown>)?.requestId as string | undefined;
        
        addLogToBuffer(levelName, source, message, context, requestId);
      }
      
      return method.apply(this, inputArgs);
    },
  },
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      const url = req.url || "";
      return (
        url.startsWith("/_") ||
        url.includes("hot-update") ||
        url.includes(".js") ||
        url.includes(".css") ||
        url.includes(".svg") ||
        url.includes(".png") ||
        url.includes(".ico")
      );
    },
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err?.message || "Error"}`;
  },
  customProps: (req) => ({
    requestId: req.id,
    userAgent: req.headers["user-agent"],
    component: "http",
  }),
});

export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export const jobLogger = createContextLogger({ component: "job-queue" });
export const apiLogger = createContextLogger({ component: "api" });
export const extractionLogger = createContextLogger({ component: "extraction" });
export const webhookLogger = createContextLogger({ component: "webhook" });

process.on('beforeExit', () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushLogs();
});
