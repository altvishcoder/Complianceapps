import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Save,
  Download,
  Settings,
  Trash2,
  Move,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Grid3X3,
  Table,
  Activity,
  Gauge,
  Clock,
  LayoutGrid,
  GripVertical,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { ConfigurableChart } from '@/components/charts/ConfigurableChart';
import { ComplianceTreeMap } from '@/components/analytics/ComplianceTreeMap';
import { cn } from '@/lib/utils';

type WidgetType = 'BAR_CHART' | 'LINE_CHART' | 'PIE_CHART' | 'TREEMAP' | 'TABLE' | 'STAT_CARD' | 'GAUGE' | 'HEATMAP' | 'TIMELINE';

interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  config?: {
    groupBy?: string;
    colorField?: string;
    valueField?: string;
    labelField?: string;
    showLegend?: boolean;
    maxItems?: number;
  };
}

interface Canvas {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  gridCols: number;
  gridRows: number;
}

const WIDGET_TYPES = [
  { type: 'BAR_CHART' as WidgetType, label: 'Bar Chart', icon: BarChart3, color: 'bg-blue-500' },
  { type: 'LINE_CHART' as WidgetType, label: 'Line Chart', icon: TrendingUp, color: 'bg-green-500' },
  { type: 'PIE_CHART' as WidgetType, label: 'Pie Chart', icon: PieChartIcon, color: 'bg-purple-500' },
  { type: 'TREEMAP' as WidgetType, label: 'TreeMap', icon: Grid3X3, color: 'bg-amber-500' },
  { type: 'TABLE' as WidgetType, label: 'Data Table', icon: Table, color: 'bg-slate-500' },
  { type: 'STAT_CARD' as WidgetType, label: 'Stat Card', icon: Activity, color: 'bg-cyan-500' },
  { type: 'GAUGE' as WidgetType, label: 'Gauge', icon: Gauge, color: 'bg-red-500' },
  { type: 'TIMELINE' as WidgetType, label: 'Timeline', icon: Clock, color: 'bg-pink-500' },
];

interface DataSourceDef {
  id: string;
  label: string;
  endpoint: string;
  transform: (data: any) => { name: string; value: number; color?: string }[];
  statExtractor?: (data: any) => { value: number | string; label: string };
}

const DATA_SOURCES: DataSourceDef[] = [
  { 
    id: 'compliance-by-stream', 
    label: 'Compliance by Stream', 
    endpoint: '/api/analytics/hierarchy?level=stream',
    transform: (data) => {
      const items = data?.data || data || [];
      return items.map((item: any) => ({
        name: item.stream || item.name || 'Unknown',
        value: item.totalProperties || item.propertyCount || item.value || 0,
        color: item.riskLevel === 'HIGH' ? '#ef4444' : item.riskLevel === 'MEDIUM' ? '#f59e0b' : '#22c55e'
      }));
    },
    statExtractor: (data) => {
      const items = data?.data || data || [];
      const total = items.reduce((sum: number, item: any) => sum + (item.totalProperties || 0), 0);
      return { value: total, label: 'Properties by Stream' };
    }
  },
  { 
    id: 'compliance-by-scheme', 
    label: 'Compliance by Scheme', 
    endpoint: '/api/analytics/hierarchy?level=scheme',
    transform: (data) => {
      const items = data?.data || data || [];
      return items.map((item: any) => ({
        name: item.scheme || item.name || 'Unknown',
        value: item.totalProperties || item.propertyCount || item.value || 0,
        color: item.riskLevel === 'HIGH' ? '#ef4444' : item.riskLevel === 'MEDIUM' ? '#f59e0b' : '#22c55e'
      }));
    },
    statExtractor: (data) => {
      const items = data?.data || data || [];
      return { value: items.length, label: 'Total Schemes' };
    }
  },
  { 
    id: 'certificates-status', 
    label: 'Certificate Status', 
    endpoint: '/api/dashboard/stats',
    transform: (data) => {
      if (!data) return [];
      return [
        { name: 'Valid', value: data.validCertificates || 0, color: '#22c55e' },
        { name: 'Expiring Soon', value: data.expiringSoon || 0, color: '#f59e0b' },
        { name: 'Expired', value: data.expiredCertificates || 0, color: '#ef4444' },
      ].filter(item => item.value > 0);
    },
    statExtractor: (data) => ({ value: data?.totalCertificates || 0, label: 'Total Certificates' })
  },
  { 
    id: 'remedial-actions', 
    label: 'Remedial Actions', 
    endpoint: '/api/remedial-actions?limit=100',
    transform: (data) => {
      const items = Array.isArray(data) ? data : data?.data || [];
      const grouped: Record<string, number> = {};
      items.forEach((item: any) => {
        const status = item.status || 'Unknown';
        grouped[status] = (grouped[status] || 0) + 1;
      });
      return Object.entries(grouped).map(([name, value]) => ({
        name,
        value,
        color: name === 'OPEN' ? '#ef4444' : name === 'IN_PROGRESS' ? '#f59e0b' : '#22c55e'
      }));
    },
    statExtractor: (data) => {
      const items = Array.isArray(data) ? data : data?.data || [];
      const open = items.filter((i: any) => i.status === 'OPEN').length;
      return { value: open, label: 'Open Actions' };
    }
  },
  { 
    id: 'expiry-calendar', 
    label: 'Certificate Expiry', 
    endpoint: '/api/certificates/expiring?days=90',
    transform: (data) => {
      const items = Array.isArray(data) ? data : data?.data || [];
      const grouped: Record<string, number> = {};
      items.forEach((item: any) => {
        const type = item.certificateType || item.type || 'Other';
        grouped[type] = (grouped[type] || 0) + 1;
      });
      return Object.entries(grouped).slice(0, 10).map(([name, value]) => ({
        name,
        value,
        color: '#f59e0b'
      }));
    },
    statExtractor: (data) => {
      const items = Array.isArray(data) ? data : data?.data || [];
      return { value: items.length, label: 'Expiring Soon' };
    }
  },
  { 
    id: 'properties-overview', 
    label: 'Properties Overview', 
    endpoint: '/api/dashboard/stats',
    transform: (data) => {
      if (!data) return [];
      return [
        { name: 'Total Properties', value: data.totalProperties || 0, color: '#3b82f6' },
        { name: 'With Certificates', value: data.propertiesWithCertificates || 0, color: '#22c55e' },
        { name: 'Needing Attention', value: data.propertiesNeedingAttention || 0, color: '#ef4444' },
      ].filter(item => item.value > 0);
    },
    statExtractor: (data) => ({ value: data?.totalProperties || 0, label: 'Total Properties' })
  },
  { 
    id: 'compliance-rate', 
    label: 'Compliance Rate', 
    endpoint: '/api/dashboard/stats',
    transform: (data) => {
      const rate = data?.complianceRate || 0;
      return [
        { name: 'Compliant', value: rate, color: '#22c55e' },
        { name: 'Non-Compliant', value: 100 - rate, color: '#ef4444' },
      ];
    },
    statExtractor: (data) => ({ value: `${data?.complianceRate || 0}%`, label: 'Compliance Rate' })
  },
];

const DEFAULT_CANVAS: Canvas = {
  id: 'default',
  name: 'New Report Canvas',
  description: 'Drag and drop widgets to build your custom report',
  widgets: [],
  gridCols: 12,
  gridRows: 8,
};

function WidgetRenderer({ widget, onRemove, onConfigure }: { 
  widget: WidgetConfig; 
  onRemove: () => void;
  onConfigure: () => void;
}) {
  const widgetDef = WIDGET_TYPES.find(w => w.type === widget.type);
  const Icon = widgetDef?.icon || BarChart3;

  return (
    <Card 
      className="h-full relative group"
      data-testid={`canvas-widget-${widget.id}`}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onConfigure}>
          <Settings className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={cn("h-4 w-4", widgetDef?.color?.replace('bg-', 'text-'))} />
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)]">
        {widget.type === 'TREEMAP' ? (
          <div className="h-full">
            <ComplianceTreeMap groupBy="stream" height={200} />
          </div>
        ) : widget.type === 'STAT_CARD' ? (
          <StatCardWidget dataSource={widget.dataSource} />
        ) : (
          <SimpleChartWidget widget={widget} />
        )}
      </CardContent>
    </Card>
  );
}

function StatCardWidget({ dataSource }: { dataSource: string }) {
  const dataSourceConfig = DATA_SOURCES.find(ds => ds.id === dataSource);
  
  const { data, isLoading } = useQuery({
    queryKey: [dataSourceConfig?.endpoint || '/api/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch(dataSourceConfig?.endpoint || '/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Skeleton className="h-10 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  const stat = dataSourceConfig?.statExtractor?.(data) || { value: 0, label: 'Value' };

  return (
    <div className="flex flex-col items-center justify-center h-full" data-testid="stat-card-widget">
      <p className="text-4xl font-bold text-primary">
        {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
      </p>
      <p className="text-sm text-muted-foreground">{stat.label}</p>
    </div>
  );
}

function SimpleChartWidget({ widget }: { widget: WidgetConfig }) {
  const dataSourceConfig = DATA_SOURCES.find(ds => ds.id === widget.dataSource);
  
  const { data, isLoading, error } = useQuery({
    queryKey: [dataSourceConfig?.endpoint || '/api/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch(dataSourceConfig?.endpoint || '/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!dataSourceConfig,
  });

  const chartData = dataSourceConfig?.transform(data) || [];

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (error || !chartData.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-xs">No data available</p>
      </div>
    );
  }

  if (widget.type === 'TABLE') {
    return <TableWidget data={chartData} isLoading={isLoading} />;
  }
  
  if (widget.type === 'GAUGE') {
    const value = data?.complianceRate ?? 0;
    return <GaugeWidget value={value} isLoading={isLoading} />;
  }
  
  if (widget.type === 'TIMELINE') {
    return <TimelineWidget data={chartData} isLoading={isLoading} />;
  }
  
  if (widget.type === 'HEATMAP') {
    return <HeatmapWidget data={chartData} isLoading={isLoading} />;
  }

  const chartType: 'bar' | 'line' | 'pie' = 
    widget.type === 'BAR_CHART' ? 'bar' : 
    widget.type === 'LINE_CHART' ? 'line' : 'pie';

  return (
    <ConfigurableChart
      config={{
        type: chartType,
        title: '',
        showLegend: widget.config?.showLegend ?? true,
        valueKey: 'value',
        labelKey: 'name',
        height: 180,
      }}
      data={chartData}
      isLoading={isLoading}
    />
  );
}

function TableWidget({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-full w-full" />;
  if (!data?.length) return <p className="text-muted-foreground text-center py-4">No data</p>;
  
  const columns = Object.keys(data[0] || {}).filter(k => !['id', 'color', 'icon'].includes(k)).slice(0, 5);
  
  return (
    <div className="overflow-auto max-h-[180px]" data-testid="table-widget">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            {columns.map(col => (
              <th key={col} className="text-left p-1 font-medium capitalize">{col.replace(/([A-Z])/g, ' $1')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {columns.map(col => (
                <td key={col} className="p-1 truncate max-w-[100px]">
                  {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GaugeWidget({ value, isLoading }: { value: number; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-full w-full" />;
  
  const percentage = Math.min(100, Math.max(0, value));
  const color = percentage >= 90 ? 'text-green-500' : percentage >= 70 ? 'text-amber-500' : 'text-red-500';
  
  return (
    <div className="flex flex-col items-center justify-center h-full" data-testid="gauge-widget">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
          <circle 
            cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" 
            className={color}
            strokeDasharray={`${percentage * 2.51} 251`} 
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${color}`}>
          {percentage}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Compliance Rate</p>
    </div>
  );
}

function TimelineWidget({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-full w-full" />;
  if (!data?.length) return <p className="text-muted-foreground text-center py-4">No data</p>;
  
  return (
    <div className="space-y-2 overflow-auto max-h-[180px] pr-2" data-testid="timeline-widget">
      {data.slice(0, 6).map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{item.name || item.title || `Item ${i + 1}`}</p>
            <p className="text-muted-foreground truncate">{item.description || `Value: ${item.value || item.complianceRate || 'N/A'}`}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapWidget({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-full w-full" />;
  if (!data?.length) return <p className="text-muted-foreground text-center py-4">No data</p>;
  
  return (
    <div className="grid grid-cols-4 gap-1 h-full p-2" data-testid="heatmap-widget">
      {data.slice(0, 12).map((item, i) => {
        const rate = item.complianceRate ?? item.value ?? 50;
        const bgColor = rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500';
        return (
          <div 
            key={i} 
            className={cn("rounded flex items-center justify-center text-white text-[10px] font-medium", bgColor)}
            title={item.name || `Cell ${i + 1}`}
          >
            {rate}%
          </div>
        );
      })}
    </div>
  );
}

const STORAGE_KEY = 'socialcomply-report-canvas';

export default function ReportCanvasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [canvas, setCanvas] = useState<Canvas>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_CANVAS;
        }
      }
    }
    return DEFAULT_CANVAS;
  });
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [newWidget, setNewWidget] = useState<Partial<WidgetConfig>>({
    type: 'BAR_CHART',
    title: '',
    dataSource: 'compliance-by-stream',
    gridX: 0,
    gridY: 0,
    gridW: 4,
    gridH: 4,
  });
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

  const handleAddWidget = useCallback(() => {
    if (!newWidget.title || !newWidget.type || !newWidget.dataSource) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    const widget: WidgetConfig = {
      id: crypto.randomUUID(),
      type: newWidget.type as WidgetType,
      title: newWidget.title,
      dataSource: newWidget.dataSource,
      gridX: canvas.widgets.length % 3 * 4,
      gridY: Math.floor(canvas.widgets.length / 3) * 4,
      gridW: 4,
      gridH: 4,
      config: newWidget.config,
    };

    setCanvas(prev => ({
      ...prev,
      widgets: [...prev.widgets, widget],
    }));

    setNewWidget({
      type: 'BAR_CHART',
      title: '',
      dataSource: 'compliance-by-stream',
      gridX: 0,
      gridY: 0,
      gridW: 4,
      gridH: 4,
    });
    setIsAddingWidget(false);
    toast({ title: 'Widget added', description: `${widget.title} has been added to your canvas` });
  }, [newWidget, canvas.widgets.length, toast]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setCanvas(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
    }));
    toast({ title: 'Widget removed', description: 'Widget has been removed from your canvas' });
  }, [toast]);

  const handleSaveCanvas = useCallback(async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(canvas));
      toast({ 
        title: 'Canvas saved', 
        description: `${canvas.name} has been saved to your browser` 
      });
    } catch (error) {
      toast({ 
        title: 'Save failed', 
        description: 'Could not save canvas to browser storage', 
        variant: 'destructive' 
      });
    }
  }, [canvas, toast]);

  const handleExportCanvas = useCallback(() => {
    const json = JSON.stringify(canvas, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${canvas.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Canvas configuration exported as JSON' });
  }, [canvas, toast]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Report Canvas" />
        <main className="flex-1 overflow-y-auto p-6" data-testid="report-canvas-page">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Input
                  value={canvas.name}
                  onChange={(e) => setCanvas(prev => ({ ...prev, name: e.target.value }))}
                  className="text-xl font-semibold bg-transparent border-none px-0 focus-visible:ring-0"
                  data-testid="canvas-name-input"
                />
                <p className="text-sm text-muted-foreground">
                  Drag widgets to arrange your custom compliance report
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-widget-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add Widget</DialogTitle>
                      <DialogDescription>
                        Choose a widget type and configure its data source
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Widget Title</Label>
                        <Input
                          value={newWidget.title || ''}
                          onChange={(e) => setNewWidget(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., Compliance by Stream"
                          data-testid="widget-title-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Widget Type</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {WIDGET_TYPES.map((wt) => {
                            const Icon = wt.icon;
                            return (
                              <button
                                key={wt.type}
                                onClick={() => setNewWidget(prev => ({ ...prev, type: wt.type }))}
                                className={cn(
                                  "flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors",
                                  newWidget.type === wt.type 
                                    ? "border-primary bg-primary/10" 
                                    : "border-border hover:bg-muted"
                                )}
                                data-testid={`widget-type-${wt.type}`}
                              >
                                <Icon className={cn("h-5 w-5", wt.color.replace('bg-', 'text-'))} />
                                <span className="text-xs">{wt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Data Source</Label>
                        <Select
                          value={newWidget.dataSource}
                          onValueChange={(v) => setNewWidget(prev => ({ ...prev, dataSource: v }))}
                        >
                          <SelectTrigger data-testid="data-source-select">
                            <SelectValue placeholder="Select data source" />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_SOURCES.map((ds) => (
                              <SelectItem key={ds.id} value={ds.id}>
                                {ds.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddingWidget(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddWidget} data-testid="confirm-add-widget">
                        Add Widget
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" onClick={handleSaveCanvas} data-testid="save-canvas-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" onClick={handleExportCanvas} data-testid="export-canvas-button">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5" />
                        Canvas
                      </CardTitle>
                      <CardDescription>
                        {canvas.widgets.length} widget{canvas.widgets.length !== 1 ? 's' : ''} added
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries()}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Data
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {canvas.widgets.length === 0 ? (
                    <div 
                      className="border-2 border-dashed rounded-lg p-12 text-center"
                      data-testid="empty-canvas"
                    >
                      <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No widgets yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Click "Add Widget" to start building your custom report
                      </p>
                      <Button onClick={() => setIsAddingWidget(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Widget
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-[280px]"
                      data-testid="canvas-grid"
                    >
                      {canvas.widgets.map((widget) => (
                        <div 
                          key={widget.id} 
                          className={cn(
                            "h-full",
                            widget.type === 'STAT_CARD' && "sm:col-span-1",
                            widget.type === 'TREEMAP' && "sm:col-span-2",
                            widget.type === 'TABLE' && "sm:col-span-2",
                          )}
                        >
                          <WidgetRenderer
                            widget={widget}
                            onRemove={() => handleRemoveWidget(widget.id)}
                            onConfigure={() => setEditingWidget(widget)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="w-64 flex-shrink-0 hidden xl:block">
                <CardHeader>
                  <CardTitle className="text-sm">Widget Library</CardTitle>
                  <CardDescription className="text-xs">
                    Click to add widgets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {WIDGET_TYPES.map((wt) => {
                    const Icon = wt.icon;
                    return (
                      <button
                        key={wt.type}
                        onClick={() => {
                          setNewWidget(prev => ({ 
                            ...prev, 
                            type: wt.type,
                            title: wt.label 
                          }));
                          setIsAddingWidget(true);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                        data-testid={`library-widget-${wt.type}`}
                      >
                        <div className={cn("p-1.5 rounded", wt.color)}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm">{wt.label}</span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Add Templates</CardTitle>
                <CardDescription className="text-xs">
                  Pre-configured widget sets for common reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex-col items-start"
                    onClick={() => {
                      const complianceWidgets: WidgetConfig[] = [
                        { id: crypto.randomUUID(), type: 'PIE_CHART', title: 'Compliance by Stream', dataSource: 'compliance-by-stream', gridX: 0, gridY: 0, gridW: 4, gridH: 4 },
                        { id: crypto.randomUUID(), type: 'BAR_CHART', title: 'Certificate Status', dataSource: 'certificates-status', gridX: 4, gridY: 0, gridW: 4, gridH: 4 },
                        { id: crypto.randomUUID(), type: 'STAT_CARD', title: 'Total Properties', dataSource: 'property-health', gridX: 8, gridY: 0, gridW: 4, gridH: 4 },
                      ];
                      setCanvas(prev => ({
                        ...prev,
                        widgets: [...prev.widgets, ...complianceWidgets],
                      }));
                      toast({ title: 'Template added', description: 'Compliance Overview widgets added' });
                    }}
                    data-testid="template-compliance-overview"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Compliance Overview</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Pie chart, bar chart, and stats for overall compliance
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex-col items-start"
                    onClick={() => {
                      const riskWidgets: WidgetConfig[] = [
                        { id: crypto.randomUUID(), type: 'TREEMAP', title: 'Risk by Stream', dataSource: 'property-health', gridX: 0, gridY: 0, gridW: 6, gridH: 4 },
                        { id: crypto.randomUUID(), type: 'BAR_CHART', title: 'Open Remedial Actions', dataSource: 'remedial-actions', gridX: 6, gridY: 0, gridW: 6, gridH: 4 },
                      ];
                      setCanvas(prev => ({
                        ...prev,
                        widgets: [...prev.widgets, ...riskWidgets],
                      }));
                      toast({ title: 'Template added', description: 'Risk Dashboard widgets added' });
                    }}
                    data-testid="template-risk-dashboard"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Grid3X3 className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Risk Dashboard</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      TreeMap and actions chart for risk monitoring
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex-col items-start"
                    onClick={() => {
                      const expiryWidgets: WidgetConfig[] = [
                        { id: crypto.randomUUID(), type: 'TIMELINE', title: 'Upcoming Expiries', dataSource: 'expiry-calendar', gridX: 0, gridY: 0, gridW: 8, gridH: 4 },
                        { id: crypto.randomUUID(), type: 'PIE_CHART', title: 'Expiry by Stream', dataSource: 'compliance-by-stream', gridX: 8, gridY: 0, gridW: 4, gridH: 4 },
                      ];
                      setCanvas(prev => ({
                        ...prev,
                        widgets: [...prev.widgets, ...expiryWidgets],
                      }));
                      toast({ title: 'Template added', description: 'Expiry Tracker widgets added' });
                    }}
                    data-testid="template-expiry-tracker"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-pink-500" />
                      <span className="font-medium">Expiry Tracker</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Timeline and pie chart for certificate expiries
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
