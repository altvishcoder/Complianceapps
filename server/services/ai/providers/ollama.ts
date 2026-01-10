import {
  AIProviderType,
  AICapability,
  ILLMProvider,
  IVisionProvider,
  AIProviderHealth,
  LLMExtractionResult,
  VisionResult,
  AIProviderError,
  AIProviderNotConfiguredError,
} from "./types";
import { aiRegistry } from "./registry";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  visionModel?: string;
  timeout?: number;
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

export class OllamaProvider implements ILLMProvider, IVisionProvider {
  readonly name = "Ollama Local LLM";
  readonly type = AIProviderType.OLLAMA;
  readonly capabilities = [
    AICapability.TEXT_EXTRACTION,
    AICapability.VISION,
  ];

  private baseUrl: string;
  private model: string;
  private visionModel: string;
  private timeout: number;
  private configured: boolean = false;
  private availableModels: string[] = [];
  private hasVisionModel: boolean = false;

  constructor(config?: OllamaConfig) {
    this.baseUrl = config?.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.model = config?.model || process.env.OLLAMA_MODEL || "llama3.1";
    this.visionModel = config?.visionModel || process.env.OLLAMA_VISION_MODEL || "llava";
    this.timeout = config?.timeout || 120000;
  }

  async initialize(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json() as OllamaTagsResponse;
        this.availableModels = data.models?.map(m => m.name) || [];
        this.configured = this.availableModels.length > 0;
        
        const visionModels = this.availableModels.filter(m => 
          m.includes("llava") || m.includes("bakllava") || m.includes("vision") || m.includes("moondream")
        );
        
        if (visionModels.length > 0) {
          this.visionModel = visionModels[0];
          this.hasVisionModel = true;
        }
        
        console.log(`[OllamaProvider] Initialized with ${this.availableModels.length} models: ${this.availableModels.slice(0, 5).join(", ")}${this.availableModels.length > 5 ? "..." : ""}`);
      } else {
        this.configured = false;
      }
    } catch {
      this.configured = false;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as OllamaTagsResponse;
        this.availableModels = data.models?.map(m => m.name) || [];
        this.configured = this.availableModels.length > 0;
        
        const visionModels = this.availableModels.filter(m => 
          m.includes("llava") || m.includes("bakllava") || m.includes("vision") || m.includes("moondream")
        );
        
        if (visionModels.length > 0 && !this.hasVisionModel) {
          this.visionModel = visionModels[0];
          this.hasVisionModel = true;
        }

        return {
          isHealthy: this.configured,
          latencyMs: Date.now() - startTime,
          lastChecked: new Date(),
          error: this.configured ? undefined : "No models available",
        };
      }

      return {
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: `Ollama API returned status ${response.status}`,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: `Ollama not available at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async generate(
    model: string,
    prompt: string,
    images?: string[]
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: false,
    };

    if (images && images.length > 0) {
      body.images = images;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as OllamaGenerateResponse;
      return data.response || "";
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private parseJsonSafely(text: string): Record<string, unknown> | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async extractFromText(
    text: string,
    schema: Record<string, unknown>,
    context?: { documentType?: string; existingData?: Record<string, unknown> }
  ): Promise<LLMExtractionResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name, AICapability.TEXT_EXTRACTION);
    }

    try {
      const contextPrompt = context?.documentType
        ? `The document appears to be a ${context.documentType} certificate.\n\n`
        : "";

      const existingDataPrompt = context?.existingData
        ? `\n\nPrevious extraction attempt found these fields (please verify and enhance):\n${JSON.stringify(context.existingData, null, 2)}\n\n`
        : "";

      const schemaPrompt = `Extract the following fields from the document:\n${JSON.stringify(schema, null, 2)}\n\n`;

      const prompt = `${schemaPrompt}${contextPrompt}${existingDataPrompt}Document text:\n\n${text}\n\nRespond with a JSON object containing the extracted fields. Use null for fields that cannot be determined. Output ONLY the JSON, no other text.`;

      const responseText = await this.generate(this.model, prompt);

      const extractedData = this.parseJsonSafely(responseText);
      if (!extractedData) {
        return {
          success: false,
          data: {},
          confidence: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          rawResponse: responseText,
          error: "Failed to extract JSON from response",
        };
      }

      return {
        success: true,
        data: extractedData,
        confidence: 0.75,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        rawResponse: responseText,
      };
    } catch (error) {
      throw new AIProviderError(
        `Ollama extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        AICapability.TEXT_EXTRACTION,
        true
      );
    }
  }

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    schema: Record<string, unknown>,
    context?: { documentType?: string }
  ): Promise<VisionResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name, AICapability.VISION);
    }

    if (!this.hasVisionModel) {
      return {
        success: false,
        data: {},
        confidence: 0,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        error: "No vision-capable model available in Ollama",
      };
    }

    try {
      const base64Image = imageBuffer.toString("base64");

      const contextPrompt = context?.documentType
        ? `This appears to be a ${context.documentType} certificate. `
        : "";

      const schemaPrompt = `Extract the following fields from the document image:\n${JSON.stringify(schema, null, 2)}\n\n`;

      const prompt = `${schemaPrompt}${contextPrompt}Analyze this document image and extract the requested fields. Respond with a JSON object containing the extracted fields. Use null for fields that cannot be determined. Output ONLY the JSON, no other text.`;

      const responseText = await this.generate(this.visionModel, prompt, [base64Image]);

      const extractedData = this.parseJsonSafely(responseText);
      if (!extractedData) {
        return {
          success: false,
          data: {},
          confidence: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          rawResponse: responseText,
          error: "Failed to extract JSON from response",
        };
      }

      return {
        success: true,
        data: extractedData,
        confidence: 0.70,
        cost: 0,
        processingTimeMs: Date.now() - startTime,
        rawResponse: responseText,
      };
    } catch (error) {
      throw new AIProviderError(
        `Ollama vision extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        AICapability.VISION,
        true
      );
    }
  }

  async extractFromPDF(
    _pdfBuffer: Buffer,
    _schema: Record<string, unknown>,
    _context?: { documentType?: string }
  ): Promise<VisionResult> {
    return {
      success: false,
      data: {},
      confidence: 0,
      cost: 0,
      processingTimeMs: 0,
      error: "Ollama does not support direct PDF extraction. Convert to images first.",
    };
  }
}

const ollamaProvider = new OllamaProvider();
aiRegistry.register(ollamaProvider, 60);

export { ollamaProvider };
