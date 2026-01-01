import { storage } from "../storage";
import { db } from "../db";
import { 
  organisations, schemes, blocks, properties, units, components, 
  certificates, certificateVersions, remedialActions, auditEvents, auditFieldChanges
} from "@shared/schema";
import { eq, and, gte, lte, inArray, isNull, desc } from "drizzle-orm";
import type { UkhdsExport } from "@shared/schema";

interface UKHDSAssetHierarchy {
  exportMetadata: {
    exportId: string;
    organisationId: string;
    exportedAt: string;
    format: string;
    version: string;
    totalRecords: number;
    dataRangeStart?: string;
    dataRangeEnd?: string;
  };
  organisation: {
    id: string;
    name: string;
    slug: string;
    schemes: UKHDSScheme[];
  };
  auditTrail?: UKHDSAuditEvent[];
}

interface UKHDSScheme {
  id: string;
  name: string;
  reference: string;
  complianceStatus: string;
  blocks: UKHDSBlock[];
}

interface UKHDSBlock {
  id: string;
  name: string;
  reference: string;
  hasLift: boolean;
  hasCommunalBoiler: boolean;
  complianceStatus: string;
  properties: UKHDSProperty[];
}

interface UKHDSProperty {
  id: string;
  uprn: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  propertyType: string;
  tenure: string;
  bedrooms: number;
  hasGas: boolean;
  hasAsbestos: boolean;
  vulnerableOccupant: boolean;
  epcRating?: string;
  constructionYear?: number;
  complianceStatus: string;
  units?: UKHDSUnit[];
  components?: UKHDSComponent[];
  certificates?: UKHDSCertificate[];
  remedialActions?: UKHDSRemedialAction[];
}

interface UKHDSUnit {
  id: string;
  name: string;
  floor?: string;
  components: UKHDSComponent[];
}

interface UKHDSComponent {
  id: string;
  componentTypeCode: string;
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  installDate?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  status: string;
  location?: string;
}

interface UKHDSCertificate {
  id: string;
  certificateType: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status: string;
  outcome?: string;
  versions?: UKHDSCertificateVersion[];
}

interface UKHDSCertificateVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  uploadedAt: string;
  supersededAt?: string;
  supersededReason?: string;
}

interface UKHDSRemedialAction {
  id: string;
  code?: string;
  category?: string;
  description: string;
  severity: string;
  status: string;
  dueDate?: string;
  resolvedAt?: string;
  costEstimate?: string;
}

interface UKHDSAuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  actorName?: string;
  message: string;
  createdAt: string;
  fieldChanges?: {
    fieldName: string;
    previousValue: any;
    newValue: any;
  }[];
}

export async function generateUKHDSExport(exportJob: UkhdsExport): Promise<UKHDSAssetHierarchy> {
  const org = await storage.getOrganisation(exportJob.organisationId);
  if (!org) {
    throw new Error('Organisation not found');
  }
  
  let schemeFilter = exportJob.schemeIds && exportJob.schemeIds.length > 0 
    ? exportJob.schemeIds 
    : null;
  
  const allSchemes = await db.select().from(schemes)
    .where(
      and(
        eq(schemes.organisationId, exportJob.organisationId),
        isNull(schemes.deletedAt)
      )
    );
  
  const filteredSchemes = schemeFilter 
    ? allSchemes.filter(s => schemeFilter!.includes(s.id))
    : allSchemes;
  
  let totalRecords = 0;
  const ukhdsSchemes: UKHDSScheme[] = [];
  
  for (const scheme of filteredSchemes) {
    totalRecords++;
    
    const schemeBlocks = await db.select().from(blocks)
      .where(
        and(
          eq(blocks.schemeId, scheme.id),
          isNull(blocks.deletedAt)
        )
      );
    
    const ukhdsBlocks: UKHDSBlock[] = [];
    
    for (const block of schemeBlocks) {
      totalRecords++;
      
      const blockProperties = await db.select().from(properties)
        .where(
          and(
            eq(properties.blockId, block.id),
            isNull(properties.deletedAt)
          )
        );
      
      const ukhdsProperties: UKHDSProperty[] = [];
      
      for (const property of blockProperties) {
        totalRecords++;
        
        const ukhdsProperty: UKHDSProperty = {
          id: property.id,
          uprn: property.uprn,
          addressLine1: property.addressLine1,
          addressLine2: property.addressLine2 || undefined,
          city: property.city,
          postcode: property.postcode,
          propertyType: property.propertyType,
          tenure: property.tenure,
          bedrooms: property.bedrooms,
          hasGas: property.hasGas,
          hasAsbestos: property.hasAsbestos,
          vulnerableOccupant: property.vulnerableOccupant,
          epcRating: property.epcRating || undefined,
          constructionYear: property.constructionYear || undefined,
          complianceStatus: property.complianceStatus,
        };
        
        if (exportJob.includeComponents) {
          const propertyUnits = await db.select().from(units)
            .where(
              and(
                eq(units.propertyId, property.id),
                isNull(units.deletedAt)
              )
            );
          
          const ukhdsUnits: UKHDSUnit[] = [];
          
          for (const unit of propertyUnits) {
            totalRecords++;
            const unitComponents = await db.select().from(components)
              .where(
                and(
                  eq(components.unitId, unit.id),
                  isNull(components.deletedAt)
                )
              );
            
            const ukhdsComponents: UKHDSComponent[] = unitComponents.map(c => {
              totalRecords++;
              return {
                id: c.id,
                componentTypeCode: c.componentTypeId || '',
                manufacturer: c.manufacturer || undefined,
                modelNumber: c.model || undefined,
                serialNumber: c.serialNumber || undefined,
                installDate: c.installDate || undefined,
                lastServiceDate: c.lastInspectionDate || undefined,
                nextServiceDate: c.nextServiceDue || undefined,
                status: c.condition || 'UNKNOWN',
                location: c.location || undefined,
              };
            });
            
            ukhdsUnits.push({
              id: unit.id,
              name: unit.name,
              floor: unit.floor || undefined,
              components: ukhdsComponents,
            });
          }
          
          ukhdsProperty.units = ukhdsUnits;
          
          const directComponents = await db.select().from(components)
            .where(
              and(
                eq(components.propertyId, property.id),
                isNull(components.unitId),
                isNull(components.deletedAt)
              )
            );
          
          ukhdsProperty.components = directComponents.map(c => {
            totalRecords++;
            return {
              id: c.id,
              componentTypeCode: c.componentTypeId || '',
              manufacturer: c.manufacturer || undefined,
              modelNumber: c.model || undefined,
              serialNumber: c.serialNumber || undefined,
              installDate: c.installDate || undefined,
              lastServiceDate: c.lastInspectionDate || undefined,
              nextServiceDate: c.nextServiceDue || undefined,
              status: c.condition || 'UNKNOWN',
              location: c.location || undefined,
            };
          });
        }
        
        if (exportJob.includeCertificates) {
          let certQuery = db.select().from(certificates)
            .where(
              and(
                eq(certificates.propertyId, property.id),
                isNull(certificates.deletedAt)
              )
            );
          
          const propertyCertificates = await certQuery;
          
          const ukhdsCertificates: UKHDSCertificate[] = [];
          
          for (const cert of propertyCertificates) {
            totalRecords++;
            
            const ukhdsCert: UKHDSCertificate = {
              id: cert.id,
              certificateType: cert.certificateType,
              certificateNumber: cert.certificateNumber || undefined,
              issueDate: cert.issueDate || undefined,
              expiryDate: cert.expiryDate || undefined,
              status: cert.status,
              outcome: cert.outcome || undefined,
            };
            
            if (exportJob.includeCertificateVersions) {
              const versions = await db.select().from(certificateVersions)
                .where(eq(certificateVersions.certificateId, cert.id))
                .orderBy(desc(certificateVersions.versionNumber));
              
              ukhdsCert.versions = versions.map(v => {
                totalRecords++;
                return {
                  id: v.id,
                  versionNumber: v.versionNumber,
                  fileName: v.fileName,
                  uploadedAt: v.createdAt.toISOString(),
                  supersededAt: v.supersededAt?.toISOString(),
                  supersededReason: v.supersededReason || undefined,
                };
              });
            }
            
            ukhdsCertificates.push(ukhdsCert);
          }
          
          ukhdsProperty.certificates = ukhdsCertificates;
        }
        
        if (exportJob.includeRemedialActions) {
          const propertyActions = await db.select().from(remedialActions)
            .where(
              and(
                eq(remedialActions.propertyId, property.id),
                isNull(remedialActions.deletedAt)
              )
            );
          
          ukhdsProperty.remedialActions = propertyActions.map(a => {
            totalRecords++;
            return {
              id: a.id,
              code: a.code || undefined,
              category: a.category || undefined,
              description: a.description,
              severity: a.severity,
              status: a.status,
              dueDate: a.dueDate || undefined,
              resolvedAt: a.resolvedAt?.toISOString(),
              costEstimate: a.costEstimate || undefined,
            };
          });
        }
        
        ukhdsProperties.push(ukhdsProperty);
      }
      
      ukhdsBlocks.push({
        id: block.id,
        name: block.name,
        reference: block.reference,
        hasLift: block.hasLift,
        hasCommunalBoiler: block.hasCommunalBoiler,
        complianceStatus: block.complianceStatus,
        properties: ukhdsProperties,
      });
    }
    
    ukhdsSchemes.push({
      id: scheme.id,
      name: scheme.name,
      reference: scheme.reference,
      complianceStatus: scheme.complianceStatus,
      blocks: ukhdsBlocks,
    });
  }
  
  const result: UKHDSAssetHierarchy = {
    exportMetadata: {
      exportId: exportJob.id,
      organisationId: exportJob.organisationId,
      exportedAt: new Date().toISOString(),
      format: 'UKHDS-1.0',
      version: '1.0.0',
      totalRecords,
      dataRangeStart: exportJob.dateRangeStart?.toISOString(),
      dataRangeEnd: exportJob.dateRangeEnd?.toISOString(),
    },
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      schemes: ukhdsSchemes,
    },
  };
  
  if (exportJob.includeAuditTrail) {
    const auditEventsData = await db.select().from(auditEvents)
      .where(eq(auditEvents.organisationId, exportJob.organisationId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1000);
    
    const ukhdsAuditEvents: UKHDSAuditEvent[] = [];
    
    for (const event of auditEventsData) {
      totalRecords++;
      
      const fieldChanges = await db.select().from(auditFieldChanges)
        .where(eq(auditFieldChanges.auditEventId, event.id));
      
      ukhdsAuditEvents.push({
        id: event.id,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        entityName: event.entityName || undefined,
        actorName: event.actorName || undefined,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
        fieldChanges: fieldChanges.map(fc => ({
          fieldName: fc.fieldName,
          previousValue: fc.previousValue,
          newValue: fc.newValue,
        })),
      });
    }
    
    result.auditTrail = ukhdsAuditEvents;
  }
  
  return result;
}

export async function processExportJob(exportId: string): Promise<void> {
  const exportJob = await storage.getUkhdsExport(exportId);
  if (!exportJob) {
    throw new Error('Export job not found');
  }
  
  try {
    await storage.updateUkhdsExport(exportId, {
      status: 'PROCESSING',
      startedAt: new Date(),
    } as any);
    
    const exportData = await generateUKHDSExport(exportJob);
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    
    await storage.updateUkhdsExport(exportId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      totalRecords: exportData.exportMetadata.totalRecords,
      processedRecords: exportData.exportMetadata.totalRecords,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } as any);
    
    console.log(`UKHDS Export ${exportId} completed successfully with ${exportData.exportMetadata.totalRecords} records`);
    
  } catch (error: any) {
    await storage.updateUkhdsExport(exportId, {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error.message,
    } as any);
    
    console.error(`UKHDS Export ${exportId} failed:`, error);
    throw error;
  }
}
