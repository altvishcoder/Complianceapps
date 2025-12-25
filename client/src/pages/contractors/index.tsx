import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search, 
  Plus,
  Building,
  UserPlus
} from "lucide-react";
import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContractorsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const handleAddContractor = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddOpen(false);
    toast({
      title: "Feature Coming Soon",
      description: "Contractor management will be available in a future update.",
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contractor Management" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search contractors..." className="pl-9" />
            </div>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contractor
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Contractor</DialogTitle>
                  <DialogDescription>
                    Enter details for the new supplier. They will be sent an onboarding link.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddContractor}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Company Name</Label>
                      <Input id="name" placeholder="e.g. Acme Heating Ltd" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="type">Trade Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gas">Gas & Heating</SelectItem>
                            <SelectItem value="elec">Electrical</SelectItem>
                            <SelectItem value="fire">Fire Safety</SelectItem>
                            <SelectItem value="cleaning">Cleaning</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="reg">Reg Number</Label>
                        <Input id="reg" placeholder="e.g. Company Reg" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Contact Email</Label>
                      <Input id="email" type="email" placeholder="contact@company.com" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Contact Phone</Label>
                      <Input id="phone" placeholder="07XXX XXX XXX" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add Contractor</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contractors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">No contractors registered</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">No active contracts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">All contractors verified</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Approved Contractors</CardTitle>
              <CardDescription>Manage your approved supplier list</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Contractors Yet</h3>
                <p className="text-muted-foreground max-w-sm mb-4">
                  Add your first contractor to start managing your approved supplier list. 
                  Contractors can be assigned to properties and compliance tasks.
                </p>
                <Button onClick={() => setIsAddOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Contractor
                </Button>
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
