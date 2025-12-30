import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCw, Building2, Calendar, Upload, Eye, ChevronRight, MapPin, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface DashboardStats {
  overallCompliance: string;
  activeHazards: number;
  immediateHazards: number;
  awaabsLawBreaches: number;
  pendingCertificates: number;
  totalProperties: number;
  totalCertificates: number;
  complianceByType: Array<{ type: string; code: string; compliant: number; nonCompliant: number }>;
  hazardDistribution: Array<{ name: string; value: number; severity: string }>;
  expiringCertificates: Array<{ id: string; propertyAddress: string; type: string; expiryDate: string }>;
  urgentActions: Array<{ id: string; description: string; severity: string; propertyAddress: string; dueDate: string }>;
  problemProperties: Array<{ id: string; address: string; issueCount: number; criticalCount: number }>;
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];

// CERT_TYPE_MAP is no longer needed - compliance streams come from database with code property

const SEVERITY_MAP: Record<string, string> = {
  'Immediate': 'IMMEDIATE',
  'Urgent': 'URGENT',
  'Priority': 'PRIORITY',
  'Routine': 'ROUTINE',
  'Advisory': 'ADVISORY',
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    document.title = "Command Centre - ComplianceAI";
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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Compliance Command Centre" />
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

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Command Centre" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Dashboard content">
          
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

          <div className="grid gap-6 md:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Compliance Overview by Stream</CardTitle>
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
            
            <Card className="col-span-3">
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

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/certificates/upload">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="quick-upload-cert">
                      <Upload className="h-5 w-5" />
                      <span className="text-xs">Upload Certificate</span>
                    </Button>
                  </Link>
                  <Link href="/actions?status=OPEN&from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="quick-view-actions">
                      <Wrench className="h-5 w-5" />
                      <span className="text-xs">Open Actions</span>
                    </Button>
                  </Link>
                  <Link href="/properties?from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="quick-view-properties">
                      <Building2 className="h-5 w-5" />
                      <span className="text-xs">Properties</span>
                    </Button>
                  </Link>
                  <Link href="/maps?from=/dashboard">
                    <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="quick-view-maps">
                      <MapPin className="h-5 w-5" />
                      <span className="text-xs">Risk Maps</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

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
                      Total Properties
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stats?.totalProperties || 0}</span>
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

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Awaab's Law Watchlist</CardTitle>
                  <CardDescription>Properties with timescale breaches</CardDescription>
                </div>
                {(stats?.awaabsLawBreaches || 0) > 0 && (
                  <Link href="/actions?awaabs=true&from=/dashboard">
                    <Button variant="ghost" size="sm">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {stats?.awaabsLawBreaches === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                    <p className="text-muted-foreground text-sm">No timescale violations</p>
                    <p className="text-xs text-muted-foreground">All within compliance deadlines</p>
                  </div>
                ) : (
                  <Link href="/actions?awaabs=true&from=/dashboard" className="block">
                    <div className="text-center py-6 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
                      <p className="text-3xl font-bold text-red-600">{stats?.awaabsLawBreaches}</p>
                      <p className="text-sm text-muted-foreground">properties require immediate attention</p>
                      <p className="text-xs text-muted-foreground mt-2">Click to view details</p>
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
                            {new Date(cert.expiryDate).toLocaleDateString()}
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
          </div>

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
        </main>
      </div>
    </div>
  );
}
