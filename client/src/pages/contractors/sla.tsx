import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock,
  Plus,
  Settings,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  Edit,
  Trash2,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const WORK_CATEGORIES = [
  { value: "GAS_SAFETY", label: "Gas Safety" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "FIRE_SAFETY", label: "Fire Safety" },
  { value: "LEGIONELLA", label: "Legionella/Water" },
  { value: "ASBESTOS", label: "Asbestos" },
  { value: "LIFT_INSPECTION", label: "Lift Inspection" },
  { value: "GENERAL_MAINTENANCE", label: "General Maintenance" },
  { value: "EMERGENCY_REPAIR", label: "Emergency Repair" },
];

const PRIORITIES = [
  { value: "EMERGENCY", label: "Emergency", color: "bg-red-500", hours: 24 },
  { value: "URGENT", label: "Urgent", color: "bg-orange-500", hours: 72 },
  { value: "HIGH", label: "High", color: "bg-amber-500", hours: 168 },
  { value: "STANDARD", label: "Standard", color: "bg-blue-500", hours: 672 },
  { value: "LOW", label: "Low", color: "bg-slate-500", hours: 1440 },
];

const MOCK_SLA_PROFILES = [
  { id: "1", name: "Emergency Gas Leak", workCategory: "GAS_SAFETY", priority: "EMERGENCY", responseHours: 2, completionHours: 24, isActive: true },
  { id: "2", name: "Gas Boiler Repair", workCategory: "GAS_SAFETY", priority: "URGENT", responseHours: 4, completionHours: 72, isActive: true },
  { id: "3", name: "Annual Gas Safety Check", workCategory: "GAS_SAFETY", priority: "STANDARD", responseHours: 24, completionHours: 672, isActive: true },
  { id: "4", name: "Electrical Emergency", workCategory: "ELECTRICAL", priority: "EMERGENCY", responseHours: 2, completionHours: 24, isActive: true },
  { id: "5", name: "Periodic EICR", workCategory: "ELECTRICAL", priority: "STANDARD", responseHours: 48, completionHours: 672, isActive: true },
  { id: "6", name: "Fire Alarm Fault", workCategory: "FIRE_SAFETY", priority: "URGENT", responseHours: 4, completionHours: 48, isActive: true },
  { id: "7", name: "Fire Risk Assessment", workCategory: "FIRE_SAFETY", priority: "HIGH", responseHours: 24, completionHours: 168, isActive: true },
  { id: "8", name: "Legionella Assessment", workCategory: "LEGIONELLA", priority: "STANDARD", responseHours: 48, completionHours: 672, isActive: true },
];

const MOCK_ACTIVE_JOBS = [
  { id: "1", contractor: "SafeGas Ltd", job: "Gas Boiler Repair", property: "12 High Street", priority: "URGENT", assignedAt: new Date(Date.now() - 18 * 60 * 60 * 1000), deadline: new Date(Date.now() + 54 * 60 * 60 * 1000), status: "ON_TRACK" },
  { id: "2", contractor: "ElecPro Services", job: "Emergency Lighting Test", property: "Victoria House", priority: "HIGH", assignedAt: new Date(Date.now() - 96 * 60 * 60 * 1000), deadline: new Date(Date.now() + 72 * 60 * 60 * 1000), status: "ON_TRACK" },
  { id: "3", contractor: "FireSafe UK", job: "Fire Door Inspection", property: "Westminster Block", priority: "HIGH", assignedAt: new Date(Date.now() - 140 * 60 * 60 * 1000), deadline: new Date(Date.now() + 28 * 60 * 60 * 1000), status: "AT_RISK" },
  { id: "4", contractor: "BuildFix Ltd", job: "Roof Leak Repair", property: "Oak Lane Estate", priority: "URGENT", assignedAt: new Date(Date.now() - 80 * 60 * 60 * 1000), deadline: new Date(Date.now() - 8 * 60 * 60 * 1000), status: "BREACHED" },
];

const getSLAStatusBadge = (status: string) => {
  switch (status) {
    case "ON_TRACK":
      return <Badge className="bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />On Track</Badge>;
    case "AT_RISK":
      return <Badge className="bg-amber-500"><AlertTriangle className="h-3 w-3 mr-1" />At Risk</Badge>;
    case "BREACHED":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Breached</Badge>;
    case "COMPLETED":
      return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    case "COMPLETED_LATE":
      return <Badge className="bg-orange-500"><Clock className="h-3 w-3 mr-1" />Late</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getPriorityBadge = (priority: string) => {
  const p = PRIORITIES.find(pr => pr.value === priority);
  return <Badge className={p?.color || "bg-slate-500"}>{p?.label || priority}</Badge>;
};

const formatTimeRemaining = (deadline: Date) => {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (diff < 0) {
    return <span className="text-red-600 font-medium">-{days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`} overdue</span>;
  }
  if (hours < 24) {
    return <span className={hours < 8 ? "text-amber-600" : ""}>{hours}h remaining</span>;
  }
  return <span>{days}d {hours % 24}h remaining</span>;
};

const calculateProgress = (assignedAt: Date, deadline: Date) => {
  const now = new Date();
  const total = deadline.getTime() - assignedAt.getTime();
  const elapsed = now.getTime() - assignedAt.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return progress;
};

export default function SLATrackingPage() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "",
    workCategory: "",
    priority: "",
    responseHours: "",
    completionHours: ""
  });

  const handleAddProfile = () => {
    toast({
      title: "SLA Profile Created",
      description: `${newProfile.name} has been added.`,
    });
    setIsAddOpen(false);
    setNewProfile({ name: "", workCategory: "", priority: "", responseHours: "", completionHours: "" });
  };

  return (
    <PageLayout title="SLA Tracking" pageTitle="SLA Tracking & Accountability">
      <div className="space-y-6">
        <Tabs defaultValue="active" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="active" data-testid="tab-active-jobs">Active Jobs</TabsTrigger>
              <TabsTrigger value="profiles" data-testid="tab-sla-profiles">SLA Profiles</TabsTrigger>
              <TabsTrigger value="breaches" data-testid="tab-breaches">Breach History</TabsTrigger>
            </TabsList>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button data-testid="btn-add-sla-profile">
                  <Plus className="h-4 w-4 mr-2" />
                  Add SLA Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create SLA Profile</DialogTitle>
                  <DialogDescription>Define a new SLA profile for contractor work</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Profile Name</Label>
                    <Input 
                      placeholder="e.g., Emergency Gas Leak Response"
                      value={newProfile.name}
                      onChange={(e) => setNewProfile(p => ({ ...p, name: e.target.value }))}
                      data-testid="input-profile-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Work Category</Label>
                      <Select 
                        value={newProfile.workCategory}
                        onValueChange={(v) => setNewProfile(p => ({ ...p, workCategory: v }))}
                      >
                        <SelectTrigger data-testid="select-work-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority Level</Label>
                      <Select 
                        value={newProfile.priority}
                        onValueChange={(v) => setNewProfile(p => ({ ...p, priority: v }))}
                      >
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Response Time (hours)</Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 4"
                        value={newProfile.responseHours}
                        onChange={(e) => setNewProfile(p => ({ ...p, responseHours: e.target.value }))}
                        data-testid="input-response-hours"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Completion Time (hours)</Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 72"
                        value={newProfile.completionHours}
                        onChange={(e) => setNewProfile(p => ({ ...p, completionHours: e.target.value }))}
                        data-testid="input-completion-hours"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddProfile} data-testid="btn-save-profile">Create Profile</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Active Job Tracking
                </CardTitle>
                <CardDescription>Monitor contractor jobs against SLA deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_ACTIVE_JOBS.map((job) => {
                      const progress = calculateProgress(job.assignedAt, job.deadline);
                      return (
                        <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                          <TableCell className="font-medium">{job.contractor}</TableCell>
                          <TableCell>{job.job}</TableCell>
                          <TableCell className="text-muted-foreground">{job.property}</TableCell>
                          <TableCell>{getPriorityBadge(job.priority)}</TableCell>
                          <TableCell className="w-32">
                            <Progress 
                              value={progress} 
                              className={`h-2 ${progress > 90 ? '[&>div]:bg-red-500' : progress > 75 ? '[&>div]:bg-amber-500' : ''}`}
                            />
                          </TableCell>
                          <TableCell>{formatTimeRemaining(job.deadline)}</TableCell>
                          <TableCell>{getSLAStatusBadge(job.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  SLA Profile Configuration
                </CardTitle>
                <CardDescription>Define response and completion time targets by work type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile Name</TableHead>
                      <TableHead>Work Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Completion Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_SLA_PROFILES.map((profile) => (
                      <TableRow key={profile.id} data-testid={`row-profile-${profile.id}`}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {WORK_CATEGORIES.find(c => c.value === profile.workCategory)?.label || profile.workCategory}
                          </Badge>
                        </TableCell>
                        <TableCell>{getPriorityBadge(profile.priority)}</TableCell>
                        <TableCell>{profile.responseHours}h</TableCell>
                        <TableCell>{profile.completionHours}h ({Math.round(profile.completionHours / 24)}d)</TableCell>
                        <TableCell>
                          {profile.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" data-testid={`btn-edit-${profile.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" data-testid={`btn-delete-${profile.id}`}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breaches">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  SLA Breach History
                </CardTitle>
                <CardDescription>Track and analyse past SLA breaches for accountability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">12</div>
                      <p className="text-sm text-red-600/80">Total Breaches (30 days)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-amber-600">3</div>
                      <p className="text-sm text-amber-600/80">Repeat Offenders</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-50 dark:bg-slate-950/20">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">8.5h</div>
                      <p className="text-sm text-muted-foreground">Avg Breach Duration</p>
                    </CardContent>
                  </Card>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Breach Duration</TableHead>
                      <TableHead>Root Cause</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>28 Dec 2025</TableCell>
                      <TableCell className="font-medium">BuildFix Ltd</TableCell>
                      <TableCell>Roof Leak Repair</TableCell>
                      <TableCell>{getPriorityBadge("URGENT")}</TableCell>
                      <TableCell className="text-red-600">+8h</TableCell>
                      <TableCell className="text-muted-foreground">Parts unavailable</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>22 Dec 2025</TableCell>
                      <TableCell className="font-medium">Maintenance Pro</TableCell>
                      <TableCell>Emergency Lighting</TableCell>
                      <TableCell>{getPriorityBadge("HIGH")}</TableCell>
                      <TableCell className="text-red-600">+14h</TableCell>
                      <TableCell className="text-muted-foreground">Staff shortage</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>18 Dec 2025</TableCell>
                      <TableCell className="font-medium">BuildFix Ltd</TableCell>
                      <TableCell>Window Repair</TableCell>
                      <TableCell>{getPriorityBadge("STANDARD")}</TableCell>
                      <TableCell className="text-red-600">+24h</TableCell>
                      <TableCell className="text-muted-foreground">Access issues</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
