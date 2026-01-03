import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { certificates } from "./compliance";

export const detectionPatternTypeEnum = pgEnum('detection_pattern_type', ['FILENAME', 'TEXT_CONTENT']);
export const detectionMatcherTypeEnum = pgEnum('detection_matcher_type', ['CONTAINS', 'REGEX', 'STARTS_WITH', 'ENDS_WITH']);

export const outcomeRuleOperatorEnum = pgEnum('outcome_rule_operator', [
  'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 
  'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL',
  'IS_TRUE', 'IS_FALSE', 'IS_NULL', 'IS_NOT_NULL',
  'IN_LIST', 'NOT_IN_LIST', 'REGEX_MATCH',
  'ARRAY_ANY_MATCH', 'ARRAY_ALL_MATCH'
]);

export const complianceStreams = pgTable("compliance_streams", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  colorCode: text("color_code"),
  iconName: text("icon_name"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateTypes = pgTable("certificate_types", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  complianceStream: text("compliance_stream").notNull(), // Legacy text code for backward compatibility
  streamId: varchar("stream_id").references(() => complianceStreams.id), // FK to compliance_streams (preferred)
  description: text("description"),
  validityMonths: integer("validity_months").notNull().default(12),
  warningDays: integer("warning_days").notNull().default(30),
  requiredFields: text("required_fields").array(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const classificationCodes = pgTable("classification_codes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull(),
  name: text("name").notNull(),
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  complianceStreamId: varchar("compliance_stream_id").references(() => complianceStreams.id),
  severity: text("severity").notNull(),
  colorCode: text("color_code"),
  description: text("description").notNull(),
  actionRequired: text("action_required"),
  timeframeHours: integer("timeframe_hours"),
  autoCreateAction: boolean("auto_create_action").notNull().default(true),
  actionSeverity: text("action_severity"),
  costEstimateLow: integer("cost_estimate_low"),
  costEstimateHigh: integer("cost_estimate_high"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateDetectionPatterns = pgTable("certificate_detection_patterns", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  certificateTypeCode: text("certificate_type_code").notNull(),
  patternType: detectionPatternTypeEnum("pattern_type").notNull(),
  matcherType: detectionMatcherTypeEnum("matcher_type").notNull().default('CONTAINS'),
  pattern: text("pattern").notNull(),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  additionalPatterns: text("additional_patterns").array(),
  priority: integer("priority").notNull().default(0),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateOutcomeRules = pgTable("certificate_outcome_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateTypeId: varchar("certificate_type_id").references(() => certificateTypes.id),
  certificateTypeCode: text("certificate_type_code").notNull(),
  ruleName: text("rule_name").notNull(),
  ruleGroup: text("rule_group"),
  fieldPath: text("field_path").notNull(),
  operator: outcomeRuleOperatorEnum("operator").notNull(),
  value: text("value"),
  valueList: text("value_list").array(),
  arrayFieldPath: text("array_field_path"),
  arrayMatchPatterns: text("array_match_patterns").array(),
  outcome: text("outcome").notNull().default('UNSATISFACTORY'),
  priority: integer("priority").notNull().default(0),
  stopOnMatch: boolean("stop_on_match").notNull().default(true),
  description: text("description"),
  legislation: text("legislation"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complianceRules = pgTable("compliance_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleCode: text("rule_code").notNull().unique(),
  ruleName: text("rule_name").notNull(),
  documentType: text("document_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id").references(() => complianceStreams.id),
  conditions: json("conditions").notNull(),
  conditionLogic: text("condition_logic").notNull().default("AND"),
  action: text("action").notNull(),
  priority: text("priority"),
  description: text("description").notNull(),
  legislation: text("legislation"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const normalisationRules = pgTable("normalisation_rules", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleName: text("rule_name").notNull(),
  fieldPath: text("field_path").notNull(),
  ruleType: text("rule_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id").references(() => complianceStreams.id),
  inputPatterns: text("input_patterns").array(),
  outputValue: text("output_value"),
  transformFn: text("transform_fn"),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const extractionSchemas = pgTable("extraction_schemas", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  version: text("version").notNull(),
  documentType: text("document_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id").references(() => complianceStreams.id),
  schemaJson: json("schema_json").notNull(),
  promptTemplate: text("prompt_template"),
  isActive: boolean("is_active").notNull().default(false),
  isDeprecated: boolean("is_deprecated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const factorySettings = pgTable("factory_settings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  valueType: text("value_type").notNull().default('string'),
  category: text("category").notNull().default('general'),
  isEditable: boolean("is_editable").notNull().default(true),
  validationRules: json("validation_rules"),
  updatedById: varchar("updated_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const factorySettingsAudit = pgTable("factory_settings_audit", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  settingId: varchar("setting_id").references(() => factorySettings.id, { onDelete: 'cascade' }).notNull(),
  key: text("key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedById: varchar("changed_by_id").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const autoApprovalThresholds = pgTable("auto_approval_thresholds", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  certificateType: text("certificate_type").notNull(),
  fieldName: text("field_name"),
  minConfidenceThreshold: real("min_confidence_threshold").notNull().default(0.9),
  requiredSampleSize: integer("required_sample_size").notNull().default(100),
  currentSampleSize: integer("current_sample_size").notNull().default(0),
  currentAccuracy: real("current_accuracy"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const confidenceBaselines = pgTable("confidence_baselines", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateType: text("certificate_type").notNull(),
  fieldName: text("field_name").notNull(),
  sampleCount: integer("sample_count").notNull().default(0),
  avgConfidence: real("avg_confidence").notNull().default(0),
  medianConfidence: real("median_confidence"),
  correctionCount: integer("correction_count").notNull().default(0),
  accuracyRate: real("accuracy_rate"),
  recommendedThreshold: real("recommended_threshold"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const benchmarkSets = pgTable("benchmark_sets", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  documentTypes: text("document_types").array(),
  isLocked: boolean("is_locked").notNull().default(false),
  itemCount: integer("item_count").notNull().default(0),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const benchmarkItems = pgTable("benchmark_items", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  benchmarkSetId: varchar("benchmark_set_id").references(() => benchmarkSets.id, { onDelete: 'cascade' }).notNull(),
  certificateId: varchar("certificate_id").references(() => certificates.id).notNull(),
  expectedOutput: json("expected_output").notNull(),
  difficulty: text("difficulty").notNull().default("medium"),
  challengeTypes: text("challenge_types").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evalRuns = pgTable("eval_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  benchmarkSetId: varchar("benchmark_set_id").references(() => benchmarkSets.id).notNull(),
  modelVersion: text("model_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  overallScore: real("overall_score").notNull(),
  exactMatchRate: real("exact_match_rate").notNull(),
  evidenceAccuracy: real("evidence_accuracy").notNull(),
  schemaValidRate: real("schema_valid_rate").notNull(),
  scores: json("scores").notNull(),
  itemResults: json("item_results").notNull(),
  previousRunId: varchar("previous_run_id"),
  regressions: json("regressions").notNull().default([]),
  improvements: json("improvements").notNull().default([]),
  scoreDelta: real("score_delta"),
  passedGating: boolean("passed_gating"),
  gatingNotes: text("gating_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ComplianceStream = typeof complianceStreams.$inferSelect;
export type InsertComplianceStream = Omit<ComplianceStream, 'id' | 'createdAt' | 'updatedAt'>;
export type CertificateType = typeof certificateTypes.$inferSelect;
export type InsertCertificateType = Omit<CertificateType, 'id' | 'createdAt' | 'updatedAt'>;
export type ClassificationCode = typeof classificationCodes.$inferSelect;
export type InsertClassificationCode = Omit<ClassificationCode, 'id' | 'createdAt' | 'updatedAt'>;
export type CertificateDetectionPattern = typeof certificateDetectionPatterns.$inferSelect;
export type InsertCertificateDetectionPattern = Omit<CertificateDetectionPattern, 'id' | 'createdAt' | 'updatedAt'>;
export type CertificateOutcomeRule = typeof certificateOutcomeRules.$inferSelect;
export type InsertCertificateOutcomeRule = Omit<CertificateOutcomeRule, 'id' | 'createdAt' | 'updatedAt'>;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = Omit<ComplianceRule, 'id' | 'createdAt' | 'updatedAt'>;
export type NormalisationRule = typeof normalisationRules.$inferSelect;
export type InsertNormalisationRule = Omit<NormalisationRule, 'id' | 'createdAt' | 'updatedAt'>;
export type ExtractionSchema = typeof extractionSchemas.$inferSelect;
export type InsertExtractionSchema = Omit<ExtractionSchema, 'id' | 'createdAt' | 'updatedAt'>;
export type FactorySetting = typeof factorySettings.$inferSelect;
export type InsertFactorySetting = Omit<FactorySetting, 'id' | 'createdAt' | 'updatedAt'>;
export type FactorySettingsAuditEntry = typeof factorySettingsAudit.$inferSelect;
export type InsertFactorySettingsAuditEntry = Omit<FactorySettingsAuditEntry, 'id' | 'changedAt' | 'createdAt' | 'updatedAt'>;
export type AutoApprovalThreshold = typeof autoApprovalThresholds.$inferSelect;
export type InsertAutoApprovalThreshold = Omit<AutoApprovalThreshold, 'id' | 'createdAt' | 'updatedAt'>;
export type ConfidenceBaseline = typeof confidenceBaselines.$inferSelect;
export type InsertConfidenceBaseline = Omit<ConfidenceBaseline, 'id' | 'createdAt' | 'updatedAt'>;
export type BenchmarkSet = typeof benchmarkSets.$inferSelect;
export type InsertBenchmarkSet = Omit<BenchmarkSet, 'id' | 'createdAt' | 'updatedAt'>;
export type BenchmarkItem = typeof benchmarkItems.$inferSelect;
export type InsertBenchmarkItem = Omit<BenchmarkItem, 'id' | 'createdAt' | 'updatedAt'>;
export type EvalRun = typeof evalRuns.$inferSelect;
export type InsertEvalRun = Omit<EvalRun, 'id' | 'createdAt' | 'updatedAt'>;
