import { pgTable, text, varchar, timestamp, boolean, integer, json, real, pgEnum } from "drizzle-orm/pg-core";
import { organisations } from "./core-auth";
import { properties } from "./org-structure";

export const riskLevelEnum = pgEnum('risk_level', ['property', 'block', 'scheme', 'ward', 'organisation']);
export const riskTrendEnum = pgEnum('risk_trend', ['improving', 'stable', 'deteriorating']);
export const riskTierEnum = pgEnum('risk_tier', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const riskFactorTypeEnum = pgEnum('risk_factor_type', [
  'EXPIRY_RISK', 'DEFECT_RISK', 'ASSET_PROFILE_RISK', 'COVERAGE_GAP_RISK', 'EXTERNAL_FACTOR_RISK'
]);
export const riskAlertStatusEnum = pgEnum('risk_alert_status', ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'DISMISSED']);

export const riskSnapshots = pgTable("risk_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  level: riskLevelEnum("level").notNull(),
  levelId: varchar("level_id").notNull(),
  levelName: text("level_name"),
  compositeScore: real("composite_score").notNull(),
  gasScore: real("gas_score"),
  electricalScore: real("electrical_score"),
  fireScore: real("fire_score"),
  asbestosScore: real("asbestos_score"),
  liftScore: real("lift_score"),
  waterScore: real("water_score"),
  criticalDefects: integer("critical_defects").notNull().default(0),
  majorDefects: integer("major_defects").notNull().default(0),
  minorDefects: integer("minor_defects").notNull().default(0),
  propertyCount: integer("property_count").notNull().default(0),
  unitCount: integer("unit_count").notNull().default(0),
  previousScore: real("previous_score"),
  trend: riskTrendEnum("trend"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export const propertyRiskSnapshots = pgTable("property_risk_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  overallScore: integer("overall_score").notNull().default(0),
  riskTier: riskTierEnum("risk_tier").notNull().default('LOW'),
  expiryRiskScore: integer("expiry_risk_score").notNull().default(0),
  defectRiskScore: integer("defect_risk_score").notNull().default(0),
  assetProfileRiskScore: integer("asset_profile_risk_score").notNull().default(0),
  coverageGapRiskScore: integer("coverage_gap_risk_score").notNull().default(0),
  externalFactorRiskScore: integer("external_factor_risk_score").notNull().default(0),
  factorBreakdown: json("factor_breakdown"),
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
  organisationId: varchar("organisation_id").references(() => organisations.id),
  factorType: riskFactorTypeEnum("factor_type").notNull(),
  factorName: text("factor_name").notNull(),
  description: text("description"),
  weight: integer("weight").notNull().default(20),
  maxScore: integer("max_score").notNull().default(100),
  thresholds: json("thresholds"),
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
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  alertType: text("alert_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  status: riskAlertStatusEnum("status").notNull().default('OPEN'),
  acknowledgedById: varchar("acknowledged_by_id"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RiskSnapshot = typeof riskSnapshots.$inferSelect;
export type InsertRiskSnapshot = Omit<RiskSnapshot, 'id' | 'calculatedAt'>;
export type PropertyRiskSnapshot = typeof propertyRiskSnapshots.$inferSelect;
export type InsertPropertyRiskSnapshot = Omit<PropertyRiskSnapshot, 'id' | 'createdAt' | 'calculatedAt' | 'snapshotDate'>;
export type RiskFactorDefinition = typeof riskFactorDefinitions.$inferSelect;
export type InsertRiskFactorDefinition = Omit<RiskFactorDefinition, 'id' | 'createdAt' | 'updatedAt'>;
export type RiskAlert = typeof riskAlerts.$inferSelect;
export type InsertRiskAlert = Omit<RiskAlert, 'id' | 'createdAt'>;
