import { useState, useEffect } from 'react';
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

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  
  return isMobile;
}

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
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState<'treemap' | 'explorer'>('treemap');
  const [groupBy, setGroupBy] = useState<'stream' | 'scheme'>('stream');
  
  // Auto-switch to explorer on mobile for better UX
  useEffect(() => {
    if (isMobile) setActiveView('explorer');
  }, [isMobile]);

  const { data: dashboardStats, refetch, isRefetching } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const totalProperties = dashboardStats?.totalProperties || 0;
  const totalCertificates = dashboardStats?.totalCertificates || 0;
  const totalOpenActions = dashboardStats?.activeHazards || 0;
  const avgCompliance = Math.round(parseFloat(dashboardStats?.overallCompliance || '0'));

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
        <Header title="Compliance Portfolio" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2" data-testid="stat-total-properties">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Properties</span>
                  <span className="font-semibold">{totalProperties.toLocaleString()}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-border" />
                <div className="flex items-center gap-2" data-testid="stat-certificates">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Certificates</span>
                  <span className="font-semibold">{totalCertificates.toLocaleString()}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-border" />
                <div className="flex items-center gap-2" data-testid="stat-compliance">
                  <TrendingUp className={`h-4 w-4 ${avgCompliance >= 90 ? 'text-green-500' : avgCompliance >= 70 ? 'text-amber-500' : 'text-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Compliance</span>
                  <span className={`font-semibold ${avgCompliance >= 90 ? 'text-green-500' : avgCompliance >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{avgCompliance}%</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-border" />
                <div className="flex items-center gap-2" data-testid="stat-open-actions">
                  <AlertTriangle className={`h-4 w-4 ${totalOpenActions > 100 ? 'text-red-500' : totalOpenActions > 50 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm text-muted-foreground">Actions</span>
                  <span className={`font-semibold ${totalOpenActions > 100 ? 'text-red-500' : ''}`}>{totalOpenActions.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  data-testid="refresh-treemap"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="sm" data-testid="export-treemap">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
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

          </div>
        </main>
      </div>
    </div>
  );
}
