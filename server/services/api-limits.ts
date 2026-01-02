import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../logger';

export interface ApiLimitsConfig {
  paginationDefaultLimit: number;
  paginationMaxLimit: number;
  paginationMaxPages: number;
  paginationRequireFilterForLargeData: boolean;
  paginationUnfilteredMaxRecords: number;
  rateLimitRequestsPerMinute: number;
  rateLimitHeavyEndpointsPerMinute: number;
  rateLimitEnabled: boolean;
}

const DEFAULT_CONFIG: ApiLimitsConfig = {
  paginationDefaultLimit: 50,
  paginationMaxLimit: 200,
  paginationMaxPages: 100,
  paginationRequireFilterForLargeData: true,
  paginationUnfilteredMaxRecords: 200,
  rateLimitRequestsPerMinute: 100,
  rateLimitHeavyEndpointsPerMinute: 20,
  rateLimitEnabled: true,
};

let cachedConfig: ApiLimitsConfig | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60000;

export async function getApiLimitsConfig(): Promise<ApiLimitsConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  try {
    const [
      defaultLimit,
      maxLimit,
      maxPages,
      requireFilter,
      unfilteredMax,
      rateLimit,
      heavyRateLimit,
      rateLimitEnabled,
    ] = await Promise.all([
      storage.getFactorySettingValue('api.pagination.defaultLimit', String(DEFAULT_CONFIG.paginationDefaultLimit)),
      storage.getFactorySettingValue('api.pagination.maxLimit', String(DEFAULT_CONFIG.paginationMaxLimit)),
      storage.getFactorySettingValue('api.pagination.maxPages', String(DEFAULT_CONFIG.paginationMaxPages)),
      storage.getFactorySettingValue('api.pagination.requireFilterForLargeData', String(DEFAULT_CONFIG.paginationRequireFilterForLargeData)),
      storage.getFactorySettingValue('api.pagination.unfilteredMaxRecords', String(DEFAULT_CONFIG.paginationUnfilteredMaxRecords)),
      storage.getFactorySettingValue('api.rateLimit.requestsPerMinute', String(DEFAULT_CONFIG.rateLimitRequestsPerMinute)),
      storage.getFactorySettingValue('api.rateLimit.heavyEndpointsPerMinute', String(DEFAULT_CONFIG.rateLimitHeavyEndpointsPerMinute)),
      storage.getFactorySettingValue('api.rateLimit.enabled', String(DEFAULT_CONFIG.rateLimitEnabled)),
    ]);

    cachedConfig = {
      paginationDefaultLimit: parseInt(defaultLimit) || DEFAULT_CONFIG.paginationDefaultLimit,
      paginationMaxLimit: parseInt(maxLimit) || DEFAULT_CONFIG.paginationMaxLimit,
      paginationMaxPages: parseInt(maxPages) || DEFAULT_CONFIG.paginationMaxPages,
      paginationRequireFilterForLargeData: requireFilter === 'true',
      paginationUnfilteredMaxRecords: parseInt(unfilteredMax) || DEFAULT_CONFIG.paginationUnfilteredMaxRecords,
      rateLimitRequestsPerMinute: parseInt(rateLimit) || DEFAULT_CONFIG.rateLimitRequestsPerMinute,
      rateLimitHeavyEndpointsPerMinute: parseInt(heavyRateLimit) || DEFAULT_CONFIG.rateLimitHeavyEndpointsPerMinute,
      rateLimitEnabled: rateLimitEnabled === 'true',
    };
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to load API limits from factory settings, using defaults');
    cachedConfig = { ...DEFAULT_CONFIG };
    cacheExpiry = now + CACHE_TTL_MS;
  }

  return cachedConfig;
}

export function clearApiLimitsCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  hasFilters: boolean;
}

export function paginationMiddleware(options?: { heavyEndpoint?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await getApiLimitsConfig();
      
      const requestedPage = parseInt(req.query.page as string) || 1;
      const requestedLimit = parseInt(req.query.limit as string) || config.paginationDefaultLimit;
      
      const hasFilters = Object.keys(req.query).some(key => 
        !['page', 'limit'].includes(key) && req.query[key]
      );
      
      let effectiveLimit: number;
      let effectivePage: number;
      
      if (!hasFilters && config.paginationRequireFilterForLargeData) {
        effectiveLimit = Math.min(requestedLimit, config.paginationUnfilteredMaxRecords);
        effectivePage = 1;
        
        if (requestedPage > 1) {
          return res.status(400).json({
            error: 'Pagination beyond first page requires filters',
            message: 'Please apply filters to paginate through results',
            code: 'FILTER_REQUIRED_FOR_PAGINATION',
          });
        }
      } else {
        effectiveLimit = Math.min(requestedLimit, config.paginationMaxLimit);
        effectivePage = Math.min(requestedPage, config.paginationMaxPages);
        
        if (requestedPage > config.paginationMaxPages) {
          return res.status(400).json({
            error: 'Page limit exceeded',
            message: `Maximum page number is ${config.paginationMaxPages}. Please use filters to narrow your search.`,
            code: 'MAX_PAGES_EXCEEDED',
            maxPages: config.paginationMaxPages,
          });
        }
      }
      
      const offset = (effectivePage - 1) * effectiveLimit;
      
      (req as any).pagination = {
        page: effectivePage,
        limit: effectiveLimit,
        offset,
        hasFilters,
      } as PaginationParams;
      
      next();
    } catch (error) {
      logger.error({ err: error }, 'Pagination middleware error');
      next(error);
    }
  };
}

export function createGlobalRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: async () => {
      const config = await getApiLimitsConfig();
      return config.rateLimitEnabled ? config.rateLimitRequestsPerMinute : 10000;
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: async () => {
      const config = await getApiLimitsConfig();
      return !config.rateLimitEnabled;
    },
    handler: (req, res) => {
      logger.warn({ ip: req.ip, path: req.path, method: req.method }, 'Rate limit exceeded');
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'You have exceeded the rate limit. Please wait before making more requests.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
    },
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    },
  });
}

export function createHeavyEndpointRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: async () => {
      const config = await getApiLimitsConfig();
      return config.rateLimitEnabled ? config.rateLimitHeavyEndpointsPerMinute : 10000;
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: async () => {
      const config = await getApiLimitsConfig();
      return !config.rateLimitEnabled;
    },
    handler: (req, res) => {
      logger.warn({ ip: req.ip, path: req.path, method: req.method }, 'Heavy endpoint rate limit exceeded');
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'This endpoint has strict rate limits. Please wait before making more requests.',
        code: 'HEAVY_RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
    },
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    },
  });
}

export const API_LIMIT_SETTINGS = [
  {
    key: 'api.pagination.defaultLimit',
    value: '50',
    description: 'Default number of records returned per page when no limit is specified',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 10, max: 200 },
  },
  {
    key: 'api.pagination.maxLimit',
    value: '200',
    description: 'Maximum number of records that can be returned in a single request',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 50, max: 500 },
  },
  {
    key: 'api.pagination.maxPages',
    value: '100',
    description: 'Maximum page number that can be requested. Prevents deep pagination.',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 10, max: 1000 },
  },
  {
    key: 'api.pagination.requireFilterForLargeData',
    value: 'true',
    description: 'Require filters to paginate beyond the first page (protects system from full data scans)',
    valueType: 'boolean',
    category: 'api_limits',
    validationRules: null,
  },
  {
    key: 'api.pagination.unfilteredMaxRecords',
    value: '200',
    description: 'Maximum records returned when no filters are applied',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 50, max: 500 },
  },
  {
    key: 'api.rateLimit.requestsPerMinute',
    value: '100',
    description: 'Maximum API requests per minute per IP address',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 10, max: 1000 },
  },
  {
    key: 'api.rateLimit.heavyEndpointsPerMinute',
    value: '20',
    description: 'Maximum requests per minute for resource-intensive endpoints (reports, exports)',
    valueType: 'number',
    category: 'api_limits',
    validationRules: { min: 5, max: 100 },
  },
  {
    key: 'api.rateLimit.enabled',
    value: 'true',
    description: 'Enable API rate limiting. Disable only for development/testing.',
    valueType: 'boolean',
    category: 'api_limits',
    validationRules: null,
  },
];

export async function seedApiLimitSettings(): Promise<void> {
  for (const setting of API_LIMIT_SETTINGS) {
    try {
      const existing = await storage.getFactorySetting(setting.key);
      if (!existing) {
        await storage.createFactorySetting({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          valueType: setting.valueType,
          category: setting.category,
          isEditable: true,
          validationRules: setting.validationRules,
        });
        logger.info(`Seeded API limit setting: ${setting.key}`);
      }
    } catch (error) {
      logger.warn({ err: error, key: setting.key }, 'Failed to seed API limit setting');
    }
  }
}
