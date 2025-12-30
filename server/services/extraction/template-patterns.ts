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
  /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
];

function normalizeDate(dateStr: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = dateStr.match(pattern);
    if (match) {
      let day: string, month: string, year: string;

      if (match[3]?.length === 4) {
        day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase();
        const monthNames: Record<string, string> = {
          jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
          apr: '04', april: '04', may: '05', jun: '06', june: '06',
          jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
          oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
        };
        month = monthNames[monthStr.substring(0, 3)] || monthStr.padStart(2, '0');
        year = match[3];
      } else if (match[1]?.length === 4) {
        year = match[1];
        month = match[2].padStart(2, '0');
        day = match[3].padStart(2, '0');
      } else {
        continue;
      }

      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

function normalizeOutcome(m: string): string {
  const upper = m.toUpperCase().trim();
  if (upper.includes('UNSATISFACTORY') || upper.includes('FAIL') || upper === 'U') return 'FAIL';
  if (upper.includes('SATISFACTORY') || upper.includes('PASS') || upper === 'S') return 'PASS';
  if (upper.includes('INTOLERABLE') || upper.includes('SUBSTANTIAL')) return 'FAIL';
  if (upper.includes('TOLERABLE') || upper.includes('TRIVIAL') || upper.includes('MODERATE')) return 'PASS';
  return upper;
}

const COMMON_PATTERNS = {
  certificateNumber: [
    /certificate\s*(?:no|number|ref(?:erence)?)?[:\s]*([A-Z0-9][A-Z0-9\-\/]+)/i,
    /report\s*(?:no|number|ref(?:erence)?)?[:\s]*([A-Z0-9][A-Z0-9\-\/]+)/i,
    /ref(?:erence)?[:\s]*([A-Z0-9][A-Z0-9\-\/]+)/i,
    /job\s*(?:no|number|ref)?[:\s]*([A-Z0-9][A-Z0-9\-\/]+)/i,
  ],
  inspectionDate: [
    /(?:date\s*of\s*)?inspection\s*(?:date)?[:\s]*([\d\/\-\s\w]+)/i,
    /(?:date\s*of\s*)?(?:test|service|assessment|survey)\s*(?:date)?[:\s]*([\d\/\-\s\w]+)/i,
    /(?:carried\s*out|completed)\s*(?:on)?[:\s]*([\d\/\-\s\w]+)/i,
  ],
  expiryDate: [
    /(?:expiry|expires?)\s*(?:date)?[:\s]*([\d\/\-\s\w]+)/i,
    /(?:next\s*(?:inspection|test|service|review))\s*(?:due|by)?[:\s]*([\d\/\-\s\w]+)/i,
    /valid\s*until[:\s]*([\d\/\-\s\w]+)/i,
    /re-?(?:inspection|test)\s*(?:due|by)?[:\s]*([\d\/\-\s\w]+)/i,
  ],
  propertyAddress: [
    /(?:property|premises|installation|site)\s*address[:\s]*([^\n]+(?:\n[^\n]+){0,3})/i,
    /address[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
    /location[:\s]*([^\n]+)/i,
  ],
  engineerName: [
    /(?:engineer|technician|inspector|assessor|surveyor)[:\s]*([A-Za-z\s\-']+?)(?:\s*(?:reg|gas|niceic|$|\n))/i,
    /(?:carried\s*out\s*by|tested\s*by|inspected\s*by)[:\s]*([A-Za-z\s\-']+)/i,
  ],
  contractorName: [
    /(?:contractor|company|firm|organisation)[:\s]*([A-Za-z0-9\s\-&']+?)(?:\s*(?:reg|ltd|limited|$|\n))/i,
    /(?:trading\s*as|t\/a)[:\s]*([A-Za-z0-9\s\-&']+)/i,
  ],
};

const GAS_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  {
    field: 'engineerRegistration',
    patterns: [
      /gas\s*safe\s*(?:reg(?:istration)?|id|no|number)?[:\s]*(\d{5,7})/i,
      /gsn?[:\s]*(\d{5,7})/i,
      /(?:registration|licence)\s*(?:no|number)?[:\s]*(\d{5,7})/i,
    ],
    required: true,
  },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'contractorName', patterns: COMMON_PATTERNS.contractorName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  {
    field: 'outcome',
    patterns: [
      /overall\s*(?:result|outcome|assessment)[:\s]*(satisfactory|unsatisfactory|pass|fail)/i,
      /certificate\s*(?:is\s*)?(satisfactory|unsatisfactory)/i,
      /(?:all\s*)?appliances?\s*(?:are\s*)?(safe|unsafe)/i,
    ],
    transform: normalizeOutcome,
  },
];

const GAS_SVC_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  {
    field: 'engineerRegistration',
    patterns: [/gas\s*safe\s*(?:reg)?[:\s]*(\d{5,7})/i, /gsn?[:\s]*(\d{5,7})/i],
    required: true,
  },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/service\s*date[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*service\s*(?:due)?[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/service\s*(?:result|outcome)[:\s]*(completed|satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const OIL_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  {
    field: 'engineerRegistration',
    patterns: [
      /oftec\s*(?:reg(?:istration)?|no|number)?[:\s]*([A-Z]?\d{4,8})/i,
      /registration[:\s]*([A-Z]?\d{4,8})/i,
    ],
    required: true,
  },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:boiler|installation)\s*(?:is\s*)?(serviceable|safe|unsafe|defective)/i, /(?:result|outcome)[:\s]*(pass|fail|satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const OIL_TANK_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/oftec\s*(?:reg)?[:\s]*([A-Z]?\d{4,8})/i] },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/tank\s*(?:condition|status)[:\s]*(good|fair|poor|satisfactory|unsatisfactory)/i, /(?:result|outcome)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const LPG_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/gas\s*safe\s*(?:reg)?[:\s]*(\d{5,7})/i, /lpg\s*(?:reg)?[:\s]*(\d{5,7})/i], required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:result|outcome)[:\s]*(satisfactory|unsatisfactory|pass|fail)/i], transform: normalizeOutcome },
];

const SOLID_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  {
    field: 'engineerRegistration',
    patterns: [
      /hetas\s*(?:reg(?:istration)?|no|number)?[:\s]*([A-Z0-9\-]+)/i,
      /registration[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:stove|appliance|installation)\s*(?:is\s*)?(compliant|non-?compliant|satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const BIO_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/hetas\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /mcs\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:result|outcome)[:\s]*(pass|fail|satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const HVAC_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/f-?gas\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /refcom\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system|unit)\s*(?:is\s*)?(operational|serviceable|defective)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const ASHP_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/mcs\s*(?:reg(?:istration)?)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/commissioning\s*date[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:cop|efficiency)[:\s]*(\d+\.?\d*)/i, /(?:result)[:\s]*(pass|fail|compliant)/i], transform: normalizeOutcome },
];

const GSHP_PATTERNS: ExtractorPattern[] = [...ASHP_PATTERNS];

const MECH_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:equipment|system)\s*(?:is\s*)?(serviceable|operational|defective)/i], transform: normalizeOutcome },
];

const EICR_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  {
    field: 'engineerRegistration',
    patterns: [
      /niceic\s*(?:reg(?:istration)?|no|number)?[:\s]*([A-Z0-9\-]+)/i,
      /napit\s*(?:reg(?:istration)?|no|number)?[:\s]*([A-Z0-9\-]+)/i,
      /elecsa\s*(?:reg(?:istration)?|no|number)?[:\s]*([A-Z0-9\-]+)/i,
      /stroma\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i,
      /eca\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i,
      /registration\s*(?:no|number)?[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/recommended\s*(?:re-?)?inspection[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  {
    field: 'outcome',
    patterns: [
      /overall\s*(?:condition|assessment)[:\s]*(satisfactory|unsatisfactory)/i,
      /the\s*(?:electrical\s*)?installation\s*(?:is\s*)?(satisfactory|unsatisfactory)/i,
    ],
    transform: (m: string) => m.toUpperCase().includes('UNSATISFACTORY') ? 'UNSATISFACTORY' : 'SATISFACTORY',
  },
];

const EIC_PATTERNS: ExtractorPattern[] = [...EICR_PATTERNS];

const MEIWC_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/niceic\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /napit\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /elecsa\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/work\s*(?:is\s*)?(compliant|non-?compliant)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const PAT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: [/tested\s*by[:\s]*([A-Za-z\s\-']+)/i, ...COMMON_PATTERNS.engineerName] },
  { field: 'inspectionDate', patterns: [/test\s*date[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/re-?test\s*(?:due|by)?[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:items?\s*)?(?:passed|failed)[:\s]*(\d+)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const EMLT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/niceic\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /napit\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:annual\s*)?test\s*date[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:annual\s*)?test[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:duration|runtime)\s*test[:\s]*(pass|fail)/i, /(?:result)[:\s]*(pass|fail|satisfactory)/i], transform: normalizeOutcome },
];

const EMLT_M_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/monthly\s*test\s*date[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:all\s*)?lights?\s*(?:are\s*)?(working|operational|failed)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const ELEC_HEAT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: COMMON_PATTERNS.inspectionDate, transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: COMMON_PATTERNS.expiryDate, transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:heaters?|system)\s*(?:are?\s*)?(operational|serviceable|defective)/i], transform: normalizeOutcome },
];

const EPC_PATTERNS: ExtractorPattern[] = [
  {
    field: 'certificateNumber',
    patterns: [
      /certificate\s*reference[:\s]*([A-Z0-9\-]+)/i,
      /RRN[:\s]*([0-9\-]+)/i,
      /(?:EPC|energy)\s*(?:certificate\s*)?(?:ref|reference|number)[:\s]*([A-Z0-9\-]+)/i,
    ],
    required: true,
  },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?assessment[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any },
  { field: 'expiryDate', patterns: [/valid\s*until[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  {
    field: 'outcome',
    patterns: [
      /(?:energy\s*)?(?:efficiency\s*)?rating[:\s]*([A-G])\b/i,
      /current\s*(?:energy\s*)?rating[:\s]*([A-G])\b/i,
      /band[:\s]*([A-G])\b/i,
    ],
    transform: (m: string) => m.toUpperCase(),
  },
];

const DEC_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/DEC\s*(?:ref|reference|number)?[:\s]*([A-Z0-9\-]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?assessment[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'expiryDate', patterns: [/valid\s*until[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/operational\s*rating[:\s]*([A-G])/i, /(?:rating)[:\s]*([A-G])/i], transform: (m: string) => m.toUpperCase() },
];

const SAP_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/SAP\s*(?:ref|reference)?[:\s]*([A-Z0-9\-]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:assessment|calculation)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/SAP\s*(?:rating|score)[:\s]*(\d+)/i, /(?:rating)[:\s]*([A-G])/i], transform: (m: string) => m.toUpperCase() },
];

const FRA_PATTERNS: ExtractorPattern[] = [
  { 
    field: 'certificateNumber', 
    patterns: [
      /(?:assessment|report|case)\s*(?:ref|reference|number|id)?[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:building\s*safety\s*)?case\s*(?:ref|reference|id)?[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:bsc|fra)\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i,
      ...COMMON_PATTERNS.certificateNumber
    ] 
  },
  { 
    field: 'engineerName', 
    patterns: [
      /(?:fire\s*)?(?:risk\s*)?assessor[:\s]*([A-Za-z\s\-']+)/i,
      /(?:building\s*safety\s*)?(?:case\s*)?manager[:\s]*([A-Za-z\s\-']+)/i,
      /(?:responsible\s*)?person[:\s]*([A-Za-z\s\-']+)/i,
      /(?:competent\s*)?person[:\s]*([A-Za-z\s\-']+)/i,
      /(?:principal\s*)?accountable\s*person[:\s]*([A-Za-z\s\-']+)/i,
      ...COMMON_PATTERNS.engineerName
    ] 
  },
  { 
    field: 'inspectionDate', 
    patterns: [
      /(?:date\s*of\s*)?(?:assessment|survey|review)[:\s]*([\d\/\-\s\w]+)/i,
      /(?:assessment|case)\s*date[:\s]*([\d\/\-\s\w]+)/i,
      /(?:last\s*)?(?:updated|revised)[:\s]*([\d\/\-\s\w]+)/i,
      ...COMMON_PATTERNS.inspectionDate
    ], 
    transform: normalizeDate as any, 
    required: true 
  },
  { 
    field: 'expiryDate', 
    patterns: [
      /(?:next\s*)?review\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i,
      /(?:next\s*)?assessment\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i,
      /(?:valid|expires?)\s*(?:until|by)?[:\s]*([\d\/\-\s\w]+)/i,
      ...COMMON_PATTERNS.expiryDate
    ], 
    transform: normalizeDate as any 
  },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  {
    field: 'outcome',
    patterns: [
      /overall\s*(?:risk\s*)?(?:rating|level|category)?[:\s]*(trivial|tolerable|moderate|substantial|intolerable)/i,
      /(?:fire\s*)?risk\s*(?:rating|level|category)?[:\s]*(low|medium|high|very\s*high|critical)/i,
      /(?:building\s*)?safety\s*(?:rating|status|level)?[:\s]*(compliant|non-?compliant|satisfactory|unsatisfactory)/i,
      /(?:case\s*)?status[:\s]*(open|closed|in\s*progress|complete|pending)/i,
      /(?:risk\s*)?category[:\s]*(A|B|C|D|1|2|3|4)/i,
    ],
    transform: (m: string) => m.toUpperCase(),
  },
];

// Building Safety Case (BSA 2022) - for higher-risk buildings
const BUILDING_SAFETY_PATTERNS: ExtractorPattern[] = [
  { 
    field: 'certificateNumber', 
    patterns: [
      /(?:building\s*safety\s*)?case\s*(?:ref|reference|number|id)?[:\s]*([A-Z0-9\-\/]+)/i,
      /bsc\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:hrb|higher\s*risk)\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:safety\s*)?case\s*(?:report\s*)?(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i,
      ...COMMON_PATTERNS.certificateNumber
    ],
    required: true
  },
  { 
    field: 'engineerName', 
    patterns: [
      /(?:principal\s*)?accountable\s*person[:\s]*([A-Za-z\s\-']+)/i,
      /(?:building\s*safety\s*)?(?:case\s*)?manager[:\s]*([A-Za-z\s\-']+)/i,
      /(?:responsible\s*)?person[:\s]*([A-Za-z\s\-']+)/i,
      /(?:duty\s*)?holder[:\s]*([A-Za-z\s\-']+)/i,
      /(?:building\s*)?owner[:\s]*([A-Za-z\s\-']+)/i,
      ...COMMON_PATTERNS.engineerName
    ] 
  },
  { 
    field: 'inspectionDate', 
    patterns: [
      /(?:case\s*)?(?:creation|submitted|prepared)\s*(?:date)?[:\s]*([\d\/\-\s\w]+)/i,
      /(?:last\s*)?(?:updated|revised|reviewed)[:\s]*([\d\/\-\s\w]+)/i,
      /(?:date\s*of\s*)?(?:assessment|submission)[:\s]*([\d\/\-\s\w]+)/i,
      ...COMMON_PATTERNS.inspectionDate
    ], 
    transform: normalizeDate as any, 
    required: true 
  },
  { 
    field: 'expiryDate', 
    patterns: [
      /(?:next\s*)?review\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i,
      /(?:mandatory\s*)?occurrence\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i,
      /(?:registration\s*)?(?:renewal|expires?)[:\s]*([\d\/\-\s\w]+)/i,
      ...COMMON_PATTERNS.expiryDate
    ], 
    transform: normalizeDate as any 
  },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  {
    field: 'outcome',
    patterns: [
      /(?:case\s*)?status[:\s]*(registered|pending|in\s*review|complete|rejected)/i,
      /(?:building\s*)?safety\s*(?:status|rating)?[:\s]*(compliant|non-?compliant|adequate|inadequate)/i,
      /(?:risk\s*)?(?:rating|level|category)?[:\s]*(low|medium|high|critical|unacceptable)/i,
      /(?:hrb\s*)?registration\s*(?:status)?[:\s]*(active|inactive|pending|suspended)/i,
      /(?:overall\s*)?assessment[:\s]*(satisfactory|unsatisfactory|adequate|inadequate)/i,
    ],
    transform: normalizeOutcome,
  },
];

const FRAEW_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'engineerName', patterns: [/(?:external\s*wall\s*)?assessor[:\s]*([A-Za-z\s\-']+)/i, ...COMMON_PATTERNS.engineerName] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:assessment|appraisal)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/review\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:EWS1\s*)?(?:rating|grade)[:\s]*(A1|A2|A3|B1|B2)/i, /risk\s*(?:rating)?[:\s]*(low|medium|high)/i], transform: (m: string) => m.toUpperCase() },
];

const FA_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/bafe\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /fia\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:service|maintenance)[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:service|visit)[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.expiryDate], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:status|condition)[:\s]*(compliant|non-?compliant|serviceable)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const FA_Q_PATTERNS: ExtractorPattern[] = [...FA_PATTERNS];
const FA_W_PATTERNS: ExtractorPattern[] = [
  { field: 'inspectionDate', patterns: [/(?:weekly\s*)?test\s*date[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:call\s*point|zone)\s*tested[:\s]*(pass|fail|ok)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const FD_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: [/(?:fire\s*door\s*)?inspector[:\s]*([A-Za-z\s\-']+)/i, ...COMMON_PATTERNS.engineerName] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?inspection[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*inspection[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:door|installation)\s*(?:is\s*)?(compliant|non-?compliant|satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const FD_Q_PATTERNS: ExtractorPattern[] = [...FD_PATTERNS];

const AOV_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:test|service)[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:test|service)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:aov|vent)\s*(?:is\s*)?(operational|serviceable|defective)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const SPRINK_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/bafe\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /lpcb\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:service|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:service|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:status)[:\s]*(compliant|operational|defective)/i], transform: normalizeOutcome },
];

const DRY_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:test|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:test|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:pressure\s*)?test\s*(?:result)?[:\s]*(pass|fail)/i, /(?:riser\s*)?(?:status)[:\s]*(serviceable|defective)/i], transform: normalizeOutcome },
];

const WET_PATTERNS: ExtractorPattern[] = [...DRY_PATTERNS];

const CO_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:test|installation)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:expiry|replace\s*by)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:detector|alarm)\s*(?:is\s*)?(working|operational|defective)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const SD_PATTERNS: ExtractorPattern[] = [...CO_PATTERNS];

const EXT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/bafe\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:service|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:service|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:all\s*)?extinguishers?\s*(?:are\s*)?(serviceable|operational|defective)/i], transform: normalizeOutcome },
];

const COMPART_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'engineerName', patterns: [/(?:surveyor|inspector)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/review\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:compartmentation\s*)?(?:status)[:\s]*(compliant|non-?compliant|satisfactory)/i], transform: normalizeOutcome },
];

const SMOKE_V_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:test|service)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:test|service)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:status)[:\s]*(operational|serviceable|defective)/i], transform: normalizeOutcome },
];

const ASB_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:survey|report)\s*(?:ref|reference|number)?[:\s]*([A-Z0-9\-\/]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'engineerRegistration', patterns: [/ukas\s*(?:accreditation)?[:\s]*([A-Z0-9\-]+)/i, /p40[12]\s*(?:ref)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: [/(?:surveyor|analyst)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i, ...COMMON_PATTERNS.inspectionDate], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:next\s*)?(?:re-?)?(?:inspection|survey)\s*(?:due)?[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:acm|asbestos)\s*(?:identified|found)[:\s]*(yes|no)/i, /(?:material\s*)?assessment\s*score[:\s]*(\d+)/i], transform: normalizeOutcome },
];

const ASB_M_PATTERNS: ExtractorPattern[] = [...ASB_PATTERNS];
const ASB_D_PATTERNS: ExtractorPattern[] = [...ASB_PATTERNS];
const ASB_R_PATTERNS: ExtractorPattern[] = [...ASB_PATTERNS];
const ASB_REF_PATTERNS: ExtractorPattern[] = [...ASB_PATTERNS];

const LEG_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:assessment|report)\s*(?:ref|reference|number)?[:\s]*([A-Z0-9\-\/]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'engineerRegistration', patterns: [/(?:legionella\s*)?(?:control\s*)?association[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: [/(?:risk\s*)?assessor[:\s]*([A-Za-z\s\-']+)/i, ...COMMON_PATTERNS.engineerName] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:assessment|survey)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:next\s*)?review\s*(?:date|due)?[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:overall\s*)?risk\s*(?:rating|level)?[:\s]*(low|medium|high|negligible)/i], transform: (m: string) => m.toUpperCase() },
];

const LEG_M_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:monitoring|sample)\s*date[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:colony\s*count|cfu)[:\s]*(<?\d+)/i, /(?:result)[:\s]*(satisfactory|unsatisfactory)/i], transform: normalizeOutcome },
];

const TMV_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:service|check)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:service|check)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:tmv|valve)\s*(?:is\s*)?(operational|serviceable|defective)/i, /temperature[:\s]*(\d+)/i], transform: normalizeOutcome },
];

const TANK_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:inspection|clean)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:inspection|clean)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:tank\s*)?(?:condition)[:\s]*(good|fair|poor|clean)/i], transform: normalizeOutcome },
];

const WATER_PATTERNS: ExtractorPattern[] = [...LEG_PATTERNS];

const LIFT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:examination|report)\s*(?:ref|reference|number)?[:\s]*([A-Z0-9\-\/]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'engineerRegistration', patterns: [/safed\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /sae\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: [/(?:competent\s*person|examiner)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:examination|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:thorough\s*)?examination[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:lift\s*)?(?:is\s*)?(safe|unsafe|defects?\s*found)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const LIFT_M_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:monthly\s*)?(?:check|inspection)\s*date[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:lift\s*)?(?:status)[:\s]*(operational|serviceable|defective)/i], transform: normalizeOutcome },
];

const PLAT_PATTERNS: ExtractorPattern[] = [...LIFT_PATTERNS];
const HOIST_PATTERNS: ExtractorPattern[] = [...LIFT_PATTERNS];
const FALL_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:examination|test)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:examination|test)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:is\s*)?(compliant|non-?compliant|safe|unsafe)/i], transform: normalizeOutcome },
];

const ACCESS_PATTERNS: ExtractorPattern[] = [...FALL_PATTERNS];
const STAIR_PATTERNS: ExtractorPattern[] = [...LIFT_PATTERNS];

const STRUCT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:survey|report)\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i, ...COMMON_PATTERNS.certificateNumber], required: true },
  { field: 'engineerRegistration', patterns: [/rics\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /ice\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: [/(?:structural\s*)?(?:engineer|surveyor)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:survey|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:next\s*)?review[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:structural\s*)?condition[:\s]*(good|fair|poor|satisfactory)/i], transform: normalizeOutcome },
];

const ROOF_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: [/(?:surveyor|inspector)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:next\s*)?(?:inspection|survey)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:roof\s*)?condition[:\s]*(good|fair|poor|satisfactory)/i], transform: normalizeOutcome },
];

const DRAIN_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:drains?\s*)?condition[:\s]*(good|fair|poor|blocked)/i, /(?:result)[:\s]*(pass|fail)/i], transform: normalizeOutcome },
];

const CHIMNEY_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:sweep|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:sweep|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:chimney\s*)?(?:is\s*)?(clear|blocked|safe|unsafe)/i], transform: normalizeOutcome },
];

const HHSRS_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'engineerName', patterns: [/(?:eho|inspector)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:assessment|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:category\s*)?(\d)\s*hazards?/i, /(?:hazards?\s*)?(?:rating|score)[:\s]*(\d+)/i], transform: (m: string) => m.toUpperCase() },
];

const DAMP_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerName', patterns: [/(?:surveyor|specialist)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:damp|mould)\s*(?:found|present)[:\s]*(yes|no)/i, /(?:severity)[:\s]*(minor|moderate|severe)/i], transform: normalizeOutcome },
];

const LIGHT_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:test|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:test|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:is\s*)?(compliant|non-?compliant)/i], transform: normalizeOutcome },
];

const PEEP_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:peep|plan)\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:assessment|review)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/(?:next\s*)?review[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:plan\s*)?(?:status)[:\s]*(complete|incomplete|reviewed)/i], transform: normalizeOutcome },
];

const BEEP_PATTERNS: ExtractorPattern[] = [...PEEP_PATTERNS];

const SC_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: [/(?:safety\s*case|bsr)\s*(?:ref|reference)?[:\s]*([A-Z0-9\-\/]+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:submission|review)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:status)[:\s]*(compliant|non-?compliant|submitted|pending)/i], transform: normalizeOutcome },
];

const RES_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:review|publication)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:strategy\s*)?(?:status)[:\s]*(published|draft|reviewed)/i], transform: normalizeOutcome },
];

const SIB_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:check|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:check|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:sib|box)\s*(?:is\s*)?(complete|incomplete|accessible)/i], transform: normalizeOutcome },
];

const WAYFIND_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?inspection[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:signage\s*)?(?:is\s*)?(compliant|non-?compliant)/i], transform: normalizeOutcome },
];

const CCTV_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/nsi\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /ssaib\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: COMMON_PATTERNS.engineerName },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?(?:service|maintenance)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:service|maintenance)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:system\s*)?(?:is\s*)?(operational|serviceable|defective)/i], transform: normalizeOutcome },
];

const ALARM_PATTERNS: ExtractorPattern[] = [...CCTV_PATTERNS];
const ENTRY_PATTERNS: ExtractorPattern[] = [...CCTV_PATTERNS];

const PLAY_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber, required: true },
  { field: 'engineerRegistration', patterns: [/rpii\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i, /rospa\s*(?:reg)?[:\s]*([A-Z0-9\-]+)/i] },
  { field: 'engineerName', patterns: [/(?:inspector|examiner)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?inspection[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*inspection[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:overall\s*)?(?:risk)[:\s]*(low|medium|high|very\s*high)/i], transform: (m: string) => m.toUpperCase() },
];

const PLAY_Q_PATTERNS: ExtractorPattern[] = [...PLAY_PATTERNS];
const TREE_PATTERNS: ExtractorPattern[] = [
  { field: 'certificateNumber', patterns: COMMON_PATTERNS.certificateNumber },
  { field: 'engineerName', patterns: [/(?:arborist|surveyor)[:\s]*([A-Za-z\s\-']+)/i] },
  { field: 'inspectionDate', patterns: [/(?:date\s*of\s*)?survey[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any, required: true },
  { field: 'expiryDate', patterns: [/next\s*(?:survey|inspection)[:\s]*([\d\/\-\s\w]+)/i], transform: normalizeDate as any },
  { field: 'propertyAddress', patterns: COMMON_PATTERNS.propertyAddress },
  { field: 'outcome', patterns: [/(?:trees?\s*)?(?:condition)[:\s]*(good|fair|poor|dead)/i], transform: normalizeOutcome },
];

const CERTIFICATE_PATTERNS: Partial<Record<CertificateTypeCode, ExtractorPattern[]>> = {
  GAS: GAS_PATTERNS,
  GAS_SVC: GAS_SVC_PATTERNS,
  OIL: OIL_PATTERNS,
  OIL_TANK: OIL_TANK_PATTERNS,
  LPG: LPG_PATTERNS,
  SOLID: SOLID_PATTERNS,
  BIO: BIO_PATTERNS,
  HVAC: HVAC_PATTERNS,
  ASHP: ASHP_PATTERNS,
  GSHP: GSHP_PATTERNS,
  MECH: MECH_PATTERNS,
  EICR: EICR_PATTERNS,
  EIC: EIC_PATTERNS,
  MEIWC: MEIWC_PATTERNS,
  PAT: PAT_PATTERNS,
  EMLT: EMLT_PATTERNS,
  EMLT_M: EMLT_M_PATTERNS,
  ELEC_HEAT: ELEC_HEAT_PATTERNS,
  EPC: EPC_PATTERNS,
  DEC: DEC_PATTERNS,
  SAP: SAP_PATTERNS,
  FRA: FRA_PATTERNS,
  BSC: BUILDING_SAFETY_PATTERNS,
  BUILDING_SAFETY: BUILDING_SAFETY_PATTERNS,
  FRAEW: FRAEW_PATTERNS,
  FA: FA_PATTERNS,
  FA_Q: FA_Q_PATTERNS,
  FA_W: FA_W_PATTERNS,
  FD: FD_PATTERNS,
  FD_Q: FD_Q_PATTERNS,
  AOV: AOV_PATTERNS,
  SPRINK: SPRINK_PATTERNS,
  DRY: DRY_PATTERNS,
  WET: WET_PATTERNS,
  CO: CO_PATTERNS,
  SD: SD_PATTERNS,
  EXT: EXT_PATTERNS,
  COMPART: COMPART_PATTERNS,
  SMOKE_V: SMOKE_V_PATTERNS,
  ASB: ASB_PATTERNS,
  ASB_M: ASB_M_PATTERNS,
  ASB_D: ASB_D_PATTERNS,
  ASB_R: ASB_R_PATTERNS,
  ASB_REF: ASB_REF_PATTERNS,
  LEG: LEG_PATTERNS,
  LEG_M: LEG_M_PATTERNS,
  TMV: TMV_PATTERNS,
  TANK: TANK_PATTERNS,
  WATER: WATER_PATTERNS,
  LIFT: LIFT_PATTERNS,
  LIFT_M: LIFT_M_PATTERNS,
  PLAT: PLAT_PATTERNS,
  HOIST: HOIST_PATTERNS,
  FALL: FALL_PATTERNS,
  ACCESS: ACCESS_PATTERNS,
  STAIR: STAIR_PATTERNS,
  STRUCT: STRUCT_PATTERNS,
  ROOF: ROOF_PATTERNS,
  DRAIN: DRAIN_PATTERNS,
  CHIMNEY: CHIMNEY_PATTERNS,
  HHSRS: HHSRS_PATTERNS,
  DAMP: DAMP_PATTERNS,
  LIGHT: LIGHT_PATTERNS,
  PEEP: PEEP_PATTERNS,
  BEEP: BEEP_PATTERNS,
  SC: SC_PATTERNS,
  RES: RES_PATTERNS,
  SIB: SIB_PATTERNS,
  WAYFIND: WAYFIND_PATTERNS,
  CCTV: CCTV_PATTERNS,
  ALARM: ALARM_PATTERNS,
  ENTRY: ENTRY_PATTERNS,
  PLAY: PLAY_PATTERNS,
  PLAY_Q: PLAY_Q_PATTERNS,
  TREE: TREE_PATTERNS,
};

const CODE_ALIASES: Record<string, CertificateTypeCode> = {
  'GAS_SAFETY': 'GAS',
  'FIRE_RISK': 'FRA',
  'FIRE_RISK_ASSESSMENT': 'FRA',
  'BUILDING_SAFETY_CASE': 'BSC',
  'BUILDING_SAFETY': 'BSC',
  'BLDG_SAFETY': 'BSC',
  'HRB_CASE': 'BSC',
  'HIGHER_RISK_BUILDING': 'BSC',
  'FIRE_ALARM': 'FA',
  'LEGIONELLA': 'LEG',
  'LEGIONELLA_ASSESSMENT': 'LEG',
  'ASBESTOS': 'ASB',
  'ASBESTOS_SURVEY': 'ASB',
  'EMERGENCY_LIGHTING': 'EMLT',
  'LIFT_LOLER': 'LIFT',
};

const DEFECT_CODE_PATTERNS: Record<string, RegExp[]> = {
  C1: [/\bC1\b/, /code\s*1\b/i, /danger\s*present/i, /immediately\s*dangerous/i],
  C2: [/\bC2\b/, /code\s*2\b/i, /potentially\s*dangerous/i],
  C3: [/\bC3\b/, /code\s*3\b/i, /improvement\s*recommended/i],
  FI: [/\bFI\b/, /further\s*investigation/i],
  AR: [/\bAR\b/, /at\s*risk/i],
  ID: [/\bID\b/, /immediately\s*dangerous/i],
  NCS: [/\bNCS\b/, /not\s*to\s*current\s*standard/i],
  P1: [/\bP1\b/, /priority\s*1/i, /urgent/i],
  P2: [/\bP2\b/, /priority\s*2/i],
  P3: [/\bP3\b/, /priority\s*3/i],
  P4: [/\bP4\b/, /priority\s*4/i, /advisory/i],
  HIGH: [/high\s*risk/i, /substantial/i, /intolerable/i],
  MEDIUM: [/medium\s*risk/i, /moderate/i],
  LOW: [/low\s*risk/i, /tolerable/i, /trivial/i],
};

export function extractDefects(text: string): DefectRecord[] {
  const defects: DefectRecord[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    for (const [code, patterns] of Object.entries(DEFECT_CODE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          let priority: DefectRecord['priority'] = 'ADVISORY';
          if (['C1', 'ID', 'P1', 'HIGH'].includes(code)) priority = 'IMMEDIATE';
          else if (['C2', 'AR', 'FI', 'P2', 'MEDIUM'].includes(code)) priority = 'URGENT';
          else if (['C3', 'NCS', 'P3'].includes(code)) priority = 'ROUTINE';

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

  if (certType === 'GAS' || certType === 'GAS_SVC' || certType === 'LPG' || certType === 'OIL') {
    const appliancePattern = /appliance\s*\d*[:\s]*([^\n]+)/gi;
    let match;
    while ((match = appliancePattern.exec(text)) !== null) {
      const applianceText = match[1];
      const outcomeMatch = applianceText.match(/\b(pass|fail|satisfactory|unsatisfactory|safe|unsafe)\b/i);
      const makeMatch = applianceText.match(/make[:\s]*([A-Za-z0-9\s]+?)(?:\s*model|$)/i);
      const modelMatch = applianceText.match(/model[:\s]*([A-Za-z0-9\s\-]+)/i);

      appliances.push({
        type: 'Gas Appliance',
        make: makeMatch?.[1]?.trim() || null,
        model: modelMatch?.[1]?.trim() || null,
        serialNumber: null,
        location: null,
        outcome: outcomeMatch
          ? outcomeMatch[1].toUpperCase().includes('PASS') || outcomeMatch[1].toUpperCase().includes('SATISFACTORY') || outcomeMatch[1].toUpperCase().includes('SAFE')
            ? 'PASS'
            : 'FAIL'
          : null,
        defects: [],
      });
    }
  }

  if (certType === 'PAT') {
    const itemPattern = /(?:item|appliance)\s*[:\s]*([^\n]+?)(?:\s*(?:pass|fail))/gi;
    let match;
    while ((match = itemPattern.exec(text)) !== null) {
      const outcomeMatch = text.substring(match.index).match(/\b(pass|fail)\b/i);
      appliances.push({
        type: 'Portable Appliance',
        make: null,
        model: null,
        serialNumber: null,
        location: match[1]?.trim() || null,
        outcome: outcomeMatch?.[1]?.toUpperCase() === 'PASS' ? 'PASS' : 'FAIL',
        defects: [],
      });
    }
  }

  return appliances;
}

export interface CustomPatternConfig {
  [field: string]: string[]; // field name -> array of regex pattern strings
}

export function extractWithTemplate(
  text: string,
  certType: CertificateTypeCode,
  customPatterns?: Record<string, CustomPatternConfig>
): TemplateExtractionResult {
  const resolvedType = CODE_ALIASES[certType] || certType;
  let patterns = CERTIFICATE_PATTERNS[resolvedType];

  if (!patterns) {
    return {
      success: false,
      data: { certificateType: certType },
      confidence: 0,
      matchedFields: 0,
      totalExpectedFields: 0,
    };
  }
  
  // Merge custom patterns if provided for this document type
  if (customPatterns && customPatterns[resolvedType]) {
    const customConfig = customPatterns[resolvedType];
    patterns = patterns.map(extractor => {
      const customFieldPatterns = customConfig[extractor.field];
      if (customFieldPatterns && Array.isArray(customFieldPatterns)) {
        // Prepend custom patterns (higher priority) to existing patterns
        const newPatterns = customFieldPatterns
          .map(p => {
            try {
              return new RegExp(p, 'i');
            } catch {
              return null;
            }
          })
          .filter((p): p is RegExp => p !== null);
        return {
          ...extractor,
          patterns: [...newPatterns, ...extractor.patterns],
        };
      }
      return extractor;
    });
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
  data.appliances = extractAppliances(text, resolvedType);

  let confidence = matchedFields / totalExpectedFields;
  if (requiredFieldsMissing > 0) {
    confidence *= 0.5;
  }
  if (data.defects && data.defects.length > 0) {
    confidence = Math.min(confidence + 0.1, 1);
  }
  if (data.appliances && data.appliances.length > 0) {
    confidence = Math.min(confidence + 0.05, 1);
  }

  return {
    success: matchedFields >= 2,
    data,
    confidence,
    matchedFields,
    totalExpectedFields,
  };
}
