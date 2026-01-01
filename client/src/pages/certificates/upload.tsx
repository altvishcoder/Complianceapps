import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Loader2, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, certificatesApi, certificateTypesApi } from "@/lib/api";
import { useUpload } from "@/hooks/use-upload";
import { Breadcrumb, useBreadcrumbContext } from "@/components/Breadcrumb";

interface FileWithStatus {
  file: File;
  base64: string;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export default function CertificateUpload() {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [extractionStep, setExtractionStep] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const { data: certificateTypes = [] } = useQuery({
    queryKey: ["certificateTypes"],
    queryFn: certificateTypesApi.list,
  });

  const { uploadFile, isUploading: isUploadingToStorage } = useUpload();

  const createCertificate = useMutation({
    mutationFn: certificatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithStatus[] = [];
    
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFiles(prev => [...prev, { file, base64, status: 'pending' }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !selectedPropertyId || !selectedType) return;

    setIsProcessing(true);
    setCurrentFileIndex(0);
    
    try {
      // Step 1: Create a batch for all files
      setExtractionStep("Creating batch for upload...");
      const batchResponse = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totalFiles: files.length }),
      });
      
      if (!batchResponse.ok) {
        throw new Error("Failed to create batch");
      }
      
      const batch = await batchResponse.json();
      const batchId = batch.id;

      // Step 2: Upload each file with the batch ID
      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        setCurrentFileIndex(i);
        setUploadProgress(Math.round((i / files.length) * 100));
        
        // Update file status to uploading
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));
        
        try {
          setExtractionStep(`Uploading file ${i + 1} of ${files.length}: ${fileItem.file.name}`);
          
          // Upload to object storage
          const uploadResult = await uploadFile(fileItem.file);
          const storageKey = uploadResult?.objectPath || null;
          
          // Update file status to processing
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'processing' } : f
          ));
          
          setExtractionStep(`Processing file ${i + 1} of ${files.length}: ${fileItem.file.name}`);
          
          // Create certificate with batch ID
          const mimeType = fileItem.file.type;
          await createCertificate.mutateAsync({
            propertyId: selectedPropertyId,
            fileName: fileItem.file.name,
            fileType: mimeType,
            fileSize: fileItem.file.size,
            certificateType: selectedType as any,
            storageKey: storageKey,
            fileBase64: mimeType.startsWith('image/') ? fileItem.base64 : undefined,
            mimeType: mimeType.startsWith('image/') ? mimeType : undefined,
            batchId: batchId,
          });
          
          // Update file status to complete
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'complete' } : f
          ));
          
        } catch (error) {
          // Update file status to error
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : f
          ));
        }
      }

      setUploadProgress(100);
      setExtractionStep("All files uploaded! AI extraction is processing in the background.");
      
      toast({
        title: "Upload Complete",
        description: `${files.length} certificate(s) uploaded. AI extraction is processing in the background.`,
      });

      setTimeout(() => {
        setLocation("/certificates");
      }, 2000);

    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload certificates",
        variant: "destructive",
      });
    }
  };

  const { buildContextUrl } = useBreadcrumbContext();
  const completedCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Upload Certificate" />
        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          
          <div className="mb-4">
            <Breadcrumb 
              items={[
                { label: "Certificates", href: "/certificates" },
                { label: "Upload Certificate" }
              ]}
            />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>New Document Upload</CardTitle>
              <CardDescription>Upload compliance certificates for AI analysis and extraction using Claude Vision. You can select multiple files at once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Property *</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={isProcessing}>
                    <SelectTrigger data-testid="select-property">
                      <SelectValue placeholder="Choose a property..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.addressLine1}, {p.postcode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Certificate Type *</Label>
                  <Select value={selectedType} onValueChange={setSelectedType} disabled={isProcessing}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue placeholder="Choose certificate type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {certificateTypes.filter(t => t.isActive).map(t => (
                        <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/5'}
                  ${isProcessing ? 'pointer-events-none opacity-50' : ''}
                `}
                data-testid="dropzone"
              >
                <input {...getInputProps()} data-testid="file-input" />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-muted rounded-full">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Drag & drop files here</h3>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse (multiple files supported)</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, JPG, PNG, WebP (Max 10MB each)
                  </p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="border rounded-lg divide-y">
                  <div className="p-3 bg-muted/30 flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                      {isProcessing && ` (${completedCount} completed${errorCount > 0 ? `, ${errorCount} failed` : ''})`}
                    </span>
                    {!isProcessing && (
                      <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                        Clear all
                      </Button>
                    )}
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto">
                    {files.map((fileItem, index) => (
                      <div key={index} className="p-3 flex items-center gap-3" data-testid={`file-item-${index}`}>
                        <div className={`p-2 rounded ${
                          fileItem.status === 'complete' ? 'bg-emerald-50 text-emerald-600' :
                          fileItem.status === 'error' ? 'bg-red-50 text-red-600' :
                          fileItem.status === 'uploading' || fileItem.status === 'processing' ? 'bg-blue-50 text-blue-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {fileItem.status === 'complete' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : fileItem.status === 'uploading' || fileItem.status === 'processing' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{fileItem.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                            {fileItem.status === 'error' && fileItem.error && (
                              <span className="text-red-500 ml-2">- {fileItem.error}</span>
                            )}
                          </p>
                        </div>
                        {!isProcessing && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Processing files...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                  
                  <div className="bg-slate-950 text-slate-200 p-4 rounded-md font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                      <span>{extractionStep}</span>
                    </div>
                  </div>
                </div>
              )}

              {files.length > 0 && !isProcessing && (
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedPropertyId || !selectedType || files.length === 0} 
                    className="w-full sm:w-auto"
                    data-testid="start-processing"
                  >
                    Upload {files.length} File{files.length !== 1 ? 's' : ''} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
