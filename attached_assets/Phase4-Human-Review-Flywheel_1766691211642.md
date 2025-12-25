# ComplianceAI™ Model Ownership — Phase 4
## Human Review & Data Flywheel

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 4 (4-5 days) |
| **Objective** | Capture human corrections as training data |
| **Prerequisites** | Phase 1-3 complete |
| **Outcome** | Every correction improves future extractions |

```
WHAT WE'RE BUILDING:

  Extraction Result
        │
        ▼
  ┌──────────────┐
  │ REVIEW UI    │ ──► Human reviews/edits extraction
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ DIFF CAPTURE │ ──► Record what changed + why
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ GOLD RECORD  │ ──► Store approved output
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  FLYWHEEL    │ ──► Use for benchmarks + training
  └──────────────┘
```

---

## Step 1: Create Review UI Components

### Prompt 4.1: Extraction Review Panel

```
Create the human review interface for extraction results.

1. Create src/components/features/extraction-review/ExtractionReviewPanel.tsx:

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Check, X, AlertTriangle, Eye, Edit2, 
  ChevronDown, ChevronUp, FileText, Clock 
} from 'lucide-react';
import { FieldEditor } from './FieldEditor';
import { FindingsEditor } from './FindingsEditor';
import { ErrorTagSelector } from './ErrorTagSelector';

interface ExtractionReviewPanelProps {
  extractionRunId: string;
  extraction: any;
  documentType: string;
  documentUrl: string;
  validationErrors: Array<{ field: string; message: string }>;
  onApprove: (data: ApprovalData) => Promise<void>;
  onReject: (reason: string, errorTags: string[]) => Promise<void>;
}

interface ApprovalData {
  approvedOutput: any;
  fieldChanges: FieldChange[];
  addedItems: any[];
  removedItems: any[];
  errorTags: string[];
}

interface FieldChange {
  field: string;
  before: any;
  after: any;
  reason?: string;
}

export function ExtractionReviewPanel({
  extractionRunId,
  extraction,
  documentType,
  documentUrl,
  validationErrors,
  onApprove,
  onReject,
}: ExtractionReviewPanelProps) {
  const [editedData, setEditedData] = useState<any>(extraction);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [errorTags, setErrorTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDocument, setShowDocument] = useState(true);
  const [reviewStartTime] = useState(Date.now());
  
  // Track field changes
  const handleFieldChange = (field: string, newValue: any, reason?: string) => {
    const originalValue = getNestedValue(extraction, field);
    
    // Update changes list
    setChanges(prev => {
      const existing = prev.findIndex(c => c.field === field);
      const change: FieldChange = { field, before: originalValue, after: newValue, reason };
      
      if (existing >= 0) {
        // Update existing change
        const updated = [...prev];
        if (JSON.stringify(originalValue) === JSON.stringify(newValue)) {
          // Remove if reverted to original
          updated.splice(existing, 1);
        } else {
          updated[existing] = change;
        }
        return updated;
      } else if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
        // Add new change
        return [...prev, change];
      }
      return prev;
    });
    
    // Update edited data
    setEditedData((prev: any) => {
      const updated = JSON.parse(JSON.stringify(prev));
      setNestedValue(updated, field, newValue);
      return updated;
    });
  };
  
  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove({
        approvedOutput: editedData,
        fieldChanges: changes,
        addedItems: [],  // TODO: Track added observations/actions
        removedItems: [], // TODO: Track removed items
        errorTags,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject('Manual rejection', errorTags);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const confidence = extraction.extraction_metadata?.confidence || 0;
  const confidenceColor = confidence >= 0.9 ? 'bg-green-500' : confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {documentType.replace('_', ' ')}
          </Badge>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${confidenceColor}`} />
            <span className="text-sm text-gray-600">
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          {changes.length > 0 && (
            <Badge variant="secondary">
              {changes.length} change{changes.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDocument(!showDocument)}
          >
            <FileText className="w-4 h-4 mr-2" />
            {showDocument ? 'Hide' : 'Show'} Document
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isSubmitting}
          >
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            <Check className="w-4 h-4 mr-2" />
            {changes.length > 0 ? 'Approve with Changes' : 'Approve'}
          </Button>
        </div>
      </div>
      
      {/* Validation Errors Alert */}
      {validationErrors.length > 0 && (
        <Alert className="m-4 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {validationErrors.length} validation issue{validationErrors.length !== 1 ? 's' : ''} detected. 
            Please review highlighted fields.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Main Content */}
      <div className={`flex-1 flex ${showDocument ? 'gap-4' : ''} p-4 overflow-hidden`}>
        {/* Document Viewer */}
        {showDocument && (
          <div className="w-1/2 h-full">
            <Card className="h-full">
              <CardContent className="p-0 h-full">
                <iframe
                  src={documentUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="Certificate Document"
                />
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Extraction Editor */}
        <div className={`${showDocument ? 'w-1/2' : 'w-full'} h-full overflow-y-auto`}>
          <Tabs defaultValue="core" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="core">Core Fields</TabsTrigger>
              <TabsTrigger value="specific">{documentType.split('_')[0]} Details</TabsTrigger>
              <TabsTrigger value="findings">
                Findings
                {(editedData.findings?.observations?.length > 0 || 
                  editedData.findings?.remedial_actions?.length > 0) && (
                  <Badge variant="secondary" className="ml-2">
                    {(editedData.findings?.observations?.length || 0) + 
                     (editedData.findings?.remedial_actions?.length || 0)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="changes">
                Changes
                {changes.length > 0 && (
                  <Badge variant="default" className="ml-2">{changes.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="core" className="space-y-4">
              {/* Property Section */}
              <FieldSection title="Property">
                <FieldEditor
                  field="property.address_line_1"
                  label="Address Line 1"
                  value={editedData.property?.address_line_1}
                  evidence={editedData.property?.evidence}
                  onChange={(v, r) => handleFieldChange('property.address_line_1', v, r)}
                  hasError={validationErrors.some(e => e.field === 'property.address_line_1')}
                />
                <FieldEditor
                  field="property.address_line_2"
                  label="Address Line 2"
                  value={editedData.property?.address_line_2}
                  onChange={(v, r) => handleFieldChange('property.address_line_2', v, r)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FieldEditor
                    field="property.city"
                    label="City"
                    value={editedData.property?.city}
                    onChange={(v, r) => handleFieldChange('property.city', v, r)}
                  />
                  <FieldEditor
                    field="property.postcode"
                    label="Postcode"
                    value={editedData.property?.postcode}
                    onChange={(v, r) => handleFieldChange('property.postcode', v, r)}
                    hasError={validationErrors.some(e => e.field === 'property.postcode')}
                  />
                </div>
              </FieldSection>
              
              {/* Inspection Section */}
              <FieldSection title="Inspection">
                <div className="grid grid-cols-2 gap-4">
                  <FieldEditor
                    field="inspection.date"
                    label="Inspection Date"
                    value={editedData.inspection?.date}
                    type="date"
                    evidence={editedData.inspection?.evidence}
                    onChange={(v, r) => handleFieldChange('inspection.date', v, r)}
                    hasError={validationErrors.some(e => e.field === 'inspection.date')}
                  />
                  <FieldEditor
                    field="inspection.next_due_date"
                    label="Next Due Date"
                    value={editedData.inspection?.next_due_date}
                    type="date"
                    onChange={(v, r) => handleFieldChange('inspection.next_due_date', v, r)}
                  />
                </div>
                <FieldEditor
                  field="inspection.outcome"
                  label="Outcome"
                  value={editedData.inspection?.outcome}
                  type="select"
                  options={getOutcomeOptions(documentType)}
                  evidence={editedData.inspection?.evidence}
                  onChange={(v, r) => handleFieldChange('inspection.outcome', v, r)}
                  hasError={validationErrors.some(e => e.field === 'inspection.outcome')}
                />
              </FieldSection>
              
              {/* Engineer Section */}
              <FieldSection title="Engineer / Inspector">
                <FieldEditor
                  field="engineer.name"
                  label="Name"
                  value={editedData.engineer?.name}
                  evidence={editedData.engineer?.evidence}
                  onChange={(v, r) => handleFieldChange('engineer.name', v, r)}
                  hasError={validationErrors.some(e => e.field === 'engineer.name')}
                />
                <FieldEditor
                  field="engineer.company"
                  label="Company"
                  value={editedData.engineer?.company}
                  onChange={(v, r) => handleFieldChange('engineer.company', v, r)}
                />
                <FieldEditor
                  field="engineer.registration_id"
                  label="Registration ID"
                  value={editedData.engineer?.registration_id}
                  onChange={(v, r) => handleFieldChange('engineer.registration_id', v, r)}
                  hasError={validationErrors.some(e => e.field.includes('registration'))}
                />
              </FieldSection>
            </TabsContent>
            
            <TabsContent value="specific">
              <DocumentSpecificEditor
                documentType={documentType}
                data={editedData}
                validationErrors={validationErrors}
                onChange={handleFieldChange}
              />
            </TabsContent>
            
            <TabsContent value="findings">
              <FindingsEditor
                observations={editedData.findings?.observations || []}
                remedialActions={editedData.findings?.remedial_actions || []}
                onObservationsChange={(obs) => handleFieldChange('findings.observations', obs)}
                onActionsChange={(acts) => handleFieldChange('findings.remedial_actions', acts)}
              />
            </TabsContent>
            
            <TabsContent value="changes">
              <ChangesReview 
                changes={changes} 
                errorTags={errorTags}
                onErrorTagsChange={setErrorTags}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// Helper component for field sections
function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <Card>
      <CardHeader 
        className="py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// Get outcome options based on document type
function getOutcomeOptions(docType: string): string[] {
  switch (docType) {
    case 'GAS_SAFETY':
      return ['PASS', 'FAIL', 'ADVISORY', 'INCOMPLETE'];
    case 'EICR':
      return ['SATISFACTORY', 'UNSATISFACTORY', 'FURTHER_INVESTIGATION'];
    case 'FIRE_RISK_ASSESSMENT':
      return ['TRIVIAL', 'TOLERABLE', 'MODERATE', 'SUBSTANTIAL', 'INTOLERABLE'];
    default:
      return ['PASS', 'FAIL', 'SATISFACTORY', 'UNSATISFACTORY'];
  }
}

// Utility functions
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[lastKey] = value;
}

2. Create src/components/features/extraction-review/FieldEditor.tsx:

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldEditorProps {
  field: string;
  label: string;
  value: any;
  type?: 'text' | 'date' | 'select' | 'boolean' | 'number';
  options?: string[];
  evidence?: { page: number; text_snippet: string } | null;
  hasError?: boolean;
  onChange: (value: any, reason?: string) => void;
}

export function FieldEditor({
  field,
  label,
  value,
  type = 'text',
  options,
  evidence,
  hasError,
  onChange,
}: FieldEditorProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const [isEdited, setIsEdited] = useState(false);
  
  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
    setIsEdited(newValue !== value);
    onChange(newValue || null);
  };
  
  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue || null);
    }
  };
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={field}
          className={cn(
            "text-sm font-medium",
            hasError && "text-red-600",
            isEdited && "text-blue-600"
          )}
        >
          {label}
          {hasError && <AlertCircle className="w-3 h-3 inline ml-1 text-red-500" />}
          {isEdited && <span className="text-xs ml-1">(edited)</span>}
        </Label>
        
        <div className="flex items-center gap-2">
          {evidence && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <Eye className="w-3 h-3 mr-1" />
                  <span className="text-xs">Page {evidence.page}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Evidence from page {evidence.page}</p>
                  <p className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                    "{evidence.text_snippet}"
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      
      {type === 'select' && options ? (
        <Select value={localValue || ''} onValueChange={handleChange}>
          <SelectTrigger className={cn(hasError && "border-red-500", isEdited && "border-blue-500")}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Not specified</SelectItem>
            {options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === 'boolean' ? (
        <Select value={localValue?.toString() || ''} onValueChange={(v) => handleChange(v === 'true')}>
          <SelectTrigger className={cn(hasError && "border-red-500", isEdited && "border-blue-500")}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unknown</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={field}
          type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            hasError && "border-red-500 focus:ring-red-500",
            isEdited && "border-blue-500 focus:ring-blue-500"
          )}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
}

3. Create src/components/features/extraction-review/ErrorTagSelector.tsx:

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ERROR_TAGS = [
  { id: 'wrong_date_format', label: 'Wrong Date Format', category: 'format' },
  { id: 'missed_table_row', label: 'Missed Table Row', category: 'completeness' },
  { id: 'hallucinated_value', label: 'Hallucinated Value', category: 'accuracy' },
  { id: 'wrong_field_mapping', label: 'Wrong Field Mapping', category: 'mapping' },
  { id: 'missed_defect', label: 'Missed Defect', category: 'completeness' },
  { id: 'name_address_confusion', label: 'Name/Address Confusion', category: 'mapping' },
  { id: 'poor_ocr_quality', label: 'Poor OCR Quality', category: 'source' },
  { id: 'multi_page_missed', label: 'Multi-Page Missed', category: 'completeness' },
  { id: 'handwriting_error', label: 'Handwriting Error', category: 'source' },
  { id: 'wrong_appliance_result', label: 'Wrong Appliance Result', category: 'accuracy' },
  { id: 'missed_observation', label: 'Missed Observation', category: 'completeness' },
  { id: 'wrong_outcome', label: 'Wrong Outcome', category: 'accuracy' },
];

interface ErrorTagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function ErrorTagSelector({ selectedTags, onChange }: ErrorTagSelectorProps) {
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(t => t !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Error Categories
          <span className="text-xs font-normal text-gray-500 ml-2">
            (Select what went wrong for model improvement)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {ERROR_TAGS.map(tag => (
            <Badge
              key={tag.id}
              variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

4. Create src/components/features/extraction-review/ChangesReview.tsx:

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorTagSelector } from './ErrorTagSelector';
import { ArrowRight } from 'lucide-react';

interface ChangesReviewProps {
  changes: Array<{
    field: string;
    before: any;
    after: any;
    reason?: string;
  }>;
  errorTags: string[];
  onErrorTagsChange: (tags: string[]) => void;
}

export function ChangesReview({ changes, errorTags, onErrorTagsChange }: ChangesReviewProps) {
  if (changes.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              No changes made. The extraction looks correct!
            </p>
          </CardContent>
        </Card>
        <ErrorTagSelector selectedTags={errorTags} onChange={onErrorTagsChange} />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {changes.length} Change{changes.length !== 1 ? 's' : ''} Made
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {changes.map((change, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs font-medium text-gray-500 mb-2">
                {change.field}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded line-through">
                  {formatValue(change.before)}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  {formatValue(change.after)}
                </span>
              </div>
              {change.reason && (
                <p className="text-xs text-gray-500 mt-2">
                  Reason: {change.reason}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      
      <ErrorTagSelector selectedTags={errorTags} onChange={onErrorTagsChange} />
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
  return String(value);
}

5. Create src/components/features/extraction-review/index.ts:

export { ExtractionReviewPanel } from './ExtractionReviewPanel';
export { FieldEditor } from './FieldEditor';
export { ErrorTagSelector } from './ErrorTagSelector';
export { ChangesReview } from './ChangesReview';
```

---

## Step 2: Create Review API Endpoints

### Prompt 4.2: Review APIs

```
Create API endpoints for the human review system.

1. Create src/app/api/extractions/[id]/review/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const ApproveSchema = z.object({
  approvedOutput: z.any(),
  fieldChanges: z.array(z.object({
    field: z.string(),
    before: z.any(),
    after: z.any(),
    reason: z.string().optional(),
  })),
  addedItems: z.array(z.any()).default([]),
  removedItems: z.array(z.any()).default([]),
  errorTags: z.array(z.string()).default([]),
});

// POST - Approve extraction with changes
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const data = ApproveSchema.parse(body);
    
    const extractionRun = await prisma.extractionRun.findFirst({
      where: { id: params.id },
      include: { certificate: true },
    });
    
    if (!extractionRun) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // Verify organisation access
    if (extractionRun.certificate.organisationId !== session.user.organisationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Calculate diff summary
    const diffSummary = {
      totalChanges: data.fieldChanges.length,
      addedCount: data.addedItems.length,
      removedCount: data.removedItems.length,
      fieldsChanged: data.fieldChanges.map(c => c.field),
    };
    
    // Create human review record
    const humanReview = await prisma.humanReview.create({
      data: {
        extractionRunId: extractionRun.id,
        reviewerId: session.user.id,
        organisationId: session.user.organisationId,
        approvedOutput: data.approvedOutput,
        fieldChanges: data.fieldChanges,
        addedItems: data.addedItems,
        removedItems: data.removedItems,
        errorTags: data.errorTags,
        wasCorrect: data.fieldChanges.length === 0,
        changeCount: data.fieldChanges.length,
      },
    });
    
    // Update extraction run
    await prisma.extractionRun.update({
      where: { id: extractionRun.id },
      data: {
        finalOutput: data.approvedOutput,
        status: 'APPROVED',
      },
    });
    
    // Update certificate status
    await prisma.certificate.update({
      where: { id: extractionRun.certificateId },
      data: { processingStatus: 'COMPLETED' },
    });
    
    // Create compliance record from approved data
    const complianceRecord = await createComplianceRecord(
      extractionRun.certificate,
      data.approvedOutput,
      session.user.organisationId
    );
    
    return NextResponse.json({
      success: true,
      humanReviewId: humanReview.id,
      complianceRecordId: complianceRecord?.id,
      diffSummary,
    });
    
  } catch (error) {
    console.error('Review approval error:', error);
    return NextResponse.json(
      { error: 'Failed to approve' },
      { status: 500 }
    );
  }
}

async function createComplianceRecord(
  certificate: any,
  approvedOutput: any,
  organisationId: string
) {
  // Map extraction to compliance record
  const inspectionDate = approvedOutput.inspection?.date 
    ? new Date(approvedOutput.inspection.date)
    : new Date();
    
  const nextDueDate = approvedOutput.inspection?.next_due_date
    ? new Date(approvedOutput.inspection.next_due_date)
    : calculateNextDueDate(inspectionDate, certificate.complianceStreamId);
  
  const outcome = mapOutcomeToEnum(approvedOutput.inspection?.outcome);
  const status = calculateComplianceStatus(nextDueDate, outcome);
  
  return prisma.complianceRecord.create({
    data: {
      organisationId,
      propertyId: certificate.propertyId,
      assetId: certificate.assetId,
      complianceStreamId: certificate.complianceStreamId,
      certificateId: certificate.id,
      status,
      inspectionDate,
      nextDueDate,
      outcome,
      contractor: approvedOutput.engineer?.company,
      engineerName: approvedOutput.engineer?.name,
      certificateNumber: getCertificateNumber(approvedOutput),
      defects: approvedOutput.findings?.remedial_actions || [],
      metadata: {
        extractedData: approvedOutput,
        reviewedAt: new Date().toISOString(),
      },
    },
  });
}

function calculateNextDueDate(inspectionDate: Date, streamId: string): Date {
  // Default frequencies by stream type
  const frequencies: Record<string, number> = {
    GAS: 12,
    ELECTRICAL: 60,
    FIRE: 12,
    ASBESTOS: 12,
    LEGIONELLA: 24,
    LIFT: 6,
  };
  
  const months = frequencies[streamId] || 12;
  const nextDue = new Date(inspectionDate);
  nextDue.setMonth(nextDue.getMonth() + months);
  return nextDue;
}

function mapOutcomeToEnum(outcome: string | null): string {
  const mapping: Record<string, string> = {
    'PASS': 'PASS',
    'FAIL': 'FAIL',
    'SATISFACTORY': 'PASS',
    'UNSATISFACTORY': 'FAIL',
    'ADVISORY': 'ADVISORY',
  };
  return mapping[outcome || ''] || 'PASS';
}

function calculateComplianceStatus(nextDueDate: Date, outcome: string): string {
  if (outcome === 'FAIL') return 'NON_COMPLIANT';
  
  const now = new Date();
  const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue < 30) return 'DUE_SOON';
  return 'COMPLIANT';
}

function getCertificateNumber(extraction: any): string | null {
  return extraction.gas_specific?.certificate_number ||
    extraction.eicr_specific?.report_reference ||
    extraction.fra_specific?.assessment_reference ||
    null;
}

2. Create src/app/api/extractions/[id]/reject/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const RejectSchema = z.object({
  reason: z.string().min(1),
  errorTags: z.array(z.string()).default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const data = RejectSchema.parse(body);
    
    const extractionRun = await prisma.extractionRun.findFirst({
      where: { id: params.id },
      include: { certificate: true },
    });
    
    if (!extractionRun) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    if (extractionRun.certificate.organisationId !== session.user.organisationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Update extraction run
    await prisma.extractionRun.update({
      where: { id: extractionRun.id },
      data: { status: 'REJECTED' },
    });
    
    // Update certificate
    await prisma.certificate.update({
      where: { id: extractionRun.certificateId },
      data: { processingStatus: 'FAILED' },
    });
    
    // Create a human review record for tracking
    await prisma.humanReview.create({
      data: {
        extractionRunId: extractionRun.id,
        reviewerId: session.user.id,
        organisationId: session.user.organisationId,
        approvedOutput: {},
        fieldChanges: [],
        errorTags: data.errorTags,
        wasCorrect: false,
        changeCount: 0,
        reviewerNotes: `Rejected: ${data.reason}`,
      },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}

3. Create src/app/api/reviews/stats/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    
    const dateFrom = searchParams.get('dateFrom') 
      ? new Date(searchParams.get('dateFrom')!) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const dateTo = searchParams.get('dateTo')
      ? new Date(searchParams.get('dateTo')!)
      : new Date();
    
    const reviews = await prisma.humanReview.findMany({
      where: {
        organisationId: session.user.organisationId,
        reviewedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      include: {
        extractionRun: {
          select: { documentType: true },
        },
      },
    });
    
    // Calculate stats
    const totalReviews = reviews.length;
    const correctCount = reviews.filter(r => r.wasCorrect).length;
    const accuracyRate = totalReviews > 0 ? correctCount / totalReviews : 0;
    
    const totalChanges = reviews.reduce((sum, r) => sum + r.changeCount, 0);
    const avgChangesPerReview = totalReviews > 0 ? totalChanges / totalReviews : 0;
    
    // Error tag frequency
    const tagCounts: Record<string, number> = {};
    reviews.forEach(r => {
      r.errorTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const topErrorTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    
    // By document type
    const byDocType: Record<string, { total: number; correct: number }> = {};
    reviews.forEach(r => {
      const docType = r.extractionRun.documentType;
      if (!byDocType[docType]) {
        byDocType[docType] = { total: 0, correct: 0 };
      }
      byDocType[docType].total++;
      if (r.wasCorrect) byDocType[docType].correct++;
    });
    
    const byDocumentType = Object.entries(byDocType).map(([type, stats]) => ({
      type,
      total: stats.total,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
    }));
    
    return NextResponse.json({
      totalReviews,
      accuracyRate,
      avgChangesPerReview,
      topErrorTags,
      byDocumentType,
      dateRange: { from: dateFrom, to: dateTo },
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
```

---

## Step 3: Create Review Page

### Prompt 4.3: Review Page

```
Create the extraction review page.

1. Create src/app/(dashboard)/certificates/[id]/review/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtractionReviewPanel } from '@/components/features/extraction-review';
import { Loader2 } from 'lucide-react';

interface PageProps {
  params: { id: string };
}

export default function CertificateReviewPage({ params }: PageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    extractionRun: any;
    extraction: any;
    documentUrl: string;
  } | null>(null);
  
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/certificates/${params.id}/extraction`);
        if (!response.ok) throw new Error('Failed to load');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);
  
  const handleApprove = async (approvalData: any) => {
    const response = await fetch(`/api/extractions/${data?.extractionRun.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvalData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to approve');
    }
    
    router.push(`/certificates/${params.id}`);
  };
  
  const handleReject = async (reason: string, errorTags: string[]) => {
    const response = await fetch(`/api/extractions/${data?.extractionRun.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, errorTags }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to reject');
    }
    
    router.push(`/certificates/${params.id}`);
  };
  
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-600">Error: {error || 'No data'}</p>
      </div>
    );
  }
  
  return (
    <div className="h-screen">
      <ExtractionReviewPanel
        extractionRunId={data.extractionRun.id}
        extraction={data.extraction}
        documentType={data.extractionRun.documentType}
        documentUrl={data.documentUrl}
        validationErrors={data.extractionRun.validationErrors || []}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}

2. Create src/app/api/certificates/[id]/extraction/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { getSignedUrl } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    
    const certificate = await prisma.certificate.findFirst({
      where: {
        id: params.id,
        organisationId: session.user.organisationId,
      },
      include: {
        extractionRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    
    if (!certificate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    const extractionRun = certificate.extractionRuns[0];
    if (!extractionRun) {
      return NextResponse.json({ error: 'No extraction' }, { status: 404 });
    }
    
    // Get signed URL for document
    const documentUrl = await getSignedUrl(certificate.storagePath);
    
    // Return the best available extraction
    const extraction = extractionRun.finalOutput || 
      extractionRun.repairedOutput || 
      extractionRun.validatedOutput || 
      extractionRun.rawOutput;
    
    return NextResponse.json({
      extractionRun: {
        id: extractionRun.id,
        documentType: extractionRun.documentType,
        confidence: extractionRun.confidence,
        status: extractionRun.status,
        validationErrors: extractionRun.validationErrors,
        repairAttempts: extractionRun.repairAttempts,
      },
      extraction,
      documentUrl,
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
```

---

## Verification Checklist

After completing Phase 4, verify:

```
□ Review UI displays correctly
  - Document viewer shows PDF
  - Extraction fields are editable
  - Evidence popover shows page/snippet
  - Error highlighting works

□ Changes are tracked
  - Editing a field marks it as changed
  - Changes tab shows before/after
  - Error tags can be selected

□ Approval flow works
  - Approve creates HumanReview record
  - ExtractionRun status updates to APPROVED
  - ComplianceRecord is created
  - Certificate status updates

□ Rejection flow works
  - Reject updates status to REJECTED
  - Error tags are recorded
  - Certificate marked as FAILED

□ Stats API works
  - Returns accuracy rate
  - Shows top error tags
  - Filters by date range
```

---

## Files Created in Phase 4

```
src/components/features/extraction-review/
  ExtractionReviewPanel.tsx
  FieldEditor.tsx
  ErrorTagSelector.tsx
  ChangesReview.tsx
  FindingsEditor.tsx
  DocumentSpecificEditor.tsx
  index.ts

src/app/api/extractions/[id]/
  review/route.ts
  reject/route.ts

src/app/api/certificates/[id]/
  extraction/route.ts

src/app/api/reviews/
  stats/route.ts

src/app/(dashboard)/certificates/[id]/
  review/page.tsx
```
