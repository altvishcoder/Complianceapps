import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, HeatmapLayer, MapSkeleton } from '@/components/maps';
import type { HeatmapPoint } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getIcon, getActionIcon } from '@/config/icons';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

const RefreshCcw = getIcon('RefreshCcw');
const Flame = getIcon('Flame');

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from') || params.has('stream') || params.has('level');
}

type HeatmapIntensity = 'low' | 'medium' | 'high';

export default function RiskHeatmapPage() {
  const [intensity, setIntensity] = useState<HeatmapIntensity>('medium');
  const [showOnlyHighRisk, setShowOnlyHighRisk] = useState(false);
  const showBackButton = useMemo(() => hasUrlFilters(), []);

  const radiusMap = { low: 15, medium: 25, high: 40 };
  const blurMap = { low: 10, medium: 15, high: 25 };
  
  const { data: properties = [], isLoading, refetch } = useQuery({
    queryKey: ['heatmap-properties'],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch('/api/properties/geo', {
        headers: { 'X-User-Id': userId || '' },
        cache: 'no-store'
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const heatmapPoints: HeatmapPoint[] = useMemo(() => {
    let filtered = properties;
    if (showOnlyHighRisk) {
      filtered = properties.filter((p: any) => p.riskScore < 70);
    }
    return filtered
      .filter((p: any) => typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng))
      .map((p: any) => ({
        lat: p.lat,
        lng: p.lng,
        intensity: p.riskScore || 75
      }));
  }, [properties, showOnlyHighRisk]);

  const riskStats = useMemo(() => {
    const total = properties.length;
    const highRisk = properties.filter((p: any) => p.riskScore < 60).length;
    const mediumRisk = properties.filter((p: any) => p.riskScore >= 60 && p.riskScore < 85).length;
    const lowRisk = properties.filter((p: any) => p.riskScore >= 85).length;
    const avgScore = total > 0 
      ? Math.round(properties.reduce((sum: number, p: any) => sum + (p.riskScore || 75), 0) / total)
      : 0;
    return { total, highRisk, mediumRisk, lowRisk, avgScore };
  }, [properties]);

  const mapCenter = useMemo(() => {
    const validPoints = heatmapPoints.filter(p => 
      typeof p.lat === 'number' && !isNaN(p.lat) &&
      typeof p.lng === 'number' && !isNaN(p.lng)
    );
    if (validPoints.length === 0) return [52.5, -1.5] as [number, number];
    return [
      validPoints.reduce((sum, p) => sum + p.lat, 0) / validPoints.length,
      validPoints.reduce((sum, p) => sum + p.lng, 0) / validPoints.length
    ] as [number, number];
  }, [heatmapPoints]);

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
              <Label htmlFor="intensity" className="text-sm">Intensity:</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as HeatmapIntensity)}>
                <SelectTrigger className="w-[100px]" id="intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="high-risk-only"
                checked={showOnlyHighRisk}
                onCheckedChange={setShowOnlyHighRisk}
              />
              <Label htmlFor="high-risk-only" className="text-sm">High risk only</Label>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          <div className="flex-1 flex min-h-[75vh] md:min-h-[600px]">
            <div className="flex-1 relative min-h-[75vh] md:min-h-[600px]">
              {isLoading && properties.length === 0 ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap center={mapCenter} zoom={heatmapPoints.length > 0 ? 10 : 6}>
                    <HeatmapLayer 
                      points={heatmapPoints}
                      radius={radiusMap[intensity]}
                      blur={blurMap[intensity]}
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
                        <span className="text-muted-foreground">Properties shown:</span>
                        <span className="font-medium">{heatmapPoints.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">High risk areas:</span>
                        <span className="font-medium text-destructive">{riskStats.highRisk.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {!isLoading && heatmapPoints.length === 0 && (
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
