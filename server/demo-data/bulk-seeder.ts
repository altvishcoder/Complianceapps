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
    label: "Medium (25K)",
    description: "~25,000 properties - large UK housing association scale",
    schemes: 100,
    blocksPerScheme: 5,
    propertiesPerBlock: 50,
    spacesPerProperty: 4,
    componentsPerProperty: 4,
    certificatesPerProperty: 3,
    remedialsPerCertificate: 0.5,
    contractors: 250,
    staffMembers: 120,
    estimatedMinutes: 15,
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
  // Spaces at three levels: scheme (2 per scheme), block (3 per block), property (spacesPerProperty)
  const schemeSpaces = totalSchemes * 2;
  const blockSpaces = totalBlocks * 3;
  const propertySpaces = totalProperties * config.spacesPerProperty;
  const totalSpaces = schemeSpaces + blockSpaces + propertySpaces;
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
// Block-level communal spaces (attached to blocks)
const BLOCK_COMMUNAL_SPACES = [
  { name: "Main Stairwell", type: "CIRCULATION" as const },
  { name: "Plant Room", type: "UTILITY" as const },
  { name: "Bin Store", type: "STORAGE" as const },
  { name: "Entrance Lobby", type: "CIRCULATION" as const },
  { name: "Corridor - Ground Floor", type: "CIRCULATION" as const },
  { name: "Meter Cupboard", type: "UTILITY" as const },
];
// Scheme-level spaces (attached to schemes/estates)
const SCHEME_COMMUNAL_SPACES = [
  { name: "Community Hall", type: "COMMUNAL_AREA" as const },
  { name: "Estate Grounds", type: "EXTERNAL" as const },
  { name: "Car Park", type: "EXTERNAL" as const },
  { name: "Play Area", type: "EXTERNAL" as const },
];
const REMEDIAL_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const REMEDIAL_STATUS_WEIGHTS = [0.4, 0.25, 0.3, 0.05];
const SEVERITIES = ["IMMEDIATE", "URGENT", "PRIORITY", "ROUTINE", "ADVISORY"] as const;
const SEVERITY_WEIGHTS = [0.05, 0.15, 0.25, 0.4, 0.15];
const CERT_TYPES = ["GAS_SAFETY", "EICR", "EPC", "FIRE_RISK_ASSESSMENT", "LEGIONELLA_ASSESSMENT", "ASBESTOS_SURVEY", "LIFT_LOLER", "OTHER"] as const;
const CERT_STATUSES = ["UPLOADED", "PROCESSING", "EXTRACTED", "NEEDS_REVIEW", "APPROVED"] as const;
const CERT_STATUS_WEIGHTS = [0.05, 0.05, 0.1, 0.1, 0.7];

// Seeded random number generator for deterministic data generation
// Uses mulberry32 algorithm - fast and good distribution
class SeededRandom {
  private state: number;
  
  constructor(seed: string | number = Date.now()) {
    // Convert string seed to numeric hash
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }
      this.state = Math.abs(hash) || 1;
    } else {
      this.state = seed || 1;
    }
  }
  
  // Returns a random number between 0 and 1 (like rng.random())
  random(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  // Returns a random integer between min (inclusive) and max (exclusive)
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }
  
  // Pick a random element from an array
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }
}

// Global seeded random instance - initialized per run
let rng: SeededRandom = new SeededRandom();

// Initialize the RNG with a specific seed for reproducible data
export function initializeSeededRandom(seed?: string | number): void {
  rng = new SeededRandom(seed ?? Date.now());
  console.log(`Seeded RNG initialized with seed: ${seed ?? 'random'}`);
}

function weightedRandom<T>(items: readonly T[], weights: number[]): T {
  const r = rng.random();
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
  return new Date(start + rng.random() * (end - start));
}

function generatePostcode(prefix: string): string {
  const num = rng.randomInt(1, 21);
  const suffix = `${rng.randomInt(1, 10)}${String.fromCharCode(65 + rng.randomInt(0, 26))}${String.fromCharCode(65 + rng.randomInt(0, 26))}`;
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
    
    const spaceIds = await seedSpacesBulk(schemeIds, blockIds, propertyIds, config);
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
        hasLift: rng.random() > 0.6,
        hasCommunalBoiler: rng.random() > 0.7,
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
        isHighRiseBuilding: rng.random() > 0.85,
        buildingHeight: rng.random() > 0.9 ? Math.floor(rng.random() * 30) + 18 : null,
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

async function seedSpacesBulk(
  schemeIds: string[], 
  blockIds: string[], 
  propertyIds: string[], 
  config: VolumeConfig
): Promise<string[]> {
  const spaceIds: string[] = [];
  const values: any[] = [];
  
  // 1. Scheme-level spaces (estate-wide communal areas) - 2 per scheme
  for (const schemeId of schemeIds) {
    const spacesToCreate = SCHEME_COMMUNAL_SPACES.slice(0, 2);
    for (const spaceTemplate of spacesToCreate) {
      values.push({
        schemeId,
        propertyId: null,
        blockId: null,
        name: spaceTemplate.name,
        spaceType: spaceTemplate.type,
        description: `Estate-wide ${spaceTemplate.name.toLowerCase()}`,
        areaSqMeters: Math.floor(rng.random() * 200) + 50,
      });
    }
  }
  
  // 2. Block-level spaces (building communal areas) - 3 per block
  for (const blockId of blockIds) {
    const spacesToCreate = BLOCK_COMMUNAL_SPACES.slice(0, 3);
    for (let i = 0; i < spacesToCreate.length; i++) {
      const spaceTemplate = spacesToCreate[i];
      values.push({
        blockId,
        propertyId: null,
        schemeId: null,
        name: spaceTemplate.name,
        spaceType: spaceTemplate.type,
        floor: i === 0 ? "All Floors" : "Ground",
        description: `Building communal ${spaceTemplate.name.toLowerCase()}`,
        areaSqMeters: Math.floor(rng.random() * 30) + 10,
      });
    }
  }
  
  // 3. Property-level spaces (rooms within dwellings)
  for (const propertyId of propertyIds) {
    for (let s = 0; s < config.spacesPerProperty; s++) {
      values.push({
        propertyId,
        blockId: null,
        schemeId: null,
        name: SPACE_NAMES[s % SPACE_NAMES.length],
        spaceType: SPACE_TYPES[s % SPACE_TYPES.length],
        floor: String(Math.floor(s / 3)),
        areaSqMeters: Math.floor(rng.random() * 20) + 8,
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
  
  const schemeSpaces = schemeIds.length * 2;
  const blockSpaces = blockIds.length * 3;
  const propertySpaces = propertyIds.length * config.spacesPerProperty;
  console.log(`  ✓ ${spaceIds.length} spaces (${schemeSpaces} scheme-level, ${blockSpaces} block-level, ${propertySpaces} property-level)`);
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
        spaceId: rng.random() > 0.3 ? spaceId : null,
        componentTypeId: compType?.id || crypto.randomUUID(),
        manufacturer: ["Vaillant", "Worcester", "Baxi", "Ideal", "Potterton", "Glow-worm"][c % 6],
        model: `Model-${Math.floor(rng.random() * 1000)}`,
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
      contactPhone: `0${Math.floor(rng.random() * 900000000) + 100000000}`,
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
        fileSize: Math.floor(rng.random() * 500000) + 50000,
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

// Realistic Awaab's Law breach data for 25k portfolio
const AWAABS_COUNTS = {
  PHASE1_BREACHES: 175,   // Damp/mould - 24-hour statutory deadline breached
  PHASE2_BREACHES: 95,    // Fire/electrical - 7-day deadline (2026)
  PHASE3_BREACHES: 70,    // All HHSRS - 14-day deadline (2027)
  IMMEDIATE_HAZARDS: 48,  // Internal severity classification
  OVERDUE_ACTIONS: 105,   // Past due date
};

const DAMP_MOULD_DESCRIPTIONS = [
  "Black mould growth on bedroom ceiling - tenant reports respiratory issues",
  "Severe condensation on windows causing mould on window frames",
  "Penetrating damp in living room corner - water ingress from external wall",
  "Rising damp in hallway - visible tide marks and peeling wallpaper",
  "Mould behind wardrobe in main bedroom - tenant notified 3 weeks ago",
  "Condensation causing mould in bathroom - extractor fan not working",
  "Water staining and mould on kitchen ceiling - flat roof leak suspected",
  "Damp patch spreading on nursery wall - vulnerable child in property",
  "Mould growth around window seals in multiple rooms",
  "Severe condensation pooling on windowsills causing wood rot",
  "Black spot mould in corner of living room - repeat complaint",
  "Damp causing wallpaper to peel in elderly tenant's bedroom",
];

const FIRE_ELECTRICAL_DESCRIPTIONS = [
  "C2 defect on consumer unit - requires urgent replacement",
  "Fire alarm system showing intermittent faults",
  "Emergency lighting failed monthly test - batteries depleted",
  "Damaged socket outlet in kitchen showing signs of overheating",
  "Fire door closer not functioning correctly on communal landing",
  "EICR identified unsatisfactory condition - immediate investigation required",
  "PAT test failure on communal area equipment",
  "Fire risk assessment identified blocked escape route",
  "Smoke detector not functioning in high-rise flat",
  "Electrical installation over 5 years since last inspection",
];

const HHSRS_DESCRIPTIONS = [
  "Gas boiler annual service overdue - potential CO risk",
  "Legionella risk assessment identified stagnant water in unused outlet",
  "Asbestos survey identified damaged AIB in communal area",
  "Lift LOLER inspection overdue - 6 weeks past due date",
  "EPC rating band G - fuel poverty risk for vulnerable tenant",
  "Gas safety certificate expired - no access issues documented",
  "Water temperature at outlets exceeds safe limits",
  "Identified ACM requiring encapsulation or removal",
  "Lift brake mechanism flagged for urgent maintenance",
  "Boiler flue terminal clearance below regulations",
];

const ROUTINE_DESCRIPTIONS = [
  "Replace faulty component", "Annual service required", "Safety inspection needed",
  "Repair leak", "Replace sensor", "Test emergency lighting", "Clear blockage",
  "Update documentation", "Install new equipment", "Conduct risk assessment"
];

async function seedRemedialsBulk(
  certIds: string[],
  propertyIds: string[],
  contractorIds: string[],
  config: VolumeConfig
): Promise<void> {
  const values: any[] = [];
  let idx = 0;

  // Phase 1 breaches (damp/mould - 24 hour deadline BREACHED)
  for (let i = 0; i < AWAABS_COUNTS.PHASE1_BREACHES; i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[i % propertyIds.length];
    const hoursOverdue = Math.floor(rng.random() * 168) + 24; // 1-8 days overdue
    const dueDate = new Date(Date.now() - hoursOverdue * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: DAMP_MOULD_DESCRIPTIONS[i % DAMP_MOULD_DESCRIPTIONS.length],
      severity: "IMMEDIATE" as const,
      status: "OPEN" as const,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 3000) + 500),
    });
  }

  // Phase 2 breaches (fire/electrical - 7 day deadline breached)
  for (let i = 0; i < AWAABS_COUNTS.PHASE2_BREACHES; i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[(i + 1000) % propertyIds.length];
    const daysOverdue = Math.floor(rng.random() * 21) + 7; // 7-28 days overdue
    const dueDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: FIRE_ELECTRICAL_DESCRIPTIONS[i % FIRE_ELECTRICAL_DESCRIPTIONS.length],
      severity: i % 3 === 0 ? "IMMEDIATE" as const : "URGENT" as const,
      status: i % 4 === 0 ? "IN_PROGRESS" as const : "OPEN" as const,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 2500) + 200),
    });
  }

  // Phase 3 breaches (all HHSRS - 14 day deadline breached)
  for (let i = 0; i < AWAABS_COUNTS.PHASE3_BREACHES; i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[(i + 2000) % propertyIds.length];
    const daysOverdue = Math.floor(rng.random() * 30) + 14; // 14-44 days overdue
    const dueDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: HHSRS_DESCRIPTIONS[i % HHSRS_DESCRIPTIONS.length],
      severity: i % 4 === 0 ? "IMMEDIATE" as const : i % 2 === 0 ? "URGENT" as const : "PRIORITY" as const,
      status: i % 5 === 0 ? "SCHEDULED" as const : i % 3 === 0 ? "IN_PROGRESS" as const : "OPEN" as const,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 4000) + 300),
    });
  }

  // Additional immediate hazards (internal severity)
  for (let i = 0; i < AWAABS_COUNTS.IMMEDIATE_HAZARDS; i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[(i + 3000) % propertyIds.length];
    const hoursOverdue = Math.floor(rng.random() * 48) + 24;
    const dueDate = new Date(Date.now() - hoursOverdue * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: "Immediate hazard requiring urgent attention - safety risk identified",
      severity: "IMMEDIATE" as const,
      status: "OPEN" as const,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 2000) + 100),
    });
  }

  // Overdue actions (mix of severities)
  const overdueSeverities = ["URGENT", "PRIORITY", "ROUTINE"] as const;
  for (let i = 0; i < AWAABS_COUNTS.OVERDUE_ACTIONS; i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[(i + 4000) % propertyIds.length];
    const daysOverdue = Math.floor(rng.random() * 60) + 1;
    const dueDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
    
    values.push({
      certificateId: certId,
      propertyId,
      description: `Remedial action ${i + 1} - follow-up work required from inspection`,
      severity: overdueSeverities[i % overdueSeverities.length],
      status: i % 3 === 0 ? "IN_PROGRESS" as const : "OPEN" as const,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 3000) + 150),
    });
  }

  // Remaining scheduled/future actions (not breaching)
  const remainingCount = Math.floor(certIds.length * config.remedialsPerCertificate) - values.length;
  const futureSeverities = ["PRIORITY", "ROUTINE", "ADVISORY"] as const;
  const futureStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OPEN"] as const;
  for (let i = 0; i < Math.max(remainingCount, 0); i++) {
    const certId = certIds[idx++ % certIds.length];
    const propertyId = propertyIds[(i + 5000) % propertyIds.length];
    const daysUntilDue = Math.floor(rng.random() * 90) + 1;
    const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);
    const status = futureStatuses[i % futureStatuses.length];
    
    values.push({
      certificateId: certId,
      propertyId,
      description: `${ROUTINE_DESCRIPTIONS[i % ROUTINE_DESCRIPTIONS.length]} - scheduled maintenance`,
      severity: futureSeverities[i % futureSeverities.length],
      status,
      dueDate: dueDate.toISOString().split('T')[0],
      costEstimate: String(Math.floor(rng.random() * 2000) + 100),
    });
  }

  console.log(`  Creating ${values.length} remedial actions (${AWAABS_COUNTS.PHASE1_BREACHES} Phase 1, ${AWAABS_COUNTS.PHASE2_BREACHES} Phase 2, ${AWAABS_COUNTS.PHASE3_BREACHES} Phase 3 breaches)`);
  
  let done = 0;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(remedialActions).values(batch);
    done += batch.length;
    updateProgress("remedials", done, values.length);
  }
  
  console.log(`  ✓ ${values.length} remedial actions with Awaab's Law breach scenarios`);
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
