# ComplianceAI™ Model Ownership — Phase 5
## Benchmarking & Evaluation

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 5 (3-4 days) |
| **Objective** | Measure extraction quality and gate releases |
| **Prerequisites** | Phase 1-4 complete |
| **Outcome** | Quantified accuracy, regression prevention |

```
WHAT WE'RE BUILDING:

  ┌─────────────────┐
  │ BENCHMARK SET   │ ──► 50-200 "gold standard" certificates
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │    SCORER       │ ──► Compare extraction vs expected
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   EVAL RUN      │ ──► Overall score + per-field metrics
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ RELEASE GATING  │ ──► Only ship if score improves
  └─────────────────┘
```

---

## Step 1: Create Benchmark Scoring System

### Prompt 5.1: Scoring Engine

```
Create the benchmark scoring system for evaluating extraction quality.

1. Create directory: src/lib/benchmarks/

2. Create src/lib/benchmarks/types.ts:

// ==========================================
// BENCHMARK TYPES
// ==========================================

export interface BenchmarkScore {
  overall: number;  // 0-100
  
  // Field-level scores
  fields: {
    exact_match: FieldScores;
    fuzzy_match: FieldScores;
  };
  
  // List accuracy (observations, remedials, appliances)
  lists: {
    observations: ListScore;
    remedial_actions: ListScore;
    appliances?: ListScore;
    codes?: ListScore;
  };
  
  // Evidence quality
  evidence: {
    present_rate: number;  // % of fields with evidence
    accuracy: number;      // % of evidence that matches value
  };
  
  // Schema compliance
  schema: {
    valid_rate: number;    // % that pass validation
    error_count: number;
  };
}

export interface FieldScores {
  [fieldPath: string]: {
    score: number;      // 0-1
    expected: any;
    actual: any;
    match_type: 'exact' | 'fuzzy' | 'missing' | 'wrong';
  };
}

export interface ListScore {
  precision: number;  // % of extracted items that are correct
  recall: number;     // % of expected items that were found
  f1: number;         // Harmonic mean of precision & recall
  expected_count: number;
  actual_count: number;
  matched_count: number;
}

export interface ItemResult {
  itemId: string;
  certificateId: string;
  documentType: string;
  score: BenchmarkScore;
  extraction: any;
  expected: any;
  errors: string[];
}

export interface EvalRunResult {
  evalRunId: string;
  benchmarkSetId: string;
  
  // Aggregate scores
  overallScore: number;
  exactMatchRate: number;
  evidenceAccuracy: number;
  schemaValidRate: number;
  
  // By document type
  byDocumentType: Record<string, {
    score: number;
    count: number;
  }>;
  
  // Item results
  itemResults: ItemResult[];
  
  // Comparison
  comparison?: {
    previousScore: number;
    delta: number;
    improved: string[];
    regressed: string[];
  };
  
  // Gating
  passedGating: boolean;
  gatingReason?: string;
}

3. Create src/lib/benchmarks/scorer.ts:

import { BenchmarkScore, FieldScores, ListScore, ItemResult } from './types';

// ==========================================
// MAIN SCORING FUNCTION
// ==========================================

export function scoreExtraction(
  extracted: any,
  expected: any,
  documentType: string
): BenchmarkScore {
  const exactMatchFields = scoreExactMatchFields(extracted, expected, documentType);
  const fuzzyMatchFields = scoreFuzzyMatchFields(extracted, expected);
  const listScores = scoreListFields(extracted, expected, documentType);
  const evidenceScores = scoreEvidence(extracted, expected);
  const schemaScores = scoreSchemaCompliance(extracted, documentType);
  
  // Calculate overall score (weighted average)
  const weights = {
    exactMatch: 0.30,
    fuzzyMatch: 0.15,
    lists: 0.25,
    evidence: 0.15,
    schema: 0.15,
  };
  
  const exactMatchScore = calculateFieldScoreAverage(exactMatchFields);
  const fuzzyMatchScore = calculateFieldScoreAverage(fuzzyMatchFields);
  const listScore = calculateListScoreAverage(listScores);
  
  const overall = Math.round(
    (exactMatchScore * weights.exactMatch +
     fuzzyMatchScore * weights.fuzzyMatch +
     listScore * weights.lists +
     evidenceScores.accuracy * weights.evidence +
     schemaScores.valid_rate * weights.schema) * 100
  );
  
  return {
    overall,
    fields: {
      exact_match: exactMatchFields,
      fuzzy_match: fuzzyMatchFields,
    },
    lists: listScores,
    evidence: evidenceScores,
    schema: schemaScores,
  };
}

// ==========================================
// EXACT MATCH SCORING
// ==========================================

function scoreExactMatchFields(
  extracted: any,
  expected: any,
  documentType: string
): FieldScores {
  const scores: FieldScores = {};
  
  // Core fields to exact match
  const exactFields = [
    'inspection.date',
    'inspection.outcome',
    'inspection.next_due_date',
    'engineer.name',
    'engineer.registration_id',
    'property.postcode',
  ];
  
  // Add document-specific fields
  if (documentType === 'GAS_SAFETY') {
    exactFields.push(
      'gas_specific.gas_safe_number',
      'gas_specific.certificate_number',
      'gas_specific.appliance_count'
    );
  } else if (documentType === 'EICR') {
    exactFields.push(
      'eicr_specific.overall_assessment',
      'eicr_specific.report_reference',
      'eicr_specific.code_summary.c1_count',
      'eicr_specific.code_summary.c2_count'
    );
  }
  
  for (const field of exactFields) {
    const extractedValue = getNestedValue(extracted, field);
    const expectedValue = getNestedValue(expected, field);
    
    const normalizedExtracted = normalizeValue(extractedValue);
    const normalizedExpected = normalizeValue(expectedValue);
    
    let matchType: 'exact' | 'fuzzy' | 'missing' | 'wrong';
    let score: number;
    
    if (normalizedExpected === null || normalizedExpected === undefined) {
      // Expected is null, so extracted being null is correct
      score = normalizedExtracted === null ? 1 : 0.5;
      matchType = normalizedExtracted === null ? 'exact' : 'wrong';
    } else if (normalizedExtracted === null || normalizedExtracted === undefined) {
      score = 0;
      matchType = 'missing';
    } else if (normalizedExtracted === normalizedExpected) {
      score = 1;
      matchType = 'exact';
    } else {
      score = 0;
      matchType = 'wrong';
    }
    
    scores[field] = {
      score,
      expected: expectedValue,
      actual: extractedValue,
      match_type: matchType,
    };
  }
  
  return scores;
}

// ==========================================
// FUZZY MATCH SCORING
// ==========================================

function scoreFuzzyMatchFields(
  extracted: any,
  expected: any
): FieldScores {
  const scores: FieldScores = {};
  
  const fuzzyFields = [
    { path: 'property.address_line_1', threshold: 0.8 },
    { path: 'property.address_line_2', threshold: 0.7 },
    { path: 'property.city', threshold: 0.8 },
    { path: 'engineer.company', threshold: 0.7 },
  ];
  
  for (const { path, threshold } of fuzzyFields) {
    const extractedValue = getNestedValue(extracted, path);
    const expectedValue = getNestedValue(expected, path);
    
    if (!expectedValue) {
      scores[path] = {
        score: extractedValue ? 0.5 : 1,
        expected: expectedValue,
        actual: extractedValue,
        match_type: extractedValue ? 'wrong' : 'exact',
      };
      continue;
    }
    
    if (!extractedValue) {
      scores[path] = {
        score: 0,
        expected: expectedValue,
        actual: extractedValue,
        match_type: 'missing',
      };
      continue;
    }
    
    const similarity = calculateStringSimilarity(
      String(extractedValue).toLowerCase(),
      String(expectedValue).toLowerCase()
    );
    
    scores[path] = {
      score: similarity,
      expected: expectedValue,
      actual: extractedValue,
      match_type: similarity >= threshold ? 'fuzzy' : 'wrong',
    };
  }
  
  return scores;
}

// Levenshtein-based similarity
function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

// ==========================================
// LIST SCORING
// ==========================================

function scoreListFields(
  extracted: any,
  expected: any,
  documentType: string
): Record<string, ListScore> {
  const scores: Record<string, ListScore> = {};
  
  // Observations
  scores.observations = scoreList(
    extracted.findings?.observations || [],
    expected.findings?.observations || [],
    matchObservation
  );
  
  // Remedial actions
  scores.remedial_actions = scoreList(
    extracted.findings?.remedial_actions || [],
    expected.findings?.remedial_actions || [],
    matchRemedialAction
  );
  
  // Document-specific lists
  if (documentType === 'GAS_SAFETY') {
    scores.appliances = scoreList(
      extracted.gas_specific?.appliances || [],
      expected.gas_specific?.appliances || [],
      matchAppliance
    );
  }
  
  if (documentType === 'EICR') {
    scores.codes = scoreList(
      extracted.eicr_specific?.codes || [],
      expected.eicr_specific?.codes || [],
      matchEICRCode
    );
  }
  
  return scores;
}

function scoreList(
  extracted: any[],
  expected: any[],
  matcher: (a: any, b: any) => boolean
): ListScore {
  if (expected.length === 0) {
    return {
      precision: extracted.length === 0 ? 1 : 0,
      recall: 1,
      f1: extracted.length === 0 ? 1 : 0,
      expected_count: 0,
      actual_count: extracted.length,
      matched_count: 0,
    };
  }
  
  let matchedCount = 0;
  const matchedExpected = new Set<number>();
  
  for (const ext of extracted) {
    for (let i = 0; i < expected.length; i++) {
      if (!matchedExpected.has(i) && matcher(ext, expected[i])) {
        matchedCount++;
        matchedExpected.add(i);
        break;
      }
    }
  }
  
  const precision = extracted.length > 0 ? matchedCount / extracted.length : 0;
  const recall = expected.length > 0 ? matchedCount / expected.length : 0;
  const f1 = precision + recall > 0 
    ? 2 * (precision * recall) / (precision + recall) 
    : 0;
  
  return {
    precision,
    recall,
    f1,
    expected_count: expected.length,
    actual_count: extracted.length,
    matched_count: matchedCount,
  };
}

// Matchers for list items
function matchObservation(a: any, b: any): boolean {
  if (!a.description || !b.description) return false;
  const similarity = calculateStringSimilarity(
    a.description.toLowerCase(),
    b.description.toLowerCase()
  );
  return similarity > 0.7;
}

function matchRemedialAction(a: any, b: any): boolean {
  if (!a.description || !b.description) return false;
  const similarity = calculateStringSimilarity(
    a.description.toLowerCase(),
    b.description.toLowerCase()
  );
  // Also check priority if both have it
  if (a.priority && b.priority && a.priority !== b.priority) {
    return similarity > 0.85; // Higher threshold if priority mismatch
  }
  return similarity > 0.7;
}

function matchAppliance(a: any, b: any): boolean {
  // Match by type and location
  if (!a.type || !b.type) return false;
  const typeMatch = a.type.toLowerCase() === b.type.toLowerCase();
  const locationMatch = !a.location || !b.location || 
    calculateStringSimilarity(a.location.toLowerCase(), b.location.toLowerCase()) > 0.7;
  return typeMatch && locationMatch;
}

function matchEICRCode(a: any, b: any): boolean {
  // Match by code type and description similarity
  if (a.code !== b.code) return false;
  if (!a.description || !b.description) return true; // Code match is enough
  return calculateStringSimilarity(
    a.description.toLowerCase(),
    b.description.toLowerCase()
  ) > 0.6;
}

// ==========================================
// EVIDENCE SCORING
// ==========================================

function scoreEvidence(
  extracted: any,
  expected: any
): { present_rate: number; accuracy: number } {
  const evidenceFields = [
    'property.evidence',
    'inspection.evidence',
    'engineer.evidence',
  ];
  
  let presentCount = 0;
  let accurateCount = 0;
  let totalChecked = 0;
  
  for (const field of evidenceFields) {
    const evidence = getNestedValue(extracted, field);
    const parentField = field.replace('.evidence', '');
    const value = getNestedValue(extracted, parentField);
    
    totalChecked++;
    
    if (evidence && evidence.page && evidence.text_snippet) {
      presentCount++;
      
      // Check if evidence contains the extracted value
      if (value && typeof value === 'object') {
        // For objects, check if any value appears in snippet
        const values = Object.values(value).filter(v => v && typeof v === 'string');
        const hasMatch = values.some(v => 
          evidence.text_snippet.toLowerCase().includes(String(v).toLowerCase().substring(0, 10))
        );
        if (hasMatch) accurateCount++;
      } else if (value) {
        const valueStr = String(value).toLowerCase();
        if (evidence.text_snippet.toLowerCase().includes(valueStr.substring(0, 10))) {
          accurateCount++;
        }
      }
    }
  }
  
  return {
    present_rate: totalChecked > 0 ? presentCount / totalChecked : 0,
    accuracy: presentCount > 0 ? accurateCount / presentCount : 0,
  };
}

// ==========================================
// SCHEMA COMPLIANCE SCORING
// ==========================================

function scoreSchemaCompliance(
  extracted: any,
  documentType: string
): { valid_rate: number; error_count: number } {
  // Import validator
  const { validateExtraction } = require('../extraction-schemas/validators');
  
  try {
    const result = validateExtraction(documentType, extracted);
    return {
      valid_rate: result.valid ? 1 : 0,
      error_count: result.errors?.length || 0,
    };
  } catch {
    return { valid_rate: 0, error_count: 1 };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function normalizeValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  return value;
}

function calculateFieldScoreAverage(scores: FieldScores): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, s) => sum + s.score, 0) / values.length;
}

function calculateListScoreAverage(scores: Record<string, ListScore>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, s) => sum + s.f1, 0) / values.length;
}

// Export for use in runner
export { getNestedValue };
```

---

## Step 2: Create Benchmark Runner

### Prompt 5.2: Evaluation Runner

```
Create the benchmark runner that executes evaluations.

1. Create src/lib/benchmarks/runner.ts:

import { prisma } from '@/lib/db';
import { routeAndExtract } from '../extraction/router';
import { scoreExtraction } from './scorer';
import { EvalRunResult, ItemResult } from './types';
import { getFileFromStorage } from '../storage';

// ==========================================
// BENCHMARK RUNNER
// ==========================================

export interface RunBenchmarkOptions {
  benchmarkSetId: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  maxItems?: number;  // Limit for testing
}

export async function runBenchmark(
  options: RunBenchmarkOptions
): Promise<EvalRunResult> {
  const { benchmarkSetId } = options;
  
  // Load benchmark set
  const benchmarkSet = await prisma.benchmarkSet.findUnique({
    where: { id: benchmarkSetId },
    include: {
      items: {
        include: {
          certificate: true,
        },
      },
    },
  });
  
  if (!benchmarkSet) {
    throw new Error('Benchmark set not found');
  }
  
  // Limit items if specified
  const items = options.maxItems 
    ? benchmarkSet.items.slice(0, options.maxItems)
    : benchmarkSet.items;
  
  console.log(`Running benchmark "${benchmarkSet.name}" with ${items.length} items`);
  
  const itemResults: ItemResult[] = [];
  const scoresByType: Record<string, number[]> = {};
  
  // Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`Processing item ${i + 1}/${items.length}: ${item.certificate.originalFilename}`);
    
    try {
      // Load certificate file
      const fileBuffer = await getFileFromStorage(item.certificate.storagePath);
      
      // Run extraction
      const result = await routeAndExtract(
        fileBuffer,
        item.certificate.mimeType,
        {
          filename: item.certificate.originalFilename,
          uploadId: item.certificate.id,
          organisationId: item.certificate.organisationId,
          forceDocType: item.certificate.documentType as any,
        }
      );
      
      // Score extraction
      const score = scoreExtraction(
        result.extraction,
        item.expectedOutput,
        item.certificate.documentType
      );
      
      const itemResult: ItemResult = {
        itemId: item.id,
        certificateId: item.certificateId,
        documentType: item.certificate.documentType,
        score,
        extraction: result.extraction,
        expected: item.expectedOutput,
        errors: [],
      };
      
      itemResults.push(itemResult);
      
      // Track by document type
      const docType = item.certificate.documentType;
      if (!scoresByType[docType]) scoresByType[docType] = [];
      scoresByType[docType].push(score.overall);
      
    } catch (error) {
      console.error(`Error processing item ${item.id}:`, error);
      itemResults.push({
        itemId: item.id,
        certificateId: item.certificateId,
        documentType: item.certificate.documentType,
        score: { overall: 0, fields: { exact_match: {}, fuzzy_match: {} }, lists: {}, evidence: { present_rate: 0, accuracy: 0 }, schema: { valid_rate: 0, error_count: 1 } },
        extraction: null,
        expected: item.expectedOutput,
        errors: [(error as Error).message],
      });
    }
  }
  
  // Calculate aggregate scores
  const overallScore = itemResults.reduce((sum, r) => sum + r.score.overall, 0) / itemResults.length;
  
  const exactMatchRates = itemResults.map(r => {
    const fields = Object.values(r.score.fields.exact_match);
    return fields.filter(f => f.match_type === 'exact').length / (fields.length || 1);
  });
  const exactMatchRate = exactMatchRates.reduce((a, b) => a + b, 0) / exactMatchRates.length;
  
  const evidenceAccuracy = itemResults.reduce((sum, r) => sum + r.score.evidence.accuracy, 0) / itemResults.length;
  const schemaValidRate = itemResults.filter(r => r.score.schema.valid_rate === 1).length / itemResults.length;
  
  // By document type
  const byDocumentType: Record<string, { score: number; count: number }> = {};
  for (const [type, scores] of Object.entries(scoresByType)) {
    byDocumentType[type] = {
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    };
  }
  
  // Get previous run for comparison
  const previousRun = await prisma.evalRun.findFirst({
    where: { benchmarkSetId },
    orderBy: { createdAt: 'desc' },
  });
  
  let comparison: EvalRunResult['comparison'];
  if (previousRun) {
    const delta = overallScore - previousRun.overallScore;
    
    // Find improvements and regressions
    const improved: string[] = [];
    const regressed: string[] = [];
    
    const prevResults = previousRun.itemResults as any[];
    for (const result of itemResults) {
      const prevResult = prevResults.find((p: any) => p.itemId === result.itemId);
      if (prevResult) {
        if (result.score.overall > prevResult.score.overall + 5) {
          improved.push(result.itemId);
        } else if (result.score.overall < prevResult.score.overall - 5) {
          regressed.push(result.itemId);
        }
      }
    }
    
    comparison = {
      previousScore: previousRun.overallScore,
      delta,
      improved,
      regressed,
    };
  }
  
  // Determine gating
  const passedGating = checkGating(overallScore, comparison);
  const gatingReason = getGatingReason(overallScore, comparison);
  
  // Save eval run
  const evalRun = await prisma.evalRun.create({
    data: {
      benchmarkSetId,
      modelVersion: options.modelVersion || 'claude-sonnet-4-20250514',
      promptVersion: options.promptVersion || 'v1.0',
      schemaVersion: options.schemaVersion || 'v1.0',
      overallScore,
      exactMatchRate,
      evidenceAccuracy,
      schemaValidRate,
      scores: byDocumentType,
      itemResults: itemResults.map(r => ({
        itemId: r.itemId,
        score: r.score.overall,
        documentType: r.documentType,
        errors: r.errors,
      })),
      previousRunId: previousRun?.id,
      regressions: comparison?.regressed || [],
      improvements: comparison?.improved || [],
      scoreDelta: comparison?.delta,
      passedGating,
      gatingNotes: gatingReason,
    },
  });
  
  return {
    evalRunId: evalRun.id,
    benchmarkSetId,
    overallScore,
    exactMatchRate,
    evidenceAccuracy,
    schemaValidRate,
    byDocumentType,
    itemResults,
    comparison,
    passedGating,
    gatingReason,
  };
}

// ==========================================
// GATING LOGIC
// ==========================================

function checkGating(
  score: number,
  comparison?: EvalRunResult['comparison']
): boolean {
  // Minimum score threshold
  if (score < 70) return false;
  
  // If we have comparison, check for regressions
  if (comparison) {
    // Allow small regression (< 2 points)
    if (comparison.delta < -2) return false;
    
    // Don't allow more than 10% items to regress
    if (comparison.regressed.length > 0) {
      const regressRate = comparison.regressed.length / 
        (comparison.improved.length + comparison.regressed.length + 1);
      if (regressRate > 0.1) return false;
    }
  }
  
  return true;
}

function getGatingReason(
  score: number,
  comparison?: EvalRunResult['comparison']
): string {
  if (score < 70) {
    return `Score ${score.toFixed(1)} below minimum threshold of 70`;
  }
  
  if (comparison) {
    if (comparison.delta < -2) {
      return `Score dropped by ${Math.abs(comparison.delta).toFixed(1)} points`;
    }
    if (comparison.regressed.length > 0) {
      return `${comparison.regressed.length} items regressed`;
    }
  }
  
  return 'Passed all gating checks';
}

2. Create src/lib/benchmarks/index.ts:

export * from './types';
export * from './scorer';
export * from './runner';
```

---

## Step 3: Create Benchmark Management APIs

### Prompt 5.3: Benchmark APIs

```
Create API endpoints for benchmark management.

1. Create src/app/api/benchmarks/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// GET - List benchmark sets
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    
    const benchmarkSets = await prisma.benchmarkSet.findMany({
      include: {
        _count: { select: { items: true, evalRuns: true } },
        evalRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { overallScore: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      benchmarkSets: benchmarkSets.map(bs => ({
        id: bs.id,
        name: bs.name,
        description: bs.description,
        documentTypes: bs.documentTypes,
        isLocked: bs.isLocked,
        itemCount: bs._count.items,
        evalRunCount: bs._count.evalRuns,
        lastScore: bs.evalRuns[0]?.overallScore,
        lastRunAt: bs.evalRuns[0]?.createdAt,
        createdAt: bs.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list' }, { status: 500 });
  }
}

const CreateBenchmarkSetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  documentTypes: z.array(z.string()).default([]),
});

// POST - Create benchmark set
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const data = CreateBenchmarkSetSchema.parse(body);
    
    const benchmarkSet = await prisma.benchmarkSet.create({
      data: {
        name: data.name,
        description: data.description,
        documentTypes: data.documentTypes,
      },
    });
    
    return NextResponse.json({ benchmarkSet });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

2. Create src/app/api/benchmarks/[id]/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

// GET - Get benchmark set details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    
    const benchmarkSet = await prisma.benchmarkSet.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            certificate: {
              select: {
                id: true,
                originalFilename: true,
                documentType: true,
              },
            },
          },
        },
      },
    });
    
    if (!benchmarkSet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json({ benchmarkSet });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get' }, { status: 500 });
  }
}

// DELETE - Delete benchmark set
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    
    const benchmarkSet = await prisma.benchmarkSet.findUnique({
      where: { id: params.id },
    });
    
    if (!benchmarkSet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    if (benchmarkSet.isLocked) {
      return NextResponse.json({ error: 'Cannot delete locked set' }, { status: 400 });
    }
    
    await prisma.benchmarkSet.delete({ where: { id: params.id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

3. Create src/app/api/benchmarks/[id]/items/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const AddItemSchema = z.object({
  certificateId: z.string(),
  expectedOutput: z.any(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  challengeTypes: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

// POST - Add item to benchmark set
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const data = AddItemSchema.parse(body);
    
    const benchmarkSet = await prisma.benchmarkSet.findUnique({
      where: { id: params.id },
    });
    
    if (!benchmarkSet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    if (benchmarkSet.isLocked) {
      return NextResponse.json({ error: 'Cannot modify locked set' }, { status: 400 });
    }
    
    // Check certificate exists
    const certificate = await prisma.certificate.findUnique({
      where: { id: data.certificateId },
    });
    
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }
    
    const item = await prisma.benchmarkItem.create({
      data: {
        benchmarkSetId: params.id,
        certificateId: data.certificateId,
        expectedOutput: data.expectedOutput,
        difficulty: data.difficulty,
        challengeTypes: data.challengeTypes,
        notes: data.notes,
      },
    });
    
    // Update item count
    await prisma.benchmarkSet.update({
      where: { id: params.id },
      data: { itemCount: { increment: 1 } },
    });
    
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

4. Create src/app/api/benchmarks/[id]/run/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { runBenchmark } from '@/lib/benchmarks/runner';

// POST - Run benchmark evaluation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    
    const body = await request.json().catch(() => ({}));
    
    console.log(`Starting benchmark run for ${params.id}`);
    
    const result = await runBenchmark({
      benchmarkSetId: params.id,
      maxItems: body.maxItems,
      modelVersion: body.modelVersion,
      promptVersion: body.promptVersion,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Benchmark run error:', error);
    return NextResponse.json(
      { error: 'Benchmark run failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

5. Create src/app/api/benchmarks/[id]/runs/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

// GET - List evaluation runs for benchmark
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    
    const evalRuns = await prisma.evalRun.findMany({
      where: { benchmarkSetId: params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        modelVersion: true,
        promptVersion: true,
        schemaVersion: true,
        overallScore: true,
        exactMatchRate: true,
        evidenceAccuracy: true,
        schemaValidRate: true,
        scores: true,
        scoreDelta: true,
        passedGating: true,
        gatingNotes: true,
        regressions: true,
        improvements: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json({ evalRuns });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
  }
}
```

---

## Step 4: Create Benchmark UI

### Prompt 5.4: Benchmark Dashboard

```
Create the benchmark management UI.

1. Create src/app/(dashboard)/benchmarks/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Play, Lock, Unlock, TrendingUp, TrendingDown, 
  Minus, FileText, Clock 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BenchmarkSet {
  id: string;
  name: string;
  description?: string;
  documentTypes: string[];
  isLocked: boolean;
  itemCount: number;
  evalRunCount: number;
  lastScore?: number;
  lastRunAt?: string;
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkSet[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/benchmarks')
      .then(res => res.json())
      .then(data => setBenchmarks(data.benchmarkSets || []))
      .finally(() => setLoading(false));
  }, []);
  
  const handleRunBenchmark = async (id: string) => {
    if (!confirm('Run benchmark? This may take several minutes.')) return;
    
    try {
      const res = await fetch(`/api/benchmarks/${id}/run`, { method: 'POST' });
      const result = await res.json();
      alert(`Benchmark complete! Score: ${result.overallScore.toFixed(1)}`);
      // Refresh list
      window.location.reload();
    } catch (error) {
      alert('Benchmark failed');
    }
  };
  
  if (loading) {
    return <div className="p-8">Loading...</div>;
  }
  
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Benchmarks</h1>
          <p className="text-gray-500">Evaluate and track extraction quality</p>
        </div>
        <Link href="/benchmarks/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Benchmark Set
          </Button>
        </Link>
      </div>
      
      <div className="grid gap-4">
        {benchmarks.map(benchmark => (
          <Card key={benchmark.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Link 
                      href={`/benchmarks/${benchmark.id}`}
                      className="text-lg font-semibold hover:text-blue-600"
                    >
                      {benchmark.name}
                    </Link>
                    {benchmark.isLocked && (
                      <Badge variant="secondary">
                        <Lock className="w-3 h-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  
                  {benchmark.description && (
                    <p className="text-gray-500 text-sm mb-3">{benchmark.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      {benchmark.itemCount} items
                    </span>
                    <span>
                      {benchmark.evalRunCount} runs
                    </span>
                    {benchmark.documentTypes.length > 0 && (
                      <div className="flex gap-1">
                        {benchmark.documentTypes.map(dt => (
                          <Badge key={dt} variant="outline" className="text-xs">
                            {dt.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {benchmark.lastScore !== undefined && (
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {benchmark.lastScore.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {benchmark.lastRunAt && (
                          <>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatDistanceToNow(new Date(benchmark.lastRunAt), { addSuffix: true })}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => handleRunBenchmark(benchmark.id)}
                    disabled={benchmark.itemCount === 0}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {benchmarks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No benchmark sets yet</p>
              <Link href="/benchmarks/new">
                <Button>Create Your First Benchmark</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

2. Create src/app/(dashboard)/benchmarks/[id]/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Play, Lock, Plus, TrendingUp, 
  TrendingDown, Minus, CheckCircle, XCircle 
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

export default function BenchmarkDetailPage({ params }: { params: { id: string } }) {
  const [benchmark, setBenchmark] = useState<any>(null);
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    Promise.all([
      fetch(`/api/benchmarks/${params.id}`).then(r => r.json()),
      fetch(`/api/benchmarks/${params.id}/runs`).then(r => r.json()),
    ]).then(([bm, runs]) => {
      setBenchmark(bm.benchmarkSet);
      setEvalRuns(runs.evalRuns || []);
    }).finally(() => setLoading(false));
  }, [params.id]);
  
  if (loading || !benchmark) {
    return <div className="p-8">Loading...</div>;
  }
  
  const chartData = evalRuns
    .slice()
    .reverse()
    .map((run, i) => ({
      run: i + 1,
      score: run.overallScore,
      date: new Date(run.createdAt).toLocaleDateString(),
    }));
  
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/benchmarks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{benchmark.name}</h1>
          <p className="text-gray-500">{benchmark.description}</p>
        </div>
        <Button>
          <Play className="w-4 h-4 mr-2" />
          Run Benchmark
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Items</div>
            <div className="text-2xl font-bold">{benchmark.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Latest Score</div>
            <div className="text-2xl font-bold">
              {evalRuns[0]?.overallScore?.toFixed(1) || '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Runs</div>
            <div className="text-2xl font-bold">{evalRuns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Status</div>
            <div className="flex items-center gap-2">
              {benchmark.isLocked ? (
                <Badge><Lock className="w-3 h-3 mr-1" /> Locked</Badge>
              ) : (
                <Badge variant="outline">Editable</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Evaluation Runs</TabsTrigger>
          <TabsTrigger value="items">Benchmark Items ({benchmark.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="chart">Score Trend</TabsTrigger>
        </TabsList>
        
        <TabsContent value="runs" className="mt-4">
          <div className="space-y-3">
            {evalRuns.map(run => (
              <Card key={run.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        Score: {run.overallScore.toFixed(1)}
                        {run.scoreDelta !== null && (
                          <span className={`ml-2 text-sm ${run.scoreDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {run.scoreDelta >= 0 ? '+' : ''}{run.scoreDelta.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(run.createdAt).toLocaleString()} • 
                        Model: {run.modelVersion}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        <span>Exact: {(run.exactMatchRate * 100).toFixed(0)}%</span>
                        <span className="mx-2">•</span>
                        <span>Schema: {(run.schemaValidRate * 100).toFixed(0)}%</span>
                      </div>
                      {run.passedGating ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Passed
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="items" className="mt-4">
          <div className="space-y-2">
            {benchmark.items?.map((item: any) => (
              <Card key={item.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{item.certificate.originalFilename}</span>
                      <Badge variant="outline" className="ml-2">{item.difficulty}</Badge>
                    </div>
                    <Badge>{item.certificate.documentType.replace('_', ' ')}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="run" label={{ value: 'Run', position: 'bottom' }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      dot={{ fill: '#2563eb' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-12">
                  Run at least 2 evaluations to see trend
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Verification Checklist

After completing Phase 5, verify:

```
□ Scorer works correctly
  - Test with sample extraction vs expected
  - Exact match fields scored properly
  - Fuzzy match calculates similarity
  - List scoring handles observations/remedials

□ Benchmark runner executes
  - Can run benchmark with test items
  - Results saved to EvalRun table
  - Comparison to previous run works

□ Gating logic works
  - Score below 70 fails
  - Large regression fails
  - Improvement passes

□ APIs functional
  - List benchmark sets
  - Create benchmark set
  - Add items
  - Run benchmark
  - List runs

□ UI displays correctly
  - Benchmark list shows scores
  - Detail page shows items
  - Score trend chart renders
```

---

## Files Created in Phase 5

```
src/lib/benchmarks/
  types.ts
  scorer.ts
  runner.ts
  index.ts

src/app/api/benchmarks/
  route.ts
  [id]/route.ts
  [id]/items/route.ts
  [id]/run/route.ts
  [id]/runs/route.ts

src/app/(dashboard)/benchmarks/
  page.tsx
  [id]/page.tsx
  new/page.tsx
```
