import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveTreeMap } from '@nivo/treemap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export type ChartType = 'bar' | 'line' | 'pie' | 'treemap';

export interface ChartConfig {
  type: ChartType;
  title: string;
  description?: string;
  height?: number;
  colors?: string[];
  xKey?: string;
  yKey?: string;
  valueKey?: string;
  labelKey?: string;
  showLegend?: boolean;
  animate?: boolean;
}

interface ConfigurableChartProps {
  config: ChartConfig;
  data: any;
  isLoading?: boolean;
  error?: Error | null;
  onNodeClick?: (node: any) => void;
  className?: string;
}

const defaultColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function ConfigurableChart({
  config,
  data,
  isLoading = false,
  error = null,
  onNodeClick,
  className,
}: ConfigurableChartProps) {
  const {
    type,
    title,
    description,
    height = 300,
    colors = defaultColors,
    xKey = 'name',
    yKey = 'value',
    valueKey = 'value',
    labelKey = 'name',
    showLegend = true,
    animate = true,
  } = config;

  if (isLoading) {
    return (
      <Card className={className} data-testid={`chart-loading-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid={`chart-error-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load chart data</span>
        </CardContent>
      </Card>
    );
  }

  const chartId = title.toLowerCase().replace(/\s+/g, '-');

  const renderChart = () => {
    switch (type) {
      case 'bar':
        const barData = (data || []).slice(0, 8);
        const isCompact = height < 250;
        return (
          <ResponsiveBar
            data={barData}
            keys={[valueKey]}
            indexBy={labelKey}
            margin={isCompact 
              ? { top: 10, right: 10, bottom: 60, left: 50 }
              : { top: 20, right: 20, bottom: 60, left: 60 }
            }
            padding={0.4}
            colors={(d) => (d.data as any).color || colors[barData.indexOf(d.data) % colors.length]}
            borderRadius={2}
            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 5,
              tickRotation: -45,
              truncateTickAt: 12,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 5,
              tickRotation: 0,
              format: (v) => v >= 1000 ? `${(v as number / 1000).toFixed(0)}k` : String(v),
            }}
            enableLabel={!isCompact}
            labelSkipWidth={20}
            labelSkipHeight={20}
            labelTextColor="#ffffff"
            enableGridY={true}
            gridYValues={4}
            theme={{
              grid: { line: { stroke: '#e5e7eb', strokeWidth: 1 } },
              axis: { ticks: { text: { fontSize: isCompact ? 10 : 11 } } },
            }}
            animate={animate}
            onClick={(node) => onNodeClick?.(node)}
          />
        );

      case 'line':
        const lineRawData = (data || []).slice(0, 10);
        const lineData = Array.isArray(lineRawData) && lineRawData.length > 0 && !lineRawData[0].data
          ? [{ id: title || 'Series', data: lineRawData.map((d: any) => ({ x: d[labelKey], y: d[valueKey] })) }]
          : lineRawData;
        const isLineCompact = height < 250;
        
        return (
          <ResponsiveLine
            data={lineData}
            margin={isLineCompact 
              ? { top: 10, right: 10, bottom: 60, left: 50 }
              : { top: 20, right: 20, bottom: 60, left: 60 }
            }
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 5,
              tickRotation: -45,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 5,
              tickRotation: 0,
              format: (v) => v >= 1000 ? `${(v as number / 1000).toFixed(0)}k` : String(v),
            }}
            colors={colors}
            pointSize={isLineCompact ? 6 : 8}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            enableArea={true}
            areaOpacity={0.1}
            useMesh={true}
            enableGridX={false}
            theme={{
              grid: { line: { stroke: '#e5e7eb', strokeWidth: 1 } },
              axis: { ticks: { text: { fontSize: isLineCompact ? 10 : 11 } } },
            }}
            animate={animate}
            onClick={(point) => onNodeClick?.(point)}
          />
        );

      case 'pie':
        const pieData = (data || []).map((d: any, i: number) => ({
          id: d[labelKey] || `Item ${i}`,
          label: d[labelKey] || `Item ${i}`,
          value: d[valueKey] || 0,
          color: colors[i % colors.length],
        }));
        
        return (
          <ResponsivePie
            data={pieData}
            margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            colors={colors}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="#666"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: 'color' }}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
            legends={showLegend ? [
              {
                anchor: 'right',
                direction: 'column',
                translateX: 70,
                translateY: 0,
                itemWidth: 60,
                itemHeight: 18,
                symbolSize: 12,
                symbolShape: 'circle',
              }
            ] : []}
            animate={animate}
            onClick={(node) => onNodeClick?.(node)}
          />
        );

      case 'treemap':
        return (
          <ResponsiveTreeMap
            data={data || { name: 'root', children: [] }}
            identity="name"
            value={valueKey}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
            labelSkipSize={40}
            labelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
            parentLabelPosition="left"
            parentLabelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
            colors={colors}
            borderWidth={2}
            borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
            animate={animate}
            onClick={(node) => onNodeClick?.(node)}
          />
        );

      default:
        return <div>Unsupported chart type: {type}</div>;
    }
  };

  return (
    <Card className={className} data-testid={`chart-${chartId}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height }} data-testid={`chart-content-${chartId}`}>
          {renderChart()}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConfigurableChart;
