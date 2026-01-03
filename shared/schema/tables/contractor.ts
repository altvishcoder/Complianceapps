import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { severityEnum, actionStatusEnum } from './base';

export const contractorStatusEnum = pgEnum('contractor_status', ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);

export const contractorRegistrationTypeEnum = pgEnum('contractor_registration_type', [
  'GAS_SAFE',
  'NICEIC',
  'NAPIT',
  'ELECSA',
  'ECS',
  'OFTEC',
  'HETAS',
  'BESCA',
  'FENSA',
  'CHAS',
  'SAFE_CONTRACTOR',
  'CONSTRUCTIONLINE',
  'CIOB',
  'PAS_8672',
  'SSIP',
  'OTHER'
]);

export const contractorVerificationStatusEnum = pgEnum('contractor_verification_status', [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'EXPIRED',
  'SUSPENDED',
  'REVOKED',
  'FAILED'
]);

export const contractorWorkCategoryEnum = pgEnum('contractor_work_category', [
  'GAS_BOILER',
  'GAS_APPLIANCES',
  'GAS_FIRES',
  'ELECTRICAL_INSTALL',
  'ELECTRICAL_TEST',
  'FIRE_ALARM',
  'FIRE_DOOR',
  'FIRE_EXTINGUISHER',
  'LIFT_MAINTENANCE',
  'LEGIONELLA',
  'ASBESTOS_SURVEY',
  'ASBESTOS_REMOVAL',
  'WATER_HYGIENE',
  'EPC_ASSESSMENT',
  'GENERAL_MAINTENANCE',
  'ROOFING',
  'PLUMBING',
  'OTHER'
]);

export const slaPriorityEnum = pgEnum('sla_priority', [
  'EMERGENCY',
  'URGENT',
  'HIGH',
  'STANDARD',
  'LOW'
]);

export const slaComplianceStatusEnum = pgEnum('sla_compliance_status', [
  'ON_TRACK',
  'AT_RISK',
  'BREACHED',
  'COMPLETED',
  'COMPLETED_LATE'
]);

export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
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
  contractorId: varchar("contractor_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  registrationType: contractorRegistrationTypeEnum("registration_type").notNull(),
  registrationNumber: text("registration_number").notNull(),
  registrationName: text("registration_name"),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  verificationStatus: contractorVerificationStatusEnum("verification_status").notNull().default('UNVERIFIED'),
  verifiedAt: timestamp("verified_at"),
  verifiedById: varchar("verified_by_id"),
  verificationMethod: text("verification_method"),
  verificationNotes: text("verification_notes"),
  workCategories: text("work_categories").array(),
  documentUrl: text("document_url"),
  documentId: varchar("document_id"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorVerificationHistory = pgTable("contractor_verification_history", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractorId: varchar("contractor_id").notNull(),
  certificationId: varchar("certification_id"),
  organisationId: varchar("organisation_id").notNull(),
  verificationType: text("verification_type").notNull(),
  previousStatus: contractorVerificationStatusEnum("previous_status"),
  newStatus: contractorVerificationStatusEnum("new_status").notNull(),
  verifiedById: varchar("verified_by_id"),
  verifiedByName: text("verified_by_name"),
  verificationMethod: text("verification_method").notNull(),
  lookupUrl: text("lookup_url"),
  screenshotUrl: text("screenshot_url"),
  notes: text("notes"),
  registrationDataSnapshot: json("registration_data_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractorAlerts = pgTable("contractor_alerts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  certificationId: varchar("certification_id"),
  alertType: text("alert_type").notNull(),
  severity: severityEnum("severity").notNull().default('PRIORITY'),
  status: text("status").notNull().default('OPEN'),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours"),
  acknowledgedById: varchar("acknowledged_by_id"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedById: varchar("resolved_by_id"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorAssignments = pgTable("contractor_assignments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  propertyId: varchar("property_id"),
  remedialActionId: varchar("remedial_action_id"),
  workCategory: contractorWorkCategoryEnum("work_category").notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  status: actionStatusEnum("status").notNull().default('OPEN'),
  verifiedCertificationsAtAssignment: text("verified_certifications").array(),
  assignedById: varchar("assigned_by_id"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorSLAProfiles = pgTable("contractor_sla_profiles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  workCategory: contractorWorkCategoryEnum("work_category").notNull(),
  priority: slaPriorityEnum("priority").notNull(),
  responseTimeHours: integer("response_time_hours").notNull(),
  completionTimeHours: integer("completion_time_hours").notNull(),
  penaltyPercentage: integer("penalty_percentage").default(0),
  bonusPercentage: integer("bonus_percentage").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorJobPerformance = pgTable("contractor_job_performance", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  assignmentId: varchar("assignment_id"),
  slaProfileId: varchar("sla_profile_id"),
  priority: slaPriorityEnum("priority").notNull(),
  assignedAt: timestamp("assigned_at").notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  slaDeadline: timestamp("sla_deadline").notNull(),
  responseDeadline: timestamp("response_deadline"),
  slaStatus: slaComplianceStatusEnum("sla_status").notNull().default('ON_TRACK'),
  responseTimeMinutes: integer("response_time_minutes"),
  completionTimeMinutes: integer("completion_time_minutes"),
  slaBreachMinutes: integer("sla_breach_minutes"),
  firstTimeFixRate: boolean("first_time_fix"),
  returnVisitRequired: boolean("return_visit_required").default(false),
  defectsRaised: integer("defects_raised").default(0),
  notes: text("notes"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractorRatings = pgTable("contractor_ratings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  contractorId: varchar("contractor_id").notNull(),
  jobPerformanceId: varchar("job_performance_id"),
  ratedById: varchar("rated_by_id"),
  overallRating: integer("overall_rating").notNull(),
  qualityRating: integer("quality_rating"),
  timelinessRating: integer("timeliness_rating"),
  communicationRating: integer("communication_rating"),
  safetyRating: integer("safety_rating"),
  feedback: text("feedback"),
  wouldRecommend: boolean("would_recommend"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
