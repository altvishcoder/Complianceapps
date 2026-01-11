import { db } from "./db";
import { 
  schemes, blocks, properties, components, componentTypes,
  certificates, remedialActions, extractions, extractionRuns,
  complianceStreams, certificateTypes as certTypesTable,
  riskSnapshots, spaces, propertyRiskSnapshots, auditEvents
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const BATCH_SIZE = 100;

const UK_CITIES = [
  { city: "London", postcodePrefix: "SW", region: "Greater London" },
  { city: "Manchester", postcodePrefix: "M", region: "Greater Manchester" },
  { city: "Birmingham", postcodePrefix: "B", region: "West Midlands" },
  { city: "Leeds", postcodePrefix: "LS", region: "West Yorkshire" },
  { city: "Liverpool", postcodePrefix: "L", region: "Merseyside" },
  { city: "Newcastle", postcodePrefix: "NE", region: "Tyne and Wear" },
  { city: "Sheffield", postcodePrefix: "S", region: "South Yorkshire" },
  { city: "Bristol", postcodePrefix: "BS", region: "Bristol" },
  { city: "Nottingham", postcodePrefix: "NG", region: "Nottinghamshire" },
  { city: "Glasgow", postcodePrefix: "G", region: "Scotland" },
];

const REAL_UK_POSTCODES: Record<string, string[]> = {
  "SW": ["SW1A 1AA", "SW1A 2AA", "SW1P 3AE", "SW1V 1DX", "SW1W 9SR", "SW3 4LY", "SW6 1BA", "SW7 2AZ", "SW8 2JB", "SW10 0DQ", "SW11 1PQ", "SW12 8NP", "SW15 2LW", "SW16 1BJ", "SW17 0TW", "SW18 2PX", "SW19 4TZ", "SW20 0AQ"],
  "M": ["M1 1AD", "M2 4JW", "M3 4LE", "M4 2AF", "M11 4EQ", "M12 5NG", "M13 9PL", "M14 5RL", "M15 4PR", "M16 0BP", "M19 2SY", "M20 3BN", "M21 9JE", "M22 4RW", "M23 2PA", "M32 0EZ", "M33 2SZ", "M34 3AB", "M40 2NR", "M45 8QQ"],
  "B": ["B1 1BB", "B2 4QA", "B3 3PL", "B4 7ET", "B5 4TD", "B6 4SB", "B7 4BB", "B8 1RS", "B9 4AA", "B10 0DR", "B11 1LT", "B12 9BH", "B13 8RD", "B15 2TH", "B16 8LP", "B17 8AY", "B18 4RG", "B19 2YP", "B20 2AE", "B21 8EZ", "B23 5PA", "B24 9HB", "B25 8EX"],
  "LS": ["LS1 1UR", "LS2 7JT", "LS3 1AD", "LS5 3BT", "LS6 1AP", "LS7 1AU", "LS8 1HD", "LS9 6JT", "LS10 1NN", "LS12 3HE", "LS13 2AF", "LS14 6GJ", "LS15 0EL", "LS16 5NL", "LS17 6QY", "LS18 4LN", "LS19 7AE", "LS20 8BH", "LS21 1AE", "LS22 7AD"],
  "L": ["L1 0AA", "L2 0NJ", "L3 4AA", "L4 3TG", "L5 5AF", "L6 1HY", "L7 2PZ", "L8 0RD", "L9 7AL", "L10 4YQ", "L11 2SH", "L12 2AY", "L13 0AN", "L14 0JF", "L15 0HD", "L16 9JN", "L17 0AU", "L18 1JU", "L19 0LF", "L22 0NH", "L23 2RL"],
  "NE": ["NE1 4LP", "NE2 1AN", "NE4 6PR", "NE5 3PB", "NE8 2ET", "NE9 5DQ", "NE10 0ES", "NE11 9DH", "NE12 6AQ", "NE13 6PD", "NE15 6NJ", "NE16 3PA", "NE20 0AB", "NE21 4JL", "NE22 5AB", "NE23 6JR", "NE24 4RU", "NE25 8AL", "NE26 2TN", "NE28 6EN"],
  "S": ["S1 1WB", "S2 4UP", "S3 7EW", "S5 6LT", "S6 3GL", "S7 1LA", "S8 0QJ", "S9 1WG", "S10 2PN", "S11 9PN", "S12 4LE", "S13 9LF", "S17 3GU", "S18 2BT", "S20 6PH", "S21 4AE", "S25 2QZ", "S26 4UT", "S35 2PA", "S40 1SZ", "S41 0EW"],
  "BS": ["BS1 3LG", "BS2 0LQ", "BS3 1JL", "BS4 3JR", "BS5 0BB", "BS6 5RQ", "BS7 8PA", "BS8 2LR", "BS9 3HT", "BS10 5EH", "BS11 0DE", "BS13 0EZ", "BS14 0LH", "BS15 1SW", "BS16 1QY", "BS20 7AE", "BS21 6PH", "BS22 8AB", "BS23 1PR", "BS24 0PB", "BS30 5JA"],
  "NG": ["NG1 1GF", "NG2 2JQ", "NG3 5AW", "NG4 1JY", "NG5 1HQ", "NG6 0DH", "NG7 2ND", "NG8 1PA", "NG9 2JQ", "NG10 1LT", "NG11 6PN", "NG12 3AD", "NG13 8AN", "NG14 6BQ", "NG15 0BL", "NG16 2NJ", "NG17 2EU", "NG19 6AA", "NG21 9AF", "NG22 0ND", "NG24 1PP"],
  "G": ["G1 1XQ", "G2 4JR", "G3 7RW", "G4 9PA", "G5 8AB", "G11 5QH", "G12 8QQ", "G13 1NN", "G14 0AP", "G20 9ED", "G21 2AB", "G22 6BP", "G31 1JP", "G32 6JL", "G33 4JU", "G34 9LQ", "G40 2AA", "G41 3AB", "G42 9DL", "G43 1EP", "G44 3EE", "G45 9NS"],
};

const STREET_NAMES = [
  "High Street", "Church Lane", "Station Road", "Park Avenue", "Victoria Road",
  "Queen Street", "King Street", "Market Square", "The Crescent", "Oak Drive",
  "Elm Close", "Cedar Way", "Maple Road", "Willow Lane", "Birch Avenue"
];

const BLOCK_NAMES = [
  "Tower", "House", "Court", "Lodge", "Heights", "View", "Place", "Point", "Rise", "Mansions"
];

const BLOCK_PREFIXES = [
  "Oak", "Elm", "Birch", "Cedar", "Maple", "Pine", "Ash", "Willow", "Holly", "Rowan",
  "Churchill", "Victoria", "Elizabeth", "Wellington", "Nelson", "Drake", "Crown", "Royal"
];

const COMPONENT_MANUFACTURERS = [
  "Worcester Bosch", "Vaillant", "Baxi", "Ideal", "Potterton", "Glow-worm",
  "Aico", "Kidde", "Honeywell", "Nest", "Hive", "Drayton",
  "MK Electric", "Hager", "Schneider", "ABB", "Wylex", "Consumer Unit Direct"
];

// HACT-aligned room types for dwellings
const DWELLING_ROOM_TYPES = [
  { name: "Kitchen", spaceType: "ROOM" as const, floor: "Ground" },
  { name: "Living Room", spaceType: "ROOM" as const, floor: "Ground" },
  { name: "Bathroom", spaceType: "ROOM" as const, floor: "Ground" },
  { name: "Hallway", spaceType: "CIRCULATION" as const, floor: "Ground" },
];

// HACT-aligned communal areas for blocks
const BLOCK_COMMUNAL_AREAS = [
  { name: "Main Stairwell", spaceType: "CIRCULATION" as const },
  { name: "Plant Room", spaceType: "UTILITY" as const },
  { name: "Bin Store", spaceType: "STORAGE" as const },
  { name: "Entrance Lobby", spaceType: "COMMUNAL_AREA" as const },
];

// Component to space mapping - which room types typically contain which components
const COMPONENT_ROOM_MAPPING: Record<string, string> = {
  "GAS_BOILER": "Kitchen",
  "CONSUMER_UNIT": "Hallway",
  "SMOKE_DETECTOR": "Hallway",
  "CO_DETECTOR": "Kitchen",
  "ELECTRIC_HEATER": "Living Room",
  "EXTRACTOR_FAN": "Bathroom",
};

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUPRN(index: number): string {
  return `${100000000 + index}`;
}

function generatePostcode(prefix: string): string {
  const realPostcodes = REAL_UK_POSTCODES[prefix];
  if (realPostcodes && realPostcodes.length > 0) {
    return randomChoice(realPostcodes);
  }
  return `${prefix}${randomInt(1, 20)} ${randomInt(1, 9)}${String.fromCharCode(65 + randomInt(0, 25))}${String.fromCharCode(65 + randomInt(0, 25))}`;
}

function generateCertificateNumber(type: string, index: number): string {
  const prefixes: Record<string, string> = {
    GAS_SAFETY: "GSC",
    EICR: "EICR",
    EPC: "EPC",
    FIRE_RISK_ASSESSMENT: "FRA",
    LEGIONELLA_ASSESSMENT: "LRA",
    ASBESTOS_SURVEY: "ASB",
    LIFT_LOLER: "LOLER"
  };
  return `${prefixes[type] || "CERT"}-${Date.now().toString(36).toUpperCase()}-${index.toString().padStart(6, "0")}`;
}

function generateDateInPast(maxDaysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(1, maxDaysAgo));
  return date.toISOString().split("T")[0];
}

function generateFutureDate(minDays: number, maxDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(minDays, maxDays));
  return date.toISOString().split("T")[0];
}

function generatePastDueDate(minDaysAgo: number, maxDaysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(minDaysAgo, maxDaysAgo));
  return date.toISOString().split("T")[0];
}

function generateExpiringSoonDate(minDays: number = 1, maxDays: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(minDays, maxDays));
  return date.toISOString().split("T")[0];
}

function generateExpiryDate(issueDate: string, type: string): string {
  const issue = new Date(issueDate);
  const validityMonths: Record<string, number> = {
    GAS_SAFETY: 12,
    EICR: 60,
    EPC: 120,
    FIRE_RISK_ASSESSMENT: 12,
    LEGIONELLA_ASSESSMENT: 24,
    ASBESTOS_SURVEY: 36,
    LIFT_LOLER: 6
  };
  issue.setMonth(issue.getMonth() + (validityMonths[type] || 12));
  return issue.toISOString().split("T")[0];
}

async function getOrCreateComponentTypes(): Promise<Map<string, string>> {
  const existing = await db.select().from(componentTypes);
  const typeMap = new Map<string, string>();
  
  for (const ct of existing) {
    typeMap.set(ct.code, ct.id);
  }
  
  const defaultTypes = [
    { code: "GAS_BOILER", name: "Gas Boiler", category: "HEATING" as const, isHighRisk: true },
    { code: "CONSUMER_UNIT", name: "Consumer Unit", category: "ELECTRICAL" as const, isHighRisk: true },
    { code: "SMOKE_DETECTOR", name: "Smoke Detector", category: "FIRE_SAFETY" as const, isHighRisk: true },
    { code: "CO_DETECTOR", name: "Carbon Monoxide Detector", category: "FIRE_SAFETY" as const, isHighRisk: true },
    { code: "HEAT_DETECTOR", name: "Heat Detector", category: "FIRE_SAFETY" as const, isHighRisk: false },
    { code: "FIRE_DOOR", name: "Fire Door", category: "FIRE_SAFETY" as const, isHighRisk: true },
    { code: "WATER_TANK", name: "Water Storage Tank", category: "WATER" as const, isHighRisk: false },
    { code: "RADIATOR", name: "Radiator", category: "HEATING" as const, isHighRisk: false },
    { code: "EXTRACTOR_FAN", name: "Extractor Fan", category: "VENTILATION" as const, isHighRisk: false },
    { code: "ELECTRIC_HEATER", name: "Electric Heater", category: "HEATING" as const, isHighRisk: false },
  ];
  
  for (const dt of defaultTypes) {
    if (!typeMap.has(dt.code)) {
      const [created] = await db.insert(componentTypes).values({
        code: dt.code,
        name: dt.name,
        category: dt.category,
        isHighRisk: dt.isHighRisk,
        buildingSafetyRelevant: dt.isHighRisk,
      }).returning();
      typeMap.set(dt.code, created.id);
    }
  }
  
  return typeMap;
}

async function getOrCreateComplianceStreams(): Promise<Map<string, string>> {
  const existing = await db.select().from(complianceStreams);
  const streamMap = new Map<string, string>();
  
  for (const cs of existing) {
    streamMap.set(cs.code, cs.id);
  }
  
  const defaultStreams = [
    { code: "GAS_HEATING", name: "Gas & Heating", colorCode: "#F97316" },
    { code: "ELECTRICAL", name: "Electrical Safety", colorCode: "#EAB308" },
    { code: "FIRE_SAFETY", name: "Fire Safety", colorCode: "#EF4444" },
    { code: "WATER_SAFETY", name: "Water Safety (Legionella)", colorCode: "#3B82F6" },
    { code: "ASBESTOS", name: "Asbestos Management", colorCode: "#8B5CF6" },
    { code: "LIFT_EQUIPMENT", name: "Lifting Equipment", colorCode: "#06B6D4" },
    { code: "ENERGY", name: "Energy Performance", colorCode: "#22C55E" },
  ];
  
  for (const ds of defaultStreams) {
    if (!streamMap.has(ds.code)) {
      const [created] = await db.insert(complianceStreams).values({
        code: ds.code,
        name: ds.name,
        colorCode: ds.colorCode,
        isSystem: true,
        isActive: true,
      }).returning();
      streamMap.set(ds.code, created.id);
    }
  }
  
  return streamMap;
}

export interface SeedProgressCallback {
  (entity: string, done: number, total: number): void;
}

export interface SeedConfig {
  organisationId: string;
  schemeCount?: number;
  blocksPerScheme?: number;
  propertiesPerBlock?: number;
  componentsPerProperty?: number;
  certificatesPerProperty?: number;
  remedialsPerCertificate?: number;
  onProgress?: SeedProgressCallback;
  shouldCancel?: () => boolean;
}

export interface SeedResult {
  schemes: number;
  blocks: number;
  properties: number;
  spaces: number;
  components: number;
  certificates: number;
  remedialActions: number;
  auditEvents?: number;
  cancelled?: boolean;
}

export async function generateComprehensiveDemoData(config: SeedConfig): Promise<SeedResult> {
  const {
    organisationId,
    schemeCount = 20,
    blocksPerScheme = 5,
    propertiesPerBlock = 20,
    componentsPerProperty = 4,
    certificatesPerProperty = 3,
    remedialsPerCertificate = 0, // 0 means use outcome-based logic
    onProgress,
    shouldCancel,
  } = config;

  const targetProperties = schemeCount * blocksPerScheme * propertiesPerBlock;
  const targetComponents = targetProperties * componentsPerProperty;
  const targetCertificates = targetProperties * certificatesPerProperty;
  const targetRemedials = remedialsPerCertificate > 0 
    ? targetCertificates * remedialsPerCertificate 
    : Math.ceil(targetCertificates * 0.3);

  console.log("Starting comprehensive demo data generation...");
  console.log(`Target: ${schemeCount} schemes, ${schemeCount * blocksPerScheme} blocks, ${targetProperties} properties`);

  // Check for existing demo schemes to enable resume functionality
  const existingDemoSchemes = await db.select({ id: schemes.id, reference: schemes.reference }).from(schemes)
    .where(sql`${schemes.organisationId} = ${organisationId} AND ${schemes.reference} LIKE 'SCH-DEMO-%'`);
  
  let startSchemeIndex = 0;
  
  if (existingDemoSchemes.length > 0) {
    const demoCounts = await getDemoDataCounts(organisationId);
    const isComplete = demoCounts.properties >= targetProperties &&
                       demoCounts.components >= targetComponents &&
                       demoCounts.certificates >= targetCertificates;
    
    if (isComplete) {
      console.log("Comprehensive demo data already exists and is complete, skipping generation");
      return demoCounts;
    } else {
      // Resume from where we left off instead of wiping
      startSchemeIndex = existingDemoSchemes.length;
      console.log(`Resuming from scheme ${startSchemeIndex + 1}/${schemeCount} (${demoCounts.properties.toLocaleString()} properties already exist)`);
    }
  }

  const componentTypeMap = await getOrCreateComponentTypes();
  const streamMap = await getOrCreateComplianceStreams();

  const stats = {
    schemes: 0,
    blocks: 0,
    properties: 0,
    spaces: 0,
    components: 0,
    certificates: 0,
    remedialActions: 0,
  };

  // Calculate starting indices for resume
  let propertyIndex = startSchemeIndex * blocksPerScheme * propertiesPerBlock;
  let certIndex = propertyIndex * certificatesPerProperty;

  for (let s = startSchemeIndex; s < schemeCount; s++) {
    // Check for cancellation before each scheme
    if (shouldCancel?.()) {
      console.log("Seeding cancelled by user");
      return { ...stats, cancelled: true };
    }
    
    const cityData = UK_CITIES[s % UK_CITIES.length];
    
    const [scheme] = await db.insert(schemes).values({
      organisationId,
      name: `${cityData.city} Housing Estate ${s + 1}`,
      reference: `SCH-DEMO-${(s + 1).toString().padStart(3, "0")}`,
    }).returning();
    stats.schemes++;
    onProgress?.("schemes", stats.schemes, schemeCount);

    const blockBatch: any[] = [];
    for (let b = 0; b < blocksPerScheme; b++) {
      blockBatch.push({
        schemeId: scheme.id,
        name: `${randomChoice(BLOCK_PREFIXES)} ${randomChoice(BLOCK_NAMES)}`,
        reference: `BLK-DEMO-${s + 1}-${(b + 1).toString().padStart(3, "0")}`,
      });
    }
    
    const createdBlocks = await db.insert(blocks).values(blockBatch).returning();
    stats.blocks += createdBlocks.length;
    onProgress?.("blocks", stats.blocks, schemeCount * blocksPerScheme);

    // Create communal spaces for ALL blocks in this scheme (batched, with dedup guard)
    const blockSpaceBatch: any[] = [];
    for (const block of createdBlocks) {
      for (const area of BLOCK_COMMUNAL_AREAS) {
        blockSpaceBatch.push({
          blockId: block.id,
          name: area.name,
          reference: `SPC-${block.id.slice(0, 8)}-${area.name.replace(/\s+/g, '-').toUpperCase()}`,
          spaceType: area.spaceType,
          description: `${area.name} in ${block.name}`,
          isAccessible: area.spaceType !== 'UTILITY',
          requiresKeyAccess: area.spaceType === 'UTILITY',
        });
      }
    }
    
    // Use ON CONFLICT to handle resume scenarios without duplicate errors
    const createdBlockSpaces = await db.insert(spaces).values(blockSpaceBatch)
      .onConflictDoNothing({ target: spaces.reference })
      .returning();
    stats.spaces = (stats.spaces || 0) + createdBlockSpaces.length;

    // Build a map of block ID -> space name -> space ID for component linking
    const blockSpacesByBlock = new Map<string, Map<string, string>>();
    for (const space of createdBlockSpaces) {
      if (!space.blockId) continue;
      if (!blockSpacesByBlock.has(space.blockId)) {
        blockSpacesByBlock.set(space.blockId, new Map());
      }
      blockSpacesByBlock.get(space.blockId)!.set(space.name, space.id);
    }

    for (const block of createdBlocks) {
      // Check for cancellation before each block
      if (shouldCancel?.()) {
        console.log("Seeding cancelled by user (during block processing)");
        return { ...stats, cancelled: true };
      }
      
      const propertyBatch: any[] = [];
      
      for (let p = 0; p < propertiesPerBlock; p++) {
        propertyIndex++;
        const flatNum = p + 1;
        const street = randomChoice(STREET_NAMES);
        const hasGas = Math.random() > 0.15;
        const complianceStatuses = ["COMPLIANT", "COMPLIANT", "COMPLIANT", "EXPIRING_SOON", "OVERDUE", "NON_COMPLIANT"] as const;
        
        propertyBatch.push({
          blockId: block.id,
          uprn: generateUPRN(propertyIndex),
          addressLine1: `Flat ${flatNum}, ${block.name}`,
          addressLine2: `${randomInt(1, 200)} ${street}`,
          city: cityData.city,
          postcode: generatePostcode(cityData.postcodePrefix),
          propertyType: randomChoice(["FLAT", "FLAT", "FLAT", "MAISONETTE", "HOUSE"]),
          tenure: randomChoice(["SOCIAL_RENT", "SOCIAL_RENT", "AFFORDABLE_RENT", "LEASEHOLD", "SHARED_OWNERSHIP"]),
          bedrooms: randomInt(1, 4),
          hasGas,
          complianceStatus: randomChoice(complianceStatuses),
        });
      }
      
      const createdProperties = await db.insert(properties).values(propertyBatch).returning();
      stats.properties += createdProperties.length;
      onProgress?.("properties", stats.properties, targetProperties);

      // Create dwelling spaces for ALL properties in this block (batched insert)
      const allPropertySpacesBatch: any[] = [];
      for (const property of createdProperties) {
        for (const room of DWELLING_ROOM_TYPES) {
          allPropertySpacesBatch.push({
            propertyId: property.id,
            name: room.name,
            reference: `SPC-${property.id.slice(0, 8)}-${room.name.replace(/\s+/g, '-').toUpperCase()}`,
            spaceType: room.spaceType,
            floor: room.floor,
            description: `${room.name} in ${property.addressLine1}`,
            isAccessible: true,
          });
        }
      }
      
      // Batch insert all property spaces for this block (with conflict guard for resume)
      const createdPropertySpaces = await db.insert(spaces).values(allPropertySpacesBatch)
        .onConflictDoNothing({ target: spaces.reference })
        .returning();
      stats.spaces = (stats.spaces || 0) + createdPropertySpaces.length;

      // Build a map of property ID -> room name -> space ID for component linking
      const propertySpacesByProperty = new Map<string, Map<string, string>>();
      for (const space of createdPropertySpaces) {
        if (!space.propertyId) continue;
        if (!propertySpacesByProperty.has(space.propertyId)) {
          propertySpacesByProperty.set(space.propertyId, new Map());
        }
        propertySpacesByProperty.get(space.propertyId)!.set(space.name, space.id);
      }

      const componentBatch: any[] = [];
      const certBatch: { cert: any; actions: any[] }[] = [];
      
      for (const property of createdProperties) {
        const propertySpaceMap = propertySpacesByProperty.get(property.id) || new Map();

        const hasGas = Math.random() > 0.15;
        const componentTypeCodes = hasGas 
          ? ["GAS_BOILER", "CONSUMER_UNIT", "SMOKE_DETECTOR", "CO_DETECTOR"]
          : ["ELECTRIC_HEATER", "CONSUMER_UNIT", "SMOKE_DETECTOR", "EXTRACTOR_FAN"];
        
        for (let c = 0; c < componentsPerProperty; c++) {
          const typeCode = componentTypeCodes[c % componentTypeCodes.length];
          const typeId = componentTypeMap.get(typeCode);
          if (!typeId) continue;
          
          // Find the appropriate space for this component type
          const roomName = COMPONENT_ROOM_MAPPING[typeCode] || "Hallway";
          const spaceId = propertySpaceMap.get(roomName);
          
          componentBatch.push({
            propertyId: property.id,
            spaceId: spaceId,
            componentTypeId: typeId,
            assetTag: `AST-${propertyIndex}-${c + 1}`,
            serialNumber: `SN${Date.now().toString(36).toUpperCase()}${randomInt(1000, 9999)}`,
            manufacturer: randomChoice(COMPONENT_MANUFACTURERS),
            model: `Model ${randomChoice(["X", "Y", "Z", "Pro", "Elite", "Plus"])}${randomInt(100, 999)}`,
            location: roomName,
            installDate: generateDateInPast(365 * 5),
            condition: randomChoice(["GOOD", "GOOD", "FAIR", "POOR"]),
            complianceStatus: randomChoice(["COMPLIANT", "COMPLIANT", "EXPIRING_SOON", "UNKNOWN"]),
            isActive: true,
          });
        }

        // Extended certificate types to support 10+ per property
        const certTypes = [
          "GAS_SAFETY", "EICR", "EPC", "FIRE_RISK_ASSESSMENT", 
          "LEGIONELLA_ASSESSMENT", "ASBESTOS_SURVEY", "LIFT_LOLER",
          "GAS_SAFETY", "EICR", "FIRE_RISK_ASSESSMENT" // Allow duplicates for cycling
        ] as const;
        for (let ct = 0; ct < certificatesPerProperty; ct++) {
          certIndex++;
          const certType = certTypes[ct % certTypes.length];
          
          let issueDate: string;
          let expiryDate: string;
          
          if (certIndex % 8 === 0) {
            issueDate = generateDateInPast(340);
            expiryDate = generateExpiringSoonDate(1, 30);
          } else {
            issueDate = generateDateInPast(300);
            expiryDate = generateExpiryDate(issueDate, certType);
          }
          
          const isExpired = new Date(expiryDate) < new Date();
          const isExpiringSoon = !isExpired && new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          const outcome = isExpired 
            ? randomChoice(["UNSATISFACTORY", "FAIL", "AT_RISK"])
            : isExpiringSoon 
              ? randomChoice(["SATISFACTORY", "PASS", "UNSATISFACTORY"])
              : certIndex % 4 === 0
                ? randomChoice(["UNSATISFACTORY", "FAIL", "AT_RISK"])
                : randomChoice(["SATISFACTORY", "SATISFACTORY", "PASS", "PASS"]);
          
          const certData = {
            organisationId,
            propertyId: property.id,
            blockId: block.id,
            fileName: `${certType.toLowerCase().replace(/_/g, "-")}-${property.uprn}.pdf`,
            fileType: "application/pdf",
            fileSize: randomInt(50000, 500000),
            certificateType: certType,
            status: randomChoice(["APPROVED", "APPROVED", "APPROVED", "EXTRACTED", "NEEDS_REVIEW"]),
            certificateNumber: generateCertificateNumber(certType, certIndex),
            issueDate,
            expiryDate,
            outcome,
          };

          const actions: any[] = [];
          // Generate remedials either based on outcome or fixed count
          const shouldGenerateRemedials = remedialsPerCertificate > 0 || 
            outcome === "UNSATISFACTORY" || outcome === "FAIL" || outcome === "AT_RISK";
          
          if (shouldGenerateRemedials) {
            const actionCount = remedialsPerCertificate > 0 
              ? remedialsPerCertificate 
              : randomInt(1, 3);
            
            for (let a = 0; a < actionCount; a++) {
              const severityRoll = Math.random();
              const severity = severityRoll < 0.25 ? "IMMEDIATE" 
                : severityRoll < 0.50 ? "URGENT"
                : severityRoll < 0.70 ? "PRIORITY"
                : severityRoll < 0.85 ? "ROUTINE"
                : "ADVISORY";
              
              const isOverdue = Math.random() < 0.25;
              const dueDate = isOverdue 
                ? generatePastDueDate(1, 30)
                : generateFutureDate(7, 90);
              
              actions.push({
                propertyId: property.id,
                code: `DEF-${randomInt(100, 999)}`,
                category: certType,
                description: randomChoice([
                  "Replace faulty component",
                  "Urgent repair required", 
                  "Safety inspection overdue",
                  "Maintenance work needed",
                  "Component requires servicing",
                  "Gas appliance condemned - immediate replacement needed",
                  "Electrical hazard - consumer unit requires upgrade",
                  "Fire door defective - fire stopping compromised",
                  "Damp and mould remediation required",
                ]),
                location: randomChoice(["Kitchen", "Hallway", "Living Room", "Bedroom", "Bathroom"]),
                severity,
                status: isOverdue ? "OPEN" : randomChoice(["OPEN", "OPEN", "IN_PROGRESS", "SCHEDULED"]),
                dueDate,
              });
            }
          }
          
          certBatch.push({ cert: certData, actions });
        }
      }

      if (componentBatch.length > 0) {
        // Check for cancellation before component insertion
        if (shouldCancel?.()) {
          console.log("Seeding cancelled by user (before components)");
          return { ...stats, cancelled: true };
        }
        for (let i = 0; i < componentBatch.length; i += BATCH_SIZE) {
          const batch = componentBatch.slice(i, i + BATCH_SIZE);
          await db.insert(components).values(batch);
          stats.components += batch.length;
        }
        onProgress?.("components", stats.components, targetComponents);
      }

      // Check for cancellation before certificate insertion
      if (shouldCancel?.()) {
        console.log("Seeding cancelled by user (before certificates)");
        return { ...stats, cancelled: true };
      }

      for (let i = 0; i < certBatch.length; i += BATCH_SIZE) {
        const batch = certBatch.slice(i, i + BATCH_SIZE);
        const certValues = batch.map(b => b.cert);
        const createdCerts = await db.insert(certificates).values(certValues).returning();
        stats.certificates += createdCerts.length;
        onProgress?.("certificates", stats.certificates, targetCertificates);

        const allActions: any[] = [];
        for (let j = 0; j < createdCerts.length; j++) {
          const certId = createdCerts[j].id;
          const actionsForCert = batch[j].actions;
          for (const action of actionsForCert) {
            allActions.push({ ...action, certificateId: certId });
          }
        }
        
        // Batch remedial action inserts to avoid timeouts with large volumes
        if (allActions.length > 0) {
          for (let ra = 0; ra < allActions.length; ra += BATCH_SIZE) {
            const actionBatch = allActions.slice(ra, ra + BATCH_SIZE);
            await db.insert(remedialActions).values(actionBatch);
            stats.remedialActions += actionBatch.length;
          }
          onProgress?.("remedials", stats.remedialActions, targetRemedials);
        }
      }
    }

    console.log(`Completed scheme ${s + 1}/${schemeCount}: ${scheme.name}`);
  }

  console.log("Demo data generation complete:", stats);
  
  // Check for cancellation before risk snapshots
  if (shouldCancel?.()) {
    console.log("Seeding cancelled by user (before risk snapshots)");
    return { ...stats, cancelled: true };
  }
  
  console.log("Generating risk snapshots for all properties...");
  onProgress?.("riskSnapshots", 0, stats.properties);
  const riskSnapshotResult = await seedPropertyRiskSnapshots(organisationId, onProgress, shouldCancel);
  console.log(`Created ${riskSnapshotResult.count} property risk snapshots`);
  
  if (riskSnapshotResult.cancelled) {
    return { ...stats, cancelled: true };
  }
  
  // Seed audit events for demo data (only once per seeding)
  console.log("Generating audit events for demo data...");
  const propertyIds = await db.select({ id: properties.id }).from(properties)
    .innerJoin(blocks, eq(properties.blockId, blocks.id))
    .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
    .where(eq(schemes.organisationId, organisationId))
    .then(rows => rows.map(r => r.id));
  
  const certificateIds = await db.select({ id: certificates.id }).from(certificates)
    .where(sql`${certificates.propertyId} IN (${sql.join(propertyIds.slice(0, 1000).map(id => sql`${id}`), sql`, `)})`)
    .limit(1000)
    .then(rows => rows.map(r => r.id));
  
  await seedAuditEvents(organisationId, propertyIds, certificateIds);
  
  const finalCounts = await getDemoDataCounts(organisationId);
  console.log("Final verification counts:", finalCounts);
  
  return finalCounts;
}

async function seedPropertyRiskSnapshots(
  organisationId: string,
  onProgress?: SeedProgressCallback,
  shouldCancel?: () => boolean
): Promise<{ count: number; cancelled?: boolean }> {
  const allProperties = await db.select({
    id: properties.id,
    blockId: properties.blockId,
  }).from(properties)
  .innerJoin(blocks, eq(properties.blockId, blocks.id))
  .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
  .where(eq(schemes.organisationId, organisationId));

  if (allProperties.length === 0) {
    return { count: 0 };
  }

  const riskTiers: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const tierWeights = [0.08, 0.17, 0.35, 0.40];
  
  const triggerFactorOptions = [
    "Gas Safety Certificate expiring within 7 days",
    "EICR overdue by 30+ days",
    "Multiple open defects on property",
    "Fire Risk Assessment not completed",
    "High-rise building without adequate fire safety coverage",
    "Vulnerable occupants identified",
    "Legionella assessment overdue",
    "Lift inspection required",
    "Asbestos survey expired",
    "Consumer unit requires replacement",
  ];

  const recommendedActionOptions = [
    "Schedule urgent gas safety inspection",
    "Book electrical inspection contractor",
    "Complete fire risk assessment",
    "Address outstanding defects",
    "Update compliance calendar",
    "Contact contractor for remedial works",
    "Review tenant vulnerability status",
    "Commission legionella risk assessment",
    "Arrange lift LOLER inspection",
  ];

  const snapshotBatch: any[] = [];
  
  for (let i = 0; i < allProperties.length; i++) {
    const prop = allProperties[i];
    
    const tierRoll = Math.random();
    let cumulative = 0;
    let selectedTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    for (let t = 0; t < tierWeights.length; t++) {
      cumulative += tierWeights[t];
      if (tierRoll < cumulative) {
        selectedTier = riskTiers[t];
        break;
      }
    }

    const scoreRanges = {
      CRITICAL: [75, 100],
      HIGH: [55, 74],
      MEDIUM: [35, 54],
      LOW: [10, 34],
    };
    const range = scoreRanges[selectedTier];
    const overallScore = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));

    const expiryRiskScore = Math.floor(Math.random() * 100);
    const defectRiskScore = Math.floor(Math.random() * 100);
    const assetProfileRiskScore = Math.floor(Math.random() * 100);
    const coverageGapRiskScore = Math.floor(Math.random() * 100);
    const externalFactorRiskScore = Math.floor(Math.random() * 100);

    const numFactors = selectedTier === 'CRITICAL' ? randomInt(3, 5) 
      : selectedTier === 'HIGH' ? randomInt(2, 4)
      : selectedTier === 'MEDIUM' ? randomInt(1, 3)
      : randomInt(0, 1);
    
    const triggeringFactors = [];
    for (let f = 0; f < numFactors; f++) {
      triggeringFactors.push(triggerFactorOptions[(i + f) % triggerFactorOptions.length]);
    }

    const numActions = Math.max(1, numFactors);
    const recommendedActions = [];
    for (let a = 0; a < numActions; a++) {
      recommendedActions.push(recommendedActionOptions[(i + a) % recommendedActionOptions.length]);
    }

    const trendOptions = ['UP', 'DOWN', 'STABLE'];
    const trendDirection = trendOptions[i % 3];
    const scoreChange = trendDirection === 'UP' ? randomInt(1, 10) 
      : trendDirection === 'DOWN' ? -randomInt(1, 10) 
      : 0;

    snapshotBatch.push({
      organisationId,
      propertyId: prop.id,
      overallScore,
      riskTier: selectedTier,
      expiryRiskScore,
      defectRiskScore,
      assetProfileRiskScore,
      coverageGapRiskScore,
      externalFactorRiskScore,
      factorBreakdown: {
        expiringCertificates: selectedTier === 'CRITICAL' ? randomInt(2, 5) : selectedTier === 'HIGH' ? randomInt(1, 3) : randomInt(0, 1),
        overdueCertificates: selectedTier === 'CRITICAL' ? randomInt(1, 3) : randomInt(0, 1),
        openDefects: randomInt(0, 5),
        criticalDefects: selectedTier === 'CRITICAL' ? randomInt(1, 3) : randomInt(0, 1),
        missingStreams: selectedTier === 'HIGH' || selectedTier === 'CRITICAL' ? ['FIRE_SAFETY', 'ASBESTOS'].slice(0, randomInt(0, 2)) : [],
        assetAge: randomInt(5, 30),
        isHRB: Math.random() < 0.15,
        hasVulnerableOccupants: Math.random() < 0.25,
        epcRating: ['A', 'B', 'C', 'D', 'E', 'F', 'G'][randomInt(0, 6)],
      },
      triggeringFactors,
      recommendedActions,
      legislationReferences: ['Gas Safety (Installation and Use) Regulations 1998', 'BS 7671 Wiring Regulations'],
      previousScore: overallScore - scoreChange,
      scoreChange,
      trendDirection,
      isLatest: true,
    });
  }

  let insertedCount = 0;
  for (let i = 0; i < snapshotBatch.length; i += BATCH_SIZE) {
    // Check for cancellation during risk snapshot insertion
    if (shouldCancel?.()) {
      console.log("Seeding cancelled by user (during risk snapshots)");
      return { count: insertedCount, cancelled: true };
    }
    
    const batch = snapshotBatch.slice(i, i + BATCH_SIZE);
    await db.insert(propertyRiskSnapshots).values(batch);
    insertedCount += batch.length;
    
    // Report progress every batch
    onProgress?.("riskSnapshots", insertedCount, snapshotBatch.length);
    
    if ((i / BATCH_SIZE) % 5 === 0) {
      console.log(`  Risk snapshots: ${Math.min(i + BATCH_SIZE, snapshotBatch.length)}/${snapshotBatch.length} inserted`);
    }
  }

  return { count: snapshotBatch.length };
}

async function getDemoDataCounts(organisationId: string): Promise<SeedResult> {
  const demoSchemes = await db.select({ id: schemes.id }).from(schemes)
    .where(sql`${schemes.organisationId} = ${organisationId} AND ${schemes.reference} LIKE 'SCH-DEMO-%'`);
  
  if (demoSchemes.length === 0) {
    return { schemes: 0, blocks: 0, properties: 0, spaces: 0, components: 0, certificates: 0, remedialActions: 0 };
  }
  
  const schemeIds = demoSchemes.map(s => s.id);
  
  const [blockCount] = await db.select({ count: sql<number>`count(*)` }).from(blocks)
    .where(sql`${blocks.schemeId} IN (${sql.join(schemeIds.map(id => sql`${id}`), sql`, `)})`);
  
  const demoBlocks = await db.select({ id: blocks.id }).from(blocks)
    .where(sql`${blocks.schemeId} IN (${sql.join(schemeIds.map(id => sql`${id}`), sql`, `)})`);
  const blockIds = demoBlocks.map(b => b.id);
  
  if (blockIds.length === 0) {
    return { schemes: demoSchemes.length, blocks: 0, properties: 0, spaces: 0, components: 0, certificates: 0, remedialActions: 0 };
  }
  
  // Count block-level communal spaces
  const [blockSpaceCount] = await db.select({ count: sql<number>`count(*)` }).from(spaces)
    .where(sql`${spaces.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
  
  const [propertyCount] = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(sql`${properties.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
  
  const demoProperties = await db.select({ id: properties.id }).from(properties)
    .where(sql`${properties.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
  const propertyIds = demoProperties.map(p => p.id);
  
  if (propertyIds.length === 0) {
    return { schemes: demoSchemes.length, blocks: Number(blockCount.count), properties: 0, spaces: Number(blockSpaceCount.count), components: 0, certificates: 0, remedialActions: 0 };
  }
  
  // Count property-level spaces (rooms)
  const [propertySpaceCount] = await db.select({ count: sql<number>`count(*)` }).from(spaces)
    .where(sql`${spaces.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);
  
  const totalSpaces = Number(blockSpaceCount.count) + Number(propertySpaceCount.count);
  
  const [componentCount] = await db.select({ count: sql<number>`count(*)` }).from(components)
    .where(sql`${components.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);
  const [certificateCount] = await db.select({ count: sql<number>`count(*)` }).from(certificates)
    .where(sql`${certificates.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);
  const [actionCount] = await db.select({ count: sql<number>`count(*)` }).from(remedialActions)
    .where(sql`${remedialActions.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`);
  
  // Count existing audit events (pure counting, no side effects)
  const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(auditEvents)
    .where(sql`${auditEvents.organisationId} = ${organisationId} AND ${auditEvents.metadata}->>'demoData' = 'true'`);

  return {
    schemes: demoSchemes.length,
    blocks: Number(blockCount.count),
    properties: Number(propertyCount.count),
    spaces: totalSpaces,
    components: Number(componentCount.count),
    certificates: Number(certificateCount.count),
    remedialActions: Number(actionCount.count),
    auditEvents: Number(auditCount.count),
  };
}

async function cleanupDemoData(organisationId: string): Promise<void> {
  console.log("Cleaning up existing demo data...");
  
  const demoSchemeRefs = await db.select({ id: schemes.id }).from(schemes)
    .where(sql`${schemes.organisationId} = ${organisationId} AND ${schemes.reference} LIKE 'SCH-DEMO-%'`);
  
  if (demoSchemeRefs.length === 0) {
    console.log("No demo data to clean up");
    return;
  }
  
  const schemeIds = demoSchemeRefs.map(s => s.id);
  
  const demoBlocks = await db.select({ id: blocks.id }).from(blocks)
    .where(sql`${blocks.schemeId} IN (${sql.join(schemeIds.map(id => sql`${id}`), sql`, `)})`);
  const blockIds = demoBlocks.map(b => b.id);
  
  if (blockIds.length > 0) {
    const demoProperties = await db.select({ id: properties.id }).from(properties)
      .where(sql`${properties.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
    const propertyIds = demoProperties.map(p => p.id);
    
    if (propertyIds.length > 0) {
      await db.delete(propertyRiskSnapshots).where(
        sql`${propertyRiskSnapshots.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
      await db.delete(remedialActions).where(
        sql`${remedialActions.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
      await db.delete(certificates).where(
        sql`${certificates.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
      await db.delete(components).where(
        sql`${components.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
      await db.delete(properties).where(
        sql`${properties.id} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    
    await db.delete(blocks).where(
      sql`${blocks.id} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`
    );
  }
  
  await db.delete(schemes).where(
    sql`${schemes.id} IN (${sql.join(schemeIds.map(id => sql`${id}`), sql`, `)})`
  );
  
  console.log("Demo data cleanup complete");
}

export async function generateFullDemoData(organisationId: string): Promise<{
  schemes: number;
  blocks: number;
  properties: number;
  components: number;
  certificates: number;
  remedialActions: number;
}> {
  return generateComprehensiveDemoData({
    organisationId,
    schemeCount: 20,
    blocksPerScheme: 5,
    propertiesPerBlock: 20,
    componentsPerProperty: 4,
    certificatesPerProperty: 3,
  });
}

/**
 * Bulk seed function for 25K+ properties for load testing.
 * 
 * Data Distribution:
 * - Regional: Schemes are distributed across 10 UK cities (London, Manchester, Birmingham, Leeds, Liverpool, Newcastle, Sheffield, Bristol, Nottingham, Glasgow)
 * - Property Types: 60% Flats, 20% Maisonettes, 20% Houses
 * - Tenure Mix: 40% Social Rent, 20% Affordable Rent, 20% Leasehold, 20% Shared Ownership
 * - Gas Properties: 85% have gas, 15% electric-only
 * - Compliance Status: 50% Compliant, 17% Expiring Soon, 17% Overdue, 16% Non-Compliant
 * - Certificate Outcomes: ~12.5% Expiring Soon, ~25% with defects (triggers remedial actions)
 * - Remedial Actions: 25% of non-compliant properties have 1-3 remedial actions with varying severities
 *   - Severity distribution: 25% Immediate, 25% Urgent, 20% Priority, 15% Routine, 15% Advisory
 *   - 25% of actions are overdue
 * 
 * Tier configurations (from Admin UI):
 * - Small: 5,000 properties (10 schemes × 10 blocks × 50 properties)
 * - Medium: 25,000 properties (50 schemes × 10 blocks × 50 properties)  
 * - Large: 50,000 properties (100 schemes × 10 blocks × 50 properties)
 */
const AUDIT_EVENT_TYPES = [
  'CERTIFICATE_UPLOADED',
  'CERTIFICATE_PROCESSED',
  'CERTIFICATE_STATUS_CHANGED',
  'CERTIFICATE_APPROVED',
  'REMEDIAL_ACTION_CREATED',
  'REMEDIAL_ACTION_UPDATED',
  'REMEDIAL_ACTION_COMPLETED',
  'PROPERTY_UPDATED',
  'COMPONENT_CREATED',
  'USER_LOGIN',
  'SETTINGS_CHANGED',
] as const;

const AUDIT_ENTITY_TYPES = [
  'CERTIFICATE', 'PROPERTY', 'COMPONENT', 'REMEDIAL_ACTION', 'USER', 'SETTINGS'
] as const;

const AUDIT_ACTORS = [
  { id: "demo-user-1", name: "Sarah Johnson", type: "USER" as const },
  { id: "demo-user-2", name: "James Wilson", type: "USER" as const },
  { id: "demo-user-3", name: "Emma Thompson", type: "USER" as const },
  { id: "system", name: "System", type: "SYSTEM" as const },
  { id: "api-key-1", name: "Integration API", type: "API" as const },
];

const AUDIT_MESSAGES = [
  "Uploaded gas safety certificate for property",
  "Processed electrical certificate automatically",
  "Approved fire safety assessment",
  "Created remedial action for defect",
  "Completed remedial action - gas valve replaced",
  "Updated property details",
  "Added new smoke detector component",
  "User logged in from dashboard",
  "Changed compliance settings",
  "Marked certificate as expiring soon",
  "Assigned remedial action to contractor",
  "Bulk imported property data",
];

interface EntityRecord {
  id: string;
  propertyId: string | null;
  name?: string;
}

async function seedAuditEvents(organisationId: string, propertyIds: string[], certificateIdsInput: string[]): Promise<number> {
  if (propertyIds.length === 0) return 0;
  
  console.log("Seeding audit events with proper entity relationships...");
  
  // Load actual certificates with their propertyIds to maintain relationships
  const certRecords = await db.select({ 
    id: certificates.id, 
    propertyId: certificates.propertyId,
    name: certificates.certificateNumber
  }).from(certificates)
    .where(sql`${certificates.propertyId} IN (${sql.join(propertyIds.slice(0, 500).map(id => sql`${id}`), sql`, `)})`)
    .limit(500);
  
  // Load actual remedial actions with their IDs and propertyIds
  const remedialRecords = await db.select({ 
    id: remedialActions.id, 
    propertyId: remedialActions.propertyId,
    name: remedialActions.description
  }).from(remedialActions)
    .where(sql`${remedialActions.propertyId} IN (${sql.join(propertyIds.slice(0, 500).map(id => sql`${id}`), sql`, `)})`)
    .limit(500);
  
  // Load actual components with their IDs and propertyIds
  const componentRecords = await db.select({ 
    id: components.id, 
    propertyId: components.propertyId,
    name: components.model
  }).from(components)
    .where(sql`${components.propertyId} IN (${sql.join(propertyIds.slice(0, 500).map(id => sql`${id}`), sql`, `)})`)
    .limit(500);
  
  const auditEventsBatch = [];
  const eventCount = Math.min(500, propertyIds.length * 2);
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < eventCount; i++) {
    const eventType = randomChoice(AUDIT_EVENT_TYPES);
    const actor = randomChoice(AUDIT_ACTORS);
    const message = randomChoice(AUDIT_MESSAGES);
    
    let entityType: typeof AUDIT_ENTITY_TYPES[number] = 'PROPERTY';
    let entityId: string;
    let entityName: string;
    let propertyId: string | null = null;
    let certificateId: string | null = null;
    
    if (eventType.includes('CERTIFICATE') && certRecords.length > 0) {
      const cert = randomChoice(certRecords);
      entityType = 'CERTIFICATE';
      entityId = cert.id;
      entityName = cert.name || `Certificate ${cert.id.slice(0, 8)}`;
      propertyId = cert.propertyId;
      certificateId = cert.id;
    } else if (eventType.includes('REMEDIAL') && remedialRecords.length > 0) {
      const remedial = randomChoice(remedialRecords);
      entityType = 'REMEDIAL_ACTION';
      entityId = remedial.id;
      entityName = remedial.name || `Remedial Action ${remedial.id.slice(0, 8)}`;
      propertyId = remedial.propertyId;
    } else if (eventType.includes('COMPONENT') && componentRecords.length > 0) {
      const component = randomChoice(componentRecords);
      entityType = 'COMPONENT';
      entityId = component.id;
      entityName = component.name || `Component ${component.id.slice(0, 8)}`;
      propertyId = component.propertyId;
    } else if (eventType.includes('USER') || eventType.includes('SETTINGS')) {
      entityType = eventType.includes('USER') ? 'USER' : 'SETTINGS';
      entityId = actor.id;
      entityName = actor.name;
    } else {
      entityType = 'PROPERTY';
      entityId = randomChoice(propertyIds);
      entityName = `Property ${entityId.slice(0, 8)}`;
      propertyId = entityId;
    }
    
    const randomOffset = Math.floor(Math.random() * ninetyDaysMs);
    const createdAt = new Date(now - randomOffset);
    
    auditEventsBatch.push({
      organisationId,
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type,
      eventType,
      entityType,
      entityId,
      entityName,
      message: `${message} - Event #${i + 1}`,
      propertyId,
      certificateId,
      metadata: { demoData: true, eventIndex: i },
      createdAt,
    });
    
    if (auditEventsBatch.length >= BATCH_SIZE) {
      await db.insert(auditEvents).values(auditEventsBatch);
      auditEventsBatch.length = 0;
    }
  }
  
  if (auditEventsBatch.length > 0) {
    await db.insert(auditEvents).values(auditEventsBatch);
  }
  
  console.log(`✓ Seeded ${eventCount} audit events with proper entity relationships`);
  return eventCount;
}

export async function generateBulkDemoData(
  organisationId: string, 
  targetProperties: number = 25000,
  onProgress?: SeedProgressCallback,
  shouldCancel?: () => boolean
): Promise<SeedResult> {
  // Calculate optimal distribution for target properties
  const propertiesPerBlock = 50;
  const blocksPerScheme = 10;
  const schemeCount = Math.ceil(targetProperties / (propertiesPerBlock * blocksPerScheme));
  
  // Data ratios:
  // - 3 components per property
  // - 10 certificates per property (10x properties)
  // - 10 remedials per certificate (10x certificates)
  const certificatesPerProperty = 10;
  const remedialsPerCertificate = 10;
  
  const totalCertificates = targetProperties * certificatesPerProperty;
  const totalRemedials = totalCertificates * remedialsPerCertificate;
  
  console.log(`🚀 Starting BULK seed for ${targetProperties.toLocaleString()} properties...`);
  console.log(`   Configuration: ${schemeCount} schemes × ${blocksPerScheme} blocks × ${propertiesPerBlock} properties`);
  console.log(`   Certificates: ${totalCertificates.toLocaleString()} (${certificatesPerProperty} per property)`);
  console.log(`   Remedials: ${totalRemedials.toLocaleString()} (${remedialsPerCertificate} per certificate)`);
  console.log(`   Distribution: ${UK_CITIES.length} UK regions, ~${Math.ceil(schemeCount / UK_CITIES.length)} schemes per region`);
  
  return generateComprehensiveDemoData({
    organisationId,
    schemeCount,
    blocksPerScheme,
    propertiesPerBlock,
    componentsPerProperty: 3,
    certificatesPerProperty,
    remedialsPerCertificate,
    onProgress,
    shouldCancel,
  });
}
