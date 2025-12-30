import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedCertificateData } from './types';
import { logger } from '../../logger';

const anthropic = new Anthropic();

const EXTRACTION_PROMPT = `You are analyzing extracted text from a UK compliance certificate.
Based on the text provided, extract the following information in JSON format:

{
  "certificateType": "The type of certificate (e.g., GAS_SAFETY, EICR, EPC, FIRE_RISK, ASBESTOS, LEGIONELLA, LIFT_LOLER)",
  "certificateNumber": "Certificate or report reference number",
  "propertyAddress": "Full property address",
  "uprn": "Unique Property Reference Number if present",
  "inspectionDate": "Date of inspection in YYYY-MM-DD format",
  "expiryDate": "Expiry or next inspection date in YYYY-MM-DD format",
  "nextInspectionDate": "Next recommended inspection date in YYYY-MM-DD format",
  "outcome": "SATISFACTORY or UNSATISFACTORY",
  "engineerName": "Name of the engineer/inspector",
  "engineerRegistration": "Registration number (Gas Safe, NICEIC, etc.)",
  "contractorName": "Company or contractor name",
  "contractorRegistration": "Company registration number",
  "appliances": [
    {
      "type": "Appliance type",
      "location": "Room location",
      "make": "Manufacturer",
      "model": "Model number",
      "status": "PASS/FAIL/AT_RISK"
    }
  ],
  "defects": [
    {
      "code": "Defect classification code (C1, C2, C3, ID, AR, etc.)",
      "description": "Description of defect",
      "location": "Where the defect was found",
      "severity": "IMMEDIATE/URGENT/ROUTINE/ADVISORY"
    }
  ],
  "additionalFields": {
    "any other relevant fields": "values"
  }
}

Rules:
1. Extract dates in YYYY-MM-DD format
2. If a field cannot be determined, use null
3. Mark outcome as UNSATISFACTORY if there are serious defects (C1, C2, ID, AR classifications)
4. Be precise with registration numbers - Gas Safe is 7 digits, NICEIC varies
5. Return ONLY valid JSON, no additional text`;

export interface ClaudeTextResult {
  success: boolean;
  data: ExtractedCertificateData;
  confidence: number;
  processingTimeMs: number;
  cost: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  error?: string;
}

export async function extractWithClaudeText(
  text: string,
  certificateType?: string | null,
  existingData?: Partial<ExtractedCertificateData>
): Promise<ClaudeTextResult> {
  const startTime = Date.now();
  
  try {
    const contextPrompt = certificateType 
      ? `The document appears to be a ${certificateType} certificate.\n\n`
      : '';
    
    const existingDataPrompt = existingData 
      ? `\n\nPrevious extraction attempt found these fields (please verify and enhance):\n${JSON.stringify(existingData, null, 2)}\n\n`
      : '';

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\n${contextPrompt}${existingDataPrompt}Document text:\n\n${text.substring(0, 50000)}`
        }
      ]
    });

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 0.003 / 1000) + (outputTokens * 0.015 / 1000);

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let jsonText = content.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const extractedData = JSON.parse(jsonText) as ExtractedCertificateData;

    const fieldCount = countPopulatedFields(extractedData);
    const confidence = calculateConfidence(extractedData, fieldCount);

    logger.info({ 
      inputTokens, 
      outputTokens, 
      cost, 
      confidence,
      fieldCount,
      processingTimeMs: Date.now() - startTime 
    }, 'Claude Text extraction complete');

    return {
      success: true,
      data: extractedData,
      confidence,
      processingTimeMs: Date.now() - startTime,
      cost,
      tokensUsed: { input: inputTokens, output: outputTokens }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Claude Text extraction failed');

    return {
      success: false,
      data: createEmptyData(),
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      cost: 0,
      tokensUsed: { input: 0, output: 0 },
      error: errorMessage
    };
  }
}

function countPopulatedFields(data: ExtractedCertificateData): number {
  let count = 0;
  const coreFields = [
    'certificateType', 'certificateNumber', 'propertyAddress', 'uprn',
    'inspectionDate', 'expiryDate', 'outcome', 'engineerName', 'engineerRegistration'
  ];
  
  for (const field of coreFields) {
    if (data[field as keyof ExtractedCertificateData]) count++;
  }
  
  if (data.appliances && data.appliances.length > 0) count += 2;
  if (data.defects && data.defects.length > 0) count += 2;
  
  return count;
}

function calculateConfidence(data: ExtractedCertificateData, fieldCount: number): number {
  const maxFields = 13;
  let confidence = Math.min(fieldCount / maxFields, 1);
  
  if (data.certificateNumber) confidence += 0.1;
  if (data.inspectionDate) confidence += 0.05;
  if (data.outcome) confidence += 0.05;
  
  return Math.min(confidence, 1);
}

function createEmptyData(): ExtractedCertificateData {
  return {
    certificateType: 'UNKNOWN',
    certificateNumber: null,
    propertyAddress: null,
    uprn: null,
    inspectionDate: null,
    expiryDate: null,
    nextInspectionDate: null,
    outcome: null,
    engineerName: null,
    engineerRegistration: null,
    contractorName: null,
    contractorRegistration: null,
    appliances: [],
    defects: [],
    additionalFields: {}
  };
}
