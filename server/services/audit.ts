import { storage } from '../storage';
import type { InsertAuditEvent, AuditEvent } from '@shared/schema';
import type { Request } from 'express';

type AuditActorType = 'USER' | 'SYSTEM' | 'API';
type AuditEventType = 
  | 'CERTIFICATE_UPLOADED' | 'CERTIFICATE_PROCESSED' | 'CERTIFICATE_STATUS_CHANGED' 
  | 'CERTIFICATE_APPROVED' | 'CERTIFICATE_REJECTED' | 'CERTIFICATE_DELETED'
  | 'EXTRACTION_COMPLETED' | 'REMEDIAL_ACTION_CREATED' | 'REMEDIAL_ACTION_UPDATED' 
  | 'REMEDIAL_ACTION_COMPLETED' | 'PROPERTY_CREATED' | 'PROPERTY_UPDATED' | 'PROPERTY_DELETED'
  | 'COMPONENT_CREATED' | 'COMPONENT_UPDATED' | 'USER_LOGIN' | 'USER_LOGOUT' 
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_ROLE_CHANGED' | 'SETTINGS_CHANGED'
  | 'API_KEY_CREATED' | 'API_KEY_REVOKED' | 'BULK_IMPORT_COMPLETED';
type AuditEntityType = 'CERTIFICATE' | 'PROPERTY' | 'COMPONENT' | 'REMEDIAL_ACTION' | 'USER' | 'ORGANISATION' | 'API_KEY' | 'SETTINGS';

interface AuditContext {
  actorId?: string;
  actorName?: string;
  actorType?: AuditActorType;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAudit(params: {
  organisationId: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  message: string;
  propertyId?: string;
  certificateId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}): Promise<AuditEvent | null> {
  try {
    const event: InsertAuditEvent = {
      organisationId: params.organisationId,
      actorId: params.context?.actorId || null,
      actorName: params.context?.actorName || 'System',
      actorType: params.context?.actorType || 'SYSTEM',
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName || null,
      propertyId: params.propertyId || null,
      certificateId: params.certificateId || null,
      beforeState: params.beforeState || null,
      afterState: params.afterState || null,
      changes: params.changes || null,
      message: params.message,
      metadata: params.metadata || null,
      ipAddress: params.context?.ipAddress || null,
      userAgent: params.context?.userAgent || null,
    };
    
    return await storage.recordAuditEvent(event);
  } catch (error) {
    console.error('Failed to record audit event:', error);
    return null;
  }
}

export function getChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before || !after) return null;
  
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  
  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

interface RequestWithSession extends Request {
  session?: {
    userId?: string;
    username?: string;
  };
}

export function extractAuditContext(req: RequestWithSession): AuditContext {
  return {
    actorId: req.session?.userId || undefined,
    actorName: req.session?.username || undefined,
    actorType: 'USER',
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
    userAgent: req.headers['user-agent'] as string,
  };
}
