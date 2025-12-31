import { db } from '../../db';
import { certificateDetectionPatterns } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { CertificateTypeCode } from './types';
import { logger } from '../../logger';

export interface DetectionPatternMatch {
  certificateType: CertificateTypeCode;
  patternId: string;
  patternType: 'FILENAME' | 'TEXT_CONTENT';
  matcherType: string;
  pattern: string;
  priority: number;
  confidence: number;
}

interface CachedPattern {
  id: string;
  certificateTypeCode: string;
  patternType: 'FILENAME' | 'TEXT_CONTENT';
  matcherType: string;
  pattern: string;
  priority: number;
}

let patternsCache: CachedPattern[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000;

export async function loadDetectionPatterns(): Promise<CachedPattern[]> {
  const now = Date.now();
  if (patternsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return patternsCache;
  }

  try {
    const patterns = await db.select({
      id: certificateDetectionPatterns.id,
      certificateTypeCode: certificateDetectionPatterns.certificateTypeCode,
      patternType: certificateDetectionPatterns.patternType,
      matcherType: certificateDetectionPatterns.matcherType,
      pattern: certificateDetectionPatterns.pattern,
      priority: certificateDetectionPatterns.priority,
    })
    .from(certificateDetectionPatterns)
    .where(eq(certificateDetectionPatterns.isActive, true))
    .orderBy(desc(certificateDetectionPatterns.priority));

    patternsCache = patterns;
    cacheTimestamp = now;
    
    logger.debug({ patternCount: patterns.length }, 'Loaded detection patterns from database');
    return patterns;
  } catch (error) {
    logger.error({ error }, 'Failed to load detection patterns from database');
    return patternsCache || [];
  }
}

export function clearPatternCache(): void {
  patternsCache = null;
  cacheTimestamp = 0;
}

function matchPattern(text: string, pattern: string, matcherType: string): boolean {
  const upperText = text.toUpperCase();
  const upperPattern = pattern.toUpperCase();

  switch (matcherType) {
    case 'CONTAINS':
      return upperText.includes(upperPattern);
    case 'STARTS_WITH':
      return upperText.startsWith(upperPattern);
    case 'ENDS_WITH':
      return upperText.endsWith(upperPattern);
    case 'EXACT':
      return upperText === upperPattern;
    case 'REGEX':
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
      } catch (e) {
        logger.warn({ pattern, error: e }, 'Invalid regex pattern');
        return false;
      }
    default:
      return upperText.includes(upperPattern);
  }
}

export async function detectCertificateTypeFromPatterns(
  filename: string,
  textContent: string | null
): Promise<DetectionPatternMatch | null> {
  const patterns = await loadDetectionPatterns();
  
  if (patterns.length === 0) {
    return null;
  }

  const matches: DetectionPatternMatch[] = [];

  for (const pattern of patterns) {
    let isMatch = false;
    
    if (pattern.patternType === 'FILENAME') {
      isMatch = matchPattern(filename, pattern.pattern, pattern.matcherType);
    } else if (pattern.patternType === 'TEXT_CONTENT' && textContent) {
      isMatch = matchPattern(textContent, pattern.pattern, pattern.matcherType);
    }

    if (isMatch) {
      const confidence = Math.min(1, pattern.priority / 100);
      matches.push({
        certificateType: pattern.certificateTypeCode as CertificateTypeCode,
        patternId: pattern.id,
        patternType: pattern.patternType,
        matcherType: pattern.matcherType,
        pattern: pattern.pattern,
        priority: pattern.priority,
        confidence,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort((a, b) => b.priority - a.priority);

  const bestMatch = matches[0];
  
  logger.debug({
    filename,
    matchCount: matches.length,
    bestMatch: bestMatch.certificateType,
    bestPriority: bestMatch.priority,
  }, 'Certificate type detected from database patterns');

  return bestMatch;
}

export async function detectCertificateTypeFromFilenameDB(
  filename: string
): Promise<CertificateTypeCode | null> {
  const match = await detectCertificateTypeFromPatterns(filename, null);
  return match?.certificateType || null;
}

export async function detectCertificateTypeFromTextDB(
  textContent: string
): Promise<CertificateTypeCode | null> {
  const match = await detectCertificateTypeFromPatterns('', textContent);
  return match?.certificateType || null;
}

export async function detectCertificateTypeDB(
  filename: string,
  textContent: string | null
): Promise<{ certificateType: CertificateTypeCode; confidence: number; source: 'database' | 'fallback' }> {
  const match = await detectCertificateTypeFromPatterns(filename, textContent);
  
  if (match) {
    return {
      certificateType: match.certificateType,
      confidence: match.confidence,
      source: 'database',
    };
  }

  return {
    certificateType: 'UNKNOWN',
    confidence: 0,
    source: 'fallback',
  };
}
