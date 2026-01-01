// ComplianceAI Storage Interface - implements database operations using Drizzle ORM
import { 
  users, organisations, schemes, blocks, properties, certificates, extractions, remedialActions, contractors,
  extractionRuns, humanReviews, complianceRules, normalisationRules, 
  benchmarkSets, benchmarkItems, evalRuns, extractionSchemas,
  complianceStreams, certificateTypes, classificationCodes,
  componentTypes, units, components, componentCertificates, dataImports, dataImportRows,
  apiLogs, apiMetrics, webhookEndpoints, webhookEvents, webhookDeliveries, incomingWebhookLogs, apiKeys,
  videos, aiSuggestions,
  factorySettings, factorySettingsAudit, apiClients, uploadSessions, ingestionJobs, rateLimitEntries,
  systemLogs, auditEvents,
  certificateDetectionPatterns, certificateOutcomeRules,
  contractorCertifications, contractorVerificationHistory, contractorAlerts, contractorAssignments,
  certificateVersions, auditFieldChanges, ukhdsExports, complianceCalendarEvents,
  type User, type InsertUser,
  type Organisation, type InsertOrganisation,
  type Scheme, type InsertScheme,
  type Block, type InsertBlock,
  type Property, type InsertProperty,
  type Certificate, type InsertCertificate,
  type Extraction, type InsertExtraction,
  type RemedialAction, type InsertRemedialAction,
  type Contractor, type InsertContractor,
  type ContractorCertification, type InsertContractorCertification,
  type ContractorVerificationHistory, type InsertContractorVerificationHistory,
  type ContractorAlert, type InsertContractorAlert,
  type ContractorAssignment, type InsertContractorAssignment,
  type ComplianceStream, type InsertComplianceStream,
  type CertificateType, type InsertCertificateType,
  type ClassificationCode, type InsertClassificationCode,
  type ExtractionSchema, type InsertExtractionSchema,
  type ComplianceRule, type InsertComplianceRule,
  type NormalisationRule, type InsertNormalisationRule,
  type ComponentType, type InsertComponentType,
  type Unit, type InsertUnit,
  type Component, type InsertComponent,
  type ComponentCertificate, type InsertComponentCertificate,
  type DataImport, type InsertDataImport,
  type DataImportRow, type InsertDataImportRow,
  type ApiLog, type InsertApiLog,
  type ApiMetric, type InsertApiMetric,
  type WebhookEndpoint, type InsertWebhookEndpoint,
  type WebhookEvent, type InsertWebhookEvent,
  type WebhookDelivery, type InsertWebhookDelivery,
  type IncomingWebhookLog, type InsertIncomingWebhookLog,
  type ApiKey, type InsertApiKey,
  type Video, type InsertVideo,
  type AiSuggestion, type InsertAiSuggestion,
  type FactorySetting, type InsertFactorySetting,
  type FactorySettingsAudit, type InsertFactorySettingsAudit,
  type ApiClient, type InsertApiClient,
  type UploadSession, type InsertUploadSession,
  type IngestionJob, type InsertIngestionJob,
  type SystemLog,
  type AuditEvent, type InsertAuditEvent,
  type DetectionPattern, type InsertDetectionPattern,
  type OutcomeRule, type InsertOutcomeRule,
  type CertificateVersion, type InsertCertificateVersion,
  type AuditFieldChange, type InsertAuditFieldChange,
  type UkhdsExport, type InsertUkhdsExport,
  type ComplianceCalendarEvent, type InsertComplianceCalendarEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, count, gte, lte, ilike, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(organisationId: string): Promise<User[]>;
  updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined>;
  getSuperAdmin(organisationId: string): Promise<User | undefined>;
  
  // Organisations
  getOrganisation(id: string): Promise<Organisation | undefined>;
  createOrganisation(org: InsertOrganisation): Promise<Organisation>;
  listOrganisations(): Promise<Organisation[]>;
  updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined>;
  deleteOrganisation(id: string): Promise<boolean>;
  
  // Schemes
  listSchemes(organisationId: string): Promise<Scheme[]>;
  getScheme(id: string): Promise<Scheme | undefined>;
  createScheme(scheme: InsertScheme): Promise<Scheme>;
  updateScheme(id: string, updates: Partial<InsertScheme>): Promise<Scheme | undefined>;
  deleteScheme(id: string): Promise<boolean>;
  
  // Blocks
  listBlocks(schemeId?: string): Promise<Block[]>;
  getBlock(id: string): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  updateBlock(id: string, updates: Partial<InsertBlock>): Promise<Block | undefined>;
  deleteBlock(id: string): Promise<boolean>;
  
  // Properties
  listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  bulkDeleteProperties(ids: string[]): Promise<number>;
  bulkVerifyProperties(ids: string[]): Promise<number>;
  bulkRejectProperties(ids: string[]): Promise<number>;
  getOrCreateAutoProperty(organisationId: string, addressData: { addressLine1: string; city?: string; postcode?: string }): Promise<Property>;
  
  // Certificates
  listCertificates(organisationId: string, filters?: { propertyId?: string; status?: string }): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  findAndFailStuckCertificates(timeoutMinutes: number): Promise<Certificate[]>;
  deleteCertificate(id: string): Promise<boolean>;
  
  // Extractions
  getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined>;
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  
  // Remedial Actions
  listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]>;
  getRemedialAction(id: string): Promise<RemedialAction | undefined>;
  createRemedialAction(action: InsertRemedialAction): Promise<RemedialAction>;
  updateRemedialAction(id: string, updates: Partial<InsertRemedialAction>): Promise<RemedialAction | undefined>;
  
  // Contractors
  listContractors(organisationId: string): Promise<Contractor[]>;
  getContractor(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor | undefined>;
  updateContractorStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'): Promise<Contractor | undefined>;
  bulkApproveContractors(ids: string[]): Promise<number>;
  bulkRejectContractors(ids: string[]): Promise<number>;
  
  // Contractor Certifications
  listContractorCertifications(organisationId: string, contractorId?: string): Promise<ContractorCertification[]>;
  getContractorCertification(id: string): Promise<ContractorCertification | undefined>;
  createContractorCertification(certification: InsertContractorCertification): Promise<ContractorCertification>;
  updateContractorCertification(id: string, updates: Partial<InsertContractorCertification>): Promise<ContractorCertification | undefined>;
  deleteContractorCertification(id: string): Promise<boolean>;
  
  // Contractor Verification History
  listContractorVerificationHistory(contractorId: string): Promise<ContractorVerificationHistory[]>;
  createContractorVerificationHistory(history: InsertContractorVerificationHistory): Promise<ContractorVerificationHistory>;
  
  // Contractor Alerts
  listContractorAlerts(organisationId: string, filters?: { contractorId?: string; status?: string }): Promise<ContractorAlert[]>;
  getContractorAlert(id: string): Promise<ContractorAlert | undefined>;
  createContractorAlert(alert: InsertContractorAlert): Promise<ContractorAlert>;
  updateContractorAlert(id: string, updates: Partial<InsertContractorAlert>): Promise<ContractorAlert | undefined>;
  
  // Contractor Assignments
  listContractorAssignments(organisationId: string, filters?: { contractorId?: string; propertyId?: string; status?: string }): Promise<ContractorAssignment[]>;
  getContractorAssignment(id: string): Promise<ContractorAssignment | undefined>;
  createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment>;
  updateContractorAssignment(id: string, updates: Partial<InsertContractorAssignment>): Promise<ContractorAssignment | undefined>;
  
  // Golden Thread - Certificate Versions
  listCertificateVersions(certificateId: string): Promise<CertificateVersion[]>;
  getCertificateVersion(id: string): Promise<CertificateVersion | undefined>;
  createCertificateVersion(version: InsertCertificateVersion): Promise<CertificateVersion>;
  supersedeCertificateVersion(id: string, supersededById: string, reason?: string): Promise<CertificateVersion | undefined>;
  
  // Golden Thread - Audit Field Changes
  listAuditFieldChanges(auditEventId: string): Promise<AuditFieldChange[]>;
  createAuditFieldChange(change: InsertAuditFieldChange): Promise<AuditFieldChange>;
  createAuditFieldChanges(changes: InsertAuditFieldChange[]): Promise<AuditFieldChange[]>;
  
  // Golden Thread - UKHDS Exports
  listUkhdsExports(organisationId: string): Promise<UkhdsExport[]>;
  getUkhdsExport(id: string): Promise<UkhdsExport | undefined>;
  createUkhdsExport(exportJob: InsertUkhdsExport): Promise<UkhdsExport>;
  updateUkhdsExport(id: string, updates: Partial<InsertUkhdsExport>): Promise<UkhdsExport | undefined>;
  
  // Compliance Calendar Events
  listCalendarEvents(organisationId: string, filters?: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string }): Promise<ComplianceCalendarEvent[]>;
  getCalendarEvent(id: string): Promise<ComplianceCalendarEvent | undefined>;
  createCalendarEvent(event: InsertComplianceCalendarEvent): Promise<ComplianceCalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertComplianceCalendarEvent>): Promise<ComplianceCalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  getUpcomingEvents(organisationId: string, daysAhead: number): Promise<ComplianceCalendarEvent[]>;
  
  // Configuration - Compliance Streams
  listComplianceStreams(): Promise<ComplianceStream[]>;
  getComplianceStream(id: string): Promise<ComplianceStream | undefined>;
  getComplianceStreamByCode(code: string): Promise<ComplianceStream | undefined>;
  createComplianceStream(stream: InsertComplianceStream): Promise<ComplianceStream>;
  updateComplianceStream(id: string, updates: Partial<InsertComplianceStream>): Promise<ComplianceStream | undefined>;
  deleteComplianceStream(id: string): Promise<boolean>;
  
  // Configuration - Certificate Types
  listCertificateTypes(): Promise<CertificateType[]>;
  getCertificateType(id: string): Promise<CertificateType | undefined>;
  getCertificateTypeByCode(code: string): Promise<CertificateType | undefined>;
  createCertificateType(certType: InsertCertificateType): Promise<CertificateType>;
  updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined>;
  deleteCertificateType(id: string): Promise<boolean>;
  
  // Configuration - Classification Codes
  listClassificationCodes(filters?: { certificateTypeId?: string; complianceStreamId?: string }): Promise<ClassificationCode[]>;
  getClassificationCode(id: string): Promise<ClassificationCode | undefined>;
  getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined>;
  createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode>;
  updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined>;
  deleteClassificationCode(id: string): Promise<boolean>;
  
  // Configuration - Extraction Schemas
  listExtractionSchemas(filters?: { complianceStreamId?: string }): Promise<ExtractionSchema[]>;
  getExtractionSchema(id: string): Promise<ExtractionSchema | undefined>;
  createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema>;
  updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined>;
  deleteExtractionSchema(id: string): Promise<boolean>;
  
  // Configuration - Compliance Rules
  listComplianceRules(filters?: { complianceStreamId?: string }): Promise<ComplianceRule[]>;
  getComplianceRule(id: string): Promise<ComplianceRule | undefined>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined>;
  deleteComplianceRule(id: string): Promise<boolean>;
  
  // Configuration - Normalisation Rules
  listNormalisationRules(filters?: { complianceStreamId?: string }): Promise<NormalisationRule[]>;
  getNormalisationRule(id: string): Promise<NormalisationRule | undefined>;
  createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule>;
  updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined>;
  deleteNormalisationRule(id: string): Promise<boolean>;
  
  // HACT Architecture - Component Types
  listComponentTypes(): Promise<ComponentType[]>;
  getComponentType(id: string): Promise<ComponentType | undefined>;
  createComponentType(componentType: InsertComponentType): Promise<ComponentType>;
  updateComponentType(id: string, updates: Partial<InsertComponentType>): Promise<ComponentType | undefined>;
  deleteComponentType(id: string): Promise<boolean>;
  
  // HACT Architecture - Units
  listUnits(propertyId?: string): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, updates: Partial<InsertUnit>): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<boolean>;
  
  // HACT Architecture - Components
  listComponents(filters?: { propertyId?: string; unitId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(id: string): Promise<boolean>;
  bulkCreateComponents(components: InsertComponent[]): Promise<Component[]>;
  
  // HACT Architecture - Component Certificates
  listComponentCertificates(componentId?: string, certificateId?: string): Promise<ComponentCertificate[]>;
  createComponentCertificate(link: InsertComponentCertificate): Promise<ComponentCertificate>;
  deleteComponentCertificate(id: string): Promise<boolean>;
  
  // Data Imports
  listDataImports(organisationId: string): Promise<DataImport[]>;
  getDataImport(id: string): Promise<DataImport | undefined>;
  createDataImport(dataImport: InsertDataImport): Promise<DataImport>;
  updateDataImport(id: string, updates: Partial<InsertDataImport>): Promise<DataImport | undefined>;
  deleteDataImport(id: string): Promise<boolean>;
  
  // Data Import Rows
  listDataImportRows(importId: string): Promise<DataImportRow[]>;
  createDataImportRow(row: InsertDataImportRow): Promise<DataImportRow>;
  bulkCreateDataImportRows(rows: InsertDataImportRow[]): Promise<DataImportRow[]>;
  updateDataImportRow(id: string, updates: Partial<InsertDataImportRow>): Promise<DataImportRow | undefined>;
  getDataImportRowCounts(importId: string): Promise<{ total: number; valid: number; invalid: number; imported: number }>;
  
  // API Monitoring - Logs
  listApiLogs(limit?: number, offset?: number): Promise<ApiLog[]>;
  createApiLog(log: InsertApiLog): Promise<ApiLog>;
  getApiLogStats(): Promise<{ total: number; errors: number; avgDuration: number }>;
  
  // API Monitoring - Metrics
  listApiMetrics(startDate?: string, endDate?: string): Promise<ApiMetric[]>;
  getOrCreateApiMetric(endpoint: string, method: string, date: string): Promise<ApiMetric>;
  updateApiMetric(id: string, updates: Partial<ApiMetric>): Promise<ApiMetric | undefined>;
  
  // Webhooks - Endpoints
  listWebhookEndpoints(organisationId: string): Promise<WebhookEndpoint[]>;
  getWebhookEndpoint(id: string): Promise<WebhookEndpoint | undefined>;
  createWebhookEndpoint(endpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint>;
  updateWebhookEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | undefined>;
  deleteWebhookEndpoint(id: string): Promise<boolean>;
  getActiveWebhooksForEvent(eventType: string): Promise<WebhookEndpoint[]>;
  
  // Webhooks - Events
  listWebhookEvents(limit?: number): Promise<WebhookEvent[]>;
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;
  markWebhookEventProcessed(id: string): Promise<boolean>;
  getPendingWebhookEvents(): Promise<WebhookEvent[]>;
  
  // Webhooks - Deliveries
  listWebhookDeliveries(webhookEndpointId?: string, limit?: number): Promise<WebhookDelivery[]>;
  createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery>;
  updateWebhookDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | undefined>;
  
  // Incoming Webhooks
  listIncomingWebhookLogs(limit?: number): Promise<IncomingWebhookLog[]>;
  createIncomingWebhookLog(log: InsertIncomingWebhookLog): Promise<IncomingWebhookLog>;
  updateIncomingWebhookLog(id: string, updates: Partial<IncomingWebhookLog>): Promise<IncomingWebhookLog | undefined>;
  
  // API Keys
  listApiKeys(organisationId: string): Promise<ApiKey[]>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  
  // Factory Settings
  listFactorySettings(): Promise<FactorySetting[]>;
  getFactorySetting(key: string): Promise<FactorySetting | undefined>;
  getFactorySettingValue(key: string, defaultValue?: string): Promise<string>;
  createFactorySetting(setting: InsertFactorySetting): Promise<FactorySetting>;
  updateFactorySetting(key: string, value: string, updatedById: string): Promise<FactorySetting | undefined>;
  createFactorySettingsAudit(audit: InsertFactorySettingsAudit): Promise<FactorySettingsAudit>;
  
  // API Clients
  listApiClients(organisationId: string): Promise<ApiClient[]>;
  getApiClient(id: string): Promise<ApiClient | undefined>;
  getApiClientByKey(apiKeyPrefix: string): Promise<ApiClient | undefined>;
  createApiClient(client: InsertApiClient): Promise<ApiClient>;
  updateApiClient(id: string, updates: Partial<ApiClient>): Promise<ApiClient | undefined>;
  deleteApiClient(id: string): Promise<boolean>;
  incrementApiClientUsage(id: string): Promise<void>;
  
  // Upload Sessions
  listUploadSessions(organisationId: string): Promise<UploadSession[]>;
  getUploadSession(id: string): Promise<UploadSession | undefined>;
  getUploadSessionByIdempotencyKey(key: string): Promise<UploadSession | undefined>;
  createUploadSession(session: InsertUploadSession): Promise<UploadSession>;
  updateUploadSession(id: string, updates: Partial<UploadSession>): Promise<UploadSession | undefined>;
  cleanupExpiredUploadSessions(): Promise<number>;
  
  // Ingestion Jobs
  listIngestionJobs(organisationId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]>;
  listAllIngestionJobs(filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]>;
  getIngestionJob(id: string): Promise<IngestionJob | undefined>;
  getIngestionJobByIdempotencyKey(key: string): Promise<IngestionJob | undefined>;
  createIngestionJob(job: InsertIngestionJob): Promise<IngestionJob>;
  updateIngestionJob(id: string, updates: Partial<IngestionJob>): Promise<IngestionJob | undefined>;
  getNextPendingIngestionJob(): Promise<IngestionJob | undefined>;
  deleteIngestionJobsByChannel(channel: string): Promise<number>;
  getIngestionStats(): Promise<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    recentErrors: IngestionJob[];
    throughputByHour: Array<{ hour: string; count: number }>;
    avgProcessingTime: number;
    successRate: number;
  }>;
  
  // Rate Limiting
  checkAndIncrementRateLimit(clientId: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
  cleanupExpiredRateLimits(): Promise<number>;
  
  // Videos
  listVideos(organisationId: string): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;
  incrementVideoView(id: string): Promise<void>;
  incrementVideoDownload(id: string): Promise<void>;
  
  // AI Suggestions
  listAiSuggestions(organisationId: string, status?: string): Promise<AiSuggestion[]>;
  getAiSuggestion(id: string): Promise<AiSuggestion | undefined>;
  getAiSuggestionByKey(organisationId: string, suggestionKey: string): Promise<AiSuggestion | undefined>;
  createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion>;
  updateAiSuggestion(id: string, updates: Partial<AiSuggestion>): Promise<AiSuggestion | undefined>;
  deleteAiSuggestion(id: string): Promise<boolean>;
  dismissAiSuggestion(id: string, reason?: string): Promise<AiSuggestion | undefined>;
  resolveAiSuggestion(id: string, userId?: string): Promise<AiSuggestion | undefined>;
  autoResolveAiSuggestions(organisationId: string): Promise<number>;
  
  // System Logs
  getSystemLogs(filters: { level?: string; source?: string; search?: string; limit: number; offset: number }): Promise<{ logs: SystemLog[]; total: number }>;
  
  // Risk Maps - Geodata
  listGeocodedProperties(organisationId: string): Promise<Property[]>;
  updatePropertyGeodata(propertyId: string, geodata: { latitude: number; longitude: number; ward?: string; wardCode?: string; lsoa?: string; msoa?: string }): Promise<Property | undefined>;
  
  // Risk Maps - Risk Calculations  
  getPropertyRiskData(organisationId: string): Promise<Array<{
    property: Property;
    certificates: Array<{ type: string; status: string; expiryDate: string | null }>;
    actions: Array<{ severity: string; status: string }>;
  }>>;
  
  // Audit Trail
  recordAuditEvent(event: InsertAuditEvent): Promise<AuditEvent>;
  listAuditEvents(organisationId: string, filters?: { 
    entityType?: string; 
    entityId?: string; 
    eventType?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }>;
  getEntityAuditHistory(entityType: string, entityId: string): Promise<AuditEvent[]>;
  getEntityAuditHistoryForOrg(entityType: string, entityId: string, organisationId: string): Promise<AuditEvent[]>;
  
  // Detection Patterns (certificate type detection from filename/content)
  listDetectionPatterns(filters?: { certificateTypeCode?: string; patternType?: string; isActive?: boolean }): Promise<DetectionPattern[]>;
  getDetectionPattern(id: string): Promise<DetectionPattern | undefined>;
  createDetectionPattern(pattern: InsertDetectionPattern): Promise<DetectionPattern>;
  updateDetectionPattern(id: string, updates: Partial<InsertDetectionPattern>): Promise<DetectionPattern | undefined>;
  deleteDetectionPattern(id: string): Promise<boolean>;
  
  // Outcome Rules (certificate outcome interpretation rules)
  listOutcomeRules(filters?: { certificateTypeCode?: string; ruleGroup?: string; isActive?: boolean }): Promise<OutcomeRule[]>;
  getOutcomeRule(id: string): Promise<OutcomeRule | undefined>;
  createOutcomeRule(rule: InsertOutcomeRule): Promise<OutcomeRule>;
  updateOutcomeRule(id: string, updates: Partial<InsertOutcomeRule>): Promise<OutcomeRule | undefined>;
  deleteOutcomeRule(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async listUsers(organisationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organisationId, organisationId));
  }

  async updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined> {
    const requester = await this.getUser(requesterId);
    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new Error('Only super admins can change user roles');
    }
    
    const targetUser = await this.getUser(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }
    
    if (targetUser.organisationId !== requester.organisationId) {
      throw new Error('Cannot modify users from other organisations');
    }
    
    if (requesterId === userId && requester.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      throw new Error('Super admin cannot demote themselves. Promote another user to super admin first.');
    }
    
    if (newRole === 'SUPER_ADMIN') {
      const existingSuperAdmin = await this.getSuperAdmin(requester.organisationId);
      if (existingSuperAdmin && existingSuperAdmin.id !== userId) {
        await db.update(users)
          .set({ role: 'ADMIN' as any })
          .where(eq(users.id, existingSuperAdmin.id));
      }
    }
    
    const [updated] = await db.update(users)
      .set({ role: newRole as any })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async getSuperAdmin(organisationId: string): Promise<User | undefined> {
    const [superAdmin] = await db.select().from(users)
      .where(and(eq(users.organisationId, organisationId), eq(users.role, 'SUPER_ADMIN')));
    return superAdmin || undefined;
  }
  
  // Organisations
  async getOrganisation(id: string): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
    return org || undefined;
  }
  
  async createOrganisation(org: InsertOrganisation): Promise<Organisation> {
    const [organisation] = await db.insert(organisations).values(org).returning();
    return organisation;
  }
  
  async listOrganisations(): Promise<Organisation[]> {
    return db.select().from(organisations);
  }

  async updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined> {
    const [updated] = await db.update(organisations).set({ ...updates, updatedAt: new Date() }).where(eq(organisations.id, id)).returning();
    return updated || undefined;
  }

  async deleteOrganisation(id: string): Promise<boolean> {
    const result = await db.delete(organisations).where(eq(organisations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Schemes
  async listSchemes(organisationId: string): Promise<Scheme[]> {
    return db.select().from(schemes).where(eq(schemes.organisationId, organisationId));
  }
  
  async getScheme(id: string): Promise<Scheme | undefined> {
    const [scheme] = await db.select().from(schemes).where(eq(schemes.id, id));
    return scheme || undefined;
  }
  
  async createScheme(scheme: InsertScheme): Promise<Scheme> {
    const [newScheme] = await db.insert(schemes).values(scheme).returning();
    return newScheme;
  }
  
  async updateScheme(id: string, updates: Partial<InsertScheme>): Promise<Scheme | undefined> {
    const [updated] = await db.update(schemes).set({ ...updates, updatedAt: new Date() }).where(eq(schemes.id, id)).returning();
    return updated || undefined;
  }

  async deleteScheme(id: string): Promise<boolean> {
    const result = await db.delete(schemes).where(eq(schemes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Blocks
  async listBlocks(schemeId?: string): Promise<Block[]> {
    if (schemeId) {
      return db.select().from(blocks).where(eq(blocks.schemeId, schemeId));
    }
    return db.select().from(blocks);
  }
  
  async getBlock(id: string): Promise<Block | undefined> {
    const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
    return block || undefined;
  }
  
  async createBlock(block: InsertBlock): Promise<Block> {
    const [newBlock] = await db.insert(blocks).values(block).returning();
    return newBlock;
  }
  
  async updateBlock(id: string, updates: Partial<InsertBlock>): Promise<Block | undefined> {
    const [updated] = await db.update(blocks).set({ ...updates, updatedAt: new Date() }).where(eq(blocks.id, id)).returning();
    return updated || undefined;
  }

  async deleteBlock(id: string): Promise<boolean> {
    const result = await db.delete(blocks).where(eq(blocks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Properties
  async listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]> {
    if (filters?.blockId) {
      return db.select().from(properties).where(eq(properties.blockId, filters.blockId));
    }
    
    // For schemeId, we need to join with blocks
    if (filters?.schemeId) {
      return db.select()
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .where(eq(blocks.schemeId, filters.schemeId))
        .then(results => results.map(r => r.properties));
    }
    
    // All properties for the organisation (via schemes)
    return db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId))
      .then(results => results.map(r => r.properties));
  }
  
  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }
  
  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }
  
  async updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property | undefined> {
    const [updated] = await db.update(properties).set({ ...updates, updatedAt: new Date() }).where(eq(properties.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteProperty(id: string): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async bulkDeleteProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let deleted = 0;
    for (const id of ids) {
      const result = await db.delete(properties).where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) deleted++;
    }
    return deleted;
  }
  
  async bulkVerifyProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let verified = 0;
    for (const id of ids) {
      const result = await db.update(properties)
        .set({ needsVerification: false, updatedAt: new Date() })
        .where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) verified++;
    }
    return verified;
  }
  
  async getOrCreateAutoProperty(organisationId: string, addressData: { addressLine1: string; city?: string; postcode?: string }): Promise<Property> {
    // Check if a property with the same address already exists (case-insensitive, trimmed)
    const addressLine = (addressData.addressLine1 || 'Address To Be Verified').trim();
    const normalizedAddress = addressLine.toLowerCase();
    
    // Get all properties in the organisation and check for matches
    const allProps = await db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId));
    
    // Find case-insensitive match
    const existingProp = allProps.find(p => 
      p.properties.addressLine1.trim().toLowerCase() === normalizedAddress
    );
    
    if (existingProp) {
      // Return the existing property
      return existingProp.properties;
    }
    
    // Get or create a default scheme and block for auto-extracted properties
    let schemeList = await this.listSchemes(organisationId);
    let autoScheme = schemeList.find(s => s.reference === 'AUTO-EXTRACT');
    
    if (!autoScheme) {
      autoScheme = await this.createScheme({
        organisationId,
        name: 'Auto-Extracted Properties',
        reference: 'AUTO-EXTRACT',
      });
    }
    
    let blockList = await this.listBlocks(autoScheme.id);
    let autoBlock = blockList.find(b => b.reference === 'AUTO-BLOCK');
    
    if (!autoBlock) {
      autoBlock = await this.createBlock({
        schemeId: autoScheme.id,
        name: 'Unverified Properties',
        reference: 'AUTO-BLOCK',
      });
    }
    
    // Create the property with needsVerification flag
    const property = await this.createProperty({
      blockId: autoBlock.id,
      uprn: `AUTO-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      addressLine1: addressLine,
      city: addressData.city || 'Unknown',
      postcode: addressData.postcode || 'UNKNOWN',
      propertyType: 'FLAT',
      tenure: 'SOCIAL_RENT',
      bedrooms: 1,
      hasGas: true,
      source: 'AUTO_EXTRACTED',
      needsVerification: true,
      extractedMetadata: addressData,
    });
    
    return property;
  }
  
  async bulkRejectProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let deleted = 0;
    for (const id of ids) {
      // Get certificates for this property to delete their extractions
      const propertyCerts = await db.select().from(certificates).where(eq(certificates.propertyId, id));
      
      for (const cert of propertyCerts) {
        // Get extraction runs first (before deleting)
        const certRuns = await db.select().from(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        
        // Delete human reviews (via extraction runs)
        for (const run of certRuns) {
          await db.delete(humanReviews).where(eq(humanReviews.extractionRunId, run.id));
        }
        
        // Delete extraction runs
        await db.delete(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        // Delete extractions
        await db.delete(extractions).where(eq(extractions.certificateId, cert.id));
      }
      
      // Delete certificates
      await db.delete(certificates).where(eq(certificates.propertyId, id));
      // Delete remedial actions
      await db.delete(remedialActions).where(eq(remedialActions.propertyId, id));
      // Delete the property
      const result = await db.delete(properties).where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) deleted++;
    }
    return deleted;
  }
  
  // Certificates
  async listCertificates(organisationId: string, filters?: { propertyId?: string; status?: string }): Promise<Certificate[]> {
    const conditions = [eq(certificates.organisationId, organisationId)];
    
    if (filters?.propertyId) {
      conditions.push(eq(certificates.propertyId, filters.propertyId));
    }
    
    if (filters?.status) {
      conditions.push(eq(certificates.status, filters.status as any));
    }
    
    return db.select().from(certificates).where(and(...conditions)).orderBy(desc(certificates.createdAt));
  }
  
  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || undefined;
  }
  
  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db.insert(certificates).values(certificate).returning();
    return newCertificate;
  }
  
  async updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [updated] = await db.update(certificates).set({ ...updates, updatedAt: new Date() }).where(eq(certificates.id, id)).returning();
    return updated || undefined;
  }
  
  async findAndFailStuckCertificates(timeoutMinutes: number): Promise<Certificate[]> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const timeoutMessage = `Processing timeout: Certificate was stuck in PROCESSING status for more than ${timeoutMinutes} minutes and was automatically marked as failed.`;
    
    // Find certificates stuck in PROCESSING status for longer than the timeout
    const stuckCertificates = await db.select()
      .from(certificates)
      .where(and(
        eq(certificates.status, 'PROCESSING' as any),
        lte(certificates.updatedAt, cutoffTime)
      ));
    
    // Update each stuck certificate and its related jobs atomically using a transaction
    const updated: Certificate[] = [];
    for (const cert of stuckCertificates) {
      try {
        const failedCert = await db.transaction(async (tx) => {
          // Update certificate to FAILED only if it's still in PROCESSING status (prevents race condition)
          const [updatedCert] = await tx.update(certificates)
            .set({ 
              status: 'FAILED' as any, 
              updatedAt: new Date(),
            })
            .where(and(
              eq(certificates.id, cert.id),
              eq(certificates.status, 'PROCESSING' as any)
            ))
            .returning();
          
          if (updatedCert) {
            // Also update any corresponding ingestion job to FAILED status
            await tx.update(ingestionJobs)
              .set({
                status: 'FAILED' as any,
                statusMessage: timeoutMessage,
                errorDetails: { reason: 'PROCESSING_TIMEOUT', timeoutMinutes },
                updatedAt: new Date(),
                completedAt: new Date(),
              })
              .where(and(
                eq(ingestionJobs.certificateId, cert.id),
                eq(ingestionJobs.status, 'PROCESSING' as any)
              ));
          }
          
          return updatedCert;
        });
        
        if (failedCert) {
          updated.push(failedCert);
        }
      } catch (error) {
        console.error(`Failed to update stuck certificate ${cert.id}:`, error);
      }
    }
    
    return updated;
  }
  
  async deleteCertificate(id: string): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Extractions
  async getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined> {
    const [extraction] = await db.select().from(extractions).where(eq(extractions.certificateId, certificateId)).orderBy(desc(extractions.createdAt));
    return extraction || undefined;
  }
  
  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const [newExtraction] = await db.insert(extractions).values(extraction).returning();
    return newExtraction;
  }
  
  // Remedial Actions
  async listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]> {
    // Need to join with certificates to filter by organisation
    const conditions = [eq(certificates.organisationId, organisationId)];
    
    if (filters?.propertyId) {
      conditions.push(eq(remedialActions.propertyId, filters.propertyId));
    }
    
    if (filters?.status) {
      conditions.push(eq(remedialActions.status, filters.status as any));
    }
    
    if (filters?.certificateId) {
      conditions.push(eq(remedialActions.certificateId, filters.certificateId));
    }
    
    return db.select({ actions: remedialActions })
      .from(remedialActions)
      .innerJoin(certificates, eq(remedialActions.certificateId, certificates.id))
      .where(and(...conditions))
      .orderBy(desc(remedialActions.createdAt))
      .then(results => results.map(r => r.actions));
  }
  
  async getRemedialAction(id: string): Promise<RemedialAction | undefined> {
    const [action] = await db.select().from(remedialActions).where(eq(remedialActions.id, id));
    return action || undefined;
  }
  
  async createRemedialAction(action: InsertRemedialAction): Promise<RemedialAction> {
    const [newAction] = await db.insert(remedialActions).values(action).returning();
    return newAction;
  }
  
  async updateRemedialAction(id: string, updates: Partial<InsertRemedialAction>): Promise<RemedialAction | undefined> {
    const [updated] = await db.update(remedialActions).set({ ...updates, updatedAt: new Date() }).where(eq(remedialActions.id, id)).returning();
    return updated || undefined;
  }
  
  // Contractors
  async listContractors(organisationId: string): Promise<Contractor[]> {
    return db.select().from(contractors).where(eq(contractors.organisationId, organisationId)).orderBy(desc(contractors.createdAt));
  }
  
  async getContractor(id: string): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor || undefined;
  }
  
  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db.insert(contractors).values(contractor).returning();
    return newContractor;
  }
  
  async updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor | undefined> {
    const [updated] = await db.update(contractors).set({ ...updates, updatedAt: new Date() }).where(eq(contractors.id, id)).returning();
    return updated || undefined;
  }
  
  async updateContractorStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'): Promise<Contractor | undefined> {
    const [updated] = await db.update(contractors).set({ status, updatedAt: new Date() }).where(eq(contractors.id, id)).returning();
    return updated || undefined;
  }
  
  async bulkApproveContractors(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let approved = 0;
    for (const id of ids) {
      const result = await db.update(contractors)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(contractors.id, id));
      if (result.rowCount && result.rowCount > 0) approved++;
    }
    return approved;
  }
  
  async bulkRejectContractors(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let rejected = 0;
    for (const id of ids) {
      const result = await db.update(contractors)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(contractors.id, id));
      if (result.rowCount && result.rowCount > 0) rejected++;
    }
    return rejected;
  }
  
  // Contractor Certifications
  async listContractorCertifications(organisationId: string, contractorId?: string): Promise<ContractorCertification[]> {
    const conditions = [eq(contractorCertifications.organisationId, organisationId)];
    if (contractorId) {
      conditions.push(eq(contractorCertifications.contractorId, contractorId));
    }
    return db.select().from(contractorCertifications).where(and(...conditions)).orderBy(desc(contractorCertifications.createdAt));
  }
  
  async getContractorCertification(id: string): Promise<ContractorCertification | undefined> {
    const [cert] = await db.select().from(contractorCertifications).where(eq(contractorCertifications.id, id));
    return cert || undefined;
  }
  
  async createContractorCertification(certification: InsertContractorCertification): Promise<ContractorCertification> {
    const [newCert] = await db.insert(contractorCertifications).values(certification).returning();
    return newCert;
  }
  
  async updateContractorCertification(id: string, updates: Partial<InsertContractorCertification>): Promise<ContractorCertification | undefined> {
    const [updated] = await db.update(contractorCertifications).set({ ...updates, updatedAt: new Date() }).where(eq(contractorCertifications.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteContractorCertification(id: string): Promise<boolean> {
    const result = await db.delete(contractorCertifications).where(eq(contractorCertifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Contractor Verification History
  async listContractorVerificationHistory(contractorId: string): Promise<ContractorVerificationHistory[]> {
    return db.select().from(contractorVerificationHistory).where(eq(contractorVerificationHistory.contractorId, contractorId)).orderBy(desc(contractorVerificationHistory.createdAt));
  }
  
  async createContractorVerificationHistory(history: InsertContractorVerificationHistory): Promise<ContractorVerificationHistory> {
    const [newHistory] = await db.insert(contractorVerificationHistory).values(history).returning();
    return newHistory;
  }
  
  // Contractor Alerts
  async listContractorAlerts(organisationId: string, filters?: { contractorId?: string; status?: string }): Promise<ContractorAlert[]> {
    const conditions = [eq(contractorAlerts.organisationId, organisationId)];
    if (filters?.contractorId) {
      conditions.push(eq(contractorAlerts.contractorId, filters.contractorId));
    }
    if (filters?.status) {
      conditions.push(eq(contractorAlerts.status, filters.status as any));
    }
    return db.select().from(contractorAlerts).where(and(...conditions)).orderBy(desc(contractorAlerts.createdAt));
  }
  
  async getContractorAlert(id: string): Promise<ContractorAlert | undefined> {
    const [alert] = await db.select().from(contractorAlerts).where(eq(contractorAlerts.id, id));
    return alert || undefined;
  }
  
  async createContractorAlert(alert: InsertContractorAlert): Promise<ContractorAlert> {
    const [newAlert] = await db.insert(contractorAlerts).values(alert).returning();
    return newAlert;
  }
  
  async updateContractorAlert(id: string, updates: Partial<InsertContractorAlert>): Promise<ContractorAlert | undefined> {
    const [updated] = await db.update(contractorAlerts).set({ ...updates, updatedAt: new Date() }).where(eq(contractorAlerts.id, id)).returning();
    return updated || undefined;
  }
  
  // Contractor Assignments
  async listContractorAssignments(organisationId: string, filters?: { contractorId?: string; propertyId?: string; status?: string }): Promise<ContractorAssignment[]> {
    const conditions = [eq(contractorAssignments.organisationId, organisationId)];
    if (filters?.contractorId) {
      conditions.push(eq(contractorAssignments.contractorId, filters.contractorId));
    }
    if (filters?.propertyId) {
      conditions.push(eq(contractorAssignments.propertyId, filters.propertyId));
    }
    if (filters?.status) {
      conditions.push(eq(contractorAssignments.status, filters.status as any));
    }
    return db.select().from(contractorAssignments).where(and(...conditions)).orderBy(desc(contractorAssignments.createdAt));
  }
  
  async getContractorAssignment(id: string): Promise<ContractorAssignment | undefined> {
    const [assignment] = await db.select().from(contractorAssignments).where(eq(contractorAssignments.id, id));
    return assignment || undefined;
  }
  
  async createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment> {
    const [newAssignment] = await db.insert(contractorAssignments).values(assignment).returning();
    return newAssignment;
  }
  
  async updateContractorAssignment(id: string, updates: Partial<InsertContractorAssignment>): Promise<ContractorAssignment | undefined> {
    const [updated] = await db.update(contractorAssignments).set({ ...updates, updatedAt: new Date() }).where(eq(contractorAssignments.id, id)).returning();
    return updated || undefined;
  }
  
  // Golden Thread - Certificate Versions
  async listCertificateVersions(certificateId: string): Promise<CertificateVersion[]> {
    return db.select().from(certificateVersions).where(eq(certificateVersions.certificateId, certificateId)).orderBy(desc(certificateVersions.versionNumber));
  }
  
  async getCertificateVersion(id: string): Promise<CertificateVersion | undefined> {
    const [version] = await db.select().from(certificateVersions).where(eq(certificateVersions.id, id));
    return version || undefined;
  }
  
  async createCertificateVersion(version: InsertCertificateVersion): Promise<CertificateVersion> {
    const [newVersion] = await db.insert(certificateVersions).values(version).returning();
    return newVersion;
  }
  
  async supersedeCertificateVersion(id: string, supersededById: string, reason?: string): Promise<CertificateVersion | undefined> {
    const [updated] = await db.update(certificateVersions).set({
      supersededAt: new Date(),
      supersededById,
      supersededReason: reason || null,
    }).where(eq(certificateVersions.id, id)).returning();
    return updated || undefined;
  }
  
  // Golden Thread - Audit Field Changes
  async listAuditFieldChanges(auditEventId: string): Promise<AuditFieldChange[]> {
    return db.select().from(auditFieldChanges).where(eq(auditFieldChanges.auditEventId, auditEventId)).orderBy(auditFieldChanges.fieldName);
  }
  
  async createAuditFieldChange(change: InsertAuditFieldChange): Promise<AuditFieldChange> {
    const [newChange] = await db.insert(auditFieldChanges).values(change).returning();
    return newChange;
  }
  
  async createAuditFieldChanges(changes: InsertAuditFieldChange[]): Promise<AuditFieldChange[]> {
    if (changes.length === 0) return [];
    return db.insert(auditFieldChanges).values(changes).returning();
  }
  
  // Golden Thread - UKHDS Exports
  async listUkhdsExports(organisationId: string): Promise<UkhdsExport[]> {
    return db.select().from(ukhdsExports).where(eq(ukhdsExports.organisationId, organisationId)).orderBy(desc(ukhdsExports.createdAt));
  }
  
  async getUkhdsExport(id: string): Promise<UkhdsExport | undefined> {
    const [exportJob] = await db.select().from(ukhdsExports).where(eq(ukhdsExports.id, id));
    return exportJob || undefined;
  }
  
  async createUkhdsExport(exportJob: InsertUkhdsExport): Promise<UkhdsExport> {
    const [newExport] = await db.insert(ukhdsExports).values(exportJob).returning();
    return newExport;
  }
  
  async updateUkhdsExport(id: string, updates: Partial<InsertUkhdsExport>): Promise<UkhdsExport | undefined> {
    const [updated] = await db.update(ukhdsExports).set(updates).where(eq(ukhdsExports.id, id)).returning();
    return updated || undefined;
  }
  
  // Compliance Calendar Events
  async listCalendarEvents(organisationId: string, filters?: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string }): Promise<ComplianceCalendarEvent[]> {
    let conditions = [eq(complianceCalendarEvents.organisationId, organisationId)];
    
    if (filters?.startDate) {
      conditions.push(gte(complianceCalendarEvents.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(complianceCalendarEvents.startDate, filters.endDate));
    }
    if (filters?.eventType) {
      conditions.push(sql`${complianceCalendarEvents.eventType} = ${filters.eventType}`);
    }
    if (filters?.complianceStreamId) {
      conditions.push(eq(complianceCalendarEvents.complianceStreamId, filters.complianceStreamId));
    }
    
    return db.select().from(complianceCalendarEvents)
      .where(and(...conditions))
      .orderBy(complianceCalendarEvents.startDate);
  }
  
  async getCalendarEvent(id: string): Promise<ComplianceCalendarEvent | undefined> {
    const [event] = await db.select().from(complianceCalendarEvents).where(eq(complianceCalendarEvents.id, id));
    return event || undefined;
  }
  
  async createCalendarEvent(event: InsertComplianceCalendarEvent): Promise<ComplianceCalendarEvent> {
    const [newEvent] = await db.insert(complianceCalendarEvents).values(event).returning();
    return newEvent;
  }
  
  async updateCalendarEvent(id: string, updates: Partial<InsertComplianceCalendarEvent>): Promise<ComplianceCalendarEvent | undefined> {
    const [updated] = await db.update(complianceCalendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceCalendarEvents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCalendarEvent(id: string): Promise<boolean> {
    const result = await db.delete(complianceCalendarEvents).where(eq(complianceCalendarEvents.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getUpcomingEvents(organisationId: string, daysAhead: number): Promise<ComplianceCalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return db.select().from(complianceCalendarEvents)
      .where(
        and(
          eq(complianceCalendarEvents.organisationId, organisationId),
          gte(complianceCalendarEvents.startDate, now),
          lte(complianceCalendarEvents.startDate, futureDate)
        )
      )
      .orderBy(complianceCalendarEvents.startDate);
  }
  
  // Admin / Demo Data Management
  async wipeData(includeProperties: boolean = false): Promise<void> {
    // Delete in order of dependencies (children first)
    // First, clear AI Model related tables
    await db.delete(humanReviews);
    await db.delete(evalRuns);
    await db.delete(benchmarkItems);
    await db.delete(benchmarkSets);
    await db.delete(extractionRuns);
    await db.delete(complianceRules);
    await db.delete(normalisationRules);
    await db.delete(extractionSchemas);
    
    // Then clear core certificate-related tables
    await db.delete(remedialActions);
    await db.delete(extractions);
    await db.delete(certificates);
    
    if (includeProperties) {
      await db.delete(properties);
      await db.delete(blocks);
      await db.delete(schemes);
    }
    
    console.log(`Data wiped successfully (includeProperties: ${includeProperties})`);
  }
  
  async seedDemoData(organisationId: string): Promise<void> {
    // Create demo schemes
    const [londonScheme] = await db.insert(schemes).values({
      organisationId,
      name: "London Housing Estate",
      reference: "SCH-LON-001",
    }).returning();
    
    const [manchesterScheme] = await db.insert(schemes).values({
      organisationId,
      name: "Manchester Urban Regeneration",
      reference: "SCH-MAN-001",
    }).returning();
    
    // Create blocks
    const [oakHouseBlock] = await db.insert(blocks).values({
      schemeId: londonScheme.id,
      name: "Oak House",
      reference: "BLK-OAK-001",
    }).returning();
    
    const [towersBlock] = await db.insert(blocks).values({
      schemeId: manchesterScheme.id,
      name: "The Towers",
      reference: "BLK-TWR-001",
    }).returning();
    
    // Create properties
    await db.insert(properties).values([
      {
        blockId: oakHouseBlock.id,
        uprn: "10001001",
        addressLine1: "Flat 1, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "COMPLIANT",
      },
      {
        blockId: oakHouseBlock.id,
        uprn: "10001002",
        addressLine1: "Flat 2, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "OVERDUE",
      },
      {
        blockId: towersBlock.id,
        uprn: "10002001",
        addressLine1: "101 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "LEASEHOLD",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "COMPLIANT",
      },
      {
        blockId: towersBlock.id,
        uprn: "10002002",
        addressLine1: "102 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "NON_COMPLIANT",
      },
    ]);
    
    console.log("Demo data seeded successfully");
  }
  
  // Configuration - Compliance Streams
  async listComplianceStreams(): Promise<ComplianceStream[]> {
    return db.select().from(complianceStreams).orderBy(complianceStreams.displayOrder);
  }
  
  async getComplianceStream(id: string): Promise<ComplianceStream | undefined> {
    const [stream] = await db.select().from(complianceStreams).where(eq(complianceStreams.id, id));
    return stream || undefined;
  }
  
  async getComplianceStreamByCode(code: string): Promise<ComplianceStream | undefined> {
    const [stream] = await db.select().from(complianceStreams).where(eq(complianceStreams.code, code));
    return stream || undefined;
  }
  
  async createComplianceStream(stream: InsertComplianceStream): Promise<ComplianceStream> {
    const [created] = await db.insert(complianceStreams).values(stream).returning();
    return created;
  }
  
  async updateComplianceStream(id: string, updates: Partial<InsertComplianceStream>): Promise<ComplianceStream | undefined> {
    const [updated] = await db.update(complianceStreams)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceStreams.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComplianceStream(id: string): Promise<boolean> {
    const result = await db.delete(complianceStreams).where(eq(complianceStreams.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Certificate Types
  async listCertificateTypes(): Promise<CertificateType[]> {
    return db.select().from(certificateTypes).orderBy(certificateTypes.displayOrder);
  }
  
  async getCertificateType(id: string): Promise<CertificateType | undefined> {
    const [certType] = await db.select().from(certificateTypes).where(eq(certificateTypes.id, id));
    return certType || undefined;
  }
  
  async getCertificateTypeByCode(code: string): Promise<CertificateType | undefined> {
    const [certType] = await db.select().from(certificateTypes).where(eq(certificateTypes.code, code));
    return certType || undefined;
  }
  
  async createCertificateType(certType: InsertCertificateType): Promise<CertificateType> {
    const [created] = await db.insert(certificateTypes).values(certType).returning();
    return created;
  }
  
  async updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined> {
    const [updated] = await db.update(certificateTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateTypes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCertificateType(id: string): Promise<boolean> {
    const result = await db.delete(certificateTypes).where(eq(certificateTypes.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Classification Codes
  async listClassificationCodes(filters?: { certificateTypeId?: string; complianceStreamId?: string }): Promise<ClassificationCode[]> {
    let query = db.select().from(classificationCodes);
    if (filters?.certificateTypeId && filters?.complianceStreamId) {
      query = query.where(and(
        eq(classificationCodes.certificateTypeId, filters.certificateTypeId),
        eq(classificationCodes.complianceStreamId, filters.complianceStreamId)
      )) as typeof query;
    } else if (filters?.certificateTypeId) {
      query = query.where(eq(classificationCodes.certificateTypeId, filters.certificateTypeId)) as typeof query;
    } else if (filters?.complianceStreamId) {
      query = query.where(eq(classificationCodes.complianceStreamId, filters.complianceStreamId)) as typeof query;
    }
    return query.orderBy(classificationCodes.displayOrder);
  }
  
  async getClassificationCode(id: string): Promise<ClassificationCode | undefined> {
    const [code] = await db.select().from(classificationCodes).where(eq(classificationCodes.id, id));
    return code || undefined;
  }
  
  async getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined> {
    if (certificateTypeId) {
      const [result] = await db.select().from(classificationCodes)
        .where(and(
          eq(classificationCodes.code, code),
          eq(classificationCodes.certificateTypeId, certificateTypeId)
        ));
      return result || undefined;
    }
    const [result] = await db.select().from(classificationCodes)
      .where(eq(classificationCodes.code, code));
    return result || undefined;
  }
  
  async createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode> {
    const [created] = await db.insert(classificationCodes).values(code).returning();
    return created;
  }
  
  async updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined> {
    const [updated] = await db.update(classificationCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classificationCodes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteClassificationCode(id: string): Promise<boolean> {
    const result = await db.delete(classificationCodes).where(eq(classificationCodes.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Extraction Schemas
  async listExtractionSchemas(filters?: { complianceStreamId?: string }): Promise<ExtractionSchema[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(extractionSchemas)
        .where(eq(extractionSchemas.complianceStreamId, filters.complianceStreamId))
        .orderBy(desc(extractionSchemas.createdAt));
    }
    return db.select().from(extractionSchemas).orderBy(desc(extractionSchemas.createdAt));
  }
  
  async getExtractionSchema(id: string): Promise<ExtractionSchema | undefined> {
    const [schema] = await db.select().from(extractionSchemas).where(eq(extractionSchemas.id, id));
    return schema || undefined;
  }
  
  async createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema> {
    const [created] = await db.insert(extractionSchemas).values(schema).returning();
    return created;
  }
  
  async updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined> {
    const [updated] = await db.update(extractionSchemas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(extractionSchemas.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteExtractionSchema(id: string): Promise<boolean> {
    const result = await db.delete(extractionSchemas).where(eq(extractionSchemas.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Compliance Rules
  async listComplianceRules(filters?: { complianceStreamId?: string }): Promise<ComplianceRule[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(complianceRules)
        .where(eq(complianceRules.complianceStreamId, filters.complianceStreamId))
        .orderBy(complianceRules.ruleCode);
    }
    return db.select().from(complianceRules).orderBy(complianceRules.ruleCode);
  }
  
  async getComplianceRule(id: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.id, id));
    return rule || undefined;
  }
  
  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [created] = await db.insert(complianceRules).values(rule).returning();
    return created;
  }
  
  async updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined> {
    const [updated] = await db.update(complianceRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComplianceRule(id: string): Promise<boolean> {
    const result = await db.delete(complianceRules).where(eq(complianceRules.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Normalisation Rules
  async listNormalisationRules(filters?: { complianceStreamId?: string }): Promise<NormalisationRule[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(normalisationRules)
        .where(eq(normalisationRules.complianceStreamId, filters.complianceStreamId))
        .orderBy(desc(normalisationRules.priority));
    }
    return db.select().from(normalisationRules).orderBy(desc(normalisationRules.priority));
  }
  
  async getNormalisationRule(id: string): Promise<NormalisationRule | undefined> {
    const [rule] = await db.select().from(normalisationRules).where(eq(normalisationRules.id, id));
    return rule || undefined;
  }
  
  async createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule> {
    const [created] = await db.insert(normalisationRules).values(rule).returning();
    return created;
  }
  
  async updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined> {
    const [updated] = await db.update(normalisationRules)
      .set(updates)
      .where(eq(normalisationRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteNormalisationRule(id: string): Promise<boolean> {
    const result = await db.delete(normalisationRules).where(eq(normalisationRules.id, id)).returning();
    return result.length > 0;
  }
  
  // HACT Architecture - Component Types
  async listComponentTypes(): Promise<ComponentType[]> {
    return db.select().from(componentTypes).orderBy(componentTypes.displayOrder);
  }
  
  async getComponentType(id: string): Promise<ComponentType | undefined> {
    const [type] = await db.select().from(componentTypes).where(eq(componentTypes.id, id));
    return type || undefined;
  }
  
  async createComponentType(componentType: InsertComponentType): Promise<ComponentType> {
    const [created] = await db.insert(componentTypes).values(componentType).returning();
    return created;
  }
  
  async updateComponentType(id: string, updates: Partial<InsertComponentType>): Promise<ComponentType | undefined> {
    const [updated] = await db.update(componentTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(componentTypes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComponentType(id: string): Promise<boolean> {
    const result = await db.delete(componentTypes).where(eq(componentTypes.id, id)).returning();
    return result.length > 0;
  }
  
  // HACT Architecture - Units
  async listUnits(propertyId?: string): Promise<Unit[]> {
    if (propertyId) {
      return db.select().from(units)
        .where(eq(units.propertyId, propertyId))
        .orderBy(units.name);
    }
    return db.select().from(units).orderBy(units.name);
  }
  
  async getUnit(id: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit || undefined;
  }
  
  async createUnit(unit: InsertUnit): Promise<Unit> {
    const [created] = await db.insert(units).values(unit).returning();
    return created;
  }
  
  async updateUnit(id: string, updates: Partial<InsertUnit>): Promise<Unit | undefined> {
    const [updated] = await db.update(units)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(units.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteUnit(id: string): Promise<boolean> {
    const result = await db.delete(units).where(eq(units.id, id)).returning();
    return result.length > 0;
  }
  
  // HACT Architecture - Components
  async listComponents(filters?: { propertyId?: string; unitId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]> {
    const conditions = [];
    if (filters?.propertyId) conditions.push(eq(components.propertyId, filters.propertyId));
    if (filters?.unitId) conditions.push(eq(components.unitId, filters.unitId));
    if (filters?.blockId) conditions.push(eq(components.blockId, filters.blockId));
    if (filters?.componentTypeId) conditions.push(eq(components.componentTypeId, filters.componentTypeId));
    
    if (conditions.length > 0) {
      return db.select().from(components).where(and(...conditions)).orderBy(desc(components.createdAt));
    }
    return db.select().from(components).orderBy(desc(components.createdAt));
  }
  
  async getComponent(id: string): Promise<Component | undefined> {
    const [component] = await db.select().from(components).where(eq(components.id, id));
    return component || undefined;
  }
  
  async createComponent(component: InsertComponent): Promise<Component> {
    const [created] = await db.insert(components).values(component).returning();
    return created;
  }
  
  async updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component | undefined> {
    const [updated] = await db.update(components)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComponent(id: string): Promise<boolean> {
    const result = await db.delete(components).where(eq(components.id, id)).returning();
    return result.length > 0;
  }
  
  async bulkCreateComponents(componentList: InsertComponent[]): Promise<Component[]> {
    if (componentList.length === 0) return [];
    return db.insert(components).values(componentList).returning();
  }
  
  // HACT Architecture - Component Certificates
  async listComponentCertificates(componentId?: string, certificateId?: string): Promise<ComponentCertificate[]> {
    const conditions = [];
    if (componentId) conditions.push(eq(componentCertificates.componentId, componentId));
    if (certificateId) conditions.push(eq(componentCertificates.certificateId, certificateId));
    
    if (conditions.length > 0) {
      return db.select().from(componentCertificates).where(and(...conditions));
    }
    return db.select().from(componentCertificates);
  }
  
  async createComponentCertificate(link: InsertComponentCertificate): Promise<ComponentCertificate> {
    const [created] = await db.insert(componentCertificates).values(link).returning();
    return created;
  }
  
  async deleteComponentCertificate(id: string): Promise<boolean> {
    const result = await db.delete(componentCertificates).where(eq(componentCertificates.id, id)).returning();
    return result.length > 0;
  }
  
  // Data Imports
  async listDataImports(organisationId: string): Promise<DataImport[]> {
    return db.select().from(dataImports)
      .where(eq(dataImports.organisationId, organisationId))
      .orderBy(desc(dataImports.createdAt));
  }
  
  async getDataImport(id: string): Promise<DataImport | undefined> {
    const [dataImport] = await db.select().from(dataImports).where(eq(dataImports.id, id));
    return dataImport || undefined;
  }
  
  async createDataImport(dataImport: InsertDataImport): Promise<DataImport> {
    const [created] = await db.insert(dataImports).values(dataImport).returning();
    return created;
  }
  
  async updateDataImport(id: string, updates: Partial<InsertDataImport>): Promise<DataImport | undefined> {
    const [updated] = await db.update(dataImports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataImports.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteDataImport(id: string): Promise<boolean> {
    const result = await db.delete(dataImports).where(eq(dataImports.id, id)).returning();
    return result.length > 0;
  }
  
  // Data Import Rows
  async listDataImportRows(importId: string): Promise<DataImportRow[]> {
    return db.select().from(dataImportRows)
      .where(eq(dataImportRows.importId, importId))
      .orderBy(dataImportRows.rowNumber);
  }
  
  async createDataImportRow(row: InsertDataImportRow): Promise<DataImportRow> {
    const [created] = await db.insert(dataImportRows).values(row).returning();
    return created;
  }
  
  async bulkCreateDataImportRows(rows: InsertDataImportRow[]): Promise<DataImportRow[]> {
    if (rows.length === 0) return [];
    return db.insert(dataImportRows).values(rows).returning();
  }
  
  async updateDataImportRow(id: string, updates: Partial<InsertDataImportRow>): Promise<DataImportRow | undefined> {
    const [updated] = await db.update(dataImportRows)
      .set(updates)
      .where(eq(dataImportRows.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getDataImportRowCounts(importId: string): Promise<{ total: number; valid: number; invalid: number; imported: number }> {
    const rows = await db.select().from(dataImportRows).where(eq(dataImportRows.importId, importId));
    return {
      total: rows.length,
      valid: rows.filter(r => r.status === 'VALID').length,
      invalid: rows.filter(r => r.status === 'INVALID').length,
      imported: rows.filter(r => r.status === 'IMPORTED').length,
    };
  }
  
  // API Monitoring - Logs
  async listApiLogs(limit: number = 100, offset: number = 0): Promise<ApiLog[]> {
    return db.select().from(apiLogs)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  async createApiLog(log: InsertApiLog): Promise<ApiLog> {
    const [created] = await db.insert(apiLogs).values(log).returning();
    return created;
  }
  
  async getApiLogStats(): Promise<{ total: number; errors: number; avgDuration: number }> {
    const logs = await db.select().from(apiLogs);
    const total = logs.length;
    const errors = logs.filter(l => l.statusCode >= 400).length;
    const avgDuration = total > 0 ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / total) : 0;
    return { total, errors, avgDuration };
  }
  
  // API Monitoring - Metrics
  async listApiMetrics(startDate?: string, endDate?: string): Promise<ApiMetric[]> {
    const conditions = [];
    if (startDate) conditions.push(gte(apiMetrics.date, startDate));
    if (endDate) conditions.push(lte(apiMetrics.date, endDate));
    
    if (conditions.length > 0) {
      return db.select().from(apiMetrics)
        .where(and(...conditions))
        .orderBy(desc(apiMetrics.date));
    }
    return db.select().from(apiMetrics).orderBy(desc(apiMetrics.date));
  }
  
  async getOrCreateApiMetric(endpoint: string, method: string, date: string): Promise<ApiMetric> {
    const [existing] = await db.select().from(apiMetrics)
      .where(and(
        eq(apiMetrics.endpoint, endpoint),
        eq(apiMetrics.method, method),
        eq(apiMetrics.date, date)
      ));
    
    if (existing) return existing;
    
    const [created] = await db.insert(apiMetrics).values({
      endpoint,
      method,
      date,
      requestCount: 0,
      errorCount: 0,
      avgDuration: 0,
      p95Duration: 0,
      minDuration: 0,
      maxDuration: 0,
    }).returning();
    return created;
  }
  
  async updateApiMetric(id: string, updates: Partial<ApiMetric>): Promise<ApiMetric | undefined> {
    const [updated] = await db.update(apiMetrics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiMetrics.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Webhooks - Endpoints
  async listWebhookEndpoints(organisationId: string): Promise<WebhookEndpoint[]> {
    return db.select().from(webhookEndpoints)
      .where(eq(webhookEndpoints.organisationId, organisationId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }
  
  async getWebhookEndpoint(id: string): Promise<WebhookEndpoint | undefined> {
    const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    return endpoint || undefined;
  }
  
  async createWebhookEndpoint(endpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint> {
    const [created] = await db.insert(webhookEndpoints).values(endpoint).returning();
    return created;
  }
  
  async updateWebhookEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | undefined> {
    const [updated] = await db.update(webhookEndpoints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteWebhookEndpoint(id: string): Promise<boolean> {
    const result = await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)).returning();
    return result.length > 0;
  }
  
  async getActiveWebhooksForEvent(eventType: string): Promise<WebhookEndpoint[]> {
    const endpoints = await db.select().from(webhookEndpoints)
      .where(eq(webhookEndpoints.status, 'ACTIVE'));
    return endpoints.filter(e => e.events.includes(eventType));
  }
  
  // Webhooks - Events
  async listWebhookEvents(limit: number = 100): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit);
  }
  
  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const [created] = await db.insert(webhookEvents).values(event).returning();
    return created;
  }
  
  async markWebhookEventProcessed(id: string): Promise<boolean> {
    const [updated] = await db.update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.id, id))
      .returning();
    return !!updated;
  }
  
  async getPendingWebhookEvents(): Promise<WebhookEvent[]> {
    return db.select().from(webhookEvents)
      .where(eq(webhookEvents.processed, false))
      .orderBy(webhookEvents.createdAt);
  }
  
  // Webhooks - Deliveries
  async listWebhookDeliveries(webhookEndpointId?: string, limit: number = 100): Promise<WebhookDelivery[]> {
    if (webhookEndpointId) {
      return db.select().from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookEndpointId, webhookEndpointId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);
    }
    return db.select().from(webhookDeliveries)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }
  
  async createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery> {
    const [created] = await db.insert(webhookDeliveries).values(delivery).returning();
    return created;
  }
  
  async updateWebhookDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | undefined> {
    const [updated] = await db.update(webhookDeliveries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Incoming Webhooks
  async listIncomingWebhookLogs(limit: number = 100): Promise<IncomingWebhookLog[]> {
    return db.select().from(incomingWebhookLogs)
      .orderBy(desc(incomingWebhookLogs.createdAt))
      .limit(limit);
  }
  
  async createIncomingWebhookLog(log: InsertIncomingWebhookLog): Promise<IncomingWebhookLog> {
    const [created] = await db.insert(incomingWebhookLogs).values(log).returning();
    return created;
  }
  
  async updateIncomingWebhookLog(id: string, updates: Partial<IncomingWebhookLog>): Promise<IncomingWebhookLog | undefined> {
    const [updated] = await db.update(incomingWebhookLogs)
      .set(updates)
      .where(eq(incomingWebhookLogs.id, id))
      .returning();
    return updated || undefined;
  }
  
  // API Keys
  async listApiKeys(organisationId: string): Promise<ApiKey[]> {
    return db.select().from(apiKeys)
      .where(eq(apiKeys.organisationId, organisationId))
      .orderBy(desc(apiKeys.createdAt));
  }
  
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key || undefined;
  }
  
  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));
    return key || undefined;
  }
  
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
  }
  
  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db.update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }
  
  // Videos
  async listVideos(organisationId: string): Promise<Video[]> {
    return db.select().from(videos)
      .where(eq(videos.organisationId, organisationId))
      .orderBy(desc(videos.createdAt));
  }
  
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }
  
  async createVideo(video: InsertVideo): Promise<Video> {
    const [created] = await db.insert(videos).values(video).returning();
    return created;
  }
  
  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined> {
    const [updated] = await db.update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }
  
  async incrementVideoView(id: string): Promise<void> {
    await db.update(videos)
      .set({ viewCount: sql`${videos.viewCount} + 1` })
      .where(eq(videos.id, id));
  }
  
  async incrementVideoDownload(id: string): Promise<void> {
    await db.update(videos)
      .set({ downloadCount: sql`${videos.downloadCount} + 1` })
      .where(eq(videos.id, id));
  }
  
  // AI Suggestions
  async listAiSuggestions(organisationId: string, status?: string): Promise<AiSuggestion[]> {
    if (status) {
      return db.select().from(aiSuggestions)
        .where(and(eq(aiSuggestions.organisationId, organisationId), eq(aiSuggestions.status, status as any)))
        .orderBy(desc(aiSuggestions.createdAt));
    }
    return db.select().from(aiSuggestions)
      .where(eq(aiSuggestions.organisationId, organisationId))
      .orderBy(desc(aiSuggestions.createdAt));
  }
  
  async getAiSuggestion(id: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id));
    return suggestion || undefined;
  }
  
  async getAiSuggestionByKey(organisationId: string, suggestionKey: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.organisationId, organisationId),
        eq(aiSuggestions.suggestionKey, suggestionKey)
      ));
    return suggestion || undefined;
  }
  
  async createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion> {
    const [created] = await db.insert(aiSuggestions).values(suggestion).returning();
    return created;
  }
  
  async updateAiSuggestion(id: string, updates: Partial<AiSuggestion>): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteAiSuggestion(id: string): Promise<boolean> {
    const result = await db.delete(aiSuggestions).where(eq(aiSuggestions.id, id)).returning();
    return result.length > 0;
  }
  
  async dismissAiSuggestion(id: string, reason?: string): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ 
        status: 'DISMISSED' as any,
        dismissedAt: new Date(),
        dismissReason: reason,
        updatedAt: new Date()
      })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async resolveAiSuggestion(id: string, userId?: string): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set({ 
        status: 'RESOLVED' as any,
        resolvedAt: new Date(),
        actionedById: userId,
        progressPercent: 100,
        updatedAt: new Date()
      })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async autoResolveAiSuggestions(organisationId: string): Promise<number> {
    const activeSuggestions = await db.select().from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.organisationId, organisationId),
        eq(aiSuggestions.status, 'ACTIVE' as any)
      ));
    
    let resolvedCount = 0;
    for (const suggestion of activeSuggestions) {
      if (suggestion.currentValue !== null && suggestion.targetValue !== null) {
        if (suggestion.currentValue >= suggestion.targetValue) {
          await db.update(aiSuggestions)
            .set({ 
              status: 'AUTO_RESOLVED' as any,
              resolvedAt: new Date(),
              progressPercent: 100,
              updatedAt: new Date()
            })
            .where(eq(aiSuggestions.id, suggestion.id));
          resolvedCount++;
        }
      }
    }
    return resolvedCount;
  }
  
  // Factory Settings
  async listFactorySettings(): Promise<FactorySetting[]> {
    return db.select().from(factorySettings).orderBy(factorySettings.category, factorySettings.key);
  }
  
  async getFactorySetting(key: string): Promise<FactorySetting | undefined> {
    const [setting] = await db.select().from(factorySettings).where(eq(factorySettings.key, key));
    return setting || undefined;
  }
  
  async getFactorySettingValue(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await this.getFactorySetting(key);
    return setting?.value ?? defaultValue;
  }
  
  async createFactorySetting(setting: InsertFactorySetting): Promise<FactorySetting> {
    const [created] = await db.insert(factorySettings).values(setting).returning();
    return created;
  }
  
  async updateFactorySetting(key: string, value: string, updatedById: string): Promise<FactorySetting | undefined> {
    const [updated] = await db.update(factorySettings)
      .set({ value, updatedById, updatedAt: new Date() })
      .where(eq(factorySettings.key, key))
      .returning();
    return updated || undefined;
  }
  
  async createFactorySettingsAudit(audit: InsertFactorySettingsAudit): Promise<FactorySettingsAudit> {
    const [created] = await db.insert(factorySettingsAudit).values(audit).returning();
    return created;
  }
  
  // API Clients
  async listApiClients(organisationId: string): Promise<ApiClient[]> {
    return db.select().from(apiClients)
      .where(eq(apiClients.organisationId, organisationId))
      .orderBy(desc(apiClients.createdAt));
  }
  
  async getApiClient(id: string): Promise<ApiClient | undefined> {
    const [client] = await db.select().from(apiClients).where(eq(apiClients.id, id));
    return client || undefined;
  }
  
  async getApiClientByKey(apiKeyPrefix: string): Promise<ApiClient | undefined> {
    const [client] = await db.select().from(apiClients).where(eq(apiClients.apiKeyPrefix, apiKeyPrefix));
    return client || undefined;
  }
  
  async createApiClient(client: InsertApiClient): Promise<ApiClient> {
    const [created] = await db.insert(apiClients).values(client).returning();
    return created;
  }
  
  async updateApiClient(id: string, updates: Partial<ApiClient>): Promise<ApiClient | undefined> {
    const [updated] = await db.update(apiClients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiClients.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteApiClient(id: string): Promise<boolean> {
    const result = await db.delete(apiClients).where(eq(apiClients.id, id)).returning();
    return result.length > 0;
  }
  
  async incrementApiClientUsage(id: string): Promise<void> {
    await db.update(apiClients)
      .set({ 
        lastUsedAt: new Date(),
        requestCount: sql`${apiClients.requestCount} + 1`
      })
      .where(eq(apiClients.id, id));
  }
  
  // Upload Sessions
  async listUploadSessions(organisationId: string): Promise<UploadSession[]> {
    return db.select().from(uploadSessions)
      .where(eq(uploadSessions.organisationId, organisationId))
      .orderBy(desc(uploadSessions.createdAt));
  }
  
  async getUploadSession(id: string): Promise<UploadSession | undefined> {
    const [session] = await db.select().from(uploadSessions).where(eq(uploadSessions.id, id));
    return session || undefined;
  }
  
  async getUploadSessionByIdempotencyKey(key: string): Promise<UploadSession | undefined> {
    const [session] = await db.select().from(uploadSessions).where(eq(uploadSessions.idempotencyKey, key));
    return session || undefined;
  }
  
  async createUploadSession(session: InsertUploadSession): Promise<UploadSession> {
    const [created] = await db.insert(uploadSessions).values(session).returning();
    return created;
  }
  
  async updateUploadSession(id: string, updates: Partial<UploadSession>): Promise<UploadSession | undefined> {
    const [updated] = await db.update(uploadSessions)
      .set(updates)
      .where(eq(uploadSessions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async cleanupExpiredUploadSessions(): Promise<number> {
    const result = await db.delete(uploadSessions)
      .where(and(
        eq(uploadSessions.status, 'PENDING' as any),
        lte(uploadSessions.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }
  
  // Ingestion Jobs
  async listIngestionJobs(organisationId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    if (filters?.status) {
      return db.select().from(ingestionJobs)
        .where(and(
          eq(ingestionJobs.organisationId, organisationId),
          eq(ingestionJobs.status, filters.status as any)
        ))
        .orderBy(desc(ingestionJobs.createdAt))
        .limit(limit)
        .offset(offset);
    }
    return db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.organisationId, organisationId))
      .orderBy(desc(ingestionJobs.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  async getIngestionJob(id: string): Promise<IngestionJob | undefined> {
    const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, id));
    return job || undefined;
  }
  
  async getIngestionJobByIdempotencyKey(key: string): Promise<IngestionJob | undefined> {
    const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.idempotencyKey, key));
    return job || undefined;
  }
  
  async createIngestionJob(job: InsertIngestionJob): Promise<IngestionJob> {
    const [created] = await db.insert(ingestionJobs).values(job).returning();
    return created;
  }
  
  async updateIngestionJob(id: string, updates: Partial<IngestionJob>): Promise<IngestionJob | undefined> {
    const [updated] = await db.update(ingestionJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ingestionJobs.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getNextPendingIngestionJob(): Promise<IngestionJob | undefined> {
    const [job] = await db.select().from(ingestionJobs)
      .where(eq(ingestionJobs.status, 'QUEUED' as any))
      .orderBy(ingestionJobs.createdAt)
      .limit(1);
    return job || undefined;
  }

  async listAllIngestionJobs(filters?: { status?: string; limit?: number; offset?: number }): Promise<IngestionJob[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    if (filters?.status) {
      return db.select().from(ingestionJobs)
        .where(eq(ingestionJobs.status, filters.status as any))
        .orderBy(desc(ingestionJobs.createdAt))
        .limit(limit)
        .offset(offset);
    }
    return db.select().from(ingestionJobs)
      .orderBy(desc(ingestionJobs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async deleteIngestionJobsByChannel(channel: string): Promise<number> {
    const deleted = await db.delete(ingestionJobs)
      .where(eq(ingestionJobs.channel, channel as any))
      .returning();
    return deleted.length;
  }

  async getIngestionStats(): Promise<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    recentErrors: IngestionJob[];
    throughputByHour: Array<{ hour: string; count: number }>;
    avgProcessingTime: number;
    successRate: number;
  }> {
    const allJobs = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt));
    
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalProcessingTime = 0;
    let processedCount = 0;
    
    for (const job of allJobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      byType[job.certificateType] = (byType[job.certificateType] || 0) + 1;
      byChannel[job.channel || 'MANUAL_UPLOAD'] = (byChannel[job.channel || 'MANUAL_UPLOAD'] || 0) + 1;
      
      if (job.status === 'COMPLETE') {
        totalCompleted++;
        if (job.completedAt && job.createdAt) {
          totalProcessingTime += new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime();
          processedCount++;
        }
      } else if (job.status === 'FAILED') {
        totalFailed++;
      }
    }
    
    const recentErrors = allJobs
      .filter(j => j.status === 'FAILED')
      .slice(0, 20);
    
    const hourCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = hour.toISOString().slice(0, 13);
      hourCounts[hourKey] = 0;
    }
    
    for (const job of allJobs) {
      const hourKey = new Date(job.createdAt).toISOString().slice(0, 13);
      if (hourCounts.hasOwnProperty(hourKey)) {
        hourCounts[hourKey]++;
      }
    }
    
    const throughputByHour = Object.entries(hourCounts).map(([hour, count]) => ({ hour, count }));
    
    const total = totalCompleted + totalFailed;
    const successRate = total > 0 ? (totalCompleted / total) * 100 : 0;
    const avgProcessingTime = processedCount > 0 ? totalProcessingTime / processedCount / 1000 : 0;
    
    return {
      byStatus,
      byType,
      byChannel,
      recentErrors,
      throughputByHour,
      avgProcessingTime,
      successRate,
    };
  }

  async checkAndIncrementRateLimit(clientId: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    const [existing] = await db.select().from(rateLimitEntries)
      .where(and(
        eq(rateLimitEntries.clientId, clientId),
        gte(rateLimitEntries.windowResetAt, now)
      ))
      .limit(1);
    
    if (existing) {
      if (existing.requestCount >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: existing.windowResetAt
        };
      }
      
      await db.update(rateLimitEntries)
        .set({ 
          requestCount: existing.requestCount + 1,
          updatedAt: now
        })
        .where(eq(rateLimitEntries.id, existing.id));
      
      return {
        allowed: true,
        remaining: limit - existing.requestCount - 1,
        resetAt: existing.windowResetAt
      };
    }
    
    const resetAt = new Date(now.getTime() + windowMs);
    await db.insert(rateLimitEntries).values({
      clientId,
      requestCount: 1,
      windowStart: now,
      windowResetAt: resetAt
    });
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt
    };
  }

  async cleanupExpiredRateLimits(): Promise<number> {
    const result = await db.delete(rateLimitEntries)
      .where(lte(rateLimitEntries.windowResetAt, new Date()))
      .returning();
    return result.length;
  }

  async getSystemLogs(filters: { level?: string; source?: string; search?: string; limit: number; offset: number }): Promise<{ logs: SystemLog[]; total: number }> {
    const conditions = [];
    
    if (filters.level) {
      conditions.push(eq(systemLogs.level, filters.level as any));
    }
    if (filters.source) {
      conditions.push(eq(systemLogs.source, filters.source as any));
    }
    if (filters.search) {
      conditions.push(ilike(systemLogs.message, `%${filters.search}%`));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(systemLogs)
      .where(whereClause);
    
    const logs = await db.select()
      .from(systemLogs)
      .where(whereClause)
      .orderBy(desc(systemLogs.timestamp))
      .limit(filters.limit)
      .offset(filters.offset);
    
    return {
      logs,
      total: totalResult?.count ?? 0
    };
  }
  // Risk Maps - Geodata
  async listGeocodedProperties(organisationId: string): Promise<Property[]> {
    return db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(and(
        eq(schemes.organisationId, organisationId),
        isNotNull(properties.latitude),
        isNotNull(properties.longitude)
      ))
      .then(rows => rows.map(r => r.properties));
  }
  
  async updatePropertyGeodata(propertyId: string, geodata: { latitude: number; longitude: number; ward?: string; wardCode?: string; lsoa?: string; msoa?: string }): Promise<Property | undefined> {
    const [updated] = await db.update(properties)
      .set({
        latitude: geodata.latitude,
        longitude: geodata.longitude,
        ward: geodata.ward,
        wardCode: geodata.wardCode,
        lsoa: geodata.lsoa,
        msoa: geodata.msoa,
        geocodedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(properties.id, propertyId))
      .returning();
    return updated || undefined;
  }
  
  async getPropertyRiskData(organisationId: string): Promise<Array<{
    property: Property;
    certificates: Array<{ type: string; status: string; expiryDate: string | null }>;
    actions: Array<{ severity: string; status: string }>;
  }>> {
    const allProperties = await db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId));
    
    const result = [];
    for (const row of allProperties) {
      const prop = row.properties;
      
      const certs = await db.select({
        type: certificates.certificateType,
        status: certificates.status,
        expiryDate: certificates.expiryDate
      })
      .from(certificates)
      .where(eq(certificates.propertyId, prop.id));
      
      const actions = await db.select({
        severity: remedialActions.severity,
        status: remedialActions.status
      })
      .from(remedialActions)
      .where(eq(remedialActions.propertyId, prop.id));
      
      result.push({
        property: prop,
        certificates: certs,
        actions
      });
    }
    
    return result;
  }
  
  // Audit Trail Implementation
  async recordAuditEvent(event: InsertAuditEvent): Promise<AuditEvent> {
    const [created] = await db.insert(auditEvents).values(event).returning();
    return created;
  }
  
  async listAuditEvents(organisationId: string, filters?: { 
    entityType?: string; 
    entityId?: string; 
    eventType?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const conditions = [eq(auditEvents.organisationId, organisationId)];
    
    if (filters?.entityType) {
      conditions.push(eq(auditEvents.entityType, filters.entityType as any));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditEvents.entityId, filters.entityId));
    }
    if (filters?.eventType) {
      conditions.push(eq(auditEvents.eventType, filters.eventType as any));
    }
    if (filters?.actorId) {
      conditions.push(eq(auditEvents.actorId, filters.actorId));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditEvents.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditEvents.createdAt, filters.endDate));
    }
    
    const [{ total }] = await db.select({ total: count() })
      .from(auditEvents)
      .where(and(...conditions));
    
    const events = await db.select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    
    return { events, total: Number(total) };
  }
  
  async getEntityAuditHistory(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.entityType, entityType as any),
        eq(auditEvents.entityId, entityId)
      ))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);
  }
  
  async getEntityAuditHistoryForOrg(entityType: string, entityId: string, organisationId: string): Promise<AuditEvent[]> {
    return db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.entityType, entityType as any),
        eq(auditEvents.entityId, entityId),
        eq(auditEvents.organisationId, organisationId)
      ))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);
  }
  
  // Detection Patterns Implementation
  async listDetectionPatterns(filters?: { certificateTypeCode?: string; patternType?: string; isActive?: boolean }): Promise<DetectionPattern[]> {
    const conditions: any[] = [];
    
    if (filters?.certificateTypeCode) {
      conditions.push(eq(certificateDetectionPatterns.certificateTypeCode, filters.certificateTypeCode));
    }
    if (filters?.patternType) {
      conditions.push(eq(certificateDetectionPatterns.patternType, filters.patternType as any));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(certificateDetectionPatterns.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      return db.select()
        .from(certificateDetectionPatterns)
        .where(and(...conditions))
        .orderBy(desc(certificateDetectionPatterns.priority));
    }
    
    return db.select()
      .from(certificateDetectionPatterns)
      .orderBy(desc(certificateDetectionPatterns.priority));
  }
  
  async getDetectionPattern(id: string): Promise<DetectionPattern | undefined> {
    const [pattern] = await db.select()
      .from(certificateDetectionPatterns)
      .where(eq(certificateDetectionPatterns.id, id));
    return pattern || undefined;
  }
  
  async createDetectionPattern(pattern: InsertDetectionPattern): Promise<DetectionPattern> {
    const [created] = await db.insert(certificateDetectionPatterns).values(pattern).returning();
    return created;
  }
  
  async updateDetectionPattern(id: string, updates: Partial<InsertDetectionPattern>): Promise<DetectionPattern | undefined> {
    const [updated] = await db.update(certificateDetectionPatterns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateDetectionPatterns.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteDetectionPattern(id: string): Promise<boolean> {
    const result = await db.delete(certificateDetectionPatterns)
      .where(and(eq(certificateDetectionPatterns.id, id), eq(certificateDetectionPatterns.isSystem, false)))
      .returning();
    return result.length > 0;
  }
  
  // Outcome Rules Implementation
  async listOutcomeRules(filters?: { certificateTypeCode?: string; ruleGroup?: string; isActive?: boolean }): Promise<OutcomeRule[]> {
    const conditions: any[] = [];
    
    if (filters?.certificateTypeCode) {
      conditions.push(eq(certificateOutcomeRules.certificateTypeCode, filters.certificateTypeCode));
    }
    if (filters?.ruleGroup) {
      conditions.push(eq(certificateOutcomeRules.ruleGroup, filters.ruleGroup));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(certificateOutcomeRules.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      return db.select()
        .from(certificateOutcomeRules)
        .where(and(...conditions))
        .orderBy(desc(certificateOutcomeRules.priority));
    }
    
    return db.select()
      .from(certificateOutcomeRules)
      .orderBy(desc(certificateOutcomeRules.priority));
  }
  
  async getOutcomeRule(id: string): Promise<OutcomeRule | undefined> {
    const [rule] = await db.select()
      .from(certificateOutcomeRules)
      .where(eq(certificateOutcomeRules.id, id));
    return rule || undefined;
  }
  
  async createOutcomeRule(rule: InsertOutcomeRule): Promise<OutcomeRule> {
    const [created] = await db.insert(certificateOutcomeRules).values(rule).returning();
    return created;
  }
  
  async updateOutcomeRule(id: string, updates: Partial<InsertOutcomeRule>): Promise<OutcomeRule | undefined> {
    const [updated] = await db.update(certificateOutcomeRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateOutcomeRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteOutcomeRule(id: string): Promise<boolean> {
    const result = await db.delete(certificateOutcomeRules)
      .where(and(eq(certificateOutcomeRules.id, id), eq(certificateOutcomeRules.isSystem, false)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
