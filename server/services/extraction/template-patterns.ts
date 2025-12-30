import type { CertificateTypeCode, ExtractedCertificateData, DefectRecord, ApplianceRecord } from './types';

export interface TemplateExtractionResult {
  success: boolean;
  data: Partial<ExtractedCertificateData>;
  confidence: number;
  matchedFields: number;
  totalExpectedFields: number;
}

interface ExtractorPattern {
  field: keyof ExtractedCertificateData | string;
  patterns: RegExp[];
  transform?: (match: string) => string;
  required?: boolean;
}

const DATE_PATTERNS = [
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
];

function normalizeDate(dateStr: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = dateStr.match(pattern);
    if (match) {
      let day: string, month: string, year: string;

      if (match[3]?.length === 4) {
        day = match[1].padStart(2, '0');
        month = match[2].padStart(2, '0');
        year = match[3];
      } else if (match[1]?.length === 4) {
        year = match[1];
        month = match[2].padStart(2, '0');
        day = match[3].padStart(2, '0');
      } else {
        const monthNames: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04',
          may: '05', jun: '06', jul: '07', aug: '08',
          sep: '09', oct: '10', nov: '11', dec: '12',
        };
        day = match[1].padStart(2, '0');
        month = monthNames[match[2].toLowerCase().substring(0, 3)] || '01';
        year = match[3];
      }

      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

const GAS_PATTERNS: ExtractorPattern[] = [
  {
    field: 'certificateNumber',
    patterns: [
      /certificate\s*(?:no|number|ref)?[:\s]*([A-Z0-9\-]+)/i,
      /ref(?:erence)?[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  {
    field: 'engineerRegistration',
    patterns: [
      /gas\s*safe\s*(?:reg(?:istration)?|id|no|number)?[:\s]*(\d{6,7})/i,
      /registration\s*(?:no|number)?[:\s]*(\d{6,7})/i,
    ],
    required: true,
  },
  {
    field: 'engineerName',
    patterns: [
      /engineer[:\s]*([A-Za-z\s]+?)(?:\s*gas|$|\n)/i,
      /technician[:\s]*([A-Za-z\s]+?)(?:\s*gas|$|\n)/i,
    ],
  },
  {
    field: 'inspectionDate',
    patterns: [
      /inspection\s*date[:\s]*([\d\/\-]+)/i,
      /date\s*of\s*inspection[:\s]*([\d\/\-]+)/i,
      /date[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
    required: true,
  },
  {
    field: 'expiryDate',
    patterns: [
      /expiry\s*date[:\s]*([\d\/\-]+)/i,
      /next\s*inspection\s*(?:due\s*)?(?:by\s*)?([\d\/\-]+)/i,
      /valid\s*until[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
  },
  {
    field: 'propertyAddress',
    patterns: [
      /property\s*address[:\s]*([^\n]+(?:\n[^\n]+)?)/i,
      /address[:\s]*([^\n]+(?:\n[^\n]+)?)/i,
    ],
  },
  {
    field: 'outcome',
    patterns: [
      /overall\s*(?:result|outcome)[:\s]*(satisfactory|unsatisfactory|pass|fail)/i,
      /certificate\s*(?:is\s*)?(satisfactory|unsatisfactory)/i,
    ],
    transform: (m: string) => {
      const upper = m.toUpperCase();
      if (upper.includes('UNSATISFACTORY') || upper.includes('FAIL')) return 'FAIL';
      if (upper.includes('SATISFACTORY') || upper.includes('PASS')) return 'PASS';
      return m;
    },
  },
];

const EICR_PATTERNS: ExtractorPattern[] = [
  {
    field: 'certificateNumber',
    patterns: [
      /certificate\s*(?:no|number|ref)?[:\s]*([A-Z0-9\-]+)/i,
      /report\s*(?:ref|reference|no|number)?[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  {
    field: 'engineerRegistration',
    patterns: [
      /niceic\s*(?:reg(?:istration)?|no|number)?[:\s]*(\d+)/i,
      /napit\s*(?:reg(?:istration)?|no|number)?[:\s]*(\d+)/i,
      /elecsa\s*(?:reg(?:istration)?|no|number)?[:\s]*(\d+)/i,
      /registration\s*(?:no|number)?[:\s]*(\d+)/i,
    ],
  },
  {
    field: 'engineerName',
    patterns: [
      /inspector[:\s]*([A-Za-z\s]+?)(?:\s*niceic|$|\n)/i,
      /electrician[:\s]*([A-Za-z\s]+?)(?:\s*reg|$|\n)/i,
    ],
  },
  {
    field: 'inspectionDate',
    patterns: [
      /inspection\s*date[:\s]*([\d\/\-]+)/i,
      /date\s*of\s*(?:inspection|report)[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
    required: true,
  },
  {
    field: 'expiryDate',
    patterns: [
      /next\s*inspection\s*(?:due\s*)?(?:by\s*)?([\d\/\-]+)/i,
      /recommend(?:ed)?\s*(?:re-?)?inspection[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
  },
  {
    field: 'outcome',
    patterns: [
      /overall\s*(?:condition|assessment)[:\s]*(satisfactory|unsatisfactory)/i,
      /the\s*installation\s*is[:\s]*(satisfactory|unsatisfactory)/i,
    ],
    transform: (m: string) => {
      return m.toUpperCase().includes('UNSATISFACTORY') ? 'UNSATISFACTORY' : 'SATISFACTORY';
    },
  },
];

const EPC_PATTERNS: ExtractorPattern[] = [
  {
    field: 'certificateNumber',
    patterns: [
      /certificate\s*(?:reference|number)[:\s]*([A-Z0-9\-]+)/i,
      /RRN[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  {
    field: 'inspectionDate',
    patterns: [
      /date\s*of\s*assessment[:\s]*([\d\/\-]+)/i,
      /assessment\s*date[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
  },
  {
    field: 'expiryDate',
    patterns: [
      /valid\s*until[:\s]*([\d\/\-]+)/i,
      /expiry\s*date[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
  },
  {
    field: 'outcome',
    patterns: [
      /energy\s*(?:efficiency\s*)?rating[:\s]*([A-G])/i,
      /current\s*rating[:\s]*([A-G])/i,
    ],
    transform: (m: string) => m.toUpperCase(),
  },
];

const FRA_PATTERNS: ExtractorPattern[] = [
  {
    field: 'certificateNumber',
    patterns: [
      /assessment\s*(?:ref|reference|number)[:\s]*([A-Z0-9\-]+)/i,
      /report\s*(?:ref|reference|number)[:\s]*([A-Z0-9\-]+)/i,
    ],
  },
  {
    field: 'inspectionDate',
    patterns: [
      /date\s*of\s*assessment[:\s]*([\d\/\-]+)/i,
      /assessment\s*date[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
    required: true,
  },
  {
    field: 'expiryDate',
    patterns: [
      /review\s*date[:\s]*([\d\/\-]+)/i,
      /next\s*review[:\s]*([\d\/\-]+)/i,
    ],
    transform: normalizeDate as (m: string) => string,
  },
  {
    field: 'outcome',
    patterns: [
      /overall\s*risk\s*(?:rating|level)?[:\s]*(trivial|tolerable|moderate|substantial|intolerable)/i,
      /risk\s*rating[:\s]*(low|medium|high|very\s*high)/i,
    ],
    transform: (m: string) => m.toUpperCase(),
  },
];

const CERTIFICATE_PATTERNS: Partial<Record<CertificateTypeCode, ExtractorPattern[]>> = {
  GAS: GAS_PATTERNS,
  EICR: EICR_PATTERNS,
  EPC: EPC_PATTERNS,
  FRA: FRA_PATTERNS,
};

const DEFECT_CODE_PATTERNS: Record<string, RegExp[]> = {
  C1: [/\bC1\b/, /code\s*1\b/i, /danger\s*present/i],
  C2: [/\bC2\b/, /code\s*2\b/i, /potentially\s*dangerous/i],
  C3: [/\bC3\b/, /code\s*3\b/i, /improvement\s*recommended/i],
  FI: [/\bFI\b/, /further\s*investigation/i],
  AR: [/\bAR\b/, /at\s*risk/i],
  ID: [/\bID\b/, /immediately\s*dangerous/i],
  NCS: [/\bNCS\b/, /not\s*to\s*current\s*standard/i],
};

export function extractDefects(text: string): DefectRecord[] {
  const defects: DefectRecord[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    for (const [code, patterns] of Object.entries(DEFECT_CODE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          let priority: DefectRecord['priority'] = 'ADVISORY';
          if (code === 'C1' || code === 'ID') priority = 'IMMEDIATE';
          else if (code === 'C2' || code === 'AR') priority = 'URGENT';
          else if (code === 'FI') priority = 'URGENT';

          defects.push({
            code,
            description: line.trim(),
            location: null,
            priority,
            remedialAction: null,
          });
          break;
        }
      }
    }
  }

  return defects;
}

export function extractAppliances(text: string, certType: CertificateTypeCode): ApplianceRecord[] {
  const appliances: ApplianceRecord[] = [];

  if (certType === 'GAS') {
    const appliancePattern = /appliance\s*\d*[:\s]*([^\n]+)/gi;
    let match;
    while ((match = appliancePattern.exec(text)) !== null) {
      const applianceText = match[1];
      const outcomeMatch = applianceText.match(/\b(pass|fail|satisfactory|unsatisfactory)\b/i);

      appliances.push({
        type: 'Gas Appliance',
        make: null,
        model: null,
        serialNumber: null,
        location: null,
        outcome: outcomeMatch
          ? outcomeMatch[1].toUpperCase().includes('PASS') || outcomeMatch[1].toUpperCase().includes('SATISFACTORY')
            ? 'PASS'
            : 'FAIL'
          : null,
        defects: [],
      });
    }
  }

  return appliances;
}

export function extractWithTemplate(
  text: string,
  certType: CertificateTypeCode
): TemplateExtractionResult {
  const patterns = CERTIFICATE_PATTERNS[certType];

  if (!patterns) {
    return {
      success: false,
      data: { certificateType: certType },
      confidence: 0,
      matchedFields: 0,
      totalExpectedFields: 0,
    };
  }

  const data: Partial<ExtractedCertificateData> = {
    certificateType: certType,
    appliances: [],
    defects: [],
    additionalFields: {},
  };

  let matchedFields = 0;
  let requiredFieldsMissing = 0;
  const totalExpectedFields = patterns.length;

  for (const extractor of patterns) {
    for (const pattern of extractor.patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let value = match[1].trim();
        if (extractor.transform) {
          const transformed = extractor.transform(value);
          if (transformed) value = transformed;
        }
        (data as Record<string, unknown>)[extractor.field] = value;
        matchedFields++;
        break;
      }
    }

    if (extractor.required && !(data as Record<string, unknown>)[extractor.field]) {
      requiredFieldsMissing++;
    }
  }

  data.defects = extractDefects(text);
  data.appliances = extractAppliances(text, certType);

  let confidence = matchedFields / totalExpectedFields;
  if (requiredFieldsMissing > 0) {
    confidence *= 0.5;
  }
  if (data.defects && data.defects.length > 0) {
    confidence = Math.min(confidence + 0.1, 1);
  }

  return {
    success: matchedFields >= 2,
    data,
    confidence,
    matchedFields,
    totalExpectedFields,
  };
}
