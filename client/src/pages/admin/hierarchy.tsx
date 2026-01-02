import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Building2, Home, Plus, Pencil, Trash2, Loader2, Info, Building, MapPin,
  ChevronRight, ChevronDown, TreePine, Package, List, LayoutGrid, Network,
  Boxes, Eye, FolderTree
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { organisationsApi, schemesApi, blocksApi, propertiesApi, spacesApi, componentsApi, type EnrichedComponent } from "@/lib/api";
import type { Scheme, Block, Property, Space, Component } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Organisation = {
  id: string;
  name: string;
  slug: string;
  settings?: any;
  createdAt: string;
  updatedAt: string;
};

type ViewMode = 'tree' | 'list' | 'grid';

// UKHDS-compliant space type labels
const SPACE_TYPE_LABELS: Record<string, string> = {
  ROOM: 'Space (Room)',
  COMMUNAL_AREA: 'Communal Space',
  EXTERNAL: 'External Space',
  CIRCULATION: 'Circulation',
  UTILITY: 'Utility Space',
  STORAGE: 'Storage',
  OTHER: 'Other Space',
};

function getSpaceTypeLabel(spaceType?: string): string {
  if (!spaceType) return 'Space (Room)';
  return SPACE_TYPE_LABELS[spaceType] || 'Space (Room)';
}

interface HierarchyNode {
  id: string;
  name: string;
  type: 'scheme' | 'block' | 'property' | 'space' | 'component';
  reference?: string;
  status?: string;
  linkStatus?: 'VERIFIED' | 'UNVERIFIED';
  children: HierarchyNode[];
  data?: any;
  // For lazy loading components
  propertyId?: string;
  spaceId?: string;
  hasComponents?: boolean; // Flag to indicate this node can have components loaded on-demand
}

function HactBadge({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className="ml-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
          HACT: {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>UK Housing Data Standards (UKHDS) terminology</p>
      </TooltipContent>
    </Tooltip>
  );
}

const INITIAL_COMPONENT_DISPLAY = 5; // Show first 5 components, then paginate

// Lazy loader for components - fetches on-demand when parent is expanded
function LazyComponentsLoader({ 
  propertyId, 
  spaceId, 
  level, 
  onNodeClick 
}: { 
  propertyId?: string; 
  spaceId?: string; 
  level: number; 
  onNodeClick?: (node: HierarchyNode) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COMPONENT_DISPLAY);
  
  // Fetch components for this property/space on-demand
  const { data: componentsResponse, isLoading, isError } = useQuery({
    queryKey: ["components", "hierarchy", propertyId, spaceId],
    queryFn: () => componentsApi.list({ 
      propertyId: propertyId || undefined,
      spaceId: spaceId || undefined,
      limit: 100 
    }),
    enabled: !!(propertyId || spaceId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const components = componentsResponse?.data ?? [];
  
  // Filter by spaceId if provided, otherwise show components without spaceId (direct property components)
  const filteredComponents = spaceId 
    ? components.filter(c => c.spaceId === spaceId)
    : components.filter(c => !c.spaceId);
  
  const visibleComponents = filteredComponents.slice(0, visibleCount);
  const hasMore = filteredComponents.length > visibleCount;
  
  const getComponentName = (comp: EnrichedComponent) => {
    if (comp.componentType?.name) return comp.componentType.name;
    if (comp.manufacturer) return `${comp.manufacturer} ${comp.model || ''}`.trim();
    return comp.assetTag || comp.serialNumber || 'Component';
  };
  
  if (isLoading) {
    return (
      <div 
        className="py-2 px-3 text-sm text-slate-500 flex items-center gap-2"
        style={{ marginLeft: `${level * 24}px` }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading components...</span>
      </div>
    );
  }
  
  if (isError || filteredComponents.length === 0) {
    return null; // No components to show
  }
  
  return (
    <>
      {visibleComponents.map((component) => (
        <div
          key={component.id}
          className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors group cursor-pointer"
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => onNodeClick?.({
            id: component.id,
            name: getComponentName(component),
            type: 'component',
            reference: component.serialNumber || undefined,
            data: component,
            children: [],
          })}
          data-testid={`tree-node-component-${component.id}`}
        >
          <div className="w-6" />
          <div className="p-1.5 rounded-md bg-slate-100 text-slate-800 border-slate-200">
            <Package className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 truncate hover:underline">
                {getComponentName(component)}
              </span>
              {component.serialNumber && (
                <span className="text-xs text-slate-500">({component.serialNumber})</span>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Component (Asset)</Badge>
        </div>
      ))}
      
      {hasMore && (
        <div 
          className="py-2 px-3 text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => setVisibleCount(prev => prev + 10)}
          data-testid={`load-more-components-${propertyId || spaceId}`}
        >
          <Package className="h-4 w-4" />
          <span>Show {Math.min(10, filteredComponents.length - visibleCount)} more components</span>
          <span className="text-slate-400">({filteredComponents.length - visibleCount} remaining)</span>
        </div>
      )}
    </>
  );
}

function TreeNode({ node, level = 0, defaultOpen = true, onNodeClick }: { node: HierarchyNode; level?: number; defaultOpen?: boolean; onNodeClick?: (node: HierarchyNode) => void }) {
  // Performance optimization: only expand first 2 levels by default
  // and render children lazily (only when expanded)
  const [isOpen, setIsOpen] = useState(defaultOpen && level < 1);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level < 1);
  const [visibleComponentCount, setVisibleComponentCount] = useState(INITIAL_COMPONENT_DISPLAY);
  
  // Separate component children from other children for progressive loading
  const componentChildren = node.children.filter(child => child.type === 'component');
  const otherChildren = node.children.filter(child => child.type !== 'component');
  const hasMoreComponents = componentChildren.length > visibleComponentCount;
  const visibleComponents = componentChildren.slice(0, visibleComponentCount);
  
  // A node is expandable if it has children OR if it has components that will load on-demand
  const hasChildren = node.children.length > 0 || node.hasComponents;
  
  // Lazy render children - only mount when first opened
  const handleOpenChange = (open: boolean) => {
    if (open && !hasRenderedChildren) {
      setHasRenderedChildren(true);
    }
    setIsOpen(open);
  };
  
  const typeColors: Record<string, string> = {
    scheme: 'bg-blue-100 text-blue-800 border-blue-200',
    block: 'bg-amber-100 text-amber-800 border-amber-200',
    property: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    space: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    component: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    scheme: <MapPin className="h-4 w-4" />,
    block: <Building className="h-4 w-4" />,
    property: <Home className="h-4 w-4" />,
    space: <FolderTree className="h-4 w-4" />,
    component: <Package className="h-4 w-4" />,
  };
  
  const statusColors: Record<string, string> = {
    COMPLIANT: 'bg-green-500',
    NON_COMPLIANT: 'bg-red-500',
    PENDING: 'bg-yellow-500',
    UNKNOWN: 'bg-gray-400',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div className="select-none">
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div 
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors group cursor-pointer",
            level === 0 && "bg-slate-50"
          )}
          style={{ marginLeft: `${level * 24}px` }}
          onClick={handleClick}
          data-testid={`tree-node-${node.type}-${node.id}`}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}
          
          <div className={cn("p-1.5 rounded-md", typeColors[node.type])}>
            {typeIcons[node.type]}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 truncate hover:underline">{node.name}</span>
              {node.reference && (
                <span className="text-xs text-slate-500">({node.reference})</span>
              )}
            </div>
          </div>
          
          {node.linkStatus === 'UNVERIFIED' && (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
              Unverified
            </Badge>
          )}
          
          {node.status && (
            <div className={cn("w-2 h-2 rounded-full", statusColors[node.status] || statusColors.UNKNOWN)} />
          )}
          
          <Badge variant="secondary" className="text-xs">
            {node.type === 'scheme' && 'Scheme (Site)'}
            {node.type === 'block' && 'Block (Building)'}
            {node.type === 'property' && 'Dwelling (Property)'}
            {node.type === 'space' && getSpaceTypeLabel(node.data?.spaceType)}
            {node.type === 'component' && 'Component (Asset)'}
          </Badge>
          
          {hasChildren && (
            <span className="text-xs text-slate-400">
              {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        
        {hasChildren && hasRenderedChildren && (
          <CollapsibleContent>
            <div className="border-l-2 border-slate-200 ml-6">
              {/* Render non-component children first (spaces, properties, etc.) */}
              {otherChildren.map((child) => (
                <TreeNode key={`${child.type}-${child.id}`} node={child} level={level + 1} defaultOpen={false} onNodeClick={onNodeClick} />
              ))}
              
              {/* Render inline component children with progressive loading */}
              {visibleComponents.map((child) => (
                <TreeNode key={`${child.type}-${child.id}`} node={child} level={level + 1} defaultOpen={false} onNodeClick={onNodeClick} />
              ))}
              
              {/* Load more inline components button */}
              {hasMoreComponents && (
                <div 
                  className="py-2 px-3 ml-6 text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                  style={{ marginLeft: `${(level + 1) * 24}px` }}
                  onClick={() => setVisibleComponentCount(prev => prev + 10)}
                  data-testid={`load-more-components-${node.id}`}
                >
                  <Package className="h-4 w-4" />
                  <span>Show {Math.min(10, componentChildren.length - visibleComponentCount)} more components</span>
                  <span className="text-slate-400">({componentChildren.length - visibleComponentCount} remaining)</span>
                </div>
              )}
              
              {/* Lazy load components for properties and spaces */}
              {(node.type === 'property' || node.type === 'space') && node.hasComponents && (
                <LazyComponentsLoader
                  propertyId={node.propertyId || (node.type === 'property' ? node.id : undefined)}
                  spaceId={node.type === 'space' ? node.id : undefined}
                  level={level + 1}
                  onNodeClick={onNodeClick}
                />
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

function GridCard({ node }: { node: HierarchyNode }) {
  const typeColors: Record<string, string> = {
    scheme: 'border-l-blue-500 bg-blue-50/50',
    block: 'border-l-amber-500 bg-amber-50/50',
    property: 'border-l-emerald-500 bg-emerald-50/50',
    space: 'border-l-cyan-500 bg-cyan-50/50',
    component: 'border-l-slate-500 bg-slate-50/50',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    scheme: <MapPin className="h-5 w-5 text-blue-600" />,
    block: <Building className="h-5 w-5 text-amber-600" />,
    property: <Home className="h-5 w-5 text-emerald-600" />,
    space: <FolderTree className="h-5 w-5 text-cyan-600" />,
    component: <Package className="h-5 w-5 text-slate-600" />,
  };

  return (
    <Card className={cn("border-l-4 hover:shadow-md transition-shadow", typeColors[node.type])}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white shadow-sm">
            {typeIcons[node.type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 truncate">{node.name}</h4>
            {node.reference && (
              <p className="text-sm text-slate-500">{node.reference}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs capitalize">{node.type}</Badge>
              {node.children.length > 0 && (
                <span className="text-xs text-slate-400">
                  {node.children.length} children
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisualHierarchy({ hierarchyData, viewMode, onNodeClick }: { hierarchyData: HierarchyNode[]; viewMode: ViewMode; onNodeClick?: (node: HierarchyNode) => void }) {
  if (viewMode === 'tree') {
    return (
      <div className="space-y-1">
        {hierarchyData.map((node) => (
          <TreeNode key={`${node.type}-${node.id}`} node={node} onNodeClick={onNodeClick} />
        ))}
      </div>
    );
  }
  
  const flattenNodes = (nodes: HierarchyNode[], depth = 0): (HierarchyNode & { depth: number })[] => {
    return nodes.flatMap(node => [
      { ...node, depth },
      ...flattenNodes(node.children, depth + 1)
    ]);
  };
  
  const allNodes = flattenNodes(hierarchyData);

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {allNodes.slice(0, 50).map((node, index) => (
          <GridCard key={`${node.type}-${node.id}-${index}`} node={node} />
        ))}
        {allNodes.length > 50 && (
          <div className="col-span-full text-center text-slate-500 py-4">
            Showing first 50 of {allNodes.length} items. Use Tree view for full hierarchy.
          </div>
        )}
      </div>
    );
  }
  
  if (viewMode === 'list') {
    // UKHDS hierarchy labels with housing association friendly terms
    const getTypeLabel = (node: HierarchyNode & { depth: number }): string => {
      if (node.type === 'space') return getSpaceTypeLabel(node.data?.spaceType);
      const baseLabels: Record<string, string> = {
        scheme: 'Scheme (Site)',
        block: 'Block (Building)',
        property: 'Dwelling (Property)',
        component: 'Component (Asset)',
      };
      return baseLabels[node.type] || node.type;
    };

    const statusColors: Record<string, string> = {
      COMPLIANT: 'bg-green-100 text-green-800',
      NON_COMPLIANT: 'bg-red-100 text-red-800',
      EXPIRING_SOON: 'bg-amber-100 text-amber-800',
      UNKNOWN: 'bg-gray-100 text-gray-800',
    };

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Children</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allNodes.slice(0, 100).map((node, index) => (
              <TableRow key={`${node.type}-${node.id}-${index}`} data-testid={`list-row-${node.type}-${node.id}`}>
                <TableCell className="py-2">
                  <div style={{ marginLeft: `${node.depth * 16}px` }} className="w-2 h-2 rounded-full bg-slate-400" />
                </TableCell>
                <TableCell className="font-medium">{node.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{getTypeLabel(node)}</Badge>
                </TableCell>
                <TableCell className="text-slate-500">{node.reference || '-'}</TableCell>
                <TableCell>
                  {node.status ? (
                    <Badge className={statusColors[node.status] || statusColors.UNKNOWN}>
                      {node.status.replace('_', ' ')}
                    </Badge>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-slate-500">{node.children.length || '-'}</TableCell>
              </TableRow>
            ))}
            {allNodes.length > 100 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-4">
                  Showing first 100 of {allNodes.length} items. Use Tree view for full hierarchy.
                </TableCell>
              </TableRow>
            )}
            {allNodes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  No hierarchy data found. Add organisations and properties to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }
  
  return null;
}

const HIERARCHY_STATE_KEY = 'complianceai_hierarchy_state';

export default function PropertyHierarchy() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    document.title = "Property Hierarchy - ComplianceAI";
    // Save current location to localStorage for "back" navigation
    localStorage.setItem(HIERARCHY_STATE_KEY, JSON.stringify({ 
      lastVisited: Date.now(),
      viewMode: 'tree'
    }));
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Restore view mode from localStorage
  const savedState = useMemo(() => {
    try {
      const saved = localStorage.getItem(HIERARCHY_STATE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);
  
  const [mainTab, setMainTab] = useState<'properties' | 'assets'>('properties');
  const [viewMode, setViewMode] = useState<ViewMode>(savedState?.viewMode || 'tree');
  const [showVisualView, setShowVisualView] = useState(true);
  
  // Save view mode changes
  useEffect(() => {
    localStorage.setItem(HIERARCHY_STATE_KEY, JSON.stringify({ 
      lastVisited: Date.now(),
      viewMode 
    }));
  }, [viewMode]);
  
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showSchemeDialog, setShowSchemeDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  
  const [orgForm, setOrgForm] = useState({ name: "", slug: "" });
  const [schemeForm, setSchemeForm] = useState({ name: "", reference: "" });
  const [blockForm, setBlockForm] = useState({ 
    name: "", 
    reference: "", 
    schemeId: "",
    hasLift: false, 
    hasCommunalBoiler: false 
  });

  const { data: organisations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["organisations"],
    queryFn: organisationsApi.list,
  });

  const { data: schemes = [], isLoading: schemesLoading } = useQuery({
    queryKey: ["schemes"],
    queryFn: schemesApi.list,
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => blocksApi.list(),
  });

  const { data: propertiesResponse, isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list({ limit: 500 }),
  });
  const properties = propertiesResponse?.data ?? [];

  // Components for tree view are loaded on-demand per property/space via LazyComponentsLoader
  // This query is for the Assets tab and dashboard count
  const { data: assetsResponse, isLoading: assetsLoading } = useQuery({
    queryKey: ["components", "assets-tab"],
    queryFn: () => componentsApi.list({ limit: 50 }), // First page for list view
  });
  const assetsList = assetsResponse?.data ?? [];
  const assetsTotalCount = assetsResponse?.total ?? assetsList.length;

  const { data: allSpaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => spacesApi.list(),
  });


  const hierarchyData = useMemo((): HierarchyNode[] => {
    // Helper to get component display name
    const getComponentName = (comp: EnrichedComponent) => {
      if (comp.componentType?.name) return comp.componentType.name;
      if (comp.manufacturer) return `${comp.manufacturer} ${comp.model || ''}`.trim();
      return comp.assetTag || comp.serialNumber || 'Component';
    };
    
    // Helper to build space node - components are loaded on-demand via LazyComponentsLoader
    // Spaces can attach to: properties (dwelling rooms), blocks (communal), or schemes (estate-wide)
    const buildSpaceNode = (space: Space, context: { propertyId?: string; blockId?: string; schemeId?: string } = {}): HierarchyNode => {
      // Determine hierarchy level based on which ID is set
      const hierarchyLevel = (space as any).propertyId ? 'property' : (space as any).blockId ? 'block' : (space as any).schemeId ? 'scheme' : 'unknown';
      
      return {
        id: space.id,
        name: space.name,
        type: 'space' as const,
        reference: space.reference || undefined,
        data: { 
          ...space, 
          spaceType: space.spaceType, 
          hierarchyLevel,
          ...context 
        },
        children: [], // Components loaded on-demand
        propertyId: context.propertyId, // For component loading
        hasComponents: true, // Enable lazy component loading
      };
    };

    // UKHDS 5-level hierarchy: Scheme → Block → Property (Dwelling) → Space → Component
    // Spaces attach directly to properties, blocks, or schemes (no units table)
    return schemes.map((scheme) => {
      // Scheme-level spaces: spaces with schemeId set (estate-wide communal areas)
      const schemeLevelSpaces: HierarchyNode[] = allSpaces
        .filter((s: Space) => (s as any).schemeId === scheme.id && !(s as any).blockId && !(s as any).propertyId)
        .map((space: Space) => buildSpaceNode(space, { schemeId: scheme.id }));
      
      const blockNodes = blocks
        .filter((b) => b.schemeId === scheme.id)
        .map((block) => {
          const blockProperties = properties.filter((p: Property) => p.blockId === block.id);
          
          // Block-level spaces: communal areas, plant rooms, stairwells, etc.
          const blockLevelSpaces: HierarchyNode[] = allSpaces
            .filter((s: Space) => (s as any).blockId === block.id && !(s as any).propertyId)
            .map((space: Space) => buildSpaceNode(space, { blockId: block.id }));
          
          // Build dwelling (property) nodes - in UKHDS, Property and Dwelling are the SAME entity
          // Components are loaded on-demand via LazyComponentsLoader for performance
          const dwellingNodes: HierarchyNode[] = blockProperties.map((property: Property) => {
            // Get property-level spaces (rooms within this dwelling)
            const propertySpaces = allSpaces.filter((s: Space) => (s as any).propertyId === property.id);
            const propertySpaceNodes: HierarchyNode[] = propertySpaces.map((space: Space) => 
              buildSpaceNode(space, { propertyId: property.id })
            );
            
            return {
              id: property.id,
              name: `${property.addressLine1}, ${property.postcode}`,
              type: 'property' as const,
              reference: property.uprn,
              status: property.complianceStatus,
              linkStatus: (property as any).linkStatus as 'VERIFIED' | 'UNVERIFIED' | undefined,
              data: property,
              children: propertySpaceNodes, // Components loaded on-demand
              hasComponents: true, // Enable lazy component loading
            };
          });
          
          return {
            id: block.id,
            name: block.name,
            type: 'block' as const,
            reference: block.reference,
            status: block.complianceStatus,
            linkStatus: (block as any).linkStatus as 'VERIFIED' | 'UNVERIFIED' | undefined,
            data: block,
            // Block children: communal spaces, then dwellings (properties)
            children: [...blockLevelSpaces, ...dwellingNodes],
          };
        });
      
      return {
        id: scheme.id,
        name: scheme.name,
        type: 'scheme' as const,
        reference: scheme.reference,
        status: scheme.complianceStatus,
        linkStatus: (scheme as any).linkStatus as 'VERIFIED' | 'UNVERIFIED' | undefined,
        data: scheme,
        children: [...schemeLevelSpaces, ...blockNodes],
      };
    });
  }, [schemes, blocks, properties, allSpaces]);

  const createOrgMutation = useMutation({
    mutationFn: organisationsApi.create,
    onSuccess: () => {
      toast({ title: "Success", description: "Organisation created" });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      setShowOrgDialog(false);
      setOrgForm({ name: "", slug: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Organisation> }) => organisationsApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Organisation updated" });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      setShowOrgDialog(false);
      setEditingOrg(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: organisationsApi.delete,
    onSuccess: () => {
      toast({ title: "Success", description: "Organisation deleted" });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createSchemeMutation = useMutation({
    mutationFn: schemesApi.create,
    onSuccess: () => {
      toast({ title: "Success", description: "Scheme created" });
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      setShowSchemeDialog(false);
      setSchemeForm({ name: "", reference: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSchemeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Scheme> }) => schemesApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Scheme updated" });
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      setShowSchemeDialog(false);
      setEditingScheme(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSchemeMutation = useMutation({
    mutationFn: schemesApi.delete,
    onSuccess: () => {
      toast({ title: "Success", description: "Scheme deleted" });
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: blocksApi.create,
    onSuccess: () => {
      toast({ title: "Success", description: "Block created" });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      setShowBlockDialog(false);
      setBlockForm({ name: "", reference: "", schemeId: "", hasLift: false, hasCommunalBoiler: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Block> }) => blocksApi.update(id, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Block updated" });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      setShowBlockDialog(false);
      setEditingBlock(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: blocksApi.delete,
    onSuccess: () => {
      toast({ title: "Success", description: "Block deleted" });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openOrgDialog = (org?: Organisation) => {
    if (org) {
      setEditingOrg(org);
      setOrgForm({ name: org.name, slug: org.slug });
    } else {
      setEditingOrg(null);
      setOrgForm({ name: "", slug: "" });
    }
    setShowOrgDialog(true);
  };

  const openSchemeDialog = (scheme?: Scheme) => {
    if (scheme) {
      setEditingScheme(scheme);
      setSchemeForm({ name: scheme.name, reference: scheme.reference });
    } else {
      setEditingScheme(null);
      setSchemeForm({ name: "", reference: "" });
    }
    setShowSchemeDialog(true);
  };

  const openBlockDialog = (block?: Block) => {
    if (block) {
      setEditingBlock(block);
      setBlockForm({ 
        name: block.name, 
        reference: block.reference, 
        schemeId: block.schemeId || "",
        hasLift: block.hasLift, 
        hasCommunalBoiler: block.hasCommunalBoiler 
      });
    } else {
      setEditingBlock(null);
      setBlockForm({ name: "", reference: "", schemeId: "", hasLift: false, hasCommunalBoiler: false });
    }
    setShowBlockDialog(true);
  };

  const handleOrgSubmit = () => {
    if (editingOrg) {
      updateOrgMutation.mutate({ id: editingOrg.id, data: orgForm });
    } else {
      createOrgMutation.mutate(orgForm);
    }
  };

  const handleSchemeSubmit = () => {
    if (editingScheme) {
      updateSchemeMutation.mutate({ id: editingScheme.id, data: schemeForm });
    } else {
      createSchemeMutation.mutate(schemeForm);
    }
  };

  const handleBlockSubmit = () => {
    if (editingBlock) {
      updateBlockMutation.mutate({ id: editingBlock.id, data: blockForm });
    } else {
      createBlockMutation.mutate(blockForm);
    }
  };

  const getSchemeForBlock = (schemeId: string) => {
    return schemes.find(s => s.id === schemeId);
  };

  const isLoading = orgsLoading || schemesLoading || blocksLoading || propertiesLoading || assetsLoading || spacesLoading;

  const totalCounts = {
    organisations: organisations.length,
    schemes: schemes.length,
    blocks: blocks.length,
    properties: properties.length,
    spaces: allSpaces.length,
    components: assetsTotalCount, // Use pagination total for accurate count
  };

  const handleNodeClick = (node: HierarchyNode) => {
    // Navigate to the appropriate detail page based on node type
    switch (node.type) {
      case 'property':
        setLocation(`/properties/${node.id}`);
        break;
      case 'component':
        setLocation(`/components?highlight=${node.id}`);
        break;
      case 'scheme':
        // Filter blocks by this scheme
        setLocation(`/admin/hierarchy?scheme=${node.id}`);
        toast({ 
          title: "Scheme Selected", 
          description: `Showing blocks in ${node.name}` 
        });
        break;
      case 'block':
        // Navigate to properties filtered by this block
        if (node.data?.id) {
          setLocation(`/properties?block=${node.id}`);
        } else {
          toast({ 
            title: "Block Selected", 
            description: node.name 
          });
        }
        break;
      case 'space':
        toast({ 
          title: "Space Selected", 
          description: `${node.name} - Space details coming soon` 
        });
        break;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Property Hierarchy" />
        <main className="flex-1 p-3 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3 md:mb-6">
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <TreePine className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Property Hierarchy</h1>
              </div>
              <p className="text-sm md:text-base text-gray-600 hidden md:block">
                Manage your property portfolio structure following the UKHDS 5-level asset hierarchy.
              </p>
              <div className="hidden md:block mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    <strong>UKHDS Asset Hierarchy:</strong> Organisation → Scheme (Site/Estate) → Block (Building) → Property (Dwelling/Home) → Space (Room) → Component (Asset)
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-800">
                    <strong>Terminology Note:</strong> In UKHDS, "Property" represents the Dwelling layer - the individual lettable home (flat, house). Spaces can attach to properties (rooms like Kitchen, Bedroom), blocks (communal areas like Stairwell), or schemes (estate-wide spaces).
                  </div>
                </div>
              </div>
            </div>

            <div className="flex md:grid md:grid-cols-6 gap-2 md:gap-3 mb-3 md:mb-6 overflow-x-auto scrollbar-hide pb-1">
              <Card className="bg-purple-50 border-purple-200 shrink-0 w-20 md:w-auto">
                <CardContent className="p-2 md:p-4 text-center">
                  <Building2 className="h-4 w-4 md:h-6 md:w-6 text-purple-600 mx-auto mb-1 md:mb-2" />
                  <div className="text-lg md:text-2xl font-bold text-purple-900">{totalCounts.organisations}</div>
                  <div className="text-xs md:text-sm text-purple-600 truncate">Orgs</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200 shrink-0 w-20 md:w-auto">
                <CardContent className="p-2 md:p-4 text-center">
                  <MapPin className="h-4 w-4 md:h-6 md:w-6 text-blue-600 mx-auto mb-1 md:mb-2" />
                  <div className="text-lg md:text-2xl font-bold text-blue-900">{totalCounts.schemes}</div>
                  <div className="text-xs md:text-sm text-blue-600">Schemes</div>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200 shrink-0 w-20 md:w-auto">
                <CardContent className="p-2 md:p-4 text-center">
                  <Building className="h-4 w-4 md:h-6 md:w-6 text-amber-600 mx-auto mb-1 md:mb-2" />
                  <div className="text-lg md:text-2xl font-bold text-amber-900">{totalCounts.blocks}</div>
                  <div className="text-xs md:text-sm text-amber-600">Blocks</div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200 shrink-0 w-24 md:w-auto md:col-span-2">
                <CardContent className="p-2 md:p-4 text-center">
                  <Home className="h-4 w-4 md:h-6 md:w-6 text-emerald-600 mx-auto mb-1 md:mb-2" />
                  <div className="text-lg md:text-2xl font-bold text-emerald-900">{totalCounts.properties}</div>
                  <div className="text-xs md:text-sm text-emerald-600">Dwellings</div>
                </CardContent>
              </Card>
              <Card className="bg-cyan-50 border-cyan-200 shrink-0 w-20 md:w-auto">
                <CardContent className="p-2 md:p-3 text-center">
                  <FolderTree className="h-4 w-4 md:h-5 md:w-5 text-cyan-600 mx-auto mb-1" />
                  <div className="text-lg md:text-xl font-bold text-cyan-900">{totalCounts.spaces}</div>
                  <div className="text-xs text-cyan-600">Spaces</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200 shrink-0 w-24 md:w-auto">
                <CardContent className="p-2 md:p-3 text-center">
                  <Package className="h-4 w-4 md:h-5 md:w-5 text-slate-600 mx-auto mb-1" />
                  <div className="text-lg md:text-xl font-bold text-slate-900">{totalCounts.components}</div>
                  <div className="text-xs text-slate-600">Components</div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'properties' | 'assets')} className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="properties" className="flex items-center gap-2" data-testid="tab-properties">
                    <FolderTree className="h-4 w-4" />
                    Properties
                  </TabsTrigger>
                  <TabsTrigger value="assets" className="flex items-center gap-2" data-testid="tab-assets">
                    <Boxes className="h-4 w-4" />
                    Assets
                  </TabsTrigger>
                </TabsList>
                
                {mainTab === 'properties' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <Switch 
                        id="visual-view" 
                        checked={showVisualView} 
                        onCheckedChange={setShowVisualView}
                        data-testid="switch-visual-view"
                      />
                      <Label htmlFor="visual-view" className="text-sm">Visual View</Label>
                    </div>
                    
                    {showVisualView && (
                      <div className="flex bg-slate-100 rounded-lg p-1">
                        <Button
                          variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('tree')}
                          className="gap-1"
                          data-testid="button-view-tree"
                        >
                          <Network className="h-4 w-4" />
                          Tree
                        </Button>
                        <Button
                          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('grid')}
                          className="gap-1"
                          data-testid="button-view-grid"
                        >
                          <LayoutGrid className="h-4 w-4" />
                          Grid
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                          className="gap-1"
                          data-testid="button-view-list"
                        >
                          <List className="h-4 w-4" />
                          List
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <TabsContent value="properties">
                {showVisualView ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TreePine className="h-5 w-5 text-emerald-600" />
                        Visual Hierarchy
                      </CardTitle>
                      <CardDescription>
                        Interactive view of your entire property portfolio structure
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="flex justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        </div>
                      ) : hierarchyData.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <FolderTree className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                          <p>No hierarchy data yet. Start by adding an organisation below.</p>
                        </div>
                      ) : (
                        <VisualHierarchy hierarchyData={hierarchyData} viewMode={viewMode} onNodeClick={handleNodeClick} />
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Tabs defaultValue="organisations" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="organisations" className="flex items-center gap-2" data-testid="tab-organisations">
                        <Building2 className="h-4 w-4" />
                        Organisations
                      </TabsTrigger>
                      <TabsTrigger value="schemes" className="flex items-center gap-2" data-testid="tab-schemes">
                        <MapPin className="h-4 w-4" />
                        Schemes
                        <HactBadge label="Site" />
                      </TabsTrigger>
                      <TabsTrigger value="blocks" className="flex items-center gap-2" data-testid="tab-blocks">
                        <Building className="h-4 w-4" />
                        Blocks
                        <HactBadge label="Property" />
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="organisations">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle>Organisations</CardTitle>
                            <CardDescription>Housing associations and landlords</CardDescription>
                          </div>
                          <Button onClick={() => openOrgDialog()} data-testid="button-add-organisation">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Organisation
                          </Button>
                        </CardHeader>
                        <CardContent>
                          {orgsLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Slug</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {organisations.map((org: Organisation) => (
                                  <TableRow key={org.id} data-testid={`row-organisation-${org.id}`}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>{org.slug}</TableCell>
                                    <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openOrgDialog(org)} data-testid={`button-edit-organisation-${org.id}`}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteOrgMutation.mutate(org.id)} data-testid={`button-delete-organisation-${org.id}`}>
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {organisations.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                      No organisations found. Click "Add Organisation" to create one.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="schemes">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center">
                              Schemes
                              <HactBadge label="Site" />
                            </CardTitle>
                            <CardDescription>Estates, housing developments, or groups of properties</CardDescription>
                          </div>
                          <Button onClick={() => openSchemeDialog()} data-testid="button-add-scheme">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Scheme
                          </Button>
                        </CardHeader>
                        <CardContent>
                          {schemesLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Reference</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemes.map((scheme) => (
                                  <TableRow key={scheme.id} data-testid={`row-scheme-${scheme.id}`}>
                                    <TableCell className="font-medium">{scheme.name}</TableCell>
                                    <TableCell>{scheme.reference}</TableCell>
                                    <TableCell>
                                      <Badge variant={scheme.complianceStatus === 'COMPLIANT' ? 'default' : 'destructive'}>
                                        {scheme.complianceStatus}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openSchemeDialog(scheme)} data-testid={`button-edit-scheme-${scheme.id}`}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteSchemeMutation.mutate(scheme.id)} data-testid={`button-delete-scheme-${scheme.id}`}>
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {schemes.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                      No schemes found. Click "Add Scheme" to create one.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="blocks">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center">
                              Blocks
                              <HactBadge label="Property/Building" />
                            </CardTitle>
                            <CardDescription>Buildings or structures within a scheme</CardDescription>
                          </div>
                          <Button onClick={() => openBlockDialog()} data-testid="button-add-block">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Block
                          </Button>
                        </CardHeader>
                        <CardContent>
                          {blocksLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Reference</TableHead>
                                  <TableHead>Scheme</TableHead>
                                  <TableHead>Features</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {blocks.map((block) => (
                                  <TableRow key={block.id} data-testid={`row-block-${block.id}`}>
                                    <TableCell className="font-medium">{block.name}</TableCell>
                                    <TableCell>{block.reference}</TableCell>
                                    <TableCell>{block.schemeId ? getSchemeForBlock(block.schemeId)?.name || '-' : '-'}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        {block.hasLift && <Badge variant="outline">Lift</Badge>}
                                        {block.hasCommunalBoiler && <Badge variant="outline">Communal Boiler</Badge>}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={block.complianceStatus === 'COMPLIANT' ? 'default' : 'destructive'}>
                                        {block.complianceStatus}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openBlockDialog(block)} data-testid={`button-edit-block-${block.id}`}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteBlockMutation.mutate(block.id)} data-testid={`button-delete-block-${block.id}`}>
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {blocks.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                      No blocks found. Click "Add Block" to create one.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>

              <TabsContent value="assets">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Boxes className="h-5 w-5 text-slate-600" />
                      Assets (Components)
                    </CardTitle>
                    <CardDescription className="flex items-center justify-between">
                      <span>Showing recent components. View the full list on the Components page.</span>
                      <Button variant="link" size="sm" onClick={() => setLocation('/components')}>
                        View All ({assetsTotalCount.toLocaleString()})
                      </Button>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assetsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Manufacturer / Model</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Install Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assetsList.map((component: EnrichedComponent) => {
                            const property = properties.find((p: Property) => p.id === component.propertyId);
                            const componentTypeName = component.componentType?.name || 'Unknown';
                            const categoryName = component.componentType?.category || 'OTHER';
                            return (
                              <TableRow key={component.id} data-testid={`row-component-${component.id}`}>
                                <TableCell className="font-medium">{componentTypeName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{categoryName}</Badge>
                                </TableCell>
                                <TableCell>
                                  {component.manufacturer || component.model ? (
                                    <>
                                      <span className="font-medium">{component.manufacturer}</span>
                                      {component.model && <span className="text-muted-foreground"> / {component.model}</span>}
                                    </>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>{property ? `${property.addressLine1}, ${property.postcode}` : '-'}</TableCell>
                                <TableCell>
                                  {component.installDate ? new Date(component.installDate).toLocaleDateString() : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {assetsList.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                No components found. Add components via the Components page.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Edit Organisation" : "Add Organisation"}</DialogTitle>
            <DialogDescription>
              {editingOrg ? "Update organisation details" : "Create a new housing association or landlord"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input 
                id="org-name" 
                value={orgForm.name} 
                onChange={(e) => setOrgForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Housing Association"
                data-testid="input-organisation-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input 
                id="org-slug" 
                value={orgForm.slug} 
                onChange={(e) => setOrgForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="e.g. acme-ha"
                data-testid="input-organisation-slug"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrgDialog(false)}>Cancel</Button>
            <Button onClick={handleOrgSubmit} disabled={!orgForm.name || !orgForm.slug} data-testid="button-save-organisation">
              {editingOrg ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSchemeDialog} onOpenChange={setShowSchemeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingScheme ? "Edit Scheme" : "Add Scheme"}</DialogTitle>
            <DialogDescription>
              {editingScheme ? "Update scheme details" : "Create a new estate or development"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scheme-name">Name</Label>
              <Input 
                id="scheme-name" 
                value={schemeForm.name} 
                onChange={(e) => setSchemeForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Riverside Estate"
                data-testid="input-scheme-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme-reference">Reference</Label>
              <Input 
                id="scheme-reference" 
                value={schemeForm.reference} 
                onChange={(e) => setSchemeForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. RS001"
                data-testid="input-scheme-reference"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchemeDialog(false)}>Cancel</Button>
            <Button onClick={handleSchemeSubmit} disabled={!schemeForm.name || !schemeForm.reference} data-testid="button-save-scheme">
              {editingScheme ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlock ? "Edit Block" : "Add Block"}</DialogTitle>
            <DialogDescription>
              {editingBlock ? "Update block details" : "Create a new building or structure"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-name">Name</Label>
              <Input 
                id="block-name" 
                value={blockForm.name} 
                onChange={(e) => setBlockForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tower A"
                data-testid="input-block-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reference">Reference</Label>
              <Input 
                id="block-reference" 
                value={blockForm.reference} 
                onChange={(e) => setBlockForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. BLK-001"
                data-testid="input-block-reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-scheme">Scheme</Label>
              <Select value={blockForm.schemeId} onValueChange={(value) => setBlockForm(f => ({ ...f, schemeId: value }))}>
                <SelectTrigger id="block-scheme" data-testid="select-block-scheme">
                  <SelectValue placeholder="Select a scheme" />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((scheme) => (
                    <SelectItem key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="block-lift">Has Lift</Label>
              <Switch 
                id="block-lift" 
                checked={blockForm.hasLift} 
                onCheckedChange={(checked) => setBlockForm(f => ({ ...f, hasLift: checked }))}
                data-testid="switch-block-lift"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="block-boiler">Has Communal Boiler</Label>
              <Switch 
                id="block-boiler" 
                checked={blockForm.hasCommunalBoiler} 
                onCheckedChange={(checked) => setBlockForm(f => ({ ...f, hasCommunalBoiler: checked }))}
                data-testid="switch-block-boiler"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button onClick={handleBlockSubmit} disabled={!blockForm.name || !blockForm.reference || !blockForm.schemeId} data-testid="button-save-block">
              {editingBlock ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
