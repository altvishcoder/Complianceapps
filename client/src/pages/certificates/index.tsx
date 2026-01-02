import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
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
  Plus,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Link, useSearch } from "wouter";
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
import { ContextBackButton } from "@/components/navigation/ContextBackButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('status') || params.has('type') || params.has('filter') || params.has('stream') || params.has('from');
}

export default function CertificatesPage() {
  useEffect(() => {
    document.title = "Certificates - ComplianceAI";
  }, []);

  const searchString = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [multiStatusFilter, setMultiStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<string | null>(null);
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [expiringFilter, setExpiringFilter] = useState(false);
  const [selectedCert, setSelectedCert] = useState<EnrichedCertificate | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  
  // Fetch certificate types to map streams to certificate types
  const { data: certificateTypes = [] } = useQuery<Array<{ code: string; complianceStream: string; shortName?: string }>>({
    queryKey: ["certificate-types"],
    queryFn: async () => {
      const res = await fetch('/api/config/certificate-types');
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  // Fetch compliance streams for the dropdown
  const { data: complianceStreams = [] } = useQuery<Array<{ code: string; name: string; colorCode: string }>>({
    queryKey: ["compliance-streams"],
    queryFn: async () => {
      const res = await fetch('/api/config/compliance-streams');
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  // Create a mapping from certificate type code to stream info
  const certTypeToStream = useMemo(() => {
    const map = new Map<string, { streamCode: string; streamName: string; colorCode: string }>();
    for (const ct of certificateTypes) {
      const stream = complianceStreams.find(s => s.code === ct.complianceStream);
      if (stream) {
        map.set(ct.code, {
          streamCode: stream.code,
          streamName: stream.name,
          colorCode: stream.colorCode
        });
      }
    }
    return map;
  }, [certificateTypes, complianceStreams]);
  
  // Create a Set of certificate type codes that belong to the selected stream
  const streamCertTypes = useMemo(() => {
    if (!streamFilter) return null;
    return new Set(
      certificateTypes
        .filter(ct => ct.complianceStream === streamFilter)
        .map(ct => ct.code)
    );
  }, [streamFilter, certificateTypes]);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    
    // Reset all URL-driven filters first, then apply based on current params
    const filterParam = params.get("filter");
    if (filterParam === "overdue" || filterParam === "expired") {
      setOverdueFilter(true);
      setExpiringFilter(false);
    } else if (filterParam === "expiring") {
      setExpiringFilter(true);
      setOverdueFilter(false);
    } else {
      // No filter param - reset both
      setOverdueFilter(false);
      setExpiringFilter(false);
    }
    
    // Handle multiple status params (e.g., status=APPROVED&status=EXTRACTED)
    const statuses = params.getAll("status");
    if (statuses.length > 1) {
      setMultiStatusFilter(statuses);
      setStatusFilter(null);
    } else if (statuses.length === 1) {
      setStatusFilter(statuses[0]);
      setMultiStatusFilter([]);
    } else {
      // No status params - reset both
      setMultiStatusFilter([]);
      setStatusFilter(null);
    }
    
    // Reset and apply type filter
    if (params.get("type")) {
      setTypeFilter(params.get("type"));
    } else {
      setTypeFilter(null);
    }
    
    // Reset and apply stream filter
    if (params.get("stream")) {
      setStreamFilter(params.get("stream"));
    } else {
      setStreamFilter(null);
    }
  }, [searchString]);
  
  const ITEMS_PER_PAGE = 50;
  
  const { data: paginatedData, isLoading: isLoadingCerts, isFetching } = useQuery({
    queryKey: ["certificates", page, statusFilter, debouncedSearch],
    queryFn: () => certificatesApi.list({ 
      page, 
      limit: ITEMS_PER_PAGE, 
      status: statusFilter || undefined,
      search: debouncedSearch || undefined
    }),
  });
  
  const certificates = paginatedData?.data || [];
  const totalPages = paginatedData?.totalPages || 1;
  const totalItems = paginatedData?.total || 0;
  
  const isOverdue = (cert: EnrichedCertificate) => {
    if (!cert.expiryDate) return false;
    return new Date(cert.expiryDate) < new Date();
  };
  
  const isExpiringSoon = (cert: EnrichedCertificate) => {
    if (!cert.expiryDate) return false;
    const expiry = new Date(cert.expiryDate);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry > now && expiry <= thirtyDays;
  };
  
  const PENDING_STATUSES = ['UPLOADED', 'PROCESSING', 'NEEDS_REVIEW'];
  
  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch = searchTerm === '' || 
      cert.property?.addressLine1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.certificateType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.fileName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Handle multi-status filter (e.g., [APPROVED, EXTRACTED])
    const matchesMultiStatus = multiStatusFilter.length === 0 || multiStatusFilter.includes(cert.status);
    const matchesSingleStatus = !statusFilter || 
      (statusFilter === 'PENDING' ? PENDING_STATUSES.includes(cert.status) : cert.status === statusFilter);
    const matchesStatus = multiStatusFilter.length > 0 ? matchesMultiStatus : matchesSingleStatus;
    
    const matchesType = !typeFilter || cert.certificateType === typeFilter;
    const matchesStream = !streamCertTypes || streamCertTypes.has(cert.certificateType);
    const matchesOverdue = !overdueFilter || isOverdue(cert);
    const matchesExpiring = !expiringFilter || isExpiringSoon(cert);
    
    return matchesSearch && matchesStatus && matchesType && matchesStream && matchesOverdue && matchesExpiring;
  });
  
  const handleStatusClick = (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    if (statusFilter === status) {
      setStatusFilter(null);
    } else {
      setStatusFilter(status);
    }
  };
  
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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Certificates" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Certificates content">
          
          {showBackButton && (
            <ContextBackButton fallbackPath="/dashboard" fallbackLabel="Dashboard" />
          )}
          
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
              {overdueFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  onClick={() => setOverdueFilter(false)}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Expired Only
                  <X className="h-3 w-3" />
                </Button>
              )}
              {expiringFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  onClick={() => setExpiringFilter(false)}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Expiring Soon
                  <X className="h-3 w-3" />
                </Button>
              )}
              {multiStatusFilter.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => setMultiStatusFilter([])}
                >
                  <Filter className="h-3 w-3" />
                  {multiStatusFilter.join(' / ')}
                  <X className="h-3 w-3" />
                </Button>
              )}
              {statusFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setStatusFilter(null)}
                  aria-label={`Remove status filter: ${statusFilter.replace('_', ' ')}`}
                >
                  Status: {statusFilter.replace('_', ' ')}
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              )}
              {typeFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setTypeFilter(null)}
                  aria-label={`Remove type filter: ${typeFilter.replace(/_/g, ' ')}`}
                >
                  Type: {typeFilter.replace(/_/g, ' ')}
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              )}
              {streamFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => setStreamFilter(null)}
                  aria-label={`Remove stream filter: ${streamFilter.replace(/_/g, ' ')}`}
                >
                  Stream: {complianceStreams.find(s => s.code === streamFilter)?.name || streamFilter.replace(/_/g, ' ')}
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              )}
              <Select value={streamFilter || "all"} onValueChange={(val) => setStreamFilter(val === "all" ? null : val)}>
                <SelectTrigger className="w-[180px]" data-testid="filter-stream">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Streams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  {complianceStreams.map((stream) => (
                    <SelectItem key={stream.code} value={stream.code}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: stream.colorCode }}
                        />
                        {stream.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {isLoadingCerts ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading certificates...</p>
                </div>
              ) : filteredCertificates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No certificates found matching your criteria.
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-border border rounded-md">
                    {filteredCertificates.map((cert) => {
                      const streamInfo = certTypeToStream.get(cert.certificateType);
                      return (
                        <div 
                          key={cert.id} 
                          className="p-4 active:bg-muted/30"
                          onClick={() => setSelectedCert(cert)}
                          data-testid={`card-cert-${cert.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{cert.certificateType}</p>
                                  <p className="text-sm text-muted-foreground truncate">{cert.property?.addressLine1}</p>
                                </div>
                                <button
                                  onClick={(e) => handleStatusClick(e, cert.status)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${getStatusColor(cert.status)}`}
                                >
                                  {cert.status.replace('_', ' ')}
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-sm">
                                {streamInfo && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                                    style={{ 
                                      backgroundColor: `${streamInfo.colorCode}15`, 
                                      color: streamInfo.colorCode,
                                      borderColor: `${streamInfo.colorCode}40`
                                    }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: streamInfo.colorCode }} />
                                    {streamInfo.streamName}
                                  </span>
                                )}
                                <span className="text-muted-foreground text-xs">Exp: {formatDate(cert.expiryDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[900px]">
                      <thead className="bg-muted/50 text-muted-foreground font-medium">
                        <tr>
                          <th className="p-4">Certificate Type</th>
                          <th className="p-4">Stream</th>
                          <th className="p-4">Property</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Expiry Date</th>
                          <th className="p-4">Outcome</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredCertificates.map((cert) => {
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
                            <td className="p-4">
                              {(() => {
                                const streamInfo = certTypeToStream.get(cert.certificateType);
                                if (streamInfo) {
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStreamFilter(streamInfo.streamCode);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                                      style={{ 
                                        backgroundColor: `${streamInfo.colorCode}15`, 
                                        color: streamInfo.colorCode,
                                        borderColor: `${streamInfo.colorCode}40`
                                      }}
                                      data-testid={`stream-badge-${cert.id}`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: streamInfo.colorCode }} />
                                      {streamInfo.streamName}
                                    </button>
                                  );
                                }
                                return <span className="text-muted-foreground text-xs">-</span>;
                              })()}
                            </td>
                            <td className="p-4 font-medium">{cert.property?.addressLine1}</td>
                            <td className="p-4">
                              <button
                                onClick={(e) => handleStatusClick(e, cert.status)}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ${getStatusColor(cert.status)} ${statusFilter === cert.status ? 'ring-2 ring-primary' : ''}`}
                              >
                                {cert.status.replace('_', ' ')}
                              </button>
                            </td>
                            <td className="p-4 text-muted-foreground">{formatDate(cert.expiryDate)}</td>
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
                </>
              )}
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, totalItems)} of {totalItems} certificates
                    {isFetching && <Loader2 className="h-4 w-4 animate-spin inline ml-2" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="pagination-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      data-testid="pagination-next"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
                        <SheetDescription className="flex items-center gap-2">
                           <span>Certificate ID: {selectedCert.id}</span>
                           {(() => {
                             const streamInfo = certTypeToStream.get(selectedCert.certificateType);
                             if (streamInfo) {
                               return (
                                 <span
                                   className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                                   style={{ 
                                     backgroundColor: `${streamInfo.colorCode}15`, 
                                     color: streamInfo.colorCode,
                                     borderColor: `${streamInfo.colorCode}40`
                                   }}
                                 >
                                   <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: streamInfo.colorCode }} />
                                   {streamInfo.streamName}
                                 </span>
                               );
                             }
                             return null;
                           })()}
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
                               <div className="text-sm">{formatDate(selectedCert.issueDate)}</div>
                            </div>
                             <div>
                               <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Expiry Date</div>
                               <div className="text-sm font-semibold">{formatDate(selectedCert.expiryDate)}</div>
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
