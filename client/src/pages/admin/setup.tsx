import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Mail, Building, Lock, AlertTriangle, Database, Trash2, RefreshCw, Play, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminSetup() {
  useEffect(() => {
    document.title = "System Settings - ComplianceAI";
  }, []);

  const [, setLocation] = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role === "super_admin" || role === "SUPER_ADMIN" || role === "LASHAN_SUPER_USER" || role === "SYSTEM_ADMIN") {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

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
              You do not have permission to view System Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="bg-destructive/5 border border-destructive/20 p-3 rounded text-sm text-destructive/80 flex gap-2 items-start">
               <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
               <p>This area is restricted to Administrator accounts only.</p>
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
        <Header title="System Settings" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="System settings content">
          
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display">System Settings</h2>
                <p className="text-muted-foreground">Configure system settings and manage demo data.</p>
              </div>
              <Link href="/admin/users">
                <Button variant="outline">
                  <Shield className="mr-2 h-4 w-4" />
                  User Management
                </Button>
              </Link>
            </div>

            <Tabs defaultValue="setup" className="space-y-4">
              <TabsList>
                <TabsTrigger value="setup">Organization Settings</TabsTrigger>
                <TabsTrigger value="demo">Demo Data</TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Configuration</CardTitle>
                    <CardDescription>Configure the organization name and default settings.</CardDescription>
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
