import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  ArrowLeft, 
  Download, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  Wrench
} from "lucide-react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { certificatesApi, actionsApi } from "@/lib/api";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Skeleton } from "@/components/ui/skeleton";

export default function CertificateDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: certificate, isLoading } = useQuery({
    queryKey: ["certificates", id],
    queryFn: () => certificatesApi.get(id!),
    enabled: !!id,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["actions", { certificateId: id }],
    queryFn: () => actionsApi.list({ certificateId: id }),
    enabled: !!id,
  });

  const getOutcomeColor = (outcome?: string) => {
    if (outcome === "SATISFACTORY" || outcome === "PASS") {
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-emerald-50 text-emerald-700";
      case "EXTRACTED": return "bg-blue-50 text-blue-700";
      case "NEEDS_REVIEW": return "bg-amber-50 text-amber-700";
      case "PROCESSING": return "bg-purple-50 text-purple-700";
      case "REJECTED": return "bg-rose-50 text-rose-700";
      default: return "bg-slate-50 text-slate-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Certificate Details" />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="flex h-screen bg-muted/30">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Certificate Not Found" />
          <main className="flex-1 overflow-y-auto p-6">
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold">Certificate Not Found</h2>
                <p className="text-muted-foreground mt-2">The requested certificate could not be found.</p>
                <Link href="/certificates">
                  <Button className="mt-4">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Certificates
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const extractedData = certificate.extractedData || {};
  const defects = extractedData.defects || [];
  const observations = extractedData.observations || [];

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Certificate Details" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/certificates">
                <Button variant="ghost" size="icon" data-testid="back-button">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  {certificate.certificateType.replace(/_/g, ' ')}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {certificate.property?.addressLine1}, {certificate.property?.postcode}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" data-testid="download-button">
                <Download className="h-4 w-4 mr-2" /> Download Original
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {certificate.outcome === "SATISFACTORY" || certificate.outcome === "PASS" ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Outcome</div>
                    <div className={`font-bold text-lg ${certificate.outcome === "SATISFACTORY" ? "text-emerald-600" : "text-red-600"}`}>
                      {certificate.outcome || "Pending"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Issue Date</div>
                    <div className="font-bold text-lg">{certificate.issueDate || "N/A"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-amber-500" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Expiry Date</div>
                    <div className="font-bold text-lg">{certificate.expiryDate || "N/A"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Open Actions</div>
                    <div className="font-bold text-lg">{actions.filter(a => a.status !== 'COMPLETED').length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <DocumentViewer
            storageKey={certificate.storageKey}
            fileName={certificate.fileName}
            defects={defects}
            observations={observations}
          />

          {actions.length > 0 && (
            <>
              <Separator />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Remedial Actions ({actions.length})
                  </CardTitle>
                  <CardDescription>
                    Actions required based on certificate findings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {actions.map((action) => (
                      <div 
                        key={action.id} 
                        className="p-4 border rounded-lg flex items-start justify-between gap-4"
                        data-testid={`action-${action.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={action.severity === 'IMMEDIATE' ? 'destructive' : 'secondary'}
                              className={
                                action.severity === 'IMMEDIATE' ? 'bg-red-500' :
                                action.severity === 'URGENT' ? 'bg-orange-500 text-white' :
                                action.severity === 'PRIORITY' ? 'bg-yellow-500 text-black' :
                                'bg-blue-500 text-white'
                              }
                            >
                              {action.severity}
                            </Badge>
                            {action.code && (
                              <Badge variant="outline">{action.code}</Badge>
                            )}
                            <Badge 
                              variant="outline"
                              className={
                                action.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                action.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }
                            >
                              {action.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="font-medium">{action.description}</p>
                          {action.location && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {action.location}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {action.dueDate && (
                            <div>Due: {action.dueDate}</div>
                          )}
                          {action.costEstimate && (
                            <div className="font-medium">{action.costEstimate}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {extractedData.engineer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Engineer/Inspector Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Name</div>
                    <div className="font-medium">{extractedData.engineer.name || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Registration</div>
                    <div className="font-medium">
                      {extractedData.engineer.gasSafeNumber || extractedData.engineer.registrationNumber || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signature</div>
                    <div className="font-medium">
                      {extractedData.engineer.signaturePresent ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Present
                        </span>
                      ) : (
                        <span className="text-amber-600">Not verified</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </main>
      </div>
    </div>
  );
}
