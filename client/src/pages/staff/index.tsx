import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CheckCircle2,
  Briefcase
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
import { staffApi } from "@/lib/api";
import type { Contractor } from "@shared/schema";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "APPROVED": return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    case "PENDING": return <Badge className="bg-orange-500 hover:bg-orange-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "REJECTED": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>;
    case "SUSPENDED": return <Badge variant="secondary"><ShieldAlert className="h-3 w-3 mr-1" />Suspended</Badge>;
    default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Unknown</Badge>;
  }
};

const DEPARTMENTS = [
  "Gas & Heating",
  "Electrical",
  "General Maintenance",
  "Plumbing",
  "Fire Safety",
  "Building Services",
  "Grounds Maintenance",
  "Multi-trade"
];

export default function StaffDirectoryPage() {
  useEffect(() => {
    document.title = "Staff Directory - ComplianceAI";
  }, []);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [newStaff, setNewStaff] = useState({
    companyName: "",
    tradeType: "",
    contactEmail: "",
    contactPhone: "",
    employeeId: "",
    department: "",
    gasRegistration: "",
    electricalRegistration: ""
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: staffApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setIsAddOpen(false);
      setNewStaff({
        companyName: "",
        tradeType: "",
        contactEmail: "",
        contactPhone: "",
        employeeId: "",
        department: "",
        gasRegistration: "",
        electricalRegistration: ""
      });
      toast({
        title: "Staff Member Added",
        description: "New DLO staff member has been added.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredStaff = staff.filter((s: Contractor) => 
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tradeType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.employeeId && s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeStaff = staff.filter((s: Contractor) => s.status === 'APPROVED');
  const pendingStaff = staff.filter((s: Contractor) => s.status === 'PENDING');
  const suspendedStaff = staff.filter((s: Contractor) => s.status === 'SUSPENDED');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Staff Directory" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Briefcase className="h-8 w-8 text-blue-400" />
                  Staff & DLO Directory
                </h1>
                <p className="text-slate-400 mt-1">
                  Manage internal operatives who perform compliance work
                </p>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-staff">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Staff Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add DLO Staff Member</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Add an internal operative to the staff directory.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Full Name</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.companyName}
                          onChange={(e) => setNewStaff({...newStaff, companyName: e.target.value})}
                          placeholder="John Smith"
                          data-testid="input-staff-name"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Employee ID</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.employeeId}
                          onChange={(e) => setNewStaff({...newStaff, employeeId: e.target.value})}
                          placeholder="EMP-001"
                          data-testid="input-staff-employee-id"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Department</Label>
                        <Select value={newStaff.department} onValueChange={(v) => setNewStaff({...newStaff, department: v})}>
                          <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="select-staff-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            {DEPARTMENTS.map(d => (
                              <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Trade / Role</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.tradeType}
                          onChange={(e) => setNewStaff({...newStaff, tradeType: e.target.value})}
                          placeholder="Gas Engineer"
                          data-testid="input-staff-trade"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Email</Label>
                        <Input 
                          type="email"
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.contactEmail}
                          onChange={(e) => setNewStaff({...newStaff, contactEmail: e.target.value})}
                          placeholder="john.smith@org.co.uk"
                          data-testid="input-staff-email"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Phone</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.contactPhone}
                          onChange={(e) => setNewStaff({...newStaff, contactPhone: e.target.value})}
                          placeholder="07xxx xxxxxx"
                          data-testid="input-staff-phone"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Gas Safe ID (if applicable)</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.gasRegistration}
                          onChange={(e) => setNewStaff({...newStaff, gasRegistration: e.target.value})}
                          placeholder="1234567"
                          data-testid="input-staff-gas-reg"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">NICEIC ID (if applicable)</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.electricalRegistration}
                          onChange={(e) => setNewStaff({...newStaff, electricalRegistration: e.target.value})}
                          placeholder="NICEIC-12345"
                          data-testid="input-staff-electrical-reg"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-600 text-slate-300">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createMutation.mutate(newStaff as any)}
                      disabled={!newStaff.companyName || !newStaff.tradeType || !newStaff.contactEmail}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-save-staff"
                    >
                      Add Staff Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatsCard
                title="Total Staff"
                value={staff.length.toString()}
                icon={Users}
                description="DLO operatives"
              />
              <StatsCard
                title="Active"
                value={activeStaff.length.toString()}
                icon={ShieldCheck}
                description="Currently active"
                status="success"
              />
              <StatsCard
                title="Pending Approval"
                value={pendingStaff.length.toString()}
                icon={Clock}
                description="Awaiting verification"
                status="warning"
              />
              <StatsCard
                title="Suspended"
                value={suspendedStaff.length.toString()}
                icon={ShieldAlert}
                description="Temporarily inactive"
                status="danger"
              />
            </div>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Staff Directory</CardTitle>
                    <CardDescription className="text-slate-400">Internal operatives and DLO team members</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input 
                      placeholder="Search staff..."
                      className="pl-9 bg-slate-800 border-slate-600 text-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-staff"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12 text-slate-400">Loading staff directory...</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No staff members found</p>
                    <p className="text-slate-500 text-sm mt-1">Add DLO operatives to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStaff.map((member: Contractor) => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors"
                        data-testid={`staff-row-${member.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                            <Users className="h-6 w-6 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{member.companyName}</h3>
                            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {member.tradeType}
                              </span>
                              {member.department && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {member.department}
                                </span>
                              )}
                              {member.employeeId && (
                                <span className="text-slate-500">ID: {member.employeeId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Mail className="h-3 w-3" />
                              {member.contactEmail}
                            </div>
                            {member.contactPhone && (
                              <div className="flex items-center gap-2 text-slate-500 mt-1">
                                <Phone className="h-3 w-3" />
                                {member.contactPhone}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {member.gasRegistration && (
                              <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                                <FileCheck className="h-3 w-3 mr-1" />
                                Gas Safe
                              </Badge>
                            )}
                            {member.electricalRegistration && (
                              <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                                <FileCheck className="h-3 w-3 mr-1" />
                                NICEIC
                              </Badge>
                            )}
                          </div>
                          {getStatusBadge(member.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
