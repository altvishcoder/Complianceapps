import { db } from "../db";
import { 
  schemes, blocks, properties, spaces, components, componentTypes,
  certificates, remedialActions, contractors, staffMembers,
  contractorSLAProfiles, complianceStreams, certificateTypes
} from "@shared/schema";
import { sql } from "drizzle-orm";

export type VolumeTier = "small" | "medium" | "large";

export interface VolumeConfig {
  tier: VolumeTier;
  label: string;
  description: string;
  schemes: number;
  blocksPerScheme: number;
  propertiesPerBlock: number;
  spacesPerProperty: number;
  componentsPerProperty: number;
  certificatesPerProperty: number;
  remedialsPerCertificate: number;
  contractors: number;
  staffMembers: number;
  estimatedMinutes: number;
}

export const VOLUME_CONFIGS: Record<VolumeTier, VolumeConfig> = {
  small: {
    tier: "small",
    label: "Small (2K)",
    description: "~2,000 properties - current demo data",
    schemes: 50,
    blocksPerScheme: 4,
    propertiesPerBlock: 10,
    spacesPerProperty: 4,
    componentsPerProperty: 4,
    certificatesPerProperty: 3,
    remedialsPerCertificate: 0.8,
    contractors: 150,
    staffMembers: 50,
    estimatedMinutes: 2,
  },
  medium: {
    tier: "medium",
    label: "Medium (10K)",
    description: "~10,000 properties, 50K components, 100K certificates",
    schemes: 50,
    blocksPerScheme: 5,
    propertiesPerBlock: 40,
    spacesPerProperty: 3,
    componentsPerProperty: 5,
    certificatesPerProperty: 10,
    remedialsPerCertificate: 0.75,
    contractors: 200,
    staffMembers: 100,
    estimatedMinutes: 5,
  },
  large: {
    tier: "large",
    label: "Large (50K)",
    description: "~50,000 properties, 500K components, 1M certificates",
    schemes: 200,
    blocksPerScheme: 5,
    propertiesPerBlock: 50,
    spacesPerProperty: 3,
    componentsPerProperty: 10,
    certificatesPerProperty: 20,
    remedialsPerCertificate: 0.75,
    contractors: 500,
    staffMembers: 250,
    estimatedMinutes: 30,
  },
};

export function calculateTotals(config: VolumeConfig) {
  const totalSchemes = config.schemes;
  const totalBlocks = config.schemes * config.blocksPerScheme;
  const totalProperties = totalBlocks * config.propertiesPerBlock;
  const totalSpaces = totalProperties * config.spacesPerProperty;
  const totalComponents = totalProperties * config.componentsPerProperty;
  const totalCertificates = totalProperties * config.certificatesPerProperty;
  const totalRemedials = Math.floor(totalCertificates * config.remedialsPerCertificate);
  
  return {
    schemes: totalSchemes,
    blocks: totalBlocks,
    properties: totalProperties,
    spaces: totalSpaces,
    components: totalComponents,
    certificates: totalCertificates,
    remedials: totalRemedials,
    contractors: config.contractors,
    staffMembers: config.staffMembers,
    total: totalSchemes + totalBlocks + totalProperties + totalSpaces + 
           totalComponents + totalCertificates + totalRemedials + 
           config.contractors + config.staffMembers,
  };
}

export interface SeedProgress {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  tier: VolumeTier | null;
  currentEntity: string;
  currentCount: number;
  totalCount: number;
  percentage: number;
  startTime: number | null;
  estimatedTimeRemaining: number | null;
  error: string | null;
  entities: {
    schemes: { done: number; total: number };
    blocks: { done: number; total: number };
    properties: { done: number; total: number };
    spaces: { done: number; total: number };
    components: { done: number; total: number };
    certificates: { done: number; total: number };
    remedials: { done: number; total: number };
    contractors: { done: number; total: number };
    staff: { done: number; total: number };
  };
}

let currentProgress: SeedProgress = {
  status: "idle",
  tier: null,
  currentEntity: "",
  currentCount: 0,
  totalCount: 0,
  percentage: 0,
  startTime: null,
  estimatedTimeRemaining: null,
  error: null,
  entities: {
    schemes: { done: 0, total: 0 },
    blocks: { done: 0, total: 0 },
    properties: { done: 0, total: 0 },
    spaces: { done: 0, total: 0 },
    components: { done: 0, total: 0 },
    certificates: { done: 0, total: 0 },
    remedials: { done: 0, total: 0 },
    contractors: { done: 0, total: 0 },
    staff: { done: 0, total: 0 },
  },
};

let cancelRequested = false;

export function getProgress(): SeedProgress {
  return { ...currentProgress };
}

export function cancelBulkSeed(): void {
  cancelRequested = true;
}

function resetProgress(): void {
  cancelRequested = false;
  currentProgress = {
    status: "idle",
    tier: null,
    currentEntity: "",
    currentCount: 0,
    totalCount: 0,
    percentage: 0,
    startTime: null,
    estimatedTimeRemaining: null,
    error: null,
    entities: {
      schemes: { done: 0, total: 0 },
      blocks: { done: 0, total: 0 },
      properties: { done: 0, total: 0 },
      spaces: { done: 0, total: 0 },
      components: { done: 0, total: 0 },
      certificates: { done: 0, total: 0 },
      remedials: { done: 0, total: 0 },
      contractors: { done: 0, total: 0 },
      staff: { done: 0, total: 0 },
    },
  };
}

function updateProgress(entity: string, done: number, total: number): void {
  const entityKey = entity.toLowerCase() as keyof typeof currentProgress.entities;
  if (currentProgress.entities[entityKey]) {
    currentProgress.entities[entityKey] = { done, total };
  }
  currentProgress.currentEntity = entity;
  
  const allDone = Object.values(currentProgress.entities).reduce((sum, e) => sum + e.done, 0);
  const allTotal = Object.values(currentProgress.entities).reduce((sum, e) => sum + e.total, 0);
  currentProgress.currentCount = allDone;
  currentProgress.totalCount = allTotal;
  currentProgress.percentage = allTotal > 0 ? Math.round((allDone / allTotal) * 100) : 0;
  
  if (currentProgress.startTime && allDone > 0) {
    const elapsed = Date.now() - currentProgress.startTime;
    const rate = allDone / elapsed;
    const remaining = allTotal - allDone;
    currentProgress.estimatedTimeRemaining = Math.round(remaining / rate / 1000);
  }
}

const BATCH_SIZE = 2000;

const UK_CITIES = [
  { name: "London", postcodePrefix: "SW" },
  { name: "Manchester", postcodePrefix: "M" },
  { name: "Birmingham", postcodePrefix: "B" },
  { name: "Leeds", postcodePrefix: "LS" },
  { name: "Liverpool", postcodePrefix: "L" },
  { name: "Sheffield", postcodePrefix: "S" },
  { name: "Bristol", postcodePrefix: "BS" },
  { name: "Newcastle", postcodePrefix: "NE" },
  { name: "Nottingham", postcodePrefix: "NG" },
  { name: "Glasgow", postcodePrefix: "G" },
];

const SCHEME_PREFIXES = ["Oak", "Riverside", "Meadow", "Park", "Victoria", "Windsor", "Manor", "Green", "Garden", "Tower"];
const SCHEME_SUFFIXES = ["Estate", "Gardens", "Complex", "Village", "Heights", "Court", "Park", "View", "Fields", "Place"];
const BLOCK_PREFIXES = ["Tower", "Court", "House", "Lodge", "Mansion", "Wing", "Point", "Rise", "Heights", "View"];
const STREET_NAMES = ["Oak St", "Maple Ave", "Cedar Ln", "Elm Rd", "Birch Way", "Willow Ct", "Pine Gardens", "Ash Close", "Beech Dr", "Cherry Walk"];

const STATUSES = ["COMPLIANT", "EXPIRING_SOON", "NON_COMPLIANT", "OVERDUE"] as const;
const STATUS_WEIGHTS = [0.7, 0.15, 0.1, 0.05];
const TENURES = ["SOCIAL_RENT", "AFFORDABLE_RENT", "SHARED_OWNERSHIP", "LEASEHOLD", "TEMPORARY"] as const;
const PROPERTY_TYPES = ["FLAT", "HOUSE", "MAISONETTE", "BUNGALOW", "STUDIO"] as const;
const SPACE_TYPES = ["ROOM", "COMMUNAL_AREA", "UTILITY", "CIRCULATION", "STORAGE", "OTHER"] as const;
const SPACE_NAMES = ["Living Room", "Kitchen", "Bathroom", "Bedroom", "Hallway", "Utility"];
const REMEDIAL_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const REMEDIAL_STATUS_WEIGHTS = [0.4, 0.25, 0.3, 0.05];
const SEVERITIES = ["IMMEDIATE", "URGENT", "PRIORITY", "ROUTINE", "ADVISORY"] as const;
const SEVERITY_WEIGHTS = [0.05, 0.15, 0.25, 0.4, 0.15];
const CERT_TYPES = ["GAS_SAFETY", "EICR", "EPC", "FIRE_RISK_ASSESSMENT", "LEGIONELLA_ASSESSMENT", "ASBESTOS_SURVEY", "LIFT_LOLER", "OTHER"] as const;
const CERT_STATUSES = ["UPLOADED", "PROCESSING", "EXTRACTED", "NEEDS_REVIEW", "APPROVED"] as const;
const CERT_STATUS_WEIGHTS = [0.05, 0.05, 0.1, 0.1, 0.7];

function weightedRandom<T>(items: readonly T[], weights: number[]): T {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return items[i];
  }
  return items[items.length - 1];
}

function randomDate(daysAgo: number, daysAhead: number = 0): Date {
  const now = Date.now();
  const start = now - daysAgo * 24 * 60 * 60 * 1000;
  const end = now + daysAhead * 24 * 60 * 60 * 1000;
  return new Date(start + Math.random() * (end - start));
}

function generatePostcode(prefix: string): string {
  const num = Math.floor(Math.random() * 20) + 1;
  const suffix = `${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  return `${prefix}${num} ${suffix}`;
}

export async function runBulkSeed(tier: VolumeTier, orgId: string): Promise<void> {
  if (currentProgress.status === "running") {
    throw new Error("Bulk seeding is already in progress");
  }
  
  const config = VOLUME_CONFIGS[tier];
  const totals = calculateTotals(config);
  
  resetProgress();
  currentProgress.status = "running";
  currentProgress.tier = tier;
  currentProgress.startTime = Date.now();
  currentProgress.entities = {
    schemes: { done: 0, total: totals.schemes },
    blocks: { done: 0, total: totals.blocks },
    properties: { done: 0, total: totals.properties },
    spaces: { done: 0, total: totals.spaces },
    components: { done: 0, total: totals.components },
    certificates: { done: 0, total: totals.certificates },
    remedials: { done: 0, total: totals.remedials },
    contractors: { done: 0, total: config.contractors },
    staff: { done: 0, total: config.staffMembers },
  };
  
  console.log(`🚀 Starting ${tier} bulk seed: ${totals.total.toLocaleString()} total records`);
  
  try {
    const allStreams = await db.select().from(complianceStreams);
    const streamCodeToId: Record<string, string> = {};
    for (const stream of allStreams) {
      streamCodeToId[stream.code] = stream.id;
    }
    
    const allCertTypes = await db.select().from(certificateTypes);
    const allComponentTypes = await db.select().from(componentTypes);
    
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const schemeIds = await seedSchemesBulk(orgId, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const blockIds = await seedBlocksBulk(schemeIds, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const propertyIds = await seedPropertiesBulk(blockIds, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const spaceIds = await seedSpacesBulk(propertyIds, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const componentIds = await seedComponentsBulk(propertyIds, spaceIds, allComponentTypes, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const contractorIds = await seedContractorsBulk(orgId, streamCodeToId, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    await seedStaffBulk(orgId, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    const certIds = await seedCertificatesBulk(orgId, propertyIds, componentIds, streamCodeToId, allCertTypes, config);
    if (cancelRequested) throw new Error("Cancelled by user");
    
    await seedRemedialsBulk(certIds, propertyIds, contractorIds, config);
    
    console.log(`✅ Bulk seed complete: ${totals.total.toLocaleString()} records in ${Math.round((Date.now() - currentProgress.startTime!) / 1000)}s`);
    
    currentProgress.status = "completed";
    currentProgress.percentage = 100;
    
  } catch (error) {
    console.error("Bulk seed error:", error);
    currentProgress.status = cancelRequested ? "cancelled" : "failed";
    currentProgress.error = error instanceof Error ? error.message : "Unknown error";
    throw error;
  }
}

async function seedSchemesBulk(orgId: string, config: VolumeConfig): Promise<string[]> {
  const schemeIds: string[] = [];
  const values = [];
  
  for (let i = 0; i < config.schemes; i++) {
    const prefix = SCHEME_PREFIXES[i % SCHEME_PREFIXES.length];
    const suffix = SCHEME_SUFFIXES[Math.floor(i / SCHEME_PREFIXES.length) % SCHEME_SUFFIXES.length];
    const num = Math.floor(i / (SCHEME_PREFIXES.length * SCHEME_SUFFIXES.length)) + 1;
    const name = num > 1 ? `${prefix} ${suffix} ${num}` : `${prefix} ${suffix}`;
    
    values.push({
      organisationId: orgId,
      name,
      reference: `SCH${String(i + 1).padStart(4, '0')}`,
      complianceStatus: weightedRandom(STATUSES, STATUS_WEIGHTS),
    });
  }
  
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(schemes).values(batch).returning({ id: schemes.id });
    schemeIds.push(...inserted.map(s => s.id));
    updateProgress("schemes", schemeIds.length, config.schemes);
  }
  
  console.log(`  ✓ ${schemeIds.length} schemes`);
  return schemeIds;
}

async function seedBlocksBulk(schemeIds: string[], config: VolumeConfig): Promise<string[]> {
  const blockIds: string[] = [];
  const values = [];
  let blockNum = 1;
  
  for (const schemeId of schemeIds) {
    for (let b = 0; b < config.blocksPerScheme; b++) {
      const prefix = BLOCK_PREFIXES[b % BLOCK_PREFIXES.length];
      const letter = String.fromCharCode(65 + (b % 26));
      
      values.push({
        schemeId,
        name: `${prefix} ${letter}`,
        reference: `BLK${String(blockNum++).padStart(5, '0')}`,
        hasLift: Math.random() > 0.6,
        hasCommunalBoiler: Math.random() > 0.7,
        complianceStatus: weightedRandom(STATUSES, STATUS_WEIGHTS),
      });
    }
  }
  
  const total = values.length;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(blocks).values(batch).returning({ id: blocks.id });
    blockIds.push(...inserted.map(b => b.id));
    updateProgress("blocks", blockIds.length, total);
  }
  
  console.log(`  ✓ ${blockIds.length} blocks`);
  return blockIds;
}

async function seedPropertiesBulk(blockIds: string[], config: VolumeConfig): Promise<string[]> {
  const propertyIds: string[] = [];
  const values = [];
  let uprn = 10001001;
  
  for (let blockIndex = 0; blockIndex < blockIds.length; blockIndex++) {
    const city = UK_CITIES[blockIndex % UK_CITIES.length];
    const street = STREET_NAMES[blockIndex % STREET_NAMES.length];
    
    for (let p = 0; p < config.propertiesPerBlock; p++) {
      const flat = p + 1;
      const floor = Math.floor(p / 4) + 1;
      
      values.push({
        blockId: blockIds[blockIndex],
        uprn: String(uprn++),
        addressLine1: `Flat ${flat}, ${street}`,
        addressLine2: floor > 1 ? `Floor ${floor}` : null,
        city: city.name,
        postcode: generatePostcode(city.postcodePrefix),
        propertyType: PROPERTY_TYPES[p % PROPERTY_TYPES.length],
        tenure: TENURES[p % TENURES.length],
        bedrooms: (p % 4) + 1,
        hasGas: p % 5 !== 4,
        complianceStatus: weightedRandom(STATUSES, STATUS_WEIGHTS),
        isHighRiseBuilding: Math.random() > 0.85,
        buildingHeight: Math.random() > 0.9 ? Math.floor(Math.random() * 30) + 18 : null,
      });
    }
  }
  
  const total = values.length;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(properties).values(batch).returning({ id: properties.id });
    propertyIds.push(...inserted.map(p => p.id));
    updateProgress("properties", propertyIds.length, total);
  }
  
  console.log(`  ✓ ${propertyIds.length} properties`);
  return propertyIds;
}

async function seedSpacesBulk(propertyIds: string[], config: VolumeConfig): Promise<string[]> {
  const spaceIds: string[] = [];
  const values = [];
  
  for (const propertyId of propertyIds) {
    for (let s = 0; s < config.spacesPerProperty; s++) {
      values.push({
        propertyId,
        name: SPACE_NAMES[s % SPACE_NAMES.length],
        spaceType: SPACE_TYPES[s % SPACE_TYPES.length],
        floor: String(Math.floor(s / 3)),
        areaSqMeters: Math.floor(Math.random() * 20) + 8,
      });
    }
  }
  
  const total = values.length;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(spaces).values(batch).returning({ id: spaces.id });
    spaceIds.push(...inserted.map(s => s.id));
    updateProgress("spaces", spaceIds.length, total);
  }
  
  console.log(`  ✓ ${spaceIds.length} spaces`);
  return spaceIds;
}

async function seedComponentsBulk(
  propertyIds: string[], 
  spaceIds: string[], 
  allComponentTypes: any[],
  config: VolumeConfig
): Promise<string[]> {
  const componentIds: string[] = [];
  const values = [];
  
  const spacesPerProperty = config.spacesPerProperty;
  
  for (let propIndex = 0; propIndex < propertyIds.length; propIndex++) {
    const propertyId = propertyIds[propIndex];
    const startSpaceIdx = propIndex * spacesPerProperty;
    
    for (let c = 0; c < config.componentsPerProperty; c++) {
      const compType = allComponentTypes[c % allComponentTypes.length];
      const spaceId = spaceIds[startSpaceIdx + (c % spacesPerProperty)];
      
      values.push({
        propertyId,
        spaceId: Math.random() > 0.3 ? spaceId : null,
        componentTypeId: compType?.id || crypto.randomUUID(),
        manufacturer: ["Vaillant", "Worcester", "Baxi", "Ideal", "Potterton", "Glow-worm"][c % 6],
        model: `Model-${Math.floor(Math.random() * 1000)}`,
        serialNumber: `SN${Date.now()}-${propIndex}-${c}`,
        installDate: randomDate(3650, 0).toISOString().split('T')[0],
        lastServiceDate: randomDate(365, 0).toISOString().split('T')[0],
        warrantyExpiry: randomDate(0, 730).toISOString().split('T')[0],
      });
    }
  }
  
  const total = values.length;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(components).values(batch).returning({ id: components.id });
    componentIds.push(...inserted.map(c => c.id));
    updateProgress("components", componentIds.length, total);
  }
  
  console.log(`  ✓ ${componentIds.length} components`);
  return componentIds;
}

async function seedContractorsBulk(
  orgId: string, 
  streamCodeToId: Record<string, string>,
  config: VolumeConfig
): Promise<string[]> {
  const contractorIds: string[] = [];
  const prefixes = ["Premier", "Elite", "Pro", "Swift", "Quality", "Reliable", "Expert", "National"];
  const suffixes = ["Gas", "Electrical", "Fire Safety", "Building Services", "Maintenance"];
  const trades = ["GAS_ENGINEER", "ELECTRICIAN", "FIRE_SAFETY", "ASBESTOS_SPECIALIST", "LIFT_ENGINEER"];
  
  const values = [];
  for (let i = 0; i < config.contractors; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = suffixes[Math.floor(i / prefixes.length) % suffixes.length];
    
    values.push({
      organisationId: orgId,
      companyName: `${prefix} ${suffix} Ltd ${i > 40 ? i : ''}`.trim(),
      contactEmail: `contact${i + 1}@contractor.co.uk`,
      contactPhone: `0${Math.floor(Math.random() * 900000000) + 100000000}`,
      tradeType: trades[i % trades.length],
      gasRegistration: i % 5 === 0 ? `GSR${100000 + i}` : null,
      electricalRegistration: i % 5 === 1 ? `NICEIC${100000 + i}` : null,
    });
  }
  
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(contractors).values(batch).returning({ id: contractors.id });
    contractorIds.push(...inserted.map(c => c.id));
    updateProgress("contractors", contractorIds.length, config.contractors);
  }
  
  console.log(`  ✓ ${contractorIds.length} contractors`);
  return contractorIds;
}

async function seedStaffBulk(orgId: string, config: VolumeConfig): Promise<string[]> {
  const staffIds: string[] = [];
  const firstNames = ["James", "Sarah", "Michael", "Emma", "David", "Sophie", "Thomas", "Lucy", "Daniel", "Grace"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Taylor", "Clark"];
  const roles = ["Compliance Officer", "Property Manager", "Surveyor", "Coordinator", "Inspector"];
  const depts = ["Compliance", "Property", "Operations", "Technical", "Safety"];
  
  const values = [];
  for (let i = 0; i < config.staffMembers; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    values.push({
      organisationId: orgId,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@org.co.uk`,
      roleTitle: roles[i % roles.length],
      department: depts[i % depts.length],
    });
  }
  
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(staffMembers).values(batch).returning({ id: staffMembers.id });
    staffIds.push(...inserted.map(s => s.id));
    updateProgress("staff", staffIds.length, config.staffMembers);
  }
  
  console.log(`  ✓ ${staffIds.length} staff members`);
  return staffIds;
}

async function seedCertificatesBulk(
  orgId: string,
  propertyIds: string[],
  componentIds: string[],
  streamCodeToId: Record<string, string>,
  allCertTypes: any[],
  config: VolumeConfig
): Promise<string[]> {
  const certIds: string[] = [];
  const streamCodes = Object.keys(streamCodeToId);
  const componentsPerProperty = config.componentsPerProperty;
  
  const values = [];
  for (let propIndex = 0; propIndex < propertyIds.length; propIndex++) {
    const propertyId = propertyIds[propIndex];
    
    for (let c = 0; c < config.certificatesPerProperty; c++) {
      const certType = CERT_TYPES[c % CERT_TYPES.length];
      const streamCode = streamCodes[c % streamCodes.length];
      const status = weightedRandom(CERT_STATUSES, CERT_STATUS_WEIGHTS);
      const issueDate = randomDate(730, 0);
      const expiryDays = c % 10 === 0 ? -30 : c % 5 === 0 ? 30 : 365;
      
      values.push({
        organisationId: orgId,
        propertyId,
        fileName: `cert-${propIndex}-${c}.pdf`,
        fileType: "application/pdf",
        fileSize: Math.floor(Math.random() * 500000) + 50000,
        certificateType: certType,
        certificateNumber: `CERT-${propIndex}-${c}-${Date.now().toString(36)}`,
        complianceStreamId: streamCodeToId[streamCode] || null,
        issueDate: issueDate.toISOString().split('T')[0],
        expiryDate: new Date(issueDate.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status,
      });
    }
  }
  
  const total = values.length;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const inserted = await db.insert(certificates).values(batch).returning({ id: certificates.id });
    certIds.push(...inserted.map(c => c.id));
    updateProgress("certificates", certIds.length, total);
  }
  
  console.log(`  ✓ ${certIds.length} certificates`);
  return certIds;
}

async function seedRemedialsBulk(
  certIds: string[],
  propertyIds: string[],
  contractorIds: string[],
  config: VolumeConfig
): Promise<void> {
  const remedialCount = Math.floor(certIds.length * config.remedialsPerCertificate);
  const values = [];
  
  const descriptions = [
    "Replace faulty component", "Annual service required", "Safety inspection needed",
    "Repair leak", "Replace sensor", "Test emergency lighting", "Clear blockage",
    "Update documentation", "Install new equipment", "Conduct risk assessment"
  ];
  
  for (let i = 0; i < remedialCount; i++) {
    const certId = certIds[i % certIds.length];
    const propertyId = propertyIds[i % propertyIds.length];
    const status = weightedRandom(REMEDIAL_STATUSES, REMEDIAL_STATUS_WEIGHTS);
    const severity = weightedRandom(SEVERITIES, SEVERITY_WEIGHTS);
    
    const daysFromNow = severity === "IMMEDIATE" ? 7 : severity === "URGENT" ? 14 : severity === "PRIORITY" ? 30 : 60;
    const dueDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: `${descriptions[i % descriptions.length]} - auto-generated for testing`,
      severity,
      status,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(Math.random() * 500) + 50),
    });
  }
  
  let done = 0;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(remedialActions).values(batch);
    done += batch.length;
    updateProgress("remedials", done, remedialCount);
  }
  
  console.log(`  ✓ ${remedialCount} remedial actions`);
}

export async function refreshMaterializedViewsAfterSeed(): Promise<void> {
  console.log("🔄 Refreshing materialized views...");
  try {
    await db.execute(sql`ANALYZE`);
    console.log("✅ Database statistics updated");
  } catch (error) {
    console.error("Error refreshing views:", error);
  }
}
