import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  Download,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  BarChart3,
  PieChart
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffApi, actionsApi, certificatesApi } from "@/lib/api";
import type { Contractor } from "@shared/schema";

const REPORT_TYPES = [
  {
    id: "performance",
    name: "Staff Performance Report",
    description: "Individual and team performance metrics",
    icon: TrendingUp,
    color: "text-emerald-400"
  },
  {
    id: "workload",
    name: "Workload Distribution",
    description: "Task allocation across DLO team",
    icon: PieChart,
    color: "text-blue-400"
  },
  {
    id: "sla",
    name: "SLA Compliance Report",
    description: "Service level agreement adherence",
    icon: Clock,
    color: "text-cyan-400"
  },
  {
    id: "training",
    name: "Training & Certifications",
    description: "Staff qualifications and expiries",
    icon: Users,
    color: "text-purple-400"
  }
];

export default function StaffReportsPage() {
  useEffect(() => {
    document.title = "Staff Reports - ComplianceAI";
  }, []);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list(),
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
  });

  const completedActions = actions.filter((a: any) => a.status === 'COMPLETED');
  const activeStaff = staff.filter((s: Contractor) => s.status === 'APPROVED');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Staff Reports" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <FileText className="h-8 w-8 text-purple-400" />
                  Staff Reports
                </h1>
                <p className="text-slate-400 mt-1">
                  Generate and download DLO performance reports
                </p>
              </div>
              <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-generate-all">
                <Download className="h-4 w-4 mr-2" />
                Export All Reports
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{staff.length}</p>
                      <p className="text-sm text-slate-400">Total Staff</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-emerald-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{activeStaff.length}</p>
                      <p className="text-sm text-slate-400">Active</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-purple-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{completedActions.length}</p>
                      <p className="text-sm text-slate-400">Jobs Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-cyan-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{certificates.length}</p>
                      <p className="text-sm text-slate-400">Certificates Issued</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Available Reports</CardTitle>
                <CardDescription className="text-slate-400">Select a report type to generate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {REPORT_TYPES.map((report) => (
                    <div 
                      key={report.id}
                      className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer"
                      data-testid={`report-${report.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-slate-700/50`}>
                            <report.icon className={`h-6 w-6 ${report.color}`} />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{report.name}</h3>
                            <p className="text-sm text-slate-400 mt-1">{report.description}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  Recent Report History
                </CardTitle>
                <CardDescription className="text-slate-400">Previously generated reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reports generated yet</p>
                  <p className="text-sm mt-1">Generate a report above to see it here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
