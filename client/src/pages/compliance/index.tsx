import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, 
  ShieldCheck, Clock, XCircle, ChevronRight, Building2, MapPin, CalendarDays,
  Scale, Target, AlertOctagon, FileWarning, BarChart3, ListChecks
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { certificatesApi, actionsApi } from "@/lib/api";
import { useLocation, Link } from "wouter";

interface ComplianceStream {
  id: string;
  code: string;
  name: string;
  shortName: string;
  description?: string;
  legislationRefs?: string;
  isActive: boolean;
}

interface CertificateType {
  code: string;
  complianceStream: string;
  shortName: string;
}

export default function CompliancePage() {
  useEffect(() => {
    document.title = "Compliance Analytics Hub - ComplianceAI";
  }, []);

  const [, navigate] = useLocation();
  
  const { data: certificatesResponse, isLoading: certsLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list({ limit: 200 }),
  });
  const certificates = certificatesResponse?.data ?? [];

  const { data: actionsResponse, isLoading: actionsLoading } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list({ limit: 200 }),
  });
  const actions = actionsResponse?.data ?? [];

  // Fetch dynamic compliance streams from database
  const { data: complianceStreams = [] } = useQuery<ComplianceStream[]>({
    queryKey: ["compliance-streams"],
    queryFn: async () => {
      const res = await fetch('/api/config/compliance-streams');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch certificate types for stream mapping
  const { data: certificateTypes = [] } = useQuery<CertificateType[]>({
    queryKey: ["certificate-types"],
    queryFn: async () => {
      const res = await fetch('/api/config/certificate-types');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = certsLoading || actionsLoading;

  // Create certificate type to stream mapping
  const certTypeToStream = useMemo(() => {
    const map: Record<string, string> = {};
    certificateTypes.forEach(ct => {
      if (ct.complianceStream) {
        map[ct.code] = ct.complianceStream;
      }
    });
    return map;
  }, [certificateTypes]);

  // Calculate analytics by stream
  const streamAnalytics = useMemo(() => {
    const activeStreams = complianceStreams.filter(s => s.isActive);
    
    return activeStreams.map(stream => {
      // Find certificate types belonging to this stream
      const streamCertTypes = certificateTypes
        .filter(ct => ct.complianceStream === stream.code)
        .map(ct => ct.code);
      
      const streamCerts = certificates.filter(c => streamCertTypes.includes(c.certificateType));
      const total = streamCerts.length;
      const compliant = streamCerts.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
      const unsatisfactory = streamCerts.filter(c => c.outcome === 'UNSATISFACTORY').length;
      const expired = streamCerts.filter(c => c.expiryDate && new Date(c.expiryDate) < new Date()).length;
      const expiringWithin30 = streamCerts.filter(c => {
        if (!c.expiryDate) return false;
        const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 30;
      }).length;
      
      const rate = total > 0 ? (compliant / total) * 100 : 0;
      
      return {
        ...stream,
        total,
        compliant,
        unsatisfactory,
        expired,
        expiringWithin30,
        rate,
        hasData: total > 0,
        riskLevel: rate >= 95 ? 'low' : rate >= 80 ? 'medium' : 'high',
      };
    }).sort((a, b) => a.rate - b.rate); // Sort by compliance rate (worst first)
  }, [complianceStreams, certificateTypes, certificates]);

  // Calculate overall compliance metrics
  const totalCerts = certificates.length;
  const satisfactoryCerts = certificates.filter(c => c.outcome === 'SATISFACTORY' || c.status === 'APPROVED').length;
  const complianceRate = totalCerts > 0 ? ((satisfactoryCerts / totalCerts) * 100) : 0;
  
  // Urgent issues count
  const expiredCerts = certificates.filter(c => c.expiryDate && new Date(c.expiryDate) < new Date()).length;
  const unsatisfactoryCerts = certificates.filter(c => c.outcome === 'UNSATISFACTORY').length;
  const urgentIssues = expiredCerts + unsatisfactoryCerts;

  // Awaab's Law related (housing health issues)
  const awaabsActions = actions.filter(a => 
    a.severity === 'IMMEDIATE' && 
    (a.status === 'OPEN' || a.status === 'IN_PROGRESS')
  ).length;

  // Upcoming expirations timeline
  const upcomingExpirations = useMemo(() => {
    const now = new Date();
    const next90Days = certificates
      .filter(c => {
        if (!c.expiryDate) return false;
        const days = Math.ceil((new Date(c.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 90;
      })
      .map(c => ({
        id: c.id,
        type: c.certificateType?.replace(/_/g, ' '),
        stream: certTypeToStream[c.certificateType] || 'Unknown',
        property: c.property?.addressLine1 || c.fileName,
        expiryDate: c.expiryDate,
        daysUntil: Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    
    return next90Days.slice(0, 10);
  }, [certificates, certTypeToStream]);

  // Priority actions based on severity and age
  const priorityActions = useMemo(() => {
    return actions
      .filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS')
      .sort((a, b) => {
        const severityOrder: Record<string, number> = { IMMEDIATE: 0, URGENT: 1, PRIORITY: 2, ROUTINE: 3 };
        return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      })
      .slice(0, 8);
  }, [actions]);

  // Streams needing attention (below 95% compliance)
  const streamsNeedingAttention = streamAnalytics.filter(s => s.hasData && s.rate < 95);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Compliance Analytics Hub" />
          <main id="main-content" className="flex-1 flex items-center justify-center" role="main" aria-label="Compliance analytics content">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading compliance analytics</span>
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
        <Header title="Compliance Analytics Hub" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Compliance analytics content">
          
          {/* Compliance Health Score Banner */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Portfolio Compliance Health</h2>
                  <p className="text-muted-foreground">
                    Analysing {totalCerts} certificates across {streamAnalytics.filter(s => s.hasData).length} compliance streams
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-primary">{complianceRate.toFixed(1)}%</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {complianceRate >= 95 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">Target achieved</span>
                      </>
                    ) : (
                      <>
                        <Target className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-600 font-medium">{(95 - complianceRate).toFixed(1)}% to 95% target</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={complianceRate} 
                  className="h-3"
                />
              </div>
            </CardContent>
          </Card>

          {/* Alert Cards for Urgent Issues */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className={urgentIssues > 0 ? "border-red-200 bg-red-50/50" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${urgentIssues > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    <AlertOctagon className={`h-5 w-5 ${urgentIssues > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Urgent Issues</p>
                    <p className="text-2xl font-bold">{urgentIssues}</p>
                  </div>
                </div>
                {urgentIssues > 0 && (
                  <Link href="/certificates?filter=overdue&from=/compliance">
                    <Button size="sm" variant="destructive">Review</Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className={awaabsActions > 0 ? "border-orange-200 bg-orange-50/50" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${awaabsActions > 0 ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                    <Scale className={`h-5 w-5 ${awaabsActions > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Awaab's Law Risk</p>
                    <p className="text-2xl font-bold">{awaabsActions}</p>
                  </div>
                </div>
                {awaabsActions > 0 && (
                  <Link href="/actions?severity=IMMEDIATE&from=/compliance">
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">Review</Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className={streamsNeedingAttention.length > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${streamsNeedingAttention.length > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    <BarChart3 className={`h-5 w-5 ${streamsNeedingAttention.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Streams Below Target</p>
                    <p className="text-2xl font-bold">{streamsNeedingAttention.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="streams" className="space-y-4">
            <TabsList>
              <TabsTrigger value="streams" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Stream Analysis
              </TabsTrigger>
              <TabsTrigger value="expirations" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Expiration Timeline
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Priority Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="streams" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Stream Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown by regulatory stream with drill-down capability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {streamAnalytics.map((stream) => (
                      <Link 
                        key={stream.id} 
                        href={`/certificates?stream=${stream.code}&from=/compliance`}
                        className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                        data-testid={`stream-analysis-${stream.code}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant={stream.riskLevel === 'low' ? 'outline' : stream.riskLevel === 'medium' ? 'secondary' : 'destructive'}
                              className={stream.riskLevel === 'low' ? 'border-emerald-300 text-emerald-700' : ''}
                            >
                              {stream.riskLevel === 'low' ? 'On Target' : stream.riskLevel === 'medium' ? 'Needs Attention' : 'Critical'}
                            </Badge>
                            <span className="font-semibold">{stream.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            {stream.hasData ? (
                              <>
                                <span className={`font-bold ${stream.rate >= 95 ? 'text-emerald-600' : stream.rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {stream.rate.toFixed(1)}%
                                </span>
                                <span className="text-muted-foreground">
                                  {stream.compliant}/{stream.total} compliant
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">Not assessed</span>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        
                        {stream.hasData && (
                          <>
                            <Progress 
                              value={stream.rate} 
                              className="h-2 mb-2"
                            />
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {stream.unsatisfactory > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircle className="h-3 w-3" />
                                  {stream.unsatisfactory} unsatisfactory
                                </span>
                              )}
                              {stream.expired > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <FileWarning className="h-3 w-3" />
                                  {stream.expired} expired
                                </span>
                              )}
                              {stream.expiringWithin30 > 0 && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Clock className="h-3 w-3" />
                                  {stream.expiringWithin30} expiring in 30 days
                                </span>
                              )}
                              {stream.unsatisfactory === 0 && stream.expired === 0 && stream.expiringWithin30 === 0 && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  All certificates valid
                                </span>
                              )}
                            </div>
                          </>
                        )}

                        {stream.legislationRefs && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium">Legislation:</span> {stream.legislationRefs}
                          </div>
                        )}
                      </Link>
                    ))}
                    
                    {streamAnalytics.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShieldCheck className="w-12 h-12 mx-auto mb-2" />
                        <p>No compliance streams configured</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expirations" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Expirations</CardTitle>
                    <CardDescription>
                      Certificates expiring in the next 90 days - plan renewals ahead
                    </CardDescription>
                  </div>
                  <Link href="/certificates?filter=expiring&from=/compliance">
                    <Button variant="outline" size="sm">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {upcomingExpirations.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm" role="table" aria-label="Upcoming expirations table">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                          <tr>
                            <th scope="col" className="p-3 text-left">Certificate Type</th>
                            <th scope="col" className="p-3 text-left">Property</th>
                            <th scope="col" className="p-3 text-left">Stream</th>
                            <th scope="col" className="p-3 text-left">Expiry Date</th>
                            <th scope="col" className="p-3 text-left">Days Left</th>
                            <th scope="col" className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {upcomingExpirations.map((cert) => (
                            <tr key={cert.id} className="hover:bg-muted/20">
                              <td className="p-3 font-medium">{cert.type}</td>
                              <td className="p-3 text-muted-foreground">{cert.property}</td>
                              <td className="p-3">
                                <Badge variant="outline">{cert.stream.replace(/_/g, ' ')}</Badge>
                              </td>
                              <td className="p-3">{cert.expiryDate}</td>
                              <td className="p-3">
                                <Badge variant={cert.daysUntil <= 7 ? 'destructive' : cert.daysUntil <= 30 ? 'secondary' : 'outline'}>
                                  {cert.daysUntil} days
                                </Badge>
                              </td>
                              <td className="p-3 text-right">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => navigate(`/certificates/${cert.id}?from=/compliance`)}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                      <p>No certificates expiring in the next 90 days</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Priority Remedial Actions</CardTitle>
                    <CardDescription>
                      Actions ranked by severity - address these to improve compliance
                    </CardDescription>
                  </div>
                  <Link href="/actions?status=OPEN&from=/compliance">
                    <Button variant="outline" size="sm">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {priorityActions.length > 0 ? (
                    <div className="space-y-3">
                      {priorityActions.map((action) => (
                        <Link 
                          key={action.id} 
                          href={`/actions?from=/compliance`}
                          className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                          data-testid={`priority-action-${action.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={action.severity === 'IMMEDIATE' ? 'destructive' : action.severity === 'URGENT' ? 'secondary' : 'outline'}
                              >
                                {action.severity}
                              </Badge>
                              <span className="font-medium">{action.code}</span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {action.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {action.propertyAddress && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {action.propertyAddress}
                                </span>
                              )}
                              {action.schemeName && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {action.schemeName}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
                      <p>No open remedial actions - great work!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </main>
      </div>
    </div>
  );
}
