import type { DocumentFormat, DocumentClassification, CertificateTypeCode } from './types';
import { detectCertificateTypeFromPatterns, detectCertificateTypeDB } from './pattern-detector';
import { logger } from '../../logger';

let pdfjs: any = null;
async function getPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjs;
}

export interface FormatAnalysis {
  format: DocumentFormat;
  classification: DocumentClassification;
  detectedCertificateType: CertificateTypeCode;
  hasTextLayer: boolean;
  isScanned: boolean;
  isHybrid: boolean;
  textContent: string | null;
  pageCount: number;
  textQuality: number;
  avgCharsPerPage: number;
}

const MIME_TO_FORMAT: Record<string, DocumentFormat> = {
  'application/pdf': 'pdf-native',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/plain': 'txt',
  'message/rfc822': 'email',
  'application/vnd.ms-outlook': 'email',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/tiff': 'image',
  'image/heic': 'image',
  'image/webp': 'image',
};

export function detectFormatFromMime(mimeType: string): DocumentFormat {
  return MIME_TO_FORMAT[mimeType] || 'pdf-native';
}

export function detectFormatFromExtension(filename: string): DocumentFormat {
  const ext = filename.toLowerCase().split('.').pop();
  const extMap: Record<string, DocumentFormat> = {
    'pdf': 'pdf-native',
    'docx': 'docx',
    'doc': 'docx',
    'xlsx': 'xlsx',
    'xls': 'xlsx',
    'csv': 'csv',
    'html': 'html',
    'htm': 'html',
    'txt': 'txt',
    'eml': 'email',
    'msg': 'email',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'tiff': 'image',
    'tif': 'image',
    'heic': 'image',
    'webp': 'image',
  };
  return extMap[ext || ''] || 'pdf-native';
}

export async function analysePdf(buffer: Buffer): Promise<FormatAnalysis> {
  let textContent = '';
  let pageCount = 1;

  try {
    const pdfjsLib = await getPdfjs();
    const data = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      textContent += pageText + '\n';
    }
  } catch (error) {
    return {
      format: 'pdf-scanned',
      classification: 'unknown',
      detectedCertificateType: 'UNKNOWN',
      hasTextLayer: false,
      isScanned: true,
      isHybrid: false,
      textContent: null,
      pageCount: 1,
      textQuality: 0,
      avgCharsPerPage: 0,
    };
  }

  const avgCharsPerPage = textContent.length / pageCount;
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length;
  const textQuality = Math.min(1, (avgCharsPerPage / 500) * (wordCount / (pageCount * 50)));

  const isScanned = avgCharsPerPage < 50 || textQuality < 0.1;
  const hasTextLayer = textContent.length > 100;
  const isHybrid = avgCharsPerPage >= 50 && avgCharsPerPage <= 100;

  let format: DocumentFormat = 'pdf-native';
  if (isScanned) format = 'pdf-scanned';
  else if (isHybrid) format = 'pdf-hybrid';

  const detectedCertificateType = detectCertificateType(textContent);
  const classification = classifyDocument(textContent, detectedCertificateType);

  return {
    format,
    classification,
    detectedCertificateType,
    hasTextLayer,
    isScanned,
    isHybrid,
    textContent: textContent.trim() || null,
    pageCount,
    textQuality,
    avgCharsPerPage,
  };
}

export async function analysePdfWithDatabasePatterns(
  buffer: Buffer,
  filename: string
): Promise<FormatAnalysis> {
  let textContent = '';
  let pageCount = 1;

  try {
    const pdfjsLib = await getPdfjs();
    const data = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      textContent += pageText + '\n';
    }
  } catch (error) {
    return {
      format: 'pdf-scanned',
      classification: 'unknown',
      detectedCertificateType: 'UNKNOWN',
      hasTextLayer: false,
      isScanned: true,
      isHybrid: false,
      textContent: null,
      pageCount: 1,
      textQuality: 0,
      avgCharsPerPage: 0,
    };
  }

  const avgCharsPerPage = textContent.length / pageCount;
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length;
  const textQuality = Math.min(1, (avgCharsPerPage / 500) * (wordCount / (pageCount * 50)));

  const isScanned = avgCharsPerPage < 50 || textQuality < 0.1;
  const hasTextLayer = textContent.length > 100;
  const isHybrid = avgCharsPerPage >= 50 && avgCharsPerPage <= 100;

  let format: DocumentFormat = 'pdf-native';
  if (isScanned) format = 'pdf-scanned';
  else if (isHybrid) format = 'pdf-hybrid';

  const dbResult = await detectCertificateTypeDB(filename, textContent);
  let detectedCertificateType: CertificateTypeCode;
  
  if (dbResult.source === 'database' && dbResult.certificateType !== 'UNKNOWN') {
    detectedCertificateType = dbResult.certificateType;
    logger.info({
      filename,
      certificateType: detectedCertificateType,
      confidence: dbResult.confidence,
      source: 'database_patterns',
    }, 'Certificate type detected from database patterns');
  } else {
    detectedCertificateType = detectCertificateType(textContent);
    logger.debug({
      filename,
      certificateType: detectedCertificateType,
      source: 'hardcoded_fallback',
    }, 'Certificate type detected from hardcoded patterns');
  }
  
  const classification = classifyDocument(textContent, detectedCertificateType);

  return {
    format,
    classification,
    detectedCertificateType,
    hasTextLayer,
    isScanned,
    isHybrid,
    textContent: textContent.trim() || null,
    pageCount,
    textQuality,
    avgCharsPerPage,
  };
}

export function detectCertificateTypeFromFilename(filename: string): CertificateTypeCode | null {
  const upperFilename = filename.toUpperCase();
  const normalizedFilename = upperFilename.replace(/[_\-\s\.]+/g, ' ');
  
  // Gas Safety - extensive pattern matching for UK variants
  if (upperFilename.includes('LGSR') || upperFilename.includes('CP12') || 
      upperFilename.includes('GAS_SAFETY') || upperFilename.includes('GAS-SAFETY') ||
      upperFilename.includes('GASSAFETY') || upperFilename.includes('GAS SAFETY') ||
      normalizedFilename.includes('LANDLORD GAS') || normalizedFilename.includes('GAS CERT') ||
      normalizedFilename.includes('GAS RECORD') || normalizedFilename.includes('GSR') ||
      normalizedFilename.includes('GAS SAFE') || normalizedFilename.includes('GASCERT') ||
      upperFilename.includes('BOILER_CERT') || upperFilename.includes('BOILER-CERT') ||
      normalizedFilename.includes('ANNUAL GAS') || normalizedFilename.includes('GAS CHECK')) {
    return 'GAS_SAFETY';
  }
  
  // EICR / Electrical - comprehensive pattern matching
  if (upperFilename.includes('EICR') || normalizedFilename.includes('ELECTRICAL INSTALLATION') ||
      normalizedFilename.includes('ELECTRICAL CONDITION') || normalizedFilename.includes('PERIODIC INSPECTION') ||
      normalizedFilename.includes('PERIODIC TEST') || normalizedFilename.includes('PIR CERT') ||
      normalizedFilename.includes('ELEC CERT') || normalizedFilename.includes('ELECTRICAL CERT') ||
      normalizedFilename.includes('WIRING CERT') || normalizedFilename.includes('BS7671') ||
      normalizedFilename.includes('BS 7671') || normalizedFilename.includes('18TH EDITION') ||
      normalizedFilename.includes('ECIR') || normalizedFilename.includes('EIC REPORT')) {
    return 'EICR';
  }
  
  // EPC - Energy Performance
  if (upperFilename.includes('EPC') || normalizedFilename.includes('ENERGY PERFORMANCE') ||
      normalizedFilename.includes('ENERGY CERT') || normalizedFilename.includes('ENERGY RATING') ||
      normalizedFilename.includes('SAP CERT') || normalizedFilename.includes('SAP RATING')) {
    return 'EPC';
  }
  
  // Fire Risk Assessment - comprehensive variants
  if (upperFilename.includes('FRA') || upperFilename.includes('FIRE_RISK') || 
      upperFilename.includes('FIRE-RISK') || upperFilename.includes('FIRERISK') ||
      normalizedFilename.includes('FIRE RISK') || normalizedFilename.includes('FIRE SAFETY') ||
      normalizedFilename.includes('PAS79') || normalizedFilename.includes('PAS 79') ||
      normalizedFilename.includes('RRO') || normalizedFilename.includes('FIRE ASSESSMENT')) {
    return 'FRA';
  }
  
  // PAT Testing
  if (upperFilename.includes('PAT') || normalizedFilename.includes('PORTABLE APPLIANCE') ||
      normalizedFilename.includes('PAT TEST') || normalizedFilename.includes('PAT CERT')) {
    return 'PAT';
  }
  
  // Legionella / Water Safety - comprehensive
  if (upperFilename.includes('LEGIONELLA') || normalizedFilename.includes('LEGIONELLA') ||
      normalizedFilename.includes('WATER RISK') || normalizedFilename.includes('WATER HYGIENE') ||
      normalizedFilename.includes('L8 ASSESSMENT') || normalizedFilename.includes('L8 RISK') ||
      normalizedFilename.includes('WATER SAFETY') || normalizedFilename.includes('TMV CERT') ||
      normalizedFilename.includes('WATER TANK') || normalizedFilename.includes('COLD WATER')) {
    return 'LEGIONELLA';
  }
  
  // Asbestos
  if (upperFilename.includes('ASBESTOS') || normalizedFilename.includes('ASBESTOS') ||
      normalizedFilename.includes('ACM SURVEY') || normalizedFilename.includes('HSG264') ||
      normalizedFilename.includes('HSG 264') || normalizedFilename.includes('R&D SURVEY') ||
      normalizedFilename.includes('MANAGEMENT SURVEY')) {
    return 'ASBESTOS';
  }
  
  // Lift / LOLER
  if (upperFilename.includes('LOLER') || normalizedFilename.includes('LIFT CERT') ||
      normalizedFilename.includes('LIFT INSPECTION') || normalizedFilename.includes('LIFTING EQUIPMENT') ||
      normalizedFilename.includes('PASSENGER LIFT') || normalizedFilename.includes('STAIRLIFT') ||
      normalizedFilename.includes('THOROUGH EXAMINATION') || normalizedFilename.includes('LIFT EXAM')) {
    return 'LIFT';
  }
  
  // Emergency Lighting
  if (normalizedFilename.includes('EMERGENCY LIGHT') || normalizedFilename.includes('EMLT') ||
      normalizedFilename.includes('BS5266') || normalizedFilename.includes('BS 5266')) {
    return 'EMLT';
  }
  
  // Fire Alarm
  if (normalizedFilename.includes('FIRE ALARM') || normalizedFilename.includes('FIRE DETECTION') ||
      normalizedFilename.includes('BS5839') || normalizedFilename.includes('BS 5839') ||
      normalizedFilename.includes('SMOKE DETECTOR') || normalizedFilename.includes('SMOKE ALARM')) {
    return 'FIRE_ALARM';
  }
  
  // Fire Extinguisher
  if (normalizedFilename.includes('FIRE EXTINGUISHER') || normalizedFilename.includes('EXTINGUISHER CERT') ||
      normalizedFilename.includes('FIRE EXT') || normalizedFilename.includes('BAFE')) {
    return 'FIRE_EXT';
  }
  
  // Smoke and CO Detectors
  if (normalizedFilename.includes('SMOKE CO') || normalizedFilename.includes('CARBON MONOXIDE') ||
      normalizedFilename.includes('CO DETECTOR') || normalizedFilename.includes('CO ALARM')) {
    return 'SMOKE_CO';
  }
  
  // Structural
  if (normalizedFilename.includes('STRUCTURAL') || normalizedFilename.includes('STRUCT SURVEY') ||
      normalizedFilename.includes('BUILDING SURVEY')) {
    return 'STRUCT';
  }
  
  return null;
}

export function detectCertificateType(text: string): CertificateTypeCode {
  const upperText = text.toUpperCase();

  // Gas Safety - comprehensive UK patterns including Gas Safe Register references
  if (
    upperText.includes('LANDLORD GAS SAFETY') ||
    upperText.includes('GAS SAFETY RECORD') ||
    upperText.includes('CP12') ||
    upperText.includes('LGSR') ||
    upperText.includes('GAS SAFE REGISTER') ||
    upperText.includes('GAS INSTALLATION SAFETY') ||
    (upperText.includes('GAS SAFE') && upperText.includes('APPLIANCE')) ||
    (upperText.includes('GAS SAFE') && upperText.includes('CERTIFICATE')) ||
    (upperText.includes('BOILER') && upperText.includes('SERVICE') && upperText.includes('GAS')) ||
    upperText.includes('LANDLORDS GAS SAFETY')
  ) {
    return 'GAS_SAFETY';
  }

  // EICR / Electrical - comprehensive UK patterns
  if (
    upperText.includes('ELECTRICAL INSTALLATION CONDITION REPORT') ||
    upperText.includes('EICR') ||
    upperText.includes('PERIODIC INSPECTION') ||
    upperText.includes('PERIODIC TEST') ||
    upperText.includes('ELECTRICAL CONDITION REPORT') ||
    upperText.includes('18TH EDITION') ||
    upperText.includes('BS 7671') ||
    upperText.includes('BS7671') ||
    (upperText.includes('ELECTRICAL') && upperText.includes('INSTALLATION') && upperText.includes('REPORT')) ||
    (upperText.includes('ELECTRICAL') && upperText.includes('CONDITION') && upperText.includes('INSPECTION'))
  ) {
    return 'EICR';
  }

  // EPC - Energy Performance
  if (
    upperText.includes('ENERGY PERFORMANCE CERTIFICATE') ||
    upperText.includes('EPC') ||
    upperText.includes('ENERGY EFFICIENCY RATING') ||
    upperText.includes('SAP CALCULATION') ||
    (upperText.includes('ENERGY') && upperText.includes('RATING') && upperText.includes('PROPERTY'))
  ) {
    return 'EPC';
  }

  // Fire Risk Assessment - comprehensive including RRO references
  if (
    upperText.includes('FIRE RISK ASSESSMENT') ||
    upperText.includes('PAS 79') ||
    upperText.includes('PAS79') ||
    upperText.includes('REGULATORY REFORM') ||
    upperText.includes('RRO 2005') ||
    upperText.includes('FIRE SAFETY ORDER') ||
    (upperText.includes('FIRE') && upperText.includes('RISK') && upperText.includes('ASSESSMENT')) ||
    (upperText.includes('FIRE SAFETY') && upperText.includes('INSPECTION'))
  ) {
    return 'FRA';
  }

  // PAT Testing
  if (
    upperText.includes('PORTABLE APPLIANCE') ||
    upperText.includes('PAT TEST') ||
    upperText.includes('ELECTRICAL EQUIPMENT TEST') ||
    (upperText.includes('PAT') && upperText.includes('INSPECTION'))
  ) {
    return 'PAT';
  }

  // Legionella / Water Safety - comprehensive including L8 references
  if (
    upperText.includes('LEGIONELLA') ||
    upperText.includes('WATER HYGIENE') ||
    upperText.includes('L8 RISK') ||
    upperText.includes('L8 ASSESSMENT') ||
    upperText.includes('ACOP L8') ||
    upperText.includes('WATER RISK ASSESSMENT') ||
    upperText.includes('HSG274') ||
    (upperText.includes('WATER') && upperText.includes('SAFETY') && upperText.includes('ASSESSMENT')) ||
    (upperText.includes('WATER') && upperText.includes('RISK') && upperText.includes('CONTROL'))
  ) {
    return 'LEGIONELLA';
  }

  // Asbestos - comprehensive including survey types
  if (
    upperText.includes('ASBESTOS') ||
    upperText.includes('HSG264') ||
    upperText.includes('HSG 264') ||
    upperText.includes('MANAGEMENT SURVEY') ||
    upperText.includes('REFURBISHMENT SURVEY') ||
    upperText.includes('DEMOLITION SURVEY') ||
    upperText.includes('ACM SURVEY') ||
    upperText.includes('ASBESTOS CONTAINING MATERIAL')
  ) {
    return 'ASBESTOS';
  }

  // Lift / LOLER - thorough examination reports
  if (
    upperText.includes('LOLER') ||
    upperText.includes('THOROUGH EXAMINATION') ||
    upperText.includes('LIFTING EQUIPMENT') ||
    upperText.includes('PASSENGER LIFT') ||
    upperText.includes('STAIRLIFT') ||
    (upperText.includes('LIFT') && upperText.includes('INSPECTION')) ||
    (upperText.includes('LIFT') && upperText.includes('EXAMINATION'))
  ) {
    return 'LIFT';
  }

  // Emergency Lighting
  if (
    upperText.includes('EMERGENCY LIGHTING') ||
    upperText.includes('BS 5266') ||
    upperText.includes('BS5266') ||
    (upperText.includes('EMERGENCY') && upperText.includes('LIGHTING') && upperText.includes('TEST'))
  ) {
    return 'EMLT';
  }

  // Fire Alarm
  if (
    upperText.includes('FIRE ALARM') ||
    upperText.includes('FIRE DETECTION') ||
    upperText.includes('BS 5839') ||
    upperText.includes('BS5839') ||
    (upperText.includes('FIRE') && upperText.includes('ALARM') && upperText.includes('SYSTEM'))
  ) {
    return 'FIRE_ALARM';
  }

  // Smoke and CO Alarms
  if (
    upperText.includes('SMOKE ALARM') ||
    upperText.includes('SMOKE DETECTOR') ||
    upperText.includes('CO ALARM') ||
    upperText.includes('CO DETECTOR') ||
    upperText.includes('CARBON MONOXIDE') ||
    upperText.includes('SMOKE AND CARBON MONOXIDE')
  ) {
    return 'SMOKE_CO';
  }

  // Fire Door
  if (
    upperText.includes('FIRE DOOR') ||
    upperText.includes('DOOR INSPECTION') ||
    (upperText.includes('FIRE') && upperText.includes('DOOR') && upperText.includes('INSPECTION'))
  ) {
    return 'FIRE_DOOR';
  }

  // Oil Tank
  if (
    upperText.includes('OIL TANK') ||
    upperText.includes('OFTEC') ||
    (upperText.includes('OIL') && upperText.includes('STORAGE'))
  ) {
    return 'OIL_TANK';
  }

  // Oil Heating
  if (
    upperText.includes('OIL') &&
    (upperText.includes('HEATING') || upperText.includes('BOILER'))
  ) {
    return 'OIL';
  }

  // LPG
  if (upperText.includes('LPG') || upperText.includes('LIQUEFIED PETROLEUM')) {
    return 'LPG';
  }

  // Solid Fuel
  if (
    upperText.includes('SOLID FUEL') ||
    upperText.includes('HETAS')
  ) {
    return 'SOLID';
  }

  // Heat Pumps
  if (
    upperText.includes('HEAT PUMP') ||
    upperText.includes('ASHP') ||
    upperText.includes('AIR SOURCE')
  ) {
    return 'ASHP';
  }

  if (upperText.includes('GROUND SOURCE') || upperText.includes('GSHP')) {
    return 'GSHP';
  }

  // TMV - Thermostatic Mixing Valves
  if (upperText.includes('TMV') || upperText.includes('THERMOSTATIC MIXING')) {
    return 'TMV';
  }

  // Structural
  if (
    upperText.includes('STRUCTURAL') ||
    (upperText.includes('BUILDING') && upperText.includes('SURVEY'))
  ) {
    return 'STRUCT';
  }

  return 'UNKNOWN';
}

export function classifyDocument(text: string, certType: CertificateTypeCode): DocumentClassification {
  const upperText = text.toUpperCase();

  const structuredTypes: CertificateTypeCode[] = [
    'GAS', 'EICR', 'EPC', 'PAT', 'EMLT', 'FIRE_ALARM', 'SMOKE_CO'
  ];

  if (structuredTypes.includes(certType)) {
    return 'structured_certificate';
  }

  const complexTypes: CertificateTypeCode[] = [
    'FRA', 'ASBESTOS', 'LEGIONELLA'
  ];

  if (complexTypes.includes(certType)) {
    return 'complex_document';
  }

  const handwritingIndicators = [
    'HANDWRITTEN',
    'MANUSCRIPT',
    'SIGNATURE:',
  ];

  if (handwritingIndicators.some(ind => upperText.includes(ind))) {
    return 'handwritten_content';
  }

  return 'unknown';
}

export async function analyseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<FormatAnalysis> {
  let format = detectFormatFromMime(mimeType);

  if (format === 'pdf-native') {
    format = detectFormatFromExtension(filename);
  }

  if (format === 'pdf-native' || format === 'pdf-scanned' || format === 'pdf-hybrid') {
    return analysePdfWithDatabasePatterns(buffer, filename);
  }

  if (format === 'image') {
    const dbResult = await detectCertificateTypeDB(filename, null);
    let detectedType: CertificateTypeCode = 'UNKNOWN';
    
    if (dbResult.source === 'database' && dbResult.certificateType !== 'UNKNOWN') {
      detectedType = dbResult.certificateType;
    } else {
      const filenameType = detectCertificateTypeFromFilename(filename);
      if (filenameType) {
        detectedType = filenameType;
      }
    }
    
    return {
      format: 'image',
      classification: 'structured_certificate',
      detectedCertificateType: detectedType,
      hasTextLayer: false,
      isScanned: true,
      isHybrid: false,
      textContent: null,
      pageCount: 1,
      textQuality: 0,
      avgCharsPerPage: 0,
    };
  }

  const dbResult = await detectCertificateTypeDB(filename, null);
  let detectedType: CertificateTypeCode = 'UNKNOWN';
  
  if (dbResult.source === 'database' && dbResult.certificateType !== 'UNKNOWN') {
    detectedType = dbResult.certificateType;
  } else {
    const filenameType = detectCertificateTypeFromFilename(filename);
    if (filenameType) {
      detectedType = filenameType;
    }
  }

  return {
    format,
    classification: 'structured_certificate',
    detectedCertificateType: detectedType,
    hasTextLayer: true,
    isScanned: false,
    isHybrid: false,
    textContent: null,
    pageCount: 1,
    textQuality: 0.5,
    avgCharsPerPage: 0,
  };
}
