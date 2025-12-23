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
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  FileCheck
} from "lucide-react";
import { Link } from "wouter";
import { certificates, Certificate } from "@/lib/mock-data";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Valid": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Expiring Soon": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Overdue": return "bg-rose-50 text-rose-700 border-rose-200";
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
            <Link href="/ingestion">
              <Button className="bg-primary hover:bg-primary/90">
                Upload New
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
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCert(cert)}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{cert.type}</div>
                              <div className="text-xs text-muted-foreground">{cert.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium">{cert.property}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(cert.status)}`}>
                            {cert.status}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{cert.expiry}</td>
                        <td className="p-4">
                          <Badge variant="outline">{cert.outcome}</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCert(cert)}>
                              <Eye className="h-4 w-4" />
                            </Button>
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
                    ))}
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
                           {selectedCert.type}
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
                               <Badge className={selectedCert.status === 'Valid' ? 'bg-emerald-500' : 'bg-rose-500'}>
                                  {selectedCert.status}
                               </Badge>
                            </div>
                            <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Outcome</div>
                               <div className="font-bold">{selectedCert.outcome}</div>
                            </div>
                            <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Issue Date</div>
                               <div className="text-sm">{selectedCert.date}</div>
                            </div>
                             <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Expiry Date</div>
                               <div className="text-sm font-semibold">{selectedCert.expiry}</div>
                            </div>
                         </div>

                         <div className="space-y-2">
                            <h3 className="font-semibold text-sm">Property Details</h3>
                            <div className="p-3 border rounded-md">
                               <div className="font-medium">{selectedCert.property}</div>
                               <div className="text-xs text-muted-foreground mt-1">UPRN: {selectedCert.propId}</div>
                            </div>
                         </div>

                         <div className="space-y-2">
                            <h3 className="font-semibold text-sm">Engineer / Contractor</h3>
                            <div className="p-3 border rounded-md">
                               <div className="font-medium">{selectedCert.engineer || "N/A"}</div>
                               <div className="text-xs text-muted-foreground mt-1">Verified via Gas Safe Register</div>
                            </div>
                         </div>

                         <Separator />

                         <div className="space-y-2">
                            <h3 className="font-semibold text-sm">Preview</h3>
                            <div className="aspect-[3/4] bg-slate-100 rounded-md border flex items-center justify-center text-muted-foreground relative group overflow-hidden">
                               <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center">
                                  <Button variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity bg-white">
                                     <Eye className="mr-2 h-4 w-4" /> View Full PDF
                                  </Button>
                               </div>
                               <FileText className="h-12 w-12 opacity-20" />
                               <span className="sr-only">Document Preview</span>
                            </div>
                         </div>

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
