CREATE TYPE "public"."action_status" AS ENUM('OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."api_client_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('USER', 'SYSTEM', 'API');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('CERTIFICATE', 'PROPERTY', 'COMPONENT', 'REMEDIAL_ACTION', 'USER', 'ORGANISATION', 'API_KEY', 'SETTINGS');--> statement-breakpoint
CREATE TYPE "public"."audit_event_type" AS ENUM('CERTIFICATE_UPLOADED', 'CERTIFICATE_PROCESSED', 'CERTIFICATE_STATUS_CHANGED', 'CERTIFICATE_APPROVED', 'CERTIFICATE_REJECTED', 'CERTIFICATE_DELETED', 'EXTRACTION_COMPLETED', 'REMEDIAL_ACTION_CREATED', 'REMEDIAL_ACTION_UPDATED', 'REMEDIAL_ACTION_COMPLETED', 'PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_DELETED', 'COMPONENT_CREATED', 'COMPONENT_UPDATED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_ROLE_CHANGED', 'SETTINGS_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'BULK_IMPORT_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."certificate_outcome" AS ENUM('SATISFACTORY', 'UNSATISFACTORY', 'PASS', 'FAIL', 'AT_RISK', 'IMMEDIATELY_DANGEROUS');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."certificate_type" AS ENUM('GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."chat_intent" AS ENUM('greeting', 'navigation', 'database', 'faq', 'rag', 'off_topic', 'complex');--> statement-breakpoint
CREATE TYPE "public"."chat_response_source" AS ENUM('static', 'faq_cache', 'faq_tfidf', 'database', 'rag', 'llm');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."component_category" AS ENUM('HEATING', 'ELECTRICAL', 'FIRE_SAFETY', 'WATER', 'VENTILATION', 'STRUCTURE', 'ACCESS', 'SECURITY', 'EXTERNAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."contractor_registration_type" AS ENUM('GAS_SAFE', 'NICEIC', 'NAPIT', 'ELECSA', 'ECS', 'OFTEC', 'HETAS', 'BESCA', 'FENSA', 'CHAS', 'SAFE_CONTRACTOR', 'CONSTRUCTIONLINE', 'CIOB', 'PAS_8672', 'SSIP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."contractor_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."contractor_verification_status" AS ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."contractor_work_category" AS ENUM('GAS_BOILER', 'GAS_APPLIANCES', 'GAS_FIRES', 'ELECTRICAL_INSTALL', 'ELECTRICAL_TEST', 'FIRE_ALARM', 'FIRE_DOOR', 'FIRE_EXTINGUISHER', 'LIFT_MAINTENANCE', 'LEGIONELLA', 'ASBESTOS_SURVEY', 'ASBESTOS_REMOVAL', 'WATER_HYGIENE', 'EPC_ASSESSMENT', 'GENERAL_MAINTENANCE', 'ROOFING', 'PLUMBING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."detection_matcher_type" AS ENUM('CONTAINS', 'REGEX', 'STARTS_WITH', 'ENDS_WITH');--> statement-breakpoint
CREATE TYPE "public"."detection_pattern_type" AS ENUM('FILENAME', 'TEXT_CONTENT');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('PENDING', 'PROCESSING', 'VALIDATION_FAILED', 'REPAIR_IN_PROGRESS', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."extraction_tier_status" AS ENUM('success', 'escalated', 'skipped', 'failed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('PENDING', 'VALID', 'INVALID', 'IMPORTED', 'SKIPPED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('QUEUED', 'UPLOADING', 'PROCESSING', 'EXTRACTING', 'COMPLETE', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('trace', 'debug', 'info', 'warn', 'error', 'fatal');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('api', 'job-queue', 'extraction', 'webhook', 'http', 'system');--> statement-breakpoint
CREATE TYPE "public"."outcome_rule_operator" AS ENUM('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'IS_TRUE', 'IS_FALSE', 'IS_NULL', 'IS_NOT_NULL', 'IN_LIST', 'NOT_IN_LIST', 'REGEX_MATCH', 'ARRAY_ANY_MATCH', 'ARRAY_ALL_MATCH');--> statement-breakpoint
CREATE TYPE "public"."property_source" AS ENUM('MANUAL', 'AUTO_EXTRACTED', 'IMPORTED');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO');--> statement-breakpoint
CREATE TYPE "public"."risk_alert_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."risk_factor_type" AS ENUM('EXPIRY_RISK', 'DEFECT_RISK', 'ASSET_PROFILE_RISK', 'COVERAGE_GAP_RISK', 'EXTERNAL_FACTOR_RISK');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('property', 'block', 'scheme', 'ward', 'organisation');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."risk_trend" AS ENUM('improving', 'stable', 'deteriorating');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY');--> statement-breakpoint
CREATE TYPE "public"."suggestion_category" AS ENUM('PROMPT', 'PREPROCESSING', 'VALIDATION', 'TRAINING', 'QUALITY', 'REVIEW');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'AUTO_RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."tenure" AS ENUM('SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('DWELLING', 'COMMUNAL_AREA', 'PLANT_ROOM', 'ROOF_SPACE', 'BASEMENT', 'EXTERNAL', 'GARAGE', 'COMMERCIAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."upload_session_status" AS ENUM('PENDING', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."webhook_auth_type" AS ENUM('NONE', 'API_KEY', 'BEARER', 'HMAC_SHA256');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'RETRYING');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('ACTIVE', 'PAUSED', 'FAILED', 'DISABLED');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"suggestion_key" text NOT NULL,
	"category" "suggestion_category" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" text NOT NULL,
	"effort" text NOT NULL,
	"actionable" boolean DEFAULT true,
	"action_label" text,
	"action_route" text,
	"status" "suggestion_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_value" integer,
	"target_value" integer,
	"progress_percent" integer DEFAULT 0,
	"snapshot_metrics" json,
	"actioned_at" timestamp,
	"actioned_by_id" varchar,
	"resolved_at" timestamp,
	"dismissed_at" timestamp,
	"dismiss_reason" text,
	"auto_resolve_condition" text,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"api_key" text NOT NULL,
	"api_key_prefix" text NOT NULL,
	"api_secret" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"rate_limit_override" json,
	"status" "api_client_status" DEFAULT 'ACTIVE' NOT NULL,
	"last_used_at" timestamp,
	"request_count" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_clients_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" text[] NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"duration" integer NOT NULL,
	"request_body" json,
	"response_body" json,
	"user_agent" text,
	"ip_address" text,
	"user_id" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_metrics" (
	"id" varchar PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"date" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"avg_duration" integer DEFAULT 0 NOT NULL,
	"p95_duration" integer DEFAULT 0 NOT NULL,
	"min_duration" integer DEFAULT 0 NOT NULL,
	"max_duration" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"actor_id" varchar,
	"actor_name" text,
	"actor_type" "audit_actor_type" DEFAULT 'USER' NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" text,
	"property_id" varchar,
	"certificate_id" varchar,
	"before_state" json,
	"after_state" json,
	"changes" json,
	"message" text NOT NULL,
	"metadata" json,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmark_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"benchmark_set_id" varchar NOT NULL,
	"certificate_id" varchar NOT NULL,
	"expected_output" json NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"challenge_types" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmark_sets" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"document_types" text[],
	"is_locked" boolean DEFAULT false NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"scheme_id" varchar NOT NULL,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"has_lift" boolean DEFAULT false NOT NULL,
	"has_communal_boiler" boolean DEFAULT false NOT NULL,
	"compliance_status" "compliance_status" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_detection_patterns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_type_id" varchar,
	"certificate_type_code" text NOT NULL,
	"pattern_type" "detection_pattern_type" NOT NULL,
	"matcher_type" "detection_matcher_type" DEFAULT 'CONTAINS' NOT NULL,
	"pattern" text NOT NULL,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"additional_patterns" text[],
	"priority" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_outcome_rules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_type_id" varchar,
	"certificate_type_code" text NOT NULL,
	"rule_name" text NOT NULL,
	"rule_group" text,
	"field_path" text NOT NULL,
	"operator" "outcome_rule_operator" NOT NULL,
	"value" text,
	"value_list" text[],
	"array_field_path" text,
	"array_match_patterns" text[],
	"outcome" text DEFAULT 'UNSATISFACTORY' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"stop_on_match" boolean DEFAULT true NOT NULL,
	"description" text,
	"legislation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"compliance_stream" text NOT NULL,
	"stream_id" varchar,
	"description" text,
	"validity_months" integer DEFAULT 12 NOT NULL,
	"warning_days" integer DEFAULT 30 NOT NULL,
	"required_fields" text[],
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"block_id" varchar,
	"batch_id" varchar,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text,
	"certificate_type" "certificate_type" NOT NULL,
	"compliance_stream_id" varchar,
	"status" "certificate_status" DEFAULT 'UPLOADED' NOT NULL,
	"certificate_number" text,
	"issue_date" text,
	"expiry_date" text,
	"outcome" "certificate_outcome",
	"uploaded_by_id" varchar,
	"reviewed_by_id" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_analytics" (
	"id" varchar PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"hour" integer,
	"total_queries" integer DEFAULT 0 NOT NULL,
	"static_responses" integer DEFAULT 0 NOT NULL,
	"faq_hits" integer DEFAULT 0 NOT NULL,
	"database_queries" integer DEFAULT 0 NOT NULL,
	"rag_queries" integer DEFAULT 0 NOT NULL,
	"llm_queries" integer DEFAULT 0 NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"avg_response_time_ms" integer,
	"top_intents" json,
	"top_topics" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_conversations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"session_id" text NOT NULL,
	"title" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"intent" "chat_intent",
	"response_source" "chat_response_source",
	"confidence" real,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"response_time_ms" integer,
	"rag_documents_used" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classification_codes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"certificate_type_id" varchar,
	"compliance_stream_id" varchar,
	"severity" text NOT NULL,
	"color_code" text,
	"description" text NOT NULL,
	"action_required" text,
	"timeframe_hours" integer,
	"auto_create_action" boolean DEFAULT true NOT NULL,
	"action_severity" text,
	"cost_estimate_low" integer,
	"cost_estimate_high" integer,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"rule_code" text NOT NULL,
	"rule_name" text NOT NULL,
	"document_type" text NOT NULL,
	"compliance_stream_id" varchar,
	"conditions" json NOT NULL,
	"condition_logic" text DEFAULT 'AND' NOT NULL,
	"action" text NOT NULL,
	"priority" text,
	"description" text NOT NULL,
	"legislation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "compliance_streams" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color_code" text,
	"icon_name" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_streams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "component_certificates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"component_id" varchar NOT NULL,
	"certificate_id" varchar NOT NULL,
	"is_auto_linked" boolean DEFAULT false NOT NULL,
	"extraction_confidence" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_types" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "component_category" NOT NULL,
	"description" text,
	"hact_element_code" text,
	"expected_lifespan_years" integer,
	"related_certificate_types" text[],
	"inspection_frequency_months" integer,
	"is_high_risk" boolean DEFAULT false NOT NULL,
	"building_safety_relevant" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "component_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" varchar PRIMARY KEY NOT NULL,
	"property_id" varchar,
	"unit_id" varchar,
	"block_id" varchar,
	"component_type_id" varchar NOT NULL,
	"asset_tag" text,
	"serial_number" text,
	"manufacturer" text,
	"model" text,
	"location" text,
	"access_notes" text,
	"install_date" text,
	"expected_replacement_date" text,
	"warranty_expiry" text,
	"condition" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" "property_source" DEFAULT 'MANUAL' NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"last_inspection_date" text,
	"next_inspection_due" text,
	"compliance_status" "compliance_status" DEFAULT 'UNKNOWN' NOT NULL,
	"certificate_required" text,
	"risk_level" text,
	"last_service_date" text,
	"next_service_due" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_alerts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"certification_id" varchar,
	"alert_type" text NOT NULL,
	"severity" "severity" DEFAULT 'PRIORITY' NOT NULL,
	"status" "risk_alert_status" DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp,
	"sla_hours" integer,
	"acknowledged_by_id" varchar,
	"acknowledged_at" timestamp,
	"resolved_by_id" varchar,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_assignments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"property_id" varchar,
	"remedial_action_id" varchar,
	"work_category" "contractor_work_category" NOT NULL,
	"description" text,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"status" "action_status" DEFAULT 'OPEN' NOT NULL,
	"verified_certifications" text[],
	"assigned_by_id" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_certifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"registration_type" "contractor_registration_type" NOT NULL,
	"registration_number" text NOT NULL,
	"registration_name" text,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"verification_status" "contractor_verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"verified_at" timestamp,
	"verified_by_id" varchar,
	"verification_method" text,
	"verification_notes" text,
	"work_categories" text[],
	"document_url" text,
	"document_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_verification_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"certification_id" varchar,
	"organisation_id" varchar NOT NULL,
	"verification_type" text NOT NULL,
	"previous_status" "contractor_verification_status",
	"new_status" "contractor_verification_status" NOT NULL,
	"verified_by_id" varchar,
	"verified_by_name" text,
	"verification_method" text NOT NULL,
	"lookup_url" text,
	"screenshot_url" text,
	"notes" text,
	"registration_data_snapshot" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"company_name" text NOT NULL,
	"trade_type" text NOT NULL,
	"registration_number" text,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"gas_registration" text,
	"electrical_registration" text,
	"status" "contractor_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_import_rows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"import_id" varchar NOT NULL,
	"row_number" integer NOT NULL,
	"status" "import_row_status" DEFAULT 'PENDING' NOT NULL,
	"source_data" json NOT NULL,
	"validation_errors" json,
	"created_record_id" varchar,
	"created_record_type" text,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "data_imports" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"uploaded_by_id" varchar NOT NULL,
	"name" text NOT NULL,
	"import_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"column_mapping" json,
	"status" "import_status" DEFAULT 'PENDING' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"upsert_mode" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"error_summary" json,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"benchmark_set_id" varchar NOT NULL,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"overall_score" real NOT NULL,
	"exact_match_rate" real NOT NULL,
	"evidence_accuracy" real NOT NULL,
	"schema_valid_rate" real NOT NULL,
	"scores" json NOT NULL,
	"item_results" json NOT NULL,
	"previous_run_id" varchar,
	"regressions" json DEFAULT '[]'::json NOT NULL,
	"improvements" json DEFAULT '[]'::json NOT NULL,
	"score_delta" real,
	"passed_gating" boolean,
	"gating_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_id" varchar NOT NULL,
	"schema_id" varchar,
	"model_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"document_type" text NOT NULL,
	"classification_confidence" real DEFAULT 0 NOT NULL,
	"raw_output" json NOT NULL,
	"validated_output" json,
	"repaired_output" json,
	"normalised_output" json,
	"final_output" json,
	"confidence" real DEFAULT 0 NOT NULL,
	"processing_tier" integer DEFAULT 6 NOT NULL,
	"tier_name" text,
	"processing_time_ms" integer DEFAULT 0 NOT NULL,
	"processing_cost" real DEFAULT 0 NOT NULL,
	"validation_errors" json DEFAULT '[]'::json NOT NULL,
	"validation_passed" boolean DEFAULT false NOT NULL,
	"repair_attempts" integer DEFAULT 0 NOT NULL,
	"status" "extraction_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_schemas" (
	"id" varchar PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"document_type" text NOT NULL,
	"compliance_stream_id" varchar,
	"schema_json" json NOT NULL,
	"prompt_template" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_tier_audits" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_id" varchar NOT NULL,
	"extraction_run_id" varchar,
	"tier" text NOT NULL,
	"tier_order" integer NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"processing_time_ms" integer DEFAULT 0 NOT NULL,
	"status" "extraction_tier_status" DEFAULT 'pending' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"extracted_field_count" integer DEFAULT 0 NOT NULL,
	"escalation_reason" text,
	"document_format" text,
	"document_classification" text,
	"page_count" integer,
	"text_quality" real,
	"qr_codes_found" json,
	"metadata_extracted" json,
	"raw_output" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_id" varchar NOT NULL,
	"method" text NOT NULL,
	"model" text,
	"prompt_version" text,
	"raw_response" json,
	"extracted_data" json,
	"confidence" real,
	"text_quality" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_settings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_editable" boolean DEFAULT true NOT NULL,
	"validation_rules" json,
	"updated_by_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factory_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "factory_settings_audit" (
	"id" varchar PRIMARY KEY NOT NULL,
	"setting_id" varchar NOT NULL,
	"key" text NOT NULL,
	"old_value" text,
	"new_value" text NOT NULL,
	"changed_by_id" varchar NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "human_reviews" (
	"id" varchar PRIMARY KEY NOT NULL,
	"extraction_run_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"organisation_id" varchar NOT NULL,
	"approved_output" json NOT NULL,
	"field_changes" json DEFAULT '[]'::json NOT NULL,
	"added_items" json DEFAULT '[]'::json NOT NULL,
	"removed_items" json DEFAULT '[]'::json NOT NULL,
	"error_tags" text[],
	"was_correct" boolean DEFAULT false NOT NULL,
	"change_count" integer DEFAULT 0 NOT NULL,
	"review_time_seconds" integer,
	"reviewer_notes" text,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "human_reviews_extraction_run_id_unique" UNIQUE("extraction_run_id")
);
--> statement-breakpoint
CREATE TABLE "incoming_webhook_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_type" text,
	"payload" json NOT NULL,
	"headers" json,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_batches" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" text,
	"total_files" integer DEFAULT 0 NOT NULL,
	"completed_files" integer DEFAULT 0 NOT NULL,
	"failed_files" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"api_client_id" varchar,
	"upload_session_id" varchar,
	"certificate_type" "certificate_type" NOT NULL,
	"property_uprn" text,
	"property_id" varchar,
	"file_name" text NOT NULL,
	"object_path" text,
	"status" "ingestion_job_status" DEFAULT 'QUEUED' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status_message" text,
	"certificate_id" varchar,
	"extraction_id" varchar,
	"error_details" json,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"webhook_url" text,
	"webhook_delivered" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "ingestion_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"metadata" json,
	"embedding_model" text NOT NULL,
	"embedding" text,
	"risk_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalisation_rules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"rule_name" text NOT NULL,
	"field_path" text NOT NULL,
	"rule_type" text NOT NULL,
	"compliance_stream_id" varchar,
	"input_patterns" text[],
	"output_value" text,
	"transform_fn" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY NOT NULL,
	"block_id" varchar NOT NULL,
	"uprn" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"postcode" text NOT NULL,
	"property_type" "property_type" NOT NULL,
	"tenure" "tenure" NOT NULL,
	"bedrooms" integer DEFAULT 1 NOT NULL,
	"has_gas" boolean DEFAULT true NOT NULL,
	"compliance_status" "compliance_status" DEFAULT 'UNKNOWN' NOT NULL,
	"source" "property_source" DEFAULT 'MANUAL' NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"extracted_metadata" json,
	"vulnerable_occupant" boolean DEFAULT false NOT NULL,
	"epc_rating" text,
	"construction_year" integer,
	"number_of_floors" integer DEFAULT 1,
	"has_electricity" boolean DEFAULT true NOT NULL,
	"has_asbestos" boolean DEFAULT false NOT NULL,
	"has_sprinklers" boolean DEFAULT false NOT NULL,
	"local_authority" text,
	"latitude" real,
	"longitude" real,
	"ward" text,
	"ward_code" text,
	"lsoa" text,
	"msoa" text,
	"geocoded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "properties_uprn_unique" UNIQUE("uprn")
);
--> statement-breakpoint
CREATE TABLE "property_risk_snapshots" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"risk_tier" "risk_tier" DEFAULT 'LOW' NOT NULL,
	"expiry_risk_score" integer DEFAULT 0 NOT NULL,
	"defect_risk_score" integer DEFAULT 0 NOT NULL,
	"asset_profile_risk_score" integer DEFAULT 0 NOT NULL,
	"coverage_gap_risk_score" integer DEFAULT 0 NOT NULL,
	"external_factor_risk_score" integer DEFAULT 0 NOT NULL,
	"factor_breakdown" json,
	"triggering_factors" text[],
	"recommended_actions" text[],
	"legislation_references" text[],
	"previous_score" integer,
	"score_change" integer,
	"trend_direction" text,
	"is_latest" boolean DEFAULT true NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"client_id" varchar NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remedial_actions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"certificate_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"code" text,
	"category" text,
	"description" text NOT NULL,
	"location" text,
	"severity" "severity" NOT NULL,
	"status" "action_status" DEFAULT 'OPEN' NOT NULL,
	"due_date" text,
	"resolved_at" timestamp,
	"cost_estimate" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_alerts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"snapshot_id" varchar,
	"alert_type" text NOT NULL,
	"risk_tier" "risk_tier" NOT NULL,
	"status" "risk_alert_status" DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"triggering_factors" text[],
	"risk_score" integer NOT NULL,
	"previous_score" integer,
	"due_date" timestamp,
	"sla_hours" integer,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"acknowledged_by_id" varchar,
	"acknowledged_at" timestamp,
	"resolved_by_id" varchar,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"linked_remedial_action_ids" text[],
	"linked_certificate_ids" text[],
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_factor_definitions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar,
	"factor_type" "risk_factor_type" NOT NULL,
	"factor_name" text NOT NULL,
	"description" text,
	"weight" integer DEFAULT 20 NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"thresholds" json,
	"calculation_logic" text,
	"legislation_reference" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_snapshots" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"level" "risk_level" NOT NULL,
	"level_id" varchar NOT NULL,
	"level_name" text,
	"composite_score" real NOT NULL,
	"gas_score" real,
	"electrical_score" real,
	"fire_score" real,
	"asbestos_score" real,
	"lift_score" real,
	"water_score" real,
	"critical_defects" integer DEFAULT 0 NOT NULL,
	"major_defects" integer DEFAULT 0 NOT NULL,
	"minor_defects" integer DEFAULT 0 NOT NULL,
	"property_count" integer DEFAULT 0 NOT NULL,
	"unit_count" integer DEFAULT 0 NOT NULL,
	"previous_score" real,
	"trend" "risk_trend",
	"latitude" real,
	"longitude" real,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"compliance_status" "compliance_status" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"level" "log_level" NOT NULL,
	"source" "log_source" DEFAULT 'system' NOT NULL,
	"message" text NOT NULL,
	"context" json,
	"request_id" text,
	"user_id" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" varchar PRIMARY KEY NOT NULL,
	"property_id" varchar NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"unit_type" "unit_type" NOT NULL,
	"floor" text,
	"description" text,
	"hact_location_code" text,
	"area_sq_meters" real,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"fire_compartment" text,
	"asbestos_present" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"api_client_id" varchar,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"checksum" text,
	"upload_url" text,
	"object_path" text,
	"status" "upload_session_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "upload_sessions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'VIEWER' NOT NULL,
	"organisation_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"uploaded_by_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"duration" integer,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"webhook_endpoint_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"response_status" integer,
	"response_body" text,
	"error_message" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organisation_id" varchar NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"auth_type" "webhook_auth_type" DEFAULT 'NONE' NOT NULL,
	"auth_value" text,
	"headers" json,
	"events" text[] NOT NULL,
	"status" "webhook_status" DEFAULT 'ACTIVE' NOT NULL,
	"retry_count" integer DEFAULT 3 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"last_delivery_at" timestamp,
	"last_delivery_status" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"payload" json NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_actioned_by_id_users_id_fk" FOREIGN KEY ("actioned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_items" ADD CONSTRAINT "benchmark_items_benchmark_set_id_benchmark_sets_id_fk" FOREIGN KEY ("benchmark_set_id") REFERENCES "public"."benchmark_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_items" ADD CONSTRAINT "benchmark_items_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_detection_patterns" ADD CONSTRAINT "certificate_detection_patterns_certificate_type_id_certificate_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."certificate_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_outcome_rules" ADD CONSTRAINT "certificate_outcome_rules_certificate_type_id_certificate_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."certificate_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_types" ADD CONSTRAINT "certificate_types_stream_id_compliance_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."compliance_streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_conversation_id_chatbot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chatbot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_codes" ADD CONSTRAINT "classification_codes_certificate_type_id_certificate_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."certificate_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_certificates" ADD CONSTRAINT "component_certificates_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_certificates" ADD CONSTRAINT "component_certificates_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_component_type_id_component_types_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_alerts" ADD CONSTRAINT "contractor_alerts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_alerts" ADD CONSTRAINT "contractor_alerts_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_alerts" ADD CONSTRAINT "contractor_alerts_certification_id_contractor_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."contractor_certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_alerts" ADD CONSTRAINT "contractor_alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_alerts" ADD CONSTRAINT "contractor_alerts_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_assignments" ADD CONSTRAINT "contractor_assignments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_assignments" ADD CONSTRAINT "contractor_assignments_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_assignments" ADD CONSTRAINT "contractor_assignments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_assignments" ADD CONSTRAINT "contractor_assignments_remedial_action_id_remedial_actions_id_fk" FOREIGN KEY ("remedial_action_id") REFERENCES "public"."remedial_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_assignments" ADD CONSTRAINT "contractor_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_certifications" ADD CONSTRAINT "contractor_certifications_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_certifications" ADD CONSTRAINT "contractor_certifications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_certifications" ADD CONSTRAINT "contractor_certifications_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_verification_history" ADD CONSTRAINT "contractor_verification_history_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_verification_history" ADD CONSTRAINT "contractor_verification_history_certification_id_contractor_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."contractor_certifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_verification_history" ADD CONSTRAINT "contractor_verification_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_verification_history" ADD CONSTRAINT "contractor_verification_history_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_import_rows" ADD CONSTRAINT "data_import_rows_import_id_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."data_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_benchmark_set_id_benchmark_sets_id_fk" FOREIGN KEY ("benchmark_set_id") REFERENCES "public"."benchmark_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_schema_id_extraction_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."extraction_schemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_tier_audits" ADD CONSTRAINT "extraction_tier_audits_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_tier_audits" ADD CONSTRAINT "extraction_tier_audits_extraction_run_id_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_settings" ADD CONSTRAINT "factory_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_settings_audit" ADD CONSTRAINT "factory_settings_audit_setting_id_factory_settings_id_fk" FOREIGN KEY ("setting_id") REFERENCES "public"."factory_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_settings_audit" ADD CONSTRAINT "factory_settings_audit_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_extraction_run_id_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "public"."upload_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_risk_snapshots" ADD CONSTRAINT "property_risk_snapshots_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_risk_snapshots" ADD CONSTRAINT "property_risk_snapshots_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remedial_actions" ADD CONSTRAINT "remedial_actions_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remedial_actions" ADD CONSTRAINT "remedial_actions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_snapshot_id_property_risk_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."property_risk_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_factor_definitions" ADD CONSTRAINT "risk_factor_definitions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_snapshots" ADD CONSTRAINT "risk_snapshots_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;