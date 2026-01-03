import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { chatIntentEnum, chatResponseSourceEnum } from './base';

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "ACTIVE",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
  "AUTO_RESOLVED"
]);

export const suggestionCategoryEnum = pgEnum("suggestion_category", [
  "PROMPT",
  "PREPROCESSING",
  "VALIDATION",
  "TRAINING",
  "QUALITY",
  "REVIEW"
]);

export const chatbotConversations = pgTable("chatbot_conversations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id"),
  sessionId: text("session_id").notNull(),
  title: text("title"),
  messageCount: integer("message_count").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatbotMessages = pgTable("chatbot_messages", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  intent: chatIntentEnum("intent"),
  responseSource: chatResponseSourceEnum("response_source"),
  confidence: real("confidence"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  responseTimeMs: integer("response_time_ms"),
  ragDocumentsUsed: json("rag_documents_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatbotAnalytics = pgTable("chatbot_analytics", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: text("date").notNull(),
  hour: integer("hour"),
  totalQueries: integer("total_queries").notNull().default(0),
  staticResponses: integer("static_responses").notNull().default(0),
  faqHits: integer("faq_hits").notNull().default(0),
  databaseQueries: integer("database_queries").notNull().default(0),
  ragQueries: integer("rag_queries").notNull().default(0),
  llmQueries: integer("llm_queries").notNull().default(0),
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
  avgResponseTimeMs: integer("avg_response_time_ms"),
  topIntents: json("top_intents"),
  topTopics: json("top_topics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeEmbeddings = pgTable("knowledge_embeddings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  metadata: json("metadata"),
  embeddingModel: text("embedding_model").notNull(),
  embedding: text("embedding"),
  riskScore: real("risk_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiSuggestions = pgTable("ai_suggestions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  suggestionKey: text("suggestion_key").notNull(),
  category: suggestionCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  impact: text("impact").notNull(),
  effort: text("effort").notNull(),
  actionable: boolean("actionable").default(true),
  actionLabel: text("action_label"),
  actionRoute: text("action_route"),
  status: suggestionStatusEnum("status").notNull().default("ACTIVE"),
  currentValue: integer("current_value"),
  targetValue: integer("target_value"),
  progressPercent: integer("progress_percent").default(0),
  snapshotMetrics: json("snapshot_metrics"),
  actionedAt: timestamp("actioned_at"),
  actionedById: varchar("actioned_by_id"),
  resolvedAt: timestamp("resolved_at"),
  dismissedAt: timestamp("dismissed_at"),
  dismissReason: text("dismiss_reason"),
  autoResolveCondition: text("auto_resolve_condition"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const faqCache = pgTable("faq_cache", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"),
  keywords: text("keywords").array(),
  hitCount: integer("hit_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
