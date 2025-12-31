import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Webhook, Key, ArrowDownToLine, Book, Plus, Trash2, TestTube2, 
  CheckCircle, XCircle, Clock, Copy, Eye, EyeOff
} from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Integrations" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6" role="main" aria-label="Integrations content">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Integrations</h1>
              <p className="text-muted-foreground">
                Connect ComplianceAI with your Housing Management System and other tools
              </p>
            </div>

            <Tabs defaultValue="webhooks" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
                <TabsTrigger value="webhooks" className="gap-2">
                  <Webhook className="h-4 w-4" />
                  <span className="hidden sm:inline">Webhooks</span>
                </TabsTrigger>
                <TabsTrigger value="api-keys" className="gap-2">
                  <Key className="h-4 w-4" />
                  <span className="hidden sm:inline">API Keys</span>
                </TabsTrigger>
                <TabsTrigger value="incoming" className="gap-2">
                  <ArrowDownToLine className="h-4 w-4" />
                  <span className="hidden sm:inline">Incoming</span>
                </TabsTrigger>
                <TabsTrigger value="guide" className="gap-2">
                  <Book className="h-4 w-4" />
                  <span className="hidden sm:inline">Guide</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="webhooks">
                <WebhooksTab />
              </TabsContent>
              <TabsContent value="api-keys">
                <ApiKeysTab />
              </TabsContent>
              <TabsContent value="incoming">
                <IncomingWebhooksTab />
              </TabsContent>
              <TabsContent value="guide">
                <IntegrationGuideTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

function WebhooksTab() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    authType: "NONE",
    authValue: "",
    events: [] as string[],
    retryCount: 3,
    timeoutMs: 30000
  });

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["/api/admin/webhooks"],
    queryFn: () => fetch("/api/admin/webhooks", { credentials: 'include' }).then(r => r.json())
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["/api/admin/webhook-deliveries"],
    queryFn: () => fetch("/api/admin/webhook-deliveries?limit=50", { credentials: 'include' }).then(r => r.json())
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newWebhook) =>
      fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/webhooks"] });
      setShowDialog(false);
      toast.success("Webhook created successfully");
      setNewWebhook({ name: "", url: "", authType: "NONE", authValue: "", events: [], retryCount: 3, timeoutMs: 30000 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/webhooks/${id}`, { method: "DELETE", credentials: 'include' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/webhooks"] });
      toast.success("Webhook deleted");
    }
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/webhooks/${id}/test`, { method: "POST", credentials: 'include' }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Test successful! Status: ${data.status}, Duration: ${data.duration}ms`);
      } else {
        toast.error(`Test failed: ${data.error || `Status ${data.status}`}`);
      }
    }
  });

  const eventTypes = [
    "action.created", "action.updated", "action.completed",
    "certificate.created", "certificate.expiring",
    "property.created", "property.updated"
  ];

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Outgoing Webhooks</CardTitle>
              <CardDescription>
                Send real-time notifications when events occur in ComplianceAI
              </CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-webhook">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Webhook</DialogTitle>
                  <DialogDescription>
                    Configure a new webhook endpoint to receive events
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Name</Label>
                    <Input
                      id="webhook-name"
                      placeholder="HMS Integration"
                      value={newWebhook.name}
                      onChange={e => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-webhook-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-hms.com/webhooks"
                      value={newWebhook.url}
                      onChange={e => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                      data-testid="input-webhook-url"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Authentication</Label>
                      <Select
                        value={newWebhook.authType}
                        onValueChange={v => setNewWebhook(prev => ({ ...prev, authType: v }))}
                      >
                        <SelectTrigger data-testid="select-auth-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="API_KEY">API Key</SelectItem>
                          <SelectItem value="BEARER">Bearer Token</SelectItem>
                          <SelectItem value="HMAC_SHA256">HMAC SHA256</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newWebhook.authType !== "NONE" && (
                      <div className="space-y-2">
                        <Label htmlFor="auth-value">Secret/Key</Label>
                        <Input
                          id="auth-value"
                          type="password"
                          placeholder="Enter secret"
                          value={newWebhook.authValue}
                          onChange={e => setNewWebhook(prev => ({ ...prev, authValue: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Events to Subscribe</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {eventTypes.map(event => (
                        <label key={event} className="flex items-center space-x-2 cursor-pointer">
                          <Checkbox
                            checked={newWebhook.events.includes(event)}
                            onCheckedChange={() => toggleEvent(event)}
                          />
                          <span className="text-sm">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => createMutation.mutate(newWebhook)}
                    disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                    data-testid="button-create-webhook"
                  >
                    Create Webhook
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-muted-foreground">No webhooks configured yet.</p>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook: any) => (
                <div key={webhook.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      <Badge variant={webhook.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {webhook.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{webhook.url}</p>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.events.map((e: string) => (
                        <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => testMutation.mutate(webhook.id)}
                      data-testid={`button-test-webhook-${webhook.id}`}
                    >
                      <TestTube2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteMutation.mutate(webhook.id)}
                      data-testid={`button-delete-webhook-${webhook.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
          <CardDescription>Last 50 webhook delivery attempts</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {deliveries.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b text-sm">
                  <div className="flex items-center gap-2">
                    {d.status === 'SENT' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : d.status === 'FAILED' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span>{d.status}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {d.responseStatus ? `HTTP ${d.responseStatus}` : d.errorMessage || '-'}
                  </span>
                  <span className="text-muted-foreground">{d.duration}ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", scopes: [] as string[] });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => fetch("/api/admin/api-keys", { credentials: 'include' }).then(r => r.json())
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newKey) =>
      fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data)
      }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setCreatedKey(data.key);
      toast.success("API key created. Copy it now - it won't be shown again!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/api-keys/${id}`, { method: "DELETE", credentials: 'include' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast.success("API key revoked");
    }
  });

  const scopes = ["read:properties", "read:certificates", "read:actions", "write:actions", "webhooks"];

  const toggleScope = (scope: string) => {
    setNewKey(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success("API key copied to clipboard");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Generate keys for external systems to access ComplianceAI APIs
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              setCreatedKey(null);
              setNewKey({ name: "", scopes: [] });
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-api-key">
                <Plus className="h-4 w-4 mr-2" />
                Generate Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {createdKey ? "API Key Created" : "Generate API Key"}
                </DialogTitle>
                <DialogDescription>
                  {createdKey 
                    ? "Copy this key now. It won't be displayed again."
                    : "Create a new API key with specific permissions"
                  }
                </DialogDescription>
              </DialogHeader>
              {createdKey ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      value={showKey ? createdKey : createdKey.replace(/./g, '•')}
                      readOnly
                      className="pr-20 font-mono"
                    />
                    <div className="absolute right-1 top-1 flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={copyKey}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setShowDialog(false)}>
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      placeholder="HMS Production"
                      value={newKey.name}
                      onChange={e => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-api-key-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="space-y-2">
                      {scopes.map(scope => (
                        <label key={scope} className="flex items-center space-x-2 cursor-pointer">
                          <Checkbox
                            checked={newKey.scopes.includes(scope)}
                            onCheckedChange={() => toggleScope(scope)}
                          />
                          <span className="text-sm">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => createMutation.mutate(newKey)}
                    disabled={!newKey.name || newKey.scopes.length === 0}
                    data-testid="button-create-api-key"
                  >
                    Generate Key
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : apiKeys.length === 0 ? (
          <p className="text-muted-foreground">No API keys generated yet.</p>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((key: any) => (
              <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    <Badge variant={key.isActive ? 'default' : 'secondary'}>
                      {key.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    {key.keyPrefix}...
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {key.scopes.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteMutation.mutate(key.id)}
                  data-testid={`button-revoke-key-${key.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IncomingWebhooksTab() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["/api/admin/incoming-webhooks"],
    queryFn: () => fetch("/api/admin/incoming-webhooks?limit=100", { credentials: 'include' }).then(r => r.json())
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incoming Webhook Logs</CardTitle>
        <CardDescription>
          Requests received from external systems (HMS, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground">No incoming webhooks received yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="p-3 border rounded-lg text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{log.source}</Badge>
                    <span className="font-medium">{log.eventType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.processed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {log.errorMessage && (
                  <p className="text-red-500 text-xs">{log.errorMessage}</p>
                )}
                <details className="mt-2">
                  <summary className="text-muted-foreground cursor-pointer text-xs">View Payload</summary>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationGuideTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integration Guide</CardTitle>
          <CardDescription>
            How to connect your Housing Management System with ComplianceAI
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h3 className="text-lg font-semibold mt-4">1. Receiving Data from ComplianceAI (Webhooks)</h3>
          <p>ComplianceAI can notify your HMS when events occur:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>action.created</strong> - New remedial action identified</li>
            <li><strong>action.updated</strong> - Action status or details changed</li>
            <li><strong>action.completed</strong> - Remedial action marked complete</li>
            <li><strong>certificate.created</strong> - New compliance certificate uploaded</li>
            <li><strong>certificate.expiring</strong> - Certificate approaching expiry</li>
          </ul>
          
          <h4 className="font-medium mt-4">Webhook Payload Format</h4>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto">{`{
  "event": "action.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "deliveryId": "uuid",
  "data": {
    "id": "action-uuid",
    "propertyId": "property-uuid",
    "type": "EICR",
    "description": "C2 deficiency identified",
    "severity": "HIGH",
    "dueDate": "2024-02-15"
  }
}`}</pre>

          <h3 className="text-lg font-semibold mt-6">2. Sending Data to ComplianceAI (API)</h3>
          <p>Your HMS can update ComplianceAI when work is completed:</p>
          
          <h4 className="font-medium mt-4">Update Action Status</h4>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto">{`POST /api/integrations/hms/actions
Content-Type: application/json
X-API-Key: your-api-key

{
  "actionId": "uuid",
  "status": "COMPLETED",
  "completedAt": "2024-01-20T14:00:00Z",
  "costActual": 450.00,
  "notes": "Work completed by ABC Contractors"
}`}</pre>

          <h4 className="font-medium mt-4">Update Work Order</h4>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto">{`POST /api/integrations/hms/work-orders
Content-Type: application/json
X-API-Key: your-api-key

{
  "workOrderId": "WO-12345",
  "actionId": "uuid",
  "status": "scheduled",
  "scheduledDate": "2024-01-18",
  "assignedContractor": "ABC Electrical"
}`}</pre>

          <h3 className="text-lg font-semibold mt-6">3. Authentication</h3>
          <p>All API requests require authentication via API key:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Generate an API key in the "API Keys" tab</li>
            <li>Include the key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header</li>
            <li>Store the key securely - it's only shown once when created</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6">4. OpenAPI Documentation</h3>
          <p>
            Full API documentation is available at{' '}
            <a href="/api/admin/openapi" target="_blank" className="text-primary underline">
              /api/admin/openapi
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
