import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend } from '@/components/maps';
import type { PropertyMarker } from '@/components/maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Map, BarChart3, AlertTriangle, FileText, MapPin, Loader2, Building2, MapPinned, Home } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type AggregationLevel = 'property' | 'scheme' | 'ward';

export default function MapsIndexPage() {
  const [selectedProperty, setSelectedProperty] = useState<PropertyMarker | null>(null);
  const [aggregationLevel, setAggregationLevel] = useState<AggregationLevel>('property');
  const queryClient = useQueryClient();
  
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['map-properties'],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch('/api/properties/geo', {
        headers: { 'X-User-Id': userId || '' }
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
  
  const riskSummary = useMemo(() => {
    const dataSource = displayMarkers;
    const high = dataSource.filter((p: any) => p.riskScore < 60).length;
    const medium = dataSource.filter((p: any) => p.riskScore >= 60 && p.riskScore < 85).length;
    const low = dataSource.filter((p: any) => p.riskScore >= 85).length;
    const avgScore = dataSource.length > 0 
      ? dataSource.reduce((sum: number, p: any) => sum + p.riskScore, 0) / dataSource.length 
      : 0;
    return { high, medium, low, avgScore: Math.round(avgScore), total: dataSource.length };
  }, [displayMarkers]);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Risk Maps" />
        <main id="main-content" className="flex-1 overflow-hidden p-6" role="main" aria-label="Risk maps content">
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display">Geographic Risk View</h2>
                <p className="text-muted-foreground">
                  Visualize compliance risk across your property portfolio
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">View by:</Label>
                  <Select value={aggregationLevel} onValueChange={(v) => setAggregationLevel(v as AggregationLevel)}>
                    <SelectTrigger className="w-[140px]" data-testid="select-aggregation-level">
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
                </div>
                <Link href="/maps/risk-heatmap">
                  <Button variant="outline" data-testid="button-heatmap">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Risk Heatmap
                  </Button>
                </Link>
                <Link href="/maps/scenarios">
                  <Button variant="outline" data-testid="button-scenarios">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Scenarios
                  </Button>
                </Link>
                <Link href="/maps/evidence">
                  <Button variant="outline" data-testid="button-evidence">
                    <FileText className="h-4 w-4 mr-2" />
                    Evidence View
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-total-properties">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {aggregationLevel === 'property' ? 'Total Properties' : 
                     aggregationLevel === 'scheme' ? 'Total Schemes' : 'Total Wards'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{riskSummary.total}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-high-risk">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-600">High Risk</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{riskSummary.high}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-medium-risk">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-600">Medium Risk</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{riskSummary.medium}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-avg-score">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{riskSummary.avgScore}%</p>
                </CardContent>
              </Card>
            </div>

            {geocodingStatus && geocodingStatus.notGeocoded > 0 && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        {geocodingStatus.geocoded} of {geocodingStatus.total} properties have map coordinates
                      </p>
                      <p className="text-sm text-amber-600">
                        {geocodingStatus.canAutoGeocode} properties can be auto-geocoded from their postcodes
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {geocodingStatus.canAutoGeocode > 0 && (
                      <Button 
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
                    <Link href="/admin/imports?type=geocoding">
                      <Button variant="outline" data-testid="button-import-geocoding">
                        Import Geocoding
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex-1 relative rounded-lg overflow-hidden border shadow-sm" style={{ minHeight: '400px' }}>
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <MapWrapper>
                <BaseMap center={[52.5, -1.5]} zoom={6}>
                  <PropertyMarkers 
                    properties={displayMarkers}
                    onPropertyClick={setSelectedProperty}
                  />
                </BaseMap>
              </MapWrapper>
              
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
