export const performanceIndexDefinitions = `
-- Performance indexes for scale optimization
-- These are applied at startup if they don't exist

-- Certificate queries by property and status (high frequency)
CREATE INDEX IF NOT EXISTS idx_certificates_property_status 
ON certificates(property_id, status, expiry_date);

-- Certificate expiry lookups for notification scans
CREATE INDEX IF NOT EXISTS idx_certificates_expiry 
ON certificates(expiry_date) 
WHERE status IN ('UPLOADED', 'PROCESSED', 'APPROVED');

-- Certificate by organisation for list queries
CREATE INDEX IF NOT EXISTS idx_certificates_org_created 
ON certificates(organisation_id, created_at DESC);

-- Remedials by property and severity for dashboard
CREATE INDEX IF NOT EXISTS idx_remedials_property_severity 
ON remedial_actions(property_id, severity, status);

-- Remedials by status for action lists
CREATE INDEX IF NOT EXISTS idx_remedials_status_due 
ON remedial_actions(status, due_date);

-- Properties by block for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_properties_block 
ON properties(block_id, compliance_status);

-- Components by property for asset health
CREATE INDEX IF NOT EXISTS idx_components_property_type 
ON components(property_id, component_type_id, compliance_status);

-- Components by block for building-level queries
CREATE INDEX IF NOT EXISTS idx_components_block 
ON components(block_id, is_active);

-- Audit events for entity lookup (high frequency)
CREATE INDEX IF NOT EXISTS idx_audit_entity_timestamp 
ON audit_events(entity_type, entity_id, created_at DESC);

-- Audit events by organisation for audit log page
CREATE INDEX IF NOT EXISTS idx_audit_org_created 
ON audit_events(organisation_id, created_at DESC);

-- Extraction runs by certificate for processing queries
CREATE INDEX IF NOT EXISTS idx_extraction_runs_cert_status 
ON extraction_runs(certificate_id, status);

-- Blocks by scheme for hierarchy navigation
CREATE INDEX IF NOT EXISTS idx_blocks_scheme 
ON blocks(scheme_id);

-- Spaces by property/block for hierarchy
CREATE INDEX IF NOT EXISTS idx_spaces_property 
ON spaces(property_id);

CREATE INDEX IF NOT EXISTS idx_spaces_block 
ON spaces(block_id);
`;

export const materializedViewDefinitions = `
-- Materialized views for dashboard statistics
-- Created at startup, refreshed on-demand via admin jobs

-- Dashboard compliance statistics by scheme
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT 
    COALESCE(b.scheme_id, 'unlinked') as scheme_id,
    COUNT(DISTINCT p.id) as property_count,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'COMPLIANT' THEN p.id END) as compliant_count,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'NON_COMPLIANT' THEN p.id END) as non_compliant_count,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'EXPIRING_SOON' THEN p.id END) as expiring_soon_count,
    COUNT(DISTINCT c.id) as certificate_count,
    COUNT(DISTINCT CASE WHEN ra.status = 'OPEN' THEN ra.id END) as open_actions_count
FROM properties p
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY COALESCE(b.scheme_id, 'unlinked');

-- Certificate compliance summary by type
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_certificate_compliance AS
SELECT 
    certificate_type,
    status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date::date < CURRENT_DATE) as expired_count,
    COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date::date < CURRENT_DATE + INTERVAL '30 days' AND expiry_date::date >= CURRENT_DATE) as expiring_soon_count
FROM certificates
WHERE deleted_at IS NULL
GROUP BY certificate_type, status;

-- Asset health summary by property (using condition text field)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_asset_health AS
SELECT 
    c.property_id,
    COUNT(*) as total_components,
    COUNT(*) FILTER (WHERE LOWER(c.condition) = 'good') as good_count,
    COUNT(*) FILTER (WHERE LOWER(c.condition) = 'fair') as fair_count,
    COUNT(*) FILTER (WHERE LOWER(c.condition) = 'poor') as poor_count,
    COUNT(*) FILTER (WHERE LOWER(c.condition) = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE c.needs_verification = true) as pending_verification_count
FROM components c
WHERE c.is_active = true AND c.property_id IS NOT NULL
GROUP BY c.property_id;
`;

export const materializedViewIndexDefinitions = `
-- Indexes for materialized views (created after views exist)
CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_stats_scheme_idx ON mv_dashboard_stats(scheme_id);
CREATE UNIQUE INDEX IF NOT EXISTS mv_certificate_compliance_idx ON mv_certificate_compliance(certificate_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS mv_asset_health_property_idx ON mv_asset_health(property_id);
`;

export const expiryTrackerTableDefinition = `
-- Lightweight certificate expiry tracking for efficient scans
CREATE TABLE IF NOT EXISTS certificate_expiry_tracker (
    certificate_id VARCHAR PRIMARY KEY,
    expiry_date DATE NOT NULL,
    certificate_type TEXT NOT NULL,
    property_id VARCHAR NOT NULL,
    notified_30_day BOOLEAN DEFAULT FALSE,
    notified_7_day BOOLEAN DEFAULT FALSE,
    notified_expired BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiry_tracker_date ON certificate_expiry_tracker(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiry_tracker_notify ON certificate_expiry_tracker(expiry_date) 
WHERE notified_30_day = FALSE OR notified_7_day = FALSE;
`;

export const riskSnapshotTableDefinition = `
-- Risk score snapshots for cached ML/risk calculations
CREATE TABLE IF NOT EXISTS risk_snapshots (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id VARCHAR NOT NULL,
    risk_score REAL NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'LOW',
    risk_factors JSONB DEFAULT '[]',
    compliance_score REAL DEFAULT 0,
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_entity ON risk_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_level ON risk_snapshots(risk_level, entity_type);
`;

export const assetHealthSummaryTableDefinition = `
-- Pre-computed asset health summaries
CREATE TABLE IF NOT EXISTS asset_health_summary (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id VARCHAR NOT NULL,
    total_components INTEGER NOT NULL DEFAULT 0,
    good_count INTEGER NOT NULL DEFAULT 0,
    fair_count INTEGER NOT NULL DEFAULT 0,
    poor_count INTEGER NOT NULL DEFAULT 0,
    critical_count INTEGER NOT NULL DEFAULT 0,
    health_score REAL NOT NULL DEFAULT 0,
    pending_verification INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_health_entity ON asset_health_summary(entity_type, entity_id);
`;
