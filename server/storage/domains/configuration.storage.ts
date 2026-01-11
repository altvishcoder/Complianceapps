import { 
  complianceStreams, certificateTypes, classificationCodes, 
  extractionSchemas, complianceRules, normalisationRules 
} from "@shared/schema";
import type { 
  ComplianceStream, InsertComplianceStream,
  CertificateType, InsertCertificateType,
  ClassificationCode, InsertClassificationCode,
  ExtractionSchema, InsertExtractionSchema,
  ComplianceRule, InsertComplianceRule,
  NormalisationRule, InsertNormalisationRule
} from "@shared/schema";
import { db, eq, and, desc } from "../base";
import type { IConfigurationStorage } from "../interfaces";

export class ConfigurationStorage implements IConfigurationStorage {
  async listComplianceStreams(): Promise<ComplianceStream[]> {
    return db.select().from(complianceStreams).orderBy(complianceStreams.displayOrder);
  }
  
  async getComplianceStream(id: string): Promise<ComplianceStream | undefined> {
    const [stream] = await db.select().from(complianceStreams).where(eq(complianceStreams.id, id));
    return stream || undefined;
  }
  
  async getComplianceStreamByCode(code: string): Promise<ComplianceStream | undefined> {
    const [stream] = await db.select().from(complianceStreams).where(eq(complianceStreams.code, code));
    return stream || undefined;
  }
  
  async createComplianceStream(stream: InsertComplianceStream): Promise<ComplianceStream> {
    const [newStream] = await db.insert(complianceStreams).values(stream).returning();
    return newStream;
  }
  
  async updateComplianceStream(id: string, updates: Partial<InsertComplianceStream>): Promise<ComplianceStream | undefined> {
    const [updated] = await db.update(complianceStreams).set({ ...updates, updatedAt: new Date() }).where(eq(complianceStreams.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteComplianceStream(id: string): Promise<boolean> {
    const result = await db.delete(complianceStreams).where(eq(complianceStreams.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listCertificateTypes(): Promise<CertificateType[]> {
    return db.select().from(certificateTypes).orderBy(certificateTypes.name);
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
    const [newType] = await db.insert(certificateTypes).values(certType).returning();
    return newType;
  }
  
  async updateCertificateType(id: string, updates: Partial<InsertCertificateType>): Promise<CertificateType | undefined> {
    const [updated] = await db.update(certificateTypes).set({ ...updates, updatedAt: new Date() }).where(eq(certificateTypes.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteCertificateType(id: string): Promise<boolean> {
    const result = await db.delete(certificateTypes).where(eq(certificateTypes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listClassificationCodes(filters?: { certificateTypeId?: string; complianceStreamId?: string }): Promise<ClassificationCode[]> {
    const conditions: any[] = [];
    if (filters?.certificateTypeId) {
      conditions.push(eq(classificationCodes.certificateTypeId, filters.certificateTypeId));
    }
    if (filters?.complianceStreamId) {
      conditions.push(eq(classificationCodes.complianceStreamId, filters.complianceStreamId));
    }
    if (conditions.length > 0) {
      return db.select().from(classificationCodes).where(and(...conditions)).orderBy(classificationCodes.code);
    }
    return db.select().from(classificationCodes).orderBy(classificationCodes.code);
  }
  
  async getClassificationCode(id: string): Promise<ClassificationCode | undefined> {
    const [code] = await db.select().from(classificationCodes).where(eq(classificationCodes.id, id));
    return code || undefined;
  }
  
  async getClassificationCodeByCode(code: string, certificateTypeId?: string): Promise<ClassificationCode | undefined> {
    const conditions = [eq(classificationCodes.code, code)];
    if (certificateTypeId) {
      conditions.push(eq(classificationCodes.certificateTypeId, certificateTypeId));
    }
    const [result] = await db.select().from(classificationCodes).where(and(...conditions));
    return result || undefined;
  }
  
  async createClassificationCode(code: InsertClassificationCode): Promise<ClassificationCode> {
    const [newCode] = await db.insert(classificationCodes).values(code).returning();
    return newCode;
  }
  
  async updateClassificationCode(id: string, updates: Partial<InsertClassificationCode>): Promise<ClassificationCode | undefined> {
    const [updated] = await db.update(classificationCodes).set({ ...updates, updatedAt: new Date() }).where(eq(classificationCodes.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteClassificationCode(id: string): Promise<boolean> {
    const result = await db.delete(classificationCodes).where(eq(classificationCodes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listExtractionSchemas(filters?: { complianceStreamId?: string }): Promise<ExtractionSchema[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(extractionSchemas).where(eq(extractionSchemas.complianceStreamId, filters.complianceStreamId)).orderBy(extractionSchemas.name);
    }
    return db.select().from(extractionSchemas).orderBy(extractionSchemas.name);
  }
  
  async getExtractionSchema(id: string): Promise<ExtractionSchema | undefined> {
    const [schema] = await db.select().from(extractionSchemas).where(eq(extractionSchemas.id, id));
    return schema || undefined;
  }
  
  async createExtractionSchema(schema: InsertExtractionSchema): Promise<ExtractionSchema> {
    const [newSchema] = await db.insert(extractionSchemas).values(schema).returning();
    return newSchema;
  }
  
  async updateExtractionSchema(id: string, updates: Partial<InsertExtractionSchema>): Promise<ExtractionSchema | undefined> {
    const [updated] = await db.update(extractionSchemas).set({ ...updates, updatedAt: new Date() }).where(eq(extractionSchemas.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteExtractionSchema(id: string): Promise<boolean> {
    const result = await db.delete(extractionSchemas).where(eq(extractionSchemas.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listComplianceRules(filters?: { complianceStreamId?: string }): Promise<ComplianceRule[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(complianceRules).where(eq(complianceRules.complianceStreamId, filters.complianceStreamId)).orderBy(complianceRules.priority);
    }
    return db.select().from(complianceRules).orderBy(complianceRules.priority);
  }
  
  async getComplianceRule(id: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.id, id));
    return rule || undefined;
  }
  
  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [newRule] = await db.insert(complianceRules).values(rule).returning();
    return newRule;
  }
  
  async updateComplianceRule(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule | undefined> {
    const [updated] = await db.update(complianceRules).set({ ...updates, updatedAt: new Date() }).where(eq(complianceRules.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteComplianceRule(id: string): Promise<boolean> {
    const result = await db.delete(complianceRules).where(eq(complianceRules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async listNormalisationRules(filters?: { complianceStreamId?: string }): Promise<NormalisationRule[]> {
    if (filters?.complianceStreamId) {
      return db.select().from(normalisationRules).where(eq(normalisationRules.complianceStreamId, filters.complianceStreamId)).orderBy(normalisationRules.priority);
    }
    return db.select().from(normalisationRules).orderBy(normalisationRules.priority);
  }
  
  async getNormalisationRule(id: string): Promise<NormalisationRule | undefined> {
    const [rule] = await db.select().from(normalisationRules).where(eq(normalisationRules.id, id));
    return rule || undefined;
  }
  
  async createNormalisationRule(rule: InsertNormalisationRule): Promise<NormalisationRule> {
    const [newRule] = await db.insert(normalisationRules).values(rule).returning();
    return newRule;
  }
  
  async updateNormalisationRule(id: string, updates: Partial<InsertNormalisationRule>): Promise<NormalisationRule | undefined> {
    const [updated] = await db.update(normalisationRules).set({ ...updates, updatedAt: new Date() }).where(eq(normalisationRules.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteNormalisationRule(id: string): Promise<boolean> {
    const result = await db.delete(normalisationRules).where(eq(normalisationRules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const configurationStorage = new ConfigurationStorage();
