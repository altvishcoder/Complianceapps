import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, AlertTriangle, CheckCircle2, Home, Building2, Calendar, UploadCloud, ChevronLeft, Wrench, Loader2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi } from "@/lib/api";
import { Breadcrumb, useBreadcrumbContext } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";

function truncateAddress(address: string, maxLength: number = 60): string {
  if (!address) return "Property";
  if (address.length <= maxLength) return address;
  const truncated = address.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

function PropertyDetailSkeleton() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Property Details" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 h-fit">
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="contents">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
                <Separator />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </CardContent>
            </Card>
            <div className="md:col-span-2">
              <Skeleton className="h-10 w-full rounded-md mb-4" />
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1,2,3].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PropertyDetail() {
  const [match, params] = useRoute("/properties/:id");
  const { buildContextUrl } = useBreadcrumbContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: property, isLoading } = useQuery({
    queryKey: ["property", params?.id],
    queryFn: () => propertiesApi.get(params?.id!),
    enabled: !!params?.id,
  });
  
  const verifyMutation = useMutation({
    mutationFn: () => propertiesApi.verify(params?.id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({ title: "Property Verified", description: "Property has been verified and approved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to verify property.", variant: "destructive" });
    }
  });

  if (isLoading || !property) return <PropertyDetailSkeleton />;
  
  const certificates = property.certificates || [];
  const actions = property.actions || [];
  const components = property.components || [];
  const block = property.block;
  const scheme = property.scheme;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLIANT": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Compliant</Badge>;
      case "NON_COMPLIANT": return <Badge variant="destructive">Non-Compliant</Badge>;
      case "OVERDUE": return <Badge variant="destructive">Overdue</Badge>;
      case "EXPIRING_SOON": return <Badge className="bg-amber-500 hover:bg-amber-600">Expiring Soon</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Property Details" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="mb-4">
            <Breadcrumb 
              items={[
                { label: "Properties", href: "/properties" },
                { label: truncateAddress(property.addressLine1, 50) }
              ]}
            />
          </div>
          
          <div className="flex items-center gap-4">
             <div>
               <h1 className="text-2xl font-bold tracking-tight">{truncateAddress(property.addressLine1, 80)}</h1>
               <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span>{property.city}, {property.postcode}</span>
                  <span>•</span>
                  <span>UPRN: {property.uprn}</span>
               </div>
             </div>
             <div className="ml-auto flex items-center gap-2">
                {getStatusBadge(property.complianceStatus)}
                {property.needsVerification && (
                  <Button 
                    variant="default" 
                    className="gap-2"
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending}
                    data-testid="button-verify-property"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Verify Property
                  </Button>
                )}
                <Link href={buildContextUrl("/certificates/upload")}>
                   <Button variant="outline" className="gap-2">
                      <UploadCloud className="h-4 w-4" /> Upload Certificate
                   </Button>
                </Link>
             </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
             <Card className="md:col-span-1 h-fit">
                <CardHeader>
                   <CardTitle>Asset Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium capitalize">{property.propertyType.toLowerCase()}</span>
                      
                      <span className="text-muted-foreground">Tenure</span>
                      <span className="font-medium capitalize">{property.tenure.replace('_', ' ').toLowerCase()}</span>
                      
                      <span className="text-muted-foreground">Bedrooms</span>
                      <span className="font-medium">{property.bedrooms}</span>
                      
                      <span className="text-muted-foreground">Gas Supply</span>
                      <span className="font-medium">{property.hasGas ? "Yes" : "No"}</span>
                   </div>
                   <Separator />
                   <div className="space-y-2">
                      <div className="text-sm font-medium">Hierarchy</div>
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                         <Building2 className="h-4 w-4 text-blue-500" />
                         <div className="flex flex-col">
                            <span className="font-medium">{block?.name}</span>
                            <span className="text-xs text-muted-foreground">Block</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                         <Home className="h-4 w-4 text-indigo-500" />
                         <div className="flex flex-col">
                            <span className="font-medium">{scheme?.name}</span>
                            <span className="text-xs text-muted-foreground">Scheme</span>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <div className="md:col-span-2">
                <Tabs defaultValue="certificates" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="certificates">Certificates</TabsTrigger>
                    <TabsTrigger value="components">Components</TabsTrigger>
                    <TabsTrigger value="actions">Remedial Actions</TabsTrigger>
                    <TabsTrigger value="history">Audit History</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="certificates" className="mt-4">
                    <Card>
                       <CardHeader>
                          <CardTitle>Compliance Documents</CardTitle>
                          <CardDescription>All uploaded certificates for this property.</CardDescription>
                       </CardHeader>
                       <CardContent>
                          <div className="space-y-4">
                             {certificates.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No certificates found.</div>
                             ) : (
                                certificates.map(cert => (
                                   <div key={cert.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/10 transition-colors">
                                      <div className="flex items-center gap-4">
                                         <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                         </div>
                                         <div>
                                            <div className="font-medium">{cert.certificateType}</div>
                                            <div className="text-sm text-muted-foreground">Exp: {cert.expiryDate}</div>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                         <Badge variant={cert.outcome === 'SATISFACTORY' || cert.outcome === 'PASS' ? 'outline' : 'destructive'}>
                                            {cert.outcome}
                                         </Badge>
                                         <Link href={buildContextUrl(`/certificates/${cert.id}`)}>
                                           <Button size="sm" variant="ghost">View</Button>
                                         </Link>
                                      </div>
                                   </div>
                                ))
                             )}
                          </div>
                       </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="components" className="mt-4">
                    <Card>
                       <CardHeader>
                          <CardTitle>Asset Components</CardTitle>
                          <CardDescription>Equipment and assets linked to this property.</CardDescription>
                       </CardHeader>
                       <CardContent>
                          <div className="space-y-4">
                             {components.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No components found for this property.</div>
                             ) : (
                                components.map((comp: any) => (
                                   <div key={comp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/10 transition-colors">
                                      <div className="flex items-center gap-4">
                                         <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                                            <Wrench className="h-5 w-5" />
                                         </div>
                                         <div>
                                            <div className="font-medium">{comp.componentType?.name ?? "Unknown Component"}</div>
                                            <div className="text-sm text-muted-foreground">
                                              {comp.manufacturer && <span>{comp.manufacturer}</span>}
                                              {comp.model && <span> / {comp.model}</span>}
                                              {comp.location && <span> • {comp.location}</span>}
                                            </div>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                         {comp.needsVerification ? (
                                           <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>
                                         ) : (
                                           <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Verified</Badge>
                                         )}
                                         <Link href={buildContextUrl("/components")}>
                                           <Button size="sm" variant="ghost">View All</Button>
                                         </Link>
                                      </div>
                                   </div>
                                ))
                             )}
                          </div>
                       </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="actions" className="mt-4">
                    <Card>
                       <CardHeader>
                          <CardTitle>Remedial Actions</CardTitle>
                          <CardDescription>Outstanding tasks from inspections.</CardDescription>
                       </CardHeader>
                       <CardContent>
                          <div className="space-y-4">
                             {actions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No outstanding actions.</div>
                             ) : (
                                actions.map(action => (
                                   <div key={action.id} className="flex items-start gap-4 p-4 border rounded-lg">
                                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                                      <div className="flex-1">
                                         <div className="font-medium">{action.description}</div>
                                         <div className="text-sm text-muted-foreground mt-1">
                                            Due: {action.dueDate} • Est: {action.costEstimate}
                                         </div>
                                      </div>
                                      <Badge>{action.severity}</Badge>
                                   </div>
                                ))
                             )}
                          </div>
                       </CardContent>
                    </Card>
                  </TabsContent>
                   <TabsContent value="history" className="mt-4">
                    <Card>
                       <CardHeader>
                          <CardTitle>Audit Trail</CardTitle>
                       </CardHeader>
                       <CardContent>
                          <div className="space-y-8 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                             <div className="relative">
                                <div className="absolute -left-[29px] h-6 w-6 bg-background border-2 border-primary rounded-full flex items-center justify-center">
                                   <div className="h-2 w-2 bg-primary rounded-full" />
                                </div>
                                <div className="text-sm font-medium">Property Created</div>
                                <div className="text-xs text-muted-foreground">23 Dec 2024 • System Admin</div>
                             </div>
                             {certificates.map(cert => (
                                <div key={cert.id + 'log'} className="relative">
                                   <div className="absolute -left-[29px] h-6 w-6 bg-background border-2 border-muted-foreground rounded-full flex items-center justify-center">
                                      <div className="h-2 w-2 bg-muted-foreground rounded-full" />
                                   </div>
                                   <div className="text-sm font-medium">Certificate Uploaded: {cert.certificateType}</div>
                                   <div className="text-xs text-muted-foreground">{new Date(cert.createdAt).toLocaleDateString()} • System User</div>
                                </div>
                             ))}
                          </div>
                       </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
             </div>
          </div>

        </main>
      </div>
    </div>
  );
}
