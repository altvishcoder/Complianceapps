import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCw, Building2, Calendar, Upload, Eye, ChevronRight, MapPin, Wrench, Settings2, GripVertical, EyeOff, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Reorder, useDragControls } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AwaabsPhase {
  count: number;
  status: 'active' | 'preview' | 'future';
  label: string;
}

interface DashboardStats {
  overallCompliance: string;
  activeHazards: number;
  immediateHazards: number;
  awaabsLawBreaches: number;
  awaabsLaw?: {
    phase1: AwaabsPhase;
    phase2: AwaabsPhase;
    phase3: AwaabsPhase;
    total: number;
  };
  pendingCertificates: number;
  totalProperties: number;
  totalHomes: number;
  totalCertificates: number;
  complianceByType: Array<{ type: string; code: string; compliant: number; nonCompliant: number }>;
  hazardDistribution: Array<{ name: string; value: number; severity: string }>;
  expiringCertificates: Array<{ id: string; propertyAddress: string; type: string; expiryDate: string }>;
  urgentActions: Array<{ id: string; description: string; severity: string; propertyAddress: string; dueDate: string }>;
  problemProperties: Array<{ id: string; address: string; issueCount: number; criticalCount: number }>;
}

type WidgetId = 'stats' | 'charts' | 'quick-actions' | 'summary' | 'awaabs' | 'expiring' | 'urgent' | 'problem-properties';

interface WidgetConfig {
  id: WidgetId;
  name: string;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats', name: 'Key Statistics', visible: true },
  { id: 'charts', name: 'Compliance & Hazard Charts', visible: true },
  { id: 'quick-actions', name: 'Quick Actions', visible: true },
  { id: 'summary', name: 'Summary', visible: true },
  { id: 'awaabs', name: "Awaab's Law Watchlist", visible: true },
  { id: 'expiring', name: 'Expiring Certificates', visible: true },
  { id: 'urgent', name: 'Urgent Actions', visible: true },
  { id: 'problem-properties', name: 'Properties Requiring Attention', visible: true },
];

const STORAGE_KEY = 'dashboard-widget-config';

function loadWidgetConfig(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const storedIds = new Set(parsed.map((w: WidgetConfig) => w.id));
      const merged = parsed.filter((w: WidgetConfig) => DEFAULT_WIDGETS.some(d => d.id === w.id));
      DEFAULT_WIDGETS.forEach(dw => {
        if (!storedIds.has(dw.id)) {
          merged.push(dw);
        }
      });
      return merged;
    }
  } catch (e) {
    console.error('Failed to load widget config:', e);
  }
  return DEFAULT_WIDGETS;
}

function saveWidgetConfig(config: WidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save widget config:', e);
  }
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];

const SEVERITY_MAP: Record<string, string> = {
  'Immediate': 'IMMEDIATE',
  'Urgent': 'URGENT',
  'Priority': 'PRIORITY',
  'Routine': 'ROUTINE',
  'Advisory': 'ADVISORY',
};

function DraggableWidget({ 
  children, 
  widgetId, 
  isConfiguring 
}: { 
  children: React.ReactNode; 
  widgetId: WidgetId;
  isConfiguring: boolean;
}) {
  const dragControls = useDragControls();
  
  if (!isConfiguring) {
    return <>{children}</>;
  }
  
  return (
    <Reorder.Item 
      value={widgetId} 
      dragListener={false} 
      dragControls={dragControls}
      className="relative"
    >
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing p-2 bg-primary/10 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
           onPointerDown={(e) => dragControls.start(e)}
           data-testid={`drag-handle-${widgetId}`}>
        <GripVertical className="h-4 w-4 text-primary" />
      </div>
      <div className="ring-2 ring-primary/30 ring-offset-2 rounded-xl transition-all">
        {children}
      </div>
    </Reorder.Item>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgetConfig);
  const [isConfiguring, setIsConfiguring] = useState(false);
  
  useEffect(() => {
    document.title = "Overview Hub - ComplianceAI";
  }, []);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    staleTime: 30000,
  });
  
  const visibleWidgets = useMemo(() => 
    widgets.filter(w => w.visible).map(w => w.id),
    [widgets]
  );
  
  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const streamCode = data.activePayload[0].payload.code || '';
      if (streamCode) {
        setLocation(`/certificates?stream=${streamCode}&from=/dashboard`);
      }
    }
  };
  
  const handlePieClick = (data: any) => {
    if (data?.name) {
      const severity = SEVERITY_MAP[data.name] || data.severity || '';
      if (severity) {
        setLocation(`/actions?severity=${severity}&from=/dashboard`);
      }
    }
  };
  
  const toggleWidget = (id: WidgetId) => {
    setWidgets(prev => {
      const updated = prev.map(w => 
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      saveWidgetConfig(updated);
      return updated;
    });
  };
  
  const handleReorder = (newOrder: WidgetId[]) => {
    setWidgets(prev => {
      const widgetMap = new Map(prev.map(w => [w.id, w]));
      const updated = newOrder.map(id => widgetMap.get(id)!).filter(Boolean);
      prev.forEach(w => {
        if (!newOrder.includes(w.id)) {
          updated.push(w);
        }
      });
      saveWidgetConfig(updated);
      return updated;
    });
  };
  
  const resetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
    saveWidgetConfig(DEFAULT_WIDGETS);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Overview Hub" />
          <main id="main-content" className="flex-1 flex items-center justify-center" role="main" aria-label="Dashboard content">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading dashboard data</span>
          </main>
        </div>
      </div>
    );
  }

  const complianceData = stats?.complianceByType || [];
  const hazardData = stats?.hazardDistribution || [];
  
  const renderWidget = (widgetId: WidgetId) => {
    switch (widgetId) {
      case 'stats':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard 
                title="Overall Compliance" 
                value={`${stats?.overallCompliance || '0'}%`}
                description="Across all asset groups"
                icon={CheckCircle2}
                status={parseFloat(stats?.overallCompliance || '0') >= 90 ? "success" : "warning"}
                href="/certificates?from=/dashboard"
                data-testid="stat-overall-compliance"
              />
              <StatsCard 
                title="Active Hazards" 
                value={String(stats?.activeHazards || 0)}
                description={`${stats?.immediateHazards || 0} requiring immediate action`}
                icon={AlertTriangle}
                trend={stats?.activeHazards ? "down" : undefined}
                trendValue={String(stats?.immediateHazards || 0)}
                status={stats?.activeHazards ? "danger" : "success"}
                href="/actions?status=OPEN&from=/dashboard"
                data-testid="stat-active-hazards"
              />
              <StatsCard 
                title="Awaab's Law Breaches" 
                value={String(stats?.awaabsLawBreaches || 0)}
                description="Timescale violations"
                icon={Clock}
                status={stats?.awaabsLawBreaches ? "danger" : "success"}
                href="/actions?awaabs=true&from=/dashboard"
                data-testid="stat-awaabs-law"
              />
              <StatsCard 
                title="Pending Certificates" 
                value={String(stats?.pendingCertificates || 0)}
                description="In ingestion queue"
                icon={FileText}
                href="/certificates?status=PENDING&from=/dashboard"
                data-testid="stat-pending-certs"
              />
            </div>
          </DraggableWidget>
        );
        
      case 'charts':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <div className="grid gap-6 md:grid-cols-7">
              <Card className="md:col-span-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Compliance by Stream</CardTitle>
                    <CardDescription>Click any bar to view certificates</CardDescription>
                  </div>
                  <Link href="/certificates?from=/dashboard">
                    <Button variant="ghost" size="sm" data-testid="link-all-certificates">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {complianceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(320, complianceData.length * 32)}>
                      <BarChart data={complianceData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="type" 
                          tick={{ fontSize: 11 }} 
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3">
                                <p className="font-medium">{payload[0].payload.type}</p>
                                <p className="text-sm text-blue-600">Compliant: {payload[0].payload.compliant}%</p>
                                <p className="text-sm text-red-600">Non-Compliant: {payload[0].payload.nonCompliant}%</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar dataKey="compliant" fill="#3b82f6" name="Compliant %" />
                        <Bar dataKey="nonCompliant" fill="#ef4444" name="Non-Compliant %" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                      No compliance data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="md:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Active Hazard Distribution</CardTitle>
                    <CardDescription>Click any segment to filter actions</CardDescription>
                  </div>
                  <Link href="/actions?from=/dashboard">
                    <Button variant="ghost" size="sm" data-testid="link-all-actions">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {hazardData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={hazardData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          onClick={handlePieClick}
                          style={{ cursor: 'pointer' }}
                        >
                          {hazardData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3">
                                <p className="font-medium">{payload[0].name}</p>
                                <p className="text-sm">{payload[0].value} actions</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No active hazards
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DraggableWidget>
        );
        
      case 'quick-actions':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Link href="/certificates/upload">
                    <Button variant="outline" className="w-full h-auto py-6 flex flex-col items-center gap-2" data-testid="quick-upload-cert">
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Upload Certificate</span>
                    </Button>
                  </Link>
                  <Link href="/actions?status=OPEN&from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-6 flex flex-col items-center gap-2" data-testid="quick-view-actions">
                      <Wrench className="h-6 w-6" />
                      <span className="text-sm">Open Actions</span>
                    </Button>
                  </Link>
                  <Link href="/properties?from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-6 flex flex-col items-center gap-2" data-testid="quick-view-properties">
                      <Building2 className="h-6 w-6" />
                      <span className="text-sm">Properties</span>
                    </Button>
                  </Link>
                  <Link href="/maps?from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-6 flex flex-col items-center gap-2" data-testid="quick-view-maps">
                      <MapPin className="h-6 w-6" />
                      <span className="text-sm">Risk Maps</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      case 'summary':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Summary</CardTitle>
                  <CardDescription>Click any item to explore</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/properties" className="flex justify-between items-center pb-2 border-b hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer" data-testid="summary-properties">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Total Homes
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats?.totalHomes || 0}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  <Link href="/certificates?from=/dashboard" className="flex justify-between items-center pb-2 border-b hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer" data-testid="summary-certificates">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Total Certificates
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats?.totalCertificates || 0}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  <Link href="/actions?status=OPEN&from=/dashboard" className="flex justify-between items-center pb-2 border-b hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer" data-testid="summary-hazards">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Active Hazards
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-orange-600">{stats?.activeHazards || 0}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  <Link href="/certificates?status=PENDING&from=/dashboard" className="flex justify-between items-center hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer" data-testid="summary-pending">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Pending Reviews
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats?.pendingCertificates || 0}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      case 'awaabs':
        const awaabsData = stats?.awaabsLaw;
        const hasAnyBreaches = (awaabsData?.total || 0) > 0;
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Awaab's Law Compliance
                  </CardTitle>
                  <CardDescription>Timescale breaches by regulatory phase</CardDescription>
                </div>
                {hasAnyBreaches && (
                  <Link href="/actions?awaabs=true&from=/dashboard">
                    <Button variant="ghost" size="sm">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Link href="/actions?awaabs=true&phase=1&from=/dashboard" className="block">
                    <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                      (awaabsData?.phase1?.count || 0) > 0 
                        ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50' 
                        : 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-950/30'
                    }`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-600 hover:bg-red-700 text-xs">NOW IN FORCE</Badge>
                          <span className="text-sm font-bold">Phase 1: Damp & Mould</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Strict timescales - respond within 14 days</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-2xl font-bold ${(awaabsData?.phase1?.count || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {awaabsData?.phase1?.count || 0}
                        </span>
                        <span className="text-xs text-muted-foreground">breaches</span>
                      </div>
                    </div>
                  </Link>
                  <Link href="/actions?awaabs=true&phase=2&from=/dashboard" className="block">
                    <div className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">2026</Badge>
                        <span className="text-sm font-medium">Phase 2: Fire, Electrical, Falls</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-lg font-bold ${(awaabsData?.phase2?.count || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {awaabsData?.phase2?.count || 0}
                        </span>
                        <span className="text-xs text-muted-foreground">breaches</span>
                      </div>
                    </div>
                  </Link>
                  <Link href="/actions?awaabs=true&phase=3&from=/dashboard" className="block">
                    <div className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer opacity-60">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">2027</Badge>
                        <span className="text-sm font-medium">Phase 3: All HHSRS</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-muted-foreground">
                          {awaabsData?.phase3?.count || 0}
                        </span>
                        <span className="text-xs text-muted-foreground">breaches</span>
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      case 'expiring':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Expiring Soon</CardTitle>
                  <CardDescription>Certificates expiring in the next 30 days</CardDescription>
                </div>
                <Link href="/certificates?from=/dashboard">
                  <Button variant="ghost" size="sm" data-testid="link-expiring-certs">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {(stats?.expiringCertificates?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {stats?.expiringCertificates?.slice(0, 5).map((cert) => (
                      <Link 
                        key={cert.id} 
                        href={`/certificates/${cert.id}`}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        data-testid={`expiring-cert-${cert.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{cert.propertyAddress}</p>
                          <p className="text-xs text-muted-foreground">{cert.type}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(cert.expiryDate)}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">No certificates expiring soon</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      case 'urgent':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Urgent Actions Required</CardTitle>
                  <CardDescription>Remedial actions needing immediate attention</CardDescription>
                </div>
                <Link href="/actions?severity=IMMEDIATE&from=/dashboard">
                  <Button variant="ghost" size="sm" data-testid="link-urgent-actions">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {(stats?.urgentActions?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {stats?.urgentActions?.slice(0, 5).map((action) => (
                      <Link 
                        key={action.id} 
                        href={`/actions/${action.id}`}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        data-testid={`urgent-action-${action.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{action.description}</p>
                          <p className="text-xs text-muted-foreground">{action.propertyAddress}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant={action.severity === 'IMMEDIATE' ? 'destructive' : 'secondary'}>
                            {action.severity}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">No urgent actions pending</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      case 'problem-properties':
        return (
          <DraggableWidget key={widgetId} widgetId={widgetId} isConfiguring={isConfiguring}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Properties Requiring Attention</CardTitle>
                  <CardDescription>Properties with the most compliance issues</CardDescription>
                </div>
                <Link href="/properties?sort=issues&from=/dashboard">
                  <Button variant="ghost" size="sm" data-testid="link-problem-properties">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {(stats?.problemProperties?.length || 0) > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {stats?.problemProperties?.slice(0, 6).map((prop) => (
                      <Link 
                        key={prop.id} 
                        href={`/properties/${prop.id}`}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        data-testid={`problem-property-${prop.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{prop.address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {prop.issueCount} issues
                            </Badge>
                            {prop.criticalCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {prop.criticalCount} critical
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">All properties are in good compliance status</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </DraggableWidget>
        );
        
      default:
        return null;
    }
  };
  
  const fullWidthWidgets: WidgetId[] = ['stats', 'charts', 'quick-actions', 'problem-properties'];
  const smallWidgets: WidgetId[] = ['summary', 'awaabs', 'expiring', 'urgent'];
  
  const renderNormalLayout = () => {
    const result: React.ReactNode[] = [];
    let smallWidgetBuffer: WidgetId[] = [];
    
    visibleWidgets.forEach((widgetId, index) => {
      if (fullWidthWidgets.includes(widgetId)) {
        if (smallWidgetBuffer.length > 0) {
          const cols = smallWidgetBuffer.length <= 2 ? 2 : 3;
          result.push(
            <div key={`grid-${index}`} className={`grid gap-6 md:grid-cols-${cols}`}>
              {smallWidgetBuffer.map(id => renderWidget(id))}
            </div>
          );
          smallWidgetBuffer = [];
        }
        result.push(renderWidget(widgetId));
      } else if (smallWidgets.includes(widgetId)) {
        smallWidgetBuffer.push(widgetId);
        if (smallWidgetBuffer.length === 3 || index === visibleWidgets.length - 1) {
          const cols = smallWidgetBuffer.length <= 2 ? 2 : 3;
          result.push(
            <div key={`grid-${index}`} className={cols === 2 ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3"}>
              {smallWidgetBuffer.map(id => renderWidget(id))}
            </div>
          );
          smallWidgetBuffer = [];
        }
      }
    });
    
    if (smallWidgetBuffer.length > 0) {
      const cols = smallWidgetBuffer.length <= 2 ? 2 : 3;
      result.push(
        <div key="grid-final" className={cols === 2 ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3"}>
          {smallWidgetBuffer.map(id => renderWidget(id))}
        </div>
      );
    }
    
    return result;
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview Hub" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Dashboard content">
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isConfiguring && (
                <Badge variant="secondary" className="animate-pulse">
                  <GripVertical className="h-3 w-3 mr-1" />
                  Drag widgets to reorder
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="btn-widget-visibility">
                    {widgets.filter(w => !w.visible).length > 0 ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Widgets
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Toggle Widget Visibility</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {widgets.map(widget => (
                    <DropdownMenuCheckboxItem
                      key={widget.id}
                      checked={widget.visible}
                      onCheckedChange={() => toggleWidget(widget.id)}
                      data-testid={`toggle-widget-${widget.id}`}
                    >
                      {widget.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant={isConfiguring ? "default" : "outline"} 
                size="sm"
                onClick={() => setIsConfiguring(!isConfiguring)}
                data-testid="btn-configure-layout"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                {isConfiguring ? "Done" : "Configure Layout"}
              </Button>
              
              {isConfiguring && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={resetLayout}
                  data-testid="btn-reset-layout"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </div>
          
          {isConfiguring ? (
            <Reorder.Group 
              axis="y" 
              values={visibleWidgets} 
              onReorder={handleReorder}
              className="space-y-6"
            >
              {visibleWidgets.map(widgetId => renderWidget(widgetId))}
            </Reorder.Group>
          ) : (
            <>{renderNormalLayout()}</>
          )}
        </main>
      </div>
    </div>
  );
}
