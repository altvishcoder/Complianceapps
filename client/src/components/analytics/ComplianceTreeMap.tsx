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
  displayValue: number;
  sizeValue: number;
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

const MIN_TILE_SIZE = 500;

function CustomNode({ node }: { node: any }) {
  const { x, y, width, height, color, data } = node;
  
  if (width < 4 || height < 4) return null;
  
  const displayValue = data.displayValue ?? 0;
  const name = data.name || '';
  
  const showFullLabel = width > 120 && height > 40;
  const showNameOnly = !showFullLabel && width > 80 && height > 30;
  const showValueOnly = !showFullLabel && !showNameOnly && width > 40 && height > 20;
  
  const formatValue = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };
  
  const truncateName = (n: string, maxLen: number) => {
    if (n.length <= maxLen) return n;
    return n.substring(0, maxLen - 2) + '..';
  };
  
  const maxNameChars = Math.max(6, Math.floor(width / 9));
  
  return (
    <g style={{ cursor: 'pointer' }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={2}
        rx={2}
      />
      {showFullLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={12}
            fontWeight={600}
          >
            {truncateName(name, maxNameChars)}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={11}
          >
            ({formatValue(displayValue)})
          </text>
        </>
      )}
      {showNameOnly && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={11}
          fontWeight={500}
        >
          {truncateName(name, maxNameChars)}
        </text>
      )}
      {showValueOnly && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={10}
        >
          {formatValue(displayValue)}
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
    children: data.children?.map(child => {
      const actualValue = child.value ?? 0;
      const logScaledSize = actualValue > 0 
        ? Math.log10(actualValue + 1) * 1000 
        : MIN_TILE_SIZE;
      return {
        ...child,
        displayValue: actualValue,
        value: Math.max(logScaledSize, MIN_TILE_SIZE),
      } as TransformedNode;
    }) || []
  };

  return (
    <div data-testid="treemap-container">
        <div style={{ height }} data-testid="treemap-chart">
          <ResponsiveTreeMap
            data={transformedData}
            identity="name"
            value="value"
            tile="squarify"
            leavesOnly={true}
            innerPadding={3}
            outerPadding={3}
            enableParentLabel={false}
            nodeComponent={CustomNode}
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
