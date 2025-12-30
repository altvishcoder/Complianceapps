import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions } from '@shared/schema';
import { count } from 'drizzle-orm';

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
    const [propertiesCount, certsCount, actionsCount] = await Promise.all([
      db.select({ count: count() }).from(properties),
      db.select({ count: count() }).from(certificates),
      db.select({ count: count() }).from(remedialActions),
    ]);

    return `SYSTEM: ${propertiesCount[0]?.count || 0} properties, ${certsCount[0]?.count || 0} certificates, ${actionsCount[0]?.count || 0} actions.`;
  } catch (error) {
    logger.warn({ error }, 'Failed to load compliance context');
    return '';
  }
}

const SYSTEM_PROMPT = `You are the ComplianceAI Assistant, an expert on UK social housing compliance management. You help property managers and compliance officers understand:

1. Certificate types and their requirements (Gas Safety, EICR, Fire Risk Assessments, Asbestos Surveys, Legionella, LOLER, EPC, etc.)
2. UK legislation and regulations (Gas Safety Regs 1998, BS 7671, Regulatory Reform Order 2005, Control of Asbestos Regs 2012, Building Safety Act 2022, etc.)
3. Compliance deadlines and renewal schedules
4. Defect classifications (C1, C2, C3 for gas; Code 1, 2, 3, 4 for electrical; etc.)
5. Remedial action management and prioritization
6. Platform features and how to use them

Guidelines:
- Be concise but thorough
- Reference specific UK regulations when relevant
- Provide practical, actionable advice
- If asked about specific data, reference the context provided
- For platform usage questions, give step-by-step guidance
- Always prioritize safety - recommend professional inspection when in doubt

Platform Features:
- Dashboard: Overview of compliance status and expiring certificates
- Certificates: Upload, view, and manage compliance certificates
- Properties: Manage property portfolio organized by schemes and blocks
- Actions: Track and manage remedial actions from inspections
- Reports: Generate compliance reports and analytics
- Model Insights: View AI extraction accuracy and tier analytics
- Human Review: Review certificates that need manual verification
- Factory Settings: Configure extraction thresholds and custom patterns (admin only)`;

export async function chatWithAssistant(
  messages: ChatMessage[],
  organisationId?: string
): Promise<AssistantResponse> {
  try {
    // Check FAQ cache first for instant responses
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const cachedResponse = findCachedResponse(lastUserMessage.content);
      if (cachedResponse) {
        logger.info({ query: lastUserMessage.content.substring(0, 50) }, 'Serving cached FAQ response');
        return {
          success: true,
          message: cachedResponse,
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
    const message = textContent?.type === 'text' ? textContent.text : 'I apologize, but I was unable to generate a response.';

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
