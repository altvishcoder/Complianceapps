import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

const CORRELATION_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers[CORRELATION_HEADER] as string | undefined;
  const correlationId = incomingId || randomUUID();
  
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  
  next();
}

export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown';
}
