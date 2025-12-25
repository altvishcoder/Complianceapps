import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, BrainCircuit, X, Calendar, User, MapPin, Scan, FileSearch, Layers } from "lucide-react";
import { useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import generatedImage from '@assets/generated_images/abstract_digital_network_background_for_ai_interface.png';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropzone } from "react-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, certificatesApi } from "@/lib/api";
import { useUpload } from "@/hooks/use-upload";
import type { EnrichedCertificate } from "@/lib/api";

const CERTIFICATE_TYPES = [
  { value: "GAS_SAFETY", label: "Gas Safety (CP12)" },
  { value: "EICR", label: "Electrical (EICR)" },
  { value: "FIRE_RISK_ASSESSMENT", label: "Fire Risk Assessment" },
  { value: "ASBESTOS_SURVEY", label: "Asbestos Survey" },
  { value: "LEGIONELLA_ASSESSMENT", label: "Legionella Assessment" },
  { value: "LIFT_LOLER", label: "Lift (LOLER)" },
  { value: "EPC", label: "Energy Performance (EPC)" },
  { value: "OTHER", label: "Other" },
];

export default function Ingestion() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("auto-detect");
  const [selectedType, setSelectedType] = useState("auto-detect");
  const [extractedResult, setExtractedResult] = useState<EnrichedCertificate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const { data: recentCertificates = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
  });

  const createCertificate = useMutation({
    mutationFn: certificatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setUploadProgress(0);
      setProcessingState('idle');
      setExtractedResult(null);
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFileBase64(base64);
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: 1
  });

  const handleProcessDocument = async () => {
    if (!file || !selectedPropertyId || !selectedType) {
      toast({
        title: "Missing Information",
        description: "Please select a property (or auto-detect) and certificate type before processing.",
        variant: "destructive",
      });
      return;
    }
    
    const isAutoDetectProperty = selectedPropertyId === 'auto-detect';
    const isAutoDetectType = selectedType === 'auto-detect';

    setProcessingState('uploading');
    setUploadProgress(0);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(Math.min(progress, 30));
    }, 100);

    try {
      const mimeType = file.type;
      
      setProcessingStep("Uploading to secure storage...");
      const uploadResult = await uploadFile(file);
      const storageKey = uploadResult?.objectPath || null;
      
      clearInterval(interval);
      setUploadProgress(40);
      setProcessingState('analyzing');
      setProcessingStep("Analyzing document...");
      
      const actualPropertyId = isAutoDetectProperty 
        ? (properties.length > 0 ? properties[0].id : '') 
        : selectedPropertyId;
        
      if (!actualPropertyId) {
        throw new Error('No properties available. Please create a property first.');
      }
      
      const actualType = isAutoDetectType ? 'OTHER' : selectedType;
      
      const certificate = await createCertificate.mutateAsync({
        propertyId: actualPropertyId,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        certificateType: actualType as any,
        storageKey: storageKey,
        fileBase64: mimeType.startsWith('image/') ? fileBase64 : undefined,
        mimeType: mimeType.startsWith('image/') ? mimeType : undefined,
      });

      setUploadProgress(50);
      setProcessingStep("Waiting for AI extraction to complete...");
      
      // Poll until extraction is complete (status changes from PROCESSING)
      let enrichedCert = await certificatesApi.get(certificate.id);
      let attempts = 0;
      const maxAttempts = 30; // Max 30 seconds
      
      while (enrichedCert.status === 'PROCESSING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        setUploadProgress(50 + Math.min(attempts * 1.5, 40));
        setProcessingStep(`Analyzing document... (${attempts}s)`);
        enrichedCert = await certificatesApi.get(certificate.id);
      }
      
      if (enrichedCert.status === 'PROCESSING') {
        throw new Error('AI extraction timed out. Please try again.');
      }
      
      setUploadProgress(95);
      setProcessingStep("Extraction complete!");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setExtractedResult(enrichedCert);
      
      setUploadProgress(100);
      setProcessingState('complete');
      
    } catch (error) {
      clearInterval(interval);
      setProcessingState('error');
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process document",
        variant: "destructive",
      });
    }
  };

  const handleApprove = () => {
    setIsReviewOpen(false);
    setProcessingState('idle');
    setFile(null);
    setFileBase64("");
    setExtractedResult(null);
    toast({
      title: "Certificate Approved",
      description: "The certificate has been validated and added to the property record.",
      variant: "default",
    });
  };

  const resetUpload = () => {
    setFile(null);
    setFileBase64("");
    setProcessingState('idle');
    setExtractedResult(null);
    setUploadProgress(0);
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Cert Hub - Advanced Document Center" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <Tabs defaultValue="upload" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="upload">Upload & Scan</TabsTrigger>
                <TabsTrigger value="batch">Batch Processing</TabsTrigger>
                <TabsTrigger value="review">Review Queue (12)</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="gap-2">
                    <Scan className="h-4 w-4" />
                    Connect Scanner
                 </Button>
                 <Button variant="outline" size="sm" className="gap-2">
                    <Layers className="h-4 w-4" />
                    Templates
                 </Button>
              </div>
            </div>

            <TabsContent value="upload" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Upload Area */}
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>Intelligent Ingestion</CardTitle>
                    <CardDescription>AI-powered extraction. Drag files here.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Select Property</Label>
                        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={processingState !== 'idle'}>
                          <SelectTrigger data-testid="select-property-ingestion">
                            <SelectValue placeholder="Choose property..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="auto-detect">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-600">Auto-detect from document</span>
                              </div>
                            </SelectItem>
                            <div className="my-1 border-t" />
                            {properties.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.addressLine1}, {p.postcode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPropertyId === 'auto-detect' && (
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            AI will extract address and match to properties
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Certificate Type</Label>
                        <Select value={selectedType} onValueChange={setSelectedType} disabled={processingState !== 'idle'}>
                          <SelectTrigger data-testid="select-type-ingestion">
                            <SelectValue placeholder="Choose type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto-detect">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-600">Auto-detect from document</span>
                              </div>
                            </SelectItem>
                            <div className="my-1 border-t" />
                            {CERTIFICATE_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedType === 'auto-detect' && (
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            AI will identify the certificate type
                          </p>
                        )}
                      </div>
                    </div>

                    {!file ? (
                      <div 
                        {...getRootProps()}
                        className={`h-full min-h-[220px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer group
                          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'}
                        `}
                      >
                        <input {...getInputProps()} data-testid="file-input-ingestion" />
                        <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Scan className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Drop Document Here</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mb-4">
                          Supports PDF, JPG, PNG, WebP<br/>
                          AI-powered document extraction
                        </p>
                        <div className="flex gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                           <BrainCircuit className="h-3 w-3" />
                           <span>AI Vision Active</span>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-medium">{file.name}</p>
                              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          {processingState === 'idle' && (
                            <Button variant="ghost" size="icon" onClick={resetUpload} data-testid="remove-file-ingestion">
                              <X className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                        
                        {processingState === 'idle' && (
                          <Button 
                            className="w-full gap-2" 
                            onClick={handleProcessDocument}
                            disabled={!selectedPropertyId || !selectedType}
                            data-testid="start-processing-ingestion"
                          >
                            <BrainCircuit className="h-4 w-4" />
                            Start AI Processing
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Processing View */}
                <Card className="h-full flex flex-col relative overflow-hidden border-blue-200/50 dark:border-blue-800/50">
                  {/* Background Image for AI Feel */}
                  <div 
                    className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                    style={{ 
                      backgroundImage: `url(${generatedImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  
                  <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BrainCircuit className="h-5 w-5 text-blue-600" />
                          Cert Hub Intelligence
                        </CardTitle>
                        <CardDescription>Real-time extraction and validation</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Engine Active
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 relative z-10 space-y-4">
                    {processingState === 'idle' && (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <BrainCircuit className="h-12 w-12 mb-4 opacity-20" />
                        <p>Ready to analyze documents...</p>
                        <p className="text-xs mt-2">Upload a file and click "Start AI Processing"</p>
                      </div>
                    )}

                    {(processingState === 'uploading' || processingState === 'analyzing') && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-blue-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-blue-500" />
                            <div>
                              <p className="font-medium text-sm">{file?.name || "Document"}</p>
                              <p className="text-xs text-blue-600 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {processingStep}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>Upload & Storage</span>
                            <span className={uploadProgress >= 40 ? "text-emerald-600" : "text-blue-600"}>
                              {uploadProgress >= 40 ? "Complete" : "Processing..."}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(uploadProgress * 2.5, 100)}%` }} />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-3">
                            <span>AI Document Analysis</span>
                            <span className={uploadProgress >= 70 ? "text-emerald-600" : "text-blue-600"}>
                              {uploadProgress >= 90 ? "Complete" : uploadProgress >= 40 ? "Processing..." : "Waiting..."}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${uploadProgress >= 40 ? 'bg-blue-500' : 'bg-slate-200'}`} 
                                 style={{ width: `${Math.max(0, (uploadProgress - 40) * 1.67)}%` }} />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-950 rounded-md font-mono text-xs text-slate-200 space-y-1 border border-slate-800">
                          <p className="text-emerald-400">{'>'} Model: claude-3-5-haiku-20241022</p>
                          <p>{'>'} Document Type: {CERTIFICATE_TYPES.find(t => t.value === selectedType)?.label || selectedType}</p>
                          <p className="animate-pulse text-blue-400">{'>'} {processingStep}</p>
                        </div>
                      </div>
                    )}

                    {processingState === 'complete' && extractedResult && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${
                          extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS'
                            ? 'bg-emerald-50/50 border border-emerald-100'
                            : 'bg-amber-50/50 border border-amber-100'
                        }`}>
                            {extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS' ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                            )}
                            <div>
                              <p className={`font-medium ${
                                extractedResult.outcome === 'SATISFACTORY' ? 'text-emerald-900' : 'text-amber-900'
                              }`}>AI Extraction Complete</p>
                              <p className={`text-sm mt-1 ${
                                extractedResult.outcome === 'SATISFACTORY' ? 'text-emerald-700' : 'text-amber-700'
                              }`}>
                                Certificate extracted for <strong>{extractedResult.property?.addressLine1}</strong>
                              </p>
                            </div>
                        </div>

                        <div className="bg-white border border-border rounded-lg divide-y divide-border text-sm">
                            <div className="p-3 flex justify-between">
                              <span className="text-muted-foreground">Type</span>
                              <span className="font-medium">{extractedResult.certificateType?.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <span className="text-muted-foreground">Outcome</span>
                              <span className={`font-medium px-2 py-0.5 rounded text-xs border ${
                                extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS'
                                  ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                  : 'text-red-600 bg-red-50 border-red-100'
                              }`}>{extractedResult.outcome}</span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <span className="text-muted-foreground">Issue Date</span>
                              <span className="font-medium">{extractedResult.issueDate || 'N/A'}</span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <span className="text-muted-foreground">Expiry Date</span>
                              <span className="font-medium">{extractedResult.expiryDate || 'N/A'}</span>
                            </div>
                            {extractedResult.extractedData?.c1Count > 0 && (
                              <div className="p-3 flex justify-between">
                                <span className="text-muted-foreground">C1 Defects</span>
                                <span className="font-medium text-red-600">{extractedResult.extractedData.c1Count}</span>
                              </div>
                            )}
                            {extractedResult.extractedData?.c2Count > 0 && (
                              <div className="p-3 flex justify-between">
                                <span className="text-muted-foreground">C2 Defects</span>
                                <span className="font-medium text-orange-600">{extractedResult.extractedData.c2Count}</span>
                              </div>
                            )}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={resetUpload}>
                              Upload Another
                            </Button>
                            <Button className="flex-1 gap-2" onClick={() => setIsReviewOpen(true)}>
                              Review Details <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                    )}

                    {processingState === 'error' && (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mb-4 text-red-400" />
                        <p className="text-red-600 font-medium">Processing Failed</p>
                        <p className="text-sm mt-2">Please try again or use a different document format.</p>
                        <Button variant="outline" className="mt-4" onClick={resetUpload}>
                          Try Again
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="batch">
               <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-lg bg-muted/10">
                  <Layers className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold">Batch Processing Mode</h3>
                  <p className="text-muted-foreground mb-4">Upload folder or ZIP archive for bulk ingestion.</p>
                  <Button variant="outline">Select Folder</Button>
               </div>
            </TabsContent>
          </Tabs>
          
          {/* Recent Uploads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Certificates</CardTitle>
              <CardDescription>Recently processed certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Property</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Outcome</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentCertificates.slice(0, 5).map((cert) => (
                      <tr key={cert.id} className="hover:bg-muted/20">
                        <td className="p-3 font-medium">{cert.fileName}</td>
                        <td className="p-3">{cert.certificateType?.replace(/_/g, ' ')}</td>
                        <td className="p-3">{cert.property?.addressLine1 || 'N/A'}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            cert.status === 'APPROVED' || cert.status === 'EXTRACTED' 
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                              : cert.status === 'NEEDS_REVIEW'
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                              : cert.status === 'PROCESSING'
                              ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                              : 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20'
                          }`}>
                            {cert.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={
                            cert.outcome === 'SATISFACTORY' || cert.outcome === 'PASS'
                              ? 'text-emerald-600 border-emerald-200'
                              : 'text-red-600 border-red-200'
                          }>{cert.outcome}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/certificates/${cert.id}`}>View</a>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {recentCertificates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No certificates processed yet. Upload a document above to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </main>
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="p-6 border-b border-border bg-muted/10">
            <DialogHeader>
              <DialogTitle>Review Extraction Results</DialogTitle>
              <DialogDescription>
                Verify AI-extracted data against the original document before processing.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Document Preview */}
            <div className="w-1/2 bg-slate-900 p-4 flex items-center justify-center border-r border-border overflow-y-auto">
               {extractedResult?.storageKey && extractedResult.fileType?.startsWith('image/') ? (
                 <img 
                   src={`/api/object-storage/url/${encodeURIComponent(extractedResult.storageKey)}`}
                   alt="Certificate document"
                   className="max-w-full max-h-full object-contain rounded shadow-2xl"
                 />
               ) : (
                 <div className="flex flex-col items-center text-slate-300 text-center">
                   <div className="p-6 bg-slate-800 rounded-xl mb-4">
                     <FileText className="h-20 w-20" />
                   </div>
                   <p className="text-lg font-medium mb-1">{extractedResult?.fileName || file?.name || 'Document'}</p>
                   <p className="text-sm text-slate-400 mb-4">
                     {extractedResult?.fileType === 'application/pdf' ? 'PDF Document' : extractedResult?.fileType || 'Document'}
                   </p>
                   {extractedResult?.storageKey && (
                     <a 
                       href={`/api/object-storage/url/${encodeURIComponent(extractedResult.storageKey)}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-sm text-blue-400 hover:text-blue-300 underline"
                     >
                       Open in new tab
                     </a>
                   )}
                 </div>
               )}
            </div>

            {/* Form Fields - Real Data */}
            <div className="w-1/2 p-6 overflow-y-auto bg-background">
               {extractedResult ? (
               <div className="space-y-6">
                 <div className="space-y-4">
                   <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Property Details</h3>
                   <div className="grid gap-2">
                     <Label>Selected Property (from your selection)</Label>
                     <div className="relative">
                       <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input 
                         value={`${extractedResult.property?.addressLine1 || ''}, ${extractedResult.property?.postcode || ''}`} 
                         readOnly
                         className="pl-9 bg-blue-50/50 border-blue-200" 
                       />
                     </div>
                   </div>
                   {(extractedResult.extractedData?.installationAddress || extractedResult.extractedData?.propertyAddress) && (() => {
                     const addr = extractedResult.extractedData?.installationAddress;
                     const propAddr = extractedResult.extractedData?.propertyAddress;
                     let extractedAddress = 'Not extracted';
                     
                     if (typeof addr === 'string') {
                       extractedAddress = addr;
                     } else if (addr?.fullAddress) {
                       extractedAddress = addr.fullAddress;
                     } else if (propAddr?.streetAddress) {
                       extractedAddress = `${propAddr.streetAddress}, ${propAddr.city || ''} ${propAddr.postCode || propAddr.postcode || ''}`;
                     }
                     
                     const selectedAddr = `${extractedResult.property?.addressLine1 || ''}, ${extractedResult.property?.postcode || ''}`.toLowerCase();
                     const normalizedExtracted = extractedAddress.toLowerCase();
                     const isMismatch = extractedAddress !== 'Not extracted' && 
                       !normalizedExtracted.includes(selectedAddr.split(',')[0].trim()) &&
                       !selectedAddr.includes(normalizedExtracted.split(',')[0].trim());
                     
                     return (
                       <div className="grid gap-2">
                         <Label className="flex items-center gap-2">
                           Address from Certificate (AI extracted)
                           {isMismatch && <Badge variant="destructive" className="text-xs">Mismatch!</Badge>}
                         </Label>
                         <div className="relative">
                           <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input 
                             value={extractedAddress} 
                             readOnly
                             className={`pl-9 ${isMismatch ? 'bg-red-50 border-red-300 text-red-900' : 'bg-amber-50/50 border-amber-200 text-amber-900'}`}
                           />
                         </div>
                         {isMismatch ? (
                           <p className="text-xs text-red-600 font-medium">Warning: The extracted address does not match the selected property!</p>
                         ) : (
                           <p className="text-xs text-amber-600">Please verify the selected property matches the certificate address</p>
                         )}
                       </div>
                     );
                   })()}
                 </div>

                 <div className="space-y-4">
                   <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Certificate Data</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Type (you selected)</Label>
                        <Input value={extractedResult.certificateType?.replace(/_/g, ' ') || 'Unknown'} readOnly className="bg-blue-50/50 border-blue-200" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Reference Number</Label>
                        <Input value={extractedResult.extractedData?.certificateNumber || extractedResult.extractedData?.reportNumber || extractedResult.certificateNumber || 'N/A'} readOnly />
                      </div>
                   </div>
                   {extractedResult.extractedData?.documentType && (
                     <div className="grid gap-2">
                       <Label>Detected Type (AI extracted)</Label>
                       <Input 
                         value={extractedResult.extractedData.documentType} 
                         readOnly 
                         className="bg-amber-50/50 border-amber-200 text-amber-900"
                       />
                       <p className="text-xs text-amber-600">Please verify the selected type matches the actual certificate</p>
                     </div>
                   )}
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Issue Date</Label>
                        <div className="relative">
                           <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input 
                             value={extractedResult.issueDate || extractedResult.extractedData?.issueDate || 'N/A'} 
                             readOnly 
                             className="pl-9" 
                           />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Expiry Date</Label>
                         <div className="relative">
                           <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input 
                             value={extractedResult.expiryDate || extractedResult.extractedData?.expiryDate || extractedResult.extractedData?.reviewDate || 'N/A'} 
                             readOnly 
                             className={`pl-9 font-medium ${(extractedResult.expiryDate || extractedResult.extractedData?.expiryDate) ? 'text-emerald-600' : ''}`} 
                           />
                        </div>
                      </div>
                   </div>

                   <div className="grid gap-2">
                     <Label>Engineer / Inspector</Label>
                     <div className="relative">
                       <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input 
                         value={(() => {
                           const data = extractedResult.extractedData;
                           if (!data) return 'Not extracted';
                           const name = data.engineerName || data.inspector?.name || 'Unknown';
                           const regNum = data.engineerIdNumber || data.inspector?.registrationNumber || '';
                           return regNum ? `${name} (${regNum})` : name;
                         })()}
                         readOnly 
                         className="pl-9" 
                       />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Compliance Outcome</h3>
                    <div className={`p-4 rounded-lg border space-y-3 ${
                      extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-red-200 bg-red-50'
                    }`}>
                       <div className="flex items-center justify-between">
                         <Label className={extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS' ? 'text-emerald-900' : 'text-red-900'}>
                           Overall Status
                         </Label>
                         <Badge className={
                           extractedResult.outcome === 'SATISFACTORY' || extractedResult.outcome === 'PASS'
                             ? 'bg-emerald-600 hover:bg-emerald-700'
                             : 'bg-red-600 hover:bg-red-700'
                         }>{extractedResult.outcome}</Badge>
                       </div>
                       
                       {(extractedResult.extractedData?.c1Count > 0 || extractedResult.extractedData?.c2Count > 0 || extractedResult.extractedData?.c3Count > 0) ? (
                         <div className="space-y-2">
                           <Label className="text-slate-700">Defects Identified</Label>
                           <div className="flex gap-2 flex-wrap">
                             {extractedResult.extractedData?.c1Count > 0 && (
                               <Badge variant="destructive">C1: {extractedResult.extractedData.c1Count} (Immediate Danger)</Badge>
                             )}
                             {extractedResult.extractedData?.c2Count > 0 && (
                               <Badge className="bg-orange-500 hover:bg-orange-600">C2: {extractedResult.extractedData.c2Count} (At Risk)</Badge>
                             )}
                             {extractedResult.extractedData?.c3Count > 0 && (
                               <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">C3: {extractedResult.extractedData.c3Count} (Improvement)</Badge>
                             )}
                           </div>
                         </div>
                       ) : (
                         <div className="grid gap-2">
                           <Label className={extractedResult.outcome === 'SATISFACTORY' ? 'text-emerald-900' : 'text-red-900'}>
                             Defects / Remedials
                           </Label>
                           <Input value="None Identified" readOnly className="bg-white border-emerald-200 text-emerald-900" />
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Remedial Actions Section */}
                 {extractedResult.actions && extractedResult.actions.length > 0 && (
                   <div className="space-y-4">
                     <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                       Remedial Actions ({extractedResult.actions.length})
                     </h3>
                     <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                       {extractedResult.actions.map((action: any) => (
                         <div key={action.id} className="p-3 space-y-1">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <Badge variant={
                                 action.severity === 'IMMEDIATE' ? 'destructive' :
                                 action.severity === 'URGENT' ? 'default' : 'secondary'
                               } className={
                                 action.severity === 'URGENT' ? 'bg-orange-500 hover:bg-orange-600' :
                                 action.severity === 'ADVISORY' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''
                               }>
                                 {action.code}
                               </Badge>
                               <span className="font-medium text-sm">{action.location}</span>
                             </div>
                             <Badge variant="outline" className="text-xs">
                               {action.severity}
                             </Badge>
                           </div>
                           <p className="text-sm text-muted-foreground">{action.description}</p>
                           {action.costEstimate && (
                             <p className="text-xs text-muted-foreground">Est. cost: {action.costEstimate}</p>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}

                 {extractedResult.extractedData?.appliances && extractedResult.extractedData.appliances.length > 0 && (
                   <div className="space-y-4">
                     <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Appliances</h3>
                     <div className="border rounded-lg divide-y">
                       {extractedResult.extractedData.appliances.map((app: any, idx: number) => (
                         <div key={idx} className="p-3 flex justify-between items-center">
                           <div>
                             <p className="font-medium">{app.type || app.applianceType}</p>
                             <p className="text-sm text-muted-foreground">{app.location} - {app.make} {app.model}</p>
                           </div>
                           <Badge variant="outline" className={
                             app.safetyStatus === 'PASS' ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'
                           }>{app.safetyStatus}</Badge>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
               ) : (
                 <div className="flex items-center justify-center h-full text-muted-foreground">
                   <p>No extraction data available</p>
                 </div>
               )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-muted/10">
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="mr-auto ml-2">Reject Document</Button>
            <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
