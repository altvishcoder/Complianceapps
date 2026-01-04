import type { ExtractionTier } from '../types';
import type { ExtractionAdapter, ExtractionResult, ExtractionContext } from './types';

export class StubExtractionAdapter implements ExtractionAdapter {
  readonly name: string;
  readonly tier: ExtractionTier;
  readonly costPerCall: number;

  private callCount = 0;
  private responses: Array<ExtractionResult | Error>;
  private available = true;

  constructor(config: {
    name: string;
    tier: ExtractionTier;
    costPerCall?: number;
    responses: Array<ExtractionResult | Error>;
    available?: boolean;
  }) {
    this.name = config.name;
    this.tier = config.tier;
    this.costPerCall = config.costPerCall ?? 0;
    this.responses = config.responses;
    this.available = config.available ?? true;
  }

  async extract(_document: Buffer, _context: ExtractionContext): Promise<ExtractionResult> {
    const response = this.responses[this.callCount] ?? this.responses[this.responses.length - 1];
    this.callCount++;

    if (response instanceof Error) {
      throw response;
    }
    return response;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }
}

export function createSuccessfulAdapter(
  tier: ExtractionTier, 
  confidence: number,
  data: Partial<Record<string, unknown>> = {}
): StubExtractionAdapter {
  return new StubExtractionAdapter({
    name: `stub-${tier}`,
    tier,
    responses: [{
      success: true,
      confidence,
      data: {
        certificateType: 'GAS_SAFETY',
        certificateNumber: `TEST-${tier}-001`,
        propertyAddress: '123 Test Street',
        ...data,
      } as any,
      provider: `stub-${tier}`,
      tier,
      costIncurred: 0,
      processingTimeMs: 10,
    }],
  });
}

export function createFailingAdapter(
  tier: ExtractionTier, 
  error?: Error
): StubExtractionAdapter {
  return new StubExtractionAdapter({
    name: `stub-${tier}`,
    tier,
    responses: [error ?? new Error(`${tier} extraction failed`)],
  });
}

export function createLowConfidenceAdapter(
  tier: ExtractionTier, 
  confidence: number
): StubExtractionAdapter {
  return new StubExtractionAdapter({
    name: `stub-${tier}`,
    tier,
    responses: [{
      success: true,
      confidence,
      data: {
        certificateType: 'GAS_SAFETY',
      } as any,
      provider: `stub-${tier}`,
      tier,
      costIncurred: 0,
      processingTimeMs: 10,
    }],
  });
}

export function createCostlyAdapter(
  tier: ExtractionTier,
  confidence: number,
  cost: number
): StubExtractionAdapter {
  return new StubExtractionAdapter({
    name: `stub-${tier}`,
    tier,
    costPerCall: cost,
    responses: [{
      success: true,
      confidence,
      data: {
        certificateType: 'GAS_SAFETY',
      } as any,
      provider: `stub-${tier}`,
      tier,
      costIncurred: cost,
      processingTimeMs: 50,
    }],
  });
}

export function createUnavailableAdapter(tier: ExtractionTier): StubExtractionAdapter {
  return new StubExtractionAdapter({
    name: `stub-${tier}`,
    tier,
    responses: [],
    available: false,
  });
}
