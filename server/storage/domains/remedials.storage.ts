import { remedialActions, properties, blocks, schemes, certificates } from "@shared/schema";
import type { RemedialAction, InsertRemedialAction } from "@shared/schema";
import { db, eq, and, or, desc, sql, count, gte, lte, ilike, isNotNull } from "../base";
import type { IRemedialsStorage } from "../interfaces";

export class RemedialsStorage implements IRemedialsStorage {
  async listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]> {
    const conditions = [eq(remedialActions.organisationId, organisationId)];
    if (filters?.propertyId) {
      conditions.push(eq(remedialActions.propertyId, filters.propertyId));
    }
    if (filters?.status) {
      conditions.push(eq(remedialActions.status, filters.status as any));
    }
    if (filters?.certificateId) {
      conditions.push(eq(remedialActions.certificateId, filters.certificateId));
    }
    return db.select().from(remedialActions).where(and(...conditions)).orderBy(desc(remedialActions.createdAt));
  }
  
  async listRemedialActionsPaginated(organisationId: string, options: {
    limit: number;
    offset: number;
    status?: string;
    severity?: string;
    search?: string;
    overdue?: boolean;
    propertyId?: string;
    awaabs?: boolean;
    phase?: number;
    certificateType?: string;
    excludeCompleted?: boolean;
  }): Promise<{ items: RemedialAction[]; total: number }> {
    const conditions: any[] = [eq(remedialActions.organisationId, organisationId)];
    
    if (options.status) {
      conditions.push(eq(remedialActions.status, options.status as any));
    }
    if (options.severity) {
      conditions.push(eq(remedialActions.severity, options.severity as any));
    }
    if (options.propertyId) {
      conditions.push(eq(remedialActions.propertyId, options.propertyId));
    }
    if (options.awaabs) {
      conditions.push(eq(remedialActions.awaabsLaw, true));
    }
    if (options.phase !== undefined) {
      conditions.push(eq(remedialActions.awaabsPhase, options.phase));
    }
    if (options.certificateType) {
      conditions.push(eq(remedialActions.certificateType, options.certificateType));
    }
    if (options.excludeCompleted) {
      conditions.push(sql`${remedialActions.status} != 'COMPLETED'`);
    }
    if (options.overdue) {
      conditions.push(sql`${remedialActions.dueDate} < NOW() AND ${remedialActions.status} != 'COMPLETED'`);
    }
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(or(
        ilike(remedialActions.description, searchPattern),
        ilike(remedialActions.title, searchPattern)
      ));
    }
    
    const [countResult] = await db.select({ count: count() }).from(remedialActions).where(and(...conditions));
    const total = countResult?.count || 0;
    
    const items = await db.select()
      .from(remedialActions)
      .where(and(...conditions))
      .orderBy(desc(remedialActions.createdAt))
      .limit(options.limit)
      .offset(options.offset);
    
    return { items, total };
  }
  
  async getRemedialAction(id: string): Promise<RemedialAction | undefined> {
    const [action] = await db.select().from(remedialActions).where(eq(remedialActions.id, id));
    return action || undefined;
  }
  
  async createRemedialAction(action: InsertRemedialAction): Promise<RemedialAction> {
    const [newAction] = await db.insert(remedialActions).values(action).returning();
    return newAction;
  }
  
  async updateRemedialAction(id: string, updates: Partial<InsertRemedialAction>): Promise<RemedialAction | undefined> {
    const [updated] = await db.update(remedialActions).set({ ...updates, updatedAt: new Date() }).where(eq(remedialActions.id, id)).returning();
    return updated || undefined;
  }
}

export const remedialsStorage = new RemedialsStorage();
