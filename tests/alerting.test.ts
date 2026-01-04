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
  },
}));

import {
  trackError,
  clearAlertingCache,
  testAlertWebhook,
} from '../server/services/alerting';
import { storage } from '../server/storage';

const mockStorage = vi.mocked(storage);
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Alerting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAlertingCache();
    mockFetch.mockReset();
  });

  describe('clearAlertingCache', () => {
    it('should clear the config cache', () => {
      expect(() => clearAlertingCache()).not.toThrow();
    });
  });

  describe('trackError', () => {
    it('should track errors without triggering alert below threshold', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('false');

      await trackError('test-category', 'Test error message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use default config when storage fails', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('DB error'));

      await expect(trackError('error-category', 'Error message')).resolves.not.toThrow();
    });

    it('should accept optional context', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('false');

      await expect(
        trackError('category', 'message', { userId: 'user-123', action: 'login' })
      ).resolves.not.toThrow();
    });
  });

  describe('testAlertWebhook', () => {
    it('should return failure when no webhook URL configured', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('false');

      const result = await testAlertWebhook();

      expect(result.success).toBe(false);
      expect(result.message).toContain('No webhook URL configured');
    });

    it('should return success when webhook responds OK', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('https://webhook.example.com')
        .mockResolvedValueOnce('true');

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await testAlertWebhook();

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
    });

    it('should return failure when webhook responds with error', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('https://webhook.example.com')
        .mockResolvedValueOnce('true');

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await testAlertWebhook();

      expect(result.success).toBe(false);
      expect(result.message).toContain('500');
    });

    it('should return failure when fetch throws error', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('https://webhook.example.com')
        .mockResolvedValueOnce('true');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await testAlertWebhook();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });

    it('should send test alert payload to webhook', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('https://webhook.example.com')
        .mockResolvedValueOnce('true');

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await testAlertWebhook();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://webhook.example.com',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.alert).toBe('test');
      expect(body.service).toBe('complianceai');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Error Window Management', () => {
    it('should track errors in same category', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValue('10');

      await trackError('category-a', 'Error 1');
      await trackError('category-a', 'Error 2');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should track errors in different categories separately', async () => {
      mockStorage.getFactorySettingValue
        .mockResolvedValue('10');

      await trackError('category-a', 'Error in A');
      await trackError('category-b', 'Error in B');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Alert Threshold Configuration', () => {
    it('should use default threshold of 10', async () => {
      mockStorage.getFactorySettingValue.mockRejectedValue(new Error('Not found'));

      for (let i = 0; i < 9; i++) {
        await trackError('threshold-test', 'Error');
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
