import { db } from "../db";
import { sql } from "drizzle-orm";
import { jobLogger as log } from "../logger";

export async function createReportingViews() {
  log.info("Creating materialized views for reporting...");

  try {
    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_summary AS
      SELECT 
        c.compliance_stream as stream,
        c.certificate_type as type,
        COUNT(*) as total_certificates,
        COUNT(*) FILTER (WHERE c.status = 'COMPLIANT') as compliant_count,
        COUNT(*) FILTER (WHERE c.status = 'NON_COMPLIANT') as non_compliant_count,
        COUNT(*) FILTER (WHERE c.status = 'EXPIRED') as expired_count,
        COUNT(*) FILTER (WHERE c.expiry_date < CURRENT_DATE + INTERVAL '30 days' AND c.expiry_date >= CURRENT_DATE) as expiring_soon,
        ROUND(
          (COUNT(*) FILTER (WHERE c.status = 'COMPLIANT')::numeric / NULLIF(COUNT(*), 0) * 100), 
          2
        ) as compliance_percentage,
        MAX(c.created_at) as last_updated
      FROM certificates c
      WHERE c.status IS NOT NULL
      GROUP BY c.compliance_stream, c.certificate_type
    `);

    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_health AS
      SELECT 
        p.id as property_id,
        p.address,
        p.scheme_id,
        COUNT(DISTINCT c.id) as total_certificates,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLIANT') as compliant_certificates,
        COUNT(DISTINCT ra.id) FILTER (WHERE ra.status IN ('OPEN', 'IN_PROGRESS')) as open_actions,
        ROUND(
          (COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLIANT')::numeric / 
           NULLIF(COUNT(DISTINCT c.id), 0) * 100), 
          2
        ) as health_score,
        MAX(c.created_at) as last_certificate_date
      FROM properties p
      LEFT JOIN certificates c ON c.property_id = p.id
      LEFT JOIN remedial_actions ra ON ra.property_id = p.id
      GROUP BY p.id, p.address, p.scheme_id
    `);

    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_contractor_performance AS
      SELECT 
        con.id as contractor_id,
        con.name as contractor_name,
        COUNT(DISTINCT c.id) as total_jobs,
        AVG(
          EXTRACT(DAY FROM (c.created_at - c.inspection_date))
        ) as avg_turnaround_days,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLIANT') as successful_jobs,
        ROUND(
          (COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'COMPLIANT')::numeric / 
           NULLIF(COUNT(DISTINCT c.id), 0) * 100), 
          2
        ) as success_rate
      FROM contractors con
      LEFT JOIN certificates c ON c.contractor_id = con.id
      GROUP BY con.id, con.name
    `);

    await db.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_trends AS
      SELECT 
        DATE_TRUNC('month', c.created_at) as month,
        c.compliance_stream as stream,
        COUNT(*) as certificates_issued,
        COUNT(*) FILTER (WHERE c.status = 'COMPLIANT') as compliant,
        COUNT(*) FILTER (WHERE c.status = 'NON_COMPLIANT') as non_compliant
      FROM certificates c
      WHERE c.created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', c.created_at), c.compliance_stream
      ORDER BY month DESC, stream
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mv_compliance_summary_stream 
      ON mv_compliance_summary (stream)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mv_property_health_score 
      ON mv_property_health (health_score)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_mv_contractor_performance_rate 
      ON mv_contractor_performance (success_rate)
    `);

    log.info("Materialized views created successfully");
  } catch (error) {
    log.error({ error }, "Error creating materialized views");
    throw error;
  }
}

export async function refreshReportingViews() {
  log.info("Refreshing materialized views...");
  
  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_summary`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_health`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_contractor_performance`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_trends`);
    
    log.info("Materialized views refreshed successfully");
  } catch (error) {
    log.error({ error }, "Error refreshing materialized views");
    throw error;
  }
}

export async function getReportingMetrics() {
  const cacheStats = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM mv_compliance_summary) as compliance_rows,
      (SELECT COUNT(*) FROM mv_property_health) as property_rows,
      (SELECT COUNT(*) FROM mv_contractor_performance) as contractor_rows,
      (SELECT COUNT(*) FROM mv_monthly_trends) as trend_rows
  `);
  
  return {
    materializedViews: 4,
    lastRefresh: new Date().toISOString(),
    rowCounts: cacheStats.rows[0]
  };
}
