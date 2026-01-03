import { logger } from '../logger';

interface ClientUploadState {
  activeUploads: number;
  lastUploadTime: number;
  uploadTokens: number;
  lastTokenRefill: number;
}

interface ThrottleConfig {
  maxConcurrentUploads: number;
  maxUploadsPerMinute: number;
  tokenRefillRateMs: number;
}

const DEFAULT_CONFIG: ThrottleConfig = {
  maxConcurrentUploads: 5,
  maxUploadsPerMinute: 30,
  tokenRefillRateMs: 2000,
};

const clientStates = new Map<string, ClientUploadState>();

function getClientState(clientId: string): ClientUploadState {
  if (!clientStates.has(clientId)) {
    clientStates.set(clientId, {
      activeUploads: 0,
      lastUploadTime: 0,
      uploadTokens: DEFAULT_CONFIG.maxUploadsPerMinute,
      lastTokenRefill: Date.now(),
    });
  }
  return clientStates.get(clientId)!;
}

function refillTokens(state: ClientUploadState, config: ThrottleConfig): void {
  const now = Date.now();
  const timeSinceRefill = now - state.lastTokenRefill;
  const tokensToAdd = Math.floor(timeSinceRefill / config.tokenRefillRateMs);
  
  if (tokensToAdd > 0) {
    state.uploadTokens = Math.min(config.maxUploadsPerMinute, state.uploadTokens + tokensToAdd);
    state.lastTokenRefill = now;
  }
}

export interface ThrottleResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  currentActive?: number;
  remainingTokens?: number;
}

export function acquireUploadSlot(
  clientId: string, 
  config: Partial<ThrottleConfig> = {}
): ThrottleResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const state = getClientState(clientId);
  
  refillTokens(state, fullConfig);
  
  if (state.activeUploads >= fullConfig.maxConcurrentUploads) {
    logger.warn({ clientId, activeUploads: state.activeUploads }, 'Upload throttled: max concurrent uploads reached');
    return {
      allowed: false,
      reason: `Maximum concurrent uploads (${fullConfig.maxConcurrentUploads}) reached. Please wait for existing uploads to complete.`,
      currentActive: state.activeUploads,
    };
  }
  
  if (state.uploadTokens <= 0) {
    const retryAfterMs = fullConfig.tokenRefillRateMs;
    logger.warn({ clientId, tokens: state.uploadTokens }, 'Upload throttled: rate limit exceeded');
    return {
      allowed: false,
      reason: 'Upload rate limit exceeded. Please wait before submitting more uploads.',
      retryAfterMs,
      remainingTokens: 0,
    };
  }
  
  state.activeUploads++;
  state.uploadTokens--;
  state.lastUploadTime = Date.now();
  logger.debug({ clientId, activeUploads: state.activeUploads }, 'Upload slot acquired atomically');
  
  return {
    allowed: true,
    currentActive: state.activeUploads,
    remainingTokens: state.uploadTokens,
  };
}

export function checkUploadThrottle(
  clientId: string, 
  config: Partial<ThrottleConfig> = {}
): ThrottleResult {
  return acquireUploadSlot(clientId, config);
}

export function releaseUploadSlot(clientId: string): void {
  const state = getClientState(clientId);
  state.activeUploads = Math.max(0, state.activeUploads - 1);
  logger.debug({ clientId, activeUploads: state.activeUploads }, 'Upload slot released');
}

export function endUpload(clientId: string): void {
  releaseUploadSlot(clientId);
}

export function getClientUploadStats(clientId: string): {
  activeUploads: number;
  remainingTokens: number;
} {
  const state = getClientState(clientId);
  refillTokens(state, DEFAULT_CONFIG);
  return {
    activeUploads: state.activeUploads,
    remainingTokens: state.uploadTokens,
  };
}

const processingFiles = new Set<string>();

export function acquireFileLock(fileKey: string): boolean {
  if (processingFiles.has(fileKey)) {
    logger.warn({ fileKey }, 'File lock acquisition failed: already processing');
    return false;
  }
  processingFiles.add(fileKey);
  logger.debug({ fileKey }, 'File lock acquired');
  return true;
}

export function releaseFileLock(fileKey: string): void {
  processingFiles.delete(fileKey);
  logger.debug({ fileKey }, 'File lock released');
}

export function isFileProcessing(fileKey: string): boolean {
  return processingFiles.has(fileKey);
}

setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;
  
  clientStates.forEach((state, clientId) => {
    if (now - state.lastUploadTime > staleThreshold && state.activeUploads === 0) {
      clientStates.delete(clientId);
    }
  });
  
  processingFiles.forEach((fileKey) => {
    const [, timestamp] = fileKey.split('::');
    if (timestamp && now - parseInt(timestamp) > 10 * 60 * 1000) {
      processingFiles.delete(fileKey);
      logger.warn({ fileKey }, 'Stale file lock cleaned up');
    }
  });
}, 60000);
