import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
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
  Briefcase,
  Download,
  Upload
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
import type { StaffMember } from "@shared/schema";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "ACTIVE": return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    case "PENDING": return <Badge className="bg-orange-500 hover:bg-orange-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "INACTIVE": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>;
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newStaff, setNewStaff] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    employeeId: "",
    department: "",
    roleTitle: "",
    tradeSpecialism: "",
    gasSafeNumber: "",
    nicEicNumber: "",
    notes: ""
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
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        employeeId: "",
        department: "",
        roleTitle: "",
        tradeSpecialism: "",
        gasSafeNumber: "",
        nicEicNumber: "",
        notes: ""
      });
      toast({
        title: "Staff Member Added",
        description: "New staff member has been added to the directory.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: staffApi.bulkImport,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setIsImportOpen(false);
      toast({
        title: "Import Successful",
        description: `${data.created} staff members imported successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: "Error", description: "CSV file must have headers and at least one data row", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const staffList = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          if (values[index]) {
            row[header] = values[index];
          }
        });
        
        if (row.firstName && row.lastName && row.email) {
          staffList.push({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone || null,
            department: row.department || null,
            roleTitle: row.roleTitle || null,
            employeeId: row.employeeId || null,
            status: (row.status as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE') || 'ACTIVE',
            tradeSpecialism: row.tradeSpecialism || null,
            gasSafeNumber: row.gasSafeNumber || null,
            nicEicNumber: row.niceicNumber || null,
            notes: row.notes || null
          });
        }
      }

      if (staffList.length === 0) {
        toast({ title: "Error", description: "No valid staff records found in CSV", variant: "destructive" });
        return;
      }

      importMutation.mutate(staffList);
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    window.location.href = '/api/imports/template?type=staff';
  };

  const getFullName = (s: StaffMember) => `${s.firstName} ${s.lastName}`;

  const filteredStaff = staff.filter((s: StaffMember) => {
    const fullName = getFullName(s).toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) ||
      (s.email?.toLowerCase().includes(query)) ||
      (s.department?.toLowerCase().includes(query)) ||
      (s.employeeId?.toLowerCase().includes(query)) ||
      (s.roleTitle?.toLowerCase().includes(query));
  });

  const activeStaff = staff.filter((s: StaffMember) => s.status === 'ACTIVE');
  const pendingStaff = staff.filter((s: StaffMember) => s.status === 'PENDING');
  const suspendedStaff = staff.filter((s: StaffMember) => s.status === 'SUSPENDED');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Staff Directory" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-blue-400" />
                  Staff Directory
                </h1>
                <p className="text-sm text-slate-400 hidden sm:block">
                  Manage internal staff members and DLO operatives
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadTemplate} className="border-slate-600 text-slate-300" data-testid="button-download-template">
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-slate-600 text-slate-300" data-testid="button-import-staff">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">Import Staff from CSV</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Upload a CSV file to bulk import staff members. Download the template first for the correct format.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-csv-file"
                      />
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={importMutation.isPending}
                        data-testid="button-select-file"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {importMutation.isPending ? "Importing..." : "Select CSV File"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-staff">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Staff Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add Staff Member</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Add a new staff member to the directory.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">First Name *</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.firstName}
                            onChange={(e) => setNewStaff({...newStaff, firstName: e.target.value})}
                            placeholder="John"
                            data-testid="input-staff-firstname"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">Last Name *</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.lastName}
                            onChange={(e) => setNewStaff({...newStaff, lastName: e.target.value})}
                            placeholder="Smith"
                            data-testid="input-staff-lastname"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">Email *</Label>
                          <Input 
                            type="email"
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.email}
                            onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                            placeholder="john.smith@org.co.uk"
                            data-testid="input-staff-email"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">Phone</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.phone}
                            onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                            placeholder="07xxx xxxxxx"
                            data-testid="input-staff-phone"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">Role / Job Title</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.roleTitle}
                            onChange={(e) => setNewStaff({...newStaff, roleTitle: e.target.value})}
                            placeholder="Gas Engineer"
                            data-testid="input-staff-role"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">Trade Specialism</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.tradeSpecialism}
                            onChange={(e) => setNewStaff({...newStaff, tradeSpecialism: e.target.value})}
                            placeholder="Gas & Heating"
                            data-testid="input-staff-trade"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">Gas Safe ID</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.gasSafeNumber}
                            onChange={(e) => setNewStaff({...newStaff, gasSafeNumber: e.target.value})}
                            placeholder="1234567"
                            data-testid="input-staff-gas-safe"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">NICEIC ID</Label>
                          <Input 
                            className="bg-slate-800 border-slate-600 text-white mt-1"
                            value={newStaff.nicEicNumber}
                            onChange={(e) => setNewStaff({...newStaff, nicEicNumber: e.target.value})}
                            placeholder="NICEIC-12345"
                            data-testid="input-staff-niceic"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-300">Notes</Label>
                        <Input 
                          className="bg-slate-800 border-slate-600 text-white mt-1"
                          value={newStaff.notes}
                          onChange={(e) => setNewStaff({...newStaff, notes: e.target.value})}
                          placeholder="Additional notes..."
                          data-testid="input-staff-notes"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-600 text-slate-300">
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => createMutation.mutate(newStaff as any)}
                        disabled={!newStaff.firstName || !newStaff.lastName || !newStaff.email || createMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-save-staff"
                      >
                        {createMutation.isPending ? "Adding..." : "Add Staff Member"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <HeroStatsGrid stats={[
              {
                title: "Total Staff",
                value: staff.length,
                icon: Users,
                riskLevel: "good",
                subtitle: "Staff members",
                testId: "stat-total-staff"
              },
              {
                title: "Active",
                value: activeStaff.length,
                icon: ShieldCheck,
                riskLevel: "good",
                subtitle: "Currently active",
                testId: "stat-active-staff"
              },
              {
                title: "Pending",
                value: pendingStaff.length,
                icon: Clock,
                riskLevel: pendingStaff.length > 5 ? "high" : pendingStaff.length > 0 ? "medium" : "good",
                subtitle: "Pending activation",
                testId: "stat-pending-staff"
              },
              {
                title: "Suspended",
                value: suspendedStaff.length,
                icon: ShieldAlert,
                riskLevel: suspendedStaff.length > 0 ? "critical" : "good",
                subtitle: "Temporarily suspended",
                testId: "stat-suspended-staff"
              }
            ]} />

            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-white">Staff Directory</CardTitle>
                    <CardDescription className="text-slate-400 hidden sm:block">All staff members and operatives</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
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
                    <p className="text-slate-500 text-sm mt-1">Add staff members or import from CSV to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredStaff.map((member: StaffMember) => (
                      <div 
                        key={member.id} 
                        className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors"
                        data-testid={`staff-row-${member.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600/20 rounded-full flex items-center justify-center shrink-0">
                            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-white font-medium truncate">{getFullName(member)}</h3>
                              <div className="shrink-0">{getStatusBadge(member.status)}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-400 mt-1">
                              {member.roleTitle && (
                                <span className="flex items-center gap-1 truncate">
                                  <Briefcase className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{member.roleTitle}</span>
                                </span>
                              )}
                              {member.department && (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{member.department}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{member.email}</span>
                              </span>
                              {member.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {member.phone}
                                </span>
                              )}
                            </div>
                            {(member.gasSafeNumber || member.nicEicNumber || member.employeeId) && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {member.employeeId && (
                                  <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                                    ID: {member.employeeId}
                                  </Badge>
                                )}
                                {member.gasSafeNumber && (
                                  <Badge variant="outline" className="border-orange-500/50 text-orange-400 text-xs">
                                    <FileCheck className="h-3 w-3 mr-1" />
                                    Gas Safe
                                  </Badge>
                                )}
                                {member.nicEicNumber && (
                                  <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs">
                                    <FileCheck className="h-3 w-3 mr-1" />
                                    NICEIC
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
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
