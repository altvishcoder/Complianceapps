import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import {
  rotateOldLogs,
  getLogRotationStats,
  startLogRotationScheduler,
  stopLogRotationScheduler,
} from '../server/services/log-rotation';

describe('Log Rotation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopLogRotationScheduler();
  });

  afterEach(() => {
    stopLogRotationScheduler();
  });

  describe('rotateOldLogs', () => {
    it('should return stats object', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const stats = await rotateOldLogs();

      expect(stats).toHaveProperty('filesScanned');
      expect(stats).toHaveProperty('filesDeleted');
      expect(stats).toHaveProperty('bytesFreed');
      expect(stats).toHaveProperty('totalSizeBytes');
      expect(stats).toHaveProperty('directoriesProcessed');
    });

    it('should skip non-existent directories', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const stats = await rotateOldLogs();

      expect(stats.directoriesProcessed).toHaveLength(0);
      expect(stats.filesScanned).toBe(0);
    });

    it('should scan .log files in directories', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => path === '/tmp/logs');
      vi.mocked(fs.readdirSync).mockReturnValue(['test.log', 'other.txt'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1024,
        mtime: new Date(),
      } as any);

      const stats = await rotateOldLogs();

      expect(stats.filesScanned).toBe(1);
    });

    it('should delete old files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['old.log'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1024,
        mtime: oldDate,
      } as any);

      const stats = await rotateOldLogs();

      expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalled();
      expect(stats.filesDeleted).toBeGreaterThanOrEqual(0);
    });

    it('should handle directory read errors', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const stats = await rotateOldLogs();

      expect(stats.filesScanned).toBe(0);
    });

    it('should track oldest and newest file dates', async () => {
      const date1 = new Date('2024-01-01');

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['file1.log'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 100, mtime: date1 } as any);

      const stats = await rotateOldLogs();

      expect(stats.oldestFileDate).not.toBeNull();
      expect(stats.newestFileDate).not.toBeNull();
    });
  });

  describe('getLogRotationStats', () => {
    it('should return config and null stats when no directories exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getLogRotationStats();

      expect(result.config).toBeDefined();
      expect(result.config.maxAgeDays).toBe(30);
      expect(result.config.maxSizeMB).toBe(100);
      expect(result.stats).toBeNull();
    });

    it('should return stats when directories exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['test.log'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 2048,
        mtime: new Date(),
      } as any);

      const result = getLogRotationStats();

      expect(result.stats).not.toBeNull();
      expect(result.stats?.filesScanned).toBeGreaterThanOrEqual(1);
      expect(result.stats?.totalSizeBytes).toBeGreaterThanOrEqual(2048);
    });

    it('should skip non-log files', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => path === '/tmp/logs');
      vi.mocked(fs.readdirSync).mockReturnValue(['readme.md', 'data.json'] as any);

      const result = getLogRotationStats();

      expect(result.stats?.filesScanned).toBe(0);
    });
  });

  describe('Log Rotation Scheduler', () => {
    it('should start scheduler without error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => startLogRotationScheduler()).not.toThrow();
    });

    it('should stop scheduler without error', () => {
      expect(() => stopLogRotationScheduler()).not.toThrow();
    });

    it('should handle multiple start calls', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      startLogRotationScheduler();
      startLogRotationScheduler();

      expect(() => stopLogRotationScheduler()).not.toThrow();
    });

    it('should handle stop when not started', () => {
      expect(() => stopLogRotationScheduler()).not.toThrow();
    });
  });

  describe('LogRotationStats Type', () => {
    it('should have correct initial values', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const stats = await rotateOldLogs();

      expect(stats.filesScanned).toBe(0);
      expect(stats.filesDeleted).toBe(0);
      expect(stats.bytesFreed).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.oldestFileDate).toBeNull();
      expect(stats.newestFileDate).toBeNull();
      expect(stats.directoriesProcessed).toEqual([]);
    });
  });

  describe('Configuration', () => {
    it('should have correct default config', () => {
      const result = getLogRotationStats();

      expect(result.config.maxAgeDays).toBe(30);
      expect(result.config.maxSizeMB).toBe(100);
      expect(result.config.logDirectories).toContain('/tmp/logs');
      expect(result.config.checkIntervalMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});
