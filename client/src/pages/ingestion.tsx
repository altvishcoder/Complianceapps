import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, BrainCircuit, X, Calendar, User, MapPin, Scan, FileSearch, Layers, Play, Pause, RotateCcw, Zap, Clock, ListOrdered, Files, XCircle } from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { useState, useCallback, useEffect, useRef } from "react";
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
import { propertiesApi, certificatesApi, certificateTypesApi } from "@/lib/api";
import { useUpload } from "@/hooks/use-upload";
import type { EnrichedCertificate } from "@/lib/api";

// Helper function to extract address from certificate data
function getExtractedAddress(extractedData: any): string {
  if (!extractedData) return 'Not extracted';
  
  // Check installationAddress (can be string or object)
  const addr = extractedData.installationAddress;
  if (typeof addr === 'string' && addr.trim()) return addr;
  if (addr?.fullAddress) return addr.fullAddress;
  
  // Check propertyAddress object
  const propAddr = extractedData.propertyAddress;
  if (propAddr?.streetAddress) {
    return `${propAddr.streetAddress}, ${propAddr.city || ''} ${propAddr.postCode || propAddr.postcode || ''}`.trim();
  }
  
  return 'Not extracted';
}

// Helper function to get classification code counts from various data formats
function getClassificationCounts(extractedData: any): Record<string, number> {
  if (!extractedData) return {};
  
  const counts: Record<string, number> = {};
  
  // Source 1: classificationSummary object (e.g., {C1: 1, C2: 2, FI: 1})
  if (extractedData.classificationSummary) {
    Object.entries(extractedData.classificationSummary).forEach(([key, val]) => {
      if (typeof val === 'number' && val > 0) {
        counts[key] = (counts[key] || 0) + val;
      }
    });
  }
  
  // Source 2: complianceDetails object (e.g., {C1_count: 0, C2_count: 1, FI_count: 2})
  // Only use this if classificationSummary wasn't present (avoid double counting)
  if (extractedData.complianceDetails && !extractedData.classificationSummary) {
    const cd = extractedData.complianceDetails;
    if (cd.C1_count > 0) counts['C1'] = (counts['C1'] || 0) + cd.C1_count;
    if (cd.C2_count > 0) counts['C2'] = (counts['C2'] || 0) + cd.C2_count;
    if (cd.C3_count > 0) counts['C3'] = (counts['C3'] || 0) + cd.C3_count;
    if (cd.FI_count > 0) counts['FI'] = (counts['FI'] || 0) + cd.FI_count;
    if (cd.LIM_count > 0) counts['LIM'] = (counts['LIM'] || 0) + cd.LIM_count;
    if (cd.NA_count > 0) counts['N/A'] = (counts['N/A'] || 0) + cd.NA_count;
  }
  
  // Source 3: Direct count fields (c1Count, c2Count, etc.) - fallback if nothing else found
  if (Object.keys(counts).length === 0) {
    if (extractedData.c1Count > 0) counts['C1'] = extractedData.c1Count;
    if (extractedData.c2Count > 0) counts['C2'] = extractedData.c2Count;
    if (extractedData.c3Count > 0) counts['C3'] = extractedData.c3Count;
    if (extractedData.fiCount > 0) counts['FI'] = extractedData.fiCount;
  }
  
  // Source 4: Count from defects array (always aggregate from this)
  if (extractedData.defects && Array.isArray(extractedData.defects)) {
    extractedData.defects.forEach((d: any) => {
      const code = d.severity || d.code || '';
      if (code) counts[code] = (counts[code] || 0) + 1;
    });
  }
  
  // Source 5: Count from observations array  
  if (extractedData.observations && Array.isArray(extractedData.observations)) {
    extractedData.observations.forEach((o: any) => {
      const code = o.code || o.severity || '';
      if (code) counts[code] = (counts[code] || 0) + 1;
    });
  }
  
  return counts;
}

type ProcessingMode = 'sequential' | 'parallel';
type BatchFileStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'error';

interface BatchFile {
  id: string;
  file: File | null;
  base64: string;
  status: BatchFileStatus;
  progress: number;
  error?: string;
  certificateId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export default function Ingestion() {
  useEffect(() => {
    document.title = "Cert Hub - ComplianceAI";
  }, []);

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
  
  // Batch processing state (history loaded from localStorage for display only)
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchProcessingMode, setBatchProcessingMode] = useState<ProcessingMode>('sequential');
  const [batchPropertyId, setBatchPropertyId] = useState("auto-detect");
  const [batchCertType, setBatchCertType] = useState("auto-detect");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [parallelLimit, setParallelLimit] = useState(3);
  const wasProcessingRef = useRef(false);
  
  // Persist batch file metadata to localStorage (never store file content/base64)
  useEffect(() => {
    const serializable = batchFiles
      .filter(bf => bf.status === 'complete' || bf.status === 'error')
      .map(bf => ({
        id: bf.id,
        status: bf.status,
        progress: bf.progress,
        error: bf.error,
        certificateId: bf.certificateId,
        fileName: bf.file?.name || bf.fileName,
        fileSize: bf.file?.size || bf.fileSize,
        fileType: bf.file?.type || bf.fileType,
      }));
    localStorage.setItem('ingestion_batch_history', JSON.stringify(serializable));
  }, [batchFiles]);
  
  const { toast } = useToast();
  
  // Show toast when batch processing completes
  useEffect(() => {
    if (wasProcessingRef.current && !isBatchProcessing && batchFiles.length > 0) {
      const completedCount = batchFiles.filter(f => f.status === 'complete').length;
      const errorCount = batchFiles.filter(f => f.status === 'error').length;
      
      if (completedCount + errorCount > 0) {
        if (errorCount > 0) {
          toast({
            title: "Batch Processing Complete",
            description: `Processed: ${completedCount} successful, ${errorCount} failed.`,
            variant: errorCount === completedCount + errorCount ? "destructive" : "default",
          });
        } else {
          toast({
            title: "Batch Processing Complete",
            description: `Successfully processed ${completedCount} documents.`,
          });
        }
      }
    }
    wasProcessingRef.current = isBatchProcessing;
  }, [isBatchProcessing, batchFiles, toast]);
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();

  const { data: propertiesResponse } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list({ limit: 200 }),
  });
  const properties = propertiesResponse?.data ?? [];

  const { data: certificateTypes = [] } = useQuery({
    queryKey: ["certificateTypes"],
    queryFn: certificateTypesApi.list,
  });

  const { data: recentCertificatesResponse } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list({ limit: 50 }),
  });
  const recentCertificates = recentCertificatesResponse?.data ?? [];

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
      
      let actualPropertyId = isAutoDetectProperty 
        ? (properties.length > 0 ? properties[0].id : '') 
        : selectedPropertyId;
        
      if (!actualPropertyId) {
        setProcessingStep("No properties found. Creating auto-property...");
        const autoProperty = await propertiesApi.autoCreate({
          addressLine1: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          city: 'To Be Verified',
          postcode: 'UNKNOWN',
        });
        actualPropertyId = autoProperty.id;
        queryClient.invalidateQueries({ queryKey: ["properties"] });
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

  // Batch processing handlers
  const onBatchDrop = useCallback((acceptedFiles: File[]) => {
    const newBatchFiles: BatchFile[] = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      base64: '',
      status: 'pending' as BatchFileStatus,
      progress: 0,
    }));
    
    newBatchFiles.forEach((bf) => {
      if (!bf.file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setBatchFiles(prev => prev.map(f => 
          f.id === bf.id ? { ...f, base64 } : f
        ));
      };
      reader.readAsDataURL(bf.file);
    });
    
    setBatchFiles(prev => [...prev, ...newBatchFiles]);
  }, []);

  const { getRootProps: getBatchRootProps, getInputProps: getBatchInputProps, isDragActive: isBatchDragActive } = useDropzone({ 
    onDrop: onBatchDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    disabled: isBatchProcessing
  });

  const removeBatchFile = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearBatchFiles = () => {
    setBatchFiles([]);
    setBatchProgress({ completed: 0, total: 0 });
  };

  const retryFailedFiles = () => {
    setBatchFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending' as BatchFileStatus, progress: 0, error: undefined } : f
    ));
  };

  const hasFailedFiles = batchFiles.some(f => f.status === 'error');

  const processSingleBatchFile = async (bf: BatchFile): Promise<void> => {
    if (!bf.file) {
      setBatchFiles(prev => prev.map(f => 
        f.id === bf.id ? { ...f, status: 'error', error: 'No file data available' } : f
      ));
      return;
    }
    const file = bf.file;
    
    try {
      setBatchFiles(prev => prev.map(f => 
        f.id === bf.id ? { ...f, status: 'uploading', progress: 10 } : f
      ));

      const mimeType = file.type;
      const uploadResult = await uploadFile(file);
      const storageKey = uploadResult?.objectPath || null;

      setBatchFiles(prev => prev.map(f => 
        f.id === bf.id ? { ...f, status: 'processing', progress: 40 } : f
      ));

      let actualPropertyId = batchPropertyId === 'auto-detect' ? '' : batchPropertyId;
        
      if (!actualPropertyId) {
        const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        const autoProperty = await propertiesApi.autoCreate({
          addressLine1: cleanFileName,
          city: 'To Be Verified',
          postcode: 'UNKNOWN',
        });
        actualPropertyId = autoProperty.id;
        queryClient.invalidateQueries({ queryKey: ["properties"] });
      }
      
      const actualType = batchCertType === 'auto-detect' ? 'OTHER' : batchCertType;

      const certificate = await createCertificate.mutateAsync({
        propertyId: actualPropertyId,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        certificateType: actualType as any,
        storageKey: storageKey,
        fileBase64: mimeType.startsWith('image/') ? bf.base64 : undefined,
        mimeType: mimeType.startsWith('image/') ? mimeType : undefined,
      });

      // Poll for extraction completion
      let enrichedCert = await certificatesApi.get(certificate.id);
      let attempts = 0;
      const maxAttempts = 30;
      
      while (enrichedCert.status === 'PROCESSING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        setBatchFiles(prev => prev.map(f => 
          f.id === bf.id ? { ...f, progress: 40 + Math.min(attempts * 2, 50) } : f
        ));
        enrichedCert = await certificatesApi.get(certificate.id);
      }

      // Check if extraction timed out or failed
      if (enrichedCert.status === 'PROCESSING') {
        throw new Error('AI extraction timed out');
      }
      
      if (enrichedCert.status === 'REJECTED') {
        throw new Error('AI extraction failed');
      }

      setBatchFiles(prev => prev.map(f => 
        f.id === bf.id ? { ...f, status: 'complete', progress: 100, certificateId: certificate.id } : f
      ));

    } catch (error) {
      setBatchFiles(prev => prev.map(f => 
        f.id === bf.id ? { 
          ...f, 
          status: 'error', 
          progress: 0, 
          error: error instanceof Error ? error.message : 'Failed to process'
        } : f
      ));
    }
  };

  const processSequential = async () => {
    const pendingFiles = batchFiles.filter(f => f.status === 'pending');
    setBatchProgress({ completed: 0, total: pendingFiles.length });

    for (let i = 0; i < pendingFiles.length; i++) {
      await processSingleBatchFile(pendingFiles[i]);
      setBatchProgress(prev => ({ ...prev, completed: i + 1 }));
    }
  };

  const processParallel = async () => {
    const pendingFiles = batchFiles.filter(f => f.status === 'pending');
    setBatchProgress({ completed: 0, total: pendingFiles.length });
    let completed = 0;

    // Process in chunks based on parallelLimit
    for (let i = 0; i < pendingFiles.length; i += parallelLimit) {
      const chunk = pendingFiles.slice(i, i + parallelLimit);
      await Promise.all(chunk.map(async (bf) => {
        await processSingleBatchFile(bf);
        completed++;
        setBatchProgress(prev => ({ ...prev, completed }));
      }));
    }
  };

  const startBatchProcessing = async () => {
    const pendingFiles = batchFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast({
        title: "No Files to Process",
        description: "Please add some documents first.",
        variant: "destructive",
      });
      return;
    }

    setIsBatchProcessing(true);
    
    try {
      if (batchProcessingMode === 'sequential') {
        await processSequential();
      } else {
        await processParallel();
      }
      
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      
      // Use a small delay to ensure state updates are complete before reading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Show success toast (counts are computed from updated state in the component)
      setIsBatchProcessing(false);
    } catch (error) {
      toast({
        title: "Batch Processing Error",
        description: "Some documents failed to process. Check individual file statuses.",
        variant: "destructive",
      });
      setIsBatchProcessing(false);
    }
  };

  const getStatusIcon = (status: BatchFileStatus) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'uploading': return <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />;
      case 'processing': return <BrainCircuit className="h-4 w-4 text-emerald-500 animate-pulse" />;
      case 'complete': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: BatchFileStatus) => {
    const variants: Record<BatchFileStatus, string> = {
      pending: 'bg-gray-100 text-gray-700',
      uploading: 'bg-emerald-100 text-emerald-700',
      processing: 'bg-emerald-100 text-emerald-700',
      complete: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
    };
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Cert Hub - Advanced Document Center" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Certificate hub content">
          
          {/* Hero Stats Grid */}
          <HeroStatsGrid stats={[
            {
              title: "Recent Uploads",
              value: recentCertificates.length,
              icon: Files,
              riskLevel: "good",
              subtitle: "documents processed",
              testId: "stat-recent-uploads"
            },
            {
              title: "Batch Queue",
              value: batchFiles.filter(f => f.status === 'pending' || f.status === 'uploading' || f.status === 'processing').length,
              icon: Clock,
              riskLevel: "medium",
              subtitle: "in progress",
              testId: "stat-batch-queue"
            },
            {
              title: "Completed",
              value: batchFiles.filter(f => f.status === 'complete').length,
              icon: CheckCircle2,
              riskLevel: "good",
              subtitle: "successfully processed",
              testId: "stat-completed"
            },
            {
              title: "Failed",
              value: batchFiles.filter(f => f.status === 'error').length,
              icon: XCircle,
              riskLevel: batchFiles.filter(f => f.status === 'error').length > 0 ? "critical" : "good",
              subtitle: "need attention",
              testId: "stat-failed"
            }
          ]} />
          
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
                        <Label>Select Property (Structure)</Label>
                        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={processingState !== 'idle'}>
                          <SelectTrigger data-testid="select-property-ingestion">
                            <SelectValue placeholder="Choose property..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="auto-detect">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-emerald-600">Auto-detect from document</span>
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
                        <p className="text-xs text-muted-foreground">
                          UKHDS: Property = Structure within a Block. For dwelling-level certs, select the containing property.
                        </p>
                        {selectedPropertyId === 'auto-detect' && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
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
                                <BrainCircuit className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-emerald-600">Auto-detect from document</span>
                              </div>
                            </SelectItem>
                            <div className="my-1 border-t" />
                            {certificateTypes.filter(t => t.isActive).map(t => (
                              <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedType === 'auto-detect' && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            AI will identify the certificate type
                          </p>
                        )}
                      </div>
                    </div>

                    {!file ? (
                      <div 
                        {...getRootProps()}
                        className={`group relative h-full min-h-[260px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer overflow-hidden transition-all duration-300 ease-out
                          ${isDragActive 
                            ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 scale-[1.02] shadow-lg shadow-emerald-500/20' 
                            : 'border-border bg-gradient-to-br from-muted/30 to-muted/10 hover:from-emerald-50/50 hover:to-green-50/50 dark:hover:from-emerald-950/20 dark:hover:to-green-950/20 hover:border-emerald-300 hover:shadow-md'}
                        `}
                        data-testid="dropzone-ingestion"
                      >
                        <input {...getInputProps()} data-testid="file-input-ingestion" />
                        
                        {isDragActive && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-emerald-500 rounded-tl-lg animate-pulse" />
                            <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-emerald-500 rounded-tr-lg animate-pulse" />
                            <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-emerald-500 rounded-bl-lg animate-pulse" />
                            <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-emerald-500 rounded-br-lg animate-pulse" />
                          </div>
                        )}
                        
                        <div className={`relative transition-all duration-300 ${isDragActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                          <div className={`h-20 w-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300
                            ${isDragActive 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 rotate-6' 
                              : 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600 dark:from-emerald-900/50 dark:to-green-900/50'}`}
                          >
                            {isDragActive ? (
                              <UploadCloud className="h-10 w-10 animate-bounce" />
                            ) : (
                              <Scan className="h-10 w-10" />
                            )}
                          </div>
                          {isDragActive && (
                            <div className="absolute -inset-2 bg-emerald-500/20 rounded-3xl blur-xl animate-pulse" />
                          )}
                        </div>
                        
                        <h3 className={`text-xl font-semibold mb-2 transition-colors duration-300
                          ${isDragActive ? 'text-emerald-600' : 'text-foreground'}`}>
                          {isDragActive ? 'Release to Upload!' : 'Drop Documents Here'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mb-5">
                          {isDragActive 
                            ? 'Your document will be processed with AI' 
                            : 'Drag & drop or click to browse\nPDF, JPG, PNG, WebP supported'}
                        </p>
                        
                        <div className="flex flex-wrap justify-center gap-2 mb-4">
                          <div className="flex items-center gap-1.5 text-xs bg-white/80 dark:bg-gray-800/80 px-3 py-1.5 rounded-full border shadow-sm">
                            <FileText className="h-3.5 w-3.5 text-red-500" />
                            <span>PDF</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs bg-white/80 dark:bg-gray-800/80 px-3 py-1.5 rounded-full border shadow-sm">
                            <FileText className="h-3.5 w-3.5 text-green-500" />
                            <span>JPG</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs bg-white/80 dark:bg-gray-800/80 px-3 py-1.5 rounded-full border shadow-sm">
                            <FileText className="h-3.5 w-3.5 text-emerald-500" />
                            <span>PNG</span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center gap-2 text-xs px-4 py-2 rounded-full border transition-all duration-300
                          ${isDragActive 
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg' 
                            : 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 border-emerald-200 dark:from-emerald-950/50 dark:to-green-950/50 dark:border-emerald-800'}`}>
                          <BrainCircuit className={`h-4 w-4 ${isDragActive ? 'animate-pulse' : ''}`} />
                          <span className="font-medium">AI Vision Ready</span>
                          <Zap className="h-3 w-3" />
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-4 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-gray-900 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
                                <FileText className="h-7 w-7" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{file.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                <span className="text-green-600 dark:text-green-400">Ready for processing</span>
                              </div>
                            </div>
                          </div>
                          {processingState === 'idle' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={resetUpload} 
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid="remove-file-ingestion"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                        
                        {processingState === 'idle' && (
                          <Button 
                            className="w-full gap-2 h-12 text-base bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/40" 
                            onClick={handleProcessDocument}
                            disabled={!selectedPropertyId || !selectedType}
                            data-testid="start-processing-ingestion"
                          >
                            <BrainCircuit className="h-5 w-5" />
                            Start AI Processing
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Processing View */}
                <Card className="h-full flex flex-col relative overflow-hidden border-emerald-200/50 dark:border-emerald-800/50">
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
                          <BrainCircuit className="h-5 w-5 text-emerald-600" />
                          Cert Hub Intelligence
                        </CardTitle>
                        <CardDescription>Real-time extraction and validation</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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
                        <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-emerald-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-emerald-500" />
                            <div>
                              <p className="font-medium text-sm">{file?.name || "Document"}</p>
                              <p className="text-xs text-emerald-600 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {processingStep}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>Upload & Storage</span>
                            <span className={uploadProgress >= 40 ? "text-emerald-600" : "text-emerald-500"}>
                              {uploadProgress >= 40 ? "Complete" : "Processing..."}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(uploadProgress * 2.5, 100)}%` }} />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-3">
                            <span>AI Document Analysis</span>
                            <span className={uploadProgress >= 70 ? "text-emerald-600" : "text-emerald-500"}>
                              {uploadProgress >= 90 ? "Complete" : uploadProgress >= 40 ? "Processing..." : "Waiting..."}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${uploadProgress >= 40 ? 'bg-emerald-500' : 'bg-slate-200'}`} 
                                 style={{ width: `${Math.max(0, (uploadProgress - 40) * 1.67)}%` }} />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-950 rounded-md font-mono text-xs text-slate-200 space-y-1 border border-slate-800">
                          <p className="text-emerald-400">{'>'} Model: claude-3-5-haiku-20241022</p>
                          <p>{'>'} Document Type: {certificateTypes.find(t => t.code === selectedType)?.name || selectedType}</p>
                          <p className="animate-pulse text-emerald-400">{'>'} {processingStep}</p>
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
                                Certificate extracted for <strong>{
                                  selectedPropertyId === 'auto-detect' 
                                    ? getExtractedAddress(extractedResult.extractedData).split(',')[0] || 'property (auto-detected)'
                                    : extractedResult.property?.addressLine1 || 'property'
                                }</strong>
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
                            {(() => {
                              const counts = getClassificationCounts(extractedResult.extractedData);
                              return (
                                <>
                                  {counts['C1'] > 0 && (
                                    <div className="p-3 flex justify-between">
                                      <span className="text-muted-foreground">C1 (Danger)</span>
                                      <span className="font-medium text-red-600">{counts['C1']}</span>
                                    </div>
                                  )}
                                  {counts['C2'] > 0 && (
                                    <div className="p-3 flex justify-between">
                                      <span className="text-muted-foreground">C2 (Potentially Dangerous)</span>
                                      <span className="font-medium text-orange-600">{counts['C2']}</span>
                                    </div>
                                  )}
                                  {counts['C3'] > 0 && (
                                    <div className="p-3 flex justify-between">
                                      <span className="text-muted-foreground">C3 (Improvement)</span>
                                      <span className="font-medium text-yellow-600">{counts['C3']}</span>
                                    </div>
                                  )}
                                  {counts['FI'] > 0 && (
                                    <div className="p-3 flex justify-between">
                                      <span className="text-muted-foreground">FI (Further Investigation)</span>
                                      <span className="font-medium text-emerald-600">{counts['FI']}</span>
                                    </div>
                                  )}
                                  {counts['LIM'] > 0 && (
                                    <div className="p-3 flex justify-between">
                                      <span className="text-muted-foreground">LIM (Limitation)</span>
                                      <span className="font-medium text-slate-600">{counts['LIM']}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
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
            
            <TabsContent value="batch" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Batch Upload Area */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Batch Document Upload
                    </CardTitle>
                    <CardDescription>
                      Upload multiple documents at once. AI will process them based on your selected mode.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Settings Row */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Processing Mode</Label>
                        <Select value={batchProcessingMode} onValueChange={(v) => setBatchProcessingMode(v as ProcessingMode)} disabled={isBatchProcessing}>
                          <SelectTrigger data-testid="select-batch-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sequential">
                              <div className="flex items-center gap-2">
                                <ListOrdered className="h-4 w-4" />
                                <span>Sequential (One at a time)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="parallel">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                <span>Parallel (Faster)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Property</Label>
                        <Select value={batchPropertyId} onValueChange={setBatchPropertyId} disabled={isBatchProcessing}>
                          <SelectTrigger data-testid="select-batch-property">
                            <SelectValue placeholder="Choose property..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="auto-detect">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-emerald-600">Auto-detect</span>
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
                      </div>
                      <div className="space-y-2">
                        <Label>Default Certificate Type</Label>
                        <Select value={batchCertType} onValueChange={setBatchCertType} disabled={isBatchProcessing}>
                          <SelectTrigger data-testid="select-batch-cert-type">
                            <SelectValue placeholder="Choose type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto-detect">
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-emerald-600">Auto-detect</span>
                              </div>
                            </SelectItem>
                            <div className="my-1 border-t" />
                            {certificateTypes.filter(t => t.isActive).map(t => (
                              <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {batchProcessingMode === 'parallel' && (
                      <div className="flex items-center gap-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <Zap className="h-5 w-5 text-emerald-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-900">Parallel Processing</p>
                          <p className="text-xs text-emerald-700">Process up to {parallelLimit} documents simultaneously</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-emerald-700">Concurrent:</Label>
                          <Select value={String(parallelLimit)} onValueChange={(v) => setParallelLimit(Number(v))} disabled={isBatchProcessing}>
                            <SelectTrigger className="w-16 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Dropzone */}
                    <div 
                      {...getBatchRootProps()}
                      className={`relative min-h-[180px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer overflow-hidden transition-all duration-300 ease-out
                        ${isBatchDragActive 
                          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 scale-[1.01] shadow-lg shadow-emerald-500/20' 
                          : 'border-border bg-gradient-to-br from-muted/30 to-muted/10 hover:from-emerald-50/50 hover:to-green-50/50 dark:hover:from-emerald-950/20 dark:hover:to-green-950/20 hover:border-emerald-300 hover:shadow-md'}
                        ${isBatchProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      data-testid="batch-dropzone"
                    >
                      <input {...getBatchInputProps()} data-testid="batch-file-input" />
                      
                      {isBatchDragActive && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-emerald-500 rounded-tl-lg animate-pulse" />
                          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-emerald-500 rounded-tr-lg animate-pulse" />
                          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-emerald-500 rounded-bl-lg animate-pulse" />
                          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-emerald-500 rounded-br-lg animate-pulse" />
                        </div>
                      )}
                      
                      <div className={`relative transition-all duration-300 ${isBatchDragActive ? 'scale-110' : ''}`}>
                        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300
                          ${isBatchDragActive 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' 
                            : 'bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600 dark:from-emerald-900/50 dark:to-green-900/50'}`}
                        >
                          {isBatchDragActive ? (
                            <Layers className="h-8 w-8 animate-pulse" />
                          ) : (
                            <UploadCloud className="h-8 w-8" />
                          )}
                        </div>
                        {isBatchDragActive && (
                          <div className="absolute -inset-2 bg-emerald-500/20 rounded-3xl blur-xl animate-pulse" />
                        )}
                      </div>
                      
                      <h3 className={`text-lg font-semibold mb-1 transition-colors duration-300
                        ${isBatchDragActive ? 'text-emerald-600' : 'text-foreground'}`}>
                        {isBatchDragActive ? 'Drop Files Here!' : 'Drop Multiple Documents'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isBatchDragActive 
                          ? `${batchFiles.length} file${batchFiles.length !== 1 ? 's' : ''} will be added` 
                          : 'PDF, JPG, PNG, WebP supported'}
                      </p>
                    </div>

                    {/* File List */}
                    {batchFiles.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-2 flex justify-between items-center border-b">
                          <span className="text-sm font-medium">
                            {batchFiles.length} document{batchFiles.length !== 1 ? 's' : ''} queued
                          </span>
                          <div className="flex gap-2">
                            {batchProgress.total > 0 && (
                              <span className="text-sm text-muted-foreground">
                                {batchProgress.completed}/{batchProgress.total} completed
                              </span>
                            )}
                            {hasFailedFiles && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={retryFailedFiles} 
                                disabled={isBatchProcessing}
                                className="h-7 text-xs text-orange-600 hover:text-orange-700"
                                data-testid="btn-retry-failed"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Retry Failed
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={clearBatchFiles} 
                              disabled={isBatchProcessing}
                              className="h-7 text-xs"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Clear All
                            </Button>
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto divide-y">
                          {batchFiles.map((bf) => (
                            <div key={bf.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30">
                              {getStatusIcon(bf.status)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{bf.fileName || bf.file?.name || 'Unknown file'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(bf.status)}
                                  <span className="text-xs text-muted-foreground">
                                    {(((bf.fileSize || bf.file?.size) || 0) / 1024).toFixed(1)} KB
                                  </span>
                                  {bf.error && (
                                    <span className="text-xs text-red-600">{bf.error}</span>
                                  )}
                                </div>
                                {(bf.status === 'uploading' || bf.status === 'processing') && (
                                  <Progress value={bf.progress} className="mt-2 h-1" />
                                )}
                              </div>
                              {bf.status === 'pending' && !isBatchProcessing && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => removeBatchFile(bf.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={startBatchProcessing}
                        disabled={batchFiles.length === 0 || isBatchProcessing}
                        className="gap-2"
                        data-testid="btn-start-batch"
                      >
                        {isBatchProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Start Batch Processing
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Processing Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5" />
                      Processing Modes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <ListOrdered className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-sm">Sequential</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Processes documents one at a time. Best for reliability and when you want to monitor each extraction.
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-sm">Parallel</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Processes multiple documents simultaneously. Faster but uses more resources. Configure concurrent limit.
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t space-y-2">
                      <h4 className="text-sm font-medium">Tips</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>Use auto-detect for mixed document batches</li>
                        <li>Set a specific property if all docs are for same address</li>
                        <li>Parallel mode is faster but may hit rate limits</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
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
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
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
                       className="text-sm text-emerald-400 hover:text-emerald-300 underline"
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
                   {selectedPropertyId === 'auto-detect' ? (
                     <div className="grid gap-2">
                       <Label className="flex items-center gap-2">
                         Property Address (from certificate)
                         <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-700">Auto-Detected</Badge>
                       </Label>
                       <div className="relative">
                         <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                         <Input 
                           value={getExtractedAddress(extractedResult.extractedData)} 
                           readOnly
                           className="pl-9 bg-amber-50/50 border-amber-200 text-amber-900" 
                         />
                       </div>
                       <p className="text-xs text-amber-600">Auto-detect mode: Please verify this matches a property in your system</p>
                     </div>
                   ) : (
                     <div className="grid gap-2">
                       <Label>Selected Property (from your selection)</Label>
                       <div className="relative">
                         <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                         <Input 
                           value={`${extractedResult.property?.addressLine1 || ''}, ${extractedResult.property?.postcode || ''}`} 
                           readOnly
                           className="pl-9 bg-emerald-50/50 border-emerald-200" 
                         />
                       </div>
                     </div>
                   )}
                   {selectedPropertyId !== 'auto-detect' && (() => {
                     const extractedAddress = getExtractedAddress(extractedResult.extractedData);
                     if (extractedAddress === 'Not extracted') return null;
                     
                     const selectedAddr = `${extractedResult.property?.addressLine1 || ''}, ${extractedResult.property?.postcode || ''}`.toLowerCase();
                     const normalizedExtracted = extractedAddress.toLowerCase();
                     const isMismatch = !normalizedExtracted.includes(selectedAddr.split(',')[0].trim()) &&
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
                        <Input value={extractedResult.certificateType?.replace(/_/g, ' ') || 'Unknown'} readOnly className="bg-emerald-50/50 border-emerald-200" />
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
                       
                       {(() => {
                         const counts = getClassificationCounts(extractedResult.extractedData);
                         const hasDefects = Object.keys(counts).length > 0;
                         
                         if (hasDefects) {
                           return (
                             <div className="space-y-2">
                               <Label className="text-slate-700">Classification Codes</Label>
                               <div className="flex gap-2 flex-wrap">
                                 {counts['C1'] > 0 && (
                                   <Badge variant="destructive">C1: {counts['C1']} (Danger)</Badge>
                                 )}
                                 {counts['C2'] > 0 && (
                                   <Badge className="bg-orange-500 hover:bg-orange-600">C2: {counts['C2']} (Potentially Dangerous)</Badge>
                                 )}
                                 {counts['C3'] > 0 && (
                                   <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">C3: {counts['C3']} (Improvement)</Badge>
                                 )}
                                 {counts['FI'] > 0 && (
                                   <Badge className="bg-emerald-500 hover:bg-emerald-600">FI: {counts['FI']} (Further Investigation)</Badge>
                                 )}
                                 {counts['LIM'] > 0 && (
                                   <Badge className="bg-slate-500 hover:bg-slate-600">LIM: {counts['LIM']} (Limitation)</Badge>
                                 )}
                                 {counts['N/A'] > 0 && (
                                   <Badge variant="outline">N/A: {counts['N/A']}</Badge>
                                 )}
                               </div>
                             </div>
                           );
                         } else {
                           return (
                             <div className="grid gap-2">
                               <Label className={extractedResult.outcome === 'SATISFACTORY' ? 'text-emerald-900' : 'text-red-900'}>
                                 Defects / Remedials
                               </Label>
                               <Input value="None Identified" readOnly className="bg-white border-emerald-200 text-emerald-900" />
                             </div>
                           );
                         }
                       })()}
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
