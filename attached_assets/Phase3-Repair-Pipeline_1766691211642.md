# ComplianceAI™ Model Ownership — Phase 3
## Validation & Repair Pipeline

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 3 (3-4 days) |
| **Objective** | Auto-detect and repair extraction errors |
| **Prerequisites** | Phase 1 (schemas) + Phase 2 (routing) complete |
| **Outcome** | Self-correcting extraction with 20%+ error reduction |

```
WHAT WE'RE BUILDING:

  Raw Extraction
        │
        ▼
  ┌──────────────┐
  │  VALIDATORS  │ ──► Check each field
  └──────┬───────┘
         │
    Valid? ───► YES ───► Done
         │
         NO
         │
         ▼
  ┌──────────────┐
  │   REPAIR     │ ──► Re-ask model for specific field
  │   PROMPTS    │     with focused context
  └──────┬───────┘
         │
         ▼
  Repaired Extraction
```

---

## Step 1: Create Field Validators

### Prompt 3.1: Field Validation System

```
Create a comprehensive field validation system.

1. Create directory: src/lib/extraction/validators/

2. Create src/lib/extraction/validators/field-validators.ts:

// ==========================================
// FIELD VALIDATION TYPES
// ==========================================

export interface FieldValidationResult {
  valid: boolean;
  field: string;
  value: any;
  message?: string;
  code: ValidationCode;
  severity: 'error' | 'warning';
  suggestedFix?: string;
  repairable: boolean;
}

export type ValidationCode = 
  | 'INVALID_FORMAT'
  | 'INVALID_VALUE'
  | 'MISSING_REQUIRED'
  | 'UNREASONABLE_VALUE'
  | 'MISSING_EVIDENCE'
  | 'EVIDENCE_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'PATTERN_MISMATCH';

// ==========================================
// DATE VALIDATORS
// ==========================================

export function validateDate(
  value: string | null,
  fieldName: string,
  options: {
    required?: boolean;
    allowFuture?: boolean;
    maxYearsAgo?: number;
    maxYearsAhead?: number;
  } = {}
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  // Null handling
  if (value === null || value === undefined || value === '') {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: `${fieldName} is required but not found`,
        suggestedFix: `Look for a date field labeled as ${fieldName.split('.').pop()}`,
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_REQUIRED', severity: 'warning' };
  }
  
  // Format check (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_FORMAT',
      severity: 'error',
      message: `Date "${value}" is not in YYYY-MM-DD format`,
      suggestedFix: 'Convert the date to YYYY-MM-DD format',
    };
  }
  
  // Parse and validate
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'error',
      message: `"${value}" is not a valid date`,
    };
  }
  
  const now = new Date();
  
  // Future date check
  if (!options.allowFuture && date > now) {
    const maxAhead = options.maxYearsAhead || 10;
    const maxDate = new Date(now.getFullYear() + maxAhead, now.getMonth(), now.getDate());
    
    if (date > maxDate) {
      return {
        ...baseResult,
        valid: false,
        code: 'UNREASONABLE_VALUE',
        severity: 'error',
        message: `Date "${value}" is too far in the future`,
        suggestedFix: 'Verify the year is correct',
      };
    }
  }
  
  // Past date check
  const maxYearsAgo = options.maxYearsAgo || 15;
  const minDate = new Date(now.getFullYear() - maxYearsAgo, 0, 1);
  if (date < minDate) {
    return {
      ...baseResult,
      valid: false,
      code: 'UNREASONABLE_VALUE',
      severity: 'warning',
      message: `Date "${value}" seems too old (>${maxYearsAgo} years ago)`,
      suggestedFix: 'Verify the year is correct',
    };
  }
  
  return { ...baseResult, valid: true, code: 'INVALID_FORMAT', severity: 'warning' };
}

// ==========================================
// UK POSTCODE VALIDATOR
// ==========================================

export function validatePostcode(
  value: string | null,
  fieldName: string,
  options: { required?: boolean } = {}
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  if (!value) {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: 'Postcode is required',
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_REQUIRED', severity: 'warning' };
  }
  
  // UK postcode pattern
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  if (!postcodeRegex.test(value.trim())) {
    return {
      ...baseResult,
      valid: false,
      code: 'PATTERN_MISMATCH',
      severity: 'error',
      message: `"${value}" is not a valid UK postcode`,
      suggestedFix: 'Extract the postcode in format like SW1A 1AA',
    };
  }
  
  return { ...baseResult, valid: true, code: 'PATTERN_MISMATCH', severity: 'warning' };
}

// ==========================================
// GAS SAFE NUMBER VALIDATOR
// ==========================================

export function validateGasSafeNumber(
  value: string | null,
  fieldName: string,
  options: { required?: boolean } = {}
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  if (!value) {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: 'Gas Safe number is required for gas certificates',
        suggestedFix: 'Look for a 6 or 7 digit number near the Gas Safe logo',
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_REQUIRED', severity: 'warning' };
  }
  
  // Gas Safe numbers are 6-7 digits
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length < 6 || cleaned.length > 7) {
    return {
      ...baseResult,
      valid: false,
      code: 'PATTERN_MISMATCH',
      severity: 'error',
      message: `Gas Safe number "${value}" should be 6-7 digits`,
      suggestedFix: 'Look for a 6 or 7 digit registration number',
    };
  }
  
  return { ...baseResult, valid: true, code: 'PATTERN_MISMATCH', severity: 'warning' };
}

// ==========================================
// PERSON NAME VALIDATOR
// ==========================================

export function validatePersonName(
  value: string | null,
  fieldName: string,
  options: { required?: boolean } = {}
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  if (!value) {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: `${fieldName} is required`,
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_REQUIRED', severity: 'warning' };
  }
  
  // Check if it looks like an address (common error)
  const addressPatterns = [
    /\d+\s+\w+\s+(street|road|avenue|lane|drive|way|close|court)/i,
    /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i,  // Postcode
    /flat\s+\d/i,
    /\bunit\s+\d/i,
  ];
  
  for (const pattern of addressPatterns) {
    if (pattern.test(value)) {
      return {
        ...baseResult,
        valid: false,
        code: 'TYPE_MISMATCH',
        severity: 'error',
        message: `"${value}" looks like an address, not a name`,
        suggestedFix: 'Extract the person\'s name, not the address',
      };
    }
  }
  
  // Check minimum length
  if (value.trim().length < 2) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'error',
      message: `Name "${value}" is too short`,
    };
  }
  
  // Check for suspicious patterns
  if (/^\d+$/.test(value)) {
    return {
      ...baseResult,
      valid: false,
      code: 'TYPE_MISMATCH',
      severity: 'error',
      message: `"${value}" is a number, not a name`,
    };
  }
  
  return { ...baseResult, valid: true, code: 'INVALID_VALUE', severity: 'warning' };
}

// ==========================================
// REMEDIAL ACTION VALIDATOR
// ==========================================

export function validateRemedialAction(
  value: string,
  fieldName: string
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  if (!value || value.trim().length < 5) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'error',
      message: 'Remedial action description is too short',
    };
  }
  
  // Check for action verbs (indication of actual action)
  const actionVerbs = [
    'replace', 'repair', 'check', 'inspect', 'test', 'install',
    'remove', 'clean', 'service', 'renew', 'upgrade', 'ensure',
    'isolate', 'investigate', 'rectify', 'address', 'correct',
    'fit', 'provide', 'make', 'carry out', 'arrange', 'obtain'
  ];
  
  const lowerValue = value.toLowerCase();
  const hasActionVerb = actionVerbs.some(verb => lowerValue.includes(verb));
  
  if (!hasActionVerb && value.length < 30) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'warning',
      message: `"${value.substring(0, 50)}..." doesn't seem like an action`,
      suggestedFix: 'Extract the full remedial action with specific action required',
    };
  }
  
  return { ...baseResult, valid: true, code: 'INVALID_VALUE', severity: 'warning' };
}

// ==========================================
// EVIDENCE VALIDATOR
// ==========================================

export function validateEvidence(
  evidence: any,
  fieldName: string,
  extractedValue: any,
  options: { required?: boolean } = {}
): FieldValidationResult {
  const baseResult = { field: `${fieldName}.evidence`, value: evidence, repairable: true };
  
  if (!evidence) {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_EVIDENCE',
        severity: 'warning',
        message: `Missing evidence for ${fieldName}`,
        suggestedFix: 'Provide page number and text snippet containing this value',
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_EVIDENCE', severity: 'warning' };
  }
  
  // Check evidence structure
  if (typeof evidence.page !== 'number' || evidence.page < 1) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'warning',
      message: 'Evidence missing valid page number',
    };
  }
  
  if (!evidence.text_snippet || evidence.text_snippet.length < 5) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'warning',
      message: 'Evidence text snippet is too short',
    };
  }
  
  // Check if evidence matches extracted value (basic check)
  if (extractedValue && typeof extractedValue === 'string') {
    const snippetLower = evidence.text_snippet.toLowerCase();
    const valueLower = extractedValue.toLowerCase();
    
    // For short values, check exact presence
    if (extractedValue.length < 20) {
      if (!snippetLower.includes(valueLower)) {
        return {
          ...baseResult,
          valid: false,
          code: 'EVIDENCE_MISMATCH',
          severity: 'warning',
          message: `Evidence doesn't contain the extracted value "${extractedValue}"`,
          suggestedFix: 'Ensure evidence text contains the extracted value',
        };
      }
    }
  }
  
  return { ...baseResult, valid: true, code: 'MISSING_EVIDENCE', severity: 'warning' };
}

// ==========================================
// OUTCOME VALIDATOR
// ==========================================

export function validateOutcome(
  value: string | null,
  fieldName: string,
  validOutcomes: string[],
  options: { required?: boolean } = {}
): FieldValidationResult {
  const baseResult = { field: fieldName, value, repairable: true };
  
  if (!value) {
    if (options.required) {
      return {
        ...baseResult,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: `Outcome is required`,
        suggestedFix: `Look for: ${validOutcomes.join(', ')}`,
      };
    }
    return { ...baseResult, valid: true, code: 'MISSING_REQUIRED', severity: 'warning' };
  }
  
  const normalizedValue = value.toUpperCase().replace(/[^A-Z_]/g, '_');
  
  if (!validOutcomes.includes(normalizedValue) && !validOutcomes.includes(value)) {
    return {
      ...baseResult,
      valid: false,
      code: 'INVALID_VALUE',
      severity: 'error',
      message: `"${value}" is not a valid outcome. Expected: ${validOutcomes.join(', ')}`,
      suggestedFix: `Map to one of: ${validOutcomes.join(', ')}`,
    };
  }
  
  return { ...baseResult, valid: true, code: 'INVALID_VALUE', severity: 'warning' };
}

3. Create src/lib/extraction/validators/extraction-validator.ts:

import { DocumentType } from '../../extraction-schemas/types';
import {
  FieldValidationResult,
  validateDate,
  validatePostcode,
  validateGasSafeNumber,
  validatePersonName,
  validateEvidence,
  validateOutcome,
  validateRemedialAction,
} from './field-validators';

export interface ExtractionValidationResult {
  valid: boolean;
  errors: FieldValidationResult[];
  warnings: FieldValidationResult[];
  repairableErrors: FieldValidationResult[];
}

export function validateGasSafetyExtraction(extraction: any): ExtractionValidationResult {
  const results: FieldValidationResult[] = [];
  
  // Core field validations
  results.push(validateDate(extraction.inspection?.date, 'inspection.date', { required: true }));
  results.push(validateDate(extraction.inspection?.next_due_date, 'inspection.next_due_date', { allowFuture: true }));
  results.push(validatePostcode(extraction.property?.postcode, 'property.postcode'));
  results.push(validatePersonName(extraction.engineer?.name, 'engineer.name', { required: true }));
  results.push(validateGasSafeNumber(extraction.gas_specific?.gas_safe_number, 'gas_specific.gas_safe_number', { required: true }));
  
  // Outcome validation
  results.push(validateOutcome(
    extraction.inspection?.outcome,
    'inspection.outcome',
    ['PASS', 'FAIL', 'ADVISORY', 'INCOMPLETE'],
    { required: true }
  ));
  
  // Evidence validations for key fields
  results.push(validateEvidence(extraction.inspection?.evidence, 'inspection', extraction.inspection?.date, { required: true }));
  results.push(validateEvidence(extraction.engineer?.evidence, 'engineer', extraction.engineer?.name));
  
  // Appliance validations
  const appliances = extraction.gas_specific?.appliances || [];
  appliances.forEach((app: any, index: number) => {
    if (!app.type) {
      results.push({
        field: `gas_specific.appliances[${index}].type`,
        value: app.type,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'error',
        message: 'Appliance type is required',
        repairable: true,
      });
    }
    if (!app.result) {
      results.push({
        field: `gas_specific.appliances[${index}].result`,
        value: app.result,
        valid: false,
        code: 'MISSING_REQUIRED',
        severity: 'warning',
        message: 'Appliance result is missing',
        repairable: true,
      });
    }
  });
  
  // Remedial action validations
  const actions = extraction.findings?.remedial_actions || [];
  actions.forEach((action: any, index: number) => {
    results.push(validateRemedialAction(action.description, `findings.remedial_actions[${index}].description`));
  });
  
  return categorizeResults(results);
}

export function validateEICRExtraction(extraction: any): ExtractionValidationResult {
  const results: FieldValidationResult[] = [];
  
  // Core validations
  results.push(validateDate(extraction.inspection?.date, 'inspection.date', { required: true }));
  results.push(validatePostcode(extraction.property?.postcode, 'property.postcode'));
  results.push(validatePersonName(extraction.engineer?.name, 'engineer.name', { required: true }));
  
  // EICR-specific
  results.push(validateOutcome(
    extraction.eicr_specific?.overall_assessment,
    'eicr_specific.overall_assessment',
    ['SATISFACTORY', 'UNSATISFACTORY', 'FURTHER_INVESTIGATION'],
    { required: true }
  ));
  
  // Code validations
  const codes = extraction.eicr_specific?.codes || [];
  codes.forEach((code: any, index: number) => {
    if (!['C1', 'C2', 'C3', 'FI', 'LIM', 'N/A'].includes(code.code)) {
      results.push({
        field: `eicr_specific.codes[${index}].code`,
        value: code.code,
        valid: false,
        code: 'INVALID_VALUE',
        severity: 'error',
        message: `Invalid EICR code: ${code.code}`,
        repairable: true,
      });
    }
  });
  
  return categorizeResults(results);
}

export function validateExtraction(
  docType: DocumentType,
  extraction: any
): ExtractionValidationResult {
  switch (docType) {
    case 'GAS_SAFETY':
      return validateGasSafetyExtraction(extraction);
    case 'EICR':
      return validateEICRExtraction(extraction);
    // Add other document types
    default:
      return { valid: true, errors: [], warnings: [], repairableErrors: [] };
  }
}

function categorizeResults(results: FieldValidationResult[]): ExtractionValidationResult {
  const errors = results.filter(r => !r.valid && r.severity === 'error');
  const warnings = results.filter(r => !r.valid && r.severity === 'warning');
  const repairableErrors = errors.filter(r => r.repairable);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repairableErrors,
  };
}
```

---

## Step 2: Create Repair Prompts

### Prompt 3.2: Repair System

```
Create the repair prompt system for fixing validation errors.

1. Create src/lib/extraction/repair/repair-prompts.ts:

import Anthropic from '@anthropic-ai/sdk';
import { FieldValidationResult } from '../validators/field-validators';

const anthropic = new Anthropic();

export interface RepairResult {
  field: string;
  originalValue: any;
  repairedValue: any;
  evidence: any;
  success: boolean;
  confidence: number;
  attempts: number;
}

export interface RepairContext {
  documentType: string;
  fullExtraction: any;
  relevantPages?: number[];
  hint?: string;
}

// Build a focused repair prompt for a specific field
function buildRepairPrompt(
  error: FieldValidationResult,
  context: RepairContext
): string {
  const basePrompt = `You are repairing an extraction error from a UK ${context.documentType.replace('_', ' ')} certificate.

FIELD TO REPAIR: ${error.field}
CURRENT VALUE: ${JSON.stringify(error.value)}
ERROR: ${error.message}
${error.suggestedFix ? `HINT: ${error.suggestedFix}` : ''}

Look carefully at the document and find the CORRECT value for this field.

RULES:
1. If the information truly cannot be found, respond with {"found": false}
2. If found, provide the corrected value WITH evidence
3. Be precise - extract exactly what's in the document
4. Evidence must include the page number and exact text snippet

Respond with JSON only:
{
  "found": true | false,
  "value": "corrected value" | null,
  "evidence": {
    "page": page_number,
    "text_snippet": "exact text from document containing the value"
  } | null,
  "confidence": 0.0-1.0,
  "notes": "any relevant notes about the extraction"
}`;

  // Add field-specific guidance
  const fieldGuidance = getFieldSpecificGuidance(error.field, context.documentType);
  
  return basePrompt + (fieldGuidance ? `\n\nFIELD GUIDANCE:\n${fieldGuidance}` : '');
}

function getFieldSpecificGuidance(field: string, docType: string): string {
  const guidance: Record<string, Record<string, string>> = {
    GAS_SAFETY: {
      'inspection.date': 'Look for "Date of inspection", "Inspection date", or similar. Usually near the top of the form.',
      'engineer.name': 'Look for "Engineer name", "Operative", or the signature area. This is a person\'s name, NOT a company name or address.',
      'gas_specific.gas_safe_number': 'Look for a 6 or 7 digit number near the Gas Safe logo. May be labeled "Gas Safe ID" or "Registration No".',
      'inspection.outcome': 'Look for overall result - usually "Pass", "Fail", or a checkbox section. May say "Satisfactory/Unsatisfactory".',
    },
    EICR: {
      'inspection.date': 'Look for "Date of inspection" or "Date" near the top of the report.',
      'eicr_specific.overall_assessment': 'Look for "Overall assessment" - should be SATISFACTORY or UNSATISFACTORY. Usually in a prominent box.',
      'engineer.name': 'Look for "Qualified Supervisor", "Inspector name", or signature area.',
    },
  };
  
  return guidance[docType]?.[field] || '';
}

export async function repairField(
  buffer: Buffer,
  mimeType: string,
  error: FieldValidationResult,
  context: RepairContext
): Promise<RepairResult> {
  const base64 = buffer.toString('base64');
  const prompt = buildRepairPrompt(error, context);
  
  let mediaType: any = 'application/pdf';
  if (mimeType.startsWith('image/')) {
    mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mimeType === 'application/pdf' ? 'document' : 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        field: error.field,
        originalValue: error.value,
        repairedValue: result.found ? result.value : null,
        evidence: result.evidence,
        success: result.found === true && result.value !== null,
        confidence: result.confidence || 0,
        attempts: 1,
      };
    }
  } catch (err) {
    console.error('Repair error:', err);
  }
  
  return {
    field: error.field,
    originalValue: error.value,
    repairedValue: null,
    evidence: null,
    success: false,
    confidence: 0,
    attempts: 1,
  };
}

2. Create src/lib/extraction/repair/repair-pipeline.ts:

import { FieldValidationResult } from '../validators/field-validators';
import { ExtractionValidationResult } from '../validators/extraction-validator';
import { repairField, RepairResult, RepairContext } from './repair-prompts';

export interface RepairPipelineResult {
  repairedExtraction: any;
  repairs: RepairResult[];
  remainingErrors: FieldValidationResult[];
  totalAttempts: number;
  successCount: number;
}

export async function runRepairPipeline(
  buffer: Buffer,
  mimeType: string,
  extraction: any,
  validation: ExtractionValidationResult,
  options: {
    documentType: string;
    maxRepairs?: number;
    maxAttemptsPerField?: number;
  }
): Promise<RepairPipelineResult> {
  const maxRepairs = options.maxRepairs || 5;
  const repairableErrors = validation.repairableErrors.slice(0, maxRepairs);
  
  // Clone extraction for modification
  const repairedExtraction = JSON.parse(JSON.stringify(extraction));
  
  const repairs: RepairResult[] = [];
  const remainingErrors: FieldValidationResult[] = [];
  
  for (const error of repairableErrors) {
    const context: RepairContext = {
      documentType: options.documentType,
      fullExtraction: extraction,
    };
    
    const result = await repairField(buffer, mimeType, error, context);
    repairs.push(result);
    
    if (result.success && result.repairedValue !== null) {
      // Apply repair to extraction
      setNestedValue(repairedExtraction, error.field, result.repairedValue);
      
      // Update evidence if available
      if (result.evidence) {
        const evidenceField = getEvidenceField(error.field);
        if (evidenceField) {
          setNestedValue(repairedExtraction, evidenceField, result.evidence);
        }
      }
    } else {
      remainingErrors.push(error);
    }
  }
  
  // Add errors that weren't attempted
  const notAttempted = validation.repairableErrors.slice(maxRepairs);
  remainingErrors.push(...notAttempted);
  
  // Add non-repairable errors
  remainingErrors.push(...validation.errors.filter(e => !e.repairable));
  
  return {
    repairedExtraction,
    repairs,
    remainingErrors,
    totalAttempts: repairs.length,
    successCount: repairs.filter(r => r.success).length,
  };
}

// Helper to set nested object value
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  const lastKey = keys.pop()!;
  
  let target = obj;
  for (const key of keys) {
    if (target[key] === undefined) {
      target[key] = /^\d+$/.test(keys[keys.indexOf(key) + 1] || '') ? [] : {};
    }
    target = target[key];
  }
  
  target[lastKey] = value;
}

// Get the evidence field path for a given field
function getEvidenceField(field: string): string | null {
  // inspection.date -> inspection.evidence
  // engineer.name -> engineer.evidence
  // gas_specific.appliances[0].type -> gas_specific.appliances[0].evidence
  
  const parts = field.split('.');
  
  // For nested objects like property, inspection, engineer
  if (parts.length === 2 && !parts[1].includes('[')) {
    return `${parts[0]}.evidence`;
  }
  
  // For array items
  if (field.includes('[')) {
    const arrayMatch = field.match(/^(.+\[\d+\])\./);
    if (arrayMatch) {
      return `${arrayMatch[1]}.evidence`;
    }
  }
  
  return null;
}

3. Create src/lib/extraction/repair/index.ts:

export * from './repair-prompts';
export * from './repair-pipeline';
```

---

## Step 3: Integrate Repair into Pipeline

### Prompt 3.3: Update Extraction Router

```
Update the extraction router to include the repair pipeline.

Update src/lib/extraction/router.ts:

// Add import at top
import { validateExtraction } from './validators/extraction-validator';
import { runRepairPipeline, RepairPipelineResult } from './repair/repair-pipeline';

// Update the RoutedExtractionResult interface
export interface RoutedExtractionResult {
  classification: ClassificationResult;
  classificationSkipped: boolean;
  
  // Raw extraction
  rawExtraction: any;
  
  // After validation
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string; code: string }>;
    warnings: Array<{ field: string; message: string }>;
  };
  
  // After repair (if needed)
  repair?: {
    attempted: boolean;
    repairs: Array<{
      field: string;
      success: boolean;
      originalValue: any;
      repairedValue: any;
    }>;
    successCount: number;
  };
  
  // Final extraction (after repairs)
  extraction: any;
  
  processing: {
    tier: number;
    cost: number;
    timeMs: number;
    modelVersion: string;
    schemaVersion: string;
    repairAttempts: number;
  };
}

// Update routeAndExtract function
export async function routeAndExtract(
  buffer: Buffer,
  mimeType: string,
  context: ExtractionContext
): Promise<RoutedExtractionResult> {
  const startTime = Date.now();
  let totalCost = 0;
  
  // Step 1: Classify (existing code)
  let classification: ClassificationResult;
  let classificationSkipped = false;
  
  if (context.forceDocType) {
    classification = {
      document_type: context.forceDocType,
      confidence: 1.0,
      reasoning: 'Forced',
      detected_features: [],
      alternative_types: [],
    };
    classificationSkipped = true;
  } else {
    classification = await classifyDocument(buffer, mimeType, { filename: context.filename });
  }
  
  // Step 2: Extract (existing code)
  const docType = classification.document_type;
  const extractor = EXTRACTORS[docType] || extractGeneric;
  const extractionResult = await extractor(buffer, mimeType, context);
  totalCost += extractionResult.cost;
  
  const rawExtraction = extractionResult.data;
  
  // Step 3: Validate
  const validation = validateExtraction(docType, rawExtraction);
  
  // Step 4: Repair if needed
  let repair: RoutedExtractionResult['repair'];
  let finalExtraction = rawExtraction;
  let repairAttempts = 0;
  
  if (!validation.valid && validation.repairableErrors.length > 0) {
    const repairResult = await runRepairPipeline(
      buffer,
      mimeType,
      rawExtraction,
      validation,
      {
        documentType: docType,
        maxRepairs: 5,
      }
    );
    
    repair = {
      attempted: true,
      repairs: repairResult.repairs.map(r => ({
        field: r.field,
        success: r.success,
        originalValue: r.originalValue,
        repairedValue: r.repairedValue,
      })),
      successCount: repairResult.successCount,
    };
    
    finalExtraction = repairResult.repairedExtraction;
    repairAttempts = repairResult.totalAttempts;
    
    // Estimate repair cost (roughly 0.02 per repair attempt)
    totalCost += repairAttempts * 0.02;
  }
  
  // Step 5: Re-validate after repairs
  const finalValidation = repair?.attempted 
    ? validateExtraction(docType, finalExtraction)
    : validation;
  
  return {
    classification,
    classificationSkipped,
    rawExtraction,
    validation: {
      valid: finalValidation.valid,
      errors: finalValidation.errors.map(e => ({ field: e.field, message: e.message || '', code: e.code })),
      warnings: finalValidation.warnings.map(w => ({ field: w.field, message: w.message || '' })),
    },
    repair,
    extraction: finalExtraction,
    processing: {
      tier: extractionResult.tier,
      cost: totalCost,
      timeMs: Date.now() - startTime,
      modelVersion: 'claude-sonnet-4-20250514',
      schemaVersion: 'v1.0',
      repairAttempts,
    },
  };
}
```

---

## Verification Checklist

After completing Phase 3, verify:

```
□ Validators detect errors
  - Invalid dates are caught
  - Invalid postcodes are caught
  - Names that look like addresses are caught
  - Missing required fields are caught

□ Repair prompts work
  - Test with extraction missing inspection date
  - Test with invalid Gas Safe number
  - Verify repairs are applied correctly

□ Pipeline integrates repairs
  - Process a document with validation errors
  - Verify repair attempts are recorded
  - Check final extraction includes repairs

□ Cost tracking updated
  - Repair attempts add to total cost
  - ExtractionRun records repair attempts

□ Remaining errors tracked
  - Errors that couldn't be repaired are listed
  - Status reflects validation state
```

---

## Files Created in Phase 3

```
src/lib/extraction/
  validators/
    field-validators.ts
    extraction-validator.ts
  repair/
    repair-prompts.ts
    repair-pipeline.ts
    index.ts
  router.ts (updated)
```
