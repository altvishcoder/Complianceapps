import { 
  organisations, schemes, blocks, properties, certificates, remedialActions, 
  extractions, extractionRuns, humanReviews, ingestionBatches, spaces, components
} from "@shared/schema";
import type { 
  Organisation, InsertOrganisation,
  Scheme, InsertScheme,
  Block, InsertBlock,
  Property, InsertProperty,
  IngestionBatch, InsertIngestionBatch
} from "@shared/schema";
import { db, eq, and, or, desc, sql, count, ilike, isNotNull, inArray } from "../base";
import type { IPropertiesStorage } from "../interfaces";

export class PropertiesStorage implements IPropertiesStorage {
  async getOrganisation(id: string): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
    return org || undefined;
  }
  
  async createOrganisation(org: InsertOrganisation): Promise<Organisation> {
    const [organisation] = await db.insert(organisations).values(org).returning();
    return organisation;
  }
  
  async listOrganisations(): Promise<Organisation[]> {
    return db.select().from(organisations);
  }

  async updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined> {
    const [updated] = await db.update(organisations).set({ ...updates, updatedAt: new Date() }).where(eq(organisations.id, id)).returning();
    return updated || undefined;
  }

  async deleteOrganisation(id: string): Promise<boolean> {
    const result = await db.delete(organisations).where(eq(organisations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async getHierarchyStats(): Promise<{
    organisations: number;
    schemes: number;
    blocks: number;
    properties: number;
    spaces: number;
    components: number;
  }> {
    try {
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM organisations) as org_count,
          (SELECT COUNT(*) FROM schemes) as scheme_count,
          (SELECT COUNT(*) FROM blocks) as block_count,
          (SELECT COUNT(*) FROM properties) as property_count,
          (SELECT COUNT(*) FROM spaces) as space_count,
          (SELECT COUNT(*) FROM components) as component_count
      `);
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as any;
        return {
          organisations: Number(row.org_count) || 0,
          schemes: Number(row.scheme_count) || 0,
          blocks: Number(row.block_count) || 0,
          properties: Number(row.property_count) || 0,
          spaces: Number(row.space_count) || 0,
          components: Number(row.component_count) || 0,
        };
      }
    } catch (e) {
      console.error('Error in getHierarchyStats:', e);
    }
    
    const [
      [orgCount],
      [schemeCount],
      [blockCount],
      [propertyCount],
      [spaceCount],
      [componentCount]
    ] = await Promise.all([
      db.select({ count: count() }).from(organisations),
      db.select({ count: count() }).from(schemes),
      db.select({ count: count() }).from(blocks),
      db.select({ count: count() }).from(properties),
      db.select({ count: count() }).from(spaces),
      db.select({ count: count() }).from(components),
    ]);
    
    return {
      organisations: orgCount?.count ?? 0,
      schemes: schemeCount?.count ?? 0,
      blocks: blockCount?.count ?? 0,
      properties: propertyCount?.count ?? 0,
      spaces: spaceCount?.count ?? 0,
      components: componentCount?.count ?? 0,
    };
  }
  
  async listSchemes(organisationId: string): Promise<Scheme[]> {
    return db.select().from(schemes).where(eq(schemes.organisationId, organisationId));
  }
  
  async getScheme(id: string): Promise<Scheme | undefined> {
    const [scheme] = await db.select().from(schemes).where(eq(schemes.id, id));
    return scheme || undefined;
  }
  
  async createScheme(scheme: InsertScheme): Promise<Scheme> {
    const [newScheme] = await db.insert(schemes).values(scheme).returning();
    return newScheme;
  }
  
  async updateScheme(id: string, updates: Partial<InsertScheme>): Promise<Scheme | undefined> {
    const [updated] = await db.update(schemes).set({ ...updates, updatedAt: new Date() }).where(eq(schemes.id, id)).returning();
    return updated || undefined;
  }

  async deleteScheme(id: string): Promise<boolean> {
    const result = await db.delete(schemes).where(eq(schemes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listBlocks(schemeId?: string): Promise<Block[]> {
    if (schemeId) {
      return db.select().from(blocks).where(eq(blocks.schemeId, schemeId));
    }
    return db.select().from(blocks);
  }
  
  async getBlock(id: string): Promise<Block | undefined> {
    const [block] = await db.select().from(blocks).where(eq(blocks.id, id));
    return block || undefined;
  }
  
  async createBlock(block: InsertBlock): Promise<Block> {
    const [newBlock] = await db.insert(blocks).values(block).returning();
    return newBlock;
  }
  
  async updateBlock(id: string, updates: Partial<InsertBlock>): Promise<Block | undefined> {
    const [updated] = await db.update(blocks).set({ ...updates, updatedAt: new Date() }).where(eq(blocks.id, id)).returning();
    return updated || undefined;
  }

  async deleteBlock(id: string): Promise<boolean> {
    const result = await db.delete(blocks).where(eq(blocks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]> {
    if (filters?.blockId) {
      return db.select().from(properties).where(eq(properties.blockId, filters.blockId));
    }
    
    if (filters?.schemeId) {
      return db.select()
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .where(eq(blocks.schemeId, filters.schemeId))
        .then(results => results.map(r => r.properties));
    }
    
    return db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId))
      .then(results => results.map(r => r.properties));
  }
  
  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }
  
  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }
  
  async updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property | undefined> {
    const [updated] = await db.update(properties).set({ ...updates, updatedAt: new Date() }).where(eq(properties.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteProperty(id: string): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async bulkDeleteProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let deleted = 0;
    for (const id of ids) {
      const result = await db.delete(properties).where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) deleted++;
    }
    return deleted;
  }
  
  async bulkVerifyProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let verified = 0;
    for (const id of ids) {
      const result = await db.update(properties)
        .set({ needsVerification: false, updatedAt: new Date() })
        .where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) verified++;
    }
    return verified;
  }
  
  async getOrCreateAutoProperty(organisationId: string, addressData: { addressLine1: string; city?: string; postcode?: string }): Promise<Property> {
    const addressLine = (addressData.addressLine1 || 'Address To Be Verified').trim();
    const normalizedAddress = addressLine.toLowerCase();
    
    const allProps = await db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId));
    
    const existingProp = allProps.find(p => 
      p.properties.addressLine1.trim().toLowerCase() === normalizedAddress
    );
    
    if (existingProp) {
      return existingProp.properties;
    }
    
    let schemeList = await this.listSchemes(organisationId);
    let autoScheme = schemeList.find(s => s.reference === 'AUTO-EXTRACT');
    
    if (!autoScheme) {
      autoScheme = await this.createScheme({
        organisationId,
        name: 'Auto-Extracted Properties',
        reference: 'AUTO-EXTRACT',
      });
    }
    
    let blockList = await this.listBlocks(autoScheme.id);
    let autoBlock = blockList.find(b => b.reference === 'AUTO-BLOCK');
    
    if (!autoBlock) {
      autoBlock = await this.createBlock({
        schemeId: autoScheme.id,
        name: 'Unverified Properties',
        reference: 'AUTO-BLOCK',
      });
    }
    
    const property = await this.createProperty({
      blockId: autoBlock.id,
      uprn: `AUTO-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      addressLine1: addressLine,
      city: addressData.city || 'Unknown',
      postcode: addressData.postcode || 'UNKNOWN',
      propertyType: 'FLAT',
      tenure: 'SOCIAL_RENT',
      bedrooms: 1,
      hasGas: true,
      source: 'AUTO_EXTRACTED',
      needsVerification: true,
      extractedMetadata: addressData,
    });
    
    return property;
  }
  
  async bulkRejectProperties(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let deleted = 0;
    for (const id of ids) {
      const propertyCerts = await db.select().from(certificates).where(eq(certificates.propertyId, id));
      
      for (const cert of propertyCerts) {
        const certRuns = await db.select().from(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        
        for (const run of certRuns) {
          await db.delete(humanReviews).where(eq(humanReviews.extractionRunId, run.id));
        }
        
        await db.delete(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        await db.delete(extractions).where(eq(extractions.certificateId, cert.id));
      }
      
      await db.delete(certificates).where(eq(certificates.propertyId, id));
      await db.delete(remedialActions).where(eq(remedialActions.propertyId, id));
      const result = await db.delete(properties).where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) deleted++;
    }
    return deleted;
  }
  
  async listIngestionBatches(organisationId: string): Promise<IngestionBatch[]> {
    return db.select().from(ingestionBatches)
      .where(eq(ingestionBatches.organisationId, organisationId))
      .orderBy(desc(ingestionBatches.createdAt));
  }
  
  async getIngestionBatch(id: string): Promise<IngestionBatch | undefined> {
    const [batch] = await db.select().from(ingestionBatches).where(eq(ingestionBatches.id, id));
    return batch || undefined;
  }
  
  async createIngestionBatch(batch: InsertIngestionBatch): Promise<IngestionBatch> {
    const [created] = await db.insert(ingestionBatches).values(batch).returning();
    return created;
  }
  
  async updateIngestionBatch(id: string, updates: Partial<InsertIngestionBatch>): Promise<IngestionBatch | undefined> {
    const [updated] = await db.update(ingestionBatches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ingestionBatches.id, id))
      .returning();
    return updated || undefined;
  }
  
  async listGeocodedProperties(organisationId: string): Promise<Property[]> {
    return db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(and(
        eq(schemes.organisationId, organisationId),
        isNotNull(properties.latitude),
        isNotNull(properties.longitude)
      ))
      .then(results => results.map(r => r.properties));
  }
  
  async updatePropertyGeodata(propertyId: string, geodata: { latitude: number; longitude: number; ward?: string; wardCode?: string; lsoa?: string; msoa?: string }): Promise<Property | undefined> {
    const [updated] = await db.update(properties)
      .set({
        latitude: geodata.latitude,
        longitude: geodata.longitude,
        ward: geodata.ward,
        wardCode: geodata.wardCode,
        lsoa: geodata.lsoa,
        msoa: geodata.msoa,
        updatedAt: new Date()
      })
      .where(eq(properties.id, propertyId))
      .returning();
    return updated || undefined;
  }
  
  async getPropertyRiskData(organisationId: string): Promise<Array<{
    property: Property;
    certificates: Array<{ type: string; status: string; expiryDate: string | null }>;
    actions: Array<{ severity: string; status: string }>;
  }>> {
    // Step 1: Fetch all properties in one query
    const props = await db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId))
      .then(results => results.map(r => r.properties));
    
    if (props.length === 0) {
      return [];
    }
    
    // Get all property IDs for batch queries
    const propertyIds = props.map(p => p.id);
    
    // PostgreSQL limits ROW expressions to 1664 entries, so chunk the queries
    const CHUNK_SIZE = 1000;
    const allCerts: Array<typeof certificates.$inferSelect> = [];
    const allActions: Array<typeof remedialActions.$inferSelect> = [];
    
    // Step 2: Batch fetch certificates in chunks
    for (let i = 0; i < propertyIds.length; i += CHUNK_SIZE) {
      const chunk = propertyIds.slice(i, i + CHUNK_SIZE);
      const chunkCerts = await db.select()
        .from(certificates)
        .where(inArray(certificates.propertyId, chunk));
      allCerts.push(...chunkCerts);
    }
    
    // Step 3: Batch fetch remedial actions in chunks
    for (let i = 0; i < propertyIds.length; i += CHUNK_SIZE) {
      const chunk = propertyIds.slice(i, i + CHUNK_SIZE);
      const chunkActions = await db.select()
        .from(remedialActions)
        .where(inArray(remedialActions.propertyId, chunk));
      allActions.push(...chunkActions);
    }
    
    // Step 4: Group certificates and actions by propertyId in memory
    const certsByPropertyId = new Map<string, typeof allCerts>();
    for (const cert of allCerts) {
      if (!certsByPropertyId.has(cert.propertyId)) {
        certsByPropertyId.set(cert.propertyId, []);
      }
      certsByPropertyId.get(cert.propertyId)!.push(cert);
    }
    
    const actionsByPropertyId = new Map<string, typeof allActions>();
    for (const action of allActions) {
      if (!actionsByPropertyId.has(action.propertyId)) {
        actionsByPropertyId.set(action.propertyId, []);
      }
      actionsByPropertyId.get(action.propertyId)!.push(action);
    }
    
    // Step 5: Build results array
    return props.map(prop => ({
      property: prop,
      certificates: (certsByPropertyId.get(prop.id) || []).map(c => ({
        type: c.certificateType,
        status: c.status,
        expiryDate: c.expiryDate || null
      })),
      actions: (actionsByPropertyId.get(prop.id) || []).map(a => ({
        severity: a.severity,
        status: a.status
      }))
    }));
  }
}

export const propertiesStorage = new PropertiesStorage();
