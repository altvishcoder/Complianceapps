import { 
  componentTypes, spaces, components, componentCertificates, 
  dataImports, dataImportRows 
} from "@shared/schema";
import type { 
  ComponentType, InsertComponentType,
  Space, InsertSpace,
  Component, InsertComponent,
  ComponentCertificate, InsertComponentCertificate,
  DataImport, InsertDataImport,
  DataImportRow, InsertDataImportRow
} from "@shared/schema";
import { db, eq, and, desc } from "../base";
import type { IComponentsStorage } from "../interfaces";

export class ComponentsStorage implements IComponentsStorage {
  async listComponentTypes(): Promise<ComponentType[]> {
    return db.select().from(componentTypes).orderBy(componentTypes.name);
  }
  
  async getComponentType(id: string): Promise<ComponentType | undefined> {
    const [type] = await db.select().from(componentTypes).where(eq(componentTypes.id, id));
    return type || undefined;
  }
  
  async createComponentType(componentType: InsertComponentType): Promise<ComponentType> {
    const [created] = await db.insert(componentTypes).values(componentType).returning();
    return created;
  }
  
  async updateComponentType(id: string, updates: Partial<InsertComponentType>): Promise<ComponentType | undefined> {
    const [updated] = await db.update(componentTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(componentTypes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComponentType(id: string): Promise<boolean> {
    const result = await db.delete(componentTypes).where(eq(componentTypes.id, id)).returning();
    return result.length > 0;
  }
  
  async listSpaces(filters?: { propertyId?: string; blockId?: string; schemeId?: string }): Promise<Space[]> {
    const conditions: any[] = [];
    if (filters?.propertyId) conditions.push(eq(spaces.propertyId, filters.propertyId));
    if (filters?.blockId) conditions.push(eq(spaces.blockId, filters.blockId));
    if (filters?.schemeId) conditions.push(eq(spaces.schemeId, filters.schemeId));
    
    if (conditions.length > 0) {
      return db.select().from(spaces).where(and(...conditions)).orderBy(desc(spaces.createdAt));
    }
    return db.select().from(spaces).orderBy(desc(spaces.createdAt));
  }
  
  async getSpace(id: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
    return space || undefined;
  }
  
  async createSpace(space: InsertSpace): Promise<Space> {
    const attachments = [space.propertyId, space.blockId, space.schemeId].filter(Boolean);
    if (attachments.length !== 1) {
      throw new Error('Space must attach to exactly one level: propertyId (dwelling), blockId (communal), or schemeId (estate)');
    }
    const [created] = await db.insert(spaces).values(space).returning();
    return created;
  }
  
  async updateSpace(id: string, updates: Partial<InsertSpace>): Promise<Space | undefined> {
    if (updates.propertyId !== undefined || updates.blockId !== undefined || updates.schemeId !== undefined) {
      const current = await this.getSpace(id);
      if (!current) return undefined;
      
      const mergedPropertyId = 'propertyId' in updates ? updates.propertyId : current.propertyId;
      const mergedBlockId = 'blockId' in updates ? updates.blockId : current.blockId;
      const mergedSchemeId = 'schemeId' in updates ? updates.schemeId : current.schemeId;
      
      const attachments = [mergedPropertyId, mergedBlockId, mergedSchemeId].filter(Boolean);
      if (attachments.length !== 1) {
        throw new Error('Space must attach to exactly one level: propertyId (dwelling), blockId (communal), or schemeId (estate)');
      }
    }
    
    const [updated] = await db.update(spaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(spaces.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteSpace(id: string): Promise<boolean> {
    const result = await db.delete(spaces).where(eq(spaces.id, id)).returning();
    return result.length > 0;
  }
  
  async listComponents(filters?: { propertyId?: string; spaceId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]> {
    const conditions = [];
    if (filters?.propertyId) conditions.push(eq(components.propertyId, filters.propertyId));
    if (filters?.spaceId) conditions.push(eq(components.spaceId, filters.spaceId));
    if (filters?.blockId) conditions.push(eq(components.blockId, filters.blockId));
    if (filters?.componentTypeId) conditions.push(eq(components.componentTypeId, filters.componentTypeId));
    
    if (conditions.length > 0) {
      return db.select().from(components).where(and(...conditions)).orderBy(desc(components.createdAt));
    }
    return db.select().from(components).orderBy(desc(components.createdAt));
  }
  
  async getComponent(id: string): Promise<Component | undefined> {
    const [component] = await db.select().from(components).where(eq(components.id, id));
    return component || undefined;
  }
  
  async createComponent(component: InsertComponent): Promise<Component> {
    const [created] = await db.insert(components).values(component).returning();
    return created;
  }
  
  async updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component | undefined> {
    const [updated] = await db.update(components)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(components.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComponent(id: string): Promise<boolean> {
    const result = await db.delete(components).where(eq(components.id, id)).returning();
    return result.length > 0;
  }
  
  async bulkCreateComponents(componentList: InsertComponent[]): Promise<Component[]> {
    if (componentList.length === 0) return [];
    return db.insert(components).values(componentList).returning();
  }
  
  async listComponentCertificates(componentId?: string, certificateId?: string): Promise<ComponentCertificate[]> {
    const conditions = [];
    if (componentId) conditions.push(eq(componentCertificates.componentId, componentId));
    if (certificateId) conditions.push(eq(componentCertificates.certificateId, certificateId));
    
    if (conditions.length > 0) {
      return db.select().from(componentCertificates).where(and(...conditions));
    }
    return db.select().from(componentCertificates);
  }
  
  async createComponentCertificate(link: InsertComponentCertificate): Promise<ComponentCertificate> {
    const [created] = await db.insert(componentCertificates).values(link).returning();
    return created;
  }
  
  async deleteComponentCertificate(id: string): Promise<boolean> {
    const result = await db.delete(componentCertificates).where(eq(componentCertificates.id, id)).returning();
    return result.length > 0;
  }
  
  async listDataImports(organisationId: string): Promise<DataImport[]> {
    return db.select().from(dataImports)
      .where(eq(dataImports.organisationId, organisationId))
      .orderBy(desc(dataImports.createdAt));
  }
  
  async getDataImport(id: string): Promise<DataImport | undefined> {
    const [dataImport] = await db.select().from(dataImports).where(eq(dataImports.id, id));
    return dataImport || undefined;
  }
  
  async createDataImport(dataImport: InsertDataImport): Promise<DataImport> {
    const [created] = await db.insert(dataImports).values(dataImport).returning();
    return created;
  }
  
  async updateDataImport(id: string, updates: Partial<InsertDataImport>): Promise<DataImport | undefined> {
    const [updated] = await db.update(dataImports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataImports.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteDataImport(id: string): Promise<boolean> {
    const result = await db.delete(dataImports).where(eq(dataImports.id, id)).returning();
    return result.length > 0;
  }
  
  async listDataImportRows(importId: string): Promise<DataImportRow[]> {
    return db.select().from(dataImportRows)
      .where(eq(dataImportRows.importId, importId))
      .orderBy(dataImportRows.rowNumber);
  }
  
  async createDataImportRow(row: InsertDataImportRow): Promise<DataImportRow> {
    const [created] = await db.insert(dataImportRows).values(row).returning();
    return created;
  }
  
  async bulkCreateDataImportRows(rows: InsertDataImportRow[]): Promise<DataImportRow[]> {
    if (rows.length === 0) return [];
    return db.insert(dataImportRows).values(rows).returning();
  }
  
  async updateDataImportRow(id: string, updates: Partial<InsertDataImportRow>): Promise<DataImportRow | undefined> {
    const [updated] = await db.update(dataImportRows)
      .set(updates)
      .where(eq(dataImportRows.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getDataImportRowCounts(importId: string): Promise<{ total: number; valid: number; invalid: number; imported: number }> {
    const rows = await db.select().from(dataImportRows).where(eq(dataImportRows.importId, importId));
    return {
      total: rows.length,
      valid: rows.filter(r => r.status === 'VALID').length,
      invalid: rows.filter(r => r.status === 'INVALID').length,
      imported: rows.filter(r => r.status === 'IMPORTED').length,
    };
  }
}

export const componentsStorage = new ComponentsStorage();
