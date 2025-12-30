# ComplianceAI: Multi-Format Extraction Architecture

## Intelligent Document Processing for All File Types

**Version:** 2.0  
**Date:** December 2024  
**Author:** LASHAN Digital

---

## Executive Summary

ComplianceAI's extraction pipeline is designed to handle **any document format** contractors submit - not just PDFs. The tiered architecture intelligently routes each format to the most cost-effective extraction method, minimising AI costs while maximising accuracy.

**Key Principles:**
1. **Use the cheapest method that achieves ≥85% confidence**, escalating only when necessary
2. **Extract non-OCR data first** - QR codes, metadata, and visual patterns are FREE
3. **QR codes can bypass OCR entirely** - modern certificates often embed verification URLs or data

**Supported Formats:**
- PDF (native and scanned)
- Microsoft Word (DOCX, DOC)
- Microsoft Excel (XLSX, XLS)
- Images (JPEG, PNG, TIFF, HEIC, WebP)
- CSV/TSV
- HTML
- Plain Text
- Email (EML, MSG)

**Cost Innovation:** By scanning for QR codes before OCR, we can extract complete certificate data for **FREE** from 15-25% of modern certificates.

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
│  Native or         │             │             ▼             │             │
│  Scanned?          │             │        ┌────────┐         │             │
│      │             │             │        │TIER 0.5│         │             │
│  ┌───┴───┐         │             │        │QR/Meta │         │             │
│  ▼       ▼         │             │        └───┬────┘         │             │
│ Native Scanned     │             │            │              │             │
│   │       │        │             │      ┌─────┴─────┐        │             │
│   │       │        │             │      ▼           ▼        │             │
│   │       │        │             │   QR Found    No QR       │             │
│   │       │        │             │      │           │        │             │
│   │       │        │             │      ▼           ▼        │             │
│   │       │        │             │   DONE ✅    TIER 2       │             │
│   │       │        │             │   (FREE!)   (£0.0015)     │             │
│   ▼       ▼        ▼             ▼                           ▼             │
│ TIER 1  TIER 2   TIER 1       TIER 1                      TIER 1          │
│ (free) (£0.0015) (free)       (free)                      (free)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete Tier Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   TIER 0: Format Detection (instant, free)                                 │
│      │                                                                      │
│      ├─── Text-based (PDF native, DOCX, XLSX, CSV, HTML, TXT, Email)       │
│      │         │                                                            │
│      │         ▼                                                            │
│      │    TIER 1: Template Extraction (free)                               │
│      │         │                                                            │
│      │         ├─── Confidence ≥ 0.85 ──────────────────────► DONE ✅      │
│      │         │                                                            │
│      │         ▼                                                            │
│      │    TIER 1.5: Claude Text Enhancement (~£0.003)                      │
│      │         │                                                            │
│      │         ├─── Confidence ≥ 0.80 ──────────────────────► DONE ✅      │
│      │         │                                                            │
│      │         ▼                                                            │
│      │    Continue to TIER 2...                                            │
│      │                                                                      │
│      └─── Image-based (Scanned PDF, JPEG, PNG, TIFF, etc.)                 │
│                │                                                            │
│                ▼                                                            │
│           TIER 0.5: QR & Metadata Extraction (FREE) ◄─── NEW!              │
│                │                                                            │
│                ├─── QR contains verification data ──────────► DONE ✅      │
│                │         (Gas Safe URL, certificate ref, etc.)   (FREE!)   │
│                │                                                            │
│                ▼                                                            │
│           TIER 2: Azure Document Intelligence (~£0.0015/page)              │
│                │                                                            │
│                ├─── Confidence ≥ 0.80 ──────────────────────► DONE ✅      │
│                │                                                            │
│                ▼                                                            │
│           TIER 3: Claude Vision (~£0.01/page)                              │
│                │                                                            │
│                ├─── Confidence ≥ 0.70 ──────────────────────► DONE ✅      │
│                │                                                            │
│                ▼                                                            │
│           TIER 4: Manual Review (~£5-10/document)                          │
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
| PDF | Analyse if native or scanned | TIER 1 (native) or TIER 0.5 (scanned) |
| DOCX/DOC | Extract XML text | TIER 1 |
| XLSX/XLS/CSV | Extract cells + headers | TIER 1 |
| HTML | Parse DOM, extract text | TIER 1 |
| TXT | Read directly | TIER 1 |
| EML/MSG | Parse email, extract body + attachments | TIER 1 (body) + recurse (attachments) |
| Images | Extract metadata + scan QR codes | TIER 0.5 |

---

### TIER 0.5: QR Code & Metadata Extraction (NEW)
**Cost:** FREE  
**Time:** <500ms  
**Applies to:** Images, Scanned PDFs

Before expensive OCR, extract all available non-text data:

#### What Can Be Extracted Without OCR

| Data Type | Method | Use Case |
|-----------|--------|----------|
| **QR Codes** | Barcode library | Verification URLs, certificate refs, complete data |
| **EXIF Metadata** | ExifReader | Date taken, GPS location, generating software |
| **Logos** | Template matching | Identify certificate type (Gas Safe, NICEIC, etc.) |
| **Signatures** | Pattern detection | Verify document is signed |
| **Checkboxes** | Computer vision | Pass/Fail status without reading text |

#### QR Code Types Found in Compliance Certificates

| Provider | QR Content | Data Available |
|----------|------------|----------------|
| **Gas Safe Register** | `gassaferegister.co.uk/check/XXXXXXX` | Engineer licence number, verification URL |
| **Gas Tag / X Tag** | `gastag.co.uk/verify/...` | Full certificate data via API |
| **Corgi HomePlan** | Verification URL | Certificate reference, status |
| **NICEIC Online** | Verification URL | Certificate validation |
| **Contractor Apps** | JSON-encoded data | Complete inspection data |

---

### Non-OCR Data Extraction Methods

Beyond QR codes, several other data sources can be extracted from images WITHOUT expensive OCR:

#### 1. EXIF/XMP Metadata Extraction

Digital photos and PDFs contain embedded metadata that can provide valuable compliance information:

| Metadata Field | Compliance Use | Example Value |
|----------------|----------------|---------------|
| **DateTimeOriginal** | Verify inspection date | `2024-03-15 09:30:22` |
| **GPSLatitude/Longitude** | Verify photo at property | `51.5074, -0.1278` |
| **Make/Model** | Identify capture device | `Apple iPhone 14 Pro` |
| **Software** | Detect generating application | `Gas Tag v3.2`, `Adobe Acrobat` |
| **Creator** | Potential engineer name | `John Smith` |
| **CreateDate** | Document creation date | `2024-03-15` |
| **ModifyDate** | Last modification | `2024-03-15` |

**Compliance Value:**
- **GPS validation:** Confirm photo was taken at the property address (cross-reference with UPRN/address)
- **Date validation:** Check photo date matches claimed inspection date
- **Software detection:** Identify if generated by known compliance software (Gas Tag, Corgi, etc.)
- **Tampering detection:** Compare CreateDate vs ModifyDate for potential alterations

```typescript
import ExifReader from 'exifreader';

interface ExifMetadata {
  // Date/Time
  dateTaken?: Date;
  dateCreated?: Date;
  dateModified?: Date;
  
  // Location
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
  };
  
  // Device
  deviceMake?: string;
  deviceModel?: string;
  software?: string;
  
  // Document
  creator?: string;
  title?: string;
  subject?: string;
  
  // Image properties
  width?: number;
  height?: number;
  orientation?: number;
  
  // Validation flags
  hasGPS: boolean;
  hasValidDate: boolean;
  possibleTampering: boolean;
}

async function extractExifMetadata(buffer: Buffer): Promise<ExifMetadata> {
  try {
    const tags = ExifReader.load(buffer, { expanded: true });
    
    // Parse dates
    const dateTaken = parseExifDate(tags.exif?.DateTimeOriginal?.description);
    const dateCreated = parseExifDate(tags.xmp?.CreateDate?.description);
    const dateModified = parseExifDate(tags.xmp?.ModifyDate?.description);
    
    // Parse GPS
    const gpsCoordinates = parseGPSCoordinates(tags.gps);
    
    // Check for tampering indicators
    const possibleTampering = detectTampering(dateCreated, dateModified, tags);
    
    return {
      dateTaken,
      dateCreated,
      dateModified,
      gpsCoordinates,
      deviceMake: tags.exif?.Make?.description,
      deviceModel: tags.exif?.Model?.description,
      software: tags.exif?.Software?.description || tags.xmp?.CreatorTool?.description,
      creator: tags.xmp?.Creator?.description,
      title: tags.xmp?.Title?.description,
      subject: tags.xmp?.Subject?.description,
      width: tags.file?.['Image Width']?.value,
      height: tags.file?.['Image Height']?.value,
      orientation: tags.exif?.Orientation?.value,
      hasGPS: !!gpsCoordinates,
      hasValidDate: !!dateTaken || !!dateCreated,
      possibleTampering,
    };
  } catch (error) {
    console.warn('EXIF extraction failed:', error);
    return {
      hasGPS: false,
      hasValidDate: false,
      possibleTampering: false,
    };
  }
}

function parseExifDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  
  // EXIF date format: "YYYY:MM:DD HH:MM:SS"
  const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
  }
  
  // Try ISO format
  const isoDate = new Date(dateStr);
  return isNaN(isoDate.getTime()) ? undefined : isoDate;
}

function parseGPSCoordinates(gps: any): ExifMetadata['gpsCoordinates'] | undefined {
  if (!gps?.Latitude || !gps?.Longitude) return undefined;
  
  let latitude = parseFloat(gps.Latitude);
  let longitude = parseFloat(gps.Longitude);
  
  // Apply reference direction
  if (gps.GPSLatitudeRef?.value?.[0] === 'S') latitude = -latitude;
  if (gps.GPSLongitudeRef?.value?.[0] === 'W') longitude = -longitude;
  
  return {
    latitude,
    longitude,
    altitude: gps.GPSAltitude ? parseFloat(gps.GPSAltitude) : undefined,
  };
}

function detectTampering(
  created?: Date, 
  modified?: Date, 
  tags?: any
): boolean {
  // Modified significantly after creation
  if (created && modified) {
    const diffHours = (modified.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24) return true;
  }
  
  // Software indicates editing tool
  const editingSoftware = ['photoshop', 'gimp', 'paint', 'editor'];
  const software = (tags?.exif?.Software?.description || '').toLowerCase();
  if (editingSoftware.some(s => software.includes(s))) return true;
  
  return false;
}

// GPS validation against property location
interface GPSValidationResult {
  isValid: boolean;
  distanceMeters: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED';
  message: string;
}

function validateGPSLocation(
  photoGPS: { latitude: number; longitude: number },
  propertyGPS: { latitude: number; longitude: number },
  toleranceMeters: number = 100
): GPSValidationResult {
  const distance = calculateHaversineDistance(
    photoGPS.latitude, photoGPS.longitude,
    propertyGPS.latitude, propertyGPS.longitude
  );
  
  if (distance <= toleranceMeters) {
    return {
      isValid: true,
      distanceMeters: distance,
      confidence: distance <= 30 ? 'HIGH' : 'MEDIUM',
      message: `Photo taken within ${Math.round(distance)}m of property`,
    };
  }
  
  return {
    isValid: false,
    distanceMeters: distance,
    confidence: 'FAILED',
    message: `Photo taken ${Math.round(distance)}m from property - possible wrong location`,
  };
}

function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}
```

---

#### 2. Logo Detection (Template Matching)

Detect certification body logos to identify certificate type BEFORE OCR:

| Logo | Certificate Type | Confidence Indicator |
|------|------------------|---------------------|
| ![Gas Safe](gas_safe_logo) | GAS, LPG | High - regulatory requirement |
| ![NICEIC](niceic_logo) | EICR, ELEC | High - competent person scheme |
| ![NAPIT](napit_logo) | EICR, ELEC | High - competent person scheme |
| ![ELECSA](elecsa_logo) | EICR, ELEC | High - competent person scheme |
| ![OFTEC](oftec_logo) | OIL, OIL-TANK | High - oil industry scheme |
| ![HETAS](hetas_logo) | SOLID, BIO | High - solid fuel scheme |
| ![BAFE](bafe_logo) | FRA, FA, EXT | High - fire industry scheme |
| ![MCS](mcs_logo) | ASHP, GSHP, RENEW | High - renewable energy |
| ![ECS Card](ecs_logo) | EICR | Medium - electrician ID |
| ![UKAS](ukas_logo) | ASB | High - asbestos surveys |

**Implementation:**

```typescript
import cv from '@techstark/opencv-js';
// Alternative: import * as tf from '@tensorflow/tfjs';

interface LogoTemplate {
  name: string;
  certificateTypes: string[];
  template: cv.Mat;          // OpenCV matrix
  threshold: number;         // Minimum match confidence
  expectedRegion?: {         // Where logo typically appears
    x: number;               // % from left
    y: number;               // % from top
    width: number;           // % of image width
    height: number;          // % of image height
  };
}

interface LogoDetectionResult {
  name: string;
  confidence: number;
  certificateTypes: string[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isInExpectedRegion: boolean;
}

// Pre-load logo templates at startup
const LOGO_TEMPLATES: LogoTemplate[] = [
  {
    name: 'Gas Safe Register',
    certificateTypes: ['GAS', 'GAS-SVC', 'LPG'],
    template: loadTemplate('templates/gas_safe_logo.png'),
    threshold: 0.75,
    expectedRegion: { x: 0, y: 0, width: 0.4, height: 0.3 }, // Top-left
  },
  {
    name: 'NICEIC',
    certificateTypes: ['EICR', 'ELEC', 'PAT'],
    template: loadTemplate('templates/niceic_logo.png'),
    threshold: 0.75,
    expectedRegion: { x: 0, y: 0, width: 0.4, height: 0.3 },
  },
  {
    name: 'NAPIT',
    certificateTypes: ['EICR', 'ELEC', 'PAT'],
    template: loadTemplate('templates/napit_logo.png'),
    threshold: 0.75,
  },
  {
    name: 'ELECSA',
    certificateTypes: ['EICR', 'ELEC'],
    template: loadTemplate('templates/elecsa_logo.png'),
    threshold: 0.75,
  },
  {
    name: 'OFTEC',
    certificateTypes: ['OIL', 'OIL-TANK'],
    template: loadTemplate('templates/oftec_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'HETAS',
    certificateTypes: ['SOLID', 'BIO'],
    template: loadTemplate('templates/hetas_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'BAFE',
    certificateTypes: ['FRA', 'FA', 'EXT', 'SPRINK'],
    template: loadTemplate('templates/bafe_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'MCS',
    certificateTypes: ['ASHP', 'GSHP', 'RENEW'],
    template: loadTemplate('templates/mcs_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'UKAS',
    certificateTypes: ['ASB', 'ASB-M', 'ASB-R'],
    template: loadTemplate('templates/ukas_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'SAFed',
    certificateTypes: ['LIFT', 'STAIR', 'HOIST', 'PLAT'],
    template: loadTemplate('templates/safed_logo.png'),
    threshold: 0.70,
  },
  {
    name: 'FDIS',
    certificateTypes: ['FD', 'FD-Q', 'FD-A'],
    template: loadTemplate('templates/fdis_logo.png'),
    threshold: 0.70,
  },
];

async function detectLogos(imageBuffer: Buffer): Promise<LogoDetectionResult[]> {
  const results: LogoDetectionResult[] = [];
  
  // Load image into OpenCV
  const imageMat = cv.imdecode(imageBuffer);
  const imageGray = new cv.Mat();
  cv.cvtColor(imageMat, imageGray, cv.COLOR_BGR2GRAY);
  
  // Scale factors to handle different logo sizes
  const scales = [0.5, 0.75, 1.0, 1.25, 1.5];
  
  for (const template of LOGO_TEMPLATES) {
    let bestMatch = { confidence: 0, location: null as any, scale: 1 };
    
    for (const scale of scales) {
      // Resize template
      const scaledTemplate = new cv.Mat();
      cv.resize(
        template.template, 
        scaledTemplate, 
        new cv.Size(
          template.template.cols * scale, 
          template.template.rows * scale
        )
      );
      
      // Skip if template larger than image
      if (scaledTemplate.cols > imageGray.cols || 
          scaledTemplate.rows > imageGray.rows) {
        scaledTemplate.delete();
        continue;
      }
      
      // Template matching
      const result = new cv.Mat();
      cv.matchTemplate(imageGray, scaledTemplate, result, cv.TM_CCOEFF_NORMED);
      
      // Find best match
      const minMax = cv.minMaxLoc(result);
      
      if (minMax.maxVal > bestMatch.confidence) {
        bestMatch = {
          confidence: minMax.maxVal,
          location: minMax.maxLoc,
          scale,
        };
      }
      
      result.delete();
      scaledTemplate.delete();
    }
    
    // Check if match exceeds threshold
    if (bestMatch.confidence >= template.threshold) {
      const boundingBox = {
        x: bestMatch.location.x,
        y: bestMatch.location.y,
        width: template.template.cols * bestMatch.scale,
        height: template.template.rows * bestMatch.scale,
      };
      
      // Check if in expected region
      let isInExpectedRegion = true;
      if (template.expectedRegion) {
        const centerX = (boundingBox.x + boundingBox.width / 2) / imageMat.cols;
        const centerY = (boundingBox.y + boundingBox.height / 2) / imageMat.rows;
        
        isInExpectedRegion = (
          centerX >= template.expectedRegion.x &&
          centerX <= template.expectedRegion.x + template.expectedRegion.width &&
          centerY >= template.expectedRegion.y &&
          centerY <= template.expectedRegion.y + template.expectedRegion.height
        );
      }
      
      results.push({
        name: template.name,
        confidence: bestMatch.confidence,
        certificateTypes: template.certificateTypes,
        boundingBox,
        isInExpectedRegion,
      });
    }
  }
  
  // Clean up
  imageMat.delete();
  imageGray.delete();
  
  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence);
}

// Alternative: TensorFlow.js model for logo classification
async function detectLogosML(imageBuffer: Buffer): Promise<LogoDetectionResult[]> {
  // Load pre-trained model (custom trained on compliance logos)
  const model = await tf.loadGraphModel('models/compliance_logo_detector/model.json');
  
  // Preprocess image
  const tensor = tf.node.decodeImage(imageBuffer)
    .resizeBilinear([224, 224])
    .expandDims(0)
    .div(255.0);
  
  // Run inference
  const predictions = await model.predict(tensor) as tf.Tensor;
  const results = await predictions.array();
  
  // Map to logo results
  // ...
  
  tensor.dispose();
  predictions.dispose();
  
  return [];
}
```

---

#### 3. Signature Detection

Detect presence of handwritten signatures to validate document completion:

| Signature Type | Detection Method | Confidence |
|----------------|------------------|------------|
| **Ink signature** | Stroke pattern analysis | High |
| **Digital signature** | Certificate marker detection | High |
| **Initials** | Small stroke clusters | Medium |
| **Stamp** | Circular/rectangular patterns | High |

```typescript
interface SignatureDetectionResult {
  hasSignature: boolean;
  signatureType: 'INK' | 'DIGITAL' | 'STAMP' | 'INITIALS' | 'NONE';
  confidence: number;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  signatureRegion: 'EXPECTED' | 'UNEXPECTED' | 'UNKNOWN';
}

// Expected signature regions on compliance certificates
const SIGNATURE_REGIONS = {
  // Bottom-right quadrant (most common)
  primary: { x: 0.5, y: 0.7, width: 0.45, height: 0.25 },
  // Bottom-left quadrant (dual signatures)
  secondary: { x: 0.05, y: 0.7, width: 0.45, height: 0.25 },
  // Middle-right (some forms)
  tertiary: { x: 0.5, y: 0.4, width: 0.45, height: 0.2 },
};

async function detectSignature(imageBuffer: Buffer): Promise<SignatureDetectionResult> {
  const imageMat = cv.imdecode(imageBuffer);
  const imageGray = new cv.Mat();
  cv.cvtColor(imageMat, imageGray, cv.COLOR_BGR2GRAY);
  
  // Focus on expected signature regions
  for (const [regionName, region] of Object.entries(SIGNATURE_REGIONS)) {
    const roi = extractROI(imageGray, region, imageMat.cols, imageMat.rows);
    
    // Apply adaptive thresholding to isolate ink
    const binary = new cv.Mat();
    cv.adaptiveThreshold(
      roi, binary, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11, 2
    );
    
    // Find contours (signature strokes)
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // Analyse contours for signature characteristics
    const analysis = analyseSignatureContours(contours, roi.cols, roi.rows);
    
    if (analysis.isSignature) {
      // Calculate absolute position
      const location = {
        x: region.x * imageMat.cols,
        y: region.y * imageMat.rows,
        width: region.width * imageMat.cols,
        height: region.height * imageMat.rows,
      };
      
      // Clean up
      roi.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
      imageMat.delete();
      imageGray.delete();
      
      return {
        hasSignature: true,
        signatureType: analysis.type,
        confidence: analysis.confidence,
        location,
        signatureRegion: 'EXPECTED',
      };
    }
    
    roi.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
  
  imageMat.delete();
  imageGray.delete();
  
  return {
    hasSignature: false,
    signatureType: 'NONE',
    confidence: 0,
    signatureRegion: 'UNKNOWN',
  };
}

interface ContourAnalysis {
  isSignature: boolean;
  type: 'INK' | 'DIGITAL' | 'STAMP' | 'INITIALS' | 'NONE';
  confidence: number;
}

function analyseSignatureContours(
  contours: cv.MatVector, 
  width: number, 
  height: number
): ContourAnalysis {
  const contourCount = contours.size();
  
  if (contourCount === 0) {
    return { isSignature: false, type: 'NONE', confidence: 0 };
  }
  
  // Calculate metrics
  let totalArea = 0;
  let totalPerimeter = 0;
  let complexContours = 0; // Contours with many points (handwriting)
  let circularContours = 0; // Potential stamps
  
  for (let i = 0; i < contourCount; i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);
    const points = contour.rows;
    
    totalArea += area;
    totalPerimeter += perimeter;
    
    // Circularity check (stamps are often circular)
    if (perimeter > 0) {
      const circularity = 4 * Math.PI * area / (perimeter * perimeter);
      if (circularity > 0.7) circularContours++;
    }
    
    // Complexity check (signatures have many direction changes)
    if (points > 20) complexContours++;
  }
  
  const regionArea = width * height;
  const coverageRatio = totalArea / regionArea;
  
  // Stamp detection: circular shape, moderate coverage
  if (circularContours > 0 && coverageRatio > 0.05 && coverageRatio < 0.4) {
    return { isSignature: true, type: 'STAMP', confidence: 0.8 };
  }
  
  // Signature detection: complex strokes, low-moderate coverage
  if (complexContours > 3 && coverageRatio > 0.01 && coverageRatio < 0.3) {
    // Check stroke characteristics
    const avgComplexity = totalPerimeter / totalArea;
    
    if (avgComplexity > 0.5) { // High perimeter-to-area = handwriting
      return { 
        isSignature: true, 
        type: 'INK', 
        confidence: Math.min(0.9, 0.5 + complexContours * 0.05),
      };
    }
  }
  
  // Initials: fewer strokes, small area
  if (complexContours >= 1 && complexContours <= 3 && coverageRatio < 0.1) {
    return { isSignature: true, type: 'INITIALS', confidence: 0.6 };
  }
  
  return { isSignature: false, type: 'NONE', confidence: 0 };
}

function extractROI(
  image: cv.Mat, 
  region: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): cv.Mat {
  const rect = new cv.Rect(
    Math.floor(region.x * imageWidth),
    Math.floor(region.y * imageHeight),
    Math.floor(region.width * imageWidth),
    Math.floor(region.height * imageHeight)
  );
  return image.roi(rect);
}
```

---

#### 4. Checkbox/Tick Detection

Detect checkbox states to determine Pass/Fail without OCR:

| Checkbox State | Visual Pattern | Compliance Meaning |
|----------------|----------------|-------------------|
| ✓ Checked | Tick mark inside box | PASS / YES / Compliant |
| ✗ Crossed | X mark inside box | FAIL / NO / Non-compliant |
| ☐ Empty | Empty box | Not assessed / N/A |
| ● Filled | Solid filled box | Selected option |

```typescript
interface CheckboxDetectionResult {
  checkboxes: DetectedCheckbox[];
  passFailDetermined: boolean;
  overallResult?: 'PASS' | 'FAIL' | 'MIXED' | 'UNDETERMINED';
  confidence: number;
}

interface DetectedCheckbox {
  location: { x: number; y: number; width: number; height: number };
  state: 'CHECKED' | 'CROSSED' | 'EMPTY' | 'FILLED' | 'UNKNOWN';
  confidence: number;
  nearbyText?: string; // If OCR hint available
  isPassIndicator: boolean;
  isFailIndicator: boolean;
}

// Common checkbox patterns on compliance certificates
const CHECKBOX_PATTERNS = {
  // Pass/Satisfactory indicators typically on left side of "PASS" text
  passRegions: [
    { x: 0.05, y: 0.1, width: 0.15, height: 0.1 },  // Top-left
    { x: 0.05, y: 0.2, width: 0.15, height: 0.1 },  // Upper-left
    { x: 0.5, y: 0.1, width: 0.15, height: 0.1 },   // Top-middle
  ],
  // Fail/Unsatisfactory indicators
  failRegions: [
    { x: 0.05, y: 0.15, width: 0.15, height: 0.1 }, // Below pass
    { x: 0.5, y: 0.15, width: 0.15, height: 0.1 },  // Right of pass
  ],
};

async function detectCheckboxes(imageBuffer: Buffer): Promise<CheckboxDetectionResult> {
  const imageMat = cv.imdecode(imageBuffer);
  const imageGray = new cv.Mat();
  cv.cvtColor(imageMat, imageGray, cv.COLOR_BGR2GRAY);
  
  // Apply edge detection
  const edges = new cv.Mat();
  cv.Canny(imageGray, edges, 50, 150);
  
  // Find rectangular contours (potential checkboxes)
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
  
  const checkboxes: DetectedCheckbox[] = [];
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const approx = new cv.Mat();
    const epsilon = 0.02 * cv.arcLength(contour, true);
    cv.approxPolyDP(contour, approx, epsilon, true);
    
    // Check if rectangular (4 corners)
    if (approx.rows === 4) {
      const rect = cv.boundingRect(contour);
      
      // Filter by size (checkboxes are typically 10-50px)
      const avgDimension = (rect.width + rect.height) / 2;
      const aspectRatio = rect.width / rect.height;
      
      if (avgDimension >= 10 && avgDimension <= 60 && 
          aspectRatio >= 0.7 && aspectRatio <= 1.3) {
        
        // Extract checkbox region
        const checkboxROI = imageGray.roi(rect);
        
        // Analyse interior to determine state
        const state = analyseCheckboxState(checkboxROI);
        
        // Determine if this is a pass/fail indicator by position
        const normalizedX = rect.x / imageMat.cols;
        const normalizedY = rect.y / imageMat.rows;
        
        const isPassIndicator = isInRegions(normalizedX, normalizedY, CHECKBOX_PATTERNS.passRegions);
        const isFailIndicator = isInRegions(normalizedX, normalizedY, CHECKBOX_PATTERNS.failRegions);
        
        checkboxes.push({
          location: rect,
          state: state.state,
          confidence: state.confidence,
          isPassIndicator,
          isFailIndicator,
        });
        
        checkboxROI.delete();
      }
    }
    approx.delete();
  }
  
  // Determine overall result
  let overallResult: CheckboxDetectionResult['overallResult'] = 'UNDETERMINED';
  let passFailDetermined = false;
  
  const passChecked = checkboxes.some(cb => 
    cb.isPassIndicator && (cb.state === 'CHECKED' || cb.state === 'FILLED')
  );
  const failChecked = checkboxes.some(cb => 
    cb.isFailIndicator && (cb.state === 'CHECKED' || cb.state === 'FILLED')
  );
  
  if (passChecked && !failChecked) {
    overallResult = 'PASS';
    passFailDetermined = true;
  } else if (failChecked && !passChecked) {
    overallResult = 'FAIL';
    passFailDetermined = true;
  } else if (passChecked && failChecked) {
    overallResult = 'MIXED'; // Unusual - might need manual review
  }
  
  // Clean up
  imageMat.delete();
  imageGray.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();
  
  return {
    checkboxes,
    passFailDetermined,
    overallResult,
    confidence: passFailDetermined ? 0.85 : 0.3,
  };
}

interface CheckboxStateAnalysis {
  state: DetectedCheckbox['state'];
  confidence: number;
}

function analyseCheckboxState(roi: cv.Mat): CheckboxStateAnalysis {
  // Calculate mean intensity
  const mean = cv.mean(roi);
  const avgIntensity = mean[0];
  
  // Calculate fill ratio
  const binary = new cv.Mat();
  cv.threshold(roi, binary, 128, 255, cv.THRESH_BINARY_INV);
  const filledPixels = cv.countNonZero(binary);
  const totalPixels = roi.rows * roi.cols;
  const fillRatio = filledPixels / totalPixels;
  
  binary.delete();
  
  // Determine state based on fill characteristics
  if (fillRatio < 0.1) {
    // Very empty - probably unchecked
    return { state: 'EMPTY', confidence: 0.9 };
  }
  
  if (fillRatio > 0.6) {
    // Heavily filled - probably a filled checkbox
    return { state: 'FILLED', confidence: 0.85 };
  }
  
  if (fillRatio >= 0.15 && fillRatio <= 0.45) {
    // Moderate fill - likely a tick or cross
    // Would need more sophisticated analysis to distinguish
    // For now, assume checked (tick is more common than cross)
    return { state: 'CHECKED', confidence: 0.7 };
  }
  
  return { state: 'UNKNOWN', confidence: 0.3 };
}

function isInRegions(
  x: number, 
  y: number, 
  regions: Array<{ x: number; y: number; width: number; height: number }>
): boolean {
  return regions.some(region => 
    x >= region.x && x <= region.x + region.width &&
    y >= region.y && y <= region.y + region.height
  );
}
```

---

#### 5. Combined Visual Analysis

Orchestrate all visual detection methods:

```typescript
interface ComprehensiveVisualAnalysis {
  // QR/Barcode
  qrCodes: QRCodeResult[];
  
  // Metadata
  exifMetadata: ExifMetadata;
  gpsValidation?: GPSValidationResult;
  
  // Visual elements
  logoDetection: LogoDetectionResult[];
  signatureDetection: SignatureDetectionResult;
  checkboxDetection: CheckboxDetectionResult;
  
  // Derived insights
  suggestedCertificateType?: string;
  suggestedOutcome?: 'PASS' | 'FAIL' | 'UNDETERMINED';
  documentCompleteness: {
    hasLogo: boolean;
    hasSignature: boolean;
    hasDate: boolean;
    hasCheckboxes: boolean;
    completenessScore: number; // 0-1
  };
  
  // Can we skip OCR?
  canBypassOCR: boolean;
  bypassReason?: string;
  extractedData?: Partial<ComplianceData>;
  
  // Confidence in visual analysis
  overallConfidence: number;
}

async function performComprehensiveVisualAnalysis(
  imageBuffer: Buffer,
  propertyLocation?: { latitude: number; longitude: number }
): Promise<ComprehensiveVisualAnalysis> {
  
  // Run all analyses in parallel
  const [
    qrCodes,
    exifMetadata,
    logoDetection,
    signatureDetection,
    checkboxDetection,
  ] = await Promise.all([
    extractQRCodes(imageBuffer),
    extractExifMetadata(imageBuffer),
    detectLogos(imageBuffer),
    detectSignature(imageBuffer),
    detectCheckboxes(imageBuffer),
  ]);
  
  // GPS validation if property location provided
  let gpsValidation: GPSValidationResult | undefined;
  if (propertyLocation && exifMetadata.gpsCoordinates) {
    gpsValidation = validateGPSLocation(
      exifMetadata.gpsCoordinates,
      propertyLocation
    );
  }
  
  // Determine certificate type from logo
  const primaryLogo = logoDetection[0];
  const suggestedCertificateType = primaryLogo?.certificateTypes[0];
  
  // Determine outcome from checkboxes
  const suggestedOutcome = checkboxDetection.overallResult === 'PASS' ? 'PASS' :
                           checkboxDetection.overallResult === 'FAIL' ? 'FAIL' :
                           'UNDETERMINED';
  
  // Calculate document completeness
  const documentCompleteness = {
    hasLogo: logoDetection.length > 0,
    hasSignature: signatureDetection.hasSignature,
    hasDate: exifMetadata.hasValidDate,
    hasCheckboxes: checkboxDetection.checkboxes.length > 0,
    completenessScore: 0,
  };
  documentCompleteness.completenessScore = (
    (documentCompleteness.hasLogo ? 0.3 : 0) +
    (documentCompleteness.hasSignature ? 0.3 : 0) +
    (documentCompleteness.hasDate ? 0.2 : 0) +
    (documentCompleteness.hasCheckboxes ? 0.2 : 0)
  );
  
  // Determine if we can bypass OCR
  const bypassQR = qrCodes.find(qr => qr.canBypassOCR);
  const canBypassOCR = !!bypassQR;
  
  // Extract data if bypassing
  let extractedData: Partial<ComplianceData> | undefined;
  let bypassReason: string | undefined;
  
  if (bypassQR) {
    bypassReason = `QR code from ${bypassQR.provider} contains verification data`;
    extractedData = {
      certificateType: suggestedCertificateType,
      certificateRef: bypassQR.parsed?.certificateRef,
      gasSafeId: bypassQR.parsed?.gasSafeId,
      engineerId: bypassQR.parsed?.engineerId,
      inspectionDate: bypassQR.parsed?.inspectionDate 
        ? new Date(bypassQR.parsed.inspectionDate)
        : exifMetadata.dateTaken,
      verificationUrl: bypassQR.parsed?.verificationUrl,
      outcome: suggestedOutcome !== 'UNDETERMINED' ? suggestedOutcome : undefined,
      extractionMethod: 'VISUAL_ANALYSIS',
    };
  }
  
  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence({
    qrCodes,
    logoDetection,
    signatureDetection,
    checkboxDetection,
    documentCompleteness,
  });
  
  return {
    qrCodes,
    exifMetadata,
    gpsValidation,
    logoDetection,
    signatureDetection,
    checkboxDetection,
    suggestedCertificateType,
    suggestedOutcome,
    documentCompleteness,
    canBypassOCR,
    bypassReason,
    extractedData,
    overallConfidence,
  };
}

function calculateOverallConfidence(data: {
  qrCodes: QRCodeResult[];
  logoDetection: LogoDetectionResult[];
  signatureDetection: SignatureDetectionResult;
  checkboxDetection: CheckboxDetectionResult;
  documentCompleteness: { completenessScore: number };
}): number {
  let confidence = 0;
  let weights = 0;
  
  // QR code confidence (highest weight)
  const bypassQR = data.qrCodes.find(qr => qr.canBypassOCR);
  if (bypassQR) {
    confidence += 0.95 * 3; // Weight 3
    weights += 3;
  }
  
  // Logo confidence
  if (data.logoDetection.length > 0) {
    confidence += data.logoDetection[0].confidence * 2; // Weight 2
    weights += 2;
  }
  
  // Signature confidence
  if (data.signatureDetection.hasSignature) {
    confidence += data.signatureDetection.confidence * 1; // Weight 1
    weights += 1;
  }
  
  // Checkbox confidence
  if (data.checkboxDetection.passFailDetermined) {
    confidence += data.checkboxDetection.confidence * 1.5; // Weight 1.5
    weights += 1.5;
  }
  
  // Document completeness
  confidence += data.documentCompleteness.completenessScore * 1; // Weight 1
  weights += 1;
  
  return weights > 0 ? confidence / weights : 0;
}
```

---

#### Visual Analysis Value Summary

| Method | Cost | Implementation | Data Extracted | Compliance Value |
|--------|------|----------------|----------------|------------------|
| **QR Codes** | FREE | jsQR / Dynamsoft | Verification URLs, certificate refs, full data | ⭐⭐⭐⭐⭐ Can bypass OCR entirely |
| **EXIF Metadata** | FREE | ExifReader | Date, GPS, software, device | ⭐⭐⭐⭐ Date/location validation |
| **Logo Detection** | FREE | OpenCV / TensorFlow | Certificate type hint | ⭐⭐⭐ Faster type classification |
| **Signature Detection** | FREE | OpenCV | Document signed (Y/N) | ⭐⭐⭐ Completeness validation |
| **Checkbox Detection** | FREE | OpenCV | Pass/Fail status | ⭐⭐⭐⭐ Outcome without OCR |

**Combined Impact:**
- **10-20%** of images can bypass OCR entirely (QR codes)
- **30-40%** get faster processing with type hints (logos)
- **50-60%** get validation data (dates, locations, signatures)
- **~13% cost reduction** overall

#### TIER 0.5 Implementation

```typescript
import ExifReader from 'exifreader';
import Dynamsoft from 'dynamsoft-javascript-barcode';
// Alternative: import jsQR from 'jsqr';

// ═══════════════════════════════════════════════════════════════
// EXIF/XMP METADATA EXTRACTION
// ═══════════════════════════════════════════════════════════════

interface ImageMetadata {
  dateTaken?: Date;
  gpsCoordinates?: { lat: number; lng: number };
  device?: string;
  software?: string;  // Could indicate generating software
}

async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const tags = ExifReader.load(buffer);
    
    return {
      dateTaken: tags['DateTimeOriginal']?.description 
        ? new Date(tags['DateTimeOriginal'].description) 
        : undefined,
      gpsCoordinates: tags['GPSLatitude'] && tags['GPSLongitude'] 
        ? {
            lat: parseGPSCoordinate(tags['GPSLatitude'], tags['GPSLatitudeRef']),
            lng: parseGPSCoordinate(tags['GPSLongitude'], tags['GPSLongitudeRef']),
          } 
        : undefined,
      device: [tags['Make']?.description, tags['Model']?.description]
        .filter(Boolean).join(' ') || undefined,
      software: tags['Software']?.description,
    };
  } catch {
    return {};
  }
}

function parseGPSCoordinate(coord: any, ref: any): number {
  const degrees = coord.description;
  const direction = ref?.value?.[0];
  const decimal = parseFloat(degrees);
  return (direction === 'S' || direction === 'W') ? -decimal : decimal;
}

// ═══════════════════════════════════════════════════════════════
// QR CODE / BARCODE EXTRACTION
// ═══════════════════════════════════════════════════════════════

interface QRCodeResult {
  type: 'VERIFICATION_URL' | 'CERTIFICATE_DATA' | 'REFERENCE_CODE' | 'UNKNOWN';
  rawContent: string;
  provider?: 'GAS_SAFE' | 'GAS_TAG' | 'NICEIC' | 'CORGI' | 'VERIFORCE' | 'GENERIC';
  parsed?: {
    verificationUrl?: string;
    certificateRef?: string;
    engineerId?: string;
    gasSafeId?: string;
    inspectionDate?: string;
    propertyRef?: string;
    uprn?: string;
  };
  canBypassOCR: boolean;
}

async function extractQRCodes(buffer: Buffer): Promise<QRCodeResult[]> {
  try {
    const reader = await Dynamsoft.BarcodeReader.createInstance();
    const results = await reader.decode(buffer);
    
    return results.map(result => parseQRContent(result.barcodeText));
  } catch (error) {
    console.warn('QR extraction failed:', error);
    return [];
  }
}

function parseQRContent(content: string): QRCodeResult {
  // Gas Safe Register verification URL
  if (content.includes('gassaferegister.co.uk')) {
    const licenceMatch = content.match(/\/check\/(\d{7})/);
    return {
      type: 'VERIFICATION_URL',
      rawContent: content,
      provider: 'GAS_SAFE',
      parsed: {
        verificationUrl: content,
        gasSafeId: licenceMatch?.[1],
      },
      canBypassOCR: !!licenceMatch, // Can verify engineer without OCR
    };
  }
  
  // Gas Tag / X Tag (has API access)
  if (content.includes('gastag.co.uk') || content.includes('xtag.co.uk')) {
    return {
      type: 'VERIFICATION_URL',
      rawContent: content,
      provider: 'GAS_TAG',
      parsed: {
        verificationUrl: content,
      },
      canBypassOCR: true, // Gas Tag has API - can fetch full certificate data!
    };
  }
  
  // NICEIC verification
  if (content.includes('niceic.com')) {
    const refMatch = content.match(/certificate\/([A-Z0-9]+)/i);
    return {
      type: 'VERIFICATION_URL',
      rawContent: content,
      provider: 'NICEIC',
      parsed: {
        verificationUrl: content,
        certificateRef: refMatch?.[1],
      },
      canBypassOCR: !!refMatch,
    };
  }
  
  // JSON-encoded certificate data (modern contractor apps)
  if (isValidJSON(content)) {
    try {
      const data = JSON.parse(content);
      return {
        type: 'CERTIFICATE_DATA',
        rawContent: content,
        provider: detectProviderFromJSON(data),
        parsed: {
          certificateRef: data.certificateRef || data.cert_id || data.reference,
          engineerId: data.engineerId || data.eng_id || data.engineer,
          gasSafeId: data.gasSafeId || data.gas_safe_id,
          inspectionDate: data.date || data.inspection_date || data.inspectionDate,
          propertyRef: data.propertyRef || data.property_id,
          uprn: data.uprn,
        },
        canBypassOCR: true, // Full data available!
      };
    } catch {
      // Fall through to unknown
    }
  }
  
  // Generic URL
  if (content.startsWith('http://') || content.startsWith('https://')) {
    return {
      type: 'VERIFICATION_URL',
      rawContent: content,
      provider: 'GENERIC',
      parsed: {
        verificationUrl: content,
      },
      canBypassOCR: false, // Unknown URL - still need OCR
    };
  }
  
  // Reference code pattern (alphanumeric)
  const refPattern = /^[A-Z0-9]{6,20}$/i;
  if (refPattern.test(content.trim())) {
    return {
      type: 'REFERENCE_CODE',
      rawContent: content,
      parsed: {
        certificateRef: content.trim(),
      },
      canBypassOCR: false, // Reference only - need OCR for other fields
    };
  }
  
  return {
    type: 'UNKNOWN',
    rawContent: content,
    canBypassOCR: false,
  };
}

function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function detectProviderFromJSON(data: any): QRCodeResult['provider'] {
  if (data.provider) return data.provider.toUpperCase();
  if (data.gastag || data.gas_tag) return 'GAS_TAG';
  if (data.veriforce) return 'VERIFORCE';
  return 'GENERIC';
}

// ═══════════════════════════════════════════════════════════════
// VISUAL PATTERN DETECTION (Logo, Signature, Checkboxes)
// ═══════════════════════════════════════════════════════════════

interface VisualAnalysis {
  detectedLogos: DetectedLogo[];
  hasSignature: boolean;
  hasStamp: boolean;
  checkboxes: CheckboxResult[];
  suggestedCertificateType?: string;
}

interface DetectedLogo {
  name: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface CheckboxResult {
  label?: string;
  isChecked: boolean;
  confidence: number;
}

// Pre-loaded logo templates for common certification bodies
const LOGO_TEMPLATES = [
  { name: 'Gas Safe Register', pattern: 'gas_safe_logo.png', certType: 'GAS' },
  { name: 'NICEIC', pattern: 'niceic_logo.png', certType: 'EICR' },
  { name: 'NAPIT', pattern: 'napit_logo.png', certType: 'EICR' },
  { name: 'ELECSA', pattern: 'elecsa_logo.png', certType: 'EICR' },
  { name: 'OFTEC', pattern: 'oftec_logo.png', certType: 'OIL' },
  { name: 'HETAS', pattern: 'hetas_logo.png', certType: 'SOLID' },
  { name: 'BAFE', pattern: 'bafe_logo.png', certType: 'FRA' },
  { name: 'MCS', pattern: 'mcs_logo.png', certType: 'RENEW' },
];

async function analyseVisualElements(buffer: Buffer): Promise<VisualAnalysis> {
  // This would use OpenCV.js or TensorFlow.js for pattern matching
  // Simplified implementation shown here
  
  const detectedLogos: DetectedLogo[] = [];
  
  // Logo detection via template matching
  for (const template of LOGO_TEMPLATES) {
    const match = await matchLogoTemplate(buffer, template.pattern);
    if (match.confidence > 0.7) {
      detectedLogos.push({
        name: template.name,
        confidence: match.confidence,
        boundingBox: match.boundingBox,
      });
    }
  }
  
  // Signature detection (look for ink-like patterns in expected regions)
  const hasSignature = await detectSignaturePattern(buffer);
  
  // Stamp/seal detection
  const hasStamp = await detectStampPattern(buffer);
  
  // Checkbox detection and state
  const checkboxes = await detectCheckboxes(buffer);
  
  // Suggest certificate type based on detected logo
  const primaryLogo = detectedLogos.sort((a, b) => b.confidence - a.confidence)[0];
  const suggestedCertificateType = primaryLogo 
    ? LOGO_TEMPLATES.find(t => t.name === primaryLogo.name)?.certType 
    : undefined;
  
  return {
    detectedLogos,
    hasSignature,
    hasStamp,
    checkboxes,
    suggestedCertificateType,
  };
}

// Placeholder implementations - would use actual CV libraries
async function matchLogoTemplate(buffer: Buffer, templatePath: string): Promise<{ confidence: number; boundingBox: any }> {
  // OpenCV template matching implementation
  return { confidence: 0, boundingBox: null };
}

async function detectSignaturePattern(buffer: Buffer): Promise<boolean> {
  // Look for ink-like strokes in signature region
  return false;
}

async function detectStampPattern(buffer: Buffer): Promise<boolean> {
  // Look for circular/rectangular stamp patterns
  return false;
}

async function detectCheckboxes(buffer: Buffer): Promise<CheckboxResult[]> {
  // Detect checkbox shapes and determine if filled
  return [];
}

// ═══════════════════════════════════════════════════════════════
// TIER 0.5 ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

interface Tier05Result {
  metadata: ImageMetadata;
  qrCodes: QRCodeResult[];
  visualAnalysis: VisualAnalysis;
  canBypassOCR: boolean;
  extractedData?: Partial<ComplianceData>;
  hints: ExtractionHints;
}

interface ExtractionHints {
  suggestedCertificateType?: string;
  possibleDate?: Date;
  possibleLocation?: { lat: number; lng: number };
  engineerId?: string;
  certificateRef?: string;
  verificationUrl?: string;
}

async function executeTier05(buffer: Buffer): Promise<Tier05Result> {
  // Run all extractions in parallel (they're all fast and free)
  const [metadata, qrCodes, visualAnalysis] = await Promise.all([
    extractImageMetadata(buffer),
    extractQRCodes(buffer),
    analyseVisualElements(buffer),
  ]);
  
  // Check if any QR code can bypass OCR
  const bypassQR = qrCodes.find(qr => qr.canBypassOCR);
  
  // Compile hints for OCR if needed
  const hints: ExtractionHints = {
    suggestedCertificateType: visualAnalysis.suggestedCertificateType,
    possibleDate: metadata.dateTaken,
    possibleLocation: metadata.gpsCoordinates,
    engineerId: bypassQR?.parsed?.engineerId || bypassQR?.parsed?.gasSafeId,
    certificateRef: bypassQR?.parsed?.certificateRef,
    verificationUrl: bypassQR?.parsed?.verificationUrl,
  };
  
  // If we can bypass OCR, extract as much data as possible
  let extractedData: Partial<ComplianceData> | undefined;
  
  if (bypassQR) {
    extractedData = {
      certificateType: visualAnalysis.suggestedCertificateType,
      certificateRef: bypassQR.parsed?.certificateRef,
      engineerId: bypassQR.parsed?.engineerId,
      gasSafeId: bypassQR.parsed?.gasSafeId,
      inspectionDate: bypassQR.parsed?.inspectionDate 
        ? new Date(bypassQR.parsed.inspectionDate) 
        : metadata.dateTaken,
      propertyRef: bypassQR.parsed?.propertyRef,
      uprn: bypassQR.parsed?.uprn,
      verificationUrl: bypassQR.parsed?.verificationUrl,
      extractionMethod: 'QR_CODE',
    };
    
    // If Gas Tag, we can fetch complete data via their API
    if (bypassQR.provider === 'GAS_TAG' && bypassQR.parsed?.verificationUrl) {
      try {
        const gasTagData = await fetchGasTagCertificate(bypassQR.parsed.verificationUrl);
        extractedData = { ...extractedData, ...gasTagData };
      } catch (error) {
        console.warn('Gas Tag API fetch failed:', error);
      }
    }
  }
  
  return {
    metadata,
    qrCodes,
    visualAnalysis,
    canBypassOCR: !!bypassQR && !!extractedData,
    extractedData,
    hints,
  };
}

// Gas Tag has exclusive API access - if they're the provider, we can get full data
async function fetchGasTagCertificate(verificationUrl: string): Promise<Partial<ComplianceData>> {
  // This would require Gas Tag API credentials
  // Returns complete certificate data including:
  // - Property address, UPRN
  // - All appliances inspected
  // - Defects and outcomes (ID/AR/NCS)
  // - Engineer details with Gas Safe verification
  // - Next service due date
  
  // Placeholder - would call Gas Tag API
  throw new Error('Gas Tag API integration not implemented');
}
```

#### TIER 0.5 Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIER 0.5: QR & Metadata Extraction                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Image/Scanned PDF                                                         │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              Run in parallel (all FREE):                            │   │
│  │  • Extract EXIF metadata (date, GPS, software)                      │   │
│  │  • Scan for QR codes / barcodes                                     │   │
│  │  • Detect logos (Gas Safe, NICEIC, etc.)                           │   │
│  │  • Check for signatures / stamps                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              QR Code Analysis                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ├─── Gas Tag/X Tag URL found?                                      │
│         │         │                                                         │
│         │         YES ──► Fetch from Gas Tag API ──► DONE ✅ (FREE!)       │
│         │                                                                   │
│         ├─── Gas Safe verification URL found?                              │
│         │         │                                                         │
│         │         YES ──► Extract licence number ──► Partial data          │
│         │                 (still need OCR for address, appliances)         │
│         │                                                                   │
│         ├─── JSON certificate data in QR?                                  │
│         │         │                                                         │
│         │         YES ──► Parse JSON ──► DONE ✅ (FREE!)                   │
│         │                                                                   │
│         ├─── Certificate reference code found?                             │
│         │         │                                                         │
│         │         YES ──► Store as hint for OCR                            │
│         │                                                                   │
│         └─── No useful QR data                                             │
│                   │                                                         │
│                   ▼                                                         │
│         Continue to TIER 2 (Azure DI) with hints                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

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

Images now go through TIER 0.5 (QR & Metadata) before expensive OCR.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   IMAGE PROCESSING PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Supported formats:                                                        │
│  • JPEG (.jpg, .jpeg)                                                      │
│  • PNG (.png)                                                              │
│  • TIFF (.tif, .tiff)                                                      │
│  • WebP (.webp)                                                            │
│  • HEIC (.heic) - requires conversion                                      │
│  • BMP (.bmp)                                                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 1: Pre-processing (if needed)                                    │ │
│  │ • Convert HEIC to JPEG                                                │ │
│  │ • Resize if >20MB (Azure DI limit)                                    │ │
│  │ • Optional: Deskew, enhance contrast                                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 2: TIER 0.5 - QR & Metadata Extraction (FREE)                    │ │
│  │ • Extract EXIF metadata (date, GPS, software)                         │ │
│  │ • Scan for QR codes / barcodes                                        │ │
│  │ • Detect certification logos                                          │ │
│  │ • Check for signatures                                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│              ┌───────────────┴───────────────┐                             │
│              ▼                               ▼                             │
│       QR Contains Data?                 No Useful QR                       │
│              │                               │                             │
│              ▼                               ▼                             │
│       ┌──────────────┐              ┌──────────────┐                       │
│       │ Gas Tag URL? │              │   TIER 2:    │                       │
│       │ JSON Data?   │              │  Azure DI    │                       │
│       └──────┬───────┘              │  (£0.0015)   │                       │
│              │                       └──────┬───────┘                       │
│        YES   │                              │                              │
│              ▼                              ▼                              │
│       DONE ✅ (FREE!)               Confidence ≥ 0.8?                      │
│                                             │                              │
│                              ┌──────────────┴──────────────┐               │
│                              ▼                             ▼               │
│                            YES                            NO               │
│                              │                             │               │
│                              ▼                             ▼               │
│                       DONE ✅                       ┌──────────────┐       │
│                                                     │   TIER 3:    │       │
│                                                     │ Claude Vision│       │
│                                                     │  (£0.01)     │       │
│                                                     └──────┬───────┘       │
│                                                            │               │
│                                                            ▼               │
│                                                   Confidence ≥ 0.7?        │
│                                                            │               │
│                                             ┌──────────────┴──────────────┐│
│                                             ▼                             ▼│
│                                           YES                            NO│
│                                             │                             ││
│                                             ▼                             ▼│
│                                       DONE ✅                       TIER 4 │
│                                                                   (Manual) │
└─────────────────────────────────────────────────────────────────────────────┘
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
  const startTime = Date.now();
  
  // Preprocess
  const processed = await preprocessImage(file);
  
  // ═══════════════════════════════════════════════════════════════
  // TIER 0.5: QR & Metadata Extraction (FREE)
  // ═══════════════════════════════════════════════════════════════
  
  const tier05Result = await executeTier05(processed.buffer);
  
  // Check if QR code provided sufficient data
  if (tier05Result.canBypassOCR && tier05Result.extractedData) {
    // Validate extracted data meets minimum requirements
    const data = tier05Result.extractedData;
    const hasRequiredFields = data.certificateRef || data.gasSafeId || data.engineerId;
    
    if (hasRequiredFields) {
      return {
        tier: 0.5,
        data: tier05Result.extractedData,
        confidence: 0.95, // High confidence - data from source system
        cost: 0, // FREE!
        method: 'QR_CODE',
        qrProvider: tier05Result.qrCodes.find(q => q.canBypassOCR)?.provider,
        verificationUrl: tier05Result.hints.verificationUrl,
        processingTime: Date.now() - startTime,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TIER 2: Azure Document Intelligence (with hints from TIER 0.5)
  // ═══════════════════════════════════════════════════════════════
  
  const base64 = processed.buffer.toString('base64');
  
  try {
    const azureResult = await callAzureDocumentIntelligence(base64, processed.mimeType, {
      // Pass hints to improve extraction
      expectedCertificateType: tier05Result.hints.suggestedCertificateType,
      knownFields: {
        engineerId: tier05Result.hints.engineerId,
        certificateRef: tier05Result.hints.certificateRef,
        inspectionDate: tier05Result.hints.possibleDate,
      },
    });
    
    if (azureResult.confidence >= 0.80) {
      // Merge with any data from QR codes
      const mergedData = {
        ...tier05Result.extractedData,
        ...azureResult.data,
        verificationUrl: tier05Result.hints.verificationUrl,
      };
      
      return {
        tier: 2,
        data: mergedData,
        confidence: azureResult.confidence,
        cost: 0.0015,
        method: 'AZURE_DI',
        hints: tier05Result.hints,
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.error('Azure DI failed for image:', error);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TIER 3: Claude Vision (with all available context)
  // ═══════════════════════════════════════════════════════════════
  
  try {
    const claudeResult = await callClaudeVision(base64, processed.mimeType, {
      certificateTypeHint: tier05Result.hints.suggestedCertificateType,
      knownData: tier05Result.extractedData,
      detectedLogos: tier05Result.visualAnalysis.detectedLogos.map(l => l.name),
    });
    
    if (claudeResult.confidence >= 0.70) {
      const mergedData = {
        ...tier05Result.extractedData,
        ...claudeResult.data,
        verificationUrl: tier05Result.hints.verificationUrl,
      };
      
      return {
        tier: 3,
        data: mergedData,
        confidence: claudeResult.confidence,
        cost: 0.01,
        method: 'CLAUDE_VISION',
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.error('Claude Vision failed for image:', error);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TIER 4: Manual review required
  // ═══════════════════════════════════════════════════════════════
  
  return {
    tier: 4,
    data: tier05Result.extractedData || null, // Include any partial data
    confidence: 0,
    requiresManualReview: true,
    hints: tier05Result.hints, // Pass hints to manual reviewer
    visualAnalysis: tier05Result.visualAnalysis,
    processingTime: Date.now() - startTime,
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

### Per-Document Costs by Format and Tier

| Format | TIER 0.5 (QR) | TIER 1 | TIER 1.5 | TIER 2 | TIER 3 | TIER 4 |
|--------|---------------|--------|----------|--------|--------|--------|
| Native PDF | N/A | £0 | £0.003 | £0.0015/pg | £0.01/pg | ~£5 |
| Scanned PDF | £0 ✨ | N/A | N/A | £0.0015/pg | £0.01/pg | ~£5 |
| DOCX | N/A | £0 | £0.003 | N/A | N/A | ~£5 |
| XLSX | N/A | £0 | £0.003 | N/A | N/A | ~£5 |
| CSV | N/A | £0 | £0.003 | N/A | N/A | ~£5 |
| HTML | N/A | £0 | £0.003 | N/A | N/A | ~£5 |
| Images | £0 ✨ | N/A | N/A | £0.0015 | £0.01 | ~£5 |
| Email | N/A | £0 (body) | £0.003 | Per attachment | Per attachment | ~£5 |

✨ = **NEW: QR code extraction bypasses OCR entirely for FREE**

### TIER 0.5 QR Code Success Rates

Based on analysis of modern compliance certificates:

| Certificate Type | % with Scannable QR | QR Contains Full Data | Bypass Rate |
|------------------|---------------------|----------------------|-------------|
| Gas (CP12/LGSR) | 35% | 60% (Gas Tag users) | 21% |
| EICR | 20% | 30% | 6% |
| FRA | 15% | 20% | 3% |
| Other | 10% | 15% | 1.5% |
| **Weighted Avg** | **25%** | **40%** | **10%** |

**Key insight:** Gas Tag/X Tag certificates have particularly high bypass rates because Gas Tag has API access to Gas Safe Register data.

### Expected Distribution (Social Housing) - Updated with QR Savings

| Format | % of Uploads | Typical Path | Avg Cost |
|--------|--------------|--------------|----------|
| Native PDF | 55% | 80% T1, 15% T1.5, 5% T2 | £0.0006 |
| Scanned PDF | 20% | **10% T0.5**, 60% T2, 25% T3, 5% T4 | £0.0034 |
| DOCX | 10% | 90% T1, 10% T1.5 | £0.0003 |
| XLSX | 8% | 95% T1, 5% T1.5 | £0.0002 |
| Images | 5% | **20% T0.5**, 50% T2, 25% T3, 5% T4 | £0.0040 |
| Other | 2% | Mixed | £0.0030 |

### Blended Cost Calculation (with QR Savings)

```
Previous (without QR): £0.00148 per document

Updated Calculation:
- Scanned PDF: 0.20 × (0.10×0 + 0.60×0.0015 + 0.25×0.01 + 0.05×5) = £0.0034 (was £0.0040)
- Images: 0.05 × (0.20×0 + 0.50×0.0015 + 0.25×0.01 + 0.05×5) = £0.0040 (was £0.0050)

New Blended Cost = Σ (Format % × Avg Cost)

= (0.55 × 0.0006) + (0.20 × 0.0034) + (0.10 × 0.0003) 
  + (0.08 × 0.0002) + (0.05 × 0.0040) + (0.02 × 0.0030)

= 0.00033 + 0.00068 + 0.00003 + 0.000016 + 0.00020 + 0.00006

= £0.00132 per document

≈ £0.0013 per document (rounded)
```

### Cost Savings from QR Implementation

| Metric | Without QR | With QR | Savings |
|--------|-----------|---------|---------|
| Per document | £0.0015 | £0.0013 | **13%** |
| 10,000 docs/month | £15.00 | £13.00 | £2.00 |
| 50,000 docs/month | £75.00 | £65.00 | £10.00 |
| 100,000 docs/month | £150.00 | £130.00 | £20.00 |

**Note:** These savings are FREE to implement - just requires adding a barcode scanning library.

### Monthly Cost Projections (Updated)

| Documents/Month | AI Extraction | TIER 4 (4%) | Total |
|-----------------|---------------|-------------|-------|
| 1,000 | £1.30 | £200 | £201.30 |
| 5,000 | £6.50 | £1,000 | £1,006.50 |
| 10,000 | £13.00 | £2,000 | £2,013.00 |
| 50,000 | £65.00 | £10,000 | £10,065.00 |

*Note: TIER 4 rate reduced from 5% to 4% because QR codes help validate some documents that would otherwise fail*

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

### Phase 1.5: Visual Analysis - Non-OCR Extraction (NEW - HIGH ROI)

#### QR Code / Barcode Scanning
- [ ] Barcode/QR scanning library (Dynamsoft or jsQR)
- [ ] Gas Safe URL parsing
- [ ] Gas Tag verification URL detection
- [ ] NICEIC/NAPIT URL parsing
- [ ] JSON certificate data parsing
- [ ] Reference code extraction

#### EXIF/Metadata Extraction
- [ ] ExifReader integration
- [ ] Date extraction (DateTimeOriginal, CreateDate)
- [ ] GPS coordinate extraction
- [ ] Software/device detection
- [ ] Tampering detection (CreateDate vs ModifyDate)
- [ ] GPS validation against property location

#### Logo Detection
- [ ] OpenCV.js or TensorFlow.js setup
- [ ] Logo template library (Gas Safe, NICEIC, NAPIT, OFTEC, HETAS, BAFE, MCS, UKAS, SAFed, FDIS)
- [ ] Multi-scale template matching
- [ ] Expected region validation
- [ ] Certificate type inference from logos

#### Signature Detection
- [ ] Signature region identification
- [ ] Stroke pattern analysis
- [ ] Ink vs digital signature classification
- [ ] Stamp detection
- [ ] Initials detection

#### Checkbox/Tick Detection
- [ ] Rectangular contour detection
- [ ] Checkbox state analysis (checked/empty/crossed)
- [ ] Pass/Fail region mapping
- [ ] Overall outcome determination

#### Combined Visual Analysis
- [ ] Parallel execution of all methods
- [ ] GPS validation integration
- [ ] Document completeness scoring
- [ ] OCR bypass decision logic
- [ ] Confidence calculation

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
4. **QR Code Shortcut** - Extract data for FREE from modern certificates
5. **Graceful Degradation** - Escalate smoothly when needed
6. **Human Fallback** - Never lose documents to automation failures

**Key Design Principles:**

| Principle | Implementation |
|-----------|----------------|
| **Cheapest first** | TIER 0.5 (free) → TIER 1 (free) → TIER 2 (£0.0015) → TIER 3 (£0.01) |
| **QR before OCR** | Scan for QR codes before expensive image processing |
| **Format-aware** | Text formats skip OCR entirely |
| **Confidence-driven** | Only escalate when confidence < threshold |
| **Structure-preserving** | XLSX columns → fields directly |
| **Fail-safe** | Always route to TIER 4 if all else fails |

**QR Code Innovation:**

Modern compliance certificates increasingly include QR codes linking to verification systems. By scanning these BEFORE expensive OCR:

- **Gas Tag certificates:** Full data available via API (FREE)
- **Gas Safe verification URLs:** Extract licence numbers (FREE)
- **NICEIC certificates:** Verification links (FREE)
- **JSON-encoded data:** Complete certificate info (FREE)

This simple addition saves **~13% on processing costs** with zero API spend.

This architecture positions ComplianceAI to process **any document format** at scale while maintaining industry-leading cost efficiency.
