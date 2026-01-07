import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Database, 
  RefreshCcw, 
  Zap, 
  Table, 
  Eye, 
  AlertCircle,
  Loader2,
  HardDrive
} from "lucide-react";

interface OptimizationIndex {
  name: string;
  tableName: string;
  size: string;
}

interface MaterializedView {
  name: string;
  rowCount: number;
  lastRefresh: string | null;
}

interface OptimizationTable {
  name: string;
  rowCount: number;
}

interface OptimizationStatus {
  indexes: OptimizationIndex[];
  materializedViews: MaterializedView[];
  optimizationTables: OptimizationTable[];
}

interface RefreshResult {
  success: boolean;
  durationMs: number;
}

interface ApplyResult {
  success: boolean;
  indexes: { applied: number; errors: string[] };
  views: { created: number; errors: string[] };
  tables: { created: number; errors: string[] };
}

export default function DbOptimizationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [refreshingView, setRefreshingView] = useState<string | null>(null);

  const { data: status, isLoading, refetch } = useQuery<OptimizationStatus>({
    queryKey: ["db-optimization-status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/db-optimization/status", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch optimization status");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const refreshViewMutation = useMutation({
    mutationFn: async (viewName: string) => {
      setRefreshingView(viewName);
      const res = await fetch("/api/admin/db-optimization/refresh-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ viewName })
      });
      if (!res.ok) throw new Error("Failed to refresh view");
      return res.json() as Promise<RefreshResult>;
    },
    onSuccess: (data, viewName) => {
      toast({
        title: "View Refreshed",
        description: `${viewName} refreshed in ${data.durationMs}ms`,
      });
      refetch();
    },
    onError: (error: Error, viewName) => {
      toast({
        title: "Refresh Failed",
        description: `Failed to refresh ${viewName}: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRefreshingView(null);
    }
  });

  const applyAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/db-optimization/apply-all", {
        method: "POST",
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to apply optimizations");
      return res.json() as Promise<ApplyResult>;
    },
    onSuccess: (data) => {
      const totalApplied = data.indexes.applied + data.views.created + data.tables.created;
      toast({
        title: "Optimizations Applied",
        description: `Applied ${totalApplied} optimization objects`,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Apply Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const viewDescriptions: Record<string, string> = {
    mv_dashboard_stats: "Dashboard compliance statistics aggregated by scheme",
    mv_certificate_compliance: "Certificate counts by type and status with expiry tracking",
    mv_asset_health: "Component health metrics aggregated by property"
  };

  if (authLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background" data-testid="db-optimization-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Database Optimization" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Database Optimization</h1>
                <p className="text-muted-foreground">
                  Manage performance indexes, materialized views, and caching tables for scale
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  data-testid="button-refresh-status"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                <Button
                  onClick={() => applyAllMutation.mutate()}
                  disabled={applyAllMutation.isPending}
                  data-testid="button-apply-all"
                >
                  {applyAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Apply All Optimizations
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    Performance Indexes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-index-count">
                    {status?.indexes.length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active indexes for query optimization
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-500" />
                    Materialized Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-view-count">
                    {status?.materializedViews.length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pre-computed aggregations for dashboards
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Table className="h-4 w-4 text-purple-500" />
                    Optimization Tables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-table-count">
                    {status?.optimizationTables.length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cache and snapshot tables
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Materialized Views
                </CardTitle>
                <CardDescription>
                  Pre-computed views for fast dashboard queries. Refresh manually after bulk data changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : status?.materializedViews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No materialized views found. Click "Apply All Optimizations" to create them.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {status?.materializedViews.map((view) => (
                      <div
                        key={view.name}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        data-testid={`view-${view.name}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{view.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {view.rowCount.toLocaleString()} rows
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {viewDescriptions[view.name] || "Materialized view for performance"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshViewMutation.mutate(view.name)}
                          disabled={refreshingView === view.name}
                          data-testid={`button-refresh-${view.name}`}
                        >
                          {refreshingView === view.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                          <span className="ml-2">Refresh</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Performance Indexes
                </CardTitle>
                <CardDescription>
                  Database indexes for optimizing common query patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : status?.indexes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No custom indexes found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Index Name</th>
                          <th className="text-left py-2 px-3 font-medium">Table</th>
                          <th className="text-right py-2 px-3 font-medium">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status?.indexes.map((idx) => (
                          <tr key={idx.name} className="border-b last:border-0" data-testid={`index-${idx.name}`}>
                            <td className="py-2 px-3 font-mono text-xs">{idx.name}</td>
                            <td className="py-2 px-3">{idx.tableName}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{idx.size}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Optimization Tables
                </CardTitle>
                <CardDescription>
                  Tables for caching computed data and snapshots
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : status?.optimizationTables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No optimization tables found. Click "Apply All Optimizations" to create them.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {status?.optimizationTables.map((table) => (
                      <div
                        key={table.name}
                        className="p-4 bg-muted/50 rounded-lg"
                        data-testid={`table-${table.name}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{table.name}</span>
                          <Badge variant="secondary">
                            {table.rowCount.toLocaleString()} rows
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
