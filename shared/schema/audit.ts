import { pgTable, text, varchar, timestamp, boolean, json, pgEnum } from "drizzle-orm/pg-core";
import { organisations } from "./core-auth";
import { properties } from "./org-structure";

export const auditActorTypeEnum = pgEnum('audit_actor_type', ['USER', 'SYSTEM', 'API']);
export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'CERTIFICATE_UPLOADED', 'CERTIFICATE_VERIFIED', 'CERTIFICATE_REJECTED', 'CERTIFICATE_DELETED',
  'EXTRACTION_COMPLETED', 'REMEDIAL_ACTION_CREATED', 'REMEDIAL_ACTION_UPDATED', 'REMEDIAL_ACTION_COMPLETED',
  'PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_DELETED', 'COMPONENT_CREATED', 'COMPONENT_UPDATED',
  'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_ROLE_CHANGED',
  'SETTINGS_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'BULK_IMPORT_COMPLETED'
]);
export const auditEntityTypeEnum = pgEnum('audit_entity_type', [
  'CERTIFICATE', 'PROPERTY', 'COMPONENT', 'REMEDIAL_ACTION', 'USER', 'ORGANISATION', 'API_KEY', 'SETTINGS'
]);
export const changeScopeEnum = pgEnum('change_scope', ['FIELD', 'RECORD', 'RELATIONSHIP']);

export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  actorType: auditActorTypeEnum("actor_type").notNull().default('USER'),
  eventType: auditEventTypeEnum("event_type").notNull(),
  entityType: auditEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id"), // FK to certificates.id - defined at DB level to avoid circular import
  beforeState: json("before_state"),
  afterState: json("after_state"),
  changes: json("changes"),
  message: text("message").notNull(),
  metadata: json("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditFieldChanges = pgTable("audit_field_changes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  auditEventId: varchar("audit_event_id").references(() => auditEvents.id, { onDelete: 'cascade' }).notNull(),
  tableName: text("table_name").notNull(),
  recordId: varchar("record_id").notNull(),
  changeScope: changeScopeEnum("change_scope").notNull(),
  fieldName: text("field_name").notNull(),
  fieldLabel: text("field_label"),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  isSignificant: boolean("is_significant").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const logLevelEnum = pgEnum('log_level', ['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export const logSourceEnum = pgEnum('log_source', ['api', 'job-queue', 'extraction', 'webhook', 'http', 'system']);

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  level: logLevelEnum("level").notNull(),
  source: logSourceEnum("source").notNull().default('system'),
  message: text("message").notNull(),
  context: json("context"),
  requestId: text("request_id"),
  userId: varchar("user_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = Omit<AuditEvent, 'id' | 'createdAt'>;
export type AuditFieldChange = typeof auditFieldChanges.$inferSelect;
export type InsertAuditFieldChange = Omit<AuditFieldChange, 'id' | 'createdAt'>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = Omit<SystemLog, 'id'>;
