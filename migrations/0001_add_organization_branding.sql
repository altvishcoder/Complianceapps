-- Add organization_branding table for white-label support
-- This table stores branding configuration per organization for cloud-agnostic deployments

CREATE TABLE IF NOT EXISTS organization_branding (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id VARCHAR NOT NULL UNIQUE,
  app_name TEXT NOT NULL DEFAULT 'SocialComply',
  logo_url TEXT,
  logo_light_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  accent_color TEXT DEFAULT '#60a5fa',
  font_family TEXT DEFAULT 'Inter',
  custom_css TEXT,
  meta_title TEXT,
  meta_description TEXT,
  support_email TEXT,
  support_phone TEXT,
  footer_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed default branding
INSERT INTO organization_branding (
  organisation_id, 
  app_name, 
  primary_color, 
  secondary_color, 
  accent_color, 
  meta_title, 
  meta_description, 
  footer_text
)
VALUES (
  'default', 
  'SocialComply', 
  '#3b82f6', 
  '#1e40af', 
  '#60a5fa', 
  'SocialComply - Compliance Management', 
  'UK Social Housing Compliance Management Platform', 
  'SocialComply - Keeping Homes Safe'
)
ON CONFLICT (organisation_id) DO NOTHING;
