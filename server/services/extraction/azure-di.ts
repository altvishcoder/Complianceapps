import type { ExtractedCertificateData } from './types';
import { logger } from '../../logger';
import { circuitBreaker, withRetry } from '../circuit-breaker';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
}

function getAzureConfig(): AzureConfig | null {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  
  if (!endpoint || !apiKey) {
    return null;
  }
  
  return {
    endpoint: endpoint.replace(/\/$/, ''),
    apiKey,
    apiVersion: "2024-11-30"
  };
}

export function isAzureDIConfigured(): boolean {
  return getAzureConfig() !== null;
}

export interface AzureDIResult {
  success: boolean;
  rawText: string;
  structuredData: Record<string, unknown>;
  data: ExtractedCertificateData;
  confidence: number;
  processingTimeMs: number;
  cost: number;
  pageCount: number;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function extractWithAzureDI(
  buffer: Buffer,
  mimeType: string
): Promise<AzureDIResult> {
  const startTime = Date.now();
  const config = getAzureConfig();
  
  if (!config) {
    return {
      success: false,
      rawText: '',
      structuredData: {},
      data: createEmptyData(),
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      cost: 0,
      pageCount: 0,
      error: 'Azure Document Intelligence not configured'
    };
  }

  try {
    const result = await circuitBreaker.execute(
      'azure-di',
      async () => {
        const modelId = "prebuilt-layout";
        const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=${config.apiVersion}&outputContentFormat=markdown`;
        
        logger.info({ modelId, mimeType, bufferSize: buffer.length }, 'Starting Azure DI extraction');
        
        const submitResponse = await withRetry(
          () => fetch(analyzeUrl, {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": config.apiKey,
              "Content-Type": mimeType
            },
            body: buffer
          }),
          2, // maxRetries
          1000 // baseDelayMs
        );
        
        if (!submitResponse.ok) {
          const errorText = await submitResponse.text();
          throw new Error(`Azure API error: ${submitResponse.status} - ${errorText}`);
        }
        
        const operationLocation = submitResponse.headers.get("Operation-Location");
        if (!operationLocation) {
          throw new Error("No Operation-Location header in response");
        }
        
        let pollResult: { status: string; analyzeResult?: { content?: string; pages?: unknown[] }; error?: { message: string } } | null = null;
        const maxPolls = 30;
        const pollInterval = 2000;
        
        for (let i = 0; i < maxPolls; i++) {
          await sleep(pollInterval);
          
          const pollResponse = await fetch(operationLocation, {
            method: "GET",
            headers: {
              "Ocp-Apim-Subscription-Key": config.apiKey
            }
          });
          
          if (!pollResponse.ok) continue;
          
          pollResult = await pollResponse.json();
          
          if (pollResult?.status === "succeeded") break;
          if (pollResult?.status === "failed") {
            throw new Error(pollResult.error?.message || "Azure analysis failed");
          }
        }
        
        if (!pollResult || pollResult.status !== "succeeded") {
          throw new Error("Azure analysis timed out");
        }
        
        return pollResult;
      }
    );
    
    const rawText = result.analyzeResult?.content || '';
    const pageCount = result.analyzeResult?.pages?.length || 1;
    const cost = pageCount * 0.0015;
    
    const extractedData = parseAzureResult(rawText);
    const confidence = calculateConfidence(rawText, extractedData);
    
    logger.info({ 
      textLength: rawText.length,
      pageCount,
      cost,
      confidence,
      processingTimeMs: Date.now() - startTime 
    }, 'Azure DI extraction complete');

    return {
      success: true,
      rawText,
      structuredData: result.analyzeResult || {},
      data: extractedData,
      confidence,
      processingTimeMs: Date.now() - startTime,
      cost,
      pageCount
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isCircuitOpen = errorMessage.includes('Circuit breaker');
    logger.error({ error: errorMessage, isCircuitOpen }, 'Azure DI extraction failed');

    return {
      success: false,
      rawText: '',
      structuredData: {},
      data: createEmptyData(),
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      cost: 0,
      pageCount: 0,
      error: errorMessage
    };
  }
}

function parseAzureResult(text: string): ExtractedCertificateData {
  const data = createEmptyData();
  
  const certificateMatch = text.match(/(?:certificate|report)\s*(?:number|no|ref)[:\s]*([A-Z0-9\-\/]+)/i);
  if (certificateMatch) data.certificateNumber = certificateMatch[1];
  
  const datePatterns = [
    /(?:date|issued)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.inspectionDate = normalizeDate(match[1]);
      break;
    }
  }
  
  const gasSafeMatch = text.match(/gas\s*safe[:\s]*(\d{7})/i);
  if (gasSafeMatch) data.engineerRegistration = gasSafeMatch[1];
  
  const niceicMatch = text.match(/niceic[:\s]*([A-Z0-9]+)/i);
  if (niceicMatch) data.engineerRegistration = niceicMatch[1];
  
  if (/satisfactory|pass|compliant/i.test(text) && !/unsatisfactory|fail|non-compliant/i.test(text)) {
    data.outcome = 'SATISFACTORY';
  } else if (/unsatisfactory|fail|non-compliant/i.test(text)) {
    data.outcome = 'UNSATISFACTORY';
  }
  
  return data;
}

function normalizeDate(dateStr: string): string | null {
  try {
    const parts = dateStr.split(/[\/-]/);
    if (parts.length === 3) {
      let day = parseInt(parts[0]);
      let month = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      
      if (year < 100) year += 2000;
      
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } catch {
    return null;
  }
  return null;
}

function calculateConfidence(text: string, data: ExtractedCertificateData): number {
  let confidence = 0;
  
  if (text.length > 500) confidence += 0.3;
  else if (text.length > 200) confidence += 0.2;
  else if (text.length > 50) confidence += 0.1;
  
  if (data.certificateNumber) confidence += 0.15;
  if (data.inspectionDate) confidence += 0.15;
  if (data.engineerRegistration) confidence += 0.15;
  if (data.outcome) confidence += 0.1;
  
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
