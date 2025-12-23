// Simulating a more robust data model with relationships

// Types based on the prisma schema from the prompt
export type UserRole = "ADMIN" | "MANAGER" | "OFFICER" | "VIEWER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisationId: string;
}

export type ComplianceStatus = "COMPLIANT" | "EXPIRING_SOON" | "OVERDUE" | "NON_COMPLIANT" | "ACTION_REQUIRED" | "UNKNOWN";

export interface Scheme {
  id: string;
  organisationId: string;
  name: string;
  reference: string;
  complianceStatus: ComplianceStatus;
}

export interface Block {
  id: string;
  schemeId: string;
  name: string;
  reference: string;
  hasLift: boolean;
  hasCommunalBoiler: boolean;
  complianceStatus: ComplianceStatus;
}

export type PropertyType = "HOUSE" | "FLAT" | "BUNGALOW" | "MAISONETTE" | "BEDSIT" | "STUDIO";
export type Tenure = "SOCIAL_RENT" | "AFFORDABLE_RENT" | "SHARED_OWNERSHIP" | "LEASEHOLD" | "TEMPORARY";

export interface Property {
  id: string;
  blockId: string;
  uprn: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  propertyType: PropertyType;
  tenure: Tenure;
  bedrooms: number;
  hasGas: boolean;
  complianceStatus: ComplianceStatus;
  
  // Computed fields for UI convenience
  fullAddress: string; 
  schemeId?: string; // Derived from block
}

export type CertificateType = "GAS_SAFETY" | "EICR" | "EPC" | "FIRE_RISK_ASSESSMENT" | "LEGIONELLA_ASSESSMENT" | "ASBESTOS_SURVEY" | "LIFT_LOLER" | "OTHER";
export type CertificateStatus = "UPLOADED" | "PROCESSING" | "EXTRACTED" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";
export type CertificateOutcome = "SATISFACTORY" | "UNSATISFACTORY" | "PASS" | "FAIL" | "AT_RISK" | "IMMEDIATELY_DANGEROUS";

export interface Certificate {
  id: string;
  propertyId: string;
  fileName: string;
  certificateType: CertificateType;
  status: CertificateStatus;
  issueDate?: string;
  expiryDate?: string;
  outcome?: CertificateOutcome;
  uploadedAt: string;
  extractedData?: any; // For AI results
}

export interface RemedialAction {
  id: string;
  certificateId: string;
  propertyId: string; // Denormalized for easy access
  description: string;
  severity: "IMMEDIATE" | "URGENT" | "PRIORITY" | "ROUTINE" | "ADVISORY";
  status: "OPEN" | "IN_PROGRESS" | "SCHEDULED" | "COMPLETED";
  dueDate?: string;
  costEstimate?: string;
}

// Initial Mock Data

export const mockSchemes: Scheme[] = [
  { id: "SCH-001", organisationId: "ORG-001", name: "Oak Estate", reference: "SCH001", complianceStatus: "COMPLIANT" },
  { id: "SCH-002", organisationId: "ORG-001", name: "Riverside Gardens", reference: "SCH002", complianceStatus: "EXPIRING_SOON" },
];

export const mockBlocks: Block[] = [
  { id: "BLK-001", schemeId: "SCH-001", name: "Oak House", reference: "BLK001", hasLift: false, hasCommunalBoiler: false, complianceStatus: "COMPLIANT" },
  { id: "BLK-002", schemeId: "SCH-002", name: "The Towers Block A", reference: "BLK002", hasLift: true, hasCommunalBoiler: true, complianceStatus: "NON_COMPLIANT" },
  { id: "BLK-003", schemeId: "SCH-002", name: "The Towers Block B", reference: "BLK003", hasLift: true, hasCommunalBoiler: true, complianceStatus: "COMPLIANT" },
];

export const mockProperties: Property[] = [
  { 
    id: "PROP-001", blockId: "BLK-001", uprn: "10001001", 
    addressLine1: "Flat 1, Oak House", city: "London", postcode: "SW1 1AA",
    propertyType: "FLAT", tenure: "SOCIAL_RENT", bedrooms: 2, hasGas: true,
    complianceStatus: "COMPLIANT", fullAddress: "Flat 1, Oak House, London, SW1 1AA", schemeId: "SCH-001"
  },
  { 
    id: "PROP-002", blockId: "BLK-001", uprn: "10001002", 
    addressLine1: "Flat 2, Oak House", city: "London", postcode: "SW1 1AA",
    propertyType: "FLAT", tenure: "SOCIAL_RENT", bedrooms: 2, hasGas: true,
    complianceStatus: "OVERDUE", fullAddress: "Flat 2, Oak House, London, SW1 1AA", schemeId: "SCH-001"
  },
  { 
    id: "PROP-003", blockId: "BLK-002", uprn: "10002001", 
    addressLine1: "101 The Towers", city: "Manchester", postcode: "M1 1BB",
    propertyType: "FLAT", tenure: "LEASEHOLD", bedrooms: 1, hasGas: false,
    complianceStatus: "COMPLIANT", fullAddress: "101 The Towers, Manchester, M1 1BB", schemeId: "SCH-002"
  },
  { 
    id: "PROP-004", blockId: "BLK-002", uprn: "10002002", 
    addressLine1: "102 The Towers", city: "Manchester", postcode: "M1 1BB",
    propertyType: "FLAT", tenure: "SOCIAL_RENT", bedrooms: 1, hasGas: false,
    complianceStatus: "NON_COMPLIANT", fullAddress: "102 The Towers, Manchester, M1 1BB", schemeId: "SCH-002"
  },
];

export const mockCertificates: Certificate[] = [
  { 
    id: "CERT-001", propertyId: "PROP-001", fileName: "CP12_2024.pdf", 
    certificateType: "GAS_SAFETY", status: "APPROVED", 
    issueDate: "2024-01-15", expiryDate: "2025-01-15", outcome: "PASS", uploadedAt: "2024-01-16T10:00:00Z" 
  },
  { 
    id: "CERT-002", propertyId: "PROP-002", fileName: "CP12_OLD.pdf", 
    certificateType: "GAS_SAFETY", status: "APPROVED", 
    issueDate: "2023-01-10", expiryDate: "2024-01-10", outcome: "PASS", uploadedAt: "2023-01-12T10:00:00Z" 
  },
  { 
    id: "CERT-003", propertyId: "PROP-004", fileName: "EICR_FAILED.pdf", 
    certificateType: "EICR", status: "APPROVED", 
    issueDate: "2024-06-01", expiryDate: "2029-06-01", outcome: "UNSATISFACTORY", uploadedAt: "2024-06-02T14:30:00Z" 
  },
];

export const mockActions: RemedialAction[] = [
  {
    id: "ACT-001", certificateId: "CERT-003", propertyId: "PROP-004",
    description: "C1 - Exposed live parts in fuse box", severity: "IMMEDIATE", status: "OPEN",
    dueDate: "2024-06-02", costEstimate: "£250"
  },
  {
    id: "ACT-002", certificateId: "CERT-003", propertyId: "PROP-004",
    description: "C2 - No RCD protection for bathroom circuits", severity: "URGENT", status: "SCHEDULED",
    dueDate: "2024-06-15", costEstimate: "£450"
  }
];

// Simple Client-Side Store to manage state
class Store {
  schemes = [...mockSchemes];
  blocks = [...mockBlocks];
  properties = [...mockProperties];
  certificates = [...mockCertificates];
  actions = [...mockActions];
  
  listeners: Function[] = [];

  subscribe(listener: Function) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  addProperty(prop: Omit<Property, "id" | "complianceStatus" | "fullAddress">) {
    const newProp: Property = {
      ...prop,
      id: `PROP-${Date.now()}`,
      complianceStatus: "UNKNOWN",
      fullAddress: `${prop.addressLine1}, ${prop.city}, ${prop.postcode}`,
      schemeId: this.blocks.find(b => b.id === prop.blockId)?.schemeId
    };
    this.properties = [...this.properties, newProp];
    this.notify();
    return newProp;
  }
  
  addCertificate(cert: Omit<Certificate, "id" | "uploadedAt" | "status">) {
    const newCert: Certificate = {
      ...cert,
      id: `CERT-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      status: "PROCESSING" // Start as processing to simulate AI
    };
    this.certificates = [newCert, ...this.certificates];
    this.notify();
    return newCert;
  }

  updateCertificateStatus(id: string, status: CertificateStatus, extraData?: Partial<Certificate>) {
    this.certificates = this.certificates.map(c => 
      c.id === id ? { ...c, status, ...extraData } : c
    );
    this.notify();
  }

  getPropertiesByBlock(blockId: string) {
    return this.properties.filter(p => p.blockId === blockId);
  }

  getBlocksByScheme(schemeId: string) {
    return this.blocks.filter(b => b.schemeId === schemeId);
  }
}

export const db = new Store();
