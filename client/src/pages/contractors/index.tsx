import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Search, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal, 
  Mail, 
  Phone,
  Shield
} from "lucide-react";

export default function ContractorsPage() {
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
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Add Contractor
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Gas Safe Pros Ltd", type: "Gas & Heating", status: "Approved", staff: 12, jobs: 45, rating: 4.8 },
              { name: "Sparky's Electric", type: "Electrical", status: "Approved", staff: 8, jobs: 22, rating: 4.5 },
              { name: "CleanTeam Services", type: "Cleaning & Hygiene", status: "Pending", staff: 24, jobs: 0, rating: "-" },
              { name: "Secure Fire Safety", type: "Fire Protection", status: "Approved", staff: 5, jobs: 18, rating: 4.9 },
              { name: "BuildRight Construction", type: "General Building", status: "Suspended", staff: 15, jobs: 2, rating: 3.2 },
            ].map((contractor, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{contractor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{contractor.name}</CardTitle>
                      <CardDescription>{contractor.type}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Badge variant={
                        contractor.status === 'Approved' ? 'default' : 
                        contractor.status === 'Pending' ? 'secondary' : 'destructive'
                      } className={
                        contractor.status === 'Approved' ? 'bg-emerald-500 hover:bg-emerald-600' : ''
                      }>
                        {contractor.status}
                      </Badge>
                      {contractor.status === 'Approved' && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Shield className="h-3 w-3 mr-1 text-emerald-500" />
                          Verified
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-sm border-t pt-4">
                      <div>
                        <div className="font-bold">{contractor.staff}</div>
                        <div className="text-xs text-muted-foreground">Engineers</div>
                      </div>
                      <div>
                        <div className="font-bold">{contractor.jobs}</div>
                        <div className="text-xs text-muted-foreground">Active Jobs</div>
                      </div>
                      <div>
                        <div className="font-bold">{contractor.rating}</div>
                        <div className="text-xs text-muted-foreground">Rating</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Mail className="h-3 w-3 mr-2" />
                        Email
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Phone className="h-3 w-3 mr-2" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
