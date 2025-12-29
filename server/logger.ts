import pino from "pino";
import pinoHttp from "pino-http";

const isProduction = process.env.NODE_ENV === "production";

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
  }),
});

export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export const jobLogger = createContextLogger({ component: "job-queue" });
export const apiLogger = createContextLogger({ component: "api" });
export const extractionLogger = createContextLogger({ component: "extraction" });
export const webhookLogger = createContextLogger({ component: "webhook" });
