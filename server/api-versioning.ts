import type { Request, Response, NextFunction, Express, RequestHandler } from 'express';
import { logger } from './logger';

export const CURRENT_API_VERSION = 'v1';
export const SUPPORTED_VERSIONS = ['v1'];

export function setupApiVersioning(app: Express) {
  app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
    req.url = req.url;
    res.setHeader('X-API-Version', 'v1');
    next();
  });

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/v1') && !req.path.startsWith('/auth')) {
      res.setHeader('X-API-Deprecation-Warning', 'Unversioned API endpoints are deprecated. Please use /api/v1/ prefix.');
    }
    next();
  });
}

export function createVersionedRouter(app: Express) {
  return {
    get: (path: string, ...handlers: RequestHandler[]) => {
      app.get(`/api/v1${path}`, ...handlers);
      app.get(`/api${path}`, ...handlers);
    },
    post: (path: string, ...handlers: RequestHandler[]) => {
      app.post(`/api/v1${path}`, ...handlers);
      app.post(`/api${path}`, ...handlers);
    },
    put: (path: string, ...handlers: RequestHandler[]) => {
      app.put(`/api/v1${path}`, ...handlers);
      app.put(`/api${path}`, ...handlers);
    },
    patch: (path: string, ...handlers: RequestHandler[]) => {
      app.patch(`/api/v1${path}`, ...handlers);
      app.patch(`/api${path}`, ...handlers);
    },
    delete: (path: string, ...handlers: RequestHandler[]) => {
      app.delete(`/api/v1${path}`, ...handlers);
      app.delete(`/api${path}`, ...handlers);
    },
    all: (path: string, ...handlers: RequestHandler[]) => {
      app.all(`/api/v1${path}`, ...handlers);
      app.all(`/api${path}`, ...handlers);
    },
  };
}

export function getApiVersionInfo() {
  return {
    currentVersion: CURRENT_API_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    deprecatedVersions: [] as string[],
    documentation: '/api/docs',
    versionedEndpoint: '/api/v1',
    legacyEndpoint: '/api (deprecated)',
  };
}
