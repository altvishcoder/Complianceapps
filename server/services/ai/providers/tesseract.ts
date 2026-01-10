import { createWorker, Worker } from "tesseract.js";
import {
  AIProviderType,
  AICapability,
  IOCRProvider,
  AIProviderHealth,
  OCRResult,
  AIProviderError,
} from "./types";
import { aiRegistry } from "./registry";

export interface TesseractProviderConfig {
  languages?: string[];
  dataPath?: string;
}

export class TesseractProvider implements IOCRProvider {
  readonly name = "Tesseract.js OCR";
  readonly type = AIProviderType.TESSERACT;
  readonly capabilities = [AICapability.OCR];

  private languages: string[];
  private dataPath?: string;
  private worker: Worker | null = null;
  private configured: boolean = false;
  private initializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(config?: TesseractProviderConfig) {
    this.languages = config?.languages || ["eng"];
    this.dataPath = config?.dataPath;
  }

  async initialize(): Promise<void> {
    if (this.configured) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (this.initializing || this.configured) return;
    this.initializing = true;

    try {
      const workerOptions: Record<string, unknown> = {
        logger: () => {},
      };
      
      if (this.dataPath) {
        workerOptions.langPath = this.dataPath;
      }

      this.worker = await createWorker(this.languages, 1, workerOptions);
      this.configured = true;
      console.log(`[TesseractProvider] Initialized with languages: ${this.languages.join(", ")}`);
    } catch (error) {
      console.error("[TesseractProvider] Failed to initialize worker:", error);
      this.configured = false;
      this.worker = null;
      throw error;
    } finally {
      this.initializing = false;
      this.initPromise = null;
    }
  }

  isConfigured(): boolean {
    return true;
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.worker) {
        await this.initialize();
      }

      if (!this.worker) {
        return {
          isHealthy: false,
          lastChecked: new Date(),
          error: "Tesseract worker failed to initialize",
        };
      }

      const testImage = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAADklEQVR4AWNgGAWDEwAAAZoAASRhsLsAAAAASUVORK5CYII=",
        "base64"
      );
      
      await this.worker.recognize(testImage);

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

  async extractText(buffer: Buffer, mimeType: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      if (!this.worker) {
        await this.initialize();
      }

      if (!this.worker) {
        return {
          success: false,
          text: "",
          confidence: 0,
          processingTimeMs: Date.now() - startTime,
          cost: 0,
          error: "Tesseract worker not available",
        };
      }

      const supportedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/webp",
        "image/tiff",
      ];

      if (!supportedTypes.includes(mimeType) && !mimeType.startsWith("image/")) {
        return {
          success: false,
          text: "",
          confidence: 0,
          processingTimeMs: Date.now() - startTime,
          cost: 0,
          error: `Unsupported mime type: ${mimeType}. Tesseract only supports images.`,
        };
      }

      const result = await this.worker.recognize(buffer);

      const text = result.data.text.trim();
      const confidence = result.data.confidence / 100;

      return {
        success: true,
        text,
        confidence,
        processingTimeMs: Date.now() - startTime,
        cost: 0,
        pageCount: 1,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        text: "",
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
        cost: 0,
        error: `Tesseract OCR failed: ${errorMessage}`,
      };
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
      }
      this.worker = null;
      this.configured = false;
    }
  }
}

const tesseractProvider = new TesseractProvider();
aiRegistry.register(tesseractProvider, 50);

export { tesseractProvider };
