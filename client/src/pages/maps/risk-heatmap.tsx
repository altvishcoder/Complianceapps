import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, HeatSurfaceLayer, MapSkeleton, PropertyMarkers } from '@/components/maps';
import type { HeatPoint, PropertyMarker } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getIcon } from '@/config/icons';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';
import { PropertyHomeIcon } from '@/components/icons/SocialComplyLogo';
import { toast } from 'sonner';
import L from 'leaflet';

const RefreshCcw = getIcon('RefreshCcw');
const Flame = getIcon('Flame');
const MapPin = getIcon('MapPin');
const AlertTriangle = getIcon('AlertTriangle');
const ZoomIn = getIcon('ZoomIn');
const ZoomOut = getIcon('ZoomOut');
const ArrowLeft = getIcon('ArrowLeft');
const Building = getIcon('Building');
const Building2 = getIcon('Building2');
const MapPinned = getIcon('MapPinned');
const Home = getIcon('Home');
const Loader2 = getIcon('Loader2');

type AggregationLevel = 'property' | 'block' | 'scheme';

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
  const [aggregationLevel, setAggregationLevel] = useState<AggregationLevel>('property');
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  const mapRef = useRef<L.Map | null>(null);
  const queryClient = useQueryClient();

  const config = drillLevelConfig[drillState.level];
  
  const { data: geocodingStatus } = useQuery({
    queryKey: ['geocoding-status'],
    queryFn: async () => {
      const res = await fetch('/api/geocoding/status');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });
  
  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/geocoding/batch', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to geocode');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Geocoded ${data.updated} properties`);
      queryClient.invalidateQueries({ queryKey: ['property-markers-all'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap-data'] });
      queryClient.invalidateQueries({ queryKey: ['geocoding-status'] });
    },
    onError: () => {
      toast.error('Failed to geocode properties');
    }
  });
  
  const { data: aggregatedAreas = [] } = useQuery({
    queryKey: ['aggregated-areas', aggregationLevel],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const endpoint = aggregationLevel === 'block' 
        ? '/api/blocks/geo'
        : `/api/risk/areas?level=${aggregationLevel}`;
      const res = await fetch(endpoint, {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: aggregationLevel !== 'property',
    staleTime: 30000,
  });
  
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

  const { data: propertyMarkersWithCoords } = useQuery<PropertyMarker[]>({
    queryKey: ['property-markers-all'],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch('/api/properties/geo', {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data
        .filter((p: any) => p.lat && p.lng)
        .map((p: any) => ({
          id: String(p.id),
          name: p.name || 'Property',
          address: p.address,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng),
          riskScore: p.riskScore || 75,
          assetType: 'property' as const
        }));
    },
    staleTime: 60000,
  });
  
  const displayMarkers = useMemo(() => {
    if (aggregationLevel === 'property') {
      return propertyMarkersWithCoords || [];
    }
    return aggregatedAreas.map((area: any) => {
      const propertyCount = area.propertyCount ?? area.riskScore?.propertyCount ?? 0;
      const riskScore = area.riskScore?.compositeScore ?? area.riskScore ?? 75;
      return {
        id: area.id,
        name: area.name,
        address: area.address || `${area.name} (${propertyCount} properties)`,
        lat: parseFloat(area.lat),
        lng: parseFloat(area.lng),
        riskScore: typeof riskScore === 'number' ? riskScore : 75,
        propertyCount,
        assetType: aggregationLevel as 'scheme' | 'block',
      };
    });
  }, [aggregationLevel, propertyMarkersWithCoords, aggregatedAreas]);

  
  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Always show properties popup on click - allows direct access
      setSelectedPoint({ lat, lng });
      setDrillDownOpen(true);
      
      // Also zoom in if not at local level for better context
      if (drillState.level === 'national') {
        const spread = 2;
        setDrillState({
          level: 'regional',
          bounds: { minLat: lat - spread, maxLat: lat + spread, minLng: lng - spread * 1.5, maxLng: lng + spread * 1.5 },
          center: { lat, lng }
        });
        map.flyTo([lat, lng], 10, { duration: 0.8 });
      } else if (drillState.level === 'regional') {
        const spread = 0.5;
        setDrillState({
          level: 'local',
          bounds: { minLat: lat - spread, maxLat: lat + spread, minLng: lng - spread * 1.5, maxLng: lng + spread * 1.5 },
          center: { lat, lng }
        });
        map.flyTo([lat, lng], 13, { duration: 0.8 });
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
        <Header title="Risk Hotspot Map" />
        <main id="main-content" className="flex-1 overflow-auto flex flex-col" role="main" aria-label="Risk heatmap content">
          {showBackButton && (
            <div className="p-4 pb-0">
              <ContextBackButton fallbackPath="/dashboard" fallbackLabel="Dashboard" />
            </div>
          )}
          
          <div className="p-4 flex flex-wrap gap-4 items-center border-b relative z-[1500] bg-background">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Risk Hotspot Map</span>
            </div>
            
            <Select value={aggregationLevel} onValueChange={(v) => setAggregationLevel(v as AggregationLevel)}>
              <SelectTrigger className="w-[130px] h-8" data-testid="select-aggregation-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-[2000]">
                <SelectItem value="property">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Property
                  </div>
                </SelectItem>
                <SelectItem value="block">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Block
                  </div>
                </SelectItem>
                <SelectItem value="scheme">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Scheme
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
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
          
          {geocodingStatus && geocodingStatus.notGeocoded > 0 && (
            <div className="mx-4 mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                      {geocodingStatus.geocoded} of {geocodingStatus.total} properties have map coordinates
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {geocodingStatus.canAutoGeocode} properties can be auto-geocoded from their postcodes
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-8 sm:ml-0">
                  {geocodingStatus.canAutoGeocode > 0 && (
                    <Button 
                      size="sm"
                      onClick={() => geocodeMutation.mutate()}
                      disabled={geocodeMutation.isPending}
                      data-testid="button-geocode"
                    >
                      {geocodeMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Geocoding...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mr-2" />
                          Geocode Properties
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
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
                    {displayMarkers && displayMarkers.length > 0 && (
                      <PropertyMarkers 
                        properties={displayMarkers}
                      />
                    )}
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
      
      {drillDownOpen && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrillDownOpen(false)}
          />
          <div className="relative z-[1401] bg-background border rounded-2xl shadow-2xl max-w-lg w-[calc(100%-2rem)] max-h-[80vh] p-4 sm:p-6">
            <button
              onClick={() => setDrillDownOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 opacity-70 hover:opacity-100 hover:bg-muted transition-all"
              aria-label="Close"
            >
              <span className="text-lg">&times;</span>
            </button>
            
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Properties in Area</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Showing properties near the selected location
            </p>
            
            <div className="max-h-[50vh] overflow-y-auto">
              {loadingZoneProps ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : zoneProperties?.properties && zoneProperties.properties.length > 0 ? (
                <div className="space-y-2">
                  {zoneProperties.properties.map((prop) => (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDrillDownOpen(false);
                        setTimeout(() => navigate(`/properties/${prop.id}`), 50);
                      }}
                      className="w-full text-left cursor-pointer select-none block"
                      data-testid={`property-card-${prop.id}`}
                    >
                      <Card className="overflow-hidden hover:bg-muted/50 active:bg-muted transition-colors border-2 hover:border-primary/50 hover:shadow-md">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <PropertyHomeIcon className="h-4 w-4 text-primary flex-shrink-0" />
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
                    </button>
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
            </div>
            
            <div className="flex justify-end pt-4 mt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDrillDownOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
