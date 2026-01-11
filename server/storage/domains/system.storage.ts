import { 
  factorySettings, factorySettingsAudit, systemLogs, auditEvents,
  navigationSections, navigationItems, iconRegistry, navigationItemRoles,
  hazardCases, hazardActions, tenantCommunications,
  households, tenants, serviceRequests, tsmMeasures, tsmSnapshots,
  buildingSafetyProfiles, safetyCaseReviews, mandatoryOccurrenceReports
} from "@shared/schema";
import type { 
  FactorySetting, InsertFactorySetting,
  FactorySettingsAudit, InsertFactorySettingsAudit,
  SystemLog,
  AuditEvent, InsertAuditEvent,
  NavigationSection, InsertNavigationSection,
  NavigationItem, InsertNavigationItem,
  IconRegistry, InsertIconRegistry,
  HazardCase, InsertHazardCase,
  HazardAction, InsertHazardAction,
  TenantCommunication, InsertTenantCommunication,
  Household, InsertHousehold,
  Tenant, InsertTenant,
  ServiceRequest, InsertServiceRequest,
  TsmMeasure, InsertTsmMeasure,
  TsmSnapshot, InsertTsmSnapshot,
  BuildingSafetyProfile, InsertBuildingSafetyProfile,
  SafetyCaseReview, InsertSafetyCaseReview,
  MandatoryOccurrenceReport, InsertMandatoryOccurrenceReport
} from "@shared/schema";
import { db, eq, and, or, desc, sql, count, gte, lte, ilike } from "../base";
import type { ISystemStorage } from "../interfaces";

export class SystemStorage implements ISystemStorage {
  async listFactorySettings(): Promise<FactorySetting[]> {
    return db.select().from(factorySettings).orderBy(factorySettings.category, factorySettings.key);
  }
  
  async getFactorySetting(key: string): Promise<FactorySetting | undefined> {
    const [setting] = await db.select().from(factorySettings).where(eq(factorySettings.key, key));
    return setting || undefined;
  }
  
  async getFactorySettingValue(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await this.getFactorySetting(key);
    return setting?.value ?? defaultValue;
  }
  
  async createFactorySetting(setting: InsertFactorySetting): Promise<FactorySetting> {
    const [created] = await db.insert(factorySettings).values(setting).returning();
    return created;
  }
  
  async updateFactorySetting(key: string, value: string, updatedById: string): Promise<FactorySetting | undefined> {
    const [updated] = await db.update(factorySettings)
      .set({ value, updatedById, updatedAt: new Date() })
      .where(eq(factorySettings.key, key))
      .returning();
    return updated || undefined;
  }
  
  async createFactorySettingsAudit(audit: InsertFactorySettingsAudit): Promise<FactorySettingsAudit> {
    const [created] = await db.insert(factorySettingsAudit).values(audit).returning();
    return created;
  }
  
  async getSystemLogs(filters: { level?: string; source?: string; search?: string; limit: number; offset: number }): Promise<{ logs: SystemLog[]; total: number }> {
    const conditions: any[] = [];
    
    if (filters.level) {
      conditions.push(eq(systemLogs.level, filters.level as any));
    }
    if (filters.source) {
      conditions.push(eq(systemLogs.source, filters.source as typeof systemLogs.source.enumValues[number]));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(or(
        ilike(systemLogs.message, searchPattern),
        ilike(systemLogs.source, searchPattern)
      ));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db.select({ count: count() }).from(systemLogs).where(whereClause);
    const total = countResult?.count || 0;
    
    const logs = await db.select()
      .from(systemLogs)
      .where(whereClause)
      .orderBy(desc(systemLogs.timestamp))
      .limit(filters.limit)
      .offset(filters.offset);
    
    return { logs, total };
  }
  
  async recordAuditEvent(event: InsertAuditEvent): Promise<AuditEvent> {
    const [created] = await db.insert(auditEvents).values(event).returning();
    return created;
  }
  
  async listAuditEvents(organisationId: string, filters?: { 
    entityType?: string; 
    entityId?: string; 
    eventType?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const conditions = [eq(auditEvents.organisationId, organisationId)];
    
    if (filters?.entityType) {
      conditions.push(eq(auditEvents.entityType, filters.entityType as any));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditEvents.entityId, filters.entityId));
    }
    if (filters?.eventType) {
      conditions.push(eq(auditEvents.eventType, filters.eventType as any));
    }
    if (filters?.actorId) {
      conditions.push(eq(auditEvents.actorId, filters.actorId));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditEvents.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditEvents.createdAt, filters.endDate));
    }
    
    const [countResult] = await db.select({ count: count() }).from(auditEvents).where(and(...conditions));
    const total = countResult?.count || 0;
    
    let query = db.select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    const events = await query;
    return { events, total };
  }
  
  async getEntityAuditHistory(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.entityType, entityType as any),
        eq(auditEvents.entityId, entityId)
      ))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);
  }
  
  async getEntityAuditHistoryForOrg(entityType: string, entityId: string, organisationId: string): Promise<AuditEvent[]> {
    return db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.entityType, entityType as any),
        eq(auditEvents.entityId, entityId),
        eq(auditEvents.organisationId, organisationId)
      ))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);
  }
  
  async listNavigationSections(organisationId?: string): Promise<NavigationSection[]> {
    if (organisationId) {
      return db.select()
        .from(navigationSections)
        .where(eq(navigationSections.organisationId, organisationId))
        .orderBy(navigationSections.displayOrder);
    }
    return db.select()
      .from(navigationSections)
      .where(eq(navigationSections.isActive, true))
      .orderBy(navigationSections.displayOrder);
  }

  async getNavigationSection(id: string): Promise<NavigationSection | undefined> {
    const [section] = await db.select()
      .from(navigationSections)
      .where(eq(navigationSections.id, id));
    return section || undefined;
  }

  async createNavigationSection(section: InsertNavigationSection): Promise<NavigationSection> {
    const [created] = await db.insert(navigationSections).values(section).returning();
    return created;
  }

  async updateNavigationSection(id: string, updates: Partial<InsertNavigationSection>): Promise<NavigationSection | undefined> {
    const [updated] = await db.update(navigationSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigationSections.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNavigationSection(id: string): Promise<boolean> {
    const result = await db.delete(navigationSections)
      .where(and(eq(navigationSections.id, id), eq(navigationSections.isSystem, false)))
      .returning();
    return result.length > 0;
  }

  async listNavigationItems(sectionId?: string): Promise<NavigationItem[]> {
    if (sectionId) {
      return db.select()
        .from(navigationItems)
        .where(eq(navigationItems.sectionId, sectionId))
        .orderBy(navigationItems.displayOrder);
    }
    return db.select()
      .from(navigationItems)
      .where(eq(navigationItems.isActive, true))
      .orderBy(navigationItems.displayOrder);
  }

  async getNavigationItem(id: string): Promise<NavigationItem | undefined> {
    const [item] = await db.select()
      .from(navigationItems)
      .where(eq(navigationItems.id, id));
    return item || undefined;
  }

  async createNavigationItem(item: InsertNavigationItem): Promise<NavigationItem> {
    const [created] = await db.insert(navigationItems).values(item).returning();
    return created;
  }

  async updateNavigationItem(id: string, updates: Partial<InsertNavigationItem>): Promise<NavigationItem | undefined> {
    const [updated] = await db.update(navigationItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigationItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNavigationItem(id: string): Promise<boolean> {
    const result = await db.delete(navigationItems)
      .where(and(eq(navigationItems.id, id), eq(navigationItems.isSystem, false)))
      .returning();
    return result.length > 0;
  }

  async getNavigationWithItems(organisationId?: string): Promise<Array<NavigationSection & { items: NavigationItem[] }>> {
    const sections = await this.listNavigationSections(organisationId);
    const allItems = await this.listNavigationItems();
    
    return sections.map(section => ({
      ...section,
      items: allItems.filter(item => item.sectionId === section.id)
    }));
  }

  async listNavigationItemsWithRoles(sectionId?: string): Promise<Array<NavigationItem & { roles: string[] }>> {
    const items = await this.listNavigationItems(sectionId);
    const allRoles = await db.select().from(navigationItemRoles);
    
    return items.map(item => ({
      ...item,
      roles: allRoles.filter(r => r.navigationItemId === item.id).map(r => r.role)
    }));
  }

  async getNavigationItemRoles(itemId: string): Promise<string[]> {
    const roles = await db.select()
      .from(navigationItemRoles)
      .where(eq(navigationItemRoles.navigationItemId, itemId));
    return roles.map(r => r.role);
  }

  async setNavigationItemRoles(itemId: string, roles: string[]): Promise<void> {
    await db.delete(navigationItemRoles)
      .where(eq(navigationItemRoles.navigationItemId, itemId));
    
    if (roles.length > 0) {
      await db.insert(navigationItemRoles).values(
        roles.map(role => ({ navigationItemId: itemId, role }))
      );
    }
  }

  async listIconRegistry(): Promise<IconRegistry[]> {
    return db.select()
      .from(iconRegistry)
      .where(eq(iconRegistry.isActive, true))
      .orderBy(iconRegistry.iconKey);
  }

  async createIconRegistryEntry(entry: InsertIconRegistry): Promise<IconRegistry> {
    const [created] = await db.insert(iconRegistry).values(entry).returning();
    return created;
  }

  async listHazardCases(organisationId: string, filters?: { status?: string; severity?: string; propertyId?: string }): Promise<HazardCase[]> {
    const conditions = [eq(hazardCases.organisationId, organisationId)];
    if (filters?.status) conditions.push(eq(hazardCases.status, filters.status as any));
    if (filters?.severity) conditions.push(eq(hazardCases.severity, filters.severity as any));
    if (filters?.propertyId) conditions.push(eq(hazardCases.propertyId, filters.propertyId));
    return db.select().from(hazardCases).where(and(...conditions)).orderBy(desc(hazardCases.reportedAt));
  }

  async getHazardCase(id: string, organisationId?: string): Promise<HazardCase | undefined> {
    const conditions = [eq(hazardCases.id, id)];
    if (organisationId) conditions.push(eq(hazardCases.organisationId, organisationId));
    const [hazard] = await db.select().from(hazardCases).where(and(...conditions));
    return hazard || undefined;
  }

  async createHazardCase(hazard: InsertHazardCase): Promise<HazardCase> {
    const [created] = await db.insert(hazardCases).values(hazard).returning();
    return created;
  }

  async updateHazardCase(id: string, updates: Partial<InsertHazardCase>): Promise<HazardCase | undefined> {
    const [updated] = await db.update(hazardCases).set({ ...updates, updatedAt: new Date() }).where(eq(hazardCases.id, id)).returning();
    return updated || undefined;
  }

  async listHazardActions(hazardCaseId: string): Promise<HazardAction[]> {
    return db.select().from(hazardActions).where(eq(hazardActions.hazardCaseId, hazardCaseId));
  }

  async createHazardAction(action: InsertHazardAction): Promise<HazardAction> {
    const [created] = await db.insert(hazardActions).values(action).returning();
    return created;
  }

  async updateHazardAction(id: string, updates: Partial<InsertHazardAction>): Promise<HazardAction | undefined> {
    const [updated] = await db.update(hazardActions).set({ ...updates, updatedAt: new Date() }).where(eq(hazardActions.id, id)).returning();
    return updated || undefined;
  }

  async listTenantCommunications(filters?: { hazardCaseId?: string; propertyId?: string }): Promise<TenantCommunication[]> {
    const conditions = [];
    if (filters?.hazardCaseId) conditions.push(eq(tenantCommunications.hazardCaseId, filters.hazardCaseId));
    if (filters?.propertyId) conditions.push(eq(tenantCommunications.propertyId, filters.propertyId));
    return db.select().from(tenantCommunications).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(tenantCommunications.createdAt));
  }

  async createTenantCommunication(comm: InsertTenantCommunication): Promise<TenantCommunication> {
    const [created] = await db.insert(tenantCommunications).values(comm).returning();
    return created;
  }

  async listHouseholds(organisationId: string, filters?: { propertyId?: string; isActive?: boolean }): Promise<Household[]> {
    const conditions = [eq(households.organisationId, organisationId)];
    if (filters?.propertyId) conditions.push(eq(households.propertyId, filters.propertyId));
    if (filters?.isActive !== undefined) conditions.push(eq(households.isActive, filters.isActive));
    return db.select().from(households).where(and(...conditions));
  }

  async getHousehold(id: string, organisationId?: string): Promise<Household | undefined> {
    const conditions = [eq(households.id, id)];
    if (organisationId) conditions.push(eq(households.organisationId, organisationId));
    const [h] = await db.select().from(households).where(and(...conditions));
    return h || undefined;
  }

  async createHousehold(household: InsertHousehold): Promise<Household> {
    const [created] = await db.insert(households).values(household).returning();
    return created;
  }

  async updateHousehold(id: string, updates: Partial<InsertHousehold>): Promise<Household | undefined> {
    const [updated] = await db.update(households).set({ ...updates, updatedAt: new Date() }).where(eq(households.id, id)).returning();
    return updated || undefined;
  }

  async listTenants(organisationId: string, filters?: { householdId?: string }): Promise<Tenant[]> {
    const conditions = [eq(tenants.organisationId, organisationId)];
    if (filters?.householdId) conditions.push(eq(tenants.householdId, filters.householdId));
    return db.select().from(tenants).where(and(...conditions));
  }

  async getTenant(id: string, organisationId?: string): Promise<Tenant | undefined> {
    const conditions = [eq(tenants.id, id)];
    if (organisationId) conditions.push(eq(tenants.organisationId, organisationId));
    const [t] = await db.select().from(tenants).where(and(...conditions));
    return t || undefined;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set({ ...updates, updatedAt: new Date() }).where(eq(tenants.id, id)).returning();
    return updated || undefined;
  }

  async listServiceRequests(organisationId: string, filters?: { propertyId?: string; status?: string; type?: string }): Promise<ServiceRequest[]> {
    const conditions = [eq(serviceRequests.organisationId, organisationId)];
    if (filters?.propertyId) conditions.push(eq(serviceRequests.propertyId, filters.propertyId));
    if (filters?.status) conditions.push(eq(serviceRequests.status, filters.status as any));
    if (filters?.type) conditions.push(eq(serviceRequests.requestType, filters.type as any));
    return db.select().from(serviceRequests).where(and(...conditions)).orderBy(desc(serviceRequests.reportedAt));
  }

  async getServiceRequest(id: string, organisationId?: string): Promise<ServiceRequest | undefined> {
    const conditions = [eq(serviceRequests.id, id)];
    if (organisationId) conditions.push(eq(serviceRequests.organisationId, organisationId));
    const [sr] = await db.select().from(serviceRequests).where(and(...conditions));
    return sr || undefined;
  }

  async createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest> {
    const [created] = await db.insert(serviceRequests).values(request).returning();
    return created;
  }

  async updateServiceRequest(id: string, updates: Partial<InsertServiceRequest>): Promise<ServiceRequest | undefined> {
    const [updated] = await db.update(serviceRequests).set({ ...updates, updatedAt: new Date() }).where(eq(serviceRequests.id, id)).returning();
    return updated || undefined;
  }

  async listTsmMeasures(): Promise<TsmMeasure[]> {
    return db.select().from(tsmMeasures);
  }

  async getTsmMeasure(id: string): Promise<TsmMeasure | undefined> {
    const [m] = await db.select().from(tsmMeasures).where(eq(tsmMeasures.id, id));
    return m || undefined;
  }

  async createTsmMeasure(measure: InsertTsmMeasure): Promise<TsmMeasure> {
    const [created] = await db.insert(tsmMeasures).values(measure).returning();
    return created;
  }

  async listTsmSnapshots(organisationId: string, filters?: { measureCode?: string; periodStart?: Date }): Promise<TsmSnapshot[]> {
    const conditions = [eq(tsmSnapshots.organisationId, organisationId)];
    if (filters?.measureCode) conditions.push(eq(tsmSnapshots.measureCode, filters.measureCode));
    if (filters?.periodStart) conditions.push(gte(tsmSnapshots.periodStart, filters.periodStart.toISOString().split('T')[0]));
    return db.select().from(tsmSnapshots).where(and(...conditions)).orderBy(desc(tsmSnapshots.periodEnd));
  }

  async createTsmSnapshot(snapshot: InsertTsmSnapshot): Promise<TsmSnapshot> {
    const [created] = await db.insert(tsmSnapshots).values(snapshot).returning();
    return created;
  }

  async listBuildingSafetyProfiles(organisationId: string, filters?: { isHrb?: boolean }): Promise<BuildingSafetyProfile[]> {
    const conditions = [eq(buildingSafetyProfiles.organisationId, organisationId)];
    if (filters?.isHrb !== undefined) conditions.push(eq(buildingSafetyProfiles.isHRB, filters.isHrb));
    return db.select().from(buildingSafetyProfiles).where(and(...conditions));
  }

  async getBuildingSafetyProfile(id: string, organisationId?: string): Promise<BuildingSafetyProfile | undefined> {
    const conditions = [eq(buildingSafetyProfiles.id, id)];
    if (organisationId) conditions.push(eq(buildingSafetyProfiles.organisationId, organisationId));
    const [p] = await db.select().from(buildingSafetyProfiles).where(and(...conditions));
    return p || undefined;
  }

  async getBuildingSafetyProfileByBlockId(blockId: string): Promise<BuildingSafetyProfile | undefined> {
    const [p] = await db.select().from(buildingSafetyProfiles).where(eq(buildingSafetyProfiles.blockId, blockId));
    return p || undefined;
  }

  async createBuildingSafetyProfile(profile: InsertBuildingSafetyProfile): Promise<BuildingSafetyProfile> {
    const [created] = await db.insert(buildingSafetyProfiles).values(profile).returning();
    return created;
  }

  async updateBuildingSafetyProfile(id: string, updates: Partial<InsertBuildingSafetyProfile>): Promise<BuildingSafetyProfile | undefined> {
    const [updated] = await db.update(buildingSafetyProfiles).set({ ...updates, updatedAt: new Date() }).where(eq(buildingSafetyProfiles.id, id)).returning();
    return updated || undefined;
  }

  async listSafetyCaseReviews(profileId: string): Promise<SafetyCaseReview[]> {
    return db.select().from(safetyCaseReviews).where(eq(safetyCaseReviews.buildingSafetyProfileId, profileId)).orderBy(desc(safetyCaseReviews.reviewDate));
  }

  async createSafetyCaseReview(review: InsertSafetyCaseReview): Promise<SafetyCaseReview> {
    const [created] = await db.insert(safetyCaseReviews).values(review).returning();
    return created;
  }

  async listMandatoryOccurrenceReports(organisationId: string): Promise<MandatoryOccurrenceReport[]> {
    return db.select().from(mandatoryOccurrenceReports).where(eq(mandatoryOccurrenceReports.organisationId, organisationId)).orderBy(desc(mandatoryOccurrenceReports.occurrenceDate));
  }

  async getMandatoryOccurrenceReport(id: string, organisationId?: string): Promise<MandatoryOccurrenceReport | undefined> {
    const conditions = [eq(mandatoryOccurrenceReports.id, id)];
    if (organisationId) conditions.push(eq(mandatoryOccurrenceReports.organisationId, organisationId));
    const [r] = await db.select().from(mandatoryOccurrenceReports).where(and(...conditions));
    return r || undefined;
  }

  async createMandatoryOccurrenceReport(report: InsertMandatoryOccurrenceReport): Promise<MandatoryOccurrenceReport> {
    const [created] = await db.insert(mandatoryOccurrenceReports).values(report).returning();
    return created;
  }

  async updateMandatoryOccurrenceReport(id: string, updates: Partial<InsertMandatoryOccurrenceReport>): Promise<MandatoryOccurrenceReport | undefined> {
    const [updated] = await db.update(mandatoryOccurrenceReports).set({ ...updates, updatedAt: new Date() }).where(eq(mandatoryOccurrenceReports.id, id)).returning();
    return updated || undefined;
  }
}

export const systemStorage = new SystemStorage();
