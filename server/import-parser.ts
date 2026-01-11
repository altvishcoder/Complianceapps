import { storage } from "./storage";
import type { InsertProperty, InsertComponent, InsertDataImportRow } from "@shared/schema";

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: Array<{ field: string; error: string; value: string | undefined }>;
  isValid: boolean;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  errors: Array<{ rowNumber: number; errors: Array<{ field: string; error: string; value: any }> }>;
}

const PROPERTY_TYPES = ['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'STUDIO'];
const TENURE_TYPES = ['SOCIAL_RENT', 'AFFORDABLE_RENT', 'SHARED_OWNERSHIP', 'LEASEHOLD', 'TEMPORARY'];
const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];
const UNIT_TYPES = ['KITCHEN', 'BEDROOM', 'BATHROOM', 'LIVING_ROOM', 'COMMUNAL', 'HALLWAY', 'STORAGE', 'UTILITY'];

export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

export function validatePropertyRow(row: Record<string, string>, rowNumber: number): ParsedRow {
  const errors: Array<{ field: string; error: string; value: string | undefined }> = [];
  
  if (!row.uprn || row.uprn.trim() === '') {
    errors.push({ field: 'uprn', error: 'UPRN is required', value: row.uprn });
  }
  
  if (!row.addressLine1 || row.addressLine1.trim() === '') {
    errors.push({ field: 'addressLine1', error: 'Address line 1 is required', value: row.addressLine1 });
  }
  
  if (!row.city || row.city.trim() === '') {
    errors.push({ field: 'city', error: 'City is required', value: row.city });
  }
  
  if (!row.postcode || row.postcode.trim() === '') {
    errors.push({ field: 'postcode', error: 'Postcode is required', value: row.postcode });
  }
  
  if (!row.propertyType || !PROPERTY_TYPES.includes(row.propertyType.toUpperCase())) {
    errors.push({ 
      field: 'propertyType', 
      error: `Invalid property type. Must be one of: ${PROPERTY_TYPES.join(', ')}`, 
      value: row.propertyType 
    });
  }
  
  if (!row.tenure || !TENURE_TYPES.includes(row.tenure.toUpperCase())) {
    errors.push({ 
      field: 'tenure', 
      error: `Invalid tenure. Must be one of: ${TENURE_TYPES.join(', ')}`, 
      value: row.tenure 
    });
  }
  
  if (!row.blockReference || row.blockReference.trim() === '') {
    errors.push({ field: 'blockReference', error: 'Block reference is required', value: row.blockReference });
  }
  
  if (row.bedrooms && isNaN(parseInt(row.bedrooms))) {
    errors.push({ field: 'bedrooms', error: 'Bedrooms must be a number', value: row.bedrooms });
  }
  
  return {
    rowNumber,
    data: row,
    errors,
    isValid: errors.length === 0
  };
}

export function validateUnitRow(row: Record<string, string>, rowNumber: number): ParsedRow {
  const errors: Array<{ field: string; error: string; value: string | undefined }> = [];
  
  if (!row.propertyUprn || row.propertyUprn.trim() === '') {
    errors.push({ field: 'propertyUprn', error: 'Property UPRN is required', value: row.propertyUprn });
  }
  
  if (!row.name || row.name.trim() === '') {
    errors.push({ field: 'name', error: 'Unit name is required', value: row.name });
  }
  
  if (!row.unitType || !UNIT_TYPES.includes(row.unitType.toUpperCase())) {
    errors.push({ 
      field: 'unitType', 
      error: `Invalid unit type. Must be one of: ${UNIT_TYPES.join(', ')}`, 
      value: row.unitType 
    });
  }
  
  return {
    rowNumber,
    data: row,
    errors,
    isValid: errors.length === 0
  };
}

export function validateComponentRow(row: Record<string, string>, rowNumber: number): ParsedRow {
  const errors: Array<{ field: string; error: string; value: string | undefined }> = [];
  
  if (!row.propertyUprn && !row.unitReference) {
    errors.push({ 
      field: 'propertyUprn', 
      error: 'Either property UPRN or unit reference is required', 
      value: row.propertyUprn 
    });
  }
  
  if (!row.componentTypeCode || row.componentTypeCode.trim() === '') {
    errors.push({ field: 'componentTypeCode', error: 'Component type code is required', value: row.componentTypeCode });
  }
  
  if (row.condition && !CONDITIONS.includes(row.condition.toUpperCase())) {
    errors.push({ 
      field: 'condition', 
      error: `Invalid condition. Must be one of: ${CONDITIONS.join(', ')}`, 
      value: row.condition 
    });
  }
  
  if (row.installDate && !isValidDate(row.installDate)) {
    errors.push({ field: 'installDate', error: 'Invalid date format. Use YYYY-MM-DD', value: row.installDate });
  }
  
  return {
    rowNumber,
    data: row,
    errors,
    isValid: errors.length === 0
  };
}

function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export async function validateImportData(
  importId: string,
  importType: string,
  rows: Record<string, string>[]
): Promise<{ validRows: ParsedRow[]; invalidRows: ParsedRow[] }> {
  const validRows: ParsedRow[] = [];
  const invalidRows: ParsedRow[] = [];
  
  let validator: (row: Record<string, string>, rowNumber: number) => ParsedRow;
  
  switch (importType.toUpperCase()) {
    case 'PROPERTIES':
      validator = validatePropertyRow;
      break;
    case 'UNITS':
      validator = validateUnitRow;
      break;
    case 'COMPONENTS':
      validator = validateComponentRow;
      break;
    default:
      throw new Error(`Unknown import type: ${importType}`);
  }
  
  for (let i = 0; i < rows.length; i++) {
    const parsed = validator(rows[i], i + 1);
    
    await storage.createDataImportRow({
      importId,
      rowNumber: i + 1,
      status: parsed.isValid ? 'VALID' : 'INVALID',
      sourceData: rows[i],
      validationErrors: parsed.errors.length > 0 ? parsed.errors : null,
    });
    
    if (parsed.isValid) {
      validRows.push(parsed);
    } else {
      invalidRows.push(parsed);
    }
  }
  
  return { validRows, invalidRows };
}

export async function processPropertyImport(
  importId: string,
  rows: ParsedRow[],
  upsertMode: boolean = false
): Promise<ImportResult> {
  let importedRows = 0;
  const errors: Array<{ rowNumber: number; errors: Array<{ field: string; error: string; value: any }> }> = [];
  
  const blocks = await storage.listBlocks();
  const blockMap = new Map(blocks.map(b => [b.reference, b.id]));
  
  for (const row of rows) {
    try {
      const blockId = blockMap.get(row.data.blockReference);
      
      if (!blockId) {
        errors.push({
          rowNumber: row.rowNumber,
          errors: [{ field: 'blockReference', error: `Block not found: ${row.data.blockReference}`, value: row.data.blockReference }]
        });
        continue;
      }
      
      const propertyData: InsertProperty = {
        blockId,
        uprn: row.data.uprn.trim(),
        addressLine1: row.data.addressLine1.trim(),
        addressLine2: row.data.addressLine2?.trim() || null,
        city: row.data.city.trim(),
        postcode: row.data.postcode.trim(),
        propertyType: row.data.propertyType.toUpperCase() as any,
        tenure: row.data.tenure.toUpperCase() as any,
        bedrooms: row.data.bedrooms ? parseInt(row.data.bedrooms) : 1,
        hasGas: row.data.hasGas?.toLowerCase() === 'true',
        source: 'IMPORTED',
      };
      
      await storage.createProperty(propertyData);
      importedRows++;
      
      await storage.updateDataImportRow(row.rowNumber.toString(), {
        status: 'IMPORTED',
        processedAt: new Date(),
      });
      
    } catch (error: any) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'database', error: error.message || 'Failed to create property', value: null }]
      });
    }
  }
  
  return {
    success: errors.length === 0,
    totalRows: rows.length,
    validRows: rows.length,
    invalidRows: 0,
    importedRows,
    errors
  };
}

export async function processComponentImport(
  importId: string,
  rows: ParsedRow[],
  upsertMode: boolean = false
): Promise<ImportResult> {
  let importedRows = 0;
  const errors: Array<{ rowNumber: number; errors: Array<{ field: string; error: string; value: any }> }> = [];
  
  const properties = await storage.listProperties('default-org');
  const propertyMap = new Map(properties.map(p => [p.uprn, p.id]));
  
  const componentTypes = await storage.listComponentTypes();
  const typeMap = new Map(componentTypes.map(t => [t.code, t.id]));
  
  for (const row of rows) {
    try {
      const propertyId = row.data.propertyUprn ? propertyMap.get(row.data.propertyUprn) : null;
      const componentTypeId = typeMap.get(row.data.componentTypeCode?.toUpperCase());
      
      if (!componentTypeId) {
        errors.push({
          rowNumber: row.rowNumber,
          errors: [{ field: 'componentTypeCode', error: `Component type not found: ${row.data.componentTypeCode}`, value: row.data.componentTypeCode }]
        });
        continue;
      }
      
      if (!propertyId && row.data.propertyUprn) {
        errors.push({
          rowNumber: row.rowNumber,
          errors: [{ field: 'propertyUprn', error: `Property not found: ${row.data.propertyUprn}`, value: row.data.propertyUprn }]
        });
        continue;
      }
      
      const componentData: InsertComponent = {
        propertyId: propertyId || null,
        componentTypeId,
        assetTag: row.data.assetTag?.trim() || null,
        serialNumber: row.data.serialNumber?.trim() || null,
        manufacturer: row.data.manufacturer?.trim() || null,
        model: row.data.model?.trim() || null,
        location: row.data.location?.trim() || null,
        installDate: row.data.installDate?.trim() || null,
        condition: row.data.condition?.toUpperCase() || null,
        source: 'IMPORTED',
      };
      
      await storage.createComponent(componentData);
      importedRows++;
      
    } catch (error: any) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'database', error: error.message || 'Failed to create component', value: null }]
      });
    }
  }
  
  return {
    success: errors.length === 0,
    totalRows: rows.length,
    validRows: rows.length,
    invalidRows: 0,
    importedRows,
    errors
  };
}

export function generateCSVTemplate(importType: string): string {
  const templates: Record<string, string[]> = {
    properties: [
      'uprn,addressLine1,addressLine2,city,postcode,propertyType,tenure,bedrooms,hasGas,hasElectricity,hasAsbestos,hasSprinklers,vulnerableOccupant,epcRating,constructionYear,numberOfFloors,localAuthority,blockReference',
      '100000000001,123 Main Street,Flat 1,London,E1 1AA,FLAT,SOCIAL_RENT,2,true,true,false,false,false,C,1985,1,London Borough of Tower Hamlets,BLOCK-001'
    ],
    units: [
      'propertyUprn,name,reference,unitType,floor,description,areaSqMeters,isAccessible,fireCompartment,asbestosPresent,hactLocationCode',
      '100000000001,Kitchen,UNIT-001,DWELLING,Ground,Main kitchen area,12.5,true,FC-01,false,LOC-KIT-001'
    ],
    components: [
      'propertyUprn,unitReference,componentTypeCode,assetTag,serialNumber,manufacturer,model,location,accessNotes,installDate,expectedReplacementDate,warrantyExpiry,condition,riskLevel,certificateRequired,lastServiceDate,nextServiceDue',
      '100000000001,,GAS_BOILER,ASSET-001,SN12345,Worcester,Greenstar 30i,Utility Room,Key required from tenant,2020-01-15,2035-01-15,2025-01-15,GOOD,MEDIUM,GAS_SAFETY,2024-06-12,2025-06-12'
    ],
    geocoding: [
      'propertyId,latitude,longitude',
      'example-property-id,51.5074,-0.1278'
    ],
    staff: [
      'firstName,lastName,email,phone,department,roleTitle,employeeId,status,tradeSpecialism,gasSafeNumber,niceicNumber,notes',
      'John,Smith,john.smith@example.org,07700900123,Maintenance,Compliance Officer,EMP001,ACTIVE,Gas & Heating,123456,,,Example staff member'
    ]
  };
  
  return templates[importType.toLowerCase()]?.join('\n') || '';
}
