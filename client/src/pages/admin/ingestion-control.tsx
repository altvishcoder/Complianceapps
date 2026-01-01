import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Upload, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  RefreshCw,
  Play,
  XCircle,
  Loader2,
  ArrowRight,
  TrendingUp,
  Zap,
  FileWarning,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface IngestionStats {
  queue: {
    ingestion: { queued: number; active: number; completed: number; failed: number };
    webhook: { queued: number; active: number; completed: number; failed: number };
  };
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  recentErrors: IngestionJob[];
  throughputByHour: Array<{ hour: string; count: number }>;
  avgProcessingTime: number;
  successRate: number;
}

interface IngestionJob {
  id: string;
  organisationId: string;
  certificateType: string;
  propertyUprn: string | null;
  propertyId: string | null;
  fileName: string;
  objectPath: string | null;
  status: string;
  progress: number;
  statusMessage: string | null;
  certificateId: string | null;
  errorDetails: any;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  webhookUrl: string | null;
  webhookDelivered: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-blue-100 text-blue-800 border-blue-200",
  UPLOADING: "bg-indigo-100 text-indigo-800 border-indigo-200",
  PROCESSING: "bg-amber-100 text-amber-800 border-amber-200",
  EXTRACTING: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  QUEUED: Clock,
  UPLOADING: Upload,
  PROCESSING: Loader2,
  EXTRACTING: Zap,
  COMPLETE: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: XCircle,
};

const PIPELINE_STAGES = [
  { id: "QUEUED", label: "Queued", icon: Clock },
  { id: "UPLOADING", label: "Uploading", icon: Upload },
  { id: "PROCESSING", label: "Processing", icon: Loader2 },
  { id: "EXTRACTING", label: "AI Extraction", icon: Zap },
  { id: "COMPLETE", label: "Complete", icon: CheckCircle2 },
];

const PIE_COLORS = ["#3b82f6", "#6366f1", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#6b7280"];

function PipelineStage({ stage, count, isActive }: { stage: typeof PIPELINE_STAGES[0]; count: number; isActive: boolean }) {
  const Icon = stage.icon;
  return (
    <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-muted'}`}>
      <div className={`p-3 rounded-full ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
        <Icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'} ${stage.id === 'PROCESSING' || stage.id === 'EXTRACTING' ? 'animate-spin' : ''}`} />
      </div>
      <span className="text-sm font-medium mt-2">{stage.label}</span>
      <span className={`text-2xl font-bold ${count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{count}</span>
    </div>
  );
}

export default function IngestionControlRoom() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    document.title = "Ingestion Control Room - ComplianceAI";
  }, []);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<IngestionStats>({
    queryKey: ["/api/admin/ingestion-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ingestion-stats", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<IngestionJob[]>({
    queryKey: ["/api/admin/ingestion-jobs", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/ingestion-jobs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/admin/ingestion-jobs/${jobId}/retry`, {
        method: "POST",
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to retry job");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Job Retried", description: "The job has been queued for retry" });
      refetchJobs();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: "Retry Failed", description: error.message, variant: "destructive" });
    },
  });

  const throughputData = stats?.throughputByHour.map(item => ({
    hour: new Date(item.hour + ':00:00Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    count: item.count,
  })) || [];

  const statusData = stats ? Object.entries(stats.byStatus).map(([status, count]) => ({
    name: status,
    value: count,
  })) : [];

  const typeData = stats ? Object.entries(stats.byType).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    value: count,
  })).sort((a, b) => b.value - a.value).slice(0, 8) : [];

  const totalJobs = stats ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0) : 0;
  const activeJobs = (stats?.byStatus?.QUEUED || 0) + (stats?.byStatus?.UPLOADING || 0) + 
                     (stats?.byStatus?.PROCESSING || 0) + (stats?.byStatus?.EXTRACTING || 0);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Ingestion Control Room" />
        <main id="main-content" className="flex-1 overflow-auto p-6" role="main" aria-label="Ingestion control room content" data-testid="ingestion-control-page">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ingestion Control Room</h1>
              <p className="text-muted-foreground mt-1">
                Monitor and manage certificate processing pipeline
              </p>
            </div>
            <Button onClick={() => { refetchStats(); refetchJobs(); }} variant="outline" data-testid="button-refresh">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card data-testid="card-total-jobs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalJobs}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card data-testid="card-active-jobs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{activeJobs}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
              </CardContent>
            </Card>
            <Card data-testid="card-success-rate">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{stats?.successRate.toFixed(1) || 0}%</div>
                <Progress value={stats?.successRate || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card data-testid="card-avg-time">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.avgProcessingTime.toFixed(1) || 0}s</div>
                <p className="text-xs text-muted-foreground mt-1">Per certificate</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6" data-testid="card-pipeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Pipeline Status
              </CardTitle>
              <CardDescription>Real-time view of the certificate processing pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {PIPELINE_STAGES.map((stage, index) => (
                  <div key={stage.id} className="flex items-center flex-1">
                    <PipelineStage 
                      stage={stage} 
                      count={stats?.byStatus?.[stage.id] || 0}
                      isActive={(stats?.byStatus?.[stage.id] || 0) > 0}
                    />
                    {index < PIPELINE_STAGES.length - 1 && (
                      <ArrowRight className="h-6 w-6 text-muted-foreground mx-2" />
                    )}
                  </div>
                ))}
                <div className="flex items-center flex-1">
                  <ArrowRight className="h-6 w-6 text-muted-foreground mx-2" />
                  <div className="flex flex-col items-center p-4 rounded-lg border-2 border-red-200 bg-red-50">
                    <div className="p-3 rounded-full bg-red-100">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <span className="text-sm font-medium mt-2">Failed</span>
                    <span className="text-2xl font-bold text-red-600">{stats?.byStatus?.FAILED || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="jobs" data-testid="tab-jobs">Job Queue</TabsTrigger>
              <TabsTrigger value="errors" data-testid="tab-errors">Error Triage</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-throughput">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Throughput (24 Hours)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={throughputData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Jobs" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-by-type">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Jobs by Certificate Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={typeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" name="Jobs" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-queue-health">
                <CardHeader>
                  <CardTitle>Queue Health</CardTitle>
                  <CardDescription>pg-boss job queue statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Certificate Ingestion Queue</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span>Queued:</span><Badge variant="secondary">{stats?.queue?.ingestion?.queued || 0}</Badge></div>
                        <div className="flex justify-between"><span>Active:</span><Badge className="bg-blue-100 text-blue-800">{stats?.queue?.ingestion?.active || 0}</Badge></div>
                        <div className="flex justify-between"><span>Completed:</span><Badge className="bg-emerald-100 text-emerald-800">{stats?.queue?.ingestion?.completed || 0}</Badge></div>
                        <div className="flex justify-between"><span>Failed:</span><Badge className="bg-red-100 text-red-800">{stats?.queue?.ingestion?.failed || 0}</Badge></div>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Webhook Delivery Queue</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span>Queued:</span><Badge variant="secondary">{stats?.queue?.webhook?.queued || 0}</Badge></div>
                        <div className="flex justify-between"><span>Active:</span><Badge className="bg-blue-100 text-blue-800">{stats?.queue?.webhook?.active || 0}</Badge></div>
                        <div className="flex justify-between"><span>Completed:</span><Badge className="bg-emerald-100 text-emerald-800">{stats?.queue?.webhook?.completed || 0}</Badge></div>
                        <div className="flex justify-between"><span>Failed:</span><Badge className="bg-red-100 text-red-800">{stats?.queue?.webhook?.failed || 0}</Badge></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Job Queue</CardTitle>
                      <CardDescription>All ingestion jobs with current status</CardDescription>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40" data-testid="select-status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="QUEUED">Queued</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="EXTRACTING">Extracting</SelectItem>
                        <SelectItem value="COMPLETE">Complete</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Certificate Type</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Attempts</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs?.map((job) => {
                          const StatusIcon = STATUS_ICONS[job.status] || Clock;
                          return (
                            <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                              <TableCell className="font-medium">{job.certificateType.replace(/_/g, ' ')}</TableCell>
                              <TableCell className="max-w-48 truncate" title={job.fileName}>{job.fileName}</TableCell>
                              <TableCell>
                                <Badge className={STATUS_COLORS[job.status]}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'PROCESSING' || job.status === 'EXTRACTING' ? 'animate-spin' : ''}`} />
                                  {job.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={job.progress} className="w-16 h-2" />
                                  <span className="text-xs text-muted-foreground">{job.progress}%</span>
                                </div>
                              </TableCell>
                              <TableCell>{job.attemptCount}/{job.maxAttempts}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(job.createdAt), 'dd/MM/yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                {job.status === 'FAILED' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => retryMutation.mutate(job.id)}
                                    disabled={retryMutation.isPending}
                                    data-testid={`button-retry-${job.id}`}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Retry
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!jobs || jobs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No jobs found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-red-500" />
                    Error Triage
                  </CardTitle>
                  <CardDescription>Recent failed jobs requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {stats?.recentErrors && stats.recentErrors.length > 0 ? (
                      <div className="space-y-4">
                        {stats.recentErrors.map((job) => (
                          <div key={job.id} className="p-4 border rounded-lg border-red-200 bg-red-50/50" data-testid={`error-job-${job.id}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-red-100 text-red-800">{job.certificateType.replace(/_/g, ' ')}</Badge>
                                  <span className="text-sm text-muted-foreground">{job.fileName}</span>
                                </div>
                                <p className="text-sm mt-2">
                                  <strong>Error:</strong> {job.statusMessage || 'Unknown error'}
                                </p>
                                {job.errorDetails && (
                                  <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto">
                                    {typeof job.errorDetails === 'string' ? job.errorDetails : JSON.stringify(job.errorDetails, null, 2)}
                                  </pre>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Attempts: {job.attemptCount}/{job.maxAttempts}</span>
                                  <span>Failed: {format(new Date(job.updatedAt), 'dd/MM/yyyy HH:mm')}</span>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => retryMutation.mutate(job.id)}
                                disabled={retryMutation.isPending}
                                data-testid={`button-retry-error-${job.id}`}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                        <p className="font-medium">No Failed Jobs</p>
                        <p className="text-sm">All certificate ingestion jobs are processing successfully</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
