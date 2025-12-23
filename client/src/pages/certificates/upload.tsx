import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, File, X, ArrowRight } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { db, Certificate } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";

export default function CertificateUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionStep, setExtractionStep] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [properties, setProperties] = useState(db.properties);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsub = db.subscribe(() => setProperties(db.properties));
    return unsub;
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

  const handleUpload = () => {
    if (!file || !selectedPropertyId) return;

    setIsProcessing(true);
    
    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        startExtraction();
      }
    }, 200);
  };

  const startExtraction = () => {
    // Simulate AI Extraction Pipeline
    const steps = [
      "Analyzing document structure...",
      "OCR Text Extraction...",
      "Classifying Certificate Type...",
      "Extracting Entities (GPT-4o)...",
      "Validating Compliance Data...",
      "Complete!"
    ];

    let stepIndex = 0;
    setExtractionStep(steps[0]);

    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setExtractionStep(steps[stepIndex]);
      } else {
        clearInterval(stepInterval);
        finishProcessing();
      }
    }, 800);
  };

  const finishProcessing = () => {
    // Determine type based on filename for demo
    let type = "OTHER";
    if (file?.name.toLowerCase().includes("cp12") || file?.name.toLowerCase().includes("gas")) type = "GAS_SAFETY";
    else if (file?.name.toLowerCase().includes("eicr") || file?.name.toLowerCase().includes("elec")) type = "EICR";

    const newCert = db.addCertificate({
      propertyId: selectedPropertyId,
      fileName: file!.name,
      certificateType: type as any,
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0], // +1 year
      outcome: "PASS"
    });

    // Update status to approved for demo
    db.updateCertificateStatus(newCert.id, "NEEDS_REVIEW");

    toast({
      title: "Processing Complete",
      description: "Certificate extracted and ready for review.",
    });

    // Redirect to certificate list or detail
    setTimeout(() => {
       setLocation("/certificates");
    }, 1000);
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
              <CardDescription>Upload a compliance certificate for AI analysis and extraction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                 <Label>Select Property</Label>
                 <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={isProcessing}>
                    <SelectTrigger>
                       <SelectValue placeholder="Search or select a property..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                       {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.fullAddress}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>

              {!file ? (
                <div 
                  {...getRootProps()} 
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/5'}
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-muted rounded-full">
                      <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Drag & drop your file here</h3>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports PDF, JPG, PNG (Max 10MB)
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
                         <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <X className="h-5 w-5" />
                         </Button>
                      )}
                   </div>

                   {isProcessing ? (
                      <div className="space-y-4">
                         <div className="space-y-1">
                            <div className="flex justify-between text-sm font-medium">
                               <span>{uploadProgress < 100 ? "Uploading..." : "AI Processing..."}</span>
                               <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                         </div>
                         
                         {uploadProgress === 100 && (
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
                         <Button onClick={handleUpload} disabled={!selectedPropertyId} className="w-full sm:w-auto">
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
