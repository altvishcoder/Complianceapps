import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, HeatmapLayer, MapSkeleton } from '@/components/maps';
import type { HeatmapCell } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getIcon } from '@/config/icons';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

const RefreshCcw = getIcon('RefreshCcw');
const Flame = getIcon('Flame');

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from') || params.has('stream') || params.has('level');
}

type GridResolution = 'coarse' | 'medium' | 'fine';

interface HeatmapResponse {
  cells: HeatmapCell[];
  cellSize: { latStep: number; lngStep: number };
  stats: { totalCells: number; totalProperties: number; avgRisk: number };
}

export default function RiskHeatmapPage() {
  const [resolution, setResolution] = useState<GridResolution>('medium');
  const showBackButton = useMemo(() => hasUrlFilters(), []);

  const gridSizeMap = { coarse: 30, medium: 50, fine: 80 };
  
  const { data, isLoading, refetch } = useQuery<HeatmapResponse>({
    queryKey: ['heatmap-data', resolution],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch(`/api/properties/geo/heatmap?gridSize=${gridSizeMap[resolution]}`, {
        headers: { 'X-User-Id': userId || '' },
        cache: 'no-store'
      });
      if (!res.ok) return { cells: [], cellSize: { latStep: 0, lngStep: 0 }, stats: { totalCells: 0, totalProperties: 0, avgRisk: 0 } };
      return res.json();
    },
    staleTime: 30000,
  });

  const cells = data?.cells || [];
  const cellSize = data?.cellSize || { latStep: 0, lngStep: 0 };
  const stats = data?.stats || { totalCells: 0, totalProperties: 0, avgRisk: 0 };

  const riskBreakdown = useMemo(() => {
    const highRisk = cells.filter(c => c.avgRisk < 60).reduce((sum, c) => sum + c.count, 0);
    const mediumRisk = cells.filter(c => c.avgRisk >= 60 && c.avgRisk < 85).reduce((sum, c) => sum + c.count, 0);
    const lowRisk = cells.filter(c => c.avgRisk >= 85).reduce((sum, c) => sum + c.count, 0);
    return { highRisk, mediumRisk, lowRisk };
  }, [cells]);

  const mapCenter = useMemo(() => {
    if (cells.length === 0) return [52.5, -1.5] as [number, number];
    return [
      cells.reduce((sum, c) => sum + c.lat, 0) / cells.length,
      cells.reduce((sum, c) => sum + c.lng, 0) / cells.length
    ] as [number, number];
  }, [cells]);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Risk Hotspot Heatmap" />
        <main id="main-content" className="flex-1 overflow-auto flex flex-col" role="main" aria-label="Risk heatmap content">
          {showBackButton && (
            <div className="p-4 pb-0">
              <ContextBackButton fallbackPath="/maps" fallbackLabel="Property Risk Map" />
            </div>
          )}
          
          <div className="p-4 flex flex-wrap gap-4 items-center border-b">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Risk Hotspot Heatmap</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="resolution" className="text-sm">Detail level:</Label>
              <Select value={resolution} onValueChange={(v) => setResolution(v as GridResolution)}>
                <SelectTrigger className="w-[110px]" id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coarse">Overview</SelectItem>
                  <SelectItem value="medium">Standard</SelectItem>
                  <SelectItem value="fine">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          <div className="flex-1 flex min-h-[75vh] md:min-h-[600px]">
            <div className="flex-1 relative min-h-[75vh] md:min-h-[600px]">
              {isLoading && cells.length === 0 ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap center={mapCenter} zoom={cells.length > 0 ? 10 : 6}>
                    <HeatmapLayer 
                      cells={cells}
                      cellSize={cellSize}
                    />
                  </BaseMap>
                </MapWrapper>
              )}
              
              <div className="absolute bottom-4 left-4 z-[1000]">
                <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Heat Intensity</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600" />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Low Risk</span>
                      <span>High Risk</span>
                    </div>
                    <div className="pt-2 border-t text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grid cells:</span>
                        <span className="font-medium">{stats.totalCells.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Properties covered:</span>
                        <span className="font-medium">{stats.totalProperties.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg risk score:</span>
                        <span className="font-medium">{stats.avgRisk}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">High risk areas:</span>
                        <span className="font-medium text-destructive">{riskBreakdown.highRisk.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {!isLoading && cells.length === 0 && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-center max-w-xs">
                    <p className="font-medium text-foreground">No data to display</p>
                    <p className="text-muted-foreground">
                      No properties with geo-coordinates found.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
