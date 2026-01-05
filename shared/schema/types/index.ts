import {
  organisations,
  users,
  staffMembers,
  sessions,
  accounts,
  verifications,
  schemes,
  blocks,
  properties,
  ingestionBatches,
  certificates,
  extractions,
  remedialActions,
  contractors,
  extractionSchemas,
  extractionRuns,
  extractionTierAudits,
  humanReviews,
  fieldConfidenceScores,
  autoApprovalThresholds,
  confidenceBaselines,
  benchmarkSets,
  benchmarkItems,
  evalRuns,
  complianceRules,
  normalisationRules,
  complianceStreams,
  certificateTypes,
  classificationCodes,
  certificateDetectionPatterns,
  certificateOutcomeRules,
  componentTypes,
  spaces,
  components,
  componentCertificates,
  dataImports,
  dataImportRows,
  factorySettings,
  factorySettingsAudit,
  apiClients,
  uploadSessions,
  ingestionJobs,
  rateLimitEntries,
  apiLogs,
  apiMetrics,
  webhookEndpoints,
  webhookEvents,
  webhookDeliveries,
  incomingWebhookLogs,
  apiKeys,
  auditEvents,
  propertyRiskSnapshots,
  riskFactorDefinitions,
  riskAlerts,
  contractorCertifications,
  contractorVerificationHistory,
  contractorAlerts,
  contractorAssignments,
  contractorSLAProfiles,
  contractorJobPerformance,
  contractorRatings,
  certificateVersions,
  auditFieldChanges,
  ukhdsExports,
  complianceCalendarEvents,
  scheduledReports,
  reportTemplates,
  generatedReports,
  mlModels,
  mlPredictions,
  mlFeedback,
  extractionCorrections,
  mlTrainingRuns,
  navigationSections,
  navigationItems,
  navigationItemRoles,
  iconRegistry,
  chatbotConversations,
  chatbotMessages,
  chatbotAnalytics,
  knowledgeEmbeddings,
  aiSuggestions,
  videos,
  systemLogs,
  riskSnapshots,
  cacheRegions,
  cacheStats,
  cacheClearAudit,
  hazardCases,
  hazardActions,
  tenantCommunications,
  households,
  tenants,
  serviceRequests,
  tsmMeasures,
  tsmSnapshots,
  buildingSafetyProfiles,
  safetyCaseReviews,
  mandatoryOccurrenceReports,
  gasApplianceRecords,
  electricalCircuitRecords,
  fireSystemRecords,
  asbestosSurveyRecords,
  waterTemperatureRecords,
} from "../tables";

export type Organisation = typeof organisations.$inferSelect;
export type User = typeof users.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Scheme = typeof schemes.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type IngestionBatch = typeof ingestionBatches.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Extraction = typeof extractions.$inferSelect;
export type RemedialAction = typeof remedialActions.$inferSelect;
export type Contractor = typeof contractors.$inferSelect;
export type ExtractionSchema = typeof extractionSchemas.$inferSelect;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type ExtractionTierAudit = typeof extractionTierAudits.$inferSelect;
export type HumanReview = typeof humanReviews.$inferSelect;
export type FieldConfidenceScore = typeof fieldConfidenceScores.$inferSelect;
export type AutoApprovalThreshold = typeof autoApprovalThresholds.$inferSelect;
export type ConfidenceBaseline = typeof confidenceBaselines.$inferSelect;
export type BenchmarkSet = typeof benchmarkSets.$inferSelect;
export type BenchmarkItem = typeof benchmarkItems.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type NormalisationRule = typeof normalisationRules.$inferSelect;
export type ComplianceStream = typeof complianceStreams.$inferSelect;
export type CertificateType = typeof certificateTypes.$inferSelect;
export type ClassificationCode = typeof classificationCodes.$inferSelect;
export type DetectionPattern = typeof certificateDetectionPatterns.$inferSelect;
export type OutcomeRule = typeof certificateOutcomeRules.$inferSelect;
export type ComponentType = typeof componentTypes.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Component = typeof components.$inferSelect;
export type ComponentCertificate = typeof componentCertificates.$inferSelect;
export type DataImport = typeof dataImports.$inferSelect;
export type DataImportRow = typeof dataImportRows.$inferSelect;
export type FactorySetting = typeof factorySettings.$inferSelect;
export type FactorySettingsAudit = typeof factorySettingsAudit.$inferSelect;
export type ApiClient = typeof apiClients.$inferSelect;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;
export type ApiLog = typeof apiLogs.$inferSelect;
export type ApiMetric = typeof apiMetrics.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type IncomingWebhookLog = typeof incomingWebhookLogs.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type PropertyRiskSnapshot = typeof propertyRiskSnapshots.$inferSelect;
export type RiskFactorDefinition = typeof riskFactorDefinitions.$inferSelect;
export type RiskAlert = typeof riskAlerts.$inferSelect;
export type ContractorCertification = typeof contractorCertifications.$inferSelect;
export type ContractorVerificationHistory = typeof contractorVerificationHistory.$inferSelect;
export type ContractorAlert = typeof contractorAlerts.$inferSelect;
export type ContractorAssignment = typeof contractorAssignments.$inferSelect;
export type ContractorSLAProfile = typeof contractorSLAProfiles.$inferSelect;
export type ContractorJobPerformance = typeof contractorJobPerformance.$inferSelect;
export type ContractorRating = typeof contractorRatings.$inferSelect;
export type CertificateVersion = typeof certificateVersions.$inferSelect;
export type AuditFieldChange = typeof auditFieldChanges.$inferSelect;
export type UkhdsExport = typeof ukhdsExports.$inferSelect;
export type ComplianceCalendarEvent = typeof complianceCalendarEvents.$inferSelect;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type MlModel = typeof mlModels.$inferSelect;
export type MlPrediction = typeof mlPredictions.$inferSelect;
export type MlFeedback = typeof mlFeedback.$inferSelect;
export type ExtractionCorrection = typeof extractionCorrections.$inferSelect;
export type MlTrainingRun = typeof mlTrainingRuns.$inferSelect;
export type NavigationSection = typeof navigationSections.$inferSelect;
export type NavigationItem = typeof navigationItems.$inferSelect;
export type NavigationItemRole = typeof navigationItemRoles.$inferSelect;
export type IconRegistry = typeof iconRegistry.$inferSelect;
export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type ChatbotMessage = typeof chatbotMessages.$inferSelect;
export type ChatbotAnalytics = typeof chatbotAnalytics.$inferSelect;
export type KnowledgeEmbedding = typeof knowledgeEmbeddings.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type SystemLog = typeof systemLogs.$inferSelect;
export type RiskSnapshot = typeof riskSnapshots.$inferSelect;
export type CacheRegion = typeof cacheRegions.$inferSelect;
export type CacheStats = typeof cacheStats.$inferSelect;
export type CacheClearAudit = typeof cacheClearAudit.$inferSelect;

export type CacheLayer = 'CLIENT' | 'API' | 'DATABASE' | 'MEMORY' | 'SESSION';
export type CacheClearScope = 'REGION' | 'CATEGORY' | 'LAYER' | 'ALL';

// Regulatory - Awaab's Law
export type HazardCase = typeof hazardCases.$inferSelect;
export type HazardAction = typeof hazardActions.$inferSelect;
export type TenantCommunication = typeof tenantCommunications.$inferSelect;

// Regulatory - TSM (Tenant Satisfaction Measures)
export type Household = typeof households.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type TsmMeasure = typeof tsmMeasures.$inferSelect;
export type TsmSnapshot = typeof tsmSnapshots.$inferSelect;

// Regulatory - Building Safety Act 2022
export type BuildingSafetyProfile = typeof buildingSafetyProfiles.$inferSelect;
export type SafetyCaseReview = typeof safetyCaseReviews.$inferSelect;
export type MandatoryOccurrenceReport = typeof mandatoryOccurrenceReports.$inferSelect;

// Regulatory - Certificate Detail Records
export type GasApplianceRecord = typeof gasApplianceRecords.$inferSelect;
export type ElectricalCircuitRecord = typeof electricalCircuitRecords.$inferSelect;
export type FireSystemRecord = typeof fireSystemRecords.$inferSelect;
export type AsbestosSurveyRecord = typeof asbestosSurveyRecords.$inferSelect;
export type WaterTemperatureRecord = typeof waterTemperatureRecords.$inferSelect;
