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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Info,
  Clock,
  History,
  Settings,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface OptimizationIndex {
  name: string;
  tableName: string;
  size: string;
}

interface MaterializedView {
  name: string;
  rowCount: number;
  lastRefresh: string | null;
  lastDurationMs: number | null;
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
  rowCount: number;
}

interface RefreshAllResult {
  success: boolean;
  results: { viewName: string; success: boolean; durationMs: number; rowCount: number }[];
  totalDurationMs: number;
}

interface ApplyResult {
  success: boolean;
  indexes: { applied: number; errors: string[] };
  views: { created: number; errors: string[] };
  tables: { created: number; errors: string[] };
}

interface RefreshHistoryItem {
  id: string;
  viewName: string;
  category: string | null;
  status: string;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  rowCountBefore: number | null;
  rowCountAfter: number | null;
  rowDelta: number | null;
  initiatedBy: string | null;
  errorMessage: string | null;
}

interface FreshnessStatus {
  isStale: boolean;
  oldestRefresh: string | null;
  viewsNeverRefreshed: string[];
  staleViews: string[];
  freshViews: string[];
}

interface RefreshSchedule {
  id: string;
  name: string;
  isEnabled: boolean;
  scheduleTime: string;
  timezone: string;
  postIngestionEnabled: boolean;
  staleThresholdHours: number;
  targetViews: string[] | null;
  refreshAll: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
}

interface ViewScheduleConfig {
  viewName: string;
  isEnabled: boolean;
  scheduleTime: string;
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
  const [scheduleTime, setScheduleTime] = useState("05:30");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [postIngestionEnabled, setPostIngestionEnabled] = useState(false);
  const [staleThresholdHours, setStaleThresholdHours] = useState(6);
  const [refreshAll, setRefreshAll] = useState(true);
  const [selectedViews, setSelectedViews] = useState<Set<string>>(new Set());
  const [expandedScheduleCategories, setExpandedScheduleCategories] = useState<Set<string>>(new Set());

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

  const { data: freshnessData } = useQuery<FreshnessStatus>({
    queryKey: ["db-optimization-freshness"],
    queryFn: async () => {
      const res = await fetch("/api/admin/db-optimization/freshness", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch freshness");
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<{ history: RefreshHistoryItem[] }>({
    queryKey: ["db-optimization-history"],
    queryFn: async () => {
      const res = await fetch("/api/admin/db-optimization/refresh-history?limit=50", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: scheduleData, refetch: refetchSchedule } = useQuery<{ schedule: RefreshSchedule | null }>({
    queryKey: ["db-optimization-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/admin/db-optimization/schedule", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      const data = await res.json();
      if (data.schedule) {
        setScheduleTime(data.schedule.scheduleTime || '05:30');
        setScheduleEnabled(data.schedule.isEnabled ?? true);
        setPostIngestionEnabled(data.schedule.postIngestionEnabled ?? false);
        setStaleThresholdHours(data.schedule.staleThresholdHours ?? 6);
        // Explicitly handle refreshAll - only default to true if undefined
        const storedRefreshAll = data.schedule.refreshAll;
        setRefreshAll(storedRefreshAll === undefined || storedRefreshAll === null ? true : storedRefreshAll);
        // Always populate selectedViews from stored targetViews if present
        if (data.schedule.targetViews && Array.isArray(data.schedule.targetViews)) {
          setSelectedViews(new Set(data.schedule.targetViews));
        } else {
          setSelectedViews(new Set());
        }
      }
      return data;
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
        description: `${viewName} refreshed in ${data.durationMs}ms (${data.rowCount} rows)`,
      });
      refetch();
      refetchHistory();
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
      refetchHistory();
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
      refetchHistory();
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

  const updateScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/db-optimization/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          scheduleTime,
          isEnabled: scheduleEnabled,
          postIngestionEnabled,
          staleThresholdHours,
          refreshAll,
          targetViews: refreshAll ? null : Array.from(selectedViews)
        })
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedule Updated",
        description: "Refresh schedule has been saved",
      });
      refetchSchedule();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
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

  const getViewLastRefresh = (viewName: string): string | null => {
    const view = status?.materializedViews.find(v => v.name === viewName);
    return view?.lastRefresh || null;
  };

  const isViewCreated = (viewName: string): boolean => {
    return status?.materializedViews.some(v => v.name === viewName) ?? false;
  };

  const formatLastRefresh = (timestamp: string | null): string => {
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
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
                  Manage performance indexes, materialized views, and scheduling for 50k+ scale
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

            {freshnessData?.isStale && (
              <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-900 dark:text-yellow-100">Dashboard Data May Be Stale</p>
                      <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                        {freshnessData.viewsNeverRefreshed.length > 0 && (
                          <span>{freshnessData.viewsNeverRefreshed.length} views have never been refreshed. </span>
                        )}
                        {freshnessData.staleViews.length > 0 && (
                          <span>{freshnessData.staleViews.length} views are older than {staleThresholdHours} hours. </span>
                        )}
                        Click "Refresh All Views" to update dashboard metrics.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Data Freshness Guide</p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      <strong>Real-time:</strong> Property lists, certificate lists, component lists, hierarchy tree structure.
                      <br />
                      <strong>Eventual consistency:</strong> Dashboard compliance %, scheme/block badges, risk scores, TSM metrics.
                      Refresh views after bulk imports to update these calculations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    Active indexes
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
                    Created / Total defined
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
                    Cache tables
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {freshnessData?.isStale ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    Freshness Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-freshness-status">
                    {freshnessData?.isStale ? "Stale" : "Fresh"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {freshnessData?.freshViews.length ?? 0} fresh, {(freshnessData?.staleViews.length ?? 0) + (freshnessData?.viewsNeverRefreshed.length ?? 0)} need refresh
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="views" className="space-y-4">
              <TabsList>
                <TabsTrigger value="views" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Views
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="indexes" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Indexes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="views">
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
                                    const lastRefresh = getViewLastRefresh(viewName);
                                    return (
                                      <div
                                        key={viewName}
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                          isCreated ? 'bg-muted/50' : 'bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                                        }`}
                                        data-testid={`view-${viewName}`}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-sm">{viewName}</span>
                                            {isCreated ? (
                                              <>
                                                <Badge variant="outline" className="text-xs">
                                                  {rowCount.toLocaleString()} rows
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                  {formatLastRefresh(lastRefresh)}
                                                </Badge>
                                              </>
                                            ) : (
                                              <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                                                Not Created
                                              </Badge>
                                            )}
                                          </div>
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
              </TabsContent>

              <TabsContent value="schedule">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Refresh Schedule
                    </CardTitle>
                    <CardDescription>
                      Configure automatic daily refresh with per-view scheduling
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Enable Scheduled Refresh</Label>
                            <p className="text-sm text-muted-foreground">
                              Run automatic refresh at scheduled time
                            </p>
                          </div>
                          <Switch
                            checked={scheduleEnabled}
                            onCheckedChange={setScheduleEnabled}
                            data-testid="switch-schedule-enabled"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="schedule-time">Daily Refresh Time</Label>
                          <Input
                            id="schedule-time"
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-40"
                            data-testid="input-schedule-time"
                          />
                          <p className="text-xs text-muted-foreground">
                            UK/London timezone. Recommended: early morning (05:30)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Post-Ingestion Refresh</Label>
                            <p className="text-sm text-muted-foreground">
                              Auto-refresh after bulk certificate imports
                            </p>
                          </div>
                          <Switch
                            checked={postIngestionEnabled}
                            onCheckedChange={setPostIngestionEnabled}
                            data-testid="switch-post-ingestion"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stale-threshold">Stale Threshold (hours)</Label>
                          <Input
                            id="stale-threshold"
                            type="number"
                            min={1}
                            max={72}
                            value={staleThresholdHours}
                            onChange={(e) => setStaleThresholdHours(parseInt(e.target.value) || 6)}
                            className="w-24"
                            data-testid="input-stale-threshold"
                          />
                          <p className="text-xs text-muted-foreground">
                            Show staleness warning when views are older than this
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Per-View Selection */}
                    <div className="border-t pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Refresh All Views</Label>
                          <p className="text-sm text-muted-foreground">
                            When disabled, only selected views are refreshed
                          </p>
                        </div>
                        <Switch
                          checked={refreshAll}
                          onCheckedChange={setRefreshAll}
                          data-testid="switch-refresh-all"
                        />
                      </div>

                      {!refreshAll && categories && (
                        <div className="mt-4 space-y-3">
                          <Label>Select Views to Include in Scheduled Refresh</Label>
                          <div className="border rounded-lg max-h-80 overflow-y-auto">
                            {Object.entries(categories).map(([key, category]) => (
                              <Collapsible
                                key={key}
                                open={expandedScheduleCategories.has(key)}
                                onOpenChange={() => {
                                  const newSet = new Set(expandedScheduleCategories);
                                  if (newSet.has(key)) {
                                    newSet.delete(key);
                                  } else {
                                    newSet.add(key);
                                  }
                                  setExpandedScheduleCategories(newSet);
                                }}
                              >
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                                    <div className="flex items-center gap-2">
                                      {expandedScheduleCategories.has(key) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      {categoryIcons[key] || <Eye className="h-4 w-4" />}
                                      <span className="font-medium text-sm">{category.name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {category.views.filter(v => selectedViews.has(v)).length}/{category.views.length} selected
                                      </Badge>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const allSelected = category.views.every(v => selectedViews.has(v));
                                        const newSet = new Set(selectedViews);
                                        category.views.forEach(v => {
                                          if (allSelected) {
                                            newSet.delete(v);
                                          } else {
                                            newSet.add(v);
                                          }
                                        });
                                        setSelectedViews(newSet);
                                      }}
                                    >
                                      {category.views.every(v => selectedViews.has(v)) ? 'Deselect All' : 'Select All'}
                                    </Button>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="pl-8 pr-4 pb-2 space-y-1">
                                    {category.views.map(viewName => (
                                      <div key={viewName} className="flex items-center gap-2 py-1.5">
                                        <Switch
                                          checked={selectedViews.has(viewName)}
                                          onCheckedChange={(checked) => {
                                            const newSet = new Set(selectedViews);
                                            if (checked) {
                                              newSet.add(viewName);
                                            } else {
                                              newSet.delete(viewName);
                                            }
                                            setSelectedViews(newSet);
                                          }}
                                          data-testid={`switch-view-${viewName}`}
                                        />
                                        <span className="font-mono text-xs">{viewName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedViews.size} view(s) selected for scheduled refresh
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={() => updateScheduleMutation.mutate()}
                        disabled={updateScheduleMutation.isPending}
                        data-testid="button-save-schedule"
                      >
                        {updateScheduleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Save Schedule
                      </Button>
                    </div>

                    {scheduleData?.schedule?.lastRunAt && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm">
                          <strong>Last scheduled run:</strong>{" "}
                          {format(new Date(scheduleData.schedule.lastRunAt), "PPpp")}
                          {scheduleData.schedule.lastRunStatus && (
                            <Badge variant={scheduleData.schedule.lastRunStatus === 'SUCCESS' ? 'default' : 'destructive'} className="ml-2">
                              {scheduleData.schedule.lastRunStatus}
                            </Badge>
                          )}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Refresh History
                    </CardTitle>
                    <CardDescription>
                      Recent view refresh operations with timing and row counts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!historyData?.history || historyData.history.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No refresh history yet. Refresh a view to see history.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 font-medium">View</th>
                              <th className="text-left py-2 px-3 font-medium">Status</th>
                              <th className="text-left py-2 px-3 font-medium">Trigger</th>
                              <th className="text-right py-2 px-3 font-medium">Duration</th>
                              <th className="text-right py-2 px-3 font-medium">Rows</th>
                              <th className="text-right py-2 px-3 font-medium">Delta</th>
                              <th className="text-left py-2 px-3 font-medium">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.history.slice(0, 20).map((item) => (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="py-2 px-3 font-mono text-xs">{item.viewName}</td>
                                <td className="py-2 px-3">
                                  <Badge variant={item.status === 'SUCCESS' ? 'default' : 'destructive'} className="text-xs">
                                    {item.status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-muted-foreground text-xs">{item.trigger}</td>
                                <td className="py-2 px-3 text-right">{item.durationMs ? `${item.durationMs}ms` : '-'}</td>
                                <td className="py-2 px-3 text-right">{item.rowCountAfter?.toLocaleString() ?? '-'}</td>
                                <td className="py-2 px-3 text-right">
                                  {item.rowDelta !== null ? (
                                    <span className={item.rowDelta > 0 ? 'text-green-600' : item.rowDelta < 0 ? 'text-red-600' : ''}>
                                      {item.rowDelta > 0 ? '+' : ''}{item.rowDelta}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground text-xs">
                                  {item.completedAt ? formatDistanceToNow(new Date(item.completedAt), { addSuffix: true }) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="indexes">
                <div className="grid gap-6">
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
                        <div className="max-h-96 overflow-y-auto overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
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
                        <div className="max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
