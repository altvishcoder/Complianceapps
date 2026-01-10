import { ResponsiveTreeMap } from '@nivo/treemap';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TreeMapNode {
  name: string;
  code?: string;
  color?: string;
  value?: number;
  complianceRate?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  children?: TreeMapNode[];
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
      <Card data-testid="treemap-loading">
        <CardHeader>
          <CardTitle>Compliance Overview</CardTitle>
          <CardDescription>Loading visualization...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="treemap-error">
        <CardHeader>
          <CardTitle>Compliance Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load visualization</span>
        </CardContent>
      </Card>
    );
  }

  const totalProperties = data.children?.reduce((sum, child) => sum + (child.value || 0), 0) || 0;
  const avgCompliance = data.children?.length 
    ? Math.round(data.children.reduce((sum, child) => sum + (child.complianceRate || 0), 0) / data.children.length)
    : 0;

  // Apply log scale transformation to make small values visible
  // Ensures all streams are visible regardless of size disparity
  const transformedData = {
    ...data,
    children: data.children?.map(child => ({
      ...child,
      originalValue: child.value,
      value: Math.max(Math.log10((child.value || 1) + 1) * 1000, 300),
    }))
  };

  return (
    <Card data-testid="treemap-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compliance Overview</CardTitle>
            <CardDescription>
              Click on segments to drill down into compliance streams
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold" data-testid="treemap-total-properties">
                {totalProperties.toLocaleString()}
              </div>
              <div className="text-muted-foreground">Properties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" data-testid="treemap-avg-compliance">
                {avgCompliance}%
              </div>
              <div className="text-muted-foreground">Avg Compliance</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Low Risk
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Medium Risk
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            High Risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height }} data-testid="treemap-chart">
          <ResponsiveTreeMap
            data={transformedData}
            identity="name"
            value="value"
            tile="squarify"
            leavesOnly={true}
            valueFormat={() => ''}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            innerPadding={3}
            outerPadding={3}
            labelSkipSize={20}
            orientLabel={false}
            label={(node) => {
              const width = node.width || 0;
              const height = node.height || 0;
              if (width < 50 || height < 25) return '';
              const origVal = (node.data as any).originalValue || node.value;
              const formatted = origVal >= 1000 ? `${(origVal/1000).toFixed(0)}k` : String(Math.round(origVal));
              const maxChars = Math.max(5, Math.floor(width / 8));
              const name = node.id.length > maxChars ? node.id.substring(0, maxChars - 2) + '..' : node.id;
              return width < 100 ? `${formatted}` : `${name} (${formatted})`;
            }}
            labelTextColor="#ffffff"
            enableParentLabel={false}
            colors={(node) => {
              const riskLevel = (node.data as TreeMapNode).riskLevel;
              return getRiskColor(riskLevel);
            }}
            borderWidth={2}
            borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
            nodeOpacity={0.85}
            animate={true}
            motionConfig="gentle"
            onClick={(node) => {
              if (onNodeClick && node.data) {
                onNodeClick(node.data as TreeMapNode);
              }
            }}
            tooltip={({ node }) => {
              const nodeData = node.data as TreeMapNode & { originalValue?: number };
              const displayValue = nodeData.originalValue ?? nodeData.value ?? 0;
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
      </CardContent>
    </Card>
  );
}

export default ComplianceTreeMap;
