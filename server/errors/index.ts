import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

export interface RFC7807ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
  traceId?: string;
  timestamp?: string;
}

export abstract class APIError extends Error {
  abstract readonly status: number;
  abstract readonly type: string;
  abstract readonly title: string;
  readonly detail?: string;
  readonly errors?: Array<{ path: string; message: string }>;

  constructor(message: string, detail?: string, errors?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = this.constructor.name;
    this.detail = detail;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toRFC7807(req: Request): RFC7807ProblemDetail {
    const requestId = (req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id'];
    return {
      type: `https://api.socialcomply.io/errors/${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.detail || this.message,
      instance: req.originalUrl,
      errors: this.errors,
      traceId: requestId ? String(requestId) : undefined,
      timestamp: new Date().toISOString(),
    };
  }
}

export class BadRequestError extends APIError {
  readonly status = 400;
  readonly type = 'bad-request';
  readonly title = 'Bad Request';

  constructor(detail?: string, errors?: Array<{ path: string; message: string }>) {
    super('Bad Request', detail, errors);
  }
}

export class ValidationError extends APIError {
  readonly status = 400;
  readonly type = 'validation-error';
  readonly title = 'Validation Error';

  constructor(detail?: string, errors?: Array<{ path: string; message: string }>) {
    super('Validation Error', detail, errors);
  }

  static fromZodError(error: ZodError): ValidationError {
    const errors = error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return new ValidationError('Request validation failed', errors);
  }
}

export class UnauthorizedError extends APIError {
  readonly status = 401;
  readonly type = 'unauthorized';
  readonly title = 'Unauthorized';

  constructor(detail: string = 'Authentication required') {
    super('Unauthorized', detail);
  }
}

export class ForbiddenError extends APIError {
  readonly status = 403;
  readonly type = 'forbidden';
  readonly title = 'Forbidden';

  constructor(detail: string = 'Access denied') {
    super('Forbidden', detail);
  }
}

export class NotFoundError extends APIError {
  readonly status = 404;
  readonly type = 'not-found';
  readonly title = 'Not Found';

  constructor(resource?: string) {
    const detail = resource ? `${resource} not found` : 'Resource not found';
    super('Not Found', detail);
  }
}

export class ConflictError extends APIError {
  readonly status = 409;
  readonly type = 'conflict';
  readonly title = 'Conflict';

  constructor(detail: string = 'Resource conflict') {
    super('Conflict', detail);
  }
}

export class TooManyRequestsError extends APIError {
  readonly status = 429;
  readonly type = 'rate-limit-exceeded';
  readonly title = 'Too Many Requests';
  readonly retryAfter?: number;

  constructor(detail: string = 'Rate limit exceeded', retryAfter?: number) {
    super('Too Many Requests', detail);
    this.retryAfter = retryAfter;
  }

  override toRFC7807(req: Request): RFC7807ProblemDetail {
    const base = super.toRFC7807(req);
    if (this.retryAfter) {
      return { ...base, retryAfter: this.retryAfter } as RFC7807ProblemDetail & { retryAfter: number };
    }
    return base;
  }
}

export class InternalServerError extends APIError {
  readonly status = 500;
  readonly type = 'internal-error';
  readonly title = 'Internal Server Error';

  constructor(detail: string = 'An unexpected error occurred') {
    super('Internal Server Error', detail);
  }
}

export class ServiceUnavailableError extends APIError {
  readonly status = 503;
  readonly type = 'service-unavailable';
  readonly title = 'Service Unavailable';

  constructor(detail: string = 'Service temporarily unavailable') {
    super('Service Unavailable', detail);
  }
}

export class UnprocessableEntityError extends APIError {
  readonly status = 422;
  readonly type = 'unprocessable-entity';
  readonly title = 'Unprocessable Entity';

  constructor(detail?: string, errors?: Array<{ path: string; message: string }>) {
    super('Unprocessable Entity', detail || 'The request was well-formed but contains semantic errors', errors);
  }
}

export class UnsupportedMediaTypeError extends APIError {
  readonly status = 415;
  readonly type = 'unsupported-media-type';
  readonly title = 'Unsupported Media Type';

  constructor(detail: string = 'The media type is not supported') {
    super('Unsupported Media Type', detail);
  }
}

export class PayloadTooLargeError extends APIError {
  readonly status = 413;
  readonly type = 'payload-too-large';
  readonly title = 'Payload Too Large';

  constructor(detail: string = 'The request payload is too large') {
    super('Payload Too Large', detail);
  }
}

export class ExternalServiceError extends APIError {
  readonly status = 502;
  readonly type = 'external-service-error';
  readonly title = 'External Service Error';

  constructor(service: string, detail?: string) {
    super('External Service Error', detail || `Failed to communicate with ${service}`);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id'];

  if (err instanceof APIError) {
    const problemDetail = err.toRFC7807(req);
    
    if (err.status >= 500) {
      logger.error({ err, requestId, path: req.path }, err.message);
    } else {
      logger.warn({ err, requestId, path: req.path }, err.message);
    }
    
    res.status(err.status).json(problemDetail);
    return;
  }

  if (err instanceof ZodError) {
    const validationError = ValidationError.fromZodError(err);
    const problemDetail = validationError.toRFC7807(req);
    
    logger.warn({ err, requestId, path: req.path }, 'Validation error');
    res.status(400).json(problemDetail);
    return;
  }

  logger.error({ err, requestId, path: req.path, stack: err.stack }, 'Unhandled error');

  const problemDetail: RFC7807ProblemDetail = {
    type: 'https://api.socialcomply.io/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    instance: req.originalUrl,
    traceId: requestId ? String(requestId) : undefined,
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(problemDetail);
}

export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const problemDetail: RFC7807ProblemDetail = {
    type: 'https://api.socialcomply.io/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
    instance: req.originalUrl,
    timestamp: new Date().toISOString(),
  };
  res.status(404).json(problemDetail);
}

export function handleRouteError(error: unknown, req: Request, res: Response, context: string): void {
  const requestId = (req as { id?: string | number }).id || req.headers['x-request-id'] || req.headers['x-correlation-id'];
  
  if (error instanceof APIError) {
    const problemDetail = error.toRFC7807(req);
    if (error.status >= 500) {
      logger.error({ err: error, requestId, path: req.path, context }, error.message);
    } else {
      logger.warn({ err: error, requestId, path: req.path, context }, error.message);
    }
    res.status(error.status).json(problemDetail);
    return;
  }

  if (error instanceof ZodError) {
    const validationError = ValidationError.fromZodError(error);
    const problemDetail = validationError.toRFC7807(req);
    logger.warn({ err: error, requestId, path: req.path, context }, 'Validation error');
    res.status(400).json(problemDetail);
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  
  if (err.message.includes('not found') || err.message.includes('Not found') || err.message.includes('NOT_FOUND')) {
    const notFoundError = new NotFoundError(context);
    res.status(404).json(notFoundError.toRFC7807(req));
    return;
  }
  
  if (err.message.includes('duplicate') || err.message.includes('already exists') || err.message.includes('UNIQUE')) {
    const conflictError = new ConflictError(`${context} already exists or conflicts with existing data`);
    res.status(409).json(conflictError.toRFC7807(req));
    return;
  }
  
  if (err.message.includes('foreign key') || err.message.includes('FOREIGN KEY') || err.message.includes('violates')) {
    const badRequestError = new BadRequestError(`Invalid reference in ${context.toLowerCase()}`);
    res.status(400).json(badRequestError.toRFC7807(req));
    return;
  }

  logger.error({ err, requestId, path: req.path, context, stack: err.stack }, `Error in ${context}`);
  
  const problemDetail: RFC7807ProblemDetail = {
    type: 'https://api.socialcomply.io/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'development' ? err.message : `Failed to process ${context.toLowerCase()}`,
    instance: req.originalUrl,
    traceId: requestId ? String(requestId) : undefined,
    timestamp: new Date().toISOString(),
  };
  
  res.status(500).json(problemDetail);
}

export function mapDatabaseError(error: unknown, resource: string): APIError {
  const err = error instanceof Error ? error : new Error(String(error));
  
  if (err.message.includes('not found') || err.message.includes('NOT_FOUND')) {
    return new NotFoundError(resource);
  }
  
  if (err.message.includes('duplicate') || err.message.includes('UNIQUE') || err.message.includes('already exists')) {
    return new ConflictError(`${resource} already exists`);
  }
  
  if (err.message.includes('foreign key') || err.message.includes('FOREIGN KEY')) {
    return new BadRequestError(`Invalid reference for ${resource}`);
  }
  
  if (err.message.includes('null value') || err.message.includes('NOT NULL')) {
    return new BadRequestError(`Missing required field for ${resource}`);
  }
  
  return new InternalServerError(`Failed to process ${resource}`);
}
