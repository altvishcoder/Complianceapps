import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  getIcon,
  getStatusIcon,
  getActionIcon,
  getStreamIcon, 
  getIconByName,
  getHierarchyIcon,
  getHierarchyColor,
  HIERARCHY_ICONS,
} from '@/config/icons';

const ChevronRight = getActionIcon('next');
const ChevronDown = getIcon('ChevronDown');
const AlertTriangle = getStatusIcon('warning');
const Loader2 = getIcon('Loader2');
const MapPin = getIcon('MapPin');
const FileText = getIcon('FileText');
const Layers = getIcon('Layers');

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
  code?: string;
}

interface HierarchyExplorerProps {
  onPropertyClick?: (propertyId: string) => void;
}

type LevelType = 'stream' | 'certificateType' | 'property';

const levelLabels = {
  stream: 'Compliance Stream',
  certificateType: 'Certificate Type',
  property: 'Property',
};

const nextLevel: Record<string, LevelType> = {
  stream: 'certificateType',
  certificateType: 'property',
};

function TreeNode({ 
  item, 
  level,
  nodeLevel = 0,
  onPropertyClick,
}: { 
  item: HierarchyItem; 
  level: LevelType;
  nodeLevel?: number;
  onPropertyClick?: (propertyId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  
  const getNodeIcon = () => {
    if (level === 'stream') {
      if (item.icon) {
        return getIconByName(item.icon);
      }
      if (item.id) {
        return getStreamIcon(item.id);
      }
    }
    return getHierarchyIcon(level);
  };
  
  const LevelIcon = getNodeIcon();
  const levelColor = getHierarchyColor(level);
  const canExpand = level !== 'property';
  const childLevel = nextLevel[level];
  
  const handleToggle = (open: boolean) => {
    if (open && !hasRendered) {
      setHasRendered(true);
    }
    setIsOpen(open);
  };
  
  const handleClick = () => {
    if (level === 'property') {
      onPropertyClick?.(item.id);
    }
  };
  
  return (
    <div className="select-none">
      <Collapsible open={isOpen} onOpenChange={handleToggle}>
        <div 
          className={cn(
            "py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition-colors group",
            level === 'property' && "cursor-pointer"
          )}
          style={{ marginLeft: `${nodeLevel * 16}px` }}
          onClick={handleClick}
          data-testid={`tree-node-${level}-${item.id}`}
        >
          <div className="flex items-center gap-2">
            {canExpand ? (
              <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 flex-shrink-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <div className="w-6 flex-shrink-0" />
            )}
            
            <div className={cn("p-1.5 rounded-md flex-shrink-0", levelColor)}>
              <LevelIcon className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                {item.color && (
                  <span 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="font-medium text-sm truncate">{item.name}</span>
              </div>
            </div>
            
            {item.riskLevel && item.riskLevel !== 'LOW' && (
              <Badge 
                variant={item.riskLevel === 'HIGH' ? 'destructive' : 'secondary'}
                className="flex-shrink-0 text-xs"
              >
                {item.riskLevel}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1 ml-8 text-xs text-muted-foreground">
            {item.propertyCount !== undefined && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.propertyCount.toLocaleString()}
              </span>
            )}
            {item.certificateCount !== undefined && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {item.certificateCount.toLocaleString()}
              </span>
            )}
            {item.complianceRate !== undefined && (
              <span className={cn(
                "font-medium",
                item.complianceRate >= 90 ? "text-green-600" :
                item.complianceRate >= 70 ? "text-amber-600" : "text-red-600"
              )}>
                {item.complianceRate}%
              </span>
            )}
            {(item.address || item.reference) && (
              <span className="truncate">
                {item.address || item.reference}
                {item.postcode && `, ${item.postcode}`}
              </span>
            )}
          </div>
        </div>
        
        {canExpand && hasRendered && (
          <CollapsibleContent>
            <TreeChildren 
              parentId={item.id} 
              level={childLevel}
              nodeLevel={nodeLevel + 1}
              onPropertyClick={onPropertyClick}
            />
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

function TreeChildren({ 
  parentId, 
  level,
  nodeLevel,
  onPropertyClick 
}: { 
  parentId: string; 
  level: LevelType;
  nodeLevel: number;
  onPropertyClick?: (propertyId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(level === 'property' ? 20 : 50);
  
  const { data, isLoading, error } = useQuery<{ level: string; data: HierarchyItem[]; parentId: string | null }>({
    queryKey: ['/api/analytics/hierarchy', level, parentId],
    queryFn: async () => {
      const params = new URLSearchParams({ level, parentId });
      const res = await fetch(`/api/analytics/hierarchy?${params}`);
      if (!res.ok) throw new Error('Failed to fetch hierarchy data');
      return res.json();
    },
  });
  
  if (isLoading) {
    return (
      <div 
        className="py-2 px-3 text-sm text-muted-foreground flex items-center gap-2"
        style={{ marginLeft: `${nodeLevel * 24}px` }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading {levelLabels[level].toLowerCase()}s...</span>
      </div>
    );
  }
  
  if (error || !data?.data?.length) {
    return (
      <div 
        className="py-2 px-3 text-sm text-muted-foreground"
        style={{ marginLeft: `${nodeLevel * 24}px` }}
      >
        No {levelLabels[level].toLowerCase()}s found
      </div>
    );
  }
  
  const items = data.data;
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = items.length > visibleCount;
  
  return (
    <div>
      {visibleItems.map((item) => (
        <TreeNode 
          key={item.id} 
          item={item} 
          level={level}
          nodeLevel={nodeLevel}
          onPropertyClick={onPropertyClick}
        />
      ))}
      
      {hasMore && (
        <div 
          className="py-2 px-3 text-sm text-primary hover:text-primary/80 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors flex items-center gap-2"
          style={{ marginLeft: `${nodeLevel * 24}px` }}
          onClick={() => setVisibleCount(prev => prev + 20)}
        >
          <ChevronDown className="h-4 w-4" />
          <span>Show more ({items.length - visibleCount} remaining)</span>
        </div>
      )}
    </div>
  );
}

export function HierarchyExplorer({ 
  onPropertyClick,
}: HierarchyExplorerProps) {
  const { data, isLoading, error } = useQuery<{ level: string; data: HierarchyItem[]; parentId: string | null }>({
    queryKey: ['/api/analytics/hierarchy', 'stream', null],
    queryFn: async () => {
      const params = new URLSearchParams({ level: 'stream' });
      const res = await fetch(`/api/analytics/hierarchy?${params}`);
      if (!res.ok) throw new Error('Failed to fetch hierarchy data');
      return res.json();
    },
  });

  return (
    <Card data-testid="hierarchy-explorer">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Compliance Hierarchy
        </CardTitle>
        <CardDescription>
          Navigate through compliance streams, certificate types, and properties
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="hierarchy-loading">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive" data-testid="hierarchy-error">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load data</p>
          </div>
        ) : !data?.data?.length ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="hierarchy-empty">
            <p>No compliance streams found</p>
          </div>
        ) : (
          <div className="space-y-1" data-testid="hierarchy-tree">
            {data.data.map((item) => (
              <TreeNode 
                key={item.id} 
                item={item} 
                level="stream"
                onPropertyClick={onPropertyClick}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HierarchyExplorer;
