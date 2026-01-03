import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Upload, Zap, Webhook, Cpu, Lock, AlertTriangle, Save, RotateCcw, Loader2, Database, Play, Trash2, RefreshCw, Settings, ChevronRight, ChevronDown, Globe, Search, FileText, Scale, Plus, Edit, X, Check, Menu } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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
  REGIONAL: Globe,
  EXTRACTION: Cpu,
  JOB_QUEUE: Zap,
  CACHING: Database,
  GEOCODING: Globe,
  DETECTION_PATTERNS: Search,
  OUTCOME_RULES: Scale,
  api_limits: Shield,
};

const categoryLabels: Record<string, string> = {
  RATE_LIMITING: "Rate Limiting",
  UPLOADS: "Upload Settings",
  INGESTION: "Ingestion Pipeline",
  SECURITY: "API Security",
  WEBHOOKS: "Webhooks",
  AI: "AI Extraction",
  DEMO_DATA: "Demo Data",
  REGIONAL: "Regional Settings",
  EXTRACTION: "Extraction",
  JOB_QUEUE: "Job Queue",
  CACHING: "Caching",
  GEOCODING: "Geocoding",
  DETECTION_PATTERNS: "Detection Patterns",
  OUTCOME_RULES: "Outcome Rules",
  api_limits: "API Limits & Throttling",
};

const categoryDescriptions: Record<string, string> = {
  RATE_LIMITING: "Control API request limits and throttling behavior",
  UPLOADS: "Configure file upload limits and allowed file types",
  INGESTION: "Settings for document ingestion and processing pipeline",
  SECURITY: "API security and authentication settings",
  WEBHOOKS: "Webhook endpoints and notification settings",
  AI: "AI extraction model configuration and thresholds",
  DEMO_DATA: "Manage demonstration data for testing",
  REGIONAL: "Regional and locale settings (dates, currency, etc.)",
  EXTRACTION: "Document extraction rules and patterns",
  JOB_QUEUE: "Background job processing configuration",
  CACHING: "Cache settings and expiration policies",
  GEOCODING: "Address lookup and geocoding settings",
  DETECTION_PATTERNS: "Configure patterns for automatic certificate type detection from filenames and content",
  OUTCOME_RULES: "Configure rules for interpreting compliance outcomes from extracted data",
  api_limits: "Configure pagination limits, rate limiting, and system protection settings for all API endpoints",
};

interface DetectionPattern {
  id: string;
  certificateTypeCode: string;
  patternType: 'FILENAME' | 'TEXT_CONTENT';
  matcherType: 'CONTAINS' | 'REGEX' | 'STARTS_WITH' | 'ENDS_WITH';
  pattern: string;
  priority: number;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
}

interface OutcomeRule {
  id: string;
  certificateTypeCode: string;
  ruleName: string;
  ruleGroup: string | null;
  fieldPath: string;
  operator: string;
  value: string | null;
  outcome: string;
  priority: number;
  description: string | null;
  legislation: string | null;
  isActive: boolean;
  isSystem: boolean;
}

export default function FactorySettings() {
  useEffect(() => {
    document.title = "Factory Settings - ComplianceAI";
  }, []);

  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ key: string; value: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState("RATE_LIMITING");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const userRole = user?.role || "";
  const isAuthorized = userRole === "LASHAN_SUPER_USER" || userRole === "lashan_super_user" || 
                       userRole === "super_admin" || userRole === "SUPER_ADMIN";

  if (authLoading) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="text-center">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Please log in to access this page</p>
        </div>
      </div>
    );
  }

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
  
  const [patternFilter, setPatternFilter] = useState("");
  const [ruleFilter, setRuleFilter] = useState("");
  
  const { data: detectionPatterns, isLoading: patternsLoading } = useQuery<DetectionPattern[]>({
    queryKey: ["detectionPatterns"],
    queryFn: async () => {
      const res = await fetch("/api/config/detection-patterns", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to load detection patterns");
      return res.json();
    },
    enabled: isAuthorized && !!user?.id && activeCategory === "DETECTION_PATTERNS",
  });

  const { data: outcomeRules, isLoading: rulesLoading } = useQuery<OutcomeRule[]>({
    queryKey: ["outcomeRules"],
    queryFn: async () => {
      const res = await fetch("/api/config/outcome-rules", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to load outcome rules");
      return res.json();
    },
    enabled: isAuthorized && !!user?.id && activeCategory === "OUTCOME_RULES",
  });

  const togglePatternMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/config/detection-patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update pattern");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Pattern updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["detectionPatterns"] });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/config/outcome-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Rule updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["outcomeRules"] });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });
  
  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ["factorySettings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/factory-settings", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to load factory settings");
      return res.json();
    },
    enabled: isAuthorized && !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch(`/api/admin/factory-settings/${key}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify({ value }),
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
            <div className="flex gap-1">
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
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            data-testid={`input-${setting.key}`}
            type={setting.valueType === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            disabled={!setting.isEditable}
            className={`w-full sm:w-48 ${changed ? "border-amber-500" : ""}`}
            min={setting.validationRules?.min}
            max={setting.validationRules?.max}
          />
          {changed && (
            <div className="flex items-center gap-1 shrink-0">
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
            </div>
          )}
        </div>
        {setting.validationRules && (
          <span className="text-xs text-muted-foreground">
            ({setting.validationRules.min} - {setting.validationRules.max})
          </span>
        )}
      </div>
    );
  };

  const availableCategories = data?.grouped ? Object.keys(data.grouped) : [];
  const allCategories = Array.from(new Set([...Object.keys(categoryLabels), ...availableCategories]));

  const filteredPatterns = detectionPatterns?.filter(p => 
    !patternFilter || 
    p.certificateTypeCode.toLowerCase().includes(patternFilter.toLowerCase()) ||
    p.pattern.toLowerCase().includes(patternFilter.toLowerCase()) ||
    p.description?.toLowerCase().includes(patternFilter.toLowerCase())
  ) || [];

  const filteredRules = outcomeRules?.filter(r => 
    !ruleFilter || 
    r.certificateTypeCode.toLowerCase().includes(ruleFilter.toLowerCase()) ||
    r.ruleName.toLowerCase().includes(ruleFilter.toLowerCase()) ||
    r.fieldPath.toLowerCase().includes(ruleFilter.toLowerCase())
  ) || [];

  const patternsByType = filteredPatterns.reduce((acc, p) => {
    if (!acc[p.certificateTypeCode]) acc[p.certificateTypeCode] = [];
    acc[p.certificateTypeCode].push(p);
    return acc;
  }, {} as Record<string, DetectionPattern[]>);

  const rulesByType = filteredRules.reduce((acc, r) => {
    if (!acc[r.certificateTypeCode]) acc[r.certificateTypeCode] = [];
    acc[r.certificateTypeCode].push(r);
    return acc;
  }, {} as Record<string, OutcomeRule[]>);

  const renderCategoryContent = () => {
    if (activeCategory === "DETECTION_PATTERNS") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Certificate Detection Patterns
            </CardTitle>
            <CardDescription>
              Configure how certificates are automatically identified from filenames and document content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter patterns..."
                value={patternFilter}
                onChange={(e) => setPatternFilter(e.target.value)}
                className="max-w-sm"
                data-testid="input-pattern-filter"
              />
              {patternFilter && (
                <Button variant="ghost" size="sm" onClick={() => setPatternFilter("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Badge variant="secondary">{filteredPatterns.length} patterns</Badge>
            </div>

            {patternsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(patternsByType).map(([certType, patterns]) => (
                    <Card key={certType} className="border">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {certType.replace(/_/g, " ")}
                          </CardTitle>
                          <Badge variant="outline">{patterns.length} patterns</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="space-y-2">
                          {patterns.map((pattern) => (
                            <div key={pattern.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-muted/50 text-sm gap-2">
                              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                <Badge variant={pattern.patternType === 'FILENAME' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                  {pattern.patternType}
                                </Badge>
                                <code className="bg-background px-2 py-0.5 rounded text-xs font-mono break-all">
                                  {pattern.pattern}
                                </code>
                                <span className="text-muted-foreground text-xs">{pattern.matcherType}</span>
                                {pattern.isSystem && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    <Lock className="h-3 w-3 mr-1" />
                                    System
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-xs">P{pattern.priority}</Badge>
                                <Switch
                                  checked={pattern.isActive}
                                  onCheckedChange={(checked) => togglePatternMutation.mutate({ id: pattern.id, isActive: checked })}
                                  disabled={togglePatternMutation.isPending}
                                  data-testid={`switch-pattern-${pattern.id}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      );
    }

    if (activeCategory === "OUTCOME_RULES") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Compliance Outcome Rules
            </CardTitle>
            <CardDescription>
              Configure rules for interpreting compliance outcomes from extracted certificate data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter rules..."
                value={ruleFilter}
                onChange={(e) => setRuleFilter(e.target.value)}
                className="max-w-sm"
                data-testid="input-rule-filter"
              />
              {ruleFilter && (
                <Button variant="ghost" size="sm" onClick={() => setRuleFilter("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Badge variant="secondary">{filteredRules.length} rules</Badge>
            </div>

            {rulesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(rulesByType).map(([certType, rules]) => (
                    <Card key={certType} className="border">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {certType.replace(/_/g, " ")}
                          </CardTitle>
                          <Badge variant="outline">{rules.length} rules</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="space-y-2">
                          {rules.map((rule) => (
                            <div key={rule.id} className="p-3 rounded bg-muted/50 text-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{rule.ruleName}</span>
                                  {rule.isSystem && (
                                    <Badge variant="outline" className="text-xs">
                                      <Lock className="h-3 w-3 mr-1" />
                                      System
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={rule.outcome === 'UNSATISFACTORY' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {rule.outcome}
                                  </Badge>
                                  <Switch
                                    checked={rule.isActive}
                                    onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                                    disabled={toggleRuleMutation.isPending}
                                    data-testid={`switch-rule-${rule.id}`}
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center gap-2">
                                  <code className="bg-background px-1.5 py-0.5 rounded">{rule.fieldPath}</code>
                                  <span>{rule.operator}</span>
                                  {rule.value && <code className="bg-background px-1.5 py-0.5 rounded">{rule.value}</code>}
                                </div>
                                {rule.legislation && (
                                  <div className="text-xs italic text-muted-foreground">
                                    {rule.legislation}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      );
    }

    if (activeCategory === "DEMO_DATA") {
      return (
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      );
    }

    const settings = data?.grouped?.[activeCategory] || [];
    const Icon = categoryIcons[activeCategory] || Settings;

    if (settings.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {categoryLabels[activeCategory] || activeCategory}
            </CardTitle>
            <CardDescription>
              {categoryDescriptions[activeCategory] || `Configure ${categoryLabels[activeCategory]?.toLowerCase() || activeCategory.toLowerCase()} settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No settings available in this category.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {categoryLabels[activeCategory] || activeCategory}
          </CardTitle>
          <CardDescription>
            {categoryDescriptions[activeCategory] || `Configure ${categoryLabels[activeCategory]?.toLowerCase() || activeCategory.toLowerCase()} settings.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.key} className="space-y-3 pb-4 border-b last:border-0">
              <div>
                <Label className="font-medium text-sm sm:text-base">{setting.key.replace(/_/g, " ")}</Label>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {setting.description}
                </p>
                {!setting.isEditable && (
                  <Badge variant="secondary" className="mt-2">
                    <Lock className="h-3 w-3 mr-1" />
                    Read-only
                  </Badge>
                )}
              </div>
              <div className="w-full">
                {renderSettingInput(setting)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-screen overflow-hidden" data-testid="page-factory-settings">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Factory Settings" />
          <main id="main-content" className="flex-1 overflow-y-auto p-6" role="main" aria-label="Factory settings content">
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

  const CategoryNavContent = ({ onSelect }: { onSelect?: () => void }) => (
    <nav className="p-2 space-y-1">
      {allCategories.map((cat) => {
        const Icon = categoryIcons[cat] || Settings;
        const isActive = activeCategory === cat;
        const settingsCount = data?.grouped?.[cat]?.length || 0;
        
        return (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              onSelect?.();
            }}
            data-testid={`nav-${cat.toLowerCase()}`}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{categoryLabels[cat] || cat}</span>
            {settingsCount > 0 && !isActive && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {settingsCount}
              </Badge>
            )}
            {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </nav>
  );

  const ActiveIcon = categoryIcons[activeCategory] || Settings;

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-factory-settings">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Factory Settings" />
        <main id="main-content" className="flex-1 overflow-hidden" role="main" aria-label="Factory settings content">
          <div className="h-full flex flex-col lg:flex-row">
            {/* Mobile Category Selector */}
            <div className="lg:hidden border-b bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only">Categories</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Settings Categories
                      </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-80px)]">
                      <CategoryNavContent onSelect={() => setMobileMenuOpen(false)} />
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
                
                {/* Current category indicator on mobile */}
                <div className="flex-1 flex items-center gap-2 px-2 py-1.5 bg-primary/10 rounded-md">
                  <ActiveIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate">
                    {categoryLabels[activeCategory] || activeCategory}
                  </span>
                </div>
                
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs hidden sm:flex">
                  <Lock className="h-3 w-3 mr-1" />
                  Super User
                </Badge>
              </div>
            </div>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 border-r bg-muted/30 flex-col shrink-0">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Settings Categories</span>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <CategoryNavContent />
              </ScrollArea>
              <div className="p-4 border-t">
                <Badge variant="outline" className="w-full justify-center border-emerald-500 text-emerald-600 py-1">
                  <Lock className="h-3 w-3 mr-1" />
                  Lashan Super User
                </Badge>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                <div className="hidden lg:block">
                  <h1 className="text-2xl font-bold text-foreground">
                    {categoryLabels[activeCategory] || activeCategory}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {categoryDescriptions[activeCategory] || "System configuration settings."}
                  </p>
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
                  renderCategoryContent()
                )}
              </div>
            </div>
          </div>
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
