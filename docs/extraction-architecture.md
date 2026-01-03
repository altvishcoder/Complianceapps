# Extraction Service Architecture

## Overview

The ComplianceAI extraction service uses a 6-tier architecture (Tier 0 through Tier 4, with half-steps) to process compliance certificates. Each tier represents increasing complexity and cost, with automatic escalation based on confidence thresholds.

## Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTRACTION PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Tier 0    │ → │  Tier 0.5   │ → │   Tier 1    │ → │  Tier 1.5   │     │
│  │   Format    │   │  QR/Meta    │   │  Template   │   │ Claude Text │     │
│  │  Detection  │   │  Extraction │   │  Matching   │   │ Enhancement │     │
│  │   (FREE)    │   │   (FREE)    │   │   (FREE)    │   │  (~$0.003)  │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│         │                 │                 │                 │             │
│         └─────────────────┴─────────────────┴─────────────────┘             │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                        │
│                    │                               │                        │
│             ┌──────┴──────┐               ┌───────┴───────┐                 │
│             │   Tier 2    │               │    Tier 3     │                 │
│             │ Azure DI    │               │ Claude Vision │                 │
│             │ (~$0.0015)  │               │  (~$0.01)     │                 │
│             └─────────────┘               └───────────────┘                 │
│                    │                               │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                             ┌──────┴──────┐                                 │
│                             │   Tier 4    │                                 │
│                             │   Human     │                                 │
│                             │   Review    │                                 │
│                             └─────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tier Descriptions

### Tier 0: Format Detection (FREE)
**File**: `server/services/extraction/format-detector.ts`
**Function**: `analyseDocument(buffer, mimeType, filename)`

- Detects document format (PDF native, PDF scanned, image, etc.)
- Extracts text layer from PDFs if available
- Classifies document complexity
- Calculates text quality score
- Always runs first for every document

**Output**: `FormatAnalysis` with format, classification, text content, page count

### Tier 0.5: QR & Metadata Extraction (FREE)
**File**: `server/services/extraction/qr-metadata.ts`
**Functions**: `extractQRCodes()`, `extractImageMetadata()`

- Extracts QR codes from images/PDFs
- Reads EXIF metadata from images
- Useful for Gas Safe certificates with QR verification
- Only runs for scanned documents or images

**Output**: QR verification data, photo date, GPS coordinates

### Tier 1: Template Matching (FREE)
**File**: `server/services/extraction/template-patterns.ts`
**Function**: `extractWithTemplate(text, documentType, customPatterns)`

- Uses predefined regex patterns per certificate type
- Supports 25+ certificate types with specific patterns
- Configurable via Factory Settings (CUSTOM_EXTRACTION_PATTERNS)
- Confidence threshold: 0.85 (configurable)

**Supported Certificate Types**:
- Gas Safety (CP12, LGSR)
- EICR, Electrical Installation
- Fire Risk Assessment (FRA, BSC, FRAEW)
- Asbestos (R&D, Management Survey)
- Legionella Risk Assessment
- Water Testing, PAT Testing, Emergency Lighting
- Lift Safety (LOLER), Pressure Systems (PUWER)
- Oil/LPG/Solid Fuel (OFTEC, HETAS)
- And more...

### Tier 1.5: Claude Text Enhancement (~$0.003/doc)
**File**: `server/services/extraction/claude-text.ts`
**Function**: `extractWithClaudeText(text, documentType)`

- Uses Claude 3.5 Haiku for text-based extraction
- Enhances Tier 1 results when confidence is low
- Lower cost than Vision tier
- Requires AI_EXTRACTION_ENABLED=true

### Tier 2: Azure Document Intelligence (~$0.0015/page)
**File**: `server/services/extraction/azure-di.ts`
**Function**: `extractWithAzureDocumentIntelligence(buffer, mimeType)`

- Uses Azure's prebuilt-layout model
- Better for structured forms and tables
- Cost-effective for multi-page PDFs
- Requires AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and KEY

### Tier 3: Claude Vision (~$0.01/doc)
**File**: `server/services/extraction/claude-vision.ts`
**Functions**: `extractWithClaudeVision()`, `extractWithClaudeVisionFromPDF()`

- Uses Claude claude-sonnet-4-20250514 with vision capabilities
- Best for scanned documents and complex layouts
- Highest accuracy but highest cost
- Requires ANTHROPIC_API_KEY

### Tier 4: Human Review (FREE but manual)
**File**: Queue stored in `humanReviewQueue` table

- Flagged when no automated tier achieves sufficient confidence
- Uses human feedback to improve models (Data Flywheel)
- Corrections stored in `humanReviews` and `extractionCorrections` tables

## Call Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    extractCertificate()                          │
│                 (server/services/extraction/orchestrator.ts)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ 1. Load settings    │
                    │    from Factory DB  │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ 2. analyseDocument  │◄──── Tier 0
                    │    (format-detector)│
                    └─────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │ isScanned?    │               │
              ▼               │               │
    ┌─────────────────┐       │               │
    │ extractQRAndMeta│       │               │
    │   (qr-metadata) │◄──────┼───── Tier 0.5 │
    └─────────────────┘       │               │
              │               │               │
              ▼               │               │
    ┌─────────────────────────┼───────────────┘
    │ Has QR verification?    │
    │         YES             │ NO
    ▼                         ▼
  RETURN                ┌─────────────────────┐
  EARLY                 │ 3. extractWithTemplate│◄── Tier 1
                        │    (template-patterns)│
                        └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ confidence >= 0.85?│
                    └─────────┬─────────┘
              YES             │          NO
              ▼               │          ▼
           RETURN         ┌───┴───────────────────┐
           SUCCESS        │ AI Enabled?           │
                          └─────────┬─────────────┘
                        NO          │         YES
                        ▼           │          ▼
                  ┌──────────┐      │    ┌─────────────────────┐
                  │ Tier 4   │      │    │ 4. extractWithClaudeText│◄ Tier 1.5
                  │ (Review) │      │    │    (claude-text)    │
                  └──────────┘      │    └─────────────────────┘
                                    │          │
                                    │    ┌─────┴─────────┐
                                    │    │ confidence >=  │
                                    │    │     0.80?      │
                                    │    └─────┬─────────┘
                                YES │          │ NO
                                    ▼          ▼
                               RETURN    ┌─────────────────────┐
                               SUCCESS   │ PDF with tables?    │
                                         └─────────┬───────────┘
                                         YES       │        NO
                                         ▼         │         ▼
                                ┌─────────────────┐│  ┌─────────────────┐
                                │ 5. extractWith  ││  │ 6. extractWith  │
                                │ AzureDocumentInt││  │ ClaudeVision    │
                                │ (azure-di)      ││  │ (claude-vision) │
                                │   ◄── Tier 2    ││  │   ◄── Tier 3    │
                                └─────────────────┘│  └─────────────────┘
                                         │         │         │
                                         └─────────┴─────────┘
                                                   │
                                         ┌─────────┴─────────┐
                                         │ confidence >= 0.70?│
                                         └─────────┬─────────┘
                                         YES       │       NO
                                         ▼         │        ▼
                                     RETURN        │   ┌──────────┐
                                     SUCCESS       │   │ Tier 4   │
                                                   │   │ (Review) │
                                                   │   └──────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `server/services/extraction/orchestrator.ts` | Main entry point, tier coordination |
| `server/services/extraction/format-detector.ts` | Document format analysis (Tier 0) |
| `server/services/extraction/qr-metadata.ts` | QR/EXIF extraction (Tier 0.5) |
| `server/services/extraction/template-patterns.ts` | Regex pattern matching (Tier 1) |
| `server/services/extraction/claude-text.ts` | Claude text enhancement (Tier 1.5) |
| `server/services/extraction/azure-di.ts` | Azure Document Intelligence (Tier 2) |
| `server/services/extraction/claude-vision.ts` | Claude Vision extraction (Tier 3) |
| `server/services/confidence-scoring.ts` | Confidence calculation logic |

## Configuration (Factory Settings)

| Setting | Default | Description |
|---------|---------|-------------|
| `AI_EXTRACTION_ENABLED` | false | Enable AI-powered tiers |
| `TIER1_CONFIDENCE_THRESHOLD` | 0.85 | Min confidence for Tier 1 success |
| `TIER2_CONFIDENCE_THRESHOLD` | 0.80 | Min confidence for Tier 2 success |
| `TIER3_CONFIDENCE_THRESHOLD` | 0.70 | Min confidence for Tier 3 success |
| `MAX_COST_PER_DOCUMENT` | 0.05 | Maximum spend per document |
| `DOCUMENT_TYPE_THRESHOLDS` | JSON | Per-type confidence overrides |
| `CUSTOM_EXTRACTION_PATTERNS` | JSON | Custom regex patterns by type |

## Database Tables

| Table | Purpose |
|-------|---------|
| `extraction_runs` | Stores extraction results with progressive refinement |
| `extraction_tier_audits` | Tracks each tier attempt for analytics |
| `extractions` | Legacy table for simple extraction data |
| `human_reviews` | Stores human-approved corrections |
| `extraction_corrections` | Field-level correction tracking |
| `field_confidence_scores` | Per-field confidence tracking |
| `auto_approval_thresholds` | Gradual automation configuration |

## Metrics & Observability

The extraction pipeline emits metrics to:
- `extraction_tier_audits` - Per-tier processing stats
- `observability-dashboard` - Real-time service health
- Structured logs via Pino

Key metrics:
- Processing time per tier
- Cost per document
- Confidence distribution
- Escalation rates
- Human review queue depth
