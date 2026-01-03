import { storage } from '../storage';
import { logger } from '../logger';

interface ErrorWindow {
  count: number;
  windowStart: number;
}

let cachedConfig: {
  threshold: number;
  windowMinutes: number;
  webhookUrl: string;
  webhookEnabled: boolean;
} | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000;

const errorWindows = new Map<string, ErrorWindow>();

async function getAlertingConfig() {
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const [threshold, windowMinutes, webhookUrl, webhookEnabled] = await Promise.all([
      storage.getFactorySettingValue('monitoring_error_threshold', '10'),
      storage.getFactorySettingValue('monitoring_error_window_minutes', '5'),
      storage.getFactorySettingValue('monitoring_webhook_url', ''),
      storage.getFactorySettingValue('monitoring_webhook_enabled', 'false'),
    ]);

    cachedConfig = {
      threshold: parseInt(threshold, 10) || 10,
      windowMinutes: parseInt(windowMinutes, 10) || 5,
      webhookUrl,
      webhookEnabled: webhookEnabled === 'true',
    };
    configCacheTime = now;
    return cachedConfig;
  } catch (error) {
    logger.warn({ error }, 'Failed to load alerting config, using defaults');
    return {
      threshold: 10,
      windowMinutes: 5,
      webhookUrl: '',
      webhookEnabled: false,
    };
  }
}

export async function trackError(category: string, errorMessage: string, context?: Record<string, unknown>) {
  const config = await getAlertingConfig();
  const now = Date.now();
  const windowMs = config.windowMinutes * 60 * 1000;

  let window = errorWindows.get(category);
  
  if (!window || now - window.windowStart > windowMs) {
    window = { count: 0, windowStart: now };
    errorWindows.set(category, window);
  }

  window.count++;

  if (window.count >= config.threshold) {
    await sendAlert(category, window.count, errorMessage, context);
    window.count = 0;
    window.windowStart = now;
  }
}

async function sendAlert(category: string, errorCount: number, lastError: string, context?: Record<string, unknown>) {
  const config = await getAlertingConfig();
  
  logger.error({
    alertType: 'error_threshold_exceeded',
    category,
    errorCount,
    lastError,
    context,
  }, `Alert: ${category} exceeded error threshold (${errorCount} errors)`);

  if (!config.webhookEnabled || !config.webhookUrl) {
    return;
  }

  try {
    const payload = {
      alert: 'error_threshold_exceeded',
      service: 'complianceai',
      category,
      errorCount,
      threshold: config.threshold,
      windowMinutes: config.windowMinutes,
      lastError,
      context,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Alert webhook returned non-OK status');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to send alert webhook');
  }
}

export function clearAlertingCache() {
  cachedConfig = null;
  configCacheTime = 0;
}

export async function testAlertWebhook(): Promise<{ success: boolean; message: string }> {
  const config = await getAlertingConfig();
  
  if (!config.webhookUrl) {
    return { success: false, message: 'No webhook URL configured' };
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'test',
        service: 'complianceai',
        message: 'This is a test alert from ComplianceAI',
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      return { success: true, message: 'Test alert sent successfully' };
    } else {
      return { success: false, message: `Webhook returned status ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: `Failed to send: ${error}` };
  }
}
