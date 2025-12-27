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
import { Settings, FileText, AlertTriangle, Tags, Code, Plus, Pencil, Trash2, Lock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  certificateTypesApi, classificationCodesApi, extractionSchemasApi, 
  complianceRulesApi, normalisationRulesApi 
} from "@/lib/api";
import type { 
  CertificateType, ClassificationCode, ExtractionSchema, 
  ComplianceRule, NormalisationRule, InsertCertificateType, InsertClassificationCode 
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Configuration() {
  const [, setLocation] = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingCertType, setEditingCertType] = useState<CertificateType | null>(null);
  const [editingCode, setEditingCode] = useState<ClassificationCode | null>(null);
  const [showCertTypeDialog, setShowCertTypeDialog] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role === "super_admin" || role === "SUPER_ADMIN") {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

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
    const data: InsertClassificationCode = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      severity: formData.get("severity") as string,
      description: formData.get("description") as string,
      certificateTypeId: formData.get("certificateTypeId") as string || undefined,
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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Configuration" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display" data-testid="text-config-title">Configuration</h2>
                <p className="text-muted-foreground">Manage certificate types, classification codes, and extraction rules.</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>

            <Tabs defaultValue="cert-types" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
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

              <TabsContent value="cert-types" className="space-y-4">
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
                            <Select name="complianceStream" defaultValue={editingCertType?.complianceStream || "GAS"}>
                              <SelectTrigger data-testid="select-compliance-stream">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GAS">Gas</SelectItem>
                                <SelectItem value="ELECTRICAL">Electrical</SelectItem>
                                <SelectItem value="FIRE">Fire Safety</SelectItem>
                                <SelectItem value="ASBESTOS">Asbestos</SelectItem>
                                <SelectItem value="WATER">Water/Legionella</SelectItem>
                                <SelectItem value="LIFT">Lift/LOLER</SelectItem>
                                <SelectItem value="ENERGY">Energy</SelectItem>
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
                          {certificateTypes.map((type) => (
                            <TableRow key={type.id} data-testid={`row-cert-type-${type.id}`}>
                              <TableCell className="font-mono text-sm">{type.code}</TableCell>
                              <TableCell>{type.shortName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{type.complianceStream}</Badge>
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
                            <Select name="certificateTypeId" defaultValue={editingCode?.certificateTypeId || ""}>
                              <SelectTrigger data-testid="select-cert-type">
                                <SelectValue placeholder="Select type (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">All Types</SelectItem>
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
                            <TableHead>Severity</TableHead>
                            <TableHead>Timeframe</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classificationCodes.map((code) => (
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
                <Card>
                  <CardHeader>
                    <CardTitle>Extraction Schemas</CardTitle>
                    <CardDescription>Define the data extraction schemas for AI-powered document processing.</CardDescription>
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
                        {extractionSchemas.map((schema) => (
                          <div key={schema.id} className="border rounded-lg p-4 space-y-3" data-testid={`row-schema-${schema.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <Code className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{schema.documentType}</p>
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
              </TabsContent>

              <TabsContent value="rules" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Compliance Rules</CardTitle>
                      <CardDescription>Rules that validate certificate data against compliance requirements.</CardDescription>
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
                          {complianceRules.map((rule) => (
                            <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-rule-${rule.id}`}>
                              <div>
                                <div className="font-medium text-sm">{rule.ruleName}</div>
                                <div className="text-xs text-muted-foreground">{rule.ruleCode}</div>
                              </div>
                              <Badge variant={rule.isActive ? "default" : "secondary"}>
                                {rule.isActive ? "Active" : "Inactive"}
                              </Badge>
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
                          {normalisationRules.map((rule) => (
                            <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-norm-rule-${rule.id}`}>
                              <div>
                                <div className="font-medium text-sm">{rule.ruleName}</div>
                                <div className="text-xs text-muted-foreground">{rule.fieldPath} ({rule.ruleType})</div>
                              </div>
                              <Badge variant={rule.isActive ? "default" : "secondary"}>
                                {rule.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
