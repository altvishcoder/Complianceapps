import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, UserPlus, Users, Key, Mail, Building } from "lucide-react";

export default function AdminSetup() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Administration" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display">User Management</h2>
                <p className="text-muted-foreground">Manage access controls and system accounts.</p>
              </div>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite New User
              </Button>
            </div>

            <Tabs defaultValue="users" className="space-y-4">
              <TabsList>
                <TabsTrigger value="users">Active Users</TabsTrigger>
                <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
                <TabsTrigger value="setup">Initial Setup</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>System Accounts</CardTitle>
                    <CardDescription>Manage user access levels and authentication methods.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                          <tr>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Last Active</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            { name: "Sarah Jenkins", email: "sarah.j@compliance.co.uk", role: "Admin", status: "Active", last: "Just now" },
                            { name: "Mike Ross", email: "mike.r@compliance.co.uk", role: "Surveyor", status: "Active", last: "2h ago" },
                            { name: "Compliance Team", email: "team@compliance.co.uk", role: "Viewer", status: "Invited", last: "-" },
                          ].map((user, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                    {user.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                  {user.role}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-emerald-600/20 bg-emerald-50 text-emerald-700">
                                  {user.status}
                                </span>
                              </td>
                              <td className="p-4 text-muted-foreground">{user.last}</td>
                              <td className="p-4 text-right">
                                <Button variant="ghost" size="sm">Edit</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="setup" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Default Account Configuration</CardTitle>
                    <CardDescription>Configure the primary administrator account and default settings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Organization Name</Label>
                        <div className="relative">
                          <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input defaultValue="Acme Housing Association" className="pl-9" />
                        </div>
                      </div>
                      <div className="space-y-2">
                         <Label>Admin Email</Label>
                         <div className="relative">
                           <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input defaultValue="admin@acme-housing.co.uk" className="pl-9" />
                         </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Default MFA Policy</Label>
                      <Select defaultValue="strict">
                        <SelectTrigger>
                          <SelectValue placeholder="Select policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">Strict (MFA Required for All)</SelectItem>
                          <SelectItem value="optional">Optional (User Discretion)</SelectItem>
                          <SelectItem value="admin_only">Admin Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button>Save Configuration</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

        </main>
      </div>
    </div>
  );
}
