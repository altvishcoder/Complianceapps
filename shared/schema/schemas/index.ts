import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  organisations,
  users,
  staffMembers,
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
} from "../tables";

export const insertOrganisationSchema = createInsertSchema(organisations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSchemeSchema = createInsertSchema(schemes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlockSchema = createInsertSchema(blocks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIngestionBatchSchema = createInsertSchema(ingestionBatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionSchema = createInsertSchema(extractions).omit({ id: true, createdAt: true });
export const insertRemedialActionSchema = createInsertSchema(remedialActions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorSchema = createInsertSchema(contractors).omit({ id: true, createdAt: true, updatedAt: true });

export const insertExtractionSchemaSchema = createInsertSchema(extractionSchemas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionRunSchema = createInsertSchema(extractionRuns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExtractionTierAuditSchema = createInsertSchema(extractionTierAudits).omit({ id: true, createdAt: true });
export const insertHumanReviewSchema = createInsertSchema(humanReviews).omit({ id: true, reviewedAt: true });
export const insertFieldConfidenceScoreSchema = createInsertSchema(fieldConfidenceScores).omit({ id: true, createdAt: true });
export const insertAutoApprovalThresholdSchema = createInsertSchema(autoApprovalThresholds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConfidenceBaselineSchema = createInsertSchema(confidenceBaselines).omit({ id: true, lastUpdatedAt: true });
export const insertBenchmarkSetSchema = createInsertSchema(benchmarkSets).omit({ id: true, createdAt: true });
export const insertBenchmarkItemSchema = createInsertSchema(benchmarkItems).omit({ id: true, createdAt: true });
export const insertEvalRunSchema = createInsertSchema(evalRuns).omit({ id: true, createdAt: true });
export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNormalisationRuleSchema = createInsertSchema(normalisationRules).omit({ id: true });

export const insertComplianceStreamSchema = createInsertSchema(complianceStreams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateTypeSchema = createInsertSchema(certificateTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassificationCodeSchema = createInsertSchema(classificationCodes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDetectionPatternSchema = createInsertSchema(certificateDetectionPatterns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOutcomeRuleSchema = createInsertSchema(certificateOutcomeRules).omit({ id: true, createdAt: true, updatedAt: true });

export const insertComponentTypeSchema = createInsertSchema(componentTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSpaceSchema = createInsertSchema(spaces)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine(
    (data) => {
      const attachments = [data.propertyId, data.blockId, data.schemeId].filter(Boolean);
      return attachments.length === 1;
    },
    { message: "Space must attach to exactly one level: propertyId (dwelling), blockId (communal), or schemeId (estate)" }
  );
export const insertComponentSchema = createInsertSchema(components).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComponentCertificateSchema = createInsertSchema(componentCertificates).omit({ id: true, createdAt: true });
export const insertDataImportSchema = createInsertSchema(dataImports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDataImportRowSchema = createInsertSchema(dataImportRows).omit({ id: true });

export const insertFactorySettingSchema = createInsertSchema(factorySettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFactorySettingsAuditSchema = createInsertSchema(factorySettingsAudit).omit({ id: true, changedAt: true });

export const insertApiClientSchema = createInsertSchema(apiClients).omit({ id: true, createdAt: true, updatedAt: true, lastUsedAt: true, requestCount: true });
export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({ id: true, createdAt: true, completedAt: true });
export const insertIngestionJobSchema = createInsertSchema(ingestionJobs).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true, lastAttemptAt: true, nextRetryAt: true });
export const insertRateLimitEntrySchema = createInsertSchema(rateLimitEntries).omit({ id: true, createdAt: true, updatedAt: true });

export const insertApiLogSchema = createInsertSchema(apiLogs).omit({ id: true, createdAt: true });
export const insertApiMetricSchema = createInsertSchema(apiMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints).omit({ id: true, createdAt: true, updatedAt: true, lastDeliveryAt: true, lastDeliveryStatus: true, failureCount: true });
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true, createdAt: true, processed: true });
export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncomingWebhookLogSchema = createInsertSchema(incomingWebhookLogs).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, lastUsedAt: true });

export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({ id: true, createdAt: true });

export const insertPropertyRiskSnapshotSchema = createInsertSchema(propertyRiskSnapshots).omit({ id: true, createdAt: true, calculatedAt: true });
export const insertRiskFactorDefinitionSchema = createInsertSchema(riskFactorDefinitions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRiskAlertSchema = createInsertSchema(riskAlerts).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorCertificationSchema = createInsertSchema(contractorCertifications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorVerificationHistorySchema = createInsertSchema(contractorVerificationHistory).omit({ id: true, createdAt: true });
export const insertContractorAlertSchema = createInsertSchema(contractorAlerts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorAssignmentSchema = createInsertSchema(contractorAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorSLAProfileSchema = createInsertSchema(contractorSLAProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorJobPerformanceSchema = createInsertSchema(contractorJobPerformance).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractorRatingSchema = createInsertSchema(contractorRatings).omit({ id: true, createdAt: true });

export const insertCertificateVersionSchema = createInsertSchema(certificateVersions).omit({ id: true, createdAt: true });
export const insertAuditFieldChangeSchema = createInsertSchema(auditFieldChanges).omit({ id: true, createdAt: true });
export const insertUkhdsExportSchema = createInsertSchema(ukhdsExports).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export const insertComplianceCalendarEventSchema = createInsertSchema(complianceCalendarEvents).omit({ id: true, createdAt: true, updatedAt: true });

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({ id: true, createdAt: true });

export const insertMlModelSchema = createInsertSchema(mlModels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMlPredictionSchema = createInsertSchema(mlPredictions).omit({ id: true, createdAt: true });
export const insertMlFeedbackSchema = createInsertSchema(mlFeedback).omit({ id: true, createdAt: true });
export const insertExtractionCorrectionSchema = createInsertSchema(extractionCorrections).omit({ id: true, createdAt: true });
export const insertMlTrainingRunSchema = createInsertSchema(mlTrainingRuns).omit({ id: true, startedAt: true });

export const insertNavigationSectionSchema = createInsertSchema(navigationSections).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNavigationItemSchema = createInsertSchema(navigationItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNavigationItemRoleSchema = createInsertSchema(navigationItemRoles).omit({ id: true, createdAt: true });
export const insertIconRegistrySchema = createInsertSchema(iconRegistry).omit({ id: true, createdAt: true });

export const insertChatbotConversationSchema = createInsertSchema(chatbotConversations).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertChatbotMessageSchema = createInsertSchema(chatbotMessages).omit({ id: true, createdAt: true });
export const insertChatbotAnalyticsSchema = createInsertSchema(chatbotAnalytics).omit({ id: true, createdAt: true });
export const insertKnowledgeEmbeddingSchema = createInsertSchema(knowledgeEmbeddings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({ id: true, createdAt: true, updatedAt: true });

export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type InsertScheme = z.infer<typeof insertSchemeSchema>;
export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type InsertIngestionBatch = z.infer<typeof insertIngestionBatchSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
export type InsertRemedialAction = z.infer<typeof insertRemedialActionSchema>;
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type InsertExtractionSchema = z.infer<typeof insertExtractionSchemaSchema>;
export type InsertExtractionRun = z.infer<typeof insertExtractionRunSchema>;
export type InsertExtractionTierAudit = z.infer<typeof insertExtractionTierAuditSchema>;
export type InsertHumanReview = z.infer<typeof insertHumanReviewSchema>;
export type InsertFieldConfidenceScore = z.infer<typeof insertFieldConfidenceScoreSchema>;
export type InsertAutoApprovalThreshold = z.infer<typeof insertAutoApprovalThresholdSchema>;
export type InsertConfidenceBaseline = z.infer<typeof insertConfidenceBaselineSchema>;
export type InsertBenchmarkSet = z.infer<typeof insertBenchmarkSetSchema>;
export type InsertBenchmarkItem = z.infer<typeof insertBenchmarkItemSchema>;
export type InsertEvalRun = z.infer<typeof insertEvalRunSchema>;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;
export type InsertNormalisationRule = z.infer<typeof insertNormalisationRuleSchema>;
export type InsertComplianceStream = z.infer<typeof insertComplianceStreamSchema>;
export type InsertCertificateType = z.infer<typeof insertCertificateTypeSchema>;
export type InsertClassificationCode = z.infer<typeof insertClassificationCodeSchema>;
export type InsertDetectionPattern = z.infer<typeof insertDetectionPatternSchema>;
export type InsertOutcomeRule = z.infer<typeof insertOutcomeRuleSchema>;
export type InsertComponentType = z.infer<typeof insertComponentTypeSchema>;
export type InsertSpace = z.infer<typeof insertSpaceSchema>;
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type InsertComponentCertificate = z.infer<typeof insertComponentCertificateSchema>;
export type InsertDataImport = z.infer<typeof insertDataImportSchema>;
export type InsertDataImportRow = z.infer<typeof insertDataImportRowSchema>;
export type InsertFactorySetting = z.infer<typeof insertFactorySettingSchema>;
export type InsertFactorySettingsAudit = z.infer<typeof insertFactorySettingsAuditSchema>;
export type InsertApiClient = z.infer<typeof insertApiClientSchema>;
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;
export type InsertIngestionJob = z.infer<typeof insertIngestionJobSchema>;
export type InsertRateLimitEntry = z.infer<typeof insertRateLimitEntrySchema>;
export type InsertApiLog = z.infer<typeof insertApiLogSchema>;
export type InsertApiMetric = z.infer<typeof insertApiMetricSchema>;
export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type InsertIncomingWebhookLog = z.infer<typeof insertIncomingWebhookLogSchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type InsertPropertyRiskSnapshot = z.infer<typeof insertPropertyRiskSnapshotSchema>;
export type InsertRiskFactorDefinition = z.infer<typeof insertRiskFactorDefinitionSchema>;
export type InsertRiskAlert = z.infer<typeof insertRiskAlertSchema>;
export type InsertContractorCertification = z.infer<typeof insertContractorCertificationSchema>;
export type InsertContractorVerificationHistory = z.infer<typeof insertContractorVerificationHistorySchema>;
export type InsertContractorAlert = z.infer<typeof insertContractorAlertSchema>;
export type InsertContractorAssignment = z.infer<typeof insertContractorAssignmentSchema>;
export type InsertContractorSLAProfile = z.infer<typeof insertContractorSLAProfileSchema>;
export type InsertContractorJobPerformance = z.infer<typeof insertContractorJobPerformanceSchema>;
export type InsertContractorRating = z.infer<typeof insertContractorRatingSchema>;
export type InsertCertificateVersion = z.infer<typeof insertCertificateVersionSchema>;
export type InsertAuditFieldChange = z.infer<typeof insertAuditFieldChangeSchema>;
export type InsertUkhdsExport = z.infer<typeof insertUkhdsExportSchema>;
export type InsertComplianceCalendarEvent = z.infer<typeof insertComplianceCalendarEventSchema>;
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type InsertMlModel = z.infer<typeof insertMlModelSchema>;
export type InsertMlPrediction = z.infer<typeof insertMlPredictionSchema>;
export type InsertMlFeedback = z.infer<typeof insertMlFeedbackSchema>;
export type InsertExtractionCorrection = z.infer<typeof insertExtractionCorrectionSchema>;
export type InsertMlTrainingRun = z.infer<typeof insertMlTrainingRunSchema>;
export type InsertNavigationSection = z.infer<typeof insertNavigationSectionSchema>;
export type InsertNavigationItem = z.infer<typeof insertNavigationItemSchema>;
export type InsertNavigationItemRole = z.infer<typeof insertNavigationItemRoleSchema>;
export type InsertIconRegistry = z.infer<typeof insertIconRegistrySchema>;
export type InsertChatbotConversation = z.infer<typeof insertChatbotConversationSchema>;
export type InsertChatbotMessage = z.infer<typeof insertChatbotMessageSchema>;
export type InsertChatbotAnalytics = z.infer<typeof insertChatbotAnalyticsSchema>;
export type InsertKnowledgeEmbedding = z.infer<typeof insertKnowledgeEmbeddingSchema>;
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
