import { Router, Response } from "express";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { 
  extractionRuns, 
  humanReviews, 
  extractionTierAudits, 
  aiSuggestions,
  mlModels,
  mlTrainingRuns,
  mlPredictions,
  extractionCorrections,
  certificates,
  properties,
} from "@shared/schema";
import { storage } from "../storage";

export const mlRouter = Router();

// Apply requireAuth middleware to all routes
mlRouter.use(requireAuth as any);

const SUPER_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN'] as const;

// Helper to get orgId with guard
function getOrgId(req: AuthenticatedRequest): string | null {
  return req.user?.organisationId || null;
}

// =====================================================
// MODEL INSIGHTS ROUTES
// =====================================================

mlRouter.get("/model-insights", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    // Join through certificates to scope by organisation
    const allRunsRaw = await db.select({ run: extractionRuns })
      .from(extractionRuns)
      .innerJoin(certificates, eq(extractionRuns.certificateId, certificates.id))
      .where(eq(certificates.organisationId, orgId))
      .orderBy(desc(extractionRuns.createdAt));
    const allRuns = allRunsRaw.map(r => r.run);
    
    const allReviews = await db.select().from(humanReviews)
      .where(eq(humanReviews.organisationId, orgId))
      .orderBy(desc(humanReviews.reviewedAt));
    
    const totalRuns = allRuns.length;
    const approvedRuns = allRuns.filter(r => r.status === 'APPROVED').length;
    const rejectedRuns = allRuns.filter(r => r.status === 'REJECTED' || r.status === 'VALIDATION_FAILED').length;
    const awaitingReviewRuns = allRuns.filter(r => r.status === 'AWAITING_REVIEW').length;
    
    const reviewedRuns = approvedRuns + rejectedRuns;
    const accuracy = reviewedRuns > 0 ? approvedRuns / reviewedRuns : 0;
    
    const avgConfidence = allRuns.length > 0 
      ? allRuns.reduce((sum, r) => sum + (r.confidence || 0), 0) / allRuns.length 
      : 0;
    
    const overallAccuracy = reviewedRuns > 0 ? accuracy : avgConfidence;
    
    const errorTags: Record<string, number> = {};
    allReviews.forEach(review => {
      (review.errorTags || []).forEach((tag: string) => {
        errorTags[tag] = (errorTags[tag] || 0) + 1;
      });
    });
    
    if (rejectedRuns > 0 && Object.keys(errorTags).length === 0) {
      errorTags['extraction_rejected'] = rejectedRuns;
    }
    
    const topTags = Object.entries(errorTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count, trend: 0 }));
    
    const byDocType = Object.entries(
      allRuns.reduce((acc, run) => {
        const docType = run.documentType || 'Unknown';
        if (!acc[docType]) acc[docType] = { total: 0, approved: 0, rejected: 0, confidenceSum: 0 };
        acc[docType].total++;
        acc[docType].confidenceSum += (run.confidence || 0);
        if (run.status === 'APPROVED') acc[docType].approved++;
        if (run.status === 'REJECTED' || run.status === 'VALIDATION_FAILED') acc[docType].rejected++;
        return acc;
      }, {} as Record<string, { total: number; approved: number; rejected: number; confidenceSum: number }>)
    ).map(([type, data]) => {
      const reviewed = data.approved + data.rejected;
      const acc = reviewed > 0 
        ? (data.approved / reviewed) * 100 
        : (data.confidenceSum / data.total) * 100;
      return {
        type: type.length > 30 ? type.substring(0, 27) + '...' : type,
        accuracy: Math.round(acc),
        count: data.total
      };
    });
    
    const weeklyData: Record<string, { total: number; approved: number; avgConf: number }> = {};
    allRuns.forEach(run => {
      const weekStart = new Date(run.createdAt || new Date());
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeklyData[weekKey]) weeklyData[weekKey] = { total: 0, approved: 0, avgConf: 0 };
      weeklyData[weekKey].total++;
      weeklyData[weekKey].avgConf += (run.confidence || 0);
      if (run.status === 'APPROVED') weeklyData[weekKey].approved++;
    });
    
    const byWeek = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        accuracy: data.total > 0 ? Math.round((data.avgConf / data.total) * 100) : 0
      }));
    
    const validationPassRate = allRuns.filter(r => r.validationPassed).length / Math.max(totalRuns, 1);
    const benchmarkScore = Math.round((avgConfidence * 0.5 + validationPassRate * 0.5) * 100);
    
    res.json({
      accuracy: { overall: Math.round(overallAccuracy * 100), trend: 0, byDocType, byWeek },
      errors: {
        topTags,
        recentExamples: allReviews.slice(0, 10).map(r => ({
          id: r.id, field: 'various', tag: (r.errorTags || [])[0] || 'unknown', docType: 'Certificate'
        })),
      },
      improvements: {
        queue: topTags.slice(0, 5).map((t, i) => ({
          id: `imp-${i}`, issue: `Fix ${t.tag.replace(/_/g, ' ')} errors`, occurrences: t.count,
          suggestedFix: `Review and update extraction prompt to handle ${t.tag.replace(/_/g, ' ')} cases`,
          priority: i < 2 ? 'high' : 'medium'
        })),
        recentWins: [],
      },
      benchmarks: {
        latest: { score: benchmarkScore, date: new Date().toISOString(), passed: benchmarkScore >= 80 },
        trend: [],
      },
      extractionStats: {
        total: totalRuns, pending: allRuns.filter(r => r.status === 'PENDING').length,
        approved: approvedRuns, awaitingReview: awaitingReviewRuns, failed: rejectedRuns,
      },
    });
  } catch (error) {
    console.error("Error fetching model insights:", error);
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

mlRouter.get("/model-insights/tier-stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    // Join through certificates to scope by organisation
    const allAuditsRaw = await db.select({ audit: extractionTierAudits })
      .from(extractionTierAudits)
      .innerJoin(certificates, eq(extractionTierAudits.certificateId, certificates.id))
      .where(eq(certificates.organisationId, orgId))
      .orderBy(extractionTierAudits.attemptedAt);
    const allAudits = allAuditsRaw.map(a => a.audit);
    
    if (allAudits.length === 0) {
      return res.json({
        summary: { totalExtractionRuns: 0, totalCertificates: 0, totalTierAttempts: 0, avgTiersPerRun: 0, totalCost: 0, avgCostPerRun: 0, totalProcessingTimeMs: 0, avgProcessingTimeMs: 0 },
        tierDistribution: [], finalTierDistribution: [], escalationReasons: [], costByTier: [], processingTimeByTier: [], recentExtractions: [],
      });
    }
    
    const extractionRunsMap: Map<string, typeof allAudits> = new Map();
    allAudits.forEach(audit => {
      const runKey = audit.extractionRunId || audit.certificateId;
      if (!extractionRunsMap.has(runKey)) extractionRunsMap.set(runKey, []);
      extractionRunsMap.get(runKey)!.push(audit);
    });
    
    const uniqueCertificates = new Set(allAudits.map(a => a.certificateId));
    const totalCost = allAudits.reduce((sum, a) => sum + ((a as any).estimatedCost || 0), 0);
    const totalProcessingTime = allAudits.reduce((sum, a) => sum + (a.processingTimeMs || 0), 0);
    
    const tierCounts: Record<string, number> = {};
    const finalTierCounts: Record<string, number> = {};
    allAudits.forEach(a => { tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1; });
    extractionRunsMap.forEach(audits => {
      const final = audits[audits.length - 1];
      finalTierCounts[final.tier] = (finalTierCounts[final.tier] || 0) + 1;
    });
    
    res.json({
      summary: {
        totalExtractionRuns: extractionRunsMap.size, totalCertificates: uniqueCertificates.size,
        totalTierAttempts: allAudits.length, avgTiersPerRun: allAudits.length / extractionRunsMap.size,
        totalCost, avgCostPerRun: totalCost / extractionRunsMap.size, totalProcessingTimeMs: totalProcessingTime,
        avgProcessingTimeMs: totalProcessingTime / allAudits.length,
      },
      tierDistribution: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
      finalTierDistribution: Object.entries(finalTierCounts).map(([tier, count]) => ({ tier, count })),
      escalationReasons: [], costByTier: [], processingTimeByTier: [], recentExtractions: [],
    });
  } catch (error) {
    console.error("Error fetching tier stats:", error);
    res.status(500).json({ error: "Failed to fetch tier stats" });
  }
});

mlRouter.get("/model-insights/ai-suggestions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const suggestions = await db.select().from(aiSuggestions)
      .where(eq(aiSuggestions.organisationId, orgId))
      .orderBy(desc(aiSuggestions.createdAt))
      .limit(50);
    
    res.json(suggestions);
  } catch (error) {
    console.error("Error fetching AI suggestions:", error);
    res.status(500).json({ error: "Failed to fetch AI suggestions" });
  }
});

mlRouter.post("/model-insights/ai-suggestions/:id/dismiss", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const [updated] = await db.update(aiSuggestions)
      .set({ status: 'DISMISSED', updatedAt: new Date() })
      .where(and(eq(aiSuggestions.id, req.params.id), eq(aiSuggestions.organisationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error dismissing suggestion:", error);
    res.status(500).json({ error: "Failed to dismiss suggestion" });
  }
});

mlRouter.post("/model-insights/ai-suggestions/:id/start", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const [updated] = await db.update(aiSuggestions)
      .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
      .where(and(eq(aiSuggestions.id, req.params.id), eq(aiSuggestions.organisationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error starting suggestion:", error);
    res.status(500).json({ error: "Failed to start suggestion" });
  }
});

mlRouter.post("/model-insights/ai-suggestions/:id/resolve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const [updated] = await db.update(aiSuggestions)
      .set({ status: 'RESOLVED', resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(aiSuggestions.id, req.params.id), eq(aiSuggestions.organisationId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error resolving suggestion:", error);
    res.status(500).json({ error: "Failed to resolve suggestion" });
  }
});

mlRouter.get("/model-insights/ai-suggestions/history", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const history = await db.select().from(aiSuggestions)
      .where(and(eq(aiSuggestions.organisationId, orgId), eq(aiSuggestions.status, 'RESOLVED')))
      .orderBy(desc(aiSuggestions.resolvedAt))
      .limit(50);
    res.json(history);
  } catch (error) {
    console.error("Error fetching suggestions history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Stub routes for model-insights features
mlRouter.get("/model-insights/features/:propertyId", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ features: [], propertyId: req.params.propertyId });
});

mlRouter.post("/model-insights/predict", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ prediction: null, message: "Use /api/ml/predictions endpoint" });
});

mlRouter.post("/model-insights/training/config", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, config: req.body });
});

mlRouter.get("/model-insights/training/status", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ status: 'IDLE', lastRun: null });
});

mlRouter.get("/model-insights/training/runs", async (req: AuthenticatedRequest, res: Response) => {
  res.json([]);
});

mlRouter.get("/model-insights/predictions/history", async (req: AuthenticatedRequest, res: Response) => {
  res.json([]);
});

mlRouter.get("/model-insights/accuracy", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ overall: 0, byType: [] });
});

mlRouter.post("/model-insights/feedback", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true });
});

mlRouter.get("/model-insights/feedback/stats", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ total: 0, positive: 0, negative: 0 });
});

mlRouter.get("/model-insights/risk-weights", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ weights: {} });
});

mlRouter.post("/model-insights/persistence/save", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true });
});

mlRouter.post("/model-insights/persistence/load", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true });
});

mlRouter.get("/model-insights/persistence/models", async (req: AuthenticatedRequest, res: Response) => {
  res.json([]);
});

mlRouter.get("/model-insights/persistence/versions", async (req: AuthenticatedRequest, res: Response) => {
  res.json([]);
});

mlRouter.post("/model-insights/predict/batch", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ predictions: [] });
});

mlRouter.post("/model-insights/run-benchmark", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, score: 0 });
});

mlRouter.post("/model-insights/export-training-data", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [] });
});

// =====================================================
// ML PREDICTION ROUTES
// =====================================================

mlRouter.get("/ml/model", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { getModelMetrics } = await import('../services/ml-prediction');
    const metrics = await getModelMetrics(orgId);
    res.json(metrics);
  } catch (error) {
    console.error("Error fetching ML model metrics:", error);
    res.status(500).json({ error: "Failed to fetch ML model metrics" });
  }
});

mlRouter.patch("/ml/model/settings", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { learningRate, epochs, batchSize, featureWeights } = req.body;
    const { updateModelSettings } = await import('../services/ml-prediction');
    const updatedModel = await updateModelSettings(orgId, { learningRate, epochs, batchSize, featureWeights });
    res.json(updatedModel);
  } catch (error) {
    console.error("Error updating ML model settings:", error);
    res.status(500).json({ error: "Failed to update ML model settings" });
  }
});

mlRouter.get("/ml/predictions/:propertyId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { predictPropertyBreach } = await import('../services/ml-prediction');
    const prediction = await predictPropertyBreach(req.params.propertyId, orgId);
    res.json(prediction);
  } catch (error) {
    console.error("Error getting ML prediction:", error);
    res.status(500).json({ error: "Failed to get ML prediction" });
  }
});

mlRouter.post("/ml/predictions/bulk", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { propertyIds } = req.body;
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: "propertyIds array is required" });
    }
    
    const { predictPropertyBreach } = await import('../services/ml-prediction');
    const predictions = await Promise.all(propertyIds.slice(0, 50).map(id => predictPropertyBreach(id, orgId)));
    res.json({ predictions, generated: predictions.length });
  } catch (error) {
    console.error("Error getting bulk ML predictions:", error);
    res.status(500).json({ error: "Failed to get bulk ML predictions" });
  }
});

mlRouter.post("/ml/predictions/test", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const limit = Math.min(req.body.limit || 30, 50);
    const sampleProperties = (await storage.listProperties(orgId)).slice(0, limit);
    
    if (sampleProperties.length === 0) {
      return res.json({ predictions: [], message: "No properties found for testing" });
    }
    
    const { predictPropertyBreach } = await import('../services/ml-prediction');
    const predictions = await Promise.all(sampleProperties.map(p => predictPropertyBreach(p.id, orgId, { isTest: true })));
    res.json({ predictions, generated: predictions.length, message: `Generated ${predictions.length} test predictions` });
  } catch (error) {
    console.error("Error generating test ML predictions:", error);
    res.status(500).json({ error: "Failed to generate test ML predictions" });
  }
});

mlRouter.post("/ml/predictions/:predictionId/feedback", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id || 'system';
    const userName = req.user?.name || 'System User';
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { feedbackType, correctedScore, correctedCategory, feedbackNotes } = req.body;
    if (!['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT'].includes(feedbackType)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }
    
    const { submitPredictionFeedback } = await import('../services/ml-prediction');
    const feedback = await submitPredictionFeedback(
      req.params.predictionId, orgId, feedbackType, userId, userName, correctedScore, correctedCategory, feedbackNotes
    );
    res.json(feedback);
  } catch (error) {
    console.error("Error submitting ML feedback:", error);
    res.status(500).json({ error: "Failed to submit ML feedback" });
  }
});

mlRouter.post("/ml/model/train", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { learningRate = 0.01, epochs = 100, batchSize = 32, validationSplit = 0.2 } = req.body;
    const { trainModelFromFeedback } = await import('../services/ml-prediction');
    const result = await trainModelFromFeedback(orgId, { learningRate, epochs, batchSize, validationSplit });
    res.json(result);
  } catch (error) {
    console.error("Error training ML model:", error);
    res.status(500).json({ error: "Failed to train ML model" });
  }
});

mlRouter.get("/ml/training-runs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const trainingRunsData = await db.select()
      .from(mlTrainingRuns)
      .innerJoin(mlModels, eq(mlTrainingRuns.modelId, mlModels.id))
      .where(eq(mlModels.organisationId, orgId))
      .orderBy(desc(mlTrainingRuns.startedAt))
      .limit(20);
    res.json(trainingRunsData.map(r => r.ml_training_runs));
  } catch (error) {
    console.error("Error fetching training runs:", error);
    res.status(500).json({ error: "Failed to fetch training runs" });
  }
});

mlRouter.get("/ml/predictions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { propertyId, tier, limit = '50' } = req.query;
    const conditions = [eq(mlPredictions.organisationId, orgId)];
    
    if (propertyId && typeof propertyId === 'string') conditions.push(eq(mlPredictions.propertyId, propertyId));
    if (tier && typeof tier === 'string' && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(tier)) {
      conditions.push(eq(mlPredictions.predictedRiskCategory, tier));
    }
    
    const rawPredictions = await db.select().from(mlPredictions)
      .where(and(...conditions))
      .orderBy(desc(mlPredictions.createdAt))
      .limit(Math.min(parseInt(limit as string), 100));
    
    const propertyIds = rawPredictions.map(p => p.propertyId).filter(Boolean) as string[];
    let propertyMap = new Map<string, { id: string; uprn: string | null; address: string | null; postcode: string | null }>();
    
    if (propertyIds.length > 0) {
      const propertiesData = await db.select().from(properties).where(inArray(properties.id, propertyIds));
      propertyMap = new Map(propertiesData.map(p => [p.id, { id: p.id, uprn: p.uprn, address: p.addressLine1, postcode: p.postcode }]));
    }
    
    const predictions = rawPredictions.map(p => {
      const hasML = p.mlScore !== null && p.mlConfidence !== null;
      const statConf = p.statisticalConfidence || 50;
      const mlConf = p.mlConfidence || 0;
      let combinedScore = p.statisticalScore || 0;
      let combinedConfidence = statConf;
      let sourceLabel: 'Statistical' | 'ML-Enhanced' | 'ML-Only' = 'Statistical';
      
      if (hasML && p.mlScore !== null) {
        const totalConf = statConf + mlConf;
        combinedScore = Math.round((p.statisticalScore || 0) * (statConf / totalConf) + p.mlScore * (mlConf / totalConf));
        combinedConfidence = Math.round((statConf + mlConf) / 2);
        sourceLabel = 'ML-Enhanced';
      }
      
      const property = p.propertyId ? propertyMap.get(p.propertyId) : null;
      return {
        id: p.id, propertyId: p.propertyId, propertyUprn: property?.uprn || null, propertyAddress: property?.address || null,
        propertyPostcode: property?.postcode || null, riskScore: combinedScore, riskCategory: p.predictedRiskCategory || 'LOW',
        breachProbability: combinedScore / 100, predictedBreachDate: p.predictedBreachDate, confidenceLevel: combinedConfidence,
        sourceLabel, createdAt: p.createdAt, statisticalScore: p.statisticalScore, statisticalConfidence: p.statisticalConfidence,
        mlScore: p.mlScore, mlConfidence: p.mlConfidence,
      };
    });
    res.json(predictions);
  } catch (error) {
    console.error("Error fetching ML predictions:", error);
    res.status(500).json({ error: "Failed to fetch ML predictions" });
  }
});

mlRouter.get("/ml/learning-lifecycle", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const correctionStats = await db.select({
      totalCorrections: sql<number>`COUNT(*)`,
      usedForImprovement: sql<number>`COUNT(*) FILTER (WHERE used_for_improvement = true)`,
      avgReviewTime: sql<number>`AVG(review_duration_seconds)`,
    }).from(extractionCorrections).where(eq(extractionCorrections.organisationId, orgId));
    
    const correctionsByType = await db.select({
      correctionType: extractionCorrections.correctionType,
      count: sql<number>`COUNT(*)`,
    }).from(extractionCorrections).where(eq(extractionCorrections.organisationId, orgId)).groupBy(extractionCorrections.correctionType);
    
    const correctionsByField = await db.select({
      fieldName: extractionCorrections.fieldName,
      count: sql<number>`COUNT(*)`,
    }).from(extractionCorrections).where(eq(extractionCorrections.organisationId, orgId)).groupBy(extractionCorrections.fieldName)
      .orderBy(desc(sql<number>`COUNT(*)`)).limit(10);
    
    const correctionsByCertType = await db.select({
      certificateType: extractionCorrections.certificateType,
      count: sql<number>`COUNT(*)`,
    }).from(extractionCorrections).where(eq(extractionCorrections.organisationId, orgId)).groupBy(extractionCorrections.certificateType);
    
    const recentCorrections = await db.select().from(extractionCorrections)
      .where(eq(extractionCorrections.organisationId, orgId))
      .orderBy(desc(extractionCorrections.createdAt)).limit(20);
    
    const stats = correctionStats[0] || { totalCorrections: 0, usedForImprovement: 0, avgReviewTime: 0 };
    const improvementRate = stats.totalCorrections > 0 ? Math.round((stats.usedForImprovement / stats.totalCorrections) * 100) : 0;
    
    res.json({
      summary: {
        totalCorrections: Number(stats.totalCorrections) || 0, usedForImprovement: Number(stats.usedForImprovement) || 0,
        pendingImprovement: Number(stats.totalCorrections) - Number(stats.usedForImprovement) || 0, improvementRate,
        avgReviewTimeSeconds: Math.round(Number(stats.avgReviewTime) || 0),
      },
      correctionsByType: correctionsByType.map(c => ({ type: c.correctionType, count: Number(c.count) })),
      correctionsByField: correctionsByField.map(c => ({ field: c.fieldName, count: Number(c.count) })),
      correctionsByCertificateType: correctionsByCertType.map(c => ({ certificateType: c.certificateType, count: Number(c.count) })),
      recentCorrections: recentCorrections.map(c => ({
        id: c.id, fieldName: c.fieldName, originalValue: c.originalValue, correctedValue: c.correctedValue,
        correctionType: c.correctionType, certificateType: c.certificateType, extractionTier: c.extractionTier,
        reviewerName: c.reviewerName, usedForImprovement: c.usedForImprovement, createdAt: c.createdAt,
      })),
      learningPipeline: {
        stages: [
          { name: 'Document Uploaded', description: 'Certificate enters ingestion queue', status: 'active' },
          { name: 'AI Extraction', description: 'Multi-tier extraction processes document', status: 'active' },
          { name: 'Human Review', description: 'Quality assurance and correction', status: 'active' },
          { name: 'Correction Capture', description: 'Field-level differences recorded', status: 'active' },
          { name: 'Pattern Analysis', description: 'Identify recurring extraction failures', status: 'pending' },
          { name: 'Template Update', description: 'Improve extraction rules', status: 'pending' },
        ],
      },
    });
  } catch (error) {
    console.error("Error fetching learning lifecycle:", error);
    res.status(500).json({ error: "Failed to fetch learning lifecycle data" });
  }
});

mlRouter.post("/ml/corrections", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id;
    const userName = req.user?.name || 'Unknown';
    if (!orgId) return res.status(403).json({ error: "No organisation access" });
    
    const { certificateId, corrections } = req.body;
    if (!certificateId || !corrections || !Array.isArray(corrections)) {
      return res.status(400).json({ error: "certificateId and corrections array required" });
    }
    
    // Verify certificate exists AND belongs to the caller's organisation
    const cert = await db.select().from(certificates)
      .where(and(eq(certificates.id, certificateId), eq(certificates.organisationId, orgId)))
      .limit(1);
    
    if (!cert[0]) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    
    const insertedCorrections = [];
    
    for (const correction of corrections) {
      const { fieldName, originalValue, correctedValue, correctionType, sourceText, notes, reviewDurationSeconds } = correction;
      if (!fieldName || !correctedValue || !correctionType) continue;
      
      const [inserted] = await db.insert(extractionCorrections).values({
        organisationId: orgId, certificateId, fieldName, originalValue: originalValue || null, correctedValue, correctionType,
        sourceText: sourceText || null, certificateType: cert[0]?.certificateType || null, reviewerId: userId || null,
        reviewerName: userName, reviewDurationSeconds: reviewDurationSeconds || null, notes: notes || null,
      }).returning();
      insertedCorrections.push(inserted);
    }
    
    res.status(201).json({ success: true, count: insertedCorrections.length, corrections: insertedCorrections });
  } catch (error) {
    console.error("Error recording corrections:", error);
    res.status(500).json({ error: "Failed to record corrections" });
  }
});

// Pattern analysis routes (admin only)
mlRouter.get("/ml/pattern-analysis", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runPatternAnalysis } = await import('../services/pattern-analysis');
    const result = await runPatternAnalysis();
    res.json(result);
  } catch (error) {
    console.error("Error running pattern analysis:", error);
    res.status(500).json({ error: "Failed to run pattern analysis" });
  }
});

mlRouter.get("/ml/pattern-analysis/summary", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { getPatternSummary } = await import('../services/pattern-analysis');
    const summary = await getPatternSummary();
    res.json(summary);
  } catch (error) {
    console.error("Error getting pattern summary:", error);
    res.status(500).json({ error: "Failed to get pattern summary" });
  }
});

mlRouter.post("/ml/pattern-analysis/trigger", requireRole(...SUPER_ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { triggerPatternAnalysis } = await import('../job-queue');
    const jobId = await triggerPatternAnalysis();
    res.json({ success: true, jobId, message: "Pattern analysis job triggered" });
  } catch (error) {
    console.error("Error triggering pattern analysis:", error);
    res.status(500).json({ error: "Failed to trigger pattern analysis" });
  }
});
