import { Router } from "express";
import { requireRole } from "../../session";
import { storage } from "../../storage";
import { ORG_ID, SUPER_ADMIN_ROLES, hashApiKey, requireAdminRole } from "./utils";

export const integrationsOutboundRouter = Router();

integrationsOutboundRouter.get("/admin/webhooks", async (req, res) => {
  try {
    const webhooks = await storage.listWebhookEndpoints(ORG_ID);
    res.json(webhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

integrationsOutboundRouter.post("/admin/webhooks", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const { name, url, authType, authValue, headers, events, retryCount, timeoutMs } = req.body;
    
    if (!name || !url || !events || events.length === 0) {
      return res.status(400).json({ error: "Name, URL, and at least one event are required" });
    }
    
    const webhook = await storage.createWebhookEndpoint({
      organisationId: ORG_ID,
      name,
      url,
      authType: authType || 'NONE',
      authValue,
      headers,
      events,
      retryCount: retryCount || 3,
      timeoutMs: timeoutMs || 30000,
    });
    
    res.status(201).json(webhook);
  } catch (error) {
    console.error("Error creating webhook:", error);
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

integrationsOutboundRouter.patch("/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const webhook = await storage.updateWebhookEndpoint(req.params.id, req.body);
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json(webhook);
  } catch (error) {
    console.error("Error updating webhook:", error);
    res.status(500).json({ error: "Failed to update webhook" });
  }
});

integrationsOutboundRouter.delete("/admin/webhooks/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const deleted = await storage.deleteWebhookEndpoint(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

integrationsOutboundRouter.post("/admin/webhooks/:id/test", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const webhook = await storage.getWebhookEndpoint(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from ComplianceAI'
      }
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Source': 'ComplianceAI',
      ...(webhook.headers as Record<string, string> || {})
    };
    
    if (webhook.authType === 'API_KEY' && webhook.authValue) {
      headers['X-API-Key'] = webhook.authValue;
    } else if (webhook.authType === 'BEARER' && webhook.authValue) {
      headers['Authorization'] = `Bearer ${webhook.authValue}`;
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(webhook.timeoutMs)
      });
      
      const duration = Date.now() - startTime;
      const responseText = await response.text();
      
      res.json({
        success: response.ok,
        status: response.status,
        duration,
        responsePreview: responseText.substring(0, 500)
      });
    } catch (fetchError: any) {
      const duration = Date.now() - startTime;
      res.json({
        success: false,
        status: 0,
        duration,
        error: fetchError.message || 'Connection failed'
      });
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({ error: "Failed to test webhook" });
  }
});

integrationsOutboundRouter.get("/admin/webhook-deliveries", async (req, res) => {
  try {
    const webhookId = req.query.webhookId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const deliveries = await storage.listWebhookDeliveries(webhookId, limit);
    res.json(deliveries);
  } catch (error) {
    console.error("Error fetching webhook deliveries:", error);
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});

integrationsOutboundRouter.get("/admin/webhook-events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await storage.listWebhookEvents(limit);
    res.json(events);
  } catch (error) {
    console.error("Error fetching webhook events:", error);
    res.status(500).json({ error: "Failed to fetch webhook events" });
  }
});

integrationsOutboundRouter.get("/admin/api-keys", async (req, res) => {
  try {
    const keys = await storage.listApiKeys(ORG_ID);
    res.json(keys.map(k => ({ ...k, keyHash: undefined })));
  } catch (error) {
    console.error("Error fetching API keys:", error);
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

integrationsOutboundRouter.post("/admin/api-keys", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const { name, scopes, expiresAt } = req.body;
    
    if (!name || !scopes || scopes.length === 0) {
      return res.status(400).json({ error: "Name and at least one scope are required" });
    }
    
    const rawKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = await hashApiKey(rawKey);
    
    const apiKey = await storage.createApiKey({
      organisationId: ORG_ID,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true
    });
    
    res.status(201).json({ 
      ...apiKey, 
      keyHash: undefined,
      key: rawKey
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(500).json({ error: "Failed to create API key" });
  }
});

integrationsOutboundRouter.delete("/admin/api-keys/:id", requireRole(...SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const deleted = await storage.deleteApiKey(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "API key not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

integrationsOutboundRouter.get("/admin/api-clients", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const orgId = req.query.organisationId as string || "default-org";
    const clients = await storage.listApiClients(orgId);
    res.json(clients);
  } catch (error) {
    console.error("Error listing API clients:", error);
    res.status(500).json({ error: "Failed to list API clients" });
  }
});

integrationsOutboundRouter.post("/admin/api-clients", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { name, description, scopes, organisationId, createdById } = req.body;
    
    const apiKey = `cai_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPrefix = apiKey.substring(0, 12);
    const keyHash = await hashApiKey(apiKey);
    
    const rateLimit = parseInt(await storage.getFactorySettingValue('RATE_LIMIT_REQUESTS_PER_MINUTE', '60'));
    const expiryDays = parseInt(await storage.getFactorySettingValue('API_KEY_EXPIRY_DAYS', '365'));
    
    const client = await storage.createApiClient({
      name,
      description,
      organisationId: organisationId || 'default-org',
      apiKey: keyHash,
      apiKeyPrefix: keyPrefix,
      scopes: scopes || ['read', 'write'],
      createdById: createdById || 'system'
    });
    
    res.json({ ...client, apiKey });
  } catch (error) {
    console.error("Error creating API client:", error);
    res.status(500).json({ error: "Failed to create API client" });
  }
});

integrationsOutboundRouter.patch("/admin/api-clients/:id", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const { isActive, name, description, scopes } = req.body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (scopes !== undefined) updates.scopes = scopes;
    if (isActive !== undefined) updates.status = isActive ? 'ACTIVE' : 'SUSPENDED';
    
    const updated = await storage.updateApiClient(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: "API client not found" });
    }
    res.json({ ...updated, isActive: updated.status === 'ACTIVE' });
  } catch (error) {
    console.error("Error updating API client:", error);
    res.status(500).json({ error: "Failed to update API client" });
  }
});

integrationsOutboundRouter.delete("/admin/api-clients/:id", async (req, res) => {
  try {
    if (!await requireAdminRole(req, res)) return;
    
    const success = await storage.deleteApiClient(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "API client not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting API client:", error);
    res.status(500).json({ error: "Failed to delete API client" });
  }
});
