import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { componentsApi, componentTypesApi, propertiesApi } from "@/lib/api";
import { Plus, Search, Settings, Wrench, Info, Loader2, Trash2, Edit } from "lucide-react";
import type { InsertComponent } from "@shared/schema";

const CONDITION_COLORS: Record<string, string> = {
  GOOD: "bg-green-100 text-green-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export default function ComponentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newComponent, setNewComponent] = useState<Partial<InsertComponent>>({});
  
  const queryClient = useQueryClient();
  
  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ["components", propertyFilter, typeFilter],
    queryFn: () => componentsApi.list({
      propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
      componentTypeId: typeFilter !== "all" ? typeFilter : undefined,
    }),
  });
  
  const { data: componentTypes = [] } = useQuery({
    queryKey: ["component-types"],
    queryFn: componentTypesApi.list,
  });
  
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });
  
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
  
  const filteredComponents = components.filter((comp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      comp.componentType?.name?.toLowerCase().includes(query) ||
      comp.assetTag?.toLowerCase().includes(query) ||
      comp.serialNumber?.toLowerCase().includes(query) ||
      comp.manufacturer?.toLowerCase().includes(query) ||
      comp.model?.toLowerCase().includes(query) ||
      comp.location?.toLowerCase().includes(query)
    );
  });
  
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
      ACCESS: "bg-purple-100 text-purple-800",
      SECURITY: "bg-indigo-100 text-indigo-800",
      EXTERNAL: "bg-green-100 text-green-800",
      OTHER: "bg-slate-100 text-slate-800",
    };
    return colors[category || "OTHER"] || colors.OTHER;
  };
  
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Components & Assets" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Components & Assets</h1>
              <p className="text-muted-foreground">
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
                    {componentTypes.map((type) => (
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
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>HACT Asset Registry</AlertTitle>
        <AlertDescription>
          Components are assets within properties that require compliance inspections. 
          Link components to certificates to track their inspection history and compliance status.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Component Registry</CardTitle>
              <CardDescription>{filteredComponents.length} components registered</CardDescription>
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="filter-component-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {componentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {componentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No components found. Add your first component or import from CSV.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Manufacturer / Model</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Install Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map((comp) => (
                  <TableRow key={comp.id} data-testid={`component-row-${comp.id}`}>
                    <TableCell className="font-medium">
                      {comp.componentType?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryBadge(comp.componentType?.category)}>
                        {comp.componentType?.category || "OTHER"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {comp.assetTag || "-"}
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
                    <TableCell className="text-muted-foreground">
                      {comp.installDate || "-"}
                    </TableCell>
                    <TableCell>
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
          )}
        </CardContent>
      </Card>
        </main>
      </div>
    </div>
  );
}
