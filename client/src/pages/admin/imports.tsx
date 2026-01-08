import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";

type ImportType = "properties" | "units" | "components" | "geocoding";

const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: "properties", label: "Properties", description: "Import property records with UPRN, address, and tenure" },
  { value: "units", label: "Units", description: "Import rooms/areas within properties" },
  { value: "components", label: "Components (Assets)", description: "Import equipment and assets like boilers, alarms" },
  { value: "geocoding", label: "Geocoding", description: "Import map coordinates (latitude/longitude) for properties" },
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
  useEffect(() => {
    document.title = "Data Import - ComplianceAI";
  }, []);

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [importType, setImportType] = useState<ImportType>(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type');
    if (typeParam && ['properties', 'units', 'components', 'geocoding'].includes(typeParam)) {
      return typeParam as ImportType;
    }
    return "properties";
  });
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
  
  const geocodingImportMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const lines = csvData.trim().split('\n');
      const data: Array<{propertyId: string; latitude: number; longitude: number}> = [];
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 3) {
          const propertyId = parts[0].trim();
          const latitude = parseFloat(parts[1].trim());
          const longitude = parseFloat(parts[2].trim());
          if (propertyId && !isNaN(latitude) && !isNaN(longitude)) {
            data.push({ propertyId, latitude, longitude });
          }
        }
      }
      
      const res = await fetch('/api/geocoding/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to import geocoding data');
      }
      return { ...await res.json(), totalAttempted: data.length };
    },
    onSuccess: (data) => {
      setExecuteResult({ 
        success: true, 
        totalRows: data.totalAttempted, 
        importedRows: data.updated,
        isGeocoding: true
      });
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ["map-properties"] });
      queryClient.invalidateQueries({ queryKey: ["geocoding-status"] });
    },
    onError: (error: Error) => {
      setExecuteResult({
        success: false,
        totalRows: 0,
        importedRows: 0,
        isGeocoding: true,
        errorMessage: error.message
      });
      setStep(4);
    }
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
    
    if (importType === "geocoding") {
      geocodingImportMutation.mutate(csvContent);
    } else {
      createImportMutation.mutate({
        name: importName,
        importType: importType.toUpperCase(),
        fileName: `${importName}.csv`,
        fileType: "CSV",
        fileSize: csvContent.length,
      });
    }
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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Data Import" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" role="main" aria-label="Data import content">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Data Import</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Import CSV data using HACT hierarchy
              </p>
            </div>
          </div>
      
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
                    <div className="border rounded-lg p-3 sm:p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h4 className="font-medium">Template Columns</h4>
                        <div className="flex flex-col xs:flex-row gap-2">
                          <Button variant="outline" size="sm" asChild data-testid="btn-download-template" className="w-full xs:w-auto">
                            <a href={dataImportsApi.downloadTemplate(importType)} download>
                              <Download className="h-4 w-4 mr-2" />
                              Blank Template
                            </a>
                          </Button>
                          <Button variant="default" size="sm" asChild data-testid="btn-download-sample" className="w-full xs:w-auto">
                            <a href={dataImportsApi.downloadSample(importType)} download>
                              <FileText className="h-4 w-4 mr-2" />
                              Sample with Data
                            </a>
                          </Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <Table className="min-w-[500px]">
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
                              <TableCell className="font-mono text-xs sm:text-sm">{col.name}</TableCell>
                              <TableCell>
                                {col.required ? (
                                  <Badge variant="destructive">Required</Badge>
                                ) : (
                                  <Badge variant="secondary">Optional</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs sm:text-sm">{col.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 sm:p-8 text-center">
                      <Upload className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                      <Input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto text-xs sm:text-sm"
                        data-testid="input-csv-file"
                      />
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
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
                    disabled={!importName || !csvContent || createImportMutation.isPending || geocodingImportMutation.isPending}
                    data-testid="button-start-import"
                  >
                    {(createImportMutation.isPending || geocodingImportMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {importType === "geocoding" ? "Import Coordinates" : "Continue to Validation"}
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
                        <div className="bg-muted p-2 sm:p-3 flex items-center justify-between">
                          <span className="font-medium text-sm sm:text-base">Data Preview</span>
                          <Badge variant="secondary" className="text-xs">{totalRows} rows</Badge>
                        </div>
                        <div className="overflow-x-auto">
                          <Table className="min-w-[400px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 sm:w-12 text-xs">#</TableHead>
                                {headers.map((header, idx) => (
                                  <TableHead key={idx} className="font-mono text-[10px] sm:text-xs">{header}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                  <TableCell className="text-muted-foreground text-xs">{rowIdx + 1}</TableCell>
                                  {row.map((cell, cellIdx) => (
                                    <TableCell key={cellIdx} className="text-xs sm:text-sm max-w-24 sm:max-w-32 truncate">
                                      {cell || <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {totalRows > 5 && (
                          <div className="bg-muted/50 p-2 text-center text-xs sm:text-sm text-muted-foreground">
                            Showing first 5 of {totalRows} rows
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  <div className="flex flex-col xs:flex-row gap-2 sm:gap-4">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-full xs:w-auto">
                      Back
                    </Button>
                    <Button 
                      onClick={handleValidate}
                      disabled={validateMutation.isPending}
                      data-testid="button-validate"
                      className="w-full xs:w-auto"
                    >
                      {validateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Validate Data
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 3 && validationResult && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4">
                    <Card>
                      <CardContent className="pt-4 sm:pt-6">
                        <div className="text-xl sm:text-2xl font-bold">{validationResult.totalRows}</div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Rows</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 sm:pt-6">
                        <div className="text-xl sm:text-2xl font-bold text-green-600">{validationResult.validRows}</div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Valid Rows</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 sm:pt-6">
                        <div className="text-xl sm:text-2xl font-bold text-red-600">{validationResult.invalidRows}</div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Invalid Rows</p>
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
                    <div className="border rounded-lg max-h-64 overflow-y-auto overflow-x-auto">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs sm:text-sm">Row</TableHead>
                            <TableHead className="text-xs sm:text-sm">Field</TableHead>
                            <TableHead className="text-xs sm:text-sm">Error</TableHead>
                            <TableHead className="text-xs sm:text-sm">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.errors.slice(0, 50).map((err: any, idx: number) => (
                            err.errors.map((e: any, eidx: number) => (
                              <TableRow key={`${idx}-${eidx}`}>
                                <TableCell className="text-xs sm:text-sm">{err.rowNumber}</TableCell>
                                <TableCell className="font-mono text-xs sm:text-sm">{e.field}</TableCell>
                                <TableCell className="text-red-600 text-xs sm:text-sm">{e.error}</TableCell>
                                <TableCell className="text-muted-foreground text-xs sm:text-sm max-w-24 truncate">{String(e.value)}</TableCell>
                              </TableRow>
                            ))
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  <div className="flex flex-col xs:flex-row gap-2 sm:gap-4">
                    <Button variant="outline" onClick={resetWizard} className="w-full xs:w-auto">
                      Start Over
                    </Button>
                    <Button 
                      onClick={handleExecute}
                      disabled={validationResult.validRows === 0 || executeMutation.isPending}
                      data-testid="button-execute-import"
                      className="w-full xs:w-auto"
                    >
                      {executeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Play className="h-4 w-4 mr-2" />
                      <span className="truncate">Import {validationResult.validRows} Valid Rows</span>
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
                    <AlertTitle>
                      {executeResult.success 
                        ? (executeResult.isGeocoding ? "Geocoding Import Complete!" : "Import Complete!") 
                        : (executeResult.isGeocoding ? "Geocoding Import Failed" : "Import Completed with Errors")}
                    </AlertTitle>
                    <AlertDescription>
                      {executeResult.success ? (
                        executeResult.isGeocoding 
                          ? `Successfully updated coordinates for ${executeResult.importedRows} of ${executeResult.totalRows} properties.`
                          : `Successfully imported ${executeResult.importedRows} of ${executeResult.totalRows} rows.`
                      ) : (
                        executeResult.errorMessage || `Failed to complete import. ${executeResult.importedRows} of ${executeResult.totalRows} rows imported.`
                      )}
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
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Import History</CardTitle>
              <CardDescription className="text-xs sm:text-sm">View past import operations and their results</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
              {importsLoading && !imports.length ? (
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Name</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm">Rows</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24 sm:w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 sm:w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 sm:w-24 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12 sm:w-16" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : imports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  No imports yet. Start by creating a new import.
                </div>
              ) : (
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Name</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm">Rows</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => {
                      const statusInfo = STATUS_BADGES[imp.status] || STATUS_BADGES.PENDING;
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={imp.id} data-testid={`import-row-${imp.id}`}>
                          <TableCell className="font-medium text-xs sm:text-sm max-w-32 truncate">{imp.name}</TableCell>
                          <TableCell className="text-xs sm:text-sm">{imp.importType}</TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant} className="text-xs">
                              <StatusIcon className="h-3 w-3 mr-1" />
                              <span className="hidden xs:inline">{imp.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {imp.importedRows || 0} / {imp.totalRows || 0}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">
                            {new Date(imp.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </main>
      </div>
    </div>
  );
}
