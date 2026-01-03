# Changelog

All notable changes to ComplianceAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version management system with release notes
- API endpoint for version information

## [0.9.0] - 2026-01-03

### Highlights
- Pre-release version with core compliance management features
- UKHDS-aligned 5-level asset hierarchy
- AI-powered document extraction

### Added
- Property hierarchy management (Schemes, Blocks, Dwellings, Spaces, Components)
- 80+ compliance certificate types across 16 compliance streams
- AI document extraction using Claude Vision for 45 extraction schemas
- Remedial action tracking with configurable classification codes
- Risk Radar with predictive compliance scoring
- System health monitoring with job queue and cache statistics
- AI Assistant chatbot with 5-layer cost-optimized architecture
- CSV import functionality for properties and components
- External ingestion API for machine-to-machine integration
- Role-based access control with hierarchical permissions
- Dark mode support with mobile-responsive design
- HeroStats dashboard grid component across major pages
- Chatbot integration with system monitoring queries

### Changed
- Updated navigation structure with Command Centre and Operations sections
- Improved pagination performance for large datasets

### Security
- PostgreSQL-backed rate limiting
- Session-based authentication with secure cookie handling
- Admin Factory Settings authorization with audit logging

## [0.8.0] - 2025-12-15

### Highlights
- Enhanced reporting and analytics capabilities
- Contractor management module

### Added
- Scheduled reports with PDF/CSV/Excel export options
- Contractor portal with compliance tracking
- HeroStats dashboard components for key metrics
- Remedial Kanban board for action management

### Fixed
- Pagination for large datasets now computes stats correctly
- Improved error handling in API routes

## [0.7.0] - 2025-11-20

### Highlights
- Initial beta release
- Core property and certificate management

### Added
- Basic property CRUD operations
- Certificate upload and viewing functionality
- User authentication with session management
- Initial database schema with Drizzle ORM

---

## Pre-1.0 Versioning Convention

While in pre-1.0 development:
- **Minor version** (0.X.0): May include breaking changes
- **Patch version** (0.0.X): Feature additions and bug fixes

Version 1.0.0 will be released when:
- All core UKHDS compliance features are complete
- Production-ready stability is achieved
- Security audit is completed
- Documentation is comprehensive
