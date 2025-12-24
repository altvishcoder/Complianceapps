import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  MoreHorizontal,
  FileCheck,
  Plus
} from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { certificatesApi } from "@/lib/api";
import type { EnrichedCertificate } from "@/lib/api";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCert, setSelectedCert] = useState<EnrichedCertificate | null>(null);
  const { toast } = useToast();
  
  const { data: certificates = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
  });
  
  const selectedProp = selectedCert?.property;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "NEEDS_REVIEW": return "bg-amber-50 text-amber-700 border-amber-200";
      case "PROCESSING": return "bg-blue-50 text-blue-700 border-blue-200";
      case "REJECTED": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Download Started",
      description: "Certificate PDF is downloading...",
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Certificates" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 w-full max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by address, type or reference..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <Link href="/certificates/upload">
              <Button className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" /> Upload New
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Certificates</CardTitle>
              <CardDescription>Manage and view compliance documents across all properties.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4">Certificate Type</th>
                      <th className="p-4">Property</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Expiry Date</th>
                      <th className="p-4">Outcome</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {certificates.map((cert) => {
                      return (
                      <tr key={cert.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCert(cert)}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{cert.certificateType}</div>
                              <div className="text-xs text-muted-foreground">{cert.fileName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium">{cert.property?.addressLine1}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(cert.status)}`}>
                            {cert.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{cert.expiryDate}</td>
                        <td className="p-4">
                          <Badge variant="outline">{cert.outcome}</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/certificates/${cert.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`view-cert-${cert.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleDownload}>
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileCheck className="mr-2 h-4 w-4" /> Verify Again
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  Archive Document
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Sheet open={!!selectedCert} onOpenChange={(open) => !open && setSelectedCert(null)}>
            <SheetContent className="sm:max-w-xl h-full flex flex-col p-0">
               {selectedCert && (
                 <>
                   <div className="p-6 border-b bg-muted/10">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                           <FileText className="h-5 w-5 text-blue-600" />
                           {selectedCert.certificateType}
                        </SheetTitle>
                        <SheetDescription>
                           Certificate ID: {selectedCert.id}
                        </SheetDescription>
                      </SheetHeader>
                   </div>
                   
                   <ScrollArea className="flex-1 p-6">
                      <div className="space-y-6">
                         
                         <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg border">
                            <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                               <Badge className={selectedCert.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-amber-500'}>
                                  {selectedCert.status.replace('_', ' ')}
                               </Badge>
                            </div>
                            <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Outcome</div>
                               <div className="font-bold">{selectedCert.outcome}</div>
                            </div>
                            <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Issue Date</div>
                               <div className="text-sm">{selectedCert.issueDate}</div>
                            </div>
                             <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Expiry Date</div>
                               <div className="text-sm font-semibold">{selectedCert.expiryDate}</div>
                            </div>
                         </div>

                         <div className="space-y-2">
                            <h3 className="font-semibold text-sm">Property Details</h3>
                            <div className="p-3 border rounded-md">
                               <div className="font-medium">{selectedProp?.addressLine1}</div>
                               <div className="text-xs text-muted-foreground mt-1">UPRN: {selectedProp?.uprn}</div>
                            </div>
                         </div>

                         <Separator />
                         
                         {/* Dynamic Extraction Data Display based on certificate type */}
                         {selectedCert.extractedData && (
                            <div className="space-y-4">
                               <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <FileCheck className="h-4 w-4 text-blue-600" />
                                  Extracted Data
                               </h3>
                               
                               {selectedCert.certificateType === 'GAS_SAFETY' && selectedCert.extractedData.appliances && (
                                  <div className="space-y-2">
                                     <div className="text-xs font-medium text-muted-foreground uppercase">Appliances</div>
                                     <div className="rounded-md border overflow-hidden">
                                        <table className="w-full text-xs text-left bg-background">
                                           <thead className="bg-muted text-muted-foreground">
                                              <tr>
                                                 <th className="p-2">Location</th>
                                                 <th className="p-2">Type</th>
                                                 <th className="p-2">Status</th>
                                              </tr>
                                           </thead>
                                           <tbody>
                                              {selectedCert.extractedData.appliances.map((app: any, idx: number) => (
                                                 <tr key={idx} className="border-t">
                                                    <td className="p-2">{app.location}</td>
                                                    <td className="p-2">{app.type} ({app.make})</td>
                                                    <td className="p-2">
                                                       {app.applianceSafe ? 
                                                          <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Safe</Badge> : 
                                                          <Badge variant="destructive">Unsafe</Badge>
                                                       }
                                                    </td>
                                                 </tr>
                                              ))}
                                           </tbody>
                                        </table>
                                     </div>
                                  </div>
                               )}

                               {selectedCert.certificateType === 'EICR' && selectedCert.extractedData.observations && (
                                  <div className="space-y-2">
                                     <div className="text-xs font-medium text-muted-foreground uppercase">Observations</div>
                                     <div className="space-y-2">
                                        {selectedCert.extractedData.observations.map((obs: any, idx: number) => (
                                           <div key={idx} className="p-2 border rounded-md bg-background text-xs flex gap-2 items-start">
                                              <Badge variant={['C1', 'C2'].includes(obs.code) ? 'destructive' : 'secondary'} className="shrink-0">
                                                 {obs.code}
                                              </Badge>
                                              <div>
                                                 <div className="font-medium">{obs.location}</div>
                                                 <div className="text-muted-foreground">{obs.description}</div>
                                              </div>
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               )}
                               
                               {selectedCert.extractedData.engineer && (
                                   <div className="p-3 border rounded-md bg-muted/20 text-xs">
                                      <div className="grid grid-cols-2 gap-2">
                                         <div>
                                            <span className="text-muted-foreground">Engineer:</span>
                                            <div className="font-medium">{selectedCert.extractedData.engineer.name}</div>
                                         </div>
                                          <div>
                                            <span className="text-muted-foreground">ID Number:</span>
                                            <div className="font-medium">{selectedCert.extractedData.engineer.gasSafeNumber || selectedCert.extractedData.engineer.registrationNumber}</div>
                                         </div>
                                      </div>
                                   </div>
                               )}
                            </div>
                         )}

                         <Separator />

                         {/* Summary of Issues/Actions */}
                         {selectedCert.extractedData && (
                           <div className="space-y-3">
                             <h3 className="font-semibold text-sm">Issues Summary</h3>
                             
                             {/* EICR Code Counts */}
                             {(selectedCert.extractedData.c1Count > 0 || selectedCert.extractedData.c2Count > 0 || selectedCert.extractedData.c3Count > 0) && (
                               <div className="grid grid-cols-3 gap-2">
                                 {selectedCert.extractedData.c1Count > 0 && (
                                   <div className="p-3 bg-red-50 border border-red-200 rounded-md text-center">
                                     <div className="text-2xl font-bold text-red-600">{selectedCert.extractedData.c1Count}</div>
                                     <div className="text-xs text-red-700 font-medium">C1 - Danger</div>
                                   </div>
                                 )}
                                 {selectedCert.extractedData.c2Count > 0 && (
                                   <div className="p-3 bg-orange-50 border border-orange-200 rounded-md text-center">
                                     <div className="text-2xl font-bold text-orange-600">{selectedCert.extractedData.c2Count}</div>
                                     <div className="text-xs text-orange-700 font-medium">C2 - Urgent</div>
                                   </div>
                                 )}
                                 {selectedCert.extractedData.c3Count > 0 && (
                                   <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-center">
                                     <div className="text-2xl font-bold text-yellow-600">{selectedCert.extractedData.c3Count}</div>
                                     <div className="text-xs text-yellow-700 font-medium">C3 - Improve</div>
                                   </div>
                                 )}
                               </div>
                             )}

                             {/* Gas Safety Defects */}
                             {selectedCert.extractedData.defects && selectedCert.extractedData.defects.length > 0 && (
                               <div className="space-y-2">
                                 <div className="text-xs font-medium text-muted-foreground uppercase">Defects Found</div>
                                 {selectedCert.extractedData.defects.map((defect: any, idx: number) => (
                                   <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-md">
                                     <div className="flex items-start gap-2">
                                       <Badge variant="destructive" className="shrink-0">{defect.classification || 'Defect'}</Badge>
                                       <div className="text-sm">
                                         <div className="font-medium text-red-900">{defect.description}</div>
                                         <div className="text-xs text-red-700 mt-1">Location: {defect.location}</div>
                                       </div>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}

                             {/* No Issues Found */}
                             {selectedCert.outcome === 'SATISFACTORY' && (
                               <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-center">
                                 <div className="text-emerald-600 font-semibold">No Issues Found</div>
                                 <div className="text-xs text-emerald-700 mt-1">Certificate passed all checks</div>
                               </div>
                             )}
                           </div>
                         )}

                      </div>
                   </ScrollArea>

                   <div className="p-4 border-t bg-muted/10">
                      <Button className="w-full gap-2" onClick={handleDownload}>
                         <Download className="h-4 w-4" /> Download Original PDF
                      </Button>
                   </div>
                 </>
               )}
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  );
}
