import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  User
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

type FilterType = 'all' | 'open' | 'emergency' | 'in_progress' | 'resolved';

export default function ActionsPage() {
  const [selectedAction, setSelectedAction] = useState<EnrichedRemedialAction | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: remedialActions = [] } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list(),
  });
  
  // Calculate stats from real data
  const totalOpen = remedialActions.filter(a => a.status === 'OPEN').length;
  const emergencyCount = remedialActions.filter(a => a.severity === 'IMMEDIATE' && a.status === 'OPEN').length;
  const inProgressCount = remedialActions.filter(a => a.status === 'IN_PROGRESS').length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const resolvedCount = remedialActions.filter(a => {
    if (a.status !== 'COMPLETED') return false;
    if (!a.resolvedAt) return false;
    return new Date(a.resolvedAt) >= thirtyDaysAgo;
  }).length;
  
  // Filter actions based on active filter and search
  const filteredActions = remedialActions.filter(action => {
    // Apply filter
    let passesFilter = true;
    switch (activeFilter) {
      case 'open':
        passesFilter = action.status === 'OPEN';
        break;
      case 'emergency':
        passesFilter = action.severity === 'IMMEDIATE' && action.status === 'OPEN';
        break;
      case 'in_progress':
        passesFilter = action.status === 'IN_PROGRESS';
        break;
      case 'resolved':
        passesFilter = action.status === 'COMPLETED';
        break;
      default:
        passesFilter = true;
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        action.description?.toLowerCase().includes(query) ||
        action.location?.toLowerCase().includes(query) ||
        action.code?.toLowerCase().includes(query) ||
        action.property?.addressLine1?.toLowerCase().includes(query);
      return passesFilter && matchesSearch;
    }
    
    return passesFilter;
  });
  
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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Remedial Actions" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
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
                <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="emergency">Emergency Only</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {activeFilter !== 'all' && (
                <Button variant="outline" onClick={() => setActiveFilter('all')}>
                  Clear Filter
                </Button>
              )}
              <Button onClick={() => toast({ title: "Export Started", description: "Downloading CSV..." })}>
                Export List
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'open' ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'open' ? 'all' : 'open')}
              data-testid="card-total-open"
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Open</p>
                  <h3 className="text-2xl font-bold mt-1">{totalOpen}</h3>
                </div>
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'emergency' ? 'ring-2 ring-rose-500' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'emergency' ? 'all' : 'emergency')}
              data-testid="card-emergency"
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Emergency</p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-600">{emergencyCount}</h3>
                </div>
                <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                  <AlertOctagon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'in_progress' ? 'ring-2 ring-amber-500' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'in_progress' ? 'all' : 'in_progress')}
              data-testid="card-in-progress"
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <h3 className="text-2xl font-bold mt-1">{inProgressCount}</h3>
                </div>
                <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'resolved' ? 'ring-2 ring-emerald-500' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'resolved' ? 'all' : 'resolved')}
              data-testid="card-resolved"
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved (30d)</p>
                  <h3 className="text-2xl font-bold mt-1 text-emerald-600">{resolvedCount}</h3>
                </div>
                <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Action Required</span>
                <Badge variant="secondary">{filteredActions.length} result{filteredActions.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
              <CardDescription>Remedial works identified from recent inspections</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredActions.length === 0 ? (
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
                {filteredActions.map((action) => (
                  <div key={action.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors gap-4 cursor-pointer" onClick={() => setSelectedAction(action)}>
                    <div className="flex gap-4">
                      <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                        action.severity === 'IMMEDIATE' ? 'bg-rose-600 animate-pulse' : 
                        action.severity === 'URGENT' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{action.property?.addressLine1 || 'Unknown Property'}</span>
                          <span className="text-xs text-muted-foreground">#{action.id}</span>
                        </div>
                        <p className="text-sm font-medium">{action.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Code: {action.code || 'N/A'} • Location: {action.location || 'N/A'}</p>
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
