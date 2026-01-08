import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { HeroStatsGrid, HeroStatsGridSkeleton } from '@/components/dashboard/HeroStats';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend, MapSkeleton } from '@/components/maps';
import type { PropertyMarker } from '@/components/maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Map, BarChart3, AlertTriangle, FileText, MapPin, Loader2, Building2, MapPinned, Home, CheckCircle, Clock, Shield } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from');
}

type AggregationLevel = 'property' | 'scheme' | 'ward';

export default function MapsIndexPage() {
  const [selectedProperty, setSelectedProperty] = useState<PropertyMarker | null>(null);
  const [aggregationLevel, setAggregationLevel] = useState<AggregationLevel>('property');
  const queryClient = useQueryClient();
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  
  // Lightweight stats endpoint - loads instantly
  const { data: mapStats, isLoading: statsLoading } = useQuery({
    queryKey: ['map-stats'],
    queryFn: async () => {
      const res = await fetch('/api/maps/stats', { cache: 'no-store' });
      if (!res.ok) return { total: 0, high: 0, medium: 0, low: 0, avgScore: 0 };
      return res.json();
    },
    staleTime: 30000,
  });

  // Full property data for map markers - loads in background
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['map-properties'],
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
    refetchOnWindowFocus: true,
  });
  
  const { data: geocodingStatus } = useQuery({
    queryKey: ['geocoding-status'],
    queryFn: async () => {
      const res = await fetch('/api/geocoding/status');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });
  
  const { data: aggregatedAreas = [] } = useQuery({
    queryKey: ['risk-areas', aggregationLevel],
    queryFn: async () => {
      const res = await fetch(`/api/risk/areas?level=${aggregationLevel}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: aggregationLevel !== 'property',
    staleTime: 30000,
  });
  
  const geocodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/geocoding/batch', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to geocode');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Geocoded ${data.updated} properties`);
      queryClient.invalidateQueries({ queryKey: ['map-properties'] });
      queryClient.invalidateQueries({ queryKey: ['geocoding-status'] });
    },
    onError: () => {
      toast.error('Failed to geocode properties');
    }
  });
  

  const displayMarkers = useMemo(() => {
    if (aggregationLevel === 'property') {
      return properties;
    }
    return aggregatedAreas.map((area: any) => ({
      id: area.id,
      name: area.name,
      address: `${area.name} (${area.riskScore.propertyCount} properties)`,
      lat: area.lat,
      lng: area.lng,
      riskScore: area.riskScore.compositeScore,
      propertyCount: area.riskScore.propertyCount,
    }));
  }, [aggregationLevel, properties, aggregatedAreas]);
  
  // Use server-side stats for property level (instant load), calculate from data for aggregated views
  const riskSummary = useMemo(() => {
    if (aggregationLevel === 'property' && mapStats) {
      return mapStats;
    }
    // Fallback for scheme/ward aggregation levels
    const dataSource = displayMarkers;
    const high = dataSource.filter((p: any) => p.riskScore < 60).length;
    const medium = dataSource.filter((p: any) => p.riskScore >= 60 && p.riskScore < 85).length;
    const low = dataSource.filter((p: any) => p.riskScore >= 85).length;
    const avgScore = dataSource.length > 0 
      ? dataSource.reduce((sum: number, p: any) => sum + p.riskScore, 0) / dataSource.length 
      : 0;
    return { high, medium, low, avgScore: Math.round(avgScore), total: dataSource.length };
  }, [aggregationLevel, mapStats, displayMarkers]);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Risk Maps" />
        <main id="main-content" className="flex-1 overflow-hidden p-4 md:p-6" role="main" aria-label="Risk maps content">
          {showBackButton && (
            <div className="mb-4">
              <ContextBackButton fallbackPath="/dashboard" fallbackLabel="Dashboard" />
            </div>
          )}
          <div className="h-full flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight font-display">Geographic Risk View</h2>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Visualize compliance risk across your property portfolio
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={aggregationLevel} onValueChange={(v) => setAggregationLevel(v as AggregationLevel)}>
                  <SelectTrigger className="w-[120px]" data-testid="select-aggregation-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Property
                      </div>
                    </SelectItem>
                    <SelectItem value="scheme">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Scheme
                      </div>
                    </SelectItem>
                    <SelectItem value="ward">
                      <div className="flex items-center gap-2">
                        <MapPinned className="h-4 w-4" />
                        Ward
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Link href="/maps/risk-heatmap?from=/maps">
                  <Button variant="outline" size="icon" data-testid="button-heatmap" title="Risk Heatmap">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/maps/scenarios?from=/maps">
                  <Button variant="outline" size="icon" data-testid="button-scenarios" title="Scenarios">
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/maps/evidence?from=/maps">
                  <Button variant="outline" size="icon" data-testid="button-evidence" title="Evidence View">
                    <FileText className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {statsLoading && !mapStats ? (
              <HeroStatsGridSkeleton count={4} />
            ) : (
              <HeroStatsGrid
                stats={[
                  {
                    title: aggregationLevel === 'property' ? 'Total Properties' : 
                           aggregationLevel === 'scheme' ? 'Total Schemes' : 'Total Wards',
                    value: riskSummary.total,
                    subtitle: riskSummary.total === 0 ? "No geocoded data" : undefined,
                    icon: MapPin,
                    riskLevel: "good",
                    testId: "stat-total-properties",
                  },
                  {
                    title: "High Risk",
                    value: riskSummary.high,
                    icon: AlertTriangle,
                    riskLevel: riskSummary.high > 0 ? "critical" : "good",
                    testId: "stat-high-risk",
                  },
                  {
                    title: "Medium Risk",
                    value: riskSummary.medium,
                    icon: Clock,
                    riskLevel: riskSummary.medium > 5 ? "high" : "medium",
                    testId: "stat-medium-risk",
                  },
                  {
                    title: "Average Score",
                    value: riskSummary.avgScore,
                    subtitle: riskSummary.total > 0 ? "%" : "No data",
                    icon: Shield,
                    riskLevel: riskSummary.avgScore >= 85 ? "good" : riskSummary.avgScore >= 70 ? "medium" : "critical",
                    testId: "stat-avg-score",
                  },
                ]}
              />
            )}

            {geocodingStatus && geocodingStatus.notGeocoded > 0 && (
              <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <CardContent className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-amber-800 dark:text-amber-300 text-sm sm:text-base">
                          {geocodingStatus.geocoded} of {geocodingStatus.total} properties have map coordinates
                        </p>
                        <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
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
                              <span className="hidden sm:inline">Geocoding...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Geocode Properties</span>
                            </>
                          )}
                        </Button>
                      )}
                      <Link href="/admin/imports?type=geocoding">
                        <Button variant="outline" size="sm" data-testid="button-import-geocoding">
                          <span className="hidden sm:inline">Import Geocoding</span>
                          <span className="sm:hidden">Import</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex-1 relative rounded-lg overflow-hidden border shadow-sm min-h-[300px] sm:min-h-[400px]">
              {propertiesLoading ? (
                <MapSkeleton />
              ) : (
                <MapWrapper>
                  <BaseMap center={[52.5, -1.5]} zoom={6}>
                    <PropertyMarkers 
                      properties={displayMarkers}
                      onPropertyClick={setSelectedProperty}
                    />
                  </BaseMap>
                </MapWrapper>
              )}
              
              <div className="absolute bottom-4 left-4 z-[1000]">
                <RiskLegend />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
