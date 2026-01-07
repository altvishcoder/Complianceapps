import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Clock, 
  Zap,
  RefreshCcw,
  Shield,
  Gauge,
  BarChart3,
  TrendingUp,
  Target,
  CircleDot,
  FileCheck
} from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

interface CircuitBreakerStatus {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  totalCalls: number;
  totalFailures: number;
  lastFailureTime: number | null;
  config: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
  };
}

interface CircuitBreakerData {
  success: boolean;
  data: CircuitBreakerStatus[];
  timestamp: string;
}

interface QueueMetricsData {
  success: boolean;
  data: {
    ingestion: { queued: number; active: number; completed: number; failed: number };
    webhook: { queued: number; active: number; completed: number; failed: number };
    healthy?: boolean;
  };
  timestamp: string;
}

interface ProcessingMetricsData {
  success: boolean;
  data: {
    extraction: {
      totalRuns: number;
      avgProcessingTime: string | null;
      avgConfidence: string | null;
    };
    certificates: {
      total: number;
      uploaded: number;
      processing: number;
      extracted: number;
      needsReview: number;
      approved: number;
      failed: number;
    };
    reviews: {
      totalReviews: number;
      correctCount: number;
      avgChangeCount: string | null;
      avgReviewTime: string | null;
    };
    period: string;
  };
  timestamp: string;
}

interface ConfidenceBaseline {
  certificate_type: string;
  field_name: string;
  sample_count: number;
  avg_confidence: number;
  median_confidence: number;
  correction_count: number;
  accuracy_rate: number;
}

interface ConfidenceBaselinesData {
  success: boolean;
  data: ConfidenceBaseline[];
}

function CircuitBreakerStateIcon({ state }: { state: string }) {
  switch (state) {
    case 'CLOSED':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'OPEN':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'HALF_OPEN':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    default:
      return <CircleDot className="h-5 w-5 text-muted-foreground" />;
  }
}

function CircuitBreakerStateBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    CLOSED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    OPEN: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    HALF_OPEN: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  };
  
  return (
    <Badge variant="outline" className={`text-xs ${styles[state] || ''}`}>
      {state.replace('_', ' ')}
    </Badge>
  );
}

function formatServiceName(name: string): string {
  const serviceNameMap: Record<string, string> = {
    'claude-vision': 'Document Vision',
    'claude-text': 'Text Analysis',
    'azure-di': 'Document Intelligence',
    'object-storage': 'File Storage',
    'webhook-delivery': 'Webhook Delivery',
  };
  
  if (serviceNameMap[name]) {
    return serviceNameMap[name];
  }
  
  return name
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ObservabilityDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const { data: circuitBreakers, refetch: refetchCircuitBreakers, isLoading: cbLoading } = useQuery<CircuitBreakerData>({
    queryKey: ["observability", "circuit-breakers"],
    queryFn: async () => {
      const res = await fetch("/api/observability/circuit-breakers", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch circuit breakers");
      return res.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: queueMetrics, refetch: refetchQueue, isLoading: queueLoading } = useQuery<QueueMetricsData>({
    queryKey: ["observability", "queue-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/observability/queue-metrics", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch queue metrics");
      return res.json();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: processingMetrics, refetch: refetchProcessing, isLoading: processingLoading } = useQuery<ProcessingMetricsData>({
    queryKey: ["observability", "processing-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/observability/processing-metrics", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch processing metrics");
      return res.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: confidenceBaselines, refetch: refetchBaselines, isLoading: baselinesLoading } = useQuery<ConfidenceBaselinesData>({
    queryKey: ["observability", "confidence-baselines"],
    queryFn: async () => {
      const res = await fetch("/api/observability/confidence-baselines", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch confidence baselines");
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const refreshAll = () => {
    refetchCircuitBreakers();
    refetchQueue();
    refetchProcessing();
    refetchBaselines();
    setLastRefresh(new Date());
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => setLastRefresh(new Date()), 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const cbData = circuitBreakers?.data || [];
  const openCircuitBreakers = cbData.filter(cb => cb.state === 'OPEN').length;
  const halfOpenCircuitBreakers = cbData.filter(cb => cb.state === 'HALF_OPEN').length;
  
  const queueData = queueMetrics?.data;
  const totalQueued = queueData 
    ? (queueData.ingestion?.queued || 0) + (queueData.ingestion?.active || 0) + 
      (queueData.webhook?.queued || 0) + (queueData.webhook?.active || 0)
    : 0;
  
  const certData = processingMetrics?.data?.certificates;
  const totalCertificates = certData?.total || 0;
  const failedCertificates = certData?.failed || 0;
  const approvedCertificates = certData?.approved || 0;
  const overallSuccessRate = totalCertificates > 0 ? approvedCertificates / totalCertificates : 0;

  if (authLoading) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  const isInitialLoad = cbLoading && queueLoading && processingLoading && !circuitBreakers && !queueMetrics && !processingMetrics;

  if (isInitialLoad) {
    return (
      <div className="flex h-screen bg-background" data-testid="observability-dashboard">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Observability Dashboard" />
          <main className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <CardSkeleton key={i} hasHeader={false} contentHeight={80} />
              ))}
            </div>
            <CardSkeleton contentHeight={300} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background" data-testid="observability-dashboard">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Observability Dashboard" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  data-testid="switch-auto-refresh"
                />
                <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh</Label>
              </div>
              <span className="text-xs text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshAll}
              data-testid="button-refresh-all"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh All
            </Button>
          </div>

          {/* Hero Stats Cards */}
          <div className="mb-6">
            <HeroStatsGrid stats={[
              {
                title: "System Health",
                value: openCircuitBreakers === 0 && halfOpenCircuitBreakers === 0 
                  ? "Healthy" 
                  : openCircuitBreakers > 0 
                    ? `${openCircuitBreakers} Failed`
                    : `${halfOpenCircuitBreakers} Recovering`,
                subtitle: `${cbData.length} circuit breakers monitored`,
                icon: Shield,
                riskLevel: openCircuitBreakers === 0 && halfOpenCircuitBreakers === 0 
                  ? "good" 
                  : openCircuitBreakers > 0 
                    ? "critical"
                    : "medium",
                testId: "hero-card-circuit-breakers",
              },
              {
                title: "Queue Depth",
                value: totalQueued,
                subtitle: `${(queueData?.ingestion?.active || 0) + (queueData?.webhook?.active || 0)} actively processing`,
                icon: Gauge,
                riskLevel: totalQueued === 0 ? "low" : totalQueued > 100 ? "medium" : "low",
                testId: "hero-card-queue-depth",
              },
              {
                title: "Approval Rate",
                value: `${(overallSuccessRate * 100).toFixed(1)}%`,
                subtitle: `${approvedCertificates} of ${totalCertificates} approved`,
                icon: TrendingUp,
                riskLevel: overallSuccessRate >= 0.9 ? "good" : overallSuccessRate >= 0.7 ? "medium" : "critical",
                testId: "hero-card-success-rate",
              },
              {
                title: "Certificates (24h)",
                value: totalCertificates,
                subtitle: `${certData?.needsReview || 0} awaiting review`,
                icon: FileCheck,
                riskLevel: failedCertificates > 0 ? "high" : (certData?.needsReview || 0) > 10 ? "medium" : "good",
                testId: "hero-card-certificates",
              },
            ]} />
          </div>

          <Tabs defaultValue="circuit-breakers" className="space-y-4">
            <TabsList data-testid="tabs-observability">
              <TabsTrigger value="circuit-breakers" data-testid="tab-circuit-breakers">
                <Shield className="h-4 w-4 mr-2" />
                Circuit Breakers
              </TabsTrigger>
              <TabsTrigger value="queues" data-testid="tab-queues">
                <Gauge className="h-4 w-4 mr-2" />
                Queue Metrics
              </TabsTrigger>
              <TabsTrigger value="processing" data-testid="tab-processing">
                <Activity className="h-4 w-4 mr-2" />
                Processing
              </TabsTrigger>
              <TabsTrigger value="confidence" data-testid="tab-confidence">
                <Target className="h-4 w-4 mr-2" />
                Confidence Baselines
              </TabsTrigger>
            </TabsList>

            <TabsContent value="circuit-breakers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Circuit Breaker Status</CardTitle>
                  <CardDescription>
                    Protection mechanisms for external service calls. Open circuits prevent cascading failures.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cbLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cbData.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mb-2 opacity-50" />
                          <p>No circuit breakers registered yet</p>
                        </div>
                      ) : (
                        cbData.map((cb) => (
                          <Card key={cb.name} className="border" data-testid={`card-cb-${cb.name}`}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <CircuitBreakerStateIcon state={cb.state} />
                                  <span className="font-medium">{formatServiceName(cb.name)}</span>
                                </div>
                                <CircuitBreakerStateBadge state={cb.state} />
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Failures</span>
                                  <span className={cb.failures > 0 ? 'text-red-600 font-medium' : ''}>{cb.failures}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Total Calls</span>
                                  <span>{cb.totalCalls}</span>
                                </div>
                                {cb.state === 'HALF_OPEN' && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Successes (recovery)</span>
                                    <span className="text-green-600">{cb.successes}</span>
                                  </div>
                                )}
                                {cb.lastFailureTime && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Last Failure</span>
                                    <span className="text-xs">{new Date(cb.lastFailureTime).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queues" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Queue Metrics</CardTitle>
                  <CardDescription>
                    Job queue depths and processing status across all queues.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {queueLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {queueData ? (
                        ['ingestion', 'webhook'].map((queueName) => {
                          const queue = queueData[queueName as keyof typeof queueData] as { queued: number; active: number; completed: number; failed: number } | undefined;
                          if (!queue || typeof queue !== 'object') return null;
                          
                          const total = queue.queued + queue.active + queue.completed + queue.failed;
                          const successRate = total > 0 ? (queue.completed / total) * 100 : 0;
                          
                          return (
                            <div key={queueName} className="space-y-2" data-testid={`queue-${queueName}`}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{formatServiceName(queueName)}</span>
                                <Badge variant={queue.failed > 0 ? "destructive" : "secondary"}>
                                  {queue.queued + queue.active} queued
                                </Badge>
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold text-amber-600">{queue.queued}</div>
                                  <div className="text-xs text-muted-foreground">Queued</div>
                                </div>
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold text-blue-600">{queue.active}</div>
                                  <div className="text-xs text-muted-foreground">Active</div>
                                </div>
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold text-green-600">{queue.completed}</div>
                                  <div className="text-xs text-muted-foreground">Completed</div>
                                </div>
                                <div className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold text-red-600">{queue.failed}</div>
                                  <div className="text-xs text-muted-foreground">Failed</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={successRate} className="flex-1" />
                                <span className="text-xs text-muted-foreground w-16 text-right">
                                  {successRate.toFixed(1)}% success
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <Gauge className="h-12 w-12 mb-2 opacity-50" />
                          <p>No queue data available</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processing" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Certificate Status (Last 24h)</CardTitle>
                    <CardDescription>Breakdown of certificate processing status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {processingLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold">{certData?.total || 0}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-amber-600">{certData?.uploaded || 0}</div>
                            <div className="text-xs text-muted-foreground">Uploaded</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{certData?.processing || 0}</div>
                            <div className="text-xs text-muted-foreground">Processing</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{certData?.extracted || 0}</div>
                            <div className="text-xs text-muted-foreground">Extracted</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{certData?.needsReview || 0}</div>
                            <div className="text-xs text-muted-foreground">Needs Review</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{certData?.approved || 0}</div>
                            <div className="text-xs text-muted-foreground">Approved</div>
                          </div>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Failed</span>
                            <span className="text-2xl font-bold text-red-600">{certData?.failed || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Extraction Stats</CardTitle>
                    <CardDescription>AI extraction performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {processingLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Total Runs</div>
                            <div className="text-2xl font-bold">{processingMetrics?.data?.extraction?.totalRuns || 0}</div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Avg Processing Time</div>
                            <div className="text-2xl font-bold">
                              {processingMetrics?.data?.extraction?.avgProcessingTime 
                                ? `${(parseFloat(processingMetrics.data.extraction.avgProcessingTime) / 1000).toFixed(1)}s` 
                                : '-'}
                            </div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Avg Confidence</div>
                            <div className="text-2xl font-bold">
                              {processingMetrics?.data?.extraction?.avgConfidence 
                                ? `${(parseFloat(processingMetrics.data.extraction.avgConfidence) * 100).toFixed(0)}%`
                                : '-'}
                            </div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Total Reviews</div>
                            <div className="text-2xl font-bold">{processingMetrics?.data?.reviews?.totalReviews || 0}</div>
                          </div>
                        </div>
                        {processingMetrics?.data?.reviews && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Correct on First Pass</span>
                              <span className="text-2xl font-bold text-green-600">{processingMetrics.data.reviews.correctCount || 0}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="confidence" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Confidence Baselines</CardTitle>
                  <CardDescription>
                    Field-level accuracy metrics for AI extraction. Used to calibrate auto-approval thresholds.
                    Requires 10+ samples per field to generate baselines.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {baselinesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : confidenceBaselines?.data?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Target className="h-16 w-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No confidence baselines yet</p>
                      <p className="text-sm text-center max-w-md mt-2">
                        Baselines are generated after processing and reviewing certificates. 
                        Each field needs at least 10 samples to establish an accuracy baseline.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Certificate Type</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead className="text-right">Samples</TableHead>
                            <TableHead className="text-right">Avg Confidence</TableHead>
                            <TableHead className="text-right">Corrections</TableHead>
                            <TableHead className="text-right">Accuracy</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {confidenceBaselines?.data?.map((baseline, idx) => (
                            <TableRow key={`${baseline.certificate_type}-${baseline.field_name}`} data-testid={`baseline-${idx}`}>
                              <TableCell className="font-medium">{baseline.certificate_type}</TableCell>
                              <TableCell>{baseline.field_name}</TableCell>
                              <TableCell className="text-right">{baseline.sample_count}</TableCell>
                              <TableCell className="text-right">
                                {(baseline.avg_confidence * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={baseline.correction_count > 0 ? 'text-amber-600' : ''}>
                                  {baseline.correction_count}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={baseline.accuracy_rate >= 0.95 ? "default" : baseline.accuracy_rate >= 0.9 ? "secondary" : "destructive"}>
                                  {(baseline.accuracy_rate * 100).toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
