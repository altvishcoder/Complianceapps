# ComplianceAI: Multi-Format Extraction Architecture

## Intelligent Document Processing for All File Types

**Version:** 1.0  
**Date:** December 2024  
**Author:** LASHAN Digital

---

## Executive Summary

ComplianceAI's extraction pipeline is designed to handle **any document format** contractors submit - not just PDFs. The tiered architecture intelligently routes each format to the most cost-effective extraction method, minimising AI costs while maximising accuracy.

**Key Principle:** Use the cheapest method that achieves ≥85% confidence, escalating only when necessary.

**Supported Formats:**
- PDF (native and scanned)
- Microsoft Word (DOCX, DOC)
- Microsoft Excel (XLSX, XLS)
- Images (JPEG, PNG, TIFF, HEIC, WebP)
- CSV/TSV
- HTML
- Plain Text
- Email (EML, MSG)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIER 0: FORMAT DETECTION                            │
│                              (instant, free)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  File Upload                                                                │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              MIME Type / Extension Detection                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ├──────────────┬──────────────┬──────────────┬──────────────┐        │
│       ▼              ▼              ▼              ▼              ▼        │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐       │
│  │  PDF   │    │  DOCX  │    │  XLSX  │    │ IMAGE  │    │ EMAIL  │       │
│  └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘       │
│      │             │             │             │             │             │
│      ▼             │             │             │             │             │
│  Native or         │             │             │             │             │
│  Scanned?          │             │             │             │             │
│      │             │             │             │             │             │
│  ┌───┴───┐         │             │             │             │             │
│  ▼       ▼         ▼             ▼             ▼             ▼             │
│ Native Scanned   TIER 1       TIER 1       TIER 2       TIER 1           │
│   │       │     (free)       (free)      (£0.0015)     (free)            │
│   ▼       ▼                                                               │
│ TIER 1  TIER 2                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tier Definitions

### TIER 0: Format Detection & Analysis
**Cost:** Free  
**Time:** <100ms

Determines file type and routes to appropriate extraction path:

| Format Type | Action | Next Tier |
|-------------|--------|-----------|
| PDF | Analyse if native or scanned | TIER 1 (native) or TIER 2 (scanned) |
| DOCX/DOC | Extract XML text | TIER 1 |
| XLSX/XLS/CSV | Extract cells + headers | TIER 1 |
| HTML | Parse DOM, extract text | TIER 1 |
| TXT | Read directly | TIER 1 |
| EML/MSG | Parse email, extract body + attachments | TIER 1 (body) + recurse (attachments) |
| Images | Skip text extraction | TIER 2 |

---

### TIER 1: Template Extraction
**Cost:** Free  
**Time:** <500ms  
**Confidence Target:** ≥85%

Pattern matching and regex-based extraction against known certificate templates.

**Works best for:**
- Native PDFs with consistent layouts
- DOCX certificates from software systems
- XLSX compliance registers
- Structured HTML exports

**Process:**
1. Normalise extracted text
2. Identify certificate type (GAS, EICR, FRA, etc.)
3. Apply type-specific extraction templates
4. Validate extracted fields
5. Calculate confidence score

**Exit Criteria:**
- Confidence ≥ 0.85 → **DONE** ✅
- Confidence < 0.85 → Continue to TIER 1.5 or TIER 2

---

### TIER 1.5: Claude Text Enhancement (Optional)
**Cost:** ~£0.003/document  
**Time:** 2-5 seconds  
**Confidence Target:** ≥80%

For text-based formats where templates fail but text is available. Uses Claude's text API (cheaper than vision) to interpret unstructured text.

**When to use:**
- TIER 1 confidence between 0.5 and 0.85
- Text is available but layout is unusual
- Unknown certificate template

**Process:**
1. Send extracted text to Claude API
2. Include partial TIER 1 extraction as hints
3. Request structured JSON response
4. Validate and merge with template results

---

### TIER 2: Azure Document Intelligence
**Cost:** ~£0.0015/page  
**Time:** 3-10 seconds  
**Confidence Target:** ≥80%

OCR and structured extraction for scanned documents and images.

**Works best for:**
- Scanned PDFs
- Photographed certificates
- Faxed documents
- Image-based files (JPEG, PNG, TIFF)

**Process:**
1. Submit to Azure DI (prebuilt-document or custom model)
2. Receive structured extraction with confidence scores
3. Map extracted fields to compliance schema
4. Validate against business rules

**Exit Criteria:**
- Confidence ≥ 0.80 → **DONE** ✅
- Confidence < 0.80 → Continue to TIER 3

---

### TIER 3: Claude Vision
**Cost:** ~£0.01/page  
**Time:** 5-15 seconds  
**Confidence Target:** ≥70%

AI vision for complex documents, handwriting, and fallback scenarios.

**When to use:**
- Complex multi-column layouts
- Handwritten entries
- Poor quality scans
- Azure DI failures
- Mixed content (text + diagrams + tables)

**Process:**
1. Convert document to images (if PDF)
2. Send to Claude Vision API with extraction prompt
3. Request structured JSON with reasoning
4. Cross-validate with any partial extractions

**Exit Criteria:**
- Confidence ≥ 0.70 → **DONE** ✅
- Confidence < 0.70 → Continue to TIER 4

---

### TIER 4: Manual Review
**Cost:** Human time (~£5-10/document)  
**Time:** Minutes to hours

Human-in-the-loop for documents that automated systems cannot process.

**Process:**
1. Flag document for compliance officer review
2. Pre-populate form with best extraction attempt
3. Highlight low-confidence fields
4. Human validates/corrects
5. **Learning:** Feed corrections back to improve templates

---

## Format-Specific Processing

### PDF Processing

```
┌─────────────────────────────────────────────────────────┐
│                    PDF ANALYSIS                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Attempt text extraction (pdfjs-dist / pdf-parse)   │
│                                                         │
│  2. Analyse text quality:                              │
│     • Character count vs page count                    │
│     • Text-to-whitespace ratio                         │
│     • Presence of readable words                       │
│                                                         │
│  3. Classification:                                    │
│     • >100 chars/page + coherent text → NATIVE         │
│     • <100 chars/page or gibberish → SCANNED          │
│     • Mixed → HYBRID (process both paths)             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
interface PDFAnalysis {
  isNative: boolean;
  isScanned: boolean;
  isHybrid: boolean;
  textContent: string | null;
  pageCount: number;
  textQuality: number; // 0-1
}

async function analysePDF(file: File): Promise<PDFAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let totalText = '';
  const pageCount = pdf.numPages;
  
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    totalText += pageText + '\n';
  }
  
  const charsPerPage = totalText.length / pageCount;
  const wordCount = totalText.split(/\s+/).filter(w => w.length > 2).length;
  const textQuality = Math.min(1, (charsPerPage / 500) * (wordCount / (pageCount * 50)));
  
  return {
    isNative: charsPerPage > 100 && textQuality > 0.3,
    isScanned: charsPerPage < 50 || textQuality < 0.1,
    isHybrid: charsPerPage >= 50 && charsPerPage <= 100,
    textContent: totalText.trim() || null,
    pageCount,
    textQuality,
  };
}
```

---

### DOCX Processing

DOCX files are ZIP archives containing XML. Text extraction is reliable and free.

```
┌─────────────────────────────────────────────────────────┐
│                   DOCX EXTRACTION                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DOCX Structure:                                       │
│  ├── [Content_Types].xml                               │
│  ├── _rels/                                            │
│  ├── docProps/                                         │
│  │   ├── core.xml        ← Metadata (author, dates)   │
│  │   └── app.xml                                       │
│  └── word/                                             │
│      ├── document.xml    ← Main content               │
│      ├── styles.xml                                    │
│      ├── header1.xml     ← Headers (contractor info?) │
│      ├── footer1.xml     ← Footers (page numbers)     │
│      └── media/          ← Embedded images            │
│                                                         │
│  Extraction targets:                                   │
│  • Paragraphs (w:p → w:r → w:t)                       │
│  • Tables (w:tbl → w:tr → w:tc)                       │
│  • Document properties (creator = contractor?)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

interface DOCXExtraction {
  text: string;
  paragraphs: string[];
  tables: TableData[];
  metadata: {
    title?: string;
    creator?: string;
    created?: Date;
    modified?: Date;
  };
}

async function extractDOCX(file: File): Promise<DOCXExtraction> {
  const zip = await JSZip.loadAsync(file);
  const parser = new XMLParser({ ignoreAttributes: false });
  
  // Extract main document
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const doc = parser.parse(documentXml || '');
  
  // Extract paragraphs
  const paragraphs: string[] = [];
  const body = doc['w:document']?.['w:body'];
  
  if (body?.['w:p']) {
    const paras = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']];
    for (const para of paras) {
      const text = extractParagraphText(para);
      if (text) paragraphs.push(text);
    }
  }
  
  // Extract tables
  const tables: TableData[] = [];
  if (body?.['w:tbl']) {
    const tbls = Array.isArray(body['w:tbl']) ? body['w:tbl'] : [body['w:tbl']];
    for (const tbl of tbls) {
      tables.push(extractTableData(tbl));
    }
  }
  
  // Extract metadata
  const coreXml = await zip.file('docProps/core.xml')?.async('string');
  const core = parser.parse(coreXml || '');
  
  return {
    text: paragraphs.join('\n'),
    paragraphs,
    tables,
    metadata: {
      title: core['cp:coreProperties']?.['dc:title'],
      creator: core['cp:coreProperties']?.['dc:creator'],
      created: parseDate(core['cp:coreProperties']?.['dcterms:created']),
      modified: parseDate(core['cp:coreProperties']?.['dcterms:modified']),
    },
  };
}

function extractParagraphText(para: any): string {
  let text = '';
  const runs = para['w:r'];
  if (!runs) return '';
  
  const runArray = Array.isArray(runs) ? runs : [runs];
  for (const run of runArray) {
    const t = run['w:t'];
    if (typeof t === 'string') {
      text += t;
    } else if (t?.['#text']) {
      text += t['#text'];
    }
  }
  return text.trim();
}
```

---

### XLSX Processing

Excel files provide inherent structure - columns map directly to fields.

```
┌─────────────────────────────────────────────────────────┐
│                   XLSX EXTRACTION                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Common compliance spreadsheet patterns:               │
│                                                         │
│  ┌─────────┬────────────┬────────┬─────────┬────────┐ │
│  │ Address │ Insp Date  │ Expiry │ Result  │ Eng ID │ │
│  ├─────────┼────────────┼────────┼─────────┼────────┤ │
│  │ 1 High St│ 01/03/2024│01/03/25│ PASS    │ 123456 │ │
│  │ 2 Low Rd │ 15/03/2024│15/03/25│ NCS     │ 123456 │ │
│  └─────────┴────────────┴────────┴─────────┴────────┘ │
│                                                         │
│  Extraction approach:                                  │
│  1. Identify header row (usually row 1)               │
│  2. Map headers to schema fields                       │
│  3. Extract data rows                                  │
│  4. Parse dates, numbers, enums                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
import * as XLSX from 'xlsx';

interface XLSXExtraction {
  sheets: SheetData[];
  asText: string;
  detectedType: string | null;
  records: ComplianceRecord[];
}

interface SheetData {
  name: string;
  headers: string[];
  rows: any[][];
  rowCount: number;
}

async function extractXLSX(file: File): Promise<XLSXExtraction> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  
  const sheets: SheetData[] = [];
  let allText = '';
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (json.length === 0) continue;
    
    const headers = (json[0] || []).map(h => String(h || '').trim());
    const rows = json.slice(1).filter(row => row.some(cell => cell != null));
    
    sheets.push({
      name: sheetName,
      headers,
      rows,
      rowCount: rows.length,
    });
    
    allText += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
  }
  
  // Detect certificate type from headers
  const detectedType = detectCertificateType(sheets[0]?.headers || []);
  
  // Map to compliance records
  const records = mapToComplianceRecords(sheets[0], detectedType);
  
  return {
    sheets,
    asText: allText.trim(),
    detectedType,
    records,
  };
}

// Header-to-field mapping for common certificate types
const HEADER_MAPPINGS: Record<string, Record<string, string[]>> = {
  GAS: {
    propertyAddress: ['address', 'property', 'site', 'property address', 'site address'],
    inspectionDate: ['date', 'inspection date', 'service date', 'visit date', 'cp12 date'],
    expiryDate: ['expiry', 'expiry date', 'due date', 'next due', 'renewal date'],
    engineerName: ['engineer', 'technician', 'operative', 'gas engineer'],
    gasSafeId: ['gas safe', 'gas safe id', 'registration', 'licence', 'license'],
    outcome: ['result', 'outcome', 'status', 'pass/fail', 'overall'],
  },
  EICR: {
    propertyAddress: ['address', 'property', 'site address'],
    inspectionDate: ['date', 'inspection date', 'test date'],
    nextInspectionDate: ['next inspection', 'due date', 'retest due', 'next test'],
    overallResult: ['result', 'overall', 'satisfactory', 'outcome'],
    contractorName: ['contractor', 'company', 'electrician', 'tested by'],
    observations: ['observations', 'codes', 'defects', 'findings'],
  },
  FRA: {
    propertyAddress: ['address', 'property', 'building', 'premises'],
    assessmentDate: ['date', 'assessment date', 'fra date'],
    reviewDate: ['review', 'review date', 'next review', 'due date'],
    riskRating: ['risk', 'risk rating', 'risk level', 'overall risk'],
    assessor: ['assessor', 'assessed by', 'fire assessor'],
  },
  // ... more mappings
};

function detectCertificateType(headers: string[]): string | null {
  const normalised = headers.map(h => h.toLowerCase());
  
  // Score each type by matching headers
  let bestMatch = { type: null as string | null, score: 0 };
  
  for (const [type, mappings] of Object.entries(HEADER_MAPPINGS)) {
    let score = 0;
    for (const possibleHeaders of Object.values(mappings)) {
      if (possibleHeaders.some(ph => normalised.some(h => h.includes(ph)))) {
        score++;
      }
    }
    if (score > bestMatch.score) {
      bestMatch = { type, score };
    }
  }
  
  return bestMatch.score >= 2 ? bestMatch.type : null;
}

function mapToComplianceRecords(
  sheet: SheetData | undefined,
  type: string | null
): ComplianceRecord[] {
  if (!sheet || !type) return [];
  
  const mapping = HEADER_MAPPINGS[type];
  if (!mapping) return [];
  
  // Map headers to column indices
  const headerIndices: Record<string, number> = {};
  sheet.headers.forEach((header, index) => {
    const normalised = header.toLowerCase();
    for (const [field, possibleHeaders] of Object.entries(mapping)) {
      if (possibleHeaders.some(ph => normalised.includes(ph))) {
        headerIndices[field] = index;
      }
    }
  });
  
  // Extract records
  return sheet.rows.map(row => {
    const record: Record<string, any> = { certificateType: type };
    for (const [field, index] of Object.entries(headerIndices)) {
      record[field] = row[index];
    }
    return record as ComplianceRecord;
  });
}
```

---

### Image Processing

Images skip directly to TIER 2 (Azure DI) since there's no native text to extract.

```
┌─────────────────────────────────────────────────────────┐
│                   IMAGE PROCESSING                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Supported formats:                                    │
│  • JPEG (.jpg, .jpeg)                                  │
│  • PNG (.png)                                          │
│  • TIFF (.tif, .tiff)                                  │
│  • WebP (.webp)                                        │
│  • HEIC (.heic) - requires conversion                  │
│  • BMP (.bmp)                                          │
│                                                         │
│  Pre-processing:                                       │
│  1. Convert to supported format if needed             │
│  2. Resize if >20MB (Azure DI limit)                  │
│  3. Enhance if low quality detected                   │
│     • Deskew                                          │
│     • Contrast adjustment                             │
│     • Noise reduction                                 │
│                                                         │
│  Then: TIER 2 (Azure DI) → TIER 3 (Claude) → TIER 4  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
import sharp from 'sharp';

interface ImageProcessingResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  wasEnhanced: boolean;
}

async function preprocessImage(file: File): Promise<ImageProcessingResult> {
  let buffer = Buffer.from(await file.arrayBuffer());
  let wasEnhanced = false;
  
  // Get image metadata
  const metadata = await sharp(buffer).metadata();
  
  // Convert HEIC to JPEG
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    wasEnhanced = true;
  }
  
  // Resize if too large (Azure DI limit: 50MB, but smaller is faster)
  const MAX_DIMENSION = 4000;
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  
  if ((metadata.width || 0) > MAX_DIMENSION || 
      (metadata.height || 0) > MAX_DIMENSION ||
      buffer.length > MAX_SIZE) {
    buffer = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    wasEnhanced = true;
  }
  
  // Auto-enhance if needed (optional, adds latency)
  // buffer = await sharp(buffer).normalize().sharpen().toBuffer();
  
  const finalMetadata = await sharp(buffer).metadata();
  
  return {
    buffer,
    mimeType: 'image/jpeg',
    width: finalMetadata.width || 0,
    height: finalMetadata.height || 0,
    wasEnhanced,
  };
}

async function processImage(file: File): Promise<ExtractionResult> {
  // Preprocess
  const processed = await preprocessImage(file);
  const base64 = processed.buffer.toString('base64');
  
  // TIER 2: Azure Document Intelligence
  try {
    const azureResult = await callAzureDocumentIntelligence(base64, processed.mimeType);
    
    if (azureResult.confidence >= 0.80) {
      return {
        tier: 2,
        data: azureResult.data,
        confidence: azureResult.confidence,
        cost: 0.0015,
        processingTime: azureResult.processingTime,
      };
    }
  } catch (error) {
    console.error('Azure DI failed for image:', error);
  }
  
  // TIER 3: Claude Vision
  try {
    const claudeResult = await callClaudeVision(base64, processed.mimeType);
    
    if (claudeResult.confidence >= 0.70) {
      return {
        tier: 3,
        data: claudeResult.data,
        confidence: claudeResult.confidence,
        cost: 0.01,
        processingTime: claudeResult.processingTime,
      };
    }
  } catch (error) {
    console.error('Claude Vision failed for image:', error);
  }
  
  // TIER 4: Manual review
  return {
    tier: 4,
    data: null,
    confidence: 0,
    requiresManualReview: true,
  };
}
```

---

### Email Processing

Emails may contain compliance certificates as attachments or inline content.

```
┌─────────────────────────────────────────────────────────┐
│                   EMAIL PROCESSING                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Email structure:                                      │
│  • Headers (From, To, Subject, Date)                   │
│  • Body (plain text or HTML)                           │
│  • Attachments (certificates!)                         │
│                                                         │
│  Extraction strategy:                                  │
│  1. Parse email headers for metadata                   │
│  2. Extract body text (may contain summary)           │
│  3. Extract attachments                                │
│  4. Process each attachment through main pipeline     │
│  5. Link attachment results to email metadata         │
│                                                         │
│  Use cases:                                            │
│  • Contractor sends CP12 via email                     │
│  • Automated certificate delivery from software       │
│  • Forwarded certificates from property managers      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
import { simpleParser, ParsedMail, Attachment } from 'mailparser';

interface EmailExtraction {
  metadata: {
    from: string;
    to: string[];
    subject: string;
    date: Date;
  };
  body: string;
  attachments: AttachmentInfo[];
}

interface AttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
}

async function extractEmail(file: File): Promise<EmailExtraction> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await simpleParser(buffer);
  
  return {
    metadata: {
      from: parsed.from?.text || '',
      to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text) : [parsed.to.text]) : [],
      subject: parsed.subject || '',
      date: parsed.date || new Date(),
    },
    body: parsed.text || '',
    attachments: (parsed.attachments || []).map(att => ({
      filename: att.filename || 'attachment',
      mimeType: att.contentType,
      size: att.size,
      content: att.content,
    })),
  };
}

async function processEmail(file: File): Promise<EmailExtractionResult> {
  const email = await extractEmail(file);
  const results: ExtractionResult[] = [];
  
  // Process each attachment through the main pipeline
  for (const attachment of email.attachments) {
    const attachmentFile = new File(
      [attachment.content],
      attachment.filename,
      { type: attachment.mimeType }
    );
    
    const result = await extractDocument(attachmentFile); // Main pipeline
    results.push({
      ...result,
      sourceEmail: {
        from: email.metadata.from,
        subject: email.metadata.subject,
        date: email.metadata.date,
      },
    });
  }
  
  return {
    email: email.metadata,
    bodyText: email.body,
    attachmentResults: results,
  };
}
```

---

## Complete Pipeline Implementation

```typescript
// Main extraction orchestrator
export class MultiFormatExtractor {
  private templateEngine: TemplateExtractionEngine;
  private azureClient: AzureDocumentIntelligence;
  private claudeClient: ClaudeVisionClient;
  
  constructor(config: ExtractorConfig) {
    this.templateEngine = new TemplateExtractionEngine(config.templates);
    this.azureClient = new AzureDocumentIntelligence(config.azureEndpoint, config.azureKey);
    this.claudeClient = new ClaudeVisionClient(config.anthropicKey);
  }
  
  async extract(file: File): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    // TIER 0: Format detection
    const format = this.detectFormat(file);
    const handler = this.getHandler(format);
    
    console.log(`Processing ${file.name} as ${format}`);
    
    // Route based on format
    let result: ExtractionResult;
    
    switch (handler.startTier) {
      case 1:
        result = await this.processTextBased(file, handler);
        break;
      case 2:
        result = await this.processVisual(file);
        break;
      default:
        throw new Error(`Unknown start tier: ${handler.startTier}`);
    }
    
    result.processingTime = Date.now() - startTime;
    result.format = format;
    
    return result;
  }
  
  private detectFormat(file: File): FileFormat {
    // Check MIME type first
    const mimeType = file.type.toLowerCase();
    
    // Map MIME types to formats
    const mimeMap: Record<string, FileFormat> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.ms-excel': 'XLS',
      'text/csv': 'CSV',
      'text/html': 'HTML',
      'text/plain': 'TXT',
      'message/rfc822': 'EMAIL',
      'image/jpeg': 'IMAGE',
      'image/png': 'IMAGE',
      'image/tiff': 'IMAGE',
      'image/webp': 'IMAGE',
      'image/heic': 'IMAGE',
    };
    
    if (mimeMap[mimeType]) {
      return mimeMap[mimeType];
    }
    
    // Fall back to extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const extMap: Record<string, FileFormat> = {
      'pdf': 'PDF',
      'docx': 'DOCX',
      'doc': 'DOC',
      'xlsx': 'XLSX',
      'xls': 'XLS',
      'csv': 'CSV',
      'html': 'HTML',
      'htm': 'HTML',
      'txt': 'TXT',
      'eml': 'EMAIL',
      'msg': 'EMAIL',
      'jpg': 'IMAGE',
      'jpeg': 'IMAGE',
      'png': 'IMAGE',
      'tif': 'IMAGE',
      'tiff': 'IMAGE',
      'webp': 'IMAGE',
      'heic': 'IMAGE',
    };
    
    return extMap[ext || ''] || 'UNKNOWN';
  }
  
  private getHandler(format: FileFormat): FormatHandler {
    const handlers: Record<FileFormat, FormatHandler> = {
      PDF: { startTier: 0, extractor: this.extractPDF.bind(this) }, // Needs analysis
      DOCX: { startTier: 1, extractor: this.extractDOCX.bind(this) },
      DOC: { startTier: 1, extractor: this.extractDOC.bind(this) },
      XLSX: { startTier: 1, extractor: this.extractXLSX.bind(this) },
      XLS: { startTier: 1, extractor: this.extractXLS.bind(this) },
      CSV: { startTier: 1, extractor: this.extractCSV.bind(this) },
      HTML: { startTier: 1, extractor: this.extractHTML.bind(this) },
      TXT: { startTier: 1, extractor: this.extractTXT.bind(this) },
      EMAIL: { startTier: 1, extractor: this.extractEmail.bind(this) },
      IMAGE: { startTier: 2, extractor: this.extractImage.bind(this) },
      UNKNOWN: { startTier: 2, extractor: this.extractImage.bind(this) }, // Try as image
    };
    
    return handlers[format];
  }
  
  private async processTextBased(file: File, handler: FormatHandler): Promise<ExtractionResult> {
    // Extract text
    const extraction = await handler.extractor(file);
    
    if (!extraction.text) {
      // No text extracted - fall back to visual processing
      return this.processVisual(file);
    }
    
    // TIER 1: Template extraction
    const templateResult = await this.templateEngine.extract(
      extraction.text,
      extraction.structure,
      file.name
    );
    
    if (templateResult.confidence >= 0.85) {
      return {
        tier: 1,
        data: templateResult.data,
        confidence: templateResult.confidence,
        cost: 0,
      };
    }
    
    // TIER 1.5: Claude text enhancement
    if (templateResult.confidence >= 0.5) {
      const enhancedResult = await this.claudeTextEnhance(
        extraction.text,
        templateResult.partialData
      );
      
      if (enhancedResult.confidence >= 0.80) {
        return {
          tier: 1.5,
          data: enhancedResult.data,
          confidence: enhancedResult.confidence,
          cost: 0.003,
        };
      }
    }
    
    // Fall back to visual processing
    return this.processVisual(file);
  }
  
  private async processVisual(file: File): Promise<ExtractionResult> {
    // Convert to image if needed
    const images = await this.toImages(file);
    let totalCost = 0;
    
    // TIER 2: Azure Document Intelligence
    try {
      const azureResult = await this.azureClient.analyze(images);
      totalCost += 0.0015 * images.length;
      
      if (azureResult.confidence >= 0.80) {
        return {
          tier: 2,
          data: azureResult.data,
          confidence: azureResult.confidence,
          cost: totalCost,
        };
      }
    } catch (error) {
      console.error('Azure DI failed:', error);
    }
    
    // TIER 3: Claude Vision
    try {
      const claudeResult = await this.claudeClient.analyze(images);
      totalCost += 0.01 * images.length;
      
      if (claudeResult.confidence >= 0.70) {
        return {
          tier: 3,
          data: claudeResult.data,
          confidence: claudeResult.confidence,
          cost: totalCost,
        };
      }
    } catch (error) {
      console.error('Claude Vision failed:', error);
    }
    
    // TIER 4: Manual review
    return {
      tier: 4,
      data: null,
      confidence: 0,
      cost: totalCost,
      requiresManualReview: true,
    };
  }
  
  private async toImages(file: File): Promise<Buffer[]> {
    const mimeType = file.type;
    
    if (mimeType.startsWith('image/')) {
      const processed = await preprocessImage(file);
      return [processed.buffer];
    }
    
    if (mimeType === 'application/pdf') {
      return await this.pdfToImages(file);
    }
    
    // For other formats, try to convert via PDF
    // (would need LibreOffice or similar)
    throw new Error(`Cannot convert ${mimeType} to images`);
  }
}
```

---

## Cost Analysis

### Per-Document Costs by Format

| Format | TIER 1 | TIER 1.5 | TIER 2 | TIER 3 | TIER 4 |
|--------|--------|----------|--------|--------|--------|
| Native PDF | £0 | £0.003 | £0.0015/pg | £0.01/pg | ~£5 |
| Scanned PDF | N/A | N/A | £0.0015/pg | £0.01/pg | ~£5 |
| DOCX | £0 | £0.003 | N/A | N/A | ~£5 |
| XLSX | £0 | £0.003 | N/A | N/A | ~£5 |
| CSV | £0 | £0.003 | N/A | N/A | ~£5 |
| HTML | £0 | £0.003 | N/A | N/A | ~£5 |
| Images | N/A | N/A | £0.0015 | £0.01 | ~£5 |
| Email | £0 (body) | £0.003 | Per attachment | Per attachment | ~£5 |

### Expected Distribution (Social Housing)

Based on typical contractor submission patterns:

| Format | % of Uploads | Typical Path | Avg Cost |
|--------|--------------|--------------|----------|
| Native PDF | 55% | 80% T1, 15% T1.5, 5% T2 | £0.0006 |
| Scanned PDF | 20% | 70% T2, 25% T3, 5% T4 | £0.0040 |
| DOCX | 10% | 90% T1, 10% T1.5 | £0.0003 |
| XLSX | 8% | 95% T1, 5% T1.5 | £0.0002 |
| Images | 5% | 60% T2, 35% T3, 5% T4 | £0.0050 |
| Other | 2% | Mixed | £0.0030 |

### Blended Cost Calculation

```
Blended Cost = Σ (Format % × Avg Cost)

= (0.55 × 0.0006) + (0.20 × 0.0040) + (0.10 × 0.0003) 
  + (0.08 × 0.0002) + (0.05 × 0.0050) + (0.02 × 0.0030)

= 0.00033 + 0.00080 + 0.00003 + 0.000016 + 0.00025 + 0.00006

= £0.00148 per document

≈ £0.0015 per document (rounded)
```

### Monthly Cost Projections

| Documents/Month | Blended Cost | TIER 4 (5%) | Total |
|-----------------|--------------|-------------|-------|
| 1,000 | £1.50 | £250 | £251.50 |
| 5,000 | £7.50 | £1,250 | £1,257.50 |
| 10,000 | £15.00 | £2,500 | £2,515.00 |
| 50,000 | £75.00 | £12,500 | £12,575.00 |

*Note: TIER 4 costs assume £5/document for manual review of 5% failures*

---

## Implementation Checklist

### Phase 1: Core Pipeline
- [ ] Format detection (MIME + extension)
- [ ] PDF analysis (native vs scanned)
- [ ] PDF text extraction (pdfjs-dist)
- [ ] DOCX text extraction (JSZip + XML parsing)
- [ ] XLSX extraction (xlsx library)
- [ ] Template matching engine
- [ ] Confidence scoring

### Phase 2: AI Integration
- [ ] Azure Document Intelligence client
- [ ] Custom model training (optional)
- [ ] Claude Vision client
- [ ] Claude Text API for TIER 1.5
- [ ] Cost tracking and budgets

### Phase 3: Extended Formats
- [ ] CSV parsing
- [ ] HTML extraction
- [ ] Email parsing (mailparser)
- [ ] Image preprocessing (sharp)
- [ ] HEIC conversion

### Phase 4: Production Hardening
- [ ] Error handling and retries
- [ ] Timeout management
- [ ] Queue processing for large batches
- [ ] Monitoring and alerting
- [ ] Cost alerts and limits

---

## Summary

The multi-format extraction architecture provides:

1. **Universal Format Support** - Handle any file contractors submit
2. **Cost Optimisation** - Always use cheapest viable method
3. **Intelligent Routing** - Skip unnecessary tiers based on format
4. **Graceful Degradation** - Escalate smoothly when needed
5. **Human Fallback** - Never lose documents to automation failures

**Key Design Principles:**

| Principle | Implementation |
|-----------|----------------|
| **Cheapest first** | TIER 1 (free) → TIER 2 (£0.0015) → TIER 3 (£0.01) |
| **Format-aware** | Text formats skip OCR entirely |
| **Confidence-driven** | Only escalate when confidence < threshold |
| **Structure-preserving** | XLSX columns → fields directly |
| **Fail-safe** | Always route to TIER 4 if all else fails |

This architecture positions ComplianceAI to process **any document format** at scale while maintaining industry-leading cost efficiency.
