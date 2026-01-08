import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend, MapSkeleton } from '@/components/maps';
import { RiskFilters } from '@/components/maps/RiskFilters';
import { AreaDetailPanel } from '@/components/maps/AreaDetailPanel';
import type { PropertyMarker } from '@/components/maps';
import type { RiskFilters as RiskFiltersType, RiskScore, AreaRisk } from '@/lib/risk/types';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Download, X } from 'lucide-react';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from') || params.has('stream') || params.has('level');
}

export default function RiskHeatmapPage() {
  const [filters, setFilters] = useState<RiskFiltersType>({
    level: 'ward',
    streams: 'all',
    period: 'current',
    showOnlyAtRisk: false,
  });
  
  const [selectedArea, setSelectedArea] = useState<AreaRisk | null>(null);
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  
  // For property level, use the geo endpoint with full data; for aggregated views use risk/areas
  const { data: areas = [], isLoading, refetch } = useQuery({
    queryKey: ['risk-areas', filters.level, filters.streams, filters.period, filters.showOnlyAtRisk],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      
      // Build params for all levels
      const params = new URLSearchParams({ level: filters.level === 'estate' ? 'scheme' : filters.level });
      if (filters.streams !== 'all' && Array.isArray(filters.streams) && filters.streams.length > 0) {
        params.set('streams', filters.streams.join(','));
      }
      if (filters.showOnlyAtRisk) {
        params.set('maxScore', '85');
      }
      
      const res = await fetch(`/api/risk/areas?${params}`, {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  
  const hasStreamFilter = filters.streams !== 'all';
  const streamLabel = hasStreamFilter && Array.isArray(filters.streams) && filters.streams.length > 0 
    ? filters.streams[0].charAt(0).toUpperCase() + filters.streams[0].slice(1) 
    : '';

  const filteredAreas = useMemo(() => {
    if (!filters.showOnlyAtRisk) return areas;
    return areas.filter((a: AreaRisk) => a.riskScore.compositeScore < 85);
  }, [areas, filters.showOnlyAtRisk]);

  const mapMarkers: PropertyMarker[] = filteredAreas.map((area: AreaRisk, index: number) => ({
    id: area.id,
    name: area.name,
    lat: area.lat,
    lng: area.lng,
    riskScore: area.riskScore.compositeScore,
    propertyCount: area.riskScore.propertyCount,
    unitCount: area.riskScore.unitCount,
    assetType: index % 3 === 0 ? 'scheme' : index % 3 === 1 ? 'block' : 'property',
  }));

  const handleAreaClick = (marker: PropertyMarker) => {
    const area = filteredAreas.find((a: AreaRisk) => a.id === marker.id);
    if (area) {
      setSelectedArea(area);
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Risk Heatmap" />
        <main id="main-content" className="flex-1 overflow-auto flex flex-col" role="main" aria-label="Risk heatmap content">
          {showBackButton && (
            <div className="p-4 pb-0">
              <ContextBackButton fallbackPath="/maps" fallbackLabel="Risk Maps" />
            </div>
          )}
          <RiskFilters filters={filters} onChange={setFilters} />
          
          <div className="flex-1 flex min-h-[60vh] md:min-h-[500px]">
            <div className="flex-1 relative min-h-[60vh] md:min-h-[500px]">
              {isLoading && areas.length === 0 ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap 
                    center={(() => {
                      const validMarkers = mapMarkers.filter(m => 
                        typeof m.lat === 'number' && !isNaN(m.lat) &&
                        typeof m.lng === 'number' && !isNaN(m.lng)
                      );
                      if (validMarkers.length === 0) return [52.5, -1.5] as [number, number];
                      return [
                        validMarkers.reduce((sum, m) => sum + m.lat, 0) / validMarkers.length,
                        validMarkers.reduce((sum, m) => sum + m.lng, 0) / validMarkers.length
                      ] as [number, number];
                    })()} 
                    zoom={mapMarkers.length > 0 ? 10 : 6}
                  >
                    <PropertyMarkers 
                      properties={mapMarkers}
                      onPropertyClick={handleAreaClick}
                    />
                  </BaseMap>
                </MapWrapper>
              )}
              
              <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => refetch()} data-testid="button-refresh-map">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              <div className="absolute bottom-4 left-4 z-[1000] space-y-2">
                <RiskLegend />
                {hasStreamFilter && (
                  <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border">
                    <span className="text-muted-foreground">Filtered by: </span>
                    <span className="font-medium text-primary">{streamLabel}</span>
                    <span className="text-muted-foreground ml-2">({filteredAreas.length} areas)</span>
                  </div>
                )}
              </div>
              
              {!selectedArea && !isLoading && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-center max-w-xs">
                    {mapMarkers.length === 0 ? (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">No data found</p>
                        <p className="text-muted-foreground">
                          {hasStreamFilter 
                            ? `No properties with ${streamLabel} certificates match your filters. Try selecting "All Streams".`
                            : 'No properties with geo-coordinates found. Try a different aggregation level.'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Click an area to see details</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {selectedArea && (
              <div className="w-80 border-l bg-background overflow-hidden">
                <AreaDetailPanel
                  areaId={selectedArea.id}
                  areaName={selectedArea.name}
                  areaLevel={selectedArea.level}
                  riskScore={selectedArea.riskScore}
                  onClose={() => setSelectedArea(null)}
                  onExport={() => console.log('Export', selectedArea.id)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
