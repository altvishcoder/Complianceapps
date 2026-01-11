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
import { Progress } from "@/components/ui/progress";
import { Shield, Upload, Zap, Webhook, Cpu, Lock, AlertTriangle, Save, RotateCcw, Loader2, Database, Play, Trash2, RefreshCw, Settings, ChevronRight, ChevronDown, Globe, Search, FileText, Scale, Plus, Edit, X, Check, Menu, Rocket, XCircle, ArrowUpCircle, CheckCircle2 } from "lucide-react";
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
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

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

interface InitializationProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

function InitializeSystemSection({ isDemoLoading, isSeeding, userRole }: { 
  isDemoLoading: boolean; 
  isSeeding: boolean;
  userRole: string;
}) {
  const [initPhrase, setInitPhrase] = useState<string | null>(null);
  const [initExpiresAt, setInitExpiresAt] = useState<number | null>(null);
  const [typedPhrase, setTypedPhrase] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [countdownActive, setCountdownActive] = useState(false);
  const [progress, setProgress] = useState<InitializationProgress[] | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isLashanSuperUser = userRole.toUpperCase() === 'LASHAN_SUPER_USER';
  
  useEffect(() => {
    if (!countdownActive) return;
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdownActive, countdown]);
  
  useEffect(() => {
    if (!initExpiresAt) return;
    
    const checkExpiry = setInterval(() => {
      if (Date.now() > initExpiresAt) {
        setInitPhrase(null);
        setInitExpiresAt(null);
        setTypedPhrase("");
        setCountdown(30);
        setCountdownActive(false);
        toast({ 
          title: "Expired", 
          description: "Initialization request has expired. Please request a new one.",
          variant: "destructive"
        });
      }
    }, 1000);
    
    return () => clearInterval(checkExpiry);
  }, [initExpiresAt, toast]);

  const requestInitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/initialize-system/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to request initialization");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setInitPhrase(data.phrase);
      setInitExpiresAt(data.expiresAt);
      setTypedPhrase("");
      setCountdown(30);
      setCountdownActive(true);
      setProgress(null);
      setInitError(null);
      toast({ title: "Initialization Requested", description: "Please carefully read and follow the instructions below." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const confirmInitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/initialize-system/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ phrase: typedPhrase, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm initialization");
      }
      return data;
    },
    onSuccess: (data) => {
      setProgress(data.progress || null);
      setInitPhrase(null);
      setInitExpiresAt(null);
      setTypedPhrase("");
      setCountdown(30);
      setCountdownActive(false);
      toast({ 
        title: "System Initialized", 
        description: data.message,
        duration: 10000
      });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      setInitError(error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const cancelInitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/initialize-system/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      setInitPhrase(null);
      setInitExpiresAt(null);
      setTypedPhrase("");
      setCountdown(30);
      setCountdownActive(false);
      setProgress(null);
      setInitError(null);
    },
  });
  
  const phraseMatches = typedPhrase.toUpperCase().trim() === initPhrase?.toUpperCase();
  const canConfirm = countdown <= 0 && phraseMatches && !confirmInitMutation.isPending;
  const timeRemaining = initExpiresAt ? Math.max(0, Math.floor((initExpiresAt - Date.now()) / 1000)) : 0;
  
  if (!isLashanSuperUser) {
    return null;
  }

  return (
    <Card className="border-2 border-red-300 dark:border-red-800 mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          Initialize System
          <Badge variant="destructive" className="text-xs ml-2">LASHAN SUPER USER ONLY</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">CRITICAL WARNING</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This operation will <strong>completely wipe ALL data</strong> from the system including:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside mt-2 space-y-1">
                <li>All properties, blocks, and schemes</li>
                <li>All certificates and compliance records</li>
                <li>All users and audit logs</li>
                <li>All contractors and staff records</li>
                <li>All ML predictions and extraction data</li>
              </ul>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2 font-medium">
                Only mandatory configuration data will be restored. This action CANNOT be undone.
              </p>
            </div>
          </div>
        </div>
        
        {!initPhrase && !progress && (
          <Button 
            className="w-full"
            variant="destructive"
            onClick={() => requestInitMutation.mutate()}
            disabled={isDemoLoading || isSeeding || requestInitMutation.isPending}
            data-testid="button-request-init"
          >
            {requestInitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Request System Initialization
              </>
            )}
          </Button>
        )}
        
        {initPhrase && (
          <div className="space-y-4 border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Confirmation Required</p>
              <Badge variant="outline" className="text-xs">
                Expires in {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </Badge>
            </div>
            
            <div className="bg-background rounded border p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Type this phrase to confirm:</p>
              <code className="text-2xl font-bold tracking-wider text-foreground">{initPhrase}</code>
            </div>
            
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder="Type the confirmation phrase..."
              className="font-mono text-center text-lg"
              data-testid="input-init-phrase"
            />
            
            {countdown > 0 && (
              <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Please wait {countdown} seconds before confirming...</span>
              </div>
            )}
            
            {initError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{initError}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => cancelInitMutation.mutate()}
                disabled={confirmInitMutation.isPending}
                data-testid="button-cancel-init"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={() => confirmInitMutation.mutate()}
                disabled={!canConfirm}
                data-testid="button-confirm-init"
              >
                {confirmInitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm Initialization
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {progress && (
          <div className="space-y-3 border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
            <p className="font-medium text-green-800 dark:text-green-200">Initialization Complete</p>
            <div className="space-y-2">
              {progress.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {step.status === 'completed' && <Check className="h-4 w-4 text-green-600" />}
                  {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                  {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                  <span className={step.status === 'completed' ? 'text-green-700 dark:text-green-300' : 
                                   step.status === 'failed' ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}>
                    {step.step.replace(/_/g, ' ')}: {step.message || step.status}
                  </span>
                </div>
              ))}
            </div>
            <Button 
              variant="outline"
              className="w-full mt-2"
              onClick={() => setProgress(null)}
              data-testid="button-clear-progress"
            >
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MigrationPreview {
  complianceStreams: { code: string; name: string; status: 'new' | 'updated' }[];
  certificateTypes: { code: string; name: string; status: 'new' | 'updated' }[];
  classificationCodes: { code: string; name: string; status: 'new' | 'updated' }[];
  componentTypes: { code: string; name: string; status: 'new' | 'updated' }[];
  totalPending: number;
}

function UpdateSystemConfigurationSection({ isDemoLoading, isSeeding }: { 
  isDemoLoading: boolean; 
  isSeeding: boolean;
}) {
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; totalApplied?: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const checkForUpdates = async () => {
    setIsChecking(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/admin/demo-data/migrate/preview", {
        method: "GET",
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to check for updates");
      }
      const data = await res.json();
      setPreview(data);
      if (data.totalPending === 0) {
        toast({ title: "Up to Date", description: "No pending configuration updates found." });
      } else {
        toast({ title: "Updates Available", description: `Found ${data.totalPending} pending configuration updates.` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  };

  const applyUpdates = async () => {
    setIsApplying(true);
    try {
      const res = await fetch("/api/admin/demo-data/migrate/apply", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply updates");
      }
      setApplyResult({ success: true, message: data.message, totalApplied: data.totalApplied });
      setPreview(null);
      toast({ title: "Updates Applied", description: data.message, duration: 10000 });
      queryClient.invalidateQueries();
    } catch (error: any) {
      setApplyResult({ success: false, message: error.message });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="border-2 border-cyan-200 dark:border-cyan-800 mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 text-cyan-600" />
          Update System Configuration
          <Badge variant="outline" className="text-xs ml-2">Non-Destructive</Badge>
        </CardTitle>
        <CardDescription>
          Check for and apply new configuration updates (compliance streams, certificate types, component types) without affecting existing data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 p-4 rounded-lg">
          <div className="flex gap-2 items-start">
            <CheckCircle2 className="h-5 w-5 text-cyan-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-cyan-800 dark:text-cyan-200">Safe Update Process</p>
              <p className="text-sm text-cyan-700 dark:text-cyan-300">
                This operation only adds new configuration items. Existing data, properties, certificates, and user records will NOT be modified or deleted.
              </p>
            </div>
          </div>
        </div>

        {!preview && !applyResult && (
          <Button 
            className="w-full"
            variant="outline"
            onClick={checkForUpdates}
            disabled={isDemoLoading || isSeeding || isChecking}
            data-testid="button-check-updates"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking for Updates...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Check for Configuration Updates
              </>
            )}
          </Button>
        )}

        {preview && preview.totalPending > 0 && (
          <div className="space-y-4 border border-cyan-200 dark:border-cyan-700 rounded-lg p-4 bg-cyan-50/50 dark:bg-cyan-950/20">
            <div className="flex items-center justify-between">
              <p className="font-medium text-cyan-800 dark:text-cyan-200">
                {preview.totalPending} Pending Updates Found
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {preview.complianceStreams.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-1">
                    Compliance Streams ({preview.complianceStreams.length})
                  </p>
                  <div className="space-y-1">
                    {preview.complianceStreams.map(item => (
                      <div key={item.code} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                        <code className="text-xs bg-background px-1.5 py-0.5 rounded">{item.code}</code>
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {preview.certificateTypes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-1">
                    Certificate Types ({preview.certificateTypes.length})
                  </p>
                  <div className="space-y-1">
                    {preview.certificateTypes.map(item => (
                      <div key={item.code} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                        <code className="text-xs bg-background px-1.5 py-0.5 rounded">{item.code}</code>
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {preview.componentTypes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-1">
                    Component Types ({preview.componentTypes.length})
                  </p>
                  <div className="space-y-1">
                    {preview.componentTypes.map(item => (
                      <div key={item.code} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                        <code className="text-xs bg-background px-1.5 py-0.5 rounded">{item.code}</code>
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setPreview(null)}
                disabled={isApplying}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={applyUpdates}
                disabled={isApplying}
                data-testid="button-apply-updates"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying Updates...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Apply {preview.totalPending} Updates
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {preview && preview.totalPending === 0 && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">System is Up to Date</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  All configuration items are already present in the database.
                </p>
              </div>
            </div>
            <Button 
              variant="outline"
              className="w-full mt-3"
              onClick={() => setPreview(null)}
            >
              Close
            </Button>
          </div>
        )}

        {applyResult && (
          <div className={`p-4 rounded-lg border ${
            applyResult.success 
              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-2">
              {applyResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className={`font-medium ${applyResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                  {applyResult.success ? "Updates Applied Successfully" : "Update Failed"}
                </p>
                <p className={`text-sm ${applyResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                  {applyResult.message}
                </p>
              </div>
            </div>
            <Button 
              variant="outline"
              className="w-full mt-3"
              onClick={() => setApplyResult(null)}
            >
              {applyResult.success ? "Check for More Updates" : "Try Again"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
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

  const resetDemoMutation = useMutation({
    mutationFn: () => adminApi.resetDemo(),
    onSuccess: (data) => {
      const stats = data.stats;
      if (stats) {
        toast({ 
          title: "Demo Data Regenerated", 
          description: `Created ${stats.properties} properties, ${stats.components} components, ${stats.certificates} certificates`,
          duration: 10000,
        });
      } else {
        toast({ title: "Success", description: data.message });
      }
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isDemoLoading = wipeDataMutation.isPending || resetDemoMutation.isPending;
  
  const [selectedTier, setSelectedTier] = useState<"small" | "medium" | "large">("medium");
  
  const { data: bulkSeedTiers } = useQuery({
    queryKey: ["bulkSeedTiers"],
    queryFn: () => adminApi.getBulkSeedTiers(),
    enabled: isAuthorized && !!user?.id && activeCategory === "DEMO_DATA",
  });
  
  const { data: bulkSeedProgress, refetch: refetchProgress } = useQuery({
    queryKey: ["bulkSeedProgress"],
    queryFn: () => adminApi.getBulkSeedProgress(),
    enabled: isAuthorized && !!user?.id && activeCategory === "DEMO_DATA",
    refetchInterval: (query) => query.state.data?.status === "running" ? 1000 : false,
  });
  
  const startBulkSeedMutation = useMutation({
    mutationFn: (tier: "small" | "medium" | "large") => adminApi.startBulkSeed(tier),
    onSuccess: (data) => {
      toast({ title: "Bulk Seeding Started", description: data.message });
      refetchProgress();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const cancelBulkSeedMutation = useMutation({
    mutationFn: () => adminApi.cancelBulkSeed(),
    onSuccess: () => {
      toast({ title: "Cancelled", description: "Bulk seeding cancelled" });
      refetchProgress();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const seedSpacesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/seed-spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to seed spaces");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Spaces Added", 
        description: `Created ${data.total?.toLocaleString() || 0} spaces (${data.created?.scheme || 0} scheme, ${data.created?.block || 0} block, ${data.created?.property || 0} property level)`,
        duration: 10000,
      });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
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

            {patternsLoading && !detectionPatterns ? (
              <div className="space-y-4 p-4">
                <CardSkeleton contentHeight={100} />
                <CardSkeleton contentHeight={100} />
                <CardSkeleton contentHeight={100} />
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

            {rulesLoading && !outcomeRules ? (
              <div className="space-y-4 p-4">
                <CardSkeleton contentHeight={100} />
                <CardSkeleton contentHeight={100} />
                <CardSkeleton contentHeight={100} />
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
      const selectedTierInfo = bulkSeedTiers?.find(t => t.tier === selectedTier);
      const isSeeding = bulkSeedProgress?.status === "running";
      
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
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Important</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    These actions modify your database. Wipe operations cannot be undone.
                    Make sure you have a backup before proceeding.
                  </p>
                </div>
              </div>
            </div>

            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-blue-600" />
                  High Volume Data Seeding
                </CardTitle>
                <CardDescription>
                  Generate large datasets to test system scalability and performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isSeeding ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Seeding in progress: {bulkSeedProgress?.tier?.toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {bulkSeedProgress?.currentEntity} - {bulkSeedProgress?.currentCount.toLocaleString()} / {bulkSeedProgress?.totalCount.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelBulkSeedMutation.mutate()}
                        disabled={cancelBulkSeedMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    <Progress value={bulkSeedProgress?.percentage || 0} className="h-3" />
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {Object.entries(bulkSeedProgress?.entities || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between bg-muted/50 rounded px-2 py-1">
                          <span className="capitalize">{key}</span>
                          <span className="font-mono">{val.done}/{val.total}</span>
                        </div>
                      ))}
                    </div>
                    {bulkSeedProgress?.estimatedTimeRemaining && (
                      <p className="text-sm text-muted-foreground">
                        Est. time remaining: {Math.floor(bulkSeedProgress.estimatedTimeRemaining / 60)}m {bulkSeedProgress.estimatedTimeRemaining % 60}s
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {bulkSeedTiers?.map((tier) => (
                        <button
                          key={tier.tier}
                          onClick={() => setSelectedTier(tier.tier)}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${
                            selectedTier === tier.tier
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                              : "border-muted hover:border-blue-300"
                          }`}
                          data-testid={`tier-${tier.tier}`}
                        >
                          <div className="font-medium">{tier.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{tier.description}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            ~{tier.estimatedMinutes} min | {tier.totals.total.toLocaleString()} records
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {selectedTierInfo && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">Selected: {selectedTierInfo.label}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Properties:</span> {selectedTierInfo.totals.properties.toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Components:</span> {selectedTierInfo.totals.components.toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Certificates:</span> {selectedTierInfo.totals.certificates.toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Remedials:</span> {selectedTierInfo.totals.remedials.toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Schemes:</span> {selectedTierInfo.totals.schemes.toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Blocks:</span> {selectedTierInfo.totals.blocks.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full"
                      onClick={() => startBulkSeedMutation.mutate(selectedTier)}
                      disabled={startBulkSeedMutation.isPending || isDemoLoading}
                      data-testid="button-start-bulk-seed"
                    >
                      {startBulkSeedMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
                          Start {selectedTierInfo?.label || "Bulk"} Seeding
                        </>
                      )}
                    </Button>
                  </>
                )}
                
                {bulkSeedProgress?.status === "completed" && (
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      ✅ Bulk seeding completed successfully!
                    </p>
                  </div>
                )}
                
                {bulkSeedProgress?.status === "failed" && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      ❌ Error: {bulkSeedProgress.error}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-orange-600" />
                    Wipe All Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Remove all data including properties, components, schemes, blocks, certificates, and remedial actions.
                  </p>
                  <Button 
                    className="w-full"
                    variant="outline"
                    onClick={() => wipeDataMutation.mutate(true)}
                    disabled={isDemoLoading || isSeeding}
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

              <Card className="border-2 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    Reset to Small Demo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Wipe and regenerate small demo dataset (~2,000 properties, ~6,000 certificates).
                  </p>
                  <Button 
                    className="w-full"
                    variant="default"
                    onClick={() => resetDemoMutation.mutate()}
                    disabled={isDemoLoading || isSeeding}
                    data-testid="button-reset-demo"
                  >
                    {resetDemoMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset to Small Demo
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-2 border-blue-200 dark:border-blue-800 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  Seed Missing Spaces
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add communal spaces to existing schemes, blocks, and properties. Creates estate-wide spaces (Community Hall, Estate Grounds), block-level communal areas (Stairwell, Plant Room, Bin Store), and dwelling rooms (Living Room, Kitchen, Bathroom, Bedroom) where missing.
                </p>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => seedSpacesMutation.mutate()}
                  disabled={isDemoLoading || isSeeding || seedSpacesMutation.isPending}
                  data-testid="button-seed-spaces"
                >
                  {seedSpacesMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Adding Spaces...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Seed Missing Spaces
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
            
            <UpdateSystemConfigurationSection 
              isDemoLoading={isDemoLoading} 
              isSeeding={isSeeding}
            />
            
            <InitializeSystemSection 
              isDemoLoading={isDemoLoading} 
              isSeeding={isSeeding}
              userRole={userRole}
            />
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

                {isLoading && !data ? (
                  <div className="space-y-4">
                    <CardSkeleton contentHeight={120} />
                    <CardSkeleton contentHeight={80} />
                    <CardSkeleton contentHeight={100} />
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
