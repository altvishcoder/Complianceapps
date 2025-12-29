import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, TrendingUp, ArrowUpRight, RefreshCw, ShieldCheck, Clock, XCircle, ChevronRight, Building2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { certificatesApi, actionsApi } from "@/lib/api";
import { useLocation, Link } from "wouter";

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

  const totalCerts = certificates.length;
  const satisfactoryCerts = certificates.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
  const complianceRate = totalCerts > 0 ? ((satisfactoryCerts / totalCerts) * 100).toFixed(1) : '0';
  
  const atRiskProps = certificates.filter(c => {
    if (!c.expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).length;

  const nonCompliant = certificates.filter(c => c.outcome === 'UNSATISFACTORY').length;

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
    const rate = streamCerts.length > 0 ? (validCerts / streamCerts.length) * 100 : 0;
    return { ...stream, value: rate, count: streamCerts.length, hasData: streamCerts.length > 0 };
  });

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

  const openActions = actions.filter(a => a.status === 'OPEN');

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
              href="/certificates?from=/compliance"
              data-testid="card-compliance-rate"
            />
            <StatsCard 
              title="At Risk Properties" 
              value={String(atRiskProps)}
              description="Expiring within 30 days"
              icon={Clock}
              status={atRiskProps > 0 ? "warning" : "success"}
              href="/certificates?from=/compliance"
              data-testid="card-at-risk"
            />
            <StatsCard 
              title="Non-Compliant" 
              value={String(nonCompliant)}
              description="Requiring immediate action"
              icon={XCircle}
              status={nonCompliant > 0 ? "danger" : "success"}
              href="/actions?status=OPEN&from=/compliance"
              data-testid="card-non-compliant"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Compliance by Stream</CardTitle>
                  <CardDescription>Click any stream to view certificates</CardDescription>
                </div>
                <Link href="/certificates?from=/compliance">
                  <Button variant="ghost" size="sm" data-testid="link-all-certificates">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {complianceByStream.map((item) => (
                  <Link 
                    key={item.key} 
                    href={`/certificates?type=${item.key}&from=/compliance`}
                    className="block space-y-1 p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                    data-testid={`stream-${item.key}`}
                  >
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
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Open Remedial Actions</CardTitle>
                  <CardDescription>Active issues requiring attention</CardDescription>
                </div>
                {openActions.length > 0 && (
                  <Link href="/actions?status=OPEN&from=/compliance">
                    <Button variant="ghost" size="sm" data-testid="link-all-actions">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {openActions.length > 0 ? (
                  <div className="space-y-3">
                    {openActions.slice(0, 5).map((action) => (
                      <Link 
                        key={action.id} 
                        href={`/actions?from=/compliance`}
                        className="flex items-start justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                        data-testid={`action-${action.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            <span className="font-bold">{action.code}:</span> {action.description?.slice(0, 40)}...
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {action.propertyAddress && (
                              <span className="flex items-center gap-1 truncate">
                                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {action.propertyAddress}
                              </span>
                            )}
                            {action.schemeName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {action.schemeName}
                              </span>
                            )}
                          </div>
                          {action.location && (
                            <p className="text-xs text-muted-foreground mt-1">{action.location}</p>
                          )}
                        </div>
                        <Badge 
                          variant={action.severity === 'IMMEDIATE' ? 'destructive' : 'outline'}
                          className="shrink-0 ml-2"
                        >
                          {action.severity}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" aria-hidden="true" />
                    <p>No open remedial actions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Compliance Gaps</CardTitle>
                <CardDescription>Properties requiring attention to achieve 100% compliance</CardDescription>
              </div>
              {complianceGaps.length > 0 && (
                <Link href="/certificates?from=/compliance">
                  <Button variant="ghost" size="sm" data-testid="link-compliance-gaps">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {complianceGaps.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm text-left" role="table" aria-label="Compliance gaps table">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                      <tr>
                        <th scope="col" className="p-4">Property</th>
                        <th scope="col" className="p-4">Issue</th>
                        <th scope="col" className="p-4">Stream</th>
                        <th scope="col" className="p-4">Days Overdue</th>
                        <th scope="col" className="p-4 text-right">Action</th>
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
                              onClick={() => navigate(`/certificates/${row.id}?from=/compliance`)}
                              data-testid={`button-resolve-${row.id}`}
                            >
                              Resolve <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" aria-hidden="true" />
                  <p>No compliance gaps - all properties are compliant</p>
                </div>
              )}
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
