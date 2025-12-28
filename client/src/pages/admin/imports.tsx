import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { dataImportsApi } from "@/lib/api";
import { Upload, Download, FileText, AlertCircle, CheckCircle, XCircle, Clock, Play, Loader2, Info } from "lucide-react";

type ImportType = "properties" | "units" | "components";

const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: "properties", label: "Properties", description: "Import property records with UPRN, address, and tenure" },
  { value: "units", label: "Units", description: "Import rooms/areas within properties" },
  { value: "components", label: "Components (Assets)", description: "Import equipment and assets like boilers, alarms" },
];

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  PENDING: { variant: "secondary", icon: Clock },
  VALIDATING: { variant: "outline", icon: Loader2 },
  VALIDATED: { variant: "default", icon: CheckCircle },
  IMPORTING: { variant: "outline", icon: Loader2 },
  COMPLETED: { variant: "default", icon: CheckCircle },
  FAILED: { variant: "destructive", icon: XCircle },
  CANCELLED: { variant: "secondary", icon: XCircle },
};

export default function ImportsPage() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [importType, setImportType] = useState<ImportType>("properties");
  const [importName, setImportName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [executeResult, setExecuteResult] = useState<any>(null);
  
  const queryClient = useQueryClient();
  
  const { data: imports = [], isLoading: importsLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: dataImportsApi.list,
  });
  
  const { data: template } = useQuery({
    queryKey: ["import-template", importType],
    queryFn: () => dataImportsApi.getTemplate(importType),
    enabled: step === 1,
  });
  
  const createImportMutation = useMutation({
    mutationFn: dataImportsApi.create,
    onSuccess: (data) => {
      setCurrentImportId(data.id);
      setStep(2);
      queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });
  
  const validateMutation = useMutation({
    mutationFn: ({ id, csv }: { id: string; csv: string }) => dataImportsApi.validate(id, csv),
    onSuccess: (data) => {
      setValidationResult(data);
      setStep(3);
    },
  });
  
  const executeMutation = useMutation({
    mutationFn: (id: string) => dataImportsApi.execute(id),
    onSuccess: (data) => {
      setExecuteResult(data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };
  
  const handleCreateImport = () => {
    if (!importName || !csvContent) return;
    
    createImportMutation.mutate({
      name: importName,
      importType: importType.toUpperCase(),
      fileName: `${importName}.csv`,
      fileType: "CSV",
      fileSize: csvContent.length,
    });
  };
  
  const handleValidate = () => {
    if (!currentImportId) return;
    validateMutation.mutate({ id: currentImportId, csv: csvContent });
  };
  
  const handleExecute = () => {
    if (!currentImportId) return;
    executeMutation.mutate(currentImportId);
  };
  
  const resetWizard = () => {
    setStep(1);
    setImportName("");
    setCsvContent("");
    setCurrentImportId(null);
    setValidationResult(null);
    setExecuteResult(null);
  };
  
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Data Import" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Data Import</h1>
              <p className="text-muted-foreground">
                Import properties, units, and components from CSV files
              </p>
            </div>
          </div>
          
          <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>HACT-Aligned Import</AlertTitle>
        <AlertDescription>
          Import data following the HACT standard hierarchy: Properties contain Units (rooms/areas), 
          which contain Components (assets like boilers, alarms). Use the templates to ensure correct format.
        </AlertDescription>
      </Alert>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "new" | "history")}>
        <TabsList>
          <TabsTrigger value="new" data-testid="tab-new-import">New Import</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-import-history">Import History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Wizard</CardTitle>
              <CardDescription>
                Step {step} of 4: {
                  step === 1 ? "Select Type & Upload" :
                  step === 2 ? "Review Data" :
                  step === 3 ? "Validation Results" :
                  "Import Complete"
                }
              </CardDescription>
              <Progress value={(step / 4) * 100} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Import Type</Label>
                    <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                      <SelectTrigger data-testid="select-import-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <span className="font-medium">{type.label}</span>
                              <span className="text-muted-foreground ml-2">- {type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Import Name</Label>
                    <Input 
                      placeholder="e.g., Q4 2024 Property Update"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      data-testid="input-import-name"
                    />
                  </div>
                  
                  {template && (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Template Columns</h4>
                        <Button variant="outline" size="sm" asChild>
                          <a href={dataImportsApi.downloadTemplate(importType)} download>
                            <Download className="h-4 w-4 mr-2" />
                            Download Template
                          </a>
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {template.columns.map((col) => (
                            <TableRow key={col.name}>
                              <TableCell className="font-mono text-sm">{col.name}</TableCell>
                              <TableCell>
                                {col.required ? (
                                  <Badge variant="destructive">Required</Badge>
                                ) : (
                                  <Badge variant="secondary">Optional</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{col.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <Input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto"
                        data-testid="input-csv-file"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Upload a CSV file matching the template format
                      </p>
                    </div>
                    {csvContent && (
                      <Alert>
                        <FileText className="h-4 w-4" />
                        <AlertDescription>
                          File loaded: {csvContent.split("\n").length - 1} data rows detected
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleCreateImport}
                    disabled={!importName || !csvContent || createImportMutation.isPending}
                    data-testid="button-start-import"
                  >
                    {createImportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Continue to Validation
                  </Button>
                </div>
              )}
              
              {step === 2 && (
                <div className="space-y-6">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Ready to Validate</AlertTitle>
                    <AlertDescription>
                      Review the data preview below, then click "Validate Data" to check for errors before importing.
                    </AlertDescription>
                  </Alert>
                  
                  {csvContent && (() => {
                    const lines = csvContent.trim().split("\n");
                    const headers = lines[0]?.split(",").map(h => h.trim().replace(/^"|"$/g, '')) || [];
                    const previewRows = lines.slice(1, 6).map(line => 
                      line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ''))
                    );
                    const totalRows = lines.length - 1;
                    
                    return (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted p-3 flex items-center justify-between">
                          <span className="font-medium">Data Preview</span>
                          <Badge variant="secondary">{totalRows} rows total</Badge>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                {headers.map((header, idx) => (
                                  <TableHead key={idx} className="font-mono text-xs">{header}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                  <TableCell className="text-muted-foreground">{rowIdx + 1}</TableCell>
                                  {row.map((cell, cellIdx) => (
                                    <TableCell key={cellIdx} className="text-sm max-w-32 truncate">
                                      {cell || <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {totalRows > 5 && (
                          <div className="bg-muted/50 p-2 text-center text-sm text-muted-foreground">
                            Showing first 5 of {totalRows} rows
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleValidate}
                      disabled={validateMutation.isPending}
                      data-testid="button-validate"
                    >
                      {validateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Validate Data
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 3 && validationResult && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{validationResult.totalRows}</div>
                        <p className="text-sm text-muted-foreground">Total Rows</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">{validationResult.validRows}</div>
                        <p className="text-sm text-muted-foreground">Valid Rows</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-600">{validationResult.invalidRows}</div>
                        <p className="text-sm text-muted-foreground">Invalid Rows</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {validationResult.invalidRows > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Validation Errors Found</AlertTitle>
                      <AlertDescription>
                        {validationResult.invalidRows} rows have errors and will be skipped during import.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {validationResult.errors?.length > 0 && (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 50).map((err: any, idx: number) => (
                            err.errors.map((e: any, eidx: number) => (
                              <TableRow key={`${idx}-${eidx}`}>
                                <TableCell>{err.rowNumber}</TableCell>
                                <TableCell className="font-mono">{e.field}</TableCell>
                                <TableCell className="text-red-600">{e.error}</TableCell>
                                <TableCell className="text-muted-foreground">{String(e.value)}</TableCell>
                              </TableRow>
                            ))
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={resetWizard}>
                      Start Over
                    </Button>
                    <Button 
                      onClick={handleExecute}
                      disabled={validationResult.validRows === 0 || executeMutation.isPending}
                      data-testid="button-execute-import"
                    >
                      {executeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Play className="h-4 w-4 mr-2" />
                      Import {validationResult.validRows} Valid Rows
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 4 && executeResult && (
                <div className="space-y-6">
                  <Alert className={executeResult.success ? "border-green-500" : "border-red-500"}>
                    {executeResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <AlertTitle>{executeResult.success ? "Import Complete!" : "Import Completed with Errors"}</AlertTitle>
                    <AlertDescription>
                      Successfully imported {executeResult.importedRows} of {executeResult.totalRows} rows.
                    </AlertDescription>
                  </Alert>
                  
                  <Button onClick={resetWizard} data-testid="button-new-import">
                    Start New Import
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>View past import operations and their results</CardDescription>
            </CardHeader>
            <CardContent>
              {importsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : imports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No imports yet. Start by creating a new import.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => {
                      const statusInfo = STATUS_BADGES[imp.status] || STATUS_BADGES.PENDING;
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={imp.id} data-testid={`import-row-${imp.id}`}>
                          <TableCell className="font-medium">{imp.name}</TableCell>
                          <TableCell>{imp.importType}</TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {imp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {imp.importedRows || 0} / {imp.totalRows || 0}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(imp.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </main>
      </div>
    </div>
  );
}
