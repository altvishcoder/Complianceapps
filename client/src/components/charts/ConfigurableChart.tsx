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
        return (
          <ResponsiveBar
            data={data || []}
            keys={[yKey]}
            indexBy={xKey}
            margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
            padding={0.3}
            colors={colors}
            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: '',
              legendPosition: 'middle',
              legendOffset: 40,
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendPosition: 'middle',
              legendOffset: -50,
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            legends={showLegend ? [
              {
                dataFrom: 'keys',
                anchor: 'top-right',
                direction: 'column',
                translateX: 0,
                translateY: -20,
                itemWidth: 80,
                itemHeight: 20,
                symbolSize: 12,
              }
            ] : []}
            animate={animate}
            onClick={(node) => onNodeClick?.(node)}
          />
        );

      case 'line':
        const lineData = Array.isArray(data) && data.length > 0 && !data[0].data
          ? [{ id: title, data: data.map((d: any) => ({ x: d[xKey], y: d[yKey] })) }]
          : data || [];
        
        return (
          <ResponsiveLine
            data={lineData}
            margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
            }}
            colors={colors}
            pointSize={8}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            pointLabelYOffset={-12}
            useMesh={true}
            legends={showLegend ? [
              {
                anchor: 'top-right',
                direction: 'column',
                translateX: 0,
                translateY: -20,
                itemWidth: 80,
                itemHeight: 20,
                symbolSize: 12,
              }
            ] : []}
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
