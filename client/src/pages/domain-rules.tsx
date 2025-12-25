import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  Settings2, Plus, Edit2, Trash2, RefreshCw, Scale,
  AlertTriangle, CheckCircle, ArrowRightLeft, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ComplianceRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  documentType: string;
  conditions: any[];
  conditionLogic: string;
  action: string;
  priority: string | null;
  description: string;
  legislation: string | null;
  isActive: boolean;
}

interface NormalisationRule {
  id: string;
  ruleName: string;
  fieldPath: string;
  ruleType: string;
  inputPatterns: string[];
  outputValue: string | null;
  transformFn: string | null;
  priority: number;
  isActive: boolean;
}

const DOC_TYPES = ['GAS_SAFETY', 'EICR', 'FIRE_RISK_ASSESSMENT', 'ASBESTOS', 'LEGIONELLA', 'EPC', 'LIFT_LOLER'];
const ACTIONS = ['FLAG_URGENT', 'MARK_INCOMPLETE', 'AUTO_FAIL', 'INFO', 'CREATE_ACTION'];
const RULE_TYPES = ['MAPPING', 'REGEX', 'TRANSFORM'];

export default function DomainRulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingCompliance, setIsAddingCompliance] = useState(false);
  const [isAddingNorm, setIsAddingNorm] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [editingNorm, setEditingNorm] = useState<NormalisationRule | null>(null);
  
  const { data: complianceRules = [], isLoading: loadingCompliance } = useQuery<ComplianceRule[]>({
    queryKey: ['compliance-rules'],
    queryFn: async () => {
      const res = await fetch('/api/compliance-rules');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
  
  const { data: normRules = [], isLoading: loadingNorm } = useQuery<NormalisationRule[]>({
    queryKey: ['normalisation-rules'],
    queryFn: async () => {
      const res = await fetch('/api/normalisation-rules');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
  
  const createComplianceMutation = useMutation({
    mutationFn: async (data: Partial<ComplianceRule>) => {
      const res = await fetch('/api/compliance-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Rule Created' });
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      setIsAddingCompliance(false);
    },
  });
  
  const updateComplianceMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<ComplianceRule>) => {
      const res = await fetch(`/api/compliance-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Rule Updated' });
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      setEditingRule(null);
    },
  });
  
  const deleteComplianceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/compliance-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ title: 'Rule Deleted' });
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
    },
  });
  
  const createNormMutation = useMutation({
    mutationFn: async (data: Partial<NormalisationRule>) => {
      const res = await fetch('/api/normalisation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Rule Created' });
      queryClient.invalidateQueries({ queryKey: ['normalisation-rules'] });
      setIsAddingNorm(false);
    },
  });
  
  const updateNormMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<NormalisationRule>) => {
      const res = await fetch(`/api/normalisation-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Rule Updated' });
      queryClient.invalidateQueries({ queryKey: ['normalisation-rules'] });
      setEditingNorm(null);
    },
  });
  
  const deleteNormMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/normalisation-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ title: 'Rule Deleted' });
      queryClient.invalidateQueries({ queryKey: ['normalisation-rules'] });
    },
  });
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings2 className="w-7 h-7" />
              Domain Rules
            </h1>
            <p className="text-muted-foreground">Configure compliance rules and normalisation mappings</p>
          </div>
          
          <Tabs defaultValue="compliance">
            <TabsList>
              <TabsTrigger value="compliance" className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Compliance Rules
              </TabsTrigger>
              <TabsTrigger value="normalisation" className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Normalisation Rules
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="compliance" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Rules that apply compliance logic to extracted data
                </p>
                <Dialog open={isAddingCompliance} onOpenChange={setIsAddingCompliance}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-compliance-rule">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Compliance Rule</DialogTitle>
                    </DialogHeader>
                    <ComplianceRuleForm
                      onSubmit={(data) => createComplianceMutation.mutate(data)}
                      isSubmitting={createComplianceMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              
              {loadingCompliance ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : complianceRules.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Scale className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No compliance rules</h3>
                    <p className="text-muted-foreground">Create your first rule to automate compliance logic</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {complianceRules.map((rule) => (
                    <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{rule.ruleName}</h3>
                              <Badge variant="outline">{rule.ruleCode}</Badge>
                              <Badge variant="secondary">{rule.documentType}</Badge>
                              {!rule.isActive && <Badge variant="destructive">Inactive</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={
                                rule.action === 'FLAG_URGENT' ? 'bg-red-100 text-red-800' :
                                rule.action === 'AUTO_FAIL' ? 'bg-red-100 text-red-800' :
                                rule.action === 'CREATE_ACTION' ? 'bg-amber-100 text-amber-800' :
                                'bg-blue-100 text-blue-800'
                              }>
                                {rule.action}
                              </Badge>
                              {rule.priority && <Badge variant="outline">{rule.priority}</Badge>}
                              {rule.legislation && (
                                <span className="text-xs text-muted-foreground">{rule.legislation}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingRule(rule)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this rule?')) {
                                  deleteComplianceMutation.mutate(rule.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="normalisation" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Rules that standardise extracted values (contractor names, outcomes, etc.)
                </p>
                <Dialog open={isAddingNorm} onOpenChange={setIsAddingNorm}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-norm-rule">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Normalisation Rule</DialogTitle>
                    </DialogHeader>
                    <NormalisationRuleForm
                      onSubmit={(data) => createNormMutation.mutate(data)}
                      isSubmitting={createNormMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              
              {loadingNorm ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : normRules.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ArrowRightLeft className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No normalisation rules</h3>
                    <p className="text-muted-foreground">Create rules to standardise extracted data</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {normRules.map((rule) => (
                    <Card key={rule.id} data-testid={`card-norm-${rule.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{rule.ruleName}</h3>
                              <Badge variant="outline">{rule.ruleType}</Badge>
                              <Badge variant="secondary">{rule.fieldPath}</Badge>
                              {!rule.isActive && <Badge variant="destructive">Inactive</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm text-muted-foreground">
                                {rule.inputPatterns?.join(', ') || 'No patterns'} 
                              </span>
                              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{rule.outputValue || rule.transformFn}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingNorm(rule)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this rule?')) {
                                  deleteNormMutation.mutate(rule.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Compliance Rule</DialogTitle>
              </DialogHeader>
              {editingRule && (
                <ComplianceRuleForm
                  initialData={editingRule}
                  onSubmit={(data) => updateComplianceMutation.mutate({ id: editingRule.id, ...data })}
                  isSubmitting={updateComplianceMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>
          
          <Dialog open={!!editingNorm} onOpenChange={(open) => !open && setEditingNorm(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Normalisation Rule</DialogTitle>
              </DialogHeader>
              {editingNorm && (
                <NormalisationRuleForm
                  initialData={editingNorm}
                  onSubmit={(data) => updateNormMutation.mutate({ id: editingNorm.id, ...data })}
                  isSubmitting={updateNormMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}

function ComplianceRuleForm({ 
  initialData, 
  onSubmit, 
  isSubmitting 
}: { 
  initialData?: ComplianceRule;
  onSubmit: (data: Partial<ComplianceRule>) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    ruleCode: initialData?.ruleCode || '',
    ruleName: initialData?.ruleName || '',
    documentType: initialData?.documentType || 'GAS_SAFETY',
    action: initialData?.action || 'INFO',
    priority: initialData?.priority || '',
    description: initialData?.description || '',
    legislation: initialData?.legislation || '',
    isActive: initialData?.isActive ?? true,
  });
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rule Code</Label>
          <Input
            value={formData.ruleCode}
            onChange={(e) => setFormData({ ...formData, ruleCode: e.target.value })}
            placeholder="EICR_C1_URGENT"
            data-testid="input-rule-code"
          />
        </div>
        <div>
          <Label>Rule Name</Label>
          <Input
            value={formData.ruleName}
            onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
            placeholder="C1 Code Found"
            data-testid="input-rule-name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Document Type</Label>
          <Select value={formData.documentType} onValueChange={(v) => setFormData({ ...formData, documentType: v })}>
            <SelectTrigger data-testid="select-doc-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Action</Label>
          <Select value={formData.action} onValueChange={(v) => setFormData({ ...formData, action: v })}>
            <SelectTrigger data-testid="select-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger data-testid="select-priority">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P1">P1 - Critical</SelectItem>
              <SelectItem value="P2">P2 - High</SelectItem>
              <SelectItem value="P3">P3 - Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Legislation Reference</Label>
          <Input
            value={formData.legislation}
            onChange={(e) => setFormData({ ...formData, legislation: e.target.value })}
            placeholder="Gas Safety (Installation and Use) Regulations 1998"
          />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this rule does..."
          data-testid="textarea-description"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={formData.isActive}
          onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
          data-testid="switch-active"
        />
        <Label>Active</Label>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button 
          onClick={() => onSubmit({ ...formData, conditions: [], conditionLogic: 'AND' })} 
          disabled={isSubmitting || !formData.ruleCode || !formData.ruleName}
          data-testid="button-save-rule"
        >
          {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Rule
        </Button>
      </DialogFooter>
    </div>
  );
}

function NormalisationRuleForm({
  initialData,
  onSubmit,
  isSubmitting
}: {
  initialData?: NormalisationRule;
  onSubmit: (data: Partial<NormalisationRule>) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    ruleName: initialData?.ruleName || '',
    fieldPath: initialData?.fieldPath || '',
    ruleType: initialData?.ruleType || 'MAPPING',
    inputPatterns: initialData?.inputPatterns?.join('\n') || '',
    outputValue: initialData?.outputValue || '',
    transformFn: initialData?.transformFn || '',
    priority: initialData?.priority || 0,
    isActive: initialData?.isActive ?? true,
  });
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rule Name</Label>
          <Input
            value={formData.ruleName}
            onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
            placeholder="British Gas Normalisation"
            data-testid="input-norm-name"
          />
        </div>
        <div>
          <Label>Field Path</Label>
          <Input
            value={formData.fieldPath}
            onChange={(e) => setFormData({ ...formData, fieldPath: e.target.value })}
            placeholder="engineer.company"
            data-testid="input-field-path"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rule Type</Label>
          <Select value={formData.ruleType} onValueChange={(v) => setFormData({ ...formData, ruleType: v })}>
            <SelectTrigger data-testid="select-rule-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RULE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Input
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            data-testid="input-priority"
          />
        </div>
      </div>
      <div>
        <Label>Input Patterns (one per line)</Label>
        <Textarea
          value={formData.inputPatterns}
          onChange={(e) => setFormData({ ...formData, inputPatterns: e.target.value })}
          placeholder="british gas&#10;bg services&#10;bg"
          rows={4}
          data-testid="textarea-patterns"
        />
      </div>
      {formData.ruleType === 'MAPPING' && (
        <div>
          <Label>Output Value</Label>
          <Input
            value={formData.outputValue}
            onChange={(e) => setFormData({ ...formData, outputValue: e.target.value })}
            placeholder="British Gas"
            data-testid="input-output"
          />
        </div>
      )}
      {formData.ruleType === 'TRANSFORM' && (
        <div>
          <Label>Transform Function</Label>
          <Input
            value={formData.transformFn}
            onChange={(e) => setFormData({ ...formData, transformFn: e.target.value })}
            placeholder="titleCase"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch
          checked={formData.isActive}
          onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
        />
        <Label>Active</Label>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          onClick={() => onSubmit({
            ...formData,
            inputPatterns: formData.inputPatterns.split('\n').filter(p => p.trim()),
          })}
          disabled={isSubmitting || !formData.ruleName || !formData.fieldPath}
          data-testid="button-save-norm"
        >
          {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Rule
        </Button>
      </DialogFooter>
    </div>
  );
}
