import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions, blocks, schemes, components, componentTypes } from '@shared/schema';
import { count, ilike, or, eq, and, isNull, lt, desc } from 'drizzle-orm';

const anthropic = new Anthropic();

// Cached FAQ responses for instant replies - kept short for small chat window
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
      return `🎉 **Great news!** I couldn't find any properties with major compliance issues right now. Your portfolio is looking healthy!

Want me to help you with something else? You can:
- Search for a specific property by name or address
- Ask about compliance requirements
- Check on upcoming certificate renewals`;
    }
    
    let response = `⚠️ **Properties Needing Attention**\n\n`;
    
    if (nonCompliantProps.length > 0) {
      response += `**🔴 Non-Compliant Properties (${nonCompliantProps.length}):**\n\n`;
      for (const p of nonCompliantProps.slice(0, 5)) {
        response += `- **${p.addressLine1}**, ${p.postcode}\n`;
        response += `  ${p.blockName || 'No block'} • [View & fix →](/properties/${p.id})\n\n`;
      }
      if (nonCompliantProps.length > 5) {
        response += `  ...and ${nonCompliantProps.length - 5} more. [View all properties](/properties?status=NON_COMPLIANT)\n\n`;
      }
    }
    
    if (propsWithActions.length > 0) {
      // Get property details for actions
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
        
        response += `**🔧 Properties with Open Remedial Actions:**\n\n`;
        for (const p of propsWithActionDetails) {
          const actionInfo = propsWithActions.find(a => a.propertyId === p.id);
          response += `- **${p.addressLine1}**, ${p.postcode} - ${actionInfo?.actionCount || 0} open action${(actionInfo?.actionCount || 0) !== 1 ? 's' : ''}\n`;
          response += `  [View property details →](/properties/${p.id})\n\n`;
        }
      }
    }
    
    response += `💡 **Tip:** Click on any property to see full details and take action!`;
    
    return response;
  } catch (error) {
    logger.error({ error }, 'Failed to get properties with issues');
    return `😅 I had trouble fetching the compliance data. Try refreshing or check the [Properties page](/properties) directly.`;
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

export async function chatWithAssistant(
  messages: ChatMessage[],
  organisationId?: string
): Promise<AssistantResponse> {
  try {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const isFollowUp = messages.length > 1; // Has previous conversation
    
    // Get all user questions for filtering suggestions
    const askedQuestions = messages.filter(m => m.role === 'user').map(m => m.content);
    
    // Check if this looks like a follow-up question
    const followUpIndicators = ['more', 'also', 'what about', 'and', 'tell me more', 'explain', 'why', 'how come', 'can you'];
    const looksLikeFollowUp = isFollowUp && lastUserMessage && 
      followUpIndicators.some(ind => lastUserMessage.content.toLowerCase().startsWith(ind));
    
    if (lastUserMessage && !looksLikeFollowUp) {
      // Check FAQ cache first for instant responses (only for first questions)
      const cachedResponse = findCachedResponse(lastUserMessage.content);
      if (cachedResponse) {
        logger.info({ query: lastUserMessage.content.substring(0, 50) }, 'Serving cached FAQ response');
        const suggestions = getFollowUpSuggestions(lastUserMessage.content, askedQuestions);
        return {
          success: true,
          message: cachedResponse,
          suggestions,
          tokensUsed: { input: 0, output: 0 },
        };
      }
      
      // Check for property search queries
      const propertyResponse = await searchProperties(lastUserMessage.content);
      if (propertyResponse) {
        logger.info({ query: lastUserMessage.content.substring(0, 50) }, 'Serving property search response');
        const suggestions = getFollowUpSuggestions(lastUserMessage.content, askedQuestions);
        return {
          success: true,
          message: propertyResponse,
          suggestions,
          tokensUsed: { input: 0, output: 0 },
        };
      }
    }

    // Fall back to LLM for non-cached queries
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
    
    // Get suggestions for LLM responses too
    const suggestions = lastUserMessage 
      ? getFollowUpSuggestions(lastUserMessage.content, askedQuestions)
      : [];

    return {
      success: true,
      message,
      suggestions,
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
