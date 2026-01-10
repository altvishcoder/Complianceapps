import Anthropic from "@anthropic-ai/sdk";
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

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export class ClaudeProvider implements ILLMProvider, IVisionProvider {
  readonly name = "Anthropic Claude";
  readonly type = AIProviderType.CLAUDE;
  readonly capabilities = [
    AICapability.TEXT_EXTRACTION,
    AICapability.VISION,
    AICapability.CHAT,
  ];

  private client: Anthropic | null = null;
  private textModel: string = "claude-sonnet-4-20250514";
  private visionModel: string = "claude-sonnet-4-20250514";
  private configured: boolean = false;

  constructor(config?: { model?: string; visionModel?: string }) {
    if (config?.model) this.textModel = config.model;
    if (config?.visionModel) this.visionModel = config.visionModel;
  }

  async initialize(): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured && this.client !== null;
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const startTime = Date.now();
    
    if (!this.isConfigured()) {
      return {
        isHealthy: false,
        lastChecked: new Date(),
        error: "Claude not configured - ANTHROPIC_API_KEY missing",
      };
    }

    try {
      await this.client!.messages.create({
        model: this.textModel,
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      });

      return {
        isHealthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
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

      const response = await this.client!.messages.create({
        model: this.textModel,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${schemaPrompt}${contextPrompt}${existingDataPrompt}Document text:\n\n${text}\n\nRespond with a JSON object containing the extracted fields. Use null for fields that cannot be determined.`,
          },
        ],
      });

      const responseText = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("");

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          data: {},
          confidence: 0,
          cost: this.estimateCost(text.length, responseText.length),
          processingTimeMs: Date.now() - startTime,
          rawResponse: responseText,
          error: "Failed to extract JSON from response",
        };
      }

      const extractedData = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        data: extractedData,
        confidence: 0.85,
        cost: this.estimateCost(text.length, responseText.length),
        processingTimeMs: Date.now() - startTime,
        rawResponse: responseText,
      };
    } catch (error) {
      throw new AIProviderError(
        `Claude extraction failed: ${error instanceof Error ? error.message : String(error)}`,
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

    try {
      const base64Image = imageBuffer.toString("base64");
      const supportedTypes: MediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      let mediaType: MediaType = "image/jpeg";

      if (supportedTypes.includes(mimeType as MediaType)) {
        mediaType = mimeType as MediaType;
      }

      const contextPrompt = context?.documentType
        ? `This appears to be a ${context.documentType} certificate. `
        : "";

      const schemaPrompt = `Extract the following fields from the document image:\n${JSON.stringify(schema, null, 2)}\n\n`;

      const response = await this.client!.messages.create({
        model: this.visionModel,
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
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: `${schemaPrompt}${contextPrompt}Analyze this document image and extract the requested fields. Respond with a JSON object containing the extracted fields. Use null for fields that cannot be determined.`,
              },
            ],
          },
        ],
      });

      const responseText = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("");

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          data: {},
          confidence: 0,
          cost: this.estimateVisionCost(imageBuffer.length),
          processingTimeMs: Date.now() - startTime,
          rawResponse: responseText,
          error: "Failed to extract JSON from response",
        };
      }

      const extractedData = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        data: extractedData,
        confidence: 0.88,
        cost: this.estimateVisionCost(imageBuffer.length),
        processingTimeMs: Date.now() - startTime,
        rawResponse: responseText,
      };
    } catch (error) {
      throw new AIProviderError(
        `Claude vision extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        AICapability.VISION,
        true
      );
    }
  }

  async extractFromPDF(
    pdfBuffer: Buffer,
    schema: Record<string, unknown>,
    context?: { documentType?: string }
  ): Promise<VisionResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name, AICapability.VISION);
    }

    try {
      const base64Pdf = pdfBuffer.toString("base64");

      const contextPrompt = context?.documentType
        ? `This appears to be a ${context.documentType} certificate. `
        : "";

      const schemaPrompt = `Extract the following fields from the document:\n${JSON.stringify(schema, null, 2)}\n\n`;

      const response = await this.client!.messages.create({
        model: this.visionModel,
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
                  data: base64Pdf,
                },
              },
              {
                type: "text",
                text: `${schemaPrompt}${contextPrompt}Analyze this document and extract the requested fields. Respond with a JSON object containing the extracted fields. Use null for fields that cannot be determined.`,
              },
            ],
          },
        ],
      });

      const responseText = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("");

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          data: {},
          confidence: 0,
          cost: this.estimateVisionCost(pdfBuffer.length),
          processingTimeMs: Date.now() - startTime,
          rawResponse: responseText,
          error: "Failed to extract JSON from response",
        };
      }

      const extractedData = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        data: extractedData,
        confidence: 0.88,
        cost: this.estimateVisionCost(pdfBuffer.length),
        processingTimeMs: Date.now() - startTime,
        rawResponse: responseText,
      };
    } catch (error) {
      throw new AIProviderError(
        `Claude PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        AICapability.VISION,
        true
      );
    }
  }

  private estimateCost(inputChars: number, outputChars: number): number {
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }

  private estimateVisionCost(imageBytes: number): number {
    const baseVisionCost = 0.008;
    const sizeFactor = Math.ceil(imageBytes / (1024 * 1024));
    return baseVisionCost * Math.max(1, sizeFactor);
  }
}

aiRegistry.register(new ClaudeProvider(), 20);
