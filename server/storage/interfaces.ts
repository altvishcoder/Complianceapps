import {
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
  type Space, type InsertSpace,
  type Component, type InsertComponent,
  type ComponentCertificate, type InsertComponentCertificate,
  type DataImport, type InsertDataImport,
  type DataImportRow, type InsertDataImportRow,
  type ApiLog, type InsertApiLog,
  type ApiMetric,
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
  type IngestionBatch, type InsertIngestionBatch,
  type SystemLog,
  type AuditEvent, type InsertAuditEvent,
  type DetectionPattern, type InsertDetectionPattern,
  type OutcomeRule, type InsertOutcomeRule,
  type CertificateVersion, type InsertCertificateVersion,
  type AuditFieldChange, type InsertAuditFieldChange,
  type UkhdsExport, type InsertUkhdsExport,
  type ComplianceCalendarEvent, type InsertComplianceCalendarEvent,
  type StaffMember, type InsertStaffMember,
  type NavigationSection, type InsertNavigationSection,
  type NavigationItem, type InsertNavigationItem,
  type IconRegistry, type InsertIconRegistry,
  type HazardCase, type InsertHazardCase,
  type HazardAction, type InsertHazardAction,
  type TenantCommunication, type InsertTenantCommunication,
  type Household, type InsertHousehold,
  type Tenant, type InsertTenant,
  type ServiceRequest, type InsertServiceRequest,
  type TsmMeasure, type InsertTsmMeasure,
  type TsmSnapshot, type InsertTsmSnapshot,
  type BuildingSafetyProfile, type InsertBuildingSafetyProfile,
  type SafetyCaseReview, type InsertSafetyCaseReview,
  type MandatoryOccurrenceReport, type InsertMandatoryOccurrenceReport,
  type GasApplianceRecord, type InsertGasApplianceRecord,
  type ElectricalCircuitRecord, type InsertElectricalCircuitRecord,
  type FireSystemRecord, type InsertFireSystemRecord,
  type AsbestosSurveyRecord, type InsertAsbestosSurveyRecord,
  type WaterTemperatureRecord, type InsertWaterTemperatureRecord
} from "@shared/schema";

export interface IUsersStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(organisationId: string): Promise<User[]>;
  updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined>;
  getSuperAdmin(organisationId: string): Promise<User | undefined>;
}

export interface IPropertiesStorage {
  getOrganisation(id: string): Promise<Organisation | undefined>;
  createOrganisation(org: InsertOrganisation): Promise<Organisation>;
  listOrganisations(): Promise<Organisation[]>;
  updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined>;
  deleteOrganisation(id: string): Promise<boolean>;
  
  getHierarchyStats(): Promise<{
    organisations: number;
    schemes: number;
    blocks: number;
    properties: number;
    spaces: number;
    components: number;
  }>;
  
  listSchemes(organisationId: string): Promise<Scheme[]>;
  getScheme(id: string): Promise<Scheme | undefined>;
  createScheme(scheme: InsertScheme): Promise<Scheme>;
  updateScheme(id: string, updates: Partial<InsertScheme>): Promise<Scheme | undefined>;
  deleteScheme(id: string): Promise<boolean>;
  
  listBlocks(schemeId?: string): Promise<Block[]>;
  getBlock(id: string): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  updateBlock(id: string, updates: Partial<InsertBlock>): Promise<Block | undefined>;
  deleteBlock(id: string): Promise<boolean>;
  
  listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  bulkDeleteProperties(ids: string[]): Promise<number>;
  bulkVerifyProperties(ids: string[]): Promise<number>;
  bulkRejectProperties(ids: string[]): Promise<number>;
  getOrCreateAutoProperty(organisationId: string, addressData: { addressLine1: string; city?: string; postcode?: string }): Promise<Property>;
  
  listIngestionBatches(organisationId: string): Promise<IngestionBatch[]>;
  getIngestionBatch(id: string): Promise<IngestionBatch | undefined>;
  createIngestionBatch(batch: InsertIngestionBatch): Promise<IngestionBatch>;
  updateIngestionBatch(id: string, updates: Partial<InsertIngestionBatch>): Promise<IngestionBatch | undefined>;
  
  listGeocodedProperties(organisationId: string): Promise<Property[]>;
  updatePropertyGeodata(propertyId: string, geodata: { latitude: number; longitude: number; ward?: string; wardCode?: string; lsoa?: string; msoa?: string }): Promise<Property | undefined>;
  
  getPropertyRiskData(organisationId: string): Promise<Array<{
    property: Property;
    certificates: Array<{ type: string; status: string; expiryDate: string | null }>;
    actions: Array<{ severity: string; status: string }>;
  }>>;
}

export interface ICertificatesStorage {
  listCertificates(organisationId: string, filters?: { propertyId?: string; status?: string }): Promise<Certificate[]>;
  listCertificatesCursor(organisationId: string, options: { propertyId?: string; status?: string | string[]; search?: string; limit: number; cursor?: string }): Promise<{ data: (Certificate & { property?: Property; extraction?: Extraction })[]; nextCursor: string | null; hasMore: boolean }>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  findAndFailStuckCertificates(timeoutMinutes: number): Promise<Certificate[]>;
  deleteCertificate(id: string): Promise<boolean>;
  
  getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined>;
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  
  listCertificateVersions(certificateId: string): Promise<CertificateVersion[]>;
  getCertificateVersion(id: string): Promise<CertificateVersion | undefined>;
  createCertificateVersion(version: InsertCertificateVersion): Promise<CertificateVersion>;
  supersedeCertificateVersion(id: string, supersededById: string, reason?: string): Promise<CertificateVersion | undefined>;
  
  listAuditFieldChanges(auditEventId: string): Promise<AuditFieldChange[]>;
  createAuditFieldChange(change: InsertAuditFieldChange): Promise<AuditFieldChange>;
  createAuditFieldChanges(changes: InsertAuditFieldChange[]): Promise<AuditFieldChange[]>;
  
  listUkhdsExports(organisationId: string): Promise<UkhdsExport[]>;
  getUkhdsExport(id: string): Promise<UkhdsExport | undefined>;
  createUkhdsExport(exportJob: InsertUkhdsExport): Promise<UkhdsExport>;
  updateUkhdsExport(id: string, updates: Partial<InsertUkhdsExport>): Promise<UkhdsExport | undefined>;
  
  listCalendarEvents(organisationId: string, filters?: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string }): Promise<ComplianceCalendarEvent[]>;
  getCalendarEvent(id: string): Promise<ComplianceCalendarEvent | undefined>;
  createCalendarEvent(event: InsertComplianceCalendarEvent): Promise<ComplianceCalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertComplianceCalendarEvent>): Promise<ComplianceCalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  getUpcomingEvents(organisationId: string, daysAhead: number): Promise<ComplianceCalendarEvent[]>;
  
  listDetectionPatterns(filters?: { certificateTypeCode?: string; patternType?: string; isActive?: boolean }): Promise<DetectionPattern[]>;
  getDetectionPattern(id: string): Promise<DetectionPattern | undefined>;
  createDetectionPattern(pattern: InsertDetectionPattern): Promise<DetectionPattern>;
  updateDetectionPattern(id: string, updates: Partial<InsertDetectionPattern>): Promise<DetectionPattern | undefined>;
  deleteDetectionPattern(id: string): Promise<boolean>;
  
  listOutcomeRules(filters?: { certificateTypeCode?: string; ruleGroup?: string; isActive?: boolean }): Promise<OutcomeRule[]>;
  getOutcomeRule(id: string): Promise<OutcomeRule | undefined>;
  createOutcomeRule(rule: InsertOutcomeRule): Promise<OutcomeRule>;
  updateOutcomeRule(id: string, updates: Partial<InsertOutcomeRule>): Promise<OutcomeRule | undefined>;
  deleteOutcomeRule(id: string): Promise<boolean>;
  
  listGasApplianceRecords(certificateId: string): Promise<GasApplianceRecord[]>;
  createGasApplianceRecord(record: InsertGasApplianceRecord): Promise<GasApplianceRecord>;
  bulkCreateGasApplianceRecords(records: InsertGasApplianceRecord[]): Promise<GasApplianceRecord[]>;
  
  listElectricalCircuitRecords(certificateId: string): Promise<ElectricalCircuitRecord[]>;
  createElectricalCircuitRecord(record: InsertElectricalCircuitRecord): Promise<ElectricalCircuitRecord>;
  bulkCreateElectricalCircuitRecords(records: InsertElectricalCircuitRecord[]): Promise<ElectricalCircuitRecord[]>;
  
  listFireSystemRecords(certificateId: string): Promise<FireSystemRecord[]>;
  createFireSystemRecord(record: InsertFireSystemRecord): Promise<FireSystemRecord>;
  bulkCreateFireSystemRecords(records: InsertFireSystemRecord[]): Promise<FireSystemRecord[]>;
  
  listAsbestosSurveyRecords(certificateId: string): Promise<AsbestosSurveyRecord[]>;
  createAsbestosSurveyRecord(record: InsertAsbestosSurveyRecord): Promise<AsbestosSurveyRecord>;
  bulkCreateAsbestosSurveyRecords(records: InsertAsbestosSurveyRecord[]): Promise<AsbestosSurveyRecord[]>;
  
  listWaterTemperatureRecords(filters?: { propertyId?: string; blockId?: string; certificateId?: string }): Promise<WaterTemperatureRecord[]>;
  createWaterTemperatureRecord(record: InsertWaterTemperatureRecord): Promise<WaterTemperatureRecord>;
  bulkCreateWaterTemperatureRecords(records: InsertWaterTemperatureRecord[]): Promise<WaterTemperatureRecord[]>;
}

export interface IRemedialsStorage {
  listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]>;
  listRemedialActionsPaginated(organisationId: string, options: {
    limit: number;
    offset: number;
    status?: string;
    severity?: string;
    search?: string;
    overdue?: boolean;
    propertyId?: string;
    awaabs?: boolean;
    phase?: number;
    certificateType?: string;
    excludeCompleted?: boolean;
  }): Promise<{ items: RemedialAction[]; total: number }>;
  getRemedialAction(id: string): Promise<RemedialAction | undefined>;
  createRemedialAction(action: InsertRemedialAction): Promise<RemedialAction>;
  updateRemedialAction(id: string, updates: Partial<InsertRemedialAction>): Promise<RemedialAction | undefined>;
}

export interface IContractorsStorage {
  listContractors(organisationId: string): Promise<Contractor[]>;
  getContractor(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor | undefined>;
  updateContractorStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'): Promise<Contractor | undefined>;
  bulkApproveContractors(ids: string[]): Promise<number>;
  bulkRejectContractors(ids: string[]): Promise<number>;
  
  listContractorCertifications(organisationId: string, contractorId?: string): Promise<ContractorCertification[]>;
  getContractorCertification(id: string): Promise<ContractorCertification | undefined>;
  createContractorCertification(certification: InsertContractorCertification): Promise<ContractorCertification>;
  updateContractorCertification(id: string, updates: Partial<InsertContractorCertification>): Promise<ContractorCertification | undefined>;
  deleteContractorCertification(id: string): Promise<boolean>;
  
  listContractorVerificationHistory(contractorId: string): Promise<ContractorVerificationHistory[]>;
  createContractorVerificationHistory(history: InsertContractorVerificationHistory): Promise<ContractorVerificationHistory>;
  
  listContractorAlerts(organisationId: string, filters?: { contractorId?: string; status?: string }): Promise<ContractorAlert[]>;
  getContractorAlert(id: string): Promise<ContractorAlert | undefined>;
  createContractorAlert(alert: InsertContractorAlert): Promise<ContractorAlert>;
  updateContractorAlert(id: string, updates: Partial<InsertContractorAlert>): Promise<ContractorAlert | undefined>;
  
  listContractorAssignments(organisationId: string, filters?: { contractorId?: string; propertyId?: string; status?: string }): Promise<ContractorAssignment[]>;
  getContractorAssignment(id: string): Promise<ContractorAssignment | undefined>;
  createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment>;
  updateContractorAssignment(id: string, updates: Partial<InsertContractorAssignment>): Promise<ContractorAssignment | undefined>;
  
  listStaffMembers(organisationId: string, filters?: { status?: string; department?: string }): Promise<StaffMember[]>;
  getStaffMember(id: string): Promise<StaffMember | undefined>;
  createStaffMember(staff: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(id: string, updates: Partial<InsertStaffMember>): Promise<StaffMember | undefined>;
  deleteStaffMember(id: string): Promise<boolean>;
  bulkCreateStaffMembers(staffList: InsertStaffMember[]): Promise<StaffMember[]>;
}

export interface IConfigurationStorage {
  listComplianceStreams(): Promise<ComplianceStream[]>;
  getComplianceStream(id: string): Promise<ComplianceStream | undefined>;
  getComplianceStreamByCode(code: string): Promise<ComplianceStream | undefined>;
  createComplianceStream(stream: InsertComplianceStream): Promise<ComplianceStream>;
  updateComplianceStream(id: string, updates: Partial<InsertComplianceStream>): Promise<ComplianceStream | undefined>;
  deleteComplianceStream(id: string): Promise<boolean>;
  
  listCertificateTypes(): Promise<CertificateType[]>;
  getCertificateType(id: string): Promise<CertificateType | undefined>;
  getCertificateTypeByCode(code: string): Promise<CertificateType | undefined>;
  createCertificateType(certType: InsertCertificateType): Promise<CertificateType>;
  updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined>;
  deleteCertificateType(id: string): Promise<boolean>;
  
  listClassificationCodes(filters?: { certificateTypeId?: string; complianceStreamId?: string }): Promise<ClassificationCode[]>;
  getClassificationCode(id: string): Promise<ClassificationCode | undefined>;
  getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined>;
  createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode>;
  updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined>;
  deleteClassificationCode(id: string): Promise<boolean>;
  
  listExtractionSchemas(filters?: { complianceStreamId?: string }): Promise<ExtractionSchema[]>;
  getExtractionSchema(id: string): Promise<ExtractionSchema | undefined>;
  createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema>;
  updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined>;
  deleteExtractionSchema(id: string): Promise<boolean>;
  
  listComplianceRules(filters?: { complianceStreamId?: string }): Promise<ComplianceRule[]>;
  getComplianceRule(id: string): Promise<ComplianceRule | undefined>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined>;
  deleteComplianceRule(id: string): Promise<boolean>;
  
  listNormalisationRules(filters?: { complianceStreamId?: string }): Promise<NormalisationRule[]>;
  getNormalisationRule(id: string): Promise<NormalisationRule | undefined>;
  createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule>;
  updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined>;
  deleteNormalisationRule(id: string): Promise<boolean>;
}

export interface IComponentsStorage {
  listComponentTypes(): Promise<ComponentType[]>;
  getComponentType(id: string): Promise<ComponentType | undefined>;
  createComponentType(componentType: InsertComponentType): Promise<ComponentType>;
  updateComponentType(id: string, updates: Partial<InsertComponentType>): Promise<ComponentType | undefined>;
  deleteComponentType(id: string): Promise<boolean>;
  
  listSpaces(filters?: { propertyId?: string; blockId?: string; schemeId?: string }): Promise<Space[]>;
  getSpace(id: string): Promise<Space | undefined>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, updates: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;
  
  listComponents(filters?: { propertyId?: string; spaceId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(id: string): Promise<boolean>;
  bulkCreateComponents(components: InsertComponent[]): Promise<Component[]>;
  
  listComponentCertificates(componentId?: string, certificateId?: string): Promise<ComponentCertificate[]>;
  createComponentCertificate(link: InsertComponentCertificate): Promise<ComponentCertificate>;
  deleteComponentCertificate(id: string): Promise<boolean>;
  
  listDataImports(organisationId: string): Promise<DataImport[]>;
  getDataImport(id: string): Promise<DataImport | undefined>;
  createDataImport(dataImport: InsertDataImport): Promise<DataImport>;
  updateDataImport(id: string, updates: Partial<InsertDataImport>): Promise<DataImport | undefined>;
  deleteDataImport(id: string): Promise<boolean>;
  
  listDataImportRows(importId: string): Promise<DataImportRow[]>;
  createDataImportRow(row: InsertDataImportRow): Promise<DataImportRow>;
  bulkCreateDataImportRows(rows: InsertDataImportRow[]): Promise<DataImportRow[]>;
  updateDataImportRow(id: string, updates: Partial<InsertDataImportRow>): Promise<DataImportRow | undefined>;
  getDataImportRowCounts(importId: string): Promise<{ total: number; valid: number; invalid: number; imported: number }>;
}

export interface IApiStorage {
  listApiLogs(limit?: number, offset?: number): Promise<ApiLog[]>;
  createApiLog(log: InsertApiLog): Promise<ApiLog>;
  getApiLogStats(): Promise<{ total: number; errors: number; avgDuration: number }>;
  
  listApiMetrics(startDate?: string, endDate?: string): Promise<ApiMetric[]>;
  getOrCreateApiMetric(endpoint: string, method: string, date: string): Promise<ApiMetric>;
  updateApiMetric(id: string, updates: Partial<ApiMetric>): Promise<ApiMetric | undefined>;
  
  listWebhookEndpoints(organisationId: string): Promise<WebhookEndpoint[]>;
  getWebhookEndpoint(id: string): Promise<WebhookEndpoint | undefined>;
  createWebhookEndpoint(endpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint>;
  updateWebhookEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | undefined>;
  deleteWebhookEndpoint(id: string): Promise<boolean>;
  getActiveWebhooksForEvent(eventType: string): Promise<WebhookEndpoint[]>;
  
  listWebhookEvents(limit?: number): Promise<WebhookEvent[]>;
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;
  markWebhookEventProcessed(id: string): Promise<boolean>;
  getPendingWebhookEvents(): Promise<WebhookEvent[]>;
  
  listWebhookDeliveries(webhookEndpointId?: string, limit?: number): Promise<WebhookDelivery[]>;
  createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery>;
  updateWebhookDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | undefined>;
  
  listIncomingWebhookLogs(limit?: number): Promise<IncomingWebhookLog[]>;
  createIncomingWebhookLog(log: InsertIncomingWebhookLog): Promise<IncomingWebhookLog>;
  updateIncomingWebhookLog(id: string, updates: Partial<IncomingWebhookLog>): Promise<IncomingWebhookLog | undefined>;
  
  listApiKeys(organisationId: string): Promise<ApiKey[]>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  
  listApiClients(organisationId: string): Promise<ApiClient[]>;
  getApiClient(id: string): Promise<ApiClient | undefined>;
  getApiClientByKey(apiKeyPrefix: string): Promise<ApiClient | undefined>;
  createApiClient(client: InsertApiClient): Promise<ApiClient>;
  updateApiClient(id: string, updates: Partial<ApiClient>): Promise<ApiClient | undefined>;
  deleteApiClient(id: string): Promise<boolean>;
  incrementApiClientUsage(id: string): Promise<void>;
  
  listUploadSessions(organisationId: string): Promise<UploadSession[]>;
  getUploadSession(id: string): Promise<UploadSession | undefined>;
  getUploadSessionByIdempotencyKey(key: string): Promise<UploadSession | undefined>;
  createUploadSession(session: InsertUploadSession): Promise<UploadSession>;
  updateUploadSession(id: string, updates: Partial<UploadSession>): Promise<UploadSession | undefined>;
  cleanupExpiredUploadSessions(): Promise<number>;
  
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
  
  checkAndIncrementRateLimit(clientId: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
  cleanupExpiredRateLimits(): Promise<number>;
  
  listVideos(organisationId: string): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;
  incrementVideoView(id: string): Promise<void>;
  incrementVideoDownload(id: string): Promise<void>;
  
  listAiSuggestions(organisationId: string, status?: string): Promise<AiSuggestion[]>;
  getAiSuggestion(id: string): Promise<AiSuggestion | undefined>;
  getAiSuggestionByKey(organisationId: string, suggestionKey: string): Promise<AiSuggestion | undefined>;
  createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion>;
  updateAiSuggestion(id: string, updates: Partial<AiSuggestion>): Promise<AiSuggestion | undefined>;
  deleteAiSuggestion(id: string): Promise<boolean>;
  dismissAiSuggestion(id: string, reason?: string): Promise<AiSuggestion | undefined>;
  resolveAiSuggestion(id: string, userId?: string): Promise<AiSuggestion | undefined>;
  autoResolveAiSuggestions(organisationId: string): Promise<number>;
}

export interface ISystemStorage {
  listFactorySettings(): Promise<FactorySetting[]>;
  getFactorySetting(key: string): Promise<FactorySetting | undefined>;
  getFactorySettingValue(key: string, defaultValue?: string): Promise<string>;
  createFactorySetting(setting: InsertFactorySetting): Promise<FactorySetting>;
  updateFactorySetting(key: string, value: string, updatedById: string): Promise<FactorySetting | undefined>;
  createFactorySettingsAudit(audit: InsertFactorySettingsAudit): Promise<FactorySettingsAudit>;
  
  getSystemLogs(filters: { level?: string; source?: string; search?: string; limit: number; offset: number }): Promise<{ logs: SystemLog[]; total: number }>;
  
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
  
  listNavigationSections(organisationId?: string): Promise<NavigationSection[]>;
  getNavigationSection(id: string): Promise<NavigationSection | undefined>;
  createNavigationSection(section: InsertNavigationSection): Promise<NavigationSection>;
  updateNavigationSection(id: string, updates: Partial<InsertNavigationSection>): Promise<NavigationSection | undefined>;
  deleteNavigationSection(id: string): Promise<boolean>;
  
  listNavigationItems(sectionId?: string): Promise<NavigationItem[]>;
  getNavigationItem(id: string): Promise<NavigationItem | undefined>;
  createNavigationItem(item: InsertNavigationItem): Promise<NavigationItem>;
  updateNavigationItem(id: string, updates: Partial<InsertNavigationItem>): Promise<NavigationItem | undefined>;
  deleteNavigationItem(id: string): Promise<boolean>;
  
  getNavigationWithItems(organisationId?: string): Promise<Array<NavigationSection & { items: NavigationItem[] }>>;
  listNavigationItemsWithRoles(sectionId?: string): Promise<Array<NavigationItem & { roles: string[] }>>;
  getNavigationItemRoles(itemId: string): Promise<string[]>;
  setNavigationItemRoles(itemId: string, roles: string[]): Promise<void>;
  
  listIconRegistry(): Promise<IconRegistry[]>;
  createIconRegistryEntry(entry: InsertIconRegistry): Promise<IconRegistry>;
  
  listHazardCases(organisationId: string, filters?: { status?: string; severity?: string; propertyId?: string }): Promise<HazardCase[]>;
  getHazardCase(id: string, organisationId?: string): Promise<HazardCase | undefined>;
  createHazardCase(hazard: InsertHazardCase): Promise<HazardCase>;
  updateHazardCase(id: string, updates: Partial<InsertHazardCase>): Promise<HazardCase | undefined>;
  
  listHazardActions(hazardCaseId: string): Promise<HazardAction[]>;
  createHazardAction(action: InsertHazardAction): Promise<HazardAction>;
  updateHazardAction(id: string, updates: Partial<InsertHazardAction>): Promise<HazardAction | undefined>;
  
  listTenantCommunications(filters?: { hazardCaseId?: string; propertyId?: string }): Promise<TenantCommunication[]>;
  createTenantCommunication(comm: InsertTenantCommunication): Promise<TenantCommunication>;
  
  listHouseholds(organisationId: string, filters?: { propertyId?: string; isActive?: boolean }): Promise<Household[]>;
  getHousehold(id: string, organisationId?: string): Promise<Household | undefined>;
  createHousehold(household: InsertHousehold): Promise<Household>;
  updateHousehold(id: string, updates: Partial<InsertHousehold>): Promise<Household | undefined>;
  
  listTenants(organisationId: string, filters?: { householdId?: string }): Promise<Tenant[]>;
  getTenant(id: string, organisationId?: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  listServiceRequests(organisationId: string, filters?: { propertyId?: string; status?: string; type?: string }): Promise<ServiceRequest[]>;
  getServiceRequest(id: string, organisationId?: string): Promise<ServiceRequest | undefined>;
  createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(id: string, updates: Partial<InsertServiceRequest>): Promise<ServiceRequest | undefined>;
  
  listTsmMeasures(): Promise<TsmMeasure[]>;
  getTsmMeasure(id: string): Promise<TsmMeasure | undefined>;
  createTsmMeasure(measure: InsertTsmMeasure): Promise<TsmMeasure>;
  
  listTsmSnapshots(organisationId: string, filters?: { measureCode?: string; periodStart?: Date }): Promise<TsmSnapshot[]>;
  createTsmSnapshot(snapshot: InsertTsmSnapshot): Promise<TsmSnapshot>;
  
  listBuildingSafetyProfiles(organisationId: string, filters?: { isHrb?: boolean }): Promise<BuildingSafetyProfile[]>;
  getBuildingSafetyProfile(id: string, organisationId?: string): Promise<BuildingSafetyProfile | undefined>;
  getBuildingSafetyProfileByBlockId(blockId: string): Promise<BuildingSafetyProfile | undefined>;
  createBuildingSafetyProfile(profile: InsertBuildingSafetyProfile): Promise<BuildingSafetyProfile>;
  updateBuildingSafetyProfile(id: string, updates: Partial<InsertBuildingSafetyProfile>): Promise<BuildingSafetyProfile | undefined>;
  
  listSafetyCaseReviews(profileId: string): Promise<SafetyCaseReview[]>;
  createSafetyCaseReview(review: InsertSafetyCaseReview): Promise<SafetyCaseReview>;
  
  listMandatoryOccurrenceReports(organisationId: string): Promise<MandatoryOccurrenceReport[]>;
  getMandatoryOccurrenceReport(id: string, organisationId?: string): Promise<MandatoryOccurrenceReport | undefined>;
  createMandatoryOccurrenceReport(report: InsertMandatoryOccurrenceReport): Promise<MandatoryOccurrenceReport>;
  updateMandatoryOccurrenceReport(id: string, updates: Partial<InsertMandatoryOccurrenceReport>): Promise<MandatoryOccurrenceReport | undefined>;
}

export interface IStorage extends 
  IUsersStorage, 
  IPropertiesStorage, 
  ICertificatesStorage, 
  IRemedialsStorage,
  IContractorsStorage,
  IConfigurationStorage,
  IComponentsStorage,
  IApiStorage,
  ISystemStorage {}
