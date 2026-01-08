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

function generateSampleAreas(): AreaRisk[] {
  const areas: AreaRisk[] = [];
  const londonWards = [
    { name: 'Highgate', lat: 51.574, lng: -0.144 },
    { name: 'Hampstead', lat: 51.557, lng: -0.178 },
    { name: 'Islington Central', lat: 51.536, lng: -0.103 },
    { name: 'Hackney Central', lat: 51.545, lng: -0.055 },
    { name: 'Bethnal Green', lat: 51.527, lng: -0.055 },
    { name: 'Bow East', lat: 51.529, lng: -0.016 },
    { name: 'Mile End', lat: 51.525, lng: -0.034 },
    { name: 'Whitechapel', lat: 51.519, lng: -0.061 },
    { name: 'Shadwell', lat: 51.511, lng: -0.056 },
    { name: 'Wapping', lat: 51.504, lng: -0.056 },
    { name: 'Bermondsey', lat: 51.499, lng: -0.063 },
    { name: 'Rotherhithe', lat: 51.500, lng: -0.049 },
    { name: 'Peckham', lat: 51.473, lng: -0.069 },
    { name: 'Camberwell', lat: 51.474, lng: -0.093 },
    { name: 'Brixton', lat: 51.462, lng: -0.115 },
  ];

  for (let i = 0; i < londonWards.length; i++) {
    const ward = londonWards[i];
    const riskScore = Math.floor(Math.random() * 50) + 50;
    
    areas.push({
      id: `ward-${i + 1}`,
      name: ward.name,
      level: 'ward',
      lat: ward.lat,
      lng: ward.lng,
      riskScore: {
        compositeScore: riskScore,
        streams: [
          { stream: 'gas', compliance: 0.95 + Math.random() * 0.05, total: 100, compliant: 95, overdueCount: Math.floor(Math.random() * 5), dueSoonCount: Math.floor(Math.random() * 10) },
          { stream: 'electrical', compliance: 0.85 + Math.random() * 0.15, total: 100, compliant: 85, overdueCount: Math.floor(Math.random() * 10), dueSoonCount: Math.floor(Math.random() * 15) },
          { stream: 'fire', compliance: 0.90 + Math.random() * 0.10, total: 50, compliant: 45, overdueCount: Math.floor(Math.random() * 3), dueSoonCount: Math.floor(Math.random() * 5) },
          { stream: 'asbestos', compliance: 0.92 + Math.random() * 0.08, total: 80, compliant: 74, overdueCount: Math.floor(Math.random() * 5), dueSoonCount: Math.floor(Math.random() * 8) },
          { stream: 'lift', compliance: 0.88 + Math.random() * 0.12, total: 20, compliant: 18, overdueCount: Math.floor(Math.random() * 2), dueSoonCount: Math.floor(Math.random() * 3) },
          { stream: 'water', compliance: 0.94 + Math.random() * 0.06, total: 60, compliant: 57, overdueCount: Math.floor(Math.random() * 2), dueSoonCount: Math.floor(Math.random() * 4) },
        ],
        defects: {
          critical: Math.floor(Math.random() * 3),
          major: Math.floor(Math.random() * 8),
          minor: Math.floor(Math.random() * 15),
        },
        trend: ['improving', 'stable', 'deteriorating'][Math.floor(Math.random() * 3)] as 'improving' | 'stable' | 'deteriorating',
        propertyCount: Math.floor(Math.random() * 50) + 20,
        unitCount: Math.floor(Math.random() * 300) + 100,
      },
    });
  }

  return areas;
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
  
  const sampleAreas = useMemo(() => generateSampleAreas(), []);
  
  // For property level, use the geo endpoint with full data; for aggregated views use risk/areas
  const { data: areas = sampleAreas, isLoading, refetch } = useQuery({
    queryKey: ['risk-areas', filters.level, filters.streams, filters.period, filters.showOnlyAtRisk],
    queryFn: async () => {
      console.log('Fetching risk areas with filters:', filters);
      const userId = localStorage.getItem('user_id');
      
      // For property level, use the risk areas endpoint with property level
      // This ensures streams filter works for property level too
      if (filters.level === 'property') {
        const params = new URLSearchParams({ level: 'property' });
        if (filters.streams !== 'all' && Array.isArray(filters.streams) && filters.streams.length > 0) {
          params.set('streams', filters.streams.join(','));
        }
        if (filters.showOnlyAtRisk) {
          params.set('maxScore', '85');
        }
        
        const res = await fetch(`/api/risk/areas?${params}`, {
          headers: { 'X-User-Id': userId || '' }
        });
        if (!res.ok) return sampleAreas;
        const data = await res.json();
        return data.length > 0 ? data : sampleAreas;
      }
      
      // For ward/estate aggregation, use the risk areas endpoint
      const params = new URLSearchParams({
        level: filters.level,
      });
      if (filters.showOnlyAtRisk) {
        params.set('maxScore', '85');
      }
      // Pass streams filter to API
      if (filters.streams !== 'all' && Array.isArray(filters.streams) && filters.streams.length > 0) {
        params.set('streams', filters.streams.join(','));
      }
      
      const res = await fetch(`/api/risk/areas?${params}`, {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return sampleAreas;
      const data = await res.json();
      console.log('API returned', data.length, 'areas for filters:', filters);
      return data.length > 0 ? data : sampleAreas;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

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
          
          <div className="flex-1 flex min-h-[500px]">
            <div className="flex-1 relative min-h-[500px]">
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
              
              <div className="absolute bottom-4 left-4 z-[1000]">
                <RiskLegend />
              </div>
              
              {!selectedArea && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-muted-foreground">
                    Click an area to see details
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
