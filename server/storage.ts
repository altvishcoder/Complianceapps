// ComplianceAI Storage Interface - implements database operations using Drizzle ORM
import { 
  users, organisations, schemes, blocks, properties, certificates, extractions, remedialActions,
  extractionRuns, humanReviews, complianceRules, normalisationRules, 
  benchmarkSets, benchmarkItems, evalRuns, extractionSchemas,
  type User, type InsertUser,
  type Organisation, type InsertOrganisation,
  type Scheme, type InsertScheme,
  type Block, type InsertBlock,
  type Property, type InsertProperty,
  type Certificate, type InsertCertificate,
  type Extraction, type InsertExtraction,
  type RemedialAction, type InsertRemedialAction
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Organisations
  getOrganisation(id: string): Promise<Organisation | undefined>;
  createOrganisation(org: InsertOrganisation): Promise<Organisation>;
  listOrganisations(): Promise<Organisation[]>;
  
  // Schemes
  listSchemes(organisationId: string): Promise<Scheme[]>;
  getScheme(id: string): Promise<Scheme | undefined>;
  createScheme(scheme: InsertScheme): Promise<Scheme>;
  updateScheme(id: string, updates: Partial<InsertScheme>): Promise<Scheme | undefined>;
  
  // Blocks
  listBlocks(schemeId?: string): Promise<Block[]>;
  getBlock(id: string): Promise<Block | undefined>;
  createBlock(block: InsertBlock): Promise<Block>;
  updateBlock(id: string, updates: Partial<InsertBlock>): Promise<Block | undefined>;
  
  // Properties
  listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, updates: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  bulkDeleteProperties(ids: string[]): Promise<number>;
  bulkVerifyProperties(ids: string[]): Promise<number>;
  bulkRejectProperties(ids: string[]): Promise<number>;
  getOrCreateAutoProperty(organisationId: string, addressData: { addressLine1: string; city?: string; postcode?: string }): Promise<Property>;
  
  // Certificates
  listCertificates(organisationId: string, filters?: { propertyId?: string; status?: string }): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  deleteCertificate(id: string): Promise<boolean>;
  
  // Extractions
  getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined>;
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  
  // Remedial Actions
  listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]>;
  getRemedialAction(id: string): Promise<RemedialAction | undefined>;
  createRemedialAction(action: InsertRemedialAction): Promise<RemedialAction>;
  updateRemedialAction(id: string, updates: Partial<InsertRemedialAction>): Promise<RemedialAction | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Organisations
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
  
  // Schemes
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
  
  // Blocks
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
  
  // Properties
  async listProperties(organisationId: string, filters?: { blockId?: string; schemeId?: string }): Promise<Property[]> {
    if (filters?.blockId) {
      return db.select().from(properties).where(eq(properties.blockId, filters.blockId));
    }
    
    // For schemeId, we need to join with blocks
    if (filters?.schemeId) {
      return db.select()
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .where(eq(blocks.schemeId, filters.schemeId))
        .then(results => results.map(r => r.properties));
    }
    
    // All properties for the organisation (via schemes)
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
    // Check if a property with the same address already exists (case-insensitive, trimmed)
    const addressLine = (addressData.addressLine1 || 'Address To Be Verified').trim();
    const normalizedAddress = addressLine.toLowerCase();
    
    // Get all properties in the organisation and check for matches
    const allProps = await db.select()
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(schemes.organisationId, organisationId));
    
    // Find case-insensitive match
    const existingProp = allProps.find(p => 
      p.properties.addressLine1.trim().toLowerCase() === normalizedAddress
    );
    
    if (existingProp) {
      // Return the existing property
      return existingProp.properties;
    }
    
    // Get or create a default scheme and block for auto-extracted properties
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
    
    // Create the property with needsVerification flag
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
      // Get certificates for this property to delete their extractions
      const propertyCerts = await db.select().from(certificates).where(eq(certificates.propertyId, id));
      
      for (const cert of propertyCerts) {
        // Get extraction runs first (before deleting)
        const certRuns = await db.select().from(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        
        // Delete human reviews (via extraction runs)
        for (const run of certRuns) {
          await db.delete(humanReviews).where(eq(humanReviews.extractionRunId, run.id));
        }
        
        // Delete extraction runs
        await db.delete(extractionRuns).where(eq(extractionRuns.certificateId, cert.id));
        // Delete extractions
        await db.delete(extractions).where(eq(extractions.certificateId, cert.id));
      }
      
      // Delete certificates
      await db.delete(certificates).where(eq(certificates.propertyId, id));
      // Delete remedial actions
      await db.delete(remedialActions).where(eq(remedialActions.propertyId, id));
      // Delete the property
      const result = await db.delete(properties).where(eq(properties.id, id));
      if (result.rowCount && result.rowCount > 0) deleted++;
    }
    return deleted;
  }
  
  // Certificates
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
  
  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || undefined;
  }
  
  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db.insert(certificates).values(certificate).returning();
    return newCertificate;
  }
  
  async updateCertificate(id: string, updates: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [updated] = await db.update(certificates).set({ ...updates, updatedAt: new Date() }).where(eq(certificates.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteCertificate(id: string): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Extractions
  async getExtractionByCertificate(certificateId: string): Promise<Extraction | undefined> {
    const [extraction] = await db.select().from(extractions).where(eq(extractions.certificateId, certificateId)).orderBy(desc(extractions.createdAt));
    return extraction || undefined;
  }
  
  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const [newExtraction] = await db.insert(extractions).values(extraction).returning();
    return newExtraction;
  }
  
  // Remedial Actions
  async listRemedialActions(organisationId: string, filters?: { propertyId?: string; status?: string; certificateId?: string }): Promise<RemedialAction[]> {
    // Need to join with certificates to filter by organisation
    const conditions = [eq(certificates.organisationId, organisationId)];
    
    if (filters?.propertyId) {
      conditions.push(eq(remedialActions.propertyId, filters.propertyId));
    }
    
    if (filters?.status) {
      conditions.push(eq(remedialActions.status, filters.status as any));
    }
    
    if (filters?.certificateId) {
      conditions.push(eq(remedialActions.certificateId, filters.certificateId));
    }
    
    return db.select({ actions: remedialActions })
      .from(remedialActions)
      .innerJoin(certificates, eq(remedialActions.certificateId, certificates.id))
      .where(and(...conditions))
      .orderBy(desc(remedialActions.createdAt))
      .then(results => results.map(r => r.actions));
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
  
  // Admin / Demo Data Management
  async wipeData(includeProperties: boolean = false): Promise<void> {
    // Delete in order of dependencies (children first)
    // First, clear AI Model related tables
    await db.delete(humanReviews);
    await db.delete(evalRuns);
    await db.delete(benchmarkItems);
    await db.delete(benchmarkSets);
    await db.delete(extractionRuns);
    await db.delete(complianceRules);
    await db.delete(normalisationRules);
    await db.delete(extractionSchemas);
    
    // Then clear core certificate-related tables
    await db.delete(remedialActions);
    await db.delete(extractions);
    await db.delete(certificates);
    
    if (includeProperties) {
      await db.delete(properties);
      await db.delete(blocks);
      await db.delete(schemes);
    }
    
    console.log(`Data wiped successfully (includeProperties: ${includeProperties})`);
  }
  
  async seedDemoData(organisationId: string): Promise<void> {
    // Create demo schemes
    const [londonScheme] = await db.insert(schemes).values({
      organisationId,
      name: "London Housing Estate",
      reference: "SCH-LON-001",
    }).returning();
    
    const [manchesterScheme] = await db.insert(schemes).values({
      organisationId,
      name: "Manchester Urban Regeneration",
      reference: "SCH-MAN-001",
    }).returning();
    
    // Create blocks
    const [oakHouseBlock] = await db.insert(blocks).values({
      schemeId: londonScheme.id,
      name: "Oak House",
      reference: "BLK-OAK-001",
    }).returning();
    
    const [towersBlock] = await db.insert(blocks).values({
      schemeId: manchesterScheme.id,
      name: "The Towers",
      reference: "BLK-TWR-001",
    }).returning();
    
    // Create properties
    await db.insert(properties).values([
      {
        blockId: oakHouseBlock.id,
        uprn: "10001001",
        addressLine1: "Flat 1, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "COMPLIANT",
      },
      {
        blockId: oakHouseBlock.id,
        uprn: "10001002",
        addressLine1: "Flat 2, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "OVERDUE",
      },
      {
        blockId: towersBlock.id,
        uprn: "10002001",
        addressLine1: "101 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "LEASEHOLD",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "COMPLIANT",
      },
      {
        blockId: towersBlock.id,
        uprn: "10002002",
        addressLine1: "102 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "NON_COMPLIANT",
      },
    ]);
    
    console.log("Demo data seeded successfully");
  }
}

export const storage = new DatabaseStorage();
