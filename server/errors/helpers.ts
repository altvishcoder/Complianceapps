import type { Request, Response } from 'express';
import type { RFC7807ProblemDetail } from './index';

export function sendError(
  res: Response, 
  status: number, 
  detail: string, 
  type?: string,
  req?: Request
): void {
  const requestId = req ? ((req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id']) : undefined;
  const problemDetail: RFC7807ProblemDetail = {
    type: type ? `https://api.socialcomply.io/errors/${type}` : getTypeFromStatus(status),
    title: getTitleFromStatus(status),
    status,
    detail,
    instance: req?.originalUrl,
    traceId: requestId ? String(requestId) : undefined,
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(problemDetail);
}

export function sendValidationError(
  res: Response, 
  detail: string, 
  errors?: Array<{ path: string; message: string }>,
  req?: Request
): void {
  const requestId = req ? ((req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id']) : undefined;
  const problemDetail: RFC7807ProblemDetail = {
    type: 'https://api.socialcomply.io/errors/validation-error',
    title: 'Validation Error',
    status: 400,
    detail,
    errors,
    instance: req?.originalUrl,
    traceId: requestId ? String(requestId) : undefined,
    timestamp: new Date().toISOString(),
  };
  res.status(400).json(problemDetail);
}

export function sendNotFound(res: Response, resource?: string, req?: Request): void {
  const detail = resource ? `${resource} not found` : 'Resource not found';
  sendError(res, 404, detail, 'not-found', req);
}

export function sendUnauthorized(res: Response, detail: string = 'Authentication required', req?: Request): void {
  sendError(res, 401, detail, 'unauthorized', req);
}

export function sendForbidden(res: Response, detail: string = 'Access denied', req?: Request): void {
  sendError(res, 403, detail, 'forbidden', req);
}

export function sendConflict(res: Response, detail: string, req?: Request): void {
  sendError(res, 409, detail, 'conflict', req);
}

export function sendInternalError(res: Response, detail?: string, req?: Request): void {
  sendError(res, 500, detail || 'An unexpected error occurred', 'internal-error', req);
}

export function sendUnprocessableEntity(
  res: Response, 
  detail: string, 
  errors?: Array<{ path: string; message: string }>,
  req?: Request
): void {
  const requestId = req ? ((req as any).id || req.headers['x-request-id'] || req.headers['x-correlation-id']) : undefined;
  const problemDetail: RFC7807ProblemDetail = {
    type: 'https://api.socialcomply.io/errors/unprocessable-entity',
    title: 'Unprocessable Entity',
    status: 422,
    detail,
    errors,
    instance: req?.originalUrl,
    traceId: requestId ? String(requestId) : undefined,
    timestamp: new Date().toISOString(),
  };
  res.status(422).json(problemDetail);
}

export function sendUnsupportedMediaType(res: Response, detail: string = 'The media type is not supported', req?: Request): void {
  sendError(res, 415, detail, 'unsupported-media-type', req);
}

function getTypeFromStatus(status: number): string {
  const typeMap: Record<number, string> = {
    400: 'https://api.socialcomply.io/errors/bad-request',
    401: 'https://api.socialcomply.io/errors/unauthorized',
    403: 'https://api.socialcomply.io/errors/forbidden',
    404: 'https://api.socialcomply.io/errors/not-found',
    409: 'https://api.socialcomply.io/errors/conflict',
    413: 'https://api.socialcomply.io/errors/payload-too-large',
    415: 'https://api.socialcomply.io/errors/unsupported-media-type',
    422: 'https://api.socialcomply.io/errors/unprocessable-entity',
    429: 'https://api.socialcomply.io/errors/rate-limit-exceeded',
    500: 'https://api.socialcomply.io/errors/internal-error',
    502: 'https://api.socialcomply.io/errors/external-service-error',
    503: 'https://api.socialcomply.io/errors/service-unavailable',
  };
  return typeMap[status] || 'https://api.socialcomply.io/errors/unknown';
}

function getTitleFromStatus(status: number): string {
  const titleMap: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return titleMap[status] || 'Error';
}
