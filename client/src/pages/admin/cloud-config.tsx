import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Cloud, Database, Shield, Brain, Check, X, AlertTriangle, 
  Loader2, RefreshCw, HardDrive, Server, Key
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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
  capabilities: string[];
  priority: number;
  configured: boolean;
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
  text_extraction: "Text Extraction",
  vision: "Vision",
  document_intelligence: "Document Intelligence",
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

function ProviderCard({ 
  icon: Icon, 
  name, 
  description, 
  status,
  statusLabel,
  details,
  priority,
  capabilities,
}: { 
  icon: React.ElementType;
  name: string;
  description: string;
  status: "active" | "configured" | "unconfigured" | "healthy" | "unhealthy";
  statusLabel?: string;
  details?: React.ReactNode;
  priority?: number;
  capabilities?: string[];
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
        {details}
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
  const [activeTab, setActiveTab] = useState("storage");
  
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
                      return (
                        <ProviderCard
                          key={provider.type}
                          icon={Brain}
                          name={provider.name}
                          description={`Priority: ${provider.priority}`}
                          status={healthStatus}
                          statusLabel={
                            provider.health?.isHealthy ? "Healthy" :
                            provider.configured ? (provider.health?.error ? "Error" : "Ready") : "Not Configured"
                          }
                          priority={provider.priority}
                          capabilities={provider.capabilities}
                          details={
                            provider.health?.error ? (
                              <div className="text-xs text-destructive truncate" title={provider.health.error}>
                                {provider.health.error}
                              </div>
                            ) : provider.health?.latencyMs ? (
                              <div className="text-xs text-muted-foreground">
                                Latency: {provider.health.latencyMs}ms
                              </div>
                            ) : null
                          }
                        />
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
