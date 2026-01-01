import { db } from "../db";
import { 
  schemes, blocks, properties, units, components, componentTypes,
  certificates, remedialActions, contractors, 
  contractorSLAProfiles, complianceStreams
} from "@shared/schema";

const UK_CITIES = [
  { name: "London", lat: 51.5074, lng: -0.1278, postcodePrefix: "SW", wards: ["Westminster", "Lambeth", "Southwark", "Tower Hamlets", "Islington"] },
  { name: "Manchester", lat: 53.4808, lng: -2.2426, postcodePrefix: "M", wards: ["Piccadilly", "Ancoats", "Hulme", "Moss Side", "Rusholme"] },
  { name: "Birmingham", lat: 52.4862, lng: -1.8904, postcodePrefix: "B", wards: ["Ladywood", "Edgbaston", "Aston", "Selly Oak", "Hall Green"] },
  { name: "Leeds", lat: 53.8008, lng: -1.5491, postcodePrefix: "LS", wards: ["City Centre", "Headingley", "Chapel Allerton", "Hyde Park", "Beeston"] },
  { name: "Liverpool", lat: 53.4084, lng: -2.9916, postcodePrefix: "L", wards: ["Central", "Everton", "Anfield", "Toxteth", "Wavertree"] },
];

const SCHEME_NAMES = [
  "Oak Estate", "Riverside Gardens", "Meadowview Complex", "Parkside Village", "Victoria Heights"
];

const BLOCK_TEMPLATES = [
  { prefix: "Tower", hasLift: true, hasCommunalBoiler: true },
  { prefix: "Court", hasLift: false, hasCommunalBoiler: false },
  { prefix: "House", hasLift: false, hasCommunalBoiler: true },
  { prefix: "Lodge", hasLift: true, hasCommunalBoiler: false },
  { prefix: "Mansion", hasLift: true, hasCommunalBoiler: true },
];

const STREET_NAMES = [
  "Oak Street", "Maple Avenue", "Cedar Lane", "Elm Road", "Birch Way",
  "Willow Court", "Pine Gardens", "Ash Close", "Beech Drive", "Cherry Walk",
  "Hazel Crescent", "Poplar Place", "Rowan Terrace", "Sycamore Lane", "Yew Road"
];

const CONTRACTOR_COMPANY_PREFIXES = [
  "Premier", "Elite", "Pro", "Swift", "Quality", "Reliable", "Expert", "United",
  "National", "Regional", "City", "Metro", "Alpha", "Omega", "First", "Best",
  "Superior", "Precision", "Excellence", "Prime", "Dynamic", "Rapid", "Secure", "Safe"
];

const CONTRACTOR_COMPANY_SUFFIXES = [
  "Gas Services", "Electrical Ltd", "Fire Safety Co", "Building Services",
  "Property Maintenance", "Technical Services", "Compliance Solutions",
  "Safety Systems", "Mechanical Services", "Environmental Services"
];

const TRADE_TYPES = [
  "GAS_ENGINEER", "ELECTRICIAN", "FIRE_SAFETY", "ASBESTOS_SPECIALIST",
  "LIFT_ENGINEER", "WATER_HYGIENE", "GENERAL_MAINTENANCE", "BUILDING_SURVEYOR"
];

const STREAM_CODES = [
  "GAS_HEATING", "ELECTRICAL", "FIRE_SAFETY", "ASBESTOS", "LIFTING", 
  "WATER_SAFETY", "BUILDING_SAFETY", "ENERGY"
];

export async function seedComprehensiveDemoData(orgId: string) {
  console.log("🚀 Starting comprehensive demo data seeding...");
  
  const allStreams = await db.select().from(complianceStreams);
  const streamCodeToId: Record<string, string> = {};
  for (const stream of allStreams) {
    streamCodeToId[stream.code] = stream.id;
  }
  
  const allComponentTypes = await db.select().from(componentTypes);
  
  const schemeIds = await seedSchemes(orgId);
  console.log(`✓ Created ${schemeIds.length} schemes`);
  
  const blockIds = await seedBlocks(schemeIds);
  console.log(`✓ Created ${blockIds.length} blocks`);
  
  const propertyIds = await seedProperties(blockIds);
  console.log(`✓ Created ${propertyIds.length} properties`);
  
  const unitIds = await seedUnits(propertyIds);
  console.log(`✓ Created ${unitIds.length} units`);
  
  const componentIds = await seedComponents(propertyIds, allComponentTypes);
  console.log(`✓ Created ${componentIds.length} components`);
  
  const contractorIds = await seedContractors(orgId, streamCodeToId);
  console.log(`✓ Created ${contractorIds.length} contractors`);
  
  await seedSLAProfiles(orgId);
  console.log("✓ Created SLA profiles");
  
  const certIds = await seedCertificates(orgId, propertyIds, streamCodeToId);
  console.log(`✓ Created ${certIds.length} certificates`);
  
  await seedRemedialActions(certIds, propertyIds);
  console.log("✓ Created remedial actions");
  
  console.log("🎉 Comprehensive demo data seeding complete!");
}

async function seedSchemes(orgId: string): Promise<string[]> {
  const schemeIds: string[] = [];
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "COMPLIANT", "NON_COMPLIANT", "COMPLIANT"] as const;
  
  for (let i = 0; i < 5; i++) {
    const city = UK_CITIES[i % UK_CITIES.length];
    
    const [scheme] = await db.insert(schemes).values({
      organisationId: orgId,
      name: SCHEME_NAMES[i],
      reference: `SCH${String(i + 1).padStart(3, '0')}`,
      complianceStatus: statuses[i],
    }).returning();
    
    schemeIds.push(scheme.id);
  }
  
  return schemeIds;
}

async function seedBlocks(schemeIds: string[]): Promise<string[]> {
  const blockIds: string[] = [];
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "NON_COMPLIANT", "COMPLIANT", "OVERDUE"] as const;
  
  for (let schemeIndex = 0; schemeIndex < schemeIds.length; schemeIndex++) {
    const blocksPerScheme = 5;
    
    for (let b = 0; b < blocksPerScheme; b++) {
      const template = BLOCK_TEMPLATES[b % BLOCK_TEMPLATES.length];
      const blockNum = schemeIndex * blocksPerScheme + b + 1;
      
      const [block] = await db.insert(blocks).values({
        schemeId: schemeIds[schemeIndex],
        name: `${template.prefix} ${String.fromCharCode(65 + b)}`,
        reference: `BLK${String(blockNum).padStart(3, '0')}`,
        hasLift: template.hasLift,
        hasCommunalBoiler: template.hasCommunalBoiler,
        complianceStatus: statuses[b % statuses.length],
      }).returning();
      
      blockIds.push(block.id);
    }
  }
  
  return blockIds;
}

async function seedProperties(blockIds: string[]): Promise<string[]> {
  const propertyIds: string[] = [];
  const propertiesPerBlock = 40;
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "NON_COMPLIANT", "COMPLIANT", "OVERDUE"] as const;
  const tenures = ["SOCIAL_RENT", "AFFORDABLE_RENT", "SHARED_OWNERSHIP", "LEASEHOLD", "TEMPORARY"] as const;
  const propertyTypes = ["FLAT", "HOUSE", "MAISONETTE", "BUNGALOW", "STUDIO"] as const;
  
  let uprn = 10001001;
  
  for (let blockIndex = 0; blockIndex < blockIds.length; blockIndex++) {
    const city = UK_CITIES[Math.floor(blockIndex / 5) % UK_CITIES.length];
    const street = STREET_NAMES[blockIndex % STREET_NAMES.length];
    
    const batchValues = [];
    
    for (let p = 0; p < propertiesPerBlock; p++) {
      const flat = p + 1;
      const floor = Math.floor(p / 4) + 1;
      
      batchValues.push({
        blockId: blockIds[blockIndex],
        uprn: String(uprn++),
        addressLine1: `Flat ${flat}, ${street}`,
        addressLine2: floor > 1 ? `Floor ${floor}` : null,
        city: city.name,
        postcode: `${city.postcodePrefix}${Math.floor(Math.random() * 20) + 1} ${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
        propertyType: propertyTypes[p % propertyTypes.length],
        tenure: tenures[p % tenures.length],
        bedrooms: (p % 4) + 1,
        hasGas: p % 5 !== 4,
        complianceStatus: statuses[p % statuses.length],
        latitude: city.lat + (Math.random() - 0.5) * 0.05,
        longitude: city.lng + (Math.random() - 0.5) * 0.05,
        ward: city.wards[p % city.wards.length],
        riskScore: Math.floor(Math.random() * 40) + 60,
        geocodedAt: new Date(),
      });
    }
    
    const inserted = await db.insert(properties).values(batchValues).returning();
    propertyIds.push(...inserted.map(p => p.id));
  }
  
  return propertyIds;
}

async function seedUnits(propertyIds: string[]): Promise<string[]> {
  const unitIds: string[] = [];
  const unitTypes = ["DWELLING", "COMMUNAL_AREA", "PLANT_ROOM", "ROOF_SPACE", "EXTERNAL"] as const;
  
  for (let i = 0; i < Math.min(propertyIds.length, 500); i++) {
    const unitsPerProperty = Math.floor(Math.random() * 3) + 2;
    
    const batchValues = [];
    for (let u = 0; u < unitsPerProperty; u++) {
      batchValues.push({
        propertyId: propertyIds[i],
        name: `${unitTypes[u % unitTypes.length]} ${u + 1}`,
        unitType: unitTypes[u % unitTypes.length],
        floor: String(Math.floor(Math.random() * 3)),
      });
    }
    
    const inserted = await db.insert(units).values(batchValues).returning();
    unitIds.push(...inserted.map(u => u.id));
  }
  
  return unitIds;
}

async function seedComponents(propertyIds: string[], componentTypesList: any[]): Promise<string[]> {
  const componentIds: string[] = [];
  
  if (componentTypesList.length === 0) {
    console.log("   No component types found, skipping component seeding");
    return componentIds;
  }
  
  for (let i = 0; i < Math.min(propertyIds.length, 500); i++) {
    const componentsPerProperty = Math.floor(Math.random() * 3) + 2;
    
    const batchValues = [];
    for (let c = 0; c < componentsPerProperty; c++) {
      const compType = componentTypesList[c % componentTypesList.length];
      batchValues.push({
        propertyId: propertyIds[i],
        componentTypeId: compType.id,
        name: `${compType.name} - ${i + 1}.${c + 1}`,
        manufacturer: ["Worcester", "Vaillant", "Baxi", "Ideal", "Glow-worm"][c % 5],
        modelNumber: `MOD-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        installDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        condition: (["GOOD", "FAIR", "POOR"] as const)[c % 3],
        isActive: true,
      });
    }
    
    const inserted = await db.insert(components).values(batchValues).returning();
    componentIds.push(...inserted.map(c => c.id));
  }
  
  return componentIds;
}

async function seedContractors(orgId: string, streamCodeToId: Record<string, string>): Promise<string[]> {
  const contractorIds: string[] = [];
  const statuses = ["APPROVED", "PENDING", "APPROVED", "APPROVED", "SUSPENDED"] as const;
  
  for (let i = 0; i < 100; i++) {
    const prefix = CONTRACTOR_COMPANY_PREFIXES[i % CONTRACTOR_COMPANY_PREFIXES.length];
    const suffix = CONTRACTOR_COMPANY_SUFFIXES[i % CONTRACTOR_COMPANY_SUFFIXES.length];
    const tradeType = TRADE_TYPES[i % TRADE_TYPES.length];
    
    const [contractor] = await db.insert(contractors).values({
      organisationId: orgId,
      companyName: `${prefix} ${suffix}`,
      tradeType,
      registrationNumber: `REG${String(i + 1).padStart(5, '0')}`,
      contactEmail: `contact${i + 1}@${prefix.toLowerCase()}services.co.uk`,
      contactPhone: `07${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
      status: statuses[i % statuses.length],
      gasRegistration: tradeType === "GAS_ENGINEER" ? `${Math.floor(Math.random() * 999999)}` : null,
      electricalRegistration: tradeType === "ELECTRICIAN" ? `NICEIC${String(i).padStart(6, '0')}` : null,
    }).returning();
    
    contractorIds.push(contractor.id);
  }
  
  return contractorIds;
}

async function seedSLAProfiles(orgId: string) {
  const profiles = [
    { name: "Gas Emergency", priority: "EMERGENCY" as const, workCategory: "GAS_BOILER" as const, responseTimeHours: 4, completionTimeHours: 24 },
    { name: "Electrical Urgent", priority: "URGENT" as const, workCategory: "ELECTRICAL_INSTALL" as const, responseTimeHours: 24, completionTimeHours: 72 },
    { name: "Fire Safety", priority: "HIGH" as const, workCategory: "FIRE_ALARM" as const, responseTimeHours: 48, completionTimeHours: 168 },
    { name: "General Maintenance", priority: "STANDARD" as const, workCategory: "GENERAL_MAINTENANCE" as const, responseTimeHours: 120, completionTimeHours: 672 },
  ];
  
  for (const profile of profiles) {
    await db.insert(contractorSLAProfiles).values({
      organisationId: orgId,
      name: profile.name,
      priority: profile.priority,
      workCategory: profile.workCategory,
      responseTimeHours: profile.responseTimeHours,
      completionTimeHours: profile.completionTimeHours,
      isActive: true,
    }).onConflictDoNothing();
  }
}

async function seedCertificates(
  orgId: string, 
  propertyIds: string[], 
  streamCodeToId: Record<string, string>
): Promise<string[]> {
  const certIds: string[] = [];
  const statuses = ["APPROVED", "EXTRACTED", "NEEDS_REVIEW", "PENDING", "FAILED"] as const;
  const certTypes = ["GAS_SAFETY", "EICR", "FIRE_RISK_ASSESSMENT", "ASBESTOS_SURVEY", "LIFT_LOLER", "LEGIONELLA_ASSESSMENT", "EPC"] as const;
  
  const certTypeToStream: Record<string, string> = {
    "GAS_SAFETY": "GAS_HEATING",
    "EICR": "ELECTRICAL",
    "FIRE_RISK_ASSESSMENT": "FIRE_SAFETY",
    "ASBESTOS_SURVEY": "ASBESTOS",
    "LIFT_LOLER": "LIFTING",
    "LEGIONELLA_ASSESSMENT": "WATER_SAFETY",
    "EPC": "ENERGY",
  };
  
  for (let i = 0; i < Math.min(propertyIds.length, 800); i++) {
    const certsPerProperty = Math.floor(Math.random() * 3) + 2;
    
    for (let c = 0; c < certsPerProperty; c++) {
      const certType = certTypes[(i + c) % certTypes.length];
      const streamCode = certTypeToStream[certType];
      const status = statuses[(i + c) % statuses.length];
      
      const issueDate = new Date(Date.now() - Math.random() * 300 * 24 * 60 * 60 * 1000);
      const expiryDate = new Date(issueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      const [cert] = await db.insert(certificates).values({
        organisationId: orgId,
        propertyId: propertyIds[i],
        certificateType: certType,
        complianceStreamId: streamCodeToId[streamCode] || null,
        status,
        fileName: `${certType.toLowerCase()}_${i}_${c}.pdf`,
        fileSize: Math.floor(Math.random() * 500000) + 100000,
        fileType: "application/pdf",
        issueDate: issueDate.toISOString().split('T')[0],
        expiryDate: expiryDate.toISOString().split('T')[0],
        certificateNumber: `CERT-${String(i * 10 + c).padStart(6, '0')}`,
      } as any).returning();
      
      certIds.push(cert.id);
    }
  }
  
  return certIds;
}

async function seedRemedialActions(certIds: string[], propertyIds: string[]) {
  const severities = ["IMMEDIATE", "URGENT", "PRIORITY", "ROUTINE", "ADVISORY"] as const;
  const statuses = ["OPEN", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
  
  const actionsToCreate = Math.floor(certIds.length * 0.3);
  
  for (let i = 0; i < actionsToCreate; i++) {
    const certId = certIds[i % certIds.length];
    const propertyId = propertyIds[i % propertyIds.length];
    const severity = severities[i % severities.length];
    const status = statuses[i % statuses.length];
    
    await db.insert(remedialActions).values({
      certificateId: certId,
      propertyId,
      description: `Remedial action ${i + 1} - ${severity} priority work required`,
      severity,
      status,
      dueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      resolvedAt: status === "COMPLETED" ? new Date() : null,
      costEstimate: String(Math.floor(Math.random() * 5000) + 100),
    });
  }
}
