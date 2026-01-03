import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";

export const riskTierEnum = pgEnum('risk_tier', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const riskFactorTypeEnum = pgEnum('risk_factor_type', [
  'EXPIRY_RISK',
  'DEFECT_RISK', 
  'ASSET_PROFILE_RISK',
  'COVERAGE_GAP_RISK',
  'EXTERNAL_FACTOR_RISK'
]);
export const riskAlertStatusEnum = pgEnum('risk_alert_status', ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'DISMISSED']);

export const propertyRiskSnapshots = pgTable("property_risk_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  overallScore: integer("overall_score").notNull().default(0),
  riskTier: riskTierEnum("risk_tier").notNull().default('LOW'),
  expiryRiskScore: integer("expiry_risk_score").notNull().default(0),
  defectRiskScore: integer("defect_risk_score").notNull().default(0),
  assetProfileRiskScore: integer("asset_profile_risk_score").notNull().default(0),
  coverageGapRiskScore: integer("coverage_gap_risk_score").notNull().default(0),
  externalFactorRiskScore: integer("external_factor_risk_score").notNull().default(0),
  factorBreakdown: json("factor_breakdown").$type<{
    expiringCertificates: number;
    overdueCertificates: number;
    openDefects: number;
    criticalDefects: number;
    missingStreams: string[];
    assetAge: number | null;
    isHRB: boolean;
    hasVulnerableOccupants: boolean;
    epcRating: string | null;
  }>(),
  triggeringFactors: text("triggering_factors").array(),
  recommendedActions: text("recommended_actions").array(),
  legislationReferences: text("legislation_references").array(),
  previousScore: integer("previous_score"),
  scoreChange: integer("score_change"),
  trendDirection: text("trend_direction"),
  isLatest: boolean("is_latest").notNull().default(true),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskFactorDefinitions = pgTable("risk_factor_definitions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id"),
  factorType: riskFactorTypeEnum("factor_type").notNull(),
  factorName: text("factor_name").notNull(),
  description: text("description"),
  weight: integer("weight").notNull().default(20),
  maxScore: integer("max_score").notNull().default(100),
  thresholds: json("thresholds").$type<{
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  }>(),
  calculationLogic: text("calculation_logic"),
  legislationReference: text("legislation_reference"),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  priority: integer("priority").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const riskAlerts = pgTable("risk_alerts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  snapshotId: varchar("snapshot_id"),
  alertType: text("alert_type").notNull(),
  riskTier: riskTierEnum("risk_tier").notNull(),
  status: riskAlertStatusEnum("status").notNull().default('OPEN'),
  title: text("title").notNull(),
  description: text("description").notNull(),
  triggeringFactors: text("triggering_factors").array(),
  riskScore: integer("risk_score").notNull(),
  previousScore: integer("previous_score"),
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  acknowledgedById: varchar("acknowledged_by_id"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedById: varchar("resolved_by_id"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  linkedRemedialActionIds: text("linked_remedial_action_ids").array(),
  linkedCertificateIds: text("linked_certificate_ids").array(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
