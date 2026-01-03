import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { properties } from "./org-structure";
import { certificates, remedialActions } from "./compliance";

export const ukhdsExportStatusEnum = pgEnum('ukhds_export_status', [
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'
]);
export const calendarEventTypeEnum = pgEnum('calendar_event_type', [
  'LEGISLATIVE', 'COMPANY_WIDE', 'STREAM_TASK', 'CERTIFICATE_EXPIRY', 'REMEDIAL_DUE', 'INSPECTION'
]);
export const calendarEventRecurrenceEnum = pgEnum('calendar_event_recurrence', [
  'NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'
]);
export const reportFrequencyEnum = pgEnum('report_frequency', ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);
export const reportFormatEnum = pgEnum('report_format', ['PDF', 'CSV', 'EXCEL']);

export const ukhdsExports = pgTable("ukhds_exports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  requestedById: varchar("requested_by_id").references(() => users.id).notNull(),
  exportType: text("export_type").notNull().default('FULL'),
  exportFormat: text("export_format").notNull().default('JSON'),
  status: ukhdsExportStatusEnum("status").notNull().default('PENDING'),
  includeProperties: boolean("include_properties").notNull().default(true),
  includeComponents: boolean("include_components").notNull().default(true),
  includeCertificates: boolean("include_certificates").notNull().default(true),
  includeCertificateVersions: boolean("include_certificate_versions").notNull().default(true),
  includeAuditTrail: boolean("include_audit_trail").notNull().default(true),
  includeRemedialActions: boolean("include_remedial_actions").notNull().default(true),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  schemeIds: text("scheme_ids").array(),
  totalRecords: integer("total_records"),
  processedRecords: integer("processed_records").default(0),
  storageKey: text("storage_key"),
  downloadUrl: text("download_url"),
  expiresAt: timestamp("expires_at"),
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const complianceCalendarEvents = pgTable("compliance_calendar_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: calendarEventTypeEnum("event_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  recurrence: calendarEventRecurrenceEnum("recurrence").notNull().default('NONE'),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id").references(() => certificates.id),
  remedialActionId: varchar("remedial_action_id").references(() => remedialActions.id),
  reminderDaysBefore: integer("reminder_days_before").default(7),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  legislationReference: text("legislation_reference"),
  priority: text("priority").notNull().default('MEDIUM'),
  colour: text("colour").default('#3B82F6'),
  createdById: varchar("created_by_id").references(() => users.id),
  isSystemGenerated: boolean("is_system_generated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  name: text("name").notNull(),
  templateId: varchar("template_id"),
  templateName: text("template_name").notNull(),
  frequency: reportFrequencyEnum("frequency").notNull(),
  cronExpression: text("cron_expression"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  format: reportFormatEnum("format").notNull().default('PDF'),
  recipients: text("recipients").array().default([]),
  filters: json("filters"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  name: text("name").notNull(),
  description: text("description"),
  sections: text("sections").array().default([]),
  defaultFilters: json("default_filters"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const generatedReports = pgTable("generated_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduledReportId: varchar("scheduled_report_id").references(() => scheduledReports.id),
  organisationId: varchar("organisation_id").references(() => organisations.id),
  name: text("name").notNull(),
  format: reportFormatEnum("format").notNull(),
  storageKey: text("storage_key"),
  downloadUrl: text("download_url"),
  recordCount: integer("record_count"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UkhdsExport = typeof ukhdsExports.$inferSelect;
export type InsertUkhdsExport = Omit<UkhdsExport, 'id' | 'createdAt'>;
export type ComplianceCalendarEvent = typeof complianceCalendarEvents.$inferSelect;
export type InsertComplianceCalendarEvent = Omit<ComplianceCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt'>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = Omit<GeneratedReport, 'id' | 'createdAt' | 'generatedAt'>;
