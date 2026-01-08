import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HeroStatsGrid, HeroStatsGridSkeleton } from "@/components/dashboard/HeroStats";
import { Skeleton, ListItemSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  AlertOctagon, 
  AlertTriangle, 
  Wrench, 
  CheckCircle2, 
  Search,
  Filter,
  ArrowRight,
  Clock,
  Calendar,
  User,
  Building2,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Zap
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { actionsApi } from "@/lib/api";
import type { EnrichedRemedialAction } from "@/lib/api";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
  SheetFooter
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContextBackButton } from "@/components/navigation/ContextBackButton";

type FilterType = 'all' | 'open' | 'emergency' | 'in_progress' | 'resolved' | 'immediate' | 'urgent' | 'overdue';

function getInitialFilterFromUrl(): FilterType {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const severity = params.get('severity');
  const awaabs = params.get('awaabs');
  
  if (awaabs === 'true') return 'overdue';
  if (severity === 'IMMEDIATE') return 'immediate';
  if (severity === 'URGENT') return 'urgent';
  if (status === 'OPEN') return 'open';
  if (status === 'IN_PROGRESS') return 'in_progress';
  if (status === 'COMPLETED') return 'resolved';
  
  return 'all';
}

function getInitialTypeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('type');
}

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('status') || params.has('severity') || params.has('awaabs') || params.has('type') || params.has('from');
}

export default function ActionsPage() {
  useEffect(() => {
    document.title = "Remedial Actions - ComplianceAI";
  }, []);

  const searchString = useSearch();
  const [selectedAction, setSelectedAction] = useState<EnrichedRemedialAction | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  
  // React to URL parameter changes
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const status = params.get('status');
    const severity = params.get('severity');
    const awaabs = params.get('awaabs');
    const type = params.get('type');
    
    // Determine filter from URL params
    let newFilter: FilterType = 'all';
    if (awaabs === 'true') newFilter = 'overdue';
    else if (severity === 'IMMEDIATE') newFilter = 'immediate';
    else if (severity === 'URGENT') newFilter = 'urgent';
    else if (status === 'OPEN') newFilter = 'open';
    else if (status === 'IN_PROGRESS') newFilter = 'in_progress';
    else if (status === 'COMPLETED') newFilter = 'resolved';
    
    setActiveFilter(newFilter);
    setTypeFilter(type);
    setPage(1);
  }, [searchString]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const ITEMS_PER_PAGE = 50;
  
  const isOverdueFilter = activeFilter === 'overdue';
  
  const apiStatus = activeFilter === 'open' || activeFilter === 'emergency' || activeFilter === 'immediate' || activeFilter === 'urgent' || activeFilter === 'overdue'
    ? 'OPEN' 
    : activeFilter === 'in_progress' 
    ? 'IN_PROGRESS' 
    : activeFilter === 'resolved' 
    ? 'COMPLETED' 
    : undefined;
  
  const apiSeverity = activeFilter === 'immediate' || activeFilter === 'emergency' 
    ? 'IMMEDIATE' 
    : activeFilter === 'urgent' 
    ? 'URGENT' 
    : undefined;
  
  // Separate stats query - uses dedicated lightweight endpoint
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["actions-stats"],
    queryFn: async () => {
      const response = await fetch('/api/actions/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 60000, // Keep stats stable for 1 minute
    refetchOnWindowFocus: false,
  });
  
  const { data: paginatedData, isLoading: isLoadingActions, isFetching } = useQuery({
    queryKey: ["actions", page, apiStatus, apiSeverity, debouncedSearch, isOverdueFilter],
    queryFn: () => actionsApi.list({ 
      page, 
      limit: ITEMS_PER_PAGE,
      status: apiStatus,
      severity: apiSeverity,
      search: debouncedSearch || undefined,
      overdue: isOverdueFilter || undefined
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
    staleTime: 30000, // Keep data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });
  
  const remedialActions = paginatedData?.data || [];
  const totalPages = paginatedData?.totalPages || 1;
  const totalItems = paginatedData?.total || 0;
  
  // Use separate stats query for stable hero stats (won't change on pagination)
  const apiStats = statsData || null;
  
  // Use API stats for accurate counts, fallback to current-page calculation
  const totalOpen = apiStats?.totalOpen ?? totalItems;
  const emergencyCount = apiStats?.immediate ?? (apiSeverity === 'IMMEDIATE' ? totalItems : 0);
  const inProgressCount = apiStats?.inProgress ?? (apiStatus === 'IN_PROGRESS' ? totalItems : 0);
  const resolvedCount = apiStats?.completed ?? (apiStatus === 'COMPLETED' ? totalItems : 0);
  const overdueCount = apiStats?.overdue ?? remedialActions.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status === 'OPEN').length;
  
  const filteredActions = typeFilter 
    ? remedialActions.filter(action => action.certificate?.certificateType === typeFilter)
    : remedialActions;
  
  const updateAction = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EnrichedRemedialAction> }) => 
      actionsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      const isComplete = variables.data.status === 'COMPLETED';
      toast({
        title: isComplete ? "Action Resolved" : "Status Updated",
        description: isComplete ? "Remedial action marked as complete" : "Action status has been changed",
      });
      if (isComplete) {
        setSelectedAction(null);
      }
    },
  });

  const handleUpdateStatus = (newStatus: string) => {
    if (selectedAction) {
      updateAction.mutate({ 
        id: selectedAction.id, 
        data: { status: newStatus as any } 
      });
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Remedial Actions" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Remedial actions content">
          
          {showBackButton && (
            <ContextBackButton fallbackPath="/dashboard" fallbackLabel="Dashboard" />
          )}
          
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search actions..." 
                  className="pl-9" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-actions"
                />
              </div>
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterType)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-status">
                  <Filter className="h-4 w-4 mr-2 sm:hidden" />
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="emergency">Emergency Only</SelectItem>
                  <SelectItem value="immediate">Immediate Severity</SelectItem>
                  <SelectItem value="urgent">Urgent Severity</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {typeFilter && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setTypeFilter(null)}
                    aria-label={`Remove type filter: ${typeFilter.replace(/_/g, ' ')}`}
                    data-testid="chip-type-filter"
                  >
                    Type: {typeFilter.replace(/_/g, ' ')}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Button>
                )}
                {activeFilter !== 'all' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setActiveFilter('all')}
                    aria-label="Clear status filter"
                    data-testid="button-clear-filter"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
              <Button size="sm" className="sm:size-default" onClick={() => toast({ title: "Export Started", description: "Downloading CSV..." })} data-testid="button-export">
                Export List
              </Button>
            </div>
          </div>

          {isLoadingStats ? (
            <HeroStatsGridSkeleton count={4} />
          ) : (
            <HeroStatsGrid
              stats={[
                {
                  title: "Overdue Actions",
                  value: overdueCount,
                  subtitle: "past due date",
                  icon: Clock,
                  riskLevel: overdueCount > 0 ? "critical" : "good",
                  onClick: () => setActiveFilter('overdue'),
                  slaInfo: "Requires immediate attention",
                  testId: "hero-overdue-actions",
                },
                {
                  title: "Immediate/Emergency",
                  value: emergencyCount,
                  subtitle: "24hr SLA",
                  icon: AlertOctagon,
                  riskLevel: emergencyCount > 0 ? "critical" : "good",
                  onClick: () => setActiveFilter('immediate'),
                  slaInfo: "Must respond within 24 hours",
                  testId: "hero-emergency",
                },
                {
                  title: "In Progress",
                  value: inProgressCount,
                  subtitle: "being worked on",
                  icon: Wrench,
                  riskLevel: inProgressCount > 10 ? "medium" : "low",
                  onClick: () => setActiveFilter('in_progress'),
                  testId: "hero-in-progress",
                },
                {
                  title: "Total Open",
                  value: totalOpen,
                  subtitle: "awaiting resolution",
                  icon: AlertTriangle,
                  riskLevel: totalOpen > 20 ? "medium" : "low",
                  onClick: () => setActiveFilter('open'),
                  testId: "hero-total-open",
                },
              ]}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Action Required</span>
                <Badge variant="secondary">{totalItems} result{totalItems !== 1 ? 's' : ''}</Badge>
              </CardTitle>
              <CardDescription>Remedial works identified from recent inspections</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActions && !paginatedData ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              ) : filteredActions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No actions found</p>
                  <p className="text-sm">Try adjusting your filters or search query</p>
                  {activeFilter !== 'all' && (
                    <Button variant="outline" className="mt-4" onClick={() => setActiveFilter('all')}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
              <div className="space-y-4">
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      Showing {((page - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(page * ITEMS_PER_PAGE, totalItems)} of {totalItems}
                      {isFetching && <Loader2 className="h-4 w-4 animate-spin inline ml-2" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        data-testid="pagination-top-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        data-testid="pagination-top-next"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {filteredActions.map((action) => (
                  <div 
                    key={action.id} 
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors gap-4 cursor-pointer focus-within:ring-2 focus-within:ring-primary" 
                    onClick={() => setSelectedAction(action)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedAction(action)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View action ${action.code || action.id}: ${action.description}`}
                    data-testid={`action-row-${action.id}`}
                  >
                    <div className="flex gap-4">
                      <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                        action.severity === 'IMMEDIATE' ? 'bg-rose-600 animate-pulse' : 
                        action.severity === 'URGENT' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} aria-hidden="true" />
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{action.propertyAddress || action.property?.addressLine1 || 'Unknown Property'}</span>
                          <span className="text-xs text-muted-foreground">#{action.id.slice(0, 8)}</span>
                        </div>
                        {(action.schemeName || action.blockName) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            {action.schemeName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                {action.schemeName}
                              </span>
                            )}
                            {action.blockName && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" aria-hidden="true" />
                                {action.blockName}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-medium">{action.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">{action.code || 'N/A'}</span> • {action.location || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right mr-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Due</div>
                        <div className={`text-sm font-bold`}>{action.dueDate || 'TBD'}</div>
                      </div>
                      <Badge variant={
                        action.status === 'OPEN' ? 'destructive' :
                        action.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                      }>
                        {action.status}
                      </Badge>
                      <Button variant="ghost" size="sm">Manage</Button>
                    </div>
                  </div>
                ))}
                
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      Showing {((page - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(page * ITEMS_PER_PAGE, totalItems)} of {totalItems}
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
                        <span className="hidden sm:inline">Previous</span>
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        data-testid="pagination-next"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>

          <Sheet open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
            <SheetContent className="sm:max-w-xl flex flex-col h-full">
              {selectedAction && (
                <>
                  <SheetHeader className="pb-6 border-b">
                    <div className="flex items-center gap-3 mb-2">
                       <Badge variant={selectedAction.severity === 'IMMEDIATE' ? 'destructive' : 'default'} className="uppercase">
                          {selectedAction.severity} Priority
                       </Badge>
                       <span className="text-sm text-muted-foreground">#{selectedAction.id}</span>
                    </div>
                    <SheetTitle className="text-xl">{selectedAction.description}</SheetTitle>
                    <SheetDescription className="text-base flex items-center gap-2">
                       <AlertOctagon className="h-4 w-4" />
                       {selectedAction.property?.addressLine1 || 'Unknown Property'}
                    </SheetDescription>
                  </SheetHeader>
                  
                  <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-8 py-6">
                      
                      {/* Workflow Status */}
                      <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                         <Label className="text-muted-foreground uppercase text-xs font-bold tracking-wider">Current Status</Label>
                         <div className="flex items-center gap-4">
                            <Select defaultValue={selectedAction.status.toLowerCase().replace(' ', '_')} onValueChange={handleUpdateStatus}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="no_access">No Access</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                               <Label className="text-muted-foreground text-xs">Code</Label>
                               <div className="flex items-center gap-2 font-medium">
                                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                  {selectedAction.code || 'N/A'}
                               </div>
                            </div>
                            <div className="space-y-1">
                               <Label className="text-muted-foreground text-xs">Due Date</Label>
                               <div className="flex items-center gap-2 font-medium">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {selectedAction.dueDate || 'TBD'}
                               </div>
                            </div>
                            <div className="space-y-1">
                               <Label className="text-muted-foreground text-xs">Location</Label>
                               <div className="flex items-center gap-2 font-medium">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  {selectedAction.location || 'N/A'}
                               </div>
                            </div>
                            <div className="space-y-1">
                               <Label className="text-muted-foreground text-xs">Estimated Cost</Label>
                               <div className="font-medium text-emerald-600">
                                  {selectedAction.costEstimate || 'TBD'}
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-2">
                         <Label className="text-base font-semibold">Description of Defect</Label>
                         <div className="p-4 bg-white border rounded-md text-sm leading-relaxed">
                            {selectedAction.description}
                         </div>
                      </div>

                      <div className="space-y-2">
                         <Label className="text-base font-semibold">Updates & Notes</Label>
                         <div className="border rounded-md divide-y">
                            <div className="p-3 text-sm bg-muted/10">
                               <div className="flex justify-between mb-1">
                                  <span className="font-semibold">System</span>
                                  <span className="text-xs text-muted-foreground">Today, 09:41</span>
                               </div>
                               <p>Ticket created automatically from EICR ingestion.</p>
                            </div>
                            <div className="p-3">
                               <Textarea placeholder="Add a note or update..." className="min-h-[80px] resize-none border-0 focus-visible:ring-0 p-0" />
                               <div className="flex justify-end mt-2">
                                  <Button size="sm" variant="ghost">Add Note</Button>
                               </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </ScrollArea>

                  <SheetFooter className="border-t pt-4">
                     <div className="flex gap-2 w-full">
                        <Button className="flex-1" variant="outline" onClick={() => setSelectedAction(null)}>Close</Button>
                        <Button 
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleUpdateStatus('COMPLETED')}
                          disabled={updateAction.isPending || selectedAction.status === 'COMPLETED'}
                          data-testid="button-mark-complete"
                        >
                          {updateAction.isPending ? 'Saving...' : selectedAction.status === 'COMPLETED' ? 'Already Resolved' : 'Mark Complete'}
                        </Button>
                     </div>
                  </SheetFooter>
                </>
              )}
            </SheetContent>
          </Sheet>

        </main>
      </div>
    </div>
  );
}
