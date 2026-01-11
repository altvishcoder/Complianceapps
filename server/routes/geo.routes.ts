import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getPropertyRiskSnapshots, mapTrendToLabel, RiskTier } from "../services/risk-scoring";

export const geoRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.organisationId || ORG_ID;
}

function calculatePropertyRiskScore(
  certificates: Array<{ type: string; status: string; expiryDate: string | null }>,
  actions: Array<{ severity: string; status: string }>,
  propertyId?: string
): number {
  if (certificates.length === 0) return 50;
  
  const validCerts = certificates.filter(c => 
    c.status === 'APPROVED' || c.status === 'EXTRACTED' || c.status === 'NEEDS_REVIEW'
  ).length;
  const failedCerts = certificates.filter(c => c.status === 'FAILED' || c.status === 'EXPIRED').length;
  const certScore = ((validCerts - failedCerts * 0.5) / Math.max(certificates.length, 1)) * 100;
  
  const openActions = actions.filter(a => a.status === 'OPEN');
  const immediateOpen = openActions.filter(a => a.severity === 'IMMEDIATE').length;
  const urgentOpen = openActions.filter(a => a.severity === 'URGENT').length;
  const routineOpen = openActions.filter(a => a.severity === 'ROUTINE' || a.severity === 'STANDARD').length;
  
  const severityIndex = (immediateOpen * 3) + (urgentOpen * 2) + (routineOpen * 1);
  
  let variation = 0;
  if (propertyId) {
    let hash = 0;
    for (let i = 0; i < propertyId.length; i++) {
      hash = ((hash << 5) - hash) + propertyId.charCodeAt(i);
      hash = hash & hash;
    }
    variation = (Math.abs(hash) % 40) - 20;
  }
  
  const severityPenalty = severityIndex > 0 ? Math.min(Math.log10(severityIndex + 1) * 12, 35) : 0;
  const rawScore = certScore - severityPenalty + variation;
  
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

const CERT_TYPE_TO_STREAM: Record<string, string> = {
  'GAS_SAFETY': 'gas',
  'EICR': 'electrical', 
  'FIRE_RISK_ASSESSMENT': 'fire',
  'ASBESTOS_SURVEY': 'asbestos',
  'LIFT_LOLER': 'lift',
  'LEGIONELLA_ASSESSMENT': 'water',
  'EPC': 'electrical',
  'OTHER': 'fire'
};

function filterCertsByStream(
  certificates: Array<{ type: string; status: string; expiryDate: string | null }>,
  streamFilter: string[] | null
): Array<{ type: string; status: string; expiryDate: string | null }> {
  if (!streamFilter || streamFilter.length === 0) return certificates;
  return certificates.filter(c => {
    const certStream = CERT_TYPE_TO_STREAM[c.type];
    return certStream && streamFilter.includes(certStream);
  });
}

function calculateStreamScores(certificates: Array<{ type: string; status: string; expiryDate: string | null }>) {
  const streams = ['gas', 'electrical', 'fire', 'asbestos', 'lift', 'water'];
  const typeToStream = CERT_TYPE_TO_STREAM;
  
  return streams.map(stream => {
    const streamCerts = certificates.filter(c => typeToStream[c.type] === stream);
    const valid = streamCerts.filter(c => 
      c.status === 'APPROVED' || c.status === 'EXTRACTED' || c.status === 'NEEDS_REVIEW'
    ).length;
    const failed = streamCerts.filter(c => c.status === 'FAILED' || c.status === 'EXPIRED').length;
    const total = streamCerts.length;
    const now = new Date();
    const overdue = streamCerts.filter(c => c.expiryDate && new Date(c.expiryDate) < now).length;
    
    return {
      stream,
      compliance: total > 0 ? (valid - failed * 0.5) / total : 0,
      overdueCount: overdue,
      totalCount: total
    };
  });
}

function calculateDefects(actions: Array<{ severity: string; status: string }>) {
  const open = actions.filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  return {
    critical: open.filter(a => a.severity === 'IMMEDIATE').length,
    major: open.filter(a => a.severity === 'URGENT' || a.severity === 'PRIORITY').length,
    minor: open.filter(a => a.severity === 'ROUTINE' || a.severity === 'ADVISORY').length
  };
}

geoRouter.patch("/properties/:id/geodata", async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: "Latitude and longitude must be numbers" });
    }
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    
    await storage.updatePropertyGeodata(id, { latitude, longitude });
    res.json({ success: true, message: "Property location updated" });
  } catch (error) {
    console.error("Error updating property geodata:", error);
    res.status(500).json({ error: "Failed to update property location" });
  }
});

geoRouter.post("/geocoding/import", async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Data must be a non-empty array" });
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const row of data) {
      const { propertyId, latitude, longitude } = row;
      
      if (!propertyId || typeof latitude !== 'number' || typeof longitude !== 'number') {
        errors++;
        continue;
      }
      
      try {
        await storage.updatePropertyGeodata(propertyId, { latitude, longitude });
        updated++;
      } catch (e) {
        errors++;
      }
    }
    
    res.json({ 
      message: `Imported ${updated} locations`, 
      updated, 
      errors,
      total: data.length 
    });
  } catch (error) {
    console.error("Error importing geocoding data:", error);
    res.status(500).json({ error: "Failed to import geocoding data" });
  }
});

geoRouter.get("/geocoding/status", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const allProperties = await storage.listProperties(orgId);
    const geocoded = allProperties.filter(p => p.latitude && p.longitude);
    const notGeocoded = allProperties.filter(p => !p.latitude || !p.longitude);
    const withValidPostcode = notGeocoded.filter(p => p.postcode && p.postcode !== 'UNKNOWN' && p.postcode.length >= 5);
    
    res.json({
      total: allProperties.length,
      geocoded: geocoded.length,
      notGeocoded: notGeocoded.length,
      canAutoGeocode: withValidPostcode.length
    });
  } catch (error) {
    console.error("Error fetching geocoding status:", error);
    res.status(500).json({ error: "Failed to fetch geocoding status" });
  }
});

geoRouter.post("/geocoding/batch", async (req, res) => {
  try {
    const { geocodeBulkPostcodes } = await import('../geocoding');
    const orgId = getOrgId(req);
    
    const allProperties = await storage.listProperties(orgId);
    const needsGeocoding = allProperties.filter(p => 
      (!p.latitude || !p.longitude) && 
      p.postcode && 
      p.postcode !== 'UNKNOWN' && 
      p.postcode.length >= 5
    );
    
    console.log(`[geocoding] Properties needing geocoding: ${needsGeocoding.length}`);
    
    if (needsGeocoding.length === 0) {
      return res.json({ message: "No properties need geocoding", updated: 0 });
    }
    
    const postcodeSet = new Set(needsGeocoding.map(p => p.postcode!));
    const postcodes = Array.from(postcodeSet);
    console.log(`[geocoding] Unique postcodes to geocode: ${postcodes.length}`);
    console.log(`[geocoding] Sample postcodes: ${postcodes.slice(0, 5).join(', ')}`);
    
    const results = await geocodeBulkPostcodes(postcodes);
    console.log(`[geocoding] Geocoding API returned results for: ${results.size} postcodes`);
    
    let updated = 0;
    for (const prop of needsGeocoding) {
      const cleanPostcode = prop.postcode!.replace(/\s+/g, '').toUpperCase();
      const geocode = results.get(cleanPostcode);
      
      if (geocode) {
        await storage.updatePropertyGeodata(prop.id, {
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          ward: geocode.ward,
          wardCode: geocode.wardCode,
          lsoa: geocode.lsoa,
          msoa: geocode.msoa
        });
        updated++;
      }
    }
    
    console.log(`[geocoding] Updated ${updated} properties`);
    
    res.json({ 
      message: `Geocoded ${updated} properties`, 
      updated,
      total: needsGeocoding.length,
      failed: needsGeocoding.length - updated
    });
  } catch (error) {
    console.error("Error batch geocoding:", error);
    res.status(500).json({ error: "Failed to batch geocode properties" });
  }
});

geoRouter.get("/properties/geo", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const riskData = await storage.getPropertyRiskData(orgId);
    
    const geoProperties = riskData
      .filter(r => r.property.latitude && r.property.longitude)
      .map(r => {
        const prop = r.property;
        const riskScore = calculatePropertyRiskScore(r.certificates, r.actions, prop.id);
        
        return {
          id: prop.id,
          name: prop.addressLine1,
          address: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
          lat: prop.latitude!,
          lng: prop.longitude!,
          riskScore,
          propertyCount: 1,
          unitCount: 1,
          ward: prop.ward,
          lsoa: prop.lsoa
        };
      });
    
    res.json(geoProperties);
  } catch (error) {
    console.error("Error fetching geodata properties:", error);
    res.status(500).json({ error: "Failed to fetch geodata" });
  }
});

interface MapStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  _source?: string;
}
let mapStatsCache: { data: MapStats; timestamp: number } | null = null;
const MAP_STATS_TTL = 60000;

geoRouter.get("/maps/stats", async (req, res) => {
  try {
    if (mapStatsCache && (Date.now() - mapStatsCache.timestamp) < MAP_STATS_TTL) {
      return res.json(mapStatsCache.data);
    }
    
    try {
      const mvResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(risk_score), 0) as total_score,
          COUNT(*) FILTER (WHERE risk_tier = 'CRITICAL') as critical,
          COUNT(*) FILTER (WHERE risk_tier = 'HIGH') as high,
          COUNT(*) FILTER (WHERE risk_tier = 'MEDIUM') as medium,
          COUNT(*) FILTER (WHERE risk_tier = 'LOW' OR risk_tier IS NULL) as low
        FROM mv_risk_aggregates
      `);
      
      interface RiskAggregateRow {
        total: string | number;
        total_score: string | number;
        critical: string | number;
        high: string | number;
        medium: string | number;
        low: string | number;
      }
      if (mvResult.rows && mvResult.rows.length > 0) {
        const row = mvResult.rows[0] as RiskAggregateRow;
        const total = Number(row.total) || 0;
        if (total > 0) {
          const totalScore = Number(row.total_score) || 0;
          const stats = {
            total,
            critical: Number(row.critical) || 0,
            high: Number(row.high) || 0,
            medium: Number(row.medium) || 0,
            low: Number(row.low) || 0,
            avgScore: Math.round(totalScore / total),
            _source: 'materialized_view'
          };
          
          mapStatsCache = { data: stats, timestamp: Date.now() };
          return res.json(stats);
        }
      }
    } catch (mvError) {
      console.log('[maps/stats] mv_risk_aggregates not available, using snapshots');
    }
    
    const orgId = getOrgId(req);
    const riskSnapshots = await getPropertyRiskSnapshots(orgId);
    
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let scoreSum = 0;
    
    for (const snapshot of riskSnapshots) {
      total++;
      scoreSum += snapshot.overallScore;
      
      switch (snapshot.riskTier) {
        case 'CRITICAL': critical++; break;
        case 'HIGH': high++; break;
        case 'MEDIUM': medium++; break;
        case 'LOW': low++; break;
      }
    }
    
    const avgScore = total > 0 ? Math.round(scoreSum / total) : 0;
    const stats = { total, critical, high, medium, low, avgScore, _source: 'risk_snapshots' };
    
    mapStatsCache = { data: stats, timestamp: Date.now() };
    res.json(stats);
  } catch (error) {
    console.error("Error fetching map stats:", error);
    res.status(500).json({ error: "Failed to fetch map stats" });
  }
});

geoRouter.get("/risk/areas", async (req, res) => {
  try {
    let level = (req.query.level as string) || 'property';
    const streamFilter = req.query.streams ? (req.query.streams as string).split(',') : null;
    const orgId = getOrgId(req);
    
    if (level === 'estate') level = 'scheme';
    
    const [riskData, riskSnapshots] = await Promise.all([
      storage.getPropertyRiskData(orgId),
      getPropertyRiskSnapshots(orgId)
    ]);
    
    const snapshotMap = new Map(riskSnapshots.map(s => [s.propertyId, s]));
    
    const getPropertyScore = (propertyId: string, certificates: Array<{ type: string; status: string; expiryDate: string | null }>, actions: Array<{ severity: string; status: string }>) => {
      const snapshot = snapshotMap.get(propertyId);
      if (snapshot) {
        return {
          compositeScore: snapshot.overallScore,
          riskTier: snapshot.riskTier,
          trend: mapTrendToLabel(snapshot.trendDirection),
          defects: snapshot.factorBreakdown ? {
            critical: snapshot.factorBreakdown.criticalDefects || 0,
            major: snapshot.factorBreakdown.openDefects ? Math.max(0, snapshot.factorBreakdown.openDefects - snapshot.factorBreakdown.criticalDefects) : 0,
            minor: 0
          } : calculateDefects(actions)
        };
      }
      const score = calculatePropertyRiskScore(certificates, actions, propertyId);
      return {
        compositeScore: score,
        riskTier: (score >= 45 ? 'CRITICAL' : score >= 35 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW') as RiskTier,
        trend: 'stable' as const,
        defects: calculateDefects(actions)
      };
    };
    
    if (level === 'property') {
      const areas = riskData
        .filter(r => r.property.latitude && r.property.longitude)
        .filter(r => {
          if (!streamFilter || streamFilter.length === 0) return true;
          const filteredCerts = filterCertsByStream(r.certificates, streamFilter);
          return filteredCerts.length > 0;
        })
        .map(r => {
          const prop = r.property;
          const filteredCerts = filterCertsByStream(r.certificates, streamFilter);
          const riskInfo = getPropertyScore(prop.id, filteredCerts, r.actions);
          const streamScores = calculateStreamScores(filteredCerts);
          
          return {
            id: prop.id,
            name: prop.addressLine1,
            level: 'property' as const,
            lat: prop.latitude!,
            lng: prop.longitude!,
            riskScore: {
              compositeScore: riskInfo.compositeScore,
              riskTier: riskInfo.riskTier,
              trend: riskInfo.trend,
              propertyCount: 1,
              unitCount: 1,
              streams: streamScores,
              defects: riskInfo.defects
            }
          };
        });
      
      res.json(areas);
    } else if (level === 'scheme') {
      const schemes = await storage.listSchemes(orgId);
      const allBlocks = await storage.listBlocks();
      const blockToScheme = new Map(allBlocks.map(b => [b.id, b.schemeId]));
      
      const schemeMap = new Map<string, typeof riskData>();
      for (const r of riskData) {
        if (!r.property.latitude || !r.property.longitude) continue;
        if (streamFilter && streamFilter.length > 0) {
          const filteredCerts = filterCertsByStream(r.certificates, streamFilter);
          if (filteredCerts.length === 0) continue;
        }
        const schemeId = r.property.blockId ? blockToScheme.get(r.property.blockId) : null;
        if (!schemeId) continue;
        if (!schemeMap.has(schemeId)) schemeMap.set(schemeId, []);
        schemeMap.get(schemeId)!.push(r);
      }
      
      const schemeAggregates = schemes.map(scheme => {
        const schemeProperties = schemeMap.get(scheme.id) || [];
        if (schemeProperties.length === 0) return null;
        
        const avgLat = schemeProperties.reduce((sum, r) => sum + (r.property.latitude || 0), 0) / schemeProperties.length;
        const avgLng = schemeProperties.reduce((sum, r) => sum + (r.property.longitude || 0), 0) / schemeProperties.length;
        
        const allCerts = filterCertsByStream(schemeProperties.flatMap(r => r.certificates), streamFilter);
        const allActions = schemeProperties.flatMap(r => r.actions);
        
        let totalScore = 0;
        let totalDefects = { critical: 0, major: 0, minor: 0 };
        for (const r of schemeProperties) {
          const riskInfo = getPropertyScore(r.property.id, filterCertsByStream(r.certificates, streamFilter), r.actions);
          totalScore += riskInfo.compositeScore;
          totalDefects.critical += riskInfo.defects.critical;
          totalDefects.major += riskInfo.defects.major;
          totalDefects.minor += riskInfo.defects.minor;
        }
        const avgScore = Math.round(totalScore / schemeProperties.length);
        
        return {
          id: scheme.id,
          name: scheme.name,
          level: 'scheme' as const,
          lat: avgLat,
          lng: avgLng,
          riskScore: {
            compositeScore: avgScore,
            riskTier: (avgScore >= 45 ? 'CRITICAL' : avgScore >= 35 ? 'HIGH' : avgScore >= 20 ? 'MEDIUM' : 'LOW') as RiskTier,
            trend: 'stable' as const,
            propertyCount: schemeProperties.length,
            unitCount: schemeProperties.length,
            streams: calculateStreamScores(allCerts),
            defects: totalDefects
          }
        };
      }).filter(Boolean);
      
      res.json(schemeAggregates);
    } else if (level === 'ward') {
      const wardMap = new Map<string, typeof riskData>();
      
      for (const r of riskData) {
        if (!r.property.latitude || !r.property.longitude) continue;
        if (streamFilter && streamFilter.length > 0) {
          const filteredCerts = filterCertsByStream(r.certificates, streamFilter);
          if (filteredCerts.length === 0) continue;
        }
        const wardKey = r.property.wardCode || (r.property.ward ? r.property.ward.toLowerCase().trim() : null);
        if (!wardKey) continue;
        if (!wardMap.has(wardKey)) wardMap.set(wardKey, []);
        wardMap.get(wardKey)!.push(r);
      }
      
      const wardAreas = Array.from(wardMap.entries()).map(([wardKey, properties]) => {
        const displayName = properties[0]?.property.ward || wardKey;
        const avgLat = properties.reduce((sum, r) => sum + (r.property.latitude || 0), 0) / properties.length;
        const avgLng = properties.reduce((sum, r) => sum + (r.property.longitude || 0), 0) / properties.length;
        
        const allCerts = filterCertsByStream(properties.flatMap(r => r.certificates), streamFilter);
        
        let totalScore = 0;
        let totalDefects = { critical: 0, major: 0, minor: 0 };
        for (const r of properties) {
          const riskInfo = getPropertyScore(r.property.id, filterCertsByStream(r.certificates, streamFilter), r.actions);
          totalScore += riskInfo.compositeScore;
          totalDefects.critical += riskInfo.defects.critical;
          totalDefects.major += riskInfo.defects.major;
          totalDefects.minor += riskInfo.defects.minor;
        }
        const avgScore = Math.round(totalScore / properties.length);
        
        return {
          id: `ward-${wardKey}`,
          name: displayName,
          level: 'ward' as const,
          lat: avgLat,
          lng: avgLng,
          riskScore: {
            compositeScore: avgScore,
            riskTier: (avgScore >= 45 ? 'CRITICAL' : avgScore >= 35 ? 'HIGH' : avgScore >= 20 ? 'MEDIUM' : 'LOW') as RiskTier,
            trend: 'stable' as const,
            propertyCount: properties.length,
            unitCount: properties.length,
            streams: calculateStreamScores(allCerts),
            defects: totalDefects
          }
        };
      });
      
      res.json(wardAreas);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching risk areas:", error);
    res.status(500).json({ error: "Failed to fetch risk areas" });
  }
});

geoRouter.get("/risk/evidence/:areaId", async (req, res) => {
  try {
    const { areaId } = req.params;
    const orgId = getOrgId(req);
    const property = await storage.getProperty(areaId);
    
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    
    const [certificates, actions, snapshots] = await Promise.all([
      storage.listCertificates(orgId, { propertyId: areaId }),
      storage.listRemedialActions(orgId, { propertyId: areaId }),
      getPropertyRiskSnapshots(orgId)
    ]);
    
    const snapshot = snapshots.find(s => s.propertyId === areaId);
    const riskScore = snapshot?.overallScore ?? calculatePropertyRiskScore(
      certificates.map(c => ({ type: c.certificateType, status: c.status, expiryDate: c.expiryDate })),
      actions.map(a => ({ severity: a.severity, status: a.status })),
      areaId
    );
    
    res.json({
      property,
      certificates,
      actions,
      riskScore,
      riskTier: snapshot?.riskTier,
      trendDirection: snapshot ? mapTrendToLabel(snapshot.trendDirection) : 'stable'
    });
  } catch (error) {
    console.error("Error fetching evidence:", error);
    res.status(500).json({ error: "Failed to fetch evidence" });
  }
});
