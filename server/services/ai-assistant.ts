import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions, blocks, schemes, components, componentTypes } from '@shared/schema';
import { count, ilike, or, eq, and, isNull, lt, desc } from 'drizzle-orm';

const anthropic = new Anthropic();

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

// Enhanced FAQ database - loaded from attached JSON
const FAQ_DATABASE: FAQEntry[] = [
  {
    id: "gas-001",
    category: "gas_safety",
    question: "How often do gas safety certificates need to be renewed?",
    variations: ["When does a gas certificate expire?", "LGSR renewal frequency", "CP12 validity period", "Gas cert expiry"],
    answer: `**Gas Safety Certificates** (LGSR/CP12) must be renewed **annually** - within 12 months.

• Applies to all rental properties with gas appliances
• Must be by Gas Safe registered engineer
• Certificate to tenant within **28 days**
• Records kept for **2 years**

**Regulation:** Gas Safety Regulations 1998`,
    sources: ["Gas Safety Regulations 1998", "HSE Guidance INDG285"],
  },
  {
    id: "gas-002",
    category: "gas_safety",
    question: "What appliances need to be checked on a gas safety inspection?",
    variations: ["What does a gas check cover?", "Gas safety inspection scope", "What's included in LGSR?"],
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
• Gas tightness (pipework)`,
    sources: ["Gas Safety Regulations 1998"],
  },
  {
    id: "gas-003",
    category: "gas_safety", 
    question: "What happens if a gas appliance is condemned?",
    variations: ["Immediately dangerous gas appliance", "ID classification gas", "At risk gas appliance", "AR classification meaning"],
    answer: `**Gas Appliance Classifications:**

🔴 **Immediately Dangerous (ID)**
• Disconnect immediately
• Cannot use until repaired

🟠 **At Risk (AR)**
• Should be repaired ASAP
• User warned in writing

🟡 **Not to Current Standards (NCS)**
• Safe to use
• Recommend upgrade when convenient

**Landlord must fix all ID and AR issues before re-letting.**`,
    sources: ["Gas Safe Register Unsafe Situations Procedure"],
  },
  {
    id: "electrical-001",
    category: "electrical",
    question: "How often is an EICR required for rental properties?",
    variations: ["EICR inspection frequency", "When do electrical certificates expire?", "Electrical safety check frequency"],
    answer: `**EICRs required at least every 5 years**

• Mandatory for all private rented sector (since April 2021)
• Must be by qualified electrician (NICEIC, NAPIT, ELECSA)
• C1/C2 defects: fix within **28 days**
• Copy to tenant within **28 days**

**Regulation:** Electrical Safety Standards Regulations 2020`,
    sources: ["Electrical Safety Standards Regulations 2020", "BS 7671:2018+A2:2022"],
  },
  {
    id: "electrical-002",
    category: "electrical",
    question: "What do EICR codes C1, C2, C3 mean?",
    variations: ["EICR observation codes explained", "What is a C1 defect?", "C2 electrical code meaning", "Electrical report classification codes"],
    answer: `**EICR Observation Codes:**

🔴 **C1 - Danger Present**
• Immediate risk → Fix within **24-48 hours**

🟠 **C2 - Potentially Dangerous**
• Could become dangerous → Fix within **28 days** (legal)

🟡 **C3 - Improvement Recommended**
• Not a safety issue → Recommended but not mandatory

**FI** - Further Investigation needed

**Any C1 or C2 = UNSATISFACTORY overall**`,
    sources: ["BS 7671:2018", "Electrical Safety Standards Regulations 2020"],
  },
  {
    id: "fire-001",
    category: "fire_safety",
    question: "How often should a Fire Risk Assessment be reviewed?",
    variations: ["FRA review frequency", "When to update fire risk assessment", "Fire risk assessment renewal"],
    answer: `**Fire Risk Assessment: Review annually** or sooner if:

• Significant building changes
• Changes to use or occupancy
• After a fire or near-miss
• New legislation introduced

**High-rise (18m+):**
• More frequent reviews (quarterly)
• Building Safety Case required

**Regulation:** Fire Safety Order 2005, Building Safety Act 2022`,
    sources: ["Fire Safety Order 2005", "PAS 79-2:2020", "Building Safety Act 2022"],
  },
  {
    id: "fire-002",
    category: "fire_safety",
    question: "Do I need fire alarms in rental properties?",
    variations: ["Smoke alarm requirements rental", "Carbon monoxide alarm regulations", "Fire alarm requirements landlords"],
    answer: `**Yes - smoke and CO alarms mandatory** (from Oct 2022)

**Smoke alarms:**
• At least one on each storey
• Must work at start of each tenancy

**Carbon monoxide alarms:**
• In any room with combustion appliance
• Includes gas boilers, fires, wood burners

**Penalties:** Up to £5,000 fine

**Regulation:** Smoke and CO Alarm Regulations 2022`,
    sources: ["Smoke and CO Alarm Regulations 2022"],
  },
  {
    id: "legionella-001",
    category: "legionella",
    question: "Do landlords need a Legionella risk assessment?",
    variations: ["Legionella requirements rental property", "LRA mandatory for landlords?", "Water safety assessment rental"],
    answer: `**Yes - all landlords must assess Legionella risk**

• Document the assessment
• Review every **2 years**
• Implement control measures if needed

**Temperature controls:**
• Hot water: **60°C** stored, **50°C** delivered
• Cold water: below **20°C**

**Regulation:** HSE ACOP L8, HSG274`,
    sources: ["ACOP L8", "HSG274 Parts 1-3"],
  },
  {
    id: "asbestos-001",
    category: "asbestos",
    question: "When is an asbestos survey required?",
    variations: ["Asbestos survey requirements", "Do I need asbestos survey?", "Asbestos check rental property"],
    answer: `**Asbestos Surveys Required For:**

**Management surveys:**
• Non-domestic premises/common areas
• Before routine maintenance
• Pre-1999 buildings recommended

**Refurbishment/Demolition surveys:**
• Before ANY refurbishment work
• Before demolition

**Note:** Asbestos used until 1999 (banned 2000)

**Regulation:** Control of Asbestos Regulations 2012`,
    sources: ["Control of Asbestos Regulations 2012", "HSG264"],
  },
  {
    id: "general-001",
    category: "general",
    question: "What compliance certificates do landlords need?",
    variations: ["Required certificates for rental property", "Landlord legal requirements certificates", "Rental property compliance checklist"],
    answer: `**Mandatory Certificates:**

✅ **Gas Safety (CP12)** - Annual (if gas)
✅ **EICR** - Every 5 years
✅ **EPC** - Every 10 years (Rating E+)
✅ **Smoke & CO Alarms** - Each tenancy start

**Recommended:**
📋 **Fire Risk Assessment** - HMOs/common areas
📋 **Legionella Risk Assessment** - Every 2 years
📋 **Asbestos Survey** - Pre-1999 buildings`,
    sources: ["Various UK regulations"],
  },
  {
    id: "general-002",
    category: "general",
    question: "What are the penalties for non-compliance?",
    variations: ["Fines for missing gas certificate", "Landlord compliance penalties", "What happens if no EICR"],
    answer: `**Compliance Penalties:**

**Gas Safety:** Up to **£6,000** fine, 6 months prison
**Electrical:** Up to **£30,000** fine
**Smoke/CO Alarms:** Up to **£5,000** fine
**Fire Safety:** **Unlimited** fines, 2 years prison

**Also:**
• Invalid Section 21 notices
• Insurance may be void
• Rent Repayment Orders possible`,
    sources: ["Gas Safety Regs 1998", "Electrical Safety Standards 2020", "Housing Act 2004"],
  },
  {
    id: "epc-001",
    category: "general",
    question: "What EPC rating is required for rental properties?",
    variations: ["Minimum EPC rating to rent", "EPC requirements landlords", "Can I rent with EPC rating F", "MEES regulations"],
    answer: `**Minimum EPC: E or above**

• Cannot grant new tenancies if below E
• Fine up to **£5,000** for breaches

**Exemptions:**
• All improvements up to £3,500 cap made
• Valid exemption lasts 5 years

**Future:** Potential C rating by 2028/2030

**Regulation:** MEES Regulations`,
    sources: ["Energy Efficiency Regulations 2015", "MEES Regulations"],
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
• Records kept **2 years**, tenant copy within **28 days**`,

  "eicr renew": `**EICR** (Electrical Safety Standards 2020)
• Required every **5 years**
• Qualified electrician (BS 7671)
• Fix issues within **28 days** if unsatisfactory`,

  "c1 c2 c3": `**Gas Defect Codes**
• **C1** - Immediately Dangerous → Disconnect now
• **C2** - At Risk → Fix within 24-48 hours  
• **C3** - Not to standard → Fix at next service
• **FI** - Further investigation needed`,

  "upload certificate": `**Upload a Certificate**
1. Go to [Certificates](/certificates)
2. Click **Upload Certificate** button
3. Select PDF or image file
4. AI extracts data automatically
5. Review and save`,

  "fire risk": `**Fire Risk Assessment** (RRO 2005)
• Required for all communal areas
• Review annually or after changes
• 18m+ buildings: more frequent (BSA 2022)`,

  "asbestos": `**Asbestos** (CAR 2012)
• Management survey for pre-2000 buildings
• Re-inspect every 6-12 months
• R&D survey before intrusive work`,

  "legionella": `**Legionella** (L8 ACOP)
• Risk assessment every **2 years**
• Hot water: 60°C+ stored, 50°C+ delivered
• Cold water: below 20°C`,
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
    "Which blocks need asbestos re-inspection?",
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
      return `✅ **No certificates pending review!**\nAll certificates have been reviewed. [View all certificates](/certificates)`;
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
    
    let response = `🕵️ **Certificates Pending Review: ${pendingCerts.length}**\n\n`;
    
    const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes.slice(0, 5)) {
      const label = typeLabels[type] || type.replace(/_/g, ' ');
      response += `• ${label}: **${count}** → [View](/certificates?status=NEEDS_REVIEW&type=${encodeURIComponent(type)})\n`;
    }
    
    response += `\n[View all pending →](/certificates?status=NEEDS_REVIEW)`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get pending certificates');
    return `😅 Couldn't fetch pending certificates. [Check certificates page](/certificates?status=NEEDS_REVIEW)`;
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
        return `🔍 **No ${typeLabel.toLowerCase()} found** in your portfolio. [View all components →](/components)`;
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
      return `✅ **All ${typeLabel.toLowerCase()} up to date!** [View all →](/components)`;
    }
    
    let response = `🔧 **${typeLabel} Needing Attention: ${criticalComponents.length}**\n\n`;
    
    for (const c of criticalComponents.slice(0, 5)) {
      const typeName = c.componentTypeName || 'Component';
      const shortAddr = c.propertyPostcode || 'Unknown';
      const status = c.nextInspectionDue ? `⚠️ Overdue` : `❓ No date`;
      const link = c.propertyId ? `[${shortAddr}](/properties/${c.propertyId})` : shortAddr;
      response += `• ${typeName} - ${link} ${status}\n`;
    }
    
    if (criticalComponents.length > 5) {
      response += `\n+${criticalComponents.length - 5} more [View all →](/components)`;
    }
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get components needing attention');
    return `😅 Couldn't fetch component data. Check the [Components page](/components) directly.`;
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
      return `🎉 **All clear!** No major compliance issues found. [View all properties →](/properties)`;
    }
    
    let response = `⚠️ **Properties Needing Attention**\n\n`;
    
    if (nonCompliantProps.length > 0) {
      response += `**🔴 Non-Compliant (${nonCompliantProps.length}):**\n`;
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
        
        response += `**🔧 Open Actions:**\n`;
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
    return `😅 Couldn't fetch data. [Check Properties page →](/properties)`;
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
      return `🔍 I searched but couldn't find any properties matching "${cleanQuery}". Try searching by address, postcode, or block name!`;
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
      const statusEmoji = p.complianceStatus === 'COMPLIANT' ? '✅' : p.complianceStatus === 'NON_COMPLIANT' ? '🔴' : '⚠️';
      
      return `🏠 **Found it!** Here's what I know about this property:

**${p.addressLine1}${p.addressLine2 ? ', ' + p.addressLine2 : ''}**
📍 ${p.city}, ${p.postcode}

**Quick Facts:**
- ${statusEmoji} Status: **${p.complianceStatus?.replace('_', ' ')}**
- 🏘️ Block: ${p.blockName || 'Not assigned'}
- 📋 Scheme: ${p.schemeName || 'Not assigned'}
- 🛏️ ${p.bedrooms} bedroom ${p.propertyType?.toLowerCase() || 'property'}
- ${p.hasGas ? '🔥 Gas supply' : '⚡ Electric only'}
${p.epcRating ? `- 📊 EPC Rating: ${p.epcRating}` : ''}

**Compliance Summary:**
- 📄 ${certCount} certificate${certCount !== 1 ? 's' : ''} on file
- 🔧 ${actionCount} remedial action${actionCount !== 1 ? 's' : ''}

👉 [View full property details](/properties/${p.id})`;
    }
    
    // Multiple results
    let response = `🔍 I found **${results.length} properties** matching your search:\n\n`;
    
    for (const p of results) {
      const statusEmoji = p.complianceStatus === 'COMPLIANT' ? '✅' : p.complianceStatus === 'NON_COMPLIANT' ? '🔴' : '⚠️';
      const certCount = certCountMap.get(p.id) || 0;
      
      response += `${statusEmoji} **${p.addressLine1}**, ${p.postcode}\n`;
      response += `   ${p.blockName || 'No block'} • ${certCount} cert${certCount !== 1 ? 's' : ''} • [View details](/properties/${p.id})\n\n`;
    }
    
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

    return `PORTFOLIO SNAPSHOT: You're managing ${propCount} properties with ${certCount} certificates on file. ${pendingCount > 0 ? `⚠️ ${pendingCount} certificates need your review!` : '✅ All certificates reviewed!'} ${actionCount > 0 ? `There are ${actionCount} remedial actions being tracked.` : ''}`;
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

**Platform pages:** Dashboard, Certificates, Properties, Actions, Human Review

Stay brief and helpful! 🏠`;

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
  
  greeting_thanks: `You're welcome! 🏠 Let me know if you have any other compliance questions.`,
  
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
      return {
        success: true,
        message: response,
        suggestions: ["What compliance certificates do I need?", "Show properties with issues"],
        tokensUsed: { input: 0, output: 0 },
      };
    }
    
    // Handle off-topic politely
    if (intent.category === 'off_topic') {
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
      // LAYER 1: FAQ DATABASE (TF-IDF Semantic Matching)
      // ==========================================================================
      if (intent.category === 'faq' || intent.confidence < 0.8) {
        const faqMatch = findBestFAQMatch(query);
        if (faqMatch.entry && faqMatch.score > 0.15) {
          logger.info({ 
            query: query.substring(0, 50), 
            faqId: faqMatch.entry.id,
            score: faqMatch.score.toFixed(3)
          }, 'Serving TF-IDF FAQ match');
          
          const enhanced = enhanceResponse(faqMatch.entry.answer, intent, askedQuestions, 'faq');
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
          return {
            success: true,
            message: enhanced.message,
            suggestions: enhanced.suggestions,
            tokensUsed: { input: 0, output: 0 },
          };
        }
      }
      
      // ==========================================================================
      // LAYER 2: DATABASE QUERIES (Property/Certificate Lookups)
      // ==========================================================================
      if (intent.category === 'database') {
        const propertyResponse = await searchProperties(query);
        if (propertyResponse) {
          logger.info({ query: query.substring(0, 50) }, 'Serving database query response');
          const enhanced = enhanceResponse(propertyResponse, intent, askedQuestions, 'database');
          return {
            success: true,
            message: enhanced.message,
            suggestions: enhanced.suggestions,
            tokensUsed: { input: 0, output: 0 },
          };
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
