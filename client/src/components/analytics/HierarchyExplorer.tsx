import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronRight, 
  ChevronLeft, 
  Home, 
  Building2, 
  Layers, 
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HierarchyItem {
  id: string;
  name: string;
  value: number;
  propertyCount?: number;
  blockCount?: number;
  certificateCount?: number;
  compliantCount?: number;
  expiredCount?: number;
  expiringSoonCount?: number;
  openActions?: number;
  complianceRate?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  color?: string;
  icon?: string;
  address?: string;
  postcode?: string;
  reference?: string;
}

interface BreadcrumbItem {
  level: 'stream' | 'scheme' | 'block' | 'property';
  id: string | null;
  name: string;
}

interface HierarchyExplorerProps {
  onPropertyClick?: (propertyId: string) => void;
  initialLevel?: 'stream' | 'scheme' | 'block';
}

const levelIcons = {
  stream: FileText,
  scheme: Layers,
  block: Building2,
  property: MapPin,
};

const levelLabels = {
  stream: 'Compliance Stream',
  scheme: 'Scheme',
  block: 'Block',
  property: 'Property',
};

const nextLevel: Record<string, 'stream' | 'scheme' | 'block' | 'property'> = {
  stream: 'scheme',
  scheme: 'block',
  block: 'property',
};

export function HierarchyExplorer({ 
  onPropertyClick,
  initialLevel = 'stream'
}: HierarchyExplorerProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { level: 'stream', id: null, name: 'All Streams' }
  ]);
  
  const currentLevel = breadcrumbs[breadcrumbs.length - 1];
  
  const { data, isLoading, error } = useQuery<{ level: string; data: HierarchyItem[]; parentId: string | null }>({
    queryKey: ['/api/analytics/hierarchy', currentLevel.level, currentLevel.id],
    queryFn: async () => {
      const params = new URLSearchParams({ level: currentLevel.level });
      if (currentLevel.id) params.set('parentId', currentLevel.id);
      const res = await fetch(`/api/analytics/hierarchy?${params}`);
      if (!res.ok) throw new Error('Failed to fetch hierarchy data');
      return res.json();
    },
  });

  const handleDrillDown = (item: HierarchyItem) => {
    if (currentLevel.level === 'property') {
      onPropertyClick?.(item.id);
      return;
    }
    
    setBreadcrumbs(prev => [
      ...prev,
      { 
        level: nextLevel[currentLevel.level], 
        id: item.id, 
        name: item.name 
      }
    ]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleBack = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs(prev => prev.slice(0, -1));
    }
  };

  const LevelIcon = levelIcons[currentLevel.level];

  return (
    <Card data-testid="hierarchy-explorer">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LevelIcon className="h-5 w-5" />
              {levelLabels[currentLevel.level]}s
            </CardTitle>
            <CardDescription>
              Navigate through your property hierarchy
            </CardDescription>
          </div>
          {breadcrumbs.length > 1 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBack}
              data-testid="hierarchy-back-button"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        
        <nav className="flex items-center gap-1 text-sm mt-3 flex-wrap" data-testid="hierarchy-breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.level}-${crumb.id}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={cn(
                  "hover:underline",
                  index === breadcrumbs.length - 1 
                    ? "font-semibold text-foreground" 
                    : "text-muted-foreground"
                )}
                data-testid={`breadcrumb-${crumb.level}`}
              >
                {index === 0 ? <Home className="h-3 w-3 inline mr-1" /> : null}
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="hierarchy-loading">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive" data-testid="hierarchy-error">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load data</p>
          </div>
        ) : !data?.data?.length ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="hierarchy-empty">
            <p>No items found at this level</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="hierarchy-items">
            {data.data.map((item) => (
              <button
                key={item.id}
                onClick={() => handleDrillDown(item)}
                className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                data-testid={`hierarchy-item-${item.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.color && (
                        <span 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      <span className="font-medium truncate">{item.name}</span>
                      {item.riskLevel && (
                        <Badge 
                          variant={item.riskLevel === 'HIGH' ? 'destructive' : item.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'}
                          className="flex-shrink-0"
                        >
                          {item.riskLevel}
                        </Badge>
                      )}
                    </div>
                    {(item.address || item.reference) && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {item.address || item.reference}
                        {item.postcode && `, ${item.postcode}`}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </div>
                
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  {item.propertyCount !== undefined && (
                    <div data-testid={`item-${item.id}-properties`}>
                      <span className="text-muted-foreground">Properties</span>
                      <div className="font-semibold">{item.propertyCount.toLocaleString()}</div>
                    </div>
                  )}
                  {item.certificateCount !== undefined && (
                    <div data-testid={`item-${item.id}-certificates`}>
                      <span className="text-muted-foreground">Certificates</span>
                      <div className="font-semibold">{item.certificateCount.toLocaleString()}</div>
                    </div>
                  )}
                  {item.openActions !== undefined && item.openActions > 0 && (
                    <div data-testid={`item-${item.id}-actions`}>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Open Actions
                      </span>
                      <div className="font-semibold text-amber-600">{item.openActions}</div>
                    </div>
                  )}
                  {item.complianceRate !== undefined && (
                    <div className="col-span-2 sm:col-span-1" data-testid={`item-${item.id}-compliance`}>
                      <span className="text-muted-foreground">Compliance</span>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={item.complianceRate} 
                          className="h-2 flex-1"
                        />
                        <span className={cn(
                          "font-semibold",
                          item.complianceRate >= 90 ? "text-green-600" :
                          item.complianceRate >= 70 ? "text-amber-600" : "text-red-600"
                        )}>
                          {item.complianceRate}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {(item.expiredCount ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-red-600">
                      <Clock className="h-3 w-3" />
                      {item.expiredCount} expired
                    </span>
                    {(item.expiringSoonCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        {item.expiringSoonCount} expiring soon
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HierarchyExplorer;
