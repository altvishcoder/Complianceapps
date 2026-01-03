import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Search, 
  Plus,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  History,
  Upload,
  CheckCircle2,
  Calendar,
  Award,
  ClipboardCheck
} from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
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
import type { Contractor, ContractorCertification } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";

const REGISTRATION_TYPES = [
  { value: "GAS_SAFE", label: "Gas Safe Register", lookupUrl: "https://www.gassaferegister.co.uk/find-an-engineer/" },
  { value: "NICEIC", label: "NICEIC", lookupUrl: "https://www.niceic.com/find-a-contractor" },
  { value: "NAPIT", label: "NAPIT", lookupUrl: "https://www.napit.org.uk/find-an-installer.aspx" },
  { value: "ELECSA", label: "ELECSA", lookupUrl: "https://www.elecsa.co.uk/find-an-electrician" },
  { value: "ECS", label: "ECS Card", lookupUrl: "https://www.ecscard.org.uk/card-checker" },
  { value: "OFTEC", label: "OFTEC", lookupUrl: "https://www.oftec.org/consumers/find-a-technician" },
  { value: "HETAS", label: "HETAS", lookupUrl: "https://www.hetas.co.uk/find-installer/" },
  { value: "BESCA", label: "BESCA", lookupUrl: "https://www.besca.org.uk/members/" },
  { value: "FGAS", label: "F-Gas", lookupUrl: "https://www.gov.uk/guidance/f-gas-register" },
  { value: "SSIP", label: "SSIP (CHAS/SafeContractor)", lookupUrl: "https://ssip.org.uk/member-search/" },
  { value: "CONSTRUCTIONLINE", label: "Constructionline", lookupUrl: "https://www.constructionline.co.uk/suppliers/" },
  { value: "REFCOM", label: "REFCOM", lookupUrl: "https://www.refcom.org.uk/members/" },
  { value: "CIOB", label: "CIOB", lookupUrl: "https://www.ciob.org/directory" },
  { value: "PAS_8672", label: "PAS 8672 Competence", lookupUrl: null },
  { value: "BUILDING_SAFETY", label: "Building Safety Regulator", lookupUrl: "https://www.hse.gov.uk/building-safety/" },
  { value: "OTHER", label: "Other", lookupUrl: null },
];

const getVerificationStatusBadge = (status: string) => {
  switch (status) {
    case "VERIFIED": return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
    case "PENDING": return <Badge className="bg-orange-500 hover:bg-orange-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "EXPIRED": return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
    case "FAILED": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "SUSPENDED": return <Badge variant="secondary"><ShieldAlert className="h-3 w-3 mr-1" />Suspended</Badge>;
    case "REVOKED": return <Badge variant="destructive">Revoked</Badge>;
    default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Unverified</Badge>;
  }
};

export default function ContractorsPage() {
  useEffect(() => {
    document.title = "Contractor Verification - ComplianceAI";
  }, []);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  
  const [newContractor, setNewContractor] = useState({
    companyName: "",
    tradeType: "",
    registrationNumber: "",
    contactEmail: "",
    contactPhone: "",
    gasRegistration: "",
    electricalRegistration: ""
  });

  const [newCertification, setNewCertification] = useState({
    registrationType: "",
    registrationNumber: "",
    registrationName: "",
    issueDate: "",
    expiryDate: "",
    verificationNotes: ""
  });

  const [verificationData, setVerificationData] = useState({
    action: "VERIFIED",
    verificationType: "MANUAL_REVIEW",
    verificationMethod: "MANUAL",
    notes: ""
  });

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ["contractors"],
    queryFn: () => contractorsApi.list(),
  });

  const { data: certifications = [] } = useQuery<ContractorCertification[]>({
    queryKey: ["contractor-certifications", selectedContractor?.id],
    queryFn: async () => {
      if (!selectedContractor?.id) return [];
      const res = await fetch(`/api/contractor-certifications?contractorId=${selectedContractor.id}`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedContractor?.id,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["contractor-alerts"],
    queryFn: async () => {
      const res = await fetch('/api/contractor-alerts', { credentials: 'include' });
      return res.json();
    },
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

  const createCertificationMutation = useMutation({
    mutationFn: async (data: typeof newCertification & { contractorId: string }) => {
      const res = await fetch('/api/contractor-certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add certification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-certifications"] });
      setIsCertOpen(false);
      setNewCertification({
        registrationType: "",
        registrationNumber: "",
        registrationName: "",
        issueDate: "",
        expiryDate: "",
        verificationNotes: ""
      });
      toast({ title: "Certification Added", description: "Registration has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ contractorId, data }: { contractorId: string; data: typeof verificationData }) => {
      const res = await fetch(`/api/contractors/${contractorId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to verify');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-certifications"] });
      setIsVerifyOpen(false);
      toast({ title: "Verification Recorded", description: "Verification status has been updated." });
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

  const handleAddCertification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractor || !newCertification.registrationType || !newCertification.registrationNumber) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createCertificationMutation.mutate({
      ...newCertification,
      contractorId: selectedContractor.id,
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractor) return;
    verifyMutation.mutate({
      contractorId: selectedContractor.id,
      data: verificationData,
    });
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

  const openContractorPassport = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    setActiveTab("passport");
  };

  const filteredContractors = contractors.filter(c => 
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = contractors.filter(c => c.status === 'PENDING').length;
  const approvedCount = contractors.filter(c => c.status === 'APPROVED').length;
  const expiredCertCount = certifications.filter(c => c.verificationStatus === 'EXPIRED').length;

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

  const getRegistrationTypeInfo = (type: string) => {
    return REGISTRATION_TYPES.find(r => r.value === type) || { label: type, lookupUrl: null };
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contractor Verification" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Contractor verification content">
          
          {/* Hero Stats Grid */}
          <HeroStatsGrid stats={[
            {
              title: "Total Contractors",
              value: contractors.length,
              icon: Users,
              riskLevel: "good",
              subtitle: "registered suppliers",
              testId: "stat-total-contractors"
            },
            {
              title: "Verified",
              value: approvedCount,
              icon: ShieldCheck,
              riskLevel: "good",
              subtitle: "approved contractors",
              testId: "stat-verified-contractors"
            },
            {
              title: "Pending Verification",
              value: pendingCount,
              icon: Clock,
              riskLevel: pendingCount > 5 ? "high" : "medium",
              subtitle: "awaiting review",
              testId: "stat-pending-contractors"
            },
            {
              title: "Expired Certs",
              value: expiredCertCount,
              icon: AlertTriangle,
              riskLevel: expiredCertCount > 0 ? "critical" : "good",
              subtitle: "need renewal",
              testId: "stat-expired-certs"
            }
          ]} />
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <TabsList>
                <TabsTrigger value="list" data-testid="tab-contractor-list">
                  <Users className="h-4 w-4 mr-2" />
                  Contractors
                </TabsTrigger>
                <TabsTrigger value="passport" data-testid="tab-contractor-passport" disabled={!selectedContractor}>
                  <Award className="h-4 w-4 mr-2" />
                  Passport
                </TabsTrigger>
                <TabsTrigger value="alerts" data-testid="tab-contractor-alerts">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Alerts ({alerts.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                {activeTab === "list" && selectedIds.size > 0 && (
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
                {activeTab === "list" && (
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
                )}
              </div>
            </div>

            <TabsContent value="list" className="space-y-6">
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

              <div className="grid gap-4 md:grid-cols-4">
                <StatsCard 
                  title="Total Contractors" 
                  value={String(contractors.length)}
                  description={contractors.length === 0 ? "No contractors registered" : "Registered suppliers"}
                  icon={Users}
                  data-testid="card-total-contractors"
                />
                <StatsCard 
                  title="Approved" 
                  value={String(approvedCount)}
                  description="Verified contractors"
                  icon={ShieldCheck}
                  status="success"
                  data-testid="card-approved-count"
                />
                <StatsCard 
                  title="Pending Verification" 
                  value={String(pendingCount)}
                  description={pendingCount === 0 ? "All verified" : "Awaiting review"}
                  icon={Clock}
                  status={pendingCount > 0 ? "warning" : "success"}
                  data-testid="card-pending-count"
                />
                <StatsCard 
                  title="Expiring Certs" 
                  value={String(alerts.filter((a: any) => a.alertType === 'EXPIRING_CERTIFICATION').length)}
                  description="Within 30 days"
                  icon={AlertTriangle}
                  status="warning"
                  data-testid="card-expiring-certs"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Contractor Directory</CardTitle>
                  <CardDescription>Click on a contractor to view their verification passport</CardDescription>
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
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => openContractorPassport(contractor)}
                          data-testid={`contractor-row-${contractor.id}`}
                        >
                          <Checkbox 
                            checked={selectedIds.has(contractor.id)}
                            onCheckedChange={() => toggleSelect(contractor.id)}
                            onClick={(e) => e.stopPropagation()}
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
                                  <span className="flex items-center gap-1">
                                    <FileCheck className="h-3 w-3 text-blue-500" />
                                    Gas Safe: {contractor.gasRegistration}
                                  </span>
                                )}
                                {contractor.electricalRegistration && (
                                  <span className="flex items-center gap-1">
                                    <FileCheck className="h-3 w-3 text-yellow-500" />
                                    NICEIC: {contractor.electricalRegistration}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openContractorPassport(contractor); }}>
                            <Award className="h-4 w-4 mr-1" />
                            View Passport
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="passport" className="space-y-6">
              {selectedContractor && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Award className="h-6 w-6 text-primary" />
                        {selectedContractor.companyName}
                      </h2>
                      <p className="text-muted-foreground">{getTradeTypeLabel(selectedContractor.tradeType)} Contractor</p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={isCertOpen} onOpenChange={setIsCertOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" data-testid="button-add-certification">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Certification
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Certification</DialogTitle>
                            <DialogDescription>
                              Record a new professional registration or certification for this contractor.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleAddCertification}>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label>Registration Type *</Label>
                                <Select 
                                  value={newCertification.registrationType}
                                  onValueChange={(value) => setNewCertification({...newCertification, registrationType: value})}
                                >
                                  <SelectTrigger data-testid="select-registration-type">
                                    <SelectValue placeholder="Select registration type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REGISTRATION_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <Label>Registration Number *</Label>
                                <Input 
                                  placeholder="e.g. 123456" 
                                  value={newCertification.registrationNumber}
                                  onChange={(e) => setNewCertification({...newCertification, registrationNumber: e.target.value})}
                                  data-testid="input-cert-registration-number"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>Registered Name</Label>
                                <Input 
                                  placeholder="Name as shown on certificate" 
                                  value={newCertification.registrationName}
                                  onChange={(e) => setNewCertification({...newCertification, registrationName: e.target.value})}
                                  data-testid="input-cert-registration-name"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label>Issue Date</Label>
                                  <Input 
                                    type="date" 
                                    value={newCertification.issueDate}
                                    onChange={(e) => setNewCertification({...newCertification, issueDate: e.target.value})}
                                    data-testid="input-cert-issue-date"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Expiry Date</Label>
                                  <Input 
                                    type="date" 
                                    value={newCertification.expiryDate}
                                    onChange={(e) => setNewCertification({...newCertification, expiryDate: e.target.value})}
                                    data-testid="input-cert-expiry-date"
                                  />
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <Label>Notes</Label>
                                <Textarea 
                                  placeholder="Any additional notes..." 
                                  value={newCertification.verificationNotes}
                                  onChange={(e) => setNewCertification({...newCertification, verificationNotes: e.target.value})}
                                  data-testid="input-cert-notes"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsCertOpen(false)}>Cancel</Button>
                              <Button type="submit" disabled={createCertificationMutation.isPending} data-testid="button-submit-certification">
                                Add Certification
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                      
                      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-verify-contractor">
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Record Verification
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Verification</DialogTitle>
                            <DialogDescription>
                              Record the result of a manual verification check for this contractor.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleVerify}>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label>Verification Result *</Label>
                                <Select 
                                  value={verificationData.action}
                                  onValueChange={(value) => setVerificationData({...verificationData, action: value})}
                                >
                                  <SelectTrigger data-testid="select-verification-result">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="VERIFIED">Verified - All checks passed</SelectItem>
                                    <SelectItem value="PENDING">Pending - Awaiting information</SelectItem>
                                    <SelectItem value="FAILED">Failed - Verification unsuccessful</SelectItem>
                                    <SelectItem value="EXPIRED">Expired - Registration expired</SelectItem>
                                    <SelectItem value="SUSPENDED">Suspended - Temporarily inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <Label>Verification Type</Label>
                                <Select 
                                  value={verificationData.verificationType}
                                  onValueChange={(value) => setVerificationData({...verificationData, verificationType: value})}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MANUAL_REVIEW">Manual Review</SelectItem>
                                    <SelectItem value="REGISTRY_LOOKUP">Registry Lookup</SelectItem>
                                    <SelectItem value="DOCUMENT_CHECK">Document Check</SelectItem>
                                    <SelectItem value="RENEWAL">Renewal Verification</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <Label>Verification Notes</Label>
                                <Textarea 
                                  placeholder="Describe what was checked and the outcome..." 
                                  value={verificationData.notes}
                                  onChange={(e) => setVerificationData({...verificationData, notes: e.target.value})}
                                  data-testid="input-verification-notes"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsVerifyOpen(false)}>Cancel</Button>
                              <Button type="submit" disabled={verifyMutation.isPending} data-testid="button-submit-verification">
                                Record Verification
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
                        <CardTitle className="text-sm font-medium text-muted-foreground">Verification Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {selectedContractor.status === 'APPROVED' ? (
                            <ShieldCheck className="h-8 w-8 text-emerald-500" />
                          ) : (
                            <Clock className="h-8 w-8 text-orange-500" />
                          )}
                          <div>
                            <p className="text-2xl font-bold">{selectedContractor.status}</p>
                            <p className="text-xs text-muted-foreground">Overall status</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Certifications</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="text-2xl font-bold">{certifications.length}</p>
                            <p className="text-xs text-muted-foreground">Recorded registrations</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {expiredCertCount > 0 ? (
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          )}
                          <div>
                            <p className="text-2xl font-bold">{expiredCertCount}</p>
                            <p className="text-xs text-muted-foreground">{expiredCertCount === 0 ? 'All clear' : 'Needs attention'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5" />
                        Professional Registrations
                      </CardTitle>
                      <CardDescription>
                        UK regulatory scheme registrations for Building Safety Act 2022 and Social Housing Regulation Act 2023 compliance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {certifications.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No certifications recorded yet.</p>
                          <Button variant="outline" className="mt-4" onClick={() => setIsCertOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Certification
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {certifications.map((cert) => {
                            const typeInfo = getRegistrationTypeInfo(cert.registrationType);
                            return (
                              <div key={cert.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`cert-row-${cert.id}`}>
                                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                  <Award className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{typeInfo.label}</span>
                                    {getVerificationStatusBadge(cert.verificationStatus)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Registration: {cert.registrationNumber}
                                    {cert.registrationName && ` • ${cert.registrationName}`}
                                  </div>
                                  {cert.expiryDate && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <Calendar className="h-3 w-3" />
                                      Expires: {new Date(cert.expiryDate).toLocaleDateString('en-GB')}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {typeInfo.lookupUrl && (
                                    <Button variant="outline" size="sm" asChild>
                                      <a href={typeInfo.lookupUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        Lookup
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{selectedContractor.contactEmail}</p>
                          </div>
                        </div>
                        {selectedContractor.contactPhone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Phone</p>
                              <p className="font-medium">{selectedContractor.contactPhone}</p>
                            </div>
                          </div>
                        )}
                        {selectedContractor.registrationNumber && (
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Company Registration</p>
                              <p className="font-medium">{selectedContractor.registrationNumber}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Contractor Verification Alerts
                  </CardTitle>
                  <CardDescription>
                    Expiring certifications and verification issues requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!alerts || alerts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                      <p className="text-lg font-medium">No Active Alerts</p>
                      <p className="text-sm">All contractor certifications are up to date.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {alerts.map((alert: any) => (
                        <div key={alert.id} className="flex items-center gap-4 p-4 border rounded-lg border-orange-200 bg-orange-50" data-testid={`alert-row-${alert.id}`}>
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          <div className="flex-1">
                            <p className="font-medium">{alert.title}</p>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                            {alert.dueDate && (
                              <p className="text-xs text-orange-600 mt-1">
                                Due: {new Date(alert.dueDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                          </div>
                          <Badge variant={alert.severity === 'IMMEDIATE' ? 'destructive' : 'secondary'}>
                            {alert.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </main>
      </div>
    </div>
  );
}
