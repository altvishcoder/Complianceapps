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
import { Building2, Home, Layers, Plus, Pencil, Trash2, Loader2, Info, Building, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { organisationsApi, schemesApi, blocksApi } from "@/lib/api";
import type { Scheme, Block } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type Organisation = {
  id: string;
  name: string;
  slug: string;
  settings?: any;
  createdAt: string;
  updatedAt: string;
};

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

export default function AssetHierarchy() {
  useEffect(() => {
    document.title = "Asset Hierarchy - ComplianceAI";
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Asset Hierarchy" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-6 w-6 text-emerald-600" />
                <h1 className="text-2xl font-bold text-gray-900">Asset Hierarchy</h1>
              </div>
              <p className="text-gray-600">
                Manage your property portfolio structure following the UKHDS 5-level asset hierarchy.
              </p>
              <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    <strong>HACT/UKHDS Hierarchy:</strong> Organisation → Scheme (Site) → Block (Property/Building) → Property (Unit/Dwelling) → Unit (Space/Room) → Component
                  </div>
                </div>
              </div>
            </div>

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
            <DialogTitle className="flex items-center">
              {editingScheme ? "Edit Scheme" : "Add Scheme"}
              <HactBadge label="Site" />
            </DialogTitle>
            <DialogDescription>
              {editingScheme ? "Update scheme details" : "Create a new estate or housing development"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scheme-name">Name</Label>
              <Input 
                id="scheme-name" 
                value={schemeForm.name} 
                onChange={(e) => setSchemeForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Oak Estate"
                data-testid="input-scheme-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme-reference">Reference</Label>
              <Input 
                id="scheme-reference" 
                value={schemeForm.reference} 
                onChange={(e) => setSchemeForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. SCH001"
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
            <DialogTitle className="flex items-center">
              {editingBlock ? "Edit Block" : "Add Block"}
              <HactBadge label="Property/Building" />
            </DialogTitle>
            <DialogDescription>
              {editingBlock ? "Update block details" : "Create a new building within a scheme"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-scheme">Scheme (HACT: Site)</Label>
              <Select value={blockForm.schemeId} onValueChange={(v) => setBlockForm(f => ({ ...f, schemeId: v }))}>
                <SelectTrigger data-testid="select-block-scheme">
                  <SelectValue placeholder="Select a scheme" />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((scheme) => (
                    <SelectItem key={scheme.id} value={scheme.id}>{scheme.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-name">Name</Label>
              <Input 
                id="block-name" 
                value={blockForm.name} 
                onChange={(e) => setBlockForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Oak House"
                data-testid="input-block-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reference">Reference</Label>
              <Input 
                id="block-reference" 
                value={blockForm.reference} 
                onChange={(e) => setBlockForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. BLK001"
                data-testid="input-block-reference"
              />
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
