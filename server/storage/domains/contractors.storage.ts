import { 
  contractors, contractorCertifications, contractorVerificationHistory, 
  contractorAlerts, contractorAssignments, staffMembers 
} from "@shared/schema";
import type { 
  Contractor, InsertContractor, 
  ContractorCertification, InsertContractorCertification,
  ContractorVerificationHistory, InsertContractorVerificationHistory,
  ContractorAlert, InsertContractorAlert,
  ContractorAssignment, InsertContractorAssignment,
  StaffMember, InsertStaffMember
} from "@shared/schema";
import { db, eq, and, desc } from "../base";
import type { IContractorsStorage } from "../interfaces";

export class ContractorsStorage implements IContractorsStorage {
  async listContractors(organisationId: string): Promise<Contractor[]> {
    const conditions = [eq(contractors.organisationId, organisationId)];
    return db.select().from(contractors).where(and(...conditions)).orderBy(desc(contractors.createdAt));
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
  
  async listContractorCertifications(organisationId: string, contractorId?: string): Promise<ContractorCertification[]> {
    const conditions = [eq(contractorCertifications.organisationId, organisationId)];
    if (contractorId) {
      conditions.push(eq(contractorCertifications.contractorId, contractorId));
    }
    return db.select().from(contractorCertifications).where(and(...conditions)).orderBy(desc(contractorCertifications.createdAt));
  }
  
  async getContractorCertification(id: string): Promise<ContractorCertification | undefined> {
    const [cert] = await db.select().from(contractorCertifications).where(eq(contractorCertifications.id, id));
    return cert || undefined;
  }
  
  async createContractorCertification(certification: InsertContractorCertification): Promise<ContractorCertification> {
    const [newCert] = await db.insert(contractorCertifications).values(certification).returning();
    return newCert;
  }
  
  async updateContractorCertification(id: string, updates: Partial<InsertContractorCertification>): Promise<ContractorCertification | undefined> {
    const [updated] = await db.update(contractorCertifications).set({ ...updates, updatedAt: new Date() }).where(eq(contractorCertifications.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteContractorCertification(id: string): Promise<boolean> {
    const result = await db.delete(contractorCertifications).where(eq(contractorCertifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async listContractorVerificationHistory(contractorId: string): Promise<ContractorVerificationHistory[]> {
    return db.select().from(contractorVerificationHistory).where(eq(contractorVerificationHistory.contractorId, contractorId)).orderBy(desc(contractorVerificationHistory.createdAt));
  }
  
  async createContractorVerificationHistory(history: InsertContractorVerificationHistory): Promise<ContractorVerificationHistory> {
    const [newHistory] = await db.insert(contractorVerificationHistory).values(history).returning();
    return newHistory;
  }
  
  async listContractorAlerts(organisationId: string, filters?: { contractorId?: string; status?: string }): Promise<ContractorAlert[]> {
    const conditions = [eq(contractorAlerts.organisationId, organisationId)];
    if (filters?.contractorId) {
      conditions.push(eq(contractorAlerts.contractorId, filters.contractorId));
    }
    if (filters?.status) {
      conditions.push(eq(contractorAlerts.status, filters.status as any));
    }
    return db.select().from(contractorAlerts).where(and(...conditions)).orderBy(desc(contractorAlerts.createdAt));
  }
  
  async getContractorAlert(id: string): Promise<ContractorAlert | undefined> {
    const [alert] = await db.select().from(contractorAlerts).where(eq(contractorAlerts.id, id));
    return alert || undefined;
  }
  
  async createContractorAlert(alert: InsertContractorAlert): Promise<ContractorAlert> {
    const [newAlert] = await db.insert(contractorAlerts).values(alert).returning();
    return newAlert;
  }
  
  async updateContractorAlert(id: string, updates: Partial<InsertContractorAlert>): Promise<ContractorAlert | undefined> {
    const [updated] = await db.update(contractorAlerts).set({ ...updates, updatedAt: new Date() }).where(eq(contractorAlerts.id, id)).returning();
    return updated || undefined;
  }
  
  async listContractorAssignments(organisationId: string, filters?: { contractorId?: string; propertyId?: string; status?: string }): Promise<ContractorAssignment[]> {
    const conditions = [eq(contractorAssignments.organisationId, organisationId)];
    if (filters?.contractorId) {
      conditions.push(eq(contractorAssignments.contractorId, filters.contractorId));
    }
    if (filters?.propertyId) {
      conditions.push(eq(contractorAssignments.propertyId, filters.propertyId));
    }
    if (filters?.status) {
      conditions.push(eq(contractorAssignments.status, filters.status as any));
    }
    return db.select().from(contractorAssignments).where(and(...conditions)).orderBy(desc(contractorAssignments.createdAt));
  }
  
  async getContractorAssignment(id: string): Promise<ContractorAssignment | undefined> {
    const [assignment] = await db.select().from(contractorAssignments).where(eq(contractorAssignments.id, id));
    return assignment || undefined;
  }
  
  async createContractorAssignment(assignment: InsertContractorAssignment): Promise<ContractorAssignment> {
    const [newAssignment] = await db.insert(contractorAssignments).values(assignment).returning();
    return newAssignment;
  }
  
  async updateContractorAssignment(id: string, updates: Partial<InsertContractorAssignment>): Promise<ContractorAssignment | undefined> {
    const [updated] = await db.update(contractorAssignments).set({ ...updates, updatedAt: new Date() }).where(eq(contractorAssignments.id, id)).returning();
    return updated || undefined;
  }
  
  async listStaffMembers(organisationId: string, filters?: { status?: string; department?: string }): Promise<StaffMember[]> {
    const conditions = [eq(staffMembers.organisationId, organisationId)];
    if (filters?.status) {
      conditions.push(eq(staffMembers.status, filters.status as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE'));
    }
    if (filters?.department) {
      conditions.push(eq(staffMembers.department, filters.department));
    }
    return db.select().from(staffMembers).where(and(...conditions)).orderBy(desc(staffMembers.createdAt));
  }
  
  async getStaffMember(id: string): Promise<StaffMember | undefined> {
    const [staff] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
    return staff || undefined;
  }
  
  async createStaffMember(staff: InsertStaffMember): Promise<StaffMember> {
    const [created] = await db.insert(staffMembers).values(staff).returning();
    return created;
  }
  
  async updateStaffMember(id: string, updates: Partial<InsertStaffMember>): Promise<StaffMember | undefined> {
    const [updated] = await db.update(staffMembers).set({ ...updates, updatedAt: new Date() }).where(eq(staffMembers.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteStaffMember(id: string): Promise<boolean> {
    const result = await db.delete(staffMembers).where(eq(staffMembers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async bulkCreateStaffMembers(staffList: InsertStaffMember[]): Promise<StaffMember[]> {
    if (staffList.length === 0) return [];
    const created = await db.insert(staffMembers).values(staffList).returning();
    return created;
  }
}

export const contractorsStorage = new ContractorsStorage();
