import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Server,
  Database,
  Zap,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

function deriveQueueHealth(stats: QueueStats | undefined, isError: boolean): boolean {
  if (isError || !stats) return false;
  if (typeof stats.healthy === 'boolean') return stats.healthy;
  return true;
}

export default function SystemHealthPage() {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  
  const { data: queueStats, isLoading: queueLoading, isError: queueError, refetch: refetchQueue } = useQuery<QueueStats>({
    queryKey: ["queue-stats"],
    queryFn: async () => {
      const userId = localStorage.getItem("user_id");
      const res = await fetch("/api/admin/queue-stats", {
        headers: { "X-User-Id": userId || "" }
      });
      if (!res.ok) throw new Error("Failed to fetch queue stats");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: healthStatus, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthStatus>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const userId = localStorage.getItem("user_id");
      
      try {
        const dbRes = await fetch("/api/schemes", {
          headers: { "X-User-Id": userId || "" }
        });
        const dbOk = dbRes.ok;
        
        const apiRes = await fetch("/api/health", {
          headers: { "X-User-Id": userId || "" }
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
  };

  const allHealthy = healthStatus?.database && healthStatus?.api && queueHealthy;

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
                  Monitor service status and background job processing
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
          </div>
        </main>
      </div>
    </div>
  );
}
