import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, HeatSurfaceLayer, MapSkeleton } from '@/components/maps';
import type { HeatPoint } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getIcon } from '@/config/icons';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';
import L from 'leaflet';

const RefreshCcw = getIcon('RefreshCcw');
const Flame = getIcon('Flame');
const MapPin = getIcon('MapPin');
const Building = getIcon('Building');
const AlertTriangle = getIcon('AlertTriangle');
const ZoomIn = getIcon('ZoomIn');
const ZoomOut = getIcon('ZoomOut');
const ArrowLeft = getIcon('ArrowLeft');

interface PropertyInZone {
  id: number;
  uprn: string;
  addressLine1: string;
  postcode: string;
  riskScore: number;
}

interface ZonePropertiesResponse {
  properties: PropertyInZone[];
  total: number;
}

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from') || params.has('stream') || params.has('level');
}

type DrillLevel = 'national' | 'regional' | 'local';

interface HeatmapResponse {
  cells: Array<{ lat: number; lng: number; avgRisk: number; count: number }>;
  cellSize: { latStep: number; lngStep: number };
  stats: { totalCells: number; totalProperties: number; avgRisk: number };
}

interface DrillState {
  level: DrillLevel;
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  center?: { lat: number; lng: number };
}

const drillLevelConfig = {
  national: { gridSize: 15, radius: 50, blur: 35, label: 'National Overview' },
  regional: { gridSize: 40, radius: 35, blur: 25, label: 'Regional View' },
  local: { gridSize: 80, radius: 25, blur: 15, label: 'Local Detail' }
};

export default function RiskHeatmapPage() {
  const [, navigate] = useLocation();
  const [drillState, setDrillState] = useState<DrillState>({ level: 'national' });
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  const mapRef = useRef<L.Map | null>(null);

  const config = drillLevelConfig[drillState.level];
  
  const buildQueryUrl = () => {
    let url = `/api/properties/geo/heatmap?gridSize=${config.gridSize}`;
    if (drillState.bounds) {
      const { minLat, maxLat, minLng, maxLng } = drillState.bounds;
      url += `&minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`;
    }
    return url;
  };
  
  const { data, isLoading, refetch } = useQuery<HeatmapResponse>({
    queryKey: ['heatmap-data', drillState.level, drillState.bounds],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch(buildQueryUrl(), {
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

  const heatPoints: HeatPoint[] = useMemo(() => {
    return cells.map(c => ({
      lat: c.lat,
      lng: c.lng,
      riskScore: c.avgRisk,
      count: c.count
    }));
  }, [cells]);

  const { data: zoneProperties, isLoading: loadingZoneProps } = useQuery<ZonePropertiesResponse>({
    queryKey: ['zone-properties', selectedPoint?.lat, selectedPoint?.lng, drillState.bounds?.minLat],
    queryFn: async () => {
      if (!selectedPoint) return { properties: [], total: 0 };
      const userId = localStorage.getItem('user_id');
      
      let minLat: number, maxLat: number, minLng: number, maxLng: number;
      if (drillState.bounds) {
        const latRange = (drillState.bounds.maxLat - drillState.bounds.minLat) / 4;
        const lngRange = (drillState.bounds.maxLng - drillState.bounds.minLng) / 4;
        minLat = selectedPoint.lat - latRange;
        maxLat = selectedPoint.lat + latRange;
        minLng = selectedPoint.lng - lngRange;
        maxLng = selectedPoint.lng + lngRange;
      } else {
        const spread = 0.2;
        minLat = selectedPoint.lat - spread;
        maxLat = selectedPoint.lat + spread;
        minLng = selectedPoint.lng - spread;
        maxLng = selectedPoint.lng + spread;
      }
      
      const res = await fetch(
        `/api/properties/geo/zone?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&limit=50`,
        { headers: { 'X-User-Id': userId || '' } }
      );
      if (!res.ok) return { properties: [], total: 0 };
      return res.json();
    },
    enabled: !!selectedPoint && drillDownOpen,
    staleTime: 60000,
  });

  const riskBreakdown = useMemo(() => {
    const highRisk = cells.filter(c => c.avgRisk < 60).reduce((sum, c) => sum + c.count, 0);
    const mediumRisk = cells.filter(c => c.avgRisk >= 60 && c.avgRisk < 85).reduce((sum, c) => sum + c.count, 0);
    const lowRisk = cells.filter(c => c.avgRisk >= 85).reduce((sum, c) => sum + c.count, 0);
    return { highRisk, mediumRisk, lowRisk };
  }, [cells]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      if (drillState.level === 'national') {
        const spread = 2;
        setDrillState({
          level: 'regional',
          bounds: { minLat: lat - spread, maxLat: lat + spread, minLng: lng - spread * 1.5, maxLng: lng + spread * 1.5 },
          center: { lat, lng }
        });
        map.flyTo([lat, lng], 8, { duration: 0.8 });
      } else if (drillState.level === 'regional') {
        const spread = 0.5;
        setDrillState({
          level: 'local',
          bounds: { minLat: lat - spread, maxLat: lat + spread, minLng: lng - spread * 1.5, maxLng: lng + spread * 1.5 },
          center: { lat, lng }
        });
        map.flyTo([lat, lng], 11, { duration: 0.8 });
      } else {
        setSelectedPoint({ lat, lng });
        setDrillDownOpen(true);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [drillState.level]);

  const handleBack = useCallback(() => {
    if (drillState.level === 'local') {
      setDrillState({ level: 'regional', bounds: undefined });
      mapRef.current?.flyTo([51.5, -0.1], 9, { duration: 0.6 });
    } else if (drillState.level === 'regional') {
      setDrillState({ level: 'national' });
      mapRef.current?.flyTo([51.5, -0.1], 10, { duration: 0.6 });
    }
  }, [drillState.level]);

  const handleReset = useCallback(() => {
    setDrillState({ level: 'national' });
    mapRef.current?.flyTo([51.5, -0.1], 10, { duration: 0.6 });
  }, []);

  useEffect(() => {
    if (!mapRef.current || cells.length === 0 || cellSize.latStep === 0) return;
    
    if (drillState.level === 'national' && !drillState.bounds) {
      const map = mapRef.current;
      const timeoutId = setTimeout(() => {
        try {
          const minLat = Math.min(...cells.map(c => c.lat));
          const maxLat = Math.max(...cells.map(c => c.lat));
          const minLng = Math.min(...cells.map(c => c.lng));
          const maxLng = Math.max(...cells.map(c => c.lng));
          
          const bounds = L.latLngBounds(
            [minLat - cellSize.latStep, minLng - cellSize.lngStep],
            [maxLat + cellSize.latStep, maxLng + cellSize.lngStep]
          );
          
          if (map && bounds.isValid()) {
            map.fitBounds(bounds, { maxZoom: 7, padding: [20, 20] });
          }
        } catch (e) {
          console.warn('Failed to fit bounds:', e);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [cells, cellSize, drillState.level, drillState.bounds]);

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
          
          <div className="p-4 flex flex-wrap gap-4 items-center border-b relative z-[1500] bg-background">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Risk Hotspot Heatmap</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={drillState.level === 'national' ? 'default' : 'secondary'} className="text-xs">
                {config.label}
              </Badge>
              {drillState.level !== 'national' && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 px-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {drillState.level !== 'national' && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2">
                  Reset
                </Button>
              )}
            </div>
            
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          <div className="flex-1 min-h-[75vh] md:min-h-[600px] relative overflow-hidden">
            <div className="absolute inset-0">
              {isLoading && cells.length === 0 ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap center={[51.5, -0.1]} zoom={10} onMapReady={handleMapReady}>
                    <HeatSurfaceLayer 
                      key={`heat-${drillState.level}-${cells.length}`}
                      points={heatPoints}
                      radius={config.radius}
                      blur={config.blur}
                    />
                  </BaseMap>
                </MapWrapper>
              )}
            </div>
            
            <div className="absolute top-4 right-4 z-[1100] pointer-events-auto">
              <Card className="bg-background/95 backdrop-blur-sm shadow-lg w-48">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    How to use
                  </p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    {drillState.level === 'national' && (
                      <p className="flex items-center gap-1">
                        <ZoomIn className="h-3 w-3" />
                        Click a hotspot to zoom in
                      </p>
                    )}
                    {drillState.level === 'regional' && (
                      <p className="flex items-center gap-1">
                        <ZoomIn className="h-3 w-3" />
                        Click again for local detail
                      </p>
                    )}
                    {drillState.level === 'local' && (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Click to see properties
                      </p>
                    )}
                    {drillState.level !== 'national' && (
                      <p className="flex items-center gap-1">
                        <ZoomOut className="h-3 w-3" />
                        Use Back to zoom out
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="absolute bottom-4 left-4 z-[1100] pointer-events-auto">
              <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Risk Intensity
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {stats.totalCells} zones
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low Risk</span>
                    <span>High Risk</span>
                  </div>
                  <div className="pt-2 border-t text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Properties:</span>
                      <span className="font-medium">{stats.totalProperties.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg risk:</span>
                      <span className="font-medium">{stats.avgRisk}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-red-600">High risk:</span>
                      <span className="font-medium text-red-600">{riskBreakdown.highRisk.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-amber-600">Medium:</span>
                      <span className="font-medium text-amber-600">{riskBreakdown.mediumRisk.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-green-600">Low risk:</span>
                      <span className="font-medium text-green-600">{riskBreakdown.lowRisk.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {!isLoading && cells.length === 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1100] pointer-events-none">
                <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-center max-w-xs">
                  <p className="font-medium text-foreground">No data to display</p>
                  <p className="text-muted-foreground">
                    No properties with geo-coordinates found.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] z-[1300]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Properties in Area
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                Showing properties near the selected location
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh]">
            {loadingZoneProps ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : zoneProperties?.properties && zoneProperties.properties.length > 0 ? (
              <div className="space-y-2">
                {zoneProperties.properties.map((prop) => (
                  <div
                    key={prop.id}
                    onClick={() => {
                      setDrillDownOpen(false);
                      navigate(`/properties/${prop.id}`);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setDrillDownOpen(false);
                        navigate(`/properties/${prop.id}`);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Card className="overflow-hidden hover:bg-muted/50 active:bg-muted transition-colors border-2 hover:border-primary/50">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium text-sm truncate text-foreground">{prop.addressLine1}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{prop.postcode}</span>
                              {prop.uprn && (
                                <>
                                  <span>•</span>
                                  <span>UPRN: {prop.uprn}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant={prop.riskScore < 60 ? 'destructive' : prop.riskScore < 85 ? 'secondary' : 'outline'}
                            className="flex-shrink-0"
                          >
                            {prop.riskScore}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {zoneProperties.total > zoneProperties.properties.length && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Showing {zoneProperties.properties.length} of {zoneProperties.total.toLocaleString()} properties
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="text-sm">No properties found in this area</p>
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrillDownOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
