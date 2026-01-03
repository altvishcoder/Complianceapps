import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum('user_role', ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER', 'ADMIN', 'MANAGER', 'OFFICER', 'VIEWER']);
export const complianceStatusEnum = pgEnum('compliance_status', ['COMPLIANT', 'EXPIRING_SOON', 'OVERDUE', 'NON_COMPLIANT', 'ACTION_REQUIRED', 'UNKNOWN']);
export const propertyTypeEnum = pgEnum('property_type', ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO']);
export const tenureEnum = pgEnum('tenure', ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY']);
export const certificateTypeEnum = pgEnum('certificate_type', ['GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT', 'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER', 'OTHER']);
export const certificateStatusEnum = pgEnum('certificate_status', ['UPLOADED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED']);
export const certificateOutcomeEnum = pgEnum('certificate_outcome', ['SATISFACTORY', 'UNSATISFACTORY', 'PASS', 'FAIL', 'AT_RISK', 'IMMEDIATELY_DANGEROUS']);
export const severityEnum = pgEnum('severity', ['IMMEDIATE', 'URGENT', 'PRIORITY', 'ROUTINE', 'ADVISORY']);
export const actionStatusEnum = pgEnum('action_status', ['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const propertySourceEnum = pgEnum('property_source', ['MANUAL', 'AUTO_EXTRACTED', 'IMPORTED']);
export const linkStatusEnum = pgEnum('link_status', ['VERIFIED', 'UNVERIFIED']);

export const extractionStatusEnum = pgEnum('extraction_status', [
  'PENDING', 'PROCESSING', 'VALIDATION_FAILED', 'REPAIR_IN_PROGRESS', 
  'AWAITING_REVIEW', 'APPROVED', 'REJECTED'
]);

export const chatIntentEnum = pgEnum('chat_intent', [
  'greeting', 'navigation', 'database', 'faq', 'rag', 'off_topic', 'complex'
]);
export const chatResponseSourceEnum = pgEnum('chat_response_source', [
  'static', 'faq_cache', 'faq_tfidf', 'database', 'rag', 'llm'
]);
export const staffStatusEnum = pgEnum('staff_status', ['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE']);
