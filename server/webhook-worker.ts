import { storage } from "./storage";
import type { WebhookEndpoint, WebhookEvent } from "@shared/schema";

const RETRY_DELAYS = [1000, 5000, 30000, 120000, 300000];

export async function enqueueWebhookEvent(
  eventType: string, 
  entityType: string, 
  entityId: string, 
  payload: any
) {
  try {
    await storage.createWebhookEvent({
      eventType,
      entityType,
      entityId,
      payload
    });
    console.log(`Webhook event queued: ${eventType} for ${entityType}/${entityId}`);
  } catch (error) {
    console.error("Failed to enqueue webhook event:", error);
  }
}

export async function processWebhookQueue() {
  try {
    const pendingEvents = await storage.getPendingWebhookEvents();
    
    for (const event of pendingEvents) {
      const webhooks = await storage.getActiveWebhooksForEvent(event.eventType);
      
      if (webhooks.length === 0) {
        await storage.markWebhookEventProcessed(event.id);
        continue;
      }
      
      for (const webhook of webhooks) {
        await deliverWebhook(webhook, event);
      }
      
      await storage.markWebhookEventProcessed(event.id);
    }
  } catch (error) {
    console.error("Error processing webhook queue:", error);
  }
}

async function deliverWebhook(webhook: WebhookEndpoint, event: WebhookEvent) {
  const delivery = await storage.createWebhookDelivery({
    webhookEndpointId: webhook.id,
    eventId: event.id,
    status: 'PENDING',
    attemptCount: 0
  });
  
  await attemptDelivery(delivery.id, webhook, event);
}

async function attemptDelivery(
  deliveryId: string,
  webhook: WebhookEndpoint,
  event: WebhookEvent
) {
  const delivery = await storage.updateWebhookDelivery(deliveryId, {
    attemptCount: 1,
    lastAttemptAt: new Date()
  });
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Source': 'ComplianceAI',
    'X-Webhook-Event': event.eventType,
    'X-Webhook-Delivery': deliveryId,
    ...(webhook.headers as Record<string, string> || {})
  };
  
  if (webhook.authType === 'API_KEY' && webhook.authValue) {
    headers['X-API-Key'] = webhook.authValue;
  } else if (webhook.authType === 'BEARER' && webhook.authValue) {
    headers['Authorization'] = `Bearer ${webhook.authValue}`;
  } else if (webhook.authType === 'HMAC_SHA256' && webhook.authValue) {
    const signature = await signPayload(JSON.stringify(event.payload), webhook.authValue);
    headers['X-Webhook-Signature'] = signature;
  }
  
  const payload = {
    event: event.eventType,
    timestamp: new Date().toISOString(),
    deliveryId,
    data: event.payload
  };
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhook.timeoutMs)
    });
    
    const duration = Date.now() - startTime;
    const responseBody = await response.text();
    
    if (response.ok) {
      await storage.updateWebhookDelivery(deliveryId, {
        status: 'SENT',
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        duration
      });
      
      await storage.updateWebhookEndpoint(webhook.id, {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: 'success',
        failureCount: 0
      });
    } else {
      await handleDeliveryFailure(deliveryId, webhook, event, response.status, responseBody, duration);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await handleDeliveryFailure(deliveryId, webhook, event, 0, error.message || 'Connection failed', duration);
  }
}

async function handleDeliveryFailure(
  deliveryId: string,
  webhook: WebhookEndpoint,
  event: WebhookEvent,
  statusCode: number,
  errorMessage: string,
  duration: number
) {
  const delivery = await storage.updateWebhookDelivery(deliveryId, {
    status: 'RETRYING',
    responseStatus: statusCode,
    errorMessage,
    duration
  });
  
  if (!delivery) return;
  
  const attemptCount = delivery.attemptCount;
  const newFailureCount = (webhook.failureCount || 0) + 1;
  
  await storage.updateWebhookEndpoint(webhook.id, {
    lastDeliveryAt: new Date(),
    lastDeliveryStatus: 'failed',
    failureCount: newFailureCount,
    status: newFailureCount >= 10 ? 'FAILED' : webhook.status
  });
  
  if (attemptCount < webhook.retryCount) {
    const retryDelay = RETRY_DELAYS[Math.min(attemptCount, RETRY_DELAYS.length - 1)];
    const nextRetryAt = new Date(Date.now() + retryDelay);
    
    await storage.updateWebhookDelivery(deliveryId, {
      nextRetryAt
    });
    
    setTimeout(async () => {
      await retryDelivery(deliveryId, webhook, event, attemptCount + 1);
    }, retryDelay);
  } else {
    await storage.updateWebhookDelivery(deliveryId, {
      status: 'FAILED'
    });
  }
}

async function retryDelivery(
  deliveryId: string,
  webhook: WebhookEndpoint,
  event: WebhookEvent,
  attemptNumber: number
) {
  console.log(`Retrying webhook delivery ${deliveryId}, attempt ${attemptNumber}`);
  
  await storage.updateWebhookDelivery(deliveryId, {
    attemptCount: attemptNumber,
    lastAttemptAt: new Date()
  });
  
  const payload = {
    event: event.eventType,
    timestamp: new Date().toISOString(),
    deliveryId,
    data: event.payload
  };
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Source': 'ComplianceAI',
    'X-Webhook-Event': event.eventType,
    'X-Webhook-Delivery': deliveryId,
    'X-Webhook-Retry': attemptNumber.toString(),
    ...(webhook.headers as Record<string, string> || {})
  };
  
  if (webhook.authType === 'API_KEY' && webhook.authValue) {
    headers['X-API-Key'] = webhook.authValue;
  } else if (webhook.authType === 'BEARER' && webhook.authValue) {
    headers['Authorization'] = `Bearer ${webhook.authValue}`;
  } else if (webhook.authType === 'HMAC_SHA256' && webhook.authValue) {
    const signature = await signPayload(JSON.stringify(payload), webhook.authValue);
    headers['X-Webhook-Signature'] = signature;
  }
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhook.timeoutMs)
    });
    
    const duration = Date.now() - startTime;
    const responseBody = await response.text();
    
    if (response.ok) {
      await storage.updateWebhookDelivery(deliveryId, {
        status: 'SENT',
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        duration
      });
      
      await storage.updateWebhookEndpoint(webhook.id, {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: 'success',
        failureCount: 0
      });
    } else {
      await handleDeliveryFailure(deliveryId, webhook, event, response.status, responseBody, duration);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await handleDeliveryFailure(deliveryId, webhook, event, 0, error.message || 'Connection failed', duration);
  }
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startWebhookWorker(intervalMs: number = 5000) {
  if (workerInterval) return;
  
  console.log('Starting webhook worker...');
  workerInterval = setInterval(processWebhookQueue, intervalMs);
  processWebhookQueue();
}

export function stopWebhookWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('Webhook worker stopped');
  }
}
