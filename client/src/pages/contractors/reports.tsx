import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  BarChart3,
  Download,
  FileText,
  Star,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { contractorsApi } from "@/lib/api";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";

const MOCK_MONTHLY_PERFORMANCE = [
  { month: "Jul", compliance: 88, jobs: 22, rating: 4.2 },
  { month: "Aug", compliance: 89, jobs: 25, rating: 4.3 },
  { month: "Sep", compliance: 91, jobs: 28, rating: 4.4 },
  { month: "Oct", compliance: 90, jobs: 31, rating: 4.5 },
  { month: "Nov", compliance: 93, jobs: 29, rating: 4.6 },
  { month: "Dec", compliance: 92, jobs: 27, rating: 4.6 },
];

const MOCK_CONTRACTOR_RANKINGS = [
  { rank: 1, name: "SafeGas Ltd", compliance: 98, jobs: 45, avgRating: 4.8, trend: "up", breaches: 0 },
  { rank: 2, name: "ElecPro Services", compliance: 94, jobs: 38, avgRating: 4.5, trend: "up", breaches: 1 },
  { rank: 3, name: "FireSafe UK", compliance: 91, jobs: 32, avgRating: 4.3, trend: "neutral", breaches: 2 },
  { rank: 4, name: "WaterCheck Co", compliance: 88, jobs: 28, avgRating: 4.2, trend: "down", breaches: 3 },
  { rank: 5, name: "LiftServe Ltd", compliance: 85, jobs: 13, avgRating: 4.0, trend: "up", breaches: 2 },
  { rank: 6, name: "BuildFix Ltd", compliance: 82, jobs: 24, avgRating: 3.9, trend: "down", breaches: 4 },
  { rank: 7, name: "Maintenance Pro", compliance: 79, jobs: 19, avgRating: 3.7, trend: "down", breaches: 5 },
];

const MOCK_WORK_CATEGORY_STATS = [
  { category: "Gas Safety", jobs: 68, compliance: 95, avgTime: 42 },
  { category: "Electrical", jobs: 54, compliance: 92, avgTime: 56 },
  { category: "Fire Safety", jobs: 38, compliance: 89, avgTime: 72 },
  { category: "Legionella", jobs: 22, compliance: 94, avgTime: 38 },
  { category: "General", jobs: 45, compliance: 86, avgTime: 84 },
];

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <span className="h-4 w-4 text-slate-400">—</span>;
  }
};

const getComplianceBadge = (rate: number) => {
  if (rate >= 95) return <Badge className="bg-emerald-500">Excellent</Badge>;
  if (rate >= 85) return <Badge className="bg-amber-500">Good</Badge>;
  if (rate >= 70) return <Badge className="bg-orange-500">Fair</Badge>;
  return <Badge variant="destructive">Poor</Badge>;
};

export default function ContractorReportsPage() {
  const [dateRange, setDateRange] = useState("30d");
  
  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: () => contractorsApi.list(),
  });

  const handleExport = (format: string) => {
    console.log(`Exporting report as ${format}`);
  };

  return (
    <PageLayout title="Contractor Reports" pageTitle="Contractor Performance Reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40" data-testid="select-date-range">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExport('pdf')} data-testid="btn-export-pdf">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')} data-testid="btn-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contractors</p>
                  <p className="text-2xl font-bold">{contractors.length || 12}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Jobs Completed</p>
                  <p className="text-2xl font-bold">156</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Compliance</p>
                  <p className="text-2xl font-bold">92%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SLA Breaches</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rankings" className="w-full">
          <TabsList>
            <TabsTrigger value="rankings" data-testid="tab-rankings">Contractor Rankings</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">By Work Category</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings">
            <Card>
              <CardHeader>
                <CardTitle>Contractor Performance Rankings</CardTitle>
                <CardDescription>Ranked by overall SLA compliance and customer ratings</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Compliance Rate</TableHead>
                      <TableHead>Jobs Completed</TableHead>
                      <TableHead>Avg Rating</TableHead>
                      <TableHead>SLA Breaches</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_CONTRACTOR_RANKINGS.map((contractor) => (
                      <TableRow key={contractor.rank} data-testid={`row-contractor-${contractor.rank}`}>
                        <TableCell>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            contractor.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                            contractor.rank === 2 ? 'bg-slate-100 text-slate-700' :
                            contractor.rank === 3 ? 'bg-amber-100 text-amber-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {contractor.rank}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{contractor.name}</TableCell>
                        <TableCell>
                          <span className={contractor.compliance >= 90 ? 'text-green-600' : contractor.compliance >= 80 ? 'text-amber-600' : 'text-red-600'}>
                            {contractor.compliance}%
                          </span>
                        </TableCell>
                        <TableCell>{contractor.jobs}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {contractor.avgRating}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={contractor.breaches > 3 ? 'text-red-600' : contractor.breaches > 0 ? 'text-amber-600' : 'text-green-600'}>
                            {contractor.breaches}
                          </span>
                        </TableCell>
                        <TableCell>{getTrendIcon(contractor.trend)}</TableCell>
                        <TableCell>{getComplianceBadge(contractor.compliance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends Over Time</CardTitle>
                <CardDescription>Monthly compliance rates and job volumes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={MOCK_MONTHLY_PERFORMANCE}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="compliance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Compliance Rate %"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="jobs" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="Jobs Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Performance by Work Category</CardTitle>
                <CardDescription>Breakdown of contractor performance across different work types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={MOCK_WORK_CATEGORY_STATS}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(value: number) => [`${value}%`, 'Compliance']} />
                        <Bar dataKey="compliance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Jobs</TableHead>
                          <TableHead>Compliance</TableHead>
                          <TableHead>Avg Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_WORK_CATEGORY_STATS.map((cat) => (
                          <TableRow key={cat.category}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell>{cat.jobs}</TableCell>
                            <TableCell>
                              <span className={cat.compliance >= 90 ? 'text-green-600' : 'text-amber-600'}>
                                {cat.compliance}%
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{cat.avgTime}h</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
