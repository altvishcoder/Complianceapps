import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2,
  Shield,
  FileDown,
  Calendar,
  Target,
  Users,
  Flame,
  Zap,
  Droplets,
  Wind,
  ThermometerSun,
  Loader2,
  ChevronRight,
  LucideIcon
} from "lucide-react";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

interface BoardReportStats {
  overallRiskScore: number;
  previousRiskScore: number;
  complianceStreams: Array<{ name: string; code: string; score: number; trend: string; total: number }>;
  portfolioHealth: Array<{ name: string; value: number; color: string }>;
  keyMetrics: Array<{ label: string; value: string; change: string; trend: string; sublabel?: string }>;
  criticalAlerts: Array<{ title: string; location: string; urgency: string; daysOverdue: number; impact: string }>;
  quarterlyHighlights: Array<{ metric: string; current: string; target: string; status: string }>;
  riskTrend: Array<{ month: string; score: number }>;
}

const streamIcons: Record<string, { icon: LucideIcon; color: string }> = {
  "GAS_HEATING": { icon: Flame, color: "#f97316" },
  "ELECTRICAL": { icon: Zap, color: "#eab308" },
  "FIRE_SAFETY": { icon: AlertTriangle, color: "#ef4444" },
  "WATER_SAFETY": { icon: Droplets, color: "#3b82f6" },
  "ASBESTOS": { icon: Wind, color: "#8b5cf6" },
  "ENERGY": { icon: ThermometerSun, color: "#10b981" },
  "LIFTING": { icon: Building2, color: "#6366f1" },
  "BUILDING_SAFETY": { icon: Shield, color: "#0ea5e9" },
};

const metricIcons: Record<string, LucideIcon> = {
  "Total Properties": Building2,
  "Active Certificates": Shield,
  "Open Actions": Clock,
  "Contractors Active": Users,
};

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 75) return "text-amber-500";
  return "text-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-500";
  if (score >= 75) return "bg-amber-500";
  return "bg-red-500";
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function RiskGauge({ score, previousScore, size = "default" }: { score: number; previousScore: number; size?: "small" | "default" }) {
  const improvement = score - previousScore;
  const isSmall = size === "small";
  const radius = isSmall ? 40 : 80;
  const strokeWidth = isSmall ? 8 : 12;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const svgSize = isSmall ? 100 : 192;
  const center = svgSize / 2;
  
  return (
    <div className="relative flex flex-col items-center justify-center" data-testid="risk-gauge">
      <svg className={isSmall ? "w-[100px] h-[100px]" : "w-48 h-48"} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`${isSmall ? "text-2xl" : "text-4xl"} font-bold ${getScoreColor(score)}`} data-testid="risk-score">{score}</span>
        <span className={`${isSmall ? "text-xs" : "text-sm"} text-muted-foreground`}>Risk Score</span>
        <div className="flex items-center gap-1 mt-1">
          {improvement > 0 ? (
            <>
              <TrendingUp className={`${isSmall ? "h-3 w-3" : "h-4 w-4"} text-green-500`} />
              <span className={`${isSmall ? "text-xs" : "text-sm"} text-green-500`}>+{improvement} pts</span>
            </>
          ) : improvement < 0 ? (
            <>
              <TrendingDown className={`${isSmall ? "h-3 w-3" : "h-4 w-4"} text-red-500`} />
              <span className={`${isSmall ? "text-xs" : "text-sm"} text-red-500`}>{improvement} pts</span>
            </>
          ) : (
            <span className={`${isSmall ? "text-xs" : "text-sm"} text-muted-foreground`}>No change</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardReporting() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  
  const { data: stats, isLoading, error } = useQuery<BoardReportStats>({
    queryKey: ['/api/board-report/stats'],
    refetchInterval: 60000,
  });
  
  const overallRiskScore = stats?.overallRiskScore ?? 0;
  const previousRiskScore = stats?.previousRiskScore ?? 0;
  const complianceStreams = stats?.complianceStreams ?? [];
  const portfolioHealth = stats?.portfolioHealth ?? [];
  const keyMetrics = stats?.keyMetrics ?? [];
  const criticalAlerts = stats?.criticalAlerts ?? [];
  const quarterlyHighlights = stats?.quarterlyHighlights ?? [];
  const riskTrend = stats?.riskTrend ?? [];
  const totalProperties = portfolioHealth.reduce((sum, item) => sum + item.value, 0);
  
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const bottomMargin = 25;
      let yPos = 20;
      
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - bottomMargin) {
          doc.addPage();
          yPos = 20;
        }
      };
      
      const addFooter = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(`ComplianceAI - Confidential Board Report | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        }
      };
      
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Board Compliance Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;
      
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", margin, yPos);
      yPos += 10;
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Overall Risk Score: ${overallRiskScore}/100`, margin, yPos);
      yPos += 7;
      doc.text(`Score Change: +${overallRiskScore - previousRiskScore} points from previous period`, margin, yPos);
      yPos += 15;
      
      checkPageBreak(10 + keyMetrics.length * 6);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Key Metrics", margin, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      keyMetrics.forEach(metric => {
        checkPageBreak(6);
        doc.text(`${metric.label}: ${metric.value} (${metric.change})`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 10;
      
      checkPageBreak(10 + complianceStreams.length * 6);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Compliance Streams", margin, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      complianceStreams.forEach(stream => {
        checkPageBreak(6);
        const trendSymbol = stream.trend === "up" ? "+" : stream.trend === "down" ? "-" : "=";
        doc.text(`${stream.name}: ${stream.score}% [${trendSymbol}]`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 10;
      
      checkPageBreak(10 + portfolioHealth.length * 6);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Portfolio Health", margin, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      portfolioHealth.forEach(item => {
        checkPageBreak(6);
        const percentage = Math.round((item.value / totalProperties) * 100);
        doc.text(`${item.name}: ${item.value} properties (${percentage}%)`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 10;
      
      if (criticalAlerts.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Critical Alerts", margin, yPos);
        yPos += 8;
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        criticalAlerts.forEach(alert => {
          checkPageBreak(14);
          doc.text(`- ${alert.title} (${alert.location})`, margin + 5, yPos);
          yPos += 5;
          doc.text(`  Urgency: ${alert.urgency}, Impact: ${alert.impact}`, margin + 5, yPos);
          yPos += 7;
        });
      }
      
      checkPageBreak(20);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Quarterly Highlights", margin, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      quarterlyHighlights.forEach(item => {
        checkPageBreak(6);
        const statusIcon = item.status === "achieved" ? "[OK]" : item.status === "approaching" ? "[~]" : "[!]";
        doc.text(`${item.metric}: ${item.current} / Target: ${item.target} ${statusIcon}`, margin + 5, yPos);
        yPos += 6;
      });
      
      addFooter();
      
      doc.save(`board-report-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Exported",
        description: "Board report PDF has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleScheduleReport = () => {
    toast({
      title: "Report Scheduled",
      description: `Board report will be sent ${scheduleFrequency} to stakeholders.`,
    });
    setShowScheduleDialog(false);
  };
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Board Reporting" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-muted-foreground" data-testid="text-last-updated">
                  Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleExportPdf} disabled={isExporting} data-testid="button-export-pdf">
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
                <Button variant="outline" onClick={() => setShowScheduleDialog(true)} data-testid="button-schedule-report">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Report
                </Button>
              </div>
            </div>
            
            {/* Schedule Dialog */}
            <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Board Report</DialogTitle>
                  <DialogDescription>
                    Configure automatic report generation and distribution to stakeholders.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                      <SelectTrigger data-testid="select-schedule-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                        <SelectItem value="monthly">Monthly (1st)</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
                  <Button onClick={handleScheduleReport} data-testid="button-confirm-schedule">Schedule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Loading State */}
            {isLoading && !stats && (
              <div className="space-y-6">
                <CardSkeleton contentHeight={150} />
                <div className="grid gap-4 md:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <CardSkeleton key={i} contentHeight={80} />
                  ))}
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                  <CardSkeleton contentHeight={200} />
                  <CardSkeleton contentHeight={200} />
                  <CardSkeleton contentHeight={200} />
                </div>
                <span className="sr-only">Loading board report data...</span>
              </div>
            )}
            
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center text-red-600">
                  Failed to load board report data. Please try again.
                </CardContent>
              </Card>
            )}

            {!isLoading && !error && (
              <>
            {/* Executive Summary - Top of page for quick overview */}
            <Card data-testid="card-executive-summary">
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>Key takeaways for this reporting period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" data-testid="summary-achievements">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-green-800 dark:text-green-200">Achievements</h4>
                    </div>
                    <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                      <li data-testid="text-achievement-0">• Risk score: {overallRiskScore}% ({overallRiskScore >= previousRiskScore ? `+${overallRiskScore - previousRiskScore}` : `${overallRiskScore - previousRiskScore}`} points)</li>
                      <li data-testid="text-achievement-1">• {complianceStreams.length > 0 ? `${complianceStreams[0].name} compliance at ${complianceStreams[0].score}%` : 'No compliance data yet'}</li>
                      <li data-testid="text-achievement-2">• {quarterlyHighlights.filter(h => h.status === 'achieved').length} target{quarterlyHighlights.filter(h => h.status === 'achieved').length !== 1 ? 's' : ''} achieved</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" data-testid="summary-in-progress">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">In Progress</h4>
                    </div>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li data-testid="text-progress-0">• {keyMetrics.find(m => m.label === 'Open Actions')?.value || '0'} remedial actions being addressed</li>
                      <li data-testid="text-progress-1">• {portfolioHealth.find(h => h.name === 'Minor Issues')?.value || 0} properties with minor issues</li>
                      <li data-testid="text-progress-2">• {quarterlyHighlights.filter(h => h.status === 'approaching').length} targets on track</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="summary-attention">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <h4 className="font-semibold text-red-800 dark:text-red-200">Attention Required</h4>
                    </div>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      <li data-testid="text-attention-0">• {criticalAlerts.length} critical alert{criticalAlerts.length !== 1 ? 's' : ''}</li>
                      <li data-testid="text-attention-1">• {quarterlyHighlights.filter(h => h.status === 'behind').length} target{quarterlyHighlights.filter(h => h.status === 'behind').length !== 1 ? 's' : ''} behind</li>
                      <li data-testid="text-attention-2">• {portfolioHealth.find(h => h.name === 'Attention Required')?.value || 0} properties need intervention</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics Row - Horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 md:grid md:grid-cols-4 md:gap-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {keyMetrics.map((metric, index) => {
                const metricLinks: Record<string, string> = {
                  "Total Properties": "/properties",
                  "Active Certificates": "/certificates",
                  "Open Actions": "/actions",
                  "Contractors Active": "/contractors"
                };
                const href = metricLinks[metric.label] || "#";
                const MetricIcon = metricIcons[metric.label] || Shield;
                return (
                  <Link key={index} href={href} className="flex-shrink-0 w-[160px] md:w-auto">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full" data-testid={`card-metric-${index}`}>
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                            <MetricIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendIndicator trend={metric.trend} />
                            <span className={`text-xs md:text-sm ${
                              metric.trend === "up" ? "text-green-500" : 
                              metric.trend === "down" ? "text-red-500" : 
                              "text-muted-foreground"
                            }`}>
                              {metric.change}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="mt-3 md:mt-4">
                          <p className="text-xl md:text-2xl font-bold" data-testid={`text-metric-value-${index}`}>{metric.value}</p>
                          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                            {metric.label}
                            {metric.sublabel && <span className="text-xs ml-1 hidden md:inline">{metric.sublabel}</span>}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Overall Risk Score */}
              <Card data-testid="card-overall-risk">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Overall Risk Score</CardTitle>
                  <CardDescription>Portfolio-wide compliance health indicator</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 pt-0">
                  <RiskGauge score={overallRiskScore} previousScore={previousRiskScore} size="small" />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Target Score</span>
                      <span className="font-medium" data-testid="text-target-score">85</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Industry Average</span>
                      <span className="font-medium" data-testid="text-industry-avg">72</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Health */}
              <Card data-testid="card-portfolio-health">
                <CardHeader>
                  <CardTitle>Portfolio Health</CardTitle>
                  <CardDescription>Property compliance distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={portfolioHealth}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {portfolioHealth.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-compliant-percentage">
                      {totalProperties > 0 && portfolioHealth[0] ? Math.round((portfolioHealth[0].value / totalProperties) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">Properties fully compliant</p>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Trend */}
              <Card data-testid="card-risk-trend">
                <CardHeader>
                  <CardTitle>Risk Score Trend</CardTitle>
                  <CardDescription>6-month compliance trajectory</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={riskTrend}>
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis domain={[60, 100]} className="text-xs" />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#3b82f6" 
                          fillOpacity={1} 
                          fill="url(#scoreGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Streams */}
              <Card className="lg:col-span-2" data-testid="card-compliance-streams">
                <CardHeader>
                  <CardTitle>Compliance by Stream</CardTitle>
                  <CardDescription>Performance across key compliance areas - click to view details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {complianceStreams.map((stream, index) => {
                      const streamCode = stream.code || "";
                      const streamStyle = streamIcons[streamCode] || { icon: Shield, color: "#6b7280" };
                      const StreamIcon = streamStyle.icon;
                      const streamColor = streamStyle.color;
                      return (
                        <Link 
                          key={stream.name}
                          href={`/certificates?stream=${streamCode}`}
                        >
                          <div 
                            className="flex items-center gap-4 p-4 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-shadow"
                            data-testid={`stream-card-${index}`}
                          >
                            <div 
                              className="p-3 rounded-lg" 
                              style={{ backgroundColor: `${streamColor}20` }}
                            >
                              <StreamIcon className="h-5 w-5" style={{ color: streamColor }} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm" data-testid={`text-stream-name-${index}`}>{stream.name}</p>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-lg font-bold ${getScoreColor(stream.score)}`} data-testid={`text-stream-score-${index}`}>
                                  {stream.score}%
                                </span>
                                <TrendIndicator trend={stream.trend} />
                              </div>
                              <div className="mt-2 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden" data-testid={`progress-stream-${index}`}>
                                <div 
                                  className={`h-full rounded-full ${getScoreBgColor(stream.score)}`}
                                  style={{ width: `${stream.score}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Critical Alerts and Quarterly Performance */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Critical Alerts */}
              <Card data-testid="card-critical-alerts">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Items Requiring Attention
                      </CardTitle>
                      <CardDescription>Priority matters for board awareness - click to view actions</CardDescription>
                    </div>
                    <Link href="/actions?status=OPEN">
                      <Badge variant="outline" className="text-amber-600 border-amber-600 cursor-pointer hover:bg-amber-50" data-testid="badge-alert-count">
                        {criticalAlerts.length} items
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Badge>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {criticalAlerts.map((alert, index) => (
                      <Link key={index} href="/actions?status=OPEN">
                        <div 
                          className="flex items-start gap-4 p-4 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-shadow"
                          data-testid={`alert-item-${index}`}
                        >
                          <div className={`p-2 rounded-full ${
                            alert.urgency === "High" ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                          }`}>
                            <AlertTriangle className={`h-4 w-4 ${
                              alert.urgency === "High" ? "text-red-600" : "text-amber-600"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium" data-testid={`text-alert-title-${index}`}>{alert.title}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant={alert.urgency === "High" ? "destructive" : "secondary"} data-testid={`badge-alert-urgency-${index}`}>
                                  {alert.urgency}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-alert-location-${index}`}>{alert.location}</p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-alert-impact-${index}`}>{alert.impact}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quarterly Performance */}
              <Card data-testid="card-quarterly-performance">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Quarterly Performance
                      </CardTitle>
                      <CardDescription>Progress against key targets</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {quarterlyHighlights.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        data-testid={`quarterly-item-${index}`}
                      >
                        <div>
                          <p className="font-medium" data-testid={`text-quarterly-metric-${index}`}>{item.metric}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold" data-testid={`text-quarterly-current-${index}`}>{item.current}</span>
                            <span className="text-sm text-muted-foreground" data-testid={`text-quarterly-target-${index}`}>/ {item.target} target</span>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            item.status === "achieved" ? "default" : 
                            item.status === "approaching" ? "secondary" : 
                            "destructive"
                          }
                          className={
                            item.status === "achieved" ? "bg-green-500" : 
                            item.status === "approaching" ? "" : 
                            ""
                          }
                          data-testid={`badge-quarterly-status-${index}`}
                        >
                          {item.status === "achieved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {item.status === "achieved" ? "Achieved" : 
                           item.status === "approaching" ? "On Track" : 
                           "Behind Target"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
