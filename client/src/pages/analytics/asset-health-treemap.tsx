import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ComplianceTreeMap } from '@/components/analytics/ComplianceTreeMap';
import { HierarchyExplorer } from '@/components/analytics/HierarchyExplorer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  LayoutGrid, 
  List, 
  RefreshCw, 
  Download,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface StreamSummary {
  id: string;
  name: string;
  color: string;
  propertyCount: number;
  certificateCount: number;
  complianceRate: number;
  openActions: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export default function AssetHealthTreemapPage() {
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<'treemap' | 'explorer'>('treemap');
  const [groupBy, setGroupBy] = useState<'stream' | 'scheme'>('stream');

  const { data: hierarchyData, refetch, isRefetching } = useQuery<{ level: string; data: StreamSummary[] }>({
    queryKey: ['/api/analytics/hierarchy', 'stream'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/hierarchy?level=stream');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const streams = hierarchyData?.data || [];
  const totalProperties = streams.reduce((sum, s) => sum + (s.propertyCount || 0), 0);
  const totalCertificates = streams.reduce((sum, s) => sum + (s.certificateCount || 0), 0);
  const totalOpenActions = streams.reduce((sum, s) => sum + (s.openActions || 0), 0);
  const avgCompliance = streams.length > 0 
    ? Math.round(streams.reduce((sum, s) => sum + (s.complianceRate || 0), 0) / streams.length)
    : 0;

  const handlePropertyClick = (propertyId: string) => {
    setLocation(`/properties/${propertyId}`);
  };

  const handleTreemapNodeClick = (node: any) => {
    if (node.code || node.id) {
      setActiveView('explorer');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Asset Health Overview" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-muted-foreground">
                  Visual breakdown of compliance across your property portfolio
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  data-testid="refresh-treemap"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" data-testid="export-treemap">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="stat-total-properties">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Properties</p>
                      <p className="text-2xl font-bold">{totalProperties.toLocaleString()}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="stat-certificates">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Certificates</p>
                      <p className="text-2xl font-bold">{totalCertificates.toLocaleString()}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="stat-compliance">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Compliance</p>
                      <p className="text-2xl font-bold">{avgCompliance}%</p>
                    </div>
                    <TrendingUp className={`h-8 w-8 ${avgCompliance >= 90 ? 'text-green-500' : avgCompliance >= 70 ? 'text-amber-500' : 'text-red-500'}`} />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="stat-open-actions">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Open Actions</p>
                      <p className="text-2xl font-bold">{totalOpenActions.toLocaleString()}</p>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${totalOpenActions > 100 ? 'text-red-500' : totalOpenActions > 50 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'treemap' | 'explorer')}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="treemap" className="flex items-center gap-2" data-testid="tab-treemap">
                    <LayoutGrid className="h-4 w-4" />
                    TreeMap View
                  </TabsTrigger>
                  <TabsTrigger value="explorer" className="flex items-center gap-2" data-testid="tab-explorer">
                    <List className="h-4 w-4" />
                    Hierarchy Explorer
                  </TabsTrigger>
                </TabsList>
                
                {activeView === 'treemap' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Group by:</span>
                    <Button
                      variant={groupBy === 'stream' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGroupBy('stream')}
                      data-testid="group-by-stream"
                    >
                      Stream
                    </Button>
                    <Button
                      variant={groupBy === 'scheme' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGroupBy('scheme')}
                      data-testid="group-by-scheme"
                    >
                      Scheme
                    </Button>
                  </div>
                )}
              </div>

              <TabsContent value="treemap" className="mt-4">
                <ComplianceTreeMap 
                  groupBy={groupBy} 
                  onNodeClick={handleTreemapNodeClick}
                  height={500}
                />
              </TabsContent>

              <TabsContent value="explorer" className="mt-4">
                <HierarchyExplorer onPropertyClick={handlePropertyClick} />
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Streams Summary</CardTitle>
                <CardDescription>
                  Overview of all compliance streams with their current status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {streams.map((stream) => (
                    <div 
                      key={stream.id}
                      className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setActiveView('explorer');
                      }}
                      data-testid={`stream-card-${stream.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stream.color }}
                        />
                        <span className="font-medium">{stream.name}</span>
                        <Badge 
                          variant={stream.riskLevel === 'HIGH' ? 'destructive' : stream.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}
                          className="ml-auto"
                        >
                          {stream.riskLevel}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Properties</span>
                          <div className="font-semibold">{stream.propertyCount?.toLocaleString() || 0}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Compliance</span>
                          <div className={`font-semibold ${
                            stream.complianceRate >= 90 ? 'text-green-600' :
                            stream.complianceRate >= 70 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {stream.complianceRate || 0}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
