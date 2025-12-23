import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Download, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, Home, Plus } from "lucide-react";
import { properties, Property } from "@/lib/mock-data";
import { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function Properties() {
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddOpen(false);
    toast({
      title: "Property Added",
      description: "New asset has been successfully created.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pass": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "Fail": return <XCircle className="h-4 w-4 text-rose-500" />;
      case "Due Soon": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <span className="text-muted-foreground text-xs">-</span>;
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Property Assets" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Input placeholder="Search address or UPRN..." className="pl-9" />
                  <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" className="gap-2">
                   <Download className="h-4 w-4" /> Export
                </Button>
                
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                       <Plus className="h-4 w-4" /> Add Property
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Asset</DialogTitle>
                      <DialogDescription>Add a new property to the portfolio hierarchy.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddProperty}>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                           <Label>Address Line 1</Label>
                           <Input placeholder="e.g. 10 Downing Street" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2">
                              <Label>City</Label>
                              <Input placeholder="London" />
                           </div>
                           <div className="grid gap-2">
                              <Label>Postcode</Label>
                              <Input placeholder="SW1A 2AA" required />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2">
                              <Label>Type</Label>
                              <Select>
                                 <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="house">House</SelectItem>
                                    <SelectItem value="flat">Flat</SelectItem>
                                    <SelectItem value="block">Block</SelectItem>
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="grid gap-2">
                              <Label>UPRN (Optional)</Label>
                              <Input placeholder="Unique Property Ref" />
                           </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit">Create Asset</Button>
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
                      <th className="p-4 pl-6">UPRN / Address</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Overall Status</th>
                      <th className="p-4 text-center">Gas</th>
                      <th className="p-4 text-center">Elec</th>
                      <th className="p-4 text-center">Fire</th>
                      <th className="p-4 text-center">Asbestos</th>
                      <th className="p-4 text-center">Water</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {properties.map((prop, i) => (
                      <tr key={i} className="group hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedProp(prop)}>
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{prop.address}</span>
                            <span className="text-xs text-muted-foreground font-mono">{prop.uprn}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{prop.type}</td>
                        <td className="p-4">
                           <Badge variant="outline" className={
                             prop.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                             prop.status === 'Non-Compliant' || prop.status === 'Investigation' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                             'bg-amber-50 text-amber-700 border-amber-200'
                           }>
                             {prop.status}
                           </Badge>
                        </td>
                        <td className="p-4 text-center">{getStatusIcon(prop.compliance.gas)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.compliance.elec)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.compliance.fire)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.compliance.asbestos)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.compliance.water)}</td>
                        <td className="p-4 text-right pr-6">
                           <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                             <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Sheet open={!!selectedProp} onOpenChange={(open) => !open && setSelectedProp(null)}>
             <SheetContent className="sm:max-w-xl">
                {selectedProp && (
                   <>
                      <SheetHeader className="pb-6 border-b mb-6">
                         <SheetTitle className="text-xl">{selectedProp.address}</SheetTitle>
                         <SheetDescription>UPRN: {selectedProp.uprn} • {selectedProp.type}</SheetDescription>
                      </SheetHeader>
                      
                      <div className="space-y-6">
                         <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                            <span className="font-semibold">Overall Compliance Status</span>
                            <Badge className={
                             selectedProp.status === 'Compliant' ? 'bg-emerald-500' :
                             selectedProp.status === 'Non-Compliant' ? 'bg-rose-500' :
                             'bg-amber-500'
                           }>{selectedProp.status}</Badge>
                         </div>

                         <div>
                            <h3 className="font-semibold mb-3">Compliance Streams</h3>
                            <div className="grid grid-cols-2 gap-4">
                               {Object.entries(selectedProp.compliance).map(([key, value]) => (
                                  <div key={key} className="flex items-center justify-between p-3 border rounded-md">
                                     <span className="capitalize">{key === 'elec' ? 'Electrical' : key}</span>
                                     <div className="flex items-center gap-2">
                                        {getStatusIcon(value)}
                                        <span className="text-sm">{value}</span>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>

                         <div>
                            <h3 className="font-semibold mb-3">Occupancy</h3>
                            <div className="p-4 border rounded-md bg-muted/10">
                               <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">Current Tenant</span>
                                  <span className="font-medium">{selectedProp.tenant || "Vacant"}</span>
                               </div>
                            </div>
                         </div>
                         
                         <Separator />
                         
                         <div className="flex gap-2">
                            <Button className="flex-1" variant="outline">View Documents</Button>
                            <Button className="flex-1">Raise Action</Button>
                         </div>
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
