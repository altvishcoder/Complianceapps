import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, AlertTriangle, CheckCircle, 
  Clock, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, ChevronLeft, Home
} from "lucide-react";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLocation } from "wouter";

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

function getPropertyComplianceColor(status: string): string {
  if (status === 'compliant') return COMPLIANCE_COLORS.excellent;
  if (status === 'at_risk') return COMPLIANCE_COLORS.warning;
  if (status === 'expired') return COMPLIANCE_COLORS.critical;
  return '#9ca3af';
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
  
  if (nodeType === 'property') {
    const status = data.complianceStatus === 'expired' ? 'Expired' : 
                   data.complianceStatus === 'at_risk' ? 'At Risk' : 
                   data.complianceStatus === 'compliant' ? 'Compliant' : 'No Certificates';
    const statusColor = data.complianceStatus === 'expired' ? 'text-red-600' :
                        data.complianceStatus === 'at_risk' ? 'text-amber-600' :
                        data.complianceStatus === 'compliant' ? 'text-green-600' : 'text-muted-foreground';
    
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-lg border text-sm" data-testid="treemap-tooltip">
        <p className="font-semibold mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${statusColor}`}>{status}</span>
          </div>
          {data.uprn && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">UPRN:</span>
              <span>{data.uprn}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-green-600">Valid Certs:</span>
            <span>{data.compliantCerts || 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-amber-600">Expiring:</span>
            <span>{data.expiringCerts || 0}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-red-600">Expired:</span>
            <span>{data.expiredCerts || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-600 pt-1 border-t mt-1">
            <ExternalLink className="h-3 w-3" />
            <span>Click to view property details</span>
          </div>
        </div>
      </div>
    );
  }
  
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
            <span>Click to drill down to blocks</span>
          </div>
        </div>
      </div>
    );
  }
  
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
          <span>Click to drill down to properties</span>
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
  complianceStatus?: string;
  depth?: number;
  index?: number;
  nodeType?: 'scheme' | 'block' | 'property';
  nodeId?: string;
}

function CustomTreemapContent({ x = 0, y = 0, width = 0, height = 0, name = '', complianceRate = 0, complianceStatus, nodeType, depth = 0 }: TreemapContentProps) {
  if (width < 4 || height < 4) return null;
  
  const color = nodeType === 'property' && complianceStatus 
    ? getPropertyComplianceColor(complianceStatus)
    : getComplianceColor(complianceRate);
  
  const showFullText = width > 50 && height > 35;
  const showNameOnly = !showFullText && width > 40 && height > 20;
  const showPercentOnly = !showFullText && !showNameOnly && width > 25 && height > 18;
  
  const truncateName = (n: string, maxChars: number) => {
    if (n.length <= maxChars) return n;
    return n.substring(0, maxChars - 2) + '..';
  };
  
  const maxChars = Math.max(3, Math.floor(width / 7));
  
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
        strokeWidth={1}
        rx={2}
      />
      {showFullText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(11, Math.max(8, width / 10))}
            fontWeight="600"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {truncateName(name, maxChars)}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(10, Math.max(7, width / 12))}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {nodeType === 'property' ? (complianceStatus === 'compliant' ? '✓' : complianceStatus === 'at_risk' ? '⚠' : complianceStatus === 'expired' ? '✗' : '—') : `${complianceRate.toFixed(0)}%`}
          </text>
        </>
      )}
      {showNameOnly && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 4}
          textAnchor="middle"
          fill="#fff"
          fontSize={Math.min(9, Math.max(7, width / 8))}
          fontWeight="600"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          {truncateName(name, Math.max(3, Math.floor(width / 8)))}
        </text>
      )}
      {showPercentOnly && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 3}
          textAnchor="middle"
          fill="#fff"
          fontSize={Math.min(8, Math.max(6, Math.min(width, height) / 4))}
          fontWeight="600"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          {nodeType === 'property' ? (complianceStatus === 'compliant' ? '✓' : complianceStatus === 'at_risk' ? '⚠' : '✗') : `${complianceRate.toFixed(0)}%`}
        </text>
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

interface BlocksResponse {
  blocks: Array<{
    id: string;
    name: string;
    totalProperties: number;
    compliantProperties: number;
    atRiskProperties: number;
    expiredProperties: number;
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

interface PropertiesResponse {
  properties: Array<{
    id: string;
    name: string;
    uprn: string;
    compliantCerts: number;
    expiredCerts: number;
    expiringCerts: number;
    complianceStatus: 'compliant' | 'at_risk' | 'expired' | 'no_data';
  }>;
  totals: {
    total: number;
    compliant: number;
    atRisk: number;
    expired: number;
    noData: number;
  };
}

type ViewLevel = 'schemes' | 'blocks' | 'properties';

interface DrilldownState {
  level: ViewLevel;
  schemeId?: string;
  schemeName?: string;
  blockId?: string;
  blockName?: string;
}

export default function AssetHealth() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    document.title = "Asset Health - ComplianceAI";
  }, []);

  const [drilldown, setDrilldown] = useState<DrilldownState>({ level: 'schemes' });
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>('all');

  const { data: summary, isLoading: summaryLoading, refetch } = useQuery<AssetHealthSummary>({
    queryKey: ['asset-health-summary'],
    queryFn: async () => {
      const res = await fetch('/api/asset-health/summary', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch asset health summary');
      return res.json();
    },
  });

  const { data: blocksData, isLoading: blocksLoading } = useQuery<BlocksResponse>({
    queryKey: ['asset-health-blocks', drilldown.schemeId],
    queryFn: async () => {
      const res = await fetch(`/api/asset-health/schemes/${drilldown.schemeId}/blocks`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch blocks');
      return res.json();
    },
    enabled: drilldown.level === 'blocks' && !!drilldown.schemeId,
  });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery<PropertiesResponse>({
    queryKey: ['asset-health-properties', drilldown.blockId],
    queryFn: async () => {
      const res = await fetch(`/api/asset-health/blocks/${drilldown.blockId}/properties`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
    enabled: drilldown.level === 'properties' && !!drilldown.blockId,
  });

  const isLoading = summaryLoading || (drilldown.level === 'blocks' && blocksLoading) || (drilldown.level === 'properties' && propertiesLoading);
  const schemes = summary?.schemes || [];

  const treeData = useMemo(() => {
    if (drilldown.level === 'schemes') {
      if (!summary || !summary.schemes) return [];
      
      const filteredSchemes = summary.schemes.filter(
        s => selectedSchemeFilter === 'all' || s.id === selectedSchemeFilter
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
    }
    
    if (drilldown.level === 'blocks' && blocksData) {
      return blocksData.blocks
        .map(block => ({
          name: block.name,
          size: Math.max(block.totalProperties, 1),
          totalProperties: block.totalProperties,
          compliantProperties: block.compliantProperties,
          atRiskProperties: block.atRiskProperties,
          expiredProperties: block.expiredProperties,
          complianceRate: block.complianceRate,
          nodeType: 'block' as const,
          nodeId: block.id,
        }))
        .filter(node => node.totalProperties > 0);
    }
    
    if (drilldown.level === 'properties' && propertiesData) {
      return propertiesData.properties.map(prop => ({
        name: prop.name,
        size: 1,
        totalProperties: 1,
        compliantProperties: prop.complianceStatus === 'compliant' ? 1 : 0,
        atRiskProperties: prop.complianceStatus === 'at_risk' ? 1 : 0,
        expiredProperties: prop.complianceStatus === 'expired' ? 1 : 0,
        complianceRate: prop.complianceStatus === 'compliant' ? 100 : prop.complianceStatus === 'at_risk' ? 70 : 0,
        complianceStatus: prop.complianceStatus,
        nodeType: 'property' as const,
        nodeId: prop.id,
        uprn: prop.uprn,
        compliantCerts: prop.compliantCerts,
        expiredCerts: prop.expiredCerts,
        expiringCerts: prop.expiringCerts,
      }));
    }
    
    return [];
  }, [summary, blocksData, propertiesData, drilldown.level, selectedSchemeFilter]);

  const summaryStats = useMemo(() => {
    if (drilldown.level === 'blocks' && blocksData) {
      return blocksData.totals;
    }
    if (drilldown.level === 'properties' && propertiesData) {
      return {
        totalProperties: propertiesData.totals.total,
        compliantProperties: propertiesData.totals.compliant,
        atRiskProperties: propertiesData.totals.atRisk,
        expiredProperties: propertiesData.totals.expired,
        complianceRate: propertiesData.totals.total > 0 
          ? Math.round((propertiesData.totals.compliant / propertiesData.totals.total) * 1000) / 10 
          : 100,
      };
    }
    if (!summary) return { totalProperties: 0, compliantProperties: 0, atRiskProperties: 0, expiredProperties: 0, complianceRate: 100 };
    return summary.totals;
  }, [summary, blocksData, propertiesData, drilldown.level]);

  const handleTreemapClick = useCallback((data: any) => {
    if (!data || !data.nodeType || !data.nodeId) return;
    
    if (data.nodeType === 'scheme') {
      setDrilldown({
        level: 'blocks',
        schemeId: data.nodeId,
        schemeName: data.name,
      });
    } else if (data.nodeType === 'block') {
      setDrilldown(prev => ({
        ...prev,
        level: 'properties',
        blockId: data.nodeId,
        blockName: data.name,
      }));
    } else if (data.nodeType === 'property') {
      navigate(`/properties/${data.nodeId}`);
    }
  }, [navigate]);

  const handleGoBack = useCallback(() => {
    if (drilldown.level === 'properties') {
      setDrilldown(prev => ({
        level: 'blocks',
        schemeId: prev.schemeId,
        schemeName: prev.schemeName,
      }));
    } else if (drilldown.level === 'blocks') {
      setDrilldown({ level: 'schemes' });
    }
  }, [drilldown.level]);

  const handleGoHome = useCallback(() => {
    setDrilldown({ level: 'schemes' });
    setSelectedSchemeFilter('all');
  }, []);

  const getBreadcrumb = () => {
    const parts = ['All Schemes'];
    if (drilldown.schemeName) parts.push(drilldown.schemeName);
    if (drilldown.blockName) parts.push(drilldown.blockName);
    return parts;
  };

  const getViewTitle = () => {
    if (drilldown.level === 'properties') return `Properties in ${drilldown.blockName}`;
    if (drilldown.level === 'blocks') return `Blocks in ${drilldown.schemeName}`;
    return 'Scheme Overview';
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-asset-health">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Asset Health" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-bold">Asset Health Overview</h1>
              <p className="text-sm text-muted-foreground">Visual compliance status across your property portfolio</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh" className="shrink-0 gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="sm:sr-only">Refresh</span>
            </Button>
          </div>

          <ErrorBoundary sectionName="Statistics">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card>
              <CardContent className="pt-4 md:pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Total Properties</p>
                    <p className="text-lg md:text-2xl font-bold" data-testid="stat-total">{summaryStats.totalProperties}</p>
                  </div>
                  <Building2 className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
              <CardContent className="pt-4 md:pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400">Compliant</p>
                    <p className="text-lg md:text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="stat-compliant">{summaryStats.compliantProperties}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
              <CardContent className="pt-4 md:pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-amber-600 dark:text-amber-400">At Risk</p>
                    <p className="text-lg md:text-2xl font-bold text-amber-700 dark:text-amber-300" data-testid="stat-at-risk">{summaryStats.atRiskProperties}</p>
                  </div>
                  <Clock className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
              <CardContent className="pt-4 md:pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-red-600 dark:text-red-400">Expired</p>
                    <p className="text-lg md:text-2xl font-bold text-red-700 dark:text-red-300" data-testid="stat-expired">{summaryStats.expiredProperties}</p>
                  </div>
                  <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2 md:col-span-1" style={{ borderColor: getComplianceColor(summaryStats.complianceRate) }}>
              <CardContent className="pt-4 md:pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Compliance Rate</p>
                    <p className="text-lg md:text-2xl font-bold" style={{ color: getComplianceColor(summaryStats.complianceRate) }} data-testid="stat-rate">
                      {summaryStats.complianceRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center">
                    {summaryStats.complianceRate >= 85 ? (
                      <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-emerald-500" />
                    ) : summaryStats.complianceRate >= 70 ? (
                      <Minus className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </ErrorBoundary>

          <ErrorBoundary sectionName="Treemap">
          <Card>
            <CardHeader className="pb-2 px-3 md:px-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                    {drilldown.level !== 'schemes' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={handleGoHome} data-testid="button-home" className="h-8 w-8 p-0 md:h-9 md:w-9">
                          <Home className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="button-back" className="h-8 px-2 md:h-9 md:px-3">
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Back</span>
                        </Button>
                      </>
                    )}
                    <CardTitle className="text-base md:text-lg truncate">{getViewTitle()}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground flex-wrap">
                    {getBreadcrumb().map((part, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span>/</span>}
                        <span className={i === getBreadcrumb().length - 1 ? 'font-medium text-foreground' : ''}>{part}</span>
                      </span>
                    ))}
                  </div>
                  <CardDescription className="text-xs md:text-sm">
                    {drilldown.level === 'properties' 
                      ? 'Color indicates compliance status' 
                      : 'Size represents property count, color indicates compliance rate. Tap to drill down.'}
                  </CardDescription>
                </div>
                {drilldown.level === 'schemes' && (
                  <Select value={selectedSchemeFilter} onValueChange={setSelectedSchemeFilter}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-scheme">
                      <SelectValue placeholder="All Schemes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schemes</SelectItem>
                      {schemes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              {isLoading && !treeData.length ? (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                  </div>
                  <Skeleton className="h-[200px] md:h-[300px] w-full rounded-lg" />
                </div>
              ) : treeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-24 text-muted-foreground">
                  <Building2 className="h-10 w-10 md:h-12 md:w-12 mb-3 md:mb-4" />
                  <p className="text-sm md:text-base text-center">No data available for the selected view</p>
                  {drilldown.level !== 'schemes' && (
                    <Button variant="link" onClick={handleGoBack} className="mt-2">
                      Go back
                    </Button>
                  )}
                </div>
              ) : (
                <div className="h-[300px] sm:h-[400px] md:h-[500px]" data-testid="treemap-container">
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

          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-xs md:text-sm px-2" data-testid="color-legend">
            <span className="text-muted-foreground font-medium w-full text-center sm:w-auto">Compliance Legend:</span>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.excellent }} />
              <span>≥95%</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.good }} />
              <span>≥85%</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.warning }} />
              <span>≥70%</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.danger }} />
              <span>≥50%</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: COMPLIANCE_COLORS.critical }} />
              <span>&lt;50%</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
