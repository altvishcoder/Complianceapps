import { logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';

const LOG_ROTATION_CONFIG = {
  maxAgeDays: 30,
  maxSizeMB: 100,
  logDirectories: ['/tmp/logs', 'server/runtime/logs'], // Check both locations
  checkIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
};

interface LogRotationStats {
  filesScanned: number;
  filesDeleted: number;
  bytesFreed: number;
  totalSizeBytes: number;
  oldestFileDate: Date | null;
  newestFileDate: Date | null;
  directoriesProcessed: string[];
}

interface LogFileInfo {
  path: string;
  size: number;
  mtime: Date;
}

export async function rotateOldLogs(): Promise<LogRotationStats> {
  const stats: LogRotationStats = {
    filesScanned: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    totalSizeBytes: 0,
    oldestFileDate: null,
    newestFileDate: null,
    directoriesProcessed: [],
  };
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOG_ROTATION_CONFIG.maxAgeDays);
  const maxSizeBytes = LOG_ROTATION_CONFIG.maxSizeMB * 1024 * 1024;
  
  // Collect all log files from all directories
  const allLogFiles: LogFileInfo[] = [];
  
  for (const logDir of LOG_ROTATION_CONFIG.logDirectories) {
    if (!fs.existsSync(logDir)) continue;
    stats.directoriesProcessed.push(logDir);
    
    try {
      const files = fs.readdirSync(logDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(logDir, file);
        
        try {
          const fileStat = fs.statSync(filePath);
          allLogFiles.push({
            path: filePath,
            size: fileStat.size,
            mtime: fileStat.mtime,
          });
          stats.filesScanned++;
          stats.totalSizeBytes += fileStat.size;
          
          // Track oldest and newest
          if (!stats.oldestFileDate || fileStat.mtime < stats.oldestFileDate) {
            stats.oldestFileDate = fileStat.mtime;
          }
          if (!stats.newestFileDate || fileStat.mtime > stats.newestFileDate) {
            stats.newestFileDate = fileStat.mtime;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      logger.warn({ logDir, error }, 'Failed to read log directory');
    }
  }
  
  // Sort files by modification time (oldest first)
  allLogFiles.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
  
  // Phase 1: Delete files older than cutoff date
  for (const fileInfo of allLogFiles) {
    if (fileInfo.mtime < cutoffDate) {
      try {
        fs.unlinkSync(fileInfo.path);
        stats.filesDeleted++;
        stats.bytesFreed += fileInfo.size;
        stats.totalSizeBytes -= fileInfo.size;
        logger.info({ 
          file: path.basename(fileInfo.path), 
          age: Math.floor((Date.now() - fileInfo.mtime.getTime()) / (24 * 60 * 60 * 1000)) 
        }, 'Deleted old log file');
      } catch (fileError) {
        logger.warn({ file: fileInfo.path, error: fileError }, 'Failed to delete log file');
      }
    }
  }
  
  // Phase 2: If still over size limit, delete oldest files until under limit
  const remainingFiles = allLogFiles.filter(f => f.mtime >= cutoffDate);
  let currentSize = stats.totalSizeBytes;
  
  for (const fileInfo of remainingFiles) {
    if (currentSize <= maxSizeBytes) break;
    
    try {
      fs.unlinkSync(fileInfo.path);
      stats.filesDeleted++;
      stats.bytesFreed += fileInfo.size;
      currentSize -= fileInfo.size;
      logger.info({ 
        file: path.basename(fileInfo.path), 
        reason: 'size_limit' 
      }, 'Deleted log file to stay under size limit');
    } catch (fileError) {
      logger.warn({ file: fileInfo.path, error: fileError }, 'Failed to delete log file');
    }
  }
  
  stats.totalSizeBytes = currentSize;
  
  logger.info({
    filesScanned: stats.filesScanned,
    filesDeleted: stats.filesDeleted,
    bytesFreed: stats.bytesFreed,
    mbFreed: Math.round(stats.bytesFreed / 1024 / 1024 * 100) / 100,
    totalSizeMB: Math.round(stats.totalSizeBytes / 1024 / 1024 * 100) / 100,
    maxSizeMB: LOG_ROTATION_CONFIG.maxSizeMB,
  }, 'Log rotation completed');
  
  return stats;
}

export function getLogRotationStats(): { config: typeof LOG_ROTATION_CONFIG; stats: LogRotationStats | null } {
  const stats: LogRotationStats = {
    filesScanned: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    totalSizeBytes: 0,
    oldestFileDate: null,
    newestFileDate: null,
    directoriesProcessed: [],
  };
  
  for (const logDir of LOG_ROTATION_CONFIG.logDirectories) {
    if (!fs.existsSync(logDir)) continue;
    stats.directoriesProcessed.push(logDir);
    
    try {
      const files = fs.readdirSync(logDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        stats.filesScanned++;
        const filePath = path.join(logDir, file);
        
        try {
          const fileStat = fs.statSync(filePath);
          stats.totalSizeBytes += fileStat.size;
          
          if (!stats.oldestFileDate || fileStat.mtime < stats.oldestFileDate) {
            stats.oldestFileDate = fileStat.mtime;
          }
          if (!stats.newestFileDate || fileStat.mtime > stats.newestFileDate) {
            stats.newestFileDate = fileStat.mtime;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }
  
  if (stats.directoriesProcessed.length === 0) {
    return { config: LOG_ROTATION_CONFIG, stats: null };
  }
  
  return { config: LOG_ROTATION_CONFIG, stats };
}

let rotationInterval: NodeJS.Timeout | null = null;

export function startLogRotationScheduler(): void {
  if (rotationInterval) {
    clearInterval(rotationInterval);
  }
  
  // Run immediately on startup
  rotateOldLogs().catch(err => logger.error({ err }, 'Initial log rotation failed'));
  
  // Schedule periodic rotation
  rotationInterval = setInterval(() => {
    rotateOldLogs().catch(err => logger.error({ err }, 'Scheduled log rotation failed'));
  }, LOG_ROTATION_CONFIG.checkIntervalMs);
  
  logger.info({ intervalHours: LOG_ROTATION_CONFIG.checkIntervalMs / (60 * 60 * 1000) }, 'Log rotation scheduler started');
}

export function stopLogRotationScheduler(): void {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
    logger.info('Log rotation scheduler stopped');
  }
}
