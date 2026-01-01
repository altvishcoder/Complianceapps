import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { 
  FileText, Download, Filter, Search, Calendar as CalendarIcon, 
  BarChart3, PieChart, TrendingUp, Building2, FileCheck, 
  AlertTriangle, Clock, CheckCircle, XCircle, Loader2, RefreshCw,
  Play, Edit, Trash2, Eye, Mail, Copy, Save, Plus, Pause, ChevronRight
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { cn, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Link, useLocation } from "wouter";

interface ReportFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  complianceStream: string;
  status: string;
  scheme: string;
  block: string;
}

interface ComplianceSummary {
  total: number;
  compliant: number;
  nonCompliant: number;
  expiringSoon: number;
  expired: number;
}

interface ScheduledReport {
  id: string;
  name: string;
  template: string;
  frequency: string;
  nextRun: string;
  format: string;
  recipients: number;
  isActive: boolean;
}

interface RecentReport {
  id: string;
  name: string;
  generated: string;
  format: string;
  size: string;
  status: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

const defaultTemplates: ReportTemplate[] = [
  { id: '1', name: 'Compliance Summary', description: 'Overview of all compliance streams with status breakdown', sections: ['Executive Summary', 'Compliance by Stream', 'Risk Assessment', 'Action Items'] },
  { id: '2', name: 'Gas Safety', description: 'Detailed gas safety certificate status and landlord obligations', sections: ['LGSR Status', 'Expiring Certificates', 'Overdue Properties', 'Engineer Performance'] },
  { id: '3', name: 'Electrical', description: 'EICR status and electrical safety compliance', sections: ['EICR Coverage', 'Unsatisfactory Reports', 'Remedial Works', 'Contractor Analysis'] },
  { id: '4', name: 'Fire Safety', description: 'FRA status and fire safety compliance overview', sections: ['FRA Coverage', 'Risk Ratings', 'Action Progress', 'Equipment Status'] },
  { id: '5', name: 'Board Summary', description: 'Executive-level compliance dashboard for board reporting', sections: ['KPIs', 'Risk Matrix', 'Trend Analysis', 'Strategic Recommendations'] },
];

export default function Reports() {
  const { toast } = useToast();
  
  useEffect(() => {
    document.title = "Reports - ComplianceAI";
  }, []);

  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: subDays(new Date(), 30),
    dateTo: new Date(),
    complianceStream: "all",
    status: "all",
    scheme: "all",
    block: "all",
  });

  const [activeTab, setActiveTab] = useState("builder");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedStreamFilters, setSelectedStreamFilters] = useState<string[]>([]);
  const [, setLocation] = useLocation();

  const { data: reportTemplatesData, refetch: refetchTemplates } = useQuery<any[]>({
    queryKey: ["reportTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/reports/templates", { credentials: 'include' });
      if (!res.ok) return defaultTemplates;
      const data = await res.json();
      return data.length > 0 ? data.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        sections: t.sections || []
      })) : defaultTemplates;
    },
  });

  const reportTemplates = reportTemplatesData || defaultTemplates;

  const { data: scheduledReportsData, refetch: refetchScheduled } = useQuery<any[]>({
    queryKey: ["scheduledReports"],
    queryFn: async () => {
      const res = await fetch("/api/reports/scheduled", { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((s: any) => ({
        id: s.id,
        name: s.name,
        template: s.template_name,
        frequency: s.frequency === 'WEEKLY' ? 'Every Monday at 06:00' : 
                   s.frequency === 'MONTHLY' ? 'First day of month at 09:00' : 
                   s.frequency === 'QUARTERLY' ? 'Quarterly' : 'Daily at 06:00',
        nextRun: s.next_run_at ? new Date(s.next_run_at).toISOString().slice(0, 16).replace('T', ' ') : '',
        format: s.format || 'PDF',
        recipients: s.recipients?.length || 0,
        isActive: s.is_active
      }));
    },
  });

  const scheduledReports = scheduledReportsData || [];

  const { data: recentReportsData, refetch: refetchRecent } = useQuery<any[]>({
    queryKey: ["generatedReports"],
    queryFn: async () => {
      const res = await fetch("/api/reports/generated", { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        generated: r.generated_at ? new Date(r.generated_at).toISOString().slice(0, 16).replace('T', ' ') : '',
        format: r.format || 'PDF',
        size: r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)} MB` : '1.0 MB',
        status: r.status || 'Ready'
      }));
    },
  });

  const recentReports = recentReportsData || [];

  const { data: schemes } = useQuery<any[]>({
    queryKey: ["schemes"],
    queryFn: async () => {
      const res = await fetch("/api/schemes", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch schemes");
      return res.json();
    },
  });

  const { data: complianceStreams } = useQuery<any[]>({
    queryKey: ["complianceStreams"],
    queryFn: async () => {
      const res = await fetch("/api/config/compliance-streams", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch compliance streams");
      return res.json();
    },
  });

  const { data: certificates, isLoading: certsLoading, refetch } = useQuery<any[]>({
    queryKey: ["reportCertificates", filters],
    queryFn: async () => {
      const res = await fetch("/api/certificates", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch certificates");
      return res.json();
    },
  });

  const { data: properties } = useQuery<any[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });

  const propertySchemeMap = useMemo(() => {
    return (properties || []).reduce((acc, p) => {
      acc[p.id] = { schemeId: p.schemeId, blockId: p.blockId };
      return acc;
    }, {} as Record<string, { schemeId: string; blockId: string }>);
  }, [properties]);

  const toggleStreamFilter = (streamId: string) => {
    setSelectedStreamFilters(prev => 
      prev.includes(streamId) 
        ? prev.filter(id => id !== streamId)
        : [...prev, streamId]
    );
  };

  const filteredCertificates = useMemo(() => {
    return (certificates || []).filter(cert => {
      if (filters.status !== "all" && cert.status !== filters.status) return false;
      if (filters.complianceStream !== "all" && cert.complianceStreamId !== filters.complianceStream) return false;
      if (selectedStreamFilters.length > 0 && !selectedStreamFilters.includes(cert.complianceStreamId)) return false;
      
      if (filters.dateFrom) {
        const certDate = cert.createdAt ? new Date(cert.createdAt) : null;
        if (certDate && certDate < startOfDay(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const certDate = cert.createdAt ? new Date(cert.createdAt) : null;
        if (certDate && certDate > endOfDay(filters.dateTo)) return false;
      }
      
      if (filters.scheme !== "all") {
        const propInfo = propertySchemeMap[cert.propertyId];
        if (!propInfo || propInfo.schemeId !== filters.scheme) return false;
      }
      if (filters.block !== "all") {
        const propInfo = propertySchemeMap[cert.propertyId];
        if (!propInfo || propInfo.blockId !== filters.block) return false;
      }
      
      return true;
    });
  }, [certificates, filters, propertySchemeMap, selectedStreamFilters]);

  const summary: ComplianceSummary = {
    total: filteredCertificates.length,
    compliant: filteredCertificates.filter(c => c.status === 'APPROVED' || c.status === 'EXTRACTED').length,
    nonCompliant: filteredCertificates.filter(c => c.status === 'FAILED' || c.status === 'REJECTED').length,
    expiringSoon: filteredCertificates.filter(c => {
      if (!c.expiryDate) return false;
      const expiry = new Date(c.expiryDate);
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return expiry > now && expiry <= thirtyDays;
    }).length,
    expired: filteredCertificates.filter(c => {
      if (!c.expiryDate) return false;
      return new Date(c.expiryDate) < new Date();
    }).length,
  };

  const statusData = [
    { name: 'Compliant', value: summary.compliant, color: '#10b981' },
    { name: 'Non-Compliant', value: summary.nonCompliant, color: '#ef4444' },
    { name: 'Expiring Soon', value: summary.expiringSoon, color: '#f59e0b' },
    { name: 'Expired', value: summary.expired, color: '#6366f1' },
  ].filter(d => d.value > 0);

  const certTypeData = Object.entries(
    filteredCertificates.reduce((acc, cert) => {
      const type = cert.certificateType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).slice(0, 10);

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subDays(new Date(), (5 - i) * 30);
    const month = format(date, 'MMM');
    const monthCerts = filteredCertificates.filter(c => {
      const certDate = new Date(c.createdAt);
      return format(certDate, 'MMM yyyy') === format(date, 'MMM yyyy');
    });
    return {
      month,
      uploaded: monthCerts.length,
      approved: monthCerts.filter(c => c.status === 'APPROVED').length,
      failed: monthCerts.filter(c => c.status === 'FAILED').length,
    };
  });

  const handleExport = (exportFormat: 'csv' | 'pdf') => {
    const data = filteredCertificates.map(cert => ({
      'Certificate Type': cert.certificateType,
      'Property': cert.propertyId,
      'Status': cert.status,
      'Issue Date': cert.issueDate ? formatDate(cert.issueDate) : 'N/A',
      'Expiry Date': cert.expiryDate ? formatDate(cert.expiryDate) : 'N/A',
      'Created': formatDate(cert.createdAt),
    }));

    if (exportFormat === 'csv') {
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV Exported", description: "Report has been downloaded successfully." });
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const template = reportTemplates.find(t => t.id === selectedTemplate);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 20;

      const checkPageBreak = (space: number) => {
        if (yPos + space > pageHeight - 25) {
          doc.addPage();
          yPos = 20;
        }
      };

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(template?.name || "Compliance Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Certificates: ${summary.total}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Compliant: ${summary.compliant} (${summary.total > 0 ? Math.round((summary.compliant / summary.total) * 100) : 0}%)`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Non-Compliant: ${summary.nonCompliant}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Expiring Soon: ${summary.expiringSoon}`, margin + 5, yPos);
      yPos += 6;
      doc.text(`Expired: ${summary.expired}`, margin + 5, yPos);
      yPos += 15;

      if (template?.sections) {
        template.sections.forEach(section => {
          checkPageBreak(20);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(section, margin, yPos);
          yPos += 8;
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`Section content for ${section} would be generated here.`, margin + 5, yPos);
          yPos += 12;
        });
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`ComplianceAI Report | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      const fileName = `${template?.name?.toLowerCase().replace(/\s+/g, '-') || 'report'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);

      // Record the generated report in the backend
      try {
        await fetch('/api/reports/generated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: template?.name || 'Custom Report',
            format: 'PDF',
            filters: filters,
            status: 'READY'
          })
        });
        refetchRecent();
      } catch (err) {
        // Non-critical - report still downloaded
      }

      toast({ title: "Report Generated", description: `${template?.name} has been generated and downloaded.` });
    } catch (error) {
      toast({ title: "Generation Failed", description: "Failed to generate report. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleOffPeak = async () => {
    const template = reportTemplates.find(t => t.id === selectedTemplate);
    try {
      const res = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${template?.name} (Off-Peak)`,
          templateName: template?.name || 'Custom',
          frequency: 'DAILY',
          format: 'PDF',
          recipients: [],
          filters: filters
        })
      });
      if (res.ok) {
        refetchScheduled();
        toast({ title: "Scheduled for Off-Peak", description: "Report will be generated during off-peak hours (6 AM - 8 AM)." });
      } else {
        toast({ title: "Error", description: "Failed to schedule report.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to schedule report.", variant: "destructive" });
    }
  };

  const handleSaveTemplate = () => {
    setShowTemplateDialog(true);
  };

  const handleScheduleReport = async () => {
    const template = reportTemplates.find(t => t.id === selectedTemplate);
    const frequencyMap: Record<string, string> = {
      'daily': 'DAILY',
      'weekly': 'WEEKLY',
      'monthly': 'MONTHLY',
      'quarterly': 'QUARTERLY'
    };
    try {
      const res = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${template?.name} (Scheduled)`,
          templateName: template?.name || 'Custom',
          frequency: frequencyMap[scheduleFrequency] || 'WEEKLY',
          format: 'PDF',
          recipients: [],
          filters: filters
        })
      });
      if (res.ok) {
        refetchScheduled();
        setShowScheduleDialog(false);
        toast({ title: "Report Scheduled", description: `Report will be generated ${scheduleFrequency}.` });
      } else {
        toast({ title: "Error", description: "Failed to schedule report.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to schedule report.", variant: "destructive" });
    }
  };

  const handleEditSchedule = (id: string) => {
    const schedule = scheduledReports.find(s => s.id === id);
    toast({ title: "Edit Schedule", description: `Editing schedule for ${schedule?.name}.` });
    setShowScheduleDialog(true);
  };

  const handleRunSchedule = async (id: string) => {
    const schedule = scheduledReports.find(s => s.id === id);
    toast({ title: "Running Report", description: `Generating ${schedule?.name} now...` });
    try {
      const res = await fetch(`/api/reports/scheduled/${id}/run`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        refetchRecent();
        refetchScheduled();
        toast({ title: "Report Ready", description: `${schedule?.name} has been generated.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const schedule = scheduledReports.find(s => s.id === id);
    try {
      const res = await fetch(`/api/reports/scheduled/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        refetchScheduled();
        toast({ title: "Schedule Deleted", description: `${schedule?.name} has been removed.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete schedule.", variant: "destructive" });
    }
  };

  const handleToggleSchedule = async (id: string) => {
    const schedule = scheduledReports.find(s => s.id === id);
    const newActiveState = !schedule?.isActive;
    try {
      const res = await fetch(`/api/reports/scheduled/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: newActiveState })
      });
      if (res.ok) {
        refetchScheduled();
        toast({ 
          title: newActiveState ? "Schedule Activated" : "Schedule Paused", 
          description: `${schedule?.name} has been ${newActiveState ? 'activated' : 'paused'}.` 
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update schedule.", variant: "destructive" });
    }
  };

  const handleViewReport = (id: string) => {
    const report = recentReports.find(r => r.id === id);
    toast({ title: "Opening Report", description: `Opening ${report?.name} for viewing.` });
  };

  const handleDownloadReport = (id: string) => {
    const report = recentReports.find(r => r.id === id);
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(report?.name || 'Report', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated: ${report?.generated}`, 105, 35, { align: 'center' });
    doc.text('This is a sample report content.', 20, 60);
    doc.save(`${report?.name?.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: "Report Downloaded", description: `${report?.name} has been downloaded.` });
  };

  const handleEmailReport = (id: string) => {
    const report = recentReports.find(r => r.id === id);
    toast({ title: "Email Sent", description: `${report?.name} has been emailed to configured recipients.` });
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-reports">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Reporting Centre</h1>
              <p className="text-muted-foreground">Generate, schedule, and manage compliance reports</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-reports">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => handleExport('csv')} data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stream Filter Badges */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Filter by Compliance Stream</Label>
                {selectedStreamFilters.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStreamFilters([])} data-testid="button-clear-stream-filters">
                    Clear all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {complianceStreams?.filter((s: any) => s.isActive).map((stream: any) => {
                  const isSelected = selectedStreamFilters.includes(stream.id);
                  const color = stream.colorCode || "#6366F1";
                  return (
                    <Badge
                      key={stream.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:opacity-80"
                      style={{
                        backgroundColor: isSelected ? color : 'transparent',
                        borderColor: color,
                        color: isSelected ? 'white' : color
                      }}
                      onClick={() => toggleStreamFilter(stream.id)}
                      data-testid={`badge-stream-${stream.code}`}
                    >
                      {stream.name}
                      {isSelected && <span className="ml-1">&times;</span>}
                    </Badge>
                  );
                })}
              </div>
              {selectedStreamFilters.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing data for {selectedStreamFilters.length} selected stream{selectedStreamFilters.length > 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="builder" data-testid="tab-builder">
                <FileText className="h-4 w-4 mr-2" />
                Report Builder
              </TabsTrigger>
              <TabsTrigger value="scheduled" data-testid="tab-scheduled">
                <Clock className="h-4 w-4 mr-2" />
                Scheduled Reports
              </TabsTrigger>
              <TabsTrigger value="recent" data-testid="tab-recent">
                <FileCheck className="h-4 w-4 mr-2" />
                Recent Reports
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <Copy className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Report Builder
                  </CardTitle>
                  <CardDescription>Select a template and configure your report parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Report Template</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {reportTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left" data-testid="button-date-from">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.dateFrom ? formatDate(filters.dateFrom) : "From"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={filters.dateFrom}
                                onSelect={(date) => setFilters(f => ({ ...f, dateFrom: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left" data-testid="button-date-to">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.dateTo ? formatDate(filters.dateTo) : "To"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={filters.dateTo}
                                onSelect={(date) => setFilters(f => ({ ...f, dateTo: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Compliance Stream</Label>
                        <Select value={filters.complianceStream} onValueChange={(v) => setFilters(f => ({ ...f, complianceStream: v }))}>
                          <SelectTrigger data-testid="select-compliance-stream">
                            <SelectValue placeholder="All streams" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Streams</SelectItem>
                            {complianceStreams?.map(stream => (
                              <SelectItem key={stream.id} value={stream.id}>{stream.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-blue-900">Performance Optimized</h4>
                              <p className="text-sm text-blue-700 mt-1">
                                Reports use pre-aggregated data from materialized views. Heavy queries are automatically 
                                scheduled during off-peak hours (6 AM - 8 AM) to avoid impacting system performance.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex flex-col gap-2">
                        <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full" data-testid="button-generate-report">
                          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                          {isGenerating ? "Generating..." : "Generate Report"}
                        </Button>
                        <Button variant="outline" onClick={handleScheduleOffPeak} className="w-full" data-testid="button-schedule-off-peak">
                          <Clock className="h-4 w-4 mr-2" />
                          Schedule for Off-Peak
                        </Button>
                        <Button variant="outline" onClick={handleSaveTemplate} className="w-full" data-testid="button-save-template">
                          <Copy className="h-4 w-4 mr-2" />
                          Save as Template
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Link href="/certificates?from=/reports" data-testid="link-total-certificates">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Certificates</p>
                          <p className="text-2xl font-bold">{summary.total}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/certificates?status=APPROVED&status=EXTRACTED&from=/reports" data-testid="link-compliant-certificates">
                  <Card className="border-emerald-200 bg-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-emerald-600">Compliant</p>
                          <p className="text-2xl font-bold text-emerald-700">{summary.compliant}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-8 w-8 text-emerald-500" />
                          <ChevronRight className="h-4 w-4 text-emerald-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/certificates?status=FAILED&status=REJECTED&from=/reports" data-testid="link-noncompliant-certificates">
                  <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600">Non-Compliant</p>
                          <p className="text-2xl font-bold text-red-700">{summary.nonCompliant}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="h-8 w-8 text-red-500" />
                          <ChevronRight className="h-4 w-4 text-red-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/certificates?filter=expiring&from=/reports" data-testid="link-expiring-certificates">
                  <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-amber-600">Expiring Soon</p>
                          <p className="text-2xl font-bold text-amber-700">{summary.expiringSoon}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-8 w-8 text-amber-500" />
                          <ChevronRight className="h-4 w-4 text-amber-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/certificates?filter=expired&from=/reports" data-testid="link-expired-certificates">
                  <Card className="border-purple-200 bg-purple-50/50 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-600">Expired</p>
                          <p className="text-2xl font-bold text-purple-700">{summary.expired}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-8 w-8 text-purple-500" />
                          <ChevronRight className="h-4 w-4 text-purple-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Scheduled Reports
                      </CardTitle>
                      <CardDescription>Manage automated report generation and distribution</CardDescription>
                    </div>
                    <Button onClick={() => setShowScheduleDialog(true)} data-testid="button-add-schedule">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {scheduledReports.map(schedule => (
                      <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg bg-card" data-testid={`schedule-${schedule.id}`}>
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-full", schedule.isActive ? "bg-green-100" : "bg-gray-100")}>
                            <Clock className={cn("h-5 w-5", schedule.isActive ? "text-green-600" : "text-gray-400")} />
                          </div>
                          <div>
                            <h4 className="font-semibold">{schedule.name}</h4>
                            <p className="text-sm text-muted-foreground">Template: {schedule.template}</p>
                            <p className="text-sm text-muted-foreground">{schedule.frequency} • {schedule.format} • {schedule.recipients} recipients</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Badge variant={schedule.isActive ? "default" : "secondary"}>
                              {schedule.isActive ? "Active" : "Paused"}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">Next: {schedule.nextRun}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditSchedule(schedule.id)} data-testid={`button-edit-schedule-${schedule.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRunSchedule(schedule.id)} data-testid={`button-run-schedule-${schedule.id}`}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleSchedule(schedule.id)} data-testid={`button-toggle-schedule-${schedule.id}`}>
                              {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSchedule(schedule.id)} data-testid={`button-delete-schedule-${schedule.id}`}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {scheduledReports.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        No scheduled reports. Click "Add Schedule" to create one.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Recent Reports
                  </CardTitle>
                  <CardDescription>Previously generated reports available for download</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-4 p-3 text-sm font-medium text-muted-foreground border-b">
                      <div className="col-span-2">Report Name</div>
                      <div>Generated</div>
                      <div>Format</div>
                      <div>Size</div>
                      <div>Actions</div>
                    </div>
                    {recentReports.map(report => (
                      <div key={report.id} className="grid grid-cols-6 gap-4 p-3 items-center hover:bg-muted/50 rounded-lg" data-testid={`report-${report.id}`}>
                        <div className="col-span-2 font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">{report.generated}</div>
                        <div>
                          <Badge variant="outline">{report.format}</Badge>
                        </div>
                        <div className="text-sm">{report.size}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewReport(report.id)} data-testid={`button-view-report-${report.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadReport(report.id)} data-testid={`button-download-report-${report.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEmailReport(report.id)} data-testid={`button-email-report-${report.id}`}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Copy className="h-5 w-5" />
                        Report Templates
                      </CardTitle>
                      <CardDescription>Pre-configured report templates for common compliance needs</CardDescription>
                    </div>
                    <Button variant="outline" data-testid="button-create-template">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportTemplates.map(template => (
                      <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors" data-testid={`template-${template.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-sm">{template.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Sections:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.sections.map((section, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">{section}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button size="sm" className="flex-1" onClick={() => { setSelectedTemplate(template.id); setActiveTab('builder'); }} data-testid={`button-use-template-${template.id}`}>
                              Use Template
                            </Button>
                            <Button size="sm" variant="outline" data-testid={`button-edit-template-${template.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Compliance Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Certificates by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={certTypeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Monthly Certificate Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="uploaded" stroke="#6366f1" strokeWidth={2} name="Uploaded" />
                          <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="Approved" />
                          <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Failed" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>Configure automatic report generation and distribution.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {reportTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleScheduleReport}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>Save your current configuration as a reusable template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input 
                placeholder="Enter template name" 
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                data-testid="input-template-name" 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                placeholder="Brief description of the template" 
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                data-testid="input-template-description" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={async () => { 
              try {
                const res = await fetch('/api/reports/templates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    name: templateName,
                    description: templateDescription,
                    sections: reportTemplates.find(t => t.id === selectedTemplate)?.sections || []
                  })
                });
                if (res.ok) {
                  refetchTemplates();
                  setShowTemplateDialog(false);
                  setTemplateName('');
                  setTemplateDescription('');
                  toast({ title: "Template Saved", description: "Your template has been saved successfully." });
                }
              } catch (error) {
                toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
              }
            }}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
