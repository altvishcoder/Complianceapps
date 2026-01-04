import type { ExtractionTier, ExtractedCertificateData } from '../types';

export interface ExtractionResult {
  success: boolean;
  confidence: number;
  data: Partial<ExtractedCertificateData> | null;
  provider: string;
  tier: ExtractionTier;
  costIncurred: number;
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractionContext {
  documentId: string;
  certificateType?: string;
  previousAttempts?: ExtractionResult[];
  textContent?: string;
  mimeType?: string;
  filename?: string;
}

export interface ExtractionAdapter {
  readonly name: string;
  readonly tier: ExtractionTier;
  readonly costPerCall: number;
  
  extract(document: Buffer, context: ExtractionContext): Promise<ExtractionResult>;
  
  isAvailable(): boolean;
}

export interface TierAuditSink {
  recordAttempt(audit: TierAuditEntry): Promise<void>;
  getAuditLog(): TierAuditEntry[];
}

export interface TierAuditEntry {
  documentId: string;
  tier: ExtractionTier;
  provider: string;
  timestamp: Date;
  success: boolean;
  confidence: number | null;
  costIncurred: number;
  escalationReason: string | null;
  durationMs: number;
}

export class InMemoryTierAuditSink implements TierAuditSink {
  private entries: TierAuditEntry[] = [];

  async recordAttempt(audit: TierAuditEntry): Promise<void> {
    this.entries.push(audit);
  }

  getAuditLog(): TierAuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}
