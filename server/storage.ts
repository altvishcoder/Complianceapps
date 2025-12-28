// ComplianceAI Storage Interface - implements database operations using Drizzle ORM
import { 
  users, organisations, schemes, blocks, properties, certificates, extractions, remedialActions, contractors,
  extractionRuns, humanReviews, complianceRules, normalisationRules, 
  benchmarkSets, benchmarkItems, evalRuns, extractionSchemas,
  certificateTypes, classificationCodes,
  componentTypes, units, components, componentCertificates, dataImports, dataImportRows,
  type User, type InsertUser,
  type Organisation, type InsertOrganisation,
  type Scheme, type InsertScheme,
  type Block, type InsertBlock,
  type Property, type InsertProperty,
  type Certificate, type InsertCertificate,
  type Extraction, type InsertExtraction,
  type RemedialAction, type InsertRemedialAction,
  type Contractor, type InsertContractor,
  type CertificateType, type InsertCertificateType,
  type ClassificationCode, type InsertClassificationCode,
  type ExtractionSchema, type InsertExtractionSchema,
  type ComplianceRule, type InsertComplianceRule,
  type NormalisationRule, type InsertNormalisationRule,
  type ComponentType, type InsertComponentType,
  type Unit, type InsertUnit,
  type Component, type InsertComponent,
  type ComponentCertificate, type InsertComponentCertificate,
  type DataImport, type InsertDataImport,
  type DataImportRow, type InsertDataImportRow
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(organisationId: string): Promise<User[]>;
  updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined>;
  getSuperAdmin(organisationId: string): Promise<User | undefined>;
  
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
  
  // Contractors
  listContractors(organisationId: string): Promise<Contractor[]>;
  getContractor(id: string): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor | undefined>;
  updateContractorStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'): Promise<Contractor | undefined>;
  bulkApproveContractors(ids: string[]): Promise<number>;
  bulkRejectContractors(ids: string[]): Promise<number>;
  
  // Configuration - Certificate Types
  listCertificateTypes(): Promise<CertificateType[]>;
  getCertificateType(id: string): Promise<CertificateType | undefined>;
  getCertificateTypeByCode(code: string): Promise<CertificateType | undefined>;
  createCertificateType(certType: InsertCertificateType): Promise<CertificateType>;
  updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined>;
  deleteCertificateType(id: string): Promise<boolean>;
  
  // Configuration - Classification Codes
  listClassificationCodes(certificateTypeId?: string): Promise<ClassificationCode[]>;
  getClassificationCode(id: string): Promise<ClassificationCode | undefined>;
  getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined>;
  createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode>;
  updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined>;
  deleteClassificationCode(id: string): Promise<boolean>;
  
  // Configuration - Extraction Schemas
  listExtractionSchemas(): Promise<ExtractionSchema[]>;
  getExtractionSchema(id: string): Promise<ExtractionSchema | undefined>;
  createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema>;
  updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined>;
  deleteExtractionSchema(id: string): Promise<boolean>;
  
  // Configuration - Compliance Rules
  listComplianceRules(): Promise<ComplianceRule[]>;
  getComplianceRule(id: string): Promise<ComplianceRule | undefined>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined>;
  deleteComplianceRule(id: string): Promise<boolean>;
  
  // Configuration - Normalisation Rules
  listNormalisationRules(): Promise<NormalisationRule[]>;
  getNormalisationRule(id: string): Promise<NormalisationRule | undefined>;
  createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule>;
  updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined>;
  deleteNormalisationRule(id: string): Promise<boolean>;
  
  // HACT Architecture - Component Types
  listComponentTypes(): Promise<ComponentType[]>;
  getComponentType(id: string): Promise<ComponentType | undefined>;
  createComponentType(componentType: InsertComponentType): Promise<ComponentType>;
  updateComponentType(id: string, updates: Partial<InsertComponentType>): Promise<ComponentType | undefined>;
  deleteComponentType(id: string): Promise<boolean>;
  
  // HACT Architecture - Units
  listUnits(propertyId?: string): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, updates: Partial<InsertUnit>): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<boolean>;
  
  // HACT Architecture - Components
  listComponents(filters?: { propertyId?: string; unitId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]>;
  getComponent(id: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, updates: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(id: string): Promise<boolean>;
  bulkCreateComponents(components: InsertComponent[]): Promise<Component[]>;
  
  // HACT Architecture - Component Certificates
  listComponentCertificates(componentId?: string, certificateId?: string): Promise<ComponentCertificate[]>;
  createComponentCertificate(link: InsertComponentCertificate): Promise<ComponentCertificate>;
  deleteComponentCertificate(id: string): Promise<boolean>;
  
  // Data Imports
  listDataImports(organisationId: string): Promise<DataImport[]>;
  getDataImport(id: string): Promise<DataImport | undefined>;
  createDataImport(dataImport: InsertDataImport): Promise<DataImport>;
  updateDataImport(id: string, updates: Partial<InsertDataImport>): Promise<DataImport | undefined>;
  deleteDataImport(id: string): Promise<boolean>;
  
  // Data Import Rows
  listDataImportRows(importId: string): Promise<DataImportRow[]>;
  createDataImportRow(row: InsertDataImportRow): Promise<DataImportRow>;
  bulkCreateDataImportRows(rows: InsertDataImportRow[]): Promise<DataImportRow[]>;
  updateDataImportRow(id: string, updates: Partial<InsertDataImportRow>): Promise<DataImportRow | undefined>;
  getDataImportRowCounts(importId: string): Promise<{ total: number; valid: number; invalid: number; imported: number }>;
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

  async listUsers(organisationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organisationId, organisationId));
  }

  async updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined> {
    const requester = await this.getUser(requesterId);
    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new Error('Only super admins can change user roles');
    }
    
    const targetUser = await this.getUser(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }
    
    if (targetUser.organisationId !== requester.organisationId) {
      throw new Error('Cannot modify users from other organisations');
    }
    
    if (requesterId === userId && requester.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      throw new Error('Super admin cannot demote themselves. Promote another user to super admin first.');
    }
    
    if (newRole === 'SUPER_ADMIN') {
      const existingSuperAdmin = await this.getSuperAdmin(requester.organisationId);
      if (existingSuperAdmin && existingSuperAdmin.id !== userId) {
        await db.update(users)
          .set({ role: 'ADMIN' as any })
          .where(eq(users.id, existingSuperAdmin.id));
      }
    }
    
    const [updated] = await db.update(users)
      .set({ role: newRole as any })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async getSuperAdmin(organisationId: string): Promise<User | undefined> {
    const [superAdmin] = await db.select().from(users)
      .where(and(eq(users.organisationId, organisationId), eq(users.role, 'SUPER_ADMIN')));
    return superAdmin || undefined;
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
  
  // Contractors
  async listContractors(organisationId: string): Promise<Contractor[]> {
    return db.select().from(contractors).where(eq(contractors.organisationId, organisationId)).orderBy(desc(contractors.createdAt));
  }
  
  async getContractor(id: string): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor || undefined;
  }
  
  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db.insert(contractors).values(contractor).returning();
    return newContractor;
  }
  
  async updateContractor(id: string, updates: Partial<InsertContractor>): Promise<Contractor | undefined> {
    const [updated] = await db.update(contractors).set({ ...updates, updatedAt: new Date() }).where(eq(contractors.id, id)).returning();
    return updated || undefined;
  }
  
  async updateContractorStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'): Promise<Contractor | undefined> {
    const [updated] = await db.update(contractors).set({ status, updatedAt: new Date() }).where(eq(contractors.id, id)).returning();
    return updated || undefined;
  }
  
  async bulkApproveContractors(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let approved = 0;
    for (const id of ids) {
      const result = await db.update(contractors)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(contractors.id, id));
      if (result.rowCount && result.rowCount > 0) approved++;
    }
    return approved;
  }
  
  async bulkRejectContractors(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    let rejected = 0;
    for (const id of ids) {
      const result = await db.update(contractors)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(contractors.id, id));
      if (result.rowCount && result.rowCount > 0) rejected++;
    }
    return rejected;
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
  
  // Configuration - Certificate Types
  async listCertificateTypes(): Promise<CertificateType[]> {
    return db.select().from(certificateTypes).orderBy(certificateTypes.displayOrder);
  }
  
  async getCertificateType(id: string): Promise<CertificateType | undefined> {
    const [certType] = await db.select().from(certificateTypes).where(eq(certificateTypes.id, id));
    return certType || undefined;
  }
  
  async getCertificateTypeByCode(code: string): Promise<CertificateType | undefined> {
    const [certType] = await db.select().from(certificateTypes).where(eq(certificateTypes.code, code));
    return certType || undefined;
  }
  
  async createCertificateType(certType: InsertCertificateType): Promise<CertificateType> {
    const [created] = await db.insert(certificateTypes).values(certType).returning();
    return created;
  }
  
  async updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined> {
    const [updated] = await db.update(certificateTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificateTypes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCertificateType(id: string): Promise<boolean> {
    const result = await db.delete(certificateTypes).where(eq(certificateTypes.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Classification Codes
  async listClassificationCodes(certificateTypeId?: string): Promise<ClassificationCode[]> {
    if (certificateTypeId) {
      return db.select().from(classificationCodes)
        .where(eq(classificationCodes.certificateTypeId, certificateTypeId))
        .orderBy(classificationCodes.displayOrder);
    }
    return db.select().from(classificationCodes).orderBy(classificationCodes.displayOrder);
  }
  
  async getClassificationCode(id: string): Promise<ClassificationCode | undefined> {
    const [code] = await db.select().from(classificationCodes).where(eq(classificationCodes.id, id));
    return code || undefined;
  }
  
  async getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined> {
    if (certificateTypeId) {
      const [result] = await db.select().from(classificationCodes)
        .where(and(
          eq(classificationCodes.code, code),
          eq(classificationCodes.certificateTypeId, certificateTypeId)
        ));
      return result || undefined;
    }
    const [result] = await db.select().from(classificationCodes)
      .where(eq(classificationCodes.code, code));
    return result || undefined;
  }
  
  async createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode> {
    const [created] = await db.insert(classificationCodes).values(code).returning();
    return created;
  }
  
  async updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined> {
    const [updated] = await db.update(classificationCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classificationCodes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteClassificationCode(id: string): Promise<boolean> {
    const result = await db.delete(classificationCodes).where(eq(classificationCodes.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Extraction Schemas
  async listExtractionSchemas(): Promise<ExtractionSchema[]> {
    return db.select().from(extractionSchemas).orderBy(desc(extractionSchemas.createdAt));
  }
  
  async getExtractionSchema(id: string): Promise<ExtractionSchema | undefined> {
    const [schema] = await db.select().from(extractionSchemas).where(eq(extractionSchemas.id, id));
    return schema || undefined;
  }
  
  async createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema> {
    const [created] = await db.insert(extractionSchemas).values(schema).returning();
    return created;
  }
  
  async updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined> {
    const [updated] = await db.update(extractionSchemas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(extractionSchemas.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteExtractionSchema(id: string): Promise<boolean> {
    const result = await db.delete(extractionSchemas).where(eq(extractionSchemas.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Compliance Rules
  async listComplianceRules(): Promise<ComplianceRule[]> {
    return db.select().from(complianceRules).orderBy(complianceRules.ruleCode);
  }
  
  async getComplianceRule(id: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.id, id));
    return rule || undefined;
  }
  
  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [created] = await db.insert(complianceRules).values(rule).returning();
    return created;
  }
  
  async updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined> {
    const [updated] = await db.update(complianceRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteComplianceRule(id: string): Promise<boolean> {
    const result = await db.delete(complianceRules).where(eq(complianceRules.id, id)).returning();
    return result.length > 0;
  }
  
  // Configuration - Normalisation Rules
  async listNormalisationRules(): Promise<NormalisationRule[]> {
    return db.select().from(normalisationRules).orderBy(desc(normalisationRules.priority));
  }
  
  async getNormalisationRule(id: string): Promise<NormalisationRule | undefined> {
    const [rule] = await db.select().from(normalisationRules).where(eq(normalisationRules.id, id));
    return rule || undefined;
  }
  
  async createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule> {
    const [created] = await db.insert(normalisationRules).values(rule).returning();
    return created;
  }
  
  async updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined> {
    const [updated] = await db.update(normalisationRules)
      .set(updates)
      .where(eq(normalisationRules.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteNormalisationRule(id: string): Promise<boolean> {
    const result = await db.delete(normalisationRules).where(eq(normalisationRules.id, id)).returning();
    return result.length > 0;
  }
  
  // HACT Architecture - Component Types
  async listComponentTypes(): Promise<ComponentType[]> {
    return db.select().from(componentTypes).orderBy(componentTypes.displayOrder);
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
  
  // HACT Architecture - Units
  async listUnits(propertyId?: string): Promise<Unit[]> {
    if (propertyId) {
      return db.select().from(units)
        .where(eq(units.propertyId, propertyId))
        .orderBy(units.name);
    }
    return db.select().from(units).orderBy(units.name);
  }
  
  async getUnit(id: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit || undefined;
  }
  
  async createUnit(unit: InsertUnit): Promise<Unit> {
    const [created] = await db.insert(units).values(unit).returning();
    return created;
  }
  
  async updateUnit(id: string, updates: Partial<InsertUnit>): Promise<Unit | undefined> {
    const [updated] = await db.update(units)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(units.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteUnit(id: string): Promise<boolean> {
    const result = await db.delete(units).where(eq(units.id, id)).returning();
    return result.length > 0;
  }
  
  // HACT Architecture - Components
  async listComponents(filters?: { propertyId?: string; unitId?: string; blockId?: string; componentTypeId?: string }): Promise<Component[]> {
    const conditions = [];
    if (filters?.propertyId) conditions.push(eq(components.propertyId, filters.propertyId));
    if (filters?.unitId) conditions.push(eq(components.unitId, filters.unitId));
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
  
  // HACT Architecture - Component Certificates
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
  
  // Data Imports
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
  
  // Data Import Rows
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

export const storage = new DatabaseStorage();
