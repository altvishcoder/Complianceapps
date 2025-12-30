import * as pdfjs from 'pdfjs-dist';
import type { DocumentFormat, DocumentClassification, CertificateTypeCode } from './types';

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
    const data = new Uint8Array(buffer);
    const pdf = await pdfjs.getDocument({ data }).promise;
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

export function detectCertificateType(text: string): CertificateTypeCode {
  const upperText = text.toUpperCase();

  if (
    upperText.includes('LANDLORD GAS SAFETY') ||
    upperText.includes('GAS SAFETY RECORD') ||
    upperText.includes('CP12') ||
    upperText.includes('LGSR') ||
    (upperText.includes('GAS SAFE') && upperText.includes('APPLIANCE'))
  ) {
    return 'GAS';
  }

  if (
    upperText.includes('ELECTRICAL INSTALLATION CONDITION REPORT') ||
    upperText.includes('EICR') ||
    upperText.includes('PERIODIC INSPECTION') ||
    (upperText.includes('BS 7671') && upperText.includes('ELECTRICAL'))
  ) {
    return 'EICR';
  }

  if (
    upperText.includes('ENERGY PERFORMANCE CERTIFICATE') ||
    upperText.includes('EPC') ||
    upperText.includes('ENERGY EFFICIENCY RATING')
  ) {
    return 'EPC';
  }

  if (
    upperText.includes('FIRE RISK ASSESSMENT') ||
    upperText.includes('FRA') ||
    upperText.includes('PAS 79') ||
    upperText.includes('REGULATORY REFORM')
  ) {
    return 'FRA';
  }

  if (
    upperText.includes('PORTABLE APPLIANCE') ||
    upperText.includes('PAT TEST') ||
    upperText.includes('ELECTRICAL EQUIPMENT TEST')
  ) {
    return 'PAT';
  }

  if (
    upperText.includes('LEGIONELLA') ||
    upperText.includes('WATER HYGIENE') ||
    upperText.includes('L8')
  ) {
    return 'LEGIONELLA';
  }

  if (
    upperText.includes('ASBESTOS') ||
    upperText.includes('HSG264') ||
    upperText.includes('MANAGEMENT SURVEY')
  ) {
    return 'ASBESTOS';
  }

  if (
    upperText.includes('LIFT') ||
    upperText.includes('LOLER') ||
    upperText.includes('LIFTING EQUIPMENT')
  ) {
    return 'LIFT';
  }

  if (
    upperText.includes('EMERGENCY LIGHTING') ||
    upperText.includes('BS 5266')
  ) {
    return 'EMLT';
  }

  if (
    upperText.includes('FIRE ALARM') ||
    upperText.includes('BS 5839')
  ) {
    return 'FIRE_ALARM';
  }

  if (
    upperText.includes('SMOKE ALARM') ||
    upperText.includes('CO ALARM') ||
    upperText.includes('CARBON MONOXIDE')
  ) {
    return 'SMOKE_CO';
  }

  if (
    upperText.includes('FIRE DOOR') ||
    upperText.includes('DOOR INSPECTION')
  ) {
    return 'FIRE_DOOR';
  }

  if (
    upperText.includes('OIL TANK') ||
    upperText.includes('OFTEC')
  ) {
    return 'OIL_TANK';
  }

  if (
    upperText.includes('OIL') &&
    (upperText.includes('HEATING') || upperText.includes('BOILER'))
  ) {
    return 'OIL';
  }

  if (upperText.includes('LPG')) {
    return 'LPG';
  }

  if (
    upperText.includes('SOLID FUEL') ||
    upperText.includes('HETAS')
  ) {
    return 'SOLID';
  }

  if (
    upperText.includes('HEAT PUMP') ||
    upperText.includes('ASHP')
  ) {
    return 'ASHP';
  }

  if (upperText.includes('GROUND SOURCE')) {
    return 'GSHP';
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
    return analysePdf(buffer);
  }

  if (format === 'image') {
    return {
      format: 'image',
      classification: 'structured_certificate',
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

  return {
    format,
    classification: 'structured_certificate',
    detectedCertificateType: 'UNKNOWN',
    hasTextLayer: true,
    isScanned: false,
    isHybrid: false,
    textContent: null,
    pageCount: 1,
    textQuality: 0.5,
    avgCharsPerPage: 0,
  };
}
