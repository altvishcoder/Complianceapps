export const APP_VERSION = "0.9.0";
export const APP_NAME = "ComplianceAI";

export interface VersionInfo {
  version: string;
  name: string;
  environment: string;
  buildTime: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    version: APP_VERSION,
    name: APP_NAME,
    environment: process.env.NODE_ENV || "development",
    buildTime: new Date().toISOString(),
  };
}

export const RELEASE_NOTES: Record<string, { date: string; highlights: string[]; features: string[]; fixes: string[] }> = {
  "0.9.0": {
    date: "2026-01-03",
    highlights: [
      "Pre-release version with core compliance management features",
      "UKHDS-aligned 5-level asset hierarchy",
      "AI-powered document extraction",
    ],
    features: [
      "Property hierarchy management (Schemes, Blocks, Dwellings, Spaces, Components)",
      "80+ compliance certificate types across 16 compliance streams",
      "AI document extraction using Claude Vision for 45 extraction schemas",
      "Remedial action tracking with configurable classification codes",
      "Risk Radar with predictive compliance scoring",
      "System health monitoring with job queue and cache stats",
      "AI Assistant chatbot with 5-layer cost-optimized architecture",
      "CSV import for properties and components",
      "External ingestion API for machine-to-machine integration",
      "Role-based access control with hierarchical permissions",
      "Dark mode support with mobile-responsive design",
    ],
    fixes: [],
  },
  "0.8.0": {
    date: "2025-12-15",
    highlights: [
      "Enhanced reporting and analytics",
      "Contractor management module",
    ],
    features: [
      "Scheduled reports with PDF/CSV/Excel export",
      "Contractor portal with compliance tracking",
      "HeroStats dashboard components",
      "Remedial Kanban board",
    ],
    fixes: [
      "Fixed pagination for large datasets",
      "Improved error handling in API routes",
    ],
  },
  "0.7.0": {
    date: "2025-11-20",
    highlights: [
      "Initial beta release",
      "Core property and certificate management",
    ],
    features: [
      "Basic property CRUD operations",
      "Certificate upload and viewing",
      "User authentication with session management",
    ],
    fixes: [],
  },
};
