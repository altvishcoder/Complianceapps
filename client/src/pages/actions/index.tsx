import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  AlertOctagon, 
  AlertTriangle, 
  Wrench, 
  CheckCircle2, 
  Clock,
  Search,
  Filter
} from "lucide-react";

export default function ActionsPage() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Remedial Actions" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search actions..." className="pl-9" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
              <Button>Export List</Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Open</p>
                  <h3 className="text-2xl font-bold mt-1">24</h3>
                </div>
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Emergency</p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-600">3</h3>
                </div>
                <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                  <AlertOctagon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <h3 className="text-2xl font-bold mt-1">8</h3>
                </div>
                <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved (30d)</p>
                  <h3 className="text-2xl font-bold mt-1 text-emerald-600">15</h3>
                </div>
                <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Action Required</CardTitle>
              <CardDescription>Remedial works identified from recent inspections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: "ACT-1024", prop: "12 Green Lane", issue: "C1 Danger Present - Exposed Live Conductors", source: "EICR", severity: "IMMEDIATE", status: "Open", assigned: "Sparky's Electric", due: "Today" },
                  { id: "ACT-1025", prop: "Flat 4, Oak House", issue: "Boiler Pressure Loss", source: "Tenant Report", severity: "URGENT", status: "In Progress", assigned: "Gas Safe Pros", due: "Tomorrow" },
                  { id: "ACT-1022", prop: "The Towers (Block A)", issue: "Fire Door Gap > 3mm", source: "FRA", severity: "PRIORITY", status: "Open", assigned: "Unassigned", due: "7 Days" },
                  { id: "ACT-1020", prop: "56 Maple Drive", issue: "Mould Wash Required", source: "Damp Survey", severity: "ROUTINE", status: "Scheduled", assigned: "CleanTeam Ltd", due: "14 Days" },
                ].map((action) => (
                  <div key={action.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors gap-4">
                    <div className="flex gap-4">
                      <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                        action.severity === 'IMMEDIATE' ? 'bg-rose-600 animate-pulse' : 
                        action.severity === 'URGENT' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{action.prop}</span>
                          <span className="text-xs text-muted-foreground">#{action.id}</span>
                        </div>
                        <p className="text-sm font-medium">{action.issue}</p>
                        <p className="text-xs text-muted-foreground mt-1">Source: {action.source} • Assigned: {action.assigned}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right mr-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Due</div>
                        <div className={`text-sm font-bold ${action.due === 'Today' ? 'text-rose-600' : ''}`}>{action.due}</div>
                      </div>
                      <Badge variant={
                        action.status === 'Open' ? 'destructive' :
                        action.status === 'In Progress' ? 'secondary' : 'outline'
                      }>
                        {action.status}
                      </Badge>
                      <Button variant="ghost" size="sm">Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
