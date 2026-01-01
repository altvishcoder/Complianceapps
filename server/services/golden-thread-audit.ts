import { storage } from "../storage";
import { db } from "../db";
import { auditEvents } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { InsertAuditFieldChange, InsertAuditEvent } from "@shared/schema";

type ChangeScope = 'PROPERTY' | 'COMPONENT' | 'BUILDING_FABRIC' | 'CERTIFICATE' | 'REMEDIAL_ACTION' | 'CONTRACTOR' | 'USER' | 'SETTINGS' | 'SCHEME' | 'BLOCK';

interface FieldChange {
  fieldName: string;
  fieldLabel?: string;
  previousValue: any;
  newValue: any;
  isSignificant?: boolean;
}

interface AuditContext {
  organisationId: string;
  actorId: string;
  actorName: string;
  actorType?: 'USER' | 'SYSTEM' | 'API';
  ipAddress?: string;
  userAgent?: string;
}

const SIGNIFICANT_FIELDS: Record<string, string[]> = {
  properties: ['addressLine1', 'postcode', 'propertyType', 'tenure', 'hasGas', 'hasAsbestos', 'vulnerableOccupant'],
  blocks: ['name', 'hasLift', 'hasCommunalBoiler'],
  schemes: ['name', 'reference'],
  components: ['manufacturer', 'modelNumber', 'installDate', 'lastServiceDate', 'nextServiceDate', 'status'],
  certificates: ['status', 'outcome', 'expiryDate', 'certificateNumber'],
  contractors: ['status', 'gasRegistration', 'electricalRegistration'],
  remedial_actions: ['status', 'severity', 'dueDate', 'resolvedAt'],
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  properties: {
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2',
    city: 'City',
    postcode: 'Postcode',
    propertyType: 'Property Type',
    tenure: 'Tenure',
    hasGas: 'Has Gas',
    hasAsbestos: 'Has Asbestos',
    vulnerableOccupant: 'Vulnerable Occupant',
    epcRating: 'EPC Rating',
    constructionYear: 'Construction Year',
    numberOfFloors: 'Number of Floors',
  },
  blocks: {
    name: 'Block Name',
    reference: 'Block Reference',
    hasLift: 'Has Lift',
    hasCommunalBoiler: 'Has Communal Boiler',
  },
  schemes: {
    name: 'Scheme Name',
    reference: 'Scheme Reference',
  },
  components: {
    manufacturer: 'Manufacturer',
    modelNumber: 'Model Number',
    serialNumber: 'Serial Number',
    installDate: 'Install Date',
    lastServiceDate: 'Last Service Date',
    nextServiceDate: 'Next Service Date',
    status: 'Status',
    location: 'Location',
    notes: 'Notes',
  },
  certificates: {
    status: 'Certificate Status',
    outcome: 'Outcome',
    expiryDate: 'Expiry Date',
    issueDate: 'Issue Date',
    certificateNumber: 'Certificate Number',
  },
  contractors: {
    companyName: 'Company Name',
    status: 'Contractor Status',
    gasRegistration: 'Gas Safe Registration',
    electricalRegistration: 'Electrical Registration',
    contactEmail: 'Contact Email',
    contactPhone: 'Contact Phone',
  },
  remedial_actions: {
    status: 'Action Status',
    severity: 'Severity',
    dueDate: 'Due Date',
    resolvedAt: 'Resolved At',
    description: 'Description',
    location: 'Location',
    costEstimate: 'Cost Estimate',
  },
};

function getChangeScope(tableName: string): ChangeScope {
  const mapping: Record<string, ChangeScope> = {
    properties: 'PROPERTY',
    blocks: 'BLOCK',
    schemes: 'SCHEME',
    components: 'COMPONENT',
    certificates: 'CERTIFICATE',
    remedial_actions: 'REMEDIAL_ACTION',
    contractors: 'CONTRACTOR',
    users: 'USER',
  };
  return mapping[tableName] || 'SETTINGS';
}

function detectFieldChanges(
  tableName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): FieldChange[] {
  const changes: FieldChange[] = [];
  const significantFields = SIGNIFICANT_FIELDS[tableName] || [];
  const labels = FIELD_LABELS[tableName] || {};
  
  const ignoredFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'organisationId'];
  
  const allKeys = Array.from(new Set([...Object.keys(beforeState), ...Object.keys(afterState)]));
  
  for (const key of allKeys) {
    if (ignoredFields.includes(key)) continue;
    
    const prevValue = beforeState[key];
    const newValue = afterState[key];
    
    if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
      changes.push({
        fieldName: key,
        fieldLabel: labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()),
        previousValue: prevValue,
        newValue: newValue,
        isSignificant: significantFields.includes(key),
      });
    }
  }
  
  return changes;
}

export async function recordFieldLevelAudit(
  context: AuditContext,
  tableName: string,
  recordId: string,
  entityName: string,
  eventType: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>,
  message?: string,
  metadata?: Record<string, any>
): Promise<string | null> {
  try {
    const changes = detectFieldChanges(tableName, beforeState, afterState);
    
    if (changes.length === 0) {
      return null;
    }
    
    const changeScope = getChangeScope(tableName);
    const entityType = changeScope === 'PROPERTY' ? 'PROPERTY' 
      : changeScope === 'COMPONENT' ? 'COMPONENT'
      : changeScope === 'CERTIFICATE' ? 'CERTIFICATE'
      : changeScope === 'REMEDIAL_ACTION' ? 'REMEDIAL_ACTION'
      : changeScope === 'CONTRACTOR' ? 'ORGANISATION'
      : 'SETTINGS';
    
    const significantChanges = changes.filter(c => c.isSignificant);
    const changesSummary = changes.map(c => `${c.fieldLabel || c.fieldName}`).join(', ');
    
    const auditEvent: InsertAuditEvent = {
      organisationId: context.organisationId,
      actorId: context.actorId,
      actorName: context.actorName,
      actorType: context.actorType || 'USER',
      eventType: eventType as any,
      entityType: entityType as any,
      entityId: recordId,
      entityName: entityName,
      beforeState: beforeState,
      afterState: afterState,
      changes: { fieldCount: changes.length, significantCount: significantChanges.length, fields: changes.map(c => c.fieldName) },
      message: message || `Updated ${changesSummary}`,
      metadata: { ...metadata, changeScope, tableName },
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    };
    
    const [auditEventResult] = await db.insert(auditEvents).values(auditEvent).returning();
    
    if (changes.length > 0) {
      const fieldChanges: InsertAuditFieldChange[] = changes.map(change => ({
        auditEventId: auditEventResult.id,
        tableName,
        recordId,
        changeScope,
        fieldName: change.fieldName,
        fieldLabel: change.fieldLabel || null,
        previousValue: change.previousValue,
        newValue: change.newValue,
        isSignificant: change.isSignificant || false,
      }));
      
      await storage.createAuditFieldChanges(fieldChanges);
    }
    
    return auditEventResult.id;
  } catch (error) {
    console.error('Error recording field-level audit:', error);
    return null;
  }
}

export async function recordPropertyUpdate(
  context: AuditContext,
  propertyId: string,
  propertyName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'properties',
    propertyId,
    propertyName,
    'PROPERTY_UPDATED',
    beforeState,
    afterState
  );
}

export async function recordComponentUpdate(
  context: AuditContext,
  componentId: string,
  componentName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'components',
    componentId,
    componentName,
    'COMPONENT_UPDATED',
    beforeState,
    afterState
  );
}

export async function recordBlockUpdate(
  context: AuditContext,
  blockId: string,
  blockName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'blocks',
    blockId,
    blockName,
    'PROPERTY_UPDATED',
    beforeState,
    afterState,
    `Updated block: ${blockName}`
  );
}

export async function recordSchemeUpdate(
  context: AuditContext,
  schemeId: string,
  schemeName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'schemes',
    schemeId,
    schemeName,
    'PROPERTY_UPDATED',
    beforeState,
    afterState,
    `Updated scheme: ${schemeName}`
  );
}

export async function recordCertificateUpdate(
  context: AuditContext,
  certificateId: string,
  certificateName: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'certificates',
    certificateId,
    certificateName,
    'CERTIFICATE_STATUS_CHANGED',
    beforeState,
    afterState
  );
}

export async function recordRemedialActionUpdate(
  context: AuditContext,
  actionId: string,
  actionDescription: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>
): Promise<string | null> {
  return recordFieldLevelAudit(
    context,
    'remedial_actions',
    actionId,
    actionDescription,
    'REMEDIAL_ACTION_UPDATED',
    beforeState,
    afterState
  );
}

export async function getAuditTrailForEntity(
  organisationId: string,
  entityType: string,
  entityId: string
): Promise<any[]> {
  const events = await db.select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organisationId, organisationId),
        eq(auditEvents.entityId, entityId)
      )
    )
    .orderBy(desc(auditEvents.createdAt));
  
  const enrichedEvents = await Promise.all(
    events.map(async (event) => {
      const fieldChanges = await storage.listAuditFieldChanges(event.id);
      return {
        ...event,
        fieldChanges,
      };
    })
  );
  
  return enrichedEvents;
}
