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
import { organisationsApi, schemesApi, blocksApi, propertiesApi, componentsApi } from "@/lib/api";
import type { Scheme, Block, Property, Component } from "@shared/schema";
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

interface HierarchyNode {
  id: string;
  name: string;
  type: 'organisation' | 'scheme' | 'block' | 'property' | 'component';
  reference?: string;
  status?: string;
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

function TreeNode({ node, level = 0, defaultOpen = true }: { node: HierarchyNode; level?: number; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen && level < 2);
  const hasChildren = node.children.length > 0;
  
  const typeColors: Record<string, string> = {
    organisation: 'bg-purple-100 text-purple-800 border-purple-200',
    scheme: 'bg-blue-100 text-blue-800 border-blue-200',
    block: 'bg-amber-100 text-amber-800 border-amber-200',
    property: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    component: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    organisation: <Building2 className="h-4 w-4" />,
    scheme: <MapPin className="h-4 w-4" />,
    block: <Building className="h-4 w-4" />,
    property: <Home className="h-4 w-4" />,
    component: <Package className="h-4 w-4" />,
  };
  
  const statusColors: Record<string, string> = {
    COMPLIANT: 'bg-green-500',
    NON_COMPLIANT: 'bg-red-500',
    PENDING: 'bg-yellow-500',
    UNKNOWN: 'bg-gray-400',
  };

  return (
    <div className="select-none">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors group",
            level === 0 && "bg-slate-50"
          )}
          style={{ marginLeft: `${level * 24}px` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
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
              <span className="font-medium text-slate-900 truncate">{node.name}</span>
              {node.reference && (
                <span className="text-xs text-slate-500">({node.reference})</span>
              )}
            </div>
          </div>
          
          {node.status && (
            <div className={cn("w-2 h-2 rounded-full", statusColors[node.status] || statusColors.UNKNOWN)} />
          )}
          
          <Badge variant="secondary" className="text-xs">
            {node.type}
          </Badge>
          
          {hasChildren && (
            <span className="text-xs text-slate-400">
              {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        
        {hasChildren && (
          <CollapsibleContent>
            <div className="border-l-2 border-slate-200 ml-6">
              {node.children.map((child) => (
                <TreeNode key={`${child.type}-${child.id}`} node={child} level={level + 1} defaultOpen={level < 1} />
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
    organisation: 'border-l-purple-500 bg-purple-50/50',
    scheme: 'border-l-blue-500 bg-blue-50/50',
    block: 'border-l-amber-500 bg-amber-50/50',
    property: 'border-l-emerald-500 bg-emerald-50/50',
    component: 'border-l-slate-500 bg-slate-50/50',
  };
  
  const typeIcons: Record<string, React.ReactNode> = {
    organisation: <Building2 className="h-5 w-5 text-purple-600" />,
    scheme: <MapPin className="h-5 w-5 text-blue-600" />,
    block: <Building className="h-5 w-5 text-amber-600" />,
    property: <Home className="h-5 w-5 text-emerald-600" />,
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

function VisualHierarchy({ hierarchyData, viewMode }: { hierarchyData: HierarchyNode[]; viewMode: ViewMode }) {
  if (viewMode === 'tree') {
    return (
      <div className="space-y-1">
        {hierarchyData.map((node) => (
          <TreeNode key={`${node.type}-${node.id}`} node={node} />
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
    const typeLabels: Record<string, string> = {
      organisation: 'Organisation',
      scheme: 'Scheme',
      block: 'Block',
      property: 'Property',
      component: 'Component',
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
                  <Badge variant="outline" className="capitalize">{typeLabels[node.type]}</Badge>
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

export default function PropertyHierarchy() {
  useEffect(() => {
    document.title = "Property Hierarchy - ComplianceAI";
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [mainTab, setMainTab] = useState<'properties' | 'assets'>('properties');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [showVisualView, setShowVisualView] = useState(true);
  
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

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ["components"],
    queryFn: () => componentsApi.list(),
  });

  const hierarchyData = useMemo((): HierarchyNode[] => {
    return organisations.map((org: Organisation) => ({
      id: org.id,
      name: org.name,
      type: 'organisation' as const,
      data: org,
      children: schemes
        .filter((s) => s.organisationId === org.id)
        .map((scheme) => ({
          id: scheme.id,
          name: scheme.name,
          type: 'scheme' as const,
          reference: scheme.reference,
          status: scheme.complianceStatus,
          data: scheme,
          children: blocks
            .filter((b) => b.schemeId === scheme.id)
            .map((block) => ({
              id: block.id,
              name: block.name,
              type: 'block' as const,
              reference: block.reference,
              status: block.complianceStatus,
              data: block,
              children: properties
                .filter((p: Property) => p.blockId === block.id)
                .map((property: Property) => ({
                  id: property.id,
                  name: `${property.addressLine1}, ${property.postcode}`,
                  type: 'property' as const,
                  reference: property.uprn,
                  status: property.complianceStatus,
                  data: property,
                  children: components
                    .filter((c: Component) => c.propertyId === property.id)
                    .map((component: Component) => ({
                      id: component.id,
                      name: component.manufacturer ? `${component.manufacturer} ${component.model || ''}`.trim() : (component.assetTag || component.serialNumber || 'Component'),
                      type: 'component' as const,
                      reference: component.serialNumber || undefined,
                      data: component,
                      children: [],
                    })),
                })),
            })),
        })),
    }));
  }, [organisations, schemes, blocks, properties, components]);

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
        schemeId: block.schemeId,
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

  const isLoading = orgsLoading || schemesLoading || blocksLoading || propertiesLoading || componentsLoading;

  const totalCounts = {
    organisations: organisations.length,
    schemes: schemes.length,
    blocks: blocks.length,
    properties: properties.length,
    components: components.length,
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
                    <strong>HACT/UKHDS Hierarchy:</strong> Organisation → Scheme (Site) → Block (Property/Building) → Property (Unit/Dwelling) → Component
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
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
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4 text-center">
                  <Building className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-amber-900">{totalCounts.blocks}</div>
                  <div className="text-sm text-amber-600">Blocks</div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4 text-center">
                  <Home className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-emerald-900">{totalCounts.properties}</div>
                  <div className="text-sm text-emerald-600">Properties</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 text-center">
                  <Package className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-slate-900">{totalCounts.components}</div>
                  <div className="text-sm text-slate-600">Components</div>
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
                        <VisualHierarchy hierarchyData={hierarchyData} viewMode={viewMode} />
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
                                    <TableCell>{getSchemeForBlock(block.schemeId)?.name || '-'}</TableCell>
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
                          {components.map((component: Component) => {
                            const property = properties.find((p: Property) => p.id === component.propertyId);
                            const componentName = component.manufacturer ? `${component.manufacturer} ${component.model || ''}`.trim() : (component.assetTag || component.serialNumber || 'Component');
                            return (
                              <TableRow key={component.id} data-testid={`row-component-${component.id}`}>
                                <TableCell className="font-medium">{componentName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{component.componentTypeId || '-'}</Badge>
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
