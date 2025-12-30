import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions, blocks, schemes, components, componentTypes } from '@shared/schema';
import { count, ilike, or, eq, and, isNull, lt, desc } from 'drizzle-orm';

const anthropic = new Anthropic();

// Cached FAQ responses for instant replies
const FAQ_CACHE: Record<string, string> = {
  "gas safety": `**Gas Safety Requirements for Social Housing**

Under the Gas Safety (Installation and Use) Regulations 1998, landlords must:

- Have all gas appliances, flues, and pipework checked **annually** by a Gas Safe registered engineer
- Keep records of safety checks for **2 years**
- Provide tenants with a copy of the gas safety record within **28 days** of the check

**Key points:**
- Checks must be completed within 12 months of the previous check
- CP12 (Landlord Gas Safety Record) is the required certificate
- Failure to comply can result in fines up to £6,000 or imprisonment`,

  "eicr renew": `**EICR Renewal Requirements**

Electrical Installation Condition Reports (EICRs) must be renewed:

- **Every 5 years** for rented properties (as per the Electrical Safety Standards in the Private Rented Sector Regulations 2020)
- Or sooner if the previous report recommends an earlier re-inspection date

**Key requirements:**
- Must be carried out by a qualified electrician (18th Edition BS 7671)
- Landlords must provide a copy to tenants within **28 days**
- Unsatisfactory results require remedial work within **28 days** (or 21 days for urgent issues)`,

  "c1 c2 c3": `**Gas Defect Classifications (C1, C2, C3)**

**C1 - Immediately Dangerous**
- Risk of injury, fire, or explosion
- Gas must be disconnected immediately
- "At Risk" or "Do Not Use" labels applied

**C2 - At Risk**
- Not immediately dangerous but could become so
- Should be repaired urgently (typically within 24-48 hours)
- Appliance may need to be turned off

**C3 - Not to Current Standards**
- Not meeting current regulations but not dangerous
- Should be addressed at next service
- No immediate action required

**FI - Further Investigation**
- Requires additional testing to determine safety`,

  "upload certificate": `**How to Upload a Certificate**

1. Navigate to **Certificates** in the main menu
2. Click the **Upload Certificate** button
3. Select the certificate file (PDF or image)
4. The AI will automatically extract key information
5. Review the extracted data and make corrections if needed
6. Click **Save** to complete the upload

**Tips:**
- Clear, high-quality scans work best
- The system supports Gas Safety, EICR, FRA, EPC, and other certificate types
- Extracted data can be edited before saving`,

  "fire risk": `**Fire Risk Assessment Requirements**

Under the Regulatory Reform (Fire Safety) Order 2005:

- **All communal areas** in residential buildings require a Fire Risk Assessment (FRA)
- Must be reviewed **regularly** (typically annually, or after significant changes)
- Higher Risk Buildings (18m+) require more frequent reviews under the Building Safety Act 2022

**FRA must assess:**
- Fire detection and warning systems
- Emergency escape routes
- Fire fighting equipment
- Compartmentation and fire doors
- Management procedures

**Responsible Person** must ensure:
- Assessment is suitable and sufficient
- Findings are implemented
- Records are maintained`,

  "asbestos": `**Asbestos Survey Requirements**

Under the Control of Asbestos Regulations 2012:

**Management Survey** - Required for all buildings built before 2000
- Identifies asbestos-containing materials (ACMs)
- Assesses condition and risk
- Should be reviewed annually

**Refurbishment/Demolition Survey** - Required before any intrusive work
- More thorough and destructive
- Must be done before refurbishment or demolition

**Key requirements:**
- Maintain an Asbestos Register
- Create and implement an Asbestos Management Plan
- Re-inspect ACMs regularly (typically every 6-12 months)
- All surveys must be by a UKAS-accredited surveyor`,

  "legionella": `**Legionella Risk Assessment Requirements**

Under the Health and Safety at Work Act 1974 and L8 ACOP:

- **Risk assessment required** for all water systems
- Review at least every **2 years** (or after significant changes)
- Temperature monitoring: Hot water should be stored at **60°C+**, delivered at **50°C+**
- Cold water should be below **20°C**

**Control measures:**
- Flush little-used outlets weekly
- Descale showerheads quarterly
- Annual inspection of water tanks
- Temperature checks monthly

**High-risk factors:**
- Water stored between 20-45°C
- Spray generation (showers, taps)
- Vulnerable occupants`,
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

function getFollowUpSuggestions(topic: string): string {
  const topicLower = topic.toLowerCase();
  let suggestions: string[] = FOLLOW_UP_SUGGESTIONS["default"];
  
  for (const [key, sugs] of Object.entries(FOLLOW_UP_SUGGESTIONS)) {
    if (key !== "default" && topicLower.includes(key)) {
      suggestions = sugs;
      break;
    }
  }
  
  return `\n\n---\n💡 **You might also ask:**\n${suggestions.map(s => `• ${s}`).join('\n')}`;
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

// Get components needing attention
async function getComponentsNeedingAttention(): Promise<string> {
  try {
    // Get components with upcoming or overdue inspections
    const today = new Date().toISOString().split('T')[0];
    
    const criticalComponents = await db
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
      .limit(10);
    
    if (criticalComponents.length === 0) {
      return `✅ **All components up to date!**

No components are overdue for inspection. Great job staying on top of maintenance!

Need to check something specific? Try:
- "Find boiler components"
- "Show lift equipment"`;
    }
    
    let response = `🔧 **Components Needing Attention (${criticalComponents.length})**\n\n`;
    
    for (const c of criticalComponents.slice(0, 5)) {
      const overdue = c.nextInspectionDue ? `Overdue: ${c.nextInspectionDue}` : 'No inspection date set';
      response += `- **${c.componentTypeName || 'Component'}**${c.manufacturer ? ` - ${c.manufacturer}` : ''}\n`;
      response += `  📍 ${c.propertyAddress || 'Unknown'}, ${c.propertyPostcode || ''}\n`;
      response += `  ⚠️ ${overdue}\n`;
      if (c.propertyId) {
        response += `  [View property →](/properties/${c.propertyId})\n`;
      }
      response += `\n`;
    }
    
    if (criticalComponents.length > 5) {
      response += `...and ${criticalComponents.length - 5} more. [View all components](/components)\n`;
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
  const hasComponentContext = searchTerms.includes('component') || searchTerms.includes('asset') || 
    searchTerms.includes('equipment') || searchTerms.includes('boiler') || searchTerms.includes('lift') ||
    searchTerms.includes('appliance');
  const wantsComponentAttention = (searchTerms.includes('attention') || searchTerms.includes('overdue') || 
    searchTerms.includes('critical') || searchTerms.includes('need') || searchTerms.includes('inspection')) && hasComponentContext;
  
  if (wantsComponentAttention || (searchTerms.includes('find') && hasComponentContext)) {
    return await getComponentsNeedingAttention();
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

const SYSTEM_PROMPT = `You are the ComplianceAI Assistant - a specialist in UK social housing compliance and this platform ONLY.

**IMPORTANT: You ONLY answer questions about:**
1. UK social housing compliance requirements and regulations
2. Certificate types: Gas Safety (CP12), EICR, EPC, Fire Risk Assessment, Asbestos Survey, Legionella, LOLER
3. UK legislation: Gas Safety Regs 1998, BS 7671, RRO 2005, CAR 2012, Building Safety Act 2022
4. Defect classifications: C1/C2/C3 (gas), Code 1-4 (electrical)
5. Remedial actions and compliance deadlines
6. ComplianceAI platform features and navigation

**If someone asks about ANYTHING else (weather, recipes, coding help, general chat, etc.), politely redirect:**
"I'm specifically designed to help with UK social housing compliance and the ComplianceAI platform. I can help you with certificate requirements, compliance deadlines, defect codes, or navigating the platform. What would you like to know?"

**Your personality:**
- Warm and professional - use emojis naturally 🏠 📋 ✅
- Concise - busy property managers need quick answers
- Proactive - mention relevant portfolio data when helpful
- Safety-first - recommend professional inspection when in doubt

**When discussing the portfolio:**
- Reference actual numbers from the context provided
- Be specific: "You've got 3 certificates expiring soon!"
- Suggest next steps: "Shall I help you find those properties?"

**ComplianceAI Platform Features:**
- **Dashboard** → Compliance overview, expiring certificates, quick stats
- **Certificates** → Upload, view, AI-extracted certificate data
- **Properties** → Portfolio organized by schemes and blocks
- **Actions** → Track and manage remedial work from inspections
- **Human Review** → Certificates needing manual verification
- **Model Insights** → AI extraction accuracy and analytics
- **Factory Settings** → Configure thresholds and patterns (admin only)

Stay focused on compliance. You're here to keep residents safe! 🏠`;

export async function chatWithAssistant(
  messages: ChatMessage[],
  organisationId?: string
): Promise<AssistantResponse> {
  try {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const isFollowUp = messages.length > 1; // Has previous conversation
    
    // Check if this looks like a follow-up question
    const followUpIndicators = ['more', 'also', 'what about', 'and', 'tell me more', 'explain', 'why', 'how come', 'can you'];
    const looksLikeFollowUp = isFollowUp && lastUserMessage && 
      followUpIndicators.some(ind => lastUserMessage.content.toLowerCase().startsWith(ind));
    
    if (lastUserMessage && !looksLikeFollowUp) {
      // Check FAQ cache first for instant responses (only for first questions)
      const cachedResponse = findCachedResponse(lastUserMessage.content);
      if (cachedResponse) {
        logger.info({ query: lastUserMessage.content.substring(0, 50) }, 'Serving cached FAQ response');
        const followUps = getFollowUpSuggestions(lastUserMessage.content);
        return {
          success: true,
          message: cachedResponse + followUps,
          tokensUsed: { input: 0, output: 0 },
        };
      }
      
      // Check for property search queries
      const propertyResponse = await searchProperties(lastUserMessage.content);
      if (propertyResponse) {
        logger.info({ query: lastUserMessage.content.substring(0, 50) }, 'Serving property search response');
        const followUps = getFollowUpSuggestions(lastUserMessage.content);
        return {
          success: true,
          message: propertyResponse + followUps,
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
      max_tokens: 512,
      system: systemContent,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    let message = textContent?.type === 'text' ? textContent.text : 'I apologize, but I was unable to generate a response.';
    
    // Add follow-up suggestions for LLM responses too
    if (lastUserMessage) {
      message += getFollowUpSuggestions(lastUserMessage.content);
    }

    return {
      success: true,
      message,
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
      max_tokens: 512,
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
