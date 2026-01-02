import { useEffect, useState, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileJson, Book, Code, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface OpenApiStatus {
  lastGenerated: string;
  endpointCount: number;
  version: string;
}

export default function ApiDocs() {
  const [iframeKey, setIframeKey] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "API Documentation - ComplianceAI";
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery<OpenApiStatus>({
    queryKey: ['openapi-status'],
    queryFn: async () => {
      const res = await fetch('/api/openapi/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/openapi/refresh', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to refresh');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openapi-status'] });
      setIframeKey(prev => prev + 1);
      toast({
        title: "Documentation Refreshed",
        description: "API documentation has been regenerated with the latest endpoints.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh the API documentation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="API Documentation" />
        <main id="main-content" className="flex-1 overflow-hidden p-6" role="main" aria-label="API documentation content" data-testid="api-docs-page">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
              <p className="text-muted-foreground mt-1">
                Interactive API reference with OpenAPI 3.0 specification
              </p>
              {status && (
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last updated: {formatDate(status.lastGenerated)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {status.endpointCount} endpoints
                  </span>
                  <Badge variant="secondary">v{status.version}</Badge>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                data-testid="button-refresh-docs"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Docs'}
              </Button>
              <Button variant="outline" asChild data-testid="button-openapi-spec">
                <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
                  <FileJson className="mr-2 h-4 w-4" />
                  OpenAPI Spec
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="button-fullscreen">
                <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Fullscreen
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 mb-4 md:grid-cols-3">
            <Card data-testid="card-api-overview">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Book className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">API Overview</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base URL</span>
                    <Badge variant="secondary">/api</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <Badge variant="secondary">1.0.0</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format</span>
                    <Badge variant="secondary">JSON</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-auth-info">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Authentication</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">Session Cookie</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Login</span>
                    <Badge variant="outline">POST /api/auth/login</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingestion API</span>
                    <Badge variant="outline">Bearer Token</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-endpoints-summary">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Endpoints</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Properties</span>
                    <Badge variant="secondary">CRUD</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Certificates</span>
                    <Badge variant="secondary">CRUD + Upload</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Configuration</span>
                    <Badge variant="secondary">Read/Write</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-[calc(100vh-320px)]" data-testid="card-swagger-embed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Interactive API Explorer</CardTitle>
              <CardDescription>Test API endpoints directly from this page</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)] p-0">
              <iframe 
                key={iframeKey}
                src="/api/docs" 
                className="w-full h-full border-0 rounded-b-lg"
                title="Swagger UI API Documentation"
                data-testid="iframe-swagger"
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
