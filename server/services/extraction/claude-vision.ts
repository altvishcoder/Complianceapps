import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedCertificateData } from './types';
import { logger } from '../../logger';

const anthropic = new Anthropic();

const VISION_EXTRACTION_PROMPT = `You are analyzing an image of a UK compliance certificate.
Carefully examine the entire document and extract all visible information.

Return a JSON object with the following structure:

{
  "certificateType": "The type of certificate (GAS_SAFETY, EICR, EPC, FIRE_RISK, ASBESTOS, LEGIONELLA, LIFT_LOLER, OTHER)",
  "certificateNumber": "Certificate or report reference number",
  "propertyAddress": "Full property address",
  "uprn": "Unique Property Reference Number if visible",
  "inspectionDate": "Date of inspection in YYYY-MM-DD format",
  "expiryDate": "Expiry or next inspection date in YYYY-MM-DD format",
  "nextInspectionDate": "Next recommended inspection date in YYYY-MM-DD format",
  "outcome": "SATISFACTORY or UNSATISFACTORY",
  "engineerName": "Name of the engineer/inspector",
  "engineerRegistration": "Registration number (Gas Safe ID, NICEIC number, etc.)",
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
      "code": "Defect classification (C1, C2, C3, ID, AR, NCS)",
      "description": "Description of defect",
      "location": "Where the defect was found",
      "severity": "IMMEDIATE/URGENT/ROUTINE/ADVISORY"
    }
  ],
  "additionalFields": {}
}

Rules:
1. Look carefully at all parts of the document including headers, footers, stamps, and handwritten notes
2. Extract dates in YYYY-MM-DD format
3. Gas Safe registration numbers are 7 digits
4. If a field is not visible, use null
5. Mark outcome as UNSATISFACTORY if there are C1, C2, ID, or AR classifications
6. Return ONLY valid JSON`;

export interface ClaudeVisionResult {
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

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function extractWithClaudeVision(
  imageBuffer: Buffer,
  mimeType: string,
  certificateType?: string | null
): Promise<ClaudeVisionResult> {
  const startTime = Date.now();
  
  try {
    const base64Image = imageBuffer.toString('base64');
    
    const supportedTypes: MediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    let mediaType: MediaType = "image/jpeg";
    
    if (supportedTypes.includes(mimeType as MediaType)) {
      mediaType = mimeType as MediaType;
    }

    const contextPrompt = certificateType 
      ? `This appears to be a ${certificateType} certificate. `
      : '';

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: "text",
              text: `${VISION_EXTRACTION_PROMPT}\n\n${contextPrompt}Please analyze this compliance certificate image and extract the data.`
            }
          ]
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
    }, 'Claude Vision extraction complete');

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
    logger.error({ error: errorMessage }, 'Claude Vision extraction failed');

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

export async function extractWithClaudeVisionFromPDF(
  pdfBuffer: Buffer,
  certificateType?: string | null
): Promise<ClaudeVisionResult> {
  const startTime = Date.now();
  
  try {
    const base64PDF = pdfBuffer.toString('base64');
    
    const contextPrompt = certificateType 
      ? `This appears to be a ${certificateType} certificate. `
      : '';

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64PDF
              }
            },
            {
              type: "text",
              text: `${VISION_EXTRACTION_PROMPT}\n\n${contextPrompt}Please analyze this compliance certificate document and extract the data.`
            }
          ]
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
    }, 'Claude Vision PDF extraction complete');

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
    logger.error({ error: errorMessage }, 'Claude Vision PDF extraction failed');

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
  if (data.engineerRegistration) confidence += 0.05;
  
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
