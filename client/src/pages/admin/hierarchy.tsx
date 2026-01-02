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
  Building2, Home, Layers, Plus, Pencil, Trash2, Loader2, Info, Building, MapPin,
  ChevronRight, ChevronDown, TreePine, Package, List, LayoutGrid, Network,
  Boxes, Eye, FolderTree
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { organisationsApi, schemesApi, blocksApi, propertiesApi, unitsApi, spacesApi, componentsApi, type EnrichedComponent } from "@/lib/api";
import type { Scheme, Block, Property, Unit, Space, Component } from "@shared/schema";
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

// UKHDS-compliant unit type labels
const UNIT_TYPE_LABELS: Record<string, string> = {
  DWELLING: 'Unit (Dwelling)',
  COMMUNAL_AREA: 'Communal Area',
  PLANT_ROOM: 'Plant Room',
  ROOF_SPACE: 'Roof Space',
  BASEMENT: 'Basement',
  EXTERNAL: 'External Area',
  GARAGE: 'Garage/Parking',
  COMMERCIAL: 'Commercial Unit',
  OTHER: 'Other Area',
};

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

function getUnitTypeLabel(unitType?: string): string {
  if (!unitType) return 'Unit (Dwelling)';
  return UNIT_TYPE_LABELS[unitType] || 'Unit (Dwelling)';
}

function getSpaceTypeLabel(spaceType?: string): string {
  if (!spaceType) return 'Space (Room)';
  return SPACE_TYPE_LABELS[spaceType] || 'Space (Room)';
}

interface HierarchyNode {
  id: string;
  name: string;
  type: 'scheme' | 'block' | 'property' | 'unit' | 'space' | 'component';
  reference?: string;
  status?: string;
  linkStatus?: 'VERIFIED' | 'UNVERIFIED';
  children: HierarchyNode[];
  data?: any;
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

function TreeNode({ node, level = 0, defaultOpen = true, onNodeClick }: { node: HierarchyNode; level?: number; defaultOpen?: boolean; onNodeClick?: (node: HierarchyNode) => void }) {
  // Performance optimization: only expand first 2 levels by default
  // and render children lazily (only when expanded)
  const [isOpen, setIsOpen] = useState(defaultOpen && level < 1);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level < 1);
  const hasChildren = node.children.length > 0;
  
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
    unit: 'bg-purple-100 text-purple-800 border-purple-200',
    space: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    component: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    scheme: <MapPin className="h-4 w-4" />,
    block: <Building className="h-4 w-4" />,
    property: <Home className="h-4 w-4" />,
    unit: <Layers className="h-4 w-4" />,
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
            {node.type === 'property' && 'Property (Structure)'}
            {node.type === 'unit' && getUnitTypeLabel(node.data?.unitType)}
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
              {node.children.map((child) => (
                <TreeNode key={`${child.type}-${child.id}`} node={child} level={level + 1} defaultOpen={false} onNodeClick={onNodeClick} />
              ))}
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
    unit: 'border-l-purple-500 bg-purple-50/50',
    space: 'border-l-cyan-500 bg-cyan-50/50',
    component: 'border-l-slate-500 bg-slate-50/50',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    scheme: <MapPin className="h-5 w-5 text-blue-600" />,
    block: <Building className="h-5 w-5 text-amber-600" />,
    property: <Home className="h-5 w-5 text-emerald-600" />,
    unit: <Layers className="h-5 w-5 text-purple-600" />,
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
    // Note: Housing associations typically call "Unit" as "Property" (the lettable dwelling)
    // UKHDS "Property" actually means Building/Block level
    const getTypeLabel = (node: HierarchyNode & { depth: number }): string => {
      if (node.type === 'unit') return getUnitTypeLabel(node.data?.unitType);
      if (node.type === 'space') return getSpaceTypeLabel(node.data?.spaceType);
      const baseLabels: Record<string, string> = {
        scheme: 'Scheme (Site)',
        block: 'Block (Building)',
        property: 'Property (Structure)',
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
    queryFn: () => propertiesApi.list({ limit: 200 }),
  });
  const properties = propertiesResponse?.data ?? [];

  const { data: componentsResponse, isLoading: componentsLoading } = useQuery({
    queryKey: ["components"],
    queryFn: () => componentsApi.list({ limit: 200 }),
  });
  const components = componentsResponse?.data ?? [];

  const { data: allUnits = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsApi.list(),
  });

  const { data: allSpaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => spacesApi.list(),
  });

  // Block-level unit types that should appear under Block, not Property (Housing Ops view)
  const BLOCK_LEVEL_UNIT_TYPES = new Set(['COMMUNAL_AREA', 'PLANT_ROOM', 'BASEMENT', 'EXTERNAL', 'GARAGE']);

  const hierarchyData = useMemo((): HierarchyNode[] => {
    // Helper to build unit node with its children
    const buildUnitNode = (unit: Unit, propertyId: string): HierarchyNode => {
      const unitSpaces = allSpaces.filter((s: Space) => s.unitId === unit.id);
      const getComponentName = (comp: EnrichedComponent) => {
        if (comp.componentType?.name) return comp.componentType.name;
        if (comp.manufacturer) return `${comp.manufacturer} ${comp.model || ''}`.trim();
        return comp.assetTag || comp.serialNumber || 'Component';
      };
      
      const unitComponents = components
        .filter((c: EnrichedComponent) => c.unitId === unit.id && !c.spaceId)
        .map((component: EnrichedComponent) => ({
          id: component.id,
          name: getComponentName(component),
          type: 'component' as const,
          reference: component.serialNumber || undefined,
          data: { ...component, propertyId },
          children: [],
        }));
      
      const spaceNodes: HierarchyNode[] = unitSpaces.map((space: Space) => {
        const spaceComponents = components
          .filter((c: EnrichedComponent) => c.spaceId === space.id)
          .map((component: EnrichedComponent) => ({
            id: component.id,
            name: getComponentName(component),
            type: 'component' as const,
            reference: component.serialNumber || undefined,
            data: { ...component, propertyId },
            children: [],
          }));
        
        return {
          id: space.id,
          name: space.name,
          type: 'space' as const,
          reference: space.reference || undefined,
          data: { ...space, spaceType: space.spaceType, propertyId },
          children: spaceComponents,
        };
      });
      
      return {
        id: unit.id,
        name: unit.name,
        type: 'unit' as const,
        reference: unit.reference || undefined,
        data: { ...unit, unitType: unit.unitType, propertyId },
        children: [...spaceNodes, ...unitComponents],
      };
    };

    // UKHDS 5-level hierarchy with Housing Ops view support
    // Block-level units (communal areas, plant rooms) appear under Block, not Property
    return schemes.map((scheme) => ({
      id: scheme.id,
      name: scheme.name,
      type: 'scheme' as const,
      reference: scheme.reference,
      status: scheme.complianceStatus,
      linkStatus: (scheme as any).linkStatus as 'VERIFIED' | 'UNVERIFIED' | undefined,
      data: scheme,
      children: blocks
        .filter((b) => b.schemeId === scheme.id)
        .map((block) => {
          const blockProperties = properties.filter((p: Property) => p.blockId === block.id);
          
          // Collect block-level units from all properties in this block
          const blockLevelUnits: HierarchyNode[] = [];
          
          const getComponentName = (comp: EnrichedComponent) => {
            if (comp.componentType?.name) return comp.componentType.name;
            if (comp.manufacturer) return `${comp.manufacturer} ${comp.model || ''}`.trim();
            return comp.assetTag || comp.serialNumber || 'Component';
          };
          
          const propertyNodes = blockProperties.map((property: Property) => {
            const propertyUnits = allUnits.filter((u: Unit) => u.propertyId === property.id);
            
            // Separate dwelling units from block-level units
            const dwellingUnits = propertyUnits.filter((u: Unit) => !BLOCK_LEVEL_UNIT_TYPES.has(u.unitType));
            const blockUnits = propertyUnits.filter((u: Unit) => BLOCK_LEVEL_UNIT_TYPES.has(u.unitType));
            
            // Add block-level units to the block's children
            blockUnits.forEach((unit: Unit) => {
              blockLevelUnits.push(buildUnitNode(unit, property.id));
            });
            
            const directComponents = components
              .filter((c: EnrichedComponent) => c.propertyId === property.id && !c.unitId && !c.spaceId)
              .map((component: EnrichedComponent) => ({
                id: component.id,
                name: getComponentName(component),
                type: 'component' as const,
                reference: component.serialNumber || undefined,
                data: { ...component, propertyId: property.id },
                children: [],
              }));
            
            const unitNodes: HierarchyNode[] = dwellingUnits.map((unit: Unit) => 
              buildUnitNode(unit, property.id)
            );
            
            return {
              id: property.id,
              name: `${property.addressLine1}, ${property.postcode}`,
              type: 'property' as const,
              reference: property.uprn,
              status: property.complianceStatus,
              linkStatus: (property as any).linkStatus as 'VERIFIED' | 'UNVERIFIED' | undefined,
              data: property,
              children: [...unitNodes, ...directComponents],
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
            // Block-level units appear directly under block, before properties
            children: [...blockLevelUnits, ...propertyNodes],
          };
        }),
    }));
  }, [schemes, blocks, properties, allUnits, allSpaces, components]);

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

  const isLoading = orgsLoading || schemesLoading || blocksLoading || propertiesLoading || componentsLoading || unitsLoading || spacesLoading;

  const totalCounts = {
    organisations: organisations.length,
    schemes: schemes.length,
    blocks: blocks.length,
    properties: properties.length,
    units: allUnits.length,
    spaces: allSpaces.length,
    components: components.length,
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
      case 'unit':
        // Navigate to properties page filtered by this unit's property
        if (node.data?.propertyId) {
          setLocation(`/properties/${node.data.propertyId}?tab=units&unit=${node.id}`);
        } else {
          toast({ 
            title: "Unit Selected", 
            description: node.name 
          });
        }
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
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <TreePine className="h-6 w-6 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Property Hierarchy</h1>
              </div>
              <p className="text-gray-600">
                Manage your property portfolio structure following the UKHDS 5-level asset hierarchy.
              </p>
              <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    <strong>UKHDS Asset Hierarchy:</strong> Organisation → Scheme (Site/Estate) → Block (Building) → Property/Unit (Dwelling/Home) → Space (Room) → Component (Asset)
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-800">
                    <strong>Terminology Note:</strong> "Homes" combines both <strong>Properties</strong> (structures) and <strong>Units</strong> (dwellings) - what housing associations typically call their "Properties". 
                    In UKHDS, "Property" refers to a structure within a Block, while "Unit" is the individual lettable home (flat, house). For most operational purposes, these function as the same concept.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-3 mb-6">
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4 text-center">
                  <Building2 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-900">{totalCounts.organisations}</div>
                  <div className="text-sm text-purple-600">Organisations</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-900">{totalCounts.schemes}</div>
                  <div className="text-sm text-blue-600">Schemes</div>
                  <div className="text-xs text-blue-400 mt-0.5">Site Layer</div>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4 text-center">
                  <Building className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-amber-900">{totalCounts.blocks}</div>
                  <div className="text-sm text-amber-600">Blocks</div>
                  <div className="text-xs text-amber-400 mt-0.5">Building Layer</div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200 col-span-2">
                <CardContent className="p-4 text-center">
                  <Home className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-emerald-900">{totalCounts.properties + totalCounts.units}</div>
                  <div className="text-sm text-emerald-600">Homes</div>
                  <div className="text-xs text-emerald-400 mt-0.5">Properties/Units (Dwellings)</div>
                  <div className="text-[10px] text-emerald-500 mt-1">
                    {totalCounts.properties} structures + {totalCounts.units} dwellings
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-cyan-50 border-cyan-200">
                <CardContent className="p-3 text-center">
                  <FolderTree className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-cyan-900">{totalCounts.spaces}</div>
                  <div className="text-xs text-cyan-600">Spaces</div>
                  <div className="text-xs text-cyan-400">Room</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-3 text-center">
                  <Package className="h-5 w-5 text-slate-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-slate-900">{totalCounts.components}</div>
                  <div className="text-xs text-slate-600">Components</div>
                  <div className="text-xs text-slate-400">Asset</div>
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
                    <CardDescription>
                      All components and assets across your property portfolio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {componentsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Install Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {components.map((component: EnrichedComponent) => {
                            const property = properties.find((p: Property) => p.id === component.propertyId);
                            const componentTypeName = component.componentType?.name || component.componentTypeId || '-';
                            const componentName = component.manufacturer ? `${component.manufacturer} ${component.model || ''}`.trim() : (component.assetTag || component.serialNumber || componentTypeName);
                            return (
                              <TableRow key={component.id} data-testid={`row-component-${component.id}`}>
                                <TableCell className="font-medium">{componentName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{componentTypeName}</Badge>
                                </TableCell>
                                <TableCell>{component.serialNumber || '-'}</TableCell>
                                <TableCell>{property ? `${property.addressLine1}, ${property.postcode}` : '-'}</TableCell>
                                <TableCell>
                                  {component.installDate ? new Date(component.installDate).toLocaleDateString() : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {components.length === 0 && (
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
