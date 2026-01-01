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
  RotateCcw,
  Timer,
  CalendarClock
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
  byChannel: Record<string, number>;
  recentErrors: IngestionJob[];
  throughputByHour: Array<{ hour: string; count: number }>;
  avgProcessingTime: number;
  successRate: number;
  certificates?: {
    total: number;
    recent24h: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    throughputByHour: Array<{ hour: string; count: number }>;
    pending: number;
    processing: number;
    approved: number;
    successRate: number;
  };
  recentCertificates?: Array<{
    id: string;
    certificateType: string;
    fileName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface IngestionJob {
  id: string;
  organisationId: string;
  certificateType: string;
  propertyUprn: string | null;
  propertyId: string | null;
  fileName: string;
  objectPath: string | null;
  channel: string | null;
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

interface ScheduledJobInfo {
  name: string;
  cron: string;
  timezone: string;
  lastRun: string | null;
  nextRun: string | null;
  recentJobs: Array<{
    id: string;
    state: string;
    createdOn: string;
    completedOn: string | null;
  }>;
}

const CHANNEL_COLORS: Record<string, string> = {
  MANUAL_UPLOAD: "bg-blue-100 text-blue-800 border-blue-200",
  EXTERNAL_API: "bg-purple-100 text-purple-800 border-purple-200",
  BULK_IMPORT: "bg-cyan-100 text-cyan-800 border-cyan-200",
  DEMO: "bg-gray-100 text-gray-500 border-gray-200",
};

const CHANNEL_LABELS: Record<string, string> = {
  MANUAL_UPLOAD: "Manual",
  EXTERNAL_API: "API",
  BULK_IMPORT: "Bulk",
  DEMO: "Demo",
};

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
  { id: "UPLOADED", label: "Uploaded", icon: Upload },
  { id: "PROCESSING", label: "Processing", icon: Loader2 },
  { id: "EXTRACTED", label: "Extracted", icon: Zap },
  { id: "NEEDS_REVIEW", label: "Needs Review", icon: FileWarning },
  { id: "APPROVED", label: "Approved", icon: CheckCircle2 },
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

  const createTestJobsMutation = useMutation({
    mutationFn: async (count: number) => {
      const res = await fetch('/api/admin/create-test-queue-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ count }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create test jobs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test Jobs Created", description: data.message });
      refetchJobs();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Create Test Jobs", description: error.message, variant: "destructive" });
    },
  });

  const clearDemoJobsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/clear-demo-jobs', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to clear demo jobs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Demo Jobs Cleared", description: data.message });
      refetchJobs();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Clear Demo Jobs", description: error.message, variant: "destructive" });
    },
  });

  const { data: scheduledJobs, isLoading: scheduledJobsLoading, refetch: refetchScheduledJobs } = useQuery<ScheduledJobInfo[]>({
    queryKey: ["/api/admin/scheduled-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scheduled-jobs", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch scheduled jobs");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const runWatchdogMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/scheduled-jobs/watchdog/run', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to trigger watchdog");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Watchdog Triggered", description: data.message });
      refetchScheduledJobs();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Trigger Watchdog", description: error.message, variant: "destructive" });
    },
  });

  const certThroughputData = stats?.certificates?.throughputByHour?.map(item => ({
    hour: new Date(item.hour + ':00:00Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    count: item.count,
  })) || [];

  const certTypeData = stats?.certificates?.byType ? Object.entries(stats.certificates.byType).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    value: count,
  })).sort((a, b) => b.value - a.value).slice(0, 8) : [];

  const totalCertificates = stats?.certificates?.total || 0;
  const recent24h = stats?.certificates?.recent24h || 0;
  const pendingCerts = stats?.certificates?.pending || 0;
  const processingCerts = stats?.certificates?.processing || 0;
  const approvedCerts = stats?.certificates?.approved || 0;
  const certSuccessRate = stats?.certificates?.successRate || 0;

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
            <Card data-testid="card-total-certs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Certificates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalCertificates}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card data-testid="card-recent-24h">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recent (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{recent24h}</div>
                <p className="text-xs text-muted-foreground mt-1">Processed today</p>
              </CardContent>
            </Card>
            <Card data-testid="card-approved">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{approvedCerts}</div>
                <p className="text-xs text-muted-foreground mt-1">Successfully processed</p>
              </CardContent>
            </Card>
            <Card data-testid="card-pending">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending/Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{pendingCerts + processingCerts}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6" data-testid="card-pipeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Certificate Pipeline Status
              </CardTitle>
              <CardDescription>
                All certificates from any source (manual uploads, API submissions, bulk imports) - shows processing stages after upload
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {PIPELINE_STAGES.map((stage, index) => (
                  <div key={stage.id} className="flex items-center flex-1">
                    <PipelineStage 
                      stage={stage} 
                      count={stats?.certificates?.byStatus?.[stage.id] || 0}
                      isActive={(stats?.certificates?.byStatus?.[stage.id] || 0) > 0}
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
                    <span className="text-2xl font-bold text-red-600">{stats?.certificates?.byStatus?.FAILED || stats?.certificates?.byStatus?.REJECTED || 0}</span>
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
              <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled Jobs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-throughput">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Certificate Uploads (24 Hours)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={certThroughputData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Certificates" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-by-type">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Certificates by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={certTypeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" name="Certificates" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-cert-status">
                <CardHeader>
                  <CardTitle>Certificate Status Summary</CardTitle>
                  <CardDescription>Current certificate counts by processing status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Work In Progress</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span>Uploaded:</span><Badge variant="secondary">{stats?.certificates?.byStatus?.UPLOADED || 0}</Badge></div>
                        <div className="flex justify-between"><span>Processing:</span><Badge className="bg-blue-100 text-blue-800">{stats?.certificates?.byStatus?.PROCESSING || 0}</Badge></div>
                        <div className="flex justify-between"><span>Extracted:</span><Badge className="bg-purple-100 text-purple-800">{stats?.certificates?.byStatus?.EXTRACTED || 0}</Badge></div>
                        <div className="flex justify-between"><span>Needs Review:</span><Badge className="bg-amber-100 text-amber-800">{stats?.certificates?.byStatus?.NEEDS_REVIEW || 0}</Badge></div>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">Completed</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span>Approved:</span><Badge className="bg-emerald-100 text-emerald-800">{stats?.certificates?.byStatus?.APPROVED || 0}</Badge></div>
                        <div className="flex justify-between"><span>Rejected:</span><Badge className="bg-orange-100 text-orange-800">{stats?.certificates?.byStatus?.REJECTED || 0}</Badge></div>
                        <div className="flex justify-between"><span>Failed:</span><Badge className="bg-red-100 text-red-800">{stats?.certificates?.byStatus?.FAILED || 0}</Badge></div>
                        <div className="flex justify-between"><span>Total:</span><Badge variant="outline">{stats?.certificates?.total || 0}</Badge></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-queue-health">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Background Job Queue</CardTitle>
                    <CardDescription>
                      Async processing queue for API submissions and bulk imports (not manual UI uploads which process immediately)
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createTestJobsMutation.mutate(4)}
                    disabled={createTestJobsMutation.isPending}
                    data-testid="button-create-demo-jobs-overview"
                  >
                    {createTestJobsMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      <><Activity className="h-4 w-4 mr-2" /> Create Demo Jobs</>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <button
                      className="p-4 border rounded-lg text-center hover:bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer"
                      onClick={() => { setStatusFilter('QUEUED'); setActiveTab('jobs'); refetchJobs(); }}
                      data-testid="button-status-queued"
                    >
                      <div className="text-2xl font-bold text-amber-600">{stats?.byStatus?.QUEUED || 0}</div>
                      <div className="text-sm text-muted-foreground">Queued</div>
                    </button>
                    <button
                      className="p-4 border rounded-lg text-center hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => { setStatusFilter('PROCESSING'); setActiveTab('jobs'); refetchJobs(); }}
                      data-testid="button-status-processing"
                    >
                      <div className="text-2xl font-bold text-blue-600">{stats?.byStatus?.PROCESSING || 0}</div>
                      <div className="text-sm text-muted-foreground">Processing</div>
                    </button>
                    <button
                      className="p-4 border rounded-lg text-center hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer"
                      onClick={() => { setStatusFilter('COMPLETE'); setActiveTab('jobs'); refetchJobs(); }}
                      data-testid="button-status-complete"
                    >
                      <div className="text-2xl font-bold text-emerald-600">{stats?.byStatus?.COMPLETE || 0}</div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </button>
                    <button
                      className="p-4 border rounded-lg text-center hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                      onClick={() => { setStatusFilter('FAILED'); setActiveTab('jobs'); refetchJobs(); }}
                      data-testid="button-status-failed"
                    >
                      <div className="text-2xl font-bold text-red-600">{stats?.byStatus?.FAILED || 0}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </button>
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <strong>How it works:</strong> Manual uploads via the UI are processed immediately and show in the Certificate Pipeline above. 
                    API submissions and bulk imports go through this background queue first, then appear in the Pipeline once processing completes.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jobs">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Background Job Queue</CardTitle>
                      <CardDescription>Jobs from API submissions, bulk imports, and demo data (manual UI uploads process immediately and don't appear here)</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => createTestJobsMutation.mutate(4)}
                        disabled={createTestJobsMutation.isPending}
                        data-testid="button-create-demo-jobs"
                      >
                        {createTestJobsMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                          <><Activity className="h-4 w-4 mr-2" /> Create Demo Jobs</>
                        )}
                      </Button>
                      {(stats?.byChannel?.DEMO || 0) > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearDemoJobsMutation.mutate()}
                          disabled={clearDemoJobsMutation.isPending}
                          className="text-gray-600 border-gray-300 hover:bg-gray-100"
                          data-testid="button-clear-demo-jobs"
                        >
                          {clearDemoJobsMutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Clearing...</>
                          ) : (
                            <><XCircle className="h-4 w-4 mr-2" /> Clear Demo ({stats?.byChannel?.DEMO})</>
                          )}
                        </Button>
                      )}
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
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
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
                          const channel = job.channel || 'MANUAL_UPLOAD';
                          return (
                            <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                              <TableCell>
                                <Badge className={CHANNEL_COLORS[channel] || CHANNEL_COLORS.MANUAL_UPLOAD} variant="outline">
                                  {CHANNEL_LABELS[channel] || channel}
                                </Badge>
                              </TableCell>
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
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                        {stats.recentErrors.map((job) => {
                          const isTimeout = job.errorDetails?.reason === 'PROCESSING_TIMEOUT' || 
                                           job.statusMessage?.includes('timeout');
                          return (
                            <div 
                              key={job.id} 
                              className={`p-4 border rounded-lg ${
                                isTimeout 
                                  ? 'border-amber-200 bg-amber-50/50' 
                                  : 'border-red-200 bg-red-50/50'
                              }`}
                              data-testid={`error-job-${job.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {isTimeout && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Timeout
                                      </Badge>
                                    )}
                                    <Badge className={isTimeout ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                                      {job.certificateType.replace(/_/g, ' ')}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">{job.fileName}</span>
                                  </div>
                                  <p className="text-sm mt-2">
                                    <strong>{isTimeout ? 'Reason:' : 'Error:'}</strong> {job.statusMessage || 'Unknown error'}
                                  </p>
                                  {job.errorDetails && !isTimeout && (
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
                          );
                        })}
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

            <TabsContent value="scheduled">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-blue-500" />
                        Scheduled Jobs
                      </CardTitle>
                      <CardDescription>Background tasks running on a schedule</CardDescription>
                    </div>
                    <Button
                      onClick={() => refetchScheduledJobs()}
                      variant="outline"
                      size="sm"
                      data-testid="button-refresh-scheduled"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {scheduledJobsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : scheduledJobs && scheduledJobs.length > 0 ? (
                    <div className="space-y-6">
                      {scheduledJobs.map((job) => (
                        <div key={job.name} className="border rounded-lg p-4" data-testid={`scheduled-job-${job.name}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">
                                <Timer className="h-4 w-4 text-amber-500" />
                                {job.name === 'certificate-watchdog' ? 'Certificate Watchdog' : job.name}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Marks certificates stuck in PROCESSING status as FAILED after timeout
                              </p>
                            </div>
                            <Button
                              onClick={() => runWatchdogMutation.mutate()}
                              disabled={runWatchdogMutation.isPending}
                              size="sm"
                              data-testid="button-run-watchdog"
                            >
                              {runWatchdogMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4 mr-2" />
                              )}
                              Run Now
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-xs text-muted-foreground mb-1">Schedule</p>
                              <p className="font-mono text-sm">{job.cron}</p>
                              <p className="text-xs text-muted-foreground">({job.timezone})</p>
                            </div>
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-xs text-muted-foreground mb-1">Last Run</p>
                              <p className="text-sm">
                                {job.lastRun 
                                  ? format(new Date(job.lastRun), 'dd/MM/yyyy HH:mm:ss')
                                  : 'Never'}
                              </p>
                            </div>
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-xs text-muted-foreground mb-1">Recent Runs</p>
                              <p className="text-sm font-medium">{job.recentJobs.length} jobs</p>
                            </div>
                          </div>

                          {job.recentJobs.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Run History</h4>
                              <ScrollArea className="h-48">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Job ID</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Created</TableHead>
                                      <TableHead>Completed</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {job.recentJobs.map((run) => (
                                      <TableRow key={run.id} data-testid={`scheduled-run-${run.id}`}>
                                        <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}...</TableCell>
                                        <TableCell>
                                          <Badge 
                                            className={
                                              run.state === 'completed' 
                                                ? 'bg-emerald-100 text-emerald-800' 
                                                : run.state === 'failed' 
                                                  ? 'bg-red-100 text-red-800'
                                                  : run.state === 'active'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-blue-100 text-blue-800'
                                            }
                                          >
                                            {run.state}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                          {format(new Date(run.createdOn), 'dd/MM HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                          {run.completedOn 
                                            ? format(new Date(run.completedOn), 'dd/MM HH:mm:ss')
                                            : '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarClock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="font-medium">No Scheduled Jobs</p>
                      <p className="text-sm">Scheduled jobs will appear here once configured</p>
                    </div>
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
