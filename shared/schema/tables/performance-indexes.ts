export const performanceIndexDefinitions = `
-- Performance indexes for enterprise scale optimization (50k+ properties, millions of records)
-- These are applied via admin UI "Apply All Optimizations" after deployment

-- ============================================================================
-- CERTIFICATES (hundreds of thousands of records)
-- ============================================================================

-- Certificate queries by property and status (high frequency)
CREATE INDEX IF NOT EXISTS idx_certificates_property_status 
ON certificates(property_id, status, expiry_date);

-- Certificate expiry lookups for notification scans
CREATE INDEX IF NOT EXISTS idx_certificates_expiry 
ON certificates(expiry_date) 
WHERE status IN ('UPLOADED', 'PROCESSED', 'APPROVED');

-- Certificate by organisation for list queries (CRITICAL for org-scoped filtering)
CREATE INDEX IF NOT EXISTS idx_certificates_org_created 
ON certificates(organisation_id, created_at DESC);

-- Certificate by org + status + type for filtered queries
CREATE INDEX IF NOT EXISTS idx_certificates_org_status_type 
ON certificates(organisation_id, status, certificate_type);

-- Certificate by org + expiry for compliance dashboards
CREATE INDEX IF NOT EXISTS idx_certificates_org_expiry 
ON certificates(organisation_id, expiry_date) 
WHERE deleted_at IS NULL;

-- Certificate soft deletes filter
CREATE INDEX IF NOT EXISTS idx_certificates_deleted 
ON certificates(deleted_at) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- REMEDIAL ACTIONS (millions of records)
-- ============================================================================

-- Remedials by property and severity for dashboard
CREATE INDEX IF NOT EXISTS idx_remedials_property_severity 
ON remedial_actions(property_id, severity, status);

-- Remedials by status for action lists
CREATE INDEX IF NOT EXISTS idx_remedials_status_due 
ON remedial_actions(status, due_date);

-- Remedials by org + status + due_date (CRITICAL for org-scoped filtering)
CREATE INDEX IF NOT EXISTS idx_remedials_org_status_due 
ON remedial_actions(organisation_id, status, due_date);

-- Remedials by org + severity for urgent actions
CREATE INDEX IF NOT EXISTS idx_remedials_org_severity 
ON remedial_actions(organisation_id, severity, status) 
WHERE deleted_at IS NULL;

-- Remedials by certificate for linking
CREATE INDEX IF NOT EXISTS idx_remedials_certificate 
ON remedial_actions(certificate_id);

-- Remedials soft deletes filter
CREATE INDEX IF NOT EXISTS idx_remedials_deleted 
ON remedial_actions(deleted_at) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- PROPERTIES (50k+ records)
-- ============================================================================

-- Properties by block for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_properties_block 
ON properties(block_id, compliance_status);

-- Properties by org for filtered list queries (CRITICAL)
CREATE INDEX IF NOT EXISTS idx_properties_org_status 
ON properties(organisation_id, compliance_status);

-- Properties by org + created for pagination
CREATE INDEX IF NOT EXISTS idx_properties_org_created 
ON properties(organisation_id, created_at DESC);

-- Properties by UPRN for lookups
CREATE INDEX IF NOT EXISTS idx_properties_uprn 
ON properties(uprn) 
WHERE uprn IS NOT NULL;

-- Properties soft deletes filter
CREATE INDEX IF NOT EXISTS idx_properties_deleted 
ON properties(deleted_at) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMPONENTS/ASSETS (thousands of records)
-- ============================================================================

-- Components by property for asset health
CREATE INDEX IF NOT EXISTS idx_components_property_type 
ON components(property_id, component_type_id, compliance_status);

-- Components by block for building-level queries
CREATE INDEX IF NOT EXISTS idx_components_block 
ON components(block_id, is_active);

-- Components by org for filtered list
CREATE INDEX IF NOT EXISTS idx_components_org_active 
ON components(organisation_id, is_active);

-- Components condition for health queries
CREATE INDEX IF NOT EXISTS idx_components_condition 
ON components(condition, is_active) 
WHERE is_active = true;

-- ============================================================================
-- AUDIT EVENTS (millions of records) 
-- ============================================================================

-- Audit events for entity lookup (high frequency)
CREATE INDEX IF NOT EXISTS idx_audit_entity_timestamp 
ON audit_events(entity_type, entity_id, created_at DESC);

-- Audit events by organisation for audit log page (CRITICAL)
CREATE INDEX IF NOT EXISTS idx_audit_org_created 
ON audit_events(organisation_id, created_at DESC);

-- Audit events by event type for filtering
CREATE INDEX IF NOT EXISTS idx_audit_event_type 
ON audit_events(event_type, created_at DESC);

-- Audit events by user for user activity tracking
CREATE INDEX IF NOT EXISTS idx_audit_user_created 
ON audit_events(user_id, created_at DESC);

-- Audit events composite for common queries
CREATE INDEX IF NOT EXISTS idx_audit_org_type_created 
ON audit_events(organisation_id, event_type, created_at DESC);

-- ============================================================================
-- HIERARCHY TABLES
-- ============================================================================

-- Extraction runs by certificate for processing queries
CREATE INDEX IF NOT EXISTS idx_extraction_runs_cert_status 
ON extraction_runs(certificate_id, status);

-- Blocks by scheme for hierarchy navigation
CREATE INDEX IF NOT EXISTS idx_blocks_scheme 
ON blocks(scheme_id);

-- Blocks by org for filtered list
CREATE INDEX IF NOT EXISTS idx_blocks_org 
ON blocks(organisation_id);

-- Schemes by org for filtered list
CREATE INDEX IF NOT EXISTS idx_schemes_org 
ON schemes(organisation_id);

-- Spaces by property/block for hierarchy
CREATE INDEX IF NOT EXISTS idx_spaces_property 
ON spaces(property_id);

CREATE INDEX IF NOT EXISTS idx_spaces_block 
ON spaces(block_id);

-- Spaces by scheme for estate-wide spaces
CREATE INDEX IF NOT EXISTS idx_spaces_scheme 
ON spaces(scheme_id);

-- ============================================================================
-- CONTRACTORS
-- ============================================================================

-- Contractors by org
CREATE INDEX IF NOT EXISTS idx_contractors_org 
ON contractors(organisation_id, status);

-- ============================================================================
-- USERS & AUTH
-- ============================================================================

-- Users by org for filtered list
CREATE INDEX IF NOT EXISTS idx_users_org 
ON users(organisation_id);

-- Users by email for login lookups (partial unique)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);
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

// ============================================================================
// UKHDS 5-Level Hierarchy Views (Scheme → Block → Property → Space → Component)
// ============================================================================

export const hierarchyViewDefinitions = `
-- Scheme-level compliance rollup (top of hierarchy)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_scheme_rollup AS
SELECT 
    s.id as scheme_id,
    s.name as scheme_name,
    s.reference as scheme_reference,
    COUNT(DISTINCT b.id) as block_count,
    COUNT(DISTINCT p.id) as property_count,
    COUNT(DISTINCT sp.id) as space_count,
    COUNT(DISTINCT co.id) as component_count,
    COUNT(DISTINCT c.id) as certificate_count,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'COMPLIANT' THEN p.id END) as compliant_properties,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'NON_COMPLIANT' THEN p.id END) as non_compliant_properties,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'EXPIRING_SOON' THEN p.id END) as expiring_properties,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'OPEN') as open_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN') as urgent_actions,
    ROUND(
        (COUNT(DISTINCT CASE WHEN p.compliance_status = 'COMPLIANT' THEN p.id END)::numeric / 
        NULLIF(COUNT(DISTINCT p.id), 0) * 100), 2
    ) as compliance_percentage
FROM schemes s
LEFT JOIN blocks b ON b.scheme_id = s.id AND b.deleted_at IS NULL
LEFT JOIN properties p ON p.block_id = b.id AND p.deleted_at IS NULL
LEFT JOIN spaces sp ON (sp.scheme_id = s.id OR sp.block_id = b.id OR sp.property_id = p.id)
LEFT JOIN components co ON (co.property_id = p.id OR co.space_id = sp.id) AND co.is_active = true
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.reference;

-- Block-level compliance rollup (building layer)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_block_rollup AS
SELECT 
    b.id as block_id,
    b.name as block_name,
    b.scheme_id,
    s.name as scheme_name,
    COUNT(DISTINCT p.id) as property_count,
    COUNT(DISTINCT sp.id) as space_count,
    COUNT(DISTINCT co.id) as component_count,
    COUNT(DISTINCT c.id) as certificate_count,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'COMPLIANT' THEN p.id END) as compliant_properties,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'NON_COMPLIANT' THEN p.id END) as non_compliant_properties,
    COUNT(DISTINCT CASE WHEN p.compliance_status = 'EXPIRING_SOON' THEN p.id END) as expiring_properties,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'OPEN') as open_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN') as urgent_actions,
    ROUND(
        (COUNT(DISTINCT CASE WHEN p.compliance_status = 'COMPLIANT' THEN p.id END)::numeric / 
        NULLIF(COUNT(DISTINCT p.id), 0) * 100), 2
    ) as compliance_percentage,
    b.has_lift,
    b.has_communal_boiler
FROM blocks b
LEFT JOIN schemes s ON s.id = b.scheme_id
LEFT JOIN properties p ON p.block_id = b.id AND p.deleted_at IS NULL
LEFT JOIN spaces sp ON (sp.block_id = b.id OR sp.property_id = p.id)
LEFT JOIN components co ON (co.property_id = p.id OR co.space_id = sp.id) AND co.is_active = true
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.scheme_id, s.name, b.has_lift, b.has_communal_boiler;

-- Property-level summary (dwelling layer)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_summary AS
SELECT 
    p.id as property_id,
    p.uprn,
    p.address_line1,
    p.postcode,
    p.block_id,
    b.name as block_name,
    b.scheme_id,
    s.name as scheme_name,
    p.compliance_status,
    p.needs_verification,
    p.link_status,
    COUNT(DISTINCT sp.id) as space_count,
    COUNT(DISTINCT co.id) as component_count,
    COUNT(DISTINCT c.id) as certificate_count,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'APPROVED') as approved_certificates,
    COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE) as expired_certificates,
    COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE + INTERVAL '30 days' AND c.expiry_date::date >= CURRENT_DATE) as expiring_soon_certificates,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'OPEN') as open_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN') as urgent_actions,
    MAX(c.expiry_date) as next_expiry_date
FROM properties p
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN schemes s ON s.id = b.scheme_id
LEFT JOIN spaces sp ON sp.property_id = p.id
LEFT JOIN components co ON (co.property_id = p.id OR co.space_id = sp.id) AND co.is_active = true
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.uprn, p.address_line1, p.postcode, p.block_id, b.name, b.scheme_id, s.name, p.compliance_status, p.needs_verification, p.link_status;
`;

export const hierarchyViewIndexDefinitions = `
-- UKHDS Hierarchy view indexes for fast traversal
CREATE UNIQUE INDEX IF NOT EXISTS mv_scheme_rollup_idx ON mv_scheme_rollup(scheme_id);
CREATE UNIQUE INDEX IF NOT EXISTS mv_block_rollup_idx ON mv_block_rollup(block_id);
CREATE INDEX IF NOT EXISTS mv_block_rollup_scheme_idx ON mv_block_rollup(scheme_id);
CREATE UNIQUE INDEX IF NOT EXISTS mv_property_summary_idx ON mv_property_summary(property_id);
CREATE INDEX IF NOT EXISTS mv_property_summary_block_idx ON mv_property_summary(block_id);
CREATE INDEX IF NOT EXISTS mv_property_summary_scheme_idx ON mv_property_summary(scheme_id);
CREATE INDEX IF NOT EXISTS mv_property_summary_status_idx ON mv_property_summary(compliance_status);
`;

// ============================================================================
// Risk & ML Views for Predictive Compliance Radar
// ============================================================================

export const riskViewDefinitions = `
-- Risk aggregates for ML/Predictive Compliance Radar
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_risk_aggregates AS
SELECT 
    p.id as property_id,
    p.uprn,
    b.id as block_id,
    b.scheme_id,
    p.compliance_status,
    -- Certificate risk factors
    COUNT(DISTINCT c.id) as total_certificates,
    COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE) as expired_count,
    COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE + INTERVAL '30 days' AND c.expiry_date::date >= CURRENT_DATE) as expiring_30_days,
    COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE + INTERVAL '7 days' AND c.expiry_date::date >= CURRENT_DATE) as expiring_7_days,
    -- Remedial risk factors  
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'OPEN') as open_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN') as urgent_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'IMMEDIATE' AND ra.status = 'OPEN') as immediate_severity_actions,
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.due_date::date < CURRENT_DATE AND ra.status = 'OPEN') as overdue_actions,
    -- Component risk factors
    COUNT(DISTINCT co.id) as total_components,
    COUNT(DISTINCT co.id) FILTER (WHERE LOWER(co.condition) = 'poor') as poor_condition_components,
    COUNT(DISTINCT co.id) FILTER (WHERE LOWER(co.condition) = 'critical') as critical_components,
    COUNT(DISTINCT co.id) FILTER (WHERE co.needs_verification = true) as unverified_components,
    -- Calculated risk score (weighted formula)
    (
        COALESCE(COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE), 0) * 25 +
        COALESCE(COUNT(DISTINCT c.id) FILTER (WHERE c.expiry_date::date < CURRENT_DATE + INTERVAL '7 days' AND c.expiry_date::date >= CURRENT_DATE), 0) * 15 +
        COALESCE(COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN'), 0) * 30 +
        COALESCE(COUNT(DISTINCT ra.id) FILTER (WHERE ra.due_date::date < CURRENT_DATE AND ra.status = 'OPEN'), 0) * 20 +
        COALESCE(COUNT(DISTINCT co.id) FILTER (WHERE LOWER(co.condition) = 'critical'), 0) * 35
    ) as risk_score
FROM properties p
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
LEFT JOIN spaces sp ON sp.property_id = p.id
LEFT JOIN components co ON (co.property_id = p.id OR co.space_id = sp.id) AND co.is_active = true
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.uprn, b.id, b.scheme_id, p.compliance_status;
`;

export const riskViewIndexDefinitions = `
-- Risk view indexes for radar queries
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_aggregates_property_idx ON mv_risk_aggregates(property_id);
CREATE INDEX IF NOT EXISTS mv_risk_aggregates_block_idx ON mv_risk_aggregates(block_id);
CREATE INDEX IF NOT EXISTS mv_risk_aggregates_scheme_idx ON mv_risk_aggregates(scheme_id);
CREATE INDEX IF NOT EXISTS mv_risk_aggregates_score_idx ON mv_risk_aggregates(risk_score DESC);
CREATE INDEX IF NOT EXISTS mv_risk_aggregates_status_idx ON mv_risk_aggregates(compliance_status);
`;

// ============================================================================
// Operational Views (Expiry Calendar, Remedial Backlog)
// ============================================================================

export const operationalViewDefinitions = `
-- Certificate expiry calendar for upcoming expirations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_certificate_expiry_calendar AS
SELECT 
    c.id as certificate_id,
    c.certificate_type,
    c.expiry_date,
    c.property_id,
    p.uprn,
    p.address_line1,
    p.postcode,
    b.id as block_id,
    b.name as block_name,
    b.scheme_id,
    s.name as scheme_name,
    c.status,
    CASE 
        WHEN c.expiry_date::date < CURRENT_DATE THEN 'EXPIRED'
        WHEN c.expiry_date::date < CURRENT_DATE + INTERVAL '7 days' THEN 'CRITICAL'
        WHEN c.expiry_date::date < CURRENT_DATE + INTERVAL '30 days' THEN 'WARNING'
        WHEN c.expiry_date::date < CURRENT_DATE + INTERVAL '90 days' THEN 'UPCOMING'
        ELSE 'OK'
    END as urgency_level,
    (c.expiry_date::date - CURRENT_DATE) as days_until_expiry
FROM certificates c
JOIN properties p ON p.id = c.property_id
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN schemes s ON s.id = b.scheme_id
WHERE c.deleted_at IS NULL 
    AND c.expiry_date IS NOT NULL
    AND c.status IN ('UPLOADED', 'PROCESSING', 'APPROVED')
    AND c.expiry_date::date < CURRENT_DATE + INTERVAL '180 days';

-- Remedial actions backlog with aging
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_remedial_backlog AS
SELECT 
    ra.id as action_id,
    ra.description,
    ra.severity,
    ra.status,
    ra.due_date,
    ra.property_id,
    p.uprn,
    p.address_line1,
    p.postcode,
    b.id as block_id,
    b.name as block_name,
    b.scheme_id,
    s.name as scheme_name,
    ra.certificate_id,
    c.certificate_type,
    ra.category,
    ra.created_at,
    CASE 
        WHEN ra.due_date::date < CURRENT_DATE THEN 'OVERDUE'
        WHEN ra.due_date::date < CURRENT_DATE + INTERVAL '7 days' THEN 'DUE_SOON'
        ELSE 'ON_TRACK'
    END as due_status,
    CASE 
        WHEN ra.due_date IS NOT NULL THEN (CURRENT_DATE - ra.due_date::date)
        ELSE NULL
    END as days_overdue,
    (CURRENT_DATE - ra.created_at::date) as age_days
FROM remedial_actions ra
JOIN properties p ON p.id = ra.property_id
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN schemes s ON s.id = b.scheme_id
LEFT JOIN certificates c ON c.id = ra.certificate_id
WHERE ra.deleted_at IS NULL 
    AND ra.status IN ('OPEN', 'IN_PROGRESS');
`;

export const operationalViewIndexDefinitions = `
-- Operational view indexes
CREATE INDEX IF NOT EXISTS mv_expiry_calendar_date_idx ON mv_certificate_expiry_calendar(expiry_date);
CREATE INDEX IF NOT EXISTS mv_expiry_calendar_urgency_idx ON mv_certificate_expiry_calendar(urgency_level);
CREATE INDEX IF NOT EXISTS mv_expiry_calendar_type_idx ON mv_certificate_expiry_calendar(certificate_type);
CREATE INDEX IF NOT EXISTS mv_expiry_calendar_scheme_idx ON mv_certificate_expiry_calendar(scheme_id);
CREATE INDEX IF NOT EXISTS mv_remedial_backlog_severity_idx ON mv_remedial_backlog(severity, status);
CREATE INDEX IF NOT EXISTS mv_remedial_backlog_due_idx ON mv_remedial_backlog(due_date);
CREATE INDEX IF NOT EXISTS mv_remedial_backlog_scheme_idx ON mv_remedial_backlog(scheme_id);
CREATE INDEX IF NOT EXISTS mv_remedial_backlog_age_idx ON mv_remedial_backlog(age_days DESC);
`;

// ============================================================================
// Regulatory Views (TSM, Building Safety Act)
// ============================================================================

export const regulatoryViewDefinitions = `
-- TSM (Tenant Satisfaction Measures) compliance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tsm_metrics AS
SELECT 
    COALESCE(b.scheme_id, 'unlinked') as scheme_id,
    s.name as scheme_name,
    -- BS01: Properties with valid gas safety certificate
    COUNT(DISTINCT p.id) as total_properties,
    COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM certificates gc 
            WHERE gc.property_id = p.id 
            AND gc.certificate_type::text ILIKE '%gas%' 
            AND gc.deleted_at IS NULL
            AND gc.status = 'APPROVED'
            AND gc.expiry_date::date >= CURRENT_DATE
        )
    ) as gas_compliant_properties,
    -- BS02: Properties with valid electrical certificate
    COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM certificates ec 
            WHERE ec.property_id = p.id 
            AND (ec.certificate_type::text ILIKE '%eicr%' OR ec.certificate_type::text ILIKE '%electrical%')
            AND ec.deleted_at IS NULL
            AND ec.status = 'APPROVED'
            AND ec.expiry_date::date >= CURRENT_DATE
        )
    ) as electrical_compliant_properties,
    -- BS03: Properties with valid fire risk assessment
    COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM certificates fc 
            WHERE fc.property_id = p.id 
            AND fc.certificate_type::text ILIKE '%fire%' 
            AND fc.deleted_at IS NULL
            AND fc.status = 'APPROVED'
            AND fc.expiry_date::date >= CURRENT_DATE
        )
    ) as fire_compliant_properties,
    -- BS05: Properties with valid asbestos management survey
    COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM certificates ac 
            WHERE ac.property_id = p.id 
            AND ac.certificate_type::text ILIKE '%asbestos%' 
            AND ac.deleted_at IS NULL
            AND ac.status = 'APPROVED'
        )
    ) as asbestos_compliant_properties,
    -- BS06: Legionella risk assessment compliance
    COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM certificates lc 
            WHERE lc.property_id = p.id 
            AND (lc.certificate_type::text ILIKE '%legionella%' OR lc.certificate_type::text ILIKE '%water%')
            AND lc.deleted_at IS NULL
            AND lc.status = 'APPROVED'
            AND lc.expiry_date::date >= CURRENT_DATE
        )
    ) as water_compliant_properties,
    -- RP01: Remedial actions open count
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'OPEN') as total_open_remedials,
    -- RP02: Average repair completion time (completed in last 90 days)
    AVG(
        CASE WHEN ra.status = 'COMPLETED' AND ra.updated_at > CURRENT_DATE - INTERVAL '90 days'
        THEN EXTRACT(EPOCH FROM (ra.updated_at - ra.created_at)) / 86400
        ELSE NULL END
    ) as avg_repair_days
FROM properties p
LEFT JOIN blocks b ON b.id = p.block_id
LEFT JOIN schemes s ON s.id = b.scheme_id
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY COALESCE(b.scheme_id, 'unlinked'), s.name;

-- Building Safety Act 2022 coverage metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_building_safety_coverage AS
SELECT 
    b.id as block_id,
    b.name as block_name,
    b.scheme_id,
    s.name as scheme_name,
    b.has_lift,
    b.has_communal_boiler,
    COUNT(DISTINCT p.id) as dwelling_count,
    -- BSA Fire Safety compliance
    COUNT(DISTINCT c.id) FILTER (
        WHERE c.certificate_type::text ILIKE '%fire%' 
        AND c.status = 'APPROVED'
        AND c.expiry_date::date >= CURRENT_DATE
    ) as valid_fire_certificates,
    -- BSA Structural safety
    COUNT(DISTINCT c.id) FILTER (
        WHERE c.certificate_type::text ILIKE '%structural%' 
        AND c.status = 'APPROVED'
    ) as structural_certificates,
    -- BSA External wall systems (EWS1)
    COUNT(DISTINCT c.id) FILTER (
        WHERE (c.certificate_type::text ILIKE '%ews%' OR c.certificate_type::text ILIKE '%cladding%')
        AND c.status = 'APPROVED'
    ) as ews_certificates,
    -- Urgent remedials
    COUNT(DISTINCT ra.id) FILTER (WHERE ra.severity = 'URGENT' AND ra.status = 'OPEN') as urgent_remedials
FROM blocks b
LEFT JOIN schemes s ON s.id = b.scheme_id
LEFT JOIN properties p ON p.block_id = b.id AND p.deleted_at IS NULL
LEFT JOIN certificates c ON c.property_id = p.id AND c.deleted_at IS NULL
LEFT JOIN remedial_actions ra ON ra.property_id = p.id AND ra.deleted_at IS NULL
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.scheme_id, s.name, b.has_lift, b.has_communal_boiler;
`;

export const regulatoryViewIndexDefinitions = `
-- Regulatory view indexes
CREATE UNIQUE INDEX IF NOT EXISTS mv_tsm_metrics_scheme_idx ON mv_tsm_metrics(scheme_id);
CREATE UNIQUE INDEX IF NOT EXISTS mv_building_safety_block_idx ON mv_building_safety_coverage(block_id);
CREATE INDEX IF NOT EXISTS mv_building_safety_scheme_idx ON mv_building_safety_coverage(scheme_id);
`;

// ============================================================================
// Contractor Performance Views
// ============================================================================

export const contractorViewDefinitions = `
-- Contractor summary and status tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_contractor_sla AS
SELECT 
    ct.id as contractor_id,
    ct.company_name as contractor_name,
    ct.contact_email,
    ct.contact_phone,
    ct.trade_type,
    ct.gas_registration,
    ct.electrical_registration,
    ct.status,
    ct.is_internal,
    ct.department,
    ct.created_at,
    CASE WHEN ct.status = 'APPROVED' THEN true ELSE false END as is_active
FROM contractors ct
WHERE ct.deleted_at IS NULL;
`;

export const contractorViewIndexDefinitions = `
-- Contractor view indexes
CREATE UNIQUE INDEX IF NOT EXISTS mv_contractor_sla_idx ON mv_contractor_sla(contractor_id);
CREATE INDEX IF NOT EXISTS mv_contractor_sla_active_idx ON mv_contractor_sla(is_active);
CREATE INDEX IF NOT EXISTS mv_contractor_sla_status_idx ON mv_contractor_sla(status);
`;

// ============================================================================
// View Category Metadata for Admin UI
// ============================================================================

export const materializedViewCategories = {
  core: {
    name: 'Core Dashboard',
    description: 'Essential statistics for dashboard displays',
    views: ['mv_dashboard_stats', 'mv_certificate_compliance', 'mv_asset_health']
  },
  hierarchy: {
    name: 'UKHDS 5-Level Hierarchy',
    description: 'Scheme → Block → Property → Space → Component rollups',
    views: ['mv_scheme_rollup', 'mv_block_rollup', 'mv_property_summary']
  },
  risk: {
    name: 'Risk & ML',
    description: 'Predictive Compliance Radar aggregates',
    views: ['mv_risk_aggregates']
  },
  operational: {
    name: 'Operational',
    description: 'Expiry tracking and remedial backlog',
    views: ['mv_certificate_expiry_calendar', 'mv_remedial_backlog']
  },
  regulatory: {
    name: 'Regulatory Reporting',
    description: 'TSM metrics and Building Safety Act compliance',
    views: ['mv_tsm_metrics', 'mv_building_safety_coverage']
  },
  contractor: {
    name: 'Contractor Performance',
    description: 'SLA tracking and contractor metrics',
    views: ['mv_contractor_sla']
  }
};

// All view definitions combined for full creation
export const allMaterializedViewDefinitions = `
${materializedViewDefinitions}
${hierarchyViewDefinitions}
${riskViewDefinitions}
${operationalViewDefinitions}
${regulatoryViewDefinitions}
${contractorViewDefinitions}
`;

export const allMaterializedViewIndexDefinitions = `
${materializedViewIndexDefinitions}
${hierarchyViewIndexDefinitions}
${riskViewIndexDefinitions}
${operationalViewIndexDefinitions}
${regulatoryViewIndexDefinitions}
${contractorViewIndexDefinitions}
`;

// ============================================================================
// Audit Event Archival & Retention (for millions of audit records)
// ============================================================================

export const auditArchivalTableDefinition = `
-- Archive table for old audit events (cold storage structure)
CREATE TABLE IF NOT EXISTS audit_events_archive (
    id VARCHAR PRIMARY KEY,
    organisation_id VARCHAR NOT NULL,
    actor_id VARCHAR,
    actor_name TEXT,
    actor_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id VARCHAR NOT NULL,
    entity_name TEXT,
    property_id VARCHAR,
    certificate_id VARCHAR,
    before_state JSONB,
    after_state JSONB,
    changes JSONB,
    message TEXT NOT NULL,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_org_created 
ON audit_events_archive(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_archive_entity 
ON audit_events_archive(entity_type, entity_id);

-- Audit retention settings table
CREATE TABLE IF NOT EXISTS audit_retention_settings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id VARCHAR NOT NULL UNIQUE,
    hot_retention_days INTEGER NOT NULL DEFAULT 90,
    archive_retention_days INTEGER NOT NULL DEFAULT 730,
    auto_archive_enabled BOOLEAN NOT NULL DEFAULT true,
    last_archive_run TIMESTAMP,
    last_purge_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
`;

// ============================================================================
// Connection Pooling & Scalability Notes
// ============================================================================

export const scalabilityNotes = {
  connectionPooling: {
    current: 'Neon HTTP driver (single connection per request)',
    recommended: 'Neon WebSocket driver with connection pooling OR PgBouncer',
    reasoning: 'At 50k+ properties with concurrent users, single-connection model will saturate. Need pooled connections.',
    implementation: [
      '1. Switch from @neondatabase/serverless HTTP to WebSocket mode',
      '2. Or deploy PgBouncer sidecar in production',
      '3. Configure pool_size based on expected concurrent connections (10-50)',
      '4. Monitor connection pool saturation via pg_stat_activity'
    ]
  },
  queryOptimization: {
    implemented: [
      'DB-level pagination for /api/properties and /api/certificates',
      'LEFT JOINs instead of N+1 queries for enrichment',
      'Composite indexes on organisation_id + status/date columns',
      'Soft delete filters using partial indexes'
    ],
    pending: [
      'Audit event archival/retention job',
      'Connection pool monitoring dashboard'
    ]
  },
  materializedViews: {
    refreshStrategy: 'CONCURRENT-only (no blocking) with staggered scheduling',
    staleness: 'Configurable threshold (default 6 hours)',
    categories: ['core', 'hierarchy', 'risk', 'operational', 'regulatory', 'contractor']
  }
};

// Export archival function SQL
export const archiveOldAuditEventsSQL = (daysOld: number = 90) => `
-- Archive audit events older than ${daysOld} days
INSERT INTO audit_events_archive 
SELECT 
    id, organisation_id, actor_id, actor_name, actor_type::text,
    event_type::text, entity_type::text, entity_id, entity_name,
    property_id, certificate_id, before_state, after_state, changes,
    message, metadata, ip_address, user_agent, created_at, NOW()
FROM audit_events
WHERE created_at < NOW() - INTERVAL '${daysOld} days'
ON CONFLICT (id) DO NOTHING;

-- Delete archived events from main table
DELETE FROM audit_events
WHERE created_at < NOW() - INTERVAL '${daysOld} days'
AND id IN (SELECT id FROM audit_events_archive);
`;

export const purgeOldArchivesSQL = (daysOld: number = 730) => `
-- Purge archived events older than ${daysOld} days
DELETE FROM audit_events_archive
WHERE archived_at < NOW() - INTERVAL '${daysOld} days';
`;
