import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, HeatmapLayer, MapSkeleton } from '@/components/maps';
import type { HeatmapCell } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
const X = getIcon('X');

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

type GridResolution = 'coarse' | 'medium' | 'fine';

interface HeatmapResponse {
  cells: HeatmapCell[];
  cellSize: { latStep: number; lngStep: number };
  stats: { totalCells: number; totalProperties: number; avgRisk: number };
}

const resolutionLabels = {
  coarse: 'Overview',
  medium: 'Standard', 
  fine: 'Detailed'
};

const zoomLevelMap = { coarse: 6, medium: 8, fine: 10 };

export default function RiskHeatmapPage() {
  const [resolution, setResolution] = useState<GridResolution>('medium');
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  const mapRef = useRef<L.Map | null>(null);
  const prevResolutionRef = useRef<GridResolution>(resolution);

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

  const { data: zoneProperties, isLoading: loadingZoneProps } = useQuery<ZonePropertiesResponse>({
    queryKey: ['zone-properties', selectedCell?.lat, selectedCell?.lng, cellSize.latStep, cellSize.lngStep],
    queryFn: async () => {
      if (!selectedCell) return { properties: [], total: 0 };
      const userId = localStorage.getItem('user_id');
      const halfLat = cellSize.latStep / 2;
      const halfLng = cellSize.lngStep / 2;
      const res = await fetch(
        `/api/properties/geo/zone?minLat=${selectedCell.lat - halfLat}&maxLat=${selectedCell.lat + halfLat}&minLng=${selectedCell.lng - halfLng}&maxLng=${selectedCell.lng + halfLng}&limit=50`,
        { headers: { 'X-User-Id': userId || '' } }
      );
      if (!res.ok) return { properties: [], total: 0 };
      return res.json();
    },
    enabled: !!selectedCell && drillDownOpen,
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

  const handleCellClick = useCallback((cell: HeatmapCell) => {
    setSelectedCell(cell);
    setDrillDownOpen(true);
    
    if (mapRef.current) {
      const halfLat = cellSize.latStep / 2;
      const halfLng = cellSize.lngStep / 2;
      const bounds = L.latLngBounds(
        [cell.lat - halfLat, cell.lng - halfLng],
        [cell.lat + halfLat, cell.lng + halfLng]
      );
      mapRef.current.fitBounds(bounds, { maxZoom: 14, padding: [50, 50] });
    }
  }, [cellSize]);

  useEffect(() => {
    if (!mapRef.current || cells.length === 0 || cellSize.latStep === 0) return;
    
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
          const targetZoom = zoomLevelMap[resolution];
          map.fitBounds(bounds, { maxZoom: targetZoom, padding: [20, 20] });
        }
        
        prevResolutionRef.current = resolution;
      } catch (e) {
        console.warn('Failed to fit bounds:', e);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [cells, cellSize, resolution]);

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
              <Label htmlFor="resolution" className="text-sm">Detail level:</Label>
              <Select value={resolution} onValueChange={(v) => setResolution(v as GridResolution)}>
                <SelectTrigger className="w-[110px]" id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="z-[2000]">
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
          
          <div className="flex-1 min-h-[75vh] md:min-h-[600px] relative overflow-hidden">
            <div className="absolute inset-0">
              {isLoading && cells.length === 0 ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap center={[52.5, -1.5]} zoom={6} onMapReady={handleMapReady}>
                    <HeatmapLayer 
                      key={`heatmap-${resolution}-${cells.length}`}
                      cells={cells}
                      cellSize={cellSize}
                      onCellClick={handleCellClick}
                    />
                  </BaseMap>
                </MapWrapper>
              )}
            </div>
            
            <div className="absolute bottom-4 left-4 z-[1100] pointer-events-auto">
              <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {resolutionLabels[resolution]} View
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {stats.totalCells} zones
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600" />
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
                      <span className="text-muted-foreground">High risk:</span>
                      <span className="font-medium text-destructive">{riskBreakdown.highRisk.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="pt-1 text-[10px] text-muted-foreground italic">
                    Click any zone to drill down
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
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Zone Details
            </DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <span className="flex items-center gap-2">
                  Risk Score: <Badge variant={selectedCell.avgRisk < 60 ? 'destructive' : selectedCell.avgRisk < 85 ? 'secondary' : 'outline'}>
                    {selectedCell.avgRisk.toFixed(0)}%
                  </Badge>
                  <span className="text-muted-foreground">•</span>
                  {selectedCell.count.toLocaleString()} properties in zone
                </span>
              )}
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
                  <Card key={prop.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{prop.addressLine1}</span>
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
                <p className="text-sm">No property details available</p>
              </div>
            )}
          </ScrollArea>
          
          {selectedCell && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrillDownOpen(false);
                }}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
