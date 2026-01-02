import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Database, 
  Server, 
  HardDrive, 
  Globe, 
  Users, 
  Trash2, 
  RefreshCw, 
  Shield, 
  History, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Zap
} from "lucide-react";
import { format } from "date-fns";

type CacheLayer = "CLIENT" | "API" | "DATABASE" | "MEMORY" | "SESSION";
type CacheClearScope = "REGION" | "CATEGORY" | "LAYER" | "ALL";

interface CacheRegion {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  layer: CacheLayer;
  category: string;
  queryKeyPattern: string | null;
  cacheKeyPattern: string | null;
  isProtected: boolean;
  isSystem: boolean;
  isActive: boolean;
  lastClearedAt: string | null;
  lastClearedBy: string | null;
}

interface CacheOverview {
  totalRegions: number;
  byLayer: Record<string, { count: number; regions: string[] }>;
  byCategory: Record<string, { count: number; regions: string[] }>;
  memoryCache: { size: number; hits: number; misses: number; evictions: number };
  last24Hours: { totalHits: number; totalMisses: number; hitRate: number; statsCount: number };
}

interface ClearCacheResult {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "DRY_RUN";
  affectedRegions: Array<{
    regionId: string;
    regionName: string;
    layer: string;
    status: string;
    entriesCleared?: number;
    error?: string;
  }>;
  totalEntriesCleared: number;
  executionTimeMs: number;
  auditId?: string;
}

interface AuditEntry {
  audit: {
    id: string;
    scope: CacheClearScope;
    scopeIdentifier: string | null;
    reason: string;
    isDryRun: boolean;
    status: string;
    totalEntriesCleared: number;
    executionTimeMs: number | null;
    createdAt: string;
  };
  userName: string | null;
}

const LAYER_ICONS: Record<CacheLayer, typeof Database> = {
  CLIENT: Globe,
  API: Server,
  DATABASE: Database,
  MEMORY: HardDrive,
  SESSION: Users,
};

const LAYER_COLORS: Record<CacheLayer, string> = {
  CLIENT: "bg-blue-100 text-blue-800",
  API: "bg-purple-100 text-purple-800",
  DATABASE: "bg-green-100 text-green-800",
  MEMORY: "bg-orange-100 text-orange-800",
  SESSION: "bg-pink-100 text-pink-800",
};

export default function CacheControlPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [clearScope, setClearScope] = useState<CacheClearScope>("REGION");
  const [clearIdentifier, setClearIdentifier] = useState("");
  const [clearReason, setClearReason] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [previewResult, setPreviewResult] = useState<ClearCacheResult | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [layerFilter, setLayerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: overview, isLoading: overviewLoading } = useQuery<CacheOverview>({
    queryKey: ["/api/admin/cache/overview"],
  });

  const { data: regions, isLoading: regionsLoading } = useQuery<CacheRegion[]>({
    queryKey: ["/api/admin/cache/regions"],
  });

  const { data: auditHistory } = useQuery<AuditEntry[]>({
    queryKey: ["/api/admin/cache/audit"],
  });

  const previewMutation = useMutation({
    mutationFn: async (params: { scope: CacheClearScope; identifier?: string; identifiers?: string[]; reason: string }) => {
      const res = await apiRequest("POST", "/api/admin/cache/preview", params);
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewResult(data);
    },
    onError: (error) => {
      toast({ title: "Preview failed", description: String(error), variant: "destructive" });
    },
  });

  const getTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cache/confirmation-token", {});
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmationToken(data.token);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async (params: { 
      scope: CacheClearScope; 
      identifier?: string; 
      identifiers?: string[]; 
      reason: string;
      confirmationToken?: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/cache/clear", params);
      return res.json();
    },
    onSuccess: (data: ClearCacheResult) => {
      toast({
        title: data.status === "SUCCESS" ? "Cache Cleared" : "Cache Clear " + data.status,
        description: `Cleared ${data.totalEntriesCleared} entries in ${data.executionTimeMs}ms`,
        variant: data.status === "FAILED" ? "destructive" : "default",
      });
      setShowClearDialog(false);
      setPreviewResult(null);
      setSelectedRegions([]);
      setClearReason("");
      setConfirmationToken(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/regions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/audit"] });
    },
    onError: (error) => {
      toast({ title: "Clear failed", description: String(error), variant: "destructive" });
    },
  });

  const handlePreview = () => {
    if (!clearReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for clearing the cache", variant: "destructive" });
      return;
    }

    const params: { scope: CacheClearScope; identifier?: string; identifiers?: string[]; reason: string } = {
      scope: clearScope,
      reason: clearReason,
    };

    if (clearScope === "REGION" && selectedRegions.length > 0) {
      params.identifiers = selectedRegions;
    } else if (clearScope !== "ALL" && clearIdentifier) {
      params.identifier = clearIdentifier;
    }

    previewMutation.mutate(params);
  };

  const handleClear = () => {
    const params: { 
      scope: CacheClearScope; 
      identifier?: string; 
      identifiers?: string[]; 
      reason: string;
      confirmationToken?: string;
    } = {
      scope: clearScope,
      reason: clearReason,
    };

    if (clearScope === "REGION" && selectedRegions.length > 0) {
      params.identifiers = selectedRegions;
    } else if (clearScope !== "ALL" && clearIdentifier) {
      params.identifier = clearIdentifier;
    }

    if (clearScope === "ALL" && confirmationToken) {
      params.confirmationToken = confirmationToken;
    }

    clearMutation.mutate(params);
  };

  const filteredRegions = regions?.filter(r => {
    if (layerFilter !== "all" && r.layer !== layerFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true;
  }) || [];

  const categories = Array.from(new Set(regions?.map(r => r.category) || []));

  const toggleRegionSelection = (regionId: string) => {
    setSelectedRegions(prev => 
      prev.includes(regionId) 
        ? prev.filter(id => id !== regionId)
        : [...prev, regionId]
    );
  };

  return (
    <div className="flex h-screen bg-muted/30" data-testid="page-cache-control">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Cache Control" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="heading-cache-control">Cache Control</h1>
              <p className="text-muted-foreground text-sm md:text-base">Manage application caches across all layers</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/overview"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/regions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/cache/audit"] });
              }}
              data-testid="button-refresh-cache"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="regions" data-testid="tab-regions">Regions</TabsTrigger>
              <TabsTrigger value="clear" data-testid="tab-clear">Clear Cache</TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card data-testid="card-total-regions">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Regions</CardDescription>
                    <CardTitle className="text-2xl">{overview?.totalRegions || 0}</CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-memory-entries">
                  <CardHeader className="pb-2">
                    <CardDescription>Memory Entries</CardDescription>
                    <CardTitle className="text-2xl">{overview?.memoryCache.size || 0}</CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-hit-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Hit Rate (24h)</CardDescription>
                    <CardTitle className="text-2xl">{overview?.last24Hours.hitRate || 0}%</CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-total-hits">
                  <CardHeader className="pb-2">
                    <CardDescription>Cache Hits</CardDescription>
                    <CardTitle className="text-2xl">{overview?.memoryCache.hits || 0}</CardTitle>
                  </CardHeader>
                </Card>

                <Card data-testid="card-total-misses" className="col-span-2 md:col-span-1">
                  <CardHeader className="pb-2">
                    <CardDescription>Cache Misses</CardDescription>
                    <CardTitle className="text-2xl">{overview?.memoryCache.misses || 0}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card data-testid="card-by-layer">
                  <CardHeader>
                    <CardTitle>Cache by Layer</CardTitle>
                    <CardDescription>Distribution of cache regions across layers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(["CLIENT", "API", "DATABASE", "MEMORY", "SESSION"] as CacheLayer[]).map(layer => {
                        const LayerIcon = LAYER_ICONS[layer];
                        const data = overview?.byLayer[layer];
                        return (
                          <div key={layer} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <LayerIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{layer}</span>
                            </div>
                            <Badge className={LAYER_COLORS[layer]}>{data?.count || 0} regions</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-by-category">
                  <CardHeader>
                    <CardTitle>Cache by Category</CardTitle>
                    <CardDescription>Grouped by functional area</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(overview?.byCategory || {}).map(([category, data]) => (
                        <div key={category} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="font-medium capitalize">{category}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{data.count} regions</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="regions" className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Select value={layerFilter} onValueChange={setLayerFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-layer-filter">
                    <SelectValue placeholder="Filter by layer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Layers</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="DATABASE">Database</SelectItem>
                    <SelectItem value="MEMORY">Memory</SelectItem>
                    <SelectItem value="SESSION">Session</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Layer</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Cleared</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegions.map(region => {
                        const LayerIcon = LAYER_ICONS[region.layer];
                        return (
                          <TableRow key={region.id} data-testid={`row-region-${region.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRegions.includes(region.id)}
                                onCheckedChange={() => toggleRegionSelection(region.id)}
                                disabled={region.isProtected}
                                data-testid={`checkbox-region-${region.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{region.displayName}</span>
                                {region.isProtected && <Shield className="h-4 w-4 text-yellow-500" />}
                                {region.isSystem && <Zap className="h-4 w-4 text-purple-500" />}
                              </div>
                              <span className="text-xs text-muted-foreground">{region.name}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={LAYER_COLORS[region.layer]}>
                                <LayerIcon className="h-3 w-3 mr-1" />
                                {region.layer}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{region.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {region.isActive ? (
                                <Badge className="bg-green-100 text-green-800">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {region.lastClearedAt 
                                ? format(new Date(region.lastClearedAt), "MMM d, HH:mm")
                                : "Never"
                              }
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedRegions.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <span className="font-medium">{selectedRegions.length} region(s) selected</span>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      setClearScope("REGION");
                      setSelectedTab("clear");
                    }}
                    data-testid="button-clear-selected"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Selected
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="clear" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Clear Cache
                  </CardTitle>
                  <CardDescription>
                    Carefully select the scope and provide a reason before clearing cache data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Clear Scope</Label>
                        <Select value={clearScope} onValueChange={(v) => setClearScope(v as CacheClearScope)}>
                          <SelectTrigger data-testid="select-clear-scope">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="REGION">Single Region(s)</SelectItem>
                            <SelectItem value="CATEGORY">By Category</SelectItem>
                            <SelectItem value="LAYER">By Layer</SelectItem>
                            <SelectItem value="ALL">All Caches (Requires Confirmation)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {clearScope === "REGION" && selectedRegions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Selected Regions</Label>
                          <div className="flex flex-wrap gap-2">
                            {selectedRegions.map(id => {
                              const region = regions?.find(r => r.id === id);
                              return (
                                <Badge key={id} variant="secondary">
                                  {region?.displayName || id}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {clearScope === "CATEGORY" && (
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={clearIdentifier} onValueChange={setClearIdentifier}>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {clearScope === "LAYER" && (
                        <div className="space-y-2">
                          <Label>Layer</Label>
                          <Select value={clearIdentifier} onValueChange={setClearIdentifier}>
                            <SelectTrigger data-testid="select-layer">
                              <SelectValue placeholder="Select layer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CLIENT">Client</SelectItem>
                              <SelectItem value="API">API</SelectItem>
                              <SelectItem value="DATABASE">Database</SelectItem>
                              <SelectItem value="MEMORY">Memory</SelectItem>
                              <SelectItem value="SESSION">Session</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {clearScope === "ALL" && !confirmationToken && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                          <p className="text-sm text-red-800 font-medium">
                            Clearing all caches requires a confirmation token
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => getTokenMutation.mutate()}
                            disabled={getTokenMutation.isPending}
                            data-testid="button-get-token"
                          >
                            Generate Token
                          </Button>
                        </div>
                      )}

                      {clearScope === "ALL" && confirmationToken && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
                            Token generated. Valid for 5 minutes.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Reason for Clearing</Label>
                        <Textarea
                          placeholder="Describe why you need to clear this cache..."
                          value={clearReason}
                          onChange={(e) => setClearReason(e.target.value)}
                          rows={4}
                          data-testid="textarea-reason"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={handlePreview}
                      disabled={previewMutation.isPending || !clearReason.trim()}
                      data-testid="button-preview"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowClearDialog(true)}
                      disabled={
                        clearMutation.isPending || 
                        !clearReason.trim() ||
                        (clearScope === "ALL" && !confirmationToken) ||
                        (clearScope === "REGION" && selectedRegions.length === 0)
                      }
                      data-testid="button-clear"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>

                  {previewResult && (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardHeader>
                        <CardTitle className="text-lg">Preview Result</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p><strong>Status:</strong> {previewResult.status}</p>
                          <p><strong>Affected Regions:</strong> {previewResult.affectedRegions.length}</p>
                          <div className="flex flex-wrap gap-2">
                            {previewResult.affectedRegions.map(r => (
                              <Badge key={r.regionId} variant="outline">
                                {r.regionName} ({r.layer})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit History
                  </CardTitle>
                  <CardDescription>Recent cache clear operations</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Entries Cleared</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditHistory?.map(entry => (
                        <TableRow key={entry.audit.id} data-testid={`row-audit-${entry.audit.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(entry.audit.createdAt), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>{entry.userName || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {entry.audit.scope}
                              {entry.audit.scopeIdentifier && `: ${entry.audit.scopeIdentifier}`}
                            </Badge>
                            {entry.audit.isDryRun && (
                              <Badge variant="secondary" className="ml-2">Dry Run</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.audit.status === "SUCCESS" && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            )}
                            {entry.audit.status === "PARTIAL" && (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Partial
                              </Badge>
                            )}
                            {entry.audit.status === "FAILED" && (
                              <Badge className="bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                            {entry.audit.status === "DRY_RUN" && (
                              <Badge variant="secondary">
                                <Eye className="h-3 w-3 mr-1" />
                                Preview
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{entry.audit.totalEntriesCleared}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {entry.audit.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!auditHistory || auditHistory.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No cache clear operations recorded yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cache Clear</AlertDialogTitle>
            <AlertDialogDescription>
              {clearScope === "ALL" ? (
                <span className="text-red-600 font-medium">
                  You are about to clear ALL caches. This action cannot be undone and may temporarily affect application performance.
                </span>
              ) : (
                <span>
                  This will clear the selected cache regions. Users may experience slightly slower load times until the cache is repopulated.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear"
            >
              Clear Cache
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
