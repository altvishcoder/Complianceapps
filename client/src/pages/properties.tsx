import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, Download, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, Home, Plus, Building2, Layers, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, schemesApi, blocksApi } from "@/lib/api";
import type { InsertProperty } from "@shared/schema";

export default function Properties() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [schemeFilter, setSchemeFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });
  
  const { data: schemes = [] } = useQuery({
    queryKey: ["schemes"],
    queryFn: () => schemesApi.list(),
  });
  
  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => blocksApi.list(),
  });
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProp, setNewProp] = useState<{
    schemeId: string;
    blockId: string;
    addressLine1: string;
    city: string;
    postcode: string;
    propertyType: string;
    tenure: string;
    bedrooms: string;
    hasGas: boolean;
  }>({
    schemeId: "",
    blockId: "",
    addressLine1: "",
    city: "",
    postcode: "",
    propertyType: "FLAT",
    tenure: "SOCIAL_RENT",
    bedrooms: "1",
    hasGas: true
  });

  const filteredBlocks = newProp.schemeId 
    ? blocks.filter(b => b.schemeId === newProp.schemeId)
    : [];
  
  const createProperty = useMutation({
    mutationFn: (data: InsertProperty) => propertiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setIsAddOpen(false);
      toast({
        title: "Property Added",
        description: "New asset has been successfully created and linked to the block.",
      });
      setNewProp({
        schemeId: "",
        blockId: "",
        addressLine1: "",
        city: "",
        postcode: "",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: "1",
        hasGas: true
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => propertiesApi.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setSelectedIds(new Set());
      toast({
        title: "Properties Deleted",
        description: `${data.deleted} properties have been removed.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkVerifyMutation = useMutation({
    mutationFn: (ids: string[]) => propertiesApi.bulkVerify(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setSelectedIds(new Set());
      toast({
        title: "Properties Approved",
        description: `${data.verified} properties have been verified and approved.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) => propertiesApi.bulkReject(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      setSelectedIds(new Set());
      toast({
        title: "Properties Rejected",
        description: `${data.rejected} properties have been rejected and removed.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.blockId || !newProp.addressLine1 || !newProp.postcode) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createProperty.mutate({
      blockId: newProp.blockId,
      uprn: `UPRN-${Date.now()}`,
      addressLine1: newProp.addressLine1,
      city: newProp.city,
      postcode: newProp.postcode,
      propertyType: newProp.propertyType as "FLAT" | "HOUSE" | "BUNGALOW",
      tenure: newProp.tenure as "SOCIAL_RENT" | "LEASEHOLD",
      bedrooms: parseInt(newProp.bedrooms),
      hasGas: newProp.hasGas,
      complianceStatus: "COMPLIANT"
    });
  };

  const getStatusBadge = (status: string, needsVerification?: boolean) => {
    if (needsVerification) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Needs Verification</Badge>;
    }
    switch (status) {
      case "COMPLIANT": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Compliant</Badge>;
      case "NON_COMPLIANT": return <Badge variant="destructive">Non-Compliant</Badge>;
      case "OVERDUE": return <Badge variant="destructive">Overdue</Badge>;
      case "EXPIRING_SOON": return <Badge className="bg-amber-500 hover:bg-amber-600">Expiring Soon</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProperties.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProperties.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  // Get block's scheme for filtering
  const blockToScheme = new Map(blocks.map(b => [b.id, b.schemeId]));
  
  // Filter blocks by selected scheme
  const filteredBlockOptions = schemeFilter !== "all" 
    ? blocks.filter(b => b.schemeId === schemeFilter)
    : blocks;
  
  const filteredProperties = properties.filter(p => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!p.addressLine1.toLowerCase().includes(query) && 
          !p.postcode.toLowerCase().includes(query) &&
          !p.uprn.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Scheme filter (through block)
    if (schemeFilter !== "all") {
      const blockScheme = blockToScheme.get(p.blockId);
      if (blockScheme !== schemeFilter) return false;
    }
    
    // Block filter
    if (blockFilter !== "all" && p.blockId !== blockFilter) return false;
    
    // Status filter
    if (statusFilter === "unverified") return p.needsVerification;
    if (statusFilter === "compliant") return p.complianceStatus === "COMPLIANT" && !p.needsVerification;
    if (statusFilter === "non-compliant") return p.complianceStatus === "NON_COMPLIANT" || p.complianceStatus === "OVERDUE";
    
    return true;
  });

  const unverifiedCount = properties.filter(p => p.needsVerification).length;

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Property Management" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-4 md:grid-cols-4 mb-6">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
                  <Home className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{properties.length}</div>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Blocks</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{blocks.length}</div>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Schemes</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{schemes.length}</div>
                </CardContent>
             </Card>
             <Card className={unverifiedCount > 0 ? "border-orange-300" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Needs Verification</CardTitle>
                  <AlertCircle className={`h-4 w-4 ${unverifiedCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${unverifiedCount > 0 ? 'text-orange-600' : ''}`}>{unverifiedCount}</div>
                </CardContent>
             </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
             <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Input 
                    placeholder="Search address, postcode or UPRN..." 
                    className="pl-9" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-properties"
                  />
                  <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Select value={schemeFilter} onValueChange={(v) => { setSchemeFilter(v); setBlockFilter("all"); }}>
                  <SelectTrigger className="w-[150px]" data-testid="filter-scheme">
                    <SelectValue placeholder="Scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schemes</SelectItem>
                    {schemes.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={blockFilter} onValueChange={setBlockFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="filter-block">
                    <SelectValue placeholder="Block" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Blocks</SelectItem>
                    {filteredBlockOptions.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                    <SelectItem value="unverified">Needs Verification</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             
             <div className="flex gap-2">
               {selectedIds.size > 0 && (
                 <>
                   <Button 
                     variant="outline" 
                     className="gap-2"
                     onClick={() => bulkVerifyMutation.mutate(Array.from(selectedIds))}
                     disabled={bulkVerifyMutation.isPending}
                     data-testid="button-bulk-verify"
                   >
                     <ShieldCheck className="h-4 w-4" />
                     Approve ({selectedIds.size})
                   </Button>
                   <Button 
                     variant="outline" 
                     className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                     onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                     disabled={bulkRejectMutation.isPending}
                     data-testid="button-bulk-reject"
                   >
                     <XCircle className="h-4 w-4" />
                     Reject ({selectedIds.size})
                   </Button>
                   <Button 
                     variant="destructive" 
                     className="gap-2"
                     onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                     disabled={bulkDeleteMutation.isPending}
                     data-testid="button-bulk-delete"
                   >
                     <Trash2 className="h-4 w-4" />
                     Delete ({selectedIds.size})
                   </Button>
                 </>
               )}
               
               <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                 <DialogTrigger asChild>
                   <Button className="gap-2">
                      <Plus className="h-4 w-4" /> Add Property
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-[600px]">
                   <DialogHeader>
                     <DialogTitle>Add New Property</DialogTitle>
                     <DialogDescription>Create a new property unit within an existing scheme and block.</DialogDescription>
                   </DialogHeader>
                   <form onSubmit={handleAddProperty}>
                     <div className="grid gap-4 py-4">
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label>Scheme</Label>
                             <Select 
                                value={newProp.schemeId} 
                                onValueChange={(val) => setNewProp({...newProp, schemeId: val, blockId: ""})}
                             >
                                <SelectTrigger>
                                   <SelectValue placeholder="Select Scheme" />
                                </SelectTrigger>
                                <SelectContent>
                                   {schemes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label>Block</Label>
                             <Select 
                                value={newProp.blockId} 
                                onValueChange={(val) => setNewProp({...newProp, blockId: val})}
                                disabled={!newProp.schemeId}
                             >
                                <SelectTrigger>
                                   <SelectValue placeholder="Select Block" />
                                </SelectTrigger>
                                <SelectContent>
                                   {filteredBlocks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                             </Select>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <Label>Address Line 1</Label>
                          <Input 
                             value={newProp.addressLine1}
                             onChange={e => setNewProp({...newProp, addressLine1: e.target.value})}
                             placeholder="e.g. Flat 10, Oak House" 
                          />
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label>City</Label>
                             <Input 
                                value={newProp.city}
                                onChange={e => setNewProp({...newProp, city: e.target.value})}
                                placeholder="London" 
                             />
                          </div>
                          <div className="space-y-2">
                             <Label>Postcode</Label>
                             <Input 
                                value={newProp.postcode}
                                onChange={e => setNewProp({...newProp, postcode: e.target.value})}
                                placeholder="SW1A 1AA" 
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                             <Label>Type</Label>
                             <Select 
                                value={newProp.propertyType}
                                onValueChange={(val) => setNewProp({...newProp, propertyType: val})}
                             >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="FLAT">Flat</SelectItem>
                                   <SelectItem value="HOUSE">House</SelectItem>
                                   <SelectItem value="BUNGALOW">Bungalow</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                           <div className="space-y-2">
                             <Label>Bedrooms</Label>
                             <Input 
                                type="number" 
                                value={newProp.bedrooms}
                                onChange={e => setNewProp({...newProp, bedrooms: e.target.value})}
                                min="0"
                             />
                          </div>
                          <div className="space-y-2">
                             <Label>Tenure</Label>
                             <Select 
                                value={newProp.tenure}
                                onValueChange={(val) => setNewProp({...newProp, tenure: val})}
                             >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="SOCIAL_RENT">Social Rent</SelectItem>
                                   <SelectItem value="LEASEHOLD">Leasehold</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                       </div>
                     </div>
                     <DialogFooter>
                       <Button type="submit">Create Property</Button>
                     </DialogFooter>
                   </form>
                 </DialogContent>
               </Dialog>
             </div>
          </div>

          <Card>
            <CardContent className="p-0">
               <div className="rounded-md border-t border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4 pl-4 w-10">
                        <Checkbox 
                          checked={selectedIds.size === filteredProperties.length && filteredProperties.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th className="p-4">Address</th>
                      <th className="p-4">Block / Scheme</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProperties.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No properties found. Add a property or load demo data.
                        </td>
                      </tr>
                    ) : (
                      filteredProperties.map((prop) => (
                        <tr 
                          key={prop.id} 
                          className={`group hover:bg-muted/20 transition-colors cursor-pointer ${selectedIds.has(prop.id) ? 'bg-muted/30' : ''}`}
                          onClick={() => navigate(`/properties/${prop.id}`)}
                          data-testid={`row-property-${prop.id}`}
                        >
                          <td className="p-4 pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedIds.has(prop.id)}
                              onCheckedChange={() => {
                                const newSelection = new Set(selectedIds);
                                if (newSelection.has(prop.id)) {
                                  newSelection.delete(prop.id);
                                } else {
                                  newSelection.add(prop.id);
                                }
                                setSelectedIds(newSelection);
                              }}
                              data-testid={`checkbox-property-${prop.id}`}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{prop.addressLine1}</span>
                              <span className="text-xs text-muted-foreground">{prop.city}, {prop.postcode}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                             <div className="flex flex-col">
                                <span>{prop.block?.name}</span>
                                <span className="text-xs">{prop.scheme?.name}</span>
                             </div>
                          </td>
                          <td className="p-4 text-muted-foreground capitalize">{prop.propertyType.toLowerCase()}</td>
                          <td className="p-4">
                             {getStatusBadge(prop.complianceStatus, prop.needsVerification)}
                          </td>
                          <td className="p-4 text-right pr-6">
                             <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
