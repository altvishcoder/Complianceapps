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
  Shield, 
  MoreHorizontal, 
  Mail, 
  Phone,
  CheckCircle2,
  AlertTriangle,
  Building,
  FileText,
  Plus
} from "lucide-react";
import { useState } from "react";
import { contractors, Contractor } from "@/lib/mock-data";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
  SheetFooter
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContractorsPage() {
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const handleEmail = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    toast({
      title: "Email Client Opened",
      description: `Drafting email to ${email}`,
    });
  };

  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    toast({
      title: "Calling Contractor",
      description: `Dialing ${phone}...`,
    });
  };

  const handleAddContractor = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddOpen(false);
    toast({
      title: "Contractor Added",
      description: "New contractor has been added to the approved list pending verification.",
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
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" placeholder="contact@company.com" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" placeholder="020..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Send Invitation</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contractors.map((contractor) => (
              <Card 
                key={contractor.id} 
                className="hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
                onClick={() => setSelectedContractor(contractor)}
              >
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
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
                      <Button variant="outline" size="sm" className="flex-1" onClick={(e) => handleEmail(e, contractor.email)}>
                        <Mail className="h-3 w-3 mr-2" />
                        Email
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={(e) => handleCall(e, contractor.phone)}>
                        <Phone className="h-3 w-3 mr-2" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Sheet open={!!selectedContractor} onOpenChange={(open) => !open && setSelectedContractor(null)}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
              {selectedContractor && (
                <>
                  <SheetHeader className="pb-6 border-b">
                    <div className="flex items-center gap-4 mb-2">
                      <Avatar className="h-16 w-16 border-2 border-primary/20">
                        <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                          {selectedContractor.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                         <SheetTitle className="text-xl">{selectedContractor.name}</SheetTitle>
                         <SheetDescription className="text-base">{selectedContractor.type}</SheetDescription>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                       <Badge className="bg-emerald-500">{selectedContractor.status}</Badge>
                       {selectedContractor.accreditations.map(acc => (
                         <Badge key={acc} variant="outline">{acc}</Badge>
                       ))}
                    </div>
                  </SheetHeader>
                  
                  <div className="space-y-6 py-6">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Contact Details</h3>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3 text-sm">
                           <Mail className="h-4 w-4 text-muted-foreground" />
                           <a href={`mailto:${selectedContractor.email}`} className="text-blue-600 hover:underline">{selectedContractor.email}</a>
                         </div>
                         <div className="flex items-center gap-3 text-sm">
                           <Phone className="h-4 w-4 text-muted-foreground" />
                           <span>{selectedContractor.phone}</span>
                         </div>
                         <div className="flex items-center gap-3 text-sm">
                           <Building className="h-4 w-4 text-muted-foreground" />
                           <span>{selectedContractor.address}</span>
                         </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Performance Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-3 bg-muted/30 rounded-lg border text-center">
                            <div className="text-2xl font-bold">{selectedContractor.jobs}</div>
                            <div className="text-xs text-muted-foreground">Active Jobs</div>
                         </div>
                         <div className="p-3 bg-muted/30 rounded-lg border text-center">
                            <div className="text-2xl font-bold">{selectedContractor.rating}</div>
                            <div className="text-xs text-muted-foreground">Quality Score</div>
                         </div>
                         <div className="p-3 bg-muted/30 rounded-lg border text-center">
                            <div className="text-2xl font-bold">98%</div>
                            <div className="text-xs text-muted-foreground">SLA Adherence</div>
                         </div>
                         <div className="p-3 bg-muted/30 rounded-lg border text-center">
                            <div className="text-2xl font-bold text-emerald-600">Valid</div>
                            <div className="text-xs text-muted-foreground">Insurance</div>
                         </div>
                      </div>
                    </div>

                    <div>
                       <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Recent Documents</h3>
                       <div className="space-y-2">
                          {[1, 2, 3].map(i => (
                             <div key={i} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                   <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center">
                                      <FileText className="h-4 w-4" />
                                   </div>
                                   <div>
                                      <div className="text-sm font-medium">Public Liability Insurance</div>
                                      <div className="text-xs text-muted-foreground">Exp: Dec 2026</div>
                                   </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                             </div>
                          ))}
                       </div>
                    </div>
                  </div>

                  <SheetFooter className="border-t pt-4">
                     <Button className="w-full" variant="outline">Edit Contractor Details</Button>
                  </SheetFooter>
                </>
              )}
            </SheetContent>
          </Sheet>

        </main>
      </div>
    </div>
  );
}
