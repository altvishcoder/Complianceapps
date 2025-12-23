import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Download, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, Home, Plus, Building2, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db, Property, Block, Scheme } from "@/lib/store";
import { Link } from "wouter";

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>(db.properties);
  const [schemes, setSchemes] = useState<Scheme[]>(db.schemes);
  const [blocks, setBlocks] = useState<Block[]>(db.blocks);
  const [filteredBlocks, setFilteredBlocks] = useState<Block[]>([]);
  
  // Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProp, setNewProp] = useState({
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

  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setProperties(db.properties);
      setSchemes(db.schemes);
      setBlocks(db.blocks);
    });
    return unsubscribe;
  }, []);

  // Filter blocks when scheme changes in form
  useEffect(() => {
    if (newProp.schemeId) {
      setFilteredBlocks(db.getBlocksByScheme(newProp.schemeId));
    } else {
      setFilteredBlocks([]);
    }
  }, [newProp.schemeId]);

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.blockId || !newProp.addressLine1 || !newProp.postcode) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    db.addProperty({
      blockId: newProp.blockId,
      uprn: `UPRN-${Date.now()}`,
      addressLine1: newProp.addressLine1,
      city: newProp.city,
      postcode: newProp.postcode,
      propertyType: newProp.propertyType as any,
      tenure: newProp.tenure as any,
      bedrooms: parseInt(newProp.bedrooms),
      hasGas: newProp.hasGas
    });

    setIsAddOpen(false);
    toast({
      title: "Property Added",
      description: "New asset has been successfully created and linked to the block.",
    });
    
    // Reset form
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
  };

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
        <Header title="Property Management" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-4 md:grid-cols-3 mb-6">
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
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Input placeholder="Search address, postcode or UPRN..." className="pl-9" />
                  <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             
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

          <Card>
            <CardContent className="p-0">
               <div className="rounded-md border-t border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4 pl-6">Address</th>
                      <th className="p-4">Block / Scheme</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {properties.map((prop) => {
                       const block = blocks.find(b => b.id === prop.blockId);
                       const scheme = schemes.find(s => s.id === block?.schemeId);
                       
                       return (
                        <tr key={prop.id} className="group hover:bg-muted/20 transition-colors cursor-pointer">
                          <td className="p-4 pl-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{prop.addressLine1}</span>
                              <span className="text-xs text-muted-foreground">{prop.city}, {prop.postcode}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                             <div className="flex flex-col">
                                <span>{block?.name}</span>
                                <span className="text-xs">{scheme?.name}</span>
                             </div>
                          </td>
                          <td className="p-4 text-muted-foreground capitalize">{prop.propertyType.toLowerCase()}</td>
                          <td className="p-4">
                             {getStatusBadge(prop.complianceStatus)}
                          </td>
                          <td className="p-4 text-right pr-6">
                             <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                          </td>
                        </tr>
                       );
                    })}
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
