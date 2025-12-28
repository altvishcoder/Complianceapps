import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  complianceByType: Array<{ type: string; compliant: number; nonCompliant: number }>;
  hazardDistribution: Array<{ name: string; value: number }>;
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1'];

export default function Dashboard() {
  useEffect(() => {
    document.title = "Dashboard - ComplianceAI";
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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Dashboard" />
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
        <Header title="Dashboard" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Dashboard content">
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard 
              title="Overall Compliance" 
              value={`${stats?.overallCompliance || '0'}%`}
              description="Across all asset groups"
              icon={CheckCircle2}
              status={parseFloat(stats?.overallCompliance || '0') >= 90 ? "success" : "warning"}
            />
            <StatsCard 
              title="Active Hazards" 
              value={String(stats?.activeHazards || 0)}
              description={`${stats?.immediateHazards || 0} requiring immediate action`}
              icon={AlertTriangle}
              trend={stats?.activeHazards ? "down" : undefined}
              trendValue={String(stats?.immediateHazards || 0)}
              status={stats?.activeHazards ? "danger" : "success"}
            />
            <StatsCard 
              title="Awaab's Law Breaches" 
              value={String(stats?.awaabsLawBreaches || 0)}
              description="Timescale violations"
              icon={Clock}
              status={stats?.awaabsLawBreaches ? "danger" : "success"}
            />
            <StatsCard 
              title="Pending Certificates" 
              value={String(stats?.pendingCertificates || 0)}
              description="In ingestion queue"
              icon={FileText}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Compliance Overview (Big 6)</CardTitle>
              </CardHeader>
              <CardContent>
                {complianceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={complianceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="compliant" fill="#3b82f6" name="Compliant %" />
                      <Bar dataKey="nonCompliant" fill="#ef4444" name="Non-Compliant %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No compliance data available
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Active Hazard Distribution</CardTitle>
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
                      >
                        {hazardData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
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

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">Total Properties</span>
                    <span className="font-semibold">{stats?.totalProperties || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">Total Certificates</span>
                    <span className="font-semibold">{stats?.totalCertificates || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-muted-foreground">Active Hazards</span>
                    <span className="font-semibold text-orange-600">{stats?.activeHazards || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Reviews</span>
                    <span className="font-semibold">{stats?.pendingCertificates || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Awaab's Law Watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.awaabsLawBreaches === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                    <p className="text-muted-foreground">No timescale violations</p>
                    <p className="text-sm text-muted-foreground">All properties are within compliance deadlines</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {stats?.awaabsLawBreaches} properties require attention
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
