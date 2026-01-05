import { pgTable, text, varchar, timestamp, boolean, integer, real, json, pgEnum, date } from "drizzle-orm/pg-core";

// ============================================
// AWAAB'S LAW - Damp & Mould Hazard Management
// Social Housing (Regulation) Act 2023
// ============================================

export const hazardCategoryEnum = pgEnum('hazard_category', [
  'DAMP',
  'MOULD', 
  'CONDENSATION',
  'STRUCTURAL_DEFECT',
  'WATER_INGRESS',
  'VENTILATION',
  'HEATING_FAILURE',
  'HHSRS_CATEGORY_1',
  'HHSRS_CATEGORY_2',
  'OTHER'
]);

export const hazardSeverityEnum = pgEnum('hazard_severity', [
  'EMERGENCY',
  'SERIOUS',
  'MODERATE',
  'MINOR'
]);

export const hazardStatusEnum = pgEnum('hazard_status', [
  'REPORTED',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'WORKS_SCHEDULED',
  'WORKS_IN_PROGRESS',
  'WORKS_COMPLETED',
  'MONITORING',
  'RESOLVED',
  'ESCALATED',
  'CLOSED'
]);

export const vulnerabilityTypeEnum = pgEnum('vulnerability_type', [
  'ELDERLY',
  'CHILD_UNDER_5',
  'PREGNANT',
  'RESPIRATORY_CONDITION',
  'IMMUNE_COMPROMISED',
  'DISABILITY',
  'MENTAL_HEALTH',
  'NONE_DECLARED'
]);

export const hazardCases = pgTable("hazard_cases", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  blockId: varchar("block_id"),
  schemeId: varchar("scheme_id"),
  spaceId: varchar("space_id"),
  
  caseReference: varchar("case_reference").notNull().unique(),
  category: hazardCategoryEnum("category").notNull(),
  severity: hazardSeverityEnum("severity").notNull(),
  status: hazardStatusEnum("status").notNull().default('REPORTED'),
  
  description: text("description").notNull(),
  location: text("location"),
  affectedRooms: text("affected_rooms").array(),
  affectedArea: text("affected_area"),
  rootCause: text("root_cause"),
  
  reportedByType: text("reported_by_type"),
  reportedByName: text("reported_by_name"),
  reportedByContact: text("reported_by_contact"),
  reportedAt: timestamp("reported_at").notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  initialInspectionDue: timestamp("initial_inspection_due"),
  initialInspectionAt: timestamp("initial_inspection_at"),
  worksStartDue: timestamp("works_start_due"),
  worksStartedAt: timestamp("works_started_at"),
  worksCompletionDue: timestamp("works_completion_due"),
  worksCompletedAt: timestamp("works_completed_at"),
  resolvedAt: timestamp("resolved_at"),
  
  occupantVulnerabilities: vulnerabilityTypeEnum("occupant_vulnerabilities").array(),
  hasVulnerableOccupants: boolean("has_vulnerable_occupants").notNull().default(false),
  temporaryDecantRequired: boolean("temporary_decant_required").notNull().default(false),
  decantOfferedAt: timestamp("decant_offered_at"),
  decantAcceptedAt: timestamp("decant_accepted_at"),
  
  escalationLevel: integer("escalation_level").notNull().default(0),
  slaBreach: boolean("sla_breach").notNull().default(false),
  slaBreachType: text("sla_breach_type"),
  slaBreachAt: timestamp("sla_breach_at"),
  
  linkedCertificateIds: text("linked_certificate_ids").array(),
  linkedRemedialActionIds: text("linked_remedial_action_ids").array(),
  linkedServiceRequestIds: text("linked_service_request_ids").array(),
  
  inspectionPhotos: json("inspection_photos"),
  completionPhotos: json("completion_photos"),
  metadata: json("metadata"),
  
  assignedToId: varchar("assigned_to_id"),
  reviewedById: varchar("reviewed_by_id"),
  closedById: varchar("closed_by_id"),
  closedAt: timestamp("closed_at"),
  closureReason: text("closure_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hazardActions = pgTable("hazard_actions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hazardCaseId: varchar("hazard_case_id").notNull(),
  
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  
  assignedToId: varchar("assigned_to_id"),
  contractorId: varchar("contractor_id"),
  
  scheduledDate: date("scheduled_date"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  
  costEstimate: real("cost_estimate"),
  actualCost: real("actual_cost"),
  
  status: text("status").notNull().default('PENDING'),
  outcome: text("outcome"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantCommunications = pgTable("tenant_communications", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hazardCaseId: varchar("hazard_case_id"),
  serviceRequestId: varchar("service_request_id"),
  propertyId: varchar("property_id").notNull(),
  
  communicationType: text("communication_type").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  
  sentById: varchar("sent_by_id"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  respondedAt: timestamp("responded_at"),
  
  isStatutoryNotice: boolean("is_statutory_notice").notNull().default(false),
  statutoryType: text("statutory_type"),
  responseRequired: boolean("response_required").notNull().default(false),
  responseDueDate: date("response_due_date"),
  
  attachments: json("attachments"),
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// TSM - Tenant Satisfaction Measures
// Regulator of Social Housing Requirements
// ============================================

export const tenureTypeEnum = pgEnum('tenure_type_tsm', [
  'GENERAL_NEEDS',
  'SUPPORTED_HOUSING',
  'HOUSING_FOR_OLDER_PEOPLE',
  'SHARED_OWNERSHIP',
  'LEASEHOLDER',
  'TEMPORARY_ACCOMMODATION'
]);

export const serviceRequestTypeEnum = pgEnum('service_request_type', [
  'REPAIR_ROUTINE',
  'REPAIR_EMERGENCY',
  'REPAIR_URGENT',
  'COMPLAINT_STAGE_1',
  'COMPLAINT_STAGE_2',
  'COMPLAINT_STAGE_3',
  'ANTI_SOCIAL_BEHAVIOUR',
  'TENANCY_QUERY',
  'RECHARGEABLE_REPAIR',
  'PLANNED_WORKS',
  'IMPROVEMENT',
  'OTHER'
]);

export const serviceRequestStatusEnum = pgEnum('service_request_status', [
  'LOGGED',
  'TRIAGED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_PARTS',
  'PENDING_TENANT',
  'COMPLETED',
  'CANCELLED',
  'ESCALATED',
  'CLOSED'
]);

export const households = pgTable("households", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  
  householdReference: varchar("household_reference").unique(),
  
  tenureType: tenureTypeEnum("tenure_type").notNull().default('GENERAL_NEEDS'),
  tenancyStartDate: date("tenancy_start_date"),
  tenancyEndDate: date("tenancy_end_date"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  vulnerabilityFlags: vulnerabilityTypeEnum("vulnerability_flags").array(),
  hasVulnerableMembers: boolean("has_vulnerable_members").notNull().default(false),
  
  preferredContactMethod: text("preferred_contact_method"),
  preferredLanguage: text("preferred_language"),
  
  consentForSurveys: boolean("consent_for_surveys").notNull().default(true),
  lastSurveyedAt: timestamp("last_surveyed_at"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  householdId: varchar("household_id").notNull(),
  
  tenantReference: varchar("tenant_reference").unique(),
  
  title: text("title"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth"),
  
  email: text("email"),
  phone: text("phone"),
  mobilePhone: text("mobile_phone"),
  
  isPrimaryTenant: boolean("is_primary_tenant").notNull().default(false),
  isNamedTenant: boolean("is_named_tenant").notNull().default(false),
  
  vulnerabilities: vulnerabilityTypeEnum("vulnerabilities").array(),
  
  communicationPreferences: json("communication_preferences"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  householdId: varchar("household_id"),
  reportedByTenantId: varchar("reported_by_tenant_id"),
  
  requestReference: varchar("request_reference").notNull().unique(),
  requestType: serviceRequestTypeEnum("request_type").notNull(),
  status: serviceRequestStatusEnum("status").notNull().default('LOGGED'),
  priority: text("priority").notNull().default('ROUTINE'),
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  
  reportedAt: timestamp("reported_at").notNull(),
  triageAt: timestamp("triage_at"),
  scheduledDate: date("scheduled_date"),
  appointmentSlot: text("appointment_slot"),
  
  completedAt: timestamp("completed_at"),
  closedAt: timestamp("closed_at"),
  
  targetResponseTime: integer("target_response_time"),
  targetCompletionTime: integer("target_completion_time"),
  actualResponseTime: integer("actual_response_time"),
  actualCompletionTime: integer("actual_completion_time"),
  
  metResponseTarget: boolean("met_response_target"),
  metCompletionTarget: boolean("met_completion_target"),
  
  appointmentKept: boolean("appointment_kept"),
  firstTimeFixed: boolean("first_time_fixed"),
  
  assignedToId: varchar("assigned_to_id"),
  contractorId: varchar("contractor_id"),
  
  costEstimate: real("cost_estimate"),
  actualCost: real("actual_cost"),
  isRechargeable: boolean("is_rechargeable").notNull().default(false),
  
  escalatedAt: timestamp("escalated_at"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  
  linkedHazardCaseId: varchar("linked_hazard_case_id"),
  linkedCertificateIds: text("linked_certificate_ids").array(),
  linkedRemedialActionIds: text("linked_remedial_action_ids").array(),
  
  satisfactionScore: integer("satisfaction_score"),
  satisfactionCollectedAt: timestamp("satisfaction_collected_at"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tsmMeasures = pgTable("tsm_measures", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  measureCode: varchar("measure_code").notNull().unique(),
  measureName: text("measure_name").notNull(),
  measureCategory: text("measure_category").notNull(),
  description: text("description"),
  calculationMethod: text("calculation_method"),
  dataSource: text("data_source"),
  reportingFrequency: text("reporting_frequency").notNull().default('ANNUAL'),
  isPerceptionMeasure: boolean("is_perception_measure").notNull().default(false),
  targetPercentage: real("target_percentage"),
  benchmarkPercentage: real("benchmark_percentage"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tsmSnapshots = pgTable("tsm_snapshots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  measureCode: varchar("measure_code").notNull(),
  
  numerator: integer("numerator"),
  denominator: integer("denominator"),
  percentageValue: real("percentage_value"),
  absoluteValue: real("absolute_value"),
  
  sampleSize: integer("sample_size"),
  responseRate: real("response_rate"),
  confidenceLevel: real("confidence_level"),
  
  previousPeriodValue: real("previous_period_value"),
  yearOnYearChange: real("year_on_year_change"),
  trend: text("trend"),
  
  benchmarkComparison: text("benchmark_comparison"),
  peerGroupRanking: integer("peer_group_ranking"),
  
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  submittedToRegulatorAt: timestamp("submitted_to_regulator_at"),
  
  notes: text("notes"),
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// BUILDING SAFETY ACT 2022
// Higher-Risk Buildings (HRB) Requirements
// ============================================

export const evacuationStrategyEnum = pgEnum('evacuation_strategy', [
  'STAY_PUT',
  'SIMULTANEOUS',
  'PHASED',
  'DEFEND_IN_PLACE',
  'PROGRESSIVE_HORIZONTAL'
]);

export const safetyDocumentTypeEnum = pgEnum('safety_document_type', [
  'SAFETY_CASE',
  'SAFETY_CASE_REPORT',
  'MANDATORY_OCCURRENCE_REPORT',
  'RESIDENTS_ENGAGEMENT_STRATEGY',
  'BUILDING_ASSESSMENT_CERTIFICATE',
  'KEY_BUILDING_INFORMATION',
  'STRUCTURAL_SAFETY_REPORT',
  'FIRE_SAFETY_STATEMENT',
  'CLADDING_ASSESSMENT',
  'OTHER'
]);

export const buildingSafetyProfiles = pgTable("building_safety_profiles", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  blockId: varchar("block_id").notNull().unique(),
  
  isHRB: boolean("is_hrb").notNull().default(false),
  hrbRegistrationNumber: varchar("hrb_registration_number"),
  hrbRegistrationDate: date("hrb_registration_date"),
  hrbStatusConfirmedAt: timestamp("hrb_status_confirmed_at"),
  
  buildingHeight: real("building_height"),
  numberOfStoreys: integer("number_of_storeys"),
  numberOfResidentialUnits: integer("number_of_residential_units"),
  buildingFootprint: real("building_footprint"),
  
  constructionType: text("construction_type"),
  yearBuilt: integer("year_built"),
  externalWallSystem: text("external_wall_system"),
  claddingType: text("cladding_type"),
  hasACM: boolean("has_acm"),
  hasHPL: boolean("has_hpl"),
  
  evacuationStrategy: evacuationStrategyEnum("evacuation_strategy"),
  evacuationStrategyLastReviewed: date("evacuation_strategy_last_reviewed"),
  
  principalAccountablePersonName: text("principal_accountable_person_name"),
  principalAccountablePersonContact: text("principal_accountable_person_contact"),
  accountablePersonOrg: text("accountable_person_org"),
  
  buildingSafetyManagerName: text("building_safety_manager_name"),
  buildingSafetyManagerContact: text("building_safety_manager_contact"),
  buildingSafetyManagerAppointedAt: date("building_safety_manager_appointed_at"),
  
  safetyCaseStatus: text("safety_case_status"),
  safetyCaseLastReviewedAt: date("safety_case_last_reviewed_at"),
  safetyCaseNextReviewDue: date("safety_case_next_review_due"),
  
  goldenThreadRepositoryUrl: text("golden_thread_repository_url"),
  goldenThreadLastUpdated: timestamp("golden_thread_last_updated"),
  
  residentEngagementStrategy: text("resident_engagement_strategy"),
  residentEngagementLastReviewed: date("resident_engagement_last_reviewed"),
  
  buildingAssuranceCertificateRef: text("building_assurance_certificate_ref"),
  buildingAssuranceCertificateDate: date("building_assurance_certificate_date"),
  buildingAssuranceCertificateExpiry: date("building_assurance_certificate_expiry"),
  
  keyBuildingInfoSubmitted: boolean("key_building_info_submitted").notNull().default(false),
  keyBuildingInfoSubmittedAt: timestamp("key_building_info_submitted_at"),
  
  competentPersonAssessments: json("competent_person_assessments"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const safetyCaseReviews = pgTable("safety_case_reviews", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  buildingSafetyProfileId: varchar("building_safety_profile_id").notNull(),
  
  reviewDate: date("review_date").notNull(),
  reviewType: text("review_type").notNull(),
  reviewedByName: text("reviewed_by_name").notNull(),
  reviewedByRole: text("reviewed_by_role"),
  
  overallAssessment: text("overall_assessment").notNull(),
  riskLevel: text("risk_level"),
  
  findingsSummary: text("findings_summary"),
  actionsRequired: json("actions_required"),
  
  documentRef: text("document_ref"),
  storageKey: text("storage_key"),
  
  nextReviewDue: date("next_review_due"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mandatoryOccurrenceReports = pgTable("mandatory_occurrence_reports", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: varchar("organisation_id").notNull(),
  buildingSafetyProfileId: varchar("building_safety_profile_id"),
  propertyId: varchar("property_id"),
  blockId: varchar("block_id"),
  
  reportReference: varchar("report_reference").notNull().unique(),
  
  occurrenceType: text("occurrence_type").notNull(),
  occurrenceDate: timestamp("occurrence_date").notNull(),
  reportedToRegulatorAt: timestamp("reported_to_regulator_at"),
  reportDeadline: timestamp("report_deadline"),
  wasReportedInTime: boolean("was_reported_in_time"),
  
  description: text("description").notNull(),
  immediateActionsToken: text("immediate_actions_taken"),
  
  riskToSafety: text("risk_to_safety").notNull(),
  personsAffected: integer("persons_affected"),
  injuriesReported: boolean("injuries_reported").notNull().default(false),
  
  investigationStatus: text("investigation_status"),
  investigationFindings: text("investigation_findings"),
  investigationCompletedAt: timestamp("investigation_completed_at"),
  
  correctiveActions: json("corrective_actions"),
  preventiveMeasures: json("preventive_measures"),
  
  regulatorReference: varchar("regulator_reference"),
  regulatorResponse: text("regulator_response"),
  
  linkedHazardCaseIds: text("linked_hazard_case_ids").array(),
  linkedCertificateIds: text("linked_certificate_ids").array(),
  
  closedAt: timestamp("closed_at"),
  closedById: varchar("closed_by_id"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// CERTIFICATE DETAIL TABLES
// Per-regulation specific data
// ============================================

export const gasApplianceRecords = pgTable("gas_appliance_records", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  
  applianceType: text("appliance_type").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  gcNumber: text("gc_number"),
  
  location: text("location").notNull(),
  flueType: text("flue_type"),
  
  operatingPressure: text("operating_pressure"),
  safetyDeviceChecked: boolean("safety_device_checked"),
  ventilationSatisfactory: boolean("ventilation_satisfactory"),
  visualCondition: text("visual_condition"),
  flueFowTest: text("flue_flow_test"),
  spillageTest: text("spillage_test"),
  
  applianceResult: text("appliance_result").notNull(),
  defectsFound: text("defects_found"),
  actionRequired: text("action_required"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const electricalCircuitRecords = pgTable("electrical_circuit_records", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  
  circuitNumber: integer("circuit_number").notNull(),
  circuitDescription: text("circuit_description").notNull(),
  circuitType: text("circuit_type"),
  
  fuseRating: text("fuse_rating"),
  mcbType: text("mcb_type"),
  rcboProtected: boolean("rcbo_protected"),
  
  cableType: text("cable_type"),
  cableSize: text("cable_size"),
  cpcSize: text("cpc_size"),
  
  insulationResistance: text("insulation_resistance"),
  polarity: text("polarity"),
  earthFaultLoopImpedance: text("earth_fault_loop_impedance"),
  rcdOperatingTime: text("rcd_operating_time"),
  
  observationCodes: text("observation_codes").array(),
  observations: text("observations"),
  
  result: text("result").notNull(),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fireSystemRecords = pgTable("fire_system_records", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").notNull(),
  propertyId: varchar("property_id"),
  blockId: varchar("block_id"),
  
  systemType: text("system_type").notNull(),
  systemCategory: text("system_category"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  
  location: text("location").notNull(),
  coverageArea: text("coverage_area"),
  
  installDate: date("install_date"),
  lastServiceDate: date("last_service_date"),
  nextServiceDue: date("next_service_due"),
  
  detectorTypes: text("detector_types").array(),
  numberOfDetectors: integer("number_of_detectors"),
  numberOfCallPoints: integer("number_of_call_points"),
  numberOfSounders: integer("number_of_sounders"),
  
  panelLocation: text("panel_location"),
  panelType: text("panel_type"),
  zonesConfigured: integer("zones_configured"),
  
  testResult: text("test_result").notNull(),
  faultsFound: text("faults_found").array(),
  recommendedActions: text("recommended_actions"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const asbestosSurveyRecords = pgTable("asbestos_survey_records", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id").notNull(),
  propertyId: varchar("property_id"),
  blockId: varchar("block_id"),
  
  surveyType: text("survey_type").notNull(),
  surveyDate: date("survey_date").notNull(),
  surveyorName: text("surveyor_name").notNull(),
  surveyorQualification: text("surveyor_qualification"),
  surveyCompany: text("survey_company"),
  accreditationNumber: text("accreditation_number"),
  
  location: text("location").notNull(),
  roomDescription: text("room_description"),
  
  materialType: text("material_type").notNull(),
  materialDescription: text("material_description"),
  asbestosType: text("asbestos_type"),
  
  sampleTaken: boolean("sample_taken").notNull().default(false),
  sampleReference: text("sample_reference"),
  labResult: text("lab_result"),
  
  condition: text("condition"),
  surfaceTreatment: text("surface_treatment"),
  accessibilityScore: integer("accessibility_score"),
  damageScore: integer("damage_score"),
  materialScore: integer("material_score"),
  totalRiskScore: integer("total_risk_score"),
  riskCategory: text("risk_category"),
  
  recommendedAction: text("recommended_action"),
  managementPlan: text("management_plan"),
  reinspectionDate: date("reinspection_date"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waterTemperatureRecords = pgTable("water_temperature_records", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  certificateId: varchar("certificate_id"),
  propertyId: varchar("property_id"),
  blockId: varchar("block_id"),
  
  monitoringDate: timestamp("monitoring_date").notNull(),
  monitoredById: varchar("monitored_by_id"),
  
  outletLocation: text("outlet_location").notNull(),
  outletType: text("outlet_type").notNull(),
  outletReference: text("outlet_reference"),
  
  coldWaterTemp: real("cold_water_temp"),
  hotWaterTemp: real("hot_water_temp"),
  hotWaterFlowTemp: real("hot_water_flow_temp"),
  hotWaterReturnTemp: real("hot_water_return_temp"),
  calorifierTemp: real("calorifier_temp"),
  
  coldWithinLimit: boolean("cold_within_limit"),
  hotWithinLimit: boolean("hot_within_limit"),
  
  flushingRequired: boolean("flushing_required").notNull().default(false),
  flushingCompleted: boolean("flushing_completed"),
  flushingDate: timestamp("flushing_date"),
  
  actionRequired: text("action_required"),
  notes: text("notes"),
  
  metadata: json("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
