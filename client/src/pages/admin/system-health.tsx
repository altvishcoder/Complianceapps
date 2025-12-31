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
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display">System Health</h2>
                <p className="text-muted-foreground">
                  Monitor service status, background jobs, and system logs
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                data-testid="button-refresh-health"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="health" data-testid="tab-health">
                  <Activity className="h-4 w-4 mr-2" />
                  Health Status
                </TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs">
                  <FileText className="h-4 w-4 mr-2" />
                  System Logs
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="health" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card data-testid="card-database-status">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Database
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {healthLoading ? (
                          <Badge variant="outline" data-testid="badge-database-checking">Checking...</Badge>
                        ) : healthStatus?.database ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-green-600" data-testid="text-database-connected">Connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <span className="text-sm font-medium text-red-600" data-testid="text-database-error">Connection Issue</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-api-status">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        API Server
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {healthLoading ? (
                          <Badge variant="outline" data-testid="badge-api-checking">Checking...</Badge>
                        ) : healthStatus?.api ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-green-600" data-testid="text-api-operational">Operational</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <span className="text-sm font-medium text-red-600" data-testid="text-api-degraded">Degraded</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-queue-status">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Background Jobs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {queueLoading ? (
                          <Badge variant="outline" data-testid="badge-queue-checking">Checking...</Badge>
                        ) : queueHealthy ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium text-green-600" data-testid="text-queue-running">Running</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <span className="text-sm font-medium text-red-600" data-testid="text-queue-stopped">Stopped</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

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

                <Card data-testid="card-overall-status">
                  <CardHeader>
                    <CardTitle>Overall System Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      {healthLoading ? (
                        <Badge variant="outline" className="text-lg py-2 px-4">
                          Checking systems...
                        </Badge>
                      ) : allHealthy ? (
                        <Badge 
                          className="text-lg py-2 px-4 bg-green-100 text-green-800 hover:bg-green-100"
                          data-testid="badge-all-systems-operational"
                        >
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          All Systems Operational
                        </Badge>
                      ) : (
                        <Badge 
                          variant="destructive" 
                          className="text-lg py-2 px-4"
                          data-testid="badge-system-issues"
                        >
                          <AlertCircle className="h-5 w-5 mr-2" />
                          Some Services Degraded
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-4" data-testid="text-last-checked">
                      Last checked: {lastChecked.toLocaleTimeString()}
                    </p>
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
