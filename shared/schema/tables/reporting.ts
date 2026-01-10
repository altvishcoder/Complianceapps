import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";

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
  organisationId: varchar("organisation_id").notNull(),
  requestedById: varchar("requested_by_id").notNull(),
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
  organisationId: varchar("organisation_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: calendarEventTypeEnum("event_type").notNull(),
  complianceStreamId: varchar("compliance_stream_id"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").notNull().default(true),
  recurrence: calendarEventRecurrenceEnum("recurrence").notNull().default('NONE'),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  propertyId: varchar("property_id"),
  certificateId: varchar("certificate_id"),
  remedialActionId: varchar("remedial_action_id"),
  reminderDaysBefore: integer("reminder_days_before").default(7),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  legislationReference: text("legislation_reference"),
  priority: text("priority").notNull().default('MEDIUM'),
  colour: text("colour").default('#3B82F6'),
  createdById: varchar("created_by_id"),
  isSystemGenerated: boolean("is_system_generated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  templateId: varchar("template_id"),
  templateName: text("template_name").notNull(),
  frequency: reportFrequencyEnum("frequency").notNull(),
  cronExpression: text("cron_expression"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  format: reportFormatEnum("format").notNull().default('PDF'),
  recipients: text("recipients").array().default([]),
  filters: json("filters").$type<{
    dateRangeType?: string;
    complianceStreamId?: string;
    schemeIds?: string[];
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id"),
  name: text("name").notNull(),
  description: text("description"),
  sections: text("sections").array().default([]),
  defaultFilters: json("default_filters").$type<{
    dateRangeType?: string;
    complianceStreamId?: string;
  }>(),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const generatedReports = pgTable("generated_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  templateId: varchar("template_id"),
  scheduledReportId: varchar("scheduled_report_id"),
  format: reportFormatEnum("format").notNull().default('PDF'),
  storageKey: text("storage_key"),
  fileSize: integer("file_size"),
  filters: json("filters"),
  status: text("status").notNull().default('READY'),
  generatedById: varchar("generated_by_id"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const widgetTypeEnum = pgEnum('widget_type', [
  'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'TREEMAP', 'TABLE', 'STAT_CARD', 'GAUGE', 'HEATMAP', 'TIMELINE'
]);

export const reportCanvases = pgTable("report_canvases", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id"),
  name: text("name").notNull(),
  description: text("description"),
  gridCols: integer("grid_cols").notNull().default(12),
  gridRows: integer("grid_rows").notNull().default(8),
  refreshIntervalMs: integer("refresh_interval_ms"),
  globalFilters: json("global_filters").$type<{
    dateRangeType?: string;
    complianceStreamId?: string;
    schemeIds?: string[];
  }>(),
  isPublic: boolean("is_public").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdById: varchar("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const canvasWidgets = pgTable("canvas_widgets", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  canvasId: varchar("canvas_id").notNull(),
  widgetType: widgetTypeEnum("widget_type").notNull(),
  title: text("title").notNull(),
  dataSource: text("data_source").notNull(),
  gridX: integer("grid_x").notNull().default(0),
  gridY: integer("grid_y").notNull().default(0),
  gridW: integer("grid_w").notNull().default(4),
  gridH: integer("grid_h").notNull().default(4),
  config: json("config").$type<{
    groupBy?: string;
    colorField?: string;
    valueField?: string;
    labelField?: string;
    showLegend?: boolean;
    maxItems?: number;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, unknown>;
    chartOptions?: Record<string, unknown>;
  }>(),
  displayOrder: integer("display_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navigationSections = pgTable("navigation_sections", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  iconKey: text("icon_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  defaultOpen: boolean("default_open").notNull().default(false),
  requiresRole: text("requires_role"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navigationItems = pgTable("navigation_items", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sectionId: varchar("section_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  href: text("href").notNull(),
  iconKey: text("icon_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  requiresAdmin: boolean("requires_admin").notNull().default(false),
  requiresFactorySettings: boolean("requires_factory_settings").notNull().default(false),
  requiresAITools: boolean("requires_ai_tools").notNull().default(false),
  requiresRole: text("requires_role"),
  featureFlagKey: text("feature_flag_key"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const navigationItemRoles = pgTable("navigation_item_roles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  navigationItemId: varchar("navigation_item_id").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const iconRegistry = pgTable("icon_registry", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  iconKey: text("icon_key").notNull().unique(),
  lucideName: text("lucide_name").notNull(),
  customSvg: text("custom_svg"),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
