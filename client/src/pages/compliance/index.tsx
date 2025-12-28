import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, TrendingUp, ArrowUpRight, RefreshCw, ShieldCheck, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { certificatesApi, actionsApi } from "@/lib/api";
import { useLocation } from "wouter";

export default function CompliancePage() {
  useEffect(() => {
    document.title = "Compliance Overview - ComplianceAI";
  }, []);

  const [, navigate] = useLocation();
  
  const { data: certificates = [], isLoading: certsLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
  });

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list(),
  });

  const isLoading = certsLoading || actionsLoading;

  // Calculate compliance stats from real data
  const totalCerts = certificates.length;
  const satisfactoryCerts = certificates.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
  const complianceRate = totalCerts > 0 ? ((satisfactoryCerts / totalCerts) * 100).toFixed(1) : '0';
  
  const atRiskProps = certificates.filter(c => {
    if (!c.expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).length;

  const nonCompliant = certificates.filter(c => c.outcome === 'UNSATISFACTORY').length;

  // Compliance by stream - match certificate type enum values (Big 6 + EPC)
  const streams = [
    { name: "Gas Safety", key: "GAS_SAFETY" },
    { name: "Electrical (EICR)", key: "EICR" },
    { name: "Fire Safety (FRA)", key: "FIRE_RISK_ASSESSMENT" },
    { name: "Asbestos", key: "ASBESTOS_SURVEY" },
    { name: "Legionella", key: "LEGIONELLA_ASSESSMENT" },
    { name: "Lift (LOLER)", key: "LIFT_LOLER" },
    { name: "EPC", key: "EPC" },
  ];

  const complianceByStream = streams.map(stream => {
    const streamCerts = certificates.filter(c => c.certificateType === stream.key);
    const validCerts = streamCerts.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
    // Show 0% when no certificates, not 100%
    const rate = streamCerts.length > 0 ? (validCerts / streamCerts.length) * 100 : 0;
    return { ...stream, value: rate, count: streamCerts.length, hasData: streamCerts.length > 0 };
  });

  // Compliance gaps - overdue or unsatisfactory
  const complianceGaps = certificates
    .filter(c => {
      if (c.outcome === 'UNSATISFACTORY') return true;
      if (!c.expiryDate) return false;
      return new Date(c.expiryDate) < new Date();
    })
    .slice(0, 10)
    .map(c => ({
      prop: c.fileName || 'Unknown Property',
      issue: c.outcome === 'UNSATISFACTORY' ? 'Unsatisfactory Result' : 'Certificate Expired',
      stream: c.certificateType?.replace(/_/g, ' ') || 'Unknown',
      days: c.expiryDate ? Math.abs(Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0,
      id: c.id,
    }));

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Compliance Overview" />
          <main id="main-content" className="flex-1 flex items-center justify-center" role="main" aria-label="Compliance overview content">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading compliance data</span>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Overview" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Compliance overview content">
          
          <div className="grid gap-4 md:grid-cols-3">
            <StatsCard 
              title="Big 6 Compliance" 
              value={`${complianceRate}%`}
              description={totalCerts > 0 ? `${satisfactoryCerts} of ${totalCerts} certificates compliant` : 'No certificates uploaded'}
              icon={ShieldCheck}
              status={parseFloat(complianceRate) >= 90 ? "success" : parseFloat(complianceRate) >= 70 ? "warning" : "danger"}
              data-testid="card-compliance-rate"
            />
            <StatsCard 
              title="At Risk Properties" 
              value={String(atRiskProps)}
              description="Expiring within 30 days"
              icon={Clock}
              status={atRiskProps > 0 ? "warning" : "success"}
              data-testid="card-at-risk"
            />
            <StatsCard 
              title="Non-Compliant" 
              value={String(nonCompliant)}
              description="Requiring immediate action"
              icon={XCircle}
              status={nonCompliant > 0 ? "danger" : "success"}
              data-testid="card-non-compliant"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compliance by Stream</CardTitle>
                <CardDescription>Current compliance rates per statutory area</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {complianceByStream.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      {item.hasData ? (
                        <span className={item.value < 95 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                          {item.value.toFixed(1)}% <span className="text-muted-foreground font-normal">({item.count})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Not assessed</span>
                      )}
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      {item.hasData ? (
                        <div 
                          className={`h-full rounded-full ${item.value < 95 ? "bg-amber-500" : "bg-emerald-500"}`} 
                          style={{ width: `${item.value}%` }} 
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open Remedial Actions</CardTitle>
                <CardDescription>Active issues requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {actions.filter(a => a.status === 'OPEN').length > 0 ? (
                  <div className="space-y-3">
                    {actions.filter(a => a.status === 'OPEN').slice(0, 5).map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                        <div>
                          <p className="text-sm font-medium">{action.code}: {action.description?.slice(0, 50)}...</p>
                          <p className="text-xs text-muted-foreground">{action.location}</p>
                        </div>
                        <Badge variant={action.severity === 'IMMEDIATE' ? 'destructive' : 'outline'}>
                          {action.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                    No open remedial actions
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Gaps</CardTitle>
              <CardDescription>Properties requiring attention to achieve 100% compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {complianceGaps.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                      <tr>
                        <th className="p-4">Property</th>
                        <th className="p-4">Issue</th>
                        <th className="p-4">Stream</th>
                        <th className="p-4">Days Overdue</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {complianceGaps.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="p-4 font-medium">{row.prop}</td>
                          <td className="p-4 text-rose-600 font-medium">{row.issue}</td>
                          <td className="p-4">
                            <Badge variant="outline">{row.stream}</Badge>
                          </td>
                          <td className="p-4 text-rose-600">{row.days} days</td>
                          <td className="p-4 text-right">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="gap-1"
                              onClick={() => navigate(`/certificates/${row.id}`)}
                              data-testid={`button-resolve-${row.id}`}
                            >
                              Resolve <ArrowUpRight className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  No compliance gaps - all properties are compliant
                </div>
              )}
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
