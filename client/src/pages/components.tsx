import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/ui/table-pagination";
import { componentsApi, componentTypesApi, propertiesApi, type EnrichedComponent } from "@/lib/api";
import { Plus, Search, Wrench, Info, Loader2, Trash2, CheckCircle, XCircle, Eye, Pencil, Settings, AlertTriangle, Clock } from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { ComponentTypePicker } from "@/components/ComponentTypePicker";
import { useToast } from "@/hooks/use-toast";
import { Link, useSearch } from "wouter";
import type { InsertComponent } from "@shared/schema";
import { cn } from "@/lib/utils";

const CONDITION_COLORS: Record<string, string> = {
  GOOD: "bg-green-100 text-green-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export default function ComponentsPage() {
  const searchString = useSearch();
  const highlightId = new URLSearchParams(searchString).get("highlight");
  const highlightRef = useRef<HTMLTableRowElement>(null);
  
  useEffect(() => {
    document.title = "Components & Assets - ComplianceAI";
  }, []);

  // Track if we've scrolled to the highlighted component
  const [hasScrolled, setHasScrolled] = useState(false);
  const [lastHighlightId, setLastHighlightId] = useState<string | null>(null);
  const [wasLoading, setWasLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newComponent, setNewComponent] = useState<Partial<InsertComponent>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingComponent, setEditingComponent] = useState<EnrichedComponent | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InsertComponent>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Reset page and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [propertyFilter, typeFilter, debouncedSearch, pageSize]);
  
  // Handle page change with selection clearing
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
  };
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: componentsResponse, isLoading: componentsLoading, isFetching: componentsFetching } = useQuery({
    queryKey: ["components", propertyFilter, typeFilter, currentPage, pageSize, debouncedSearch],
    queryFn: () => componentsApi.list({
      propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
      componentTypeId: typeFilter !== "all" ? typeFilter : undefined,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
    }),
    placeholderData: keepPreviousData,
  });
  
  const components = componentsResponse?.data || [];
  const totalComponents = componentsResponse?.total || 0;
  const totalPages = componentsResponse?.totalPages || 1;
  const conditionSummary = componentsResponse?.conditionSummary || { CRITICAL: 0, POOR: 0, FAIR: 0, GOOD: 0, UNKNOWN: 0 };
  
  // Auto-adjust page if current page exceeds total pages (e.g., after deletion)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);
  
  const { data: componentTypes = [] } = useQuery({
    queryKey: ["component-types"],
    queryFn: componentTypesApi.list,
  });
  
  // Deduplicate component types by name (database may have duplicates)
  const uniqueComponentTypes = useMemo(() => {
    const seen = new Set<string>();
    return componentTypes.filter(type => {
      if (seen.has(type.name)) return false;
      seen.add(type.name);
      return true;
    });
  }, [componentTypes]);
  
  const { data: propertiesResponse } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list({ limit: 200 }),
  });
  const properties = propertiesResponse?.data ?? [];
  
  // Reset scroll state when highlightId changes
  useEffect(() => {
    if (highlightId !== lastHighlightId) {
      setHasScrolled(false);
      setLastHighlightId(highlightId);
    }
  }, [highlightId, lastHighlightId]);
  
  // Track loading transitions to reset scroll state on data refresh
  useEffect(() => {
    if (wasLoading && !componentsLoading) {
      setHasScrolled(false);
    }
    setWasLoading(componentsLoading);
  }, [componentsLoading, wasLoading]);
  
  const createMutation = useMutation({
    mutationFn: (data: InsertComponent) => componentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setShowAddDialog(false);
      setNewComponent({});
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: componentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertComponent> }) => {
      // Filter out empty strings to prevent validation errors
      const cleanData: Partial<InsertComponent> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== "" && value !== undefined) {
          (cleanData as any)[key] = value;
        }
      }
      return componentsApi.update(id, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setEditingComponent(null);
      setEditFormData({});
      toast({ title: "Component Updated", description: "Component details saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const openEditDialog = (comp: EnrichedComponent) => {
    setEditingComponent(comp);
    setEditFormData({
      manufacturer: comp.manufacturer || "",
      model: comp.model || "",
      location: comp.location || "",
      condition: comp.condition || "",
      assetTag: comp.assetTag || "",
      serialNumber: comp.serialNumber || "",
    });
  };
  
  const bulkApproveMutation = useMutation({
    mutationFn: componentsApi.bulkApprove,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setSelectedIds(new Set());
      toast({ title: "Components Approved", description: `${data.approved} components approved successfully.` });
    },
  });
  
  const bulkRejectMutation = useMutation({
    mutationFn: componentsApi.bulkReject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setSelectedIds(new Set());
      toast({ title: "Components Rejected", description: `${data.rejected} components rejected/deactivated.` });
    },
  });
  
  const bulkDeleteMutation = useMutation({
    mutationFn: componentsApi.bulkDelete,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setSelectedIds(new Set());
      toast({ title: "Components Deleted", description: `${data.deleted} components deleted.` });
    },
  });
  
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredComponents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredComponents.map(c => c.id)));
    }
  };
  
  // Server-side search/filter is applied, use components directly
  const filteredComponents = components;
  
  // Scroll to highlighted component when data loads and component is found
  useEffect(() => {
    if (highlightId && !hasScrolled && !componentsLoading) {
      const hasHighlightedComponent = filteredComponents.some(c => c.id === highlightId);
      if (hasHighlightedComponent) {
        setTimeout(() => {
          highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          setHasScrolled(true);
        }, 100);
      }
    }
  }, [highlightId, hasScrolled, componentsLoading, filteredComponents]);
  
  const handleCreate = () => {
    if (!newComponent.componentTypeId) return;
    createMutation.mutate(newComponent as InsertComponent);
  };
  
  const getCategoryBadge = (category?: string) => {
    const colors: Record<string, string> = {
      HEATING: "bg-orange-100 text-orange-800",
      ELECTRICAL: "bg-yellow-100 text-yellow-800",
      FIRE_SAFETY: "bg-red-100 text-red-800",
      WATER: "bg-blue-100 text-blue-800",
      VENTILATION: "bg-cyan-100 text-cyan-800",
      STRUCTURE: "bg-gray-100 text-gray-800",
      ACCESS: "bg-emerald-100 text-emerald-800",
      SECURITY: "bg-indigo-100 text-indigo-800",
      EXTERNAL: "bg-green-100 text-green-800",
      OTHER: "bg-slate-100 text-slate-800",
    };
    return colors[category || "OTHER"] || colors.OTHER;
  };
  
  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Components & Assets" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Components and assets content">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Components & Assets</h1>
              <p className="text-sm text-muted-foreground">
                Manage equipment, appliances, and building components
              </p>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-component">
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Component</DialogTitle>
              <DialogDescription>
                Register a new equipment or asset in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Component Type *</Label>
                <Select
                  value={newComponent.componentTypeId || ""}
                  onValueChange={(v) => setNewComponent({ ...newComponent, componentTypeId: v })}
                >
                  <SelectTrigger data-testid="select-component-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueComponentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Property</Label>
                <Select
                  value={newComponent.propertyId || ""}
                  onValueChange={(v) => setNewComponent({ ...newComponent, propertyId: v })}
                >
                  <SelectTrigger data-testid="select-property">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.addressLine1}, {prop.postcode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Tag</Label>
                  <Input
                    placeholder="e.g., ASSET-001"
                    value={newComponent.assetTag || ""}
                    onChange={(e) => setNewComponent({ ...newComponent, assetTag: e.target.value })}
                    data-testid="input-asset-tag"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    placeholder="Manufacturer serial"
                    value={newComponent.serialNumber || ""}
                    onChange={(e) => setNewComponent({ ...newComponent, serialNumber: e.target.value })}
                    data-testid="input-serial-number"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    placeholder="e.g., Worcester"
                    value={newComponent.manufacturer || ""}
                    onChange={(e) => setNewComponent({ ...newComponent, manufacturer: e.target.value })}
                    data-testid="input-manufacturer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    placeholder="e.g., Greenstar 30i"
                    value={newComponent.model || ""}
                    onChange={(e) => setNewComponent({ ...newComponent, model: e.target.value })}
                    data-testid="input-model"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="e.g., Kitchen, Utility Room"
                  value={newComponent.location || ""}
                  onChange={(e) => setNewComponent({ ...newComponent, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Install Date</Label>
                  <Input
                    type="date"
                    value={newComponent.installDate || ""}
                    onChange={(e) => setNewComponent({ ...newComponent, installDate: e.target.value })}
                    data-testid="input-install-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={newComponent.condition || ""}
                    onValueChange={(v) => setNewComponent({ ...newComponent, condition: v })}
                  >
                    <SelectTrigger data-testid="select-condition">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GOOD">Good</SelectItem>
                      <SelectItem value="FAIR">Fair</SelectItem>
                      <SelectItem value="POOR">Poor</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newComponent.componentTypeId || createMutation.isPending}
                data-testid="button-save-component"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Component
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Hero Stats Grid */}
      <HeroStatsGrid stats={[
        {
          title: "Total Components",
          value: totalComponents,
          icon: Settings,
          riskLevel: "good",
          subtitle: "registered assets",
          testId: "stat-total-components"
        },
        {
          title: "Critical Condition",
          value: conditionSummary.CRITICAL,
          icon: AlertTriangle,
          riskLevel: "critical",
          subtitle: "require attention",
          testId: "stat-critical-components"
        },
        {
          title: "Poor Condition",
          value: conditionSummary.POOR,
          icon: Clock,
          riskLevel: "high",
          subtitle: "needs maintenance",
          testId: "stat-poor-components"
        },
        {
          title: "Good Condition",
          value: conditionSummary.GOOD,
          icon: CheckCircle,
          riskLevel: "good",
          subtitle: "healthy assets",
          testId: "stat-good-components"
        }
      ]} />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Component Registry</CardTitle>
              <CardDescription>{totalComponents.toLocaleString()} components registered (showing {filteredComponents.length})</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search components..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-components"
                />
              </div>
              <ComponentTypePicker
                componentTypes={uniqueComponentTypes}
                value={typeFilter}
                onValueChange={setTypeFilter}
                placeholder="All Types"
                data-testid="filter-component-type"
              />
            </div>
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                disabled={bulkApproveMutation.isPending}
                data-testid="button-bulk-approve"
              >
                {bulkApproveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                disabled={bulkRejectMutation.isPending}
                data-testid="button-bulk-reject"
              >
                {bulkRejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                Reject
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className={`transition-opacity duration-200 ${componentsFetching ? 'opacity-60' : 'opacity-100'}`}>
          {componentsLoading && !componentsResponse ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading components</span>
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No components found. Add your first component or import from CSV.</p>
            </div>
          ) : (
            <div className="space-y-4">
            {/* Top Pagination */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalComponents}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={setPageSize}
            />
            
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredComponents.length && filteredComponents.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Manufacturer / Model</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map((comp) => (
                  <TableRow 
                    key={comp.id} 
                    ref={comp.id === highlightId ? highlightRef : undefined}
                    className={cn(
                      comp.id === highlightId && "bg-emerald-50 ring-2 ring-emerald-500 ring-inset"
                    )}
                    data-testid={`component-row-${comp.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(comp.id)}
                        onCheckedChange={() => toggleSelect(comp.id)}
                        data-testid={`checkbox-${comp.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {comp.componentType?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryBadge(comp.componentType?.category)}>
                        {comp.componentType?.category || "OTHER"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {comp.property ? (
                        <Link href={`/properties/${comp.property.id}`} className="text-blue-600 hover:underline" title={`${comp.property.addressLine1}, ${comp.property.postcode}`}>
                          {comp.property.addressLine1?.substring(0, 30)}{comp.property.addressLine1 && comp.property.addressLine1.length > 30 ? '...' : ''}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.manufacturer || comp.model ? (
                        <>
                          <span className="font-medium">{comp.manufacturer}</span>
                          {comp.model && <span className="text-muted-foreground"> / {comp.model}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{comp.location || "-"}</TableCell>
                    <TableCell>
                      {comp.condition ? (
                        <Badge className={CONDITION_COLORS[comp.condition] || ""}>
                          {comp.condition}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.needsVerification ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Pending Review
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Verified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(comp)}
                        data-testid={`edit-component-${comp.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (comp.id) deleteMutation.mutate(comp.id);
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`delete-component-${comp.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </div>
            
            {/* Bottom Pagination */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalComponents}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={setPageSize}
            />
          </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Component Dialog */}
      <Dialog open={!!editingComponent} onOpenChange={(open) => !open && setEditingComponent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Component</DialogTitle>
            <DialogDescription>
              {editingComponent?.componentType?.name || "Unknown Type"} - Update component details
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {editingComponent?.property && (
              <div className="bg-muted/50 p-3 rounded-md">
                <Label className="text-xs text-muted-foreground">Linked Property</Label>
                <p className="font-medium">{editingComponent.property.addressLine1}, {editingComponent.property.postcode}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input
                  id="edit-manufacturer"
                  value={editFormData.manufacturer || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, manufacturer: e.target.value })}
                  placeholder="e.g., Worcester Bosch"
                />
              </div>
              <div>
                <Label htmlFor="edit-model">Model</Label>
                <Input
                  id="edit-model"
                  value={editFormData.model || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                  placeholder="e.g., Greenstar 30i"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-serial">Serial Number</Label>
                <Input
                  id="edit-serial"
                  value={editFormData.serialNumber || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                  placeholder="Serial number"
                />
              </div>
              <div>
                <Label htmlFor="edit-asset-tag">Asset Tag</Label>
                <Input
                  id="edit-asset-tag"
                  value={editFormData.assetTag || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, assetTag: e.target.value })}
                  placeholder="Asset tag"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editFormData.location || ""}
                onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                placeholder="e.g., Kitchen, Ground Floor"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-condition">Condition</Label>
              <Select
                value={editFormData.condition || ""}
                onValueChange={(v) => setEditFormData({ ...editFormData, condition: v })}
              >
                <SelectTrigger id="edit-condition">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOOD">Good</SelectItem>
                  <SelectItem value="FAIR">Fair</SelectItem>
                  <SelectItem value="POOR">Poor</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComponent(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingComponent?.id) {
                  updateMutation.mutate({ id: editingComponent.id, data: editFormData });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </main>
      </div>
    </div>
  );
}
