import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, BarChart3, Download, Building2, Flame, AlertTriangle, CheckCircle, Clock, ShieldAlert, Loader2, Info, TrendingUp } from "lucide-react";
import { reportsApi } from "@/lib/api";

const METRIC_ICONS: Record<string, any> = {
  BS01: Building2,
  BS02: Flame,
  BS03: AlertTriangle,
  BS04: Clock,
  BS05: CheckCircle,
  BS06: ShieldAlert,
};

const METRIC_COLORS: Record<string, string> = {
  BS01: "text-blue-600 bg-blue-50",
  BS02: "text-orange-600 bg-orange-50",
  BS03: "text-yellow-600 bg-yellow-50",
  BS04: "text-red-600 bg-red-50",
  BS05: "text-green-600 bg-green-50",
  BS06: "text-purple-600 bg-purple-50",
};

export default function Reports() {
  useEffect(() => {
    document.title = "Regulatory Reports - ComplianceAI";
  }, []);

  const { data: tsmReport, isLoading, error } = useQuery({
    queryKey: ["tsm-report"],
    queryFn: () => reportsApi.getTSMBuildingSafety(),
  });

  const downloadCSV = () => {
    if (!tsmReport) return;
    
    const csvRows = [
      ["Metric Code", "Metric Name", "Value", "Unit", "Description"],
      ...Object.entries(tsmReport.metrics).map(([code, metric]) => [
        code,
        metric.name,
        metric.value.toString(),
        metric.unit,
        metric.description
      ])
    ];
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tsm-building-safety-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Regulatory Reports" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Regulatory reports content">
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>TSM Building Safety Metrics</AlertTitle>
            <AlertDescription>
              These metrics align with the Regulator of Social Housing requirements for Building Safety compliance reporting.
              Data is calculated in real-time from your certificate and component records.
            </AlertDescription>
          </Alert>
          
          <Tabs defaultValue="tsm" className="space-y-6">
            <TabsList>
              <TabsTrigger value="tsm" data-testid="tab-tsm">TSM Building Safety (BS01-BS06)</TabsTrigger>
              <TabsTrigger value="summary" data-testid="tab-summary">Compliance Summary</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tsm" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading report data</span>
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error loading report</AlertTitle>
                  <AlertDescription>Failed to load TSM Building Safety report. Please try again.</AlertDescription>
                </Alert>
              ) : tsmReport ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">TSM Building Safety Metrics</h2>
                      <p className="text-muted-foreground">
                        Report generated: {new Date(tsmReport.reportDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button onClick={downloadCSV} data-testid="button-download-csv">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(tsmReport.metrics).map(([code, metric]) => {
                      const Icon = METRIC_ICONS[code] || BarChart3;
                      const colorClass = METRIC_COLORS[code] || "text-gray-600 bg-gray-50";
                      
                      return (
                        <Card key={code} data-testid={`metric-card-${code}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="font-mono">{code}</Badge>
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                            </div>
                            <CardTitle className="text-lg">{metric.name}</CardTitle>
                            <CardDescription className="text-sm">{metric.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-end justify-between">
                              <div>
                                <span className="text-3xl font-bold">{metric.value}</span>
                                <span className="text-muted-foreground ml-1">{metric.unit}</span>
                              </div>
                              {code === "BS02" && (
                                <Progress value={metric.value} className="w-20 h-2" />
                              )}
                            </div>
                            
                            {code === "BS03" && (metric as any).bySeverity && (
                              <div className="mt-4 space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-red-600">Immediate</span>
                                  <span className="font-medium">{(metric as any).bySeverity.immediate || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-orange-600">Urgent</span>
                                  <span className="font-medium">{(metric as any).bySeverity.urgent || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-yellow-600">Priority</span>
                                  <span className="font-medium">{(metric as any).bySeverity.priority || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Routine</span>
                                  <span className="font-medium">{(metric as any).bySeverity.routine || 0}</span>
                                </div>
                              </div>
                            )}
                            
                            {code === "BS04" && (metric as any).byType?.length > 0 && (
                              <div className="mt-4 space-y-1 text-sm">
                                {(metric as any).byType.slice(0, 4).map((item: any) => (
                                  <div key={item.type} className="flex justify-between">
                                    <span className="text-muted-foreground truncate">{item.type.replace(/_/g, ' ')}</span>
                                    <span className="font-medium">{item.count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Compliance Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <div className="text-3xl font-bold">{tsmReport.summary.complianceScore}%</div>
                          <p className="text-sm text-muted-foreground">Overall Compliance</p>
                          <Progress value={tsmReport.summary.complianceScore} className="mt-2" />
                        </div>
                        <div>
                          <div className="text-3xl font-bold">{tsmReport.summary.totalCertificates}</div>
                          <p className="text-sm text-muted-foreground">Total Certificates</p>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">{tsmReport.summary.totalHighRiskComponents}</div>
                          <p className="text-sm text-muted-foreground">High-Risk Components</p>
                        </div>
                        <div>
                          <div className="text-3xl font-bold">{tsmReport.summary.totalRemedialActions}</div>
                          <p className="text-sm text-muted-foreground">Remedial Actions</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {tsmReport.metrics.BS06?.alerts && tsmReport.metrics.BS06.alerts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                          <ShieldAlert className="h-5 w-5" />
                          Critical Safety Alerts
                        </CardTitle>
                        <CardDescription>
                          Immediate severity actions requiring urgent attention
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Property ID</TableHead>
                              <TableHead>Due Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tsmReport.metrics.BS06.alerts.map((alert: any) => (
                              <TableRow key={alert.id}>
                                <TableCell className="font-medium">{alert.description}</TableCell>
                                <TableCell className="font-mono text-sm">{alert.propertyId}</TableCell>
                                <TableCell>{alert.dueDate || "No due date"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </TabsContent>
            
            <TabsContent value="summary" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="mb-2 h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6" />
                    </div>
                    <CardTitle>Big 6 Compliance Summary</CardTitle>
                    <CardDescription>Executive overview of all major compliance streams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-4">
                      Gas Safety, EICR, Fire Risk, Asbestos, Legionella, Lifts
                    </div>
                    <Button className="w-full" size="sm">
                      <FileText className="mr-2 h-4 w-4" /> Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500">
                  <CardHeader>
                    <div className="mb-2 h-10 w-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <CardTitle>Remedial Actions Report</CardTitle>
                    <CardDescription>Outstanding works and contractor assignments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-4">
                      Track urgent works and completion status
                    </div>
                    <Button className="w-full" size="sm">
                      <FileText className="mr-2 h-4 w-4" /> Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
                  <CardHeader>
                    <div className="mb-2 h-10 w-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <CardTitle>Certificate Expiry Forecast</CardTitle>
                    <CardDescription>Upcoming certificate renewals by month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-4">
                      Plan ahead for certificate renewals
                    </div>
                    <Button className="w-full" size="sm">
                      <FileText className="mr-2 h-4 w-4" /> Generate Report
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
