import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbExecute = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    execute: (...args: any[]) => mockDbExecute(...args),
  },
}));

import {
  getCertificatesExpiringSoon,
  getExpiryAlertsByOrganisation,
  getExpiryStats,
  markExpiredCertificates,
} from '../server/services/expiry-alerts';

describe('Expiry Alerts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbExecute.mockReset();
  });

  describe('getCertificatesExpiringSoon', () => {
    it('should return empty array when no organisationId provided', async () => {
      const result = await getCertificatesExpiringSoon(30);
      
      expect(result).toEqual([]);
      expect(mockDbExecute).not.toHaveBeenCalled();
    });

    it('should return empty array when organisationId is undefined', async () => {
      const result = await getCertificatesExpiringSoon(30, undefined);
      
      expect(result).toEqual([]);
    });

    it('should query database with organisationId', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      const result = await getCertificatesExpiringSoon(30, 'org-123');

      expect(mockDbExecute).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should map database results to ExpiryAlert format', async () => {
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() + 15);
      
      mockDbExecute.mockResolvedValue({
        rows: [
          {
            certificate_id: 'cert-1',
            certificate_type: 'GAS',
            property_address: '123 Test Street',
            property_id: 'prop-1',
            expiry_date: mockDate,
            organisation_id: 'org-123',
          },
        ],
      });

      const result = await getCertificatesExpiringSoon(30, 'org-123');

      expect(result).toHaveLength(1);
      expect(result[0].certificateId).toBe('cert-1');
      expect(result[0].certificateType).toBe('GAS');
      expect(result[0].propertyAddress).toBe('123 Test Street');
      expect(result[0].daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should handle null property address', async () => {
      mockDbExecute.mockResolvedValue({
        rows: [
          {
            certificate_id: 'cert-1',
            certificate_type: 'EICR',
            property_address: null,
            property_id: null,
            expiry_date: new Date(),
            organisation_id: 'org-123',
          },
        ],
      });

      const result = await getCertificatesExpiringSoon(7, 'org-123');

      expect(result[0].propertyAddress).toBe('Unknown');
    });

    it('should throw on database error', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB connection failed'));

      await expect(getCertificatesExpiringSoon(30, 'org-123'))
        .rejects.toThrow('DB connection failed');
    });
  });

  describe('getExpiryAlertsByOrganisation', () => {
    it('should delegate to getCertificatesExpiringSoon', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      const result = await getExpiryAlertsByOrganisation('org-123', 60);

      expect(mockDbExecute).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should use default 30 days if not specified', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      await getExpiryAlertsByOrganisation('org-123');

      expect(mockDbExecute).toHaveBeenCalled();
    });
  });

  describe('getExpiryStats', () => {
    it('should return stats from parallel queries', async () => {
      mockDbExecute.mockResolvedValue({ rows: [{ count: '5' }] });

      const stats = await getExpiryStats('org-123');

      expect(stats).toHaveProperty('expiringIn7Days');
      expect(stats).toHaveProperty('expiringIn30Days');
      expect(stats).toHaveProperty('expiringIn90Days');
      expect(stats).toHaveProperty('expiredCount');
    });

    it('should handle missing count values', async () => {
      mockDbExecute.mockResolvedValue({ rows: [{}] });

      const stats = await getExpiryStats('org-123');

      expect(stats.expiringIn7Days).toBe(0);
      expect(stats.expiringIn30Days).toBe(0);
      expect(stats.expiringIn90Days).toBe(0);
      expect(stats.expiredCount).toBe(0);
    });

    it('should throw on database error', async () => {
      mockDbExecute.mockRejectedValue(new Error('Query failed'));

      await expect(getExpiryStats('org-123')).rejects.toThrow('Query failed');
    });
  });

  describe('markExpiredCertificates', () => {
    it('should return count of marked certificates', async () => {
      mockDbExecute.mockResolvedValue({
        rows: [{ id: 'cert-1' }, { id: 'cert-2' }],
      });

      const count = await markExpiredCertificates();

      expect(count).toBe(2);
    });

    it('should return 0 when no certificates to mark', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      const count = await markExpiredCertificates();

      expect(count).toBe(0);
    });

    it('should throw on database error', async () => {
      mockDbExecute.mockRejectedValue(new Error('Update failed'));

      await expect(markExpiredCertificates()).rejects.toThrow('Update failed');
    });
  });

  describe('Days Until Expiry Calculation', () => {
    it('should calculate positive days for future dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      mockDbExecute.mockResolvedValue({
        rows: [{
          certificate_id: 'cert-1',
          certificate_type: 'GAS',
          property_address: 'Test',
          property_id: 'prop-1',
          expiry_date: futureDate,
          organisation_id: 'org-123',
        }],
      });

      const result = await getCertificatesExpiringSoon(30, 'org-123');

      expect(result[0].daysUntilExpiry).toBeGreaterThanOrEqual(9);
      expect(result[0].daysUntilExpiry).toBeLessThanOrEqual(11);
    });
  });
});
