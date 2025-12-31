import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { join } from "path";
import { db } from "./db";
import { extractionRuns, componentTypes, components, contractors, certificateTypes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { broadcastExtractionEvent } from "./events";
import { extractWithAzureDocumentIntelligence, isAzureDocumentIntelligenceConfigured, type ExtractionTier } from "./azure-document-intelligence";
import { logger } from "./logger";
import type { ExtractedCertificateData as OrchestratorExtractedData, CertificateTypeCode } from "./services/extraction/types";
import { extractCertificate as extractWithOrchestrator } from "./services/extraction/orchestrator";

// Helper to get certificate type config by code
async function getCertificateTypeIdByCode(code: string) {
  return storage.getCertificateTypeByCode(code);
}

// Dynamic import pdfjs-dist for PDF processing
let pdfjs: any = null;
async function getPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjs;
}

// Configure pdfjs-dist with standard font data to avoid font warnings
const standardFontDataUrl = join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

const anthropic = new Anthropic();

// Certificate type enum values: 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER' | 'OTHER'
type CertificateType = 'GAS_SAFETY' | 'EICR' | 'EPC' | 'FIRE_RISK_ASSESSMENT' | 'LEGIONELLA_ASSESSMENT' | 'ASBESTOS_SURVEY' | 'LIFT_LOLER' | 'OTHER';

// Map detected document types to certificate type enum values
function mapDocumentTypeToCertificateType(documentType: string | undefined): CertificateType | undefined {
  if (!documentType) return undefined;
  
  const docTypeLower = documentType.toLowerCase();
  
  // Gas Safety mappings
  if (docTypeLower.includes('gas safety') || 
      docTypeLower.includes('lgsr') || 
      docTypeLower.includes('cp12') ||
      docTypeLower.includes('landlord gas')) {
    return 'GAS_SAFETY';
  }
  
  // EICR / Electrical mappings
  if (docTypeLower.includes('eicr') || 
      docTypeLower.includes('electrical installation') ||
      docTypeLower.includes('electrical condition')) {
    return 'EICR';
  }
  
  // Fire Risk mappings
  if (docTypeLower.includes('fire risk') || 
      docTypeLower.includes('fra') ||
      docTypeLower.includes('fire safety')) {
    return 'FIRE_RISK_ASSESSMENT';
  }
  
  // Asbestos mappings
  if (docTypeLower.includes('asbestos')) {
    return 'ASBESTOS_SURVEY';
  }
  
  // Legionella mappings
  if (docTypeLower.includes('legionella') || 
      docTypeLower.includes('water hygiene') ||
      docTypeLower.includes('water risk')) {
    return 'LEGIONELLA_ASSESSMENT';
  }
  
  // Lift / LOLER mappings
  if (docTypeLower.includes('lift') || 
      docTypeLower.includes('loler') ||
      docTypeLower.includes('elevator')) {
    return 'LIFT_LOLER';
  }
  
  // EPC mappings
  if (docTypeLower.includes('energy performance') || 
      docTypeLower.includes('epc')) {
    return 'EPC';
  }
  
  return undefined;
}

function mapApplianceOutcome(outcome: string | undefined | null): 'PASS' | 'FAIL' | 'N/A' | null {
  if (!outcome) return null;
  const upper = outcome.toUpperCase().trim();
  if (upper === 'PASS' || upper === 'SATISFACTORY' || upper === 'OK' || upper === 'SAFE' || upper === 'PASSED') return 'PASS';
  if (upper === 'FAIL' || upper === 'FAILED' || upper === 'UNSATISFACTORY' || 
      upper === 'ID' || upper === 'IMMEDIATE DANGER' || upper.includes('IMMEDIATE DANGER') ||
      upper === 'AR' || upper === 'AT RISK' || upper.includes('AT RISK') ||
      upper === 'NCS' || upper === 'NOT TO CURRENT STANDARD' || upper.includes('NOT TO CURRENT STANDARD') ||
      upper === 'CONDEMNED' || upper === 'CONDDEM' ||
      upper === 'UNSAFE' || upper === 'NOT SAFE' ||
      upper === 'C1' || upper === 'C2' || upper === 'CI' || upper === 'CII' ||
      upper === 'FURTHER INVESTIGATION' || upper.includes('FURTHER INVESTIGATION') ||
      upper === 'FI' || upper === 'REQUIRES ACTION' || upper === 'ACTION REQUIRED') return 'FAIL';
  if (upper === 'N/A' || upper === 'NA' || upper === 'NOT APPLICABLE' || upper === 'NOT TESTED' || 
      upper === 'SERVICE ONLY' || upper === 'S' ||
      upper === 'NOT REQUIRED' || upper === 'NOT CHECKED' || upper === 'INSPECTION ONLY') return 'N/A';
  console.warn(`[mapApplianceOutcome] Unknown outcome token: "${outcome}", defaulting to null`);
  return null;
}

function mapDefectPriority(priority: string | undefined | null): 'IMMEDIATE' | 'URGENT' | 'ADVISORY' | 'ROUTINE' | null {
  if (!priority) return null;
  const upper = priority.toUpperCase().trim();
  if (upper === 'IMMEDIATE' || upper === 'C1' || upper === 'ID' || upper === 'DANGER') return 'IMMEDIATE';
  if (upper === 'URGENT' || upper === 'C2' || upper === 'AR' || upper === 'AT RISK' || upper === 'NCS') return 'URGENT';
  if (upper === 'ADVISORY' || upper === 'FI' || upper === 'FYI' || upper === 'IMPROVEMENT') return 'ADVISORY';
  if (upper === 'ROUTINE' || upper === 'C3' || upper === 'OBSERVATION' || upper === 'MINOR') return 'ROUTINE';
  return null;
}

function mapCertificateTypeToCode(certType: string | undefined | null): CertificateTypeCode {
  if (!certType) {
    logger.warn({ certType }, '[mapCertificateTypeToCode] No certificate type provided, defaulting to UNKNOWN');
    return 'UNKNOWN';
  }
  const upper = certType.toUpperCase().trim();
  if (upper === 'GAS_SAFETY' || upper === 'GAS' || upper === 'LGSR' || upper === 'CP12' || upper.includes('GAS SAFETY')) return 'GAS_SAFETY';
  if (upper === 'GAS_SVC' || upper.includes('GAS SERVICE')) return 'GAS_SVC';
  if (upper === 'OIL' || upper.includes('OIL BOILER')) return 'OIL';
  if (upper === 'LPG') return 'LPG';
  if (upper === 'EICR' || upper === 'ELECTRICAL' || upper.includes('ELECTRICAL INSTALLATION')) return 'EICR';
  if (upper === 'ELEC') return 'ELEC';
  if (upper === 'PAT' || upper.includes('PORTABLE APPLIANCE')) return 'PAT';
  if (upper === 'EMLT' || upper.includes('EMERGENCY LIGHT')) return 'EMLT';
  if (upper === 'EPC' || upper === 'ENERGY' || upper.includes('ENERGY PERFORMANCE')) return 'EPC';
  if (upper === 'SAP') return 'SAP';
  if (upper === 'DEC' || upper.includes('DISPLAY ENERGY')) return 'DEC';
  if (upper === 'FIRE_RISK_ASSESSMENT' || upper === 'FRA' || upper === 'FIRE' || upper.includes('FIRE RISK')) return 'FRA';
  if (upper === 'FRAEW' || upper.includes('EXTERNAL WALL')) return 'FRAEW';
  if (upper === 'FIRE_ALARM' || upper.includes('FIRE ALARM')) return 'FIRE_ALARM';
  if (upper === 'FIRE_EXT' || upper.includes('FIRE EXTINGUISHER')) return 'FIRE_EXT';
  if (upper === 'FIRE_DOOR' || upper.includes('FIRE DOOR')) return 'FIRE_DOOR';
  if (upper === 'SMOKE_CO' || upper.includes('SMOKE') || upper.includes('CARBON MONOXIDE DETECTOR')) return 'SMOKE_CO';
  if (upper === 'AOV') return 'AOV';
  if (upper === 'SPRINKLER') return 'SPRINKLER';
  if (upper === 'LEGIONELLA_ASSESSMENT' || upper === 'LEGIONELLA' || upper === 'LEG_RA' || upper.includes('LEGIONELLA')) return 'LEG_RA';
  if (upper === 'LEG_MONITOR' || upper.includes('LEGIONELLA MONITOR')) return 'LEG_MONITOR';
  if (upper === 'WATER_TANK' || upper.includes('WATER TANK')) return 'WATER_TANK';
  if (upper === 'TMV' || upper.includes('THERMOSTATIC MIXING')) return 'TMV';
  if (upper === 'ASBESTOS_SURVEY' || upper === 'ASBESTOS' || upper === 'ASB_SURVEY' || upper.includes('ASBESTOS')) return 'ASB_SURVEY';
  if (upper === 'ASB_MGMT' || upper.includes('ASBESTOS MANAGEMENT')) return 'ASB_MGMT';
  if (upper === 'LIFT_LOLER' || upper === 'LOLER' || upper.includes('LOLER')) return 'LOLER';
  if (upper === 'LIFT' || upper.includes('PASSENGER LIFT')) return 'LIFT';
  if (upper === 'STAIRLIFT') return 'STAIRLIFT';
  if (upper === 'HOIST') return 'HOIST';
  if (upper === 'STRUCT' || upper.includes('STRUCTURAL')) return 'STRUCT';
  if (upper === 'BLDG_SAFETY' || upper.includes('BUILDING SAFETY')) return 'BLDG_SAFETY';
  if (upper === 'BSR_REG' || upper.includes('BSR')) return 'BSR_REG';
  if (upper === 'FACADE' || upper.includes('CLADDING')) return 'FACADE';
  if (upper === 'ROOF') return 'ROOF';
  if (upper === 'PLAY' || upper.includes('PLAYGROUND')) return 'PLAY';
  if (upper === 'TREE') return 'TREE';
  if (upper === 'CCTV') return 'CCTV';
  if (upper === 'ACCESS_CTRL' || upper.includes('ACCESS CONTROL')) return 'ACCESS_CTRL';
  if (upper === 'HHSRS' || upper.includes('HOUSING HEALTH')) return 'HHSRS';
  if (upper === 'DAMP_MOULD' || upper.includes('DAMP') || upper.includes('MOULD')) return 'DAMP_MOULD';
  if (upper === 'VENTILATION') return 'VENTILATION';
  if (upper === 'DDA' || upper.includes('DISABILITY')) return 'DDA';
  if (upper === 'PEST' || upper.includes('PEST CONTROL')) return 'PEST';
  if (upper === 'WASTE' || upper.includes('WASTE')) return 'WASTE';
  if (upper === 'COMM_CLEAN' || upper.includes('COMMUNAL CLEAN')) return 'COMM_CLEAN';
  if (upper === 'OTHER') return 'UNKNOWN';
  logger.warn({ certType, upper }, '[mapCertificateTypeToCode] Unknown certificate type, defaulting to UNKNOWN');
  return 'UNKNOWN';
}

// Normalize address from various Claude response formats
function normalizeExtractedAddress(rawAddress: any): { addressLine1: string; city: string; postcode: string } {
  const result = { addressLine1: '', city: '', postcode: '' };
  
  if (!rawAddress) return result;
  
  // Handle string address
  if (typeof rawAddress === 'string') {
    result.addressLine1 = rawAddress.substring(0, 255);
    // Try to extract postcode from string (UK format)
    const postcodeMatch = rawAddress.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i);
    if (postcodeMatch) {
      result.postcode = postcodeMatch[0].toUpperCase();
    }
    return result;
  }
  
  // Handle object address - Claude returns many different formats
  if (typeof rawAddress === 'object') {
    // Try various field names for address line
    const addressFields = ['street', 'streetAddress', 'name', 'addressLine1', 'address_line_1', 
                           'fullAddress', 'property', 'line1', 'address1'];
    for (const field of addressFields) {
      if (rawAddress[field]) {
        result.addressLine1 = String(rawAddress[field]).substring(0, 255);
        break;
      }
    }
    
    // If no specific field, try to build from components
    if (!result.addressLine1) {
      const parts = [];
      if (rawAddress.tenantUnit || rawAddress.unit) parts.push(rawAddress.tenantUnit || rawAddress.unit);
      if (rawAddress.buildingName) parts.push(rawAddress.buildingName);
      if (rawAddress.buildingNumber) parts.push(rawAddress.buildingNumber);
      if (rawAddress.street) parts.push(rawAddress.street);
      if (parts.length > 0) {
        result.addressLine1 = parts.join(', ').substring(0, 255);
      }
    }
    
    // Try various field names for city
    const cityFields = ['city', 'town', 'locality', 'district', 'area'];
    for (const field of cityFields) {
      if (rawAddress[field]) {
        result.city = String(rawAddress[field]);
        break;
      }
    }
    
    // Try various field names for postcode
    const postcodeFields = ['postcode', 'postCode', 'postalCode', 'postal_code', 'zip'];
    for (const field of postcodeFields) {
      if (rawAddress[field]) {
        result.postcode = String(rawAddress[field]).toUpperCase();
        break;
      }
    }
    
    // If address has uprn, add it
    if (rawAddress.uprn && !result.addressLine1.includes(rawAddress.uprn)) {
      // Don't use UPRN as address
    }
  }
  
  return result;
}

interface ExtractionResult {
  extractedData: Record<string, any>;
  outcome: "SATISFACTORY" | "UNSATISFACTORY";
  remedialActions: Array<{
    code: string;
    description: string;
    location: string;
    severity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY";
    costEstimate?: string;
  }>;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  confidence: number;
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  GAS_SAFETY: `You are analyzing a UK Gas Safety Certificate (CP12/Landlord Gas Safety Record).
Extract the following information in JSON format:
{
  "documentType": "Landlord Gas Safety Record (LGSR/CP12)",
  "certificateNumber": "the certificate/record number",
  "engineer": {
    "name": "engineer's full name",
    "gasSafeNumber": "Gas Safe registration number (7 digits)",
    "signaturePresent": true/false
  },
  "installationAddress": "the full property address where the gas appliances are installed",
  "appliances": [
    {
      "location": "room location",
      "type": "appliance type (Boiler, Fire, Cooker, etc.)",
      "make": "manufacturer",
      "model": "model name/number",
      "applianceSafe": true/false,
      "safetyDeviceCorrect": true/false,
      "ventilationSatisfactory": true/false,
      "flueFlowSatisfactory": true/false,
      "safetyStatus": "PASS or AT RISK or FAIL"
    }
  ],
  "issueDate": "YYYY-MM-DD format",
  "expiryDate": "YYYY-MM-DD format (usually 12 months from issue)",
  "overallOutcome": "SATISFACTORY or UNSATISFACTORY",
  "defects": [
    {
      "description": "description of any defect",
      "classification": "Immediately Dangerous (ID) / At Risk (AR) / Not to Current Standard (NCS)",
      "location": "where the defect was found"
    }
  ],
  "propertyAddress": "full property address if visible"
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is. 
If a field cannot be determined, use null. Mark outcome as UNSATISFACTORY if any appliance is unsafe or defects are found with ID/AR classification.`,

  EICR: `You are analyzing a UK Electrical Installation Condition Report (EICR).
Extract the following information in JSON format:
{
  "documentType": "Electrical Installation Condition Report (EICR)",
  "reportNumber": "the report/certificate number",
  "inspector": {
    "name": "inspector's full name",
    "registrationNumber": "NICEIC/NAPIT/other registration number",
    "signaturePresent": true/false
  },
  "installationAddress": "full property address",
  "issueDate": "YYYY-MM-DD format",
  "expiryDate": "YYYY-MM-DD format (recommended next inspection date)",
  "overallAssessment": "SATISFACTORY or UNSATISFACTORY",
  "observations": [
    {
      "itemNumber": "observation/schedule item number",
      "description": "description of the observation",
      "code": "C1/C2/C3/FI (classification code)",
      "location": "circuit or location affected"
    }
  ],
  "c1Count": number of C1 (danger present) observations,
  "c2Count": number of C2 (potentially dangerous) observations,
  "c3Count": number of C3 (improvement recommended) observations,
  "fiCount": number of FI (further investigation) observations,
  "circuitsTested": total number of circuits tested
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is.
C1 = Danger present (requires immediate action)
C2 = Potentially dangerous (urgent remedial action required)
C3 = Improvement recommended
FI = Further investigation required

Mark overall assessment as UNSATISFACTORY if any C1 or C2 codes are present.`,

  FIRE_RISK: `You are analyzing a UK Fire Risk Assessment (FRA) document.
Extract the following information in JSON format:
{
  "documentType": "Fire Risk Assessment (FRA)",
  "reportNumber": "the assessment reference number",
  "assessor": {
    "name": "assessor's full name",
    "qualifications": "relevant qualifications",
    "signaturePresent": true/false
  },
  "installationAddress": "property/building address",
  "premisesAddress": "property/building address",
  "assessmentDate": "YYYY-MM-DD format",
  "issueDate": "YYYY-MM-DD format (same as assessmentDate)",
  "reviewDate": "YYYY-MM-DD format (recommended review date)",
  "expiryDate": "YYYY-MM-DD format (same as reviewDate)",
  "riskLevel": "LOW/MODERATE/SUBSTANTIAL/HIGH/INTOLERABLE",
  "findings": [
    {
      "itemNumber": "finding reference",
      "description": "description of the fire safety issue",
      "priority": "HIGH/MEDIUM/LOW",
      "location": "area affected",
      "recommendation": "recommended action"
    }
  ],
  "highPriorityCount": number of high priority findings,
  "mediumPriorityCount": number of medium priority findings,
  "lowPriorityCount": number of low priority findings,
  "escapRoutesAdequate": true/false,
  "fireDetectionAdequate": true/false,
  "emergencyLightingAdequate": true/false
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is.
Mark as UNSATISFACTORY if risk level is SUBSTANTIAL, HIGH, or INTOLERABLE, or if there are any HIGH priority findings.`,

  ASBESTOS: `You are analyzing a UK Asbestos Survey Report (Management Survey or Refurbishment/Demolition Survey).
Extract the following information in JSON format:
{
  "documentType": "Asbestos Survey Report",
  "reportNumber": "the survey reference number",
  "surveyor": {
    "name": "surveyor's full name",
    "qualifications": "BOHS P402/P403 or equivalent",
    "laboratoryAccreditation": "UKAS accreditation number"
  },
  "surveyType": "Management Survey or Refurbishment/Demolition Survey",
  "installationAddress": "property address",
  "premisesAddress": "property address",
  "surveyDate": "YYYY-MM-DD format",
  "issueDate": "YYYY-MM-DD format (same as surveyDate)",
  "reviewDate": "YYYY-MM-DD format",
  "expiryDate": "YYYY-MM-DD format (same as reviewDate)",
  "acmItems": [
    {
      "itemId": "sample/item reference",
      "location": "where ACM was found",
      "material": "type of material (floor tiles, insulation, etc.)",
      "asbestosType": "chrysotile/amosite/crocidolite if identified",
      "condition": "GOOD/FAIR/POOR/DAMAGED",
      "riskScore": material assessment score if shown,
      "recommendation": "manage in situ/encapsulate/remove"
    }
  ],
  "totalAcmCount": number of asbestos containing materials identified,
  "highRiskCount": number of items requiring urgent action,
  "managementPlanRequired": true/false
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is.
Mark as UNSATISFACTORY if any ACMs are in POOR/DAMAGED condition or high risk items are identified.`,

  LEGIONELLA: `You are analyzing a UK Legionella Risk Assessment report.
Extract the following information in JSON format:
{
  "documentType": "Legionella Risk Assessment",
  "reportNumber": "assessment reference number",
  "assessor": {
    "name": "assessor's full name",
    "company": "company name",
    "qualifications": "relevant qualifications"
  },
  "installationAddress": "property address",
  "premisesAddress": "property address",
  "assessmentDate": "YYYY-MM-DD format",
  "issueDate": "YYYY-MM-DD format (same as assessmentDate)",
  "reviewDate": "YYYY-MM-DD format (usually 2 years)",
  "expiryDate": "YYYY-MM-DD format (same as reviewDate)",
  "overallRisk": "LOW/MEDIUM/HIGH",
  "waterSystems": [
    {
      "systemType": "cold water/hot water/cooling tower/spa",
      "riskLevel": "LOW/MEDIUM/HIGH",
      "findings": "key findings for this system"
    }
  ],
  "recommendations": [
    {
      "priority": "IMMEDIATE/SHORT_TERM/MEDIUM_TERM",
      "description": "recommended action",
      "deadline": "timeframe for completion"
    }
  ],
  "deadLegsIdentified": true/false,
  "temperatureCompliant": true/false,
  "monthlyFlushingRequired": true/false
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is.
Mark as UNSATISFACTORY if overall risk is HIGH or there are IMMEDIATE priority recommendations.`,

  LIFT: `You are analyzing a UK Lift/Elevator Inspection Report (LOLER examination).
Extract the following information in JSON format:
{
  "documentType": "Lift Inspection Report (LOLER)",
  "reportNumber": "examination report number",
  "examiner": {
    "name": "competent person's name",
    "company": "insurance company or examination body",
    "registrationNumber": "registration or certificate number"
  },
  "installationAddress": "building address",
  "liftLocation": "building/floor location of lift",
  "liftType": "passenger/goods/platform/stairlift",
  "examinationDate": "YYYY-MM-DD format",
  "issueDate": "YYYY-MM-DD format (same as examinationDate)",
  "nextExaminationDate": "YYYY-MM-DD format (usually 6 months for passenger lifts)",
  "expiryDate": "YYYY-MM-DD format (same as nextExaminationDate)",
  "safeToOperate": true/false,
  "defects": [
    {
      "category": "A/B/C (severity category if used)",
      "description": "description of defect",
      "remedialAction": "required action",
      "timeframe": "when action must be completed"
    }
  ],
  "categorA_Count": number of Category A (imminent risk) defects,
  "categoryB_Count": number of Category B (risk to become dangerous) defects,
  "categoryC_Count": number of Category C (does not meet standard) defects
}

IMPORTANT: Always include "documentType" to identify what type of certificate this actually is.
Mark as UNSATISFACTORY if lift is not safe to operate or any Category A defects are present.`
};

function getDefaultPrompt(certificateType: string): string {
  return `You are analyzing a UK compliance certificate. The user selected type: ${certificateType}, but please identify the ACTUAL document type.
Extract all relevant information including:
- documentType: The actual type of certificate you are analyzing (e.g., "Landlord Gas Safety Record", "EICR", "Fire Risk Assessment", etc.)
- certificateNumber or reportNumber
- issueDate and expiryDate (in YYYY-MM-DD format)
- installationAddress: The full property address from the certificate
- inspector or engineer details (name, registration number)
- overallOutcome or overallAssessment: SATISFACTORY or UNSATISFACTORY
- Any defects, observations, or recommendations with their severity levels

Return the data as a structured JSON object. If a field cannot be determined, use null.
IMPORTANT: Always include "documentType" to identify what type of certificate this actually is, even if it differs from what the user selected.
Also determine if the certificate shows a SATISFACTORY or UNSATISFACTORY outcome based on the findings.`;
}

export interface TieredExtractionResult {
  extractedData: Record<string, any>;
  outcome: "SATISFACTORY" | "UNSATISFACTORY";
  remedialActions: ExtractionResult["remedialActions"];
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  confidence: number;
  tier: 1 | 2 | 3;
  tierName: "AZURE_DOCUMENT_INTELLIGENCE" | "CLAUDE_VISION" | "HUMAN_REVIEW";
  tierHistory: Array<{
    tier: number;
    name: string;
    succeeded: boolean;
    confidence: number;
    error?: string;
    processingTimeMs: number;
  }>;
  processingTimeMs: number;
}

export async function extractCertificateWithTieredApproach(
  certificateId: string,
  certificateType: string,
  documentBuffer?: Buffer,
  fileBase64?: string,
  mimeType?: string
): Promise<TieredExtractionResult> {
  const startTime = Date.now();
  const certificate = await storage.getCertificate(certificateId);
  if (!certificate) {
    throw new Error("Certificate not found");
  }

  const tierHistory: TieredExtractionResult["tierHistory"] = [];
  const confidenceThreshold = 0.75;
  
  logger.info({ 
    certificateId, 
    certificateType, 
    hasBuffer: !!documentBuffer,
    mimeType,
    azureConfigured: isAzureDocumentIntelligenceConfigured() 
  }, "Starting tiered extraction");

  let extractedText: string | undefined;
  let azureTierResult: ExtractionTier | undefined;

  if (documentBuffer && isAzureDocumentIntelligenceConfigured()) {
    const effectiveMimeType = mimeType || 'application/pdf';
    azureTierResult = await extractWithAzureDocumentIntelligence(documentBuffer, effectiveMimeType);
    
    tierHistory.push({
      tier: 1,
      name: azureTierResult.name,
      succeeded: azureTierResult.succeeded,
      confidence: azureTierResult.confidence,
      error: azureTierResult.error,
      processingTimeMs: azureTierResult.processingTimeMs
    });
    
    const azureTextLength = azureTierResult.rawText?.length || 0;
    const azureConfidence = azureTierResult.confidence || 0;
    const azureIsUsable = azureTierResult.succeeded && 
                          (azureTextLength > 100 || (azureTextLength > 50 && azureConfidence >= 0.7));
    
    if (azureIsUsable) {
      extractedText = azureTierResult.rawText;
      logger.info({ 
        confidence: azureConfidence, 
        textLength: azureTextLength 
      }, "Tier 1 (Azure) OCR succeeded, using Azure text for Claude analysis");
    } else {
      logger.warn({ 
        error: azureTierResult.error,
        textLength: azureTextLength,
        confidence: azureConfidence
      }, "Tier 1 (Azure) failed or returned insufficient text, falling back to pdfjs-dist");
      
      if (documentBuffer) {
        try {
          extractedText = await extractTextFromPdf(documentBuffer);
          logger.info({ textLength: extractedText?.length }, "Fallback: extracted text with pdfjs-dist after Azure failure");
        } catch (pdfjsError) {
          logger.warn({ error: pdfjsError }, "pdfjs-dist extraction failed");
          if (azureTextLength > 0) {
            extractedText = azureTierResult.rawText;
            logger.info({ textLength: azureTextLength }, "Using Azure text as last resort after pdfjs failure");
          }
        }
      }
    }
  } else if (documentBuffer) {
    try {
      extractedText = await extractTextFromPdf(documentBuffer);
      logger.info({ textLength: extractedText?.length }, "Azure not configured, extracted text with pdfjs-dist");
    } catch (pdfjsError) {
      logger.error({ error: pdfjsError }, "pdfjs-dist extraction failed without Azure fallback");
    }
  }

  const effectiveText = extractedText || azureTierResult?.rawText;
  const hasUsableText = effectiveText && effectiveText.trim().length >= 50;
  const hasImageInput = fileBase64 && mimeType && mimeType.startsWith('image/');
  
  if (!hasUsableText && !hasImageInput) {
    logger.error({ 
      textLength: effectiveText?.length || 0,
      hasFileBase64: !!fileBase64,
      mimeType 
    }, "No usable content for Tier 2 (Claude) - requires either OCR text or image");
    
    tierHistory.push({
      tier: 2,
      name: "CLAUDE_VISION",
      succeeded: false,
      confidence: 0,
      error: "No usable OCR text or image content available",
      processingTimeMs: 0
    });
    
    return {
      extractedData: { 
        rawText: effectiveText,
        azureStructuredData: azureTierResult?.structuredData,
        error: "OCR failed to extract usable text from document"
      },
      outcome: "UNSATISFACTORY",
      remedialActions: [],
      confidence: 0,
      tier: 3,
      tierName: "HUMAN_REVIEW",
      tierHistory,
      processingTimeMs: Date.now() - startTime
    };
  }

  const tier2StartTime = Date.now();
  let claudeResult: ExtractionResult;
  let tier2Error: string | undefined;

  try {
    claudeResult = await extractCertificateWithClaude(
      certificateId,
      certificateType,
      fileBase64,
      mimeType,
      effectiveText
    );
    
    tierHistory.push({
      tier: 2,
      name: "CLAUDE_VISION",
      succeeded: true,
      confidence: claudeResult.confidence,
      processingTimeMs: Date.now() - tier2StartTime
    });
    
    logger.info({ confidence: claudeResult.confidence }, "Tier 2 (Claude) extraction complete");
    
  } catch (error) {
    tier2Error = error instanceof Error ? error.message : "Unknown Claude error";
    
    tierHistory.push({
      tier: 2,
      name: "CLAUDE_VISION",
      succeeded: false,
      confidence: 0,
      error: tier2Error,
      processingTimeMs: Date.now() - tier2StartTime
    });
    
    logger.error({ error: tier2Error }, "Tier 2 (Claude) failed");
    
    return {
      extractedData: { 
        rawText: extractedText || azureTierResult?.rawText,
        azureStructuredData: azureTierResult?.structuredData,
        error: tier2Error 
      },
      outcome: "UNSATISFACTORY",
      remedialActions: [],
      confidence: 0,
      tier: 3,
      tierName: "HUMAN_REVIEW",
      tierHistory,
      processingTimeMs: Date.now() - startTime
    };
  }

  const finalConfidence = claudeResult.confidence;
  const needsHumanReview = finalConfidence < confidenceThreshold;
  
  const azureProvidedOCR = azureTierResult?.succeeded && 
                           azureTierResult.rawText && 
                           extractedText === azureTierResult.rawText;
  
  const effectiveTier: 1 | 2 | 3 = needsHumanReview ? 3 : 2;
  const effectiveTierName: TieredExtractionResult["tierName"] = needsHumanReview ? "HUMAN_REVIEW" : "CLAUDE_VISION";

  const ocrProvider = azureProvidedOCR ? "AZURE_DOCUMENT_INTELLIGENCE" : 
                      (extractedText ? "PDFJS_LOCAL" : "NONE");

  logger.info({ 
    finalConfidence, 
    effectiveTier, 
    effectiveTierName, 
    needsHumanReview,
    ocrProvider,
    azureAttempted: !!azureTierResult,
    tierHistoryLength: tierHistory.length
  }, "Tiered extraction complete");

  return {
    ...claudeResult,
    extractedData: {
      ...claudeResult.extractedData,
      _extractionMethod: {
        ocrProvider,
        analysisProvider: "CLAUDE_VISION",
        ocrConfidence: azureProvidedOCR ? (azureTierResult?.confidence || 0) : 
                       (azureTierResult?.succeeded ? azureTierResult.confidence : 0),
        analysisConfidence: claudeResult.confidence,
        azureAttempted: !!azureTierResult,
        azureSucceeded: azureTierResult?.succeeded || false,
        azureConfidence: azureTierResult?.confidence || 0,
        azureTextLength: azureTierResult?.rawText?.length || 0,
        textUsedLength: extractedText?.length || 0,
        textUsedProvider: ocrProvider
      }
    },
    tier: effectiveTier,
    tierName: effectiveTierName,
    tierHistory,
    processingTimeMs: Date.now() - startTime
  };
}

export async function extractCertificateWithClaude(
  certificateId: string,
  certificateType: string,
  fileBase64?: string,
  mimeType?: string,
  pdfText?: string
): Promise<ExtractionResult> {
  const certificate = await storage.getCertificate(certificateId);
  if (!certificate) {
    throw new Error("Certificate not found");
  }

  const prompt = EXTRACTION_PROMPTS[certificateType] || getDefaultPrompt(certificateType);
  
  let messageContent: Anthropic.MessageParam["content"];
  
  if (fileBase64 && mimeType && mimeType.startsWith('image/')) {
    messageContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: fileBase64,
        },
      },
      {
        type: "text",
        text: prompt + "\n\nAnalyze the certificate image above and return only valid JSON."
      }
    ];
  } else if (pdfText && pdfText.trim().length > 50) {
    messageContent = [
      {
        type: "text",
        text: prompt + `\n\nAnalyze the following certificate text extracted from a PDF document and return only valid JSON:\n\n---CERTIFICATE TEXT START---\n${pdfText}\n---CERTIFICATE TEXT END---`
      }
    ];
  } else {
    throw new Error("No valid document content provided. Please upload an image (JPG, PNG, WebP) or a PDF with readable text.");
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: messageContent
        }
      ]
    });

    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    let extractedData: Record<string, any>;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", textContent.text);
      throw new Error("Failed to parse extraction response as JSON");
    }

    const outcome = determineOutcome(extractedData, certificateType);
    
    // Use configuration-driven remedial action generation
    // Falls back to hardcoded logic if no classification codes are configured
    let remedialActions: ExtractionResult["remedialActions"];
    try {
      // Lookup certificate type ID from config table based on certificate type enum
      const certTypeConfig = await getCertificateTypeIdByCode(certificateType);
      remedialActions = await generateRemedialActionsFromConfig(
        extractedData, 
        certificateType, 
        certificate.propertyId,
        certTypeConfig?.id
      );
    } catch (configError) {
      console.warn("Config-driven action generation failed, falling back to hardcoded logic:", configError);
      remedialActions = generateRemedialActions(extractedData, certificateType, certificate.propertyId);
    }

    const result: ExtractionResult = {
      extractedData,
      outcome,
      remedialActions,
      certificateNumber: extractedData.certificateNumber || extractedData.reportNumber,
      issueDate: extractedData.issueDate || extractedData.assessmentDate || extractedData.surveyDate || extractedData.examinationDate,
      expiryDate: extractedData.expiryDate || extractedData.reviewDate || extractedData.nextExaminationDate,
      confidence: (fileBase64 || pdfText) ? 0.85 : 0.5
    };

    return result;
  } catch (error) {
    console.error("Claude extraction error:", error);
    throw error;
  }
}

export function determineOutcome(data: Record<string, any>, certificateType: string): ExtractionResult["outcome"] {
  // 1. Check explicit overall outcome/assessment fields first
  if (data.overallOutcome) {
    const outcome = data.overallOutcome.toUpperCase();
    if (outcome.includes("UNSATISFACTORY") || outcome.includes("FAIL") || outcome.includes("NOT SAFE")) {
      return "UNSATISFACTORY";
    }
    if (outcome.includes("SATISFACTORY") || outcome.includes("PASS") || outcome.includes("SAFE")) {
      return "SATISFACTORY";
    }
  }
  if (data.overallAssessment) {
    const assessment = data.overallAssessment.toUpperCase();
    if (assessment.includes("UNSATISFACTORY") || assessment.includes("FAIL") || assessment.includes("NOT SAFE")) {
      return "UNSATISFACTORY";
    }
  }
  
  // 2. Gas Safety specific checks (LGSR/CP12)
  if (certificateType === "GAS_SAFETY" || certificateType === "GAS") {
    // Check for unsafe appliances
    if (data.appliances && Array.isArray(data.appliances)) {
      const hasUnsafe = data.appliances.some((a: any) => {
        // Boolean safety fields
        if (a.applianceSafe === false || a.safe === false || a.safeToUse === false) return true;
        
        // Outcome field - use substring matching for composite values like "ID – Immediately Dangerous"
        const outcome = (a.outcome || '').toUpperCase();
        if (outcome.includes('FAIL') || outcome.includes('UNSAFE') ||
            outcome.includes('ID') || outcome.includes('IMMEDIATELY DANGEROUS') ||
            outcome.includes('AR') || outcome.includes('AT RISK') ||
            outcome.includes('NCS') || outcome.includes('NOT TO CURRENT STANDARD') ||
            outcome.includes('CONDEMNED')) return true;
        
        // Status field - use substring matching
        const status = (a.status || '').toUpperCase();
        if (status.includes('ID') || status.includes('IMMEDIATELY DANGEROUS') ||
            status.includes('AR') || status.includes('AT RISK') ||
            status.includes('NCS') || status.includes('NOT TO CURRENT STANDARD') ||
            status.includes('UNSAFE') || status.includes('CONDEMNED')) return true;
        
        // SafetyStatus field
        const safetyStatus = (a.safetyStatus || '').toUpperCase();
        if (safetyStatus.includes('FAIL') || safetyStatus.includes('AT RISK') ||
            safetyStatus.includes('ID') || safetyStatus.includes('UNSAFE')) return true;
        
        return false;
      });
      if (hasUnsafe) return "UNSATISFACTORY";
    }
    // Check for defects with dangerous classifications
    if (data.defects && Array.isArray(data.defects)) {
      const hasDangerous = data.defects.some((d: any) => {
        const classification = (d.classification || d.category || '').toUpperCase();
        return classification.includes("ID") || 
               classification.includes("IMMEDIATELY DANGEROUS") ||
               classification.includes("AR") ||
               classification.includes("AT RISK") ||
               classification.includes("NCS") ||
               classification.includes("CONDEMNED");
      });
      if (hasDangerous) return "UNSATISFACTORY";
    }
    if (data.safeToOperate === false) return "UNSATISFACTORY";
  }
  
  // 3. EICR specific checks (C1/C2/C3 codes)
  if (certificateType === "EICR" || certificateType === "ELECTRICAL") {
    // C1 = Danger present - immediate action required
    // C2 = Potentially dangerous - urgent attention required
    // FI = Further Investigation required
    if (data.c1Count > 0 || data.C1Count > 0) return "UNSATISFACTORY";
    if (data.c2Count > 0 || data.C2Count > 0) return "UNSATISFACTORY";
    if (data.fiCount > 0 || data.FICount > 0) return "UNSATISFACTORY";
    
    // Check observations array
    if (data.observations && Array.isArray(data.observations)) {
      const hasCritical = data.observations.some((o: any) => {
        const code = (o.code || o.classification || '').toUpperCase();
        return code === 'C1' || code === 'C2' || code === 'FI';
      });
      if (hasCritical) return "UNSATISFACTORY";
    }
    
    // Check defects array
    if (data.defects && Array.isArray(data.defects)) {
      const hasCritical = data.defects.some((d: any) => {
        const code = (d.code || d.severity || d.category || '').toUpperCase();
        return code === 'C1' || code === 'C2' || code === 'FI';
      });
      if (hasCritical) return "UNSATISFACTORY";
    }
  }
  
  // 4. Fire Risk Assessment specific checks
  if (certificateType === "FIRE_RISK_ASSESSMENT" || certificateType === "FRA") {
    const riskLevel = (data.riskLevel || data.overallRisk || '').toUpperCase();
    if (["HIGH", "INTOLERABLE", "SUBSTANTIAL", "CRITICAL"].includes(riskLevel)) {
      return "UNSATISFACTORY";
    }
    // Check for high priority findings
    if (data.findings && Array.isArray(data.findings)) {
      const hasHighPriority = data.findings.some((f: any) => {
        const priority = (f.priority || f.risk || '').toUpperCase();
        return priority === 'HIGH' || priority === 'IMMEDIATE' || priority === 'INTOLERABLE';
      });
      if (hasHighPriority) return "UNSATISFACTORY";
    }
  }
  
  // 5. Asbestos Survey specific checks
  if (certificateType === "ASBESTOS_SURVEY" || certificateType === "ASBESTOS") {
    if (data.asbestosPresent === true && data.condition === "POOR") return "UNSATISFACTORY";
    if (data.materials && Array.isArray(data.materials)) {
      const hasHighRisk = data.materials.some((m: any) => {
        const condition = (m.condition || '').toUpperCase();
        const risk = (m.risk || m.riskLevel || '').toUpperCase();
        return condition === 'POOR' || condition === 'DAMAGED' || risk === 'HIGH';
      });
      if (hasHighRisk) return "UNSATISFACTORY";
    }
  }
  
  // 6. Legionella Assessment specific checks
  if (certificateType === "LEGIONELLA_ASSESSMENT" || certificateType === "LEGIONELLA") {
    const riskLevel = (data.riskLevel || data.overallRisk || '').toUpperCase();
    if (["HIGH", "IMMEDIATE"].includes(riskLevel)) return "UNSATISFACTORY";
    if (data.recommendations && Array.isArray(data.recommendations)) {
      const hasImmediate = data.recommendations.some((r: any) => {
        const priority = (r.priority || '').toUpperCase();
        return priority === 'IMMEDIATE' || priority === 'HIGH';
      });
      if (hasImmediate) return "UNSATISFACTORY";
    }
  }
  
  // 7. Lift/LOLER specific checks
  if (certificateType === "LIFT_LOLER" || certificateType === "LIFT" || certificateType === "LOLER") {
    if (data.safeToOperate === false || data.safeForUse === false) return "UNSATISFACTORY";
    if (data.categoryA_Count > 0 || data.categorA_Count > 0) return "UNSATISFACTORY";
    if (data.defects && Array.isArray(data.defects)) {
      const hasCatA = data.defects.some((d: any) => {
        const category = (d.category || '').toUpperCase();
        return category === 'A' || category === 'CATEGORY A' || category === 'CAT A';
      });
      if (hasCatA) return "UNSATISFACTORY";
    }
  }
  
  // 8. Generic fallback checks for any certificate type
  if (data.c1Count > 0 || data.categorA_Count > 0) return "UNSATISFACTORY";
  if (data.c2Count > 0 || data.categoryB_Count > 0) return "UNSATISFACTORY";
  if (data.riskLevel && ["HIGH", "INTOLERABLE", "SUBSTANTIAL"].includes(data.riskLevel.toUpperCase())) {
    return "UNSATISFACTORY";
  }
  if (data.overallRisk === "HIGH") return "UNSATISFACTORY";
  
  // Check generic defects array
  if (data.defects && Array.isArray(data.defects)) {
    const hasCritical = data.defects.some((d: any) => {
      const classification = (d.classification || d.category || d.severity || '').toUpperCase();
      return classification.includes("IMMEDIATELY DANGEROUS") || 
             classification.includes("ID") ||
             classification === "A" ||
             classification === "C1" ||
             classification === "CRITICAL" ||
             classification === "DANGER";
    });
    if (hasCritical) return "UNSATISFACTORY";
  }
  
  // Check generic appliances array
  if (data.appliances && Array.isArray(data.appliances)) {
    const hasUnsafe = data.appliances.some((a: any) => 
      a.applianceSafe === false || a.safe === false || a.safeToUse === false
    );
    if (hasUnsafe) return "UNSATISFACTORY";
  }
  
  return "SATISFACTORY";
}

export function generateRemedialActions(
  data: Record<string, any>, 
  certificateType: string,
  propertyId: string
): ExtractionResult["remedialActions"] {
  const actions: ExtractionResult["remedialActions"] = [];

  if (certificateType === "GAS_SAFETY" && data.defects) {
    for (const defect of data.defects) {
      let severity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY" = "ROUTINE";
      if (defect.classification?.includes("ID") || defect.classification?.includes("Immediately Dangerous")) {
        severity = "IMMEDIATE";
      } else if (defect.classification?.includes("AR") || defect.classification?.includes("At Risk")) {
        severity = "URGENT";
      }
      
      actions.push({
        code: defect.classification || "GAS",
        description: defect.description,
        location: defect.location || "Unknown",
        severity,
        costEstimate: severity === "IMMEDIATE" ? "£200-500" : "£100-300"
      });
    }
  }

  // Handle EICR - check both observations and defects arrays, and handle auto-detect (OTHER with EICR document type)
  const isEICR = certificateType === "EICR" || 
    (certificateType === "OTHER" && data.documentType?.toLowerCase().includes("eicr")) ||
    (certificateType === "OTHER" && data.documentType?.toLowerCase().includes("electrical installation"));
  
  if (isEICR) {
    // Handle observations array (traditional format)
    if (data.observations) {
      for (const obs of data.observations) {
        let severity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY" = "ROUTINE";
        if (obs.code === "C1") {
          severity = "IMMEDIATE";
        } else if (obs.code === "C2") {
          severity = "URGENT";
        } else if (obs.code === "C3") {
          severity = "ADVISORY";
        }
        
        if (obs.code === "C1" || obs.code === "C2" || obs.code === "C3") {
          actions.push({
            code: obs.code,
            description: obs.description,
            location: obs.location || "Electrical installation",
            severity,
            costEstimate: severity === "IMMEDIATE" ? "£150-400" : "£80-250"
          });
        }
      }
    }
    
    // Handle defects array (alternate format from AI)
    if (data.defects) {
      for (const defect of data.defects) {
        const code = defect.severity || defect.code || "";
        let severity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY" = "ROUTINE";
        if (code === "C1") {
          severity = "IMMEDIATE";
        } else if (code === "C2") {
          severity = "URGENT";
        } else if (code === "C3") {
          severity = "ADVISORY";
        }
        
        if (code === "C1" || code === "C2" || code === "C3") {
          actions.push({
            code,
            description: defect.description,
            location: defect.location || "Electrical installation",
            severity,
            costEstimate: severity === "IMMEDIATE" ? "£150-400" : "£80-250"
          });
        }
      }
    }
    
    // Handle defectsAndObservations array (another alternate format)
    if (data.defectsAndObservations) {
      for (const item of data.defectsAndObservations) {
        const code = item.code || item.severity || "";
        let severity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY" = "ROUTINE";
        if (code === "C1") {
          severity = "IMMEDIATE";
        } else if (code === "C2") {
          severity = "URGENT";
        } else if (code === "C3") {
          severity = "ADVISORY";
        }
        
        if (code === "C1" || code === "C2" || code === "C3") {
          actions.push({
            code,
            description: item.description,
            location: item.location || "Electrical installation",
            severity,
            costEstimate: severity === "IMMEDIATE" ? "£150-400" : "£80-250"
          });
        }
      }
    }
  }

  if (certificateType === "FIRE_RISK" && data.findings) {
    for (const finding of data.findings) {
      if (finding.priority === "HIGH" || finding.priority === "MEDIUM") {
        actions.push({
          code: `FRA-${finding.itemNumber || ""}`,
          description: finding.description + (finding.recommendation ? ` - ${finding.recommendation}` : ""),
          location: finding.location || "Building",
          severity: finding.priority === "HIGH" ? "URGENT" : "ROUTINE",
          costEstimate: finding.priority === "HIGH" ? "£300-1000" : "£100-500"
        });
      }
    }
  }

  if (certificateType === "ASBESTOS" && data.acmItems) {
    for (const item of data.acmItems) {
      if (item.condition === "POOR" || item.condition === "DAMAGED" || item.recommendation?.toLowerCase().includes("remove")) {
        actions.push({
          code: `ACM-${item.itemId || ""}`,
          description: `${item.material} at ${item.location} - ${item.recommendation || "requires attention"}`,
          location: item.location || "Property",
          severity: item.condition === "DAMAGED" ? "IMMEDIATE" : "URGENT",
          costEstimate: "£500-2000"
        });
      }
    }
  }

  if (certificateType === "LIFT" && data.defects) {
    for (const defect of data.defects) {
      if (defect.category === "A" || defect.category === "B") {
        actions.push({
          code: `LIFT-${defect.category}`,
          description: defect.description,
          location: data.liftLocation || "Lift",
          severity: defect.category === "A" ? "IMMEDIATE" : "URGENT",
          costEstimate: "£200-1500"
        });
      }
    }
  }

  // Handle generic recommendations/findings if present
  if (data.recommendations && Array.isArray(data.recommendations)) {
    for (const rec of data.recommendations) {
      const description = typeof rec === 'string' ? rec : rec.description || rec.recommendation;
      const priority = typeof rec === 'object' ? rec.priority : undefined;
      if (description && !actions.some(a => a.description === description)) {
        actions.push({
          code: `REC-${actions.length + 1}`,
          description: description,
          location: (typeof rec === 'object' ? rec.location : undefined) || "Property",
          severity: priority?.toUpperCase() === "HIGH" || priority?.toUpperCase() === "IMMEDIATE" ? "URGENT" : "ROUTINE",
          costEstimate: "TBD"
        });
      }
    }
  }

  // Fallback: If outcome is UNSATISFACTORY but no actions were generated, create a generic action
  const outcome = determineOutcome(data, certificateType);
  if (outcome === "UNSATISFACTORY" && actions.length === 0) {
    const docType = data.documentType || certificateType || "Certificate";
    actions.push({
      code: `REVIEW-${certificateType}`,
      description: `${docType} marked as unsatisfactory - requires review and remediation`,
      location: "Property",
      severity: "URGENT",
      costEstimate: "TBD - requires assessment"
    });
  }

  return actions;
}

// Configuration-driven remedial action generation that uses classification codes from database
// Handles all certificate types: Gas, EICR, Fire, Asbestos, Legionella, LOLER, Playground, Tree, HRB, etc.
export async function generateRemedialActionsFromConfig(
  data: Record<string, any>, 
  certificateType: string,
  propertyId: string,
  certificateTypeId?: string
): Promise<ExtractionResult["remedialActions"]> {
  // Load all classification codes (not filtered by certificate type for flexibility)
  const classificationCodes = await storage.listClassificationCodes(certificateTypeId ? { certificateTypeId } : undefined);
  const codeMap = new Map(classificationCodes.map(c => [c.code, c]));
  
  const actions: ExtractionResult["remedialActions"] = [];
  
  // Helper to format cost estimate from config (stored in pence)
  const formatCostEstimate = (config: typeof classificationCodes[0] | undefined): string => {
    if (config?.costEstimateLow && config?.costEstimateHigh) {
      return `£${(config.costEstimateLow / 100).toFixed(0)}-${(config.costEstimateHigh / 100).toFixed(0)}`;
    }
    return "TBD";
  };
  
  // Helper to get severity from config or default
  const getSeverity = (config: typeof classificationCodes[0] | undefined, defaultSeverity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY"): "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY" => {
    if (config?.actionSeverity) {
      const severity = config.actionSeverity.toUpperCase();
      if (severity === "IMMEDIATE" || severity === "URGENT" || severity === "ROUTINE" || severity === "ADVISORY") {
        return severity as "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY";
      }
    }
    return defaultSeverity;
  };
  
  // Helper to check if action should be auto-created
  const shouldCreateAction = (config: typeof classificationCodes[0] | undefined): boolean => {
    if (!config) return true; // Default to creating action if no config
    return config.autoCreateAction !== false;
  };
  
  // Helper to add action from config
  const addActionFromConfig = (code: string, description: string, location: string, defaultSeverity: "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY") => {
    const config = codeMap.get(code);
    if (!shouldCreateAction(config)) return;
    
    actions.push({
      code,
      description: config?.actionRequired || description,
      location,
      severity: getSeverity(config, defaultSeverity),
      costEstimate: formatCostEstimate(config)
    });
  };
  
  // ========== GAS SAFETY (CP12/LGSR) - ID/AR/NCS codes ==========
  const gasTypes = ["GAS", "GAS_SAFETY", "GAS_SVC", "BOILER_SVC"];
  if (gasTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const defects = data.defects || data.observations || [];
    for (const defect of defects) {
      const classification = defect.classification?.toUpperCase() || defect.code?.toUpperCase() || "";
      let code = "NCS"; // Default
      if (classification.includes("ID") || classification.includes("IMMEDIATELY DANGEROUS")) code = "ID";
      else if (classification.includes("AR") || classification.includes("AT RISK")) code = "AR";
      else if (classification.includes("NCS") || classification.includes("NOT TO CURRENT")) code = "NCS";
      
      addActionFromConfig(code, defect.description || `Gas defect: ${classification}`, defect.location || "Gas appliance", code === "ID" ? "IMMEDIATE" : code === "AR" ? "URGENT" : "ADVISORY");
    }
    
    // Check overall result
    const result = (data.overallResult || data.result || "").toUpperCase();
    if (result === "FAIL" || result === "AT_RISK" || result.includes("DANGEROUS")) {
      const config = codeMap.get(result === "FAIL" ? "ID" : "AR");
      if (shouldCreateAction(config) && actions.length === 0) {
        addActionFromConfig("AR", "Gas safety check requires remediation", "Property", "URGENT");
      }
    }
  }
  
  // ========== EICR - C1/C2/C3/FI codes ==========
  const eicrTypes = ["EICR", "ELECTRICAL", "PIR"];
  if (eicrTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const observations = data.observations || data.defects || data.defectsAndObservations || [];
    for (const obs of observations) {
      const code = (obs.code || obs.classification || obs.severity || "").toUpperCase();
      if (code === "C1" || code === "C2" || code === "C3" || code === "FI") {
        const defaultSeverity = code === "C1" ? "IMMEDIATE" : code === "C2" ? "URGENT" : code === "FI" ? "ROUTINE" : "ADVISORY";
        addActionFromConfig(code, obs.description || `EICR observation code ${code}`, obs.location || "Electrical installation", defaultSeverity);
      }
    }
    
    // Check overall assessment
    const assessment = (data.overallAssessment || data.outcome || "").toUpperCase();
    if (assessment === "UNSATISFACTORY" && actions.length === 0) {
      addActionFromConfig("C2", "EICR marked unsatisfactory - requires investigation", "Electrical installation", "URGENT");
    }
  }
  
  // ========== FIRE RISK ASSESSMENT - Risk rating codes ==========
  const fraTypes = ["FRA", "FIRE_RISK", "FIRE"];
  if (fraTypes.some(t => certificateType.toUpperCase().includes(t))) {
    // Overall risk rating
    const riskLevel = (data.overallRiskRating || data.riskLevel || data.riskRating || "").toUpperCase();
    if (riskLevel) {
      const riskCodes = ["TRIVIAL", "TOLERABLE", "MODERATE", "SUBSTANTIAL", "INTOLERABLE"];
      if (riskCodes.includes(riskLevel)) {
        const defaultSeverity = riskLevel === "INTOLERABLE" ? "IMMEDIATE" : riskLevel === "SUBSTANTIAL" ? "URGENT" : riskLevel === "MODERATE" ? "ROUTINE" : "ADVISORY";
        addActionFromConfig(riskLevel, `Fire risk rated ${riskLevel}`, "Building", defaultSeverity);
      }
    }
    
    // Individual findings
    const findings = data.findings || data.recommendations || data.actions || [];
    for (const finding of findings) {
      const priority = (finding.priority || finding.severity || "").toUpperCase();
      if (priority === "HIGH" || priority === "INTOLERABLE" || priority === "SUBSTANTIAL") {
        addActionFromConfig("SUBSTANTIAL", finding.description || finding.recommendation || "Fire risk finding", finding.location || "Building", "URGENT");
      } else if (priority === "MEDIUM" || priority === "MODERATE") {
        addActionFromConfig("MODERATE", finding.description || finding.recommendation || "Fire risk finding", finding.location || "Building", "ROUTINE");
      }
    }
  }
  
  // ========== ASBESTOS - ACM risk codes ==========
  const asbestosTypes = ["ASBESTOS", "ACM", "REFURBISHMENT", "DEMOLITION"];
  if (asbestosTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const acmItems = data.acmItems || data.materials || data.findings || [];
    for (const item of acmItems) {
      const risk = (item.riskLevel || item.risk || item.priority || "").toUpperCase();
      let code = "ACM_LOW";
      if (risk.includes("CRITICAL") || risk.includes("URGENT")) code = "ACM_CRITICAL";
      else if (risk.includes("HIGH")) code = "ACM_HIGH";
      else if (risk.includes("MEDIUM") || risk.includes("MODERATE")) code = "ACM_MEDIUM";
      
      const defaultSeverity = code === "ACM_CRITICAL" ? "IMMEDIATE" : code === "ACM_HIGH" ? "URGENT" : code === "ACM_MEDIUM" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, item.description || `ACM: ${item.material || "Suspected asbestos"}`, item.location || "Property", defaultSeverity);
    }
  }
  
  // ========== LEGIONELLA / WATER SAFETY - LEG codes ==========
  const legionellaTypes = ["LEGIONELLA", "LRA", "WATER", "TMV"];
  if (legionellaTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const riskLevel = (data.overallRisk || data.riskLevel || data.riskRating || "").toUpperCase();
    if (riskLevel) {
      let code = "LEG_LOW";
      if (riskLevel.includes("OUTBREAK") || riskLevel.includes("CRITICAL")) code = "LEG_OUTBREAK";
      else if (riskLevel.includes("HIGH")) code = "LEG_HIGH";
      else if (riskLevel.includes("MEDIUM") || riskLevel.includes("MODERATE")) code = "LEG_MEDIUM";
      
      const defaultSeverity = code === "LEG_OUTBREAK" ? "IMMEDIATE" : code === "LEG_HIGH" ? "URGENT" : code === "LEG_MEDIUM" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, `Legionella risk: ${riskLevel}`, "Water system", defaultSeverity);
    }
    
    // Temperature failures
    const temperatureIssues = data.temperatureFailures || data.failures || [];
    for (const issue of temperatureIssues) {
      addActionFromConfig("LEG_MEDIUM", issue.description || "Temperature out of spec", issue.location || "Water outlet", "ROUTINE");
    }
  }
  
  // ========== LOLER / LIFT INSPECTION - LIFT codes ==========
  const lolerTypes = ["LOLER", "LIFT", "ELEVATOR", "PELI", "PASSENGER_LIFT"];
  if (lolerTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const defects = data.defects || data.observations || data.findings || [];
    for (const defect of defects) {
      const severity = (defect.severity || defect.classification || defect.category || "").toUpperCase();
      let code = "LIFT_MINOR";
      if (severity.includes("DANGEROUS") || severity.includes("CRITICAL") || severity.includes("PROHIBITION")) code = "LIFT_DANGEROUS";
      else if (severity.includes("SIGNIFICANT") || severity.includes("MAJOR")) code = "LIFT_SIGNIFICANT";
      
      const defaultSeverity = code === "LIFT_DANGEROUS" ? "IMMEDIATE" : code === "LIFT_SIGNIFICANT" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, defect.description || `Lift defect: ${severity}`, defect.location || "Lift", defaultSeverity);
    }
    
    // Check overall result
    const result = (data.overallResult || data.outcome || "").toUpperCase();
    if (result.includes("FAIL") || result.includes("DEFECT") || result.includes("PROHIBITION")) {
      if (actions.length === 0) {
        addActionFromConfig("LIFT_SIGNIFICANT", "Lift inspection identified defects", "Lift", "ROUTINE");
      }
    }
  }
  
  // ========== FIRE DOOR INSPECTION - FD codes ==========
  const fireDoorTypes = ["FIRE_DOOR", "FDI"];
  if (fireDoorTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const defects = data.defects || data.findings || data.issues || [];
    for (const defect of defects) {
      const severity = (defect.severity || defect.classification || "").toUpperCase();
      let code = "FD_MINOR";
      if (severity.includes("CRITICAL") || severity.includes("FAIL") || severity.includes("REPLACE")) code = "FD_CRITICAL";
      else if (severity.includes("MAJOR") || severity.includes("SIGNIFICANT")) code = "FD_FAIL";
      else if (severity.includes("MODERATE") || severity.includes("REPAIR")) code = "FD_SIGNIFICANT";
      
      const defaultSeverity = code === "FD_CRITICAL" ? "IMMEDIATE" : code === "FD_FAIL" ? "URGENT" : code === "FD_SIGNIFICANT" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, defect.description || `Fire door defect`, defect.location || defect.doorId || "Fire door", defaultSeverity);
    }
    
    // Overall result
    const result = (data.overallResult || data.outcome || "").toUpperCase();
    if (result === "FAIL" && actions.length === 0) {
      addActionFromConfig("FD_FAIL", "Fire door failed inspection", "Fire door", "URGENT");
    }
  }
  
  // ========== FIRE ALARM - FA codes ==========
  const fireAlarmTypes = ["FIRE_ALARM", "AFD"];
  if (fireAlarmTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const faults = data.faults || data.defects || data.failures || [];
    for (const fault of faults) {
      const severity = (fault.severity || fault.type || "").toUpperCase();
      let code = "FA_MINOR";
      if (severity.includes("CRITICAL") || severity.includes("SYSTEM")) code = "FA_CRITICAL";
      else if (severity.includes("FAULT") || severity.includes("FAIL")) code = "FA_FAULT";
      
      const defaultSeverity = code === "FA_CRITICAL" ? "IMMEDIATE" : code === "FA_FAULT" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, fault.description || `Fire alarm fault`, fault.location || "Fire alarm system", defaultSeverity);
    }
    
    const result = (data.overallResult || data.outcome || "").toUpperCase();
    if ((result === "FAIL" || result.includes("DEFECT")) && actions.length === 0) {
      addActionFromConfig("FA_FAULT", "Fire alarm system fault detected", "Fire alarm system", "ROUTINE");
    }
  }
  
  // ========== EMERGENCY LIGHTING - EMLT codes ==========
  const emergencyLightTypes = ["EMERGENCY_LIGHTING", "EML"];
  if (emergencyLightTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const failures = data.failures || data.defects || data.faults || [];
    for (const failure of failures) {
      const isCritical = (failure.affectsEscape || failure.critical || "").toString().toLowerCase() === "true";
      const code = isCritical ? "EMLT_CRITICAL" : "EMLT_FAIL";
      const defaultSeverity = isCritical ? "IMMEDIATE" : "URGENT";
      addActionFromConfig(code, failure.description || "Emergency light failure", failure.location || "Emergency lighting", defaultSeverity);
    }
  }
  
  // ========== PLAYGROUND INSPECTION - PLAY codes ==========
  const playgroundTypes = ["PLAYGROUND", "PLAY"];
  if (playgroundTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const defects = data.defects || data.findings || data.issues || [];
    for (const defect of defects) {
      const risk = (defect.riskLevel || defect.severity || "").toUpperCase();
      let code = "PLAY_LOW";
      if (risk.includes("CRITICAL") || risk.includes("VERY HIGH")) code = "PLAY_CRITICAL";
      else if (risk.includes("HIGH")) code = "PLAY_HIGH";
      else if (risk.includes("MEDIUM") || risk.includes("MODERATE")) code = "PLAY_MEDIUM";
      
      const defaultSeverity = code === "PLAY_CRITICAL" ? "IMMEDIATE" : code === "PLAY_HIGH" ? "URGENT" : code === "PLAY_MEDIUM" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, defect.description || `Playground defect: ${risk}`, defect.location || defect.equipment || "Play equipment", defaultSeverity);
    }
  }
  
  // ========== TREE SURVEY - TREE codes ==========
  const treeTypes = ["TREE", "ARBORICULTURAL"];
  if (treeTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const trees = data.trees || data.findings || data.recommendations || [];
    for (const tree of trees) {
      const priority = (tree.priority || tree.urgency || tree.risk || "").toUpperCase();
      let code = "TREE_ROUTINE";
      if (priority.includes("DANGEROUS") || priority.includes("FELL") || priority.includes("IMMEDIATE")) code = "TREE_DANGEROUS";
      else if (priority.includes("URGENT")) code = "TREE_URGENT";
      else if (priority.includes("PRIORITY") || priority.includes("HIGH")) code = "TREE_PRIORITY";
      
      const defaultSeverity = code === "TREE_DANGEROUS" ? "IMMEDIATE" : code === "TREE_URGENT" ? "URGENT" : code === "TREE_PRIORITY" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, tree.description || tree.recommendation || `Tree work: ${priority}`, tree.location || tree.treeId || "Tree", defaultSeverity);
    }
  }
  
  // ========== EPC - EPC codes ==========
  const epcTypes = ["EPC", "ENERGY"];
  if (epcTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const rating = (data.currentRating || data.epcRating || data.rating || "").toUpperCase();
    if (rating && rating.length === 1 && "ABCDEFG".includes(rating)) {
      const code = `EPC_${rating}`;
      const config = codeMap.get(code);
      if (shouldCreateAction(config)) {
        // Only create action for E, F, G ratings (below minimum standards)
        if (rating === "E" || rating === "F" || rating === "G") {
          const defaultSeverity = rating === "G" ? "IMMEDIATE" : rating === "F" ? "URGENT" : "ROUTINE";
          addActionFromConfig(code, `EPC rating ${rating} - improvement required`, "Property", defaultSeverity);
        }
      }
    }
  }
  
  // ========== HHSRS / HOUSING HEALTH - HHSRS codes ==========
  const hhsrsTypes = ["HHSRS", "HOUSING", "DAMP", "MOULD"];
  if (hhsrsTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const hazards = data.hazards || data.findings || data.issues || [];
    for (const hazard of hazards) {
      const category = (hazard.category || hazard.band || hazard.severity || "").toUpperCase();
      let code = "HHSRS_CAT2_LOW";
      if (category.includes("CAT1") || category.includes("CATEGORY 1") || category.includes("CRITICAL")) code = "HHSRS_CAT1";
      else if (category.includes("HIGH") || category.includes("BAND A") || category.includes("BAND B")) code = "HHSRS_CAT2_HIGH";
      else if (category.includes("MEDIUM") || category.includes("BAND C") || category.includes("BAND D")) code = "HHSRS_CAT2_MED";
      
      const defaultSeverity = code === "HHSRS_CAT1" ? "IMMEDIATE" : code === "HHSRS_CAT2_HIGH" ? "URGENT" : code === "HHSRS_CAT2_MED" ? "ROUTINE" : "ADVISORY";
      addActionFromConfig(code, hazard.description || `HHSRS hazard: ${hazard.type || category}`, hazard.location || "Property", defaultSeverity);
    }
    
    // Damp/mould specific
    const dampLevel = (data.dampLevel || data.mouldLevel || data.severity || "").toUpperCase();
    if (dampLevel) {
      let code = "DAMP_MINOR";
      if (dampLevel.includes("CRITICAL") || dampLevel.includes("SEVERE")) code = "DAMP_CRITICAL";
      else if (dampLevel.includes("MAJOR") || dampLevel.includes("HIGH")) code = "DAMP_SEVERE";
      else if (dampLevel.includes("MODERATE") || dampLevel.includes("MEDIUM")) code = "DAMP_MODERATE";
      
      if (code !== "DAMP_MINOR") {
        const defaultSeverity = code === "DAMP_CRITICAL" ? "IMMEDIATE" : code === "DAMP_SEVERE" ? "URGENT" : "ROUTINE";
        addActionFromConfig(code, `Damp/mould issue: ${dampLevel}`, data.location || "Property", defaultSeverity);
      }
    }
  }
  
  // ========== SPRINKLER SYSTEM - SPRINK codes ==========
  const sprinklerTypes = ["SPRINKLER"];
  if (sprinklerTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const result = (data.overallResult || data.outcome || "").toUpperCase();
    if (result.includes("FAIL") || result.includes("CRITICAL")) {
      addActionFromConfig("SPRINK_CRITICAL", "Sprinkler system failure", "Sprinkler system", "IMMEDIATE");
    } else if (result.includes("DEFECT")) {
      addActionFromConfig("SPRINK_DEFECT", "Sprinkler system defect", "Sprinkler system", "ROUTINE");
    }
  }
  
  // ========== AOV / SMOKE VENTILATION - AOV codes ==========
  const aovTypes = ["AOV", "SMOKE_VENT"];
  if (aovTypes.some(t => certificateType.toUpperCase().includes(t))) {
    const result = (data.overallResult || data.outcome || "").toUpperCase();
    if (result.includes("FAIL") || result.includes("CRITICAL")) {
      addActionFromConfig("AOV_CRITICAL", "AOV system failure", "AOV system", "IMMEDIATE");
    } else if (result.includes("DEFECT")) {
      addActionFromConfig("AOV_DEFECT", "AOV system defect", "AOV system", "ROUTINE");
    }
  }
  
  // ========== GENERIC FALLBACK - For any unhandled certificate type ==========
  const outcome = determineOutcome(data, certificateType);
  if (outcome === "UNSATISFACTORY" && actions.length === 0) {
    const docType = data.documentType || certificateType || "Certificate";
    const fallbackConfig = codeMap.get("UNSATISFACTORY") || codeMap.get("FAIL") || codeMap.get("REVIEW");
    
    actions.push({
      code: `REVIEW-${certificateType}`,
      description: fallbackConfig?.actionRequired || `${docType} marked as ${outcome.toLowerCase()} - requires review and remediation`,
      location: "Property",
      severity: getSeverity(fallbackConfig, "URGENT"),
      costEstimate: formatCostEstimate(fallbackConfig)
    });
  }
  
  return actions;
}

// Normalize raw extraction output to the format expected by the human review form
export function normalizeExtractionOutput(rawOutput: Record<string, any>): Record<string, any> {
  // Parse address from string if needed
  const parseAddress = (addressString: string | undefined | null): { address_line_1: string; address_line_2?: string; city?: string; postcode?: string } => {
    if (!addressString) return { address_line_1: '' };
    
    // Try to extract postcode (UK format: e.g., "NG3 2DQ", "B5 4RN")
    const postcodeMatch = addressString.match(/([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})/i);
    const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : undefined;
    
    // Remove postcode from address to parse the rest
    let addressWithoutPostcode = postcode ? addressString.replace(postcode, '').trim() : addressString;
    addressWithoutPostcode = addressWithoutPostcode.replace(/,\s*$/, '').trim();
    
    // Split by comma and try to identify city (usually last part before postcode)
    const parts = addressWithoutPostcode.split(',').map(p => p.trim()).filter(p => p);
    
    let address_line_1 = parts[0] || '';
    let address_line_2 = '';
    let city = '';
    
    if (parts.length >= 3) {
      address_line_1 = parts.slice(0, -1).join(', ');
      city = parts[parts.length - 1];
    } else if (parts.length === 2) {
      address_line_1 = parts[0];
      city = parts[1];
    }
    
    return { address_line_1, address_line_2, city, postcode };
  };
  
  // Get address from various possible fields
  const rawAddress = rawOutput.installationAddress || rawOutput.propertyAddress || rawOutput.premisesAddress;
  const parsedAddress = typeof rawAddress === 'string' ? parseAddress(rawAddress) : 
    (typeof rawAddress === 'object' ? rawAddress : { address_line_1: '' });
  
  // Get inspector/engineer details from various possible fields
  const rawEngineer = rawOutput.engineer || rawOutput.inspector || rawOutput.assessor || rawOutput.surveyor || {};
  
  // Get outcome from various possible fields
  const rawOutcome = rawOutput.overallOutcome || rawOutput.overallAssessment || rawOutput.outcome || rawOutput.riskLevel;
  
  // Get findings/observations/defects
  const rawFindings = rawOutput.defects || rawOutput.observations || rawOutput.findings || rawOutput.acmItems || [];
  const rawRemedialActions = rawOutput.recommendations || rawOutput.remedialActions || [];
  
  return {
    property: {
      address_line_1: parsedAddress.address_line_1 || '',
      address_line_2: parsedAddress.address_line_2 || '',
      city: parsedAddress.city || '',
      postcode: parsedAddress.postcode || '',
    },
    inspection: {
      date: rawOutput.issueDate || rawOutput.assessmentDate || rawOutput.surveyDate || '',
      next_due_date: rawOutput.expiryDate || rawOutput.reviewDate || '',
      outcome: rawOutcome || '',
      certificate_number: rawOutput.certificateNumber || rawOutput.reportNumber || '',
    },
    engineer: {
      name: rawEngineer.name || '',
      company: rawEngineer.company || '',
      registration_id: rawEngineer.gasSafeNumber || rawEngineer.registrationNumber || '',
      registration_type: rawEngineer.qualifications || '',
    },
    findings: {
      observations: Array.isArray(rawFindings) ? rawFindings.map((f: any) => ({
        description: f.description || f.finding || JSON.stringify(f),
        code: f.code || f.classification || f.priority || '',
        location: f.location || '',
      })) : [],
      remedial_actions: Array.isArray(rawRemedialActions) ? rawRemedialActions.map((a: any) => ({
        description: a.description || a.recommendation || JSON.stringify(a),
        priority: a.priority || a.severity || '',
      })) : [],
    },
    // Keep original raw data for reference
    _raw: rawOutput,
  };
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await getPdfjs();
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      standardFontDataUrl,
      useSystemFonts: true
    });
    const pdfDocument = await loadingTask.promise;
    
    const textParts: string[] = [];
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      textParts.push(pageText);
    }
    
    const fullText = textParts.join('\n\n');
    console.log(`Successfully extracted ${fullText.length} characters from PDF (${pdfDocument.numPages} pages)`);
    return fullText;
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return "";
  }
}

// Maps certificate type to component type for auto-creation
const CERT_TYPE_TO_COMPONENT_CATEGORY: Record<string, string> = {
  'GAS_SAFETY': 'HEATING',
  'EICR': 'ELECTRICAL',
  'EPC': 'HEATING',
  'FIRE_RISK_ASSESSMENT': 'FIRE_SAFETY',
  'LEGIONELLA_ASSESSMENT': 'WATER',
  'ASBESTOS_SURVEY': 'STRUCTURE',
  'LIFT_LOLER': 'ACCESS',
};

async function autoCreateComponentFromCertificate(
  certificate: any,
  certificateType: string,
  extractedData: Record<string, any>
): Promise<void> {
  console.log(`[Component Auto-Create] Starting for cert type: ${certificateType}, propertyId: ${certificate.propertyId}`);
  try {
    const category = CERT_TYPE_TO_COMPONENT_CATEGORY[certificateType];
    if (!category) {
      console.log(`[Component Auto-Create] No component category mapping for certificate type: ${certificateType}`);
      return;
    }
    console.log(`[Component Auto-Create] Mapped to category: ${category}`);
    
    // Find matching component type
    const matchingTypes = await db.select().from(componentTypes)
      .where(eq(componentTypes.category, category as any));
    
    if (matchingTypes.length === 0) {
      console.log(`[Component Auto-Create] No component types found for category: ${category}. Skipping.`);
      return;
    }
    console.log(`[Component Auto-Create] Found ${matchingTypes.length} component types for category ${category}`);
    
    // Use first matching type or find specific one based on extraction
    let compType = matchingTypes[0];
    
    // Try to find more specific type based on extracted data
    if (certificateType === 'GAS_SAFETY' && extractedData?.appliances) {
      const boilerType = matchingTypes.find(t => t.name.toLowerCase().includes('boiler'));
      if (boilerType) compType = boilerType;
    }
    
    // Get appliance/equipment info from extraction - check multiple field names
    const appliances = extractedData?.appliances || extractedData?.applianceDetails || [];
    const equipmentInfo = extractedData?.equipment || extractedData?.installations || 
                          extractedData?.systemDetails || extractedData?.testResults || [];
    
    console.log(`[Component Auto-Create] Found appliances: ${JSON.stringify(appliances).substring(0, 200)}`);
    console.log(`[Component Auto-Create] Found equipment: ${JSON.stringify(equipmentInfo).substring(0, 200)}`);
    
    // Create components for each identified appliance
    // If no specific equipment found, create a single placeholder component for the property
    const items = appliances.length > 0 ? appliances : 
                  (Array.isArray(equipmentInfo) && equipmentInfo.length > 0) ? equipmentInfo : 
                  [{ _placeholder: true }];
    console.log(`[Component Auto-Create] Processing ${items.length} items`);
    
    for (const item of items) {
      // Check if component already exists to avoid duplicates
      let existing: any[] = [];
      if (item.serialNumber) {
        existing = await db.select().from(components)
          .where(and(
            eq(components.propertyId, certificate.propertyId),
            eq(components.componentTypeId, compType.id),
            eq(components.serialNumber, item.serialNumber)
          ));
      } else {
        existing = await db.select().from(components)
          .where(and(
            eq(components.propertyId, certificate.propertyId),
            eq(components.componentTypeId, compType.id)
          ));
      }
      
      if (existing.length === 0) {
        // Extract manufacturer and model properly - don't use certificate type as model
        const manufacturer = item.manufacturer || item.make || null;
        // Only use model/type if it's actual equipment info, not a certificate type
        const modelValue = item.model || 
                          (item.type && !['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 
                           'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER'].includes(item.type) 
                           ? item.type : null);
        
        console.log(`[Component Auto-Create] Creating new component: type=${compType.name}, location=${item.location || item.room || 'N/A'}`);
        const created = await storage.createComponent({
          propertyId: certificate.propertyId,
          componentTypeId: compType.id,
          manufacturer: manufacturer,
          model: modelValue,
          serialNumber: item.serialNumber || null,
          location: item.location || item.room || null,
          condition: null,
          isActive: true,
          source: 'AUTO_EXTRACTED',
          needsVerification: true,
        });
        console.log(`[Component Auto-Create] SUCCESS - Created component: ${compType.name} with ID ${created.id}`);
      } else {
        console.log(`[Component Auto-Create] Component already exists, skipping: ${compType.name}`);
      }
    }
    console.log(`[Component Auto-Create] Completed for certificate type ${certificateType}`);
  } catch (error) {
    console.error('[Component Auto-Create] ERROR:', error);
  }
}

async function autoCreateContractorFromExtraction(
  organisationId: string,
  extractedData: Record<string, any>
): Promise<void> {
  try {
    const engineerInfo = extractedData?.engineer || extractedData?.inspector || 
                         extractedData?.assessor || extractedData?.examiner;
    
    if (!engineerInfo) return;
    
    const companyName = engineerInfo.company || engineerInfo.employerName || 
                        extractedData?.gasBusinessName || extractedData?.companyName;
    const engineerName = engineerInfo.name || engineerInfo.fullName || engineerInfo.engineerName;
    const registrationNumber = engineerInfo.registrationNumber || engineerInfo.gasRegNo ||
                               engineerInfo.napit || engineerInfo.nicEic;
    const contactEmail = engineerInfo.email || engineerInfo.contactEmail || '';
    
    if (!companyName && !engineerName) return;
    
    const name = companyName || engineerName;
    
    // Check if contractor already exists
    const existingContractors = await db.select().from(contractors)
      .where(eq(contractors.organisationId, organisationId));
    
    const existing = existingContractors.find(c => 
      c.companyName.toLowerCase().includes(name.toLowerCase()) ||
      (registrationNumber && c.registrationNumber === registrationNumber)
    );
    
    if (!existing) {
      await storage.createContractor({
        organisationId,
        companyName: name.substring(0, 255),
        tradeType: 'GENERAL',
        contactEmail: contactEmail || 'pending@verification.required',
        registrationNumber: registrationNumber || null,
        gasRegistration: engineerInfo.gasRegNo || null,
        electricalRegistration: engineerInfo.napit || engineerInfo.nicEic || null,
        status: 'PENDING',
      });
      console.log(`Auto-created contractor: ${name}`);
    }
  } catch (error) {
    console.error('Error auto-creating contractor:', error);
  }
}

export async function processExtractionAndSave(
  certificateId: string,
  certificateType: string,
  fileBase64?: string,
  mimeType?: string,
  pdfBuffer?: Buffer
): Promise<void> {
  const certificate = await storage.getCertificate(certificateId);
  if (!certificate) return;

  try {
    await storage.updateCertificate(certificateId, { status: "PROCESSING" });
    
    let effectiveBuffer = pdfBuffer;
    
    if (!effectiveBuffer && fileBase64) {
      try {
        effectiveBuffer = Buffer.from(fileBase64, 'base64');
        logger.info({ certificateId }, "Created buffer from fileBase64 for tiered extraction");
      } catch (e) {
        logger.warn({ certificateId, error: e }, "Failed to create buffer from fileBase64");
      }
    }
    
    if (!effectiveBuffer && certificate.storageKey) {
      try {
        const { readFile } = await import("./replit_integrations/object_storage/objectStorage");
        const storedData = await readFile(certificate.storageKey);
        if (storedData) {
          effectiveBuffer = Buffer.from(storedData);
          logger.info({ certificateId, storageKey: certificate.storageKey }, "Loaded PDF from object storage for tiered extraction");
        }
      } catch (e) {
        logger.warn({ certificateId, error: e }, "Failed to load PDF from object storage");
      }
    }
    
    if (!effectiveBuffer || effectiveBuffer.length === 0) {
      const errorMessage = "No document buffer available from any source";
      logger.error({ 
        certificateId, 
        hasPdfBuffer: !!pdfBuffer, 
        hasFileBase64: !!fileBase64, 
        hasStorageKey: !!certificate.storageKey,
        bufferLength: effectiveBuffer?.length || 0
      }, errorMessage);
      
      await storage.updateCertificate(certificateId, { 
        status: "NEEDS_REVIEW" 
      });
      
      await storage.createExtraction({
        certificateId,
        method: "MANUAL",
        model: "none",
        promptVersion: "v2.0",
        extractedData: { error: errorMessage, requiresManualUpload: true },
        confidence: 0,
        textQuality: "POOR"
      });
      
      broadcastExtractionEvent({
        type: 'extraction_failed',
        certificateId,
        error: errorMessage
      });
      
      return;
    }
    
    const orchestratorResult = await extractWithOrchestrator(
      certificateId,
      effectiveBuffer,
      mimeType || 'application/pdf',
      certificate.fileName || 'document.pdf',
      { forceAI: true }
    );
    
    // Map tier strings to integer ordinals (0-6) for database storage
    const tierToOrdinal: Record<string, number> = {
      'tier-0': 0, 'tier-0.5': 1, 'tier-1': 2, 'tier-1.5': 3, 
      'tier-2': 4, 'tier-3': 5, 'tier-4': 6
    };
    
    // Validate and normalize the tier string
    const normalizedTier = orchestratorResult.finalTier?.toLowerCase();
    const tierOrdinal = tierToOrdinal[normalizedTier];
    if (tierOrdinal === undefined) {
      logger.warn({ 
        certificateId, 
        receivedTier: orchestratorResult.finalTier 
      }, "Unknown tier value received, defaulting to tier-4 (manual review)");
    }
    
    const result = {
      extractedData: orchestratorResult.data ? {
        ...orchestratorResult.data,
        documentType: orchestratorResult.data.certificateType,
        _tierHistory: orchestratorResult.tierAudit,
        _extractionMethod: {
          ocrProvider: orchestratorResult.finalTier === 'tier-2' ? 'AZURE_DOCUMENT_INTELLIGENCE' : 
                       orchestratorResult.finalTier === 'tier-3' ? 'CLAUDE_VISION' : 'PATTERN_MATCHING',
          tier: orchestratorResult.finalTier
        }
      } : null,
      tier: tierOrdinal ?? 6,
      tierName: normalizedTier || 'tier-4',
      tierDisplayName: orchestratorResult.requiresReview ? 'HUMAN_REVIEW' : orchestratorResult.finalTier.toUpperCase(),
      confidence: orchestratorResult.confidence,
      processingTimeMs: orchestratorResult.totalProcessingTimeMs,
      tierHistory: orchestratorResult.tierAudit,
      certificateNumber: orchestratorResult.data?.certificateNumber || null,
      issueDate: orchestratorResult.data?.inspectionDate || null,
      expiryDate: orchestratorResult.data?.expiryDate || null,
      outcome: orchestratorResult.data?.outcome || null,
      remedialActions: (orchestratorResult.data?.defects || []).map(d => ({
        code: d.code || 'DEFECT',
        description: d.description,
        location: d.location || 'General',
        severity: d.priority || 'ROUTINE',
        costEstimate: null
      }))
    };

    const methodName = orchestratorResult.finalTier === 'tier-4' ? "MANUAL" :
                       orchestratorResult.finalTier === 'tier-2' ? "AZURE_OCR_CLAUDE_ANALYSIS" : 
                       orchestratorResult.finalTier === 'tier-3' ? "CLAUDE_VISION" :
                       orchestratorResult.finalTier.startsWith('tier-1') ? "PATTERN_MATCHING" : "METADATA_EXTRACTION";
    const modelVersion = orchestratorResult.finalTier === 'tier-3' ? "claude-sonnet-4-20250514" : 
                         orchestratorResult.finalTier === 'tier-2' ? "azure-di-v3.1" : "pattern-v1.0";

    const extractedDataForStorage = result.extractedData || {};
    
    await storage.createExtraction({
      certificateId,
      method: methodName,
      model: modelVersion,
      promptVersion: "v2.0",
      extractedData: extractedDataForStorage,
      confidence: result.confidence,
      textQuality: result.confidence > 0.7 ? "GOOD" : "FAIR"
    });
    
    const docType = result.extractedData?.documentType || certificateType || 'UNKNOWN';
    
    const normalisedOutput = normalizeExtractionOutput(extractedDataForStorage);
    
    await db.insert(extractionRuns).values({
      certificateId,
      modelVersion,
      promptVersion: `${certificateType?.toLowerCase() || 'general'}_v2.0`,
      schemaVersion: "v1.0",
      documentType: docType,
      classificationConfidence: result.confidence,
      rawOutput: { ...extractedDataForStorage, _tierHistory: result.tierHistory },
      validatedOutput: extractedDataForStorage,
      normalisedOutput: normalisedOutput,
      confidence: result.confidence,
      processingTier: result.tier,
      tierName: result.tierName,
      processingTimeMs: result.processingTimeMs,
      processingCost: 0,
      validationPassed: result.confidence >= 0.7,
      status: result.tier === 5 ? 'AWAITING_REVIEW' : 'AWAITING_REVIEW',
    });

    logger.info({ 
      certificateId, 
      tier: result.tier, 
      tierName: result.tierName, 
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
      tierHistoryCount: result.tierHistory.length
    }, "Tiered extraction saved successfully");

    // Map detected document type to certificate type enum
    const detectedCertType = mapDocumentTypeToCertificateType(result.extractedData?.documentType);
    
    // Map outcome to accepted values (N/A maps to null)
    const mappedOutcome = result.outcome === 'N/A' ? null : result.outcome;
    
    await storage.updateCertificate(certificateId, {
      status: "NEEDS_REVIEW",
      certificateNumber: result.certificateNumber,
      issueDate: result.issueDate,
      expiryDate: result.expiryDate,
      outcome: mappedOutcome,
      // Update certificate type if we detected a specific type
      ...(detectedCertType && { certificateType: detectedCertType })
    });
    
    // Update property with extracted metadata and address
    const property = await storage.getProperty(certificate.propertyId);
    if (property) {
      const extractedAddress = (extractedDataForStorage as any).installationAddress || 
                               result.extractedData?.propertyAddress ||
                               (extractedDataForStorage as any).premisesAddress;
      
      const updates: Record<string, any> = { 
        extractedMetadata: result.extractedData 
      };
      
      // Normalize address from various Claude formats
      const normalized = normalizeExtractedAddress(extractedAddress);
      if (normalized.addressLine1 && normalized.addressLine1.length > 5) {
        updates.addressLine1 = normalized.addressLine1;
      }
      if (normalized.city && normalized.city !== 'To Be Verified') {
        updates.city = normalized.city;
      }
      if (normalized.postcode && normalized.postcode !== 'UNKNOWN') {
        updates.postcode = normalized.postcode;
      }
      
      await storage.updateProperty(certificate.propertyId, updates);
      console.log(`Updated property ${certificate.propertyId} with extracted address: ${normalized.addressLine1}`);
    }

    const severityMap: Record<string, "IMMEDIATE" | "URGENT" | "ROUTINE" | "ADVISORY"> = {
      IMMEDIATE: "IMMEDIATE",
      URGENT: "URGENT", 
      ROUTINE: "ROUTINE",
      ADVISORY: "ADVISORY"
    };

    console.log(`[DEBUG] Processing ${result.remedialActions.length} remedial actions for cert ${certificateId}`);
    for (const action of result.remedialActions) {
      const daysToAdd = action.severity === "IMMEDIATE" ? 1 : 
                        action.severity === "URGENT" ? 7 : 
                        action.severity === "ROUTINE" ? 30 : 90;
      
      await storage.createRemedialAction({
        certificateId,
        propertyId: certificate.propertyId,
        code: action.code,
        description: action.description,
        location: action.location,
        severity: severityMap[action.severity],
        status: "OPEN",
        dueDate: new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        costEstimate: action.costEstimate
      });
    }
    console.log(`[DEBUG] Remedial actions created, now linking to classification codes`);

    const mappedCertTypeCode = mapCertificateTypeToCode(detectedCertType || certificateType);
    const anyData = extractedDataForStorage as any;
    const extractedDataForClassification: OrchestratorExtractedData = {
      certificateType: mappedCertTypeCode as OrchestratorExtractedData['certificateType'],
      certificateNumber: result.certificateNumber || null,
      propertyAddress: anyData.installationAddress || result.extractedData?.propertyAddress || null,
      uprn: result.extractedData?.uprn || null,
      inspectionDate: result.issueDate || null,
      expiryDate: result.expiryDate || null,
      nextInspectionDate: anyData.nextServiceDate || result.extractedData?.nextInspectionDate || null,
      outcome: (result.outcome === 'N/A' ? null : result.outcome) as OrchestratorExtractedData['outcome'],
      engineerName: anyData.engineer?.name || result.extractedData?.engineerName || null,
      engineerRegistration: anyData.engineer?.gasRegNo || result.extractedData?.engineerRegistration || null,
      contractorName: anyData.contractor?.name || result.extractedData?.contractorName || null,
      contractorRegistration: anyData.contractor?.registrationNumber || result.extractedData?.contractorRegistration || null,
      appliances: (result.extractedData?.appliances || []).map((a: any) => ({
        type: a.type || 'Unknown',
        make: a.make || null,
        model: a.model || null,
        serialNumber: a.serialNumber || null,
        location: a.location || null,
        outcome: mapApplianceOutcome(a.result || a.outcome),
        defects: a.defects || [],
      })),
      defects: (result.extractedData?.defects || []).map((d: any) => ({
        code: d.code || null,
        description: d.description || d.text || 'Unknown defect',
        location: d.location || null,
        priority: mapDefectPriority(d.priority || d.severity),
        remedialAction: d.recommendation || d.action || null,
      })),
      additionalFields: {},
    };

    const { linkExtractionToClassifications } = await import("./services/extraction/classification-linker");
    const linkageResult = await linkExtractionToClassifications(
      certificateId,
      extractedDataForClassification,
      mappedCertTypeCode
    );
    
    console.log(`[DEBUG] Classification linking complete: ${linkageResult.actionsCreated} actions created, ${linkageResult.matches.length} matches found`);

    // Auto-create component with pending verification based on certificate type
    // Use the DETECTED certificate type, not the initial type (which may be "OTHER")
    const effectiveCertType = detectedCertType || certificateType;
    console.log(`[DEBUG] About to call autoCreateComponentFromCertificate for cert ${certificateId}, type: ${effectiveCertType}`);
    try {
      await autoCreateComponentFromCertificate(certificate, effectiveCertType, result.extractedData);
      console.log(`[DEBUG] autoCreateComponentFromCertificate completed for cert ${certificateId}`);
    } catch (compErr) {
      console.error(`[DEBUG] autoCreateComponentFromCertificate failed:`, compErr);
    }
    
    // Auto-create/update contractor from engineer info
    await autoCreateContractorFromExtraction(certificate.organisationId, result.extractedData);
    
    console.log(`Extraction complete for certificate ${certificateId}: ${result.outcome}, ${result.remedialActions.length} actions created`);
    
    // Broadcast real-time update events
    broadcastExtractionEvent({ 
      type: 'extraction_complete', 
      certificateId, 
      propertyId: certificate.propertyId,
      status: 'NEEDS_REVIEW'
    });
  } catch (error) {
    console.error("Extraction failed:", error);
    await storage.updateCertificate(certificateId, { 
      status: "FAILED" 
    });
    
    // Broadcast failure event
    broadcastExtractionEvent({ 
      type: 'extraction_complete', 
      certificateId, 
      status: 'FAILED'
    });
  }
}
