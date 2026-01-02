import { db } from "../db";
import { 
  schemes, blocks, properties, spaces, components, componentTypes,
  certificates, remedialActions, contractors, staffMembers,
  contractorSLAProfiles, complianceStreams
} from "@shared/schema";

// Scaling configuration - adjust these for larger datasets
const SCALE_CONFIG = {
  SCHEMES: 50,           // Number of schemes
  BLOCKS_PER_SCHEME: 4,  // 200 blocks total
  PROPERTIES_PER_BLOCK: 10, // 2000 properties total
  SPACES_PER_PROPERTY: 4, // Rooms within each dwelling
  BLOCK_SPACES_PER_BLOCK: 3, // Communal spaces per block (Stairwell, Plant Room, etc.)
  COMPONENTS_PER_PROPERTY: 4,
  CERTS_PER_PROPERTY: 3,
  BATCH_SIZE: 200,        // Insert batch size for performance
  CONTRACTORS: 150,
  STAFF_MEMBERS: 50,
};

const SPACE_NAMES = [
  "Living Room", "Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2",
  "Hallway", "Boiler Cupboard", "Under Stairs", "Utility Room", "Dining Area"
];

// Block-level communal spaces (attached to blocks, not properties)
const BLOCK_SPACE_NAMES = [
  { name: "Main Stairwell", spaceType: "CIRCULATION" as const },
  { name: "Plant Room", spaceType: "UTILITY" as const },
  { name: "Communal Hallway", spaceType: "COMMUNAL_AREA" as const },
  { name: "Bin Store", spaceType: "STORAGE" as const },
  { name: "Entrance Lobby", spaceType: "CIRCULATION" as const },
];

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
  
  const { propertySpaceIds, blockSpaceIds, blockSpaceMap } = await seedSpaces(propertyIds, blockIds);
  console.log(`✓ Created ${propertySpaceIds.length} property spaces (rooms) + ${blockSpaceIds.length} block spaces (communal areas)`);
  
  const componentIds = await seedComponents(propertyIds, propertySpaceIds, blockSpaceMap, allComponentTypes);
  console.log(`✓ Created ${componentIds.length} components (linked to properties, some also to spaces)`);
  
  const contractorIds = await seedContractors(orgId, streamCodeToId);
  console.log(`✓ Created ${contractorIds.length} contractors`);
  
  const staffIds = await seedStaffMembers(orgId);
  console.log(`✓ Created ${staffIds.length} staff members`);
  
  await seedSLAProfiles(orgId);
  console.log("✓ Created SLA profiles");
  
  const certIds = await seedCertificates(orgId, propertyIds, streamCodeToId);
  console.log(`✓ Created ${certIds.length} certificates`);
  
  await seedRemedialActions(certIds, propertyIds);
  console.log("✓ Created remedial actions");
  
  const totalSpaces = propertySpaceIds.length + blockSpaceIds.length;
  const totalRecords = schemeIds.length + blockIds.length + propertyIds.length + 
    totalSpaces + componentIds.length + contractorIds.length + 
    staffIds.length + certIds.length;
  
  console.log("🎉 Comprehensive demo data seeding complete!");
  console.log(`📊 Total records created: ${totalRecords.toLocaleString()}`);
  console.log(`   Hierarchy: ${schemeIds.length} schemes → ${blockIds.length} blocks → ${propertyIds.length} properties → ${totalSpaces} spaces`);
  console.log(`   Assets: ${componentIds.length} components`);
  console.log(`   People: ${contractorIds.length} contractors, ${staffIds.length} staff`);
  console.log(`   Compliance: ${certIds.length} certificates`);
}

async function seedSchemes(orgId: string): Promise<string[]> {
  const schemeIds: string[] = [];
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "COMPLIANT", "NON_COMPLIANT", "COMPLIANT"] as const;
  
  const batchValues = [];
  for (let i = 0; i < SCALE_CONFIG.SCHEMES; i++) {
    const city = UK_CITIES[i % UK_CITIES.length];
    const baseScheme = SCHEME_NAMES[i % SCHEME_NAMES.length];
    const schemeNum = Math.floor(i / SCHEME_NAMES.length) + 1;
    
    batchValues.push({
      organisationId: orgId,
      name: schemeNum > 1 ? `${baseScheme} ${schemeNum}` : baseScheme,
      reference: `SCH${String(i + 1).padStart(3, '0')}`,
      complianceStatus: statuses[i % statuses.length],
    });
  }
  
  // Insert in batches
  for (let i = 0; i < batchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = batchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(schemes).values(batch).returning();
    schemeIds.push(...inserted.map(s => s.id));
  }
  
  return schemeIds;
}

async function seedBlocks(schemeIds: string[]): Promise<string[]> {
  const blockIds: string[] = [];
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "NON_COMPLIANT", "COMPLIANT", "OVERDUE"] as const;
  
  const batchValues = [];
  for (let schemeIndex = 0; schemeIndex < schemeIds.length; schemeIndex++) {
    for (let b = 0; b < SCALE_CONFIG.BLOCKS_PER_SCHEME; b++) {
      const template = BLOCK_TEMPLATES[b % BLOCK_TEMPLATES.length];
      const blockNum = schemeIndex * SCALE_CONFIG.BLOCKS_PER_SCHEME + b + 1;
      
      batchValues.push({
        schemeId: schemeIds[schemeIndex],
        name: `${template.prefix} ${String.fromCharCode(65 + (b % 26))}`,
        reference: `BLK${String(blockNum).padStart(4, '0')}`,
        hasLift: template.hasLift,
        hasCommunalBoiler: template.hasCommunalBoiler,
        complianceStatus: statuses[b % statuses.length],
      });
    }
  }
  
  // Insert in batches
  for (let i = 0; i < batchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = batchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(blocks).values(batch).returning();
    blockIds.push(...inserted.map(b => b.id));
  }
  
  return blockIds;
}

async function seedProperties(blockIds: string[]): Promise<string[]> {
  const propertyIds: string[] = [];
  const statuses = ["COMPLIANT", "EXPIRING_SOON", "NON_COMPLIANT", "COMPLIANT", "OVERDUE"] as const;
  const tenures = ["SOCIAL_RENT", "AFFORDABLE_RENT", "SHARED_OWNERSHIP", "LEASEHOLD", "TEMPORARY"] as const;
  const propertyTypes = ["FLAT", "HOUSE", "MAISONETTE", "BUNGALOW", "STUDIO"] as const;
  
  let uprn = 10001001;
  const allBatchValues = [];
  
  for (let blockIndex = 0; blockIndex < blockIds.length; blockIndex++) {
    const city = UK_CITIES[Math.floor(blockIndex / SCALE_CONFIG.BLOCKS_PER_SCHEME) % UK_CITIES.length];
    const street = STREET_NAMES[blockIndex % STREET_NAMES.length];
    
    for (let p = 0; p < SCALE_CONFIG.PROPERTIES_PER_BLOCK; p++) {
      const flat = p + 1;
      const floor = Math.floor(p / 4) + 1;
      
      allBatchValues.push({
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
  }
  
  // Insert in batches for performance
  for (let i = 0; i < allBatchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = allBatchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(properties).values(batch).returning();
    propertyIds.push(...inserted.map(p => p.id));
    if ((i / SCALE_CONFIG.BATCH_SIZE) % 5 === 0) {
      console.log(`   Properties: ${propertyIds.length}/${allBatchValues.length} inserted`);
    }
  }
  
  return propertyIds;
}

async function seedSpaces(propertyIds: string[], blockIds: string[]): Promise<{ 
  propertySpaceIds: string[]; 
  blockSpaceIds: string[];
  blockSpaceMap: Map<string, string[]>;
}> {
  const propertySpaceIds: string[] = [];
  const blockSpaceIds: string[] = [];
  const blockSpaceMap = new Map<string, string[]>();
  
  // 1. Create property-level spaces (rooms within dwellings)
  const propertyBatchValues = [];
  for (let i = 0; i < propertyIds.length; i++) {
    for (let s = 0; s < SCALE_CONFIG.SPACES_PER_PROPERTY; s++) {
      propertyBatchValues.push({
        propertyId: propertyIds[i],
        name: SPACE_NAMES[s % SPACE_NAMES.length],
        reference: `ROOM-${i}-${s}`,
        spaceType: 'ROOM' as const,
      });
    }
  }
  
  // Insert property spaces in batches
  for (let i = 0; i < propertyBatchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = propertyBatchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(spaces).values(batch).returning();
    propertySpaceIds.push(...inserted.map(sp => sp.id));
    if ((i / SCALE_CONFIG.BATCH_SIZE) % 20 === 0) {
      console.log(`   Property Spaces: ${propertySpaceIds.length}/${propertyBatchValues.length} inserted`);
    }
  }
  
  // 2. Create block-level spaces (communal areas like stairwells, plant rooms)
  // Track which block each space belongs to for component linking
  const blockBatchValues: { blockId: string; name: string; reference: string; spaceType: typeof BLOCK_SPACE_NAMES[number]["spaceType"]; }[] = [];
  const blockIndexMap: number[] = []; // Track which blockId index each batch item belongs to
  
  for (let i = 0; i < blockIds.length; i++) {
    blockSpaceMap.set(blockIds[i], []);
    for (let s = 0; s < Math.min(SCALE_CONFIG.BLOCK_SPACES_PER_BLOCK, BLOCK_SPACE_NAMES.length); s++) {
      const spaceTemplate = BLOCK_SPACE_NAMES[s];
      blockBatchValues.push({
        blockId: blockIds[i],
        name: spaceTemplate.name,
        reference: `COMM-${i}-${s}`,
        spaceType: spaceTemplate.spaceType,
      });
      blockIndexMap.push(i);
    }
  }
  
  // Insert block spaces in batches and populate blockSpaceMap
  let insertedCount = 0;
  for (let i = 0; i < blockBatchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = blockBatchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(spaces).values(batch).returning();
    
    for (let j = 0; j < inserted.length; j++) {
      const blockIdx = blockIndexMap[i + j];
      const blockId = blockIds[blockIdx];
      blockSpaceIds.push(inserted[j].id);
      blockSpaceMap.get(blockId)!.push(inserted[j].id);
    }
    insertedCount += inserted.length;
  }
  
  console.log(`   Block Spaces: ${blockSpaceIds.length} communal areas created`);
  
  return { propertySpaceIds, blockSpaceIds, blockSpaceMap };
}

async function seedComponents(
  propertyIds: string[], 
  propertySpaceIds: string[], 
  blockSpaceMap: Map<string, string[]>,
  componentTypesList: any[]
): Promise<string[]> {
  const componentIds: string[] = [];
  
  if (componentTypesList.length === 0) {
    console.log("   No component types found, skipping component seeding");
    return componentIds;
  }
  
  const manufacturers = ["Worcester", "Vaillant", "Baxi", "Ideal", "Glow-worm", "Honeywell", "Kidde", "Aico", "BG", "MK"];
  const conditions = ["GOOD", "FAIR", "POOR"] as const;
  
  // Build a map of propertyId -> spaceIds for linking some components to property spaces
  const propertyToSpaces = new Map<string, string[]>();
  const spacesPerProperty = SCALE_CONFIG.SPACES_PER_PROPERTY;
  for (let i = 0; i < propertyIds.length; i++) {
    const startIdx = i * spacesPerProperty;
    const endIdx = Math.min(startIdx + spacesPerProperty, propertySpaceIds.length);
    if (startIdx < propertySpaceIds.length) {
      propertyToSpaces.set(propertyIds[i], propertySpaceIds.slice(startIdx, endIdx));
    }
  }
  
  // Get property -> blockId mapping for block space linking
  const allProperties = await db.query.properties.findMany({
    columns: { id: true, blockId: true }
  });
  const propertyToBlock = new Map(allProperties.map(p => [p.id, p.blockId]));
  
  const allBatchValues = [];
  let propertySpaceLinkCount = 0;
  let blockSpaceLinkCount = 0;
  
  for (let i = 0; i < propertyIds.length; i++) {
    const propertySpaces = propertyToSpaces.get(propertyIds[i]) || [];
    const blockId = propertyToBlock.get(propertyIds[i]);
    const blockSpaces = blockId ? (blockSpaceMap.get(blockId) || []) : [];
    
    for (let c = 0; c < SCALE_CONFIG.COMPONENTS_PER_PROPERTY; c++) {
      const compType = componentTypesList[(i + c) % componentTypesList.length];
      
      // Determine space linking strategy:
      // - ~40% link to property space (rooms)
      // - ~20% link to block space (communal areas)  
      // - ~40% no space link (property-only)
      // Components ALWAYS have propertyId (required), optionally have spaceId
      let spaceId: string | null = null;
      const linkType = (i + c) % 5;
      
      if (linkType < 2 && propertySpaces.length > 0) {
        // Link to property space (room)
        spaceId = propertySpaces[c % propertySpaces.length];
        propertySpaceLinkCount++;
      } else if (linkType === 2 && blockSpaces.length > 0) {
        // Link to block space (communal area)
        spaceId = blockSpaces[c % blockSpaces.length];
        blockSpaceLinkCount++;
      }
      // else: no space link (property-only)
      
      allBatchValues.push({
        propertyId: propertyIds[i], // Always required
        spaceId, // Optional - demonstrates space-level component linking
        componentTypeId: compType.id,
        name: `${compType.name} - ${i + 1}.${c + 1}`,
        manufacturer: manufacturers[(i + c) % manufacturers.length],
        modelNumber: `MOD-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        installDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        condition: conditions[(i + c) % conditions.length],
        isActive: true,
      });
    }
  }
  
  // Insert in batches
  for (let i = 0; i < allBatchValues.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = allBatchValues.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(components).values(batch).returning();
    componentIds.push(...inserted.map(c => c.id));
    if ((i / SCALE_CONFIG.BATCH_SIZE) % 10 === 0) {
      console.log(`   Components: ${componentIds.length}/${allBatchValues.length} inserted`);
    }
  }
  
  console.log(`   (${propertySpaceLinkCount} linked to property spaces, ${blockSpaceLinkCount} linked to block spaces)`);
  
  return componentIds;
}

const DLO_STAFF_NAMES = [
  "John Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson", "David Taylor",
  "Lisa Anderson", "James Martin", "Sophie Davis", "Robert Thomas", "Claire Jackson",
  "William White", "Hannah Harris", "Daniel Clark", "Emily Lewis", "Matthew Walker"
];

const DLO_DEPARTMENTS = [
  "Gas & Heating", "Electrical", "General Maintenance", "Plumbing", "Fire Safety"
];

async function seedContractors(orgId: string, streamCodeToId: Record<string, string>): Promise<string[]> {
  const contractorIds: string[] = [];
  const statuses = ["APPROVED", "PENDING", "APPROVED", "APPROVED", "SUSPENDED"] as const;
  
  const contractorBatch = [];
  for (let i = 0; i < SCALE_CONFIG.CONTRACTORS; i++) {
    const prefix = CONTRACTOR_COMPANY_PREFIXES[i % CONTRACTOR_COMPANY_PREFIXES.length];
    const suffix = CONTRACTOR_COMPANY_SUFFIXES[i % CONTRACTOR_COMPANY_SUFFIXES.length];
    const tradeType = TRADE_TYPES[i % TRADE_TYPES.length];
    
    contractorBatch.push({
      organisationId: orgId,
      companyName: `${prefix} ${suffix} ${Math.floor(i / CONTRACTOR_COMPANY_PREFIXES.length) + 1}`,
      tradeType,
      registrationNumber: `REG${String(i + 1).padStart(5, '0')}`,
      contactEmail: `contact${i + 1}@${prefix.toLowerCase()}services.co.uk`,
      contactPhone: `07${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
      status: statuses[i % statuses.length],
      gasRegistration: tradeType === "GAS_ENGINEER" ? `${Math.floor(Math.random() * 999999)}` : null,
      electricalRegistration: tradeType === "ELECTRICIAN" ? `NICEIC${String(i).padStart(6, '0')}` : null,
      isInternal: false,
    });
  }
  
  // Insert contractors in batches
  for (let i = 0; i < contractorBatch.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = contractorBatch.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(contractors).values(batch).returning();
    contractorIds.push(...inserted.map(c => c.id));
  }
  
  return contractorIds;
}

async function seedStaffMembers(orgId: string): Promise<string[]> {
  const staffIds: string[] = [];
  const statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "PENDING", "SUSPENDED"] as const;
  
  const staffBatch = [];
  for (let i = 0; i < SCALE_CONFIG.STAFF_MEMBERS; i++) {
    const staffName = DLO_STAFF_NAMES[i % DLO_STAFF_NAMES.length];
    const nameParts = staffName.split(' ');
    const department = DLO_DEPARTMENTS[i % DLO_DEPARTMENTS.length];
    const tradeType = TRADE_TYPES[i % TRADE_TYPES.length];
    const isGas = tradeType === "GAS_ENGINEER";
    const isElectric = tradeType === "ELECTRICIAN";
    
    staffBatch.push({
      organisationId: orgId,
      firstName: nameParts[0],
      lastName: nameParts[1] + (Math.floor(i / DLO_STAFF_NAMES.length) > 0 ? ` ${Math.floor(i / DLO_STAFF_NAMES.length) + 1}` : ''),
      email: `${nameParts[0].toLowerCase()}.${nameParts[1].toLowerCase()}${i}@housing.org.uk`,
      phone: `07${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
      department,
      roleTitle: department + " Technician",
      employeeId: `EMP-${String(i + 1).padStart(4, '0')}`,
      status: statuses[i % statuses.length],
      tradeSpecialism: tradeType,
      gasSafeNumber: isGas ? `${Math.floor(Math.random() * 999999)}` : null,
      nicEicNumber: isElectric ? `NICEIC${String(i).padStart(6, '0')}` : null,
    });
  }
  
  // Insert staff in batches
  for (let i = 0; i < staffBatch.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = staffBatch.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(staffMembers).values(batch).returning();
    staffIds.push(...inserted.map(s => s.id));
  }
  
  return staffIds;
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
  const statuses = ["APPROVED", "EXTRACTED", "NEEDS_REVIEW", "UPLOADED", "PROCESSING"] as const;
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
  
  const allCertBatch = [];
  for (let i = 0; i < propertyIds.length; i++) {
    for (let c = 0; c < SCALE_CONFIG.CERTS_PER_PROPERTY; c++) {
      const certType = certTypes[(i + c) % certTypes.length];
      const streamCode = certTypeToStream[certType];
      const status = statuses[(i + c) % statuses.length];
      
      const issueDate = new Date(Date.now() - Math.random() * 300 * 24 * 60 * 60 * 1000);
      const expiryDate = new Date(issueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      allCertBatch.push({
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
      });
    }
  }
  
  // Insert in batches
  for (let i = 0; i < allCertBatch.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = allCertBatch.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    const inserted = await db.insert(certificates).values(batch as any).returning();
    certIds.push(...inserted.map(c => c.id));
    if ((i / SCALE_CONFIG.BATCH_SIZE) % 10 === 0) {
      console.log(`   Certificates: ${certIds.length}/${allCertBatch.length} inserted`);
    }
  }
  
  return certIds;
}

async function seedRemedialActions(certIds: string[], propertyIds: string[]) {
  const severities = ["IMMEDIATE", "URGENT", "PRIORITY", "ROUTINE", "ADVISORY"] as const;
  const statuses = ["OPEN", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
  
  const actionsToCreate = Math.floor(certIds.length * 0.3);
  
  const actionBatch = [];
  for (let i = 0; i < actionsToCreate; i++) {
    const certId = certIds[i % certIds.length];
    const propertyId = propertyIds[i % propertyIds.length];
    const severity = severities[i % severities.length];
    const status = statuses[i % statuses.length];
    
    actionBatch.push({
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
  
  // Insert in batches
  for (let i = 0; i < actionBatch.length; i += SCALE_CONFIG.BATCH_SIZE) {
    const batch = actionBatch.slice(i, i + SCALE_CONFIG.BATCH_SIZE);
    await db.insert(remedialActions).values(batch);
    if ((i / SCALE_CONFIG.BATCH_SIZE) % 5 === 0) {
      console.log(`   Remedial actions: ${Math.min(i + SCALE_CONFIG.BATCH_SIZE, actionBatch.length)}/${actionBatch.length} inserted`);
    }
  }
}
