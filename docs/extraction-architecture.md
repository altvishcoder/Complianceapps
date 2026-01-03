# Extraction Service Architecture

## Overview

The ComplianceAI extraction service uses a 6-tier architecture (Tier 0 through Tier 4, with half-steps) to process compliance certificates. Each tier represents increasing complexity and cost, with automatic escalation based on confidence thresholds.

## Pre-Tier Processing Pipeline

Before the tiered extraction begins, documents pass through preprocessing stages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PRE-EXTRACTION PIPELINE (FREE)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   │
│  │ Pattern Detector│ → │ Format Detector │ → │ Certificate Type        │   │
│  │ (filename/text) │   │ (PDF analysis)  │   │ Classification          │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘   │
│         │                       │                       │                   │
│         └───────────────────────┴───────────────────────┘                   │
│                                 │                                           │
│                     ┌───────────┴───────────┐                               │
│                     │                       │                               │
│              ┌──────┴──────┐       ┌────────┴────────┐                      │
│              │ Scanned?    │       │ Native PDF?     │                      │
│              │ → QR/EXIF   │       │ → Text Extract  │                      │
│              └─────────────┘       └─────────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pre-Tier Components

| Component | File | Purpose |
|-----------|------|---------|
| Pattern Detector | `pattern-detector.ts` | Matches filename/text against 84 detection patterns to identify certificate type |
| Format Detector | `format-detector.ts` | Analyzes PDF structure (native vs scanned), extracts text layer, calculates quality |
| QR/Metadata Extractor | `qr-metadata.ts` | Extracts QR codes and EXIF metadata from scanned documents |

## Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTRACTION PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Tier 0    │ → │  Tier 0.5   │ → │   Tier 1    │ → │  Tier 1.5   │     │
│  │   Format    │   │  QR/Meta    │   │  Template   │   │ Claude Haiku│     │
│  │  Detection  │   │  Extraction │   │  Matching   │   │   (Text)    │     │
│  │   (FREE)    │   │   (FREE)    │   │   (FREE)    │   │ (~$0.002)   │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│         │                 │                 │                 │             │
│         └─────────────────┴─────────────────┴─────────────────┘             │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                        │
│                    │                               │                        │
│             ┌──────┴──────┐               ┌───────┴───────┐                 │
│             │   Tier 2    │               │    Tier 3     │                 │
│             │ Azure DI    │               │ Claude Sonnet │                 │
│             │ (~$0.001)   │               │  (~$0.015)    │                 │
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

### Tier 1.5: Claude Haiku Text Enhancement (~$0.002/doc)
**File**: `server/services/extraction/claude-text.ts`
**Function**: `extractWithClaudeText(text, documentType)`

- Uses Claude 3.5 Haiku for text-based extraction
- Enhances Tier 1 results when confidence is low
- Lower cost than Vision tier
- Requires AI_EXTRACTION_ENABLED=true

**Cost Breakdown** (Claude 3.5 Haiku, Jan 2026):
- Input: $0.25/million tokens (~1K tokens/doc = $0.00025)
- Output: $1.25/million tokens (~1.5K tokens/doc = $0.002)
- **Total: ~$0.002/document**

### Tier 2: Azure Document Intelligence (~$0.001/page)
**File**: `server/services/extraction/azure-di.ts`
**Function**: `extractWithAzureDocumentIntelligence(buffer, mimeType)`

- Uses Azure's prebuilt-layout model
- Better for structured forms and tables
- Cost-effective for multi-page PDFs
- Requires AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and KEY

**Cost Breakdown** (Azure DI Layout, Jan 2026):
- Per page: $0.001 (prebuilt-layout model)
- Average 3-page certificate: ~$0.003
- **Total: ~$0.001/page**

### Tier 3: Claude Sonnet Vision (~$0.015/doc)
**File**: `server/services/extraction/claude-vision.ts`
**Functions**: `extractWithClaudeVision()`, `extractWithClaudeVisionFromPDF()`

- Uses Claude claude-sonnet-4-20250514 with vision capabilities
- Best for scanned documents and complex layouts
- Highest accuracy but highest cost
- Requires ANTHROPIC_API_KEY

**Cost Breakdown** (Claude Sonnet, Jan 2026):
- Input: $3.00/million tokens + ~$0.01/image
- Output: $15.00/million tokens (~0.5K tokens = $0.008)
- **Total: ~$0.015/document**

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
| `server/services/extraction/pattern-detector.ts` | Certificate type detection from filename/text patterns (Pre-tier) |
| `server/services/extraction/format-detector.ts` | Document format analysis (Tier 0) |
| `server/services/extraction/qr-metadata.ts` | QR/EXIF extraction (Tier 0.5) |
| `server/services/extraction/template-patterns.ts` | Regex pattern matching (Tier 1) |
| `server/services/extraction/claude-text.ts` | Claude Haiku text enhancement (Tier 1.5) |
| `server/services/extraction/azure-di.ts` | Azure Document Intelligence (Tier 2) |
| `server/services/extraction/claude-vision.ts` | Claude Sonnet Vision extraction (Tier 3) |
| `server/services/extraction/outcome-evaluator.ts` | Compliance outcome evaluation (Post-extraction) |
| `server/services/extraction/classification-linker.ts` | Classification code linking & remedial action generation (Post-extraction) |
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

## Post-Extraction Pipeline

After extraction completes, the following post-processing occurs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     POST-EXTRACTION PIPELINE (FREE)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────┐   │
│  │  Outcome Evaluator  │ → │ Classification      │ → │ Remedial Action │   │
│  │  (27 rules + UK law)│   │ Linker (70 codes)   │   │ Generation      │   │
│  └─────────────────────┘   └─────────────────────┘   └─────────────────┘   │
│         │                           │                         │             │
│         └───────────────────────────┴─────────────────────────┘             │
│                                     │                                       │
│                        ┌────────────┴────────────┐                          │
│                        │  Data Flywheel          │                          │
│                        │  (ML Training Feedback) │                          │
│                        └─────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Outcome Evaluator
**File**: `server/services/extraction/outcome-evaluator.ts`

Evaluates extracted data against 27 outcome rules to determine compliance status:
- **SATISFACTORY**: Certificate passes all checks
- **SATISFACTORY_WITH_OBSERVATIONS**: Minor issues noted
- **UNSATISFACTORY**: Non-compliant, requires remedial action
- **UNDETERMINED**: Insufficient data for determination

Rules reference UK legislation including:
- Gas Safety (Installation and Use) Regulations 1998
- BS 7671 (Electrical Wiring Regulations)
- Regulatory Reform (Fire Safety) Order 2005
- Control of Asbestos Regulations 2012
- LOLER 1998, Building Safety Act 2022

### Classification Linker
**File**: `server/services/extraction/classification-linker.ts`

Links extraction results to 70 classification codes:
- Matches defects/outcomes to classification codes
- Auto-creates remedial actions when `autoCreateAction=true`
- Applies severity and cost estimates from configuration
- Calculates due dates based on timeframe rules

## Cost Summary

| Tier | Service | Cost per Unit | Typical Doc Cost |
|------|---------|---------------|------------------|
| 0 | Format Detection | FREE | $0.00 |
| 0.5 | QR/EXIF | FREE | $0.00 |
| 1 | Template Matching | FREE | $0.00 |
| 1.5 | Claude Haiku (text) | $0.25/$1.25 per MTok | ~$0.002 |
| 2 | Azure DI Layout | $0.001/page | ~$0.003 |
| 3 | Claude Sonnet (vision) | $3/$15 per MTok + image | ~$0.015 |
| 4 | Human Review | FREE (labor cost) | N/A |

**Average cost per certificate**: $0.005-$0.010 (depending on tier escalation)
