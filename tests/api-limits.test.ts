import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../server/storage', () => ({
  storage: {
    getFactorySettingValue: vi.fn(),
    getFactorySetting: vi.fn(),
    createFactorySetting: vi.fn(),
  },
}));

import {
  getApiLimitsConfig,
  clearApiLimitsCache,
  API_LIMIT_SETTINGS,
  type ApiLimitsConfig,
  type PaginationParams,
} from '../server/services/api-limits';
import { storage } from '../server/storage';

const mockStorage = vi.mocked(storage);

describe('API Limits Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearApiLimitsCache();
  });

  describe('ApiLimitsConfig Type', () => {
    it('should have correct structure', () => {
      const config: ApiLimitsConfig = {
        paginationDefaultLimit: 50,
        paginationMaxLimit: 200,
        paginationMaxPages: 100,
        paginationRequireFilterForLargeData: false,
        paginationUnfilteredMaxRecords: 200,
        rateLimitRequestsPerMinute: 100,
        rateLimitHeavyEndpointsPerMinute: 20,
        rateLimitEnabled: true,
      };

      expect(config.paginationDefaultLimit).toBe(50);
      expect(config.paginationMaxLimit).toBe(200);
      expect(config.rateLimitEnabled).toBe(true);
    });
  });

  describe('PaginationParams Type', () => {
    it('should have correct structure', () => {
      const params: PaginationParams = {
        page: 1,
        limit: 50,
        offset: 0,
        hasFilters: false,
      };

      expect(params.page).toBe(1);
      expect(params.limit).toBe(50);
      expect(params.offset).toBe(0);
      expect(params.hasFilters).toBe(false);
    });

    it('should calculate offset correctly', () => {
      const page2: PaginationParams = {
        page: 2,
        limit: 50,
        offset: 50,
        hasFilters: true,
      };

      expect(page2.offset).toBe((page2.page - 1) * page2.limit);
    });
  });

  describe('getApiLimitsConfig', () => {
    it('should return config from factory settings', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('50')
        .mockResolvedValueOnce('200')
        .mockResolvedValueOnce('100')
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce('200')
        .mockResolvedValueOnce('100')
        .mockResolvedValueOnce('20')
        .mockResolvedValueOnce('true');

      const config = await getApiLimitsConfig();

      expect(config.paginationDefaultLimit).toBe(50);
      expect(config.paginationMaxLimit).toBe(200);
      expect(config.rateLimitEnabled).toBe(true);
    });

    it('should use defaults when factory settings fail', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('DB error'));

      const config = await getApiLimitsConfig();

      expect(config.paginationDefaultLimit).toBe(50);
      expect(config.paginationMaxLimit).toBe(200);
      expect(config.rateLimitEnabled).toBe(true);
    });

    it('should cache config after first call', async () => {
      mockStorage.getFactorySettingValue.mockResolvedValue('50');

      await getApiLimitsConfig();
      await getApiLimitsConfig();

      expect(mockStorage.getFactorySettingValue.mock.calls.length).toBe(8);
    });
  });

  describe('clearApiLimitsCache', () => {
    it('should clear cached config', async () => {
      mockStorage.getFactorySettingValue.mockResolvedValue('50');

      await getApiLimitsConfig();
      clearApiLimitsCache();
      
      mockStorage.getFactorySettingValue.mockClear();
      mockStorage.getFactorySettingValue.mockResolvedValue('60');
      
      await getApiLimitsConfig();

      expect(mockStorage.getFactorySettingValue).toHaveBeenCalled();
    });
  });

  describe('API_LIMIT_SETTINGS', () => {
    it('should have required pagination settings', () => {
      const keys = API_LIMIT_SETTINGS.map(s => s.key);

      expect(keys).toContain('api.pagination.defaultLimit');
      expect(keys).toContain('api.pagination.maxLimit');
      expect(keys).toContain('api.pagination.maxPages');
    });

    it('should have required rate limit settings', () => {
      const keys = API_LIMIT_SETTINGS.map(s => s.key);

      expect(keys).toContain('api.rateLimit.requestsPerMinute');
      expect(keys).toContain('api.rateLimit.heavyEndpointsPerMinute');
      expect(keys).toContain('api.rateLimit.enabled');
    });

    it('should have correct value types', () => {
      const defaultLimitSetting = API_LIMIT_SETTINGS.find(
        s => s.key === 'api.pagination.defaultLimit'
      );
      const enabledSetting = API_LIMIT_SETTINGS.find(
        s => s.key === 'api.rateLimit.enabled'
      );

      expect(defaultLimitSetting?.valueType).toBe('number');
      expect(enabledSetting?.valueType).toBe('boolean');
    });

    it('should have validation rules for number settings', () => {
      const defaultLimitSetting = API_LIMIT_SETTINGS.find(
        s => s.key === 'api.pagination.defaultLimit'
      );

      expect(defaultLimitSetting?.validationRules).toHaveProperty('min');
      expect(defaultLimitSetting?.validationRules).toHaveProperty('max');
    });

    it('should have correct category', () => {
      API_LIMIT_SETTINGS.forEach(setting => {
        expect(setting.category).toBe('api_limits');
      });
    });

    it('should have descriptions for all settings', () => {
      API_LIMIT_SETTINGS.forEach(setting => {
        expect(setting.description).toBeTruthy();
        expect(setting.description.length).toBeGreaterThan(10);
      });
    });

    it('should have 8 settings total', () => {
      expect(API_LIMIT_SETTINGS).toHaveLength(8);
    });
  });

  describe('Default Config Values', () => {
    it('should have sensible defaults', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('Not found'));
      
      const config = await getApiLimitsConfig();

      expect(config.paginationDefaultLimit).toBeGreaterThan(0);
      expect(config.paginationMaxLimit).toBeGreaterThan(config.paginationDefaultLimit);
      expect(config.rateLimitRequestsPerMinute).toBeGreaterThan(0);
    });

    it('should have max limit greater than default limit', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('Not found'));
      
      const config = await getApiLimitsConfig();

      expect(config.paginationMaxLimit).toBeGreaterThan(config.paginationDefaultLimit);
    });

    it('should have heavy endpoint limit less than general limit', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('Not found'));
      
      const config = await getApiLimitsConfig();

      expect(config.rateLimitHeavyEndpointsPerMinute).toBeLessThan(config.rateLimitRequestsPerMinute);
    });
  });
});
