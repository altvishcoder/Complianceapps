import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings, Shield, Upload, Zap, Webhook, Cpu, Lock, AlertTriangle, Save, RotateCcw, Loader2, Database, Play, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";

interface FactorySetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  valueType: string;
  category: string;
  isEditable: boolean;
  validationRules: { min?: number; max?: number } | null;
  updatedAt: string;
}

interface SettingsResponse {
  settings: FactorySetting[];
  grouped: Record<string, FactorySetting[]>;
}

const categoryIcons: Record<string, React.ElementType> = {
  RATE_LIMITING: Shield,
  UPLOADS: Upload,
  INGESTION: Zap,
  SECURITY: Lock,
  WEBHOOKS: Webhook,
  AI: Cpu,
  DEMO_DATA: Database,
};

const categoryLabels: Record<string, string> = {
  RATE_LIMITING: "Rate Limiting",
  UPLOADS: "Upload Settings",
  INGESTION: "Ingestion Pipeline",
  SECURITY: "API Security",
  WEBHOOKS: "Webhooks",
  AI: "AI Extraction",
  DEMO_DATA: "Demo Data",
};

export default function FactorySettings() {
  useEffect(() => {
    document.title = "Factory Settings - ComplianceAI";
  }, []);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ key: string; value: string } | null>(null);
  const [activeTab, setActiveTab] = useState("RATE_LIMITING");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role === "LASHAN_SUPER_USER" || role === "lashan_super_user" || 
        role === "super_admin" || role === "SUPER_ADMIN") {
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

  const isDemoLoading = wipeDataMutation.isPending || seedDemoMutation.isPending || resetDemoMutation.isPending;

  const userId = typeof window !== 'undefined' ? localStorage.getItem("user_id") : null;
  
  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ["factorySettings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/factory-settings", {
        headers: {
          'X-User-Id': userId || ''
        }
      });
      if (!res.ok) throw new Error("Failed to load factory settings");
      return res.json();
    },
    enabled: isAuthorized && !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch(`/api/admin/factory-settings/${key}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Id": userId || ''
        },
        body: JSON.stringify({ value, userId: userId || "system" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update setting");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ description: `${variables.key} has been updated.` });
      queryClient.invalidateQueries({ queryKey: ["factorySettings"] });
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[variables.key];
        return next;
      });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
      setConfirmDialog(null);
    },
  });

  const handleValueChange = (key: string, value: string) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (setting: FactorySetting) => {
    const newValue = pendingChanges[setting.key];
    if (newValue === undefined) return;
    
    if (setting.category === "RATE_LIMITING" || setting.category === "SECURITY") {
      setConfirmDialog({ key: setting.key, value: newValue });
    } else {
      updateMutation.mutate({ key: setting.key, value: newValue });
    }
  };

  const handleReset = (key: string) => {
    setPendingChanges(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const confirmSave = () => {
    if (confirmDialog) {
      updateMutation.mutate({ key: confirmDialog.key, value: confirmDialog.value });
    }
  };

  const getCurrentValue = (setting: FactorySetting) => {
    return pendingChanges[setting.key] ?? setting.value;
  };

  const hasChanges = (key: string) => {
    return pendingChanges[key] !== undefined;
  };

  const renderSettingInput = (setting: FactorySetting) => {
    const value = getCurrentValue(setting);
    const changed = hasChanges(setting.key);

    if (setting.valueType === "boolean") {
      return (
        <div className="flex items-center gap-3">
          <Switch
            data-testid={`switch-${setting.key}`}
            checked={value === "true"}
            onCheckedChange={(checked) => handleValueChange(setting.key, checked ? "true" : "false")}
            disabled={!setting.isEditable}
          />
          <span className="text-sm text-muted-foreground">
            {value === "true" ? "Enabled" : "Disabled"}
          </span>
          {changed && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleReset(setting.key)}
              data-testid={`reset-${setting.key}`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Input
          data-testid={`input-${setting.key}`}
          type={setting.valueType === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => handleValueChange(setting.key, e.target.value)}
          disabled={!setting.isEditable}
          className={`w-48 ${changed ? "border-amber-500" : ""}`}
          min={setting.validationRules?.min}
          max={setting.validationRules?.max}
        />
        {setting.validationRules && (
          <span className="text-xs text-muted-foreground">
            ({setting.validationRules.min} - {setting.validationRules.max})
          </span>
        )}
        {changed && (
          <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleSave(setting)}
              disabled={updateMutation.isPending}
              data-testid={`save-${setting.key}`}
            >
              {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleReset(setting.key)}
              data-testid={`reset-${setting.key}`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    );
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-start" data-testid="page-factory-settings">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <Header title="Factory Settings" />
          <main className="flex-1 p-6 overflow-auto">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Access Denied. Factory Settings are only accessible to Lashan Super Users.
              </AlertDescription>
            </Alert>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start" data-testid="page-factory-settings">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header title="Factory Settings" />
        <main className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Factory Settings</h1>
              <p className="text-sm text-muted-foreground">
                System-wide configuration for rate limiting, uploads, and API behavior. Changes are logged for audit purposes.
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500 text-emerald-600">
              <Lock className="h-3 w-3 mr-1" />
              Lashan Super User Only
            </Badge>
          </div>

          {Object.keys(pendingChanges).length > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                You have {Object.keys(pendingChanges).length} unsaved change(s). Click save on each setting to apply.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Failed to load factory settings. Please try again.</AlertDescription>
            </Alert>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-7">
                {Object.keys(categoryLabels).map((cat) => {
                  const Icon = categoryIcons[cat] || Settings;
                  return (
                    <TabsTrigger key={cat} value={cat} className="flex items-center gap-2" data-testid={`tab-${cat.toLowerCase()}`}>
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{categoryLabels[cat]}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {Object.entries(data?.grouped || {}).map(([category, settings]) => (
                <TabsContent key={category} value={category}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {(() => {
                          const Icon = categoryIcons[category] || Settings;
                          return <Icon className="h-5 w-5" />;
                        })()}
                        {categoryLabels[category] || category}
                      </CardTitle>
                      <CardDescription>
                        Configure {categoryLabels[category]?.toLowerCase() || category.toLowerCase()} settings for the API.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {settings.map((setting) => (
                        <div key={setting.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b last:border-0">
                          <div>
                            <Label className="font-medium">{setting.key.replace(/_/g, " ")}</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {setting.description}
                            </p>
                            {!setting.isEditable && (
                              <Badge variant="secondary" className="mt-2">
                                <Lock className="h-3 w-3 mr-1" />
                                Read-only
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center">
                            {renderSettingInput(setting)}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}

              <TabsContent value="DEMO_DATA">
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
                            disabled={isDemoLoading}
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
                            disabled={isDemoLoading}
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
                            disabled={isDemoLoading}
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
          )}
        </main>
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Critical Setting Change</DialogTitle>
            <DialogDescription>
              You are about to change a critical system setting. This may affect API rate limits or security behavior across all clients.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">
                Setting: {confirmDialog?.key}
              </p>
              <p className="text-sm text-amber-600 mt-1">
                New Value: {confirmDialog?.value}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} data-testid="cancel-confirm">
              Cancel
            </Button>
            <Button 
              onClick={confirmSave} 
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="confirm-save"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
