import { Router } from "express";
import { db } from "../../db";
import { eq, desc, and, count, sql, isNotNull, lt, gte } from "drizzle-orm";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../../session";
import { storage } from "../../storage";
import { 
  certificates, properties, blocks, schemes, remedialActions, contractors,
  propertyRiskSnapshots, riskFactorDefinitions, riskAlerts
} from "@shared/schema";
import { auth } from "../../auth";
import { fromNodeHeaders } from "better-auth/node";

export const systemComplianceRouter = Router();

systemComplianceRouter.get("/audit-events", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'COMPLIANCE_MANAGER'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }
    
    const { entityType, entityId, eventType, actorId, startDate, endDate, limit, offset } = req.query;
    
    const result = await storage.listAuditEvents(user.organisationId, {
      entityType: entityType as string,
      entityId: entityId as string,
      eventType: eventType as string,
      actorId: actorId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching audit events:", error);
    res.status(500).json({ error: "Failed to fetch audit events" });
  }
});

systemComplianceRouter.get("/audit-events/:entityType/:entityId", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { entityType, entityId } = req.params;
    
    if (entityType.toUpperCase() === 'CERTIFICATE') {
      const cert = await storage.getCertificate(entityId);
      if (!cert || cert.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this entity" });
      }
    } else if (entityType.toUpperCase() === 'REMEDIAL_ACTION') {
      const action = await storage.getRemedialAction(entityId);
      if (!action || action.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this entity" });
      }
    } else if (entityType.toUpperCase() === 'PROPERTY') {
      const property = await storage.getProperty(entityId);
      if (!property || property.organisationId !== user.organisationId) {
        return res.status(403).json({ error: "Access denied to this entity" });
      }
    }
    
    const events = await storage.getEntityAuditHistoryForOrg(
      entityType.toUpperCase(), 
      entityId, 
      user.organisationId
    );
    
    res.json(events);
  } catch (error) {
    console.error("Error fetching entity audit history:", error);
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
});

systemComplianceRouter.get("/certificates/:id/audit", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const cert = await storage.getCertificate(req.params.id);
    if (!cert || cert.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied to this certificate" });
    }
    
    const events = await storage.getEntityAuditHistoryForOrg(
      'CERTIFICATE', 
      req.params.id,
      user.organisationId
    );
    res.json(events);
  } catch (error) {
    console.error("Error fetching certificate audit:", error);
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
});

let portfolioSummaryCache: { data: any; timestamp: number; orgId: string } | null = null;
const PORTFOLIO_CACHE_TTL = 60000;

systemComplianceRouter.get("/risk/portfolio-summary", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const now = Date.now();
    if (portfolioSummaryCache && 
        portfolioSummaryCache.orgId === user.organisationId &&
        (now - portfolioSummaryCache.timestamp) < PORTFOLIO_CACHE_TTL) {
      return res.json(portfolioSummaryCache.data);
    }

    const riskScoringModule = await import('../../services/risk-scoring');
    const summary = await riskScoringModule.getPortfolioRiskSummary(user.organisationId);
    
    portfolioSummaryCache = {
      data: summary,
      timestamp: now,
      orgId: user.organisationId
    };

    res.json(summary);
  } catch (error) {
    console.error("Error fetching portfolio risk summary:", error);
    res.status(500).json({ error: "Failed to fetch risk summary" });
  }
});

systemComplianceRouter.get("/risk/properties", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const tier = req.query.tier as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const snapshots = await db.select({
      id: propertyRiskSnapshots.id,
      propertyId: propertyRiskSnapshots.propertyId,
      overallScore: propertyRiskSnapshots.overallScore,
      riskTier: propertyRiskSnapshots.riskTier,
      expiryRiskScore: propertyRiskSnapshots.expiryRiskScore,
      defectRiskScore: propertyRiskSnapshots.defectRiskScore,
      assetProfileRiskScore: propertyRiskSnapshots.assetProfileRiskScore,
      coverageGapRiskScore: propertyRiskSnapshots.coverageGapRiskScore,
      externalFactorRiskScore: propertyRiskSnapshots.externalFactorRiskScore,
      factorBreakdown: propertyRiskSnapshots.factorBreakdown,
      triggeringFactors: propertyRiskSnapshots.triggeringFactors,
      recommendedActions: propertyRiskSnapshots.recommendedActions,
      scoreChange: propertyRiskSnapshots.scoreChange,
      trendDirection: propertyRiskSnapshots.trendDirection,
      calculatedAt: propertyRiskSnapshots.calculatedAt,
      propertyAddressLine1: properties.addressLine1,
      propertyCity: properties.city,
      propertyPostcode: properties.postcode,
      propertyUprn: properties.uprn,
    })
    .from(propertyRiskSnapshots)
    .innerJoin(properties, eq(propertyRiskSnapshots.propertyId, properties.id))
    .where(and(
      eq(propertyRiskSnapshots.organisationId, user.organisationId),
      eq(propertyRiskSnapshots.isLatest, true),
      tier ? eq(propertyRiskSnapshots.riskTier, tier as any) : undefined
    ))
    .orderBy(desc(propertyRiskSnapshots.overallScore))
    .limit(limit)
    .offset(offset);

    res.json(snapshots);
  } catch (error) {
    console.error("Error fetching property risks:", error);
    res.status(500).json({ error: "Failed to fetch property risks" });
  }
});

systemComplianceRouter.get("/risk/properties/:propertyId", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { propertyId } = req.params;

    const [propertyWithOrg] = await db.select({
      property: properties,
      organisationId: schemes.organisationId,
    })
    .from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .where(eq(properties.id, propertyId))
    .limit(1);

    if (!propertyWithOrg) {
      return res.status(404).json({ error: "Property not found" });
    }
    
    if (propertyWithOrg.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    const latestSnapshot = await db.select()
      .from(propertyRiskSnapshots)
      .where(and(
        eq(propertyRiskSnapshots.propertyId, propertyId),
        eq(propertyRiskSnapshots.organisationId, user.organisationId),
        eq(propertyRiskSnapshots.isLatest, true)
      ))
      .limit(1);

    const history = await db.select({
      id: propertyRiskSnapshots.id,
      overallScore: propertyRiskSnapshots.overallScore,
      riskTier: propertyRiskSnapshots.riskTier,
      scoreChange: propertyRiskSnapshots.scoreChange,
      calculatedAt: propertyRiskSnapshots.calculatedAt,
    })
    .from(propertyRiskSnapshots)
    .where(and(
      eq(propertyRiskSnapshots.propertyId, propertyId),
      eq(propertyRiskSnapshots.organisationId, user.organisationId)
    ))
    .orderBy(desc(propertyRiskSnapshots.calculatedAt))
    .limit(30);

    res.json({
      property: propertyWithOrg.property,
      currentRisk: latestSnapshot[0] || null,
      history,
    });
  } catch (error) {
    console.error("Error fetching property risk details:", error);
    res.status(500).json({ error: "Failed to fetch property risk details" });
  }
});

systemComplianceRouter.post("/risk/properties/:propertyId/calculate", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { propertyId } = req.params;

    const [propertyWithOrg] = await db.select({
      propertyId: properties.id,
      organisationId: schemes.organisationId,
    })
    .from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .where(eq(properties.id, propertyId))
    .limit(1);

    if (!propertyWithOrg) {
      return res.status(404).json({ error: "Property not found" });
    }
    
    if (propertyWithOrg.organisationId !== user.organisationId) {
      return res.status(403).json({ error: "Access denied to this property" });
    }

    const riskScoringModule = await import('../../services/risk-scoring');
    const riskData = await riskScoringModule.calculatePropertyRiskScore(propertyId, user.organisationId);
    const snapshotId = await riskScoringModule.saveRiskSnapshot(riskData);
    const alertId = await riskScoringModule.createRiskAlert(riskData, snapshotId);

    res.json({
      ...riskData,
      snapshotId,
      alertId,
    });
  } catch (error) {
    console.error("Error calculating property risk:", error);
    res.status(500).json({ error: "Failed to calculate property risk" });
  }
});

systemComplianceRouter.post("/risk/calculate-all", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const riskScoringModule = await import('../../services/risk-scoring');
    const stats = await riskScoringModule.calculateAllPropertyRisks(user.organisationId);
    res.json(stats);
  } catch (error) {
    console.error("Error calculating all property risks:", error);
    res.status(500).json({ error: "Failed to calculate risks" });
  }
});

systemComplianceRouter.get("/risk/alerts", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(session.user.id);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const status = req.query.status as string | undefined;
    const tier = req.query.tier as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const alerts = await db.select({
      id: riskAlerts.id,
      propertyId: riskAlerts.propertyId,
      alertType: riskAlerts.alertType,
      riskTier: riskAlerts.riskTier,
      status: riskAlerts.status,
      title: riskAlerts.title,
      description: riskAlerts.description,
      triggeringFactors: riskAlerts.triggeringFactors,
      riskScore: riskAlerts.riskScore,
      dueDate: riskAlerts.dueDate,
      slaHours: riskAlerts.slaHours,
      escalationLevel: riskAlerts.escalationLevel,
      createdAt: riskAlerts.createdAt,
      propertyAddressLine1: properties.addressLine1,
      propertyCity: properties.city,
      propertyPostcode: properties.postcode,
    })
    .from(riskAlerts)
    .innerJoin(properties, eq(riskAlerts.propertyId, properties.id))
    .where(and(
      eq(riskAlerts.organisationId, user.organisationId),
      status ? eq(riskAlerts.status, status as any) : undefined,
      tier ? eq(riskAlerts.riskTier, tier as any) : undefined
    ))
    .orderBy(desc(riskAlerts.createdAt))
    .limit(limit);

    res.json(alerts);
  } catch (error) {
    console.error("Error fetching risk alerts:", error);
    res.status(500).json({ error: "Failed to fetch risk alerts" });
  }
});

systemComplianceRouter.patch("/risk/alerts/:alertId", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { alertId } = req.params;
    const { status, resolutionNotes } = req.body;

    const updates: any = { updatedAt: new Date() };

    if (status === 'ACKNOWLEDGED') {
      updates.status = 'ACKNOWLEDGED';
      updates.acknowledgedById = userId;
      updates.acknowledgedAt = new Date();
    } else if (status === 'RESOLVED') {
      updates.status = 'RESOLVED';
      updates.resolvedById = userId;
      updates.resolvedAt = new Date();
      updates.resolutionNotes = resolutionNotes;
    } else if (status === 'DISMISSED') {
      updates.status = 'DISMISSED';
      updates.resolvedById = userId;
      updates.resolvedAt = new Date();
      updates.resolutionNotes = resolutionNotes || 'Dismissed by user';
    } else if (status === 'ESCALATED') {
      updates.status = 'ESCALATED';
      updates.escalationLevel = sql`${riskAlerts.escalationLevel} + 1`;
    }

    const [updated] = await db.update(riskAlerts)
      .set(updates)
      .where(and(
        eq(riskAlerts.id, alertId),
        eq(riskAlerts.organisationId, user.organisationId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating risk alert:", error);
    res.status(500).json({ error: "Failed to update alert" });
  }
});

systemComplianceRouter.get("/risk/factor-definitions", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const definitions = await db.select()
      .from(riskFactorDefinitions)
      .where(eq(riskFactorDefinitions.isActive, true))
      .orderBy(desc(riskFactorDefinitions.priority));

    res.json(definitions);
  } catch (error) {
    console.error("Error fetching risk factor definitions:", error);
    res.status(500).json({ error: "Failed to fetch factor definitions" });
  }
});

systemComplianceRouter.get("/reports/compliance-summary", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { useCached } = req.query;

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
    .where(eq(certificates.organisationId, user.organisationId))
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

systemComplianceRouter.get("/reports/property-health", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { minScore, maxScore } = req.query;

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
    .where(eq(schemes.organisationId, user.organisationId))
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

systemComplianceRouter.get("/reports/contractor-performance", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const contractorData = await db.select({
      id: contractors.id,
      name: contractors.companyName,
      tradeType: contractors.tradeType,
      status: contractors.status,
    })
    .from(contractors)
    .where(eq(contractors.organisationId, user.organisationId));

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

systemComplianceRouter.get("/reports/monthly-trends", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { months = '12' } = req.query;
    const monthsBack = parseInt(months as string) || 12;

    const trends = await db.select({
      month: sql<string>`DATE_TRUNC('month', ${certificates.createdAt})::date`,
      stream: certificates.complianceStreamId,
      issued: count(),
      compliant: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} IN ('APPROVED', 'EXTRACTED'))`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${certificates.status} = 'FAILED')`,
    })
    .from(certificates)
    .where(and(
      eq(certificates.organisationId, user.organisationId),
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

systemComplianceRouter.get("/reports/certificate-expiry", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { days = '90' } = req.query;
    const daysAhead = parseInt(days as string) || 90;

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
      eq(certificates.organisationId, user.organisationId),
      isNotNull(certificates.expiryDate),
      lt(certificates.expiryDate, sql`(CURRENT_DATE + INTERVAL '${sql.raw(daysAhead.toString())} days')::text`),
      gte(certificates.expiryDate, sql`CURRENT_DATE::text`)
    ))
    .orderBy(certificates.expiryDate);

    const now = new Date();
    const grouped = {
      urgent: expiringCerts.filter(c => {
        const daysLeft = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 7;
      }),
      soon: expiringCerts.filter(c => {
        const daysLeft = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft > 7 && daysLeft <= 30;
      }),
      upcoming: expiringCerts.filter(c => {
        const daysLeft = Math.ceil((new Date(c.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft > 30;
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

const boardSummaryCache = new Map<string, { data: any; timestamp: number }>();
const BOARD_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

systemComplianceRouter.get("/reports/board-summary", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }
    
    const orgId = user.organisationId;
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
    .where(eq(certificates.organisationId, user.organisationId));

    const [propStats] = await db.select({
      total: count(),
    })
    .from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .where(eq(schemes.organisationId, user.organisationId));

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

systemComplianceRouter.post("/reports/export", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
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

systemComplianceRouter.post("/evidence-packs", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user?.organisationId) {
      return res.status(403).json({ error: "No organisation access" });
    }

    const { 
      packType,
      schemeIds,
      complianceStreams,
      dateFrom,
      dateTo,
      includeRemedialActions = true,
      includeContractorDetails = true,
      includePropertyDetails = true,
      format = 'JSON'
    } = req.body;

    if (!packType) {
      return res.status(400).json({ error: "Pack type is required" });
    }

    const evidenceData: any = {
      packId: `EP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      packType,
      generatedAt: new Date().toISOString(),
      generatedBy: user.displayName || user.email,
      organisation: user.organisationId,
    };

    const certsResult = await db.select({
      id: certificates.id,
      certificateType: certificates.certificateType,
      complianceStreamId: certificates.complianceStreamId,
      status: certificates.status,
      issueDate: certificates.issueDate,
      expiryDate: certificates.expiryDate,
      propertyId: certificates.propertyId,
      fileName: certificates.fileName,
      extractedData: certificates.extractedData,
    })
    .from(certificates)
    .where(eq(certificates.organisationId, user.organisationId));

    evidenceData.certificates = {
      total: certsResult.length,
      byStatus: {
        compliant: certsResult.filter(c => c.status === 'APPROVED' || c.status === 'EXTRACTED').length,
        pending: certsResult.filter(c => c.status === 'PENDING' || c.status === 'NEEDS_REVIEW').length,
        failed: certsResult.filter(c => c.status === 'FAILED').length,
      },
      items: certsResult.slice(0, 100),
    };

    if (includeRemedialActions) {
      const actions = await db.select({
        id: remedialActions.id,
        description: remedialActions.description,
        severity: remedialActions.severity,
        status: remedialActions.status,
        targetDate: remedialActions.targetDate,
        completedDate: remedialActions.completedDate,
      })
      .from(remedialActions)
      .innerJoin(certificates, eq(remedialActions.certificateId, certificates.id))
      .where(eq(certificates.organisationId, user.organisationId))
      .limit(100);

      evidenceData.remedialActions = {
        total: actions.length,
        bySeverity: {
          critical: actions.filter(a => a.severity === 'IMMEDIATE').length,
          urgent: actions.filter(a => a.severity === 'URGENT').length,
          priority: actions.filter(a => a.severity === 'PRIORITY').length,
          routine: actions.filter(a => a.severity === 'ROUTINE').length,
        },
        items: actions,
      };
    }

    if (includeContractorDetails) {
      const contractorData = await db.select({
        id: contractors.id,
        companyName: contractors.companyName,
        tradeType: contractors.tradeType,
        status: contractors.status,
        gasRegistered: contractors.gasRegistered,
        nicEicApproved: contractors.nicEicApproved,
      })
      .from(contractors)
      .where(eq(contractors.organisationId, user.organisationId))
      .limit(50);

      evidenceData.contractors = {
        total: contractorData.length,
        items: contractorData,
      };
    }

    if (includePropertyDetails) {
      const propertyData = await db.select({
        id: properties.id,
        uprn: properties.uprn,
        addressLine1: properties.addressLine1,
        postcode: properties.postcode,
        tenure: properties.tenure,
        riskScore: properties.riskScore,
      })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, user.organisationId))
      .limit(100);

      evidenceData.properties = {
        total: propertyData.length,
        items: propertyData,
      };
    }

    const complianceRate = evidenceData.certificates.total > 0
      ? Math.round((evidenceData.certificates.byStatus.compliant / evidenceData.certificates.total) * 100)
      : 0;

    evidenceData.summary = {
      complianceRate,
      riskLevel: complianceRate >= 95 ? 'LOW' : complianceRate >= 85 ? 'MEDIUM' : complianceRate >= 70 ? 'HIGH' : 'CRITICAL',
      totalCertificates: evidenceData.certificates.total,
      openRemedialActions: evidenceData.remedialActions?.items?.filter((a: any) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length || 0,
      generationDate: new Date().toISOString(),
    };

    res.json(evidenceData);
  } catch (error) {
    console.error("Error generating evidence pack:", error);
    res.status(500).json({ error: "Failed to generate evidence pack" });
  }
});

systemComplianceRouter.get("/evidence-packs/templates", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const templates = [
      {
        id: 'REGULATORY_SUBMISSION',
        name: 'Regulatory Submission Pack',
        description: 'Complete compliance evidence for regulatory submissions (RSH, HSE)',
        includes: ['certificates', 'remedialActions', 'contractors', 'properties'],
        complianceStreams: ['all'],
      },
      {
        id: 'GAS_SAFETY_AUDIT',
        name: 'Gas Safety Audit Pack',
        description: 'Gas safety certificates and contractor credentials for HSE audits',
        includes: ['certificates', 'contractors'],
        complianceStreams: ['gas'],
      },
      {
        id: 'FIRE_SAFETY_AUDIT',
        name: 'Fire Safety Audit Pack',
        description: 'Fire risk assessments and remedial actions for Fire Authority submissions',
        includes: ['certificates', 'remedialActions'],
        complianceStreams: ['fire'],
      },
      {
        id: 'ELECTRICAL_SAFETY',
        name: 'Electrical Safety Pack',
        description: 'EICR certificates and electrical safety documentation',
        includes: ['certificates', 'contractors'],
        complianceStreams: ['electrical'],
      },
      {
        id: 'BUILDING_SAFETY_ACT',
        name: 'Building Safety Act Compliance Pack',
        description: 'Higher-Risk Building compliance documentation for BSR submissions',
        includes: ['certificates', 'remedialActions', 'contractors', 'properties'],
        complianceStreams: ['all'],
      },
      {
        id: 'BOARD_QUARTERLY',
        name: 'Board Quarterly Report',
        description: 'Executive summary for board presentations',
        includes: ['summary', 'certificates', 'remedialActions'],
        complianceStreams: ['all'],
      },
    ];

    res.json(templates);
  } catch (error) {
    console.error("Error fetching evidence pack templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

systemComplianceRouter.get("/reports/templates", async (req, res) => {
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

systemComplianceRouter.post("/reports/templates", async (req, res) => {
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

systemComplianceRouter.get("/reports/scheduled", async (req, res) => {
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

systemComplianceRouter.post("/reports/scheduled", async (req, res) => {
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
    
    const scheduledReport = result.rows[0] as any;
    
    if (isActive !== false) {
      try {
        const { createReportSchedule } = await import("../../job-queue");
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

systemComplianceRouter.patch("/reports/scheduled/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, frequency } = req.body;
    
    if (isActive !== undefined) {
      await db.execute(sql`
        UPDATE scheduled_reports SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}
      `);
      
      try {
        const { setReportScheduleActive } = await import("../../job-queue");
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
        const { setReportScheduleActive } = await import("../../job-queue");
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

systemComplianceRouter.delete("/reports/scheduled/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const { removeReportSchedule } = await import("../../job-queue");
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

systemComplianceRouter.get("/reports/generated", async (req, res) => {
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

systemComplianceRouter.post("/reports/generated", async (req, res) => {
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

systemComplianceRouter.post("/reports/scheduled/:id/run", async (req, res) => {
  try {
    const { id } = req.params;
    const scheduleResult = await db.execute(sql`SELECT * FROM scheduled_reports WHERE id = ${id}`);
    const schedule = scheduleResult.rows[0] as any;
    
    if (!schedule) {
      return res.status(404).json({ error: "Scheduled report not found" });
    }

    try {
      const { enqueueScheduledReportNow } = await import("../../job-queue");
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

systemComplianceRouter.get("/hazard-cases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, severity, propertyId } = req.query;
    const cases = await storage.listHazardCases(req.organisationId!, { 
      status: status as string, 
      severity: severity as string, 
      propertyId: propertyId as string 
    });
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazard cases" });
  }
});

systemComplianceRouter.get("/hazard-cases/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const hazardCase = await storage.getHazardCase(req.params.id, req.organisationId!);
    if (!hazardCase) return res.status(404).json({ error: "Hazard case not found" });
    res.json(hazardCase);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazard case" });
  }
});

systemComplianceRouter.post("/hazard-cases", requireRole('ADMIN', 'MANAGER', 'OFFICER'), async (req: AuthenticatedRequest, res) => {
  try {
    const hazardCase = await storage.createHazardCase({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(hazardCase);
  } catch (error) {
    res.status(500).json({ error: "Failed to create hazard case" });
  }
});

systemComplianceRouter.patch("/hazard-cases/:id", requireRole('ADMIN', 'MANAGER', 'OFFICER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateHazardCase(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Hazard case not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update hazard case" });
  }
});

systemComplianceRouter.get("/hazard-cases/:id/actions", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const actions = await storage.listHazardActions(req.params.id);
    res.json(actions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazard actions" });
  }
});

systemComplianceRouter.post("/hazard-cases/:id/actions", requireRole('ADMIN', 'MANAGER', 'OFFICER'), async (req: AuthenticatedRequest, res) => {
  try {
    const action = await storage.createHazardAction({ ...req.body, hazardCaseId: req.params.id });
    res.status(201).json(action);
  } catch (error) {
    res.status(500).json({ error: "Failed to create hazard action" });
  }
});

systemComplianceRouter.get("/households", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { propertyId, isActive } = req.query;
    const households = await storage.listHouseholds(req.organisationId!, { 
      propertyId: propertyId as string, 
      isActive: isActive === 'true' 
    });
    res.json(households);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch households" });
  }
});

systemComplianceRouter.get("/households/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const household = await storage.getHousehold(req.params.id, req.organisationId!);
    if (!household) return res.status(404).json({ error: "Household not found" });
    res.json(household);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch household" });
  }
});

systemComplianceRouter.post("/households", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const household = await storage.createHousehold({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(household);
  } catch (error) {
    res.status(500).json({ error: "Failed to create household" });
  }
});

systemComplianceRouter.patch("/households/:id", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateHousehold(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Household not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update household" });
  }
});

systemComplianceRouter.get("/tenants", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { householdId } = req.query;
    const tenants = await storage.listTenants(req.organisationId!, { householdId: householdId as string });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

systemComplianceRouter.get("/tenants/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenant = await storage.getTenant(req.params.id, req.organisationId!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

systemComplianceRouter.post("/tenants", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const tenant = await storage.createTenant({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

systemComplianceRouter.patch("/tenants/:id", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateTenant(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

systemComplianceRouter.get("/service-requests", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { propertyId, status, type } = req.query;
    const requests = await storage.listServiceRequests(req.organisationId!, { 
      propertyId: propertyId as string, 
      status: status as string, 
      type: type as string 
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

systemComplianceRouter.get("/service-requests/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const request = await storage.getServiceRequest(req.params.id, req.organisationId!);
    if (!request) return res.status(404).json({ error: "Service request not found" });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch service request" });
  }
});

systemComplianceRouter.post("/service-requests", requireRole('ADMIN', 'MANAGER', 'OFFICER'), async (req: AuthenticatedRequest, res) => {
  try {
    const request = await storage.createServiceRequest({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: "Failed to create service request" });
  }
});

systemComplianceRouter.patch("/service-requests/:id", requireRole('ADMIN', 'MANAGER', 'OFFICER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateServiceRequest(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Service request not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update service request" });
  }
});

systemComplianceRouter.get("/tsm-measures", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const measures = await storage.listTsmMeasures();
    res.json(measures);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch TSM measures" });
  }
});

systemComplianceRouter.get("/tsm-snapshots", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { measureCode } = req.query;
    const snapshots = await storage.listTsmSnapshots(req.organisationId!, { measureCode: measureCode as string });
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch TSM snapshots" });
  }
});

systemComplianceRouter.post("/tsm-snapshots", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const snapshot = await storage.createTsmSnapshot({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: "Failed to create TSM snapshot" });
  }
});

systemComplianceRouter.get("/building-safety-profiles", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { isHrb } = req.query;
    const profiles = await storage.listBuildingSafetyProfiles(req.organisationId!, { 
      isHrb: isHrb === 'true' ? true : isHrb === 'false' ? false : undefined 
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch building safety profiles" });
  }
});

systemComplianceRouter.get("/building-safety-profiles/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await storage.getBuildingSafetyProfile(req.params.id, req.organisationId!);
    if (!profile) return res.status(404).json({ error: "Building safety profile not found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch building safety profile" });
  }
});

systemComplianceRouter.get("/blocks/:blockId/safety-profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await storage.getBuildingSafetyProfileByBlockId(req.params.blockId);
    if (!profile) return res.status(404).json({ error: "Building safety profile not found for this block" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch building safety profile" });
  }
});

systemComplianceRouter.post("/building-safety-profiles", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await storage.createBuildingSafetyProfile({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to create building safety profile" });
  }
});

systemComplianceRouter.patch("/building-safety-profiles/:id", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateBuildingSafetyProfile(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Building safety profile not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update building safety profile" });
  }
});

systemComplianceRouter.get("/building-safety-profiles/:id/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reviews = await storage.listSafetyCaseReviews(req.params.id);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch safety case reviews" });
  }
});

systemComplianceRouter.post("/building-safety-profiles/:id/reviews", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const review = await storage.createSafetyCaseReview({ ...req.body, buildingSafetyProfileId: req.params.id });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to create safety case review" });
  }
});

systemComplianceRouter.get("/mandatory-occurrence-reports", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reports = await storage.listMandatoryOccurrenceReports(req.organisationId!);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mandatory occurrence reports" });
  }
});

systemComplianceRouter.get("/mandatory-occurrence-reports/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const report = await storage.getMandatoryOccurrenceReport(req.params.id, req.organisationId!);
    if (!report) return res.status(404).json({ error: "Mandatory occurrence report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mandatory occurrence report" });
  }
});

systemComplianceRouter.post("/mandatory-occurrence-reports", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const report = await storage.createMandatoryOccurrenceReport({ ...req.body, organisationId: req.organisationId! });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: "Failed to create mandatory occurrence report" });
  }
});

systemComplianceRouter.patch("/mandatory-occurrence-reports/:id", requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await storage.updateMandatoryOccurrenceReport(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Mandatory occurrence report not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update mandatory occurrence report" });
  }
});
