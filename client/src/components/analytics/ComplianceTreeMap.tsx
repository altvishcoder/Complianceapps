import { ResponsiveTreeMap } from '@nivo/treemap';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TreeMapNode {
  name: string;
  code?: string;
  color?: string;
  value?: number;
  certificateCount?: number;
  complianceRate?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  children?: TreeMapNode[];
}

interface TransformedNode extends TreeMapNode {
  id?: string;
  displayValue: number;
}

interface ComplianceTreeMapProps {
  onNodeClick?: (node: TreeMapNode) => void;
  groupBy?: 'stream' | 'scheme';
  height?: number;
}

const riskColors = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

const getRiskColor = (riskLevel?: string) => {
  return riskColors[riskLevel as keyof typeof riskColors] || '#6b7280';
};

const BASE_SIZE = 100;

function CustomNode({ node, onMouseEnter, onMouseLeave, onClick, index = 0 }: { 
  node: any;
  onMouseEnter?: (node: any) => void;
  onMouseLeave?: (node: any) => void;
  onClick?: (node: any) => void;
  index?: number;
}) {
  const { x, y, width, height, color, data } = node;
  
  if (width < 4 || height < 4) return null;
  
  const displayValue = data.displayValue ?? 0;
  const name = data.name || '';
  
  const formatValue = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };
  
  const truncateName = (n: string, maxLen: number) => {
    if (n.length <= maxLen) return n;
    if (maxLen <= 3) return n.substring(0, 2);
    return n.substring(0, maxLen - 2) + '..';
  };
  
  const getInitials = (n: string) => {
    return n.split(/[\s&]+/).map(w => w[0]).join('').substring(0, 3).toUpperCase();
  };
  
  const fontSize = Math.max(8, Math.min(12, Math.floor(width / 10)));
  const maxChars = Math.max(2, Math.floor(width / (fontSize * 0.7)));
  
  const canFitFullLabel = width > 100 && height > 35;
  const canFitName = width > 50 && height > 18;
  const canFitInitials = width > 20 && height > 14;
  
  let labelContent = '';
  if (canFitFullLabel) {
    labelContent = `${truncateName(name, maxChars)} (${formatValue(displayValue)})`;
  } else if (canFitName) {
    labelContent = truncateName(name, maxChars);
  } else if (canFitInitials) {
    labelContent = getInitials(name);
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(node);
  };
  
  const nodeIndex = node.data?.index ?? index;
  const animationDelay = `${nodeIndex * 0.05}s`;
  
  return (
    <g 
      style={{ 
        cursor: 'pointer', 
        pointerEvents: 'auto',
        animation: 'treemapNodeFadeIn 0.4s ease-out forwards',
        animationDelay,
        opacity: 0,
        transform: 'scale(0.9)',
        transformOrigin: `${x + width/2}px ${y + height/2}px`
      }}
      onClick={handleClick}
      onMouseEnter={() => onMouseEnter?.(node)}
      onMouseLeave={() => onMouseLeave?.(node)}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={2}
        rx={2}
        style={{
          transition: 'transform 0.2s ease, filter 0.2s ease',
        }}
        className="hover:brightness-110"
      />
      {labelContent && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight={500}
          style={{ pointerEvents: 'none' }}
        >
          {labelContent}
        </text>
      )}
    </g>
  );
}

export function ComplianceTreeMap({ 
  onNodeClick, 
  groupBy = 'stream',
  height = 500 
}: ComplianceTreeMapProps) {
  const { data, isLoading, error } = useQuery<TreeMapNode>({
    queryKey: ['/api/analytics/treemap', groupBy],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/treemap?groupBy=${groupBy}`);
      if (!res.ok) throw new Error('Failed to fetch treemap data');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div data-testid="treemap-loading" style={{ height }}>
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div data-testid="treemap-error" className="flex items-center justify-center gap-2 text-destructive" style={{ height }}>
        <AlertCircle className="h-4 w-4" />
        <span>Failed to load visualization</span>
      </div>
    );
  }

  const transformedData = {
    name: 'Portfolio',
    code: 'PORTFOLIO',
    children: data.children?.map((child, idx) => {
      const actualValue = child.value ?? 0;
      const sizeBoost = actualValue > 0 ? Math.log10(actualValue + 1) * 50 : 0;
      return {
        ...child,
        id: child.code || `stream-${idx}`,
        displayValue: actualValue,
        value: BASE_SIZE + sizeBoost,
        index: idx,
      } as TransformedNode;
    }) || []
  };

  return (
    <div data-testid="treemap-container">
        <style>{`
          @keyframes treemapNodeFadeIn {
            from {
              opacity: 0;
              transform: scale(0.85);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
        <div style={{ height }} data-testid="treemap-chart">
          <ResponsiveTreeMap
            data={transformedData}
            identity={(node: any) => node.id || node.code || node.name}
            value="value"
            tile="squarify"
            leavesOnly={true}
            innerPadding={3}
            outerPadding={3}
            enableParentLabel={false}
            nodeComponent={(props) => (
              <CustomNode 
                {...props} 
                onClick={(node) => {
                  if (onNodeClick && node.data) {
                    onNodeClick(node.data as TreeMapNode);
                  }
                }}
              />
            )}
            colors={(node) => {
              const riskLevel = (node.data as TreeMapNode).riskLevel;
              return getRiskColor(riskLevel);
            }}
            animate={true}
            motionConfig="gentle"
            onClick={(node) => {
              if (onNodeClick && node.data) {
                onNodeClick(node.data as TreeMapNode);
              }
            }}
            tooltip={({ node }) => {
              const nodeData = node.data as TransformedNode;
              const displayValue = nodeData.displayValue ?? 0;
              return (
                <div className="bg-background border rounded-lg shadow-lg p-3 text-sm" data-testid="treemap-tooltip">
                  <div className="font-semibold">{nodeData.name}</div>
                  <div className="text-muted-foreground mt-1">
                    <div>Properties: {displayValue.toLocaleString()}</div>
                    {nodeData.complianceRate !== undefined && (
                      <div className="flex items-center gap-1">
                        Compliance: {nodeData.complianceRate}%
                        {nodeData.complianceRate >= 90 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : nodeData.complianceRate >= 70 ? (
                          <Minus className="h-3 w-3 text-amber-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    )}
                    {nodeData.riskLevel && (
                      <Badge 
                        variant={nodeData.riskLevel === 'HIGH' ? 'destructive' : nodeData.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}
                        className="mt-1"
                      >
                        {nodeData.riskLevel} Risk
                      </Badge>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
    </div>
  );
}

export default ComplianceTreeMap;
