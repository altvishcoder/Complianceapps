import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Loader2, X, ArrowRight } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, certificatesApi } from "@/lib/api";

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

export default function CertificateUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleUpload = async () => {
    if (!file || !selectedPropertyId || !selectedType) return;

    setIsProcessing(true);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(Math.min(progress, 30));
      if (progress >= 30) {
        clearInterval(interval);
      }
    }, 100);

    try {
      const mimeType = file.type;
      
      await createCertificate.mutateAsync({
        propertyId: selectedPropertyId,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        certificateType: selectedType as any,
        fileBase64: mimeType.startsWith('image/') ? fileBase64 : undefined,
        mimeType: mimeType.startsWith('image/') ? mimeType : undefined,
      });

      clearInterval(interval);
      setUploadProgress(50);

      const steps = [
        "Analyzing document with Claude Vision AI...",
        "Extracting certificate details...",
        "Identifying compliance information...",
        "Detecting any issues or defects...",
        "Generating remedial actions if needed...",
        "Finalizing extraction..."
      ];

      let stepIndex = 0;
      setExtractionStep(steps[0]);

      const stepInterval = setInterval(() => {
        stepIndex++;
        setUploadProgress(50 + (stepIndex * 8));
        if (stepIndex < steps.length) {
          setExtractionStep(steps[stepIndex]);
        } else {
          clearInterval(stepInterval);
          setUploadProgress(100);
          
          toast({
            title: "Upload Complete",
            description: "Certificate uploaded. AI extraction is processing in the background.",
          });

          setTimeout(() => {
            setLocation("/certificates");
          }, 1500);
        }
      }, 1000);

    } catch (error) {
      clearInterval(interval);
      setIsProcessing(false);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload certificate",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Upload Certificate" />
        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          
          <Card>
            <CardHeader>
              <CardTitle>New Document Upload</CardTitle>
              <CardDescription>Upload a compliance certificate for AI analysis and extraction using Claude Vision.</CardDescription>
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
                      {CERTIFICATE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!file ? (
                <div 
                  {...getRootProps()} 
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/5'}
                  `}
                  data-testid="dropzone"
                >
                  <input {...getInputProps()} data-testid="file-input" />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-muted rounded-full">
                      <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Drag & drop your file here</h3>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports PDF, JPG, PNG, WebP (Max 10MB)
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      For best AI extraction, upload images (JPG, PNG, WebP)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-6 space-y-6">
                   <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <FileText className="h-8 w-8" />
                         </div>
                         <div>
                            <p className="font-medium text-lg">{file.name}</p>
                            <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                         </div>
                      </div>
                      {!isProcessing && (
                         <Button variant="ghost" size="icon" onClick={() => { setFile(null); setFileBase64(""); }} data-testid="remove-file">
                            <X className="h-5 w-5" />
                         </Button>
                      )}
                   </div>

                   {isProcessing ? (
                      <div className="space-y-4">
                         <div className="space-y-1">
                            <div className="flex justify-between text-sm font-medium">
                               <span>{uploadProgress < 50 ? "Uploading..." : "AI Processing..."}</span>
                               <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                         </div>
                         
                         {uploadProgress >= 50 && (
                            <div className="bg-slate-950 text-slate-200 p-4 rounded-md font-mono text-sm space-y-2">
                               <div className="flex items-center gap-2">
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                                  <span>{extractionStep}</span>
                                </div>
                            </div>
                         )}
                      </div>
                   ) : (
                      <div className="flex justify-end pt-2">
                         <Button 
                           onClick={handleUpload} 
                           disabled={!selectedPropertyId || !selectedType} 
                           className="w-full sm:w-auto"
                           data-testid="start-processing"
                         >
                            Start Processing <ArrowRight className="ml-2 h-4 w-4" />
                         </Button>
                      </div>
                   )}
                </div>
              )}

            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
