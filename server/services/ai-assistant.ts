import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions, blocks, schemes, components, componentTypes, chatbotConversations, chatbotMessages, chatbotAnalytics, knowledgeEmbeddings } from '@shared/schema';
import { count, ilike, or, eq, and, isNull, lt, desc, sql } from 'drizzle-orm';

// =============================================================================
// ANALYTICS TRACKING
// Tracks usage metrics for cost optimization and insights
// =============================================================================

interface AnalyticsData {
  intent: string;
  responseSource: 'static' | 'faq_cache' | 'faq_tfidf' | 'database' | 'rag' | 'llm';
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  confidence?: number;
}

async function trackAnalytics(data: AnalyticsData): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    
    // Try to update existing record for this date/hour
    const existing = await db.select()
      .from(chatbotAnalytics)
      .where(and(
        eq(chatbotAnalytics.date, today),
        eq(chatbotAnalytics.hour, hour)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const record = existing[0];
      await db.update(chatbotAnalytics)
        .set({
          totalQueries: sql`${chatbotAnalytics.totalQueries} + 1`,
          staticResponses: data.responseSource === 'static' 
            ? sql`${chatbotAnalytics.staticResponses} + 1` 
            : record.staticResponses,
          faqHits: (data.responseSource === 'faq_cache' || data.responseSource === 'faq_tfidf')
            ? sql`${chatbotAnalytics.faqHits} + 1`
            : record.faqHits,
          databaseQueries: data.responseSource === 'database'
            ? sql`${chatbotAnalytics.databaseQueries} + 1`
            : record.databaseQueries,
          ragQueries: data.responseSource === 'rag'
            ? sql`${chatbotAnalytics.ragQueries} + 1`
            : record.ragQueries,
          llmQueries: data.responseSource === 'llm'
            ? sql`${chatbotAnalytics.llmQueries} + 1`
            : record.llmQueries,
          totalInputTokens: sql`${chatbotAnalytics.totalInputTokens} + ${data.inputTokens}`,
          totalOutputTokens: sql`${chatbotAnalytics.totalOutputTokens} + ${data.outputTokens}`,
        })
        .where(eq(chatbotAnalytics.id, record.id));
    } else {
      // Insert new record
      await db.insert(chatbotAnalytics).values({
        date: today,
        hour,
        totalQueries: 1,
        staticResponses: data.responseSource === 'static' ? 1 : 0,
        faqHits: (data.responseSource === 'faq_cache' || data.responseSource === 'faq_tfidf') ? 1 : 0,
        databaseQueries: data.responseSource === 'database' ? 1 : 0,
        ragQueries: data.responseSource === 'rag' ? 1 : 0,
        llmQueries: data.responseSource === 'llm' ? 1 : 0,
        totalInputTokens: data.inputTokens,
        totalOutputTokens: data.outputTokens,
        avgResponseTimeMs: data.responseTimeMs,
      });
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to track chatbot analytics');
  }
}

// Get analytics summary for dashboard
export async function getChatbotAnalytics(days: number = 7): Promise<{
  totalQueries: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  responseSourceBreakdown: Record<string, number>;
  dailyStats: Array<{ date: string; queries: number; llmQueries: number }>;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const stats = await db.select()
      .from(chatbotAnalytics)
      .where(sql`${chatbotAnalytics.date} >= ${startDateStr}`)
      .orderBy(chatbotAnalytics.date);
    
    let totalQueries = 0;
    let staticResponses = 0;
    let faqHits = 0;
    let databaseQueries = 0;
    let ragQueries = 0;
    let llmQueries = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    
    const dailyStats: Record<string, { queries: number; llmQueries: number }> = {};
    
    for (const stat of stats) {
      totalQueries += stat.totalQueries;
      staticResponses += stat.staticResponses;
      faqHits += stat.faqHits;
      databaseQueries += stat.databaseQueries;
      ragQueries += stat.ragQueries;
      llmQueries += stat.llmQueries;
      totalInputTokens += stat.totalInputTokens;
      totalOutputTokens += stat.totalOutputTokens;
      
      if (!dailyStats[stat.date]) {
        dailyStats[stat.date] = { queries: 0, llmQueries: 0 };
      }
      dailyStats[stat.date].queries += stat.totalQueries;
      dailyStats[stat.date].llmQueries += stat.llmQueries;
    }
    
    // Estimate tokens saved (assuming ~500 tokens per query if all went to LLM)
    const queriesNotUsingLLM = totalQueries - llmQueries;
    const tokensSaved = queriesNotUsingLLM * 500;
    // Claude 3.5 Haiku pricing: ~$0.25/million input, ~$1.25/million output
    const estimatedCostSaved = (tokensSaved * 0.00000125);
    
    return {
      totalQueries,
      tokensSaved,
      estimatedCostSaved,
      responseSourceBreakdown: {
        static: staticResponses,
        faq: faqHits,
        database: databaseQueries,
        rag: ragQueries,
        llm: llmQueries,
      },
      dailyStats: Object.entries(dailyStats).map(([date, data]) => ({
        date,
        ...data,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get chatbot analytics');
    return {
      totalQueries: 0,
      tokensSaved: 0,
      estimatedCostSaved: 0,
      responseSourceBreakdown: {},
      dailyStats: [],
    };
  }
}

const anthropic = new Anthropic();

// =============================================================================
// KNOWLEDGE DOCUMENT MANAGEMENT (RAG Training Data)
// CRUD operations for managing knowledge documents used in RAG retrieval
// =============================================================================

export interface KnowledgeDocument {
  id?: string;
  title: string;
  content: string;
  category: string;
  sourceType: 'manual' | 'legislation' | 'guidance' | 'faq' | 'procedure';
  metadata?: Record<string, any>;
}

// Get all knowledge documents
export async function getKnowledgeDocuments(category?: string): Promise<KnowledgeDocument[]> {
  try {
    let query = db.select().from(knowledgeEmbeddings);
    if (category) {
      query = query.where(eq(knowledgeEmbeddings.category, category)) as typeof query;
    }
    const docs = await query.orderBy(desc(knowledgeEmbeddings.createdAt));
    return docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category || 'general',
      sourceType: (doc.sourceType as KnowledgeDocument['sourceType']) || 'manual',
      metadata: doc.metadata as Record<string, any> || {},
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get knowledge documents');
    return [];
  }
}

// Get a single knowledge document by ID
export async function getKnowledgeDocument(id: string): Promise<KnowledgeDocument | null> {
  try {
    const [doc] = await db.select()
      .from(knowledgeEmbeddings)
      .where(eq(knowledgeEmbeddings.id, id));
    
    if (!doc) return null;
    
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category || 'general',
      sourceType: (doc.sourceType as KnowledgeDocument['sourceType']) || 'manual',
      metadata: doc.metadata as Record<string, any> || {},
    };
  } catch (error) {
    logger.error({ error, id }, 'Failed to get knowledge document');
    return null;
  }
}

// Compute TF-IDF embedding for a document (stored as JSON)
function computeDocumentEmbedding(text: string): Record<string, number> {
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  const termFrequency: Record<string, number> = {};
  for (const token of tokens) {
    termFrequency[token] = (termFrequency[token] || 0) + 1;
  }
  
  // Normalize by document length
  const docLength = tokens.length;
  const embedding: Record<string, number> = {};
  for (const [term, freq] of Object.entries(termFrequency)) {
    embedding[term] = freq / docLength;
  }
  
  return embedding;
}

// Create a new knowledge document
export async function createKnowledgeDocument(doc: KnowledgeDocument): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const embedding = computeDocumentEmbedding(doc.title + ' ' + doc.content);
    
    const [created] = await db.insert(knowledgeEmbeddings).values({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      sourceType: doc.sourceType,
      embeddingModel: 'tfidf-v1',
      embedding: JSON.stringify(embedding),
      metadata: doc.metadata || {},
    }).returning();
    
    logger.info({ id: created.id, title: doc.title }, 'Knowledge document created');
    return { success: true, id: created.id };
  } catch (error: any) {
    logger.error({ error }, 'Failed to create knowledge document');
    return { success: false, error: error.message };
  }
}

// Update an existing knowledge document
export async function updateKnowledgeDocument(id: string, doc: Partial<KnowledgeDocument>): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getKnowledgeDocument(id);
    if (!existing) {
      return { success: false, error: 'Document not found' };
    }
    
    const updatedContent = doc.content || existing.content;
    const updatedTitle = doc.title || existing.title;
    const embedding = computeDocumentEmbedding(updatedTitle + ' ' + updatedContent);
    
    await db.update(knowledgeEmbeddings)
      .set({
        title: updatedTitle,
        content: updatedContent,
        category: doc.category || existing.category,
        sourceType: doc.sourceType || existing.sourceType,
        embedding: JSON.stringify(embedding),
        metadata: doc.metadata || existing.metadata,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeEmbeddings.id, id));
    
    logger.info({ id }, 'Knowledge document updated');
    return { success: true };
  } catch (error: any) {
    logger.error({ error, id }, 'Failed to update knowledge document');
    return { success: false, error: error.message };
  }
}

// Delete a knowledge document
export async function deleteKnowledgeDocument(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(knowledgeEmbeddings).where(eq(knowledgeEmbeddings.id, id));
    logger.info({ id }, 'Knowledge document deleted');
    return { success: true };
  } catch (error: any) {
    logger.error({ error, id }, 'Failed to delete knowledge document');
    return { success: false, error: error.message };
  }
}

// Get knowledge document categories for filtering
export async function getKnowledgeCategories(): Promise<string[]> {
  try {
    const docs = await db.selectDistinct({ category: knowledgeEmbeddings.category })
      .from(knowledgeEmbeddings)
      .where(sql`${knowledgeEmbeddings.category} IS NOT NULL`);
    
    return docs.map(d => d.category!).filter(Boolean);
  } catch (error) {
    logger.error({ error }, 'Failed to get knowledge categories');
    return [];
  }
}

// =============================================================================
// RAG SEARCH (Retrieval-Augmented Generation)
// Searches knowledge documents using TF-IDF similarity
// =============================================================================

interface RAGResult {
  document: KnowledgeDocument;
  score: number;
}

async function searchKnowledgeBase(query: string, topK: number = 3): Promise<RAGResult[]> {
  try {
    // Get all documents with embeddings
    const docs = await db.select()
      .from(knowledgeEmbeddings)
      .where(sql`${knowledgeEmbeddings.embedding} IS NOT NULL`);
    
    if (docs.length === 0) return [];
    
    // Compute query embedding
    const queryEmbedding = computeDocumentEmbedding(query);
    
    // Score each document
    const results: RAGResult[] = [];
    
    for (const doc of docs) {
      if (!doc.embedding) continue;
      
      let docEmbedding: Record<string, number>;
      try {
        docEmbedding = JSON.parse(doc.embedding);
      } catch {
        continue;
      }
      
      // Compute cosine similarity
      let dotProduct = 0;
      let queryMag = 0;
      let docMag = 0;
      
      for (const [term, weight] of Object.entries(queryEmbedding)) {
        queryMag += weight * weight;
        if (docEmbedding[term]) {
          dotProduct += weight * docEmbedding[term];
        }
      }
      
      for (const weight of Object.values(docEmbedding)) {
        docMag += weight * weight;
      }
      
      const similarity = queryMag > 0 && docMag > 0 
        ? dotProduct / (Math.sqrt(queryMag) * Math.sqrt(docMag))
        : 0;
      
      if (similarity > 0.1) {
        results.push({
          document: {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            category: doc.category || 'general',
            sourceType: (doc.sourceType as KnowledgeDocument['sourceType']) || 'manual',
            metadata: doc.metadata as Record<string, any> || {},
          },
          score: similarity,
        });
      }
    }
    
    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  } catch (error) {
    logger.error({ error }, 'Failed to search knowledge base');
    return [];
  }
}

// Format RAG results into a response
function formatRAGResponse(query: string, results: RAGResult[]): string | null {
  if (results.length === 0) return null;
  
  const topResult = results[0];
  
  // Build response from top match
  let response = `**${topResult.document.title}**\n\n`;
  response += topResult.document.content;
  
  // Add sources if multiple relevant docs
  if (results.length > 1) {
    response += '\n\n**Related Topics:**\n';
    for (let i = 1; i < Math.min(results.length, 3); i++) {
      response += `• ${results[i].document.title}\n`;
    }
  }
  
  return response;
}

// =============================================================================
// LAYER 0: INTENT CLASSIFICATION
// Fast keyword-based routing to bypass expensive processing for common patterns
// =============================================================================

type IntentCategory = 
  | 'faq'           // General compliance questions → Layer 1
  | 'database'      // Property/certificate lookups → Layer 2  
  | 'navigation'    // Platform how-to questions → Static response
  | 'greeting'      // Hello/thanks → Static response
  | 'off_topic'     // Non-compliance questions → Polite redirect
  | 'complex';      // Needs LLM → Layer 3

interface IntentClassification {
  category: IntentCategory;
  confidence: number;
  detectedTopics: string[];
  suggestedHandler: string;
}

const INTENT_PATTERNS: Record<IntentCategory, RegExp[]> = {
  greeting: [
    /^(hi|hello|hey|thanks|thank you|cheers|bye|goodbye)\b/i,
    /^how are you/i,
    /^good (morning|afternoon|evening)/i,
  ],
  navigation: [
    /how (do i|to|can i) (upload|add|import|view|find|delete|edit)/i,
    /where (is|are|can i find|do i)/i,
    /what (page|button|menu)/i,
    /show me how/i,
  ],
  database: [
    /show (me |my )?(properties|certificates|actions|components)/i,
    /find (properties|certificates|actions|my|the)/i,
    /which (properties|certificates|blocks|schemes)/i,
    /how many (properties|certificates|actions)/i,
    /list (all |my )?(properties|certificates|actions)/i,
    /(overdue|expiring|pending|non-compliant|compliant)/i,
    /search for/i,
    /look up/i,
  ],
  faq: [
    /(what|when|how often|how long|do i need|is .+ required)/i,
    /what (is|are|does|do) (a |an |the )?(cp12|eicr|fra|lgsr|epc|loler)/i,
    /requirements? for/i,
    /regulations?|legislation|law|legal/i,
    /(c1|c2|c3|code 1|code 2|code 3) (defect|classification|mean)/i,
    /penalty|fine|consequences/i,
    /gas safety|electrical|fire (risk|safety)|asbestos|legionella/i,
  ],
  off_topic: [
    /weather|sport|news|politic|recipe|cook|movie|music|game|travel/i,
    /joke|story|poem/i,
    /what do you think|opinion|believe/i,
    /who (are you|made you|created)/i,
  ],
  complex: [], // Fallback - no patterns, catches everything else
};

function classifyIntent(query: string): IntentClassification {
  const lowerQuery = query.toLowerCase().trim();
  const detectedTopics: string[] = [];
  
  // Quick topic detection for suggestions
  const topicKeywords = {
    gas: /gas|cp12|lgsr|boiler|heating/i,
    electrical: /electr|eicr|wiring|socket/i,
    fire: /fire|fra|smoke|alarm/i,
    asbestos: /asbestos|acm/i,
    legionella: /legionella|water|l8/i,
    lift: /lift|loler|elevator/i,
  };
  
  for (const [topic, regex] of Object.entries(topicKeywords)) {
    if (regex.test(query)) {
      detectedTopics.push(topic);
    }
  }
  
  // Check each intent category
  for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        return {
          category: category as IntentCategory,
          confidence: 0.9,
          detectedTopics,
          suggestedHandler: `Layer: ${category}`,
        };
      }
    }
  }
  
  // Default to complex for LLM handling
  return {
    category: 'complex',
    confidence: 0.5,
    detectedTopics,
    suggestedHandler: 'Layer 3: LLM',
  };
}

// =============================================================================
// LAYER 1: FAQ DATABASE WITH TF-IDF SEMANTIC MATCHING
// Comprehensive FAQ database with question variations for better matching
// =============================================================================

interface FAQEntry {
  id: string;
  category: string;
  question: string;
  variations: string[];
  answer: string;
  sources: string[];
  keywords?: string[]; // Computed from question + variations
  tfidfVector?: Map<string, number>; // Computed TF-IDF weights
}

// Enhanced FAQ database - 45+ comprehensive compliance questions
const FAQ_DATABASE: FAQEntry[] = [
  // ===== GAS SAFETY (8 FAQs) =====
  {
    id: "gas-001",
    category: "gas_safety",
    question: "How often do gas safety certificates need to be renewed?",
    variations: ["When does a gas certificate expire?", "LGSR renewal frequency", "CP12 validity period", "Gas cert expiry", "How long is a gas safety record valid?", "When to renew gas certificate"],
    answer: `**Gas Safety Certificates** (LGSR/CP12) must be renewed **annually** - within 12 months.

• Applies to all rental properties with gas appliances
• Must be by Gas Safe registered engineer
• Certificate to tenant within **28 days**
• Records kept for **2 years**

**Regulation:** Gas Safety Regulations 1998

[View Gas Safety Certificates](/certificates?type=CP12) | [View Expiring](/certificates?status=EXPIRING) | [Remedial Actions](/remedial-actions)`,
    sources: ["Gas Safety Regulations 1998", "HSE Guidance INDG285"],
  },
  {
    id: "gas-002",
    category: "gas_safety",
    question: "What appliances need to be checked on a gas safety inspection?",
    variations: ["What does a gas check cover?", "Gas safety inspection scope", "What's included in LGSR?", "Gas appliances covered by CP12"],
    answer: `**Gas Safety Inspection Scope:**

All gas appliances, fittings, and flues must be checked:
• Gas boilers and central heating
• Gas fires and heaters
• Gas cookers and hobs
• Gas water heaters

**Checks performed:**
• Appliance safety and operation
• Flue flow and spillage tests
• Ventilation adequacy
• Gas tightness (pipework)
• Carbon monoxide alarm check

[View Gas Certificates](/certificates?type=CP12) | [Components](/components) | [Remedial Actions](/remedial-actions)`,
    sources: ["Gas Safety Regulations 1998", "Gas Safe Technical Bulletin"],
  },
  {
    id: "gas-003",
    category: "gas_safety", 
    question: "What happens if a gas appliance is condemned?",
    variations: ["Immediately dangerous gas appliance", "ID classification gas", "At risk gas appliance", "AR classification meaning", "Gas appliance warning notice"],
    answer: `**Gas Appliance Classifications:**

**Immediately Dangerous (ID)**
• Poses immediate risk to life
• Must be disconnected immediately
• Cannot use until repaired by Gas Safe engineer

**At Risk (AR)**
• Not immediately dangerous but poses risk
• Should be repaired ASAP
• User warned in writing

**Not to Current Standards (NCS)**
• Safe to use
• Recommend upgrade when convenient

**Landlord must fix all ID and AR issues before re-letting.**

[View Remedial Actions](/remedial-actions?severity=IMMEDIATE) | [Urgent Actions](/remedial-actions)`,
    sources: ["Gas Safe Register Unsafe Situations Procedure", "GIUSP"],
  },
  {
    id: "gas-004",
    category: "gas_safety",
    question: "Can a tenant refuse access for a gas safety check?",
    variations: ["Tenant won't allow gas inspection", "Access denied for gas check", "What if tenant refuses gas safety", "Legal rights gas inspection access"],
    answer: `**Tenants cannot legally refuse** access for mandatory gas safety checks.

**Landlord steps:**
1. Give reasonable notice (24-48 hours recommended)
2. Offer alternative appointment times
3. Document all attempts in writing
4. Send formal written warning
5. If persistent refusal, seek legal advice

**Important:**
• Keep records of all access attempts
• You must demonstrate 'reasonable steps'
• May need court injunction as last resort
• Never enter without proper notice/consent

**HSE position:** Landlords must take 'all reasonable steps' - documented attempts protect you legally.`,
    sources: ["Gas Safety Regulations 1998 Reg.36", "HSE Guidance for Landlords"],
  },
  // ===== ELECTRICAL (5 FAQs) =====
  {
    id: "electrical-001",
    category: "electrical",
    question: "How often is an EICR required for rental properties?",
    variations: ["EICR inspection frequency", "When do electrical certificates expire?", "Electrical safety check frequency", "EICR renewal period", "How long is an electrical report valid?"],
    answer: `**EICRs required at least every 5 years**

• Mandatory for all private rented sector (since April 2021)
• Must be by qualified electrician (NICEIC, NAPIT, ELECSA)
• C1/C2 defects: fix within **28 days**
• Copy to tenant within **28 days**
• New tenants must receive copy before moving in

**Regulation:** Electrical Safety Standards Regulations 2020

[View EICRs](/certificates?type=EICR) | [Schedule Remedial Work](/remedial-actions)`,
    sources: ["Electrical Safety Standards Regulations 2020", "BS 7671:2018+A2:2022"],
  },
  {
    id: "electrical-002",
    category: "electrical",
    question: "What do EICR codes C1, C2, C3 mean?",
    variations: ["EICR observation codes explained", "What is a C1 defect?", "C2 electrical code meaning", "Electrical report classification codes", "C3 code meaning"],
    answer: `**EICR Observation Codes:**

**C1 - Danger Present**
• Immediate risk of injury
• Requires immediate remedial action
• **Action: Within 24-48 hours**

**C2 - Potentially Dangerous**
• Could become dangerous
• **Action: Within 28 days** (legal requirement)

**C3 - Improvement Recommended**
• Does not meet current standards
• Not a safety issue
• **Action: Recommended but not mandatory**

**FI** - Further Investigation needed

**Any C1 or C2 = UNSATISFACTORY overall**

[View Unsatisfactory Certs](/certificates?outcome=UNSATISFACTORY) | [Remedial Actions](/remedial-actions)`,
    sources: ["BS 7671:2018", "Electrical Safety Standards Regulations 2020"],
  },
  {
    id: "electrical-003",
    category: "electrical",
    question: "What's the difference between an EICR and an electrical certificate?",
    variations: ["EICR vs EIC", "Electrical installation certificate vs condition report", "Do I need EICR or EIC?", "Types of electrical certificates"],
    answer: `**Different electrical certificates for different purposes:**

**EICR (Electrical Installation Condition Report)**
• For EXISTING installations
• Assesses current condition and safety
• Required every 5 years for rentals
• Reports on deterioration and defects

**EIC (Electrical Installation Certificate)**
• For NEW installations or major alterations
• Confirms work meets BS 7671 standards
• Issued when new electrical work completed
• Accompanies new builds or rewires

**Minor Works Certificate**
• For small additions/alterations
• Adding sockets, lights, etc.
• Not for new circuits

**For landlords:** You need a valid EICR - not just the original EIC from when the property was built.

[View All Electrical Certificates](/certificates?type=EICR) | [Remedial Actions](/remedial-actions)`,
    sources: ["BS 7671:2018", "IET Guidance Note 3"],
  },
  // ===== FIRE SAFETY (5 FAQs) =====
  {
    id: "fire-001",
    category: "fire_safety",
    question: "How often should a Fire Risk Assessment be reviewed?",
    variations: ["FRA review frequency", "When to update fire risk assessment", "Fire risk assessment renewal", "How often FRA inspection"],
    answer: `**Fire Risk Assessment: Review at least annually** or sooner if:

• Significant changes to the building layout
• Changes to use or occupancy
• After a fire or near-miss incident
• New fire safety legislation introduced
• Following enforcement action

**High-rise (18m+):**
• More frequent reviews required (quarterly)
• Must have Building Safety Case

**Best practice:** Review annually even if no changes - document the review date.

[View FRA Documents](/certificates?type=FIRE_RISK_ASSESSMENT) | [Fire Safety Actions](/remedial-actions)`,
    sources: ["Fire Safety Order 2005", "PAS 79-2:2020", "Building Safety Act 2022"],
  },
  {
    id: "fire-002",
    category: "fire_safety",
    question: "Do I need fire alarms in rental properties?",
    variations: ["Smoke alarm requirements rental", "Carbon monoxide alarm regulations", "Fire alarm requirements landlords", "Smoke detector rules rental property"],
    answer: `**Yes - smoke and CO alarms mandatory** (from Oct 2022)

**Smoke alarms:**
• At least one on each storey with living accommodation
• Must be working at start of each tenancy
• Recommended: test regularly, replace every 10 years

**Carbon monoxide alarms:**
• In any room with a fixed combustion appliance (except gas cookers)
• Includes gas boilers, fires, wood burners, oil heaters
• Must be working at start of each tenancy

**Heat alarms:**
• Recommended in kitchens (instead of smoke alarms)

**Penalties:** Up to £5,000 fine for non-compliance.

[View Fire Safety Certificates](/certificates?type=FIRE_RISK_ASSESSMENT) | [Track Actions](/remedial-actions)`,
    sources: ["Smoke and CO Alarm Regulations 2022", "Fire Safety Order 2005"],
  },
  {
    id: "fire-003",
    category: "fire_safety",
    question: "What are fire door inspection requirements?",
    variations: ["Fire door checks frequency", "How often inspect fire doors", "Fire door regulations flats", "FD30 door requirements"],
    answer: `**Fire Door Inspection Requirements:**

**Frequency:**
• Quarterly checks recommended for communal areas
• Annual detailed inspection by competent person
• Immediately after any damage reported

**What to check:**
• Door closes fully into frame
• Gaps around door (max 3-4mm when closed)
• Intumescent strips and smoke seals intact
• Self-closing device working properly
• No damage, holes, or modifications
• Hinges secure (minimum 3 hinges)
• Signage in place

**High-rise (over 11m):**
• Flat entrance doors must be FD30S (30 min + smoke seals)
• More rigorous inspection regime required

[View Fire Safety Records](/certificates?type=FIRE_RISK_ASSESSMENT) | [Remedial Actions](/remedial-actions)`,
    sources: ["Fire Safety Order 2005", "Building Safety Act 2022", "BS 8214"],
  },
  // ===== LEGIONELLA (3 FAQs) =====
  {
    id: "legionella-001",
    category: "legionella",
    question: "Do landlords need a Legionella risk assessment?",
    variations: ["Legionella requirements rental property", "LRA mandatory for landlords?", "Water safety assessment rental", "Legionella check rental"],
    answer: `**Yes - all landlords must assess Legionella risk**

**Requirements:**
• Identify and assess risk from Legionella bacteria
• Document the assessment
• Implement control measures if needed
• Review periodically (typically every 2 years)

**For simple domestic properties:**
• Basic assessment often sufficient
• Check water temperatures
• Ensure no stagnation points
• Remove/clean showerheads and taps

**Higher risk situations:**
• Complex water systems
• Stored hot water
• Care homes or HMOs
• May need professional assessment

**Key control:** Keep hot water above 50°C stored, 60°C at cylinder

[View Legionella Assessments](/certificates?type=LEGIONELLA) | [Control Measures](/remedial-actions)`,
    sources: ["ACOP L8", "HSG274 Parts 1-3", "HSE Guidance for Landlords"],
  },
  {
    id: "legionella-002",
    category: "legionella",
    question: "What temperature should hot water be to prevent Legionella?",
    variations: ["Legionella temperature requirements", "Hot water temperature regulations", "Safe water temperature Legionella", "TMV temperature settings"],
    answer: `**Water Temperature Requirements for Legionella Control:**

**Hot water:**
• Stored at **60°C** minimum in cylinders/calorifiers
• Distributed at **50°C** minimum (within 1 minute of running)
• Outlet temperature should reach 50°C within 1 minute

**Cold water:**
• Should be below **20°C** (ideally below 20°C)
• Check at sentinel outlets (furthest from tank)

**TMVs (Thermostatic Mixing Valves):**
• Blend hot/cold to prevent scalding
• Typically set to 41-44°C at outlet
• Required where vulnerable users present
• Must be serviced annually

**Important:** Legionella thrives between 20-45°C - avoid temperatures in this range.

**Monthly checks recommended:** Temperature monitoring at key outlets.`,
    sources: ["HSG274 Part 2", "ACOP L8", "BS 8558"],
  },
  // ===== ASBESTOS (3 FAQs) =====
  {
    id: "asbestos-001",
    category: "asbestos",
    question: "When is an asbestos survey required?",
    variations: ["Asbestos survey requirements", "Do I need asbestos survey?", "Asbestos check rental property", "When to survey for asbestos"],
    answer: `**Asbestos Surveys Required For:**

**Management surveys (non-intrusive):**
• Any non-domestic premises or common areas
• Before routine maintenance work
• As part of property management
• Recommended for pre-1999 buildings

**Refurbishment/Demolition surveys:**
• Before ANY refurbishment work
• Before demolition
• Fully intrusive - destructive inspection
• Required before contractors start work

**Domestic properties:**
• No legal requirement for private dwellings
• BUT duty of care to contractors doing work
• Recommended for pre-2000 properties before works

**Common areas in flats:**
• Management survey required
• Asbestos register must be maintained
• Re-inspection recommended annually

**Note:** Asbestos was used in buildings until 1999 (banned 2000).

[View Asbestos Surveys](/certificates?type=ASBESTOS) | [Management Plans](/remedial-actions)`,
    sources: ["Control of Asbestos Regulations 2012", "HSG264", "HSG227"],
  },
  {
    id: "asbestos-002",
    category: "asbestos",
    question: "What do I do if asbestos is found?",
    variations: ["Asbestos found in property", "How to manage asbestos", "Asbestos removal requirements", "ACM found during works"],
    answer: `**If Asbestos is Found, Follow These Steps:**

**1. Don't panic - assess the risk:**
• Asbestos is only dangerous when disturbed
• Intact materials in good condition can be managed in place

**2. Determine condition:**
• Good condition, undamaged → Usually manage in place
• Damaged or likely to be disturbed → Consider removal

**3. Options:**

**Manage in place:**
• Label clearly
• Add to asbestos register
• Monitor condition (annual re-inspection)
• Brief contractors before any work

**Encapsulate:**
• Seal with protective coating
• Prevents fibre release
• Cheaper than removal

**Remove:**
• Must use licensed contractor (for most ACM types)
• Notify HSE if licensable work
• Requires air testing before re-occupation

**Important:** Never attempt DIY removal of asbestos.

[View Asbestos Surveys](/certificates?type=ASBESTOS) | [Remedial Actions](/remedial-actions)`,
    sources: ["Control of Asbestos Regulations 2012", "HSG264", "HSG247"],
  },
  // ===== GENERAL COMPLIANCE (8 FAQs) =====
  {
    id: "general-001",
    category: "general",
    question: "What compliance certificates do landlords need?",
    variations: ["Required certificates for rental property", "Landlord legal requirements certificates", "Rental property compliance checklist", "What inspections needed for BTL"],
    answer: `**Mandatory Certificates:**

- [Gas Safety (CP12)](/certificates?type=CP12) - Annual (if gas)
- [EICR](/certificates?type=EICR) - Every 5 years
- [EPC](/certificates?type=EPC) - Every 10 years (Rating E+)
- Smoke & CO Alarms - Each tenancy start

**Recommended/Situational:**
- [Fire Risk Assessment](/certificates?type=FIRE_RISK_ASSESSMENT) - HMOs/common areas (annually)
- [Legionella Risk Assessment](/certificates?type=LEGIONELLA) - Every 2 years
- [Asbestos Survey](/certificates?type=ASBESTOS) - Pre-1999 buildings before works

[View All Certificates](/certificates) | [Dashboard](/dashboard) | [Remedial Actions](/remedial-actions)`,
    sources: ["Various regulations - see specific certificate types"],
  },
  {
    id: "general-002",
    category: "general",
    question: "What are the penalties for non-compliance?",
    variations: ["Fines for missing gas certificate", "Landlord compliance penalties", "What happens if no EICR", "Non-compliance consequences rental"],
    answer: `**Penalties for Compliance Failures:**

**Gas Safety:** Up to **£6,000** fine per breach, 6 months prison
• Unlimited fine if tenant harmed
• Manslaughter charges possible

**Electrical Safety:** Up to **£30,000** fine
• Local authority can do works and recover costs
• Rent Repayment Orders possible

**Smoke/CO Alarms:** Up to **£5,000** fine

**Fire Safety (HMOs/common areas):**
• **Unlimited** fines
• Up to 2 years imprisonment
• Prohibition notices (can't let property)

**EPC:** £200 fine per breach, can't legally let without valid EPC

**Also consider:**
• Invalid Section 21 notices
• Insurance may be void
• Mortgage breach
• Criminal record
• Rent Repayment Orders`,
    sources: ["Gas Safety Regulations 1998", "Electrical Safety Standards 2020", "Housing Act 2004"],
  },
  {
    id: "general-003",
    category: "general",
    question: "How long must I keep compliance records?",
    variations: ["Certificate retention period", "How long keep gas certificates", "Record keeping requirements landlords", "Compliance document storage"],
    answer: `**Record Retention Requirements:**

**Gas Safety Records:**
• Minimum 2 years (legal requirement)
• Recommended: Keep indefinitely

**Electrical (EICR):**
• Keep until next inspection (5 years)
• Recommended: Keep indefinitely

**Fire Risk Assessment:**
• Keep current version plus previous
• Retain superseded versions for 3+ years

**Asbestos Records:**
• **40 years minimum** for exposure records
• Keep surveys indefinitely while ACMs present

**EPC:**
• 10 years (valid period)
• Keep expired ones for reference

**General recommendation:**
• Keep ALL compliance records for life of ownership
• Digital backups recommended
• Provide copies to new owner on sale
• Essential for due diligence and insurance claims

[View All Certificates](/certificates) | [Remedial Actions](/remedial-actions)`,
    sources: ["Gas Safety Regulations 1998", "Control of Asbestos Regulations 2012"],
  },
  {
    id: "epc-001",
    category: "general",
    question: "What EPC rating is required for rental properties?",
    variations: ["Minimum EPC rating to rent", "EPC requirements landlords", "Can I rent with EPC rating F", "MEES regulations EPC"],
    answer: `**Minimum EPC Rating: E or above**

**Current rules (MEES):**
• Cannot grant new tenancies if EPC below E
• Cannot continue existing tenancies if below E
• Fine up to **£5,000** for breaches

**Exemptions:**
• All improvements up to £3,500 cap made
• Property will be devalued by 5%+ by works
• Third party consent refused
• Wall insulation would damage property
• Valid exemption lasts 5 years

**Future changes (proposed):**
• Potential requirement for C rating by 2028/2030
• Consult latest government guidance

**To improve rating:**
• Loft/cavity insulation
• Double glazing
• Efficient boiler
• LED lighting
• Smart heating controls

**Note:** Must provide EPC to tenants before letting.

[View EPCs](/certificates?type=EPC) | [Remedial Actions](/remedial-actions)`,
    sources: ["Energy Efficiency Regulations 2015", "MEES Regulations"],
  },
  {
    id: "hmo-001",
    category: "general",
    question: "What extra requirements apply to HMOs?",
    variations: ["HMO compliance requirements", "House in multiple occupation rules", "HMO fire safety requirements", "Licensing requirements HMO"],
    answer: `**HMO (House in Multiple Occupation) Additional Requirements:**

**Licensing:**
• Mandatory license: 5+ people, 2+ households
• Additional licensing may apply locally
• Selective licensing in some areas
• Fees typically £500-1,500

**Fire Safety (enhanced):**
• Fire Risk Assessment mandatory
• Fire doors to all rooms
• Emergency lighting
• Fire alarm system (often Grade A LD2)
• Fire blankets in kitchens
• Clear escape routes

**Facilities:**
• Adequate kitchen facilities for occupants
• Bathroom ratios (typically 1:5)
• Minimum room sizes enforced

**Management:**
• Written statement of terms
• Manager contact details displayed
• Refuse/recycling facilities
• Common areas maintained

**Penalties:** Up to £30,000 fine + Rent Repayment Orders

[View Properties](/properties) | [Fire Safety Certs](/certificates?type=FIRE_RISK_ASSESSMENT) | [Remedial Actions](/remedial-actions)`,
    sources: ["Housing Act 2004", "Licensing of HMOs Regulations 2018", "LACORS Fire Safety Guide"],
  },
  // ===== LIFT / LOLER (2 FAQs) =====
  {
    id: "loler-001",
    category: "lift_safety",
    question: "How often do lifts need to be inspected?",
    variations: ["Lift inspection frequency", "LOLER inspection requirements", "Elevator maintenance regulations", "Lift safety certificate frequency"],
    answer: `**Lift Inspection Requirements (LOLER 1998):**

**Thorough Examination:**
• Every **6 months** for passenger lifts
• Every **12 months** for goods-only lifts
• Must be by competent person (insurance engineer)

**Report Requirements:**
• Written report within 28 days
• Kept for 2 years minimum
• Defects must be addressed

**Regular Maintenance:**
• Ongoing maintenance contract recommended
• Frequency depends on usage and type
• Typically monthly for busy lifts

**Insurance inspections:**
• Often required by building insurance
• May be combined with LOLER inspection

[View Lift Certificates](/certificates?type=LIFT_LOLER) | [Components](/components) | [Remedial Actions](/remedial-actions)`,
    sources: ["LOLER 1998", "PUWER 1998", "BS EN 13015"],
  },
  // ===== BUILDING SAFETY ACT (2 FAQs) =====
  {
    id: "bsa-001",
    category: "building_safety",
    question: "What is the Building Safety Act and who does it affect?",
    variations: ["Building Safety Act 2022 requirements", "BSA high rise regulations", "Who needs to comply with BSA", "HRB building safety"],
    answer: `**Building Safety Act 2022:**

**Applies to Higher-Risk Buildings (HRBs):**
• Residential buildings 18m+ or 7+ storeys
• At least 2 residential units
• Care homes and hospitals over 18m

**Key Requirements:**
• Accountable Person must be appointed
• Building Safety Case required
• Regular fire risk assessments
• Resident engagement strategy
• Golden Thread of building information

**Duties:**
• Prevent building safety risks
• Assess and mitigate risks
• Report to Building Safety Regulator

**Penalties:**
• Criminal offences for non-compliance
• Unlimited fines possible

[View Building Safety Records](/certificates) | [Remedial Actions](/remedial-actions)`,
    sources: ["Building Safety Act 2022", "Building Safety Regulator Guidance"],
  },
  // ===== NAVIGATION HELP (3 FAQs) =====
  {
    id: "nav-001",
    category: "navigation",
    question: "How do I upload a certificate?",
    variations: ["Upload certificate", "Add new certificate", "Submit gas certificate", "How to upload EICR"],
    answer: `**To Upload a Certificate:**

1. Go to [Certificates](/certificates)
2. Click the **Upload Certificate** button
3. Select your PDF or image file
4. AI will extract data automatically
5. Review the extracted fields
6. Link to property if needed
7. Save the certificate

**Supported formats:**
• PDF (recommended)
• PNG, JPG images
• Multi-page documents

**Tips:**
• Clear, high-quality scans work best
• Ensure all pages are included
• Check extracted data before saving

[Go to Certificates](/certificates) | [Remedial Actions](/remedial-actions)`,
    sources: [],
  },
  {
    id: "nav-002",
    category: "navigation",
    question: "How do I add a new property?",
    variations: ["Add property", "Create new property", "Import properties", "Add units to portfolio"],
    answer: `**To Add a Property:**

**Manual entry:**
1. Go to [Properties](/properties)
2. Click **Add Property** button
3. Enter address details
4. Select property type and tenure
5. Assign to a scheme/block
6. Save

**Bulk import:**
1. Go to [Admin → Import Data](/admin/import)
2. Download CSV template
3. Fill in property details
4. Upload completed CSV
5. Review and confirm import

**From certificate upload:**
• Properties can be auto-created when uploading certificates
• System extracts address from certificate

[Go to Properties](/properties) | [Import Data](/admin/import) | [Remedial Actions](/remedial-actions)`,
    sources: [],
  },
  {
    id: "nav-003",
    category: "navigation",
    question: "Where can I see overdue certificates?",
    variations: ["Find expired certificates", "See expiring soon", "Overdue compliance", "Which certificates need renewing"],
    answer: `**To Find Overdue/Expiring Certificates:**

**Dashboard Overview:**
• [Dashboard](/dashboard) shows compliance summary
• Quick links to expiring certificates

**Certificates Page:**
• [Certificates](/certificates?status=EXPIRING) - Expiring soon
• [Certificates](/certificates) - Filter by status

**Reports:**
• Compliance status by property type
• Scheme-level compliance overview

**Actions Page:**
• [Remedial Actions](/actions) - Open work items
• Filter by severity/status

[Go to Dashboard](/dashboard) | [Certificates](/certificates) | [Remedial Actions](/remedial-actions)`,
    sources: [],
  },
];

// Precompute keywords for TF-IDF matching
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'need', 'for', 'and', 'but',
  'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not', 'only',
  'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'any', 'what', 'which',
]);

// Compute TF-IDF vectors for FAQ database
function computeTFIDF(entries: FAQEntry[]): void {
  const documentFrequency: Map<string, number> = new Map();
  const totalDocs = entries.length;
  
  // First pass: count document frequency
  for (const entry of entries) {
    const allText = [entry.question, ...entry.variations].join(' ');
    const tokens = new Set(tokenize(allText));
    entry.keywords = Array.from(tokens);
    
    Array.from(tokens).forEach(token => {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    });
  }
  
  // Second pass: compute TF-IDF vectors
  for (const entry of entries) {
    const allText = [entry.question, ...entry.variations].join(' ');
    const tokens = tokenize(allText);
    const termFrequency: Map<string, number> = new Map();
    
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }
    
    entry.tfidfVector = new Map();
    Array.from(termFrequency.entries()).forEach(([term, tf]) => {
      const df = documentFrequency.get(term) || 1;
      const idf = Math.log(totalDocs / df);
      const tfidf = tf * idf;
      entry.tfidfVector!.set(term, tfidf);
    });
  }
}

// Initialize TF-IDF on module load
computeTFIDF(FAQ_DATABASE);

function cosineSimilarity(queryVector: Map<string, number>, docVector: Map<string, number>): number {
  let dotProduct = 0;
  let queryMagnitude = 0;
  let docMagnitude = 0;
  
  Array.from(queryVector.entries()).forEach(([term, weight]) => {
    queryMagnitude += weight * weight;
    if (docVector.has(term)) {
      dotProduct += weight * docVector.get(term)!;
    }
  });
  
  Array.from(docVector.values()).forEach(weight => {
    docMagnitude += weight * weight;
  });
  
  if (queryMagnitude === 0 || docMagnitude === 0) return 0;
  return dotProduct / (Math.sqrt(queryMagnitude) * Math.sqrt(docMagnitude));
}

function findBestFAQMatch(query: string): { entry: FAQEntry | null; score: number } {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { entry: null, score: 0 };
  
  // Build query TF-IDF vector
  const queryTF: Map<string, number> = new Map();
  for (const token of queryTokens) {
    queryTF.set(token, (queryTF.get(token) || 0) + 1);
  }
  
  // Simple TF for query (no IDF since it's a single document)
  const queryVector: Map<string, number> = new Map();
  Array.from(queryTF.entries()).forEach(([term, count]) => {
    queryVector.set(term, count);
  });
  
  let bestMatch: FAQEntry | null = null;
  let bestScore = 0;
  
  for (const entry of FAQ_DATABASE) {
    if (!entry.tfidfVector) continue;
    
    const score = cosineSimilarity(queryVector, entry.tfidfVector);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }
  
  // Threshold: only return if reasonably confident
  return { entry: bestScore > 0.15 ? bestMatch : null, score: bestScore };
}

// Legacy FAQ cache for backward compatibility (simple keyword matching)
const FAQ_CACHE: Record<string, string> = {
  "gas safety": `**Gas Safety** (Gas Safety Regs 1998)
• Annual check by Gas Safe engineer
• CP12 certificate every **12 months**
• Records kept **2 years**, tenant copy within **28 days**

[View Gas Certificates](/certificates?type=CP12) | [View Expiring](/certificates?status=EXPIRING) | [Remedial Actions](/remedial-actions)`,

  "eicr renew": `**EICR** (Electrical Safety Standards 2020)
• Required every **5 years**
• Qualified electrician (BS 7671)
• Fix issues within **28 days** if unsatisfactory

[View EICRs](/certificates?type=EICR) | [Remedial Actions](/remedial-actions)`,

  "c1 c2 c3": `**Defect Codes**
• **C1** - Immediately Dangerous → Disconnect now
• **C2** - At Risk → Fix within 24-48 hours  
• **C3** - Not to standard → Fix at next service
• **FI** - Further investigation needed

[View Unsatisfactory Certs](/certificates?outcome=UNSATISFACTORY) | [Remedial Actions](/remedial-actions)`,

  "upload certificate": `**Upload a Certificate**
1. Go to [Certificates](/certificates)
2. Click **Upload Certificate** button
3. Select PDF or image file
4. AI extracts data automatically
5. Review and save`,

  "fire risk": `**Fire Risk Assessment** (RRO 2005)
• Required for all communal areas
• Review annually or after changes
• 18m+ buildings: more frequent (BSA 2022)

[View FRAs](/certificates?type=FIRE_RISK_ASSESSMENT) | [Fire Actions](/remedial-actions)`,

  "asbestos": `**Asbestos** (CAR 2012)
• Management survey for pre-2000 buildings
• Re-inspect every 6-12 months
• R&D survey before intrusive work

[View Asbestos Surveys](/certificates?type=ASBESTOS) | [Management Plans](/remedial-actions)`,

  "legionella": `**Legionella** (L8 ACOP)
• Risk assessment every **2 years**
• Hot water: 60°C+ stored, 50°C+ delivered
• Cold water: below 20°C

[View Legionella Assessments](/certificates?type=LEGIONELLA) | [Control Measures](/remedial-actions)`,
};

const FOLLOW_UP_SUGGESTIONS: Record<string, string[]> = {
  "gas": [
    "Show my properties with gas safety issues",
    "Find overdue CP12 certificates in my portfolio",
    "Which properties have C1 defects needing urgent action?",
  ],
  "eicr": [
    "Show my properties with electrical issues",
    "Find EICRs expiring in the next 30 days",
    "Which properties have Code 1 electrical defects?",
  ],
  "c1 c2 c3": [
    "Show properties with open gas remedial actions",
    "Find my non-compliant properties",
    "Which gas certificates need review?",
  ],
  "fire": [
    "Show buildings due for FRA review",
    "Find my properties with fire safety actions",
    "Which schemes need fire risk assessments?",
  ],
  "asbestos": [
    "Show my properties with asbestos actions",
    "Find asbestos surveys expiring soon",
    "Which blocks have asbestos management plans?",
  ],
  "legionella": [
    "Show properties with water safety actions",
    "Find legionella certificates expiring soon",
    "Which properties have water system issues?",
  ],
  "upload": [
    "Show certificates pending AI review",
    "Find certificates with low confidence scores",
    "Which properties are missing certificates?",
  ],
  "property": [
    "Find my non-compliant properties",
    "Show components needing inspection",
    "Which properties have open remedial actions?",
  ],
  "component": [
    "Find components overdue for service",
    "Show boilers needing inspection",
    "Which lifts need LOLER checks?",
  ],
  "default": [
    "Show my non-compliant properties",
    "Find certificates expiring this month",
    "Which remedial actions are overdue?",
  ],
};

function getFollowUpSuggestions(topic: string, askedQuestions: string[]): string[] {
  const topicLower = topic.toLowerCase();
  let suggestions: string[] = FOLLOW_UP_SUGGESTIONS["default"];
  
  for (const [key, sugs] of Object.entries(FOLLOW_UP_SUGGESTIONS)) {
    if (key !== "default" && topicLower.includes(key)) {
      suggestions = sugs;
      break;
    }
  }
  
  // Filter out questions user has already asked (fuzzy match)
  const askedLower = askedQuestions.map(q => q.toLowerCase());
  const filtered = suggestions.filter(s => {
    const sLower = s.toLowerCase();
    return !askedLower.some(asked => 
      asked.includes(sLower.slice(0, 20)) || sLower.includes(asked.slice(0, 20))
    );
  });
  
  // Return 2 suggestions max
  return filtered.slice(0, 2);
}

function findCachedResponse(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('gas safety') || lowerQuery.includes('gas requirement') || lowerQuery.includes('cp12')) {
    return FAQ_CACHE["gas safety"];
  }
  if (lowerQuery.includes('eicr') && (lowerQuery.includes('renew') || lowerQuery.includes('when') || lowerQuery.includes('expire'))) {
    return FAQ_CACHE["eicr renew"];
  }
  if (lowerQuery.includes('c1') || lowerQuery.includes('c2') || lowerQuery.includes('c3') || lowerQuery.includes('defect code')) {
    return FAQ_CACHE["c1 c2 c3"];
  }
  if (lowerQuery.includes('upload') && lowerQuery.includes('certificate')) {
    return FAQ_CACHE["upload certificate"];
  }
  if (lowerQuery.includes('fire risk') || lowerQuery.includes('fra') || lowerQuery.includes('fire safety order')) {
    return FAQ_CACHE["fire risk"];
  }
  if (lowerQuery.includes('asbestos')) {
    return FAQ_CACHE["asbestos"];
  }
  if (lowerQuery.includes('legionella') || lowerQuery.includes('water safety') || lowerQuery.includes('l8')) {
    return FAQ_CACHE["legionella"];
  }
  
  return null;
}

// Get certificates pending review with links
async function getCertificatesPendingReview(): Promise<string> {
  try {
    const pendingCerts = await db
      .select({
        id: certificates.id,
        certificateType: certificates.certificateType,
        status: certificates.status,
      })
      .from(certificates)
      .where(eq(certificates.status, 'NEEDS_REVIEW'));
    
    if (pendingCerts.length === 0) {
      return `**No certificates pending review!**\nAll certificates have been reviewed. [View all certificates](/certificates) | [Remedial Actions](/remedial-actions)`;
    }
    
    // Group by type
    const byType: Record<string, number> = {};
    for (const cert of pendingCerts) {
      const type = cert.certificateType || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    
    // Map common types to friendly names and URL params
    const typeLabels: Record<string, string> = {
      'GAS_SAFETY': 'Gas Safety (CP12)',
      'CP12': 'Gas Safety (CP12)',
      'EICR': 'Electrical (EICR)',
      'FRA': 'Fire Risk Assessment',
      'FIRE_RISK_ASSESSMENT': 'Fire Risk Assessment',
      'EPC': 'Energy Performance',
      'ASBESTOS': 'Asbestos Survey',
      'LEGIONELLA': 'Legionella',
    };
    
    let response = `**Certificates Pending Review: ${pendingCerts.length}**\n\n`;
    
    const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes.slice(0, 5)) {
      const label = typeLabels[type] || type.replace(/_/g, ' ');
      response += `• ${label}: **${count}** → [View](/certificates?status=NEEDS_REVIEW&type=${encodeURIComponent(type)})\n`;
    }
    
    response += `\n[View all pending →](/certificates?status=NEEDS_REVIEW)`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get pending certificates');
    return `Unable to fetch pending certificates. [Check certificates page](/certificates?status=NEEDS_REVIEW) | [Remedial Actions](/remedial-actions)`;
  }
}

// Get certificates expiring soon for chatbot
async function getCertificatesExpiringSoonForChat(): Promise<string> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    // Use raw SQL to avoid type issues with text date columns
    // Filter for valid date format (YYYY-MM-DD) before casting to avoid errors
    const results = await db.execute(sql`
      SELECT 
        c.id,
        c.certificate_type as "certificateType",
        c.expiry_date as "expiryDate",
        c.property_id as "propertyId",
        p.address_line1 as "propertyAddress",
        p.postcode as "propertyPostcode"
      FROM certificates c
      LEFT JOIN properties p ON c.property_id = p.id
      WHERE c.expiry_date IS NOT NULL
        AND c.expiry_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND c.expiry_date::date >= ${now.toISOString().split('T')[0]}::date
        AND c.expiry_date::date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}::date
      ORDER BY c.expiry_date::date ASC
      LIMIT 50
    `);
    
    const expiringCerts = (results.rows as any[]) || [];
    
    if (expiringCerts.length === 0) {
      return `**Great news!** No certificates expiring in the next 30 days.\n\n[View all certificates](/certificates?status=EXPIRING) | [Remedial Actions](/remedial-actions)`;
    }
    
    // Group by type
    const byType: Record<string, any[]> = {};
    for (const cert of expiringCerts) {
      const type = cert.certificateType || 'Unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(cert);
    }
    
    // Map common types to friendly names
    const typeLabels: Record<string, string> = {
      'GAS_SAFETY': 'Gas Safety (CP12)',
      'CP12': 'Gas Safety (CP12)',
      'EICR': 'Electrical (EICR)',
      'FRA': 'Fire Risk Assessment',
      'FIRE_RISK_ASSESSMENT': 'Fire Risk Assessment',
      'EPC': 'Energy Performance',
      'ASBESTOS': 'Asbestos Survey',
      'LEGIONELLA': 'Legionella',
      'LOLER': 'Lift Safety (LOLER)',
      'LIFT_LOLER': 'Lift Safety (LOLER)',
    };
    
    let response = `**Certificates Expiring Soon: ${expiringCerts.length}** (next 30 days)\n\n`;
    
    // Show breakdown by type with links
    const sortedTypes = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
    for (const [type, certs] of sortedTypes.slice(0, 5)) {
      const label = typeLabels[type] || type.replace(/_/g, ' ');
      response += `**${label}:** ${certs.length} expiring → [View](/certificates?status=EXPIRING&type=${encodeURIComponent(type)})\n`;
      
      // Show up to 3 specific certificates with links
      for (const cert of certs.slice(0, 3)) {
        let expiryStr = 'Unknown date';
        if (cert.expiryDate) {
          try {
            expiryStr = new Date(cert.expiryDate).toLocaleDateString('en-GB');
          } catch { expiryStr = cert.expiryDate; }
        }
        const shortAddr = cert.propertyAddress ? shortenAddress(cert.propertyAddress) : 'Unknown';
        response += `  • [${shortAddr}](/certificates/${cert.id}) - expires ${expiryStr}\n`;
      }
      if (certs.length > 3) {
        response += `  • +${certs.length - 3} more → [View all](/certificates?status=EXPIRING&type=${encodeURIComponent(type)})\n`;
      }
      response += `\n`;
    }
    
    response += `**Quick Actions:**\n`;
    response += `• [View all expiring certificates →](/certificates?status=EXPIRING)\n`;
    response += `• [Manage remedial actions →](/remedial-actions)\n`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get expiring certificates');
    return `Unable to fetch expiring certificates. [Check certificates page](/certificates?status=EXPIRING) | [Remedial Actions](/remedial-actions)`;
  }
}

// Get certificates that are already expired (past their expiry date)
async function getExpiredCertificatesForChat(): Promise<string> {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Query for certificates with expiry date in the past
    const results = await db.execute(sql`
      SELECT 
        c.id,
        c.certificate_type as "certificateType",
        c.expiry_date as "expiryDate",
        c.property_id as "propertyId",
        p.address_line1 as "propertyAddress",
        p.postcode as "propertyPostcode"
      FROM certificates c
      LEFT JOIN properties p ON c.property_id = p.id
      WHERE c.expiry_date IS NOT NULL
        AND c.expiry_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND c.expiry_date::date < ${todayStr}::date
      ORDER BY c.expiry_date::date DESC
      LIMIT 50
    `);
    
    const expiredCerts = (results.rows as any[]) || [];
    
    if (expiredCerts.length === 0) {
      return `**Great news!** No expired certificates found in your portfolio.\n\n[View all certificates](/certificates) | [Remedial Actions](/remedial-actions)`;
    }
    
    // Group by type
    const byType: Record<string, any[]> = {};
    for (const cert of expiredCerts) {
      const type = cert.certificateType || 'Unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(cert);
    }
    
    // Map common types to friendly names
    const typeLabels: Record<string, string> = {
      'GAS_SAFETY': 'Gas Safety (CP12)',
      'CP12': 'Gas Safety (CP12)',
      'EICR': 'Electrical (EICR)',
      'FRA': 'Fire Risk Assessment',
      'FIRE_RISK_ASSESSMENT': 'Fire Risk Assessment',
      'EPC': 'Energy Performance',
      'ASBESTOS': 'Asbestos Survey',
      'ASBESTOS_SURVEY': 'Asbestos Survey',
      'LEGIONELLA': 'Legionella',
      'LEGIONELLA_ASSESSMENT': 'Legionella',
      'LOLER': 'Lift Safety (LOLER)',
      'LIFT_LOLER': 'Lift Safety (LOLER)',
    };
    
    let response = `**Expired Certificates: ${expiredCerts.length}** (require immediate attention)\n\n`;
    
    // Show breakdown by type with links
    const sortedTypes = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
    for (const [type, certs] of sortedTypes.slice(0, 5)) {
      const label = typeLabels[type] || type.replace(/_/g, ' ');
      response += `**${label}:** ${certs.length} expired\n`;
      
      // Show up to 3 specific certificates with links
      for (const cert of certs.slice(0, 3)) {
        let expiryStr = 'Unknown date';
        let daysAgo = '';
        if (cert.expiryDate) {
          try {
            const expiryDate = new Date(cert.expiryDate);
            expiryStr = expiryDate.toLocaleDateString('en-GB');
            const diffDays = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 365) {
              daysAgo = ` (${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} overdue)`;
            } else if (diffDays > 30) {
              daysAgo = ` (${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} overdue)`;
            } else {
              daysAgo = ` (${diffDays} day${diffDays !== 1 ? 's' : ''} overdue)`;
            }
          } catch { expiryStr = cert.expiryDate; }
        }
        const shortAddr = cert.propertyAddress ? shortenAddress(cert.propertyAddress) : 'Unknown';
        response += `  • [${shortAddr}](/certificates/${cert.id}) - expired ${expiryStr}${daysAgo}\n`;
      }
      if (certs.length > 3) {
        response += `  • +${certs.length - 3} more\n`;
      }
      response += `\n`;
    }
    
    response += `**Next Steps:**\n`;
    response += `• [View all expired certificates →](/certificates?filter=expired)\n`;
    response += `• [Manage remedial actions →](/remedial-actions)\n`;
    response += `• [Upload new certificates →](/certificates)\n`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get expired certificates');
    return `Unable to fetch expired certificates. [Check certificates page](/certificates) | [Remedial Actions](/remedial-actions)`;
  }
}

// Component type keywords mapping
const COMPONENT_TYPE_KEYWORDS: Record<string, string[]> = {
  'boiler': ['boiler', 'boilers', 'heating'],
  'lift': ['lift', 'lifts', 'elevator', 'elevators', 'loler'],
  'water heater': ['water heater', 'water heaters', 'hot water'],
  'smoke detector': ['smoke detector', 'smoke detectors', 'smoke alarm'],
  'fire alarm': ['fire alarm', 'fire alarms'],
  'sprinkler': ['sprinkler', 'sprinklers'],
  'emergency lighting': ['emergency light', 'emergency lighting'],
  'fire door': ['fire door', 'fire doors'],
  'roof': ['roof', 'roofs', 'roof structure'],
};

function detectComponentType(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  for (const [typeName, keywords] of Object.entries(COMPONENT_TYPE_KEYWORDS)) {
    if (keywords.some(kw => lowerQuery.includes(kw))) {
      return typeName;
    }
  }
  return null;
}

// Get components needing attention
async function getComponentsNeedingAttention(typeFilter?: string | null): Promise<string> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const typeLabel = typeFilter ? `${typeFilter}s` : 'Components';
    
    // First check if there are ANY components of this type
    if (typeFilter) {
      const allOfType = await db
        .select({ id: components.id, componentTypeName: componentTypes.name })
        .from(components)
        .leftJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
        .limit(50);
      
      const filterLower = typeFilter.toLowerCase();
      const matchingCount = allOfType.filter(c => 
        c.componentTypeName?.toLowerCase().includes(filterLower)
      ).length;
      
      if (matchingCount === 0) {
        return `**No ${typeLabel.toLowerCase()} found** in your portfolio. [View all components](/components) | [Remedial Actions](/remedial-actions)`;
      }
    }
    
    // Get components with upcoming or overdue inspections
    let query = db
      .select({
        id: components.id,
        location: components.location,
        manufacturer: components.manufacturer,
        model: components.model,
        nextInspectionDue: components.nextInspectionDue,
        componentTypeName: componentTypes.name,
        propertyId: components.propertyId,
        propertyAddress: properties.addressLine1,
        propertyPostcode: properties.postcode,
      })
      .from(components)
      .leftJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .leftJoin(properties, eq(components.propertyId, properties.id))
      .where(
        or(
          lt(components.nextInspectionDue, today),
          isNull(components.nextInspectionDue)
        )
      )
      .orderBy(components.nextInspectionDue)
      .limit(20);
    
    let criticalComponents = await query;
    
    // Apply type filter if specified
    if (typeFilter) {
      const filterLower = typeFilter.toLowerCase();
      criticalComponents = criticalComponents.filter(c => 
        c.componentTypeName?.toLowerCase().includes(filterLower)
      );
    }
    
    if (criticalComponents.length === 0) {
      return `**All ${typeLabel.toLowerCase()} up to date!** [View all](/components) | [Remedial Actions](/remedial-actions)`;
    }
    
    let response = `**${typeLabel} Needing Attention: ${criticalComponents.length}**\n\n`;
    
    for (const c of criticalComponents.slice(0, 5)) {
      const typeName = c.componentTypeName || 'Component';
      const shortAddr = c.propertyPostcode || 'Unknown';
      const status = c.nextInspectionDue ? `Overdue` : `No date set`;
      const link = c.propertyId ? `[${shortAddr}](/properties/${c.propertyId})` : shortAddr;
      response += `- ${typeName} - ${link} (${status})\n`;
    }
    
    if (criticalComponents.length > 5) {
      response += `\n+${criticalComponents.length - 5} more [View all](/components) | [Remedial Actions](/remedial-actions)`;
    }
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get components needing attention');
    return `Unable to fetch component data. Check the [Components page](/components) | [Remedial Actions](/remedial-actions)`;
  }
}

// Shorten address to just street name and number (first 30 chars max)
function shortenAddress(addr: string | null): string {
  if (!addr) return 'Unknown';
  // Take first part before any descriptive text
  const shortened = addr.split(/,|\s+Building|\s+Property|\s+Contact|\s+Test|\s+Assessment/i)[0].trim();
  return shortened.length > 35 ? shortened.slice(0, 32) + '...' : shortened;
}

// Get properties with compliance issues
async function getPropertiesWithIssues(): Promise<string> {
  try {
    // Get non-compliant properties
    const nonCompliantProps = await db
      .select({
        id: properties.id,
        addressLine1: properties.addressLine1,
        city: properties.city,
        postcode: properties.postcode,
        complianceStatus: properties.complianceStatus,
        blockName: blocks.name,
      })
      .from(properties)
      .leftJoin(blocks, eq(properties.blockId, blocks.id))
      .where(eq(properties.complianceStatus, 'NON_COMPLIANT'))
      .limit(10);
    
    // Get properties with pending actions
    const propsWithActions = await db
      .select({
        propertyId: remedialActions.propertyId,
        actionCount: count(),
      })
      .from(remedialActions)
      .where(eq(remedialActions.status, 'OPEN'))
      .groupBy(remedialActions.propertyId)
      .orderBy(count())
      .limit(5);
    
    if (nonCompliantProps.length === 0 && propsWithActions.length === 0) {
      return `**All clear!** No major compliance issues found. [View all properties](/properties) | [Remedial Actions](/remedial-actions)`;
    }
    
    let response = `**Properties Needing Attention**\n\n`;
    
    if (nonCompliantProps.length > 0) {
      response += `**Non-Compliant (${nonCompliantProps.length}):**\n`;
      for (const p of nonCompliantProps.slice(0, 5)) {
        const shortAddr = shortenAddress(p.addressLine1);
        response += `• [${shortAddr}, ${p.postcode}](/properties/${p.id})\n`;
      }
      if (nonCompliantProps.length > 5) {
        response += `+${nonCompliantProps.length - 5} more [View all →](/properties?status=NON_COMPLIANT)\n`;
      }
      response += `\n`;
    }
    
    if (propsWithActions.length > 0) {
      const propIds = propsWithActions.map(p => p.propertyId).filter(Boolean) as string[];
      if (propIds.length > 0) {
        const propsWithActionDetails = await db
          .select({
            id: properties.id,
            addressLine1: properties.addressLine1,
            postcode: properties.postcode,
          })
          .from(properties)
          .where(or(...propIds.map(id => eq(properties.id, id))))
          .limit(5);
        
        response += `**Open Actions:**\n`;
        for (const p of propsWithActionDetails) {
          const actionInfo = propsWithActions.find(a => a.propertyId === p.id);
          const shortAddr = shortenAddress(p.addressLine1);
          const count = actionInfo?.actionCount || 0;
          response += `• [${shortAddr}, ${p.postcode}](/properties/${p.id}) - ${count} action${count !== 1 ? 's' : ''}\n`;
        }
      }
    }
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get properties with issues');
    return `Unable to fetch data. [Check Properties page](/properties) | [Remedial Actions](/remedial-actions)`;
  }
}

// Search for properties by name/address or compliance status
async function searchProperties(query: string): Promise<string | null> {
  const searchTerms = query.toLowerCase();
  
  // Skip if query is too short or looks like general chat
  if (query.length < 5) return null;
  
  // Skip off-topic questions - let LLM handle redirection
  const offTopicIndicators = ['what do you think', 'opinion', 'politics', 'weather', 'news', 'joke', 
    'how are you', 'hello', 'hi there', 'thanks', 'thank you', 'bye', 'goodbye', 'who are you',
    'recipe', 'cook', 'movie', 'music', 'sport', 'game', 'travel', 'vacation'];
  if (offTopicIndicators.some(term => searchTerms.includes(term))) {
    return null; // Let LLM handle this with proper redirection
  }
  
  // Check for component queries
  const detectedType = detectComponentType(query);
  const hasComponentContext = searchTerms.includes('component') || searchTerms.includes('asset') || 
    searchTerms.includes('equipment') || searchTerms.includes('appliance') || detectedType !== null;
  const wantsComponentAttention = (searchTerms.includes('attention') || searchTerms.includes('overdue') || 
    searchTerms.includes('critical') || searchTerms.includes('need') || searchTerms.includes('inspection') ||
    searchTerms.includes('show') || searchTerms.includes('find') || searchTerms.includes('check')) && hasComponentContext;
  
  if (wantsComponentAttention) {
    return await getComponentsNeedingAttention(detectedType);
  }
  
  // Check for pending certificates queries
  const wantsPendingCerts = (searchTerms.includes('pending') || searchTerms.includes('review') || 
    searchTerms.includes('needs review') || searchTerms.includes('ai review')) && 
    (searchTerms.includes('certificate') || searchTerms.includes('cert'));
  
  if (wantsPendingCerts) {
    return await getCertificatesPendingReview();
  }
  
  // Check for expiring certificates queries - specifically about certificates, not properties
  const hasCertContext = searchTerms.includes('certificate') || searchTerms.includes('cert') || 
    searchTerms.includes('eicr') || searchTerms.includes('cp12') || searchTerms.includes('gas') ||
    searchTerms.includes('electrical') || searchTerms.includes('fire') || searchTerms.includes('fra') ||
    searchTerms.includes('epc') || searchTerms.includes('asbestos') || searchTerms.includes('legionella');
  
  // Check if asking about already expired vs expiring soon
  // "expired", "overdue", "past due" clearly mean already past expiry
  // "expiring", "expiring soon", "due soon" mean upcoming
  // "expiry" alone is ambiguous - check context
  const wantsAlreadyExpired = (searchTerms.includes('expired') || searchTerms.includes('overdue') || 
    searchTerms.includes('past due') || searchTerms.includes('out of date') || 
    searchTerms.includes('lapsed') || searchTerms.includes('already expired')) && hasCertContext;
  
  if (wantsAlreadyExpired) {
    return await getExpiredCertificatesForChat();
  }
  
  // "expiry" with "all" suggests they want both, default to expiring soon
  // "expiring", "due soon", "renew", "soon" all suggest upcoming expirations
  const wantsExpiringCerts = (searchTerms.includes('expiring') || searchTerms.includes('expiry') ||
    searchTerms.includes('due soon') || searchTerms.includes('renew') || 
    searchTerms.includes('soon') || searchTerms.includes('this month') ||
    searchTerms.includes('next month')) && hasCertContext;
  
  if (wantsExpiringCerts) {
    return await getCertificatesExpiringSoonForChat();
  }
  
  // Check for compliance-based queries first - must include property-related terms
  const hasPropertyContext = searchTerms.includes('propert') || searchTerms.includes('block') || 
    searchTerms.includes('scheme') || searchTerms.includes('building') || searchTerms.includes('unit');
  
  const wantsNonCompliant = (searchTerms.includes('non-compliant') || searchTerms.includes('non compliant') || 
    searchTerms.includes('issues') || searchTerms.includes('problem') || searchTerms.includes('low compliance') ||
    searchTerms.includes('failing') || searchTerms.includes('at risk')) && hasPropertyContext;
  const wantsExpiring = (searchTerms.includes('expir') || searchTerms.includes('due soon')) && hasPropertyContext;
  
  if (wantsNonCompliant || wantsExpiring) {
    return await getPropertiesWithIssues();
  }
  
  // Check if this looks like a property search - need explicit property context
  const propertyIndicators = ['find', 'show me', 'details for', 'look up', 'search for'];
  const addressIndicators = ['street', 'road', 'lane', 'avenue', 'drive', 'close', 'way', 'house', 'flat'];
  const hasAddressHint = addressIndicators.some(term => searchTerms.includes(term)) || /[A-Z]{1,2}\d/.test(query); // Postcode pattern
  
  const isPropertySearch = (propertyIndicators.some(term => searchTerms.includes(term)) && hasPropertyContext) || hasAddressHint;
  
  if (!isPropertySearch) return null;
  
  try {
    // Extract potential property name/address from query
    const cleanQuery = query
      .replace(/find|show|details|about|property|where is|look up|search|tell me|give me|all the|for/gi, '')
      .trim();
    
    if (cleanQuery.length < 3) return null;
    
    // Search properties
    const results = await db
      .select({
        id: properties.id,
        addressLine1: properties.addressLine1,
        addressLine2: properties.addressLine2,
        city: properties.city,
        postcode: properties.postcode,
        complianceStatus: properties.complianceStatus,
        propertyType: properties.propertyType,
        bedrooms: properties.bedrooms,
        hasGas: properties.hasGas,
        epcRating: properties.epcRating,
        blockName: blocks.name,
        schemeName: schemes.name,
      })
      .from(properties)
      .leftJoin(blocks, eq(properties.blockId, blocks.id))
      .leftJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(
        or(
          ilike(properties.addressLine1, `%${cleanQuery}%`),
          ilike(properties.addressLine2, `%${cleanQuery}%`),
          ilike(properties.city, `%${cleanQuery}%`),
          ilike(properties.postcode, `%${cleanQuery}%`),
          ilike(blocks.name, `%${cleanQuery}%`)
        )
      )
      .limit(5);
    
    if (results.length === 0) {
      return `I searched but couldn't find any properties matching "${cleanQuery}". Try searching by address, postcode, or block name. [View All Properties](/properties) | [Remedial Actions](/remedial-actions)`;
    }
    
    // Get certificate counts for found properties
    const propertyIds = results.map(r => r.id);
    const certCounts = await db
      .select({
        propertyId: certificates.propertyId,
        count: count(),
      })
      .from(certificates)
      .where(or(...propertyIds.map(id => eq(certificates.propertyId, id))))
      .groupBy(certificates.propertyId);
    
    const certCountMap = new Map(certCounts.map(c => [c.propertyId, c.count]));
    
    // Get action counts
    const actionCounts = await db
      .select({
        propertyId: remedialActions.propertyId,
        count: count(),
      })
      .from(remedialActions)
      .where(or(...propertyIds.map(id => eq(remedialActions.propertyId, id))))
      .groupBy(remedialActions.propertyId);
    
    const actionCountMap = new Map(actionCounts.map(a => [a.propertyId, a.count]));
    
    if (results.length === 1) {
      const p = results[0];
      const certCount = certCountMap.get(p.id) || 0;
      const actionCount = actionCountMap.get(p.id) || 0;
      const statusLabel = p.complianceStatus === 'COMPLIANT' ? 'Compliant' : p.complianceStatus === 'NON_COMPLIANT' ? 'Non-Compliant' : 'Unknown';
      
      return `**Found it!** Here's what I know about this property:

**${p.addressLine1}${p.addressLine2 ? ', ' + p.addressLine2 : ''}**
${p.city}, ${p.postcode}

**Quick Facts:**
- Status: **${statusLabel}**
- Block: ${p.blockName || 'Not assigned'}
- Scheme: ${p.schemeName || 'Not assigned'}
- ${p.bedrooms} bedroom ${p.propertyType?.toLowerCase() || 'property'}
- ${p.hasGas ? 'Gas supply' : 'Electric only'}
${p.epcRating ? `- EPC Rating: ${p.epcRating}` : ''}

**Compliance Summary:**
- ${certCount} certificate${certCount !== 1 ? 's' : ''} on file
- ${actionCount} remedial action${actionCount !== 1 ? 's' : ''}

[View full property details](/properties/${p.id}) | [Remedial Actions](/remedial-actions)`;
    }
    
    // Multiple results
    let response = `I found **${results.length} properties** matching your search:\n\n`;
    
    for (const p of results) {
      const statusLabel = p.complianceStatus === 'COMPLIANT' ? '[Compliant]' : p.complianceStatus === 'NON_COMPLIANT' ? '[Non-Compliant]' : '[Unknown]';
      const certCount = certCountMap.get(p.id) || 0;
      
      response += `${statusLabel} **${p.addressLine1}**, ${p.postcode}\n`;
      response += `   ${p.blockName || 'No block'} - ${certCount} cert${certCount !== 1 ? 's' : ''} - [View details](/properties/${p.id})\n\n`;
    }
    
    response += `[Remedial Actions](/remedial-actions)`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Property search failed');
    return null;
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  success: boolean;
  message: string;
  suggestions?: string[];
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
}

async function getComplianceContext(): Promise<string> {
  try {
    const [propertiesCount, certsCount, actionsCount, pendingReview] = await Promise.all([
      db.select({ count: count() }).from(properties),
      db.select({ count: count() }).from(certificates),
      db.select({ count: count() }).from(remedialActions),
      db.select({ count: count() }).from(certificates).where(eq(certificates.status, 'NEEDS_REVIEW')),
    ]);

    const propCount = propertiesCount[0]?.count || 0;
    const certCount = certsCount[0]?.count || 0;
    const actionCount = actionsCount[0]?.count || 0;
    const pendingCount = pendingReview[0]?.count || 0;

    return `PORTFOLIO SNAPSHOT: You're managing ${propCount} properties with ${certCount} certificates on file. ${pendingCount > 0 ? `${pendingCount} certificates need your review!` : 'All certificates reviewed!'} ${actionCount > 0 ? `There are ${actionCount} remedial actions being tracked.` : ''}`;
  } catch (error) {
    logger.warn({ error }, 'Failed to load compliance context');
    return '';
  }
}

const SYSTEM_PROMPT = `You are ComplianceAI Assistant - UK social housing compliance specialist.

**ONLY answer about:** UK compliance, certificates (CP12, EICR, EPC, FRA, Asbestos, Legionella, LOLER), UK regs, defect codes (C1/C2/C3), and this platform.

**Off-topic?** Politely redirect: "I help with UK housing compliance and this platform. Try asking about certificates, deadlines, or defect codes!"

**CRITICAL - Keep responses SHORT:**
- Max 4-5 bullet points
- Use bullet points (•) not paragraphs
- Include key numbers/deadlines only
- Skip introductions, get to the point

**Platform pages:** Dashboard, Certificates, Properties, Remedial Actions, Human Review

**DO NOT suggest these actions (they don't exist in the platform):**
- "Renew certificates" or "renew certs"
- "Schedule inspection" or "book inspection"
- "Book contractors"
- Any action buttons that aren't viewing data or uploading certificates

**Valid actions to suggest:**
- View certificates, properties, or remedial actions
- Upload new certificates
- Review certificates needing attention

Stay brief and helpful!`;

// =============================================================================
// LAYER 4: RESPONSE ENHANCER
// Adds formatting, sources, and follow-up suggestions
// =============================================================================

function enhanceResponse(
  message: string, 
  intent: IntentClassification, 
  askedQuestions: string[],
  source?: string
): { message: string; suggestions: string[] } {
  const suggestions = getFollowUpSuggestions(
    intent.detectedTopics[0] || 'default', 
    askedQuestions
  );
  
  // Add source attribution if from FAQ
  let enhanced = message;
  if (source === 'faq' && !message.includes('Regulation:')) {
    // Already has regulation info in most FAQ answers
  }
  
  return { message: enhanced, suggestions };
}

// Static responses for common intents
const STATIC_RESPONSES: Record<string, string> = {
  greeting_hello: `👋 Hello! I'm your ComplianceAI assistant. I can help with:

• **Compliance questions** - Gas, electrical, fire safety, etc.
• **Your portfolio** - Find properties, certificates, actions
• **UK regulations** - Deadlines, requirements, penalties

What would you like to know?`,
  
  greeting_thanks: `You're welcome! Let me know if you have any other compliance questions.`,
  
  off_topic: `I'm specialized in UK housing compliance. I can help with:

• Gas safety (CP12), electrical (EICR), fire risk
• Compliance deadlines and regulations
• Finding your properties and certificates

Try asking about a compliance topic!`,
  
  navigation_upload: `**To upload a certificate:**

1. Go to [Certificates](/certificates)
2. Click **Upload Certificate** button
3. Select your PDF or image file
4. AI will extract data automatically
5. Review the extracted fields and save

Need help with something else?`,
};

export async function chatWithAssistant(
  messages: ChatMessage[],
  organisationId?: string
): Promise<AssistantResponse> {
  const startTime = Date.now();
  
  try {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const isFollowUp = messages.length > 1;
    const askedQuestions = messages.filter(m => m.role === 'user').map(m => m.content);
    
    if (!lastUserMessage) {
      return {
        success: true,
        message: STATIC_RESPONSES.greeting_hello,
        suggestions: ["What gas safety certificates do I need?", "Show my non-compliant properties"],
      };
    }
    
    const query = lastUserMessage.content;
    
    // ==========================================================================
    // LAYER 0: INTENT CLASSIFICATION
    // ==========================================================================
    const intent = classifyIntent(query);
    logger.debug({ intent, query: query.substring(0, 50) }, 'Intent classified');
    
    // Handle greetings instantly
    if (intent.category === 'greeting') {
      const isThankYou = /thank|cheers/i.test(query);
      const response = isThankYou ? STATIC_RESPONSES.greeting_thanks : STATIC_RESPONSES.greeting_hello;
      
      // Track analytics - static response
      trackAnalytics({
        intent: intent.category,
        responseSource: 'static',
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs: Date.now() - startTime,
        confidence: intent.confidence,
      });
      
      return {
        success: true,
        message: response,
        suggestions: ["What compliance certificates do I need?", "Show properties with issues"],
        tokensUsed: { input: 0, output: 0 },
      };
    }
    
    // Handle off-topic politely
    if (intent.category === 'off_topic') {
      // Track analytics - static response
      trackAnalytics({
        intent: intent.category,
        responseSource: 'static',
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs: Date.now() - startTime,
        confidence: intent.confidence,
      });
      
      return {
        success: true,
        message: STATIC_RESPONSES.off_topic,
        suggestions: ["What is a CP12?", "How often is an EICR needed?"],
        tokensUsed: { input: 0, output: 0 },
      };
    }
    
    // Handle navigation questions
    if (intent.category === 'navigation') {
      const cachedNav = findCachedResponse(query);
      if (cachedNav) {
        const enhanced = enhanceResponse(cachedNav, intent, askedQuestions, 'static');
        
        // Track analytics - FAQ cache hit
        trackAnalytics({
          intent: intent.category,
          responseSource: 'faq_cache',
          inputTokens: 0,
          outputTokens: 0,
          responseTimeMs: Date.now() - startTime,
          confidence: intent.confidence,
        });
        
        return {
          success: true,
          message: enhanced.message,
          suggestions: enhanced.suggestions,
          tokensUsed: { input: 0, output: 0 },
        };
      }
      // Fall through to LLM for complex navigation
    }
    
    // Check for follow-up questions (let LLM handle with context)
    const followUpIndicators = ['more', 'also', 'what about', 'and', 'tell me more', 'explain', 'why', 'how come'];
    const looksLikeFollowUp = isFollowUp && 
      followUpIndicators.some(ind => query.toLowerCase().startsWith(ind));
    
    if (!looksLikeFollowUp) {
      // ==========================================================================
      // LAYER 2: DATABASE QUERIES (Property/Certificate Lookups) - CHECK FIRST
      // Database intent should be handled by database layer, not RAG
      // ==========================================================================
      if (intent.category === 'database') {
        const propertyResponse = await searchProperties(query);
        if (propertyResponse) {
          logger.info({ query: query.substring(0, 50) }, 'Serving database query response');
          const enhanced = enhanceResponse(propertyResponse, intent, askedQuestions, 'database');
          
          // Track analytics - Database query
          trackAnalytics({
            intent: intent.category,
            responseSource: 'database',
            inputTokens: 0,
            outputTokens: 0,
            responseTimeMs: Date.now() - startTime,
            confidence: intent.confidence,
          });
          
          return {
            success: true,
            message: enhanced.message,
            suggestions: enhanced.suggestions,
            tokensUsed: { input: 0, output: 0 },
          };
        }
        // If database intent but no results found, fall through to LLM
      }
      
      // ==========================================================================
      // LAYER 1 + 2.5: FAQ vs RAG SEARCH (Best Match Wins) - FOR FAQ INTENTS ONLY
      // Check both FAQ and RAG, use whichever has better score
      // This allows knowledge base to override built-in FAQs when more relevant
      // ==========================================================================
      if (intent.category === 'faq' || intent.confidence < 0.8) {
        // Check RAG for knowledge base matches
        const ragResults = await searchKnowledgeBase(query);
        const ragScore = ragResults.length > 0 ? ragResults[0].score : 0;
        
        // Check FAQ 
        const faqMatch = findBestFAQMatch(query);
        
        logger.debug({ 
          faqScore: faqMatch.score?.toFixed(3) || '0',
          ragScore: ragScore.toFixed(3),
          faqId: faqMatch.entry?.id
        }, 'Layer 1/2.5 score comparison');
        
        // RAG wins if it has a good match (score > 0.2) AND beats or matches FAQ
        // This prioritizes organization-specific knowledge over generic FAQs
        if (ragResults.length > 0 && ragScore > 0.2 && ragScore >= faqMatch.score) {
          logger.info({ 
            query: query.substring(0, 50), 
            topScore: ragScore.toFixed(3),
            matches: ragResults.length 
          }, 'Serving RAG knowledge match');
          
          const ragResponse = formatRAGResponse(query, ragResults);
          if (ragResponse) {
            const enhanced = enhanceResponse(ragResponse, intent, askedQuestions, 'rag');
            
            // Track analytics - RAG response
            trackAnalytics({
              intent: intent.category,
              responseSource: 'rag',
              inputTokens: 0,
              outputTokens: 0,
              responseTimeMs: Date.now() - startTime,
              confidence: ragScore,
            });
            
            return {
              success: true,
              message: enhanced.message,
              suggestions: enhanced.suggestions,
              tokensUsed: { input: 0, output: 0 },
            };
          }
        }
        
        // FAQ wins if it has a good match and RAG didn't win
        if (faqMatch.entry && faqMatch.score > 0.15) {
          logger.info({ 
            query: query.substring(0, 50), 
            faqId: faqMatch.entry.id,
            score: faqMatch.score.toFixed(3)
          }, 'Serving TF-IDF FAQ match');
          
          const enhanced = enhanceResponse(faqMatch.entry.answer, intent, askedQuestions, 'faq');
          
          // Track analytics - TF-IDF FAQ match
          trackAnalytics({
            intent: intent.category,
            responseSource: 'faq_tfidf',
            inputTokens: 0,
            outputTokens: 0,
            responseTimeMs: Date.now() - startTime,
            confidence: faqMatch.score,
          });
          
          return {
            success: true,
            message: enhanced.message,
            suggestions: enhanced.suggestions,
            tokensUsed: { input: 0, output: 0 },
          };
        }
        
        // Also check legacy keyword cache
        const cachedResponse = findCachedResponse(query);
        if (cachedResponse) {
          logger.info({ query: query.substring(0, 50) }, 'Serving legacy FAQ cache');
          const enhanced = enhanceResponse(cachedResponse, intent, askedQuestions, 'faq');
          
          // Track analytics - FAQ cache hit
          trackAnalytics({
            intent: intent.category,
            responseSource: 'faq_cache',
            inputTokens: 0,
            outputTokens: 0,
            responseTimeMs: Date.now() - startTime,
            confidence: intent.confidence,
          });
          
          return {
            success: true,
            message: enhanced.message,
            suggestions: enhanced.suggestions,
            tokensUsed: { input: 0, output: 0 },
          };
        }
      }
      
      // ==========================================================================
      // LAYER 2.5 FALLBACK: RAG for other intents (navigation, complex, etc.)
      // Skip for database intent (already handled above) but allow for others
      // ==========================================================================
      if (intent.category !== 'database') {
        const ragResults = await searchKnowledgeBase(query);
        if (ragResults.length > 0 && ragResults[0].score > 0.25) {
          logger.info({ 
            query: query.substring(0, 50), 
            topScore: ragResults[0].score.toFixed(3),
            matches: ragResults.length,
            intent: intent.category
          }, 'Serving RAG fallback for non-FAQ intent');
          
          const ragResponse = formatRAGResponse(query, ragResults);
          if (ragResponse) {
            const enhanced = enhanceResponse(ragResponse, intent, askedQuestions, 'rag');
            
            // Track analytics - RAG response
            trackAnalytics({
              intent: intent.category,
              responseSource: 'rag',
              inputTokens: 0,
              outputTokens: 0,
              responseTimeMs: Date.now() - startTime,
              confidence: ragResults[0].score,
            });
            
            return {
              success: true,
              message: enhanced.message,
              suggestions: enhanced.suggestions,
              tokensUsed: { input: 0, output: 0 },
            };
          }
        }
      }
    }

    // ==========================================================================
    // LAYER 3: LLM HANDLER (Claude for Complex Queries)
    // ==========================================================================
    logger.info({ query: query.substring(0, 50), intent: intent.category }, 'Escalating to LLM');
    
    const complianceContext = await getComplianceContext();
    const systemContent = complianceContext 
      ? `${SYSTEM_PROMPT}\n\n${complianceContext}`
      : SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      system: systemContent,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    let message = textContent?.type === 'text' ? textContent.text : 'I apologize, but I was unable to generate a response.';
    
    // ==========================================================================
    // LAYER 4: RESPONSE ENHANCEMENT
    // ==========================================================================
    const enhanced = enhanceResponse(message, intent, askedQuestions, 'llm');
    
    // Track analytics - LLM response
    trackAnalytics({
      intent: intent.category,
      responseSource: 'llm',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      responseTimeMs: Date.now() - startTime,
      confidence: intent.confidence,
    });

    return {
      success: true,
      message: enhanced.message,
      suggestions: enhanced.suggestions,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (error: any) {
    logger.error({ error }, 'AI Assistant chat error');
    return {
      success: false,
      message: 'I apologize, but I encountered an error. Please try again.',
      error: error.message,
    };
  }
}

export async function* chatWithAssistantStream(
  messages: ChatMessage[],
  organisationId?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const complianceContext = await getComplianceContext();
    
    const systemContent = complianceContext 
      ? `${SYSTEM_PROMPT}\n\n${complianceContext}`
      : SYSTEM_PROMPT;

    const stream = anthropic.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      system: systemContent,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  } catch (error: any) {
    logger.error({ error }, 'AI Assistant stream error');
    yield 'I apologize, but I encountered an error. Please try again.';
  }
}
