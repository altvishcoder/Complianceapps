import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Server,
  Database,
  Zap,
  RefreshCcw,
  FileText,
  Search,
  AlertTriangle,
  Info,
  XCircle,
  Calendar,
  Timer,
  Play,
  Pause,
  HardDrive,
  Layers,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";

interface QueueStats {
  ingestion: {
    queued: number;
    active: number;
    completed: number;
    failed: number;
  };
  webhook: {
    queued: number;
    active: number;
    completed: number;
    failed: number;
  };
  healthy?: boolean;
}

interface HealthStatus {
  database: boolean;
  api: boolean;
  queue: boolean;
}

interface SystemLog {
  id: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  timestamp: string;
}

interface LogsResponse {
  logs: SystemLog[];
  total: number;
}

interface ScheduledJob {
  name: string;
  displayName: string;
  cronExpression: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  enabled: boolean;
  status: 'active' | 'paused' | 'error';
  recentHistory?: {
    completedCount: number;
    failedCount: number;
  };
}

interface MemoryCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

interface CacheRegion {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  layer: string;
  category: string;
  isActive: boolean;
  isProtected: boolean;
  isSystem: boolean;
}

function deriveQueueHealth(stats: QueueStats | undefined, isError: boolean): boolean {
  if (isError || !stats) return false;
  if (typeof stats.healthy === 'boolean') return stats.healthy;
  return true;
}

function LogLevelIcon({ level }: { level: string }) {
  switch (level) {
    case 'error':
    case 'fatal':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function LogLevelBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    error: "bg-red-100 text-red-800 border-red-200",
    fatal: "bg-red-200 text-red-900 border-red-300",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    info: "bg-blue-100 text-blue-800 border-blue-200",
  };
  
  return (
    <Badge variant="outline" className={`text-xs ${variants[level] || ''}`}>
      {level.toUpperCase()}
    </Badge>
  );
}

interface VersionInfo {
  version: string;
  name: string;
  environment: string;
  buildTime: string;
  uptime: number;
  release: {
    date: string;
    highlights: string[];
  } | null;
}

export default function SystemHealthPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("health");
  
  const [logLevel, setLogLevel] = useState<string>("all");
  const [logSource, setLogSource] = useState<string>("all");
  const [logSearch, setLogSearch] = useState<string>("");
  const [logPage, setLogPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logsPerPage = 50;
  
  const { data: versionInfo } = useQuery<VersionInfo>({
    queryKey: ["version"],
    queryFn: async () => {
      const res = await fetch("/api/version", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch version");
      return res.json();
    },
    staleTime: 60000,
  });
  
  const { data: queueStats, isLoading: queueLoading, isError: queueError, refetch: refetchQueue } = useQuery<QueueStats>({
    queryKey: ["queue-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/queue-stats", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch queue stats");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: !!user?.id,
  });

  const { data: healthStatus, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthStatus>({
    queryKey: ["system-health"],
    queryFn: async () => {
      try {
        const dbRes = await fetch("/api/schemes", {
          credentials: 'include'
        });
        const dbOk = dbRes.ok;
        
        const apiRes = await fetch("/api/health", {
          credentials: 'include'
        });
        const apiOk = apiRes.ok || apiRes.status === 404;
        
        return {
          database: dbOk,
          api: apiOk,
          queue: true,
        };
      } catch {
        return {
          database: false,
          api: false,
          queue: false,
        };
      }
    },
    refetchInterval: 30000,
    enabled: !!user?.id,
  });
  
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<LogsResponse>({
    queryKey: ["system-logs", logLevel, logSource, logSearch, logPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: logsPerPage.toString(),
        offset: (logPage * logsPerPage).toString(),
      });
      if (logLevel !== "all") params.set("level", logLevel);
      if (logSource !== "all") params.set("source", logSource);
      if (logSearch) params.set("search", logSearch);
      
      const res = await fetch(`/api/admin/logs?${params}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
    enabled: activeTab === "logs" && !!user?.id,
  });

  const { data: scheduledJobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<ScheduledJob[]>({
    queryKey: ["scheduled-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scheduled-jobs", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch scheduled jobs");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: activeTab === "jobs" && !!user?.id,
  });

  const { data: memoryCacheStats, isLoading: cacheStatsLoading, refetch: refetchCacheStats } = useQuery<MemoryCacheStats>({
    queryKey: ["memory-cache-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cache/memory-stats", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch cache stats");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: activeTab === "cache" && !!user?.id,
  });

  const { data: cacheRegions, isLoading: regionsLoading, refetch: refetchRegions } = useQuery<CacheRegion[]>({
    queryKey: ["cache-regions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cache/regions", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch cache regions");
      return res.json();
    },
    refetchInterval: 60000,
    enabled: activeTab === "cache" && !!user?.id,
  });
  
  const queueHealthy = deriveQueueHealth(queueStats, queueError);
  
  useEffect(() => {
    if (!healthLoading && !queueLoading) {
      setLastChecked(new Date());
    }
  }, [healthLoading, queueLoading, healthStatus, queueStats]);

  const handleRefresh = () => {
    refetchQueue();
    refetchHealth();
    if (activeTab === "logs") {
      refetchLogs();
    }
    if (activeTab === "jobs") {
      refetchJobs();
    }
    if (activeTab === "cache") {
      refetchCacheStats();
      refetchRegions();
    }
  };
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLogPage(0);
    refetchLogs();
  };

  const allHealthy = healthStatus?.database && healthStatus?.api && queueHealthy;
  const totalPages = logsData ? Math.ceil(logsData.total / logsPerPage) : 0;

  if (authLoading) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Please log in to view system health</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Health" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6" role="main" aria-label="System health content">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight font-display">System Health</h2>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Monitor service status, background jobs, and system logs
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {versionInfo && (
                  <div className="text-right hidden md:block" data-testid="version-info">
                    <p className="text-sm font-medium">{versionInfo.name} v{versionInfo.version}</p>
                    <p className="text-xs text-muted-foreground">
                      {versionInfo.environment} | Uptime: {Math.floor(versionInfo.uptime / 3600)}h {Math.floor((versionInfo.uptime % 3600) / 60)}m
                    </p>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleRefresh}
                  data-testid="button-refresh-health"
                  title="Refresh"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
            </div>

            <div 
              className={`rounded-xl p-4 md:p-6 border-2 transition-all ${
                healthLoading || queueLoading 
                  ? 'bg-muted/50 border-muted-foreground/20' 
                  : allHealthy 
                    ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40 border-emerald-400 dark:border-emerald-600' 
                    : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 border-red-400 dark:border-red-600'
              }`}
              data-testid="overall-system-status"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`p-3 md:p-4 rounded-full ${
                    healthLoading || queueLoading 
                      ? 'bg-muted' 
                      : allHealthy 
                        ? 'bg-emerald-500' 
                        : 'bg-red-500'
                  }`}>
                    {healthLoading || queueLoading ? (
                      <RefreshCcw className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground animate-spin" />
                    ) : allHealthy ? (
                      <CheckCircle2 className="h-6 w-6 md:h-8 md:w-8 text-white" />
                    ) : (
                      <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-lg md:text-2xl font-bold ${
                      healthLoading || queueLoading 
                        ? 'text-muted-foreground' 
                        : allHealthy 
                          ? 'text-emerald-700 dark:text-emerald-300' 
                          : 'text-red-700 dark:text-red-300'
                    }`}>
                      {healthLoading || queueLoading 
                        ? 'Checking Systems...' 
                        : allHealthy 
                          ? 'All Systems Operational' 
                          : 'System Issues Detected'}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Last checked: {lastChecked.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-4">
                  {!healthLoading && !queueLoading && (
                    <div className="flex gap-2">
                      <Badge className={healthStatus?.database ? 'bg-emerald-500' : 'bg-red-500'}>
                        <Database className="h-3 w-3 mr-1" /> DB
                      </Badge>
                      <Badge className={healthStatus?.api ? 'bg-emerald-500' : 'bg-red-500'}>
                        <Server className="h-3 w-3 mr-1" /> API
                      </Badge>
                      <Badge className={queueHealthy ? 'bg-emerald-500' : 'bg-red-500'}>
                        <Zap className="h-3 w-3 mr-1" /> Jobs
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <Card data-testid="card-database-status" className="p-2 md:p-0">
                <CardHeader className="p-2 md:p-6 pb-1 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2">
                    <Database className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Database</span>
                    <span className="sm:hidden">DB</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    {healthLoading ? (
                      <Badge variant="outline" className="text-xs" data-testid="badge-database-checking">...</Badge>
                    ) : healthStatus?.database ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                        <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400 hidden sm:inline" data-testid="text-database-connected">Connected</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                        <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hidden sm:inline" data-testid="text-database-error">Error</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-api-status" className="p-2 md:p-0">
                <CardHeader className="p-2 md:p-6 pb-1 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2">
                    <Server className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">API Server</span>
                    <span className="sm:hidden">API</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    {healthLoading ? (
                      <Badge variant="outline" className="text-xs" data-testid="badge-api-checking">...</Badge>
                    ) : healthStatus?.api ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                        <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400 hidden sm:inline" data-testid="text-api-operational">OK</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                        <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hidden sm:inline" data-testid="text-api-degraded">Error</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-queue-status" className="p-2 md:p-0">
                <CardHeader className="p-2 md:p-6 pb-1 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-1 md:gap-2">
                    <Zap className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Background Jobs</span>
                    <span className="sm:hidden">Jobs</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    {queueLoading ? (
                      <Badge variant="outline" className="text-xs" data-testid="badge-queue-checking">...</Badge>
                    ) : queueHealthy ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                        <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400 hidden sm:inline" data-testid="text-queue-running">OK</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                        <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hidden sm:inline" data-testid="text-queue-stopped">Error</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between p-3 md:p-4 rounded-lg border bg-muted/30" data-testid="overall-status-bar">
              <div className="flex items-center gap-3">
                {healthLoading ? (
                  <Badge variant="outline" className="py-1 px-3">
                    Checking...
                  </Badge>
                ) : allHealthy ? (
                  <Badge 
                    className="py-1 px-3 bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/50"
                    data-testid="badge-all-systems-operational"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    All Systems Operational
                  </Badge>
                ) : (
                  <Badge 
                    variant="destructive" 
                    className="py-1 px-3"
                    data-testid="badge-system-issues"
                  >
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Some Services Degraded
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-last-checked">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="health" data-testid="tab-health">
                  <Activity className="h-4 w-4 mr-2" />
                  Health Status
                </TabsTrigger>
                <TabsTrigger value="jobs" data-testid="tab-jobs">
                  <Calendar className="h-4 w-4 mr-2" />
                  Scheduled Jobs
                </TabsTrigger>
                <TabsTrigger value="cache" data-testid="tab-cache">
                  <HardDrive className="h-4 w-4 mr-2" />
                  Cache Stats
                </TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs">
                  <FileText className="h-4 w-4 mr-2" />
                  System Logs
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="health" className="space-y-6">
                <HeroStatsGrid stats={[
                  {
                    title: "Total Queued",
                    value: (queueStats?.ingestion?.queued ?? 0) + (queueStats?.webhook?.queued ?? 0),
                    icon: Clock,
                    riskLevel: ((queueStats?.ingestion?.queued ?? 0) + (queueStats?.webhook?.queued ?? 0)) > 50 ? "high" : 
                               ((queueStats?.ingestion?.queued ?? 0) + (queueStats?.webhook?.queued ?? 0)) > 10 ? "medium" : "good",
                    testId: "stat-total-queued"
                  },
                  {
                    title: "Processing",
                    value: (queueStats?.ingestion?.active ?? 0) + (queueStats?.webhook?.active ?? 0),
                    icon: Activity,
                    riskLevel: "low",
                    testId: "stat-total-processing"
                  },
                  {
                    title: "Completed",
                    value: (queueStats?.ingestion?.completed ?? 0) + (queueStats?.webhook?.completed ?? 0),
                    icon: CheckCircle2,
                    riskLevel: "good",
                    testId: "stat-total-completed"
                  },
                  {
                    title: "Failed",
                    value: (queueStats?.ingestion?.failed ?? 0) + (queueStats?.webhook?.failed ?? 0),
                    icon: AlertCircle,
                    riskLevel: ((queueStats?.ingestion?.failed ?? 0) + (queueStats?.webhook?.failed ?? 0)) > 0 ? "critical" : "good",
                    testId: "stat-total-failed"
                  }
                ]} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-ingestion-queue">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Certificate Processing Queue
                      </CardTitle>
                      <CardDescription>
                        Status of certificate ingestion jobs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {queueLoading ? (
                        <div className="text-sm text-muted-foreground">Loading queue statistics...</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-sm text-muted-foreground">Queued</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-ingestion-queued">
                                {queueStats?.ingestion?.queued ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-muted-foreground">Processing</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-ingestion-active">
                                {queueStats?.ingestion?.active ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-muted-foreground">Completed</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-ingestion-completed">
                                {queueStats?.ingestion?.completed ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-muted-foreground">Failed</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-ingestion-failed">
                                {queueStats?.ingestion?.failed ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-webhook-queue">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Webhook Delivery Queue
                      </CardTitle>
                      <CardDescription>
                        Status of outgoing webhook notifications
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {queueLoading ? (
                        <div className="text-sm text-muted-foreground">Loading queue statistics...</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-sm text-muted-foreground">Queued</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-webhook-queued">
                                {queueStats?.webhook?.queued ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-muted-foreground">Delivering</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-webhook-active">
                                {queueStats?.webhook?.active ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-muted-foreground">Delivered</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-webhook-completed">
                                {queueStats?.webhook?.completed ?? 0}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-muted-foreground">Failed</span>
                              </div>
                              <p className="text-2xl font-bold" data-testid="text-webhook-failed">
                                {queueStats?.webhook?.failed ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

              </TabsContent>

              <TabsContent value="jobs" className="space-y-6">
                <HeroStatsGrid stats={[
                  {
                    title: "Total Jobs",
                    value: scheduledJobs?.length ?? 0,
                    icon: Calendar,
                    riskLevel: "low",
                    testId: "stat-jobs-total"
                  },
                  {
                    title: "Active",
                    value: scheduledJobs?.filter(j => j.enabled && j.status === 'active').length ?? 0,
                    icon: Play,
                    riskLevel: "good",
                    testId: "stat-jobs-active"
                  },
                  {
                    title: "Paused",
                    value: scheduledJobs?.filter(j => !j.enabled || j.status === 'paused').length ?? 0,
                    icon: Pause,
                    riskLevel: (scheduledJobs?.filter(j => !j.enabled || j.status === 'paused').length ?? 0) > 0 ? "medium" : "good",
                    testId: "stat-jobs-paused"
                  },
                  {
                    title: "Errors",
                    value: scheduledJobs?.filter(j => j.status === 'error').length ?? 0,
                    icon: AlertCircle,
                    riskLevel: (scheduledJobs?.filter(j => j.status === 'error').length ?? 0) > 0 ? "critical" : "good",
                    testId: "stat-jobs-errors"
                  }
                ]} />

                <Card data-testid="card-scheduled-jobs-list">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="h-5 w-5" />
                      Scheduled Jobs
                    </CardTitle>
                    <CardDescription>
                      Cron jobs configured for background processing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {jobsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading scheduled jobs...
                      </div>
                    ) : scheduledJobs && scheduledJobs.length > 0 ? (
                      <div className="space-y-3">
                        {scheduledJobs.map((job) => (
                          <div 
                            key={job.name} 
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-muted/30"
                            data-testid={`job-row-${job.name}`}
                          >
                            <div className="flex items-center gap-3 mb-2 md:mb-0">
                              {job.enabled && job.status === 'active' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : job.status === 'error' ? (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                <Pause className="h-5 w-5 text-amber-500" />
                              )}
                              <div>
                                <p className="font-medium" data-testid={`job-name-${job.name}`}>
                                  {job.displayName}
                                </p>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {job.cronExpression}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Next:</span>
                                <span data-testid={`job-next-run-${job.name}`}>
                                  {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : 'Not scheduled'}
                                </span>
                              </div>
                              {job.recentHistory && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-green-600">
                                    {job.recentHistory.completedCount} completed
                                  </Badge>
                                  {job.recentHistory.failedCount > 0 && (
                                    <Badge variant="outline" className="text-red-600">
                                      {job.recentHistory.failedCount} failed
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <Badge 
                                variant={job.status === 'error' ? 'destructive' : job.status === 'active' ? 'default' : 'secondary'}
                                className={job.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                              >
                                {job.status === 'active' ? 'Active' : job.status === 'error' ? 'Error' : 'Paused'}
                              </Badge>
                              <Badge variant={job.enabled ? "outline" : "secondary"}>
                                {job.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-jobs">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No scheduled jobs found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cache" className="space-y-6">
                <HeroStatsGrid stats={[
                  {
                    title: "Cache Size",
                    value: memoryCacheStats?.size ?? 0,
                    subtitle: "entries",
                    icon: HardDrive,
                    riskLevel: "low",
                    testId: "stat-cache-size"
                  },
                  {
                    title: "Cache Hits",
                    value: memoryCacheStats?.hits ?? 0,
                    icon: CheckCircle2,
                    riskLevel: "good",
                    testId: "stat-cache-hits"
                  },
                  {
                    title: "Cache Misses",
                    value: memoryCacheStats?.misses ?? 0,
                    icon: XCircle,
                    riskLevel: (memoryCacheStats?.misses ?? 0) > (memoryCacheStats?.hits ?? 0) ? "high" : "medium",
                    testId: "stat-cache-misses"
                  },
                  {
                    title: "Evictions",
                    value: memoryCacheStats?.evictions ?? 0,
                    icon: AlertTriangle,
                    riskLevel: (memoryCacheStats?.evictions ?? 0) > 100 ? "high" : (memoryCacheStats?.evictions ?? 0) > 0 ? "medium" : "good",
                    testId: "stat-cache-evictions"
                  }
                ]} />

                <Card data-testid="card-hit-ratio">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Cache Hit Ratio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cacheStatsLoading ? (
                      <div className="text-muted-foreground">Loading stats...</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all"
                              style={{
                                width: `${memoryCacheStats && (memoryCacheStats.hits + memoryCacheStats.misses) > 0 
                                  ? ((memoryCacheStats.hits / (memoryCacheStats.hits + memoryCacheStats.misses)) * 100).toFixed(1) 
                                  : 0}%`
                              }}
                            />
                          </div>
                          <span className="text-lg font-bold" data-testid="text-hit-ratio">
                            {memoryCacheStats && (memoryCacheStats.hits + memoryCacheStats.misses) > 0 
                              ? ((memoryCacheStats.hits / (memoryCacheStats.hits + memoryCacheStats.misses)) * 100).toFixed(1)
                              : 0}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Higher hit ratio indicates better cache efficiency. Target is above 80%.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-cache-regions">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Cache Regions by Layer
                    </CardTitle>
                    <CardDescription>
                      Configured cache regions across all layers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {regionsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading cache regions...
                      </div>
                    ) : cacheRegions && cacheRegions.length > 0 ? (
                      <div className="space-y-4">
                        {['CLIENT', 'API', 'DATABASE', 'MEMORY', 'SESSION'].map((layer) => {
                          const layerRegions = cacheRegions.filter(r => r.layer === layer);
                          if (layerRegions.length === 0) return null;
                          return (
                            <div key={layer} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">
                                  {layer}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {layerRegions.length} region{layerRegions.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-4">
                                {layerRegions.map((region) => (
                                  <div 
                                    key={region.id}
                                    className="p-2 rounded border bg-muted/30 text-sm"
                                    data-testid={`cache-region-${region.name}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{region.displayName}</span>
                                      {region.isActive ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Pause className="h-3 w-3 text-amber-500" />
                                      )}
                                    </div>
                                    {region.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{region.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-regions">
                        <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No cache regions configured</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          System Logs
                        </CardTitle>
                        <CardDescription>
                          View and filter application logs
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="auto-refresh"
                          checked={autoRefresh}
                          onCheckedChange={setAutoRefresh}
                          data-testid="switch-auto-refresh"
                        />
                        <Label htmlFor="auto-refresh" className="text-sm">
                          Auto-refresh
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search logs..."
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                            className="pl-10"
                            data-testid="input-log-search"
                          />
                        </div>
                      </div>
                      <Select value={logLevel} onValueChange={(val) => { setLogLevel(val); setLogPage(0); }}>
                        <SelectTrigger className="w-[140px]" data-testid="select-log-level">
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warn">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="fatal">Fatal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={logSource} onValueChange={(val) => { setLogSource(val); setLogPage(0); }}>
                        <SelectTrigger className="w-[160px]" data-testid="select-log-source">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="job-queue">Job Queue</SelectItem>
                          <SelectItem value="extraction">Extraction</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="submit" variant="secondary" data-testid="button-search-logs">
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </form>
                    
                    {logsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading logs...
                      </div>
                    ) : logsData && logsData.logs.length > 0 ? (
                      <>
                        <ScrollArea className="h-[500px] rounded-md border">
                          <div className="p-4 space-y-2">
                            {logsData.logs.map((log) => (
                              <div 
                                key={log.id} 
                                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                data-testid={`log-entry-${log.id}`}
                              >
                                <LogLevelIcon level={log.level} />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <LogLevelBadge level={log.level} />
                                    <Badge variant="secondary" className="text-xs">
                                      {log.source}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                    {log.requestId && (
                                      <span className="text-xs text-muted-foreground font-mono">
                                        [{log.requestId.slice(0, 8)}]
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm break-words" data-testid={`log-message-${log.id}`}>
                                    {log.message}
                                  </p>
                                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        View metadata
                                      </summary>
                                      <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Showing {logPage * logsPerPage + 1} - {Math.min((logPage + 1) * logsPerPage, logsData.total)} of {logsData.total} logs
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLogPage(p => Math.max(0, p - 1))}
                              disabled={logPage === 0}
                              data-testid="button-prev-page"
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLogPage(p => p + 1)}
                              disabled={logPage >= totalPages - 1}
                              data-testid="button-next-page"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-logs">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No logs found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or wait for new logs to appear</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
