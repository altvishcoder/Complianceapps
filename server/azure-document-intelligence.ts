import { logger } from "./logger";

interface AzureDocumentIntelligenceConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
}

interface AnalyzeResult {
  status: "notStarted" | "running" | "succeeded" | "failed";
  analyzeResult?: {
    apiVersion: string;
    modelId: string;
    content: string;
    pages: Array<{
      pageNumber: number;
      angle: number;
      width: number;
      height: number;
      unit: string;
      lines: Array<{
        content: string;
        boundingBox?: number[];
      }>;
      words: Array<{
        content: string;
        boundingBox?: number[];
        confidence: number;
      }>;
    }>;
    languages?: Array<{
      locale: string;
      confidence: number;
    }>;
    paragraphs?: Array<{
      content: string;
      boundingBox?: number[];
    }>;
    tables?: Array<{
      rowCount: number;
      columnCount: number;
      cells: Array<{
        rowIndex: number;
        columnIndex: number;
        content: string;
      }>;
    }>;
    keyValuePairs?: Array<{
      key: { content: string };
      value?: { content: string };
      confidence: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ExtractionTier {
  tier: 1 | 2 | 3;
  name: "AZURE_DOCUMENT_INTELLIGENCE" | "CLAUDE_VISION" | "HUMAN_REVIEW";
  succeeded: boolean;
  confidence: number;
  rawText?: string;
  structuredData?: Record<string, any>;
  error?: string;
  processingTimeMs: number;
}

function getAzureConfig(): AzureDocumentIntelligenceConfig | null {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  
  if (!endpoint || !apiKey) {
    logger.debug("Azure Document Intelligence not configured - missing AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY");
    return null;
  }
  
  return {
    endpoint: endpoint.replace(/\/$/, ''),
    apiKey,
    apiVersion: "2024-11-30"
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function extractWithAzureDocumentIntelligence(
  documentBuffer: Buffer,
  mimeType: string
): Promise<ExtractionTier> {
  const startTime = Date.now();
  const config = getAzureConfig();
  
  if (!config) {
    return {
      tier: 1,
      name: "AZURE_DOCUMENT_INTELLIGENCE",
      succeeded: false,
      confidence: 0,
      error: "Azure Document Intelligence not configured",
      processingTimeMs: Date.now() - startTime
    };
  }
  
  try {
    const modelId = "prebuilt-layout";
    const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=${config.apiVersion}&outputContentFormat=markdown`;
    
    logger.info({ modelId, mimeType, bufferSize: documentBuffer.length }, "Starting Azure Document Intelligence extraction");
    
    const submitResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.apiKey,
        "Content-Type": mimeType
      },
      body: documentBuffer
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      logger.error({ status: submitResponse.status, error: errorText }, "Azure Document Intelligence submission failed");
      return {
        tier: 1,
        name: "AZURE_DOCUMENT_INTELLIGENCE",
        succeeded: false,
        confidence: 0,
        error: `Azure API error: ${submitResponse.status} - ${errorText}`,
        processingTimeMs: Date.now() - startTime
      };
    }
    
    const operationLocation = submitResponse.headers.get("Operation-Location");
    if (!operationLocation) {
      return {
        tier: 1,
        name: "AZURE_DOCUMENT_INTELLIGENCE",
        succeeded: false,
        confidence: 0,
        error: "No Operation-Location header in response",
        processingTimeMs: Date.now() - startTime
      };
    }
    
    logger.debug({ operationLocation }, "Azure Document Intelligence analysis started, polling for results");
    
    let result: AnalyzeResult | null = null;
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
      
      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        logger.warn({ status: pollResponse.status, error: errorText, attempt: i + 1 }, "Azure Document Intelligence poll failed");
        continue;
      }
      
      result = await pollResponse.json() as AnalyzeResult;
      
      if (result.status === "succeeded") {
        logger.info({ attempt: i + 1 }, "Azure Document Intelligence extraction succeeded");
        break;
      } else if (result.status === "failed") {
        logger.error({ error: result.error }, "Azure Document Intelligence extraction failed");
        break;
      }
      
      logger.debug({ status: result.status, attempt: i + 1 }, "Azure Document Intelligence still processing");
    }
    
    if (!result || result.status !== "succeeded" || !result.analyzeResult) {
      return {
        tier: 1,
        name: "AZURE_DOCUMENT_INTELLIGENCE",
        succeeded: false,
        confidence: 0,
        error: result?.error?.message || "Analysis did not complete successfully",
        processingTimeMs: Date.now() - startTime
      };
    }
    
    const analyzeResult = result.analyzeResult;
    const rawText = analyzeResult.content || "";
    
    const avgConfidence = analyzeResult.pages.reduce((sum, page) => {
      const pageAvg = page.words.reduce((wSum, word) => wSum + word.confidence, 0) / (page.words.length || 1);
      return sum + pageAvg;
    }, 0) / (analyzeResult.pages.length || 1);
    
    const structuredData: Record<string, any> = {
      pageCount: analyzeResult.pages.length,
      extractedText: rawText,
      languages: analyzeResult.languages,
      tables: analyzeResult.tables?.map(table => ({
        rows: table.rowCount,
        columns: table.columnCount,
        data: table.cells.map(cell => ({
          row: cell.rowIndex,
          column: cell.columnIndex,
          content: cell.content
        }))
      })),
      keyValuePairs: analyzeResult.keyValuePairs?.map(kv => ({
        key: kv.key.content,
        value: kv.value?.content || "",
        confidence: kv.confidence
      }))
    };
    
    logger.info({ 
      confidence: avgConfidence, 
      pageCount: analyzeResult.pages.length,
      textLength: rawText.length,
      hasKeyValuePairs: !!analyzeResult.keyValuePairs?.length,
      hasTables: !!analyzeResult.tables?.length
    }, "Azure Document Intelligence extraction complete");
    
    return {
      tier: 1,
      name: "AZURE_DOCUMENT_INTELLIGENCE",
      succeeded: true,
      confidence: avgConfidence,
      rawText,
      structuredData,
      processingTimeMs: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error({ error }, "Azure Document Intelligence extraction error");
    return {
      tier: 1,
      name: "AZURE_DOCUMENT_INTELLIGENCE",
      succeeded: false,
      confidence: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: Date.now() - startTime
    };
  }
}

export function isAzureDocumentIntelligenceConfigured(): boolean {
  return getAzureConfig() !== null;
}
