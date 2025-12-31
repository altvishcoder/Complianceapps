-- Performance indexes for frequently queried columns
-- Run this migration to optimize database query performance

-- Certificates indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_org_id ON certificates(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_type ON certificates(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_expiry ON certificates(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_created_at ON certificates(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certificates_property_id ON certificates(property_id);

-- Properties indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_org_id ON properties(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_scheme_id ON properties(scheme_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_block_id ON properties(block_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_compliance_status ON properties(compliance_status);

-- Remedial actions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_remedial_actions_org_id ON remedial_actions(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_remedial_actions_status ON remedial_actions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_remedial_actions_severity ON remedial_actions(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_remedial_actions_certificate_id ON remedial_actions(certificate_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_remedial_actions_due_date ON remedial_actions(due_date) WHERE due_date IS NOT NULL;

-- Audit events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_org_id ON audit_events(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_entity_type ON audit_events(entity_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_entity_id ON audit_events(entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- Ingestion batches indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_batches_org_id ON ingestion_batches(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_batches_status ON ingestion_batches(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_batches_created_at ON ingestion_batches(created_at);

-- Units indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_units_org_id ON units(organisation_id);

-- Components indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_components_unit_id ON components(unit_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_components_type ON components(type);

-- Users indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org_id ON users(organisation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
