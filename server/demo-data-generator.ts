import { db } from "./db";
import { 
  schemes, blocks, properties, components, componentTypes,
  certificates, remedialActions, extractions, extractionRuns,
  complianceStreams, certificateTypes as certTypesTable,
  riskSnapshots, spaces
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

export interface SeedConfig {
  organisationId: string;
  schemeCount?: number;
  blocksPerScheme?: number;
  propertiesPerBlock?: number;
  componentsPerProperty?: number;
  certificatesPerProperty?: number;
}

export async function generateComprehensiveDemoData(config: SeedConfig): Promise<{
  schemes: number;
  blocks: number;
  properties: number;
  components: number;
  certificates: number;
  remedialActions: number;
}> {
  const {
    organisationId,
    schemeCount = 20,
    blocksPerScheme = 5,
    propertiesPerBlock = 20,
    componentsPerProperty = 4,
    certificatesPerProperty = 3,
  } = config;

  console.log("Starting comprehensive demo data generation...");
  console.log(`Target: ${schemeCount} schemes, ${schemeCount * blocksPerScheme} blocks, ${schemeCount * blocksPerScheme * propertiesPerBlock} properties`);

  const existingSchemes = await db.select().from(schemes).where(eq(schemes.reference, "SCH-DEMO-001")).limit(1);
  if (existingSchemes.length > 0) {
    console.log("Comprehensive demo data already exists, skipping generation");
    const counts = await getDataCounts();
    return counts;
  }

  const componentTypeMap = await getOrCreateComponentTypes();
  const streamMap = await getOrCreateComplianceStreams();

  const stats = {
    schemes: 0,
    blocks: 0,
    properties: 0,
    components: 0,
    certificates: 0,
    remedialActions: 0,
  };

  let propertyIndex = 0;
  let certIndex = 0;

  for (let s = 0; s < schemeCount; s++) {
    const cityData = UK_CITIES[s % UK_CITIES.length];
    
    const [scheme] = await db.insert(schemes).values({
      organisationId,
      name: `${cityData.city} Housing Estate ${s + 1}`,
      reference: s === 0 ? "SCH-DEMO-001" : `SCH-${cityData.postcodePrefix}-${(s + 1).toString().padStart(3, "0")}`,
    }).returning();
    stats.schemes++;

    const blockBatch: any[] = [];
    for (let b = 0; b < blocksPerScheme; b++) {
      blockBatch.push({
        schemeId: scheme.id,
        name: `${randomChoice(BLOCK_PREFIXES)} ${randomChoice(BLOCK_NAMES)}`,
        reference: `BLK-${scheme.reference.split("-")[1]}-${(b + 1).toString().padStart(3, "0")}`,
      });
    }
    
    const createdBlocks = await db.insert(blocks).values(blockBatch).returning();
    stats.blocks += createdBlocks.length;

    for (const block of createdBlocks) {
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

      const componentBatch: any[] = [];
      const certBatch: any[] = [];
      const actionBatch: any[] = [];
      
      for (const property of createdProperties) {
        const hasGas = Math.random() > 0.15;
        const componentTypeCodes = hasGas 
          ? ["GAS_BOILER", "CONSUMER_UNIT", "SMOKE_DETECTOR", "CO_DETECTOR"]
          : ["ELECTRIC_HEATER", "CONSUMER_UNIT", "SMOKE_DETECTOR", "EXTRACTOR_FAN"];
        
        for (let c = 0; c < componentsPerProperty; c++) {
          const typeCode = componentTypeCodes[c % componentTypeCodes.length];
          const typeId = componentTypeMap.get(typeCode);
          if (!typeId) continue;
          
          componentBatch.push({
            propertyId: property.id,
            componentTypeId: typeId,
            assetTag: `AST-${propertyIndex}-${c + 1}`,
            serialNumber: `SN${Date.now().toString(36).toUpperCase()}${randomInt(1000, 9999)}`,
            manufacturer: randomChoice(COMPONENT_MANUFACTURERS),
            model: `Model ${randomChoice(["X", "Y", "Z", "Pro", "Elite", "Plus"])}${randomInt(100, 999)}`,
            location: randomChoice(["Kitchen", "Hallway", "Living Room", "Bedroom", "Bathroom"]),
            installDate: generateDateInPast(365 * 5),
            condition: randomChoice(["GOOD", "GOOD", "FAIR", "POOR"]),
            complianceStatus: randomChoice(["COMPLIANT", "COMPLIANT", "EXPIRING_SOON", "UNKNOWN"]),
            isActive: true,
          });
        }

        const certTypes = ["GAS_SAFETY", "EICR", "EPC", "FIRE_RISK_ASSESSMENT"] as const;
        for (let ct = 0; ct < Math.min(certificatesPerProperty, certTypes.length); ct++) {
          certIndex++;
          const certType = certTypes[ct];
          const issueDate = generateDateInPast(300);
          const expiryDate = generateExpiryDate(issueDate, certType);
          const isExpired = new Date(expiryDate) < new Date();
          const isExpiringSoon = !isExpired && new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          const outcome = isExpired 
            ? randomChoice(["UNSATISFACTORY", "FAIL", "AT_RISK"])
            : isExpiringSoon 
              ? randomChoice(["SATISFACTORY", "PASS", "UNSATISFACTORY"])
              : randomChoice(["SATISFACTORY", "SATISFACTORY", "PASS", "PASS"]);
          
          certBatch.push({
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
          });

          if (outcome === "UNSATISFACTORY" || outcome === "FAIL" || outcome === "AT_RISK") {
            const severities = ["IMMEDIATE", "URGENT", "PRIORITY", "ROUTINE", "ADVISORY"] as const;
            const actionCount = randomInt(1, 3);
            
            for (let a = 0; a < actionCount; a++) {
              actionBatch.push({
                certificateId: `PLACEHOLDER_CERT_${certIndex}`,
                propertyId: property.id,
                code: `DEF-${randomInt(100, 999)}`,
                category: certType,
                description: randomChoice([
                  "Replace faulty component",
                  "Urgent repair required",
                  "Safety inspection overdue",
                  "Maintenance work needed",
                  "Component requires servicing",
                ]),
                location: randomChoice(["Kitchen", "Hallway", "Living Room", "Bedroom", "Bathroom"]),
                severity: randomChoice(severities),
                status: randomChoice(["OPEN", "OPEN", "IN_PROGRESS", "SCHEDULED"]),
                dueDate: generateFutureDate(7, 90),
              });
            }
          }
        }
      }

      if (componentBatch.length > 0) {
        for (let i = 0; i < componentBatch.length; i += BATCH_SIZE) {
          const batch = componentBatch.slice(i, i + BATCH_SIZE);
          await db.insert(components).values(batch);
          stats.components += batch.length;
        }
      }

      if (certBatch.length > 0) {
        for (let i = 0; i < certBatch.length; i += BATCH_SIZE) {
          const batch = certBatch.slice(i, i + BATCH_SIZE);
          const createdCerts = await db.insert(certificates).values(batch).returning();
          stats.certificates += createdCerts.length;

          for (let j = 0; j < actionBatch.length && j < createdCerts.length; j++) {
            if (actionBatch[j].certificateId.startsWith("PLACEHOLDER")) {
              actionBatch[j].certificateId = createdCerts[j % createdCerts.length].id;
            }
          }
        }
      }

      if (actionBatch.length > 0) {
        const validActions = actionBatch.filter(a => !a.certificateId.startsWith("PLACEHOLDER"));
        if (validActions.length > 0) {
          for (let i = 0; i < validActions.length; i += BATCH_SIZE) {
            const batch = validActions.slice(i, i + BATCH_SIZE);
            await db.insert(remedialActions).values(batch);
            stats.remedialActions += batch.length;
          }
        }
      }
    }

    console.log(`Completed scheme ${s + 1}/${schemeCount}: ${scheme.name}`);
  }

  console.log("Demo data generation complete:", stats);
  return stats;
}

async function getDataCounts(): Promise<{
  schemes: number;
  blocks: number;
  properties: number;
  components: number;
  certificates: number;
  remedialActions: number;
}> {
  const [schemeCount] = await db.select({ count: sql<number>`count(*)` }).from(schemes);
  const [blockCount] = await db.select({ count: sql<number>`count(*)` }).from(blocks);
  const [propertyCount] = await db.select({ count: sql<number>`count(*)` }).from(properties);
  const [componentCount] = await db.select({ count: sql<number>`count(*)` }).from(components);
  const [certificateCount] = await db.select({ count: sql<number>`count(*)` }).from(certificates);
  const [actionCount] = await db.select({ count: sql<number>`count(*)` }).from(remedialActions);

  return {
    schemes: Number(schemeCount.count),
    blocks: Number(blockCount.count),
    properties: Number(propertyCount.count),
    components: Number(componentCount.count),
    certificates: Number(certificateCount.count),
    remedialActions: Number(actionCount.count),
  };
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
