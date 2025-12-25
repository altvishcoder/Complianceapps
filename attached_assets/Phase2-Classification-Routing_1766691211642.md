# ComplianceAI™ Model Ownership — Phase 2
## Document Classification & Routing

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 2 (3-4 days) |
| **Objective** | Automatically identify document types and route to specialised extractors |
| **Prerequisites** | Phase 1 complete (schemas & validators) |
| **Outcome** | 95%+ classification accuracy, document-specific extraction |

```
WHAT WE'RE BUILDING:

     Document Upload
           │
           ▼
    ┌─────────────┐
    │ CLASSIFIER  │ ──► "This is an EICR (94% confident)"
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   ROUTER    │ ──► Route to EICR-specific extractor
    └──────┬──────┘
           │
     ┌─────┴─────┬─────────┬──────────┐
     ▼           ▼         ▼          ▼
  ┌─────┐    ┌─────┐   ┌─────┐    ┌─────┐
  │ GAS │    │EICR │   │ FRA │    │ ... │
  │EXTRC│    │EXTRC│   │EXTRC│    │     │
  └─────┘    └─────┘   └─────┘    └─────┘
```

---

## Step 1: Create Document Classifier

### Prompt 2.1: Classification System

```
Create a document classification system that identifies compliance certificate types.

1. Create directory: src/lib/extraction/

2. Create src/lib/extraction/classifier.ts:

import Anthropic from '@anthropic-ai/sdk';
import { DocumentType } from '../extraction-schemas/types';

const anthropic = new Anthropic();

export interface ClassificationResult {
  document_type: DocumentType;
  confidence: number;
  reasoning: string;
  detected_features: string[];
  alternative_types: Array<{
    type: DocumentType;
    confidence: number;
  }>;
}

const CLASSIFICATION_PROMPT = `You are a UK social housing compliance document classifier. Your job is to identify the type of compliance certificate or report.

Analyze the document and determine its type from these options:

1. **GAS_SAFETY** - Gas Safety Certificate (LGSR/CP12)
   Features: Gas Safe logo, "Landlord Gas Safety Record", appliance checks, flue tests, CP12 reference

2. **EICR** - Electrical Installation Condition Report
   Features: NICEIC/NAPIT/ELECSA logo, C1/C2/C3/FI codes, circuit schedules, "satisfactory/unsatisfactory" assessment

3. **FIRE_RISK_ASSESSMENT** - Fire Risk Assessment
   Features: Fire risk rating (trivial/tolerable/moderate/substantial/intolerable), means of escape, compartmentation

4. **ASBESTOS** - Asbestos Survey Report
   Features: ACM (Asbestos Containing Materials), material assessment scores, UKAS accreditation, survey type (management/refurbishment)

5. **LEGIONELLA** - Legionella Risk Assessment
   Features: Water system assessment, temperature readings (>50°C hot, <20°C cold), dead legs, storage tanks

6. **EPC** - Energy Performance Certificate
   Features: Energy rating A-G scale, coloured bars, SAP score, recommendations for improvement

7. **LIFT_LOLER** - Lift Examination Report (LOLER)
   Features: "Thorough examination", safe working load, LOLER 1998 reference, lift identification number

8. **SMOKE_CO_ALARM** - Smoke and Carbon Monoxide Alarm Certificate
   Features: Alarm locations, test results, battery check, Smoke and CO Alarm Regulations reference

9. **UNKNOWN** - Cannot determine or not a compliance certificate

IMPORTANT:
- Look for official logos, registration numbers, and regulatory references
- Check headers, footers, and form titles
- Consider the overall structure and fields present
- If uncertain, provide your best guess with lower confidence

Respond with JSON only:
{
  "document_type": "TYPE",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you classified it this way",
  "detected_features": ["feature1", "feature2", "feature3"],
  "alternative_types": [
    {"type": "SECOND_BEST", "confidence": 0.0-1.0}
  ]
}`;

export async function classifyDocument(
  buffer: Buffer,
  mimeType: string,
  options: {
    filename?: string;
    quickMode?: boolean;  // Use less tokens for speed
  } = {}
): Promise<ClassificationResult> {
  const base64 = buffer.toString('base64');
  
  // Determine media type for Claude
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  if (mimeType === 'application/pdf') {
    mediaType = 'application/pdf';
  } else if (mimeType === 'image/png') {
    mediaType = 'image/png';
  } else if (mimeType === 'image/gif') {
    mediaType = 'image/gif';
  } else if (mimeType === 'image/webp') {
    mediaType = 'image/webp';
  } else {
    mediaType = 'image/jpeg';
  }

  try {
    const response = await anthropic.messages.create({
      model: options.quickMode ? 'claude-3-haiku-20240307' : 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mimeType === 'application/pdf' ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: options.filename 
                ? `${CLASSIFICATION_PROMPT}\n\nFilename hint: ${options.filename}`
                : CLASSIFICATION_PROMPT,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        document_type: parsed.document_type || 'UNKNOWN',
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
        detected_features: parsed.detected_features || [],
        alternative_types: parsed.alternative_types || [],
      };
    }
  } catch (error) {
    console.error('Classification error:', error);
  }
  
  // Return unknown if classification fails
  return {
    document_type: 'UNKNOWN',
    confidence: 0,
    reasoning: 'Classification failed',
    detected_features: [],
    alternative_types: [],
  };
}

// Filename-based hint (quick pre-check)
export function guessTypeFromFilename(filename: string): DocumentType | null {
  const lower = filename.toLowerCase();
  
  const patterns: Array<{ pattern: RegExp; type: DocumentType }> = [
    { pattern: /lgsr|cp12|gas.?safe/i, type: 'GAS_SAFETY' },
    { pattern: /eicr|electric|niceic|napit/i, type: 'EICR' },
    { pattern: /fire.?risk|fra/i, type: 'FIRE_RISK_ASSESSMENT' },
    { pattern: /asbestos|acm/i, type: 'ASBESTOS' },
    { pattern: /legionella|water.?risk/i, type: 'LEGIONELLA' },
    { pattern: /epc|energy.?performance/i, type: 'EPC' },
    { pattern: /loler|lift|elevator/i, type: 'LIFT_LOLER' },
    { pattern: /smoke|co.?alarm|carbon/i, type: 'SMOKE_CO_ALARM' },
  ];
  
  for (const { pattern, type } of patterns) {
    if (pattern.test(lower)) {
      return type;
    }
  }
  
  return null;
}

3. Create tests for the classifier at src/lib/extraction/__tests__/classifier.test.ts:

import { guessTypeFromFilename } from '../classifier';

describe('Document Classifier', () => {
  describe('guessTypeFromFilename', () => {
    it('identifies Gas Safety from filename', () => {
      expect(guessTypeFromFilename('LGSR_123_Smith.pdf')).toBe('GAS_SAFETY');
      expect(guessTypeFromFilename('CP12-certificate.pdf')).toBe('GAS_SAFETY');
      expect(guessTypeFromFilename('gas_safety_record.pdf')).toBe('GAS_SAFETY');
    });
    
    it('identifies EICR from filename', () => {
      expect(guessTypeFromFilename('EICR_report.pdf')).toBe('EICR');
      expect(guessTypeFromFilename('electrical_cert.pdf')).toBe('EICR');
      expect(guessTypeFromFilename('NICEIC_inspection.pdf')).toBe('EICR');
    });
    
    it('returns null for ambiguous filenames', () => {
      expect(guessTypeFromFilename('document.pdf')).toBeNull();
      expect(guessTypeFromFilename('certificate_123.pdf')).toBeNull();
    });
  });
});
```

---

## Step 2: Create Extraction Router

### Prompt 2.2: Router System

```
Create a routing system that directs documents to the appropriate extractor.

1. Create src/lib/extraction/router.ts:

import { DocumentType } from '../extraction-schemas/types';
import { classifyDocument, ClassificationResult, guessTypeFromFilename } from './classifier';
import { validateExtraction } from '../extraction-schemas/validators';

// Import extractors (will be created in later prompts)
import { extractGasSafety } from './extractors/gas-safety';
import { extractEICR } from './extractors/eicr';
import { extractFireRisk } from './extractors/fire-risk';
import { extractAsbestos } from './extractors/asbestos';
import { extractLegionella } from './extractors/legionella';
import { extractEPC } from './extractors/epc';
import { extractLiftLoler } from './extractors/lift-loler';
import { extractGeneric } from './extractors/generic';

export interface ExtractionContext {
  filename: string;
  uploadId: string;
  organisationId: string;
  maxTier?: number;
  forceDocType?: DocumentType;
  skipClassification?: boolean;
}

export interface RoutedExtractionResult {
  // Classification
  classification: ClassificationResult;
  classificationSkipped: boolean;
  
  // Extraction
  extraction: any;
  
  // Validation
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string; code: string }>;
  };
  
  // Processing info
  processing: {
    tier: number;
    cost: number;
    timeMs: number;
    modelVersion: string;
    schemaVersion: string;
  };
}

// Extractor type definition
type ExtractorFn = (
  buffer: Buffer,
  mimeType: string,
  context: ExtractionContext
) => Promise<{
  data: any;
  tier: number;
  cost: number;
}>;

// Extractor registry
const EXTRACTORS: Record<DocumentType, ExtractorFn> = {
  GAS_SAFETY: extractGasSafety,
  EICR: extractEICR,
  FIRE_RISK_ASSESSMENT: extractFireRisk,
  ASBESTOS: extractAsbestos,
  LEGIONELLA: extractLegionella,
  EPC: extractEPC,
  LIFT_LOLER: extractLiftLoler,
  SMOKE_CO_ALARM: extractGeneric,
  UNKNOWN: extractGeneric,
};

export async function routeAndExtract(
  buffer: Buffer,
  mimeType: string,
  context: ExtractionContext
): Promise<RoutedExtractionResult> {
  const startTime = Date.now();
  
  // Step 1: Determine document type
  let classification: ClassificationResult;
  let classificationSkipped = false;
  
  if (context.forceDocType) {
    // Force specific type (skip classification)
    classification = {
      document_type: context.forceDocType,
      confidence: 1.0,
      reasoning: 'Document type forced by user',
      detected_features: [],
      alternative_types: [],
    };
    classificationSkipped = true;
  } else if (context.skipClassification) {
    // Quick mode: just use filename hint
    const hintedType = guessTypeFromFilename(context.filename);
    classification = {
      document_type: hintedType || 'UNKNOWN',
      confidence: hintedType ? 0.6 : 0,
      reasoning: 'Classified from filename only',
      detected_features: [],
      alternative_types: [],
    };
    classificationSkipped = true;
  } else {
    // Full classification
    classification = await classifyDocument(buffer, mimeType, {
      filename: context.filename,
    });
  }
  
  // Step 2: Get appropriate extractor
  const docType = classification.document_type;
  const extractor = EXTRACTORS[docType] || extractGeneric;
  
  // Step 3: Run extraction
  const extractionResult = await extractor(buffer, mimeType, context);
  
  // Step 4: Validate output
  const validation = validateExtraction(docType, extractionResult.data);
  
  // Step 5: Return combined result
  return {
    classification,
    classificationSkipped,
    extraction: extractionResult.data,
    validation,
    processing: {
      tier: extractionResult.tier,
      cost: extractionResult.cost,
      timeMs: Date.now() - startTime,
      modelVersion: 'claude-sonnet-4-20250514',
      schemaVersion: 'v1.0',
    },
  };
}

// Convenience function for re-classification
export async function reclassifyDocument(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<ClassificationResult> {
  return classifyDocument(buffer, mimeType, { filename });
}

2. Create src/lib/extraction/extractors/index.ts:

// Export all extractors
export { extractGasSafety } from './gas-safety';
export { extractEICR } from './eicr';
export { extractFireRisk } from './fire-risk';
export { extractAsbestos } from './asbestos';
export { extractLegionella } from './legionella';
export { extractEPC } from './epc';
export { extractLiftLoler } from './lift-loler';
export { extractGeneric } from './generic';

// Extractor metadata
export const EXTRACTOR_INFO = {
  GAS_SAFETY: {
    name: 'Gas Safety Extractor',
    promptVersion: 'gas_v1.0',
    avgCost: 0.25,
    avgTimeMs: 15000,
  },
  EICR: {
    name: 'EICR Extractor',
    promptVersion: 'eicr_v1.0',
    avgCost: 0.30,
    avgTimeMs: 18000,
  },
  FIRE_RISK_ASSESSMENT: {
    name: 'Fire Risk Extractor',
    promptVersion: 'fra_v1.0',
    avgCost: 0.35,
    avgTimeMs: 20000,
  },
  ASBESTOS: {
    name: 'Asbestos Extractor',
    promptVersion: 'asbestos_v1.0',
    avgCost: 0.30,
    avgTimeMs: 18000,
  },
  LEGIONELLA: {
    name: 'Legionella Extractor',
    promptVersion: 'legionella_v1.0',
    avgCost: 0.25,
    avgTimeMs: 15000,
  },
  EPC: {
    name: 'EPC Extractor',
    promptVersion: 'epc_v1.0',
    avgCost: 0.20,
    avgTimeMs: 12000,
  },
  LIFT_LOLER: {
    name: 'LOLER Extractor',
    promptVersion: 'loler_v1.0',
    avgCost: 0.25,
    avgTimeMs: 15000,
  },
};
```

---

## Step 3: Create Document-Specific Extractors

### Prompt 2.3: Gas Safety Extractor

```
Create the Gas Safety certificate extractor.

Create src/lib/extraction/extractors/gas-safety.ts:

import Anthropic from '@anthropic-ai/sdk';
import { GasSafetySchema, createEmptyGasSafetyExtraction } from '../../extraction-schemas/gas-safety';
import { getSchemaVersion } from '../../extraction-schemas';

const anthropic = new Anthropic();

const PROMPT_VERSION = 'gas_v1.0';

const GAS_SAFETY_PROMPT = `You are an expert at extracting data from UK Gas Safety Certificates (LGSR/CP12).

CRITICAL RULES:
1. For EVERY key field, provide EVIDENCE with page number and exact text snippet from document
2. If a field cannot be found, set it to null AND add to missing_fields with reason
3. Extract ALL appliances listed, even if information is partial
4. Dates MUST be in YYYY-MM-DD format
5. NEVER invent or assume information - only extract what is visible
6. Gas Safe numbers are 6-7 digits

Extract the following into this EXACT JSON structure:

{
  "schema_version": "v1.0",
  "document_type": "GAS_SAFETY",
  
  "source": {
    "filename": "[PROVIDED IN CONTEXT]",
    "upload_id": "[PROVIDED IN CONTEXT]",
    "pages": [COUNT TOTAL PAGES],
    "processing_tier": 4
  },
  
  "property": {
    "address_line_1": "string or null - first line of property address",
    "address_line_2": "string or null",
    "city": "string or null",
    "postcode": "UK postcode or null",
    "uprn": "string or null - if UPRN visible",
    "evidence": {"page": N, "text_snippet": "exact text containing address"} or null
  },
  
  "inspection": {
    "date": "YYYY-MM-DD or null - date inspection was carried out",
    "next_due_date": "YYYY-MM-DD or null - usually 12 months after inspection",
    "outcome": "PASS" | "FAIL" | "ADVISORY" | null,
    "standard": "Gas Safety (Installation and Use) Regulations 1998",
    "evidence": {"page": N, "text_snippet": "text showing date/outcome"} or null
  },
  
  "engineer": {
    "name": "string or null - engineer's name",
    "company": "string or null - gas company/contractor",
    "registration_id": "string or null - Gas Safe number (6-7 digits)",
    "registration_type": "Gas Safe",
    "qualification": "string or null - if visible",
    "evidence": {"page": N, "text_snippet": "text showing engineer details"} or null
  },
  
  "findings": {
    "observations": [
      {
        "id": "obs_1",
        "description": "observation text",
        "location": "where in property or null",
        "severity": "info" | "warning" | "critical",
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ],
    "remedial_actions": [
      {
        "id": "rem_1",
        "description": "action required",
        "priority": "P1" | "P2" | "P3",
        "due_date": "YYYY-MM-DD or null",
        "location": "where or null",
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ]
  },
  
  "gas_specific": {
    "certificate_number": "string or null",
    "certificate_type": "LGSR" | "CP12" | "SERVICE" | "OTHER" | null,
    "landlord_name": "string or null",
    "landlord_address": "string or null",
    "gas_safe_number": "6-7 digit number or null",
    "gas_safe_id_verified": true | false | null,
    
    "appliances": [
      {
        "id": "app_1",
        "type": "Boiler" | "Fire" | "Cooker" | "Water Heater" | etc,
        "location": "where in property",
        "make": "manufacturer or null",
        "model": "model number or null",
        "serial_number": "string or null",
        "checks": {
          "flue_flow": "pass" | "fail" | "na" | null,
          "spillage": "pass" | "fail" | "na" | null,
          "ventilation": "pass" | "fail" | "na" | null,
          "visual_condition": "pass" | "fail" | null,
          "operation": "pass" | "fail" | null,
          "safety_device": "pass" | "fail" | "na" | null
        },
        "result": "PASS" | "FAIL" | "NOT_TESTED" | "NOT_INSPECTED",
        "defects": ["list of defects"],
        "actions_required": ["list of actions"],
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ],
    "appliance_count": N,
    
    "safety_checks": {
      "flue_flow_test": true | false | null,
      "spillage_test": true | false | null,
      "ventilation_adequate": true | false | null,
      "visual_condition": "satisfactory" | "unsatisfactory" | null,
      "pipework_condition": "satisfactory" | "unsatisfactory" | null
    },
    
    "alarms": {
      "co_alarm_present": true | false | null,
      "co_alarm_tested": true | false | null,
      "co_alarm_working": true | false | null,
      "smoke_alarm_present": true | false | null,
      "smoke_alarm_tested": true | false | null
    },
    
    "meter": {
      "location": "string or null",
      "emergency_control_accessible": true | false | null
    }
  },
  
  "extraction_metadata": {
    "confidence": 0.0-1.0,
    "missing_fields": [
      {"field": "path.to.field", "reason": "not_found" | "unclear" | "not_applicable"}
    ],
    "warnings": ["any extraction warnings"],
    "processing_notes": ["any notes about extraction"]
  }
}`;

export async function extractGasSafety(
  buffer: Buffer,
  mimeType: string,
  context: { filename: string; uploadId: string; maxTier?: number }
): Promise<{
  data: GasSafetySchema;
  tier: number;
  cost: number;
}> {
  const base64 = buffer.toString('base64');
  
  const contextAddition = `
CONTEXT:
- Filename: ${context.filename}
- Upload ID: ${context.uploadId}

Return only valid JSON, no other text.`;

  // Determine media type
  let mediaType: any = 'application/pdf';
  if (mimeType.startsWith('image/')) {
    mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mimeType === 'application/pdf' ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: GAS_SAFETY_PROMPT + contextAddition,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let data: GasSafetySchema;
    
    if (jsonMatch) {
      data = JSON.parse(jsonMatch[0]);
      // Ensure source info is set
      data.source = {
        ...data.source,
        filename: context.filename,
        upload_id: context.uploadId,
      };
      data.schema_version = getSchemaVersion('GAS_SAFETY');
    } else {
      data = createEmptyGasSafetyExtraction();
      data.source.filename = context.filename;
      data.source.upload_id = context.uploadId;
      data.extraction_metadata.warnings.push('Failed to parse extraction response');
    }
    
    // Calculate cost
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
    
    return {
      data,
      tier: 4,
      cost,
    };
    
  } catch (error) {
    console.error('Gas Safety extraction error:', error);
    
    const emptyData = createEmptyGasSafetyExtraction();
    emptyData.source.filename = context.filename;
    emptyData.source.upload_id = context.uploadId;
    emptyData.extraction_metadata.warnings.push(`Extraction failed: ${(error as Error).message}`);
    
    return {
      data: emptyData,
      tier: 4,
      cost: 0,
    };
  }
}
```

### Prompt 2.4: EICR Extractor

```
Create the EICR extractor following the same pattern as Gas Safety.

Create src/lib/extraction/extractors/eicr.ts:

import Anthropic from '@anthropic-ai/sdk';
import { EICRSchema } from '../../extraction-schemas/eicr';
import { getSchemaVersion } from '../../extraction-schemas';

const anthropic = new Anthropic();

const EICR_PROMPT = `You are an expert at extracting data from UK Electrical Installation Condition Reports (EICR).

CRITICAL RULES:
1. For EVERY key field, provide EVIDENCE with page number and exact text snippet
2. Extract ALL observation codes (C1, C2, C3, FI) with their descriptions
3. Pay special attention to the OVERALL ASSESSMENT (Satisfactory/Unsatisfactory)
4. Dates MUST be in YYYY-MM-DD format
5. NEVER invent information - only extract what is visible
6. C1 = Danger present, C2 = Potentially dangerous, C3 = Improvement recommended, FI = Further investigation

Extract into this JSON structure:

{
  "schema_version": "v1.0",
  "document_type": "EICR",
  
  "source": {
    "filename": "[FROM CONTEXT]",
    "upload_id": "[FROM CONTEXT]",
    "pages": [PAGE COUNT],
    "processing_tier": 4
  },
  
  "property": {
    "address_line_1": "string or null",
    "address_line_2": "string or null",
    "city": "string or null",
    "postcode": "UK postcode or null",
    "uprn": "string or null",
    "evidence": {"page": N, "text_snippet": "..."} or null
  },
  
  "inspection": {
    "date": "YYYY-MM-DD or null",
    "next_due_date": "YYYY-MM-DD or null - check recommended re-inspection interval",
    "outcome": "SATISFACTORY" | "UNSATISFACTORY" | null,
    "standard": "BS 7671 / Electrical Safety Standards",
    "evidence": {"page": N, "text_snippet": "..."} or null
  },
  
  "engineer": {
    "name": "string or null - qualified supervisor name",
    "company": "string or null",
    "registration_id": "registration number or null",
    "registration_type": "NICEIC" | "NAPIT" | "ELECSA" | "OTHER" | null,
    "qualification": "string or null",
    "evidence": {"page": N, "text_snippet": "..."} or null
  },
  
  "findings": {
    "observations": [
      {
        "id": "obs_1",
        "description": "description",
        "location": "circuit/location",
        "severity": "critical" for C1, "warning" for C2, "info" for C3/FI,
        "code": "C1" | "C2" | "C3" | "FI",
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ],
    "remedial_actions": [
      {
        "id": "rem_1",
        "description": "action required",
        "priority": "P1" for C1, "P2" for C2, "P3" for C3,
        "due_date": null,
        "location": "circuit/location",
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ]
  },
  
  "eicr_specific": {
    "report_reference": "string or null",
    "report_type": "PERIODIC" | "INITIAL" | "MINOR_WORKS" | null,
    "overall_assessment": "SATISFACTORY" | "UNSATISFACTORY" | "FURTHER_INVESTIGATION" | null,
    "client_name": "string or null",
    "client_address": "string or null",
    "registration": {
      "scheme": "NICEIC" | "NAPIT" | "ELECSA" | string | null,
      "registration_number": "string or null"
    },
    "installation_details": {
      "age_of_installation": "string or null",
      "evidence_of_alterations": true | false | null,
      "alterations_details": "string or null",
      "consumer_unit_location": "string or null",
      "consumer_unit_type": "string or null",
      "earthing_arrangement": "TN-S" | "TN-C-S" | "TT" | string | null,
      "main_switch_rating": "string or null"
    },
    "test_results": {
      "circuits_tested": number or null,
      "circuits_satisfactory": number or null,
      "rcd_present": true | false | null,
      "rcd_tested": true | false | null
    },
    "codes": [
      {
        "id": "code_1",
        "code": "C1" | "C2" | "C3" | "FI" | "LIM",
        "description": "full description of observation",
        "location": "circuit/location or null",
        "circuit": "circuit number or null",
        "item_number": "item ref or null",
        "evidence": {"page": N, "text_snippet": "..."}
      }
    ],
    "code_summary": {
      "c1_count": N,
      "c2_count": N,
      "c3_count": N,
      "fi_count": N
    },
    "limitations": ["list of any limitations"],
    "recommended_interval_months": N or null (typically 60 for domestic)
  },
  
  "extraction_metadata": {
    "confidence": 0.0-1.0,
    "missing_fields": [],
    "warnings": [],
    "processing_notes": []
  }
}`;

export async function extractEICR(
  buffer: Buffer,
  mimeType: string,
  context: { filename: string; uploadId: string; maxTier?: number }
): Promise<{
  data: EICRSchema;
  tier: number;
  cost: number;
}> {
  // Implementation follows same pattern as extractGasSafety
  // Use EICR_PROMPT instead of GAS_SAFETY_PROMPT
  // Parse response into EICRSchema type
  
  const base64 = buffer.toString('base64');
  
  let mediaType: any = 'application/pdf';
  if (mimeType.startsWith('image/')) {
    mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mimeType === 'application/pdf' ? 'document' : 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: EICR_PROMPT + `\n\nFilename: ${context.filename}\nUpload ID: ${context.uploadId}\n\nReturn only valid JSON.`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : createEmptyEICRExtraction();
    data.source.filename = context.filename;
    data.source.upload_id = context.uploadId;
    data.schema_version = getSchemaVersion('EICR');
    
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
    
    return { data, tier: 4, cost };
    
  } catch (error) {
    console.error('EICR extraction error:', error);
    return {
      data: createEmptyEICRExtraction(),
      tier: 4,
      cost: 0,
    };
  }
}

function createEmptyEICRExtraction(): EICRSchema {
  // Return empty EICR schema structure
  return {
    schema_version: 'v1.0',
    document_type: 'EICR',
    source: { filename: '', upload_id: '', pages: 0, processing_tier: 4 },
    property: { address_line_1: null, address_line_2: null, city: null, postcode: null, uprn: null, evidence: null },
    inspection: { date: null, next_due_date: null, outcome: null, standard: 'BS 7671', evidence: null },
    engineer: { name: null, company: null, registration_id: null, registration_type: null, qualification: null, evidence: null },
    findings: { observations: [], remedial_actions: [] },
    eicr_specific: {
      report_reference: null,
      report_type: null,
      overall_assessment: null,
      client_name: null,
      client_address: null,
      registration: { scheme: null, registration_number: null },
      installation_details: {
        age_of_installation: null,
        evidence_of_alterations: null,
        alterations_details: null,
        consumer_unit_location: null,
        consumer_unit_type: null,
        earthing_arrangement: null,
        main_switch_rating: null,
      },
      test_results: { circuits_tested: null, circuits_satisfactory: null, rcd_present: null, rcd_tested: null },
      codes: [],
      code_summary: { c1_count: 0, c2_count: 0, c3_count: 0, fi_count: 0 },
      limitations: [],
      recommended_interval_months: null,
    },
    extraction_metadata: { confidence: 0, missing_fields: [], warnings: ['Empty extraction'], processing_notes: [] },
  };
}
```

### Prompt 2.5: Generic and Other Extractors

```
Create the generic extractor and stub files for other document types.

1. Create src/lib/extraction/extractors/generic.ts:

import Anthropic from '@anthropic-ai/sdk';
import { BaseExtractionSchema } from '../../extraction-schemas/types';

const anthropic = new Anthropic();

const GENERIC_PROMPT = `Extract compliance certificate information from this document.

Return JSON with:
{
  "schema_version": "v1.0",
  "document_type": "UNKNOWN",
  "source": { "filename": "", "upload_id": "", "pages": 0, "processing_tier": 4 },
  "property": { "address_line_1": null, "address_line_2": null, "city": null, "postcode": null, "uprn": null, "evidence": null },
  "inspection": { "date": null, "next_due_date": null, "outcome": null, "standard": null, "evidence": null },
  "engineer": { "name": null, "company": null, "registration_id": null, "registration_type": null, "qualification": null, "evidence": null },
  "findings": { "observations": [], "remedial_actions": [] },
  "extraction_metadata": { "confidence": 0, "missing_fields": [], "warnings": [], "processing_notes": [] }
}

Extract what you can find. Include evidence (page + text_snippet) for key fields.`;

export async function extractGeneric(
  buffer: Buffer,
  mimeType: string,
  context: { filename: string; uploadId: string; maxTier?: number }
): Promise<{
  data: BaseExtractionSchema;
  tier: number;
  cost: number;
}> {
  const base64 = buffer.toString('base64');
  
  let mediaType: any = 'application/pdf';
  if (mimeType.startsWith('image/')) {
    mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mimeType === 'application/pdf' ? 'document' : 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: GENERIC_PROMPT },
          ],
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : createEmptyExtraction();
    data.source.filename = context.filename;
    data.source.upload_id = context.uploadId;
    
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
    
    return { data, tier: 4, cost };
  } catch (error) {
    return { data: createEmptyExtraction(), tier: 4, cost: 0 };
  }
}

function createEmptyExtraction(): BaseExtractionSchema {
  return {
    schema_version: 'v1.0',
    document_type: 'UNKNOWN',
    source: { filename: '', upload_id: '', pages: 0, processing_tier: 4 },
    property: { address_line_1: null, address_line_2: null, city: null, postcode: null, uprn: null, evidence: null },
    inspection: { date: null, next_due_date: null, outcome: null, standard: null, evidence: null },
    engineer: { name: null, company: null, registration_id: null, registration_type: null, qualification: null, evidence: null },
    findings: { observations: [], remedial_actions: [] },
    extraction_metadata: { confidence: 0, missing_fields: [], warnings: [], processing_notes: [] },
  };
}

2. Create stub files for other extractors (fire-risk.ts, asbestos.ts, legionella.ts, epc.ts, lift-loler.ts):

Each should follow the same pattern but with document-specific prompts. For now, they can delegate to extractGeneric:

// src/lib/extraction/extractors/fire-risk.ts
import { extractGeneric } from './generic';

export async function extractFireRisk(
  buffer: Buffer,
  mimeType: string,
  context: { filename: string; uploadId: string; maxTier?: number }
) {
  // TODO: Implement fire risk specific extraction
  const result = await extractGeneric(buffer, mimeType, context);
  result.data.document_type = 'FIRE_RISK_ASSESSMENT';
  return result;
}

Create similar stubs for: asbestos.ts, legionella.ts, epc.ts, lift-loler.ts
```

---

## Step 4: Update Certificate Processing

### Prompt 2.6: Integrate Router with Existing Pipeline

```
Update the certificate processing to use the new classification and routing system.

1. Update src/app/api/certificates/[id]/process/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { routeAndExtract } from '@/lib/extraction/router';
import { getFileFromStorage } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    const certificateId = params.id;
    
    // Get certificate
    const certificate = await prisma.certificate.findFirst({
      where: {
        id: certificateId,
        organisationId: session.user.organisationId,
      },
    });
    
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }
    
    // Update status to processing
    await prisma.certificate.update({
      where: { id: certificateId },
      data: { processingStatus: 'PROCESSING' },
    });
    
    // Get file from storage
    const fileBuffer = await getFileFromStorage(certificate.storagePath);
    
    // Run classification and extraction
    const result = await routeAndExtract(fileBuffer, certificate.mimeType, {
      filename: certificate.originalFilename,
      uploadId: certificate.id,
      organisationId: session.user.organisationId,
    });
    
    // Create extraction run record
    const extractionRun = await prisma.extractionRun.create({
      data: {
        certificateId,
        modelVersion: result.processing.modelVersion,
        promptVersion: `${result.classification.document_type.toLowerCase()}_v1.0`,
        schemaVersion: result.processing.schemaVersion,
        documentType: result.classification.document_type,
        classificationConfidence: result.classification.confidence,
        rawOutput: result.extraction,
        validatedOutput: result.validation.valid ? result.extraction : null,
        confidence: result.extraction.extraction_metadata?.confidence || 0,
        processingTier: result.processing.tier,
        processingTimeMs: result.processing.timeMs,
        processingCost: result.processing.cost,
        validationErrors: result.validation.errors,
        validationPassed: result.validation.valid,
        status: result.validation.valid ? 'AWAITING_REVIEW' : 'VALIDATION_FAILED',
      },
    });
    
    // Update certificate
    const needsReview = !result.validation.valid || 
      result.extraction.extraction_metadata?.confidence < 0.8;
    
    await prisma.certificate.update({
      where: { id: certificateId },
      data: {
        processingStatus: needsReview ? 'REVIEW_REQUIRED' : 'COMPLETED',
        processingTier: result.processing.tier,
        processingCost: result.processing.cost,
      },
    });
    
    return NextResponse.json({
      success: true,
      extractionRunId: extractionRun.id,
      classification: result.classification,
      extraction: result.extraction,
      validation: result.validation,
      processing: result.processing,
      needsReview,
    });
    
  } catch (error) {
    console.error('Processing error:', error);
    
    // Update certificate status on error
    await prisma.certificate.update({
      where: { id: params.id },
      data: { processingStatus: 'FAILED' },
    });
    
    return NextResponse.json(
      { error: 'Processing failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

2. Create API endpoint for reclassification at src/app/api/certificates/[id]/reclassify/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { reclassifyDocument } from '@/lib/extraction/router';
import { getFileFromStorage } from '@/lib/storage';

export async function POST(
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
    });
    
    if (!certificate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    const fileBuffer = await getFileFromStorage(certificate.storagePath);
    const classification = await reclassifyDocument(
      fileBuffer,
      certificate.mimeType,
      certificate.originalFilename
    );
    
    return NextResponse.json({ classification });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Reclassification failed' },
      { status: 500 }
    );
  }
}
```

---

## Verification Checklist

After completing Phase 2, verify:

```
□ Classifier works
  - Test with sample Gas Safety PDF
  - Test with sample EICR PDF
  - Verify confidence scores are reasonable
  - Check detected_features are populated

□ Router correctly routes
  - Upload Gas Safety → routed to gas-safety extractor
  - Upload EICR → routed to eicr extractor
  - Unknown type → routed to generic extractor

□ Extractors produce valid output
  - Output matches schema structure
  - Evidence fields are populated
  - Confidence is calculated

□ Database records created
  - ExtractionRun record created for each extraction
  - Classification confidence stored
  - Validation errors stored

□ Certificate status updates
  - Status changes to PROCESSING during extraction
  - Status changes to REVIEW_REQUIRED or COMPLETED after
```

---

## What's Next

Phase 3 will add:
- Field-level validators
- Repair prompts for failed validations
- Auto-retry logic

The routing system from Phase 2 will call the repair pipeline when validation fails.

---

## Files Created in Phase 2

```
src/lib/extraction/
  classifier.ts
  router.ts
  extractors/
    index.ts
    gas-safety.ts
    eicr.ts
    fire-risk.ts (stub)
    asbestos.ts (stub)
    legionella.ts (stub)
    epc.ts (stub)
    lift-loler.ts (stub)
    generic.ts
  __tests__/
    classifier.test.ts

src/app/api/certificates/[id]/
  process/route.ts (updated)
  reclassify/route.ts (new)
```
