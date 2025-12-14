import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, BrainCircuit, X, Calendar, User, MapPin } from "lucide-react";
import { useState } from "react";
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

export default function Ingestion() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const { toast } = useToast();

  const handleUpload = () => {
    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        setProcessingState('analyzing');
        setTimeout(() => setProcessingState('complete'), 3000);
      }
    }, 100);
  };

  const handleApprove = () => {
    setIsReviewOpen(false);
    setProcessingState('idle'); // Reset state or move to another state
    toast({
      title: "Certificate Approved",
      description: "The CP12 certificate has been validated and added to the property record.",
      variant: "default",
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Ingestion Hub" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upload Area */}
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Document Upload</CardTitle>
                <CardDescription>Drag and drop compliance certificates here. Supports PDF, JPG, PNG.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div 
                  className="h-full min-h-[300px] border-2 border-dashed border-border rounded-lg bg-muted/20 flex flex-col items-center justify-center p-6 text-center hover:bg-muted/40 transition-colors cursor-pointer group"
                  onClick={handleUpload}
                >
                  <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Click or Drag files to upload</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    AI will automatically identify document type, property address, and compliance status.
                  </p>
                  {isUploading && (
                    <div className="w-full max-w-xs mt-8 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </div>
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
                      AI Processing Queue
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
                    <p>Waiting for documents...</p>
                  </div>
                )}

                {processingState === 'analyzing' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-blue-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">CP12_Gas_Cert_HighSt.pdf</p>
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Extracting Entities...
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                         <span>OCR Scanning</span>
                         <span className="text-emerald-600">Complete</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-full" />
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-3">
                         <span>Entity Recognition (LLM)</span>
                         <span className="text-blue-600">Processing...</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500 w-[60%] animate-pulse" />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-md font-mono text-xs text-slate-600 space-y-1 border border-slate-100">
                      <p>{'>'} Document Type: Gas Safety Record (CP12)</p>
                      <p>{'>'} Confidence: 99.8%</p>
                      <p>{'>'} Engineer: J. Smith (ID: 44521)</p>
                      <p className="animate-pulse">{'>'} Extracting Address...</p>
                    </div>
                  </div>
                )}

                {processingState === 'complete' && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                     <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-emerald-900">Processing Complete</p>
                          <p className="text-sm text-emerald-700 mt-1">
                            Successfully extracted 14 fields. Matched to property <strong>124 High Street</strong>.
                          </p>
                        </div>
                     </div>

                     <div className="bg-white border border-border rounded-lg divide-y divide-border text-sm">
                        <div className="p-3 flex justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <span className="font-medium">CP12 Gas Safety</span>
                        </div>
                        <div className="p-3 flex justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <span className="font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-100">PASS</span>
                        </div>
                        <div className="p-3 flex justify-between">
                          <span className="text-muted-foreground">Expiry</span>
                          <span className="font-medium">14 Dec 2026</span>
                        </div>
                        <div className="p-3 flex justify-between">
                          <span className="text-muted-foreground">Defects</span>
                          <span className="font-medium text-slate-900">None Identified</span>
                        </div>
                     </div>
                     
                     <div className="flex justify-end pt-2">
                        <Button className="gap-2" onClick={() => setIsReviewOpen(true)}>
                          Review & Approve <ArrowRight className="h-4 w-4" />
                        </Button>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Uploads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Property Match</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { file: "scan_2024_12_14.pdf", type: "EICR", prop: "12 Green Lane", status: "Review", color: "amber" },
                      { file: "FRA_The_Towers_Block_A.pdf", type: "Fire Risk", prop: "The Towers (Block A)", status: "Processed", color: "emerald" },
                      { file: "IMG_4421.jpg", type: "Damp Survey", prop: "Flat 4, Oak House", status: "Processed", color: "emerald" },
                      { file: "unknown_doc_22.pdf", type: "Unknown", prop: "Unmatched", status: "Failed", color: "rose" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-3 font-medium">{row.file}</td>
                        <td className="p-3">{row.type}</td>
                        <td className="p-3">{row.prop}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${row.color}-50 text-${row.color}-700 ring-1 ring-inset ring-${row.color}-600/20`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm">View</Button>
                        </td>
                      </tr>
                    ))}
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
            {/* Document Preview (Mock) */}
            <div className="w-1/2 bg-slate-900 p-8 flex items-center justify-center border-r border-border overflow-y-auto">
               <div className="bg-white w-full h-[140%] shadow-2xl rounded-sm p-8 text-[10px] text-slate-800 font-serif leading-relaxed opacity-90">
                  <div className="flex justify-between border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-2xl font-bold uppercase">Gas Safety Record</h1>
                    <div className="text-right">
                      <p className="font-bold">British Gas</p>
                      <p>Reg No: 55421</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <h3 className="font-bold uppercase mb-2 border-b border-black">Site Address</h3>
                      <p>124 High Street</p>
                      <p>London</p>
                      <p>SW1 4AX</p>
                    </div>
                    <div>
                       <h3 className="font-bold uppercase mb-2 border-b border-black">Details</h3>
                       <p>Date: 14/12/2025</p>
                       <p>Engineer: John Smith</p>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-black mb-8">
                    <thead>
                      <tr className="bg-slate-100">
                         <th className="border border-black p-1 text-left">Appliance</th>
                         <th className="border border-black p-1">Location</th>
                         <th className="border border-black p-1">Make/Model</th>
                         <th className="border border-black p-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black p-1">Boiler</td>
                        <td className="border border-black p-1">Kitchen</td>
                        <td className="border border-black p-1">Worcester</td>
                        <td className="border border-black p-1 text-center">PASS</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-1">Hob</td>
                        <td className="border border-black p-1">Kitchen</td>
                        <td className="border border-black p-1">Beko</td>
                        <td className="border border-black p-1 text-center">PASS</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border border-black p-4 mb-4">
                    <p className="font-bold mb-2">Outcome:</p>
                    <div className="flex gap-4">
                      <span className="font-bold">PASS [X]</span>
                      <span>FAIL [ ]</span>
                      <span>AT RISK [ ]</span>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-black flex justify-between items-end">
                    <div>
                       <p className="mb-4">Engineer Signature:</p>
                       <p className="font-script text-xl">John Smith</p>
                    </div>
                     <div>
                       <p className="mb-4">Next Inspection Due:</p>
                       <p className="font-bold text-lg">14/12/2026</p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Form Fields */}
            <div className="w-1/2 p-6 overflow-y-auto bg-background">
               <div className="space-y-6">
                 <div className="space-y-4">
                   <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Property Details</h3>
                   <div className="grid gap-2">
                     <Label>Matched Address</Label>
                     <div className="relative">
                       <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input defaultValue="124 High Street, London, SW1 4AX" className="pl-9 bg-emerald-50/50 border-emerald-200" />
                       <Badge className="absolute right-2 top-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 pointer-events-none shadow-none">99% Match</Badge>
                     </div>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Certificate Data</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Type</Label>
                        <Input defaultValue="Gas Safety (CP12)" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Reference</Label>
                        <Input defaultValue="CP-2024-88921" />
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Inspection Date</Label>
                        <div className="relative">
                           <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input defaultValue="2025-12-14" className="pl-9" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Expiry Date</Label>
                         <div className="relative">
                           <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                           <Input defaultValue="2026-12-14" className="pl-9 font-medium text-emerald-600" />
                        </div>
                      </div>
                   </div>

                   <div className="grid gap-2">
                     <Label>Engineer</Label>
                     <div className="relative">
                       <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input defaultValue="John Smith (ID: 44521)" className="pl-9" />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Compliance Outcome</h3>
                    <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 space-y-3">
                       <div className="flex items-center justify-between">
                         <Label className="text-emerald-900">Overall Status</Label>
                         <Badge className="bg-emerald-600 hover:bg-emerald-700">PASS</Badge>
                       </div>
                       <div className="grid gap-2">
                         <Label className="text-emerald-900">Defects / Remedials</Label>
                         <Input defaultValue="None Identified" className="bg-white border-emerald-200 text-emerald-900" />
                       </div>
                    </div>
                 </div>
               </div>
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
