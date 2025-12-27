// ComplianceAI API Client
import type { 
  Property, Certificate, RemedialAction,
  Scheme, Block, InsertProperty, InsertCertificate, Contractor, InsertContractor 
} from "@shared/schema";

const API_BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
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

// Schemes
export const schemesApi = {
  list: () => fetchJSON<Scheme[]>(`${API_BASE}/schemes`),
  create: (data: Partial<Scheme>) => fetchJSON<Scheme>(`${API_BASE}/schemes`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
};

// Blocks
export const blocksApi = {
  list: (schemeId?: string) => {
    const params = schemeId ? `?schemeId=${schemeId}` : "";
    return fetchJSON<Block[]>(`${API_BASE}/blocks${params}`);
  },
  create: (data: Partial<Block>) => fetchJSON<Block>(`${API_BASE}/blocks`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
};

// Properties
export interface EnrichedProperty extends Property {
  block?: Block;
  scheme?: Scheme;
  fullAddress?: string;
  certificates?: Certificate[];
  actions?: RemedialAction[];
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
  property?: Property;
  certificate?: Certificate;
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
