import { 
  certificates, extractions, properties, blocks, schemes,
  certificateVersions, auditFieldChanges, ukhdsExports, complianceCalendarEvents,
  certificateDetectionPatterns, certificateOutcomeRules,
  gasApplianceRecords, electricalCircuitRecords, fireSystemRecords, asbestosSurveyRecords, waterTemperatureRecords
} from "@shared/schema";
import type { 
  Certificate, InsertCertificate,
  Extraction, InsertExtraction,
  Property,
  CertificateVersion, InsertCertificateVersion,
  AuditFieldChange, InsertAuditFieldChange,
  UkhdsExport, InsertUkhdsExport,
  ComplianceCalendarEvent, InsertComplianceCalendarEvent,
  DetectionPattern, InsertDetectionPattern,
  OutcomeRule, InsertOutcomeRule,
  GasApplianceRecord, InsertGasApplianceRecord,
  ElectricalCircuitRecord, InsertElectricalCircuitRecord,
  FireSystemRecord, InsertFireSystemRecord,
  AsbestosSurveyRecord, InsertAsbestosSurveyRecord,
  WaterTemperatureRecord, InsertWaterTemperatureRecord
} from "@shared/schema";
import { db, eq, and, or, desc, sql, inArray, gte, lte, lt, ilike } from "../base";
import type { ICertificatesStorage } from "../interfaces";

export class CertificatesStorage implements ICertificatesStorage {
  async listCertificates(organisationId: string, filters?: { propertyId?: string; status?: string }): Promise<Certificate[]> {
    const conditions = [eq(certificates.organisationId, organisationId)];
    if (filters?.propertyId) {
      conditions.push(eq(certificates.propertyId, filters.propertyId));
    }
    if (filters?.status) {
      conditions.push(eq(certificates.status, filters.status as any));
    }
    return db.select().from(certificates).where(and(...conditions)).orderBy(desc(certificates.createdAt));
  }
  
  async listCertificatesCursor(organisationId: string, options: { 
    propertyId?: string; 
    status?: string | string[]; 
    search?: string; 
    limit: number; 
    cursor?: string 
  }): Promise<{ 
    data: (Certificate & { property?: Property; extraction?: Extraction })[]; 
    nextCursor: string | null; 
    hasMore: boolean 
  }> {
    const conditions: any[] = [eq(certificates.organisationId, organisationId)];
    
    if (options.propertyId) {
      conditions.push(eq(certificates.propertyId, options.propertyId));
    }
    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(certificates.status, options.status as any[]));
      } else {
        conditions.push(eq(certificates.status, options.status as any));
      }
    }
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(or(
        ilike(certificates.type, searchPattern),
        ilike(certificates.originalFilename, searchPattern)
      ));
    }
    if (options.cursor) {
      conditions.push(lt(certificates.createdAt, new Date(options.cursor)));
    }
    
    const rows = await db.select()
      .from(certificates)
      .leftJoin(properties, eq(certificates.propertyId, properties.id))
      .leftJoin(extractions, eq(extractions.certificateId, certificates.id))
      .where(and(...conditions))
      .orderBy(desc(certificates.createdAt))
      .limit(options.limit + 1);
    
    const hasMore = rows.length > options.limit;
    const data = rows.slice(0, options.limit).map(row => ({
      ...row.certificates,
      property: row.properties || undefined,
      extraction: row.extractions || undefined
    }));
    
    const nextCursor = hasMore && data.length > 0 
      ? data[data.length - 1].createdAt.toISOString() 
      : null;
    
    return { data, nextCursor, hasMore };
  }
  
  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert || undefined;
  }
  
  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [created] = await db.insert(certificates).values(certificate).returning();
    return created;
  }
  
  async updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [updated] = await db.update(certificates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificates.id, id))
      .returning();
    return updated || undefined;
  }
  
  async findAndFailStuckCertificates(timeoutMinutes: number): Promise<Certificate[]> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const stuck = await db.select()
      .from(certificates)
      .where(and(
        eq(certificates.status, 'PROCESSING'),
        lt(certificates.updatedAt, cutoff)
      ));
    
    for (const cert of stuck) {
      await db.update(certificates)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(certificates.id, cert.id));
    }
    
    return stuck;
  }
  
  async deleteCertificate(id: string): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined> {
    const [extraction] = await db.select().from(extractions).where(eq(extractions.certificateId, certificateId));
    return extraction || undefined;
  }
  
  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const [created] = await db.insert(extractions).values(extraction).returning();
    return created;
  }
  
  async listCertificateVersions(certificateId: string): Promise<CertificateVersion[]> {
    return db.select().from(certificateVersions).where(eq(certificateVersions.certificateId, certificateId)).orderBy(desc(certificateVersions.versionNumber));
  }
  
  async getCertificateVersion(id: string): Promise<CertificateVersion | undefined> {
    const [version] = await db.select().from(certificateVersions).where(eq(certificateVersions.id, id));
    return version || undefined;
  }
  
  async createCertificateVersion(version: InsertCertificateVersion): Promise<CertificateVersion> {
    const [newVersion] = await db.insert(certificateVersions).values(version).returning();
    return newVersion;
  }
  
  async supersedeCertificateVersion(id: string, supersededById: string, reason?: string): Promise<CertificateVersion | undefined> {
    const [updated] = await db.update(certificateVersions).set({
      supersededAt: new Date(),
      supersededById,
      supersededReason: reason || null,
    }).where(eq(certificateVersions.id, id)).returning();
    return updated || undefined;
  }
  
  async listAuditFieldChanges(auditEventId: string): Promise<AuditFieldChange[]> {
    return db.select().from(auditFieldChanges).where(eq(auditFieldChanges.auditEventId, auditEventId)).orderBy(auditFieldChanges.fieldName);
  }
  
  async createAuditFieldChange(change: InsertAuditFieldChange): Promise<AuditFieldChange> {
    const [newChange] = await db.insert(auditFieldChanges).values(change).returning();
    return newChange;
  }
  
  async createAuditFieldChanges(changes: InsertAuditFieldChange[]): Promise<AuditFieldChange[]> {
    if (changes.length === 0) return [];
    return db.insert(auditFieldChanges).values(changes).returning();
  }
  
  async listUkhdsExports(organisationId: string): Promise<UkhdsExport[]> {
    return db.select().from(ukhdsExports).where(eq(ukhdsExports.organisationId, organisationId)).orderBy(desc(ukhdsExports.createdAt));
  }
  
  async getUkhdsExport(id: string): Promise<UkhdsExport | undefined> {
    const [exportJob] = await db.select().from(ukhdsExports).where(eq(ukhdsExports.id, id));
    return exportJob || undefined;
  }
  
  async createUkhdsExport(exportJob: InsertUkhdsExport): Promise<UkhdsExport> {
    const [newExport] = await db.insert(ukhdsExports).values(exportJob).returning();
    return newExport;
  }
  
  async updateUkhdsExport(id: string, updates: Partial<InsertUkhdsExport>): Promise<UkhdsExport | undefined> {
    const [updated] = await db.update(ukhdsExports).set(updates).where(eq(ukhdsExports.id, id)).returning();
    return updated || undefined;
  }
  
  async listCalendarEvents(organisationId: string, filters?: { startDate?: Date; endDate?: Date; eventType?: string; complianceStreamId?: string }): Promise<ComplianceCalendarEvent[]> {
    let conditions = [eq(complianceCalendarEvents.organisationId, organisationId)];
    
    if (filters?.startDate) {
      conditions.push(gte(complianceCalendarEvents.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(complianceCalendarEvents.startDate, filters.endDate));
    }
    if (filters?.eventType) {
      conditions.push(sql`${complianceCalendarEvents.eventType} = ${filters.eventType}`);
    }
    if (filters?.complianceStreamId) {
      conditions.push(eq(complianceCalendarEvents.complianceStreamId, filters.complianceStreamId));
    }
    
    return db.select().from(complianceCalendarEvents)
      .where(and(...conditions))
      .orderBy(complianceCalendarEvents.startDate);
  }
  
  async getCalendarEvent(id: string): Promise<ComplianceCalendarEvent | undefined> {
    const [event] = await db.select().from(complianceCalendarEvents).where(eq(complianceCalendarEvents.id, id));
    return event || undefined;
  }
  
  async createCalendarEvent(event: InsertComplianceCalendarEvent): Promise<ComplianceCalendarEvent> {
    const [newEvent] = await db.insert(complianceCalendarEvents).values(event).returning();
    return newEvent;
  }
  
  async updateCalendarEvent(id: string, updates: Partial<InsertComplianceCalendarEvent>): Promise<ComplianceCalendarEvent | undefined> {
    const [updated] = await db.update(complianceCalendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceCalendarEvents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCalendarEvent(id: string): Promise<boolean> {
    const result = await db.delete(complianceCalendarEvents).where(eq(complianceCalendarEvents.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getUpcomingEvents(organisationId: string, daysAhead: number): Promise<ComplianceCalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return db.select().from(complianceCalendarEvents)
      .where(
        and(
          eq(complianceCalendarEvents.organisationId, organisationId),
          gte(complianceCalendarEvents.startDate, now),
          lte(complianceCalendarEvents.startDate, futureDate)
        )
      )
      .orderBy(complianceCalendarEvents.startDate);
  }
  
  async listDetectionPatterns(filters?: { certificateTypeCode?: string; patternType?: string; isActive?: boolean }): Promise<DetectionPattern[]> {
    const conditions: any[] = [];
    
    if (filters?.certificateTypeCode) {
      conditions.push(eq(certificateDetectionPatterns.certificateTypeCode, filters.certificateTypeCode));
    }
    if (filters?.patternType) {
      conditions.push(eq(certificateDetectionPatterns.patternType, filters.patternType as any));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(certificateDetectionPatterns.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      return db.select()
        .from(certificateDetectionPatterns)
        .where(and(...conditions))
        .orderBy(desc(certificateDetectionPatterns.priority));
    }
    
    return db.select()
      .from(certificateDetectionPatterns)
      .orderBy(desc(certificateDetectionPatterns.priority));
  }
  
  async getDetectionPattern(id: string): Promise<DetectionPattern | undefined> {
    const [pattern] = await db.select()
      .from(certificateDetectionPatterns)
      .where(eq(certificateDetectionPatterns.id, id));
    return pattern || undefined;
  }
  
  async createDetectionPattern(pattern: InsertDetectionPattern): Promise<DetectionPattern> {
    const [created] = await db.insert(certificateDetectionPatterns).values(pattern).returning();
    return created;
  }
  
  async updateDetectionPattern(id: string, updates: Partial<InsertDetectionPattern>): Promise<DetectionPattern | undefined> {
    const [updated] = await db.update(certificateDetectionPatterns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateDetectionPatterns.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteDetectionPattern(id: string): Promise<boolean> {
    const result = await db.delete(certificateDetectionPatterns)
      .where(and(eq(certificateDetectionPatterns.id, id), eq(certificateDetectionPatterns.isSystem, false)))
      .returning();
    return result.length > 0;
  }
  
  async listOutcomeRules(filters?: { certificateTypeCode?: string; ruleGroup?: string; isActive?: boolean }): Promise<OutcomeRule[]> {
    const conditions: any[] = [];
    
    if (filters?.certificateTypeCode) {
      conditions.push(eq(certificateOutcomeRules.certificateTypeCode, filters.certificateTypeCode));
    }
    if (filters?.ruleGroup) {
      conditions.push(eq(certificateOutcomeRules.ruleGroup, filters.ruleGroup));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(certificateOutcomeRules.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      return db.select()
        .from(certificateOutcomeRules)
        .where(and(...conditions))
        .orderBy(desc(certificateOutcomeRules.priority));
    }
    
    return db.select()
      .from(certificateOutcomeRules)
      .orderBy(desc(certificateOutcomeRules.priority));
  }
  
  async getOutcomeRule(id: string): Promise<OutcomeRule | undefined> {
    const [rule] = await db.select()
      .from(certificateOutcomeRules)
      .where(eq(certificateOutcomeRules.id, id));
    return rule || undefined;
  }
  
  async createOutcomeRule(rule: InsertOutcomeRule): Promise<OutcomeRule> {
    const [created] = await db.insert(certificateOutcomeRules).values(rule).returning();
    return created;
  }
  
  async updateOutcomeRule(id: string, updates: Partial<InsertOutcomeRule>): Promise<OutcomeRule | undefined> {
    const [updated] = await db.update(certificateOutcomeRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateOutcomeRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteOutcomeRule(id: string): Promise<boolean> {
    const result = await db.delete(certificateOutcomeRules)
      .where(and(eq(certificateOutcomeRules.id, id), eq(certificateOutcomeRules.isSystem, false)))
      .returning();
    return result.length > 0;
  }
  
  async listGasApplianceRecords(certificateId: string): Promise<GasApplianceRecord[]> {
    return db.select().from(gasApplianceRecords).where(eq(gasApplianceRecords.certificateId, certificateId));
  }

  async createGasApplianceRecord(record: InsertGasApplianceRecord): Promise<GasApplianceRecord> {
    const [created] = await db.insert(gasApplianceRecords).values(record).returning();
    return created;
  }

  async bulkCreateGasApplianceRecords(records: InsertGasApplianceRecord[]): Promise<GasApplianceRecord[]> {
    if (records.length === 0) return [];
    return db.insert(gasApplianceRecords).values(records).returning();
  }

  async listElectricalCircuitRecords(certificateId: string): Promise<ElectricalCircuitRecord[]> {
    return db.select().from(electricalCircuitRecords).where(eq(electricalCircuitRecords.certificateId, certificateId));
  }

  async createElectricalCircuitRecord(record: InsertElectricalCircuitRecord): Promise<ElectricalCircuitRecord> {
    const [created] = await db.insert(electricalCircuitRecords).values(record).returning();
    return created;
  }

  async bulkCreateElectricalCircuitRecords(records: InsertElectricalCircuitRecord[]): Promise<ElectricalCircuitRecord[]> {
    if (records.length === 0) return [];
    return db.insert(electricalCircuitRecords).values(records).returning();
  }

  async listFireSystemRecords(certificateId: string): Promise<FireSystemRecord[]> {
    return db.select().from(fireSystemRecords).where(eq(fireSystemRecords.certificateId, certificateId));
  }

  async createFireSystemRecord(record: InsertFireSystemRecord): Promise<FireSystemRecord> {
    const [created] = await db.insert(fireSystemRecords).values(record).returning();
    return created;
  }

  async bulkCreateFireSystemRecords(records: InsertFireSystemRecord[]): Promise<FireSystemRecord[]> {
    if (records.length === 0) return [];
    return db.insert(fireSystemRecords).values(records).returning();
  }

  async listAsbestosSurveyRecords(certificateId: string): Promise<AsbestosSurveyRecord[]> {
    return db.select().from(asbestosSurveyRecords).where(eq(asbestosSurveyRecords.certificateId, certificateId));
  }

  async createAsbestosSurveyRecord(record: InsertAsbestosSurveyRecord): Promise<AsbestosSurveyRecord> {
    const [created] = await db.insert(asbestosSurveyRecords).values(record).returning();
    return created;
  }

  async bulkCreateAsbestosSurveyRecords(records: InsertAsbestosSurveyRecord[]): Promise<AsbestosSurveyRecord[]> {
    if (records.length === 0) return [];
    return db.insert(asbestosSurveyRecords).values(records).returning();
  }

  async listWaterTemperatureRecords(filters?: { propertyId?: string; blockId?: string; certificateId?: string }): Promise<WaterTemperatureRecord[]> {
    const conditions: any[] = [];
    if (filters?.propertyId) conditions.push(eq(waterTemperatureRecords.propertyId, filters.propertyId));
    if (filters?.blockId) conditions.push(eq(waterTemperatureRecords.blockId, filters.blockId));
    if (filters?.certificateId) conditions.push(eq(waterTemperatureRecords.certificateId, filters.certificateId));
    
    if (conditions.length > 0) {
      return db.select().from(waterTemperatureRecords).where(and(...conditions));
    }
    return db.select().from(waterTemperatureRecords);
  }

  async createWaterTemperatureRecord(record: InsertWaterTemperatureRecord): Promise<WaterTemperatureRecord> {
    const [created] = await db.insert(waterTemperatureRecords).values(record).returning();
    return created;
  }

  async bulkCreateWaterTemperatureRecords(records: InsertWaterTemperatureRecord[]): Promise<WaterTemperatureRecord[]> {
    if (records.length === 0) return [];
    return db.insert(waterTemperatureRecords).values(records).returning();
  }
}

export const certificatesStorage = new CertificatesStorage();
