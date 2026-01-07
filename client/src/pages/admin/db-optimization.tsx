import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Database, 
  RefreshCcw, 
  Zap, 
  Table, 
  Eye, 
  AlertCircle,
  Loader2,
  HardDrive,
  ChevronDown,
  ChevronRight,
  Building2,
  BarChart3,
  Calendar,
  FileText,
  Users,
  Info
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

interface ViewCategory {
  name: string;
  description: string;
  views: string[];
}

interface ViewCategories {
  [key: string]: ViewCategory;
}

interface RefreshResult {
  success: boolean;
  durationMs: number;
}

interface RefreshAllResult {
  success: boolean;
  results: { viewName: string; success: boolean; durationMs: number }[];
  totalDurationMs: number;
}

interface ApplyResult {
  success: boolean;
  indexes: { applied: number; errors: string[] };
  views: { created: number; errors: string[] };
  tables: { created: number; errors: string[] };
}

const categoryIcons: Record<string, React.ReactNode> = {
  core: <BarChart3 className="h-4 w-4 text-blue-500" />,
  hierarchy: <Building2 className="h-4 w-4 text-green-500" />,
  risk: <AlertCircle className="h-4 w-4 text-red-500" />,
  operational: <Calendar className="h-4 w-4 text-orange-500" />,
  regulatory: <FileText className="h-4 w-4 text-purple-500" />,
  contractor: <Users className="h-4 w-4 text-cyan-500" />
};

export default function DbOptimizationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [refreshingView, setRefreshingView] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'hierarchy']));
  const [refreshingCategory, setRefreshingCategory] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

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

  const { data: categories } = useQuery<ViewCategories>({
    queryKey: ["db-optimization-categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/db-optimization/categories", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
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

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      setIsRefreshingAll(true);
      const res = await fetch("/api/admin/db-optimization/refresh-all", {
        method: "POST",
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to refresh all views");
      return res.json() as Promise<RefreshAllResult>;
    },
    onSuccess: (data) => {
      const successCount = data.results.filter(r => r.success).length;
      toast({
        title: "All Views Refreshed",
        description: `Refreshed ${successCount}/${data.results.length} views in ${data.totalDurationMs}ms`,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh All Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRefreshingAll(false);
    }
  });

  const refreshCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      setRefreshingCategory(category);
      const res = await fetch("/api/admin/db-optimization/refresh-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ category })
      });
      if (!res.ok) throw new Error("Failed to refresh category");
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      toast({
        title: "Category Refreshed",
        description: `Refreshed ${successCount}/${data.results.length} views in ${data.totalDurationMs}ms`,
      });
      refetch();
    },
    onError: (error: Error, category) => {
      toast({
        title: "Refresh Failed",
        description: `Failed to refresh ${category}: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRefreshingCategory(null);
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

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getViewRowCount = (viewName: string): number => {
    const view = status?.materializedViews.find(v => v.name === viewName);
    return view?.rowCount ?? 0;
  };

  const isViewCreated = (viewName: string): boolean => {
    return status?.materializedViews.some(v => v.name === viewName) ?? false;
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
                  Manage performance indexes, materialized views, and caching tables for 50k+ scale
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
                  variant="outline"
                  onClick={() => refreshAllMutation.mutate()}
                  disabled={isRefreshingAll || refreshAllMutation.isPending}
                  data-testid="button-refresh-all-views"
                >
                  {isRefreshingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Refresh All Views
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

            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Deployment Workflow</p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      Database optimizations are managed via migrations, not at server startup. 
                      Use "Apply All Optimizations" after deployment to create indexes and views. 
                      Use "Refresh All Views" to update materialized view data after bulk imports.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                    <span className="text-lg text-muted-foreground ml-1">
                      / {categories ? Object.values(categories).reduce((acc, cat) => acc + cat.views.length, 0) : 0}
                    </span>
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
                  Materialized Views by Category
                </CardTitle>
                <CardDescription>
                  Pre-computed views for fast queries. Organized by functional area for targeted refresh.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !categories ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Failed to load view categories.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(categories).map(([key, category]) => (
                      <Collapsible
                        key={key}
                        open={expandedCategories.has(key)}
                        onOpenChange={() => toggleCategory(key)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                {expandedCategories.has(key) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                {categoryIcons[key] || <Eye className="h-4 w-4" />}
                                <div>
                                  <span className="font-medium">{category.name}</span>
                                  <span className="text-muted-foreground ml-2 text-sm">
                                    ({category.views.filter(v => isViewCreated(v)).length}/{category.views.length} created)
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshCategoryMutation.mutate(key);
                                }}
                                disabled={refreshingCategory === key}
                                data-testid={`button-refresh-category-${key}`}
                              >
                                {refreshingCategory === key ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4" />
                                )}
                                <span className="ml-2 hidden sm:inline">Refresh Category</span>
                              </Button>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 pt-0 space-y-2">
                              <p className="text-sm text-muted-foreground mb-3 mt-2">
                                {category.description}
                              </p>
                              {category.views.map((viewName) => {
                                const isCreated = isViewCreated(viewName);
                                const rowCount = getViewRowCount(viewName);
                                return (
                                  <div
                                    key={viewName}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                      isCreated ? 'bg-muted/50' : 'bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                                    }`}
                                    data-testid={`view-${viewName}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm">{viewName}</span>
                                      {isCreated ? (
                                        <Badge variant="outline" className="text-xs">
                                          {rowCount.toLocaleString()} rows
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                                          Not Created
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => refreshViewMutation.mutate(viewName)}
                                      disabled={refreshingView === viewName || !isCreated}
                                      data-testid={`button-refresh-${viewName}`}
                                    >
                                      {refreshingView === viewName ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCcw className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
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
