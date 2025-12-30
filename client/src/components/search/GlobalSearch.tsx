import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Building2, FileText, AlertTriangle, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchResult {
  properties: Array<{
    id: string;
    uprn: string;
    address_line1: string;
    city: string;
    postcode: string;
    compliance_status: string;
  }>;
  certificates: Array<{
    id: string;
    certificate_type: string;
    status: string;
    file_name: string;
    address_line1?: string;
  }>;
  actions: Array<{
    id: string;
    description: string;
    severity: string;
    status: string;
    address_line1?: string;
  }>;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setSelectedIndex(0);
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 200);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const allResults = [
    ...(results?.properties || []).map(p => ({ type: "property" as const, data: p })),
    ...(results?.certificates || []).map(c => ({ type: "certificate" as const, data: c })),
    ...(results?.actions || []).map(a => ({ type: "action" as const, data: a })),
  ];

  const handleSelect = useCallback((type: string, id: string) => {
    closeAndReset();
    switch (type) {
      case "property":
        setLocation(`/properties/${id}`);
        break;
      case "certificate":
        setLocation(`/certificates/${id}`);
        break;
      case "action":
        setLocation(`/actions`);
        break;
    }
  }, [closeAndReset, setLocation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      const item = allResults[selectedIndex];
      handleSelect(item.type, item.data.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAndReset();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "IMMEDIATE": return "bg-red-100 text-red-700 border-red-200";
      case "URGENT": return "bg-orange-100 text-orange-700 border-orange-200";
      case "PRIORITY": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-emerald-100 text-emerald-700";
      case "NEEDS_REVIEW": return "bg-amber-100 text-amber-700";
      case "PROCESSING": return "bg-blue-100 text-blue-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border rounded-lg hover:bg-muted transition-colors"
        data-testid="global-search-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-background border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeAndReset()}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Global Search</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center gap-2 px-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search properties, certificates, actions..."
              className="border-0 focus-visible:ring-0 text-lg h-14"
              data-testid="global-search-input"
            />
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {query && !loading && (
              <button onClick={() => setQuery("")} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {allResults.length === 0 && query.length >= 2 && !loading && (
              <div className="p-8 text-center text-muted-foreground">
                No results found for "{query}"
              </div>
            )}

            {results?.properties && results.properties.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Properties
                </div>
                {results.properties.map((property, idx) => {
                  const globalIdx = idx;
                  return (
                    <button
                      key={property.id}
                      onClick={() => handleSelect("property", property.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        selectedIndex === globalIdx ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      data-testid={`search-result-property-${property.id}`}
                    >
                      <div className="h-8 w-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{property.address_line1}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {property.city}, {property.postcode} • UPRN: {property.uprn}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {property.compliance_status?.replace("_", " ")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {results?.certificates && results.certificates.length > 0 && (
              <div className="p-2 border-t">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Certificates
                </div>
                {results.certificates.map((cert, idx) => {
                  const globalIdx = (results?.properties?.length || 0) + idx;
                  return (
                    <button
                      key={cert.id}
                      onClick={() => handleSelect("certificate", cert.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        selectedIndex === globalIdx ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      data-testid={`search-result-cert-${cert.id}`}
                    >
                      <div className="h-8 w-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cert.certificate_type}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {cert.file_name} {cert.address_line1 && `• ${cert.address_line1}`}
                        </div>
                      </div>
                      <Badge className={cn("text-xs", getStatusColor(cert.status))}>
                        {cert.status?.replace("_", " ")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {results?.actions && results.actions.length > 0 && (
              <div className="p-2 border-t">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Remedial Actions
                </div>
                {results.actions.map((action, idx) => {
                  const globalIdx = (results?.properties?.length || 0) + (results?.certificates?.length || 0) + idx;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleSelect("action", action.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        selectedIndex === globalIdx ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      data-testid={`search-result-action-${action.id}`}
                    >
                      <div className="h-8 w-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{action.description}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {action.address_line1}
                        </div>
                      </div>
                      <Badge className={cn("text-xs border", getSeverityColor(action.severity))}>
                        {action.severity}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted border rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted border rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted border rounded">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted border rounded">esc</kbd>
              to close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
