import { useState } from "react";
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
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

const overallRiskScore = 78;
const previousRiskScore = 72;

const complianceStreams = [
  { name: "Gas Safety", score: 94, trend: "up", icon: Flame, color: "#f97316" },
  { name: "Electrical", score: 89, trend: "up", icon: Zap, color: "#eab308" },
  { name: "Fire Safety", score: 76, trend: "down", icon: AlertTriangle, color: "#ef4444" },
  { name: "Water/Legionella", score: 82, trend: "stable", icon: Droplets, color: "#3b82f6" },
  { name: "Asbestos", score: 91, trend: "up", icon: Wind, color: "#8b5cf6" },
  { name: "Energy (EPC)", score: 67, trend: "stable", icon: ThermometerSun, color: "#10b981" },
];

const riskTrend = [
  { month: "Jul", score: 68 },
  { month: "Aug", score: 71 },
  { month: "Sep", score: 69 },
  { month: "Oct", score: 72 },
  { month: "Nov", score: 75 },
  { month: "Dec", score: 78 },
];

const portfolioHealth = [
  { name: "Fully Compliant", value: 847, color: "#22c55e" },
  { name: "Minor Issues", value: 156, color: "#f59e0b" },
  { name: "Attention Required", value: 42, color: "#ef4444" },
];

const keyMetrics = [
  { label: "Total Properties", value: "1,045", icon: Building2, change: "+12", trend: "up", sublabel: "(Structures)" },
  { label: "Active Certificates", value: "4,892", icon: Shield, change: "+156", trend: "up" },
  { label: "Open Actions", value: "89", icon: Clock, change: "-23", trend: "down" },
  { label: "Contractors Active", value: "24", icon: Users, change: "0", trend: "stable" },
];

const criticalAlerts = [
  { 
    title: "Fire Safety Assessment Overdue", 
    location: "Elm Court Block A",
    urgency: "High",
    daysOverdue: 14,
    impact: "32 units affected"
  },
  { 
    title: "Gas Certificate Expiring Soon", 
    location: "Oak House",
    urgency: "Medium",
    daysOverdue: 0,
    impact: "12 units affected"
  },
  { 
    title: "Legionella Risk Assessment Due", 
    location: "Riverside Complex",
    urgency: "Medium",
    daysOverdue: 0,
    impact: "48 units affected"
  },
];

const quarterlyHighlights = [
  { metric: "Compliance Rate", current: "92%", target: "95%", status: "approaching" },
  { metric: "Certificate Renewals", current: "156", target: "150", status: "achieved" },
  { metric: "Actions Closed", current: "234", target: "200", status: "achieved" },
  { metric: "Response Time (avg)", current: "4.2 days", target: "3 days", status: "behind" },
];

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

function RiskGauge({ score, previousScore }: { score: number; previousScore: number }) {
  const improvement = score - previousScore;
  const circumference = 2 * Math.PI * 80;
  const progress = (score / 100) * circumference;
  
  return (
    <div className="relative flex flex-col items-center justify-center" data-testid="risk-gauge">
      <svg className="w-48 h-48 transform -rotate-90">
        <circle
          cx="96"
          cy="96"
          r="80"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx="96"
          cy="96"
          r="80"
          fill="none"
          stroke={score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444"}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold ${getScoreColor(score)}`} data-testid="risk-score">{score}</span>
        <span className="text-sm text-muted-foreground">Risk Score</span>
        <div className="flex items-center gap-1 mt-1">
          {improvement > 0 ? (
            <>
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-500">+{improvement} pts</span>
            </>
          ) : improvement < 0 ? (
            <>
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-500">{improvement} pts</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No change</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardReporting() {
  const { toast } = useToast();
  const totalProperties = portfolioHealth.reduce((sum, item) => sum + item.value, 0);
  const [isExporting, setIsExporting] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  
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
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground" data-testid="text-last-updated">
                  Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2">
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

            {/* Key Metrics Row */}
            <div className="grid gap-4 md:grid-cols-4">
              {keyMetrics.map((metric, index) => {
                const metricLinks: Record<string, string> = {
                  "Total Properties": "/properties",
                  "Active Certificates": "/certificates",
                  "Open Actions": "/remedial-actions",
                  "Contractors Active": "/contractors"
                };
                const href = metricLinks[metric.label] || "#";
                return (
                  <Link key={index} href={href}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-metric-${index}`}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <metric.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <TrendIndicator trend={metric.trend} />
                              <span className={`text-sm ${
                                metric.trend === "up" ? "text-green-500" : 
                                metric.trend === "down" ? "text-red-500" : 
                                "text-muted-foreground"
                              }`}>
                                {metric.change}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-2xl font-bold" data-testid={`text-metric-value-${index}`}>{metric.value}</p>
                          <p className="text-sm text-muted-foreground">
                            {metric.label}
                            {(metric as any).sublabel && <span className="text-xs ml-1">{(metric as any).sublabel}</span>}
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
              <Card className="lg:row-span-2" data-testid="card-overall-risk">
                <CardHeader>
                  <CardTitle>Overall Risk Score</CardTitle>
                  <CardDescription>Portfolio-wide compliance health indicator</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <RiskGauge score={overallRiskScore} previousScore={previousRiskScore} />
                  <div className="w-full mt-6 space-y-2">
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
                      {Math.round((portfolioHealth[0].value / totalProperties) * 100)}%
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
                      const streamCodeMap: Record<string, string> = {
                        "Gas Safety": "GAS_HEATING",
                        "Electrical": "ELECTRICAL",
                        "Fire Safety": "FIRE_SAFETY",
                        "Water/Legionella": "WATER_SAFETY",
                        "Asbestos": "ASBESTOS",
                        "Energy (EPC)": "ENERGY"
                      };
                      const streamCode = streamCodeMap[stream.name] || "";
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
                              style={{ backgroundColor: `${stream.color}20` }}
                            >
                              <stream.icon className="h-5 w-5" style={{ color: stream.color }} />
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
                    <Link href="/remedial-actions?status=OPEN">
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
                      <Link key={index} href="/remedial-actions?status=OPEN">
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

            {/* Summary Section */}
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
                      <li data-testid="text-achievement-0">• Risk score improved by 6 points</li>
                      <li data-testid="text-achievement-1">• Gas safety compliance at 94%</li>
                      <li data-testid="text-achievement-2">• Certificate renewals exceed target</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" data-testid="summary-in-progress">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">In Progress</h4>
                    </div>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li data-testid="text-progress-0">• Fire safety improvements underway</li>
                      <li data-testid="text-progress-1">• 89 remedial actions being addressed</li>
                      <li data-testid="text-progress-2">• EPC upgrade program ongoing</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="summary-attention">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <h4 className="font-semibold text-red-800 dark:text-red-200">Attention Required</h4>
                    </div>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      <li data-testid="text-attention-0">• 1 fire safety assessment overdue</li>
                      <li data-testid="text-attention-1">• Response time below target</li>
                      <li data-testid="text-attention-2">• 42 properties need intervention</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
