import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  Timer,
  Target,
  BarChart3,
  Award,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { contractorsApi } from "@/lib/api";
import { Link } from "wouter";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const SLA_STATUS_COLORS = {
  ON_TRACK: "#22c55e",
  AT_RISK: "#f59e0b",
  BREACHED: "#ef4444",
  COMPLETED: "#10b981",
  COMPLETED_LATE: "#f97316"
};

const MOCK_SLA_STATS = {
  totalJobs: 156,
  completedOnTime: 128,
  completedLate: 12,
  inProgress: 14,
  breached: 2,
  averageResponseTime: 4.2,
  averageCompletionTime: 48,
  slaComplianceRate: 92,
  firstTimeFixRate: 87,
  averageRating: 4.6
};

const MOCK_PERFORMANCE_BY_CONTRACTOR = [
  { name: "SafeGas Ltd", compliance: 98, jobs: 45, rating: 4.8 },
  { name: "ElecPro Services", compliance: 94, jobs: 38, rating: 4.5 },
  { name: "FireSafe UK", compliance: 91, jobs: 32, rating: 4.3 },
  { name: "WaterCheck Co", compliance: 88, jobs: 28, rating: 4.2 },
  { name: "LiftServe Ltd", compliance: 85, jobs: 13, rating: 4.0 },
];

const MOCK_SLA_DISTRIBUTION = [
  { name: "On Track", value: 14, color: SLA_STATUS_COLORS.ON_TRACK },
  { name: "At Risk", value: 3, color: SLA_STATUS_COLORS.AT_RISK },
  { name: "Completed", value: 128, color: SLA_STATUS_COLORS.COMPLETED },
  { name: "Completed Late", value: 12, color: SLA_STATUS_COLORS.COMPLETED_LATE },
  { name: "Breached", value: 2, color: SLA_STATUS_COLORS.BREACHED },
];

const MOCK_PRIORITY_PERFORMANCE = [
  { priority: "Emergency", target: 24, actual: 18, compliance: 96 },
  { priority: "Urgent", target: 72, actual: 58, compliance: 94 },
  { priority: "High", target: 168, actual: 142, compliance: 91 },
  { priority: "Standard", target: 672, actual: 520, compliance: 89 },
];

const MOCK_RECENT_BREACHES = [
  { id: "1", contractor: "BuildFix Ltd", job: "Fire Door Inspection", priority: "HIGH", hoursOverdue: 12, property: "Westminster House" },
  { id: "2", contractor: "Maintenance Pro", job: "Emergency Lighting Test", priority: "URGENT", hoursOverdue: 6, property: "Victoria Tower" },
];

const getComplianceColor = (rate: number) => {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 85) return "text-amber-600";
  return "text-red-600";
};

const getComplianceBadge = (rate: number) => {
  if (rate >= 95) return <Badge className="bg-emerald-500">Excellent</Badge>;
  if (rate >= 85) return <Badge className="bg-amber-500">Good</Badge>;
  if (rate >= 70) return <Badge className="bg-orange-500">Needs Improvement</Badge>;
  return <Badge variant="destructive">Poor</Badge>;
};

export default function ContractorDashboardPage() {
  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: () => contractorsApi.list(),
  });

  const activeContractors = contractors.filter(c => c.status === 'APPROVED').length;

  return (
    <PageLayout title="Contractor Performance" pageTitle="Contractor Performance Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard
            title="Active Contractors"
            value={String(activeContractors || 12)}
            description="Approved and working"
            icon={Users}
            trend="up"
            trendValue="+2"
          />
          <StatsCard
            title="SLA Compliance"
            value={`${MOCK_SLA_STATS.slaComplianceRate}%`}
            description="Jobs completed on time"
            icon={Target}
            trend="up"
            trendValue="+3%"
            status="success"
          />
          <StatsCard
            title="Avg Response Time"
            value={`${MOCK_SLA_STATS.averageResponseTime}h`}
            description="Time to acknowledge"
            icon={Timer}
            trend="up"
            trendValue="-0.5h"
          />
          <StatsCard
            title="First Time Fix"
            value={`${MOCK_SLA_STATS.firstTimeFixRate}%`}
            description="Resolved first visit"
            icon={CheckCircle2}
            trend="up"
            trendValue="+2%"
          />
          <StatsCard
            title="Avg Rating"
            value={String(MOCK_SLA_STATS.averageRating)}
            description="Customer satisfaction"
            icon={Star}
            trend="up"
            trendValue="+0.2"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Performance by Contractor</CardTitle>
              <CardDescription>SLA compliance rate by contractor</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={MOCK_PERFORMANCE_BY_CONTRACTOR} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Compliance']}
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="compliance" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>SLA Status Distribution</CardTitle>
              <CardDescription>Current job status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={MOCK_SLA_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {MOCK_SLA_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Priority Response Performance</CardTitle>
                <CardDescription>Target vs actual completion times</CardDescription>
              </div>
              <Link href="/contractors/sla">
                <Button variant="outline" size="sm">
                  View SLA Settings
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_PRIORITY_PERFORMANCE.map((item) => (
                  <div key={item.priority} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.priority === 'Emergency' ? 'destructive' : item.priority === 'Urgent' ? 'default' : 'secondary'}>
                          {item.priority}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Target: {item.target}h | Avg: {item.actual}h
                        </span>
                      </div>
                      <span className={`font-semibold ${getComplianceColor(item.compliance)}`}>
                        {item.compliance}%
                      </span>
                    </div>
                    <Progress value={item.compliance} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Active SLA Breaches
                </CardTitle>
                <CardDescription>Jobs exceeding target times</CardDescription>
              </div>
              <Badge variant="destructive">{MOCK_RECENT_BREACHES.length} Active</Badge>
            </CardHeader>
            <CardContent>
              {MOCK_RECENT_BREACHES.length > 0 ? (
                <div className="space-y-3">
                  {MOCK_RECENT_BREACHES.map((breach) => (
                    <div key={breach.id} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{breach.contractor}</p>
                          <p className="text-sm text-muted-foreground">{breach.job}</p>
                          <p className="text-xs text-muted-foreground mt-1">{breach.property}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={breach.priority === 'URGENT' ? 'destructive' : 'secondary'} className="mb-1">
                            {breach.priority}
                          </Badge>
                          <p className="text-sm font-medium text-red-600">
                            +{breach.hoursOverdue}h overdue
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                  <p className="text-muted-foreground text-sm">No active SLA breaches</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Performing Contractors</CardTitle>
              <CardDescription>Ranked by overall performance score</CardDescription>
            </div>
            <Link href="/contractors/reports">
              <Button variant="outline" size="sm">
                View Full Report
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {MOCK_PERFORMANCE_BY_CONTRACTOR.slice(0, 5).map((contractor, index) => (
                <div key={contractor.name} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    {index === 0 && <Award className="h-5 w-5 text-yellow-500" />}
                    {index === 1 && <Award className="h-5 w-5 text-slate-400" />}
                    {index === 2 && <Award className="h-5 w-5 text-amber-700" />}
                    <span className="font-medium text-sm truncate">{contractor.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Compliance</span>
                      <span className={`font-semibold ${getComplianceColor(contractor.compliance)}`}>
                        {contractor.compliance}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Jobs</span>
                      <span>{contractor.jobs}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rating</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {contractor.rating}
                      </span>
                    </div>
                  </div>
                  {getComplianceBadge(contractor.compliance)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
