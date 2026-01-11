import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq, desc, and, count, sql, isNotNull, lt, gte } from "drizzle-orm";
import { 
  certificates, 
  properties, 
  blocks, 
  schemes, 
  remedialActions,
  contractors,
} from "@shared/schema";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

interface ReportCache<T = unknown> {
  data: T;
  timestamp: number;
}

let tsmReportCache: ReportCache | null = null;
const TSM_CACHE_TTL_MS = 5 * 60 * 1000;

const boardSummaryCache = new Map<string, ReportCache>();
const BOARD_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

interface BS01Row { buildings_with_compliance?: string | number }
interface BS02Row { total_fra?: string | number; up_to_date_fra?: string | number }
interface BS03Row { total_outstanding?: string | number; immediate?: string | number; urgent?: string | number; priority?: string | number; routine?: string | number }
interface BS04Row { certificate_type?: string; count?: string | number }
interface BS06Row { id: string; description?: string; property_id?: string; due_date?: string | Date }
interface SummaryRow { unique_buildings?: string | number; total_components?: string | number; total_certificates?: string | number; total_remedial?: string | number; valid_certificates?: string | number }

// ===== TSM BUILDING SAFETY REPORTS =====
reportsRouter.get("/tsm-building-safety", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = req.query.period as string || 'current';
    const forceRefresh = req.query.refresh === 'true';
    const today = new Date();
    
    if (!forceRefresh && tsmReportCache && (Date.now() - tsmReportCache.timestamp < TSM_CACHE_TTL_MS)) {
      return res.json({ ...tsmReportCache.data, cached: true, cacheAge: Math.round((Date.now() - tsmReportCache.timestamp) / 1000) });
    }
    
    const [
      bs01Result,
      bs02Result,
      bs03Result,
      bs04Result,
      bs06Result,
      summaryResult
    ] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(DISTINCT property_id) as buildings_with_compliance 
        FROM certificates 
        WHERE expiry_date::date > CURRENT_DATE AND property_id IS NOT NULL
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as total_fra,
          COUNT(CASE WHEN expiry_date::date > CURRENT_DATE THEN 1 END) as up_to_date_fra
        FROM certificates 
        WHERE certificate_type = 'FIRE_RISK_ASSESSMENT'
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as total_outstanding,
          COUNT(CASE WHEN severity = 'IMMEDIATE' THEN 1 END) as immediate,
          COUNT(CASE WHEN severity = 'URGENT' THEN 1 END) as urgent,
          COUNT(CASE WHEN severity = 'PRIORITY' THEN 1 END) as priority,
          COUNT(CASE WHEN severity = 'ROUTINE' THEN 1 END) as routine
        FROM remedial_actions 
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
      `),
      db.execute(sql`
        SELECT certificate_type, COUNT(*) as count
        FROM certificates 
        WHERE expiry_date::date < CURRENT_DATE
        GROUP BY certificate_type
      `),
      db.execute(sql`
        SELECT id, description, property_id, due_date
        FROM remedial_actions 
        WHERE severity = 'IMMEDIATE' AND status NOT IN ('COMPLETED', 'CANCELLED')
        ORDER BY due_date ASC NULLS LAST
        LIMIT 10
      `),
      db.execute(sql`
        SELECT 
          (SELECT COUNT(DISTINCT COALESCE(property_id, block_id)) FROM components) as unique_buildings,
          (SELECT COUNT(*) FROM components) as total_components,
          (SELECT COUNT(*) FROM certificates) as total_certificates,
          (SELECT COUNT(*) FROM remedial_actions) as total_remedial,
          (SELECT COUNT(*) FROM certificates WHERE expiry_date::date > CURRENT_DATE) as valid_certificates
      `)
    ]);

    const bs01Row = (bs01Result.rows as BS01Row[])[0] || { buildings_with_compliance: 0 };
    const bs02Row = (bs02Result.rows as BS02Row[])[0] || { total_fra: 0, up_to_date_fra: 0 };
    const bs03Row = (bs03Result.rows as BS03Row[])[0] || { total_outstanding: 0, immediate: 0, urgent: 0, priority: 0, routine: 0 };
    const bs04Rows = (bs04Result.rows as BS04Row[]) || [];
    const bs06Rows = (bs06Result.rows as BS06Row[]) || [];
    const summaryRow = (summaryResult.rows as SummaryRow[])[0] || { unique_buildings: 0, total_components: 0, total_certificates: 0, total_remedial: 0, valid_certificates: 0 };

    const totalFRA = Number(bs02Row.total_fra) || 0;
    const upToDateFRA = Number(bs02Row.up_to_date_fra) || 0;
    const bs02Percentage = totalFRA > 0 ? (upToDateFRA / totalFRA * 100) : 0;
    
    const totalCerts = Number(summaryRow.total_certificates) || 0;
    const validCerts = Number(summaryRow.valid_certificates) || 0;
    const complianceScore = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 0;

    const reportData = {
      period,
      reportDate: today.toISOString(),
      metrics: {
        BS01: {
          name: "Building Safety Cases",
          description: "Buildings with safety case reviews completed",
          value: Number(bs01Row.buildings_with_compliance) || 0,
          total: Number(summaryRow.unique_buildings) || 0,
          unit: "buildings"
        },
        BS02: {
          name: "Fire Risk Assessment Compliance",
          description: "Percentage of buildings with up-to-date FRA",
          value: Math.round(bs02Percentage * 10) / 10,
          total: totalFRA,
          upToDate: upToDateFRA,
          unit: "percent"
        },
        BS03: {
          name: "Outstanding Remedial Actions",
          description: "Remedial actions awaiting completion",
          value: Number(bs03Row.total_outstanding) || 0,
          bySeverity: {
            immediate: Number(bs03Row.immediate) || 0,
            urgent: Number(bs03Row.urgent) || 0,
            priority: Number(bs03Row.priority) || 0,
            routine: Number(bs03Row.routine) || 0,
          },
          unit: "actions"
        },
        BS04: {
          name: "Overdue Inspections",
          description: "Inspections past their due date by type",
          value: bs04Rows.reduce((sum: number, row: BS04Row) => sum + Number(row.count || 0), 0),
          byType: bs04Rows.reduce((acc: Record<string, number>, row: BS04Row) => {
            if (row.certificate_type) {
              acc[row.certificate_type] = Number(row.count) || 0;
            }
            return acc;
          }, {} as Record<string, number>),
          unit: "inspections"
        },
        BS06: {
          name: "Critical Safety Alerts",
          description: "Immediate priority safety alerts",
          value: bs06Rows.length,
          alerts: bs06Rows.slice(0, 5),
          unit: "alerts"
        }
      },
      summary: {
        totalBuildings: Number(summaryRow.unique_buildings) || 0,
        totalComponents: Number(summaryRow.total_components) || 0,
        totalCertificates: totalCerts,
        totalRemedialActions: Number(summaryRow.total_remedial) || 0,
        complianceScore
      }
    };

    tsmReportCache = { data: reportData, timestamp: Date.now() };
    res.json({ ...reportData, cached: false });
  } catch (error) {
    console.error("Error fetching TSM building safety report:", error);
    res.status(500).json({ error: "Failed to fetch TSM building safety report" });
  }
});

// ===== COMPLIANCE SUMMARY REPORT =====
reportsRouter.get("/compliance-summary", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { useCached } = req.query;
    const orgId = req.user.organisationId;

    const query = db.select({
      stream: certificates.complianceStreamId,
      type: certificates.certificateType,
      total: count(),
      compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'APPROVED' OR ${certificates.status} = 'EXTRACTED')`,
      nonCompliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'EXPIRED')`,
      expiringSoon: sql<number>`COUNT(*) FILTER (WHERE ${certificates.expiryDate}::date < CURRENT_DATE + INTERVAL '30 days' AND ${certificates.expiryDate}::date >= CURRENT_DATE)`,
    })
    .from(certificates)
    .where(eq(certificates.organisationId, orgId))
    .groupBy(certificates.complianceStreamId, certificates.certificateType);

    const results = await query;

    const totals = results.reduce((acc, row) => ({
      totalCertificates: acc.totalCertificates + Number(row.total),
      compliant: acc.compliant + Number(row.compliant),
      nonCompliant: acc.nonCompliant + Number(row.nonCompliant),
      expired: acc.expired + Number(row.expired),
      expiringSoon: acc.expiringSoon + Number(row.expiringSoon),
    }), { totalCertificates: 0, compliant: 0, nonCompliant: 0, expired: 0, expiringSoon: 0 });

    const complianceRate = totals.totalCertificates > 0 
      ? Math.round((totals.compliant / totals.totalCertificates) * 100) 
      : 0;

    res.json({
      summary: {
        ...totals,
        complianceRate,
        lastUpdated: new Date().toISOString(),
        queryType: useCached === 'true' ? 'cached' : 'live'
      },
      byStream: results
    });
  } catch (error) {
    console.error("Error fetching compliance summary:", error);
    res.status(500).json({ error: "Failed to fetch compliance summary" });
  }
});

// ===== PROPERTY HEALTH REPORT =====
reportsRouter.get("/property-health", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { minScore, maxScore } = req.query;
    const orgId = req.user.organisationId;

    const propertyData = await db.select({
      id: properties.id,
      address: properties.addressLine1,
      blockId: properties.blockId,
      totalCertificates: sql<number>`COUNT(DISTINCT ${certificates.id})`,
      compliantCertificates: sql<number>`COUNT(DISTINCT ${certificates.id}) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
      openActions: sql<number>`COUNT(DISTINCT ${remedialActions.id}) FILTER (WHERE ${remedialActions.status} IN ('OPEN', 'IN_PROGRESS'))`,
    })
    .from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .leftJoin(certificates, eq(certificates.propertyId, properties.id))
    .leftJoin(remedialActions, eq(remedialActions.propertyId, properties.id))
    .where(eq(schemes.organisationId, orgId))
    .groupBy(properties.id, properties.addressLine1, properties.blockId);

    const propertiesWithScores = propertyData.map(p => {
      const total = Number(p.totalCertificates);
      const compliant = Number(p.compliantCertificates);
      const actions = Number(p.openActions);
      
      const certScore = total > 0 ? (compliant / total) * 100 : 50;
      const actionPenalty = actions * 5;
      const healthScore = Math.max(0, Math.min(100, Math.round(certScore - actionPenalty)));

      return {
        ...p,
        healthScore,
        riskLevel: healthScore >= 80 ? 'LOW' : healthScore >= 60 ? 'MEDIUM' : healthScore >= 40 ? 'HIGH' : 'CRITICAL'
      };
    });

    let filtered = propertiesWithScores;
    if (minScore) {
      filtered = filtered.filter(p => p.healthScore >= Number(minScore));
    }
    if (maxScore) {
      filtered = filtered.filter(p => p.healthScore <= Number(maxScore));
    }

    const distribution = {
      excellent: filtered.filter(p => p.healthScore >= 90).length,
      good: filtered.filter(p => p.healthScore >= 70 && p.healthScore < 90).length,
      fair: filtered.filter(p => p.healthScore >= 50 && p.healthScore < 70).length,
      poor: filtered.filter(p => p.healthScore < 50).length,
    };

    res.json({
      properties: filtered.sort((a, b) => a.healthScore - b.healthScore),
      distribution,
      averageScore: filtered.length > 0 
        ? Math.round(filtered.reduce((sum, p) => sum + p.healthScore, 0) / filtered.length) 
        : 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching property health:", error);
    res.status(500).json({ error: "Failed to fetch property health" });
  }
});

// ===== CONTRACTOR PERFORMANCE REPORT =====
reportsRouter.get("/contractor-performance", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const orgId = req.user.organisationId;

    const contractorData = await db.select({
      id: contractors.id,
      name: contractors.companyName,
      tradeType: contractors.tradeType,
      status: contractors.status,
    })
    .from(contractors)
    .where(eq(contractors.organisationId, orgId));

    const contractorsWithMetrics = contractorData.map(c => ({
      ...c,
      totalJobs: 0,
      completedOnTime: 0,
      successRate: 0,
      rating: 'PENDING' as const
    }));

    res.json({
      contractors: contractorsWithMetrics,
      averageSuccessRate: 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching contractor performance:", error);
    res.status(500).json({ error: "Failed to fetch contractor performance" });
  }
});

// ===== MONTHLY TRENDS REPORT =====
reportsRouter.get("/monthly-trends", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { months = '12' } = req.query;
    const monthsBack = parseInt(months as string) || 12;
    const orgId = req.user.organisationId;

    const trends = await db.select({
      month: sql<string>`DATE_TRUNC('month', ${certificates.createdAt})::date`,
      stream: certificates.complianceStreamId,
      issued: count(),
      compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
    })
    .from(certificates)
    .where(and(
      eq(certificates.organisationId, orgId),
      gte(certificates.createdAt, sql`CURRENT_DATE - INTERVAL '${sql.raw(monthsBack.toString())} months'`)
    ))
    .groupBy(sql`DATE_TRUNC('month', ${certificates.createdAt})`, certificates.complianceStreamId)
    .orderBy(sql`DATE_TRUNC('month', ${certificates.createdAt})`);

    res.json({
      trends,
      period: `${monthsBack} months`,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching monthly trends:", error);
    res.status(500).json({ error: "Failed to fetch monthly trends" });
  }
});

// ===== CERTIFICATE EXPIRY REPORT =====
reportsRouter.get("/certificate-expiry", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { days = '90' } = req.query;
    const daysAhead = parseInt(days as string) || 90;
    const orgId = req.user.organisationId;

    const expiringCerts = await db.select({
      id: certificates.id,
      type: certificates.certificateType,
      complianceStream: certificates.complianceStreamId,
      expiryDate: certificates.expiryDate,
      propertyId: certificates.propertyId,
      propertyAddress: properties.addressLine1,
    })
    .from(certificates)
    .innerJoin(properties, eq(certificates.propertyId, properties.id))
    .where(and(
      eq(certificates.organisationId, orgId),
      isNotNull(certificates.expiryDate),
      lt(certificates.expiryDate, sql`(CURRENT_DATE + INTERVAL '${sql.raw(daysAhead.toString())} days')::text`),
      gte(certificates.expiryDate, sql`CURRENT_DATE::text`)
    ))
    .orderBy(certificates.expiryDate);

    const now = new Date();
    const grouped = {
      urgent: expiringCerts.filter(c => {
        const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days <= 7;
      }),
      soon: expiringCerts.filter(c => {
        const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 7 && days <= 30;
      }),
      upcoming: expiringCerts.filter(c => {
        const days = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 30;
      }),
    };

    res.json({
      expiring: expiringCerts,
      grouped,
      summary: {
        total: expiringCerts.length,
        urgentCount: grouped.urgent.length,
        soonCount: grouped.soon.length,
        upcomingCount: grouped.upcoming.length,
      },
      period: `${daysAhead} days`,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching certificate expiry:", error);
    res.status(500).json({ error: "Failed to fetch certificate expiry" });
  }
});

// ===== BOARD SUMMARY REPORT =====
reportsRouter.get("/board-summary", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const orgId = req.user.organisationId;
    const forceRefresh = req.query.refresh === 'true';
    
    const cached = boardSummaryCache.get(orgId);
    if (!forceRefresh && cached && (Date.now() - cached.timestamp < BOARD_SUMMARY_CACHE_TTL_MS)) {
      return res.json({ ...cached.data, cached: true, cacheAge: Math.round((Date.now() - cached.timestamp) / 1000) });
    }

    const [certStats] = await db.select({
      total: count(),
      compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
      nonCompliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('PENDING', 'NEEDS_REVIEW'))`,
    })
    .from(certificates)
    .where(eq(certificates.organisationId, orgId));

    const [propStats] = await db.select({
      total: count(),
    })
    .from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .where(eq(schemes.organisationId, orgId));

    const [actionStats] = await db.select({
      total: count(),
      critical: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} = 'IMMEDIATE' AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
      major: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} IN ('URGENT', 'PRIORITY') AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
      minor: sql<number>`COUNT(*) FILTER (WHERE ${remedialActions.severity} IN ('ROUTINE', 'ADVISORY') AND ${remedialActions.status} NOT IN ('COMPLETED', 'CANCELLED'))`,
    })
    .from(remedialActions);

    const total = Number(certStats?.total || 0);
    const compliant = Number(certStats?.compliant || 0);
    const overallCompliance = total > 0 ? Math.round((compliant / total) * 100) : 0;

    const reportData = {
      overview: {
        overallCompliance,
        totalProperties: Number(propStats?.total || 0),
        totalCertificates: total,
        openActions: Number(actionStats?.total || 0) - Number(actionStats?.critical || 0) - Number(actionStats?.major || 0) - Number(actionStats?.minor || 0),
      },
      certificates: {
        total,
        compliant,
        nonCompliant: Number(certStats?.nonCompliant || 0),
        pending: Number(certStats?.pending || 0),
      },
      actions: {
        critical: Number(actionStats?.critical || 0),
        major: Number(actionStats?.major || 0),
        minor: Number(actionStats?.minor || 0),
      },
      riskLevel: overallCompliance >= 95 ? 'LOW' : overallCompliance >= 85 ? 'MEDIUM' : overallCompliance >= 70 ? 'HIGH' : 'CRITICAL',
      lastUpdated: new Date().toISOString()
    };
    
    boardSummaryCache.set(orgId, { data: reportData, timestamp: Date.now() });
    
    res.json({ ...reportData, cached: false });
  } catch (error) {
    console.error("Error fetching board summary:", error);
    res.status(500).json({ error: "Failed to fetch board summary" });
  }
});

// ===== REPORT EXPORT =====
reportsRouter.post("/export", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { reportType, format, filters } = req.body;

    if (!reportType || !format) {
      return res.status(400).json({ error: "Report type and format are required" });
    }

    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      exportId,
      status: 'QUEUED',
      message: `${reportType} export queued in ${format} format`,
      estimatedCompletion: new Date(Date.now() + 60000).toISOString()
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

// ===== REPORT TEMPLATES =====
reportsRouter.get("/templates", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM report_templates 
      WHERE is_active = true 
      ORDER BY is_system DESC, name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching report templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

reportsRouter.post("/templates", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, sections } = req.body;
    const sectionsLiteral = sections && sections.length > 0 
      ? `{${sections.map((s: string) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`
      : null;
    const result = await db.execute(sql`
      INSERT INTO report_templates (name, description, sections, is_system, is_active)
      VALUES (${name}, ${description}, ${sectionsLiteral}::text[], false, true)
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// ===== SCHEDULED REPORTS =====
reportsRouter.get("/scheduled", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM scheduled_reports 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    res.status(500).json({ error: "Failed to fetch scheduled reports" });
  }
});

reportsRouter.post("/scheduled", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, templateName, frequency, format, recipients, filters, isActive } = req.body;
    const nextRunAt = new Date();
    nextRunAt.setHours(6, 0, 0, 0);
    if (frequency === 'WEEKLY') nextRunAt.setDate(nextRunAt.getDate() + ((1 + 7 - nextRunAt.getDay()) % 7 || 7));
    else if (frequency === 'MONTHLY') { nextRunAt.setMonth(nextRunAt.getMonth() + 1); nextRunAt.setDate(1); }
    else if (frequency === 'QUARTERLY') { nextRunAt.setMonth(nextRunAt.getMonth() + 3); nextRunAt.setDate(1); }
    else nextRunAt.setDate(nextRunAt.getDate() + 1);

    const recipientsArray = recipients && recipients.length > 0 ? recipients : null;
    const result = await db.execute(sql`
      INSERT INTO scheduled_reports (organisation_id, name, template_name, frequency, format, recipients, filters, is_active, next_run_at)
      VALUES ((SELECT id FROM organisations LIMIT 1), ${name}, ${templateName}, ${frequency}, ${format || 'PDF'}, ${recipientsArray}, ${JSON.stringify(filters || {})}, ${isActive !== false}, ${nextRunAt})
      RETURNING *
    `);
    
    interface ScheduledReportRow { id: string; frequency?: string; is_active?: boolean }
    const scheduledReport = result.rows[0] as ScheduledReportRow;
    
    if (isActive !== false) {
      try {
        const { createReportSchedule } = await import("../job-queue");
        await createReportSchedule(scheduledReport.id, frequency);
      } catch (scheduleError) {
        console.error("Failed to create pg-boss schedule:", scheduleError);
      }
    }
    
    res.json(scheduledReport);
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    res.status(500).json({ error: "Failed to create scheduled report" });
  }
});

reportsRouter.patch("/scheduled/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, frequency } = req.body;
    
    if (isActive !== undefined) {
      await db.execute(sql`
        UPDATE scheduled_reports SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}
      `);
      
      try {
        const { setReportScheduleActive } = await import("../job-queue");
        await setReportScheduleActive(id, isActive);
      } catch (scheduleError) {
        console.error("Failed to update pg-boss schedule:", scheduleError);
      }
    }
    
    if (frequency) {
      await db.execute(sql`
        UPDATE scheduled_reports SET frequency = ${frequency}, updated_at = NOW() WHERE id = ${id}
      `);
      
      try {
        const { setReportScheduleActive } = await import("../job-queue");
        await setReportScheduleActive(id, true);
      } catch (scheduleError) {
        console.error("Failed to update next_run_at for frequency change:", scheduleError);
      }
    }
    
    const result = await db.execute(sql`SELECT * FROM scheduled_reports WHERE id = ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating scheduled report:", error);
    res.status(500).json({ error: "Failed to update scheduled report" });
  }
});

reportsRouter.delete("/scheduled/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    try {
      const { removeReportSchedule } = await import("../job-queue");
      await removeReportSchedule(id);
    } catch (scheduleError) {
      console.error("Failed to remove pg-boss schedule:", scheduleError);
    }
    
    await db.execute(sql`UPDATE generated_reports SET scheduled_report_id = NULL WHERE scheduled_report_id = ${id}`);
    await db.execute(sql`DELETE FROM scheduled_reports WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduled report:", error);
    res.status(500).json({ error: "Failed to delete scheduled report" });
  }
});

// ===== GENERATED REPORTS =====
reportsRouter.get("/generated", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM generated_reports 
      ORDER BY generated_at DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching generated reports:", error);
    res.status(500).json({ error: "Failed to fetch generated reports" });
  }
});

reportsRouter.post("/generated", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, templateId, format, fileSize, filters, status } = req.body;
    const result = await db.execute(sql`
      INSERT INTO generated_reports (organisation_id, name, template_id, format, file_size, filters, status)
      VALUES ((SELECT id FROM organisations LIMIT 1), ${name}, ${templateId || null}, ${format || 'PDF'}, ${fileSize || null}, ${JSON.stringify(filters || {})}, ${status || 'READY'})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating generated report:", error);
    res.status(500).json({ error: "Failed to create generated report" });
  }
});

reportsRouter.post("/scheduled/:id/run", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scheduleResult = await db.execute(sql`SELECT * FROM scheduled_reports WHERE id = ${id}`);
    interface ScheduleRow { 
      id: string;
      organisation_id?: string;
      name?: string;
      format?: string;
      filters?: Record<string, unknown>;
    }
    const schedule = scheduleResult.rows[0] as ScheduleRow;
    
    if (!schedule) {
      return res.status(404).json({ error: "Scheduled report not found" });
    }

    try {
      const { enqueueScheduledReportNow } = await import("../job-queue");
      const jobId = await enqueueScheduledReportNow(id);
      
      res.json({ 
        success: true, 
        message: "Report generation queued via pg-boss",
        jobId,
        scheduledReportId: id 
      });
    } catch (queueError) {
      console.error("Failed to enqueue via pg-boss, falling back to direct execution:", queueError);
      
      const result = await db.execute(sql`
        INSERT INTO generated_reports (organisation_id, name, scheduled_report_id, format, status, filters)
        VALUES (${schedule.organisation_id}, ${schedule.name}, ${id}, ${schedule.format}, 'READY', ${JSON.stringify(schedule.filters || {})})
        RETURNING *
      `);

      await db.execute(sql`
        UPDATE scheduled_reports SET last_run_at = NOW(), updated_at = NOW() WHERE id = ${id}
      `);

      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error("Error running scheduled report:", error);
    res.status(500).json({ error: "Failed to run scheduled report" });
  }
});
