import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, BrainCircuit } from "lucide-react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import generatedImage from '@assets/generated_images/abstract_digital_network_background_for_ai_interface.png';

export default function Ingestion() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'analyzing' | 'complete'>('idle');

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
                        <Button className="gap-2">
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
    </div>
  );
}
