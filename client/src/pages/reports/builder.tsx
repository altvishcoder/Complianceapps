import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Plus,
  Play,
  Clock,
  Calendar,
  Download,
  Settings,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Shield,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  Copy,
  Trash2,
  Edit,
  FileDown,
  Mail,
  Timer,
  Database,
  RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const reportTemplates = [
  {
    id: "compliance-summary",
    name: "Compliance Summary",
    description: "Overall compliance status across all streams with trends",
    icon: Shield,
    category: "Compliance",
    estimatedTime: "~30 seconds",
    cached: true,
    lastRun: "2025-12-28 14:00"
  },
  {
    id: "certificate-expiry",
    name: "Certificate Expiry Report",
    description: "Upcoming certificate expirations by property and stream",
    icon: Calendar,
    category: "Certificates",
    estimatedTime: "~45 seconds",
    cached: true,
    lastRun: "2025-12-28 10:00"
  },
  {
    id: "contractor-performance",
    name: "Contractor Performance",
    description: "SLA compliance, response times, and quality metrics",
    icon: Users,
    category: "Contractors",
    estimatedTime: "~1 minute",
    cached: false,
    lastRun: "2025-12-27 18:00"
  },
  {
    id: "remedial-actions",
    name: "Remedial Actions Status",
    description: "Open, in-progress, and completed remedial actions",
    icon: AlertTriangle,
    category: "Actions",
    estimatedTime: "~30 seconds",
    cached: true,
    lastRun: "2025-12-28 12:00"
  },
  {
    id: "property-health",
    name: "Property Health Report",
    description: "Asset condition and compliance scores by property",
    icon: Building2,
    category: "Properties",
    estimatedTime: "~2 minutes",
    cached: false,
    lastRun: "2025-12-26 06:00"
  },
  {
    id: "board-pack",
    name: "Board Pack",
    description: "Executive summary for board meetings",
    icon: BarChart3,
    category: "Executive",
    estimatedTime: "~3 minutes",
    cached: false,
    lastRun: "2025-12-25 06:00"
  },
  {
    id: "hse-evidence",
    name: "HSE Evidence Pack",
    description: "Regulatory compliance evidence for HSE inspections",
    icon: FileText,
    category: "Regulatory",
    estimatedTime: "~5 minutes",
    cached: false,
    lastRun: "2025-12-20 06:00"
  },
  {
    id: "risk-assessment",
    name: "Risk Assessment Report",
    description: "Property risk scores and mitigation status",
    icon: TrendingUp,
    category: "Risk",
    estimatedTime: "~2 minutes",
    cached: true,
    lastRun: "2025-12-28 06:00"
  },
];

const scheduledReports = [
  {
    id: "sched-001",
    name: "Weekly Compliance Summary",
    template: "Compliance Summary",
    schedule: "Every Monday at 06:00",
    recipients: ["compliance@housing.org", "manager@housing.org"],
    format: "PDF",
    status: "Active",
    nextRun: "2026-01-06 06:00"
  },
  {
    id: "sched-002",
    name: "Daily Certificate Expiry Alert",
    template: "Certificate Expiry Report",
    schedule: "Daily at 07:00",
    recipients: ["operations@housing.org"],
    format: "Email",
    status: "Active",
    nextRun: "2025-12-29 07:00"
  },
  {
    id: "sched-003",
    name: "Monthly Board Pack",
    template: "Board Pack",
    schedule: "1st of month at 06:00",
    recipients: ["board@housing.org", "ceo@housing.org"],
    format: "PDF",
    status: "Active",
    nextRun: "2026-01-01 06:00"
  },
  {
    id: "sched-004",
    name: "Quarterly HSE Evidence",
    template: "HSE Evidence Pack",
    schedule: "Quarterly (Jan, Apr, Jul, Oct)",
    recipients: ["compliance@housing.org", "hse@housing.org"],
    format: "PDF + CSV",
    status: "Paused",
    nextRun: "2026-01-01 06:00"
  },
];

const recentReports = [
  { name: "Compliance Summary", generatedAt: "2025-12-28 14:00", size: "2.4 MB", format: "PDF", status: "Ready" },
  { name: "Certificate Expiry Report", generatedAt: "2025-12-28 10:00", size: "1.8 MB", format: "Excel", status: "Ready" },
  { name: "Contractor Performance", generatedAt: "2025-12-27 18:00", size: "3.2 MB", format: "PDF", status: "Ready" },
  { name: "Board Pack", generatedAt: "2025-12-25 06:00", size: "8.5 MB", format: "PDF", status: "Ready" },
];

const dataMetrics = {
  cacheHitRate: 94,
  avgQueryTime: "1.2s",
  offPeakScheduled: 12,
  materializedViews: 8,
  lastRefresh: "2025-12-28 06:00"
};

const complianceStreams = [
  { id: "gas", name: "Gas Safety" },
  { id: "electrical", name: "Electrical" },
  { id: "fire", name: "Fire Safety" },
  { id: "legionella", name: "Legionella" },
  { id: "asbestos", name: "Asbestos" },
  { id: "epc", name: "Energy (EPC)" },
];

export default function ReportBuilder() {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customReportConfig, setCustomReportConfig] = useState({
    dateRange: "last30",
    streams: [] as string[],
    properties: "all",
    groupBy: "stream",
    includeCharts: true,
    format: "pdf"
  });

  const handleGenerateReport = (templateId: string) => {
    setIsGenerating(templateId);
    setTimeout(() => setIsGenerating(null), 3000);
  };

  const handleStreamToggle = (streamId: string) => {
    setCustomReportConfig(prev => ({
      ...prev,
      streams: prev.streams.includes(streamId)
        ? prev.streams.filter(s => s !== streamId)
        : [...prev.streams, streamId]
    }));
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Report Builder" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground" data-testid="text-subtitle">
                  Create, schedule, and manage compliance reports
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-schedule-report">
                      <Clock className="h-4 w-4 mr-2" />
                      Schedule Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Schedule a Report</DialogTitle>
                      <DialogDescription>
                        Schedule reports to run during off-peak hours for optimal performance
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Report Template</Label>
                        <Select>
                          <SelectTrigger data-testid="select-schedule-template">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {reportTemplates.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Schedule</Label>
                        <Select>
                          <SelectTrigger data-testid="select-schedule-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily-6am">Daily at 06:00 (Off-peak)</SelectItem>
                            <SelectItem value="weekly-mon">Weekly on Monday 06:00</SelectItem>
                            <SelectItem value="monthly-1st">Monthly on 1st at 06:00</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Recipients</Label>
                        <Input placeholder="email@example.com" data-testid="input-schedule-recipients" />
                        <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select defaultValue="pdf">
                          <SelectTrigger data-testid="select-schedule-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
                      <Button data-testid="button-confirm-schedule">Create Schedule</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card data-testid="card-cache-rate">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Zap className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-cache-rate">{dataMetrics.cacheHitRate}%</p>
                      <p className="text-xs text-muted-foreground">Cache Hit Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-query-time">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Timer className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-query-time">{dataMetrics.avgQueryTime}</p>
                      <p className="text-xs text-muted-foreground">Avg Query Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-off-peak">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-off-peak">{dataMetrics.offPeakScheduled}</p>
                      <p className="text-xs text-muted-foreground">Off-Peak Scheduled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-materialized-views">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Database className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-materialized-views">{dataMetrics.materializedViews}</p>
                      <p className="text-xs text-muted-foreground">Materialized Views</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-last-refresh">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                      <RefreshCw className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold" data-testid="text-last-refresh">{dataMetrics.lastRefresh}</p>
                      <p className="text-xs text-muted-foreground">Last Data Refresh</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="templates" className="space-y-6">
              <TabsList data-testid="tabs-reports">
                <TabsTrigger value="templates" data-testid="tab-templates">Report Templates</TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom">Custom Report</TabsTrigger>
                <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled Reports</TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">Report History</TabsTrigger>
              </TabsList>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {reportTemplates.map((template, index) => (
                    <Card 
                      key={template.id} 
                      className="hover:border-primary/50 transition-colors cursor-pointer"
                      data-testid={`card-template-${index}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <template.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex items-center gap-1">
                            {template.cached && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-cached-${index}`}>
                                <Zap className="h-3 w-3 mr-1" />
                                Cached
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardTitle className="text-base mt-3" data-testid={`text-template-name-${index}`}>
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-xs" data-testid={`text-template-desc-${index}`}>
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                          <span data-testid={`text-template-category-${index}`}>{template.category}</span>
                          <span data-testid={`text-template-time-${index}`}>{template.estimatedTime}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            disabled={isGenerating === template.id}
                            onClick={() => handleGenerateReport(template.id)}
                            data-testid={`button-generate-${index}`}
                          >
                            {isGenerating === template.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedTemplate(template.id);
                              setShowScheduleDialog(true);
                            }}
                            data-testid={`button-schedule-template-${index}`}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2" data-testid={`text-last-run-${index}`}>
                          Last run: {template.lastRun}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Custom Report Tab */}
              <TabsContent value="custom" className="space-y-6">
                <Card data-testid="card-custom-builder">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Build Custom Report
                    </CardTitle>
                    <CardDescription>
                      Configure your own report with specific data and visualizations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Date Range */}
                      <div className="space-y-2">
                        <Label>Date Range</Label>
                        <Select 
                          value={customReportConfig.dateRange}
                          onValueChange={(v) => setCustomReportConfig(prev => ({ ...prev, dateRange: v }))}
                        >
                          <SelectTrigger data-testid="select-date-range">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="last7">Last 7 days</SelectItem>
                            <SelectItem value="last30">Last 30 days</SelectItem>
                            <SelectItem value="last90">Last 90 days</SelectItem>
                            <SelectItem value="thisYear">This year</SelectItem>
                            <SelectItem value="custom">Custom range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Properties */}
                      <div className="space-y-2">
                        <Label>Properties</Label>
                        <Select 
                          value={customReportConfig.properties}
                          onValueChange={(v) => setCustomReportConfig(prev => ({ ...prev, properties: v }))}
                        >
                          <SelectTrigger data-testid="select-properties">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Properties</SelectItem>
                            <SelectItem value="scheme">By Scheme</SelectItem>
                            <SelectItem value="block">By Block</SelectItem>
                            <SelectItem value="select">Select Specific</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Group By */}
                      <div className="space-y-2">
                        <Label>Group By</Label>
                        <Select 
                          value={customReportConfig.groupBy}
                          onValueChange={(v) => setCustomReportConfig(prev => ({ ...prev, groupBy: v }))}
                        >
                          <SelectTrigger data-testid="select-group-by">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stream">Compliance Stream</SelectItem>
                            <SelectItem value="property">Property</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Format */}
                      <div className="space-y-2">
                        <Label>Output Format</Label>
                        <Select 
                          value={customReportConfig.format}
                          onValueChange={(v) => setCustomReportConfig(prev => ({ ...prev, format: v }))}
                        >
                          <SelectTrigger data-testid="select-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF Report</SelectItem>
                            <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                            <SelectItem value="csv">CSV Data</SelectItem>
                            <SelectItem value="dashboard">Interactive Dashboard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Compliance Streams */}
                    <div className="space-y-3">
                      <Label>Compliance Streams</Label>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {complianceStreams.map((stream) => (
                          <div key={stream.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={stream.id}
                              checked={customReportConfig.streams.includes(stream.id)}
                              onCheckedChange={() => handleStreamToggle(stream.id)}
                              data-testid={`checkbox-stream-${stream.id}`}
                            />
                            <Label htmlFor={stream.id} className="text-sm font-normal cursor-pointer">
                              {stream.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Include Charts & Visualizations</p>
                        <p className="text-sm text-muted-foreground">Add graphs and charts to the report</p>
                      </div>
                      <Switch 
                        checked={customReportConfig.includeCharts}
                        onCheckedChange={(v) => setCustomReportConfig(prev => ({ ...prev, includeCharts: v }))}
                        data-testid="switch-include-charts"
                      />
                    </div>

                    {/* Performance Notice */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-200">Performance Optimized</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Reports use pre-aggregated data from materialized views. Heavy queries are automatically 
                            scheduled during off-peak hours (6 AM - 8 AM) to avoid impacting system performance.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button data-testid="button-generate-custom">
                        <Play className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                      <Button variant="outline" data-testid="button-schedule-custom">
                        <Clock className="h-4 w-4 mr-2" />
                        Schedule for Off-Peak
                      </Button>
                      <Button variant="outline" data-testid="button-save-template">
                        <Copy className="h-4 w-4 mr-2" />
                        Save as Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Scheduled Reports Tab */}
              <TabsContent value="scheduled" className="space-y-6">
                <Card data-testid="card-scheduled-reports">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          Scheduled Reports
                        </CardTitle>
                        <CardDescription>
                          Automated reports scheduled to run during off-peak hours
                        </CardDescription>
                      </div>
                      <Button data-testid="button-new-schedule">
                        <Plus className="h-4 w-4 mr-2" />
                        New Schedule
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {scheduledReports.map((report, index) => (
                        <div 
                          key={report.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`scheduled-report-${index}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${
                              report.status === "Active" 
                                ? "bg-green-100 dark:bg-green-900/30" 
                                : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              <Clock className={`h-5 w-5 ${
                                report.status === "Active" ? "text-green-600" : "text-gray-400"
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium" data-testid={`text-scheduled-name-${index}`}>{report.name}</p>
                              <p className="text-sm text-muted-foreground" data-testid={`text-scheduled-template-${index}`}>
                                Template: {report.template}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span data-testid={`text-scheduled-frequency-${index}`}>{report.schedule}</span>
                                <span>•</span>
                                <span data-testid={`text-scheduled-format-${index}`}>{report.format}</span>
                                <span>•</span>
                                <span data-testid={`text-scheduled-recipients-${index}`}>{report.recipients.length} recipients</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <Badge 
                                variant={report.status === "Active" ? "default" : "secondary"}
                                className={report.status === "Active" ? "bg-green-500" : ""}
                                data-testid={`badge-scheduled-status-${index}`}
                              >
                                {report.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-next-run-${index}`}>
                                Next: {report.nextRun}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" data-testid={`button-edit-schedule-${index}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" data-testid={`button-run-now-${index}`}>
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-schedule-${index}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-6">
                <Card data-testid="card-report-history">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Recent Reports
                    </CardTitle>
                    <CardDescription>
                      Previously generated reports available for download
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Report Name</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Generated</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Format</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Size</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentReports.map((report, index) => (
                            <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-history-${index}`}>
                              <td className="py-3 px-4 font-medium" data-testid={`text-history-name-${index}`}>
                                {report.name}
                              </td>
                              <td className="py-3 px-4" data-testid={`text-history-date-${index}`}>
                                {report.generatedAt}
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" data-testid={`badge-history-format-${index}`}>
                                  {report.format}
                                </Badge>
                              </td>
                              <td className="py-3 px-4" data-testid={`text-history-size-${index}`}>
                                {report.size}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className="bg-green-500" data-testid={`badge-history-status-${index}`}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {report.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" data-testid={`button-view-report-${index}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" data-testid={`button-download-report-${index}`}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" data-testid={`button-email-report-${index}`}>
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
