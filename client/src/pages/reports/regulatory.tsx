import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileDown,
  Calendar,
  Building2,
  Flame,
  Zap,
  Droplets,
  Wind,
  AlertOctagon,
  TrendingUp,
  Eye,
  Timer,
  ArrowRight,
  ExternalLink,
  FileText,
  Search,
  Filter
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const complianceEvidence = [
  { 
    stream: "Gas Safety (GSIUR 1998)", 
    icon: Flame, 
    color: "#f97316",
    compliant: 1892,
    total: 1945,
    percentage: 97.3,
    lastAudit: "2025-11-15",
    nextDue: "2026-11-15",
    certificates: 1892,
    legislation: "Gas Safety (Installation and Use) Regulations 1998"
  },
  { 
    stream: "Electrical (BS 7671)", 
    icon: Zap, 
    color: "#eab308",
    compliant: 1756,
    total: 1945,
    percentage: 90.3,
    lastAudit: "2025-10-20",
    nextDue: "2030-10-20",
    certificates: 1756,
    legislation: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020"
  },
  { 
    stream: "Fire Safety (RRO 2005)", 
    icon: AlertTriangle, 
    color: "#ef4444",
    compliant: 312,
    total: 345,
    percentage: 90.4,
    lastAudit: "2025-09-01",
    nextDue: "2026-09-01",
    certificates: 312,
    legislation: "Regulatory Reform (Fire Safety) Order 2005"
  },
  { 
    stream: "Legionella (ACoP L8)", 
    icon: Droplets, 
    color: "#3b82f6",
    compliant: 298,
    total: 320,
    percentage: 93.1,
    lastAudit: "2025-08-10",
    nextDue: "2027-08-10",
    certificates: 298,
    legislation: "Health and Safety at Work etc. Act 1974 - ACoP L8"
  },
  { 
    stream: "Asbestos (CAR 2012)", 
    icon: Wind, 
    color: "#8b5cf6",
    compliant: 1890,
    total: 1945,
    percentage: 97.2,
    lastAudit: "2025-06-15",
    nextDue: "2026-06-15",
    certificates: 1890,
    legislation: "Control of Asbestos Regulations 2012"
  },
];

const recentInspections = [
  { date: "2025-12-28", type: "Gas Safety", property: "12 Oak Lane, Unit 4", result: "Pass", inspector: "British Gas", certificate: "GS-2025-4521" },
  { date: "2025-12-27", type: "Electrical", property: "Elm Court, Block A", result: "Pass", inspector: "Safe Electric Ltd", certificate: "EICR-2025-892" },
  { date: "2025-12-26", type: "Fire Safety", property: "Riverside Complex", result: "Minor Issues", inspector: "Fire Safety UK", certificate: "FRA-2025-156" },
  { date: "2025-12-24", type: "Legionella", property: "Oak House", result: "Pass", inspector: "Water Hygiene Ltd", certificate: "LRA-2025-078" },
  { date: "2025-12-23", type: "Gas Safety", property: "15 High Street", result: "Pass", inspector: "British Gas", certificate: "GS-2025-4520" },
];

const exceptions = [
  { 
    id: "EXC-001",
    type: "Overdue Certificate",
    stream: "Fire Safety",
    property: "Elm Court Block A",
    daysOverdue: 14,
    risk: "High",
    impact: "32 units",
    action: "Inspection scheduled for 02/01/2026",
    assignee: "Fire Safety UK"
  },
  { 
    id: "EXC-002",
    type: "Failed Inspection",
    stream: "Electrical",
    property: "22 Maple Drive",
    daysOverdue: 0,
    risk: "Medium",
    impact: "1 unit",
    action: "Remedial work in progress",
    assignee: "Safe Electric Ltd"
  },
  { 
    id: "EXC-003",
    type: "Expiring Soon",
    stream: "Gas Safety",
    property: "Oak House, Units 1-12",
    daysOverdue: -7,
    risk: "Medium",
    impact: "12 units",
    action: "Inspections booked for next week",
    assignee: "British Gas"
  },
  { 
    id: "EXC-004",
    type: "Access Issue",
    stream: "Gas Safety",
    property: "45 River View",
    daysOverdue: 21,
    risk: "High",
    impact: "1 unit",
    action: "Legal notice issued",
    assignee: "Internal Team"
  },
];

const auditTrail = [
  { timestamp: "2025-12-28 14:32", action: "Certificate Uploaded", user: "System", details: "Gas Safety Certificate GS-2025-4521 processed and verified" },
  { timestamp: "2025-12-28 14:30", action: "Inspection Complete", user: "British Gas", details: "Annual gas safety check completed at 12 Oak Lane, Unit 4" },
  { timestamp: "2025-12-28 10:15", action: "Exception Resolved", user: "J. Smith", details: "Access gained at 45 River View after tenant contact" },
  { timestamp: "2025-12-27 16:45", action: "Remedial Action Created", user: "System", details: "Electrical remedial work required at 22 Maple Drive" },
  { timestamp: "2025-12-27 09:00", action: "Bulk Upload", user: "Admin", details: "156 gas safety certificates uploaded via batch import" },
];

const complianceTimeline = [
  { month: "Jul", gas: 95, electrical: 88, fire: 82, legionella: 90, asbestos: 96 },
  { month: "Aug", gas: 96, electrical: 89, fire: 84, legionella: 91, asbestos: 96 },
  { month: "Sep", gas: 96, electrical: 89, fire: 86, legionella: 92, asbestos: 97 },
  { month: "Oct", gas: 97, electrical: 90, fire: 88, legionella: 92, asbestos: 97 },
  { month: "Nov", gas: 97, electrical: 90, fire: 89, legionella: 93, asbestos: 97 },
  { month: "Dec", gas: 97, electrical: 90, fire: 90, legionella: 93, asbestos: 97 },
];

const exceptionsByType = [
  { name: "Overdue", value: 4, color: "#ef4444" },
  { name: "Expiring Soon", value: 12, color: "#f59e0b" },
  { name: "Access Issues", value: 3, color: "#8b5cf6" },
  { name: "Failed Inspection", value: 2, color: "#ec4899" },
];

function getRiskColor(risk: string): string {
  switch (risk) {
    case "High": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "Medium": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "Low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getResultBadge(result: string) {
  switch (result) {
    case "Pass": return <Badge className="bg-green-500" data-testid="badge-result-pass">Pass</Badge>;
    case "Minor Issues": return <Badge className="bg-amber-500" data-testid="badge-result-minor">Minor Issues</Badge>;
    case "Fail": return <Badge variant="destructive" data-testid="badge-result-fail">Fail</Badge>;
    default: return <Badge variant="secondary">{result}</Badge>;
  }
}

export default function RegulatoryEvidence() {
  const [searchTerm, setSearchTerm] = useState("");
  const [streamFilter, setStreamFilter] = useState("all");
  
  const totalCompliant = complianceEvidence.reduce((sum, e) => sum + e.compliant, 0);
  const totalProperties = complianceEvidence.reduce((sum, e) => sum + e.total, 0);
  const overallCompliance = ((totalCompliant / totalProperties) * 100).toFixed(1);
  
  const filteredExceptions = exceptions.filter(exc => {
    const matchesSearch = exc.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          exc.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStream = streamFilter === "all" || exc.stream.toLowerCase().includes(streamFilter.toLowerCase());
    return matchesSearch && matchesStream;
  });
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Regulatory Evidence" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground hidden sm:block" data-testid="text-subtitle">
                  Compliance evidence for HSE and regulatory reporting
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" data-testid="button-export-evidence">
                  <FileDown className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export Evidence Pack</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button variant="outline" data-testid="button-schedule-audit">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Schedule Audit</span>
                  <span className="sm:hidden">Audit</span>
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            <HeroStatsGrid
              stats={[
                {
                  title: "Overall Compliance",
                  value: parseFloat(overallCompliance),
                  subtitle: "%",
                  icon: Shield,
                  riskLevel: parseFloat(overallCompliance) >= 95 ? "good" : parseFloat(overallCompliance) >= 85 ? "medium" : "critical",
                  testId: "stat-overall-compliance",
                },
                {
                  title: "Valid Certificates",
                  value: 6148,
                  icon: FileCheck,
                  riskLevel: "good",
                  testId: "stat-valid-certificates",
                },
                {
                  title: "Active Exceptions",
                  value: exceptions.length,
                  icon: AlertTriangle,
                  riskLevel: exceptions.length > 10 ? "critical" : exceptions.length > 5 ? "high" : "medium",
                  href: "/actions",
                  testId: "stat-active-exceptions",
                },
                {
                  title: "Avg Response Time",
                  value: 2,
                  subtitle: "days",
                  icon: Clock,
                  riskLevel: "low",
                  testId: "stat-response-time",
                },
              ]}
            />

            <Tabs defaultValue="evidence" className="space-y-6">
              <TabsList data-testid="tabs-regulatory">
                <TabsTrigger value="evidence" data-testid="tab-evidence">Compliance Evidence</TabsTrigger>
                <TabsTrigger value="exceptions" data-testid="tab-exceptions">Exception Handling</TabsTrigger>
                <TabsTrigger value="audit" data-testid="tab-audit">Audit Trail</TabsTrigger>
              </TabsList>

              {/* Compliance Evidence Tab */}
              <TabsContent value="evidence" className="space-y-6">
                {/* Compliance by Stream */}
                <Card data-testid="card-compliance-streams">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Compliance by Regulatory Stream
                    </CardTitle>
                    <CardDescription>Evidence of compliance against UK legislation requirements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {complianceEvidence.map((stream, index) => (
                        <div key={stream.stream} className="border rounded-lg p-4" data-testid={`stream-evidence-${index}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg" style={{ backgroundColor: `${stream.color}20` }}>
                                <stream.icon className="h-5 w-5" style={{ color: stream.color }} />
                              </div>
                              <div>
                                <h4 className="font-semibold" data-testid={`text-stream-title-${index}`}>{stream.stream}</h4>
                                <p className="text-xs text-muted-foreground" data-testid={`text-legislation-${index}`}>{stream.legislation}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-2xl font-bold ${stream.percentage >= 95 ? 'text-green-600' : stream.percentage >= 85 ? 'text-amber-600' : 'text-red-600'}`} data-testid={`text-stream-percentage-${index}`}>
                                {stream.percentage}%
                              </span>
                              <p className="text-xs text-muted-foreground">compliant</p>
                            </div>
                          </div>
                          
                          <Progress value={stream.percentage} className="h-2 mb-4" data-testid={`progress-stream-${index}`} />
                          
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Properties Compliant</p>
                              <p className="font-medium" data-testid={`text-compliant-count-${index}`}>{stream.compliant} / {stream.total}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Valid Certificates</p>
                              <p className="font-medium" data-testid={`text-cert-count-${index}`}>{stream.certificates}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Audit</p>
                              <p className="font-medium" data-testid={`text-last-audit-${index}`}>{new Date(stream.lastAudit).toLocaleDateString('en-GB')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Next Due</p>
                              <p className="font-medium" data-testid={`text-next-due-${index}`}>{new Date(stream.nextDue).toLocaleDateString('en-GB')}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Inspections */}
                <Card data-testid="card-recent-inspections">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      Recent Inspections & Certificates
                    </CardTitle>
                    <CardDescription>Latest compliance activities with verifiable evidence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Property</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Result</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Inspector</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Certificate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentInspections.map((inspection, index) => (
                            <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-inspection-${index}`}>
                              <td className="py-3 px-4" data-testid={`text-inspection-date-${index}`}>
                                {new Date(inspection.date).toLocaleDateString('en-GB')}
                              </td>
                              <td className="py-3 px-4" data-testid={`text-inspection-type-${index}`}>{inspection.type}</td>
                              <td className="py-3 px-4" data-testid={`text-inspection-property-${index}`}>{inspection.property}</td>
                              <td className="py-3 px-4">{getResultBadge(inspection.result)}</td>
                              <td className="py-3 px-4" data-testid={`text-inspection-inspector-${index}`}>{inspection.inspector}</td>
                              <td className="py-3 px-4">
                                <Button variant="ghost" size="sm" className="text-primary" data-testid={`button-view-cert-${index}`}>
                                  {inspection.certificate}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance Trend */}
                <Card data-testid="card-compliance-trend">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Compliance Trend (6 Months)
                    </CardTitle>
                    <CardDescription>Historical compliance performance by regulatory stream</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={complianceTimeline}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" />
                          <YAxis domain={[75, 100]} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="gas" name="Gas Safety" fill="#f97316" />
                          <Bar dataKey="electrical" name="Electrical" fill="#eab308" />
                          <Bar dataKey="fire" name="Fire Safety" fill="#ef4444" />
                          <Bar dataKey="legionella" name="Legionella" fill="#3b82f6" />
                          <Bar dataKey="asbestos" name="Asbestos" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Exception Handling Tab */}
              <TabsContent value="exceptions" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Exception List */}
                  <div className="lg:col-span-2 space-y-4">
                    <Card data-testid="card-exceptions-list">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <AlertOctagon className="h-5 w-5 text-amber-500" />
                              Active Exceptions
                            </CardTitle>
                            <CardDescription>Issues requiring attention before they become safety risks</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Search exceptions..." 
                              className="pl-9"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              data-testid="input-search-exceptions"
                            />
                          </div>
                          <Select value={streamFilter} onValueChange={setStreamFilter}>
                            <SelectTrigger className="w-[180px]" data-testid="select-stream-filter">
                              <Filter className="h-4 w-4 mr-2" />
                              <SelectValue placeholder="All Streams" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Streams</SelectItem>
                              <SelectItem value="gas">Gas Safety</SelectItem>
                              <SelectItem value="electrical">Electrical</SelectItem>
                              <SelectItem value="fire">Fire Safety</SelectItem>
                              <SelectItem value="legionella">Legionella</SelectItem>
                              <SelectItem value="asbestos">Asbestos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {filteredExceptions.map((exception, index) => (
                            <div 
                              key={exception.id} 
                              className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                              data-testid={`exception-item-${index}`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" data-testid={`badge-exception-id-${index}`}>{exception.id}</Badge>
                                  <span className="font-medium" data-testid={`text-exception-type-${index}`}>{exception.type}</span>
                                </div>
                                <Badge className={getRiskColor(exception.risk)} data-testid={`badge-exception-risk-${index}`}>
                                  {exception.risk} Risk
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                <div>
                                  <p className="text-muted-foreground">Property</p>
                                  <p className="font-medium" data-testid={`text-exception-property-${index}`}>{exception.property}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Stream</p>
                                  <p className="font-medium" data-testid={`text-exception-stream-${index}`}>{exception.stream}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Impact</p>
                                  <p className="font-medium" data-testid={`text-exception-impact-${index}`}>{exception.impact}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Assigned To</p>
                                  <p className="font-medium" data-testid={`text-exception-assignee-${index}`}>{exception.assignee}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between pt-3 border-t">
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className={exception.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-amber-600'} data-testid={`text-exception-days-${index}`}>
                                    {exception.daysOverdue > 0 
                                      ? `${exception.daysOverdue} days overdue` 
                                      : exception.daysOverdue === 0 
                                        ? 'Due today'
                                        : `Due in ${Math.abs(exception.daysOverdue)} days`
                                    }
                                  </span>
                                </div>
                                <Button variant="ghost" size="sm" data-testid={`button-view-exception-${index}`}>
                                  View Details
                                  <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                              
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                                <p className="text-muted-foreground">Current Action:</p>
                                <p className="font-medium" data-testid={`text-exception-action-${index}`}>{exception.action}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Exception Summary */}
                  <div className="space-y-6">
                    <Card data-testid="card-exception-summary">
                      <CardHeader>
                        <CardTitle>Exception Summary</CardTitle>
                        <CardDescription>Breakdown by type</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={exceptionsByType}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {exceptionsByType.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-response-metrics">
                      <CardHeader>
                        <CardTitle>Response Metrics</CardTitle>
                        <CardDescription>Exception handling performance</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Avg Response Time</span>
                          <span className="font-bold text-green-600" data-testid="text-avg-response">2.3 days</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Resolution Rate</span>
                          <span className="font-bold" data-testid="text-resolution-rate">94%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Escalated to HSE</span>
                          <span className="font-bold text-green-600" data-testid="text-escalated">0</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Resolved This Month</span>
                          <span className="font-bold" data-testid="text-resolved-month">23</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Audit Trail Tab */}
              <TabsContent value="audit" className="space-y-6">
                <Card data-testid="card-audit-trail">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-primary" />
                      Compliance Audit Trail
                    </CardTitle>
                    <CardDescription>Complete record of all compliance activities for regulatory review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {auditTrail.map((entry, index) => (
                        <div 
                          key={index} 
                          className="flex items-start gap-4 p-4 border rounded-lg"
                          data-testid={`audit-entry-${index}`}
                        >
                          <div className="p-2 rounded-lg bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium" data-testid={`text-audit-action-${index}`}>{entry.action}</span>
                              <span className="text-sm text-muted-foreground" data-testid={`text-audit-timestamp-${index}`}>{entry.timestamp}</span>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-audit-details-${index}`}>{entry.details}</p>
                            <p className="text-xs text-muted-foreground mt-1" data-testid={`text-audit-user-${index}`}>By: {entry.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <Button variant="outline" data-testid="button-load-more-audit">
                        Load More
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
