import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, Home, Layers, ChevronRight, AlertTriangle, CheckCircle, 
  Clock, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, ExternalLink
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Treemap, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface Property {
  id: string;
  addressLine1: string;
  blockId: string;
}

interface Certificate {
  id: string;
  propertyId: string;
  certificateType: string;
  status: string;
  expiryDate: string;
  outcome?: string;
}

interface Scheme {
  id: string;
  name: string;
}

interface Block {
  id: string;
  name: string;
  schemeId: string;
}

interface TreeNode {
  name: string;
  size: number;
  complianceRate: number;
  totalProperties: number;
  compliantProperties: number;
  atRiskProperties: number;
  expiredProperties: number;
  nodeType?: 'scheme' | 'block' | 'property';
  blocksCount?: number;
  nodeId?: string;
  children?: TreeNode[];
}

const COMPLIANCE_COLORS = {
  excellent: '#22c55e',
  good: '#84cc16',
  warning: '#f59e0b',
  danger: '#ef4444',
  critical: '#dc2626',
};

function getComplianceColor(rate: number): string {
  if (rate >= 95) return COMPLIANCE_COLORS.excellent;
  if (rate >= 85) return COMPLIANCE_COLORS.good;
  if (rate >= 70) return COMPLIANCE_COLORS.warning;
  if (rate >= 50) return COMPLIANCE_COLORS.danger;
  return COMPLIANCE_COLORS.critical;
}

function getComplianceStatus(rate: number): string {
  if (rate >= 95) return 'Excellent';
  if (rate >= 85) return 'Good';
  if (rate >= 70) return 'At Risk';
  if (rate >= 50) return 'Poor';
  return 'Critical';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

function CustomTreemapTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const rate = data.complianceRate || 0;
  const nodeType = data.nodeType || 'scheme';
  
  // Property-level tooltip - simpler display
  if (nodeType === 'property') {
    const status = data.expiredProperties > 0 ? 'Expired' : 
                   data.atRiskProperties > 0 ? 'At Risk' : 
                   data.compliantProperties > 0 ? 'Compliant' : 'No Certificates';
    const statusColor = data.expiredProperties > 0 ? 'text-red-600' :
                        data.atRiskProperties > 0 ? 'text-amber-600' :
                        data.compliantProperties > 0 ? 'text-green-600' : 'text-muted-foreground';
    
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-lg border text-sm" data-testid="treemap-tooltip">
        <p className="font-semibold mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${statusColor}`}>{status}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Compliance Score:</span>
            <span className="font-medium" style={{ color: getComplianceColor(rate) }}>
              {rate.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-blue-600 pt-1 border-t mt-1">
            <ExternalLink className="h-3 w-3" />
            <span>Click to view property</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Scheme-level tooltip - shows blocks and properties
  if (nodeType === 'scheme') {
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-lg border text-sm" data-testid="treemap-tooltip">
        <p className="font-semibold mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Compliance:</span>
            <span className="font-medium" style={{ color: getComplianceColor(rate) }}>
              {rate.toFixed(1)}%
            </span>
          </div>
          {data.blocksCount !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Blocks:</span>
              <span>{data.blocksCount}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Properties:</span>
            <span>{data.totalProperties}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-green-600">Compliant:</span>
            <span>{data.compliantProperties}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-amber-600">At Risk:</span>
            <span>{data.atRiskProperties}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-red-600">Expired:</span>
            <span>{data.expiredProperties}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-600 pt-1 border-t mt-1">
            <ExternalLink className="h-3 w-3" />
            <span>Click to view properties in scheme</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Block-level tooltip - shows properties within block
  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-lg border text-sm" data-testid="treemap-tooltip">
      <p className="font-semibold mb-2">{data.name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Compliance:</span>
          <span className="font-medium" style={{ color: getComplianceColor(rate) }}>
            {rate.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Properties:</span>
          <span>{data.totalProperties}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-green-600">Compliant:</span>
          <span>{data.compliantProperties}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-amber-600">At Risk:</span>
          <span>{data.atRiskProperties}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-600">Expired:</span>
          <span>{data.expiredProperties}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600 pt-1 border-t mt-1">
          <ExternalLink className="h-3 w-3" />
          <span>Click to view properties in block</span>
        </div>
      </div>
    </div>
  );
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  complianceRate?: number;
  depth?: number;
  index?: number;
  nodeType?: 'scheme' | 'block' | 'property';
  nodeId?: string;
}

function CustomTreemapContent({ x = 0, y = 0, width = 0, height = 0, name = '', complianceRate = 0, depth = 0 }: TreemapContentProps) {
  if (width < 50 || height < 30) return null;
  
  const color = getComplianceColor(complianceRate);
  
  return (
    <g style={{ cursor: 'pointer' }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={depth === 1 ? 0.9 : 0.7}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(14, width / 8)}
            fontWeight="600"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {name.length > 15 ? name.substring(0, 12) + '...' : name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(12, width / 10)}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {complianceRate.toFixed(0)}%
          </text>
        </>
      )}
    </g>
  );
}

interface AssetHealthSummary {
  schemes: Array<{
    id: string;
    name: string;
    totalProperties: number;
    compliantProperties: number;
    atRiskProperties: number;
    expiredProperties: number;
    blocksCount: number;
    complianceRate: number;
  }>;
  totals: {
    totalProperties: number;
    compliantProperties: number;
    atRiskProperties: number;
    expiredProperties: number;
    complianceRate: number;
  };
}

export default function AssetHealth() {
  useEffect(() => {
    document.title = "Asset Health - ComplianceAI";
  }, []);

  const [viewLevel, setViewLevel] = useState<'scheme' | 'block' | 'property'>('scheme');
  const [selectedScheme, setSelectedScheme] = useState<string>('all');
  const [selectedBlock, setSelectedBlock] = useState<string>('all');

  const { data: summary, isLoading: summaryLoading, refetch } = useQuery<AssetHealthSummary>({
    queryKey: ['asset-health-summary'],
    queryFn: async () => {
      const res = await fetch('/api/asset-health/summary', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch asset health summary');
      return res.json();
    },
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery<Block[]>({
    queryKey: ['blocks'],
    queryFn: async () => {
      const res = await fetch('/api/blocks', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch blocks');
      return res.json();
    },
  });

  const isLoading = summaryLoading || blocksLoading;
  const schemes = summary?.schemes || [];

  const treeData = useMemo(() => {
    if (!summary || !summary.schemes) return [];
    
    // Use the pre-computed scheme stats from the server
    const filteredSchemes = summary.schemes.filter(
      s => selectedScheme === 'all' || s.id === selectedScheme
    );
    
    return filteredSchemes
      .map(scheme => ({
        name: scheme.name,
        size: Math.max(scheme.totalProperties, 1),
        totalProperties: scheme.totalProperties,
        compliantProperties: scheme.compliantProperties,
        atRiskProperties: scheme.atRiskProperties,
        expiredProperties: scheme.expiredProperties,
        complianceRate: scheme.complianceRate,
        nodeType: 'scheme' as const,
        blocksCount: scheme.blocksCount,
        nodeId: scheme.id,
      }))
      .filter(node => node.totalProperties > 0);
  }, [summary, selectedScheme]);

  const summaryStats = useMemo(() => {
    if (!summary) return { totalProperties: 0, compliantProperties: 0, atRiskProperties: 0, expiredProperties: 0, complianceRate: 100 };
    return summary.totals;
  }, [summary]);

  // Placeholder for block view (would need a separate API endpoint)
  const blockTreeData = useMemo(() => {
    if (viewLevel !== 'block') return [];
    
    const blocksByScheme = new Map<string, Block[]>();
    blocks.forEach(b => {
      const existing = blocksByScheme.get(b.schemeId) || [];
      existing.push(b);
      blocksByScheme.set(b.schemeId, existing);
    });
    
    const filteredBlocks = blocks
      .filter(b => selectedScheme === 'all' || b.schemeId === selectedScheme)
      .filter(b => selectedBlock === 'all' || b.id === selectedBlock);
    
    // For block view, use summary data to distribute proportionally
    const schemeMap = new Map(summary?.schemes.map(s => [s.id, s]) || []);
    
    return filteredBlocks.map(block => {
      const schemeStats = schemeMap.get(block.schemeId);
      const schemeBlocks = blocksByScheme.get(block.schemeId) || [];
      const blockCount = schemeBlocks.length || 1;
      
      // Distribute scheme stats proportionally across blocks
      const proportion = 1 / blockCount;
      const total = Math.round((schemeStats?.totalProperties || 0) * proportion);
      const compliant = Math.round((schemeStats?.compliantProperties || 0) * proportion);
      const atRisk = Math.round((schemeStats?.atRiskProperties || 0) * proportion);
      const expired = Math.round((schemeStats?.expiredProperties || 0) * proportion);
      
      return {
        name: block.name,
        size: Math.max(total, 1),
        totalProperties: total,
        compliantProperties: compliant,
        atRiskProperties: atRisk,
        expiredProperties: expired,
        complianceRate: total > 0 ? (compliant / total) * 100 : 100,
        nodeType: 'block' as const,
        nodeId: block.id,
      };
    }).filter(node => node.totalProperties > 0);
  }, [viewLevel, blocks, selectedScheme, selectedBlock, summary]);

  const activeTreeData = viewLevel === 'block' ? blockTreeData : treeData;

  const filteredBlocks = useMemo(() => {
    if (selectedScheme === 'all') return blocks;
    return blocks.filter(b => b.schemeId === selectedScheme);
  }, [blocks, selectedScheme]);

  const [, navigate] = useLocation();

  const handleTreemapClick = useCallback((data: any) => {
    if (!data || !data.nodeType || !data.nodeId) return;
    
    switch (data.nodeType) {
      case 'property':
        navigate(`/properties/${data.nodeId}`);
        break;
      case 'scheme':
        // Drill down to blocks in this scheme, resetting block filter
        setSelectedScheme(data.nodeId);
        setSelectedBlock('all');
        setViewLevel('block');
        break;
      case 'block':
        // Navigate to properties page with block filter
        setSelectedBlock(data.nodeId);
        setViewLevel('property');
        break;
    }
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-asset-health">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Asset Health" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Asset Health Overview</h1>
              <p className="text-muted-foreground">Visual compliance status across your property portfolio</p>
            </div>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <ErrorBoundary sectionName="Statistics">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                    <p className="text-2xl font-bold" data-testid="stat-total">{summaryStats.totalProperties}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">Compliant</p>
                    <p className="text-2xl font-bold text-emerald-700" data-testid="stat-compliant">{summaryStats.compliantProperties}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600">At Risk</p>
                    <p className="text-2xl font-bold text-amber-700" data-testid="stat-at-risk">{summaryStats.atRiskProperties}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Expired</p>
                    <p className="text-2xl font-bold text-red-700" data-testid="stat-expired">{summaryStats.expiredProperties}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card style={{ borderColor: getComplianceColor(summaryStats.complianceRate) }}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Compliance Rate</p>
                    <p className="text-2xl font-bold" style={{ color: getComplianceColor(summaryStats.complianceRate) }} data-testid="stat-rate">
                      {summaryStats.complianceRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center">
                    {summaryStats.complianceRate >= 85 ? (
                      <TrendingUp className="h-8 w-8 text-emerald-500" />
                    ) : summaryStats.complianceRate >= 70 ? (
                      <Minus className="h-8 w-8 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </ErrorBoundary>

          <ErrorBoundary sectionName="Treemap">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Asset Compliance Treemap</CardTitle>
                  <CardDescription>Size represents property count, color indicates compliance rate</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={viewLevel} onValueChange={(v) => setViewLevel(v as 'scheme' | 'block' | 'property')}>
                    <SelectTrigger className="w-32" data-testid="select-view-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheme">By Scheme</SelectItem>
                      <SelectItem value="block">By Block</SelectItem>
                      <SelectItem value="property">By Property</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedScheme} onValueChange={setSelectedScheme}>
                    <SelectTrigger className="w-40" data-testid="select-scheme">
                      <SelectValue placeholder="All Schemes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schemes</SelectItem>
                      {schemes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(viewLevel === 'block' || viewLevel === 'property') && (
                    <Select value={selectedBlock} onValueChange={setSelectedBlock}>
                      <SelectTrigger className="w-40" data-testid="select-block">
                        <SelectValue placeholder="All Blocks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Blocks</SelectItem>
                        {filteredBlocks.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : treeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <Building2 className="h-12 w-12 mb-4" />
                  <p>No data available for the selected filters</p>
                </div>
              ) : (
                <div className="h-[500px]" data-testid="treemap-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treeData}
                      dataKey="size"
                      stroke="#fff"
                      content={<CustomTreemapContent />}
                      onClick={handleTreemapClick}
                    >
                      <Tooltip content={<CustomTreemapTooltip />} />
                    </Treemap>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          </ErrorBoundary>

          <div className="flex items-center justify-center gap-6 text-sm" data-testid="color-legend">
            <span className="text-muted-foreground font-medium">Compliance Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.excellent }} />
              <span>≥95% Excellent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.good }} />
              <span>≥85% Good</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.warning }} />
              <span>≥70% At Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.danger }} />
              <span>≥50% Poor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.critical }} />
              <span>&lt;50% Critical</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
