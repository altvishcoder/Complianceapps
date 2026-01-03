import { pgTable, text, varchar, timestamp, boolean, integer, json, real, pgEnum } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { properties } from "./org-structure";
import { remedialActions } from "./compliance";

export const contractorStatusEnum = pgEnum('contractor_status', ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);

export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  companyName: text("company_name").notNull(),
  tradeType: text("trade_type").notNull(),
  registrationNumber: text("registration_number"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  gasRegistration: text("gas_registration"),
  electricalRegistration: text("electrical_registration"),
  status: contractorStatusEnum("status").notNull().default('PENDING'),
  isInternal: boolean("is_internal").notNull().default(false),
  employeeId: text("employee_id"),
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const contractorCertifications = pgTable("contractor_certifications", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  certificationType: text("certification_type").notNull(),
  certificationNumber: text("certification_number"),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedById: varchar("verified_by_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  documentKey: text("document_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorVerificationHistory = pgTable("contractor_verification_history", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  action: text("action").notNull(),
  previousStatus: contractorStatusEnum("previous_status"),
  newStatus: contractorStatusEnum("new_status"),
  notes: text("notes"),
  performedById: varchar("performed_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractorAlerts = pgTable("contractor_alerts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  alertType: text("alert_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readById: varchar("read_by_id").references(() => users.id),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractorAssignments = pgTable("contractor_assignments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  remedialActionId: varchar("remedial_action_id").references(() => remedialActions.id),
  assignmentType: text("assignment_type").notNull(),
  status: text("status").notNull().default('PENDING'),
  priority: text("priority").notNull().default('MEDIUM'),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  assignedById: varchar("assigned_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorSLAProfiles = pgTable("contractor_sla_profiles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  workType: text("work_type").notNull(),
  responseTimeHours: integer("response_time_hours").notNull(),
  completionTimeHours: integer("completion_time_hours").notNull(),
  priorityMultiplier: json("priority_multiplier"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorJobPerformance = pgTable("contractor_job_performance", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: varchar("assignment_id").references(() => contractorAssignments.id).notNull(),
  responseTimeHours: real("response_time_hours"),
  completionTimeHours: real("completion_time_hours"),
  slaResponseMet: boolean("sla_response_met"),
  slaCompletionMet: boolean("sla_completion_met"),
  qualityScore: integer("quality_score"),
  issuesReported: integer("issues_reported").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractorRatings = pgTable("contractor_ratings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  contractorId: varchar("contractor_id").references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: varchar("assignment_id"),
  overallRating: integer("overall_rating").notNull(),
  qualityRating: integer("quality_rating"),
  communicationRating: integer("communication_rating"),
  timelinessRating: integer("timeliness_rating"),
  valueRating: integer("value_rating"),
  comments: text("comments"),
  ratedById: varchar("rated_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = Omit<Contractor, 'id' | 'createdAt' | 'updatedAt'>;
export type ContractorCertification = typeof contractorCertifications.$inferSelect;
export type InsertContractorCertification = Omit<ContractorCertification, 'id' | 'createdAt' | 'updatedAt'>;
export type ContractorVerificationHistory = typeof contractorVerificationHistory.$inferSelect;
export type InsertContractorVerificationHistory = Omit<ContractorVerificationHistory, 'id' | 'createdAt'>;
export type ContractorAlert = typeof contractorAlerts.$inferSelect;
export type InsertContractorAlert = Omit<ContractorAlert, 'id' | 'createdAt'>;
export type ContractorAssignment = typeof contractorAssignments.$inferSelect;
export type InsertContractorAssignment = Omit<ContractorAssignment, 'id' | 'createdAt' | 'updatedAt'>;
export type ContractorSLAProfile = typeof contractorSLAProfiles.$inferSelect;
export type InsertContractorSLAProfile = Omit<ContractorSLAProfile, 'id' | 'createdAt' | 'updatedAt'>;
export type ContractorJobPerformance = typeof contractorJobPerformance.$inferSelect;
export type InsertContractorJobPerformance = Omit<ContractorJobPerformance, 'id' | 'createdAt'>;
export type ContractorRating = typeof contractorRatings.$inferSelect;
export type InsertContractorRating = Omit<ContractorRating, 'id' | 'createdAt'>;
