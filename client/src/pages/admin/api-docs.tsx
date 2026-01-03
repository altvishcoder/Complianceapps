import { useEffect, useState, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileJson, Code, RefreshCw, Clock, Server, Key } from "lucide-react";
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
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6" role="main" aria-label="API documentation content" data-testid="api-docs-page">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">API Documentation</h1>
              <p className="text-sm text-muted-foreground">
                Interactive API reference with OpenAPI 3.0 specification
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                data-testid="button-refresh-docs"
                title="Refresh Docs"
              >
                <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh Docs</span>
              </Button>
              <Button variant="outline" size="icon" asChild data-testid="button-openapi-spec" title="OpenAPI Spec">
                <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
                  <FileJson className="h-4 w-4" />
                  <span className="sr-only">OpenAPI Spec</span>
                </a>
              </Button>
              <Button variant="outline" size="icon" asChild data-testid="button-fullscreen" title="Open Fullscreen">
                <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open Fullscreen</span>
                </a>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-endpoints">
              <Server className="h-3 w-3" />
              {status?.endpointCount ?? 0} endpoints
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-version">
              <FileJson className="h-3 w-3" />
              v{status?.version ?? "1.0.0"}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-auth">
              <Key className="h-3 w-3" />
              Session + Bearer
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-format">
              <Code className="h-3 w-3" />
              JSON / REST
            </Badge>
            {status?.lastGenerated && (
              <Badge variant="secondary" className="flex items-center gap-1 hidden sm:flex" data-testid="badge-updated">
                <Clock className="h-3 w-3" />
                Updated: {formatDate(status.lastGenerated)}
              </Badge>
            )}
          </div>

          <Card className="mt-4 h-[calc(100vh-280px)] md:h-[calc(100vh-300px)]" data-testid="card-swagger-embed">
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
