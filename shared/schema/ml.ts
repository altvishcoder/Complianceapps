import { pgTable, text, varchar, timestamp, boolean, integer, json, pgEnum } from "drizzle-orm/pg-core";
import { organisations, users } from "./core-auth";
import { properties } from "./org-structure";
import { certificates } from "./compliance";

export const mlModelStatusEnum = pgEnum('ml_model_status', ['TRAINING', 'ACTIVE', 'INACTIVE', 'FAILED']);
export const mlPredictionTypeEnum = pgEnum('ml_prediction_type', ['BREACH_PROBABILITY', 'DAYS_TO_BREACH', 'RISK_CATEGORY']);
export const mlFeedbackTypeEnum = pgEnum('ml_feedback_type', ['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT']);
export const correctionTypeEnum = pgEnum("correction_type", [
  'WRONG_FORMAT', 'WRONG_VALUE', 'MISSING', 'EXTRA_TEXT', 'PARTIAL'
]);

export const mlModels = pgTable("ml_models", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  modelName: text("model_name").notNull(),
  modelVersion: integer("model_version").notNull().default(1),
  predictionType: mlPredictionTypeEnum("prediction_type").notNull(),
  status: mlModelStatusEnum("status").notNull().default('TRAINING'),
  modelWeights: json("model_weights"),
  modelConfig: json("model_config"),
  learningRate: text("learning_rate").notNull().default('0.01'),
  epochs: integer("epochs").notNull().default(100),
  batchSize: integer("batch_size").notNull().default(32),
  featureWeights: json("feature_weights"),
  trainingAccuracy: text("training_accuracy"),
  validationAccuracy: text("validation_accuracy"),
  trainingLoss: text("training_loss"),
  validationLoss: text("validation_loss"),
  trainingProgress: integer("training_progress").notNull().default(0),
  trainingSamples: integer("training_samples").notNull().default(0),
  lastTrainedAt: timestamp("last_trained_at"),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  feedbackCount: integer("feedback_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mlPredictions = pgTable("ml_predictions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  modelId: varchar("model_id").references(() => mlModels.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  certificateId: varchar("certificate_id").references(() => certificates.id),
  complianceStreamCode: text("compliance_stream_code"),
  predictionType: mlPredictionTypeEnum("prediction_type").notNull(),
  statisticalScore: integer("statistical_score"),
  statisticalConfidence: integer("statistical_confidence"),
  mlScore: integer("ml_score"),
  mlConfidence: integer("ml_confidence"),
  predictedBreachDate: timestamp("predicted_breach_date"),
  predictedDaysToBreach: integer("predicted_days_to_breach"),
  predictedRiskCategory: text("predicted_risk_category"),
  inputFeatures: json("input_features"),
  actualOutcome: text("actual_outcome"),
  actualBreachDate: timestamp("actual_breach_date"),
  wasAccurate: boolean("was_accurate"),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const mlFeedback = pgTable("ml_feedback", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  predictionId: varchar("prediction_id").references(() => mlPredictions.id).notNull(),
  feedbackType: mlFeedbackTypeEnum("feedback_type").notNull(),
  feedbackNotes: text("feedback_notes"),
  correctedScore: integer("corrected_score"),
  correctedCategory: text("corrected_category"),
  submittedById: varchar("submitted_by_id").references(() => users.id),
  submittedByName: text("submitted_by_name"),
  usedForTraining: boolean("used_for_training").notNull().default(false),
  trainingBatchId: varchar("training_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractionCorrections = pgTable("extraction_corrections", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  certificateId: varchar("certificate_id").notNull(),
  fieldName: text("field_name").notNull(),
  originalValue: text("original_value"),
  correctedValue: text("corrected_value").notNull(),
  correctionType: correctionTypeEnum("correction_type").notNull(),
  sourceText: text("source_text"),
  certificateType: text("certificate_type"),
  templateId: varchar("template_id"),
  aiModel: text("ai_model"),
  extractionTier: text("extraction_tier"),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  reviewerName: text("reviewer_name"),
  reviewDurationSeconds: integer("review_duration_seconds"),
  notes: text("notes"),
  usedForImprovement: boolean("used_for_improvement").notNull().default(false),
  improvementBatchId: varchar("improvement_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mlTrainingRuns = pgTable("ml_training_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").references(() => organisations.id).notNull(),
  modelId: varchar("model_id").references(() => mlModels.id).notNull(),
  status: mlModelStatusEnum("status").notNull().default('TRAINING'),
  learningRate: text("learning_rate").notNull(),
  epochs: integer("epochs").notNull(),
  batchSize: integer("batch_size").notNull(),
  currentEpoch: integer("current_epoch").notNull().default(0),
  trainingProgress: integer("training_progress").notNull().default(0),
  trainingSamples: integer("training_samples").notNull().default(0),
  validationSamples: integer("validation_samples").notNull().default(0),
  finalAccuracy: text("final_accuracy"),
  finalLoss: text("final_loss"),
  epochHistory: json("epoch_history"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = Omit<MlModel, 'id' | 'createdAt' | 'updatedAt'>;
export type MlPrediction = typeof mlPredictions.$inferSelect;
export type InsertMlPrediction = Omit<MlPrediction, 'id' | 'createdAt'>;
export type MlFeedback = typeof mlFeedback.$inferSelect;
export type InsertMlFeedback = Omit<MlFeedback, 'id' | 'createdAt'>;
export type ExtractionCorrection = typeof extractionCorrections.$inferSelect;
export type InsertExtractionCorrection = Omit<ExtractionCorrection, 'id' | 'createdAt'>;
export type MlTrainingRun = typeof mlTrainingRuns.$inferSelect;
export type InsertMlTrainingRun = Omit<MlTrainingRun, 'id' | 'startedAt'>;
