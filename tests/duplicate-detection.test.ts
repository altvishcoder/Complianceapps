import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateFileHash,
  checkForDuplicate,
  updateCertificateHash,
  getDuplicateStats,
  type DuplicateCheckResult,
  type DuplicateStats,
} from '../server/services/duplicate-detection';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    select: () => mockDbSelect(),
    update: () => mockDbUpdate(),
  },
}));

describe('Duplicate Detection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReset();
    mockDbUpdate.mockReset();
  });

  describe('calculateFileHash', () => {
    it('should return a SHA256 hash string', () => {
      const buffer = Buffer.from('test content');
      const hash = calculateFileHash(buffer);
      
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
    });

    it('should return consistent hash for same content', () => {
      const buffer1 = Buffer.from('identical content');
      const buffer2 = Buffer.from('identical content');
      
      expect(calculateFileHash(buffer1)).toBe(calculateFileHash(buffer2));
    });

    it('should return different hash for different content', () => {
      const buffer1 = Buffer.from('content A');
      const buffer2 = Buffer.from('content B');
      
      expect(calculateFileHash(buffer1)).not.toBe(calculateFileHash(buffer2));
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from('');
      const hash = calculateFileHash(buffer);
      
      expect(hash).toHaveLength(64);
    });

    it('should handle binary content', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const hash = calculateFileHash(buffer);
      
      expect(hash).toHaveLength(64);
    });

    it('should produce valid hex string', () => {
      const buffer = Buffer.from('test');
      const hash = calculateFileHash(buffer);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('DuplicateCheckResult Type', () => {
    it('should represent non-duplicate result', () => {
      const result: DuplicateCheckResult = {
        isDuplicate: false,
        existingCertificateId: null,
        existingCertificate: null,
        fileHash: 'abc123',
      };
      
      expect(result.isDuplicate).toBe(false);
      expect(result.existingCertificateId).toBeNull();
    });

    it('should represent duplicate result', () => {
      const result: DuplicateCheckResult = {
        isDuplicate: true,
        existingCertificateId: 'cert-123',
        existingCertificate: { id: 'cert-123' } as any,
        fileHash: 'abc123',
      };
      
      expect(result.isDuplicate).toBe(true);
      expect(result.existingCertificateId).toBe('cert-123');
    });
  });

  describe('checkForDuplicate', () => {
    it('should return isDuplicate false when no existing certificate', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const buffer = Buffer.from('unique content');
      const result = await checkForDuplicate(buffer, 'org-123');

      expect(result.isDuplicate).toBe(false);
      expect(result.existingCertificateId).toBeNull();
      expect(result.existingCertificate).toBeNull();
      expect(result.fileHash).toHaveLength(64);
    });

    it('should return isDuplicate true when existing certificate found', async () => {
      const existingCert = { id: 'cert-456', fileName: 'test.pdf', fileHash: 'somehash' };
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingCert]),
          }),
        }),
      });

      const buffer = Buffer.from('duplicate content');
      const result = await checkForDuplicate(buffer, 'org-123');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingCertificateId).toBe('cert-456');
      expect(result.existingCertificate).toEqual(existingCert);
    });

    it('should include calculated hash in result', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const buffer = Buffer.from('test content');
      const result = await checkForDuplicate(buffer, 'org-123');
      const expectedHash = calculateFileHash(buffer);

      expect(result.fileHash).toBe(expectedHash);
    });
  });

  describe('updateCertificateHash', () => {
    it('should update certificate with new hash', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDbUpdate.mockReturnValue({
        set: mockSet,
      });

      await updateCertificateHash('cert-123', 'newhash123');

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ fileHash: 'newhash123' });
    });
  });

  describe('DuplicateStats Type', () => {
    it('should have correct structure', () => {
      const stats: DuplicateStats = {
        totalCertificates: 100,
        uniqueHashes: 95,
        duplicateCount: 5,
        duplicatesByType: { 'GAS': 3, 'EICR': 2 },
      };
      
      expect(stats.totalCertificates).toBe(100);
      expect(stats.uniqueHashes).toBe(95);
      expect(stats.duplicateCount).toBe(5);
      expect(Object.keys(stats.duplicatesByType)).toHaveLength(2);
    });
  });

  describe('getDuplicateStats', () => {
    it('should return empty stats when no certificates', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const stats = await getDuplicateStats('org-123');

      expect(stats.totalCertificates).toBe(0);
      expect(stats.uniqueHashes).toBe(0);
      expect(stats.duplicateCount).toBe(0);
      expect(stats.duplicatesByType).toEqual({});
    });

    it('should count duplicates correctly', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: '1', fileHash: 'hash1', certificateType: 'GAS' },
            { id: '2', fileHash: 'hash1', certificateType: 'GAS' },
            { id: '3', fileHash: 'hash2', certificateType: 'EICR' },
            { id: '4', fileHash: 'hash3', certificateType: 'FRA' },
          ]),
        }),
      });

      const stats = await getDuplicateStats('org-123');

      expect(stats.totalCertificates).toBe(4);
      expect(stats.uniqueHashes).toBe(3);
      expect(stats.duplicateCount).toBe(1);
    });

    it('should handle certificates without hash', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: '1', fileHash: null, certificateType: 'GAS' },
            { id: '2', fileHash: 'hash1', certificateType: 'GAS' },
          ]),
        }),
      });

      const stats = await getDuplicateStats('org-123');

      expect(stats.totalCertificates).toBe(2);
      expect(stats.uniqueHashes).toBe(1);
    });
  });
});
