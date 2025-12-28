import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { join } from "path";
import { db } from "./db";
import { extractionRuns, componentTypes, components, contractors } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { broadcastExtractionEvent } from "./events";

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
    const remedialActions = generateRemedialActions(extractedData, certificateType, certificate.propertyId);

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

function determineOutcome(data: Record<string, any>, certificateType: string): ExtractionResult["outcome"] {
  if (data.overallOutcome) {
    return data.overallOutcome.toUpperCase().includes("UNSATISFACTORY") ? "UNSATISFACTORY" : "SATISFACTORY";
  }
  if (data.overallAssessment) {
    return data.overallAssessment.toUpperCase().includes("UNSATISFACTORY") ? "UNSATISFACTORY" : "SATISFACTORY";
  }
  if (data.safeToOperate === false) {
    return "UNSATISFACTORY";
  }
  if (data.c1Count > 0 || data.categorA_Count > 0) {
    return "UNSATISFACTORY";
  }
  if (data.c2Count > 0 || data.categoryB_Count > 0) {
    return "UNSATISFACTORY";
  }
  if (data.riskLevel && ["HIGH", "INTOLERABLE", "SUBSTANTIAL"].includes(data.riskLevel.toUpperCase())) {
    return "UNSATISFACTORY";
  }
  if (data.overallRisk === "HIGH") {
    return "UNSATISFACTORY";
  }
  if (data.defects && Array.isArray(data.defects)) {
    const hasCritical = data.defects.some((d: any) => 
      d.classification?.includes("Immediately Dangerous") || 
      d.classification?.includes("ID") ||
      d.category === "A"
    );
    if (hasCritical) return "UNSATISFACTORY";
  }
  if (data.appliances && Array.isArray(data.appliances)) {
    const hasUnsafe = data.appliances.some((a: any) => a.applianceSafe === false);
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
    const items = appliances.length > 0 ? appliances : 
                  equipmentInfo.length > 0 ? equipmentInfo : [{ type: certificateType }];
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
        console.log(`[Component Auto-Create] Creating new component: type=${compType.name}, location=${item.location || item.room || 'N/A'}`);
        const created = await storage.createComponent({
          propertyId: certificate.propertyId,
          componentTypeId: compType.id,
          manufacturer: item.manufacturer || item.make || null,
          model: item.model || item.type || null,
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
    
    let pdfText: string | undefined;
    
    if (pdfBuffer || (certificate.fileType === 'application/pdf' && !fileBase64)) {
      if (pdfBuffer) {
        pdfText = await extractTextFromPdf(pdfBuffer);
        console.log(`Extracted ${pdfText.length} characters of text from PDF`);
      }
    }
    
    const result = await extractCertificateWithClaude(certificateId, certificateType, fileBase64, mimeType, pdfText);

    await storage.createExtraction({
      certificateId,
      method: "CLAUDE_VISION",
      model: "claude-3-5-haiku-20241022",
      promptVersion: "v2.0",
      extractedData: result.extractedData,
      confidence: result.confidence,
      textQuality: result.confidence > 0.7 ? "GOOD" : "FAIR"
    });
    
    // Create extraction run for the AI Model insights
    const docType = result.extractedData?.documentType || certificateType || 'UNKNOWN';
    
    // Normalize the raw output to the format expected by the human review form
    const normalisedOutput = normalizeExtractionOutput(result.extractedData);
    
    await db.insert(extractionRuns).values({
      certificateId,
      modelVersion: "claude-3-5-haiku-20241022",
      promptVersion: `${certificateType?.toLowerCase() || 'general'}_v2.0`,
      schemaVersion: "v1.0",
      documentType: docType,
      classificationConfidence: result.confidence,
      rawOutput: result.extractedData,
      validatedOutput: result.extractedData,
      normalisedOutput: normalisedOutput,
      confidence: result.confidence,
      processingTier: result.confidence >= 0.95 ? 1 : result.confidence >= 0.8 ? 2 : 3,
      processingTimeMs: 0,
      processingCost: 0,
      validationPassed: result.confidence >= 0.7,
      status: 'AWAITING_REVIEW',
    });

    // Map detected document type to certificate type enum
    const detectedCertType = mapDocumentTypeToCertificateType(result.extractedData?.documentType);
    
    await storage.updateCertificate(certificateId, {
      status: "NEEDS_REVIEW",
      certificateNumber: result.certificateNumber,
      issueDate: result.issueDate,
      expiryDate: result.expiryDate,
      outcome: result.outcome,
      // Update certificate type if we detected a specific type
      ...(detectedCertType && { certificateType: detectedCertType })
    });
    
    // Update property with extracted metadata and address
    const property = await storage.getProperty(certificate.propertyId);
    if (property) {
      const extractedAddress = result.extractedData?.installationAddress || 
                               result.extractedData?.propertyAddress ||
                               result.extractedData?.premisesAddress;
      
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

    // Auto-create component with pending verification based on certificate type
    await autoCreateComponentFromCertificate(certificate, certificateType, result.extractedData);
    
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
