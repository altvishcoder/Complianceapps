import Anthropic from "@anthropic-ai/sdk";
import { logger } from '../logger';
import { db } from '../db';
import { properties, certificates, remedialActions } from '@shared/schema';
import { count } from 'drizzle-orm';

const anthropic = new Anthropic();

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
