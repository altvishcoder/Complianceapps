# ComplianceAI: Hybrid Document Extraction Pipeline

## Overview

Implement a cost-optimised, intelligent document extraction pipeline that combines template-based extraction (like TCW) for native PDFs with AI fallback for complex documents.

**Effort:** 1.5 weeks | **Impact:** 70-90% cost reduction on certificate processing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Arrives                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 0: PDF Analysis                                        │
│  - Detect if native PDF (has text layer) or scanned         │
│  - Extract raw text if available                            │
│  - Cost: FREE | Speed: <100ms                               │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Native PDF            │     │   Scanned/Image PDF     │
│   (has text layer)      │     │   (no text layer)       │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               │
┌─────────────────────────┐                 │
│  TIER 1: Template       │                 │
│  Extraction             │                 │
│  - Detect cert type     │                 │
│  - Apply regex patterns │                 │
│  - Validate fields      │                 │
│  - Cost: FREE           │                 │
│  - Speed: <200ms        │                 │
└───────────┬─────────────┘                 │
            │                               │
            ▼                               │
       Confidence ≥ 0.85?                   │
       ┌─────┴─────┐                        │
       │           │                        │
      YES         NO                        │
       │           │                        │
       ▼           └────────┬───────────────┘
     DONE ✅                │
                            ▼
              ┌─────────────────────────┐
              │  Document Classifier    │
              │  - Structured cert?     │
              │  - Complex document?    │
              │  - Handwritten content? │
              └───────────┬─────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Structured Cert     │     │ Complex Document    │
│ (CP12, EICR, EPC)   │     │ (FRA, handwritten)  │
└─────────┬───────────┘     └─────────┬───────────┘
          │                           │
          ▼                           │
┌─────────────────────┐               │
│  TIER 2: Azure      │               │
│  Document Intel     │               │
│  - OCR + structure  │               │
│  - Cost: £0.0015    │               │
│  - Speed: 2-5s      │               │
└─────────┬───────────┘               │
          │                           │
          ▼                           │
     Confidence ≥ 0.8?                │
     ┌─────┴─────┐                    │
     │           │                    │
    YES         NO                    │
     │           │                    │
     ▼           └────────┬───────────┘
   DONE ✅                │
                          ▼
            ┌─────────────────────────┐
            │  TIER 3: Claude Vision  │
            │  - Deep understanding   │
            │  - Context awareness    │
            │  - Handwriting capable  │
            │  - Cost: ~£0.01/image   │
            │  - Speed: 3-10s         │
            └───────────┬─────────────┘
                        │
                        ▼
                   Confidence ≥ 0.6?
                   ┌─────┴─────┐
                   │           │
                  YES         NO
                   │           │
                   ▼           ▼
                 DONE ✅    TIER 4: Manual Review
```

## Requirements

### 1. Install Dependencies

```bash
npm install pdf-parse @azure/ai-form-recognizer @anthropic-ai/sdk
```

**Dependencies:**
- `pdf-parse` - Extract text from native PDFs
- `@azure/ai-form-recognizer` - Azure Document Intelligence SDK
- `@anthropic-ai/sdk` - Claude API (likely already installed)

### 2. Create Type Definitions

Create `server/services/extraction/types.ts`:

```typescript
export type ExtractionTier = 
  | 'pdf-native'      // Free - direct PDF text extraction
  | 'template'        // Free - regex/template based
  | 'azure-di'        // £0.0015/page
  | 'claude-vision'   // ~£0.01/image
  | 'manual-review';  // Failed all tiers

export type CertificateType = 
  | 'CP12'            // Gas Safety
  | 'EICR'            // Electrical
  | 'EPC'             // Energy Performance
  | 'FRA'             // Fire Risk Assessment
  | 'LGSR'            // Landlord Gas Safety Record (same as CP12)
  | 'PAT'             // Portable Appliance Testing
  | 'LOLER'           // Lifting equipment
  | 'LEGIONELLA'      // Water safety
  | 'ASBESTOS'        // Asbestos survey
  | 'SMOKE_CO'        // Smoke/CO alarms
  | 'UNKNOWN';

export type DocumentClassification = 
  | 'structured_certificate'   // Standard form-based certs
  | 'complex_document'         // FRAs, surveys with narrative
  | 'handwritten_content'      // Contains handwriting
  | 'unknown';

export interface ExtractedCertificateData {
  certificateType: CertificateType;
  certificateNumber: string | null;
  propertyAddress: string | null;
  uprn: string | null;
  inspectionDate: string | null;       // ISO format
  expiryDate: string | null;           // ISO format
  nextInspectionDate: string | null;   // ISO format
  outcome: 'PASS' | 'FAIL' | 'SATISFACTORY' | 'UNSATISFACTORY' | 'N/A' | null;
  
  // Engineer/Contractor details
  engineerName: string | null;
  engineerRegistration: string | null;  // Gas Safe ID, NICEIC number, etc.
  contractorName: string | null;
  contractorRegistration: string | null;
  
  // Appliance/Asset details (for gas, electrical)
  appliances: ApplianceRecord[];
  
  // Defects/Actions (especially for FRA, EICR)
  defects: DefectRecord[];
  
  // Raw fields that didn't map to known structure
  additionalFields: Record<string, string>;
}

export interface ApplianceRecord {
  type: string;           // Boiler, Cooker, Fire, etc.
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  outcome: 'PASS' | 'FAIL' | null;
  defects: string[];
}

export interface DefectRecord {
  code: string | null;      // C1, C2, C3 for electrical; risk rating for FRA
  description: string;
  location: string | null;
  priority: 'IMMEDIATE' | 'URGENT' | 'ADVISORY' | 'ROUTINE' | null;
  remedialAction: string | null;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedCertificateData | null;
  tier: ExtractionTier;
  confidence: number;           // 0.0 - 1.0
  processingTimeMs: number;
  cost: number;                 // Estimated cost in GBP
  requiresReview: boolean;
  warnings: string[];
  rawText?: string;             // For debugging
  
  // Metadata
  documentClassification: DocumentClassification;
  pdfType: 'native' | 'scanned' | 'image';
  pageCount: number;
}

export interface ExtractionOptions {
  forceAI?: boolean;            // Skip template extraction, go straight to AI
  skipTiers?: ExtractionTier[]; // Skip specific tiers
  preferredTier?: ExtractionTier;
  maxCost?: number;             // Stop if cost exceeds this
  timeout?: number;             // Timeout in ms
}
```

### 3. Create PDF Analyzer

Create `server/services/extraction/pdf-analyzer.ts`:

```typescript
import pdf from 'pdf-parse';
import { DocumentClassification, CertificateType } from './types';

export interface PdfAnalysis {
  hasTextLayer: boolean;
  isScanned: boolean;
  text: string;
  pageCount: number;
  avgCharsPerPage: number;
  detectedCertificateType: CertificateType;
  classification: DocumentClassification;
  hasHandwriting: boolean;  // Heuristic based on text patterns
}

export async function analyzePdf(buffer: Buffer): Promise<PdfAnalysis> {
  let text = '';
  let pageCount = 1;
  
  try {
    const data = await pdf(buffer);
    text = data.text || '';
    pageCount = data.numpages || 1;
  } catch (error) {
    // PDF parsing failed - likely an image or corrupted
    return {
      hasTextLayer: false,
      isScanned: true,
      text: '',
      pageCount: 1,
      avgCharsPerPage: 0,
      detectedCertificateType: 'UNKNOWN',
      classification: 'unknown',
      hasHandwriting: false,
    };
  }
  
  const avgCharsPerPage = text.length / pageCount;
  
  // Heuristic: scanned PDFs have minimal embedded text
  // Native PDFs typically have 500+ chars per page
  const isScanned = avgCharsPerPage < 200;
  const hasTextLayer = text.length > 100;
  
  // Detect certificate type from text content
  const detectedCertificateType = detectCertificateType(text);
  
  // Classify document complexity
  const classification = classifyDocument(text, detectedCertificateType);
  
  // Simple heuristic for handwriting - unusual character patterns
  // (Real detection would need AI, but this catches obvious cases)
  const hasHandwriting = detectHandwritingIndicators(text);
  
  return {
    hasTextLayer,
    isScanned,
    text,
    pageCount,
    avgCharsPerPage,
    detectedCertificateType,
    classification,
    hasHandwriting,
  };
}

function detectCertificateType(text: string): CertificateType {
  const upperText = text.toUpperCase();
  
  // Gas Safety
  if (
    upperText.includes('LANDLORD GAS SAFETY') ||
    upperText.includes('GAS SAFETY RECORD') ||
    upperText.includes('CP12') ||
    upperText.includes('LGSR') ||
    (upperText.includes('GAS SAFE') && upperText.includes('APPLIANCE'))
  ) {
    return 'CP12';
  }
  
  // Electrical
  if (
    upperText.includes('ELECTRICAL INSTALLATION CONDITION REPORT') ||
    upperText.includes('EICR') ||
    upperText.includes('PERIODIC INSPECTION') ||
    (upperText.includes('BS 7671') && upperText.includes('ELECTRICAL'))
  ) {
    return 'EICR';
  }
  
  // EPC
  if (
    upperText.includes('ENERGY PERFORMANCE CERTIFICATE') ||
    upperText.includes('EPC') ||
    upperText.includes('ENERGY EFFICIENCY RATING')
  ) {
    return 'EPC';
  }
  
  // Fire Risk Assessment
  if (
    upperText.includes('FIRE RISK ASSESSMENT') ||
    upperText.includes('FRA') ||
    upperText.includes('PAS 79') ||
    upperText.includes('REGULATORY REFORM (FIRE SAFETY)')
  ) {
    return 'FRA';
  }
  
  // PAT
  if (
    upperText.includes('PORTABLE APPLIANCE TEST') ||
    upperText.includes('PAT TEST') ||
    upperText.includes('PAT REGISTER')
  ) {
    return 'PAT';
  }
  
  // Legionella
  if (
    upperText.includes('LEGIONELLA') ||
    upperText.includes('WATER RISK ASSESSMENT') ||
    upperText.includes('L8') ||
    upperText.includes('HSG274')
  ) {
    return 'LEGIONELLA';
  }
  
  // Asbestos
  if (
    upperText.includes('ASBESTOS') ||
    upperText.includes('ACM') ||
    upperText.includes('ASBESTOS CONTAINING MATERIAL')
  ) {
    return 'ASBESTOS';
  }
  
  // LOLER
  if (
    upperText.includes('LOLER') ||
    upperText.includes('LIFTING OPERATIONS') ||
    upperText.includes('THOROUGH EXAMINATION')
  ) {
    return 'LOLER';
  }
  
  // Smoke/CO
  if (
    upperText.includes('SMOKE ALARM') ||
    upperText.includes('CARBON MONOXIDE') ||
    upperText.includes('CO ALARM') ||
    upperText.includes('SMOKE AND CO')
  ) {
    return 'SMOKE_CO';
  }
  
  return 'UNKNOWN';
}

function classifyDocument(text: string, certType: CertificateType): DocumentClassification {
  // FRAs and Asbestos surveys are complex narrative documents
  if (certType === 'FRA' || certType === 'ASBESTOS') {
    return 'complex_document';
  }
  
  // Long documents with lots of prose are likely complex
  const wordCount = text.split(/\s+/).length;
  const avgWordLength = text.length / wordCount;
  
  if (wordCount > 2000) {
    return 'complex_document';
  }
  
  // Standard certificates
  if (['CP12', 'EICR', 'EPC', 'PAT', 'LOLER', 'SMOKE_CO', 'LEGIONELLA'].includes(certType)) {
    return 'structured_certificate';
  }
  
  return 'unknown';
}

function detectHandwritingIndicators(text: string): boolean {
  // Very basic heuristic - handwritten text often has:
  // - Unusual spacing patterns
  // - OCR artifacts like mixed case mid-word
  // - Unusual character sequences
  
  // This is a placeholder - real detection needs AI
  // For now, just flag if text has OCR-like artifacts
  const hasOcrArtifacts = /[A-Z][a-z][A-Z]/.test(text) || // MixedCase mid-word
                         /[0-9][A-Za-z][0-9]/.test(text);  // Number-letter-number
  
  return hasOcrArtifacts;
}
```

### 4. Create Certificate Templates

Create `server/services/extraction/templates/index.ts`:

```typescript
import { CertificateType, ExtractedCertificateData, ApplianceRecord, DefectRecord } from '../types';

export interface CertificateTemplate {
  type: CertificateType;
  patterns: {
    [K in keyof Partial<ExtractedCertificateData>]: RegExp[];
  };
  appliancePatterns?: {
    block: RegExp;  // Pattern to find appliance blocks
    fields: Record<string, RegExp[]>;
  };
  defectPatterns?: {
    block: RegExp;
    fields: Record<string, RegExp[]>;
  };
  validators: {
    [field: string]: (value: string) => boolean;
  };
  dateFormats: string[];  // Expected date formats for parsing
}

// Gas Safety Record (CP12/LGSR)
export const CP12_TEMPLATE: CertificateTemplate = {
  type: 'CP12',
  patterns: {
    certificateNumber: [
      /(?:Certificate|Cert|Record)\s*(?:No|Number|#|Ref)[.:\s]*([A-Z0-9][-A-Z0-9]{4,20})/i,
      /(?:Job|Reference|Ref)\s*(?:No|Number|#)?[.:\s]*([A-Z0-9][-A-Z0-9]{4,20})/i,
      /GS[-\s]?(\d{4,}[-\s]?\d*)/i,
    ],
    propertyAddress: [
      /(?:Property|Premises|Address)[:\s]*\n?([\s\S]{10,100}?)(?=\n\s*(?:Postcode|Post Code|Tel|Phone|Landlord|Date))/i,
      /(?:Address of premises)[:\s]*\n?([\s\S]{10,100}?)(?=\n\s*\w)/i,
    ],
    inspectionDate: [
      /(?:Date\s*of\s*)?(?:Inspection|Check|Visit)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:Inspected|Checked)\s*(?:on)?[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    expiryDate: [
      /(?:Expiry|Expires|Valid Until|Next\s*Test\s*Due)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:Next\s*Inspection)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    engineerName: [
      /(?:Engineer|Operative|Technician)(?:'s)?\s*(?:Name)?[:\s]*([A-Za-z][-A-Za-z\s\.]{2,40})/i,
      /(?:Carried out by|Inspected by)[:\s]*([A-Za-z][-A-Za-z\s\.]{2,40})/i,
    ],
    engineerRegistration: [
      /(?:Gas\s*Safe|GS)\s*(?:ID|No|Number|Reg(?:istration)?)[.:\s]*(\d{5,7})/i,
      /(?:ID\s*No|Registration)[.:\s]*(\d{5,7})/i,
    ],
    contractorName: [
      /(?:Company|Contractor|Business|Employer)[:\s]*([A-Za-z][-A-Za-z0-9\s\.,&]{2,60})/i,
    ],
    outcome: [
      /(?:Overall|Final)?\s*(?:Result|Outcome|Status)[:\s]*(PASS|FAIL|SATISFACTORY|UNSATISFACTORY|AT RISK|NOT AT RISK)/i,
      /(?:Installation|Property)\s*(?:is\s*)?(SATISFACTORY|UNSATISFACTORY|AT RISK|NOT AT RISK)/i,
      /\b(PASS|FAIL)\b/,
    ],
  },
  appliancePatterns: {
    block: /(?:Appliance\s*\d+|Appliance Type)[:\s]*([\s\S]*?)(?=Appliance\s*\d+|Appliance Type|$)/gi,
    fields: {
      type: [/(?:Type|Appliance)[:\s]*([A-Za-z\s]+)/i],
      make: [/(?:Make|Manufacturer)[:\s]*([A-Za-z0-9\s]+)/i],
      model: [/(?:Model)[:\s]*([A-Za-z0-9\s-]+)/i],
      serialNumber: [/(?:Serial|S\/N)[:\s]*([A-Za-z0-9-]+)/i],
      location: [/(?:Location|Room|Located)[:\s]*([A-Za-z\s]+)/i],
      outcome: [/(PASS|FAIL|ID|NCS|AR)/i],  // AR = At Risk, ID = Immediately Dangerous
    },
  },
  validators: {
    engineerRegistration: (id) => /^\d{5,7}$/.test(id),
    inspectionDate: (date) => isValidDateString(date),
    expiryDate: (date) => isValidDateString(date),
  },
  dateFormats: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'],
};

// Electrical Installation Condition Report (EICR)
export const EICR_TEMPLATE: CertificateTemplate = {
  type: 'EICR',
  patterns: {
    certificateNumber: [
      /(?:Certificate|Report)\s*(?:No|Number|Ref)[.:\s]*([A-Z0-9][-A-Z0-9]{4,20})/i,
      /(?:Serial|Reference)\s*(?:No|Number)?[.:\s]*([A-Z0-9][-A-Z0-9]{4,20})/i,
    ],
    propertyAddress: [
      /(?:Installation|Property)\s*Address[:\s]*\n?([\s\S]{10,100}?)(?=\n\s*(?:Postcode|Post Code|Occupier|Client|Date))/i,
    ],
    inspectionDate: [
      /(?:Date\s*of\s*)?(?:Inspection|Report)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    expiryDate: [
      /(?:Recommended\s*)?(?:Re-?inspection|Next\s*Inspection)[:\s]*(?:by|date)?[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:Valid\s*until|Expires)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    engineerName: [
      /(?:Inspector|Contractor)[:\s]*([A-Za-z][-A-Za-z\s\.]{2,40})/i,
    ],
    engineerRegistration: [
      /(?:NICEIC|NAPIT|ELECSA|ECA)\s*(?:No|Number|Reg)[.:\s]*([A-Z0-9]+)/i,
      /(?:Registration|Reg)\s*(?:No|Number)?[.:\s]*([A-Z0-9]+)/i,
    ],
    outcome: [
      /(?:Overall\s*)?(?:Assessment|Condition)[:\s]*(SATISFACTORY|UNSATISFACTORY)/i,
      /(?:Installation\s*)?(?:is\s*)?(SATISFACTORY|UNSATISFACTORY)/i,
    ],
  },
  defectPatterns: {
    block: /(?:Observation|Code\s*[C123]|Defect)[:\s]*([\s\S]*?)(?=Observation|Code\s*[C123]|Defect|$)/gi,
    fields: {
      code: [/(C1|C2|C3|FI|LIM)/i],  // C1=Danger, C2=Potentially Dangerous, C3=Improvement
      description: [/(?:Description|Observation)[:\s]*(.+)/i],
      location: [/(?:Location|Circuit)[:\s]*(.+)/i],
    },
  },
  validators: {
    inspectionDate: (date) => isValidDateString(date),
    outcome: (val) => ['SATISFACTORY', 'UNSATISFACTORY'].includes(val.toUpperCase()),
  },
  dateFormats: ['DD/MM/YYYY', 'DD-MM-YYYY'],
};

// EPC Template
export const EPC_TEMPLATE: CertificateTemplate = {
  type: 'EPC',
  patterns: {
    certificateNumber: [
      /(?:Certificate|RRN)\s*(?:Number|Reference)[:\s]*(\d{4}-\d{4}-\d{4}-\d{4}-\d{4})/i,
      /(?:Report\s*Reference)[:\s]*(\d{4}-\d{4}-\d{4}-\d{4}-\d{4})/i,
    ],
    propertyAddress: [
      /(?:Address)[:\s]*\n?([\s\S]{10,100}?)(?=\n\s*(?:Date|Type|Floor))/i,
    ],
    inspectionDate: [
      /(?:Date\s*of\s*)?(?:Assessment|Certificate)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
      /(?:Valid from)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
    ],
    expiryDate: [
      /(?:Valid until|Expiry)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
    ],
    engineerName: [
      /(?:Assessor|Name)[:\s]*([A-Za-z][-A-Za-z\s\.]{2,40})/i,
    ],
    engineerRegistration: [
      /(?:Assessor\s*ID|Accreditation)[:\s]*([A-Z]{4}\d{6})/i,
    ],
  },
  validators: {
    certificateNumber: (num) => /^\d{4}-\d{4}-\d{4}-\d{4}-\d{4}$/.test(num),
  },
  dateFormats: ['DD MMMM YYYY', 'DD/MM/YYYY'],
};

// Export all templates
export const CERTIFICATE_TEMPLATES: Record<CertificateType, CertificateTemplate | null> = {
  'CP12': CP12_TEMPLATE,
  'LGSR': CP12_TEMPLATE,  // Same as CP12
  'EICR': EICR_TEMPLATE,
  'EPC': EPC_TEMPLATE,
  'FRA': null,            // Too complex for templates - use AI
  'PAT': null,            // TODO: Add template
  'LOLER': null,          // TODO: Add template
  'LEGIONELLA': null,     // TODO: Add template
  'ASBESTOS': null,       // Too complex for templates - use AI
  'SMOKE_CO': null,       // TODO: Add template
  'UNKNOWN': null,
};

// Helper function
function isValidDateString(dateStr: string): boolean {
  // Basic validation - more sophisticated parsing needed
  const datePattern = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/;
  return datePattern.test(dateStr);
}
```

### 5. Create Template Extractor

Create `server/services/extraction/template-extractor.ts`:

```typescript
import { 
  CertificateTemplate, 
  CERTIFICATE_TEMPLATES 
} from './templates';
import { 
  CertificateType, 
  ExtractedCertificateData, 
  ApplianceRecord,
  DefectRecord,
  ExtractionResult 
} from './types';
import { PdfAnalysis } from './pdf-analyzer';

interface TemplateExtractionResult {
  success: boolean;
  data: Partial<ExtractedCertificateData>;
  confidence: number;
  matchedFields: string[];
  missingFields: string[];
}

export function extractUsingTemplate(
  analysis: PdfAnalysis
): ExtractionResult | null {
  const startTime = Date.now();
  
  const { text, detectedCertificateType } = analysis;
  
  // Get template for this certificate type
  const template = CERTIFICATE_TEMPLATES[detectedCertificateType];
  
  if (!template) {
    // No template available for this type
    return null;
  }
  
  // Extract fields using template patterns
  const extraction = extractFields(text, template);
  
  // Calculate confidence
  const confidence = calculateConfidence(extraction, detectedCertificateType);
  
  if (confidence < 0.5) {
    // Too low confidence - don't return result
    return null;
  }
  
  // Build result
  const data: ExtractedCertificateData = {
    certificateType: detectedCertificateType,
    certificateNumber: extraction.data.certificateNumber as string || null,
    propertyAddress: cleanAddress(extraction.data.propertyAddress as string) || null,
    uprn: extraction.data.uprn as string || null,
    inspectionDate: parseDate(extraction.data.inspectionDate as string) || null,
    expiryDate: parseDate(extraction.data.expiryDate as string) || null,
    nextInspectionDate: parseDate(extraction.data.nextInspectionDate as string) || null,
    outcome: normalizeOutcome(extraction.data.outcome as string),
    engineerName: extraction.data.engineerName as string || null,
    engineerRegistration: extraction.data.engineerRegistration as string || null,
    contractorName: extraction.data.contractorName as string || null,
    contractorRegistration: extraction.data.contractorRegistration as string || null,
    appliances: extractAppliances(text, template),
    defects: extractDefects(text, template),
    additionalFields: {},
  };
  
  return {
    success: confidence >= 0.7,
    data,
    tier: 'template',
    confidence,
    processingTimeMs: Date.now() - startTime,
    cost: 0,  // Free!
    requiresReview: confidence < 0.85,
    warnings: generateWarnings(extraction, data),
    rawText: text,
    documentClassification: analysis.classification,
    pdfType: analysis.isScanned ? 'scanned' : 'native',
    pageCount: analysis.pageCount,
  };
}

function extractFields(
  text: string, 
  template: CertificateTemplate
): TemplateExtractionResult {
  const data: Partial<ExtractedCertificateData> = {};
  const matchedFields: string[] = [];
  const missingFields: string[] = [];
  
  for (const [field, patterns] of Object.entries(template.patterns)) {
    let matched = false;
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        
        // Validate if validator exists
        const validator = template.validators[field];
        if (!validator || validator(value)) {
          (data as any)[field] = value;
          matchedFields.push(field);
          matched = true;
          break;
        }
      }
    }
    
    if (!matched) {
      missingFields.push(field);
    }
  }
  
  return {
    success: matchedFields.length > 0,
    data,
    confidence: matchedFields.length / Object.keys(template.patterns).length,
    matchedFields,
    missingFields,
  };
}

function calculateConfidence(
  extraction: TemplateExtractionResult,
  certType: CertificateType
): number {
  // Define critical fields per certificate type
  const criticalFields: Record<CertificateType, string[]> = {
    'CP12': ['certificateNumber', 'inspectionDate', 'engineerRegistration', 'outcome'],
    'LGSR': ['certificateNumber', 'inspectionDate', 'engineerRegistration', 'outcome'],
    'EICR': ['certificateNumber', 'inspectionDate', 'outcome'],
    'EPC': ['certificateNumber', 'inspectionDate'],
    'FRA': ['inspectionDate'],
    'PAT': ['inspectionDate'],
    'LOLER': ['inspectionDate'],
    'LEGIONELLA': ['inspectionDate'],
    'ASBESTOS': ['inspectionDate'],
    'SMOKE_CO': ['inspectionDate'],
    'UNKNOWN': ['inspectionDate'],
  };
  
  const critical = criticalFields[certType] || ['inspectionDate'];
  const foundCritical = critical.filter(f => extraction.matchedFields.includes(f));
  
  // Weight: 60% critical fields, 40% all fields
  const criticalScore = foundCritical.length / critical.length;
  const overallScore = extraction.confidence;
  
  return (criticalScore * 0.6) + (overallScore * 0.4);
}

function extractAppliances(text: string, template: CertificateTemplate): ApplianceRecord[] {
  if (!template.appliancePatterns) {
    return [];
  }
  
  const appliances: ApplianceRecord[] = [];
  const blockPattern = template.appliancePatterns.block;
  
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    const block = match[1];
    const appliance: ApplianceRecord = {
      type: extractField(block, template.appliancePatterns.fields.type) || 'Unknown',
      make: extractField(block, template.appliancePatterns.fields.make),
      model: extractField(block, template.appliancePatterns.fields.model),
      serialNumber: extractField(block, template.appliancePatterns.fields.serialNumber),
      location: extractField(block, template.appliancePatterns.fields.location),
      outcome: normalizeApplianceOutcome(extractField(block, template.appliancePatterns.fields.outcome)),
      defects: [],
    };
    
    if (appliance.type !== 'Unknown' || appliance.make || appliance.model) {
      appliances.push(appliance);
    }
  }
  
  return appliances;
}

function extractDefects(text: string, template: CertificateTemplate): DefectRecord[] {
  if (!template.defectPatterns) {
    return [];
  }
  
  const defects: DefectRecord[] = [];
  const blockPattern = template.defectPatterns.block;
  
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    const block = match[1];
    const defect: DefectRecord = {
      code: extractField(block, template.defectPatterns.fields.code),
      description: extractField(block, template.defectPatterns.fields.description) || '',
      location: extractField(block, template.defectPatterns.fields.location),
      priority: mapDefectCodeToPriority(extractField(block, template.defectPatterns.fields.code)),
      remedialAction: null,
    };
    
    if (defect.description) {
      defects.push(defect);
    }
  }
  
  return defects;
}

function extractField(text: string, patterns?: RegExp[]): string | null {
  if (!patterns) return null;
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function cleanAddress(address: string | undefined): string | null {
  if (!address) return null;
  return address
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ', ')
    .trim();
}

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  // Try common UK date formats
  const formats = [
    { pattern: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/, order: 'dmy' },
    { pattern: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/, order: 'dmy2' },
    { pattern: /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, order: 'ymd' },
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format.pattern);
    if (match) {
      let year: number, month: number, day: number;
      
      if (format.order === 'dmy') {
        [, day, month, year] = match.map(Number);
      } else if (format.order === 'dmy2') {
        [, day, month, year] = match.map(Number);
        year = year < 50 ? 2000 + year : 1900 + year;
      } else {
        [, year, month, day] = match.map(Number);
      }
      
      // Return ISO format
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  return null;
}

function normalizeOutcome(outcome: string | undefined): ExtractedCertificateData['outcome'] {
  if (!outcome) return null;
  
  const upper = outcome.toUpperCase();
  if (upper.includes('PASS') || upper.includes('SATISFACTORY') || upper.includes('NOT AT RISK')) {
    return 'PASS';
  }
  if (upper.includes('FAIL') || upper.includes('UNSATISFACTORY') || upper.includes('AT RISK')) {
    return 'FAIL';
  }
  return null;
}

function normalizeApplianceOutcome(outcome: string | null): 'PASS' | 'FAIL' | null {
  if (!outcome) return null;
  
  const upper = outcome.toUpperCase();
  if (['PASS', 'P', 'OK', 'NCS'].includes(upper)) return 'PASS';
  if (['FAIL', 'F', 'ID', 'AR', 'NCS'].includes(upper)) return 'FAIL';
  return null;
}

function mapDefectCodeToPriority(code: string | null): DefectRecord['priority'] {
  if (!code) return null;
  
  const upper = code.toUpperCase();
  if (upper === 'C1' || upper === 'FI') return 'IMMEDIATE';
  if (upper === 'C2') return 'URGENT';
  if (upper === 'C3') return 'ADVISORY';
  return null;
}

function generateWarnings(
  extraction: TemplateExtractionResult,
  data: ExtractedCertificateData
): string[] {
  const warnings: string[] = [];
  
  // Check for missing critical fields
  if (!data.certificateNumber) {
    warnings.push('Certificate number could not be extracted');
  }
  if (!data.inspectionDate) {
    warnings.push('Inspection date could not be extracted');
  }
  if (!data.outcome) {
    warnings.push('Outcome/result could not be determined');
  }
  if (!data.engineerRegistration && data.certificateType === 'CP12') {
    warnings.push('Gas Safe registration number not found');
  }
  
  // Check for potentially invalid data
  if (data.inspectionDate && new Date(data.inspectionDate) > new Date()) {
    warnings.push('Inspection date appears to be in the future');
  }
  
  return warnings;
}
```

### 6. Create Azure Document Intelligence Service

Create `server/services/extraction/azure-di.ts`:

```typescript
import { 
  DocumentAnalysisClient, 
  AzureKeyCredential 
} from '@azure/ai-form-recognizer';
import { 
  ExtractionResult, 
  ExtractedCertificateData,
  CertificateType 
} from './types';
import { PdfAnalysis } from './pdf-analyzer';

let client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (!client) {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    if (!endpoint || !key) {
      throw new Error('Azure Document Intelligence credentials not configured');
    }
    
    client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  }
  return client;
}

export async function extractWithAzureDI(
  buffer: Buffer,
  analysis: PdfAnalysis
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    const client = getClient();
    
    // Use prebuilt-document model for general extraction
    const poller = await client.beginAnalyzeDocument(
      'prebuilt-document',
      buffer,
      {
        contentType: 'application/pdf',
      }
    );
    
    const result = await poller.pollUntilDone();
    
    // Extract key-value pairs
    const keyValuePairs = result.keyValuePairs || [];
    const tables = result.tables || [];
    const content = result.content || '';
    
    // Map Azure results to our data structure
    const data = mapAzureResultToData(
      keyValuePairs, 
      tables, 
      content, 
      analysis.detectedCertificateType
    );
    
    // Calculate confidence
    const confidence = calculateAzureConfidence(data, keyValuePairs);
    
    return {
      success: confidence >= 0.6,
      data,
      tier: 'azure-di',
      confidence,
      processingTimeMs: Date.now() - startTime,
      cost: 0.0015 * analysis.pageCount,  // £1.50 per 1000 pages
      requiresReview: confidence < 0.8,
      warnings: generateAzureWarnings(data, confidence),
      rawText: content,
      documentClassification: analysis.classification,
      pdfType: analysis.isScanned ? 'scanned' : 'native',
      pageCount: analysis.pageCount,
    };
    
  } catch (error) {
    console.error('Azure DI extraction failed:', error);
    
    return {
      success: false,
      data: null,
      tier: 'azure-di',
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      cost: 0.0015 * analysis.pageCount,  // Still charged
      requiresReview: true,
      warnings: [`Azure DI extraction failed: ${error.message}`],
      documentClassification: analysis.classification,
      pdfType: analysis.isScanned ? 'scanned' : 'native',
      pageCount: analysis.pageCount,
    };
  }
}

function mapAzureResultToData(
  keyValuePairs: any[],
  tables: any[],
  content: string,
  certType: CertificateType
): ExtractedCertificateData {
  // Build a map of key-value pairs
  const kvMap: Record<string, string> = {};
  
  for (const pair of keyValuePairs) {
    if (pair.key?.content && pair.value?.content) {
      const key = pair.key.content.toLowerCase().trim();
      const value = pair.value.content.trim();
      kvMap[key] = value;
    }
  }
  
  // Map to our structure using flexible key matching
  const data: ExtractedCertificateData = {
    certificateType: certType,
    certificateNumber: findValue(kvMap, [
      'certificate number', 'certificate no', 'cert no', 'reference', 'ref'
    ]),
    propertyAddress: findValue(kvMap, [
      'address', 'property address', 'premises', 'installation address'
    ]),
    uprn: findValue(kvMap, ['uprn']),
    inspectionDate: parseAzureDate(findValue(kvMap, [
      'inspection date', 'date of inspection', 'date', 'inspected'
    ])),
    expiryDate: parseAzureDate(findValue(kvMap, [
      'expiry date', 'valid until', 'next inspection', 'expires'
    ])),
    nextInspectionDate: parseAzureDate(findValue(kvMap, [
      'next inspection date', 'reinspection date', 'next test due'
    ])),
    outcome: normalizeOutcome(findValue(kvMap, [
      'result', 'outcome', 'overall result', 'assessment'
    ])),
    engineerName: findValue(kvMap, [
      'engineer', 'inspector', 'operative', 'technician', 'assessor'
    ]),
    engineerRegistration: findValue(kvMap, [
      'gas safe', 'registration', 'engineer id', 'niceic', 'id no'
    ]),
    contractorName: findValue(kvMap, [
      'company', 'contractor', 'business', 'employer'
    ]),
    contractorRegistration: null,
    appliances: extractAppliancesFromTables(tables),
    defects: extractDefectsFromTables(tables),
    additionalFields: kvMap,
  };
  
  return data;
}

function findValue(kvMap: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    // Exact match
    if (kvMap[key]) return kvMap[key];
    
    // Partial match
    for (const [k, v] of Object.entries(kvMap)) {
      if (k.includes(key) || key.includes(k)) {
        return v;
      }
    }
  }
  return null;
}

function parseAzureDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  // Azure often returns dates in various formats
  // Try to normalize to ISO
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through to manual parsing
  }
  
  // Try UK format DD/MM/YYYY
  const ukMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function normalizeOutcome(outcome: string | null): ExtractedCertificateData['outcome'] {
  if (!outcome) return null;
  
  const upper = outcome.toUpperCase();
  if (upper.includes('PASS') || upper.includes('SATISFACTORY')) return 'PASS';
  if (upper.includes('FAIL') || upper.includes('UNSATISFACTORY')) return 'FAIL';
  return null;
}

function extractAppliancesFromTables(tables: any[]): ApplianceRecord[] {
  // TODO: Parse appliance tables
  return [];
}

function extractDefectsFromTables(tables: any[]): DefectRecord[] {
  // TODO: Parse defect tables
  return [];
}

function calculateAzureConfidence(
  data: ExtractedCertificateData,
  keyValuePairs: any[]
): number {
  // Count found critical fields
  const criticalFields = [
    data.certificateNumber,
    data.inspectionDate,
    data.outcome,
  ];
  
  const foundCritical = criticalFields.filter(Boolean).length;
  
  // Base confidence on critical field coverage and Azure's own confidence
  const avgAzureConfidence = keyValuePairs.reduce((sum, pair) => {
    return sum + (pair.confidence || 0);
  }, 0) / (keyValuePairs.length || 1);
  
  return (foundCritical / criticalFields.length * 0.6) + (avgAzureConfidence * 0.4);
}

function generateAzureWarnings(
  data: ExtractedCertificateData,
  confidence: number
): string[] {
  const warnings: string[] = [];
  
  if (!data.certificateNumber) {
    warnings.push('Certificate number not found');
  }
  if (!data.inspectionDate) {
    warnings.push('Inspection date not found');
  }
  if (confidence < 0.7) {
    warnings.push('Low confidence extraction - manual review recommended');
  }
  
  return warnings;
}

export function isAzureDIConfigured(): boolean {
  return !!(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  );
}
```

### 7. Create Claude Vision Service

Create `server/services/extraction/claude-vision.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { 
  ExtractionResult, 
  ExtractedCertificateData,
  CertificateType,
  ApplianceRecord,
  DefectRecord
} from './types';
import { PdfAnalysis } from './pdf-analyzer';

const anthropic = new Anthropic();

const EXTRACTION_PROMPT = `You are an expert at extracting data from UK property compliance certificates.

Analyze this certificate image and extract the following information in JSON format:

{
  "certificateType": "CP12|EICR|EPC|FRA|PAT|LOLER|LEGIONELLA|ASBESTOS|SMOKE_CO|UNKNOWN",
  "certificateNumber": "string or null",
  "propertyAddress": "full address string or null",
  "uprn": "string or null",
  "inspectionDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "nextInspectionDate": "YYYY-MM-DD or null",
  "outcome": "PASS|FAIL|SATISFACTORY|UNSATISFACTORY|N/A or null",
  "engineerName": "string or null",
  "engineerRegistration": "Gas Safe ID, NICEIC number, etc. or null",
  "contractorName": "company name or null",
  "contractorRegistration": "string or null",
  "appliances": [
    {
      "type": "Boiler, Cooker, Fire, etc.",
      "make": "manufacturer or null",
      "model": "model or null",
      "serialNumber": "string or null",
      "location": "room/area or null",
      "outcome": "PASS|FAIL or null",
      "defects": ["list of defect descriptions"]
    }
  ],
  "defects": [
    {
      "code": "C1, C2, C3, etc. or null",
      "description": "defect description",
      "location": "where in property",
      "priority": "IMMEDIATE|URGENT|ADVISORY|ROUTINE or null",
      "remedialAction": "recommended action or null"
    }
  ],
  "confidence": 0.0-1.0,
  "notes": "any additional observations about document quality or unclear fields"
}

Important:
- Dates must be in YYYY-MM-DD format (convert from UK DD/MM/YYYY if needed)
- For Gas Safe certificates, the engineer registration is a 6-7 digit number
- Be conservative with confidence - if fields are unclear, use lower confidence
- Include all appliances found on the certificate
- Note any handwritten annotations or unclear sections

Return ONLY valid JSON, no other text.`;

export async function extractWithClaude(
  buffer: Buffer,
  analysis: PdfAnalysis
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    // Convert PDF to base64 image
    // Note: In production, you'd convert PDF pages to images first
    const base64 = buffer.toString('base64');
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'application/pdf',  // or 'image/png' if converted
                data: base64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });
    
    // Parse response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }
    
    // Clean and parse JSON
    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    
    const extracted = JSON.parse(jsonStr);
    
    // Map to our data structure
    const data: ExtractedCertificateData = {
      certificateType: extracted.certificateType || analysis.detectedCertificateType,
      certificateNumber: extracted.certificateNumber,
      propertyAddress: extracted.propertyAddress,
      uprn: extracted.uprn,
      inspectionDate: extracted.inspectionDate,
      expiryDate: extracted.expiryDate,
      nextInspectionDate: extracted.nextInspectionDate,
      outcome: normalizeOutcome(extracted.outcome),
      engineerName: extracted.engineerName,
      engineerRegistration: extracted.engineerRegistration,
      contractorName: extracted.contractorName,
      contractorRegistration: extracted.contractorRegistration,
      appliances: (extracted.appliances || []).map(mapAppliance),
      defects: (extracted.defects || []).map(mapDefect),
      additionalFields: {},
    };
    
    const confidence = extracted.confidence || calculateClaudeConfidence(data);
    
    // Calculate cost (approximate)
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;  // Sonnet pricing
    
    return {
      success: confidence >= 0.6,
      data,
      tier: 'claude-vision',
      confidence,
      processingTimeMs: Date.now() - startTime,
      cost,
      requiresReview: confidence < 0.8,
      warnings: generateClaudeWarnings(extracted),
      rawText: analysis.text,
      documentClassification: analysis.classification,
      pdfType: analysis.isScanned ? 'scanned' : 'native',
      pageCount: analysis.pageCount,
    };
    
  } catch (error) {
    console.error('Claude extraction failed:', error);
    
    return {
      success: false,
      data: null,
      tier: 'claude-vision',
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      cost: 0.01,  // Approximate cost even on failure
      requiresReview: true,
      warnings: [`Claude extraction failed: ${error.message}`],
      documentClassification: analysis.classification,
      pdfType: analysis.isScanned ? 'scanned' : 'native',
      pageCount: analysis.pageCount,
    };
  }
}

function normalizeOutcome(outcome: string | null): ExtractedCertificateData['outcome'] {
  if (!outcome) return null;
  
  const upper = outcome.toUpperCase();
  if (['PASS', 'SATISFACTORY'].includes(upper)) return 'PASS';
  if (['FAIL', 'UNSATISFACTORY'].includes(upper)) return 'FAIL';
  if (upper === 'N/A') return 'N/A';
  return null;
}

function mapAppliance(a: any): ApplianceRecord {
  return {
    type: a.type || 'Unknown',
    make: a.make || null,
    model: a.model || null,
    serialNumber: a.serialNumber || null,
    location: a.location || null,
    outcome: a.outcome === 'PASS' ? 'PASS' : a.outcome === 'FAIL' ? 'FAIL' : null,
    defects: a.defects || [],
  };
}

function mapDefect(d: any): DefectRecord {
  return {
    code: d.code || null,
    description: d.description || '',
    location: d.location || null,
    priority: mapPriority(d.priority),
    remedialAction: d.remedialAction || null,
  };
}

function mapPriority(p: string | null): DefectRecord['priority'] {
  if (!p) return null;
  const upper = p.toUpperCase();
  if (upper === 'IMMEDIATE') return 'IMMEDIATE';
  if (upper === 'URGENT') return 'URGENT';
  if (upper === 'ADVISORY') return 'ADVISORY';
  if (upper === 'ROUTINE') return 'ROUTINE';
  return null;
}

function calculateClaudeConfidence(data: ExtractedCertificateData): number {
  const criticalFields = [
    data.certificateNumber,
    data.inspectionDate,
    data.outcome,
    data.propertyAddress,
  ];
  
  return criticalFields.filter(Boolean).length / criticalFields.length;
}

function generateClaudeWarnings(extracted: any): string[] {
  const warnings: string[] = [];
  
  if (extracted.notes) {
    warnings.push(`AI notes: ${extracted.notes}`);
  }
  if (extracted.confidence && extracted.confidence < 0.8) {
    warnings.push('AI indicated lower confidence in extraction');
  }
  
  return warnings;
}
```

### 8. Create Main Extraction Pipeline

Create `server/services/extraction/extraction-pipeline.ts`:

```typescript
import { analyzePdf, PdfAnalysis } from './pdf-analyzer';
import { extractUsingTemplate } from './template-extractor';
import { extractWithAzureDI, isAzureDIConfigured } from './azure-di';
import { extractWithClaude } from './claude-vision';
import { 
  ExtractionResult, 
  ExtractionOptions,
  ExtractionTier 
} from './types';
import { trackExtractionCost } from './cost-tracker';
import { logger } from '../../lib/logger';

const DEFAULT_OPTIONS: ExtractionOptions = {
  forceAI: false,
  skipTiers: [],
  maxCost: 1.0,  // £1 max per extraction
  timeout: 60000, // 60 seconds
};

export async function extractCertificateData(
  buffer: Buffer,
  filename: string,
  organisationId: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  
  logger.info({ filename, organisationId }, 'Starting certificate extraction');
  
  // Step 1: Analyze PDF
  const analysis = await analyzePdf(buffer);
  
  logger.info({
    filename,
    hasTextLayer: analysis.hasTextLayer,
    isScanned: analysis.isScanned,
    detectedType: analysis.detectedCertificateType,
    classification: analysis.classification,
    pageCount: analysis.pageCount,
  }, 'PDF analysis complete');
  
  // Step 2: Try template extraction for native PDFs (FREE)
  if (
    !opts.forceAI &&
    !opts.skipTiers?.includes('template') &&
    analysis.hasTextLayer &&
    !analysis.isScanned
  ) {
    const templateResult = extractUsingTemplate(analysis);
    
    if (templateResult && templateResult.confidence >= 0.85) {
      logger.info({
        filename,
        tier: 'template',
        confidence: templateResult.confidence,
        processingTimeMs: Date.now() - startTime,
      }, 'Template extraction successful');
      
      await trackExtractionCost(organisationId, templateResult);
      return templateResult;
    }
    
    // If template got partial results with lower confidence, we'll try AI
    if (templateResult && templateResult.confidence >= 0.5) {
      logger.info({
        filename,
        tier: 'template',
        confidence: templateResult.confidence,
      }, 'Template extraction partial - will try AI fallback');
    }
  }
  
  // Step 3: Route based on document classification
  if (analysis.classification === 'complex_document' || analysis.hasHandwriting) {
    // Skip Azure DI for complex documents - go straight to Claude
    logger.info({ filename }, 'Complex document detected - using Claude directly');
    
    if (!opts.skipTiers?.includes('claude-vision')) {
      const claudeResult = await extractWithClaude(buffer, analysis);
      await trackExtractionCost(organisationId, claudeResult);
      return claudeResult;
    }
  }
  
  // Step 4: Try Azure Document Intelligence (for scanned structured certs)
  if (
    !opts.skipTiers?.includes('azure-di') &&
    isAzureDIConfigured() &&
    analysis.classification === 'structured_certificate'
  ) {
    const azureResult = await extractWithAzureDI(buffer, analysis);
    
    if (azureResult.confidence >= 0.8) {
      logger.info({
        filename,
        tier: 'azure-di',
        confidence: azureResult.confidence,
        cost: azureResult.cost,
        processingTimeMs: Date.now() - startTime,
      }, 'Azure DI extraction successful');
      
      await trackExtractionCost(organisationId, azureResult);
      return azureResult;
    }
    
    logger.info({
      filename,
      tier: 'azure-di',
      confidence: azureResult.confidence,
    }, 'Azure DI low confidence - trying Claude fallback');
  }
  
  // Step 5: Claude Vision fallback
  if (!opts.skipTiers?.includes('claude-vision')) {
    const claudeResult = await extractWithClaude(buffer, analysis);
    
    logger.info({
      filename,
      tier: 'claude-vision',
      confidence: claudeResult.confidence,
      cost: claudeResult.cost,
      processingTimeMs: Date.now() - startTime,
    }, 'Claude extraction complete');
    
    await trackExtractionCost(organisationId, claudeResult);
    
    if (claudeResult.confidence >= 0.6) {
      return claudeResult;
    }
    
    // Mark for manual review
    return {
      ...claudeResult,
      tier: 'manual-review',
      requiresReview: true,
      warnings: [
        ...claudeResult.warnings,
        'All extraction methods returned low confidence - manual review required'
      ],
    };
  }
  
  // Step 6: Manual review fallback
  logger.warn({ filename }, 'All extraction tiers skipped or failed');
  
  return {
    success: false,
    data: null,
    tier: 'manual-review',
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    cost: 0,
    requiresReview: true,
    warnings: ['No extraction method available or all methods failed'],
    documentClassification: analysis.classification,
    pdfType: analysis.isScanned ? 'scanned' : 'native',
    pageCount: analysis.pageCount,
  };
}

// Batch extraction for multiple documents
export async function extractCertificatesBatch(
  documents: Array<{ buffer: Buffer; filename: string }>,
  organisationId: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];
  
  for (const doc of documents) {
    const result = await extractCertificateData(
      doc.buffer,
      doc.filename,
      organisationId,
      options
    );
    results.push(result);
  }
  
  return results;
}
```

### 9. Create Cost Tracker

Create `server/services/extraction/cost-tracker.ts`:

```typescript
import { db } from '../../db';
import { ExtractionResult, ExtractionTier } from './types';

interface ExtractionCostRecord {
  id: string;
  organisationId: string;
  tier: ExtractionTier;
  pageCount: number;
  cost: number;
  certificateType: string;
  success: boolean;
  confidence: number;
  createdAt: Date;
}

const COST_PER_PAGE: Record<ExtractionTier, number> = {
  'pdf-native': 0,
  'template': 0,
  'azure-di': 0.0015,      // £1.50 per 1000 pages
  'claude-vision': 0.01,    // ~£0.01 per image (varies)
  'manual-review': 0,
};

export async function trackExtractionCost(
  organisationId: string,
  result: ExtractionResult
): Promise<void> {
  try {
    // Insert cost record
    await db.execute(
      `INSERT INTO extraction_costs 
       (organisation_id, tier, page_count, cost, certificate_type, success, confidence, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        organisationId,
        result.tier,
        result.pageCount,
        result.cost,
        result.data?.certificateType || 'UNKNOWN',
        result.success,
        result.confidence,
      ]
    );
  } catch (error) {
    console.error('Failed to track extraction cost:', error);
    // Don't throw - cost tracking failure shouldn't block extraction
  }
}

export async function getExtractionStats(
  organisationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalDocuments: number;
  totalCost: number;
  byTier: Record<ExtractionTier, { count: number; cost: number; avgConfidence: number }>;
  byCertificateType: Record<string, { count: number; cost: number }>;
  costSavings: number;  // Estimated savings from template extraction
}> {
  const results = await db.execute(
    `SELECT 
       tier,
       certificate_type,
       COUNT(*) as count,
       SUM(cost) as total_cost,
       AVG(confidence) as avg_confidence,
       SUM(page_count) as total_pages
     FROM extraction_costs
     WHERE organisation_id = $1
       AND created_at >= $2
       AND created_at <= $3
     GROUP BY tier, certificate_type`,
    [organisationId, startDate, endDate]
  );
  
  // Calculate stats
  const byTier: Record<string, { count: number; cost: number; avgConfidence: number }> = {};
  const byCertificateType: Record<string, { count: number; cost: number }> = {};
  let totalDocuments = 0;
  let totalCost = 0;
  let templatePages = 0;
  
  for (const row of results.rows) {
    // By tier
    if (!byTier[row.tier]) {
      byTier[row.tier] = { count: 0, cost: 0, avgConfidence: 0 };
    }
    byTier[row.tier].count += parseInt(row.count);
    byTier[row.tier].cost += parseFloat(row.total_cost);
    byTier[row.tier].avgConfidence = parseFloat(row.avg_confidence);
    
    // By certificate type
    if (!byCertificateType[row.certificate_type]) {
      byCertificateType[row.certificate_type] = { count: 0, cost: 0 };
    }
    byCertificateType[row.certificate_type].count += parseInt(row.count);
    byCertificateType[row.certificate_type].cost += parseFloat(row.total_cost);
    
    // Totals
    totalDocuments += parseInt(row.count);
    totalCost += parseFloat(row.total_cost);
    
    // Track template pages for savings calculation
    if (row.tier === 'template' || row.tier === 'pdf-native') {
      templatePages += parseInt(row.total_pages);
    }
  }
  
  // Calculate savings (what it would have cost with Azure DI)
  const costSavings = templatePages * COST_PER_PAGE['azure-di'];
  
  return {
    totalDocuments,
    totalCost,
    byTier: byTier as any,
    byCertificateType,
    costSavings,
  };
}

export async function getMonthlyCostSummary(
  organisationId: string
): Promise<Array<{
  month: string;
  totalCost: number;
  documentCount: number;
  costSavings: number;
}>> {
  const results = await db.execute(
    `SELECT 
       DATE_TRUNC('month', created_at) as month,
       SUM(cost) as total_cost,
       COUNT(*) as document_count,
       SUM(CASE WHEN tier IN ('template', 'pdf-native') THEN page_count * 0.0015 ELSE 0 END) as cost_savings
     FROM extraction_costs
     WHERE organisation_id = $1
       AND created_at >= NOW() - INTERVAL '12 months'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month DESC`,
    [organisationId]
  );
  
  return results.rows.map(row => ({
    month: row.month.toISOString().slice(0, 7),
    totalCost: parseFloat(row.total_cost),
    documentCount: parseInt(row.document_count),
    costSavings: parseFloat(row.cost_savings),
  }));
}
```

### 10. Create Database Migration

Create `server/db/migrations/add-extraction-costs.sql`:

```sql
-- Extraction cost tracking table
CREATE TABLE IF NOT EXISTS extraction_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  tier VARCHAR(50) NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  certificate_type VARCHAR(50),
  success BOOLEAN NOT NULL DEFAULT false,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for analytics queries
  CONSTRAINT valid_tier CHECK (tier IN ('pdf-native', 'template', 'azure-di', 'claude-vision', 'manual-review'))
);

CREATE INDEX idx_extraction_costs_org_date ON extraction_costs(organisation_id, created_at);
CREATE INDEX idx_extraction_costs_tier ON extraction_costs(tier);
```

### 11. Create API Endpoint

Create `server/routes/admin/extraction-stats.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { getExtractionStats, getMonthlyCostSummary } from '../../services/extraction/cost-tracker';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// GET /api/admin/extraction/stats
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  const { startDate, endDate } = statsQuerySchema.parse(req.query);
  
  const stats = await getExtractionStats(
    req.user.organisationId,
    startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate ? new Date(endDate) : new Date()
  );
  
  res.json(stats);
});

// GET /api/admin/extraction/monthly
router.get('/monthly', authenticate, requireAdmin, async (req, res) => {
  const summary = await getMonthlyCostSummary(req.user.organisationId);
  res.json(summary);
});

export default router;
```

### 12. Environment Variables

Add to `.env.example`:

```bash
# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-key

# Extraction Pipeline Settings
EXTRACTION_TEMPLATE_CONFIDENCE_THRESHOLD=0.85
EXTRACTION_AZURE_CONFIDENCE_THRESHOLD=0.8
EXTRACTION_CLAUDE_CONFIDENCE_THRESHOLD=0.6
EXTRACTION_MAX_COST_PER_DOCUMENT=1.0
EXTRACTION_TIMEOUT_MS=60000
```

## File Structure

```
server/services/extraction/
├── types.ts                    # Type definitions
├── pdf-analyzer.ts             # PDF analysis and classification
├── templates/
│   └── index.ts               # Certificate templates (CP12, EICR, EPC)
├── template-extractor.ts       # Template-based extraction
├── azure-di.ts                 # Azure Document Intelligence
├── claude-vision.ts            # Claude Vision extraction
├── extraction-pipeline.ts      # Main orchestration
├── cost-tracker.ts             # Cost tracking and analytics
└── index.ts                    # Barrel export

server/db/migrations/
└── add-extraction-costs.sql    # Cost tracking table

server/routes/admin/
└── extraction-stats.ts         # Stats API endpoint
```

## Testing

### Test Scenarios

1. **Native PDF (clean CP12)**
   - Expected: Template extraction succeeds
   - Tier: `template`
   - Cost: £0

2. **Native PDF (unknown format)**
   - Expected: Template fails, Azure DI or Claude used
   - Tier: `azure-di` or `claude-vision`

3. **Scanned PDF (clear scan)**
   - Expected: Azure DI succeeds
   - Tier: `azure-di`
   - Cost: ~£0.0015

4. **Scanned PDF (poor quality)**
   - Expected: Azure DI fails, Claude fallback
   - Tier: `claude-vision`

5. **Complex FRA document**
   - Expected: Routed directly to Claude
   - Tier: `claude-vision`

6. **Handwritten annotations**
   - Expected: Claude handles
   - Tier: `claude-vision`

### Test Commands

```bash
# Run extraction on test certificates
npx tsx server/scripts/test-extraction.ts

# Check cost statistics
curl http://localhost:3000/api/admin/extraction/stats
```

## Cost Projections

| Document Mix | Monthly Volume | Old Cost (All Azure) | New Cost (Hybrid) | Savings |
|--------------|----------------|----------------------|-------------------|---------|
| 70% native, 30% scanned | 1,000 | £1.50 | £0.45 | 70% |
| 50% native, 50% scanned | 1,000 | £1.50 | £0.75 | 50% |
| 30% native, 70% scanned | 1,000 | £1.50 | £1.05 | 30% |

## Success Metrics

- Template extraction handles 60-80% of documents (cost: £0)
- Azure DI handles 15-30% of documents (cost: £0.0015/page)
- Claude Vision handles 5-10% of documents (cost: ~£0.01/image)
- Overall average cost: <£0.005 per document
- Manual review rate: <5% of documents
