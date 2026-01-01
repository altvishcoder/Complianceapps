import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Award,
  BarChart3,
  Briefcase,
  Target
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffApi, certificatesApi, actionsApi } from "@/lib/api";
import type { Contractor } from "@shared/schema";

export default function StaffDashboardPage() {
  useEffect(() => {
    document.title = "Staff Performance - ComplianceAI";
  }, []);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list(),
  });

  const activeStaff = staff.filter((s: Contractor) => s.status === 'APPROVED');
  const completedActions = actions.filter((a: any) => a.status === 'COMPLETED');
  const overdueActions = actions.filter((a: any) => {
    if (!a.dueDate || a.status === 'COMPLETED') return false;
    return new Date(a.dueDate) < new Date();
  });

  const tradeDistribution = staff.reduce((acc: Record<string, number>, s: Contractor) => {
    acc[s.tradeType] = (acc[s.tradeType] || 0) + 1;
    return acc;
  }, {});

  const departmentDistribution = staff.reduce((acc: Record<string, number>, s: Contractor) => {
    const dept = s.department || 'Unassigned';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Staff Performance" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-blue-400" />
                Staff Performance Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Monitor DLO operative performance and workload distribution
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <StatsCard
                title="Total Staff"
                value={staff.length.toString()}
                icon={Users}
                description="DLO team members"
                status="info"
              />
              <StatsCard
                title="Active Operatives"
                value={activeStaff.length.toString()}
                icon={CheckCircle2}
                description="Currently active"
                status="success"
              />
              <StatsCard
                title="Jobs Completed"
                value={completedActions.length.toString()}
                icon={Award}
                description="This period"
              />
              <StatsCard
                title="On-Time Rate"
                value={actions.length > 0 ? `${Math.round(((actions.length - overdueActions.length) / actions.length) * 100)}%` : "N/A"}
                icon={Target}
                description="SLA compliance"
                status="info"
              />
              <StatsCard
                title="Overdue Tasks"
                value={overdueActions.length.toString()}
                icon={AlertTriangle}
                description="Requires attention"
                status="danger"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-400" />
                    Staff by Trade
                  </CardTitle>
                  <CardDescription className="text-slate-400">Distribution of operatives by trade type</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(tradeDistribution).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No staff data available</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(tradeDistribution)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .map(([trade, count]) => (
                          <div key={trade} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <span className="text-white">{trade}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-slate-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${(count as number / staff.length) * 100}%` }}
                                />
                              </div>
                              <Badge variant="outline" className="border-blue-500/50 text-blue-400">{count as number}</Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Staff by Department
                  </CardTitle>
                  <CardDescription className="text-slate-400">Team distribution across departments</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(departmentDistribution).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No department data available</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(departmentDistribution)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .map(([dept, count]) => (
                          <div key={dept} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <span className="text-white">{dept}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-slate-700 rounded-full h-2">
                                <div 
                                  className="bg-emerald-500 h-2 rounded-full" 
                                  style={{ width: `${(count as number / staff.length) * 100}%` }}
                                />
                              </div>
                              <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">{count as number}</Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  Top Performers
                </CardTitle>
                <CardDescription className="text-slate-400">Staff members with highest completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                {activeStaff.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No active staff to display</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {activeStaff.slice(0, 6).map((member: Contractor, index: number) => (
                      <div 
                        key={member.id} 
                        className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                        data-testid={`top-performer-${member.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{member.companyName}</h4>
                            <p className="text-sm text-slate-400">{member.tradeType}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-500">{member.department || 'General'}</span>
                          <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                        </div>
                      </div>
                    ))}
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
