import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../server/db';
import {
  certificates,
  extractions,
  remedialActions,
  extractionRuns,
  extractionTierAudits,
  humanReviews,
  benchmarkSets,
  benchmarkItems,
  evalRuns,
  certificateVersions,
  componentCertificates,
  auditEvents,
  auditFieldChanges,
  properties,
  blocks,
  schemes,
  components,
  spaces,
  riskAlerts,
  propertyRiskSnapshots,
  riskSnapshots,
  mlPredictions,
  mlFeedback,
  extractionCorrections,
  ingestionJobs,
  ingestionBatches,
  complianceCalendarEvents,
  contractorAssignments,
  hazardActions,
  hazardCases,
  tenantCommunications,
  tenants,
  households,
  serviceRequests,
  tsmSnapshots,
  tsmMeasures,
  safetyCaseReviews,
  mandatoryOccurrenceReports,
  buildingSafetyProfiles,
  gasApplianceRecords,
  electricalCircuitRecords,
  fireSystemRecords,
  asbestosSurveyRecords,
  waterTemperatureRecords,
} from '../shared/schema';
import { sql } from 'drizzle-orm';

describe('WipeData FK Dependencies', () => {
  const FK_DEPENDENCIES = [
    { child: 'extraction_tier_audits', parent: 'extraction_runs', fkColumn: 'extraction_run_id' },
    { child: 'extraction_tier_audits', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'human_reviews', parent: 'extraction_runs', fkColumn: 'extraction_run_id' },
    { child: 'benchmark_items', parent: 'benchmark_sets', fkColumn: 'benchmark_set_id' },
    { child: 'benchmark_items', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'eval_runs', parent: 'benchmark_sets', fkColumn: 'benchmark_set_id' },
    { child: 'extractions', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'remedial_actions', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'extraction_runs', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'certificate_versions', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'component_certificates', parent: 'certificates', fkColumn: 'certificate_id' },
    { child: 'component_certificates', parent: 'components', fkColumn: 'component_id' },
    { child: 'audit_field_changes', parent: 'audit_events', fkColumn: 'audit_event_id' },
    { child: 'risk_alerts', parent: 'property_risk_snapshots', fkColumn: 'snapshot_id' },
    { child: 'components', parent: 'properties', fkColumn: 'property_id' },
    { child: 'spaces', parent: 'properties', fkColumn: 'property_id' },
    { child: 'properties', parent: 'blocks', fkColumn: 'block_id' },
    { child: 'blocks', parent: 'schemes', fkColumn: 'scheme_id' },
  ];

  const WIPE_ORDER_NON_PROPERTIES = [
    'human_reviews',
    'eval_runs',
    'benchmark_items',
    'benchmark_sets',
    'extraction_tier_audits',
    'extraction_runs',
    'certificate_versions',
    'component_certificates',
    'remedial_actions',
    'extractions',
    'certificates',
  ];

  const WIPE_ORDER_WITH_PROPERTIES = [
    ...WIPE_ORDER_NON_PROPERTIES,
    'risk_alerts',
    'property_risk_snapshots',
    'risk_snapshots',
    'hazard_actions',
    'hazard_cases',
    'tenant_communications',
    'tenants',
    'households',
    'service_requests',
    'tsm_snapshots',
    'tsm_measures',
    'safety_case_reviews',
    'mandatory_occurrence_reports',
    'building_safety_profiles',
    'gas_appliance_records',
    'electrical_circuit_records',
    'fire_system_records',
    'asbestos_survey_records',
    'water_temperature_records',
    'ingestion_jobs',
    'ingestion_batches',
    'audit_field_changes',
    'audit_events',
    'ml_feedback',
    'ml_predictions',
    'extraction_corrections',
    'compliance_calendar_events',
    'contractor_assignments',
    'components',
    'spaces',
    'properties',
    'blocks',
    'schemes',
  ];

  it('should have correct deletion order for non-property wipe', () => {
    const relevantDeps = FK_DEPENDENCIES.filter(dep => 
      WIPE_ORDER_NON_PROPERTIES.includes(dep.child) && 
      WIPE_ORDER_NON_PROPERTIES.includes(dep.parent)
    );

    for (const dep of relevantDeps) {
      const childIndex = WIPE_ORDER_NON_PROPERTIES.indexOf(dep.child);
      const parentIndex = WIPE_ORDER_NON_PROPERTIES.indexOf(dep.parent);
      
      expect(childIndex, 
        `FK violation: ${dep.child} (index ${childIndex}) must be deleted before ${dep.parent} (index ${parentIndex}) due to ${dep.fkColumn}`
      ).toBeLessThan(parentIndex);
    }
  });

  it('should have correct deletion order for full wipe with properties', () => {
    const relevantDeps = FK_DEPENDENCIES.filter(dep => 
      WIPE_ORDER_WITH_PROPERTIES.includes(dep.child) && 
      WIPE_ORDER_WITH_PROPERTIES.includes(dep.parent)
    );

    for (const dep of relevantDeps) {
      const childIndex = WIPE_ORDER_WITH_PROPERTIES.indexOf(dep.child);
      const parentIndex = WIPE_ORDER_WITH_PROPERTIES.indexOf(dep.parent);
      
      expect(childIndex, 
        `FK violation: ${dep.child} (index ${childIndex}) must be deleted before ${dep.parent} (index ${parentIndex}) due to ${dep.fkColumn}`
      ).toBeLessThan(parentIndex);
    }
  });

  it('should delete extractionTierAudits before extractionRuns', () => {
    const tierAuditIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('extraction_tier_audits');
    const runIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('extraction_runs');
    expect(tierAuditIdx).toBeLessThan(runIdx);
  });

  it('should delete auditFieldChanges before auditEvents', () => {
    const fieldIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('audit_field_changes');
    const eventIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('audit_events');
    expect(fieldIdx).toBeLessThan(eventIdx);
  });

  it('should delete certificateVersions before certificates', () => {
    const versionIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('certificate_versions');
    const certIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('certificates');
    expect(versionIdx).toBeLessThan(certIdx);
  });

  it('should delete componentCertificates before certificates', () => {
    const compCertIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('component_certificates');
    const certIdx = WIPE_ORDER_NON_PROPERTIES.indexOf('certificates');
    expect(compCertIdx).toBeLessThan(certIdx);
  });

  it('should delete componentCertificates before components', () => {
    const compCertIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('component_certificates');
    const compIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('components');
    expect(compCertIdx).toBeLessThan(compIdx);
  });

  it('should delete riskAlerts before propertyRiskSnapshots', () => {
    const alertIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('risk_alerts');
    const snapshotIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('property_risk_snapshots');
    expect(alertIdx).toBeLessThan(snapshotIdx);
  });

  it('should delete components before properties', () => {
    const compIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('components');
    const propIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('properties');
    expect(compIdx).toBeLessThan(propIdx);
  });

  it('should delete properties before blocks', () => {
    const propIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('properties');
    const blockIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('blocks');
    expect(propIdx).toBeLessThan(blockIdx);
  });

  it('should delete blocks before schemes', () => {
    const blockIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('blocks');
    const schemeIdx = WIPE_ORDER_WITH_PROPERTIES.indexOf('schemes');
    expect(blockIdx).toBeLessThan(schemeIdx);
  });
});

describe('WipeData Database Integration', () => {
  it('should verify database connection is available', async () => {
    const result = await db.execute(sql`SELECT 1 as test`);
    expect(result.rows).toBeDefined();
  });

  it('should be able to count records in key tables', async () => {
    const certCount = await db.select({ count: sql<number>`count(*)` }).from(certificates);
    expect(certCount).toBeDefined();
    expect(certCount[0]).toHaveProperty('count');
  });
});
