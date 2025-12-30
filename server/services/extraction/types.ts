export type ExtractionTier = 
  | 'tier-0'         // Format Detection (free, instant)
  | 'tier-0.5'       // QR & Metadata Extraction (free)
  | 'tier-1'         // Template Extraction - regex patterns (free)
  | 'tier-1.5'       // Claude Text Enhancement (~£0.003)
  | 'tier-2'         // Azure Document Intelligence (~£0.0015/page)
  | 'tier-3'         // Claude Vision (~£0.01/page)
  | 'tier-4';        // Manual Review (human time)

export type TierStatus = 
  | 'success'        // Extraction completed with sufficient confidence
  | 'escalated'      // Confidence too low, moving to next tier
  | 'skipped'        // Tier was skipped (e.g., AI disabled)
  | 'failed'         // Tier failed to process
  | 'pending';       // Not yet attempted

export type DocumentFormat = 
  | 'pdf-native'     // PDF with text layer
  | 'pdf-scanned'    // PDF without text layer (image-based)
  | 'pdf-hybrid'     // PDF with mixed text/scanned pages
  | 'docx'           // Microsoft Word
  | 'xlsx'           // Microsoft Excel
  | 'csv'            // Comma-separated values
  | 'html'           // HTML document
  | 'txt'            // Plain text
  | 'email'          // EML/MSG email
  | 'image';         // JPEG, PNG, TIFF, HEIC, WebP

export type DocumentClassification = 
  | 'structured_certificate'   // Standard form-based certs (CP12, EICR, EPC)
  | 'complex_document'         // FRAs, surveys with narrative
  | 'handwritten_content'      // Contains handwriting
  | 'spreadsheet'              // XLSX/CSV data
  | 'unknown';

export type CertificateTypeCode = 
  | 'GAS' | 'GAS_SVC' | 'OIL' | 'OIL_TANK' | 'LPG' | 'SOLID' | 'BIO' | 'HVAC' | 'MECH' | 'RENEW' | 'ASHP' | 'GSHP'
  | 'ELEC' | 'EICR' | 'PAT' | 'EMLT' | 'EMLT_M' | 'ELEC_HEAT'
  | 'EPC' | 'SAP' | 'DEC'
  | 'FIRE' | 'FRA' | 'FRAEW' | 'FIRE_ALARM' | 'FIRE_ALARM_M' | 'FIRE_EXT' | 'FIRE_DOOR' | 'FIRE_DOOR_Q' | 'DRY_RISER' | 'WET_RISER' | 'SPRINKLER' | 'SMOKE_CO' | 'AOV' | 'COMPART' | 'FIRE_STOP' | 'FIRE_EVP' | 'EVAC_CHAIR' | 'ESCAPE_LTNG'
  | 'ASBESTOS' | 'ASB_SURVEY' | 'ASB_MGMT' | 'ASB_REINSP'
  | 'LEGIONELLA' | 'LEG_RA' | 'LEG_MONITOR' | 'WATER_TANK' | 'TMV'
  | 'LIFT' | 'STAIRLIFT' | 'HOIST' | 'LOLER'
  | 'STRUCT' | 'BLDG_SAFETY' | 'BSR_REG' | 'FACADE' | 'ROOF'
  | 'PLAY' | 'TREE' | 'LAND' | 'BOUNDARY' | 'PARKING' | 'DRAINAGE'
  | 'SEC_DOOR' | 'SEC_GATE' | 'CCTV' | 'ACCESS_CTRL' | 'INTERCOM'
  | 'RESIDENT_ENG' | 'BSM_STRATEGY' | 'GOLDEN_THREAD' | 'RESIDENT_INFO'
  | 'HHSRS' | 'DAMP_MOULD' | 'VENTILATION' | 'RADON'
  | 'DDA' | 'ADAPT'
  | 'PEST'
  | 'WASTE' | 'RECYCLING'
  | 'COMM_CLEAN' | 'GRAFFITI'
  | 'UNKNOWN';

export interface ApplianceRecord {
  type: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  outcome: 'PASS' | 'FAIL' | 'N/A' | null;
  defects: string[];
}

export interface DefectRecord {
  code: string | null;
  description: string;
  location: string | null;
  priority: 'IMMEDIATE' | 'URGENT' | 'ADVISORY' | 'ROUTINE' | null;
  remedialAction: string | null;
}

export interface ExtractedCertificateData {
  certificateType: CertificateTypeCode;
  certificateNumber: string | null;
  propertyAddress: string | null;
  uprn: string | null;
  inspectionDate: string | null;
  expiryDate: string | null;
  nextInspectionDate: string | null;
  outcome: 'PASS' | 'FAIL' | 'SATISFACTORY' | 'UNSATISFACTORY' | 'N/A' | null;
  
  engineerName: string | null;
  engineerRegistration: string | null;
  contractorName: string | null;
  contractorRegistration: string | null;
  
  appliances: ApplianceRecord[];
  defects: DefectRecord[];
  additionalFields: Record<string, string>;
}

export interface QRCodeData {
  provider: 'gas-safe' | 'gas-tag' | 'niceic' | 'corgi' | 'other';
  url: string | null;
  verificationCode: string | null;
  rawData: string;
}

export interface ImageMetadata {
  dateTaken: Date | null;
  gpsCoordinates: { lat: number; lng: number } | null;
  device: string | null;
  software: string | null;
}

export interface TierAuditEntry {
  tier: ExtractionTier;
  attemptedAt: Date;
  completedAt: Date | null;
  status: TierStatus;
  confidence: number;
  processingTimeMs: number;
  cost: number;
  extractedFieldCount: number;
  escalationReason: string | null;
  rawOutput: Record<string, unknown> | null;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedCertificateData | null;
  finalTier: ExtractionTier;
  confidence: number;
  totalProcessingTimeMs: number;
  totalCost: number;
  requiresReview: boolean;
  warnings: string[];
  rawText: string | null;
  
  documentFormat: DocumentFormat;
  documentClassification: DocumentClassification;
  pageCount: number;
  
  qrCodes: QRCodeData[];
  metadata: ImageMetadata | null;
  
  tierAudit: TierAuditEntry[];
}

export interface ExtractionOptions {
  forceAI?: boolean;
  skipTiers?: ExtractionTier[];
  preferredTier?: ExtractionTier;
  maxCost?: number;
  timeout?: number;
}

export const TIER_CONFIDENCE_THRESHOLDS: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0.95,
  'tier-1': 0.85,
  'tier-1.5': 0.80,
  'tier-2': 0.80,
  'tier-3': 0.70,
  'tier-4': 0,
};

export const TIER_COSTS: Record<ExtractionTier, number> = {
  'tier-0': 0,
  'tier-0.5': 0,
  'tier-1': 0,
  'tier-1.5': 0.003,
  'tier-2': 0.0015,
  'tier-3': 0.01,
  'tier-4': 0,
};
