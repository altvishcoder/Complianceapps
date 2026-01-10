export enum AIProviderType {
  AZURE_DI = "azure_di",
  CLAUDE = "claude",
  OPENAI = "openai",
  TESSERACT = "tesseract",
  OLLAMA = "ollama",
  LOCAL = "local",
}

export { AIProviderType as AIProviderTypeEnum };

export enum AICapability {
  OCR = "ocr",
  TEXT_EXTRACTION = "text_extraction",
  VISION = "vision",
  DOCUMENT_INTELLIGENCE = "document_intelligence",
  CHAT = "chat",
}

export interface AIProviderHealth {
  isHealthy: boolean;
  latencyMs?: number;
  lastChecked: Date;
  error?: string;
}

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  pageCount?: number;
  processingTimeMs: number;
  cost: number;
  error?: string;
}

export interface LLMExtractionResult {
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  cost: number;
  processingTimeMs: number;
  rawResponse?: string;
  error?: string;
}

export interface VisionResult {
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  cost: number;
  processingTimeMs: number;
  rawResponse?: string;
  description?: string;
  error?: string;
}

export interface IOCRProvider {
  readonly name: string;
  readonly type: AIProviderType;
  readonly capabilities: AICapability[];
  
  initialize(): Promise<void>;
  healthCheck(): Promise<AIProviderHealth>;
  isConfigured(): boolean;
  
  extractText(buffer: Buffer, mimeType: string): Promise<OCRResult>;
}

export interface ILLMProvider {
  readonly name: string;
  readonly type: AIProviderType;
  readonly capabilities: AICapability[];
  
  initialize(): Promise<void>;
  healthCheck(): Promise<AIProviderHealth>;
  isConfigured(): boolean;
  
  extractFromText(
    text: string,
    schema: Record<string, unknown>,
    context?: { documentType?: string; existingData?: Record<string, unknown> }
  ): Promise<LLMExtractionResult>;
}

export interface IVisionProvider {
  readonly name: string;
  readonly type: AIProviderType;
  readonly capabilities: AICapability[];
  
  initialize(): Promise<void>;
  healthCheck(): Promise<AIProviderHealth>;
  isConfigured(): boolean;
  
  extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    schema: Record<string, unknown>,
    context?: { documentType?: string }
  ): Promise<VisionResult>;
  
  extractFromPDF?(
    pdfBuffer: Buffer,
    schema: Record<string, unknown>,
    context?: { documentType?: string }
  ): Promise<VisionResult>;
}

export interface IDocumentIntelligenceProvider extends IOCRProvider {
  analyzeDocument(
    buffer: Buffer,
    mimeType: string,
    modelId?: string
  ): Promise<{
    success: boolean;
    text: string;
    structuredData: Record<string, unknown>;
    confidence: number;
    pageCount: number;
    cost: number;
    processingTimeMs: number;
    error?: string;
  }>;
}

export interface AIProviderConfig {
  type: AIProviderType;
  priority: number;
  enabled: boolean;
  fallbackTo?: AIProviderType;
}

export interface AzureDIConfig extends AIProviderConfig {
  type: AIProviderType.AZURE_DI;
  endpoint: string;
  apiKey: string;
  apiVersion?: string;
}

export interface ClaudeConfig extends AIProviderConfig {
  type: AIProviderType.CLAUDE;
  apiKey: string;
  model?: string;
  visionModel?: string;
}

export interface OllamaConfig extends AIProviderConfig {
  type: AIProviderType.OLLAMA;
  baseUrl: string;
  model: string;
  visionModel?: string;
}

export interface TesseractConfig extends AIProviderConfig {
  type: AIProviderType.TESSERACT;
  languages?: string[];
  dataPath?: string;
}

export type AnyAIProviderConfig = 
  | AzureDIConfig 
  | ClaudeConfig 
  | OllamaConfig 
  | TesseractConfig;

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly capability: AICapability,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = "AIProviderError";
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}

export class AIProviderUnavailableError extends AIProviderError {
  constructor(provider: string, capability: AICapability) {
    super(`AI provider ${provider} is unavailable for ${capability}`, provider, capability, true);
    this.name = "AIProviderUnavailableError";
  }
}

export class AIProviderNotConfiguredError extends AIProviderError {
  constructor(provider: string, capability: AICapability) {
    super(`AI provider ${provider} is not configured for ${capability}`, provider, capability, false);
    this.name = "AIProviderNotConfiguredError";
  }
}
