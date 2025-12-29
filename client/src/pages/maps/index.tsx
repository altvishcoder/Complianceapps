import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend } from '@/components/maps';
import type { PropertyMarker } from '@/components/maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Map, BarChart3, AlertTriangle, FileText } from 'lucide-react';
import { Link } from 'wouter';

function generateSampleProperties(): PropertyMarker[] {
  const properties: PropertyMarker[] = [];
  const londonAreas = [
    { name: 'Westminster', lat: 51.501, lng: -0.141 },
    { name: 'Camden', lat: 51.539, lng: -0.142 },
    { name: 'Islington', lat: 51.536, lng: -0.103 },
    { name: 'Hackney', lat: 51.545, lng: -0.055 },
    { name: 'Tower Hamlets', lat: 51.515, lng: -0.032 },
    { name: 'Southwark', lat: 51.473, lng: -0.080 },
    { name: 'Lambeth', lat: 51.457, lng: -0.123 },
    { name: 'Wandsworth', lat: 51.456, lng: -0.191 },
    { name: 'Hammersmith', lat: 51.492, lng: -0.223 },
    { name: 'Kensington', lat: 51.502, lng: -0.194 },
  ];

  for (let i = 0; i < 25; i++) {
    const area = londonAreas[i % londonAreas.length];
    const latOffset = (Math.random() - 0.5) * 0.04;
    const lngOffset = (Math.random() - 0.5) * 0.04;
    
    properties.push({
      id: `prop-${i + 1}`,
      name: `${area.name} Estate Block ${Math.floor(i / 10) + 1}`,
      address: `${Math.floor(Math.random() * 200) + 1} ${area.name} Road, London`,
      lat: area.lat + latOffset,
      lng: area.lng + lngOffset,
      riskScore: Math.floor(Math.random() * 60) + 40,
      propertyCount: Math.floor(Math.random() * 50) + 10,
      unitCount: Math.floor(Math.random() * 200) + 50,
    });
  }

  return properties;
}

export default function MapsIndexPage() {
  const [selectedProperty, setSelectedProperty] = useState<PropertyMarker | null>(null);
  
  const sampleProperties = useMemo(() => generateSampleProperties(), []);
  
  const { data: properties = sampleProperties, isLoading } = useQuery({
    queryKey: ['map-properties'],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch('/api/properties/geo', {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return sampleProperties;
      const data = await res.json();
      return data.length > 0 ? data : sampleProperties;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const riskSummary = useMemo(() => {
    const high = properties.filter((p: PropertyMarker) => p.riskScore < 60).length;
    const medium = properties.filter((p: PropertyMarker) => p.riskScore >= 60 && p.riskScore < 85).length;
    const low = properties.filter((p: PropertyMarker) => p.riskScore >= 85).length;
    const avgScore = properties.reduce((sum: number, p: PropertyMarker) => sum + p.riskScore, 0) / properties.length;
    return { high, medium, low, avgScore: Math.round(avgScore), total: properties.length };
  }, [properties]);

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
              <div className="flex gap-2">
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Properties</CardTitle>
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

            <div className="flex-1 relative rounded-lg overflow-hidden border shadow-sm" style={{ minHeight: '400px' }}>
              <MapWrapper>
                <BaseMap center={[51.505, -0.09]} zoom={11}>
                  <PropertyMarkers 
                    properties={properties}
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
