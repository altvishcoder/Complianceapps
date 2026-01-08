import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Database, 
  RefreshCcw, 
  Zap, 
  Gauge,
  Activity,
  Clock,
  HardDrive,
  Layers,
  Server,
  Monitor,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Settings,
  Info,
  Trash2,
  Eye,
  Timer
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface CacheRegionStats {
  name: string;
  displayName: string;
  category: string;
  ttlSeconds: number;
  stats: {
    hits: number;
    misses: number;
    evictions: number;
    entries: number;
    memoryEstimateBytes: number;
  };
  hitRate: number;
}

interface CacheStatsResponse {
  current: {
    global: {
      hits: number;
      misses: number;
      evictions: number;
      hitRate: number;
      uptimeMs: number;
    };
    regions: CacheRegionStats[];
    totalEntries: number;
    totalMemoryBytes: number;
  };
  historical: any[];
}

interface DbOptimizationStatus {
  indexes: { name: string; tableName: string; size: string }[];
  materializedViews: { name: string; rowCount: number; lastRefresh: string | null; lastDurationMs: number | null }[];
  optimizationTables: { name: string; rowCount: number }[];
}

interface ClientPerformanceSettings {
  staleTimeMs: number;
  gcTimeMs: number;
  debounceDelayMs: number;
  prefetchingEnabled: boolean;
  refetchOnWindowFocus: boolean;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

function PerformanceCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function CacheRegionSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20 mt-1" />
          </div>
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function DatabaseSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between py-2 border-b">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map(section => (
        <Card key={section}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map(item => (
              <div key={item} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48 mt-1" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PerformanceSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['dashboard', 'navigation']));
  const [activeTab, setActiveTab] = useState("overview");

  const { data: cacheStats, isLoading: cacheLoading, refetch: refetchCache } = useQuery<CacheStatsResponse>({
    queryKey: ["/api/admin/cache/stats"],
    enabled: !!user?.id,
    staleTime: 10000,
  });

  const { data: dbStatus, isLoading: dbLoading, refetch: refetchDb } = useQuery<DbOptimizationStatus>({
    queryKey: ["/api/admin/db-optimization/status"],
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const { data: clientSettings } = useQuery<ClientPerformanceSettings>({
    queryKey: ["/api/admin/performance/client-settings"],
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const clearCacheMutation = useMutation({
    mutationFn: async (region: string) => {
      const res = await fetch("/api/admin/cache/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scope: "REGION", identifier: region, reason: "Manual clear from Performance Settings" }),
      });
      if (!res.ok) throw new Error("Failed to clear cache");
      return res.json();
    },
    onSuccess: (_, region) => {
      toast({ title: "Cache Cleared", description: `${region} cache has been cleared successfully.` });
      refetchCache();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear cache", variant: "destructive" });
    },
  });

  const clearAllCacheMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cache/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scope: "ALL", reason: "Manual clear all from Performance Settings" }),
      });
      if (!res.ok) throw new Error("Failed to clear all caches");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "All Caches Cleared", description: "All cache regions have been cleared successfully." });
      refetchCache();
      queryClient.clear();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear caches", variant: "destructive" });
    },
  });

  const refreshViewMutation = useMutation({
    mutationFn: async (viewName: string) => {
      const res = await fetch("/api/admin/db-optimization/refresh-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ viewName }),
      });
      if (!res.ok) throw new Error("Failed to refresh view");
      return res.json();
    },
    onSuccess: (data, viewName) => {
      toast({ 
        title: "View Refreshed", 
        description: `${viewName} refreshed in ${formatDuration(data.durationMs)} with ${data.rowCount.toLocaleString()} rows.` 
      });
      refetchDb();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to refresh view", variant: "destructive" });
    },
  });

  const refreshAllViewsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/db-optimization/refresh-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to refresh views");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "All Views Refreshed", 
        description: `${data.results?.length || 0} views refreshed in ${formatDuration(data.totalDurationMs)}.` 
      });
      refetchDb();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to refresh views", variant: "destructive" });
    },
  });

  const categorizedRegions = useMemo(() => {
    if (!cacheStats?.current?.regions) return {};
    return cacheStats.current.regions.reduce((acc, region) => {
      const cat = region.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(region);
      return acc;
    }, {} as Record<string, CacheRegionStats[]>);
  }, [cacheStats?.current?.regions]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const isLoading = authLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Performance Settings" />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => <PerformanceCardSkeleton key={i} />)}
              </div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-6">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24" />)}
                  </div>
                  <SettingsSkeleton />
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const cacheData = cacheStats?.current;
  const globalStats = cacheData?.global;

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Performance Settings" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-6">
            {/* Hero Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              {cacheLoading ? (
                [1, 2, 3, 4].map(i => <PerformanceCardSkeleton key={i} />)
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{(globalStats?.hitRate || 0).toFixed(1)}%</div>
                      <Progress value={globalStats?.hitRate || 0} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-2">
                        {globalStats?.hits?.toLocaleString() || 0} hits / {globalStats?.misses?.toLocaleString() || 0} misses
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        <HardDrive className="h-4 w-4 text-blue-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatBytes(cacheData?.totalMemoryBytes || 0)}</div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {cacheData?.totalEntries?.toLocaleString() || 0} cached entries
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Cache Regions</CardTitle>
                        <Layers className="h-4 w-4 text-purple-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{cacheData?.regions?.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Active cache regions
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">DB Views</CardTitle>
                        <Database className="h-4 w-4 text-orange-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dbStatus?.materializedViews?.length || 0}</div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Materialized views active
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Main Content Tabs */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Performance Configuration
                </CardTitle>
                <CardDescription>
                  Manage caching, database optimizations, and client-side performance settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
                      <Activity className="h-4 w-4" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="query-cache" className="gap-2" data-testid="tab-query-cache">
                      <Server className="h-4 w-4" /> Query Cache
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-2" data-testid="tab-database">
                      <Database className="h-4 w-4" /> Database
                    </TabsTrigger>
                    <TabsTrigger value="client" className="gap-2" data-testid="tab-client">
                      <Monitor className="h-4 w-4" /> Client Settings
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Server Cache Summary */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Server-Side Cache
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {cacheLoading ? (
                            <SettingsSkeleton />
                          ) : (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Entries</span>
                                <span className="font-medium">{cacheData?.totalEntries?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Memory Used</span>
                                <span className="font-medium">{formatBytes(cacheData?.totalMemoryBytes || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Hit Rate</span>
                                <span className="font-medium text-green-600">{(globalStats?.hitRate || 0).toFixed(1)}%</span>
                              </div>
                              <Separator />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => clearAllCacheMutation.mutate()}
                                disabled={clearAllCacheMutation.isPending}
                                data-testid="button-clear-all-cache"
                              >
                                {clearAllCacheMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Clear All Caches
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      {/* Database Optimization Summary */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Database Optimization
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {dbLoading ? (
                            <SettingsSkeleton />
                          ) : (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Performance Indexes</span>
                                <span className="font-medium">{dbStatus?.indexes?.length || 0}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Materialized Views</span>
                                <span className="font-medium">{dbStatus?.materializedViews?.length || 0}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Optimization Tables</span>
                                <span className="font-medium">{dbStatus?.optimizationTables?.length || 0}</span>
                              </div>
                              <Separator />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => refreshAllViewsMutation.mutate()}
                                disabled={refreshAllViewsMutation.isPending}
                                data-testid="button-refresh-all-views"
                              >
                                {refreshAllViewsMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                )}
                                Refresh All Views
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Client Settings Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          Client-Side Performance
                        </CardTitle>
                        <CardDescription>
                          Current browser-side caching and performance settings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Clock className="h-4 w-4" />
                              Stale Time
                            </div>
                            <div className="text-lg font-semibold">30 seconds</div>
                            <p className="text-xs text-muted-foreground">Data freshness window</p>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <HardDrive className="h-4 w-4" />
                              Cache Time
                            </div>
                            <div className="text-lg font-semibold">5 minutes</div>
                            <p className="text-xs text-muted-foreground">Data retention period</p>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Timer className="h-4 w-4" />
                              Debounce Delay
                            </div>
                            <div className="text-lg font-semibold">300ms</div>
                            <p className="text-xs text-muted-foreground">Search input delay</p>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Zap className="h-4 w-4" />
                              Prefetching
                            </div>
                            <div className="text-lg font-semibold flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              Enabled
                            </div>
                            <p className="text-xs text-muted-foreground">Hover-triggered loading</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Query Cache Tab */}
                  <TabsContent value="query-cache" className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Cache Regions</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage server-side query cache by region
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refetchCache()}
                          data-testid="button-refresh-cache-stats"
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Refresh Stats
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => clearAllCacheMutation.mutate()}
                          disabled={clearAllCacheMutation.isPending}
                          data-testid="button-clear-all-cache-tab"
                        >
                          {clearAllCacheMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Clear All
                        </Button>
                      </div>
                    </div>

                    {cacheLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => <CacheRegionSkeleton key={i} />)}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(categorizedRegions).map(([category, regions]) => (
                          <Collapsible 
                            key={category}
                            open={expandedCategories.has(category)}
                            onOpenChange={() => toggleCategory(category)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                                <div className="flex items-center gap-3">
                                  {expandedCategories.has(category) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span className="font-medium capitalize">{category}</span>
                                  <Badge variant="secondary">{regions.length} regions</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>{regions.reduce((sum, r) => sum + (r.stats?.entries || 0), 0).toLocaleString()} entries</span>
                                  <span>{formatBytes(regions.reduce((sum, r) => sum + (r.stats?.memoryEstimateBytes || 0), 0))}</span>
                                </div>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 pl-4 pr-2">
                              {regions.map(region => (
                                <div 
                                  key={region.name}
                                  className="border rounded-lg p-4 bg-card"
                                  data-testid={`cache-region-${region.name}`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h4 className="font-medium">{region.displayName}</h4>
                                      <p className="text-xs text-muted-foreground">
                                        TTL: {region.ttlSeconds}s • Category: {region.category}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => clearCacheMutation.mutate(region.name)}
                                      disabled={clearCacheMutation.isPending}
                                      data-testid={`button-clear-${region.name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Hit Rate</p>
                                      <p className="font-medium text-green-600">{(region.hitRate || 0).toFixed(1)}%</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Hits / Misses</p>
                                      <p className="font-medium">{region.stats?.hits || 0} / {region.stats?.misses || 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Entries</p>
                                      <p className="font-medium">{(region.stats?.entries || 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Memory</p>
                                      <p className="font-medium">{formatBytes(region.stats?.memoryEstimateBytes || 0)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Database Tab */}
                  <TabsContent value="database" className="space-y-6">
                    {dbLoading ? (
                      <DatabaseSkeleton />
                    ) : (
                      <>
                        {/* Summary Stats */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Performance Indexes</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{dbStatus?.indexes?.length || 0}</div>
                              <p className="text-xs text-muted-foreground">
                                {dbStatus?.indexes?.reduce((sum, idx) => {
                                  const size = parseFloat(idx.size) || 0;
                                  return sum + size;
                                }, 0).toFixed(1)} MB total size
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Materialized Views</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{dbStatus?.materializedViews?.length || 0}</div>
                              <p className="text-xs text-muted-foreground">
                                {dbStatus?.materializedViews?.reduce((sum, v) => sum + v.rowCount, 0).toLocaleString()} total rows
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Optimization Tables</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{dbStatus?.optimizationTables?.length || 0}</div>
                              <p className="text-xs text-muted-foreground">
                                {dbStatus?.optimizationTables?.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()} cached records
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Materialized Views */}
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle>Materialized Views</CardTitle>
                                <CardDescription>Pre-computed query results for faster dashboard loading</CardDescription>
                              </div>
                              <Button 
                                variant="outline"
                                onClick={() => refreshAllViewsMutation.mutate()}
                                disabled={refreshAllViewsMutation.isPending}
                                data-testid="button-refresh-all-views-db"
                              >
                                {refreshAllViewsMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                )}
                                Refresh All
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="divide-y">
                              {dbStatus?.materializedViews?.map(view => (
                                <div key={view.name} className="py-3 flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{view.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {view.rowCount.toLocaleString()} rows
                                      {view.lastRefresh && ` • Last refreshed ${formatDistanceToNow(new Date(view.lastRefresh), { addSuffix: true })}`}
                                      {view.lastDurationMs && ` (${formatDuration(view.lastDurationMs)})`}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => refreshViewMutation.mutate(view.name)}
                                    disabled={refreshViewMutation.isPending}
                                    data-testid={`button-refresh-${view.name}`}
                                  >
                                    <RefreshCcw className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                          <CardFooter className="text-sm text-muted-foreground">
                            <Info className="h-4 w-4 mr-2" />
                            For detailed database optimization controls, visit the{" "}
                            <a href="/admin/db-optimization" className="text-primary hover:underline">Database Optimization</a> page.
                          </CardFooter>
                        </Card>
                      </>
                    )}
                  </TabsContent>

                  {/* Client Settings Tab */}
                  <TabsContent value="client" className="space-y-6">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
                      <div className="flex gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900 dark:text-blue-100">Code-Level Settings</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            These settings are configured at the application code level for optimal performance. 
                            Changes require code deployment.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Query Caching */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            TanStack Query Cache
                          </CardTitle>
                          <CardDescription>
                            Browser-side data caching configuration
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Stale Time</p>
                              <p className="text-sm text-muted-foreground">How long data is considered fresh</p>
                            </div>
                            <Badge variant="secondary">30 seconds</Badge>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Garbage Collection Time</p>
                              <p className="text-sm text-muted-foreground">How long unused data stays in cache</p>
                            </div>
                            <Badge variant="secondary">5 minutes</Badge>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Refetch on Window Focus</p>
                              <p className="text-sm text-muted-foreground">Update data when returning to tab</p>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Enabled
                            </Badge>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Retry on Failure</p>
                              <p className="text-sm text-muted-foreground">Retry failed requests</p>
                            </div>
                            <Badge variant="secondary">1 retry (1s delay)</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Search Debouncing */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Timer className="h-4 w-4" />
                            Search Optimization
                          </CardTitle>
                          <CardDescription>
                            Input debouncing and search performance
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Debounce Delay</p>
                              <p className="text-sm text-muted-foreground">Delay before search triggers</p>
                            </div>
                            <Badge variant="secondary">300ms</Badge>
                          </div>
                          <Separator />
                          <div className="py-2">
                            <p className="font-medium mb-2">Pages with Debounced Search</p>
                            <div className="flex flex-wrap gap-2">
                              {['Properties', 'Hierarchy', 'Certificates', 'Actions', 'Regulatory'].map(page => (
                                <Badge key={page} variant="outline">{page}</Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Prefetching */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Data Prefetching
                          </CardTitle>
                          <CardDescription>
                            Pre-load data on hover for faster navigation
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">Hover Prefetching</p>
                              <p className="text-sm text-muted-foreground">Load data when hovering over links</p>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Enabled
                            </Badge>
                          </div>
                          <Separator />
                          <div className="py-2">
                            <p className="font-medium mb-2">Prefetch-Enabled Areas</p>
                            <div className="flex flex-wrap gap-2">
                              {['Dashboard Cards', 'Property Rows', 'Navigation Links'].map(area => (
                                <Badge key={area} variant="outline">{area}</Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Memoization */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Computed Data Optimization
                          </CardTitle>
                          <CardDescription>
                            Memoization and computed value caching
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="font-medium">useMemo Optimization</p>
                              <p className="text-sm text-muted-foreground">Cache expensive calculations</p>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          </div>
                          <Separator />
                          <div className="py-2">
                            <p className="font-medium mb-2">Memoized Operations</p>
                            <div className="flex flex-wrap gap-2">
                              {['Filtering', 'Sorting', 'Aggregations', 'Tree Building'].map(op => (
                                <Badge key={op} variant="outline">{op}</Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
