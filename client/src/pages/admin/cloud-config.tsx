import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Cloud, Database, Shield, Brain, Check, X, AlertTriangle, 
  Loader2, RefreshCw, HardDrive, Server, Key, Settings, Pencil
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

interface StorageProvider {
  id: string;
  name: string;
  description: string;
  envVars: string[];
  isActive: boolean;
  configured: boolean;
  envVarsConfigured: number;
  envVarsRequired: number;
}

interface AIProvider {
  type: string;
  name: string;
  displayName: string;
  description: string;
  category: "cloud" | "offline";
  capabilities: string[];
  priority: number;
  configured: boolean;
  envVars: string[];
  envVarsConfigured: number;
  envVarsRequired: number;
  capabilityDetails: Record<string, string>;
  health?: {
    isHealthy: boolean;
    latencyMs?: number;
    lastChecked?: string;
    error?: string;
  };
}

interface SSOProvider {
  id: string;
  name: string;
  description: string;
  envVars: string[];
  isEnabled: boolean;
  configured: boolean;
  envVarsConfigured: number;
  envVarsRequired: number;
}

interface CloudConfig {
  storage: {
    activeProvider: string;
    providers: StorageProvider[];
  };
  ai: {
    providers: AIProvider[];
  };
  sso: {
    providers: SSOProvider[];
    emailPasswordEnabled: boolean;
  };
}

const STORAGE_ICONS: Record<string, React.ElementType> = {
  replit: Cloud,
  local: HardDrive,
  s3: Database,
  azure_blob: Cloud,
  gcs: Cloud,
};

const AI_CAPABILITY_LABELS: Record<string, string> = {
  ocr: "OCR",
  text_extraction: "LLM Extraction",
  vision: "Vision Analysis",
  document_intelligence: "Document Intelligence",
  chat: "Chat",
};

const AI_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  cloud: { label: "Cloud", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  offline: { label: "Offline/Airgapped", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
};

const SSO_ICONS: Record<string, React.ElementType> = {
  "microsoft-entra": Shield,
  google: Shield,
  okta: Shield,
  keycloak: Key,
  "generic-oidc": Key,
};

function StatusBadge({ status, label }: { status: "active" | "configured" | "unconfigured" | "healthy" | "unhealthy"; label?: string }) {
  const variants: Record<string, { className: string; icon: React.ReactNode }> = {
    active: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <Check className="h-3 w-3" /> },
    healthy: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <Check className="h-3 w-3" /> },
    configured: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Check className="h-3 w-3" /> },
    unconfigured: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: <X className="h-3 w-3" /> },
    unhealthy: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const { className, icon } = variants[status] || variants.unconfigured;
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {icon}
      {label || status}
    </Badge>
  );
}

function ProviderConfigDialog({ 
  provider, 
  type,
  isSuperAdmin 
}: { 
  provider: StorageProvider | AIProvider | SSOProvider;
  type: "storage" | "ai" | "sso";
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  
  const envVarDescriptions: Record<string, string> = {
    AWS_ACCESS_KEY_ID: "Your AWS access key ID for S3 authentication",
    AWS_SECRET_ACCESS_KEY: "Your AWS secret access key (keep secure)",
    AWS_REGION: "AWS region where your S3 bucket is located (e.g., eu-west-2)",
    S3_BUCKET: "Name of your S3 bucket for document storage",
    AZURE_STORAGE_CONNECTION_STRING: "Azure Storage account connection string",
    AZURE_STORAGE_CONTAINER: "Name of Azure Blob container for documents",
    GOOGLE_APPLICATION_CREDENTIALS: "Path to Google Cloud service account JSON file",
    GCS_BUCKET: "Name of your Google Cloud Storage bucket",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "Azure Document Intelligence service endpoint URL",
    AZURE_DOCUMENT_INTELLIGENCE_KEY: "Azure Document Intelligence API key",
    OPENAI_API_KEY: "Your OpenAI API key for AI extraction",
    ANTHROPIC_API_KEY: "Your Anthropic API key for Claude models",
    AZURE_TENANT_ID: "Azure AD tenant ID for Microsoft Entra SSO",
    AZURE_CLIENT_ID: "Azure AD application (client) ID",
    AZURE_CLIENT_SECRET: "Azure AD client secret",
    GOOGLE_CLIENT_ID: "Google OAuth client ID",
    GOOGLE_CLIENT_SECRET: "Google OAuth client secret",
    OKTA_DOMAIN: "Your Okta organization domain",
    OKTA_CLIENT_ID: "Okta application client ID",
    OKTA_CLIENT_SECRET: "Okta client secret",
    KEYCLOAK_URL: "Keycloak server URL",
    KEYCLOAK_REALM: "Keycloak realm name",
    KEYCLOAK_CLIENT_ID: "Keycloak client ID",
    KEYCLOAK_CLIENT_SECRET: "Keycloak client secret",
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs"
          data-testid={`btn-configure-${'id' in provider ? provider.id : (provider as AIProvider).name}`}
        >
          <Settings className="h-3 w-3 mr-1" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure {provider.name || (provider as AIProvider).displayName}
          </DialogTitle>
          <DialogDescription>
            {provider.configured 
              ? "This provider is configured and ready to use."
              : "Configure the required settings to enable this provider."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">Configuration Status</div>
            <StatusBadge 
              status={provider.configured ? "configured" : "unconfigured"} 
              label={`${provider.envVarsConfigured}/${provider.envVarsRequired} configured`}
            />
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">Required Environment Variables</Label>
            <div className="space-y-2">
              {provider.envVars.map((envVar, index) => {
                const isConfigured = index < provider.envVarsConfigured;
                return (
                  <div 
                    key={envVar} 
                    className={`p-3 rounded-lg border ${isConfigured ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">{envVar}</code>
                      {isConfigured ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Set
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Missing
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {envVarDescriptions[envVar] || "Required for this provider"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          
          {!provider.configured && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>How to configure:</strong> Add the missing environment variables in your Replit Secrets panel (Tools → Secrets) or your deployment environment configuration.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderCard({ 
  icon: Icon, 
  name, 
  description, 
  status,
  statusLabel,
  details,
  priority,
  capabilities,
  provider,
  providerType,
  isSuperAdmin,
}: { 
  icon: React.ElementType;
  name: string;
  description: string;
  status: "active" | "configured" | "unconfigured" | "healthy" | "unhealthy";
  statusLabel?: string;
  details?: React.ReactNode;
  priority?: number;
  capabilities?: string[];
  provider?: StorageProvider | AIProvider | SSOProvider;
  providerType?: "storage" | "ai" | "sso";
  isSuperAdmin?: boolean;
}) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <StatusBadge status={status} label={statusLabel} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {priority !== undefined && (
          <div className="text-xs text-muted-foreground mb-2">
            Priority: {priority} (lower = preferred)
          </div>
        )}
        {capabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {capabilities.map(cap => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {AI_CAPABILITY_LABELS[cap] || cap}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          {details}
          {provider && providerType && isSuperAdmin && (
            <ProviderConfigDialog 
              provider={provider} 
              type={providerType}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

export default function CloudConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("storage");
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const [selectedStorageProvider, setSelectedStorageProvider] = useState<string>("");
  
  const isSuperAdmin = user?.role === "SUPER_ADMIN" || user?.role === "LASHAN_SUPER_USER";
  
  const { data: config, isLoading, error } = useQuery<CloudConfig>({
    queryKey: ["/api/admin/cloud-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cloud-config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cloud configuration");
      return res.json();
    },
  });
  
  const healthCheckMutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await fetch("/api/admin/cloud-config/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cloud-config"] });
      toast({
        title: "Health Check Complete",
        description: `Checked ${Object.keys(data.results).length} provider(s)`,
      });
    },
    onError: (error) => {
      toast({
        title: "Health Check Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
  
  const updateStorageMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch("/api/admin/cloud-config/storage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update storage provider");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cloud-config"] });
      setStorageDialogOpen(false);
      toast({
        title: "Storage Provider Updated",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
  
  if (error) {
    return (
      <div className="flex min-h-screen bg-background" data-testid="cloud-config-page">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header title="Cloud Configuration" />
          <main className="flex-1 p-6">
            <Card className="border-destructive">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Failed to load cloud configuration</span>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" data-testid="cloud-config-page">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Cloud Configuration" />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Cloud Provider Configuration</h1>
            <p className="text-muted-foreground">
              View and test your storage, AI, and authentication provider connections
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="storage" className="gap-2" data-testid="tab-storage">
                <Database className="h-4 w-4" />
                Storage
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2" data-testid="tab-ai">
                <Brain className="h-4 w-4" />
                AI Extraction
              </TabsTrigger>
              <TabsTrigger value="auth" className="gap-2" data-testid="tab-auth">
                <Shield className="h-4 w-4" />
                Authentication
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="storage" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Storage Providers</h2>
                  <p className="text-sm text-muted-foreground">
                    Active: {config?.storage.activeProvider || "Loading..."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isSuperAdmin && (
                    <Dialog open={storageDialogOpen} onOpenChange={setStorageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedStorageProvider(config?.storage.activeProvider || "")}
                          data-testid="btn-edit-storage"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Change Provider
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Storage Provider</DialogTitle>
                          <DialogDescription>
                            Select the active storage provider for document storage. Ensure all required environment variables are configured before switching.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="storage-provider">Active Storage Provider</Label>
                          <Select 
                            value={selectedStorageProvider} 
                            onValueChange={setSelectedStorageProvider}
                          >
                            <SelectTrigger id="storage-provider" className="mt-2" data-testid="select-storage-provider">
                              <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {config?.storage.providers.map(provider => (
                                <SelectItem 
                                  key={provider.id} 
                                  value={provider.id}
                                  disabled={!provider.configured && provider.id !== config.storage.activeProvider}
                                >
                                  {provider.name} {!provider.configured && "(not configured)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedStorageProvider && config?.storage.providers.find(p => p.id === selectedStorageProvider) && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Required env vars: {config?.storage.providers.find(p => p.id === selectedStorageProvider)?.envVarsConfigured}/
                              {config?.storage.providers.find(p => p.id === selectedStorageProvider)?.envVarsRequired} configured
                            </p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setStorageDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => updateStorageMutation.mutate(selectedStorageProvider)}
                            disabled={updateStorageMutation.isPending || !selectedStorageProvider}
                            data-testid="btn-save-storage"
                          >
                            {updateStorageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => healthCheckMutation.mutate("storage")}
                    disabled={healthCheckMutation.isPending}
                    data-testid="btn-health-check-storage"
                  >
                    {healthCheckMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <>
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                  </>
                ) : (
                  config?.storage.providers.map(provider => (
                    <ProviderCard
                      key={provider.id}
                      icon={STORAGE_ICONS[provider.id] || Server}
                      name={provider.name}
                      description={provider.description}
                      status={provider.isActive ? "active" : provider.configured ? "configured" : "unconfigured"}
                      statusLabel={provider.isActive ? "Active" : provider.configured ? "Ready" : "Not Configured"}
                      details={
                        <div className="text-xs text-muted-foreground">
                          {provider.envVarsConfigured}/{provider.envVarsRequired} env vars set
                        </div>
                      }
                      provider={provider}
                      providerType="storage"
                      isSuperAdmin={isSuperAdmin}
                    />
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="ai" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">AI Providers</h2>
                  <p className="text-sm text-muted-foreground">
                    Providers are tried in priority order with automatic fallback
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => healthCheckMutation.mutate("ai")}
                  disabled={healthCheckMutation.isPending}
                  data-testid="btn-health-check-ai"
                >
                  {healthCheckMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Test All Providers
                </Button>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {isLoading ? (
                  <>
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                  </>
                ) : (
                  config?.ai.providers
                    .sort((a, b) => a.priority - b.priority)
                    .map(provider => {
                      const healthStatus = provider.health?.isHealthy ? "healthy" : 
                        provider.configured ? (provider.health ? "unhealthy" : "configured") : "unconfigured";
                      const categoryInfo = AI_CATEGORY_LABELS[provider.category] || AI_CATEGORY_LABELS.cloud;
                      return (
                        <Card key={provider.type} className="relative" data-testid={`ai-provider-${provider.type}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Brain className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">{provider.displayName}</CardTitle>
                                  <CardDescription className="text-sm">{provider.description}</CardDescription>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge status={healthStatus} label={
                                  provider.health?.isHealthy ? "Healthy" :
                                  provider.configured ? (provider.health?.error ? "Error" : "Ready") : "Not Configured"
                                } />
                                <Badge variant="outline" className={`text-xs ${categoryInfo.color}`}>
                                  {categoryInfo.label}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="text-xs text-muted-foreground">
                              Priority: {provider.priority} (lower = preferred)
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {provider.capabilities.map(cap => (
                                <Badge key={cap} variant="secondary" className="text-xs">
                                  {AI_CAPABILITY_LABELS[cap] || cap}
                                </Badge>
                              ))}
                            </div>
                            
                            {Object.keys(provider.capabilityDetails).length > 0 && (
                              <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                                {Object.entries(provider.capabilityDetails).map(([cap, detail]) => (
                                  <div key={cap} className="flex gap-2">
                                    <span className="font-medium">{AI_CAPABILITY_LABELS[cap] || cap}:</span>
                                    <span>{detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {provider.envVars.length > 0 && (
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {provider.envVarsConfigured}/{provider.envVarsRequired} env vars configured
                                </div>
                                {isSuperAdmin && (
                                  <ProviderConfigDialog 
                                    provider={provider} 
                                    type="ai"
                                    isSuperAdmin={isSuperAdmin}
                                  />
                                )}
                              </div>
                            )}
                            
                            {provider.health?.error && (
                              <div className="text-xs text-destructive truncate" title={provider.health.error}>
                                {provider.health.error}
                              </div>
                            )}
                            
                            {provider.health?.latencyMs && !provider.health?.error && (
                              <div className="text-xs text-muted-foreground">
                                Latency: {provider.health.latencyMs}ms
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="auth" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">SSO Providers</h2>
                  <p className="text-sm text-muted-foreground">
                    Single Sign-On authentication options
                  </p>
                </div>
              </div>
              
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Email & Password</CardTitle>
                        <CardDescription className="text-sm">Traditional login with username and password</CardDescription>
                      </div>
                    </div>
                    <StatusBadge status="active" label="Always Enabled" />
                  </div>
                </CardHeader>
              </Card>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <>
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                    <ProviderCardSkeleton />
                  </>
                ) : (
                  config?.sso.providers.map(provider => (
                    <ProviderCard
                      key={provider.id}
                      icon={SSO_ICONS[provider.id] || Shield}
                      name={provider.name}
                      description={provider.description}
                      status={provider.isEnabled ? "active" : provider.configured ? "configured" : "unconfigured"}
                      statusLabel={provider.isEnabled ? "Enabled" : provider.configured ? "Ready" : "Not Configured"}
                      details={
                        <div className="text-xs text-muted-foreground">
                          {provider.envVarsConfigured}/{provider.envVarsRequired} env vars set
                        </div>
                      }
                      provider={provider}
                      providerType="sso"
                      isSuperAdmin={isSuperAdmin}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
