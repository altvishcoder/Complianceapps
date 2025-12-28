import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, UserPlus, Users, Key, Mail, Building, Lock, AlertTriangle, Database, Trash2, RefreshCw, Play, Crown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { adminApi, usersApi, type SafeUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminSetup() {
  useEffect(() => {
    document.title = "System Administration - ComplianceAI";
  }, []);

  const [, setLocation] = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const userId = localStorage.getItem("user_id");
    if (role === "super_admin" || role === "SUPER_ADMIN") {
      setIsAuthorized(true);
      setCurrentUserId(userId);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled: isAuthorized,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => 
      usersApi.updateRole(userId, role, currentUserId || ''),
    onSuccess: () => {
      toast({ title: "Success", description: "User role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const wipeDataMutation = useMutation({
    mutationFn: (includeProperties: boolean) => adminApi.wipeData(includeProperties),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedDemoMutation = useMutation({
    mutationFn: () => adminApi.seedDemo(),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetDemoMutation = useMutation({
    mutationFn: () => adminApi.resetDemo(),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = wipeDataMutation.isPending || seedDemoMutation.isPending || resetDemoMutation.isPending;

  if (!isAuthorized) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <Card className="max-w-md w-full border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2 text-destructive">
               <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view the System Administration area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="bg-destructive/5 border border-destructive/20 p-3 rounded text-sm text-destructive/80 flex gap-2 items-start">
               <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
               <p>This area is restricted to Super Administrator accounts only.</p>
             </div>
             <Button className="w-full" variant="outline" onClick={() => setLocation("/dashboard")}>
               Return to Dashboard
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Administration" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="System administration content">
          
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
                <TabsTrigger value="demo">Demo Data</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>System Accounts</CardTitle>
                    <CardDescription>Manage user access levels and authentication methods. Only the Super Admin can change user roles.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : users.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No users found. Create users through the registration system.
                      </div>
                    ) : (
                    <div className="rounded-md border">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                          <tr>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Change Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-muted/20">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${user.role === 'SUPER_ADMIN' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' : 'bg-primary/10 text-primary'}`}>
                                    {user.role === 'SUPER_ADMIN' ? <Crown className="h-4 w-4" /> : user.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      {user.name}
                                      {user.role === 'SUPER_ADMIN' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">SUPER ADMIN</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  user.role === 'SUPER_ADMIN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  user.role === 'ADMIN' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  user.role === 'MANAGER' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  user.role === 'OFFICER' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {user.role.replace('_', ' ')}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-emerald-600/20 bg-emerald-50 text-emerald-700">
                                  Active
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Select
                                  value={user.role}
                                  onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, role: newRole })}
                                  disabled={updateRoleMutation.isPending || user.id === currentUserId}
                                >
                                  <SelectTrigger className="w-[140px]" data-testid={`role-select-${user.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="OFFICER">Officer</SelectItem>
                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
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

              <TabsContent value="demo" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Demo Data Management
                    </CardTitle>
                    <CardDescription>
                      Manage demonstration data for testing and training purposes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                      <div className="flex gap-2 items-start">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800">Important</p>
                          <p className="text-sm text-amber-700">
                            These actions modify your database. Wipe operations cannot be undone.
                            Make sure you have a backup before proceeding.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Play className="h-4 w-4 text-emerald-600" />
                            Load Demo Data
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Add sample schemes, blocks, and properties for demonstration purposes.
                          </p>
                          <Button 
                            className="w-full"
                            variant="outline"
                            onClick={() => seedDemoMutation.mutate()}
                            disabled={isLoading}
                            data-testid="button-seed-demo"
                          >
                            {seedDemoMutation.isPending ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Load Demo Data
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-orange-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-orange-600" />
                            Wipe All Data
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Remove all data including properties, schemes, blocks, certificates, and AI model data.
                          </p>
                          <Button 
                            className="w-full"
                            variant="outline"
                            onClick={() => wipeDataMutation.mutate(true)}
                            disabled={isLoading}
                            data-testid="button-wipe-data"
                          >
                            {wipeDataMutation.isPending ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Wiping...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Wipe All Data
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-red-600" />
                            Reset Demo
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Wipe everything and start fresh with new demo data.
                          </p>
                          <Button 
                            className="w-full"
                            variant="destructive"
                            onClick={() => resetDemoMutation.mutate()}
                            disabled={isLoading}
                            data-testid="button-reset-demo"
                          >
                            {resetDemoMutation.isPending ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Resetting...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reset Demo
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
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
