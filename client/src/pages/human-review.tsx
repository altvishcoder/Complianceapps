import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { HeroStatsGrid } from '@/components/dashboard/HeroStats';
import { CardSkeleton } from '@/components/ui/skeleton';
import { getIcon, getActionIcon, getStatusIcon } from '@/config/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const Check = getActionIcon('check');
const X = getActionIcon('close');
const AlertTriangle = getStatusIcon('warning');
const Eye = getActionIcon('view');
const Edit2 = getActionIcon('edit');
const FileText = getIcon('FileText');
const Clock = getIcon('Clock');
const Filter = getActionIcon('filter');
const ChevronLeft = getActionIcon('previous');
const ChevronRight = getActionIcon('next');
const RefreshCw = getActionIcon('refresh');
const Save = getIcon('Save');
const Tag = getIcon('FileText');
const Search = getActionIcon('search');
const ExternalLink = getIcon('ExternalLink');
const ImageIcon = getIcon('FileText');
const CheckCircle2 = getStatusIcon('compliant');
const XCircle = getStatusIcon('failed');
const ClipboardList = getIcon('Clipboard');

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
  'address_error', 'name_error', 'outcome_error', 'registration_error',
  'missing_engineer_details', 'missing_property_address', 'wrong_certificate_type',
  'missing_expiry_date', 'missing_next_due_date', 'incorrect_appliance_count',
  'missing_defects', 'wrong_severity_classification', 'missing_gas_registration',
  'missing_landlord_info', 'date_parsing_error', 'confidence_too_low',
  'ocr_quality_issue', 'multi_page_extraction_error'
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
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  
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
  
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(
        ids.map(id => {
          const run = runs.find(r => r.id === id);
          const output = run?.normalisedOutput || run?.rawOutput || {};
          return fetch(`/api/extraction-runs/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedOutput: output, errorTags: [], notes: 'Bulk approved' }),
          });
        })
      );
      return results;
    },
    onSuccess: () => {
      toast({ title: 'Bulk Approved', description: `${selectedRunIds.size} extractions approved` });
      queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
      setSelectedRunIds(new Set());
    },
  });
  
  const bulkRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(
        ids.map(id => 
          fetch(`/api/extraction-runs/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Bulk rejected', errorTags: [] }),
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      toast({ title: 'Bulk Rejected', description: `${selectedRunIds.size} extractions rejected` });
      queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
      setSelectedRunIds(new Set());
    },
  });
  
  const toggleRunSelection = (id: string) => {
    setSelectedRunIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const toggleSelectAll = () => {
    if (selectedRunIds.size === filteredRuns.length) {
      setSelectedRunIds(new Set());
    } else {
      setSelectedRunIds(new Set(filteredRuns.map(r => r.id)));
    }
  };
  
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
  
  const heroStats = useMemo(() => {
    const awaitingReview = runs.filter(r => r.status === 'AWAITING_REVIEW').length;
    const lowConfidence = runs.filter(r => r.confidence < 0.7).length;
    const approved = runs.filter(r => r.status === 'APPROVED').length;
    const rejected = runs.filter(r => r.status === 'REJECTED').length;
    return { awaitingReview, lowConfidence, approved, rejected };
  }, [runs]);
  
  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Human Review" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6" role="main" aria-label="Human review content">
          
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => resetApprovalsMutation.mutate()}
                disabled={resetApprovalsMutation.isPending}
                data-testid="button-reset-approvals"
              >
                Reset Approvals
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
          
          <HeroStatsGrid
            stats={[
              {
                title: "Awaiting Review",
                value: heroStats.awaitingReview,
                subtitle: "need triage",
                icon: ClipboardList,
                riskLevel: heroStats.awaitingReview > 10 ? "critical" : heroStats.awaitingReview > 5 ? "high" : "medium",
                testId: "hero-awaiting-review",
              },
              {
                title: "Low Confidence",
                value: heroStats.lowConfidence,
                subtitle: "< 70% confidence",
                icon: AlertTriangle,
                riskLevel: heroStats.lowConfidence > 5 ? "critical" : heroStats.lowConfidence > 0 ? "high" : "good",
                testId: "hero-low-confidence",
              },
              {
                title: "Approved",
                value: heroStats.approved,
                subtitle: "validated",
                icon: CheckCircle2,
                riskLevel: "good",
                testId: "hero-approved",
              },
              {
                title: "Rejected",
                value: heroStats.rejected,
                subtitle: "need reprocessing",
                icon: XCircle,
                riskLevel: heroStats.rejected > 5 ? "high" : "low",
                testId: "hero-rejected",
              },
            ]}
          />
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
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
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2 sm:hidden" />
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
          
          {isLoading && runs.length === 0 ? (
            <div className="space-y-4">
              <CardSkeleton contentHeight={80} />
              <CardSkeleton contentHeight={80} />
              <CardSkeleton contentHeight={80} />
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={selectedRunIds.size === filteredRuns.length && filteredRuns.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedRunIds.size} / {filteredRuns.length} selected
                  </span>
                </div>
                {selectedRunIds.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => bulkApproveMutation.mutate(Array.from(selectedRunIds))}
                      disabled={bulkApproveMutation.isPending}
                      data-testid="button-bulk-approve"
                    >
                      <Check className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Approve All</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => bulkRejectMutation.mutate(Array.from(selectedRunIds))}
                      disabled={bulkRejectMutation.isPending}
                      data-testid="button-bulk-reject"
                    >
                      <X className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Reject All</span>
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="grid gap-3">
              {filteredRuns.map((run) => (
                <Card 
                  key={run.id} 
                  className={`cursor-pointer hover:border-primary transition-colors ${selectedRunIds.has(run.id) ? 'border-primary' : ''}`}
                  data-testid={`card-extraction-${run.id}`}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox 
                          checked={selectedRunIds.has(run.id)}
                          onCheckedChange={() => toggleRunSelection(run.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                          data-testid={`checkbox-select-${run.id}`}
                        />
                        <div onClick={() => setSelectedRun(run)} className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-sm sm:text-base truncate">{run.certificate?.fileName || 'Unknown file'}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {run.certificate?.property?.addressLine1}, {run.certificate?.property?.postcode}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2 sm:hidden">
                                <Badge variant="outline" className="text-xs">{run.documentType.replace(/_/g, ' ')}</Badge>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    run.confidence >= 0.9 ? 'bg-green-500' : 
                                    run.confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`} />
                                  <span className="text-xs font-medium">{(run.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <Badge className={`text-xs ${
                                  run.status === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300' :
                                  run.status === 'REJECTED' ? 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                                  run.status === 'AWAITING_REVIEW' ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                                  'bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
                                }`}>
                                  {run.status.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-4">
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
                          run.status === 'APPROVED' ? 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300' :
                          run.status === 'REJECTED' ? 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                          run.status === 'AWAITING_REVIEW' ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                          'bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
                        }>
                          {run.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    {run.validationErrors && run.validationErrors.length > 0 && (
                      <div className="mt-2 flex gap-1 ml-9 sm:ml-0">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">
                          {run.validationErrors.length} validation issue(s)
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>
            </div>
          )}
        </main>
        
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
                    <div className="flex items-center gap-3">
                      {selectedRun.certificate?.storageKey && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-view-file">
                              <ImageIcon className="w-4 h-4 mr-1" />
                              View File
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                            <DialogHeader>
                              <DialogTitle>{selectedRun.certificate?.fileName}</DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                              <img 
                                src={`/api/files/${selectedRun.certificate.storageKey}`}
                                alt={selectedRun.certificate?.fileName || 'Certificate'}
                                className="max-w-full h-auto rounded-lg border"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          selectedRun.confidence >= 0.9 ? 'bg-green-500' : 
                          selectedRun.confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-sm">{(selectedRun.confidence * 100).toFixed(0)}% confidence</span>
                      </div>
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
      </div>
    </div>
  );
}
