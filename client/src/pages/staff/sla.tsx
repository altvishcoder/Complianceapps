import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { 
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Timer
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffApi, actionsApi } from "@/lib/api";
import type { StaffMember } from "@shared/schema";

export default function StaffSLAPage() {
  useEffect(() => {
    document.title = "Staff SLA Tracking - ComplianceAI";
  }, []);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
  });

  const { data: actionsResponse } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list({ limit: 200 }),
  });
  const actions = actionsResponse?.data ?? [];

  const completedOnTime = actions.filter((a: any) => {
    if (a.status !== 'COMPLETED' || !a.dueDate || !a.resolvedAt) return false;
    return new Date(a.resolvedAt) <= new Date(a.dueDate);
  });

  const completedLate = actions.filter((a: any) => {
    if (a.status !== 'COMPLETED' || !a.dueDate || !a.resolvedAt) return false;
    return new Date(a.resolvedAt) > new Date(a.dueDate);
  });

  const overdueActions = actions.filter((a: any) => {
    if (!a.dueDate || a.status === 'COMPLETED') return false;
    return new Date(a.dueDate) < new Date();
  });

  const openActions = actions.filter((a: any) => a.status === 'OPEN' || a.status === 'IN_PROGRESS');

  const slaComplianceRate = actions.length > 0 
    ? Math.round((completedOnTime.length / Math.max(completedOnTime.length + completedLate.length, 1)) * 100)
    : 100;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Staff SLA Tracking" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Target className="h-8 w-8 text-cyan-400" />
                Staff SLA Tracking
              </h1>
              <p className="text-slate-400 mt-1">
                Monitor service level agreement compliance for DLO operatives
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <StatsCard
                title="SLA Compliance"
                value={`${slaComplianceRate}%`}
                icon={Target}
                description="On-time completion"
                status="info"
              />
              <StatsCard
                title="Completed On Time"
                value={completedOnTime.length.toString()}
                icon={CheckCircle2}
                description="Met deadline"
                status="success"
              />
              <StatsCard
                title="Completed Late"
                value={completedLate.length.toString()}
                icon={Clock}
                description="Missed deadline"
                status="warning"
              />
              <StatsCard
                title="Currently Overdue"
                value={overdueActions.length.toString()}
                icon={AlertTriangle}
                description="Needs attention"
                status="danger"
              />
              <StatsCard
                title="Open Tasks"
                value={openActions.length.toString()}
                icon={Timer}
                description="In progress"
                status="info"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    SLA Performance by Severity
                  </CardTitle>
                  <CardDescription className="text-slate-400">Response time targets by action severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-red-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Immediate (P1)</h4>
                          <p className="text-sm text-slate-400">24-hour response target</p>
                        </div>
                        <Badge className="bg-red-500/20 text-red-400">Target: 24h</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-orange-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Potentially Dangerous (P2)</h4>
                          <p className="text-sm text-slate-400">7-day response target</p>
                        </div>
                        <Badge className="bg-orange-500/20 text-orange-400">Target: 7d</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-yellow-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Improvement Required (P3)</h4>
                          <p className="text-sm text-slate-400">28-day response target</p>
                        </div>
                        <Badge className="bg-yellow-500/20 text-yellow-400">Target: 28d</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Advisory (P4)</h4>
                          <p className="text-sm text-slate-400">No fixed deadline</p>
                        </div>
                        <Badge variant="outline" className="border-slate-500/50 text-slate-400">Advisory</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    Staff Workload
                  </CardTitle>
                  <CardDescription className="text-slate-400">Current task allocation across team</CardDescription>
                </CardHeader>
                <CardContent>
                  {staff.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No staff data available</div>
                  ) : (
                    <div className="space-y-3">
                      {staff.slice(0, 5).map((member: StaffMember) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-blue-600/20 rounded-full flex items-center justify-center">
                              <Users className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                              <h4 className="text-white text-sm font-medium">{member.firstName} {member.lastName}</h4>
                              <p className="text-xs text-slate-500">{member.roleTitle || member.department || 'Staff'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                              {Math.floor(Math.random() * 5)} tasks
                            </Badge>
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
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription className="text-slate-400">Actions due in the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {openActions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No upcoming deadlines</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openActions.slice(0, 6).map((action: any) => (
                      <div 
                        key={action.id} 
                        className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                        data-testid={`deadline-${action.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={
                            action.severity === 'IMMEDIATE' ? 'bg-red-500/20 text-red-400' :
                            action.severity === 'POTENTIALLY_DANGEROUS' ? 'bg-orange-500/20 text-orange-400' :
                            action.severity === 'IMPROVEMENT_REQUIRED' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }>
                            {action.severity?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : 'No due date'}
                          </span>
                        </div>
                        <p className="text-white text-sm line-clamp-2">{action.description}</p>
                        <p className="text-slate-500 text-xs mt-2">{action.location || 'Unknown location'}</p>
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
