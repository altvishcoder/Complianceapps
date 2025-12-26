import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  Check, X, AlertTriangle, Eye, Edit2, FileText, Clock,
  ChevronLeft, ChevronRight, RefreshCw, Save, Tag, Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractionRun {
  id: string;
  certificateId: string;
  documentType: string;
  status: string;
  confidence: number;
  rawOutput: any;
  validatedOutput: any;
  repairedOutput: any;
  normalisedOutput: any;
  finalOutput: any;
  validationErrors: any[];
  createdAt: string;
  certificate?: {
    fileName: string;
    storageKey?: string;
    property?: { addressLine1: string; postcode: string };
  };
}

const ERROR_TAGS = [
  'missed_date', 'wrong_date_format', 'missed_table_row',
  'wrong_field_mapping', 'hallucinated_value', 'incomplete_extraction',
  'address_error', 'name_error', 'outcome_error', 'registration_error'
];

function FieldEditor({ 
  field, 
  label, 
  value, 
  onChange, 
  type = 'text',
  hasError = false 
}: {
  field: string;
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'date' | 'select';
  hasError?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className={`text-xs ${hasError ? 'text-red-600' : ''}`}>
        {label}
        {hasError && <AlertTriangle className="w-3 h-3 inline ml-1" />}
      </Label>
      <Input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-sm ${hasError ? 'border-red-500' : ''}`}
        data-testid={`input-${field}`}
      />
    </div>
  );
}

export default function HumanReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<ExtractionRun | null>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [errorTags, setErrorTags] = useState<string[]>([]);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('AWAITING_REVIEW');
  
  const { data: runs = [], isLoading, refetch } = useQuery<ExtractionRun[]>({
    queryKey: ['extraction-runs', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/extraction-runs?status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
  
  const approveMutation = useMutation({
    mutationFn: async (data: { runId: string; approvedOutput: any; errorTags: string[]; notes: string }) => {
      const res = await fetch(`/api/extraction-runs/${data.runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Approval failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Extraction Approved', description: 'Changes saved to training data' });
      queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
      setSelectedRun(null);
    },
  });
  
  const rejectMutation = useMutation({
    mutationFn: async (data: { runId: string; reason: string; errorTags: string[] }) => {
      const res = await fetch(`/api/extraction-runs/${data.runId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Rejection failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Extraction Rejected' });
      queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
      setSelectedRun(null);
    },
  });
  
  const resetApprovalsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/extraction-runs/reset-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Reset failed');
      return res.json();
    },
    onSuccess: (data: { count: number }) => {
      toast({ 
        title: 'Approvals Reset', 
        description: `${data.count} extractions moved to review queue` 
      });
      queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
    },
  });
  
  useEffect(() => {
    if (selectedRun) {
      setEditedData(selectedRun.normalisedOutput || selectedRun.repairedOutput || selectedRun.validatedOutput || selectedRun.rawOutput);
      setErrorTags([]);
      setReviewerNotes('');
    }
  }, [selectedRun]);
  
  const handleFieldChange = (path: string, value: any) => {
    if (!editedData) return;
    const newData = JSON.parse(JSON.stringify(editedData));
    const keys = path.split('.');
    let obj = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setEditedData(newData);
  };
  
  const toggleErrorTag = (tag: string) => {
    setErrorTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };
  
  const filteredRuns = runs.filter(run => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      run.documentType.toLowerCase().includes(search) ||
      run.certificate?.fileName?.toLowerCase().includes(search) ||
      run.certificate?.property?.addressLine1?.toLowerCase().includes(search)
    );
  });
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Eye className="w-7 h-7" />
                Human Review
              </h1>
              <p className="text-muted-foreground">Review and correct AI extractions to improve the model</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => resetApprovalsMutation.mutate()}
                disabled={resetApprovalsMutation.isPending}
                data-testid="button-reset-approvals"
              >
                Reset Approvals to Review
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by file, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-reviews"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AWAITING_REVIEW">Awaiting Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRuns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Check className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No extractions to review</h3>
                <p className="text-muted-foreground">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRuns.map((run) => (
                <Card 
                  key={run.id} 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedRun(run)}
                  data-testid={`card-extraction-${run.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <FileText className="w-10 h-10 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium">{run.certificate?.fileName || 'Unknown file'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {run.certificate?.property?.addressLine1}, {run.certificate?.property?.postcode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{run.documentType.replace(/_/g, ' ')}</Badge>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              run.confidence >= 0.9 ? 'bg-green-500' : 
                              run.confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm font-medium">{(run.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={
                          run.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          run.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          run.status === 'AWAITING_REVIEW' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {run.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    {run.validationErrors && run.validationErrors.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-600">
                          {run.validationErrors.length} validation issue(s)
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <Sheet open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
          <SheetContent className="sm:max-w-3xl overflow-y-auto">
            {selectedRun && editedData && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Review Extraction
                  </SheetTitle>
                </SheetHeader>
                
                <div className="mt-4 space-y-6">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedRun.documentType.replace(/_/g, ' ')}</Badge>
                      <span className="text-sm">{selectedRun.certificate?.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedRun.confidence >= 0.9 ? 'bg-green-500' : 
                        selectedRun.confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm">{(selectedRun.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="property">
                    <TabsList className="w-full">
                      <TabsTrigger value="property" className="flex-1">Property</TabsTrigger>
                      <TabsTrigger value="inspection" className="flex-1">Inspection</TabsTrigger>
                      <TabsTrigger value="engineer" className="flex-1">Engineer</TabsTrigger>
                      <TabsTrigger value="findings" className="flex-1">Findings</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="property" className="space-y-4 mt-4">
                      <FieldEditor
                        field="property.address_line_1"
                        label="Address Line 1"
                        value={editedData.property?.address_line_1}
                        onChange={(v) => handleFieldChange('property.address_line_1', v)}
                      />
                      <FieldEditor
                        field="property.address_line_2"
                        label="Address Line 2"
                        value={editedData.property?.address_line_2}
                        onChange={(v) => handleFieldChange('property.address_line_2', v)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FieldEditor
                          field="property.city"
                          label="City"
                          value={editedData.property?.city}
                          onChange={(v) => handleFieldChange('property.city', v)}
                        />
                        <FieldEditor
                          field="property.postcode"
                          label="Postcode"
                          value={editedData.property?.postcode}
                          onChange={(v) => handleFieldChange('property.postcode', v)}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="inspection" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FieldEditor
                          field="inspection.date"
                          label="Inspection Date"
                          value={editedData.inspection?.date}
                          type="date"
                          onChange={(v) => handleFieldChange('inspection.date', v)}
                        />
                        <FieldEditor
                          field="inspection.next_due_date"
                          label="Next Due Date"
                          value={editedData.inspection?.next_due_date}
                          type="date"
                          onChange={(v) => handleFieldChange('inspection.next_due_date', v)}
                        />
                      </div>
                      <FieldEditor
                        field="inspection.outcome"
                        label="Outcome"
                        value={editedData.inspection?.outcome}
                        onChange={(v) => handleFieldChange('inspection.outcome', v)}
                      />
                    </TabsContent>
                    
                    <TabsContent value="engineer" className="space-y-4 mt-4">
                      <FieldEditor
                        field="engineer.name"
                        label="Engineer Name"
                        value={editedData.engineer?.name}
                        onChange={(v) => handleFieldChange('engineer.name', v)}
                      />
                      <FieldEditor
                        field="engineer.company"
                        label="Company"
                        value={editedData.engineer?.company}
                        onChange={(v) => handleFieldChange('engineer.company', v)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FieldEditor
                          field="engineer.registration_id"
                          label="Registration ID"
                          value={editedData.engineer?.registration_id}
                          onChange={(v) => handleFieldChange('engineer.registration_id', v)}
                        />
                        <FieldEditor
                          field="engineer.registration_type"
                          label="Registration Type"
                          value={editedData.engineer?.registration_type}
                          onChange={(v) => handleFieldChange('engineer.registration_type', v)}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="findings" className="space-y-4 mt-4">
                      <div>
                        <Label>Observations</Label>
                        <div className="mt-2 space-y-2">
                          {editedData.findings?.observations?.map((obs: any, idx: number) => (
                            <div key={idx} className="p-2 bg-muted rounded text-sm">
                              {obs.description || JSON.stringify(obs)}
                            </div>
                          )) || <p className="text-sm text-muted-foreground">No observations</p>}
                        </div>
                      </div>
                      <div>
                        <Label>Remedial Actions</Label>
                        <div className="mt-2 space-y-2">
                          {editedData.findings?.remedial_actions?.map((action: any, idx: number) => (
                            <div key={idx} className="p-2 bg-muted rounded text-sm flex justify-between">
                              <span>{action.description || JSON.stringify(action)}</span>
                              {action.priority && <Badge variant="outline">{action.priority}</Badge>}
                            </div>
                          )) || <p className="text-sm text-muted-foreground">No remedial actions</p>}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Error Tags (for model improvement)
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ERROR_TAGS.map((tag) => (
                        <Badge
                          key={tag}
                          variant={errorTags.includes(tag) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleErrorTag(tag)}
                          data-testid={`tag-${tag}`}
                        >
                          {tag.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Reviewer Notes</Label>
                    <Textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Optional notes about this extraction..."
                      className="mt-2"
                      data-testid="textarea-notes"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({
                        runId: selectedRun.id,
                        reason: reviewerNotes || 'Manual rejection',
                        errorTags,
                      })}
                      disabled={rejectMutation.isPending}
                      data-testid="button-reject"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => approveMutation.mutate({
                        runId: selectedRun.id,
                        approvedOutput: editedData,
                        errorTags,
                        notes: reviewerNotes,
                      })}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}
