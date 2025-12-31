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
import { 
  FileText, Download, Filter, Search, Calendar as CalendarIcon, 
  BarChart3, PieChart, TrendingUp, Building2, FileCheck, 
  AlertTriangle, Clock, CheckCircle, XCircle, Loader2, RefreshCw,
  ChevronDown
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { cn, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, LineChart, Line } from "recharts";

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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

export default function Reports() {
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

  const [activeTab, setActiveTab] = useState("overview");

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

  const filteredCertificates = useMemo(() => {
    return (certificates || []).filter(cert => {
      if (filters.status !== "all" && cert.status !== filters.status) return false;
      if (filters.complianceStream !== "all" && cert.complianceStreamId !== filters.complianceStream) return false;
      
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
  }, [certificates, filters, propertySchemeMap]);

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

  const handleExport = (format: 'csv' | 'pdf') => {
    const data = filteredCertificates.map(cert => ({
      'Certificate Type': cert.certificateType,
      'Property': cert.propertyId,
      'Status': cert.status,
      'Issue Date': cert.issueDate ? formatDate(cert.issueDate) : 'N/A',
      'Expiry Date': cert.expiryDate ? formatDate(cert.expiryDate) : 'N/A',
      'Created': formatDate(cert.createdAt),
    }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-reports">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Compliance Reports</h1>
              <p className="text-muted-foreground">Generate and export compliance reports with advanced filtering</p>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Report Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left" data-testid="button-date-from">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateFrom ? formatDate(filters.dateFrom) : "Select date"}
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
                </div>

                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left" data-testid="button-date-to">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateTo ? formatDate(filters.dateTo) : "Select date"}
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

                <div className="space-y-2">
                  <Label>Compliance Stream</Label>
                  <Select 
                    value={filters.complianceStream} 
                    onValueChange={(v) => setFilters(f => ({ ...f, complianceStream: v }))}
                  >
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

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={filters.status} 
                    onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="EXTRACTED">Extracted</SelectItem>
                      <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Certificates</p>
                    <p className="text-2xl font-bold">{summary.total}</p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">Compliant</p>
                    <p className="text-2xl font-bold text-emerald-700">{summary.compliant}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Non-Compliant</p>
                    <p className="text-2xl font-bold text-red-700">{summary.nonCompliant}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600">Expiring Soon</p>
                    <p className="text-2xl font-bold text-amber-700">{summary.expiringSoon}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600">Expired</p>
                    <p className="text-2xl font-bold text-purple-700">{summary.expired}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="by-type" data-testid="tab-by-type">
                <PieChart className="h-4 w-4 mr-2" />
                By Type
              </TabsTrigger>
              <TabsTrigger value="trends" data-testid="tab-trends">
                <TrendingUp className="h-4 w-4 mr-2" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">
                <FileText className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
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
              </div>
            </TabsContent>

            <TabsContent value="by-type" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Certificate Types Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={certTypeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {certTypeData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Certificate Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
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
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Certificate Details</CardTitle>
                  <CardDescription>
                    Showing {filteredCertificates.length} certificates matching your filters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {certsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {filteredCertificates.slice(0, 50).map((cert) => (
                          <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{cert.certificateType?.replace(/_/g, ' ') || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {cert.expiryDate ? `Expires: ${formatDate(cert.expiryDate)}` : 'No expiry date'}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={
                                cert.status === 'APPROVED' ? 'default' :
                                cert.status === 'FAILED' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {cert.status}
                            </Badge>
                          </div>
                        ))}
                        {filteredCertificates.length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            No certificates match your filters
                          </div>
                        )}
                      </div>
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
