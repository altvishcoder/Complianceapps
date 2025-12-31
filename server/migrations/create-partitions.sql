-- PostgreSQL Table Partitioning for Large Tables
-- This script creates partitioned versions of high-volume tables

-- NOTE: This is a planning document for future implementation
-- Partition strategy: Range partitioning by created_at (monthly)
-- Tables to partition: certificates, audit_events, ingestion_batches

-- Step 1: Create partitioned certificates table (example structure)
-- CREATE TABLE certificates_partitioned (
--   LIKE certificates INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- Step 2: Create monthly partitions
-- CREATE TABLE certificates_y2024m01 PARTITION OF certificates_partitioned
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- CREATE TABLE certificates_y2024m02 PARTITION OF certificates_partitioned
--   FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... continue for each month

-- Step 3: Create indexes on partitions
-- CREATE INDEX idx_certificates_y2024m01_org ON certificates_y2024m01(organisation_id);
-- CREATE INDEX idx_certificates_y2024m01_status ON certificates_y2024m01(status);

-- For now, we'll add composite indexes to improve query performance
-- without the complexity of full partitioning

-- Composite indexes for certificates table
CREATE INDEX IF NOT EXISTS idx_certificates_org_created 
  ON certificates(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_property_status 
  ON certificates(property_id, status);

CREATE INDEX IF NOT EXISTS idx_certificates_type_expiry 
  ON certificates(type, expiry_date) 
  WHERE expiry_date IS NOT NULL;

-- Composite indexes for audit_events table
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created 
  ON audit_events(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity_type_id 
  ON audit_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_created 
  ON audit_events(event_type, created_at DESC);

-- Composite indexes for ingestion_batches table  
CREATE INDEX IF NOT EXISTS idx_ingestion_batches_org_created 
  ON ingestion_batches(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_batches_status_created 
  ON ingestion_batches(status, created_at DESC);

-- Composite indexes for remedial_actions table (note: no organisation_id column)
CREATE INDEX IF NOT EXISTS idx_remedial_actions_property_status 
  ON remedial_actions(property_id, status);

CREATE INDEX IF NOT EXISTS idx_remedial_actions_severity_status
  ON remedial_actions(severity, status);

-- Add partial index for active processing
CREATE INDEX IF NOT EXISTS idx_certificates_processing 
  ON certificates(created_at DESC) 
  WHERE status = 'PROCESSING';
