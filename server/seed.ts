// Seed script for initial ComplianceAI data
import { db } from "./db";
import { organisations, schemes, blocks, properties, users, accounts, complianceStreams, certificateTypes, classificationCodes, extractionSchemas, complianceRules, normalisationRules, componentTypes, factorySettings, navigationSections, navigationItems, iconRegistry } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

// Helper function to create BetterAuth credential account for a user
async function createCredentialAccount(userId: string, hashedPassword: string) {
  const accountId = `acc_${userId}`;
  const [existing] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!existing) {
    await db.insert(accounts).values({
      id: accountId,
      userId: userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const ORG_ID = "default-org";
const LASHAN_SUPER_USER_ID = "lashan-super-user";
const SUPER_ADMIN_ID = "super-admin-user";
const SYSTEM_ADMIN_ID = "system-admin-user";
const COMPLIANCE_MANAGER_ID = "compliance-manager-user";

// Check if demo data should be seeded (default: false for production)
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === "true";

export async function seedDatabase() {
  try {
    // Check existing data
    const [existingOrg] = await db.select().from(organisations).limit(1);
    const [existingUser] = await db.select().from(users).limit(1);
    const [existingProperty] = await db.select().from(properties).limit(1);
    
    // Always seed configuration data (certificate types, classification codes, etc.)
    await seedConfiguration();
    
    // If org, user, and property exist, database is already seeded
    if (existingOrg && existingUser && existingProperty) {
      console.log("✓ Database already seeded");
      return;
    }
    
    console.log("🌱 Seeding database...");
    console.log(`   SEED_DEMO_DATA=${SEED_DEMO_DATA ? 'true' : 'false (default)'}`);
    
    // Always create or get organisation for admin user
    let org = existingOrg;
    if (!org) {
      const [newOrg] = await db.insert(organisations).values({
        id: ORG_ID,
        name: SEED_DEMO_DATA ? "Demo Housing Association" : "My Organisation",
        slug: SEED_DEMO_DATA ? "demo-ha" : "my-org",
        settings: { timezone: "Europe/London" }
      }).returning();
      org = newOrg;
      console.log("✓ Created organisation:", org.name);
    } else {
      console.log("✓ Using existing organisation:", org.name);
    }
    
    // Create default system accounts with proper role hierarchy
    // 1. Lashan Super User (highest privilege, only 1 per system)
    const [existingLashanUser] = await db.select().from(users).where(eq(users.id, LASHAN_SUPER_USER_ID));
    const lashanPassword = await hashPassword("Lashan2025!Secure");
    if (!existingLashanUser) {
      await db.insert(users).values({
        id: LASHAN_SUPER_USER_ID,
        username: "lashan",
        password: lashanPassword,
        email: "lashan@lashandigital.com",
        name: "Lashan Fernando",
        role: "LASHAN_SUPER_USER",
        organisationId: org.id
      });
      console.log("✓ Created Lashan Super User (username: lashan)");
    }
    await createCredentialAccount(LASHAN_SUPER_USER_ID, lashanPassword);
    
    // 2. Super Admin (demo account, only 1 per system)
    const [existingSuperAdmin] = await db.select().from(users).where(eq(users.id, SUPER_ADMIN_ID));
    const superAdminPassword = await hashPassword("SuperAdmin2025!");
    if (!existingSuperAdmin) {
      await db.insert(users).values({
        id: SUPER_ADMIN_ID,
        username: "superadmin",
        password: superAdminPassword,
        email: "superadmin@complianceai.co.uk",
        name: "Super Administrator",
        role: "SUPER_ADMIN",
        organisationId: org.id
      });
      console.log("✓ Created Super Admin (email: superadmin@complianceai.co.uk, password: SuperAdmin2025!)");
    }
    await createCredentialAccount(SUPER_ADMIN_ID, superAdminPassword);
    
    // 3. System Admin (can have multiple)
    const [existingSystemAdmin] = await db.select().from(users).where(eq(users.id, SYSTEM_ADMIN_ID));
    const sysAdminPassword = await hashPassword("SysAdmin2025!");
    if (!existingSystemAdmin) {
      await db.insert(users).values({
        id: SYSTEM_ADMIN_ID,
        username: "sysadmin",
        password: sysAdminPassword,
        email: "sysadmin@complianceai.co.uk",
        name: "System Administrator",
        role: "SYSTEM_ADMIN",
        organisationId: org.id
      });
      console.log("✓ Created System Admin (email: sysadmin@complianceai.co.uk, password: SysAdmin2025!)");
    }
    await createCredentialAccount(SYSTEM_ADMIN_ID, sysAdminPassword);
    
    // 4. Compliance Manager (power user)
    const [existingComplianceManager] = await db.select().from(users).where(eq(users.id, COMPLIANCE_MANAGER_ID));
    const compManagerPassword = await hashPassword("Manager2025!");
    if (!existingComplianceManager) {
      await db.insert(users).values({
        id: COMPLIANCE_MANAGER_ID,
        username: "compmanager",
        password: compManagerPassword,
        email: "compmanager@complianceai.co.uk",
        name: "Compliance Manager",
        role: "COMPLIANCE_MANAGER",
        organisationId: org.id
      });
      console.log("✓ Created Compliance Manager (email: compmanager@complianceai.co.uk, password: Manager2025!)");
    }
    await createCredentialAccount(COMPLIANCE_MANAGER_ID, compManagerPassword);
    
    // Only seed demo data if SEED_DEMO_DATA is true
    if (SEED_DEMO_DATA) {
      await seedDemoData(org.id);
      // Import and run comprehensive demo data for full reporting data
      const { seedComprehensiveDemoData } = await import("./demo-data/comprehensive-seed");
      await seedComprehensiveDemoData(org.id);
    } else {
      console.log("ℹ️  Demo data skipped (set SEED_DEMO_DATA=true to enable)");
    }
    
    console.log("🎉 Database seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

async function seedDemoData(orgId: string) {
  console.log("🎭 Seeding demo data...");
  
  // Create additional demo users with hashed passwords
  const demoUserConfigs = [
    { id: "user-manager-1", username: "manager", plainPassword: "manager123", email: "manager@complianceai.co.uk", name: "Property Manager", role: "MANAGER" as const },
    { id: "user-officer-1", username: "officer", plainPassword: "officer123", email: "officer@complianceai.co.uk", name: "Compliance Officer", role: "OFFICER" as const },
    { id: "user-viewer-1", username: "viewer", plainPassword: "viewer123", email: "viewer@complianceai.co.uk", name: "Report Viewer", role: "VIEWER" as const },
  ];
  
  for (const config of demoUserConfigs) {
    const [existing] = await db.select().from(users).where(eq(users.id, config.id));
    const hashedPassword = await hashPassword(config.plainPassword);
    if (!existing) {
      const { plainPassword, ...userData } = config;
      await db.insert(users).values({
        ...userData,
        password: hashedPassword,
        organisationId: orgId
      });
    }
    await createCredentialAccount(config.id, hashedPassword);
  }
  console.log("✓ Created demo users with BetterAuth accounts");
  
  // Create schemes if needed
  const existingSchemes = await db.select().from(schemes).where(eq(schemes.organisationId, orgId));
  let scheme1, scheme2;
  
  if (existingSchemes.length === 0) {
    [scheme1] = await db.insert(schemes).values({
      organisationId: orgId,
      name: "Oak Estate",
      reference: "SCH001",
      complianceStatus: "COMPLIANT"
    }).returning();
    
    [scheme2] = await db.insert(schemes).values({
      organisationId: orgId,
      name: "Riverside Gardens",
      reference: "SCH002",
      complianceStatus: "EXPIRING_SOON"
    }).returning();
    
    console.log("✓ Created demo schemes (HACT: Sites)");
  } else {
    scheme1 = existingSchemes[0];
    scheme2 = existingSchemes[1] || existingSchemes[0];
    console.log("✓ Using existing schemes");
  }
  
  // Create blocks if needed
  const existingBlocks = await db.select().from(blocks).limit(1);
  let block1, block2;
  
  if (existingBlocks.length === 0) {
    [block1] = await db.insert(blocks).values({
      schemeId: scheme1.id,
      name: "Oak House",
      reference: "BLK001",
      hasLift: false,
      hasCommunalBoiler: false,
      complianceStatus: "COMPLIANT"
    }).returning();
    
    [block2] = await db.insert(blocks).values({
      schemeId: scheme2.id,
      name: "The Towers Block A",
      reference: "BLK002",
      hasLift: true,
      hasCommunalBoiler: true,
      complianceStatus: "NON_COMPLIANT"
    }).returning();
    
    await db.insert(blocks).values({
      schemeId: scheme2.id,
      name: "The Towers Block B",
      reference: "BLK003",
      hasLift: true,
      hasCommunalBoiler: true,
      complianceStatus: "COMPLIANT"
    });
    
    console.log("✓ Created demo blocks (HACT: Properties/Buildings)");
  } else {
    const allBlocks = await db.select().from(blocks);
    block1 = allBlocks[0];
    block2 = allBlocks[1] || allBlocks[0];
    console.log("✓ Using existing blocks");
  }
  
  // Create properties if needed with geocoded UK coordinates
  const [existingProperty] = await db.select().from(properties).limit(1);
  if (!existingProperty) {
    // Real UK postcodes with coordinates for demo
    const londonProperties = [
      { uprn: "10001001", address: "Flat 1, Oak House", postcode: "SW1A 1AA", lat: 51.5014, lng: -0.1419, ward: "St James's", lsoa: "Westminster 018A" },
      { uprn: "10001002", address: "Flat 2, Oak House", postcode: "SW1A 2AA", lat: 51.5008, lng: -0.1426, ward: "St James's", lsoa: "Westminster 018B" },
      { uprn: "10001003", address: "Flat 3, Oak House", postcode: "SW1H 9AJ", lat: 51.4975, lng: -0.1357, ward: "Vincent Square", lsoa: "Westminster 019A" },
      { uprn: "10001004", address: "1 Maple Court", postcode: "SE1 7PB", lat: 51.5045, lng: -0.0865, ward: "Borough & Bankside", lsoa: "Southwark 023A" },
      { uprn: "10001005", address: "2 Maple Court", postcode: "SE1 7PA", lat: 51.5042, lng: -0.0870, ward: "Borough & Bankside", lsoa: "Southwark 023B" },
      { uprn: "10001006", address: "15 Cedar Lane", postcode: "E1 6AN", lat: 51.5155, lng: -0.0723, ward: "Whitechapel", lsoa: "Tower Hamlets 024A" },
      { uprn: "10001007", address: "16 Cedar Lane", postcode: "E1 6AP", lat: 51.5152, lng: -0.0728, ward: "Whitechapel", lsoa: "Tower Hamlets 024B" },
      { uprn: "10001008", address: "8 Birch Avenue", postcode: "N1 9AG", lat: 51.5386, lng: -0.1036, ward: "Canonbury", lsoa: "Islington 015A" },
      { uprn: "10001009", address: "9 Birch Avenue", postcode: "N1 9AH", lat: 51.5382, lng: -0.1040, ward: "Canonbury", lsoa: "Islington 015B" },
      { uprn: "10001010", address: "22 Elm Street", postcode: "NW1 8NP", lat: 51.5343, lng: -0.1428, ward: "Regent's Park", lsoa: "Camden 012A" },
    ];
    
    const manchesterProperties = [
      { uprn: "10002001", address: "101 The Towers", postcode: "M1 1BB", lat: 53.4808, lng: -2.2426, ward: "Piccadilly", lsoa: "Manchester 054A" },
      { uprn: "10002002", address: "102 The Towers", postcode: "M1 1BC", lat: 53.4805, lng: -2.2430, ward: "Piccadilly", lsoa: "Manchester 054B" },
      { uprn: "10002003", address: "103 The Towers", postcode: "M1 1BD", lat: 53.4802, lng: -2.2434, ward: "Piccadilly", lsoa: "Manchester 054C" },
      { uprn: "10002004", address: "25 Willow Road", postcode: "M4 5JD", lat: 53.4850, lng: -2.2345, ward: "Ancoats & Beswick", lsoa: "Manchester 055A" },
      { uprn: "10002005", address: "26 Willow Road", postcode: "M4 5JE", lat: 53.4847, lng: -2.2350, ward: "Ancoats & Beswick", lsoa: "Manchester 055B" },
    ];
    
    const statuses = ["COMPLIANT", "OVERDUE", "NON_COMPLIANT", "EXPIRING_SOON", "COMPLIANT"] as const;
    
    // Insert London properties
    for (let i = 0; i < londonProperties.length; i++) {
      const p = londonProperties[i];
      await db.insert(properties).values({
        blockId: block1.id,
        uprn: p.uprn,
        addressLine1: p.address,
        city: "London",
        postcode: p.postcode,
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: Math.floor(Math.random() * 3) + 1,
        hasGas: true,
        complianceStatus: statuses[i % statuses.length],
        latitude: p.lat,
        longitude: p.lng,
        ward: p.ward,
        lsoa: p.lsoa,
        geocodedAt: new Date()
      });
    }
    
    // Insert Manchester properties
    for (let i = 0; i < manchesterProperties.length; i++) {
      const p = manchesterProperties[i];
      await db.insert(properties).values({
        blockId: block2.id,
        uprn: p.uprn,
        addressLine1: p.address,
        city: "Manchester",
        postcode: p.postcode,
        propertyType: "FLAT",
        tenure: i % 2 === 0 ? "SOCIAL_RENT" : "LEASEHOLD",
        bedrooms: Math.floor(Math.random() * 2) + 1,
        hasGas: i % 3 !== 0,
        complianceStatus: statuses[i % statuses.length],
        latitude: p.lat,
        longitude: p.lng,
        ward: p.ward,
        lsoa: p.lsoa,
        geocodedAt: new Date()
      });
    }
    
    console.log("✓ Created 15 demo properties with UK geocoding (HACT: Units/Dwellings)");
  } else {
    console.log("✓ Using existing properties");
  }
}

async function seedConfiguration() {
  // Always seed factory settings if they don't exist
  const [existingFactorySetting] = await db.select().from(factorySettings).limit(1);
  if (!existingFactorySetting) {
    await seedFactorySettings();
  }
  
  // Always update navigation to ensure consistent structure across environments
  await seedNavigation();
  
  console.log("🔧 Seeding/updating configuration data (upsert mode)...");
  
  // ==================== COMPLIANCE STREAMS ====================
  // Comprehensive compliance streams covering all UK social housing regulations
  const streamsData = [
    { code: "GAS_HEATING", name: "Gas & Heating Safety", description: "Gas safety, boilers, oil, LPG, solid fuel, heat pumps per Gas Safety Regulations 1998", colorCode: "#EF4444", iconName: "Flame", isSystem: true, isActive: true, displayOrder: 1 },
    { code: "ELECTRICAL", name: "Electrical Safety", description: "Electrical installations, testing, PAT per Electrical Safety Standards Regulations 2020", colorCode: "#F59E0B", iconName: "Zap", isSystem: true, isActive: true, displayOrder: 2 },
    { code: "ENERGY", name: "Energy & Efficiency", description: "EPC, SAP assessments, energy efficiency per MEES Regulations", colorCode: "#22C55E", iconName: "Leaf", isSystem: true, isActive: true, displayOrder: 3 },
    { code: "FIRE_SAFETY", name: "Fire Safety", description: "Fire risk assessments, alarms, doors, extinguishers per RRO 2005 & FSA 2022", colorCode: "#DC2626", iconName: "FireExtinguisher", isSystem: true, isActive: true, displayOrder: 4 },
    { code: "ASBESTOS", name: "Asbestos Management", description: "Asbestos surveys, register, R&D per Control of Asbestos Regulations 2012", colorCode: "#7C3AED", iconName: "AlertTriangle", isSystem: true, isActive: true, displayOrder: 5 },
    { code: "WATER_SAFETY", name: "Water Safety & Legionella", description: "Legionella risk assessments, water testing per HSE ACOP L8", colorCode: "#0EA5E9", iconName: "Droplets", isSystem: true, isActive: true, displayOrder: 6 },
    { code: "LIFTING", name: "Lifting Equipment", description: "Passenger lifts, hoists, stairlifts per LOLER 1998 & PUWER 1998", colorCode: "#6366F1", iconName: "ArrowUpDown", isSystem: true, isActive: true, displayOrder: 7 },
    { code: "BUILDING_SAFETY", name: "Building & Structural Safety", description: "Structure, roof, cladding, facades per Building Safety Act 2022", colorCode: "#78716C", iconName: "Building2", isSystem: true, isActive: true, displayOrder: 8 },
    { code: "EXTERNAL", name: "External Areas & Grounds", description: "Playgrounds, trees, fencing, grounds per BS EN 1176 & BS 5837", colorCode: "#84CC16", iconName: "TreePine", isSystem: true, isActive: true, displayOrder: 9 },
    { code: "SECURITY", name: "Security & Access", description: "Door entry, CCTV, access control, communal security", colorCode: "#0F172A", iconName: "ShieldCheck", isSystem: true, isActive: true, displayOrder: 10 },
    { code: "HRB_SPECIFIC", name: "Higher-Risk Buildings (HRB)", description: "Specific requirements for buildings 18m+ per Building Safety Act 2022", colorCode: "#B91C1C", iconName: "Building", isSystem: true, isActive: true, displayOrder: 11 },
    { code: "HOUSING_HEALTH", name: "Housing Health & Safety", description: "HHSRS hazard assessments, damp & mould per Housing Act 2004", colorCode: "#0D9488", iconName: "Home", isSystem: true, isActive: true, displayOrder: 12 },
    { code: "ACCESSIBILITY", name: "Accessibility & Adaptations", description: "DDA compliance, adaptations, accessible features", colorCode: "#8B5CF6", iconName: "Accessibility", isSystem: true, isActive: true, displayOrder: 13 },
    { code: "PEST_CONTROL", name: "Pest Control", description: "Pest inspections and treatment records", colorCode: "#A3A3A3", iconName: "Bug", isSystem: true, isActive: true, displayOrder: 14 },
    { code: "WASTE", name: "Waste Management", description: "Bin stores, recycling, waste disposal compliance", colorCode: "#65A30D", iconName: "Trash2", isSystem: true, isActive: true, displayOrder: 15 },
    { code: "COMMUNAL", name: "Communal Areas", description: "Communal cleaning, lighting, general maintenance", colorCode: "#EC4899", iconName: "Users", isSystem: true, isActive: true, displayOrder: 16 },
  ];
  
  for (const stream of streamsData) {
    await db.insert(complianceStreams).values(stream)
      .onConflictDoUpdate({
        target: complianceStreams.code,
        set: {
          name: stream.name,
          description: stream.description,
          colorCode: stream.colorCode,
          iconName: stream.iconName,
          isSystem: stream.isSystem,
          displayOrder: stream.displayOrder,
          updatedAt: new Date()
        }
      });
  }
  console.log(`✓ Upserted ${streamsData.length} compliance streams`);
  
  // Fetch all streams to get their IDs for linking
  const allStreams = await db.select().from(complianceStreams);
  const streamCodeToId: Record<string, string> = {};
  for (const stream of allStreams) {
    streamCodeToId[stream.code] = stream.id;
  }
  
  // Document type to stream code mapping (used for extraction schemas, compliance rules, etc.)
  const documentTypeToStreamCode: Record<string, string> = {
    // Gas & Heating
    "GAS": "GAS_HEATING", "GAS_SVC": "GAS_HEATING", "OIL": "GAS_HEATING", "OIL_TANK": "GAS_HEATING",
    "LPG": "GAS_HEATING", "SOLID": "GAS_HEATING", "BIO": "GAS_HEATING", "HVAC": "GAS_HEATING",
    "MECH": "GAS_HEATING", "ASHP": "GAS_HEATING", "GSHP": "GAS_HEATING",
    // Electrical
    "EICR": "ELECTRICAL", "EIC": "ELECTRICAL", "MEIWC": "ELECTRICAL", "PAT": "ELECTRICAL",
    "EMLT": "ELECTRICAL", "EMLT_M": "ELECTRICAL", "ELEC_HEAT": "ELECTRICAL",
    // Energy
    "EPC": "ENERGY", "SAP": "ENERGY", "DEC": "ENERGY",
    // Fire Safety
    "FRA": "FIRE_SAFETY", "FRAEW": "FIRE_SAFETY", "FD": "FIRE_SAFETY", "FD_Q": "FIRE_SAFETY",
    "FA": "FIRE_SAFETY", "FA_W": "FIRE_SAFETY", "FA_Q": "FIRE_SAFETY", "SD": "FIRE_SAFETY",
    "CO": "FIRE_SAFETY", "SPRINK": "FIRE_SAFETY", "DRY": "FIRE_SAFETY", "WET": "FIRE_SAFETY",
    "AOV": "FIRE_SAFETY", "SMOKE_V": "FIRE_SAFETY", "EXT": "FIRE_SAFETY", "COMPART": "FIRE_SAFETY",
    // Asbestos
    "ASB": "ASBESTOS", "ASB_M": "ASBESTOS", "ASB_R": "ASBESTOS", "ASB_D": "ASBESTOS", "ASB_REF": "ASBESTOS",
    // Water Safety
    "LEG": "WATER_SAFETY", "LEG_M": "WATER_SAFETY", "WATER": "WATER_SAFETY", "TANK": "WATER_SAFETY", "TMV": "WATER_SAFETY",
    // Lifting Equipment
    "LIFT": "LIFTING", "LIFT_M": "LIFTING", "STAIR": "LIFTING", "HOIST": "LIFTING", "PLAT": "LIFTING",
    // Building Safety
    "HHSRS": "BUILDING_SAFETY", "STRUCT": "BUILDING_SAFETY", "DAMP": "BUILDING_SAFETY",
    "ROOF": "BUILDING_SAFETY", "CHIMNEY": "BUILDING_SAFETY", "DRAIN": "BUILDING_SAFETY", "LIGHT": "BUILDING_SAFETY",
    // External Areas
    "PLAY": "EXTERNAL", "PLAY_Q": "EXTERNAL", "TREE": "EXTERNAL",
    // Access Equipment (use LIFTING for now)
    "FALL": "LIFTING", "ACCESS": "LIFTING",
    // Security
    "CCTV": "SECURITY", "ENTRY": "SECURITY", "ALARM": "SECURITY",
    // HRB Specific
    "SIB": "HRB_SPECIFIC", "WAYFIND": "HRB_SPECIFIC", "SC": "HRB_SPECIFIC",
    "RES": "HRB_SPECIFIC", "PEEP": "HRB_SPECIFIC", "BEEP": "HRB_SPECIFIC"
  };
  
  // Classification code to stream code mapping (based on which certificate types use these codes)
  const classificationCodeToStreamCode: Record<string, string> = {
    // Gas Safety codes
    "ID": "GAS_HEATING", "AR": "GAS_HEATING", "NCS": "GAS_HEATING",
    // EICR codes
    "C1": "ELECTRICAL", "C2": "ELECTRICAL", "C3": "ELECTRICAL", "FI": "ELECTRICAL",
    // Fire Risk codes
    "TRIVIAL": "FIRE_SAFETY", "TOLERABLE": "FIRE_SAFETY", "MODERATE": "FIRE_SAFETY",
    "SUBSTANTIAL": "FIRE_SAFETY", "INTOLERABLE": "FIRE_SAFETY",
    // Asbestos codes
    "ACM_LOW": "ASBESTOS", "ACM_MEDIUM": "ASBESTOS", "ACM_HIGH": "ASBESTOS", "ACM_CRITICAL": "ASBESTOS",
    // LOLER Lift codes
    "LIFT_SAFE": "LIFTING", "LIFT_MINOR": "LIFTING", "LIFT_SIGNIFICANT": "LIFTING", "LIFT_DANGEROUS": "LIFTING",
    // EPC codes
    "EPC_A": "ENERGY", "EPC_B": "ENERGY", "EPC_C": "ENERGY", "EPC_D": "ENERGY",
    "EPC_E": "ENERGY", "EPC_F": "ENERGY", "EPC_G": "ENERGY",
    // Legionella codes
    "LEG_LOW": "WATER_SAFETY", "LEG_MEDIUM": "WATER_SAFETY", "LEG_HIGH": "WATER_SAFETY", "LEG_OUTBREAK": "WATER_SAFETY",
    // Fire Door codes
    "FD_PASS": "FIRE_SAFETY", "FD_MINOR": "FIRE_SAFETY", "FD_SIGNIFICANT": "FIRE_SAFETY",
    "FD_FAIL": "FIRE_SAFETY", "FD_CRITICAL": "FIRE_SAFETY",
    // Fire Alarm codes
    "FA_PASS": "FIRE_SAFETY", "FA_MINOR": "FIRE_SAFETY", "FA_FAULT": "FIRE_SAFETY", "FA_CRITICAL": "FIRE_SAFETY",
    // Playground codes
    "PLAY_LOW": "EXTERNAL", "PLAY_MEDIUM": "EXTERNAL", "PLAY_HIGH": "EXTERNAL", "PLAY_CRITICAL": "EXTERNAL",
    // Tree codes
    "TREE_SAFE": "EXTERNAL", "TREE_ROUTINE": "EXTERNAL", "TREE_PRIORITY": "EXTERNAL",
    "TREE_URGENT": "EXTERNAL", "TREE_DANGEROUS": "EXTERNAL",
    // HHSRS codes
    "HHSRS_CAT1": "HOUSING_HEALTH", "HHSRS_CAT2_HIGH": "HOUSING_HEALTH",
    "HHSRS_CAT2_MED": "HOUSING_HEALTH", "HHSRS_CAT2_LOW": "HOUSING_HEALTH",
    // Damp & Mould codes
    "DAMP_MINOR": "HOUSING_HEALTH", "DAMP_MODERATE": "HOUSING_HEALTH",
    "DAMP_SEVERE": "HOUSING_HEALTH", "DAMP_CRITICAL": "HOUSING_HEALTH",
    // Emergency Lighting codes
    "EMLT_PASS": "ELECTRICAL", "EMLT_FAIL": "ELECTRICAL", "EMLT_CRITICAL": "ELECTRICAL",
    // Sprinkler codes
    "SPRINK_PASS": "FIRE_SAFETY", "SPRINK_DEFECT": "FIRE_SAFETY", "SPRINK_CRITICAL": "FIRE_SAFETY",
    // AOV codes
    "AOV_PASS": "FIRE_SAFETY", "AOV_DEFECT": "FIRE_SAFETY", "AOV_CRITICAL": "FIRE_SAFETY"
    // Generic codes (PASS, FAIL, UNSATISFACTORY, REVIEW) intentionally omitted - they apply across streams
  };
  
  // ==================== CERTIFICATE TYPES ====================
  // Comprehensive compliance types based on UK social housing regulations
  const certTypesData = [
    // ========== GAS & HEATING (1-20) ==========
    { code: "GAS", name: "Gas Safety Certificate (CP12/LGSR)", shortName: "Gas Safety", complianceStream: "GAS_HEATING", description: "Annual gas safety check required under Gas Safety (Installation and Use) Regulations 1998", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "engineerName", "gasRegisterId", "issueDate", "expiryDate"], displayOrder: 1, isActive: true },
    { code: "GAS_SVC", name: "Gas Servicing Certificate", shortName: "Gas Service", complianceStream: "GAS_HEATING", description: "Annual gas appliance servicing by Gas Safe engineer", validityMonths: 12, warningDays: 30, requiredFields: ["certificateNumber", "engineerName", "gasRegisterId", "issueDate"], displayOrder: 2, isActive: true },
    { code: "OIL", name: "Oil Heating Certificate (OFTEC)", shortName: "Oil Heating", complianceStream: "GAS_HEATING", description: "Annual oil boiler inspection by OFTEC technician", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "technicianName", "oftecNumber", "issueDate"], displayOrder: 3, isActive: true },
    { code: "OIL_TANK", name: "Oil Tank Inspection", shortName: "Oil Tank", complianceStream: "GAS_HEATING", description: "Annual oil tank inspection and integrity check", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "technicianName", "tankCondition"], displayOrder: 4, isActive: true },
    { code: "LPG", name: "LPG Safety Certificate", shortName: "LPG", complianceStream: "GAS_HEATING", description: "Annual LPG installation safety check by Gas Safe engineer", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "engineerName", "gasRegisterId", "issueDate"], displayOrder: 5, isActive: true },
    { code: "SOLID", name: "Solid Fuel Certificate (HETAS)", shortName: "Solid Fuel", complianceStream: "GAS_HEATING", description: "Annual solid fuel appliance inspection by HETAS engineer", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "engineerName", "hetasNumber", "issueDate"], displayOrder: 6, isActive: true },
    { code: "BIO", name: "Biomass Certificate", shortName: "Biomass", complianceStream: "GAS_HEATING", description: "Annual biomass heating system inspection", validityMonths: 12, warningDays: 30, requiredFields: ["certificateNumber", "engineerName", "issueDate"], displayOrder: 7, isActive: true },
    { code: "HVAC", name: "HVAC Systems Certificate", shortName: "HVAC", complianceStream: "GAS_HEATING", description: "Air conditioning and ventilation system inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "engineerName", "systemType"], displayOrder: 8, isActive: true },
    { code: "MECH", name: "Mechanical Servicing", shortName: "Mechanical", complianceStream: "GAS_HEATING", description: "Mechanical plant and equipment servicing", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "equipmentList"], displayOrder: 9, isActive: true },
    { code: "ASHP", name: "Air Source Heat Pump Certificate", shortName: "ASHP", complianceStream: "GAS_HEATING", description: "Annual air source heat pump inspection", validityMonths: 12, warningDays: 30, requiredFields: ["certificateNumber", "engineerName", "mcsNumber", "issueDate"], displayOrder: 10, isActive: true },
    { code: "GSHP", name: "Ground Source Heat Pump Certificate", shortName: "GSHP", complianceStream: "GAS_HEATING", description: "Annual ground source heat pump inspection", validityMonths: 12, warningDays: 30, requiredFields: ["certificateNumber", "engineerName", "mcsNumber", "issueDate"], displayOrder: 11, isActive: true },
    
    // ========== ELECTRICAL (21-30) ==========
    { code: "EICR", name: "Electrical Installation Condition Report", shortName: "EICR", complianceStream: "ELECTRICAL", description: "Periodic electrical safety inspection required every 5 years under Electrical Safety Standards Regulations 2020", validityMonths: 60, warningDays: 90, requiredFields: ["certificateNumber", "engineerName", "issueDate", "nextInspectionDate", "overallAssessment"], displayOrder: 21, isActive: true },
    { code: "EIC", name: "Electrical Installation Certificate", shortName: "EIC", complianceStream: "ELECTRICAL", description: "Certificate for new electrical installations", validityMonths: 60, warningDays: 90, requiredFields: ["certificateNumber", "engineerName", "issueDate"], displayOrder: 22, isActive: true },
    { code: "MEIWC", name: "Minor Electrical Works Certificate", shortName: "MEIWC", complianceStream: "ELECTRICAL", description: "Certificate for minor electrical works", validityMonths: 60, warningDays: 90, requiredFields: ["certificateNumber", "engineerName", "worksDescription", "issueDate"], displayOrder: 23, isActive: true },
    { code: "PAT", name: "Portable Appliance Testing", shortName: "PAT", complianceStream: "ELECTRICAL", description: "Testing of portable electrical appliances", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "testerName", "appliancesTested", "passRate"], displayOrder: 24, isActive: true },
    { code: "EMLT", name: "Emergency Lighting Certificate", shortName: "Emergency Lighting", complianceStream: "ELECTRICAL", description: "Annual emergency lighting inspection under BS 5266", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "engineerName", "luminairesTested", "nextTestDate"], displayOrder: 25, isActive: true },
    { code: "EMLT_M", name: "Emergency Lighting Monthly Test", shortName: "Em Light Monthly", complianceStream: "ELECTRICAL", description: "Monthly emergency lighting functional test", validityMonths: 1, warningDays: 7, requiredFields: ["testDate", "testerName", "result"], displayOrder: 26, isActive: true },
    { code: "ELEC_HEAT", name: "Electric Heating Inspection", shortName: "Electric Heating", complianceStream: "ELECTRICAL", description: "Annual electric heating system inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "engineerName", "heaterCount"], displayOrder: 27, isActive: true },
    
    // ========== ENERGY (31-35) ==========
    { code: "EPC", name: "Energy Performance Certificate", shortName: "EPC", complianceStream: "ENERGY", description: "Energy efficiency rating required for lettings (10 year validity)", validityMonths: 120, warningDays: 180, requiredFields: ["certificateNumber", "assessorName", "currentRating", "issueDate"], displayOrder: 31, isActive: true },
    { code: "SAP", name: "SAP Assessment", shortName: "SAP", complianceStream: "ENERGY", description: "Standard Assessment Procedure calculation for new builds", validityMonths: 0, warningDays: 0, requiredFields: ["assessmentDate", "assessorName", "sapRating"], displayOrder: 32, isActive: true },
    { code: "DEC", name: "Display Energy Certificate", shortName: "DEC", complianceStream: "ENERGY", description: "Annual energy display certificate for public buildings", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "assessorName", "rating", "issueDate"], displayOrder: 33, isActive: true },
    
    // ========== FIRE SAFETY (41-60) ==========
    { code: "FRA", name: "Fire Risk Assessment", shortName: "Fire Risk", complianceStream: "FIRE_SAFETY", description: "Fire safety assessment required under Regulatory Reform (Fire Safety) Order 2005", validityMonths: 12, warningDays: 60, requiredFields: ["assessmentDate", "assessorName", "riskRating", "nextReviewDate"], displayOrder: 41, isActive: true },
    { code: "FRAEW", name: "External Wall Fire Risk Appraisal", shortName: "FRAEW/EWS1", complianceStream: "FIRE_SAFETY", description: "Fire risk appraisal of external walls under PAS 9980", validityMonths: 60, warningDays: 180, requiredFields: ["appraisalDate", "engineerName", "ews1Rating"], displayOrder: 42, isActive: true },
    { code: "FD", name: "Fire Door Inspection Report", shortName: "Fire Doors", complianceStream: "FIRE_SAFETY", description: "Fire door inspection (quarterly for HRBs, annual otherwise)", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "doorsInspected", "defectsFound"], displayOrder: 43, isActive: true },
    { code: "FD_Q", name: "Fire Door Quarterly Inspection", shortName: "Fire Door Q", complianceStream: "FIRE_SAFETY", description: "Quarterly fire door inspection for high-rise buildings", validityMonths: 3, warningDays: 14, requiredFields: ["inspectionDate", "inspectorName", "doorsInspected"], displayOrder: 44, isActive: true },
    { code: "FA", name: "Fire Alarm System Certificate", shortName: "Fire Alarm", complianceStream: "FIRE_SAFETY", description: "Annual fire alarm system inspection under BS 5839", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "engineerName", "systemType", "nextInspectionDate"], displayOrder: 45, isActive: true },
    { code: "FA_W", name: "Fire Alarm Weekly Test", shortName: "Fire Alarm W", complianceStream: "FIRE_SAFETY", description: "Weekly fire alarm call point test", validityMonths: 0, warningDays: 3, requiredFields: ["testDate", "testerName", "result"], displayOrder: 46, isActive: true },
    { code: "FA_Q", name: "Fire Alarm Quarterly Inspection", shortName: "Fire Alarm Q", complianceStream: "FIRE_SAFETY", description: "Quarterly fire alarm maintenance visit", validityMonths: 3, warningDays: 14, requiredFields: ["inspectionDate", "engineerName", "findings"], displayOrder: 47, isActive: true },
    { code: "SD", name: "Smoke Detector Certificate", shortName: "Smoke Detectors", complianceStream: "FIRE_SAFETY", description: "Annual smoke detector testing and certification", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "testerName", "detectorsCount"], displayOrder: 48, isActive: true },
    { code: "CO", name: "Carbon Monoxide Detector Certificate", shortName: "CO Detectors", complianceStream: "FIRE_SAFETY", description: "Annual CO detector testing and certification", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "testerName", "detectorsCount"], displayOrder: 49, isActive: true },
    { code: "SPRINK", name: "Sprinkler System Certificate", shortName: "Sprinklers", complianceStream: "FIRE_SAFETY", description: "Annual sprinkler system inspection by LPCB contractor", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "engineerName", "systemType"], displayOrder: 50, isActive: true },
    { code: "DRY", name: "Dry Riser Certificate", shortName: "Dry Riser", complianceStream: "FIRE_SAFETY", description: "Six-monthly dry riser testing", validityMonths: 6, warningDays: 30, requiredFields: ["testDate", "engineerName", "testResult"], displayOrder: 51, isActive: true },
    { code: "WET", name: "Wet Riser Certificate", shortName: "Wet Riser", complianceStream: "FIRE_SAFETY", description: "Six-monthly wet riser testing", validityMonths: 6, warningDays: 30, requiredFields: ["testDate", "engineerName", "testResult"], displayOrder: 52, isActive: true },
    { code: "AOV", name: "Automatic Opening Vent Certificate", shortName: "AOV", complianceStream: "FIRE_SAFETY", description: "Annual AOV smoke ventilation system test", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "engineerName", "aovCount", "result"], displayOrder: 53, isActive: true },
    { code: "SMOKE_V", name: "Smoke Ventilation Certificate", shortName: "Smoke Vent", complianceStream: "FIRE_SAFETY", description: "Annual smoke ventilation system inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "engineerName", "systemType"], displayOrder: 54, isActive: true },
    { code: "EXT", name: "Fire Extinguisher Certificate", shortName: "Extinguishers", complianceStream: "FIRE_SAFETY", description: "Annual fire extinguisher service by BAFE contractor", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "extinguishersCount"], displayOrder: 55, isActive: true },
    { code: "COMPART", name: "Compartmentation Survey", shortName: "Compartmentation", complianceStream: "FIRE_SAFETY", description: "Fire compartmentation survey and inspection", validityMonths: 60, warningDays: 180, requiredFields: ["surveyDate", "surveyorName", "findings"], displayOrder: 56, isActive: true },
    
    // ========== ASBESTOS (61-70) ==========
    { code: "ASB", name: "Asbestos Management Survey", shortName: "Asbestos Survey", complianceStream: "ASBESTOS", description: "Asbestos management survey under Control of Asbestos Regulations 2012", validityMonths: 0, warningDays: 0, requiredFields: ["surveyDate", "surveyorName", "surveyType", "acmsIdentified"], displayOrder: 61, isActive: true },
    { code: "ASB_M", name: "Asbestos Management Plan", shortName: "Asbestos Plan", complianceStream: "ASBESTOS", description: "Annual asbestos management plan review", validityMonths: 12, warningDays: 60, requiredFields: ["reviewDate", "reviewer", "acmsStatus"], displayOrder: 62, isActive: true },
    { code: "ASB_R", name: "Asbestos Re-inspection", shortName: "Asbestos Reinsp", complianceStream: "ASBESTOS", description: "Annual ACM condition reinspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "acmsInspected", "conditionChanges"], displayOrder: 63, isActive: true },
    { code: "ASB_D", name: "Asbestos Demolition Survey", shortName: "Asbestos Demo", complianceStream: "ASBESTOS", description: "Refurbishment and demolition asbestos survey", validityMonths: 0, warningDays: 0, requiredFields: ["surveyDate", "surveyorName", "surveyType"], displayOrder: 64, isActive: true },
    { code: "ASB_REF", name: "Asbestos Refurbishment Survey", shortName: "Asbestos Refurb", complianceStream: "ASBESTOS", description: "Pre-works asbestos survey for refurbishment", validityMonths: 0, warningDays: 0, requiredFields: ["surveyDate", "surveyorName", "worksArea"], displayOrder: 65, isActive: true },
    
    // ========== WATER SAFETY (71-80) ==========
    { code: "LEG", name: "Legionella Risk Assessment", shortName: "Legionella", complianceStream: "WATER_SAFETY", description: "Water hygiene risk assessment under HSE ACOP L8 (2-year validity)", validityMonths: 24, warningDays: 90, requiredFields: ["assessmentDate", "assessorName", "riskLevel", "controlMeasures"], displayOrder: 71, isActive: true },
    { code: "LEG_M", name: "Legionella Monitoring", shortName: "Legionella Mon", complianceStream: "WATER_SAFETY", description: "Monthly legionella monitoring and temperature checks", validityMonths: 1, warningDays: 7, requiredFields: ["monitoringDate", "monitorName", "temperatures"], displayOrder: 72, isActive: true },
    { code: "WATER", name: "Water Hygiene Report", shortName: "Water Hygiene", complianceStream: "WATER_SAFETY", description: "Annual water hygiene inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "findings"], displayOrder: 73, isActive: true },
    { code: "TANK", name: "Water Tank Inspection", shortName: "Water Tank", complianceStream: "WATER_SAFETY", description: "Annual cold water storage tank inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "tankCondition"], displayOrder: 74, isActive: true },
    { code: "TMV", name: "TMV Servicing Certificate", shortName: "TMV", complianceStream: "WATER_SAFETY", description: "Annual thermostatic mixing valve servicing", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "tmvCount"], displayOrder: 75, isActive: true },
    
    // ========== LIFTING EQUIPMENT (81-90) ==========
    { code: "LIFT", name: "Lift Thorough Examination (LOLER)", shortName: "Lift/LOLER", complianceStream: "LIFTING_EQUIPMENT", description: "Six-monthly lift inspection under LOLER 1998", validityMonths: 6, warningDays: 30, requiredFields: ["examinationDate", "engineerName", "liftId", "safeForUse", "nextExaminationDate"], displayOrder: 81, isActive: true },
    { code: "LIFT_M", name: "Lift Monthly Check", shortName: "Lift Monthly", complianceStream: "LIFTING_EQUIPMENT", description: "Monthly lift safety check for high-rise buildings", validityMonths: 1, warningDays: 7, requiredFields: ["checkDate", "checkerName", "result"], displayOrder: 82, isActive: true },
    { code: "STAIR", name: "Stairlift Examination", shortName: "Stairlift", complianceStream: "LIFTING_EQUIPMENT", description: "Six-monthly stairlift thorough examination", validityMonths: 6, warningDays: 30, requiredFields: ["examinationDate", "engineerName", "safeForUse"], displayOrder: 83, isActive: true },
    { code: "HOIST", name: "Hoist Examination", shortName: "Hoist", complianceStream: "LIFTING_EQUIPMENT", description: "Six-monthly hoist thorough examination", validityMonths: 6, warningDays: 30, requiredFields: ["examinationDate", "engineerName", "safeForUse"], displayOrder: 84, isActive: true },
    { code: "PLAT", name: "Platform Lift Examination", shortName: "Platform Lift", complianceStream: "LIFTING_EQUIPMENT", description: "Six-monthly platform lift thorough examination", validityMonths: 6, warningDays: 30, requiredFields: ["examinationDate", "engineerName", "safeForUse"], displayOrder: 85, isActive: true },
    
    // ========== BUILDING SAFETY (91-100) ==========
    { code: "HHSRS", name: "HHSRS Assessment", shortName: "HHSRS", complianceStream: "BUILDING_SAFETY", description: "Housing Health and Safety Rating System assessment", validityMonths: 0, warningDays: 0, requiredFields: ["assessmentDate", "assessorName", "hazards"], displayOrder: 91, isActive: true },
    { code: "STRUCT", name: "Structural Survey", shortName: "Structural", complianceStream: "BUILDING_SAFETY", description: "Structural condition survey (5-year cycle)", validityMonths: 60, warningDays: 180, requiredFields: ["surveyDate", "engineerName", "findings"], displayOrder: 92, isActive: true },
    { code: "DAMP", name: "Damp & Mould Survey", shortName: "Damp/Mould", complianceStream: "BUILDING_SAFETY", description: "Damp and mould investigation report", validityMonths: 0, warningDays: 0, requiredFields: ["surveyDate", "surveyorName", "findings", "recommendations"], displayOrder: 93, isActive: true },
    { code: "ROOF", name: "Roof Survey", shortName: "Roof", complianceStream: "BUILDING_SAFETY", description: "Roof condition survey (5-year cycle)", validityMonths: 60, warningDays: 180, requiredFields: ["surveyDate", "surveyorName", "roofCondition"], displayOrder: 94, isActive: true },
    { code: "CHIMNEY", name: "Chimney Inspection", shortName: "Chimney", complianceStream: "BUILDING_SAFETY", description: "Annual chimney inspection and sweep record", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "sweepName", "condition"], displayOrder: 95, isActive: true },
    { code: "DRAIN", name: "Drainage Survey", shortName: "Drainage", complianceStream: "BUILDING_SAFETY", description: "CCTV drainage survey (5-year cycle)", validityMonths: 60, warningDays: 180, requiredFields: ["surveyDate", "operatorName", "findings"], displayOrder: 96, isActive: true },
    { code: "LIGHT", name: "Lightning Protection Certificate", shortName: "Lightning", complianceStream: "BUILDING_SAFETY", description: "Annual lightning protection system inspection", validityMonths: 12, warningDays: 30, requiredFields: ["testDate", "engineerName", "systemStatus"], displayOrder: 97, isActive: true },
    
    // ========== EXTERNAL AREAS (101-105) ==========
    { code: "PLAY", name: "Playground Inspection", shortName: "Playground", complianceStream: "EXTERNAL_AREAS", description: "Annual playground equipment safety inspection", validityMonths: 12, warningDays: 60, requiredFields: ["inspectionDate", "inspectorName", "equipmentList", "findings"], displayOrder: 101, isActive: true },
    { code: "PLAY_Q", name: "Playground Quarterly Inspection", shortName: "Playground Q", complianceStream: "EXTERNAL_AREAS", description: "Quarterly operational playground inspection", validityMonths: 3, warningDays: 14, requiredFields: ["inspectionDate", "inspectorName", "findings"], displayOrder: 102, isActive: true },
    { code: "TREE", name: "Tree Survey", shortName: "Tree Survey", complianceStream: "EXTERNAL_AREAS", description: "Tree condition survey (3-year cycle)", validityMonths: 36, warningDays: 90, requiredFields: ["surveyDate", "arboristName", "treesAssessed", "recommendations"], displayOrder: 103, isActive: true },
    
    // ========== ACCESS EQUIPMENT (106-110) ==========
    { code: "FALL", name: "Fall Arrest System Certificate", shortName: "Fall Arrest", complianceStream: "ACCESS_EQUIPMENT", description: "Annual fall arrest and anchor point inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "anchorCount", "result"], displayOrder: 106, isActive: true },
    { code: "ACCESS", name: "Access Equipment Inspection", shortName: "Access Equip", complianceStream: "ACCESS_EQUIPMENT", description: "Annual access equipment and ladders inspection", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "equipmentList"], displayOrder: 107, isActive: true },
    
    // ========== SECURITY (111-115) ==========
    { code: "CCTV", name: "CCTV Maintenance Certificate", shortName: "CCTV", complianceStream: "SECURITY", description: "Annual CCTV system maintenance", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "cameraCount"], displayOrder: 111, isActive: true },
    { code: "ENTRY", name: "Door Entry System Certificate", shortName: "Door Entry", complianceStream: "SECURITY", description: "Annual door entry system maintenance", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "systemType"], displayOrder: 112, isActive: true },
    { code: "ALARM", name: "Intruder Alarm Certificate", shortName: "Intruder Alarm", complianceStream: "SECURITY", description: "Annual intruder alarm system maintenance", validityMonths: 12, warningDays: 30, requiredFields: ["serviceDate", "engineerName", "systemType"], displayOrder: 113, isActive: true },
    
    // ========== HRB SPECIFIC - Building Safety Act (116-125) ==========
    { code: "SIB", name: "Secure Information Box Certificate", shortName: "Secure Info Box", complianceStream: "HRB_SPECIFIC", description: "Annual secure information box inspection (HRB requirement)", validityMonths: 12, warningDays: 30, requiredFields: ["inspectionDate", "inspectorName", "contentsVerified"], displayOrder: 116, isActive: true },
    { code: "WAYFIND", name: "Wayfinding Signage Inspection", shortName: "Wayfinding", complianceStream: "HRB_SPECIFIC", description: "Wayfinding and floor identification signage check", validityMonths: 0, warningDays: 0, requiredFields: ["inspectionDate", "inspectorName", "signageStatus"], displayOrder: 117, isActive: true },
    { code: "SC", name: "Building Safety Case", shortName: "Safety Case", complianceStream: "HRB_SPECIFIC", description: "Building Safety Case document (2-year review)", validityMonths: 24, warningDays: 180, requiredFields: ["reviewDate", "reviewer", "caseStatus"], displayOrder: 118, isActive: true },
    { code: "RES", name: "Resident Engagement Strategy", shortName: "Resident Strategy", complianceStream: "HRB_SPECIFIC", description: "Resident engagement strategy review (2-year cycle)", validityMonths: 24, warningDays: 90, requiredFields: ["reviewDate", "reviewer", "strategyStatus"], displayOrder: 119, isActive: true },
    { code: "PEEP", name: "PEEP Assessment", shortName: "PEEP", complianceStream: "HRB_SPECIFIC", description: "Personal Emergency Evacuation Plan assessment", validityMonths: 12, warningDays: 60, requiredFields: ["assessmentDate", "assessorName", "residentName"], displayOrder: 120, isActive: true },
    { code: "BEEP", name: "Building Emergency Evacuation Plan", shortName: "BEEP", complianceStream: "HRB_SPECIFIC", description: "Building emergency evacuation plan review", validityMonths: 12, warningDays: 60, requiredFields: ["reviewDate", "reviewer", "planStatus"], displayOrder: 121, isActive: true },
    
    // ========== ENUM ALIASES (for extraction compatibility) ==========
    { code: "GAS_SAFETY", name: "Gas Safety Certificate (CP12)", shortName: "Gas Safety", complianceStream: "GAS_HEATING", description: "Annual gas safety check required under Gas Safety (Installation and Use) Regulations 1998", validityMonths: 12, warningDays: 60, requiredFields: ["certificateNumber", "engineerName", "gasRegisterId", "issueDate", "expiryDate"], displayOrder: 130, isActive: true },
    { code: "FIRE_RISK_ASSESSMENT", name: "Fire Risk Assessment", shortName: "FRA", complianceStream: "FIRE_SAFETY", description: "Fire risk assessment under Regulatory Reform (Fire Safety) Order 2005", validityMonths: 12, warningDays: 60, requiredFields: ["assessmentDate", "assessorName", "riskLevel", "findings"], displayOrder: 131, isActive: true },
    { code: "ASBESTOS_SURVEY", name: "Asbestos Management Survey", shortName: "Asbestos", complianceStream: "ASBESTOS", description: "Asbestos management survey under Control of Asbestos Regulations 2012", validityMonths: 0, warningDays: 0, requiredFields: ["surveyDate", "surveyorName", "surveyType", "acmsIdentified"], displayOrder: 132, isActive: true },
    { code: "LEGIONELLA_ASSESSMENT", name: "Legionella Risk Assessment", shortName: "Legionella", complianceStream: "WATER_SAFETY", description: "Water hygiene risk assessment under HSE ACOP L8", validityMonths: 24, warningDays: 90, requiredFields: ["assessmentDate", "assessorName", "riskLevel", "controlMeasures"], displayOrder: 133, isActive: true },
    { code: "LIFT_LOLER", name: "Lift Thorough Examination (LOLER)", shortName: "Lift/LOLER", complianceStream: "LIFTING_EQUIPMENT", description: "Six-monthly lift inspection under LOLER 1998", validityMonths: 6, warningDays: 30, requiredFields: ["examinationDate", "engineerName", "liftId", "safeForUse", "nextExaminationDate"], displayOrder: 134, isActive: true }
  ];
  
  for (const certType of certTypesData) {
    const streamId = streamCodeToId[certType.complianceStream] || null;
    await db.insert(certificateTypes).values({ ...certType, streamId })
      .onConflictDoUpdate({
        target: certificateTypes.code,
        set: {
          name: certType.name,
          shortName: certType.shortName,
          complianceStream: certType.complianceStream,
          streamId: streamId,
          description: certType.description,
          validityMonths: certType.validityMonths,
          warningDays: certType.warningDays,
          requiredFields: certType.requiredFields,
          displayOrder: certType.displayOrder,
          isActive: certType.isActive,
          updatedAt: new Date()
        }
      });
  }
  console.log(`✓ Upserted ${certTypesData.length} certificate types with stream links`);
  
  // ==================== CLASSIFICATION CODES ====================
  // Comprehensive defect/risk classification codes for all certificate types with remedial action settings
  const classificationCodesData = [
    // ========== GAS SAFETY CODES (ID/AR/NCS per Gas Safe regulations) ==========
    { code: "ID", name: "Immediately Dangerous", severity: "CRITICAL", colorCode: "#DC2626", description: "Immediately Dangerous - gas supply must be disconnected", actionRequired: "Immediate disconnection and isolation", timeframeHours: 0, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 20000, costEstimateHigh: 50000, displayOrder: 1, isActive: true },
    { code: "AR", name: "At Risk", severity: "HIGH", colorCode: "#EA580C", description: "At Risk - not immediately dangerous but could become so", actionRequired: "Repair within 28 days", timeframeHours: 672, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 15000, costEstimateHigh: 40000, displayOrder: 2, isActive: true },
    { code: "NCS", name: "Not to Current Standards", severity: "MEDIUM", colorCode: "#CA8A04", description: "Not to Current Standards - not dangerous but should be upgraded", actionRequired: "Plan upgrade at next service", timeframeHours: null, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 10000, costEstimateHigh: 25000, displayOrder: 3, isActive: true },
    
    // ========== EICR CODES (C1/C2/C3/FI per BS 7671) ==========
    { code: "C1", name: "Danger Present", severity: "CRITICAL", colorCode: "#DC2626", description: "C1 - Danger present requiring immediate remedial action", actionRequired: "Immediate remedial action required", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 15000, costEstimateHigh: 40000, displayOrder: 4, isActive: true },
    { code: "C2", name: "Potentially Dangerous", severity: "HIGH", colorCode: "#EA580C", description: "C2 - Potentially dangerous requiring urgent remediation", actionRequired: "Remediation within 28 days", timeframeHours: 672, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 8000, costEstimateHigh: 25000, displayOrder: 5, isActive: true },
    { code: "C3", name: "Improvement Recommended", severity: "LOW", colorCode: "#16A34A", description: "C3 - Improvement recommended but not a safety concern", actionRequired: "Consider improvement at next opportunity", timeframeHours: null, autoCreateAction: false, actionSeverity: "ADVISORY", costEstimateLow: 5000, costEstimateHigh: 15000, displayOrder: 6, isActive: true },
    { code: "FI", name: "Further Investigation", severity: "MEDIUM", colorCode: "#CA8A04", description: "FI - Further investigation required to assess risk", actionRequired: "Investigation within 28 days", timeframeHours: 672, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 10000, costEstimateHigh: 30000, displayOrder: 7, isActive: true },
    
    // ========== FIRE RISK ASSESSMENT RATINGS (per PAS 79) ==========
    { code: "TRIVIAL", name: "Trivial Risk", severity: "LOW", colorCode: "#16A34A", description: "Trivial risk - no action required beyond normal controls", actionRequired: "Continue monitoring", timeframeHours: null, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 8, isActive: true },
    { code: "TOLERABLE", name: "Tolerable Risk", severity: "LOW", colorCode: "#22C55E", description: "Tolerable risk - monitor and maintain existing controls", actionRequired: "Annual review", timeframeHours: 8760, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 9, isActive: true },
    { code: "MODERATE", name: "Moderate Risk", severity: "MEDIUM", colorCode: "#CA8A04", description: "Moderate risk - efforts should be made to reduce risk", actionRequired: "Action within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 10, isActive: true },
    { code: "SUBSTANTIAL", name: "Substantial Risk", severity: "HIGH", colorCode: "#EA580C", description: "Substantial risk - work should not proceed until risk reduced", actionRequired: "Action within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 11, isActive: true },
    { code: "INTOLERABLE", name: "Intolerable Risk", severity: "CRITICAL", colorCode: "#DC2626", description: "Intolerable risk - work must not proceed until risk eliminated", actionRequired: "Immediate action required", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 200000, costEstimateHigh: 1000000, displayOrder: 12, isActive: true },
    
    // ========== ASBESTOS RISK CATEGORIES (per CAR 2012) ==========
    { code: "ACM_LOW", name: "Low Risk ACM", severity: "LOW", colorCode: "#16A34A", description: "Low risk ACM - manage in place with periodic inspection", actionRequired: "Annual reinspection", timeframeHours: 8760, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 13, isActive: true },
    { code: "ACM_MEDIUM", name: "Medium Risk ACM", severity: "MEDIUM", colorCode: "#CA8A04", description: "Medium risk ACM - manage with enhanced controls", actionRequired: "Six-monthly inspection and labelling", timeframeHours: 4380, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 150000, displayOrder: 14, isActive: true },
    { code: "ACM_HIGH", name: "High Risk ACM", severity: "HIGH", colorCode: "#EA580C", description: "High risk ACM - removal or encapsulation required", actionRequired: "Action within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 200000, costEstimateHigh: 1000000, displayOrder: 15, isActive: true },
    { code: "ACM_CRITICAL", name: "Critical Risk ACM", severity: "CRITICAL", colorCode: "#DC2626", description: "Critical risk ACM - urgent removal by licensed contractor", actionRequired: "Urgent removal within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 500000, costEstimateHigh: 2000000, displayOrder: 16, isActive: true },
    
    // ========== LOLER LIFT DEFECTS (per LOLER 1998) ==========
    { code: "LIFT_SAFE", name: "Safe for Use", severity: "LOW", colorCode: "#16A34A", description: "Lift safe for continued use with no defects", actionRequired: "None - continue operation", timeframeHours: null, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 17, isActive: true },
    { code: "LIFT_MINOR", name: "Minor Defect", severity: "LOW", colorCode: "#22C55E", description: "Minor defects that do not affect safety", actionRequired: "Repair within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 20000, costEstimateHigh: 80000, displayOrder: 18, isActive: true },
    { code: "LIFT_SIGNIFICANT", name: "Significant Defect", severity: "MEDIUM", colorCode: "#CA8A04", description: "Significant defects requiring prompt attention", actionRequired: "Repair within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 19, isActive: true },
    { code: "LIFT_DANGEROUS", name: "Dangerous Defect", severity: "CRITICAL", colorCode: "#DC2626", description: "Dangerous defects - lift must not be used", actionRequired: "Immediate isolation and repair", timeframeHours: 0, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 20, isActive: true },
    
    // ========== EPC RATINGS ==========
    { code: "EPC_A", name: "EPC Rating A", severity: "LOW", colorCode: "#15803D", description: "EPC Rating A (92-100) - highest efficiency", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 21, isActive: true },
    { code: "EPC_B", name: "EPC Rating B", severity: "LOW", colorCode: "#16A34A", description: "EPC Rating B (81-91) - very high efficiency", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 22, isActive: true },
    { code: "EPC_C", name: "EPC Rating C", severity: "LOW", colorCode: "#22C55E", description: "EPC Rating C (69-80) - good efficiency", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 23, isActive: true },
    { code: "EPC_D", name: "EPC Rating D", severity: "MEDIUM", colorCode: "#CA8A04", description: "EPC Rating D (55-68) - plan improvements for 2030 target", actionRequired: "Plan efficiency improvements", timeframeHours: null, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 200000, costEstimateHigh: 1000000, displayOrder: 24, isActive: true },
    { code: "EPC_E", name: "EPC Rating E", severity: "HIGH", colorCode: "#EA580C", description: "EPC Rating E (39-54) - current minimum for rental", actionRequired: "Improvement works required", timeframeHours: 8760, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 500000, costEstimateHigh: 2000000, displayOrder: 25, isActive: true },
    { code: "EPC_F", name: "EPC Rating F", severity: "CRITICAL", colorCode: "#DC2626", description: "EPC Rating F (21-38) - below rental minimum", actionRequired: "Immediate improvement works required", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 800000, costEstimateHigh: 3000000, displayOrder: 26, isActive: true },
    { code: "EPC_G", name: "EPC Rating G", severity: "CRITICAL", colorCode: "#991B1B", description: "EPC Rating G (1-20) - cannot legally rent", actionRequired: "Urgent improvement works - void property", timeframeHours: 720, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 1000000, costEstimateHigh: 5000000, displayOrder: 27, isActive: true },
    
    // ========== LEGIONELLA RISK LEVELS (per HSE ACOP L8) ==========
    { code: "LEG_LOW", name: "Low Legionella Risk", severity: "LOW", colorCode: "#16A34A", description: "Low legionella risk - maintain current controls", actionRequired: "Continue monthly monitoring", timeframeHours: null, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 28, isActive: true },
    { code: "LEG_MEDIUM", name: "Medium Legionella Risk", severity: "MEDIUM", colorCode: "#CA8A04", description: "Medium legionella risk - enhanced monitoring required", actionRequired: "Weekly temperature checks and flush regime", timeframeHours: 720, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 20000, costEstimateHigh: 80000, displayOrder: 29, isActive: true },
    { code: "LEG_HIGH", name: "High Legionella Risk", severity: "HIGH", colorCode: "#EA580C", description: "High legionella risk - immediate remediation required", actionRequired: "Urgent chlorination and remediation", timeframeHours: 168, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 30, isActive: true },
    { code: "LEG_OUTBREAK", name: "Legionella Outbreak", severity: "CRITICAL", colorCode: "#DC2626", description: "Potential legionella outbreak - notify PHE", actionRequired: "Immediate system shutdown and HSE notification", timeframeHours: 0, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 31, isActive: true },
    
    // ========== FIRE DOOR DEFECTS (per Fire Safety England Regs 2022) ==========
    { code: "FD_PASS", name: "Fire Door Compliant", severity: "LOW", colorCode: "#16A34A", description: "Fire door meets all requirements", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 32, isActive: true },
    { code: "FD_MINOR", name: "Minor Fire Door Defect", severity: "LOW", colorCode: "#22C55E", description: "Minor defect not affecting fire resistance", actionRequired: "Repair within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 10000, costEstimateHigh: 30000, displayOrder: 33, isActive: true },
    { code: "FD_SIGNIFICANT", name: "Significant Fire Door Defect", severity: "MEDIUM", colorCode: "#CA8A04", description: "Defect compromising fire resistance - repair needed", actionRequired: "Repair within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 30000, costEstimateHigh: 100000, displayOrder: 34, isActive: true },
    { code: "FD_FAIL", name: "Fire Door Failed", severity: "HIGH", colorCode: "#EA580C", description: "Fire door not fit for purpose - replacement required", actionRequired: "Replace within 14 days", timeframeHours: 336, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 80000, costEstimateHigh: 200000, displayOrder: 35, isActive: true },
    { code: "FD_CRITICAL", name: "Critical Fire Door Defect", severity: "CRITICAL", colorCode: "#DC2626", description: "Critical defect in HRB - immediate action", actionRequired: "Immediate repair or fire watch", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 100000, costEstimateHigh: 300000, displayOrder: 36, isActive: true },
    
    // ========== FIRE ALARM DEFECTS (per BS 5839) ==========
    { code: "FA_PASS", name: "Fire Alarm Compliant", severity: "LOW", colorCode: "#16A34A", description: "Fire alarm system fully operational", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 37, isActive: true },
    { code: "FA_MINOR", name: "Minor Fire Alarm Fault", severity: "LOW", colorCode: "#22C55E", description: "Minor fault not affecting system operation", actionRequired: "Repair within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 10000, costEstimateHigh: 40000, displayOrder: 38, isActive: true },
    { code: "FA_FAULT", name: "Fire Alarm Fault", severity: "MEDIUM", colorCode: "#CA8A04", description: "System fault affecting coverage or function", actionRequired: "Repair within 72 hours", timeframeHours: 72, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 30000, costEstimateHigh: 100000, displayOrder: 39, isActive: true },
    { code: "FA_CRITICAL", name: "Critical Fire Alarm Failure", severity: "CRITICAL", colorCode: "#DC2626", description: "System failure - building not protected", actionRequired: "Immediate repair or fire watch", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 40, isActive: true },
    
    // ========== PLAYGROUND INSPECTION (per BS EN 1176) ==========
    { code: "PLAY_LOW", name: "Low Risk Play Equipment", severity: "LOW", colorCode: "#16A34A", description: "Low risk - minor maintenance required", actionRequired: "Routine maintenance", timeframeHours: 2160, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 41, isActive: true },
    { code: "PLAY_MEDIUM", name: "Medium Risk Play Equipment", severity: "MEDIUM", colorCode: "#CA8A04", description: "Medium risk - repair or modification needed", actionRequired: "Repair within 1 month", timeframeHours: 720, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 42, isActive: true },
    { code: "PLAY_HIGH", name: "High Risk Play Equipment", severity: "HIGH", colorCode: "#EA580C", description: "High risk - immediate closure and repair", actionRequired: "Close and repair within 7 days", timeframeHours: 168, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 43, isActive: true },
    { code: "PLAY_CRITICAL", name: "Critical Play Equipment Hazard", severity: "CRITICAL", colorCode: "#DC2626", description: "Critical hazard - immediate closure required", actionRequired: "Immediate closure and make safe", timeframeHours: 0, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 200000, costEstimateHigh: 1000000, displayOrder: 44, isActive: true },
    
    // ========== TREE SURVEY (per BS 5837) ==========
    { code: "TREE_SAFE", name: "Tree Safe - No Action", severity: "LOW", colorCode: "#16A34A", description: "Tree in good condition - no action required", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 45, isActive: true },
    { code: "TREE_ROUTINE", name: "Tree Routine Works", severity: "LOW", colorCode: "#22C55E", description: "Minor works required - crown lift, deadwood removal", actionRequired: "Works within 6 months", timeframeHours: 4380, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 20000, costEstimateHigh: 60000, displayOrder: 46, isActive: true },
    { code: "TREE_PRIORITY", name: "Tree Priority Works", severity: "MEDIUM", colorCode: "#CA8A04", description: "Priority works - crown reduction or cable bracing", actionRequired: "Works within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 150000, displayOrder: 47, isActive: true },
    { code: "TREE_URGENT", name: "Tree Urgent Works", severity: "HIGH", colorCode: "#EA580C", description: "Urgent works - significant failure risk", actionRequired: "Works within 7 days", timeframeHours: 168, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 80000, costEstimateHigh: 300000, displayOrder: 48, isActive: true },
    { code: "TREE_DANGEROUS", name: "Dangerous Tree - Fell", severity: "CRITICAL", colorCode: "#DC2626", description: "Dangerous tree requiring immediate felling", actionRequired: "Immediate felling and make safe", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 49, isActive: true },
    
    // ========== HHSRS HAZARD BANDS (per Housing Act 2004) ==========
    { code: "HHSRS_CAT1", name: "Category 1 Hazard", severity: "CRITICAL", colorCode: "#DC2626", description: "Category 1 hazard - LA enforcement action required", actionRequired: "Immediate remediation - enforcement imminent", timeframeHours: 168, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 200000, costEstimateHigh: 1500000, displayOrder: 50, isActive: true },
    { code: "HHSRS_CAT2_HIGH", name: "Category 2 Hazard (High)", severity: "HIGH", colorCode: "#EA580C", description: "High band Category 2 hazard", actionRequired: "Remediate within 3 months", timeframeHours: 2160, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 51, isActive: true },
    { code: "HHSRS_CAT2_MED", name: "Category 2 Hazard (Medium)", severity: "MEDIUM", colorCode: "#CA8A04", description: "Medium band Category 2 hazard", actionRequired: "Remediate within 6 months", timeframeHours: 4380, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 52, isActive: true },
    { code: "HHSRS_CAT2_LOW", name: "Category 2 Hazard (Low)", severity: "LOW", colorCode: "#22C55E", description: "Low band Category 2 hazard", actionRequired: "Plan remediation", timeframeHours: null, autoCreateAction: true, actionSeverity: "ADVISORY", costEstimateLow: 20000, costEstimateHigh: 100000, displayOrder: 53, isActive: true },
    
    // ========== DAMP & MOULD (per Housing Health & Safety Rating System) ==========
    { code: "DAMP_MINOR", name: "Minor Damp/Condensation", severity: "LOW", colorCode: "#22C55E", description: "Minor condensation - ventilation advice needed", actionRequired: "Tenant advice and monitoring", timeframeHours: null, autoCreateAction: false, actionSeverity: "ADVISORY", displayOrder: 54, isActive: true },
    { code: "DAMP_MODERATE", name: "Moderate Damp Issue", severity: "MEDIUM", colorCode: "#CA8A04", description: "Moderate damp requiring investigation", actionRequired: "Investigation and repair within 28 days", timeframeHours: 672, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 55, isActive: true },
    { code: "DAMP_SEVERE", name: "Severe Damp/Mould", severity: "HIGH", colorCode: "#EA580C", description: "Severe damp and mould - health risk", actionRequired: "Urgent investigation and remediation", timeframeHours: 168, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 56, isActive: true },
    { code: "DAMP_CRITICAL", name: "Critical Mould Infestation", severity: "CRITICAL", colorCode: "#DC2626", description: "Critical mould - property may be uninhabitable", actionRequired: "Immediate action - consider decant", timeframeHours: 48, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 200000, costEstimateHigh: 1000000, displayOrder: 57, isActive: true },
    
    // ========== EMERGENCY LIGHTING (per BS 5266) ==========
    { code: "EMLT_PASS", name: "Emergency Lighting Pass", severity: "LOW", colorCode: "#16A34A", description: "Emergency lighting system fully operational", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 58, isActive: true },
    { code: "EMLT_FAIL", name: "Emergency Lighting Failure", severity: "HIGH", colorCode: "#EA580C", description: "One or more emergency lights failed", actionRequired: "Replace within 72 hours", timeframeHours: 72, autoCreateAction: true, actionSeverity: "URGENT", costEstimateLow: 10000, costEstimateHigh: 50000, displayOrder: 59, isActive: true },
    { code: "EMLT_CRITICAL", name: "Critical Emergency Lighting Failure", severity: "CRITICAL", colorCode: "#DC2626", description: "Multiple failures affecting escape routes", actionRequired: "Immediate repair or temporary measures", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 30000, costEstimateHigh: 100000, displayOrder: 60, isActive: true },
    
    // ========== SPRINKLER SYSTEM (per BS EN 12845) ==========
    { code: "SPRINK_PASS", name: "Sprinkler System Pass", severity: "LOW", colorCode: "#16A34A", description: "Sprinkler system fully operational", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 61, isActive: true },
    { code: "SPRINK_DEFECT", name: "Sprinkler Defect", severity: "MEDIUM", colorCode: "#CA8A04", description: "Non-critical defect identified", actionRequired: "Repair within 72 hours", timeframeHours: 72, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 62, isActive: true },
    { code: "SPRINK_CRITICAL", name: "Sprinkler System Failure", severity: "CRITICAL", colorCode: "#DC2626", description: "System failure - no fire suppression", actionRequired: "Immediate repair or fire watch", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 100000, costEstimateHigh: 500000, displayOrder: 63, isActive: true },
    
    // ========== AOV SMOKE VENTILATION (per BS EN 12101-2) ==========
    { code: "AOV_PASS", name: "AOV System Pass", severity: "LOW", colorCode: "#16A34A", description: "AOV system fully operational", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 64, isActive: true },
    { code: "AOV_DEFECT", name: "AOV Defect", severity: "MEDIUM", colorCode: "#CA8A04", description: "AOV defect - partial function only", actionRequired: "Repair within 72 hours", timeframeHours: 72, autoCreateAction: true, actionSeverity: "ROUTINE", costEstimateLow: 30000, costEstimateHigh: 100000, displayOrder: 65, isActive: true },
    { code: "AOV_CRITICAL", name: "AOV System Failure", severity: "CRITICAL", colorCode: "#DC2626", description: "AOV system failure - no smoke ventilation", actionRequired: "Immediate repair", timeframeHours: 24, autoCreateAction: true, actionSeverity: "IMMEDIATE", costEstimateLow: 50000, costEstimateHigh: 200000, displayOrder: 66, isActive: true },
    
    // ========== GENERIC OUTCOME CODES ==========
    { code: "PASS", name: "Pass", severity: "LOW", colorCode: "#16A34A", description: "Certificate passed - no issues found", actionRequired: "None", timeframeHours: null, autoCreateAction: false, displayOrder: 90, isActive: true },
    { code: "FAIL", name: "Fail", severity: "HIGH", colorCode: "#EA580C", description: "Certificate failed - remediation required", actionRequired: "Review and remediate", timeframeHours: 672, autoCreateAction: true, actionSeverity: "URGENT", displayOrder: 91, isActive: true },
    { code: "UNSATISFACTORY", name: "Unsatisfactory", severity: "HIGH", colorCode: "#EA580C", description: "Unsatisfactory result requiring action", actionRequired: "Review findings and create action plan", timeframeHours: 672, autoCreateAction: true, actionSeverity: "URGENT", displayOrder: 92, isActive: true },
    { code: "REVIEW", name: "Review Required", severity: "MEDIUM", colorCode: "#CA8A04", description: "Manual review of certificate required", actionRequired: "Review by compliance officer", timeframeHours: 168, autoCreateAction: true, actionSeverity: "ROUTINE", displayOrder: 93, isActive: true }
  ];
  
  // Delete existing and re-insert (classification codes don't have unique constraint on code alone)
  await db.delete(classificationCodes);
  const classificationCodesWithStream = classificationCodesData.map(code => ({
    ...code,
    complianceStreamId: classificationCodeToStreamCode[code.code] ? streamCodeToId[classificationCodeToStreamCode[code.code]] : null
  }));
  await db.insert(classificationCodes).values(classificationCodesWithStream);
  console.log(`✓ Replaced ${classificationCodesData.length} classification codes with stream links`);
  
  // ==================== EXTRACTION SCHEMAS ====================
  // Comprehensive schemas for all 60+ certificate types aligned with UK social housing standards
  const extractionSchemasData = [
    // ========== GAS & HEATING SCHEMAS ==========
    {
      version: "2.0",
      documentType: "GAS",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        gasRegisterId: { type: "string", required: true },
        companyName: { type: "string", required: false },
        issueDate: { type: "date", required: true },
        expiryDate: { type: "date", required: true },
        propertyAddress: { type: "string", required: true },
        appliancesTested: { type: "array", required: true, items: { make: "string", model: "string", location: "string", result: "string" } },
        defects: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "AT_RISK", "ID", "AR", "NCS"] }
      },
      promptTemplate: "Extract CP12/LGSR gas safety certificate details including engineer Gas Safe ID, all appliances tested with make/model/location, and any defect codes (ID/AR/NCS).",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "GAS_SVC",
      schemaJson: {
        serviceDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        gasRegisterId: { type: "string", required: true },
        applianceType: { type: "string", required: true },
        applianceMake: { type: "string", required: false },
        applianceModel: { type: "string", required: false },
        serialNumber: { type: "string", required: false },
        worksCompleted: { type: "array", required: false },
        partsReplaced: { type: "array", required: false }
      },
      promptTemplate: "Extract gas servicing certificate details including appliance information and works completed.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "OIL",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        oftecRegistrationId: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        expiryDate: { type: "date", required: true },
        applianceType: { type: "string", required: true },
        combustionAnalysis: { type: "object", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "AT_RISK"] }
      },
      promptTemplate: "Extract OFTEC oil boiler service certificate including OFTEC registration, combustion analysis results, and overall status.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "OIL_TANK",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        inspectorName: { type: "string", required: true },
        tankType: { type: "string", required: true, enum: ["SINGLE_SKIN", "BUNDED", "INTEGRALLY_BUNDED"] },
        tankCapacity: { type: "number", required: false },
        condition: { type: "string", required: true, enum: ["GOOD", "FAIR", "POOR", "REPLACE"] },
        bundCondition: { type: "string", required: false },
        recommendations: { type: "array", required: false }
      },
      promptTemplate: "Extract oil tank inspection details including tank type, capacity, condition, and any recommendations.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "LPG",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        gasRegisterId: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        expiryDate: { type: "date", required: true },
        appliancesTested: { type: "array", required: true },
        tankLocation: { type: "string", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "AT_RISK"] }
      },
      promptTemplate: "Extract LPG safety certificate details including appliances tested and tank location.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "SOLID",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        hetasRegistrationId: { type: "string", required: true },
        applianceType: { type: "string", required: true },
        flueCondition: { type: "string", required: true },
        carbonMonoxideDetector: { type: "boolean", required: true },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "AT_RISK"] }
      },
      promptTemplate: "Extract solid fuel appliance inspection details including HETAS registration, flue condition, and CO detector status.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "ASHP",
      schemaJson: {
        commissioningDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        mcsRegistrationId: { type: "string", required: false },
        manufacturer: { type: "string", required: true },
        model: { type: "string", required: true },
        serialNumber: { type: "string", required: false },
        cop: { type: "number", required: false },
        refrigerantType: { type: "string", required: false },
        refrigerantCharge: { type: "number", required: false }
      },
      promptTemplate: "Extract air source heat pump commissioning certificate including MCS registration, COP, and refrigerant details.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "GSHP",
      schemaJson: {
        commissioningDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        mcsRegistrationId: { type: "string", required: false },
        manufacturer: { type: "string", required: true },
        model: { type: "string", required: true },
        boreholeDepth: { type: "number", required: false },
        groundLoopLength: { type: "number", required: false },
        cop: { type: "number", required: false }
      },
      promptTemplate: "Extract ground source heat pump commissioning certificate including ground loop details and COP.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== ELECTRICAL SCHEMAS ==========
    {
      version: "2.0",
      documentType: "EICR",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        companyName: { type: "string", required: false },
        issueDate: { type: "date", required: true },
        nextInspectionDate: { type: "date", required: true },
        propertyAddress: { type: "string", required: true },
        overallAssessment: { type: "string", required: true, enum: ["SATISFACTORY", "UNSATISFACTORY", "FURTHER_INVESTIGATION"] },
        circuitsTested: { type: "number", required: false },
        observations: { type: "array", required: false, items: { code: "string", location: "string", description: "string" } },
        c1Count: { type: "number", required: false },
        c2Count: { type: "number", required: false },
        c3Count: { type: "number", required: false },
        fiCount: { type: "number", required: false }
      },
      promptTemplate: "Extract EICR details including all observation codes (C1/C2/C3/FI), circuit information, and overall assessment.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "EIC",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        installationType: { type: "string", required: true },
        circuitsInstalled: { type: "array", required: false },
        testResults: { type: "object", required: false }
      },
      promptTemplate: "Extract Electrical Installation Certificate details for new installations.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "MEIWC",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        worksDescription: { type: "string", required: true },
        circuitsAffected: { type: "array", required: false },
        testResults: { type: "object", required: false }
      },
      promptTemplate: "Extract Minor Electrical Works Certificate details including works description and circuits affected.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "PAT",
      schemaJson: {
        testDate: { type: "date", required: true },
        testerName: { type: "string", required: true },
        itemsTested: { type: "array", required: true, items: { description: "string", location: "string", result: "string", nextTestDate: "date" } },
        passCount: { type: "number", required: false },
        failCount: { type: "number", required: false }
      },
      promptTemplate: "Extract PAT testing certificate details including all items tested with pass/fail status.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "EMLT",
      schemaJson: {
        testDate: { type: "date", required: true },
        testerName: { type: "string", required: true },
        luminairesCount: { type: "number", required: true },
        luminairesPassed: { type: "number", required: false },
        luminairesFailed: { type: "number", required: false },
        batteryConditions: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "PARTIAL"] }
      },
      promptTemplate: "Extract emergency lighting test certificate including luminaire counts and battery conditions.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== ENERGY SCHEMAS ==========
    {
      version: "2.0",
      documentType: "EPC",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        assessorName: { type: "string", required: true },
        assessorAccreditation: { type: "string", required: false },
        propertyAddress: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        currentRating: { type: "string", required: true, enum: ["A", "B", "C", "D", "E", "F", "G"] },
        currentScore: { type: "number", required: false },
        potentialRating: { type: "string", required: false },
        potentialScore: { type: "number", required: false },
        floorArea: { type: "number", required: false },
        recommendations: { type: "array", required: false, items: { measure: "string", typicalCost: "string", typicalSaving: "string" } }
      },
      promptTemplate: "Extract EPC details including current/potential ratings, scores, floor area, and improvement recommendations with costs.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "SAP",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        sapRating: { type: "number", required: true },
        derRating: { type: "number", required: false },
        targetEmissionRate: { type: "number", required: false },
        dwellingEmissionRate: { type: "number", required: false },
        complianceStatus: { type: "string", required: true, enum: ["COMPLIANT", "NON_COMPLIANT"] }
      },
      promptTemplate: "Extract SAP assessment details including SAP rating, DER, TER, and compliance status for building regulations.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== FIRE SAFETY SCHEMAS ==========
    {
      version: "2.0",
      documentType: "FRA",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        assessorQualifications: { type: "string", required: false },
        premisesAddress: { type: "string", required: true },
        premisesType: { type: "string", required: false },
        occupancyLevel: { type: "number", required: false },
        riskRating: { type: "string", required: true, enum: ["TRIVIAL", "TOLERABLE", "MODERATE", "SUBSTANTIAL", "INTOLERABLE"] },
        significantFindings: { type: "array", required: false, items: { finding: "string", priority: "string", recommendation: "string" } },
        actionPlan: { type: "array", required: false },
        nextReviewDate: { type: "date", required: true }
      },
      promptTemplate: "Extract FRA details under RRO 2005 including all significant findings, risk rating, and action plan items with priorities.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "FRAEW",
      schemaJson: {
        appraisalDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        engineerQualifications: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        buildingHeight: { type: "number", required: false },
        claddingType: { type: "string", required: false },
        ews1Rating: { type: "string", required: true, enum: ["A1", "A2", "A3", "B1", "B2"] },
        remediationRequired: { type: "boolean", required: false },
        findings: { type: "array", required: false }
      },
      promptTemplate: "Extract FRAEW/EWS1 appraisal details including cladding assessment, EWS1 rating, and remediation requirements.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "FD",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        inspectorName: { type: "string", required: true },
        doorsInspected: { type: "number", required: true },
        doorsPassed: { type: "number", required: false },
        doorsFailed: { type: "number", required: false },
        defects: { type: "array", required: false, items: { doorLocation: "string", defectType: "string", priority: "string" } },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "PARTIAL"] }
      },
      promptTemplate: "Extract fire door inspection details including all doors inspected with defects and priorities.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "FA",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        systemType: { type: "string", required: true, enum: ["L1", "L2", "L3", "L4", "L5", "P1", "P2", "M"] },
        panelLocation: { type: "string", required: false },
        zonesCount: { type: "number", required: false },
        devicesCount: { type: "number", required: false },
        defects: { type: "array", required: false },
        nextInspectionDate: { type: "date", required: true },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "PARTIAL"] }
      },
      promptTemplate: "Extract fire alarm system certificate under BS 5839 including system category, zones, devices, and defects.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "SD",
      schemaJson: {
        testDate: { type: "date", required: true },
        testerName: { type: "string", required: true },
        detectorsCount: { type: "number", required: true },
        detectorsPassed: { type: "number", required: false },
        detectorsFailed: { type: "number", required: false },
        replacementsRequired: { type: "array", required: false }
      },
      promptTemplate: "Extract smoke detector test certificate including detector counts and any replacements needed.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "CO",
      schemaJson: {
        testDate: { type: "date", required: true },
        testerName: { type: "string", required: true },
        detectorsCount: { type: "number", required: true },
        detectorLocations: { type: "array", required: false },
        detectorsPassed: { type: "number", required: false },
        detectorsFailed: { type: "number", required: false }
      },
      promptTemplate: "Extract CO detector test certificate including locations and test results.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "SPRINK",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        systemType: { type: "string", required: true },
        headsCount: { type: "number", required: false },
        tankCapacity: { type: "number", required: false },
        pumpTest: { type: "object", required: false },
        defects: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "PARTIAL"] }
      },
      promptTemplate: "Extract sprinkler system inspection by LPCB contractor including pump test results and any defects.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "AOV",
      schemaJson: {
        testDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        systemType: { type: "string", required: true, enum: ["NATURAL", "MECHANICAL", "COMBINED"] },
        ventCount: { type: "number", required: false },
        operationTime: { type: "number", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL"] }
      },
      promptTemplate: "Extract AOV smoke ventilation system test including operation times and test results.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "EXT",
      schemaJson: {
        serviceDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        extinguishersCount: { type: "number", required: true },
        extinguisherDetails: { type: "array", required: false, items: { location: "string", type: "string", rating: "string", nextServiceDate: "date" } },
        extinguishersPassed: { type: "number", required: false },
        extinguishersFailed: { type: "number", required: false }
      },
      promptTemplate: "Extract fire extinguisher service certificate by BAFE contractor including all extinguisher types and locations.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "COMPART",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        surveyorName: { type: "string", required: true },
        areasInspected: { type: "array", required: true },
        breaches: { type: "array", required: false, items: { location: "string", type: "string", severity: "string" } },
        overallStatus: { type: "string", required: true, enum: ["SATISFACTORY", "UNSATISFACTORY", "REQUIRES_REMEDIATION"] }
      },
      promptTemplate: "Extract compartmentation survey details including all breaches found with locations and severity.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== ASBESTOS SCHEMAS ==========
    {
      version: "2.0",
      documentType: "ASB",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        surveyorName: { type: "string", required: true },
        surveyorQualifications: { type: "string", required: false },
        ukasAccreditationNumber: { type: "string", required: false },
        premisesAddress: { type: "string", required: true },
        surveyType: { type: "string", required: true, enum: ["MANAGEMENT", "REFURBISHMENT", "DEMOLITION"] },
        acmsIdentified: { type: "array", required: false, items: { location: "string", material: "string", condition: "string", riskScore: "number", recommendation: "string" } },
        totalAcmCount: { type: "number", required: false },
        priorityActions: { type: "array", required: false }
      },
      promptTemplate: "Extract asbestos survey under CAR 2012 including all ACMs with locations, conditions, risk scores, and management recommendations.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "ASB_M",
      schemaJson: {
        reviewDate: { type: "date", required: true },
        reviewerName: { type: "string", required: true },
        acmsCount: { type: "number", required: true },
        acmsConditionChanges: { type: "array", required: false },
        actionsCompleted: { type: "array", required: false },
        actionsOutstanding: { type: "array", required: false },
        nextReviewDate: { type: "date", required: true }
      },
      promptTemplate: "Extract asbestos management plan review including ACM status changes and outstanding actions.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "ASB_R",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        inspectorName: { type: "string", required: true },
        acmsInspected: { type: "number", required: true },
        conditionChanges: { type: "array", required: false },
        actionRequired: { type: "boolean", required: true },
        nextInspectionDate: { type: "date", required: true }
      },
      promptTemplate: "Extract asbestos reinspection details including any condition changes requiring action.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== WATER SAFETY SCHEMAS ==========
    {
      version: "2.0",
      documentType: "LEG",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        riskLevel: { type: "string", required: true, enum: ["LOW", "MEDIUM", "HIGH"] },
        waterSystemsAssessed: { type: "array", required: false, items: { system: "string", riskLevel: "string", controlMeasures: "array" } },
        deadLegsIdentified: { type: "array", required: false },
        temperatureFindings: { type: "object", required: false },
        controlMeasures: { type: "array", required: false },
        nextAssessmentDate: { type: "date", required: true }
      },
      promptTemplate: "Extract legionella risk assessment under HSE ACOP L8 including all water systems, temperature findings, and control measures.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "LEG_M",
      schemaJson: {
        monitoringDate: { type: "date", required: true },
        monitorName: { type: "string", required: true },
        hotWaterTemperatures: { type: "array", required: false, items: { outlet: "string", temperature: "number", compliant: "boolean" } },
        coldWaterTemperatures: { type: "array", required: false, items: { outlet: "string", temperature: "number", compliant: "boolean" } },
        showerHeadsFlushed: { type: "number", required: false },
        issues: { type: "array", required: false }
      },
      promptTemplate: "Extract monthly legionella monitoring including all temperature readings and compliance status.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "TMV",
      schemaJson: {
        serviceDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        valvesServiced: { type: "number", required: true },
        valveDetails: { type: "array", required: false, items: { location: "string", mixedTemperature: "number", result: "string" } },
        failedValves: { type: "number", required: false }
      },
      promptTemplate: "Extract TMV service certificate including all valve locations and mixed temperatures.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== LIFTING EQUIPMENT SCHEMAS ==========
    {
      version: "2.0",
      documentType: "LIFT",
      schemaJson: {
        examinationDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        competentPersonOrg: { type: "string", required: false },
        liftId: { type: "string", required: true },
        liftType: { type: "string", required: false },
        safeWorkingLoad: { type: "number", required: false },
        safeForUse: { type: "boolean", required: true },
        defectsFound: { type: "array", required: false, items: { defect: "string", severity: "string", action: "string" } },
        nextExaminationDate: { type: "date", required: true }
      },
      promptTemplate: "Extract LOLER lift examination including SWL, all defects with severity ratings, and next examination date.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "STAIR",
      schemaJson: {
        examinationDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        equipmentId: { type: "string", required: true },
        manufacturer: { type: "string", required: false },
        safeWorkingLoad: { type: "number", required: false },
        safeForUse: { type: "boolean", required: true },
        defectsFound: { type: "array", required: false },
        nextExaminationDate: { type: "date", required: true }
      },
      promptTemplate: "Extract stairlift LOLER examination details including defects and next examination date.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "HOIST",
      schemaJson: {
        examinationDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        equipmentId: { type: "string", required: true },
        hoistType: { type: "string", required: true, enum: ["CEILING", "MOBILE", "BATH", "STANDING"] },
        safeWorkingLoad: { type: "number", required: true },
        slingCondition: { type: "string", required: false },
        safeForUse: { type: "boolean", required: true },
        defectsFound: { type: "array", required: false },
        nextExaminationDate: { type: "date", required: true }
      },
      promptTemplate: "Extract hoist LOLER examination including hoist type, SWL, sling condition, and defects.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== BUILDING SAFETY SCHEMAS ==========
    {
      version: "2.0",
      documentType: "HHSRS",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        propertyAddress: { type: "string", required: true },
        hazardsIdentified: { type: "array", required: false, items: { hazard: "string", band: "string", score: "number", action: "string" } },
        category1Hazards: { type: "number", required: false },
        category2Hazards: { type: "number", required: false },
        enforcementAction: { type: "string", required: false }
      },
      promptTemplate: "Extract HHSRS assessment including all hazards with bands, scores, and any enforcement action.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "STRUCT",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        engineerQualifications: { type: "string", required: false },
        structuralElements: { type: "array", required: false, items: { element: "string", condition: "string", urgency: "string" } },
        overallCondition: { type: "string", required: true, enum: ["GOOD", "FAIR", "POOR", "CRITICAL"] },
        recommendations: { type: "array", required: false }
      },
      promptTemplate: "Extract structural survey including all elements assessed with conditions and urgency ratings.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "DAMP",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        surveyorName: { type: "string", required: true },
        dampType: { type: "string", required: true, enum: ["RISING", "PENETRATING", "CONDENSATION", "MIXED"] },
        affectedAreas: { type: "array", required: true },
        moistureReadings: { type: "array", required: false },
        mouldPresent: { type: "boolean", required: true },
        mouldType: { type: "string", required: false },
        recommendations: { type: "array", required: true }
      },
      promptTemplate: "Extract damp and mould survey including damp type, affected areas, moisture readings, and remediation recommendations.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== EXTERNAL AREAS SCHEMAS ==========
    {
      version: "2.0",
      documentType: "PLAY",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        inspectorName: { type: "string", required: true },
        inspectorQualifications: { type: "string", required: false },
        equipmentInspected: { type: "array", required: true, items: { equipment: "string", condition: "string", riskLevel: "string" } },
        surfaceCondition: { type: "string", required: false },
        defects: { type: "array", required: false },
        overallRisk: { type: "string", required: true, enum: ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] }
      },
      promptTemplate: "Extract playground inspection under BS EN 1176 including all equipment with conditions and risk levels.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "TREE",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        arboristName: { type: "string", required: true },
        arboristQualifications: { type: "string", required: false },
        treesSurveyed: { type: "number", required: true },
        treesRequiringWork: { type: "number", required: false },
        treeDetails: { type: "array", required: false, items: { species: "string", location: "string", condition: "string", recommendation: "string", priority: "string" } },
        urgentWorks: { type: "array", required: false }
      },
      promptTemplate: "Extract tree survey including all trees with species, conditions, and work recommendations with priorities.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== SECURITY SCHEMAS ==========
    {
      version: "2.0",
      documentType: "CCTV",
      schemaJson: {
        serviceDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        camerasCount: { type: "number", required: true },
        camerasOperational: { type: "number", required: false },
        recorderStatus: { type: "string", required: false },
        retentionPeriod: { type: "number", required: false },
        defects: { type: "array", required: false }
      },
      promptTemplate: "Extract CCTV service certificate including camera counts, recorder status, and any defects.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "ENTRY",
      schemaJson: {
        serviceDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        systemType: { type: "string", required: true, enum: ["AUDIO", "VIDEO", "ACCESS_CONTROL", "COMBINED"] },
        doorsControlled: { type: "number", required: false },
        fobsIssued: { type: "number", required: false },
        defects: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "PARTIAL"] }
      },
      promptTemplate: "Extract door entry system service certificate including system type, doors controlled, and fobs issued.",
      isActive: true,
      isDeprecated: false
    },
    
    // ========== HRB SPECIFIC SCHEMAS ==========
    {
      version: "2.0",
      documentType: "SIB",
      schemaJson: {
        inspectionDate: { type: "date", required: true },
        inspectorName: { type: "string", required: true },
        boxLocation: { type: "string", required: true },
        contentsVerified: { type: "boolean", required: true },
        contentsPresent: { type: "array", required: false, items: { item: "string", current: "boolean" } },
        contentsMissing: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["COMPLIANT", "NON_COMPLIANT"] }
      },
      promptTemplate: "Extract secure information box inspection under Building Safety Act including contents verification.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "SC",
      schemaJson: {
        reviewDate: { type: "date", required: true },
        reviewerName: { type: "string", required: true },
        buildingId: { type: "string", required: true },
        principalAccountablePersonId: { type: "string", required: false },
        safetyRisks: { type: "array", required: false },
        controlMeasures: { type: "array", required: false },
        residentEngagementStatus: { type: "string", required: false },
        caseStatus: { type: "string", required: true, enum: ["CURRENT", "UNDER_REVIEW", "REQUIRES_UPDATE"] }
      },
      promptTemplate: "Extract Building Safety Case review under BSA 2022 including safety risks and control measures.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "PEEP",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        residentName: { type: "string", required: true },
        propertyAddress: { type: "string", required: true },
        mobilityNeeds: { type: "array", required: false },
        evacuationMethod: { type: "string", required: true },
        equipmentRequired: { type: "array", required: false },
        refugeLocation: { type: "string", required: false },
        reviewDate: { type: "date", required: true }
      },
      promptTemplate: "Extract PEEP assessment including mobility needs, evacuation method, equipment required, and refuge location.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "BEEP",
      schemaJson: {
        reviewDate: { type: "date", required: true },
        reviewerName: { type: "string", required: true },
        buildingAddress: { type: "string", required: true },
        evacuationStrategy: { type: "string", required: true, enum: ["SIMULTANEOUS", "PHASED", "PROGRESSIVE", "DEFEND_IN_PLACE"] },
        assemblyPoints: { type: "array", required: false },
        peepCount: { type: "number", required: false },
        fireMarshalCount: { type: "number", required: false },
        planStatus: { type: "string", required: true, enum: ["CURRENT", "UNDER_REVIEW", "REQUIRES_UPDATE"] }
      },
      promptTemplate: "Extract BEEP review including evacuation strategy, assembly points, and fire marshal arrangements.",
      isActive: true,
      isDeprecated: false
    }
  ];
  
  // Delete existing and re-insert extraction schemas with stream links
  await db.delete(extractionSchemas);
  const extractionSchemasWithStream = extractionSchemasData.map(schema => ({
    ...schema,
    complianceStreamId: documentTypeToStreamCode[schema.documentType] ? streamCodeToId[documentTypeToStreamCode[schema.documentType]] : null
  }));
  await db.insert(extractionSchemas).values(extractionSchemasWithStream);
  console.log(`✓ Replaced ${extractionSchemasData.length} extraction schemas with stream links`);
  
  // ==================== COMPONENT TYPES ====================
  const componentTypesData: Array<{
    code: string;
    name: string;
    category: "HEATING" | "ELECTRICAL" | "FIRE_SAFETY" | "WATER" | "STRUCTURE" | "ACCESS" | "VENTILATION" | "SECURITY" | "EXTERNAL" | "OTHER";
    description: string;
    hactElementCode: string | null;
    expectedLifespanYears: number | null;
    relatedCertificateTypes: string[];
    inspectionFrequencyMonths: number | null;
    isHighRisk: boolean;
    buildingSafetyRelevant: boolean;
    displayOrder: number;
    isActive: boolean;
  }> = [
    // Heating Components
    { code: "GAS_BOILER", name: "Gas Boiler", category: "HEATING", description: "Central heating gas boiler", hactElementCode: "HEAT-001", expectedLifespanYears: 15, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 1, isActive: true },
    { code: "GAS_FIRE", name: "Gas Fire", category: "HEATING", description: "Gas fire appliance", hactElementCode: "HEAT-002", expectedLifespanYears: 20, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 2, isActive: true },
    { code: "GAS_COOKER", name: "Gas Cooker", category: "HEATING", description: "Gas cooking appliance", hactElementCode: "HEAT-003", expectedLifespanYears: 15, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 3, isActive: true },
    { code: "GAS_WATER_HEATER", name: "Gas Water Heater", category: "HEATING", description: "Instantaneous or storage gas water heater", hactElementCode: "HEAT-004", expectedLifespanYears: 12, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: false, displayOrder: 4, isActive: true },
    { code: "RADIATOR", name: "Radiator", category: "HEATING", description: "Central heating radiator", hactElementCode: "HEAT-005", expectedLifespanYears: 25, relatedCertificateTypes: [], inspectionFrequencyMonths: null, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 5, isActive: true },
    
    // Electrical Components
    { code: "CONSUMER_UNIT", name: "Consumer Unit", category: "ELECTRICAL", description: "Main electrical distribution board", hactElementCode: "ELEC-001", expectedLifespanYears: 25, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 10, isActive: true },
    { code: "WIRING", name: "Electrical Wiring", category: "ELECTRICAL", description: "Fixed electrical wiring installation", hactElementCode: "ELEC-002", expectedLifespanYears: 40, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 11, isActive: true },
    { code: "SOCKET_OUTLET", name: "Socket Outlet", category: "ELECTRICAL", description: "Electrical socket outlet", hactElementCode: "ELEC-003", expectedLifespanYears: 25, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 12, isActive: true },
    { code: "LIGHT_FITTING", name: "Light Fitting", category: "ELECTRICAL", description: "Fixed light fitting", hactElementCode: "ELEC-004", expectedLifespanYears: 15, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 13, isActive: true },
    
    // Fire Safety Components
    { code: "SMOKE_ALARM", name: "Smoke Alarm", category: "FIRE_SAFETY", description: "Smoke detection device", hactElementCode: "FIRE-001", expectedLifespanYears: 10, relatedCertificateTypes: ["FIRE_RISK"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 20, isActive: true },
    { code: "HEAT_DETECTOR", name: "Heat Detector", category: "FIRE_SAFETY", description: "Heat detection device", hactElementCode: "FIRE-002", expectedLifespanYears: 10, relatedCertificateTypes: ["FIRE_RISK", "FIRE_ALARM"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 21, isActive: true },
    { code: "CO_ALARM", name: "Carbon Monoxide Alarm", category: "FIRE_SAFETY", description: "CO detection device", hactElementCode: "FIRE-003", expectedLifespanYears: 7, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 22, isActive: true },
    { code: "FIRE_DOOR", name: "Fire Door", category: "FIRE_SAFETY", description: "Fire-rated door assembly", hactElementCode: "FIRE-004", expectedLifespanYears: 30, relatedCertificateTypes: ["FIRE_RISK"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 23, isActive: true },
    { code: "FIRE_EXTINGUISHER", name: "Fire Extinguisher", category: "FIRE_SAFETY", description: "Portable fire extinguisher", hactElementCode: "FIRE-005", expectedLifespanYears: 10, relatedCertificateTypes: ["FIRE_RISK"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 24, isActive: true },
    { code: "EMERGENCY_LIGHT", name: "Emergency Light", category: "FIRE_SAFETY", description: "Emergency lighting unit", hactElementCode: "FIRE-006", expectedLifespanYears: 10, relatedCertificateTypes: ["EMERGENCY_LIGHTING"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 25, isActive: true },
    { code: "FIRE_ALARM_PANEL", name: "Fire Alarm Panel", category: "FIRE_SAFETY", description: "Fire alarm control panel", hactElementCode: "FIRE-007", expectedLifespanYears: 15, relatedCertificateTypes: ["FIRE_ALARM"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 26, isActive: true },
    
    // Water Components
    { code: "WATER_TANK", name: "Water Storage Tank", category: "WATER", description: "Cold water storage tank", hactElementCode: "WATER-001", expectedLifespanYears: 25, relatedCertificateTypes: ["LEGIONELLA"], inspectionFrequencyMonths: 24, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 30, isActive: true },
    { code: "HOT_WATER_CYLINDER", name: "Hot Water Cylinder", category: "WATER", description: "Hot water storage cylinder", hactElementCode: "WATER-002", expectedLifespanYears: 15, relatedCertificateTypes: ["LEGIONELLA"], inspectionFrequencyMonths: 24, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 31, isActive: true },
    
    // Access Components
    { code: "LIFT", name: "Passenger Lift", category: "ACCESS", description: "Passenger lift installation", hactElementCode: "ACCESS-001", expectedLifespanYears: 25, relatedCertificateTypes: ["LIFT_LOLER"], inspectionFrequencyMonths: 6, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 40, isActive: true },
    { code: "STAIRLIFT", name: "Stairlift", category: "ACCESS", description: "Domestic stairlift", hactElementCode: "ACCESS-002", expectedLifespanYears: 15, relatedCertificateTypes: ["LIFT_LOLER"], inspectionFrequencyMonths: 6, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 41, isActive: true },
    
    // Ventilation Components
    { code: "EXTRACTOR_FAN", name: "Extractor Fan", category: "VENTILATION", description: "Mechanical extract ventilation", hactElementCode: "VENT-001", expectedLifespanYears: 15, relatedCertificateTypes: [], inspectionFrequencyMonths: null, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 50, isActive: true },
    { code: "MVHR_UNIT", name: "MVHR Unit", category: "VENTILATION", description: "Mechanical ventilation with heat recovery", hactElementCode: "VENT-002", expectedLifespanYears: 15, relatedCertificateTypes: [], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 51, isActive: true },
    
    // Structural Components (for asbestos tracking)
    { code: "ASBESTOS_ACM", name: "Asbestos Containing Material", category: "STRUCTURE", description: "Known or presumed ACM location", hactElementCode: "STRUCT-001", expectedLifespanYears: null, relatedCertificateTypes: ["ASBESTOS"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 60, isActive: true }
  ];
  
  for (const compType of componentTypesData) {
    await db.insert(componentTypes).values(compType)
      .onConflictDoUpdate({
        target: componentTypes.code,
        set: {
          name: compType.name,
          category: compType.category,
          description: compType.description,
          hactElementCode: compType.hactElementCode,
          expectedLifespanYears: compType.expectedLifespanYears,
          relatedCertificateTypes: compType.relatedCertificateTypes,
          inspectionFrequencyMonths: compType.inspectionFrequencyMonths,
          isHighRisk: compType.isHighRisk,
          buildingSafetyRelevant: compType.buildingSafetyRelevant,
          displayOrder: compType.displayOrder,
          isActive: compType.isActive,
          updatedAt: new Date()
        }
      });
  }
  console.log(`✓ Upserted ${componentTypesData.length} component types`);
  
  // ==================== COMPLIANCE RULES ====================
  // Comprehensive domain validation rules for all certificate types aligned with UK regulations
  const complianceRulesData = [
    // ========== GAS & HEATING RULES ==========
    { ruleCode: "GAS_ANNUAL_CHECK", ruleName: "Gas Safety Annual Check Required", documentType: "GAS", description: "Properties with gas supply must have annual CP12/LGSR under Gas Safety Regulations 1998", legislation: "Gas Safety (Installation and Use) Regulations 1998", conditions: [{ field: "hasGas", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "GAS_ID_IMMEDIATE", ruleName: "Immediately Dangerous - Disconnect", documentType: "GAS", description: "ID classification requires immediate gas isolation", legislation: "Gas Safety (Installation and Use) Regulations 1998", conditions: [{ field: "defectCode", operator: "equals", value: "ID" }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "GAS_AR_28DAY", ruleName: "At Risk - 28 Day Repair", documentType: "GAS", description: "AR classification requires repair within 28 days", legislation: "Gas Safety (Installation and Use) Regulations 1998", conditions: [{ field: "defectCode", operator: "equals", value: "AR" }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "GAS_NCS_REMEDIATE", ruleName: "Not to Current Standard", documentType: "GAS", description: "NCS defects should be remediated at next service", legislation: "Gas Safety (Installation and Use) Regulations 1998", conditions: [{ field: "defectCode", operator: "equals", value: "NCS" }], conditionLogic: "AND", action: "INFO", priority: "P3", isActive: true },
    { ruleCode: "OIL_ANNUAL_SERVICE", ruleName: "Oil Boiler Annual Service", documentType: "OIL", description: "Oil boilers require annual servicing by OFTEC engineer", legislation: "Building Regulations Part J", conditions: [{ field: "hasOilHeating", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "LPG_ANNUAL_CHECK", ruleName: "LPG Safety Annual Check", documentType: "LPG", description: "LPG installations require annual safety check", legislation: "Gas Safety (Installation and Use) Regulations 1998", conditions: [{ field: "hasLPG", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "SOLID_FUEL_SWEEP", ruleName: "Solid Fuel Annual Sweep", documentType: "SOLID", description: "Solid fuel appliances require annual chimney sweep and inspection", legislation: "Building Regulations Part J", conditions: [{ field: "hasSolidFuel", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    
    // ========== ELECTRICAL RULES ==========
    { ruleCode: "EICR_5YEAR_CHECK", ruleName: "EICR 5-Year Inspection", documentType: "EICR", description: "Electrical installations must be inspected every 5 years in rented properties", legislation: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020", conditions: [{ field: "expiryDays", operator: "less_than", value: 90 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "EICR_C1_IMMEDIATE", ruleName: "C1 - Danger Present", documentType: "EICR", description: "C1 classification indicates immediate danger requiring urgent action", legislation: "BS 7671:2018", conditions: [{ field: "c1Count", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "EICR_C2_28DAY", ruleName: "C2 - Potentially Dangerous", documentType: "EICR", description: "C2 classification requires remediation within 28 days", legislation: "BS 7671:2018", conditions: [{ field: "c2Count", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "EICR_C3_RECOMMEND", ruleName: "C3 - Improvement Recommended", documentType: "EICR", description: "C3 observations should be considered for improvement", legislation: "BS 7671:2018", conditions: [{ field: "c3Count", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "INFO", priority: "P3", isActive: true },
    { ruleCode: "EICR_UNSAT_FAIL", ruleName: "EICR Unsatisfactory - Auto Fail", documentType: "EICR", description: "Unsatisfactory EICR requires immediate remedial action", legislation: "Electrical Safety Standards Regulations 2020", conditions: [{ field: "overallAssessment", operator: "equals", value: "UNSATISFACTORY" }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "PAT_ANNUAL_COMMUNAL", ruleName: "PAT Testing Communal Areas", documentType: "PAT", description: "Portable appliances in communal areas require annual testing", legislation: "Electricity at Work Regulations 1989", conditions: [{ field: "isCommunal", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P3", isActive: true },
    { ruleCode: "EMLT_ANNUAL_TEST", ruleName: "Emergency Lighting Annual Test", documentType: "EMLT", description: "Emergency lighting requires annual 3-hour duration test", legislation: "BS 5266-1", conditions: [{ field: "hasCommunalAreas", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    
    // ========== ENERGY RULES ==========
    { ruleCode: "EPC_E_MINIMUM", ruleName: "EPC E Minimum for Rental", documentType: "EPC", description: "Rental properties must have minimum EPC rating E", legislation: "Energy Efficiency (Private Rented Property) Regulations 2015", conditions: [{ field: "currentRating", operator: "in", value: ["F", "G"] }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "EPC_C_TARGET_2025", ruleName: "EPC C Target by 2025", documentType: "EPC", description: "New tenancies require EPC C from 2025 (proposed)", legislation: "Proposed legislation", conditions: [{ field: "currentRating", operator: "in", value: ["D", "E"] }], conditionLogic: "AND", action: "INFO", priority: "P3", isActive: true },
    { ruleCode: "EPC_10YEAR_VALIDITY", ruleName: "EPC 10-Year Validity", documentType: "EPC", description: "EPCs are valid for 10 years", legislation: "Energy Performance of Buildings Regulations", conditions: [{ field: "expiryDays", operator: "less_than", value: 180 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P3", isActive: true },
    
    // ========== FIRE SAFETY RULES ==========
    { ruleCode: "FRA_ANNUAL_REVIEW", ruleName: "Fire Risk Assessment Annual Review", documentType: "FRA", description: "Fire risk assessments should be reviewed annually or after significant changes", legislation: "Regulatory Reform (Fire Safety) Order 2005", conditions: [{ field: "expiryDays", operator: "less_than", value: 60 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "FRA_SUBSTANTIAL_FAIL", ruleName: "FRA Substantial/Intolerable Risk", documentType: "FRA", description: "Substantial or intolerable fire risk requires immediate action", legislation: "Regulatory Reform (Fire Safety) Order 2005", conditions: [{ field: "riskRating", operator: "in", value: ["SUBSTANTIAL", "INTOLERABLE"] }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "FD_QUARTERLY_HRB", ruleName: "Fire Door Quarterly Inspection - HRBs", documentType: "FD_Q", description: "High-rise buildings require quarterly fire door inspections", legislation: "Fire Safety (England) Regulations 2022", conditions: [{ field: "buildingHeight", operator: "greater_than", value: 18 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "FD_ANNUAL_ALL", ruleName: "Fire Door Annual Inspection", documentType: "FD", description: "All fire doors require annual inspection", legislation: "Fire Safety (England) Regulations 2022", conditions: [{ field: "hasFireDoors", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "FA_ANNUAL_SERVICE", ruleName: "Fire Alarm Annual Service", documentType: "FA", description: "Fire alarm systems require annual service under BS 5839", legislation: "BS 5839-1", conditions: [{ field: "hasFireAlarm", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "FA_WEEKLY_TEST", ruleName: "Fire Alarm Weekly Test", documentType: "FA_W", description: "Fire alarm call points require weekly testing", legislation: "BS 5839-1", conditions: [{ field: "hasFireAlarm", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "SD_ANNUAL_TEST", ruleName: "Smoke Detector Annual Test", documentType: "SD", description: "Smoke detectors require annual testing and 10-year replacement", legislation: "Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022", conditions: [{ field: "hasSmokeDetectors", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "CO_ANNUAL_TEST", ruleName: "CO Detector Annual Test", documentType: "CO", description: "CO detectors required in all properties with combustion appliances", legislation: "Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022", conditions: [{ field: "hasCombustionAppliance", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "SPRINK_ANNUAL_LPCB", ruleName: "Sprinkler Annual Inspection", documentType: "SPRINK", description: "Sprinkler systems require annual inspection by LPCB contractor", legislation: "BS EN 12845", conditions: [{ field: "hasSprinklers", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "AOV_WEEKLY_TEST", ruleName: "AOV Weekly Function Test", documentType: "AOV", description: "AOV smoke ventilation requires weekly function testing", legislation: "BS EN 12101-2", conditions: [{ field: "hasAOV", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "EXT_ANNUAL_SERVICE", ruleName: "Fire Extinguisher Annual Service", documentType: "EXT", description: "Fire extinguishers require annual service by BAFE contractor", legislation: "BS 5306-3", conditions: [{ field: "hasExtinguishers", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "FRAEW_HRB_REQUIRED", ruleName: "FRAEW/EWS1 Required for HRBs", documentType: "FRAEW", description: "Buildings over 18m require external wall fire risk appraisal", legislation: "Building Safety Act 2022", conditions: [{ field: "buildingHeight", operator: "greater_than", value: 18 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    
    // ========== ASBESTOS RULES ==========
    { ruleCode: "ASB_MANAGEMENT_PLAN", ruleName: "Asbestos Management Plan Required", documentType: "ASB", description: "Buildings with ACMs must have management plan under CAR 2012", legislation: "Control of Asbestos Regulations 2012", conditions: [{ field: "hasAsbestos", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "ASB_ANNUAL_REINSPECT", ruleName: "ACM Annual Reinspection", documentType: "ASB_R", description: "ACMs require annual condition reinspection", legislation: "Control of Asbestos Regulations 2012", conditions: [{ field: "acmCount", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "ASB_HIGH_RISK_ACTION", ruleName: "High Risk ACM - Immediate Action", documentType: "ASB", description: "High-risk ACMs require immediate management action", legislation: "Control of Asbestos Regulations 2012", conditions: [{ field: "riskScore", operator: "greater_than", value: 10 }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    
    // ========== WATER SAFETY RULES ==========
    { ruleCode: "LEG_2YEAR_ASSESSMENT", ruleName: "Legionella Risk Assessment 2-Year", documentType: "LEG", description: "Legionella risk assessment required every 2 years under ACOP L8", legislation: "HSE ACOP L8", conditions: [{ field: "expiryDays", operator: "less_than", value: 90 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "LEG_MONTHLY_MONITOR", ruleName: "Legionella Monthly Monitoring", documentType: "LEG_M", description: "Monthly temperature monitoring required for water systems", legislation: "HSE ACOP L8", conditions: [{ field: "lastMonitoringDays", operator: "greater_than", value: 35 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "LEG_TEMP_COMPLIANCE", ruleName: "Water Temperature Compliance", documentType: "LEG_M", description: "Hot water must be stored at 60°C, delivered at 50°C within 1 minute", legislation: "HSE ACOP L8", conditions: [{ field: "temperatureNonCompliant", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "TMV_ANNUAL_SERVICE", ruleName: "TMV Annual Service", documentType: "TMV", description: "Thermostatic mixing valves require annual servicing", legislation: "HSE ACOP L8", conditions: [{ field: "hasTMVs", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    
    // ========== LIFTING EQUIPMENT RULES ==========
    { ruleCode: "LIFT_6MONTH_LOLER", ruleName: "Lift 6-Monthly LOLER Examination", documentType: "LIFT", description: "Passenger lifts require thorough examination every 6 months", legislation: "LOLER 1998", conditions: [{ field: "hasLift", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "LIFT_MONTHLY_MAINT", ruleName: "Lift Monthly Maintenance", documentType: "LIFT_M", description: "Lifts require monthly maintenance visits", legislation: "LOLER 1998", conditions: [{ field: "hasLift", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "LIFT_DEFECT_ISOLATE", ruleName: "Dangerous Lift Defect - Isolate", documentType: "LIFT", description: "Dangerous lift defects require immediate isolation", legislation: "LOLER 1998", conditions: [{ field: "safeForUse", operator: "equals", value: false }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "STAIR_6MONTH_LOLER", ruleName: "Stairlift 6-Monthly LOLER", documentType: "STAIR", description: "Stairlifts require thorough examination every 6 months", legislation: "LOLER 1998", conditions: [{ field: "hasStairlift", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "HOIST_6MONTH_LOLER", ruleName: "Hoist 6-Monthly LOLER", documentType: "HOIST", description: "Ceiling and mobile hoists require 6-monthly examination", legislation: "LOLER 1998", conditions: [{ field: "hasHoist", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    
    // ========== BUILDING SAFETY RULES ==========
    { ruleCode: "HHSRS_CAT1_ACTION", ruleName: "HHSRS Category 1 Hazard", documentType: "HHSRS", description: "Category 1 hazards require local authority enforcement action", legislation: "Housing Act 2004", conditions: [{ field: "category1Hazards", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "DAMP_MOULD_ACTION", ruleName: "Damp & Mould - Urgent Response", documentType: "DAMP", description: "Damp and mould issues require urgent investigation and remediation", legislation: "Housing Health and Safety Rating System", conditions: [{ field: "mouldPresent", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "STRUCT_5YEAR_SURVEY", ruleName: "Structural Survey 5-Year Cycle", documentType: "STRUCT", description: "Structural surveys recommended on 5-year cycle", legislation: "Building Safety Act 2022", conditions: [{ field: "expiryDays", operator: "less_than", value: 180 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    
    // ========== EXTERNAL AREAS RULES ==========
    { ruleCode: "PLAY_ANNUAL_BSEN1176", ruleName: "Playground Annual Inspection", documentType: "PLAY", description: "Playgrounds require annual main inspection under BS EN 1176", legislation: "BS EN 1176", conditions: [{ field: "hasPlayground", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "PLAY_HIGH_RISK_CLOSE", ruleName: "High Risk Equipment - Close Immediately", documentType: "PLAY", description: "High/very high risk playground equipment must be closed", legislation: "BS EN 1176", conditions: [{ field: "overallRisk", operator: "in", value: ["HIGH", "VERY_HIGH"] }], conditionLogic: "AND", action: "AUTO_FAIL", priority: "P1", isActive: true },
    { ruleCode: "TREE_URGENT_WORKS", ruleName: "Tree Urgent Works Required", documentType: "TREE", description: "Trees requiring urgent works must be addressed within 7 days", legislation: "Occupiers Liability Act", conditions: [{ field: "urgentWorksCount", operator: "greater_than", value: 0 }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    
    // ========== HRB SPECIFIC RULES ==========
    { ruleCode: "SIB_ANNUAL_HRB", ruleName: "Secure Info Box Annual Inspection", documentType: "SIB", description: "HRBs require annual secure information box inspection", legislation: "Building Safety Act 2022", conditions: [{ field: "isHRB", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "SC_2YEAR_REVIEW", ruleName: "Building Safety Case 2-Year Review", documentType: "SC", description: "Building Safety Cases require review every 2 years", legislation: "Building Safety Act 2022", conditions: [{ field: "isHRB", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P1", isActive: true },
    { ruleCode: "PEEP_ANNUAL_REVIEW", ruleName: "PEEP Annual Review", documentType: "PEEP", description: "Personal Emergency Evacuation Plans require annual review", legislation: "Building Safety Act 2022", conditions: [{ field: "hasVulnerableOccupants", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true },
    { ruleCode: "BEEP_ANNUAL_REVIEW", ruleName: "BEEP Annual Review", documentType: "BEEP", description: "Building Emergency Evacuation Plans require annual review", legislation: "Regulatory Reform (Fire Safety) Order 2005", conditions: [{ field: "hasCommunalAreas", operator: "equals", value: true }], conditionLogic: "AND", action: "FLAG_URGENT", priority: "P2", isActive: true }
  ];
  
  for (const rule of complianceRulesData) {
    const streamId = documentTypeToStreamCode[rule.documentType] ? streamCodeToId[documentTypeToStreamCode[rule.documentType]] : null;
    await db.insert(complianceRules).values({ ...rule, complianceStreamId: streamId })
      .onConflictDoUpdate({
        target: complianceRules.ruleCode,
        set: {
          ruleName: rule.ruleName,
          documentType: rule.documentType,
          complianceStreamId: streamId,
          description: rule.description,
          legislation: rule.legislation,
          conditions: rule.conditions,
          conditionLogic: rule.conditionLogic,
          action: rule.action,
          priority: rule.priority,
          isActive: rule.isActive,
          updatedAt: new Date()
        }
      });
  }
  console.log(`✓ Upserted ${complianceRulesData.length} compliance rules with stream links`);
  
  // ==================== NORMALISATION RULES ====================
  // Comprehensive data transformation rules for extracted certificate data
  const normalisationRulesData = [
    // ========== NAME FORMATTING ==========
    { ruleName: "Title Case Engineer Name", fieldPath: "engineerName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 1, isActive: true },
    { ruleName: "Title Case Assessor Name", fieldPath: "assessorName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 2, isActive: true },
    { ruleName: "Title Case Surveyor Name", fieldPath: "surveyorName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 3, isActive: true },
    { ruleName: "Title Case Inspector Name", fieldPath: "inspectorName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 4, isActive: true },
    { ruleName: "Title Case Tester Name", fieldPath: "testerName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 5, isActive: true },
    
    // ========== ADDRESS FORMATTING ==========
    { ruleName: "Uppercase Postcode", fieldPath: "postcode", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "uppercase", priority: 10, isActive: true },
    { ruleName: "Format UK Postcode", fieldPath: "postcode", ruleType: "REGEX", inputPatterns: ["([A-Za-z]{1,2}[0-9]{1,2}[A-Za-z]?)\\s*([0-9][A-Za-z]{2})"], outputValue: "$1 $2", priority: 11, isActive: true },
    { ruleName: "Title Case Address", fieldPath: "propertyAddress", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 12, isActive: true },
    { ruleName: "Title Case Premises Address", fieldPath: "premisesAddress", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 13, isActive: true },
    
    // ========== DATE FORMATTING ==========
    { ruleName: "Format Issue Date DD/MM/YYYY", fieldPath: "issueDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 20, isActive: true },
    { ruleName: "Format Expiry Date DD/MM/YYYY", fieldPath: "expiryDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 21, isActive: true },
    { ruleName: "Format Assessment Date", fieldPath: "assessmentDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 22, isActive: true },
    { ruleName: "Format Survey Date", fieldPath: "surveyDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 23, isActive: true },
    { ruleName: "Format Inspection Date", fieldPath: "inspectionDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 24, isActive: true },
    { ruleName: "Format Test Date", fieldPath: "testDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 25, isActive: true },
    { ruleName: "Format Service Date", fieldPath: "serviceDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 26, isActive: true },
    { ruleName: "Format Next Inspection Date", fieldPath: "nextInspectionDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 27, isActive: true },
    { ruleName: "Format Next Review Date", fieldPath: "nextReviewDate", ruleType: "TRANSFORM", inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"], outputValue: "YYYY-MM-DD", transformFn: "dateFormat", priority: 28, isActive: true },
    
    // ========== REGISTRATION ID CLEANING ==========
    { ruleName: "Clean Gas Safe Register ID", fieldPath: "gasRegisterId", ruleType: "REGEX", inputPatterns: ["[^0-9]"], outputValue: "", priority: 30, isActive: true },
    { ruleName: "Clean OFTEC Registration ID", fieldPath: "oftecRegistrationId", ruleType: "REGEX", inputPatterns: ["[^A-Za-z0-9]"], outputValue: "", priority: 31, isActive: true },
    { ruleName: "Clean HETAS Registration ID", fieldPath: "hetasRegistrationId", ruleType: "REGEX", inputPatterns: ["[^A-Za-z0-9]"], outputValue: "", priority: 32, isActive: true },
    { ruleName: "Clean MCS Registration ID", fieldPath: "mcsRegistrationId", ruleType: "REGEX", inputPatterns: ["[^A-Za-z0-9/]"], outputValue: "", priority: 33, isActive: true },
    { ruleName: "Clean UKAS Accreditation", fieldPath: "ukasAccreditationNumber", ruleType: "REGEX", inputPatterns: ["[^0-9]"], outputValue: "", priority: 34, isActive: true },
    
    // ========== CERTIFICATE NUMBER FORMATTING ==========
    { ruleName: "Uppercase Certificate Number", fieldPath: "certificateNumber", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "uppercase", priority: 40, isActive: true },
    { ruleName: "Clean Certificate Number", fieldPath: "certificateNumber", ruleType: "REGEX", inputPatterns: ["[^A-Za-z0-9-/]"], outputValue: "", priority: 41, isActive: true },
    
    // ========== RESULT MAPPING ==========
    { ruleName: "Map Pass Variations", fieldPath: "overallResult", ruleType: "MAPPING", inputPatterns: ["PASSED", "Pass", "pass", "P", "OK", "SATISFACTORY", "Satisfactory"], outputValue: "PASS", priority: 50, isActive: true },
    { ruleName: "Map Fail Variations", fieldPath: "overallResult", ruleType: "MAPPING", inputPatterns: ["FAILED", "Fail", "fail", "F", "UNSATISFACTORY", "Unsatisfactory"], outputValue: "FAIL", priority: 51, isActive: true },
    { ruleName: "Map At Risk Variations", fieldPath: "overallResult", ruleType: "MAPPING", inputPatterns: ["AT RISK", "At Risk", "at risk", "AR", "POTENTIALLY DANGEROUS"], outputValue: "AT_RISK", priority: 52, isActive: true },
    
    // ========== EPC RATING MAPPING ==========
    { ruleName: "Uppercase EPC Rating", fieldPath: "currentRating", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "uppercase", priority: 60, isActive: true },
    { ruleName: "Uppercase Potential EPC Rating", fieldPath: "potentialRating", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "uppercase", priority: 61, isActive: true },
    
    // ========== DEFECT CODE MAPPING ==========
    { ruleName: "Map EICR C1 Variations", fieldPath: "observationCode", ruleType: "MAPPING", inputPatterns: ["C1", "c1", "Code 1", "CODE 1"], outputValue: "C1", priority: 70, isActive: true },
    { ruleName: "Map EICR C2 Variations", fieldPath: "observationCode", ruleType: "MAPPING", inputPatterns: ["C2", "c2", "Code 2", "CODE 2"], outputValue: "C2", priority: 71, isActive: true },
    { ruleName: "Map EICR C3 Variations", fieldPath: "observationCode", ruleType: "MAPPING", inputPatterns: ["C3", "c3", "Code 3", "CODE 3"], outputValue: "C3", priority: 72, isActive: true },
    { ruleName: "Map EICR FI Variations", fieldPath: "observationCode", ruleType: "MAPPING", inputPatterns: ["FI", "fi", "Further Investigation", "FURTHER INVESTIGATION"], outputValue: "FI", priority: 73, isActive: true },
    { ruleName: "Map Gas ID Variations", fieldPath: "defectCode", ruleType: "MAPPING", inputPatterns: ["ID", "id", "Immediately Dangerous", "IMMEDIATELY DANGEROUS"], outputValue: "ID", priority: 74, isActive: true },
    { ruleName: "Map Gas AR Variations", fieldPath: "defectCode", ruleType: "MAPPING", inputPatterns: ["AR", "ar", "At Risk", "AT RISK"], outputValue: "AR", priority: 75, isActive: true },
    { ruleName: "Map Gas NCS Variations", fieldPath: "defectCode", ruleType: "MAPPING", inputPatterns: ["NCS", "ncs", "Not to Current Standard", "NOT TO CURRENT STANDARD"], outputValue: "NCS", priority: 76, isActive: true },
    
    // ========== FIRE RISK RATING MAPPING ==========
    { ruleName: "Map Fire Risk Trivial", fieldPath: "riskRating", ruleType: "MAPPING", inputPatterns: ["Trivial", "trivial", "TRIVIAL", "Very Low", "very low"], outputValue: "TRIVIAL", priority: 80, isActive: true },
    { ruleName: "Map Fire Risk Tolerable", fieldPath: "riskRating", ruleType: "MAPPING", inputPatterns: ["Tolerable", "tolerable", "TOLERABLE", "Low", "low", "LOW"], outputValue: "TOLERABLE", priority: 81, isActive: true },
    { ruleName: "Map Fire Risk Moderate", fieldPath: "riskRating", ruleType: "MAPPING", inputPatterns: ["Moderate", "moderate", "MODERATE", "Medium", "medium", "MEDIUM"], outputValue: "MODERATE", priority: 82, isActive: true },
    { ruleName: "Map Fire Risk Substantial", fieldPath: "riskRating", ruleType: "MAPPING", inputPatterns: ["Substantial", "substantial", "SUBSTANTIAL", "High", "high", "HIGH"], outputValue: "SUBSTANTIAL", priority: 83, isActive: true },
    { ruleName: "Map Fire Risk Intolerable", fieldPath: "riskRating", ruleType: "MAPPING", inputPatterns: ["Intolerable", "intolerable", "INTOLERABLE", "Very High", "very high", "Critical"], outputValue: "INTOLERABLE", priority: 84, isActive: true },
    
    // ========== BOOLEAN NORMALISATION ==========
    { ruleName: "Map Boolean Yes to True", fieldPath: "*", ruleType: "MAPPING", inputPatterns: ["Yes", "yes", "YES", "Y", "y", "TRUE", "True", "1"], outputValue: "true", priority: 90, isActive: true },
    { ruleName: "Map Boolean No to False", fieldPath: "*", ruleType: "MAPPING", inputPatterns: ["No", "no", "NO", "N", "n", "FALSE", "False", "0"], outputValue: "false", priority: 91, isActive: true },
    
    // ========== COMPANY NAME FORMATTING ==========
    { ruleName: "Title Case Company Name", fieldPath: "companyName", ruleType: "TRANSFORM", inputPatterns: ["*"], transformFn: "titleCase", priority: 100, isActive: true },
    { ruleName: "Clean Company Name", fieldPath: "companyName", ruleType: "REGEX", inputPatterns: ["\\s+"], outputValue: " ", priority: 101, isActive: true }
  ];
  
  // Mapping: normalisation rule name patterns to stream codes
  const normRuleToStreamCode: Record<string, string> = {
    // Gas/Heating stream rules
    "Gas Safe": "GAS_HEATING",
    "OFTEC": "GAS_HEATING",
    "HETAS": "GAS_HEATING",
    "Gas ID": "GAS_HEATING",
    "Gas AR": "GAS_HEATING",
    "Gas NCS": "GAS_HEATING",
    // Electrical stream rules
    "EICR C1": "ELECTRICAL",
    "EICR C2": "ELECTRICAL",
    "EICR C3": "ELECTRICAL",
    "EICR FI": "ELECTRICAL",
    // Energy stream rules
    "EPC Rating": "ENERGY",
    "Potential EPC": "ENERGY",
    "MCS": "ENERGY",
    // Fire Safety stream rules
    "Fire Risk": "FIRE_SAFETY",
  };
  
  const getStreamIdForNormRule = (ruleName: string): string | null => {
    for (const [pattern, streamCode] of Object.entries(normRuleToStreamCode)) {
      if (ruleName.includes(pattern)) {
        return streamCodeToId[streamCode] || null;
      }
    }
    return null; // Universal rules don't have a stream
  };
  
  // Delete existing and re-insert normalisation rules with stream links
  await db.delete(normalisationRules);
  for (const rule of normalisationRulesData) {
    const streamId = getStreamIdForNormRule(rule.ruleName);
    await db.insert(normalisationRules).values({ ...rule, complianceStreamId: streamId });
  }
  console.log(`✓ Replaced ${normalisationRulesData.length} normalisation rules with stream links`);
  
}

async function seedFactorySettings() {
  console.log("🔧 Seeding factory settings...");
  
  const factorySettingsData = [
    // Rate Limiting Settings
    {
      key: "RATE_LIMIT_ENABLED",
      value: "true",
      category: "RATE_LIMITING",
      description: "Enable or disable API rate limiting globally",
      valueType: "boolean",
      isEditable: true
    },
    {
      key: "RATE_LIMIT_REQUESTS_PER_MINUTE",
      value: "60",
      category: "RATE_LIMITING",
      description: "Maximum API requests per minute per API key",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 1000 }
    },
    {
      key: "RATE_LIMIT_REQUESTS_PER_HOUR",
      value: "1000",
      category: "RATE_LIMITING",
      description: "Maximum API requests per hour per API key",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 10, max: 10000 }
    },
    {
      key: "RATE_LIMIT_REQUESTS_PER_DAY",
      value: "10000",
      category: "RATE_LIMITING",
      description: "Maximum API requests per day per API key",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 100, max: 100000 }
    },
    {
      key: "RATE_LIMIT_BURST_SIZE",
      value: "10",
      category: "RATE_LIMITING",
      description: "Maximum burst size for rate limiting (token bucket)",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 100 }
    },
    // Upload Settings
    {
      key: "UPLOAD_MAX_FILE_SIZE_MB",
      value: "50",
      category: "UPLOADS",
      description: "Maximum file size for uploads in megabytes",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 100 }
    },
    {
      key: "UPLOAD_ALLOWED_MIME_TYPES",
      value: "image/jpeg,image/png,image/webp,application/pdf",
      category: "UPLOADS",
      description: "Comma-separated list of allowed MIME types",
      valueType: "string",
      isEditable: true
    },
    {
      key: "UPLOAD_SESSION_TIMEOUT_MINUTES",
      value: "60",
      category: "UPLOADS",
      description: "Upload session timeout in minutes",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 5, max: 1440 }
    },
    {
      key: "UPLOAD_CONCURRENT_LIMIT",
      value: "5",
      category: "UPLOADS",
      description: "Maximum concurrent uploads per API client",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 20 }
    },
    // Ingestion Settings
    {
      key: "INGESTION_QUEUE_MAX_SIZE",
      value: "1000",
      category: "INGESTION",
      description: "Maximum number of jobs in the ingestion queue",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 10, max: 10000 }
    },
    {
      key: "INGESTION_RETRY_ATTEMPTS",
      value: "3",
      category: "INGESTION",
      description: "Number of retry attempts for failed ingestion jobs",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0, max: 10 }
    },
    {
      key: "INGESTION_TIMEOUT_SECONDS",
      value: "300",
      category: "INGESTION",
      description: "Timeout for ingestion processing in seconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 30, max: 3600 }
    },
    // API Security Settings
    {
      key: "API_KEY_EXPIRY_DAYS",
      value: "365",
      category: "SECURITY",
      description: "Default API key expiry in days (0 = never)",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0, max: 3650 }
    },
    {
      key: "API_REQUIRE_HMAC_SIGNING",
      value: "false",
      category: "SECURITY",
      description: "Require HMAC signature for API requests",
      valueType: "boolean",
      isEditable: true
    },
    {
      key: "API_HMAC_TOLERANCE_SECONDS",
      value: "300",
      category: "SECURITY",
      description: "Time tolerance for HMAC timestamp validation in seconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 60, max: 900 }
    },
    // Webhook Settings
    {
      key: "WEBHOOK_TIMEOUT_SECONDS",
      value: "30",
      category: "WEBHOOKS",
      description: "Timeout for webhook delivery in seconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 5, max: 120 }
    },
    {
      key: "WEBHOOK_MAX_RETRIES",
      value: "5",
      category: "WEBHOOKS",
      description: "Maximum retry attempts for failed webhook deliveries",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0, max: 10 }
    },
    // AI Extraction Settings
    {
      key: "AI_EXTRACTION_ENABLED",
      value: "true",
      category: "AI",
      description: "Enable AI-powered certificate extraction",
      valueType: "boolean",
      isEditable: true
    },
    {
      key: "AI_MAX_TOKENS",
      value: "4096",
      category: "AI",
      description: "Maximum tokens for AI responses",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1024, max: 8192 }
    },
    {
      key: "AI_CONFIDENCE_THRESHOLD",
      value: "0.75",
      category: "AI",
      description: "Minimum confidence threshold for AI extractions",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.5, max: 0.99 }
    },
    {
      key: "TIER1_CONFIDENCE_THRESHOLD",
      value: "0.85",
      category: "AI",
      description: "Default confidence threshold for tier-1 template matching",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.5, max: 0.99 }
    },
    {
      key: "DOCUMENT_TYPE_THRESHOLDS",
      value: JSON.stringify({
        "FRA": 0.70,
        "BSC": 0.70,
        "BUILDING_SAFETY": 0.70,
        "FRAEW": 0.70,
        "ASB": 0.75
      }),
      category: "AI",
      description: "Document-type-specific confidence thresholds (JSON). Lower for complex documents like FRA, Building Safety Case.",
      valueType: "json",
      isEditable: true
    },
    {
      key: "CUSTOM_EXTRACTION_PATTERNS",
      value: JSON.stringify({}),
      category: "AI",
      description: "Custom extraction patterns by document type (JSON). Add business-specific terminology patterns here.",
      valueType: "json",
      isEditable: true
    },
    // Job Queue Settings
    {
      key: "JOB_RETRY_LIMIT",
      value: "3",
      category: "JOB_QUEUE",
      description: "Maximum number of retry attempts for failed jobs",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 10 }
    },
    {
      key: "JOB_RETRY_DELAY_SECONDS",
      value: "30",
      category: "JOB_QUEUE",
      description: "Initial delay in seconds before retrying a failed job",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 5, max: 300 }
    },
    {
      key: "JOB_ARCHIVE_FAILED_AFTER_DAYS",
      value: "7",
      category: "JOB_QUEUE",
      description: "Days after which failed jobs are archived",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 90 }
    },
    {
      key: "JOB_DELETE_AFTER_DAYS",
      value: "30",
      category: "JOB_QUEUE",
      description: "Days after which completed jobs are permanently deleted",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 7, max: 365 }
    },
    {
      key: "CERTIFICATE_PROCESSING_TIMEOUT_MINUTES",
      value: "20",
      category: "JOB_QUEUE",
      description: "Minutes after which certificates stuck in PROCESSING status are automatically marked as FAILED",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 5, max: 120 }
    },
    {
      key: "CERTIFICATE_WATCHDOG_INTERVAL_MINUTES",
      value: "5",
      category: "JOB_QUEUE",
      description: "Interval in minutes between watchdog checks for stuck certificates",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 1, max: 30 }
    },
    // Rate Limit Timing Settings
    {
      key: "RATE_LIMIT_WINDOW_MS",
      value: "60000",
      category: "RATE_LIMITING",
      description: "Rate limit sliding window duration in milliseconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 10000, max: 300000 }
    },
    {
      key: "RATE_LIMIT_CLEANUP_INTERVAL_MS",
      value: "60000",
      category: "RATE_LIMITING",
      description: "Interval for cleaning up expired rate limit entries in milliseconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 30000, max: 300000 }
    },
    // Caching Settings
    {
      key: "OBJECT_STORAGE_CACHE_TTL_SECONDS",
      value: "3600",
      category: "CACHING",
      description: "Cache TTL for object storage downloads in seconds",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 60, max: 86400 }
    },
    // Geocoding Settings
    {
      key: "GEOCODING_BATCH_SIZE",
      value: "100",
      category: "GEOCODING",
      description: "Number of postcodes to geocode per API batch request",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 10, max: 100 }
    },
    // Extraction Settings
    {
      key: "extraction.enableAIProcessing",
      value: "false",
      category: "EXTRACTION",
      description: "Enable AI-based document extraction (Azure Document Intelligence + Claude Vision). When disabled, only free tiers (PDF/OCR) are used.",
      valueType: "boolean",
      isEditable: true,
      validationRules: null
    },
    {
      key: "extraction.tier1ConfidenceThreshold",
      value: "0.85",
      category: "EXTRACTION",
      description: "Confidence threshold for Tier 1 (template extraction) to complete without escalation",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.5, max: 1.0 }
    },
    {
      key: "extraction.tier2ConfidenceThreshold",
      value: "0.80",
      category: "EXTRACTION",
      description: "Confidence threshold for Tier 2 (Azure Document Intelligence) to complete without escalation",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.5, max: 1.0 }
    },
    {
      key: "extraction.tier3ConfidenceThreshold",
      value: "0.70",
      category: "EXTRACTION",
      description: "Confidence threshold for Tier 3 (Claude Vision) to complete without escalation",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.5, max: 1.0 }
    },
    {
      key: "extraction.maxCostPerDocument",
      value: "0.05",
      category: "EXTRACTION",
      description: "Maximum cost in GBP allowed per document extraction before routing to manual review",
      valueType: "number",
      isEditable: true,
      validationRules: { min: 0.01, max: 1.0 }
    },
    // Regional Settings
    {
      key: "regional.dateFormat",
      value: "DD-MM-YYYY",
      category: "REGIONAL",
      description: "Date display format across the application (UK default: DD-MM-YYYY)",
      valueType: "string",
      isEditable: true,
      validationRules: null
    },
    {
      key: "regional.dateTimeFormat",
      value: "DD-MM-YYYY HH:mm",
      category: "REGIONAL",
      description: "Date and time display format across the application",
      valueType: "string",
      isEditable: true,
      validationRules: null
    },
    {
      key: "regional.timezone",
      value: "Europe/London",
      category: "REGIONAL",
      description: "Default timezone for date/time display",
      valueType: "string",
      isEditable: true,
      validationRules: null
    },
    {
      key: "regional.locale",
      value: "en-GB",
      category: "REGIONAL",
      description: "Locale for number and currency formatting (e.g., en-GB, en-US)",
      valueType: "string",
      isEditable: true,
      validationRules: null
    },
    {
      key: "regional.currencySymbol",
      value: "GBP",
      category: "REGIONAL",
      description: "Currency symbol for cost displays (GBP, EUR, USD)",
      valueType: "string",
      isEditable: true,
      validationRules: null
    }
  ];
  
  await db.insert(factorySettings).values(factorySettingsData);
  console.log("✓ Created factory settings");
}

async function seedNavigation() {
  console.log("🧭 Seeding navigation configuration...");
  
  // Seed icon registry first
  const iconsData = [
    { iconKey: "LayoutDashboard", lucideName: "LayoutDashboard", category: "navigation" },
    { iconKey: "BarChart3", lucideName: "BarChart3", category: "navigation" },
    { iconKey: "UploadCloud", lucideName: "UploadCloud", category: "navigation" },
    { iconKey: "FileText", lucideName: "FileText", category: "navigation" },
    { iconKey: "Briefcase", lucideName: "Briefcase", category: "navigation" },
    { iconKey: "Settings2", lucideName: "Settings2", category: "navigation" },
    { iconKey: "Shield", lucideName: "Shield", category: "navigation" },
    { iconKey: "TreePine", lucideName: "TreePine", category: "navigation" },
    { iconKey: "Building2", lucideName: "Building2", category: "navigation" },
    { iconKey: "Package", lucideName: "Package", category: "navigation" },
    { iconKey: "Files", lucideName: "Files", category: "navigation" },
    { iconKey: "Radar", lucideName: "Radar", category: "navigation" },
    { iconKey: "Wrench", lucideName: "Wrench", category: "navigation" },
    { iconKey: "Calendar", lucideName: "Calendar", category: "navigation" },
    { iconKey: "Map", lucideName: "Map", category: "navigation" },
    { iconKey: "HeartPulse", lucideName: "HeartPulse", category: "navigation" },
    { iconKey: "ClipboardCheck", lucideName: "ClipboardCheck", category: "navigation" },
    { iconKey: "Eye", lucideName: "Eye", category: "navigation" },
    { iconKey: "Users", lucideName: "Users", category: "navigation" },
    { iconKey: "Target", lucideName: "Target", category: "navigation" },
    { iconKey: "Activity", lucideName: "Activity", category: "navigation" },
    { iconKey: "Sparkles", lucideName: "Sparkles", category: "navigation" },
    { iconKey: "MessageSquare", lucideName: "MessageSquare", category: "navigation" },
    { iconKey: "ClipboardList", lucideName: "ClipboardList", category: "navigation" },
    { iconKey: "FlaskConical", lucideName: "FlaskConical", category: "navigation" },
    { iconKey: "Brain", lucideName: "Brain", category: "navigation" },
    { iconKey: "UserCog", lucideName: "UserCog", category: "navigation" },
    { iconKey: "Webhook", lucideName: "Webhook", category: "navigation" },
    { iconKey: "Key", lucideName: "Key", category: "navigation" },
    { iconKey: "BookOpen", lucideName: "BookOpen", category: "navigation" },
    { iconKey: "Database", lucideName: "Database", category: "navigation" },
    { iconKey: "Film", lucideName: "Film", category: "navigation" },
    { iconKey: "HelpCircle", lucideName: "HelpCircle", category: "navigation" },
    { iconKey: "Gauge", lucideName: "Gauge", category: "navigation" },
    { iconKey: "FolderTree", lucideName: "FolderTree", category: "navigation" },
    { iconKey: "MonitorCheck", lucideName: "MonitorCheck", category: "navigation" },
    { iconKey: "Cog", lucideName: "Cog", category: "navigation" },
    { iconKey: "Library", lucideName: "Library", category: "navigation" },
  ];
  
  // Batch insert icons for performance
  await db.insert(iconRegistry).values(iconsData).onConflictDoNothing();
  console.log(`✓ Seeded ${iconsData.length} icons`);
  
  // IMPORTANT: Delete ALL items FIRST (before sections) to respect FK constraints
  // Delete both old-style and new-style navigation items
  await db.delete(navigationItems).where(
    sql`${navigationItems.sectionId} IN ('sec-command', 'sec-regulatory', 'sec-ops', 'sec-contractor', 'sec-staff', 'sec-monitoring', 'sec-admin', 'sec-operate', 'sec-assure', 'sec-understand', 'sec-assets', 'sec-people', 'sec-manage', 'sec-resources')`
  );
  
  // Delete old sections that are being replaced
  await db.delete(navigationSections).where(
    sql`${navigationSections.id} IN ('sec-command', 'sec-regulatory', 'sec-ops', 'sec-contractor', 'sec-staff', 'sec-monitoring', 'sec-admin')`
  );
  
  // Seed navigation sections - consolidated structure
  const sectionsData = [
    { id: "sec-operate", slug: "operate", title: "Operate", iconKey: "Gauge", displayOrder: 1, defaultOpen: true, isSystem: true },
    { id: "sec-assure", slug: "assure", title: "Assure", iconKey: "ShieldCheck", displayOrder: 2, defaultOpen: false, isSystem: true },
    { id: "sec-understand", slug: "understand", title: "Understand", iconKey: "BarChart3", displayOrder: 3, defaultOpen: false, isSystem: true },
    { id: "sec-assets", slug: "assets", title: "Assets", iconKey: "Building2", displayOrder: 4, defaultOpen: false, isSystem: true },
    { id: "sec-people", slug: "people-suppliers", title: "People & Suppliers", iconKey: "Users", displayOrder: 5, defaultOpen: false, isSystem: true },
    { id: "sec-manage", slug: "manage-system", title: "Manage System", iconKey: "Settings2", displayOrder: 6, defaultOpen: false, requiresRole: "admin", isSystem: true },
    { id: "sec-resources", slug: "resources", title: "Resources", iconKey: "Library", displayOrder: 7, defaultOpen: false, isSystem: true },
  ];
  
  // Delete existing new-style sections and re-insert for clean state
  await db.delete(navigationSections).where(
    sql`${navigationSections.id} IN ('sec-operate', 'sec-assure', 'sec-understand', 'sec-assets', 'sec-people', 'sec-manage', 'sec-resources')`
  );
  await db.insert(navigationSections).values(sectionsData);
  console.log(`✓ Seeded ${sectionsData.length} navigation sections`);
  
  // Seed navigation items with consolidated structure
  const itemsData = [
    // Operate - Day-to-day operations
    { sectionId: "sec-operate", slug: "overview", name: "Overview", href: "/dashboard", iconKey: "LayoutDashboard", displayOrder: 1, isSystem: true },
    { sectionId: "sec-operate", slug: "ingestion-hub", name: "Ingestion Hub", href: "/ingestion", iconKey: "UploadCloud", displayOrder: 2, isSystem: true },
    { sectionId: "sec-operate", slug: "certificates", name: "Certificates", href: "/certificates", iconKey: "Files", displayOrder: 3, isSystem: true },
    { sectionId: "sec-operate", slug: "remedial-actions", name: "Remedial Actions", href: "/actions", iconKey: "Wrench", displayOrder: 4, isSystem: true },
    { sectionId: "sec-operate", slug: "calendar", name: "Calendar", href: "/calendar", iconKey: "Calendar", displayOrder: 5, isSystem: true },
    { sectionId: "sec-operate", slug: "human-review", name: "Human Review", href: "/human-review", iconKey: "Eye", displayOrder: 6, requiresAITools: true, isSystem: true },
    
    // Assure - Compliance & proof
    { sectionId: "sec-assure", slug: "risk-radar", name: "Risk Radar", href: "/risk-radar", iconKey: "Radar", displayOrder: 1, isSystem: true },
    { sectionId: "sec-assure", slug: "regulatory-evidence", name: "Regulatory Evidence", href: "/reports/regulatory", iconKey: "Shield", displayOrder: 2, isSystem: true },
    { sectionId: "sec-assure", slug: "risk-maps", name: "Risk Maps", href: "/maps", iconKey: "Map", displayOrder: 3, isSystem: true },
    { sectionId: "sec-assure", slug: "audit-log", name: "Audit Log", href: "/admin/audit-log", iconKey: "ClipboardList", displayOrder: 4, requiresAdmin: true, isSystem: true },
    
    // Understand - Insights & analytics
    { sectionId: "sec-understand", slug: "analytics", name: "Analytics", href: "/compliance", iconKey: "BarChart3", displayOrder: 1, isSystem: true },
    { sectionId: "sec-understand", slug: "reporting", name: "Reporting", href: "/reports", iconKey: "FileText", displayOrder: 2, isSystem: true },
    { sectionId: "sec-understand", slug: "board", name: "Board Reports", href: "/reports/board", iconKey: "Briefcase", displayOrder: 3, isSystem: true },
    { sectionId: "sec-understand", slug: "report-builder", name: "Report Builder", href: "/reports/builder", iconKey: "Settings2", displayOrder: 4, isSystem: true },
    { sectionId: "sec-understand", slug: "asset-health", name: "Asset Health", href: "/admin/asset-health", iconKey: "HeartPulse", displayOrder: 5, requiresFactorySettings: true, isSystem: true },
    { sectionId: "sec-understand", slug: "ml-predictions", name: "ML Predictions", href: "/admin/ml-insights", iconKey: "TrendingUp", displayOrder: 6, requiresFactorySettings: true, isSystem: true },
    
    // Assets - Property & component management
    { sectionId: "sec-assets", slug: "property-hierarchy", name: "Property Hierarchy", href: "/admin/hierarchy", iconKey: "TreePine", displayOrder: 1, requiresAITools: true, isSystem: true },
    { sectionId: "sec-assets", slug: "properties", name: "Properties", href: "/properties", iconKey: "Building2", displayOrder: 2, isSystem: true },
    { sectionId: "sec-assets", slug: "components", name: "Components", href: "/components", iconKey: "Package", displayOrder: 3, isSystem: true },
    
    // People & Suppliers - Combined contractors and staff
    { sectionId: "sec-people", slug: "contractors", name: "Contractors", href: "/contractors", iconKey: "Users", displayOrder: 1, isSystem: true },
    { sectionId: "sec-people", slug: "staff-dlo", name: "Staff & DLO", href: "/staff", iconKey: "Briefcase", displayOrder: 2, isSystem: true },
    { sectionId: "sec-people", slug: "sla-tracking", name: "SLA Tracking", href: "/contractors/sla", iconKey: "Target", displayOrder: 3, isSystem: true },
    { sectionId: "sec-people", slug: "performance", name: "Performance", href: "/contractors/dashboard", iconKey: "BarChart3", displayOrder: 4, isSystem: true },
    
    // Manage System - Admin configuration
    { sectionId: "sec-manage", slug: "user-management", name: "User Management", href: "/admin/users", iconKey: "UserCog", displayOrder: 1, isSystem: true },
    { sectionId: "sec-manage", slug: "configuration", name: "Configuration", href: "/admin/configuration", iconKey: "Settings2", displayOrder: 2, isSystem: true },
    { sectionId: "sec-manage", slug: "factory-settings", name: "Factory Settings", href: "/admin/factory-settings", iconKey: "Shield", displayOrder: 3, requiresFactorySettings: true, isSystem: true },
    { sectionId: "sec-manage", slug: "system-health", name: "System Health", href: "/admin/system-health", iconKey: "Activity", displayOrder: 4, requiresFactorySettings: true, isSystem: true },
    { sectionId: "sec-manage", slug: "ingestion-control", name: "Ingestion Control", href: "/admin/ingestion-control", iconKey: "Sparkles", displayOrder: 5, requiresFactorySettings: true, isSystem: true },
    { sectionId: "sec-manage", slug: "integrations", name: "Integrations", href: "/admin/integrations", iconKey: "Webhook", displayOrder: 6, isSystem: true },
    { sectionId: "sec-manage", slug: "api-integration", name: "API Integration", href: "/admin/api-integration", iconKey: "Key", displayOrder: 7, isSystem: true },
    { sectionId: "sec-manage", slug: "api-docs", name: "API Documentation", href: "/admin/api-docs", iconKey: "BookOpen", displayOrder: 8, isSystem: true },
    
    // Resources - Help & training
    { sectionId: "sec-resources", slug: "data-import", name: "Data Import", href: "/admin/imports", iconKey: "Database", displayOrder: 1, isSystem: true },
    { sectionId: "sec-resources", slug: "video-library", name: "Video Library", href: "/video-library", iconKey: "Film", displayOrder: 2, isSystem: true },
    { sectionId: "sec-resources", slug: "help-guide", name: "Help Guide", href: "/help", iconKey: "HelpCircle", displayOrder: 3, isSystem: true },
  ];
  
  // Batch insert items for performance (items were deleted above)
  await db.insert(navigationItems).values(itemsData);
  console.log(`✓ Seeded ${itemsData.length} navigation items`);
}
