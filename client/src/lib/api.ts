// ComplianceAI API Client
import type { 
  Property, Certificate, RemedialAction,
  Scheme, Block, InsertProperty, InsertCertificate, Contractor, InsertContractor,
  ComplianceStream, InsertComplianceStream,
  CertificateType, InsertCertificateType, ClassificationCode, InsertClassificationCode,
  ExtractionSchema, InsertExtractionSchema, ComplianceRule, InsertComplianceRule,
  NormalisationRule, InsertNormalisationRule,
  ComponentType, InsertComponentType, Unit, InsertUnit, Component, InsertComponent, DataImport, InsertDataImport
} from "@shared/schema";

const API_BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Organisations (HACT: Housing Association)
export const organisationsApi = {
  list: () => fetchJSON<any[]>(`${API_BASE}/organisations`),
  get: (id: string) => fetchJSON<any>(`${API_BASE}/organisations/${id}`),
  create: (data: { name: string; slug: string; settings?: any }) => fetchJSON<any>(`${API_BASE}/organisations`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<{ name: string; slug: string; settings: any }>) => fetchJSON<any>(`${API_BASE}/organisations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/organisations/${id}`, {
    method: "DELETE",
  }),
};

// Schemes (HACT: Site)
export const schemesApi = {
  list: () => fetchJSON<Scheme[]>(`${API_BASE}/schemes`),
  create: (data: Partial<Scheme>) => fetchJSON<Scheme>(`${API_BASE}/schemes`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Scheme>) => fetchJSON<Scheme>(`${API_BASE}/schemes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/schemes/${id}`, {
    method: "DELETE",
  }),
};

// Blocks (HACT: Property/Building)
export const blocksApi = {
  list: (schemeId?: string) => {
    const params = schemeId ? `?schemeId=${schemeId}` : "";
    return fetchJSON<Block[]>(`${API_BASE}/blocks${params}`);
  },
  create: (data: Partial<Block>) => fetchJSON<Block>(`${API_BASE}/blocks`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<Block>) => fetchJSON<Block>(`${API_BASE}/blocks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/blocks/${id}`, {
    method: "DELETE",
  }),
};

// Properties
export interface EnrichedProperty extends Property {
  block?: Block;
  scheme?: Scheme;
  fullAddress?: string;
  certificates?: Certificate[];
  actions?: RemedialAction[];
  components?: Array<Component & { componentType?: ComponentType }>;
}

export const propertiesApi = {
  list: (filters?: { blockId?: string; schemeId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.blockId) params.append("blockId", filters.blockId);
    if (filters?.schemeId) params.append("schemeId", filters.schemeId);
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON<EnrichedProperty[]>(`${API_BASE}/properties${query}`);
  },
  
  get: (id: string) => fetchJSON<EnrichedProperty>(`${API_BASE}/properties/${id}`),
  
  create: (data: InsertProperty) => fetchJSON<Property>(`${API_BASE}/properties`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<Property>) => fetchJSON<Property>(`${API_BASE}/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  autoCreate: (addressData: { addressLine1: string; city?: string; postcode?: string }) => 
    fetchJSON<Property>(`${API_BASE}/properties/auto-create`, {
      method: "POST",
      body: JSON.stringify(addressData),
    }),
  
  bulkDelete: (ids: string[]) => 
    fetchJSON<{ success: boolean; deleted: number }>(`${API_BASE}/properties/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  
  bulkVerify: (ids: string[]) => 
    fetchJSON<{ success: boolean; verified: number }>(`${API_BASE}/properties/bulk-verify`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  bulkReject: (ids: string[]) => 
    fetchJSON<{ success: boolean; rejected: number }>(`${API_BASE}/properties/bulk-reject`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

// Certificates
export interface EnrichedCertificate extends Certificate {
  property?: Property;
  extractedData?: any;
  extraction?: any;
  actions?: RemedialAction[];
}

export interface CertificateUploadData {
  propertyId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  certificateType: string;
  storageKey?: string | null;
  fileBase64?: string;
  mimeType?: string;
}

export const certificatesApi = {
  list: (filters?: { propertyId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.propertyId) params.append("propertyId", filters.propertyId);
    if (filters?.status) params.append("status", filters.status);
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON<EnrichedCertificate[]>(`${API_BASE}/certificates${query}`);
  },
  
  get: (id: string) => fetchJSON<EnrichedCertificate>(`${API_BASE}/certificates/${id}`),
  
  create: (data: CertificateUploadData) => fetchJSON<Certificate>(`${API_BASE}/certificates`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<Certificate>) => fetchJSON<Certificate>(`${API_BASE}/certificates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
};

// Remedial Actions
export interface EnrichedRemedialAction extends RemedialAction {
  property?: Property & {
    schemeName?: string;
    blockName?: string;
  };
  certificate?: Certificate;
  schemeName?: string;
  blockName?: string;
  propertyAddress?: string;
}

export const actionsApi = {
  list: (filters?: { propertyId?: string; status?: string; certificateId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.propertyId) params.append("propertyId", filters.propertyId);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.certificateId) params.append("certificateId", filters.certificateId);
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON<EnrichedRemedialAction[]>(`${API_BASE}/actions${query}`);
  },
  
  update: (id: string, data: Partial<RemedialAction>) => fetchJSON<RemedialAction>(`${API_BASE}/actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
};

// Admin / Demo Data Management
export const adminApi = {
  wipeData: (includeProperties: boolean = false) => 
    fetchJSON<{ success: boolean; message: string }>(`${API_BASE}/admin/wipe-data`, {
      method: "POST",
      body: JSON.stringify({ includeProperties }),
    }),
  
  seedDemo: () => 
    fetchJSON<{ success: boolean; message: string }>(`${API_BASE}/admin/seed-demo`, {
      method: "POST",
    }),
  
  resetDemo: () => 
    fetchJSON<{ success: boolean; message: string }>(`${API_BASE}/admin/reset-demo`, {
      method: "POST",
    }),
};

// User Types and API
export interface SafeUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OFFICER' | 'VIEWER';
  organisationId: string;
  createdAt: string;
}

export const usersApi = {
  list: () => fetchJSON<SafeUser[]>(`${API_BASE}/users`),
  
  updateRole: (userId: string, role: string, requesterId: string) => 
    fetchJSON<SafeUser>(`${API_BASE}/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role, requesterId }),
    }),
};

// Contractors
export const contractorsApi = {
  list: () => fetchJSON<Contractor[]>(`${API_BASE}/contractors`),
  
  get: (id: string) => fetchJSON<Contractor>(`${API_BASE}/contractors/${id}`),
  
  create: (data: Omit<InsertContractor, 'organisationId'>) => fetchJSON<Contractor>(`${API_BASE}/contractors`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<Contractor>) => fetchJSON<Contractor>(`${API_BASE}/contractors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  updateStatus: (id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') => 
    fetchJSON<Contractor>(`${API_BASE}/contractors/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  
  bulkApprove: (ids: string[]) => 
    fetchJSON<{ success: boolean; approved: number }>(`${API_BASE}/contractors/bulk-approve`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  
  bulkReject: (ids: string[]) => 
    fetchJSON<{ success: boolean; rejected: number }>(`${API_BASE}/contractors/bulk-reject`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

// Configuration - Compliance Streams
export const complianceStreamsApi = {
  list: () => fetchJSON<ComplianceStream[]>(`${API_BASE}/config/compliance-streams`),
  
  get: (id: string) => fetchJSON<ComplianceStream>(`${API_BASE}/config/compliance-streams/${id}`),
  
  create: (data: InsertComplianceStream) => fetchJSON<ComplianceStream>(`${API_BASE}/config/compliance-streams`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertComplianceStream>) => fetchJSON<ComplianceStream>(`${API_BASE}/config/compliance-streams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/compliance-streams/${id}`, {
    method: "DELETE",
  }),
};

// Configuration - Certificate Types
export const certificateTypesApi = {
  list: () => fetchJSON<CertificateType[]>(`${API_BASE}/config/certificate-types`),
  
  get: (id: string) => fetchJSON<CertificateType>(`${API_BASE}/config/certificate-types/${id}`),
  
  create: (data: InsertCertificateType) => fetchJSON<CertificateType>(`${API_BASE}/config/certificate-types`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertCertificateType>) => fetchJSON<CertificateType>(`${API_BASE}/config/certificate-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/certificate-types/${id}`, {
    method: "DELETE",
  }),
};

// Configuration - Classification Codes
export const classificationCodesApi = {
  list: (certificateTypeId?: string) => {
    const params = certificateTypeId ? `?certificateTypeId=${certificateTypeId}` : "";
    return fetchJSON<ClassificationCode[]>(`${API_BASE}/config/classification-codes${params}`);
  },
  
  get: (id: string) => fetchJSON<ClassificationCode>(`${API_BASE}/config/classification-codes/${id}`),
  
  create: (data: InsertClassificationCode) => fetchJSON<ClassificationCode>(`${API_BASE}/config/classification-codes`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertClassificationCode>) => fetchJSON<ClassificationCode>(`${API_BASE}/config/classification-codes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/classification-codes/${id}`, {
    method: "DELETE",
  }),
};

// Configuration - Extraction Schemas
export const extractionSchemasApi = {
  list: () => fetchJSON<ExtractionSchema[]>(`${API_BASE}/config/extraction-schemas`),
  
  get: (id: string) => fetchJSON<ExtractionSchema>(`${API_BASE}/config/extraction-schemas/${id}`),
  
  create: (data: InsertExtractionSchema) => fetchJSON<ExtractionSchema>(`${API_BASE}/config/extraction-schemas`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertExtractionSchema>) => fetchJSON<ExtractionSchema>(`${API_BASE}/config/extraction-schemas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/extraction-schemas/${id}`, {
    method: "DELETE",
  }),
};

// Configuration - Compliance Rules
export const complianceRulesApi = {
  list: () => fetchJSON<ComplianceRule[]>(`${API_BASE}/config/compliance-rules`),
  
  get: (id: string) => fetchJSON<ComplianceRule>(`${API_BASE}/config/compliance-rules/${id}`),
  
  create: (data: InsertComplianceRule) => fetchJSON<ComplianceRule>(`${API_BASE}/config/compliance-rules`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertComplianceRule>) => fetchJSON<ComplianceRule>(`${API_BASE}/config/compliance-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/compliance-rules/${id}`, {
    method: "DELETE",
  }),
};

// Configuration - Normalisation Rules
export const normalisationRulesApi = {
  list: () => fetchJSON<NormalisationRule[]>(`${API_BASE}/config/normalisation-rules`),
  
  get: (id: string) => fetchJSON<NormalisationRule>(`${API_BASE}/config/normalisation-rules/${id}`),
  
  create: (data: InsertNormalisationRule) => fetchJSON<NormalisationRule>(`${API_BASE}/config/normalisation-rules`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertNormalisationRule>) => fetchJSON<NormalisationRule>(`${API_BASE}/config/normalisation-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/config/normalisation-rules/${id}`, {
    method: "DELETE",
  }),
};

// HACT Architecture - Component Types
export const componentTypesApi = {
  list: () => fetchJSON<ComponentType[]>(`${API_BASE}/component-types`),
  
  get: (id: string) => fetchJSON<ComponentType>(`${API_BASE}/component-types/${id}`),
  
  create: (data: InsertComponentType) => fetchJSON<ComponentType>(`${API_BASE}/component-types`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertComponentType>) => fetchJSON<ComponentType>(`${API_BASE}/component-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/component-types/${id}`, {
    method: "DELETE",
  }),
};

// HACT Architecture - Units
export const unitsApi = {
  list: (propertyId?: string) => {
    const params = propertyId ? `?propertyId=${propertyId}` : "";
    return fetchJSON<Unit[]>(`${API_BASE}/units${params}`);
  },
  
  get: (id: string) => fetchJSON<Unit>(`${API_BASE}/units/${id}`),
  
  create: (data: InsertUnit) => fetchJSON<Unit>(`${API_BASE}/units`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertUnit>) => fetchJSON<Unit>(`${API_BASE}/units/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/units/${id}`, {
    method: "DELETE",
  }),
};

// HACT Architecture - Components (Assets)
export interface EnrichedComponent extends Component {
  componentType?: ComponentType;
  property?: { id: string; addressLine1: string; postcode: string };
}

export const componentsApi = {
  list: (filters?: { propertyId?: string; unitId?: string; blockId?: string; componentTypeId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.propertyId) params.append("propertyId", filters.propertyId);
    if (filters?.unitId) params.append("unitId", filters.unitId);
    if (filters?.blockId) params.append("blockId", filters.blockId);
    if (filters?.componentTypeId) params.append("componentTypeId", filters.componentTypeId);
    const query = params.toString() ? `?${params}` : "";
    return fetchJSON<EnrichedComponent[]>(`${API_BASE}/components${query}`);
  },
  
  get: (id: string) => fetchJSON<EnrichedComponent>(`${API_BASE}/components/${id}`),
  
  create: (data: InsertComponent) => fetchJSON<Component>(`${API_BASE}/components`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertComponent>) => fetchJSON<Component>(`${API_BASE}/components/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/components/${id}`, {
    method: "DELETE",
  }),
  
  bulkApprove: (ids: string[]) => fetchJSON<{ success: boolean; approved: number }>(`${API_BASE}/components/bulk-approve`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  }),
  
  bulkReject: (ids: string[]) => fetchJSON<{ success: boolean; rejected: number }>(`${API_BASE}/components/bulk-reject`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  }),
  
  bulkDelete: (ids: string[]) => fetchJSON<{ success: boolean; deleted: number }>(`${API_BASE}/components/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  }),
};

// Data Imports
export interface DataImportWithCounts extends DataImport {
  total?: number;
  valid?: number;
  invalid?: number;
  imported?: number;
}

export const dataImportsApi = {
  list: () => fetchJSON<DataImport[]>(`${API_BASE}/imports`),
  
  get: (id: string) => fetchJSON<DataImportWithCounts>(`${API_BASE}/imports/${id}`),
  
  getRows: (id: string) => fetchJSON<any[]>(`${API_BASE}/imports/${id}/rows`),
  
  create: (data: Partial<InsertDataImport>) => fetchJSON<DataImport>(`${API_BASE}/imports`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<InsertDataImport>) => fetchJSON<DataImport>(`${API_BASE}/imports/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => fetchJSON<{ success: boolean }>(`${API_BASE}/imports/${id}`, {
    method: "DELETE",
  }),
  
  validate: (id: string, csvContent: string) => fetchJSON<{ importId: string; totalRows: number; validRows: number; invalidRows: number; errors: any[] }>(`${API_BASE}/imports/${id}/validate`, {
    method: "POST",
    body: JSON.stringify({ csvContent }),
  }),
  
  execute: (id: string) => fetchJSON<{ success: boolean; totalRows: number; importedRows: number; errors: any[] }>(`${API_BASE}/imports/${id}/execute`, {
    method: "POST",
  }),
  
  getTemplate: (type: string) => fetchJSON<{ columns: Array<{ name: string; required: boolean; description: string }> }>(`${API_BASE}/imports/templates/${type}`),
  
  downloadTemplate: (type: string) => `${API_BASE}/imports/templates/${type}/download`,
  
  downloadSample: (type: string) => `${API_BASE}/imports/samples/${type}/download`,
};

// TSM Reports
export interface TSMReport {
  period: string;
  reportDate: string;
  metrics: {
    BS01: { name: string; description: string; value: number; total: number; unit: string };
    BS02: { name: string; description: string; value: number; total: number; upToDate: number; unit: string };
    BS03: { name: string; description: string; value: number; bySeverity: Record<string, number>; unit: string };
    BS04: { name: string; description: string; value: number; byType: Array<{ type: string; count: number }>; unit: string };
    BS05: { name: string; description: string; value: number; notified: number; pending: number; unit: string };
    BS06: { name: string; description: string; value: number; alerts: any[]; unit: string };
  };
  summary: {
    totalHighRiskComponents: number;
    totalCertificates: number;
    totalRemedialActions: number;
    complianceScore: number;
  };
}

export const reportsApi = {
  getTSMBuildingSafety: (period?: string) => {
    const params = period ? `?period=${period}` : "";
    return fetchJSON<TSMReport>(`${API_BASE}/reports/tsm-building-safety${params}`);
  },
};
