import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Search, 
  Plus,
  UserPlus,
  ShieldCheck,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone
} from "lucide-react";
import { useState, useEffect } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractorsApi } from "@/lib/api";
import type { Contractor } from "@shared/schema";

export default function ContractorsPage() {
  useEffect(() => {
    document.title = "Contractor Management - ComplianceAI";
  }, []);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  const [newContractor, setNewContractor] = useState({
    companyName: "",
    tradeType: "",
    registrationNumber: "",
    contactEmail: "",
    contactPhone: "",
    gasRegistration: "",
    electricalRegistration: ""
  });

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ["contractors"],
    queryFn: () => contractorsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: contractorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setIsAddOpen(false);
      setNewContractor({
        companyName: "",
        tradeType: "",
        registrationNumber: "",
        contactEmail: "",
        contactPhone: "",
        gasRegistration: "",
        electricalRegistration: ""
      });
      toast({
        title: "Contractor Added",
        description: "New contractor has been added for verification.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => contractorsApi.bulkApprove(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setSelectedIds(new Set());
      toast({
        title: "Contractors Approved",
        description: `${data.approved} contractors have been approved.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) => contractorsApi.bulkReject(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      setSelectedIds(new Set());
      toast({
        title: "Contractors Rejected",
        description: `${data.rejected} contractors have been rejected.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddContractor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractor.companyName || !newContractor.tradeType || !newContractor.contactEmail) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(newContractor);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContractors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContractors.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const filteredContractors = contractors.filter(c => 
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = contractors.filter(c => c.status === 'PENDING').length;
  const approvedCount = contractors.filter(c => c.status === 'APPROVED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Approved</Badge>;
      case "PENDING": return <Badge className="bg-orange-500 hover:bg-orange-600">Pending</Badge>;
      case "REJECTED": return <Badge variant="destructive">Rejected</Badge>;
      case "SUSPENDED": return <Badge variant="secondary">Suspended</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTradeTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      gas: "Gas & Heating",
      elec: "Electrical",
      fire: "Fire Safety",
      cleaning: "Cleaning",
      asbestos: "Asbestos",
      water: "Water/Legionella",
      lift: "Lift/LOLER"
    };
    return types[type] || type;
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contractor Management" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="Contractor management content">
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search contractors..." 
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-contractors"
              />
            </div>
            
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                    disabled={bulkApproveMutation.isPending}
                    data-testid="button-bulk-approve-contractors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Approve ({selectedIds.size})
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                    disabled={bulkRejectMutation.isPending}
                    data-testid="button-bulk-reject-contractors"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject ({selectedIds.size})
                  </Button>
                </>
              )}
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-contractor">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contractor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add New Contractor</DialogTitle>
                    <DialogDescription>
                      Enter details for the new supplier. They will need verification before approval.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddContractor}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input 
                          id="name" 
                          placeholder="e.g. Acme Heating Ltd" 
                          value={newContractor.companyName}
                          onChange={(e) => setNewContractor({...newContractor, companyName: e.target.value})}
                          required 
                          data-testid="input-contractor-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="type">Trade Type *</Label>
                          <Select 
                            value={newContractor.tradeType}
                            onValueChange={(value) => setNewContractor({...newContractor, tradeType: value})}
                          >
                            <SelectTrigger data-testid="select-trade-type">
                              <SelectValue placeholder="Select trade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gas">Gas & Heating</SelectItem>
                              <SelectItem value="elec">Electrical</SelectItem>
                              <SelectItem value="fire">Fire Safety</SelectItem>
                              <SelectItem value="asbestos">Asbestos</SelectItem>
                              <SelectItem value="water">Water/Legionella</SelectItem>
                              <SelectItem value="lift">Lift/LOLER</SelectItem>
                              <SelectItem value="cleaning">Cleaning</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="reg">Company Reg</Label>
                          <Input 
                            id="reg" 
                            placeholder="e.g. 12345678" 
                            value={newContractor.registrationNumber}
                            onChange={(e) => setNewContractor({...newContractor, registrationNumber: e.target.value})}
                            data-testid="input-registration-number"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Contact Email *</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="contact@company.com" 
                          value={newContractor.contactEmail}
                          onChange={(e) => setNewContractor({...newContractor, contactEmail: e.target.value})}
                          required
                          data-testid="input-contractor-email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Contact Phone</Label>
                        <Input 
                          id="phone" 
                          placeholder="07XXX XXX XXX" 
                          value={newContractor.contactPhone}
                          onChange={(e) => setNewContractor({...newContractor, contactPhone: e.target.value})}
                          data-testid="input-contractor-phone"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="gasReg">Gas Safe Reg</Label>
                          <Input 
                            id="gasReg" 
                            placeholder="e.g. 123456" 
                            value={newContractor.gasRegistration}
                            onChange={(e) => setNewContractor({...newContractor, gasRegistration: e.target.value})}
                            data-testid="input-gas-registration"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="elecReg">NICEIC/NAPIT Reg</Label>
                          <Input 
                            id="elecReg" 
                            placeholder="e.g. ABC123" 
                            value={newContractor.electricalRegistration}
                            onChange={(e) => setNewContractor({...newContractor, electricalRegistration: e.target.value})}
                            data-testid="input-electrical-registration"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-contractor">
                        Add Contractor
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contractors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-contractors">{contractors.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {contractors.length === 0 ? "No contractors registered" : "Registered suppliers"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600" data-testid="text-approved-count">{approvedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Active contractors</p>
              </CardContent>
            </Card>
            <Card className={pendingCount > 0 ? "border-orange-300" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-orange-600' : ''}`} data-testid="text-pending-count">
                  {pendingCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingCount === 0 ? "All contractors verified" : "Awaiting review"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contractors</CardTitle>
              <CardDescription>Manage your approved supplier list</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading contractors...</p>
                </div>
              ) : contractors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Contractors Yet</h3>
                  <p className="text-muted-foreground max-w-sm mb-4">
                    Add your first contractor to start managing your approved supplier list. 
                    Contractors can be assigned to properties and compliance tasks.
                  </p>
                  <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-first-contractor">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Contractor
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox 
                      checked={selectedIds.size === filteredContractors.length && filteredContractors.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                  
                  {filteredContractors.map((contractor) => (
                    <div 
                      key={contractor.id} 
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50"
                      data-testid={`contractor-row-${contractor.id}`}
                    >
                      <Checkbox 
                        checked={selectedIds.has(contractor.id)}
                        onCheckedChange={() => toggleSelect(contractor.id)}
                        data-testid={`checkbox-contractor-${contractor.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium" data-testid={`text-company-name-${contractor.id}`}>
                            {contractor.companyName}
                          </span>
                          {getStatusBadge(contractor.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{getTradeTypeLabel(contractor.tradeType)}</span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {contractor.contactEmail}
                          </span>
                          {contractor.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contractor.contactPhone}
                            </span>
                          )}
                        </div>
                        {(contractor.gasRegistration || contractor.electricalRegistration) && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {contractor.gasRegistration && (
                              <span>Gas Safe: {contractor.gasRegistration}</span>
                            )}
                            {contractor.electricalRegistration && (
                              <span>NICEIC: {contractor.electricalRegistration}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
