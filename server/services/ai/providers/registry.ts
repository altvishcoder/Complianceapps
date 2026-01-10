import {
  AIProviderType,
  AICapability,
  IOCRProvider,
  ILLMProvider,
  IVisionProvider,
  IDocumentIntelligenceProvider,
  AIProviderHealth,
  AIProviderUnavailableError,
} from "./types";

type AnyProvider = IOCRProvider | ILLMProvider | IVisionProvider | IDocumentIntelligenceProvider;

interface ProviderEntry {
  provider: AnyProvider;
  priority: number;
  capabilities: Set<AICapability>;
}

class AIProviderRegistry {
  private providers = new Map<AIProviderType, ProviderEntry>();
  private healthCache = new Map<AIProviderType, AIProviderHealth>();
  private initialized = false;

  register(
    provider: AnyProvider,
    priority: number = 100
  ): void {
    this.providers.set(provider.type, {
      provider,
      priority,
      capabilities: new Set(provider.capabilities),
    });
  }

  unregister(type: AIProviderType): void {
    this.providers.delete(type);
    this.healthCache.delete(type);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const initPromises: Promise<void>[] = [];
    
    for (const [, entry] of Array.from(this.providers.entries())) {
      initPromises.push(
        entry.provider.initialize()
          .then(() => console.log(`[AIRegistry] Initialized ${entry.provider.name}`))
          .catch((err: unknown) => console.error(`[AIRegistry] Failed to initialize ${entry.provider.name}:`, err))
      );
    }

    await Promise.allSettled(initPromises);
    this.initialized = true;
  }

  async healthCheckAll(): Promise<Map<AIProviderType, AIProviderHealth>> {
    const results = new Map<AIProviderType, AIProviderHealth>();
    
    const checks = Array.from(this.providers.entries()).map(async ([type, entry]) => {
      try {
        const health = await entry.provider.healthCheck();
        this.healthCache.set(type, health);
        results.set(type, health);
      } catch (error) {
        const health: AIProviderHealth = {
          isHealthy: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        this.healthCache.set(type, health);
        results.set(type, health);
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  getHealth(type: AIProviderType): AIProviderHealth | undefined {
    return this.healthCache.get(type);
  }

  getProvider<T extends AnyProvider>(type: AIProviderType): T | undefined {
    const entry = this.providers.get(type);
    return entry?.provider as T | undefined;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  getProvidersForCapability(capability: AICapability): AnyProvider[] {
    const matching: { provider: AnyProvider; priority: number }[] = [];

    for (const entry of Array.from(this.providers.values())) {
      if (entry.capabilities.has(capability) && entry.provider.isConfigured()) {
        matching.push({ provider: entry.provider, priority: entry.priority });
      }
    }

    return matching
      .sort((a, b) => a.priority - b.priority)
      .map((e) => e.provider);
  }

  async getProvidersForCapabilityAsync(capability: AICapability): Promise<AnyProvider[]> {
    await this.ensureInitialized();
    return this.getProvidersForCapability(capability);
  }

  getOCRProvider(): IOCRProvider | undefined {
    const providers = this.getProvidersForCapability(AICapability.OCR);
    return providers[0] as IOCRProvider | undefined;
  }

  getLLMProvider(): ILLMProvider | undefined {
    const providers = this.getProvidersForCapability(AICapability.TEXT_EXTRACTION);
    return providers[0] as ILLMProvider | undefined;
  }

  getVisionProvider(): IVisionProvider | undefined {
    const providers = this.getProvidersForCapability(AICapability.VISION);
    return providers[0] as IVisionProvider | undefined;
  }

  getDocumentIntelligenceProvider(): IDocumentIntelligenceProvider | undefined {
    const providers = this.getProvidersForCapability(AICapability.DOCUMENT_INTELLIGENCE);
    return providers[0] as IDocumentIntelligenceProvider | undefined;
  }

  async getHealthyOCRProvider(): Promise<IOCRProvider> {
    await this.ensureInitialized();
    const providers = this.getProvidersForCapability(AICapability.OCR);
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (health.isHealthy) {
        return provider as IOCRProvider;
      }
    }

    throw new AIProviderUnavailableError("any", AICapability.OCR);
  }

  async getHealthyLLMProvider(): Promise<ILLMProvider> {
    await this.ensureInitialized();
    const providers = this.getProvidersForCapability(AICapability.TEXT_EXTRACTION);
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (health.isHealthy) {
        return provider as ILLMProvider;
      }
    }

    throw new AIProviderUnavailableError("any", AICapability.TEXT_EXTRACTION);
  }

  async getHealthyVisionProvider(): Promise<IVisionProvider> {
    await this.ensureInitialized();
    const providers = this.getProvidersForCapability(AICapability.VISION);
    
    for (const provider of providers) {
      const health = await provider.healthCheck();
      if (health.isHealthy) {
        return provider as IVisionProvider;
      }
    }

    throw new AIProviderUnavailableError("any", AICapability.VISION);
  }

  listProviders(): Array<{
    type: AIProviderType;
    name: string;
    capabilities: AICapability[];
    priority: number;
    configured: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([type, entry]) => ({
      type,
      name: entry.provider.name,
      capabilities: Array.from(entry.capabilities),
      priority: entry.priority,
      configured: entry.provider.isConfigured(),
    }));
  }

  clear(): void {
    this.providers.clear();
    this.healthCache.clear();
    this.initialized = false;
  }
}

export const aiRegistry = new AIProviderRegistry();

export function getAIRegistry(): AIProviderRegistry {
  return aiRegistry;
}
