import { storage } from '../storage';
import { logger } from '../logger';

export interface SecurityConfig {
  cspEnabled: boolean;
  hstsMaxAge: number;
  hstsIncludeSubdomains: boolean;
  hstsPreload: boolean;
  xssProtection: boolean;
}

export interface CompressionConfig {
  threshold: number;
  level: number;
}

export async function loadSecurityConfig(): Promise<SecurityConfig> {
  try {
    const [cspEnabled, hstsMaxAge, hstsIncludeSubdomains, hstsPreload, xssProtection] = await Promise.all([
      storage.getFactorySettingValue('security_csp_enabled', 'true'),
      storage.getFactorySettingValue('security_hsts_max_age', '31536000'),
      storage.getFactorySettingValue('security_hsts_include_subdomains', 'true'),
      storage.getFactorySettingValue('security_hsts_preload', 'false'),
      storage.getFactorySettingValue('security_xss_protection', 'true'),
    ]);

    return {
      cspEnabled: cspEnabled === 'true',
      hstsMaxAge: parseInt(hstsMaxAge, 10) || 31536000,
      hstsIncludeSubdomains: hstsIncludeSubdomains === 'true',
      hstsPreload: hstsPreload === 'true',
      xssProtection: xssProtection === 'true',
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load security config from Factory Settings, using defaults');
    return {
      cspEnabled: true,
      hstsMaxAge: 31536000,
      hstsIncludeSubdomains: true,
      hstsPreload: false,
      xssProtection: true,
    };
  }
}

export async function loadCompressionConfig(): Promise<CompressionConfig> {
  try {
    const [threshold, level] = await Promise.all([
      storage.getFactorySettingValue('performance_compression_threshold', '1024'),
      storage.getFactorySettingValue('performance_compression_level', '6'),
    ]);

    return {
      threshold: parseInt(threshold, 10) || 1024,
      level: Math.min(9, Math.max(1, parseInt(level, 10) || 6)),
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to load compression config from Factory Settings, using defaults');
    return {
      threshold: 1024,
      level: 6,
    };
  }
}
