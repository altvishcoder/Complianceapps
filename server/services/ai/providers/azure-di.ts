import {
  AIProviderType,
  AICapability,
  IDocumentIntelligenceProvider,
  AIProviderHealth,
  OCRResult,
  AIProviderError,
  AIProviderNotConfiguredError,
} from "./types";
import { aiRegistry } from "./registry";

interface AzureDIConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
}

function getAzureConfig(): AzureDIConfig | null {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  
  if (!endpoint || !apiKey) {
    return null;
  }
  
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    apiKey,
    apiVersion: "2024-11-30",
  };
}

export class AzureDIProvider implements IDocumentIntelligenceProvider {
  readonly name = "Azure Document Intelligence";
  readonly type = AIProviderType.AZURE_DI;
  readonly capabilities = [
    AICapability.OCR,
    AICapability.DOCUMENT_INTELLIGENCE,
  ];

  private config: AzureDIConfig | null = null;

  async initialize(): Promise<void> {
    this.config = getAzureConfig();
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const startTime = Date.now();
    
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        lastChecked: new Date(),
        error: "Azure DI not configured - AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY missing",
      };
    }

    try {
      const response = await fetch(`${this.config!.endpoint}/documentintelligence/documentModels?api-version=${this.config!.apiVersion}`, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": this.config!.apiKey,
        },
      });

      return {
        isHealthy: response.ok,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<OCRResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name, AICapability.OCR);
    }

    try {
      const result = await this.analyzeDocument(buffer, mimeType, "prebuilt-read");
      
      return {
        success: result.success,
        text: result.text,
        confidence: result.confidence,
        pageCount: result.pageCount,
        processingTimeMs: result.processingTimeMs,
        cost: result.cost,
        error: result.error,
      };
    } catch (error) {
      throw new AIProviderError(
        `Azure DI OCR failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        AICapability.OCR,
        true
      );
    }
  }

  async analyzeDocument(
    buffer: Buffer,
    mimeType: string,
    modelId: string = "prebuilt-layout"
  ): Promise<{
    success: boolean;
    text: string;
    structuredData: Record<string, unknown>;
    confidence: number;
    pageCount: number;
    cost: number;
    processingTimeMs: number;
    error?: string;
  }> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        text: "",
        structuredData: {},
        confidence: 0,
        pageCount: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        error: "Azure DI not configured",
      };
    }

    try {
      const analyzeUrl = `${this.config!.endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=${this.config!.apiVersion}&outputContentFormat=markdown`;

      const submitResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.config!.apiKey,
          "Content-Type": mimeType,
        },
        body: buffer,
      });

      if (!submitResponse.ok) {
        return {
          success: false,
          text: "",
          structuredData: {},
          confidence: 0,
          pageCount: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          error: `Failed to submit document: HTTP ${submitResponse.status}`,
        };
      }

      const operationLocation = submitResponse.headers.get("Operation-Location");
      if (!operationLocation) {
        return {
          success: false,
          text: "",
          structuredData: {},
          confidence: 0,
          pageCount: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          error: "No operation location returned",
        };
      }

      let result;
      let status = "running";
      const maxAttempts = 60;
      let attempts = 0;

      while (status === "running" && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(operationLocation, {
          method: "GET",
          headers: {
            "Ocp-Apim-Subscription-Key": this.config!.apiKey,
          },
        });

        if (!statusResponse.ok) {
          return {
            success: false,
            text: "",
            structuredData: {},
            confidence: 0,
            pageCount: 0,
            cost: 0,
            processingTimeMs: Date.now() - startTime,
            error: `Failed to get status: HTTP ${statusResponse.status}`,
          };
        }

        result = await statusResponse.json();
        status = result.status;
        attempts++;
      }

      if (status !== "succeeded") {
        return {
          success: false,
          text: "",
          structuredData: {},
          confidence: 0,
          pageCount: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          error: status === "running" ? "Timeout waiting for analysis" : `Analysis failed: ${status}`,
        };
      }

      const content = result.analyzeResult?.content || "";
      const pages = result.analyzeResult?.pages || [];
      const pageCount = pages.length;
      
      const avgConfidence = pages.length > 0
        ? pages.reduce((sum: number, p: { words?: Array<{ confidence: number }> }) => {
            const wordConfidences = p.words?.map((w: { confidence: number }) => w.confidence) || [];
            return sum + (wordConfidences.length > 0 ? wordConfidences.reduce((a: number, b: number) => a + b, 0) / wordConfidences.length : 0);
          }, 0) / pages.length
        : 0.7;

      return {
        success: true,
        text: content,
        structuredData: result.analyzeResult || {},
        confidence: avgConfidence,
        pageCount,
        cost: this.estimateCost(pageCount),
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        text: "",
        structuredData: {},
        confidence: 0,
        pageCount: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private estimateCost(pageCount: number): number {
    return pageCount * 0.001;
  }
}

aiRegistry.register(new AzureDIProvider(), 10);
