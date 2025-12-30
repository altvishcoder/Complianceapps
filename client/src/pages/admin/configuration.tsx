import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, FileText, AlertTriangle, Tags, Code, Plus, Pencil, Trash2, Lock, Loader2, Info, Zap, CheckCircle2, Layers, Filter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  complianceStreamsApi, certificateTypesApi, classificationCodesApi, extractionSchemasApi, 
  complianceRulesApi, normalisationRulesApi 
} from "@/lib/api";
import type { 
  ComplianceStream, InsertComplianceStream,
  CertificateType, ClassificationCode, ExtractionSchema, 
  ComplianceRule, NormalisationRule, InsertCertificateType, InsertClassificationCode 
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Configuration() {
  useEffect(() => {
    document.title = "System Configuration - ComplianceAI";
  }, []);

  const [, setLocation] = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingStream, setEditingStream] = useState<ComplianceStream | null>(null);
  const [editingCertType, setEditingCertType] = useState<CertificateType | null>(null);
  const [editingCode, setEditingCode] = useState<ClassificationCode | null>(null);
  const [editingSchema, setEditingSchema] = useState<ExtractionSchema | null>(null);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [editingNormRule, setEditingNormRule] = useState<NormalisationRule | null>(null);
  const [showStreamDialog, setShowStreamDialog] = useState(false);
  const [showCertTypeDialog, setShowCertTypeDialog] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showNormRuleDialog, setShowNormRuleDialog] = useState(false);
  const [selectedStreamFilters, setSelectedStreamFilters] = useState<string[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role === "super_admin" || role === "SUPER_ADMIN" || 
        role === "compliance_manager" || role === "COMPLIANCE_MANAGER") {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const { data: complianceStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["complianceStreams"],
    queryFn: complianceStreamsApi.list,
    enabled: isAuthorized,
  });

  const { data: certificateTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["certificateTypes"],
    queryFn: certificateTypesApi.list,
    enabled: isAuthorized,
  });

  const { data: classificationCodes = [], isLoading: codesLoading } = useQuery({
    queryKey: ["classificationCodes"],
    queryFn: () => classificationCodesApi.list(),
    enabled: isAuthorized,
  });

  const { data: extractionSchemas = [], isLoading: schemasLoading } = useQuery({
    queryKey: ["extractionSchemas"],
    queryFn: extractionSchemasApi.list,
    enabled: isAuthorized,
  });

  const { data: complianceRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["complianceRules"],
    queryFn: complianceRulesApi.list,
    enabled: isAuthorized,
  });

  const { data: normalisationRules = [], isLoading: normRulesLoading } = useQuery({
    queryKey: ["normalisationRules"],
    queryFn: normalisationRulesApi.list,
    enabled: isAuthorized,
  });

  const createStreamMutation = useMutation({
    mutationFn: (data: InsertComplianceStream) => complianceStreamsApi.create(data),
    onSuccess: () => {
      toast({ title: "Success", description: "Compliance stream created" });
      queryClient.invalidateQueries({ queryKey: ["complianceStreams"] });
      setShowStreamDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStreamMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertComplianceStream> }) => 
      complianceStreamsApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Compliance stream updated" });
      queryClient.invalidateQueries({ queryKey: ["complianceStreams"] });
      setShowStreamDialog(false);
      setEditingStream(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteStreamMutation = useMutation({
    mutationFn: (id: string) => complianceStreamsApi.delete(id),
    onSuccess: () => {
      toast({ title: "Success", description: "Compliance stream deleted" });
      queryClient.invalidateQueries({ queryKey: ["complianceStreams"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCertTypeMutation = useMutation({
    mutationFn: (data: InsertCertificateType) => certificateTypesApi.create(data),
    onSuccess: () => {
      toast({ title: "Success", description: "Certificate type created" });
      queryClient.invalidateQueries({ queryKey: ["certificateTypes"] });
      setShowCertTypeDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCertTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCertificateType> }) => 
      certificateTypesApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Certificate type updated" });
      queryClient.invalidateQueries({ queryKey: ["certificateTypes"] });
      setShowCertTypeDialog(false);
      setEditingCertType(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCertTypeMutation = useMutation({
    mutationFn: (id: string) => certificateTypesApi.delete(id),
    onSuccess: () => {
      toast({ title: "Success", description: "Certificate type deleted" });
      queryClient.invalidateQueries({ queryKey: ["certificateTypes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCodeMutation = useMutation({
    mutationFn: (data: InsertClassificationCode) => classificationCodesApi.create(data),
    onSuccess: () => {
      toast({ title: "Success", description: "Classification code created" });
      queryClient.invalidateQueries({ queryKey: ["classificationCodes"] });
      setShowCodeDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCodeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertClassificationCode> }) => 
      classificationCodesApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Classification code updated" });
      queryClient.invalidateQueries({ queryKey: ["classificationCodes"] });
      setShowCodeDialog(false);
      setEditingCode(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCodeMutation = useMutation({
    mutationFn: (id: string) => classificationCodesApi.delete(id),
    onSuccess: () => {
      toast({ title: "Success", description: "Classification code deleted" });
      queryClient.invalidateQueries({ queryKey: ["classificationCodes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSchemaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      extractionSchemasApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Schema Deployed", description: "Extraction schema updated and deployed" });
      queryClient.invalidateQueries({ queryKey: ["extractionSchemas"] });
      setShowSchemaDialog(false);
      setEditingSchema(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      complianceRulesApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Compliance rule updated" });
      queryClient.invalidateQueries({ queryKey: ["complianceRules"] });
      setShowRuleDialog(false);
      setEditingRule(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateNormRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      normalisationRulesApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Normalisation rule updated" });
      queryClient.invalidateQueries({ queryKey: ["normalisationRules"] });
      setShowNormRuleDialog(false);
      setEditingNormRule(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveStream = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingStream) {
      // For existing streams, only send isActive for system streams (preserve isSystem)
      if (editingStream.isSystem) {
        // System streams can only toggle isActive
        updateStreamMutation.mutate({ 
          id: editingStream.id, 
          data: { isActive: formData.get("isActive") === "on" }
        });
      } else {
        // Custom streams can update all fields except isSystem
        const data: Partial<InsertComplianceStream> = {
          code: formData.get("code") as string,
          name: formData.get("name") as string,
          description: formData.get("description") as string || undefined,
          colorCode: formData.get("colorCode") as string || "#6366F1",
          iconName: formData.get("iconName") as string || "FileCheck",
          displayOrder: parseInt(formData.get("displayOrder") as string) || 0,
          isActive: formData.get("isActive") === "on",
        };
        updateStreamMutation.mutate({ id: editingStream.id, data });
      }
    } else {
      // New streams are never system streams
      const data: InsertComplianceStream = {
        code: formData.get("code") as string,
        name: formData.get("name") as string,
        description: formData.get("description") as string || undefined,
        colorCode: formData.get("colorCode") as string || "#6366F1",
        iconName: formData.get("iconName") as string || "FileCheck",
        displayOrder: parseInt(formData.get("displayOrder") as string) || 0,
        isActive: formData.get("isActive") === "on",
        isSystem: false,
      };
      createStreamMutation.mutate(data);
    }
  };

  const handleSaveCertType = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: InsertCertificateType = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      shortName: formData.get("shortName") as string,
      complianceStream: formData.get("complianceStream") as string,
      description: formData.get("description") as string || undefined,
      validityMonths: parseInt(formData.get("validityMonths") as string) || 12,
      warningDays: parseInt(formData.get("warningDays") as string) || 30,
      displayOrder: parseInt(formData.get("displayOrder") as string) || 0,
      isActive: formData.get("isActive") === "on",
    };

    if (editingCertType) {
      updateCertTypeMutation.mutate({ id: editingCertType.id, data });
    } else {
      createCertTypeMutation.mutate(data);
    }
  };

  const handleSaveCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const certTypeId = formData.get("certificateTypeId") as string;
    const data: InsertClassificationCode = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      severity: formData.get("severity") as string,
      description: formData.get("description") as string,
      certificateTypeId: certTypeId === "__ALL__" ? undefined : certTypeId || undefined,
      colorCode: formData.get("colorCode") as string || undefined,
      actionRequired: formData.get("actionRequired") as string || undefined,
      timeframeHours: parseInt(formData.get("timeframeHours") as string) || undefined,
      displayOrder: parseInt(formData.get("displayOrder") as string) || 0,
      isActive: formData.get("isActive") === "on",
    };

    if (editingCode) {
      updateCodeMutation.mutate({ id: editingCode.id, data });
    } else {
      createCodeMutation.mutate(data);
    }
  };

  const handleSaveSchema = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSchema) return;
    const formData = new FormData(e.currentTarget);
    try {
      const schemaJson = JSON.parse(formData.get("schemaJson") as string);
      const data = {
        promptTemplate: formData.get("promptTemplate") as string || undefined,
        schemaJson,
        isActive: formData.get("isActive") === "on",
      };
      updateSchemaMutation.mutate({ id: editingSchema.id, data });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON for the schema", variant: "destructive" });
    }
  };

  const handleSaveRule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRule) return;
    const formData = new FormData(e.currentTarget);
    try {
      const conditions = JSON.parse(formData.get("conditions") as string);
      const data = {
        ruleName: formData.get("ruleName") as string,
        description: formData.get("description") as string,
        action: formData.get("action") as string,
        priority: formData.get("priority") as string,
        conditions,
        isActive: formData.get("isActive") === "on",
      };
      updateRuleMutation.mutate({ id: editingRule.id, data });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON for conditions", variant: "destructive" });
    }
  };

  const handleSaveNormRule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingNormRule) return;
    const formData = new FormData(e.currentTarget);
    const inputPatternsStr = formData.get("inputPatterns") as string;
    const inputPatterns = inputPatternsStr.split(",").map(s => s.trim()).filter(Boolean);
    const data = {
      ruleName: formData.get("ruleName") as string,
      fieldPath: formData.get("fieldPath") as string,
      ruleType: formData.get("ruleType") as string,
      inputPatterns,
      outputValue: formData.get("outputValue") as string || undefined,
      transformFn: formData.get("transformFn") as string || undefined,
      isActive: formData.get("isActive") === "on",
    };
    updateNormRuleMutation.mutate({ id: editingNormRule.id, data });
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "bg-red-500",
      HIGH: "bg-orange-500",
      MEDIUM: "bg-yellow-500",
      LOW: "bg-blue-500",
      INFO: "bg-gray-500",
    };
    return <Badge className={colors[severity] || "bg-gray-500"}>{severity}</Badge>;
  };

  const getStreamName = (streamId: string | null | undefined) => {
    if (!streamId) return <span className="text-muted-foreground">-</span>;
    const stream = complianceStreams.find(s => s.id === streamId);
    if (!stream) return <span className="text-muted-foreground">Unknown</span>;
    const color = stream.colorCode || "#6366F1";
    return (
      <Badge variant="outline" className="font-normal" style={{ borderColor: color, color: color }}>
        {stream.name}
      </Badge>
    );
  };

  const getStreamNameByCode = (streamCode: string | null | undefined) => {
    if (!streamCode) return <span className="text-muted-foreground">-</span>;
    const stream = complianceStreams.find(s => s.code === streamCode);
    if (!stream) return <Badge variant="outline" className="font-normal">{streamCode}</Badge>;
    const color = stream.colorCode || "#6366F1";
    return (
      <Badge variant="outline" className="font-normal" style={{ borderColor: color, color: color }}>
        {stream.name}
      </Badge>
    );
  };

  const toggleStreamFilter = (streamId: string) => {
    setSelectedStreamFilters(prev => 
      prev.includes(streamId) 
        ? prev.filter(id => id !== streamId)
        : [...prev, streamId]
    );
  };

  const clearStreamFilters = () => setSelectedStreamFilters([]);

  const filteredCertificateTypes = selectedStreamFilters.length === 0 
    ? certificateTypes 
    : certificateTypes.filter(t => {
        const stream = complianceStreams.find(s => s.code === t.complianceStream);
        return stream && selectedStreamFilters.includes(stream.id);
      });

  const filteredClassificationCodes = selectedStreamFilters.length === 0 
    ? classificationCodes 
    : classificationCodes.filter(c => c.complianceStreamId && selectedStreamFilters.includes(c.complianceStreamId));

  const filteredExtractionSchemas = selectedStreamFilters.length === 0 
    ? extractionSchemas 
    : extractionSchemas.filter(s => s.complianceStreamId && selectedStreamFilters.includes(s.complianceStreamId));

  const filteredComplianceRules = selectedStreamFilters.length === 0 
    ? complianceRules 
    : complianceRules.filter(r => r.complianceStreamId && selectedStreamFilters.includes(r.complianceStreamId));

  const filteredNormalisationRules = selectedStreamFilters.length === 0 
    ? normalisationRules 
    : normalisationRules.filter(r => r.complianceStreamId && selectedStreamFilters.includes(r.complianceStreamId));

  const filteredComplianceStreams = selectedStreamFilters.length === 0 
    ? complianceStreams 
    : complianceStreams.filter(s => selectedStreamFilters.includes(s.id));

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
              You do not have permission to view the System Configuration area.
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
        <Header title="System Configuration" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="System configuration content">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display" data-testid="text-config-title">Configuration</h2>
                <p className="text-muted-foreground">Manage certificate types, classification codes, extraction schemas, and domain rules.</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Filter by Stream:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {complianceStreams.filter(s => s.isActive).map(stream => {
                      const isSelected = selectedStreamFilters.includes(stream.id);
                      const color = stream.colorCode || "#6366F1";
                      return (
                        <Badge
                          key={stream.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          style={isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: color, color: color }}
                          onClick={() => toggleStreamFilter(stream.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStreamFilter(stream.id); } }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`Filter by ${stream.name}`}
                          data-testid={`filter-stream-${stream.code}`}
                        >
                          {stream.name}
                        </Badge>
                      );
                    })}
                  </div>
                  {selectedStreamFilters.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearStreamFilters} className="gap-1" data-testid="button-clear-filters">
                      <X className="h-3 w-3" />
                      Reset ({selectedStreamFilters.length})
                    </Button>
                  )}
                </div>
                {selectedStreamFilters.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {selectedStreamFilters.length} stream{selectedStreamFilters.length > 1 ? 's' : ''}: {selectedStreamFilters.map(id => complianceStreams.find(s => s.id === id)?.name).join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="streams" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="streams" data-testid="tab-streams">
                  <Layers className="h-4 w-4 mr-2" />
                  Streams
                </TabsTrigger>
                <TabsTrigger value="cert-types" data-testid="tab-cert-types">
                  <FileText className="h-4 w-4 mr-2" />
                  Certificate Types
                </TabsTrigger>
                <TabsTrigger value="codes" data-testid="tab-codes">
                  <Tags className="h-4 w-4 mr-2" />
                  Classification Codes
                </TabsTrigger>
                <TabsTrigger value="schemas" data-testid="tab-schemas">
                  <Code className="h-4 w-4 mr-2" />
                  Extraction Schemas
                </TabsTrigger>
                <TabsTrigger value="rules" data-testid="tab-rules">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Domain Rules
                </TabsTrigger>
              </TabsList>

              <TabsContent value="streams" className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Compliance Streams</strong> are high-level categories that group related certificate types (e.g., Gas & Heating, Electrical, Fire Safety). 
                    Each stream represents a distinct regulatory area in UK social housing compliance. System streams cannot be deleted but can be disabled.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Compliance Streams</CardTitle>
                      <CardDescription>Configure the compliance categories for your organisation.</CardDescription>
                    </div>
                    <Dialog open={showStreamDialog} onOpenChange={(open) => {
                      setShowStreamDialog(open);
                      if (!open) setEditingStream(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-stream">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Stream
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingStream ? "Edit" : "Add"} Compliance Stream</DialogTitle>
                          <DialogDescription>
                            Configure the compliance stream details.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveStream} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="code">Code</Label>
                              <Input 
                                id="code" 
                                name="code" 
                                placeholder="GAS_HEATING" 
                                defaultValue={editingStream?.code || ""} 
                                required 
                                disabled={editingStream?.isSystem}
                                data-testid="input-stream-code" 
                              />
                            </div>
                            <div>
                              <Label htmlFor="colorCode">Colour</Label>
                              <Input 
                                id="colorCode" 
                                name="colorCode" 
                                type="color" 
                                defaultValue={editingStream?.colorCode || "#6366F1"} 
                                data-testid="input-stream-color" 
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="name">Name</Label>
                            <Input 
                              id="name" 
                              name="name" 
                              placeholder="Gas & Heating Safety" 
                              defaultValue={editingStream?.name || ""} 
                              required 
                              disabled={editingStream?.isSystem}
                              data-testid="input-stream-name" 
                            />
                          </div>
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea 
                              id="description" 
                              name="description" 
                              placeholder="Description of the compliance stream..." 
                              defaultValue={editingStream?.description || ""} 
                              disabled={editingStream?.isSystem}
                              data-testid="input-stream-description" 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="iconName">Icon Name</Label>
                              <Input 
                                id="iconName" 
                                name="iconName" 
                                placeholder="Flame" 
                                defaultValue={editingStream?.iconName || ""} 
                                disabled={editingStream?.isSystem}
                                data-testid="input-stream-icon" 
                              />
                            </div>
                            <div>
                              <Label htmlFor="displayOrder">Display Order</Label>
                              <Input 
                                id="displayOrder" 
                                name="displayOrder" 
                                type="number" 
                                defaultValue={editingStream?.displayOrder || 0} 
                                disabled={editingStream?.isSystem}
                                data-testid="input-stream-display-order" 
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              id="isActive" 
                              name="isActive" 
                              defaultChecked={editingStream?.isActive ?? true} 
                              data-testid="switch-stream-is-active" 
                            />
                            <Label htmlFor="isActive">Active</Label>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createStreamMutation.isPending || updateStreamMutation.isPending} data-testid="button-save-stream">
                              {(createStreamMutation.isPending || updateStreamMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Save
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {streamsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : complianceStreams.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No compliance streams configured yet.</p>
                        <p className="text-sm">Add your first compliance stream to get started.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stream</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredComplianceStreams.map((stream) => (
                            <TableRow key={stream.id} data-testid={`row-stream-${stream.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: stream.colorCode || "#6366F1" }} 
                                  />
                                  <span className="font-medium">{stream.name}</span>
                                  {stream.isSystem && (
                                    <Badge variant="outline" className="text-xs">
                                      <Lock className="h-3 w-3 mr-1" />
                                      System
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{stream.code}</TableCell>
                              <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                                {stream.description}
                              </TableCell>
                              <TableCell>
                                <Badge variant={stream.isActive ? "default" : "secondary"}>
                                  {stream.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => { setEditingStream(stream); setShowStreamDialog(true); }} 
                                  data-testid={`button-edit-stream-${stream.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {!stream.isSystem && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => deleteStreamMutation.mutate(stream.id)} 
                                    data-testid={`button-delete-stream-${stream.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cert-types" className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Certificate Types</strong> define the compliance documents your organisation tracks (e.g., Gas Safety, EICR, Fire Risk). 
                    Each type has a validity period and warning threshold. When you upload a document, you select its type from this list. 
                    Changes here immediately update all dropdowns in the Upload and Ingestion Hub pages.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Certificate Types</CardTitle>
                      <CardDescription>Define the types of compliance certificates your organisation tracks.</CardDescription>
                    </div>
                    <Dialog open={showCertTypeDialog} onOpenChange={(open) => {
                      setShowCertTypeDialog(open);
                      if (!open) setEditingCertType(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-cert-type">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Type
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingCertType ? "Edit" : "Add"} Certificate Type</DialogTitle>
                          <DialogDescription>
                            Configure the certificate type details and validity settings.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveCertType} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="code">Code</Label>
                              <Input id="code" name="code" placeholder="GAS_SAFETY" defaultValue={editingCertType?.code || ""} required data-testid="input-cert-code" />
                            </div>
                            <div>
                              <Label htmlFor="shortName">Short Name</Label>
                              <Input id="shortName" name="shortName" placeholder="Gas Safety" defaultValue={editingCertType?.shortName || ""} required data-testid="input-cert-short-name" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" name="name" placeholder="Gas Safety Certificate (CP12)" defaultValue={editingCertType?.name || ""} required data-testid="input-cert-name" />
                          </div>
                          <div>
                            <Label htmlFor="complianceStream">Compliance Stream</Label>
                            <Select name="complianceStream" defaultValue={editingCertType?.complianceStream || complianceStreams[0]?.code || ""}>
                              <SelectTrigger data-testid="select-compliance-stream">
                                <SelectValue placeholder="Select a stream" />
                              </SelectTrigger>
                              <SelectContent>
                                {complianceStreams.filter(s => s.isActive).map((stream) => (
                                  <SelectItem key={stream.id} value={stream.code}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: stream.colorCode || "#6366F1" }} 
                                      />
                                      {stream.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="Description of the certificate type..." defaultValue={editingCertType?.description || ""} data-testid="input-cert-description" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="validityMonths">Validity (months)</Label>
                              <Input id="validityMonths" name="validityMonths" type="number" defaultValue={editingCertType?.validityMonths || 12} data-testid="input-validity-months" />
                            </div>
                            <div>
                              <Label htmlFor="warningDays">Warning (days)</Label>
                              <Input id="warningDays" name="warningDays" type="number" defaultValue={editingCertType?.warningDays || 30} data-testid="input-warning-days" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="displayOrder">Display Order</Label>
                              <Input id="displayOrder" name="displayOrder" type="number" defaultValue={editingCertType?.displayOrder || 0} data-testid="input-display-order" />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                              <Switch id="isActive" name="isActive" defaultChecked={editingCertType?.isActive ?? true} data-testid="switch-is-active" />
                              <Label htmlFor="isActive">Active</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createCertTypeMutation.isPending || updateCertTypeMutation.isPending} data-testid="button-save-cert-type">
                              {(createCertTypeMutation.isPending || updateCertTypeMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Save
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {typesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : certificateTypes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No certificate types configured yet.</p>
                        <p className="text-sm">Add your first certificate type to get started.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Stream</TableHead>
                            <TableHead>Validity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCertificateTypes.map((type) => (
                            <TableRow key={type.id} data-testid={`row-cert-type-${type.id}`}>
                              <TableCell className="font-mono text-sm">{type.code}</TableCell>
                              <TableCell>{type.shortName}</TableCell>
                              <TableCell>
                                {getStreamNameByCode(type.complianceStream)}
                              </TableCell>
                              <TableCell>{type.validityMonths} months</TableCell>
                              <TableCell>
                                <Badge variant={type.isActive ? "default" : "secondary"}>
                                  {type.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingCertType(type); setShowCertTypeDialog(true); }} data-testid={`button-edit-cert-type-${type.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteCertTypeMutation.mutate(type.id)} data-testid={`button-delete-cert-type-${type.id}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="codes" className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200">
                  <Tags className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Classification Codes</strong> represent outcomes or defect categories found in certificates (e.g., C1 = Immediately Dangerous, C2 = At Risk for gas; SATISFACTORY/UNSATISFACTORY for EICR). 
                    Each code has a severity level and required action timeframe. When AI extracts a certificate, it identifies these codes and the system automatically generates remedial actions based on their severity.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Classification Codes</CardTitle>
                      <CardDescription>Define classification codes for certificate outcomes (e.g., C1, C2, FI for EICR).</CardDescription>
                    </div>
                    <Dialog open={showCodeDialog} onOpenChange={(open) => {
                      setShowCodeDialog(open);
                      if (!open) setEditingCode(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-code">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Code
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingCode ? "Edit" : "Add"} Classification Code</DialogTitle>
                          <DialogDescription>
                            Define the code, severity, and required actions.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveCode} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="code">Code</Label>
                              <Input id="code" name="code" placeholder="C1" defaultValue={editingCode?.code || ""} required data-testid="input-code-code" />
                            </div>
                            <div>
                              <Label htmlFor="severity">Severity</Label>
                              <Select name="severity" defaultValue={editingCode?.severity || "HIGH"}>
                                <SelectTrigger data-testid="select-severity">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CRITICAL">Critical</SelectItem>
                                  <SelectItem value="HIGH">High</SelectItem>
                                  <SelectItem value="MEDIUM">Medium</SelectItem>
                                  <SelectItem value="LOW">Low</SelectItem>
                                  <SelectItem value="INFO">Info</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" placeholder="Danger Present" defaultValue={editingCode?.name || ""} required data-testid="input-code-name" />
                          </div>
                          <div>
                            <Label htmlFor="certificateTypeId">Certificate Type</Label>
                            <Select name="certificateTypeId" defaultValue={editingCode?.certificateTypeId || "__ALL__"}>
                              <SelectTrigger data-testid="select-cert-type">
                                <SelectValue placeholder="Select type (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ALL__">All Types</SelectItem>
                                {certificateTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id}>{type.shortName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="Describe what this code means..." defaultValue={editingCode?.description || ""} required data-testid="input-code-description" />
                          </div>
                          <div>
                            <Label htmlFor="actionRequired">Action Required</Label>
                            <Textarea id="actionRequired" name="actionRequired" placeholder="What action must be taken..." defaultValue={editingCode?.actionRequired || ""} data-testid="input-action-required" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="timeframeHours">Timeframe (hours)</Label>
                              <Input id="timeframeHours" name="timeframeHours" type="number" placeholder="24" defaultValue={editingCode?.timeframeHours || ""} data-testid="input-timeframe" />
                            </div>
                            <div>
                              <Label htmlFor="colorCode">Color</Label>
                              <Input id="colorCode" name="colorCode" type="color" defaultValue={editingCode?.colorCode || "#ef4444"} data-testid="input-color" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="displayOrder">Display Order</Label>
                              <Input id="displayOrder" name="displayOrder" type="number" defaultValue={editingCode?.displayOrder || 0} data-testid="input-code-order" />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                              <Switch id="isActive" name="isActive" defaultChecked={editingCode?.isActive ?? true} data-testid="switch-code-active" />
                              <Label htmlFor="isActive">Active</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createCodeMutation.isPending || updateCodeMutation.isPending} data-testid="button-save-code">
                              {(createCodeMutation.isPending || updateCodeMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Save
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {codesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : classificationCodes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No classification codes configured yet.</p>
                        <p className="text-sm">Add codes like C1, C2, FI for different certificate types.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Stream</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Timeframe</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClassificationCodes.map((code) => (
                            <TableRow key={code.id} data-testid={`row-code-${code.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {code.colorCode && (
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: code.colorCode }} />
                                  )}
                                  <span className="font-mono font-medium">{code.code}</span>
                                </div>
                              </TableCell>
                              <TableCell>{code.name}</TableCell>
                              <TableCell>{getStreamName(code.complianceStreamId)}</TableCell>
                              <TableCell>{getSeverityBadge(code.severity)}</TableCell>
                              <TableCell>{code.timeframeHours ? `${code.timeframeHours}h` : "-"}</TableCell>
                              <TableCell>
                                <Badge variant={code.isActive ? "default" : "secondary"}>
                                  {code.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingCode(code); setShowCodeDialog(true); }} data-testid={`button-edit-code-${code.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteCodeMutation.mutate(code.id)} data-testid={`button-delete-code-${code.id}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schemas" className="space-y-4">
                <Alert className="bg-emerald-50 border-emerald-200">
                  <Code className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    <strong>Extraction Schemas</strong> define what data the AI should extract from each document type. 
                    Each schema specifies the fields to extract (e.g., engineer name, issue date, defects), their types, and whether they're required. 
                    The prompt template guides the AI on how to interpret the document. When you deploy a schema change, all future document extractions will use the updated schema.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader>
                    <CardTitle>Extraction Schemas</CardTitle>
                    <CardDescription>Define the data extraction schemas for AI-powered document processing. Click on a schema to edit and deploy changes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {schemasLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : extractionSchemas.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No extraction schemas configured yet.</p>
                        <p className="text-sm">Schemas define what data to extract from certificates.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredExtractionSchemas.map((schema) => (
                          <div key={schema.id} className="border rounded-lg p-4 space-y-3" data-testid={`row-schema-${schema.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <Code className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{schema.documentType}</p>
                                    {getStreamName(schema.complianceStreamId)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">Version {schema.version}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={schema.isActive ? "default" : "secondary"}>
                                  {schema.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {schema.isDeprecated && (
                                  <Badge variant="destructive">Deprecated</Badge>
                                )}
                                <Button variant="outline" size="sm" onClick={() => { setEditingSchema(schema); setShowSchemaDialog(true); }}>
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit & Deploy
                                </Button>
                              </div>
                            </div>
                            {schema.promptTemplate && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Prompt Template</p>
                                <p className="text-sm">{schema.promptTemplate}</p>
                              </div>
                            )}
                            <details className="group">
                              <summary className="cursor-pointer text-sm text-primary hover:underline list-none flex items-center gap-1">
                                <span className="group-open:rotate-90 transition-transform">▸</span>
                                View Schema JSON ({Object.keys(schema.schemaJson as object || {}).length} fields)
                              </summary>
                              <pre className="mt-2 p-3 bg-slate-950 text-slate-200 rounded-lg text-xs overflow-x-auto max-h-64">
                                {JSON.stringify(schema.schemaJson, null, 2)}
                              </pre>
                            </details>
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(schema.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={showSchemaDialog} onOpenChange={(open) => {
                  setShowSchemaDialog(open);
                  if (!open) setEditingSchema(null);
                }}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Extraction Schema: {editingSchema?.documentType}</DialogTitle>
                      <DialogDescription>
                        Modify the schema JSON and prompt template. Changes will be deployed immediately when saved.
                      </DialogDescription>
                    </DialogHeader>
                    {editingSchema && (
                      <form onSubmit={handleSaveSchema} className="space-y-4">
                        <div>
                          <Label htmlFor="promptTemplate">Prompt Template</Label>
                          <Textarea 
                            id="promptTemplate" 
                            name="promptTemplate" 
                            rows={3}
                            defaultValue={editingSchema.promptTemplate || ""} 
                            placeholder="Instructions for AI extraction..."
                          />
                          <p className="text-xs text-muted-foreground mt-1">Guide the AI on how to interpret and extract data from this document type.</p>
                        </div>
                        <div>
                          <Label htmlFor="schemaJson">Schema JSON</Label>
                          <Textarea 
                            id="schemaJson" 
                            name="schemaJson" 
                            rows={15}
                            className="font-mono text-sm"
                            defaultValue={JSON.stringify(editingSchema.schemaJson, null, 2)} 
                          />
                          <p className="text-xs text-muted-foreground mt-1">Define the fields to extract, their types, and validation rules.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id="isActive" name="isActive" defaultChecked={editingSchema.isActive} />
                          <Label htmlFor="isActive">Active (used for new extractions)</Label>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={updateSchemaMutation.isPending}>
                            {updateSchemaMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            Deploy Schema
                          </Button>
                        </DialogFooter>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Domain Rules</strong> automate compliance actions based on extracted data. <strong>Compliance Rules</strong> detect issues (e.g., "if C1 defect found, flag as urgent and create immediate action"). 
                    <strong>Normalisation Rules</strong> standardise data formats (e.g., convert "ID" to "C1", format dates to ISO standard). 
                    These rules run automatically after AI extraction to ensure consistent data and appropriate responses.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Compliance Rules</CardTitle>
                      <CardDescription>Rules that validate certificate data and trigger actions based on compliance requirements.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {rulesLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : complianceRules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No compliance rules configured.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredComplianceRules.map((rule) => (
                            <div key={rule.id} className="p-3 border rounded-lg space-y-2" data-testid={`row-rule-${rule.id}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{rule.ruleName}</span>
                                    {getStreamName(rule.complianceStreamId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">{rule.ruleCode}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={rule.isActive ? "default" : "secondary"}>
                                    {rule.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <Button variant="ghost" size="icon" onClick={() => { setEditingRule(rule); setShowRuleDialog(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{rule.description}</p>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">{rule.documentType}</Badge>
                                {rule.priority && <Badge variant="outline" className="text-xs">{rule.priority}</Badge>}
                                <Badge variant="outline" className="text-xs">{rule.action}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Normalisation Rules</CardTitle>
                      <CardDescription>Rules that transform extracted data into consistent formats.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {normRulesLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : normalisationRules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No normalisation rules configured.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredNormalisationRules.map((rule) => (
                            <div key={rule.id} className="p-3 border rounded-lg space-y-2" data-testid={`row-norm-rule-${rule.id}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{rule.ruleName}</span>
                                    {getStreamName(rule.complianceStreamId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">{rule.fieldPath}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={rule.isActive ? "default" : "secondary"}>
                                    {rule.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <Button variant="ghost" size="icon" onClick={() => { setEditingNormRule(rule); setShowNormRuleDialog(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">{rule.ruleType}</Badge>
                                {rule.outputValue && (
                                  <span className="text-xs text-muted-foreground">→ {rule.outputValue}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Dialog open={showRuleDialog} onOpenChange={(open) => {
                  setShowRuleDialog(open);
                  if (!open) setEditingRule(null);
                }}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Edit Compliance Rule</DialogTitle>
                      <DialogDescription>
                        Modify the rule conditions and actions.
                      </DialogDescription>
                    </DialogHeader>
                    {editingRule && (
                      <form onSubmit={handleSaveRule} className="space-y-4">
                        <div>
                          <Label htmlFor="ruleName">Rule Name</Label>
                          <Input id="ruleName" name="ruleName" defaultValue={editingRule.ruleName} required />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea id="description" name="description" defaultValue={editingRule.description} rows={2} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="action">Action</Label>
                            <Select name="action" defaultValue={editingRule.action}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FLAG_URGENT">Flag Urgent</SelectItem>
                                <SelectItem value="MARK_INCOMPLETE">Mark Incomplete</SelectItem>
                                <SelectItem value="AUTO_FAIL">Auto Fail</SelectItem>
                                <SelectItem value="INFO">Info Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="priority">Priority</Label>
                            <Select name="priority" defaultValue={editingRule.priority || "P2"}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="P1">P1 - Critical</SelectItem>
                                <SelectItem value="P2">P2 - High</SelectItem>
                                <SelectItem value="P3">P3 - Medium</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="conditions">Conditions (JSON)</Label>
                          <Textarea 
                            id="conditions" 
                            name="conditions" 
                            className="font-mono text-sm"
                            rows={4}
                            defaultValue={JSON.stringify(editingRule.conditions, null, 2)} 
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id="isActive" name="isActive" defaultChecked={editingRule.isActive} />
                          <Label htmlFor="isActive">Active</Label>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={updateRuleMutation.isPending}>
                            {updateRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Rule
                          </Button>
                        </DialogFooter>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={showNormRuleDialog} onOpenChange={(open) => {
                  setShowNormRuleDialog(open);
                  if (!open) setEditingNormRule(null);
                }}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Edit Normalisation Rule</DialogTitle>
                      <DialogDescription>
                        Modify how extracted data is transformed.
                      </DialogDescription>
                    </DialogHeader>
                    {editingNormRule && (
                      <form onSubmit={handleSaveNormRule} className="space-y-4">
                        <div>
                          <Label htmlFor="ruleName">Rule Name</Label>
                          <Input id="ruleName" name="ruleName" defaultValue={editingNormRule.ruleName} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="fieldPath">Field Path</Label>
                            <Input id="fieldPath" name="fieldPath" defaultValue={editingNormRule.fieldPath} required placeholder="defects.code" />
                          </div>
                          <div>
                            <Label htmlFor="ruleType">Rule Type</Label>
                            <Select name="ruleType" defaultValue={editingNormRule.ruleType}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MAPPING">Mapping</SelectItem>
                                <SelectItem value="REGEX">Regex</SelectItem>
                                <SelectItem value="TRANSFORM">Transform</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="inputPatterns">Input Patterns (comma-separated)</Label>
                          <Input 
                            id="inputPatterns" 
                            name="inputPatterns" 
                            defaultValue={editingNormRule.inputPatterns?.join(", ") || ""} 
                            placeholder="ID, immediately dangerous, IMMEDIATELY DANGEROUS"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="outputValue">Output Value</Label>
                            <Input id="outputValue" name="outputValue" defaultValue={editingNormRule.outputValue || ""} placeholder="C1" />
                          </div>
                          <div>
                            <Label htmlFor="transformFn">Transform Function</Label>
                            <Input id="transformFn" name="transformFn" defaultValue={editingNormRule.transformFn || ""} placeholder="UPPERCASE" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id="isActive" name="isActive" defaultChecked={editingNormRule.isActive} />
                          <Label htmlFor="isActive">Active</Label>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={updateNormRuleMutation.isPending}>
                            {updateNormRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Rule
                          </Button>
                        </DialogFooter>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
