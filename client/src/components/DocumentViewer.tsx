import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ZoomIn, ZoomOut, RotateCw, FileImage, AlertCircle, Info, FileText, ExternalLink } from "lucide-react";

interface Defect {
  code?: string;
  description: string;
  location?: string;
  severity?: string;
  classification?: string;
}

interface DocumentViewerProps {
  storageKey?: string | null;
  fileName?: string;
  defects?: Defect[];
  observations?: Array<{
    itemNumber?: string;
    description: string;
    code?: string;
    location?: string;
  }>;
}

const isPdfFile = (fileName?: string, storageKey?: string | null): boolean => {
  if (fileName?.toLowerCase().endsWith('.pdf')) return true;
  if (storageKey?.toLowerCase().includes('.pdf')) return true;
  return false;
};

const isImageFile = (fileName?: string, storageKey?: string | null): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const name = (fileName || storageKey || '').toLowerCase();
  return imageExtensions.some(ext => name.endsWith(ext));
};

const getSeverityColor = (code?: string, classification?: string, severity?: string) => {
  if (code === "C1" || classification?.includes("Immediately Dangerous") || severity === "IMMEDIATE") {
    return { bg: "bg-red-500", text: "text-red-600", border: "border-red-500", label: "Critical", ring: "ring-red-500", bgLight: "bg-red-50" };
  }
  if (code === "C2" || classification?.includes("At Risk") || severity === "URGENT") {
    return { bg: "bg-orange-500", text: "text-orange-600", border: "border-orange-500", label: "Urgent", ring: "ring-orange-500", bgLight: "bg-orange-50" };
  }
  if (code === "C3" || severity === "ROUTINE" || severity === "PRIORITY") {
    return { bg: "bg-yellow-500", text: "text-yellow-600", border: "border-yellow-500", label: "Advisory", ring: "ring-yellow-500", bgLight: "bg-yellow-50" };
  }
  return { bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-500", label: "Info", ring: "ring-blue-500", bgLight: "bg-blue-50" };
};

export function DocumentViewer({ storageKey, fileName, defects = [], observations = [] }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [selectedDefect, setSelectedDefect] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const fileType = useMemo(() => {
    if (isPdfFile(fileName, storageKey)) return 'pdf';
    if (isImageFile(fileName, storageKey)) return 'image';
    return 'unknown';
  }, [fileName, storageKey]);

  const allIssues = [
    ...defects.map((d) => ({
      code: d.code,
      description: d.description,
      location: d.location,
      type: "defect" as const,
      ...getSeverityColor(d.code, d.classification, d.severity),
    })),
    ...observations
      .filter((o) => o.code === "C1" || o.code === "C2" || o.code === "C3" || o.code === "FI")
      .map((o) => ({
        code: o.code,
        description: o.description,
        location: o.location,
        type: "observation" as const,
        ...getSeverityColor(o.code),
      })),
  ];

  const hasImage = storageKey && storageKey.length > 0;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {fileType === 'pdf' ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                Document Preview
                {fileType === 'pdf' && <Badge variant="outline" className="ml-2">PDF</Badge>}
              </CardTitle>
              {hasImage && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                    data-testid="zoom-out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    data-testid="zoom-in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom(100)}
                    data-testid="reset-zoom"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={containerRef}
              className="relative bg-muted/50 rounded-lg overflow-auto"
              style={{ maxHeight: "600px" }}
            >
              {hasImage ? (
                <>
                  {fileType === 'pdf' ? (
                    <div className="w-full" style={{ minHeight: "600px" }}>
                      <object
                        data={storageKey || undefined}
                        type="application/pdf"
                        className="w-full h-full"
                        style={{ height: "600px", transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                        data-testid="document-pdf"
                      >
                        <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-lg">
                          <FileText className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-medium mb-2">PDF Preview Not Available</p>
                          <p className="text-sm text-muted-foreground mb-4">Your browser may not support embedded PDF viewing</p>
                          <Button 
                            variant="outline" 
                            onClick={() => window.open(storageKey || '', '_blank')}
                            className="gap-2"
                            data-testid="open-pdf-external"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open PDF in New Tab
                          </Button>
                        </div>
                      </object>
                      {allIssues.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-700">
                            <AlertTriangle className="h-4 w-4 inline mr-2" />
                            {allIssues.length} issue(s) detected - see panel on the right
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative inline-block min-w-full">
                      <img
                        src={storageKey || undefined}
                        alt={fileName || "Certificate document"}
                        className="mx-auto transition-transform"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                        data-testid="document-image"
                      />
                      {allIssues.length > 0 && (
                        <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-[90%]">
                          {allIssues.map((issue, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedDefect(selectedDefect === idx ? null : idx)}
                              className={`
                                flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                                transition-all cursor-pointer shadow-md
                                ${selectedDefect === idx 
                                  ? `${issue.bg} text-white ring-2 ring-offset-2 ${issue.ring}` 
                                  : `bg-white/90 ${issue.text} border ${issue.border}`
                                }
                              `}
                              data-testid={`defect-marker-${idx}`}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {issue.code || `Issue ${idx + 1}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileImage className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No Document Available</p>
                  <p className="text-sm mt-1">Document preview will appear here once uploaded</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Issues Found ({allIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[550px] overflow-y-auto">
            {allIssues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No issues detected</p>
              </div>
            ) : (
              allIssues.map((issue, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedDefect(selectedDefect === idx ? null : idx)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedDefect === idx 
                      ? `${issue.border} border-2 ${issue.bgLight}` 
                      : "border-border hover:border-primary/50"
                    }
                  `}
                  data-testid={`issue-card-${idx}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge 
                      variant="outline" 
                      className={`${issue.text} ${issue.border} font-semibold`}
                    >
                      {issue.code || issue.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {issue.type}
                    </span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{issue.description}</p>
                  {issue.location && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Location: {issue.location}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {allIssues.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>C1 / Immediate Danger - Requires immediate action</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>C2 / At Risk - Urgent remedial work needed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>C3 / Advisory - Improvement recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>FI - Further investigation required</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
