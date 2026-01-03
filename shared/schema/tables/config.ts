import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";

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
  complianceStream: text("compliance_stream").notNull(),
  streamId: varchar("stream_id"),
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
  certificateTypeId: varchar("certificate_type_id"),
  complianceStreamId: varchar("compliance_stream_id"),
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
  certificateTypeId: varchar("certificate_type_id"),
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
  certificateTypeId: varchar("certificate_type_id"),
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
  complianceStreamId: varchar("compliance_stream_id"),
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
  complianceStreamId: varchar("compliance_stream_id"),
  inputPatterns: text("input_patterns").array(),
  outputValue: text("output_value"),
  transformFn: text("transform_fn"),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
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
  updatedById: varchar("updated_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const factorySettingsAudit = pgTable("factory_settings_audit", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  settingId: varchar("setting_id").notNull(),
  key: text("key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedById: varchar("changed_by_id").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
