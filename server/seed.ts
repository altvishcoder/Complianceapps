// Seed script for initial ComplianceAI data
import { db } from "./db";
import { organisations, schemes, blocks, properties, users, certificateTypes, classificationCodes, extractionSchemas, complianceRules, normalisationRules, componentTypes } from "@shared/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "default-org";
const SUPER_ADMIN_ID = "super-admin-user";

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
    
    // Always create super admin user (minimal bootstrap)
    const [existingSuperAdmin] = await db.select().from(users).where(eq(users.id, SUPER_ADMIN_ID));
    if (!existingSuperAdmin) {
      await db.insert(users).values({
        id: SUPER_ADMIN_ID,
        username: "admin",
        password: "admin123",
        email: "admin@complianceai.co.uk",
        name: "System Admin",
        role: "SUPER_ADMIN",
        organisationId: org.id
      });
      console.log("✓ Created super admin user (username: admin, password: admin123)");
    }
    
    // Only seed demo data if SEED_DEMO_DATA is true
    if (SEED_DEMO_DATA) {
      await seedDemoData(org.id);
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
  
  // Create additional demo users
  const demoUsers = [
    { id: "user-manager-1", username: "manager", password: "manager123", email: "manager@complianceai.co.uk", name: "Property Manager", role: "MANAGER" as const },
    { id: "user-officer-1", username: "officer", password: "officer123", email: "officer@complianceai.co.uk", name: "Compliance Officer", role: "OFFICER" as const },
    { id: "user-viewer-1", username: "viewer", password: "viewer123", email: "viewer@complianceai.co.uk", name: "Report Viewer", role: "VIEWER" as const },
  ];
  
  for (const demoUser of demoUsers) {
    const [existing] = await db.select().from(users).where(eq(users.id, demoUser.id));
    if (!existing) {
      await db.insert(users).values({
        ...demoUser,
        organisationId: orgId
      });
    }
  }
  console.log("✓ Created demo users");
  
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
  
  // Create properties if needed
  const [existingProperty] = await db.select().from(properties).limit(1);
  if (!existingProperty) {
    await db.insert(properties).values([
      {
        blockId: block1.id,
        uprn: "10001001",
        addressLine1: "Flat 1, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "COMPLIANT"
      },
      {
        blockId: block1.id,
        uprn: "10001002",
        addressLine1: "Flat 2, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "OVERDUE"
      },
      {
        blockId: block2.id,
        uprn: "10002001",
        addressLine1: "101 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "LEASEHOLD",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "COMPLIANT"
      },
      {
        blockId: block2.id,
        uprn: "10002002",
        addressLine1: "102 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "NON_COMPLIANT"
      }
    ]);
    
    console.log("✓ Created demo properties (HACT: Units/Dwellings)");
  } else {
    console.log("✓ Using existing properties");
  }
}

async function seedConfiguration() {
  // Check if configuration already exists
  const [existingCertType] = await db.select().from(certificateTypes).limit(1);
  if (existingCertType) {
    console.log("✓ Configuration already seeded");
    return;
  }
  
  console.log("🔧 Seeding configuration data...");
  
  // ==================== CERTIFICATE TYPES ====================
  const certTypesData = [
    {
      code: "GAS_SAFETY",
      name: "Gas Safety Certificate (CP12)",
      shortName: "Gas Safety",
      complianceStream: "GAS",
      description: "Annual gas safety check required under Gas Safety (Installation and Use) Regulations 1998",
      validityMonths: 12,
      warningDays: 60,
      requiredFields: ["certificateNumber", "engineerName", "gasRegisterId", "issueDate", "expiryDate"],
      displayOrder: 1,
      isActive: true
    },
    {
      code: "EICR",
      name: "Electrical Installation Condition Report",
      shortName: "EICR",
      complianceStream: "ELECTRICAL",
      description: "Periodic electrical safety inspection required every 5 years under Electrical Safety Standards Regulations 2020",
      validityMonths: 60,
      warningDays: 90,
      requiredFields: ["certificateNumber", "engineerName", "issueDate", "nextInspectionDate", "overallAssessment"],
      displayOrder: 2,
      isActive: true
    },
    {
      code: "FIRE_RISK",
      name: "Fire Risk Assessment",
      shortName: "Fire Risk",
      complianceStream: "FIRE",
      description: "Fire safety assessment required under Regulatory Reform (Fire Safety) Order 2005",
      validityMonths: 12,
      warningDays: 60,
      requiredFields: ["assessmentDate", "assessorName", "riskRating", "nextReviewDate"],
      displayOrder: 3,
      isActive: true
    },
    {
      code: "ASBESTOS",
      name: "Asbestos Management Survey",
      shortName: "Asbestos",
      complianceStream: "ASBESTOS",
      description: "Asbestos survey and management plan under Control of Asbestos Regulations 2012",
      validityMonths: 12,
      warningDays: 60,
      requiredFields: ["surveyDate", "surveyorName", "surveyType", "acmsIdentified"],
      displayOrder: 4,
      isActive: true
    },
    {
      code: "LEGIONELLA",
      name: "Legionella Risk Assessment",
      shortName: "Legionella",
      complianceStream: "WATER",
      description: "Water hygiene risk assessment under HSE Approved Code of Practice L8",
      validityMonths: 24,
      warningDays: 60,
      requiredFields: ["assessmentDate", "assessorName", "riskLevel", "controlMeasures"],
      displayOrder: 5,
      isActive: true
    },
    {
      code: "LIFT_LOLER",
      name: "Lift Thorough Examination (LOLER)",
      shortName: "Lift/LOLER",
      complianceStream: "LIFT",
      description: "Six-monthly lift inspection under LOLER 1998",
      validityMonths: 6,
      warningDays: 30,
      requiredFields: ["examinationDate", "engineerName", "liftId", "safeForUse", "nextExaminationDate"],
      displayOrder: 6,
      isActive: true
    },
    {
      code: "EPC",
      name: "Energy Performance Certificate",
      shortName: "EPC",
      complianceStream: "ENERGY",
      description: "Energy efficiency rating required for lettings",
      validityMonths: 120,
      warningDays: 180,
      requiredFields: ["certificateNumber", "assessorName", "currentRating", "issueDate"],
      displayOrder: 7,
      isActive: true
    },
    {
      code: "PAT",
      name: "Portable Appliance Testing",
      shortName: "PAT",
      complianceStream: "ELECTRICAL",
      description: "Testing of portable electrical appliances in communal areas",
      validityMonths: 12,
      warningDays: 30,
      requiredFields: ["testDate", "testerName", "appliancesTested", "passRate"],
      displayOrder: 8,
      isActive: true
    },
    {
      code: "FIRE_ALARM",
      name: "Fire Alarm System Certificate",
      shortName: "Fire Alarm",
      complianceStream: "FIRE",
      description: "Annual fire alarm system inspection under BS 5839",
      validityMonths: 12,
      warningDays: 30,
      requiredFields: ["inspectionDate", "engineerName", "systemType", "nextInspectionDate"],
      displayOrder: 9,
      isActive: true
    },
    {
      code: "EMERGENCY_LIGHTING",
      name: "Emergency Lighting Certificate",
      shortName: "Emergency Lighting",
      complianceStream: "FIRE",
      description: "Annual emergency lighting inspection under BS 5266",
      validityMonths: 12,
      warningDays: 30,
      requiredFields: ["testDate", "engineerName", "luminairesTested", "nextTestDate"],
      displayOrder: 10,
      isActive: true
    }
  ];
  
  await db.insert(certificateTypes).values(certTypesData);
  console.log("✓ Created certificate types");
  
  // ==================== CLASSIFICATION CODES ====================
  const classificationCodesData = [
    // Gas Safety Codes
    { code: "C1", name: "Immediately Dangerous", severity: "CRITICAL", colorCode: "#DC2626", description: "Immediately Dangerous - gas supply should be disconnected", actionRequired: "Immediate disconnection and repair", timeframeHours: 0, displayOrder: 1, isActive: true },
    { code: "C2", name: "At Risk", severity: "HIGH", colorCode: "#EA580C", description: "At Risk - not immediately dangerous but could become so", actionRequired: "Repair within 28 days", timeframeHours: 672, displayOrder: 2, isActive: true },
    { code: "NCS", name: "Not to Current Standards", severity: "MEDIUM", colorCode: "#CA8A04", description: "Not to Current Standards - not dangerous but should be upgraded", actionRequired: "Plan upgrade at next visit", timeframeHours: null, displayOrder: 3, isActive: true },
    
    // EICR Codes
    { code: "C1_EICR", name: "Danger Present", severity: "CRITICAL", colorCode: "#DC2626", description: "Danger present - risk of injury, immediate remedial action required", actionRequired: "Immediate remedial action", timeframeHours: 24, displayOrder: 4, isActive: true },
    { code: "C2_EICR", name: "Potentially Dangerous", severity: "HIGH", colorCode: "#EA580C", description: "Potentially dangerous - urgent remedial action required", actionRequired: "Remedial action within 28 days", timeframeHours: 672, displayOrder: 5, isActive: true },
    { code: "C3", name: "Improvement Recommended", severity: "LOW", colorCode: "#16A34A", description: "Improvement recommended - not dangerous but could be improved", actionRequired: "Improvement at next opportunity", timeframeHours: null, displayOrder: 6, isActive: true },
    { code: "FI", name: "Further Investigation", severity: "MEDIUM", colorCode: "#CA8A04", description: "Further investigation required", actionRequired: "Investigation within 28 days", timeframeHours: 672, displayOrder: 7, isActive: true },
    
    // Fire Risk Assessment Ratings
    { code: "TRIVIAL", name: "Trivial Risk", severity: "LOW", colorCode: "#16A34A", description: "Trivial risk - no action required beyond normal controls", actionRequired: "Continue monitoring", timeframeHours: null, displayOrder: 8, isActive: true },
    { code: "TOLERABLE", name: "Tolerable Risk", severity: "LOW", colorCode: "#22C55E", description: "Tolerable risk - monitor and maintain existing controls", actionRequired: "Annual review", timeframeHours: 8760, displayOrder: 9, isActive: true },
    { code: "MODERATE", name: "Moderate Risk", severity: "MEDIUM", colorCode: "#CA8A04", description: "Moderate risk - efforts should be made to reduce risk", actionRequired: "Action within 3 months", timeframeHours: 2160, displayOrder: 10, isActive: true },
    { code: "SUBSTANTIAL", name: "Substantial Risk", severity: "HIGH", colorCode: "#EA580C", description: "Substantial risk - work should not proceed until risk reduced", actionRequired: "Action within 1 month", timeframeHours: 720, displayOrder: 11, isActive: true },
    { code: "INTOLERABLE", name: "Intolerable Risk", severity: "CRITICAL", colorCode: "#DC2626", description: "Intolerable risk - work must not proceed until risk eliminated", actionRequired: "Immediate action required", timeframeHours: 24, displayOrder: 12, isActive: true },
    
    // Asbestos Risk Categories
    { code: "ACM_LOW", name: "Low Risk ACM", severity: "LOW", colorCode: "#16A34A", description: "Low risk ACM - manage in place with periodic inspection", actionRequired: "Annual reinspection", timeframeHours: 8760, displayOrder: 13, isActive: true },
    { code: "ACM_MEDIUM", name: "Medium Risk ACM", severity: "MEDIUM", colorCode: "#CA8A04", description: "Medium risk ACM - manage with enhanced controls", actionRequired: "Six-monthly inspection", timeframeHours: 4380, displayOrder: 14, isActive: true },
    { code: "ACM_HIGH", name: "High Risk ACM", severity: "HIGH", colorCode: "#EA580C", description: "High risk ACM - removal or encapsulation required", actionRequired: "Action within 3 months", timeframeHours: 2160, displayOrder: 15, isActive: true },
    { code: "ACM_CRITICAL", name: "Critical Risk ACM", severity: "CRITICAL", colorCode: "#DC2626", description: "Critical risk ACM - urgent removal required", actionRequired: "Urgent removal within 1 month", timeframeHours: 720, displayOrder: 16, isActive: true },
    
    // LOLER Defect Categories
    { code: "LIFT_SAFE", name: "Safe for Use", severity: "LOW", colorCode: "#16A34A", description: "Lift safe for continued use with no defects", actionRequired: "None - continue operation", timeframeHours: null, displayOrder: 17, isActive: true },
    { code: "LIFT_MINOR", name: "Minor Defect", severity: "LOW", colorCode: "#22C55E", description: "Minor defects that do not affect safety", actionRequired: "Repair within 3 months", timeframeHours: 2160, displayOrder: 18, isActive: true },
    { code: "LIFT_SIGNIFICANT", name: "Significant Defect", severity: "MEDIUM", colorCode: "#CA8A04", description: "Significant defects requiring prompt attention", actionRequired: "Repair within 1 month", timeframeHours: 720, displayOrder: 19, isActive: true },
    { code: "LIFT_DANGEROUS", name: "Dangerous Defect", severity: "CRITICAL", colorCode: "#DC2626", description: "Dangerous defects - lift must not be used", actionRequired: "Immediate isolation and repair", timeframeHours: 0, displayOrder: 20, isActive: true },
    
    // EPC Ratings
    { code: "EPC_A", name: "EPC Rating A", severity: "LOW", colorCode: "#15803D", description: "EPC Rating A (92-100) - highest efficiency", actionRequired: "None", timeframeHours: null, displayOrder: 21, isActive: true },
    { code: "EPC_B", name: "EPC Rating B", severity: "LOW", colorCode: "#16A34A", description: "EPC Rating B (81-91) - very high efficiency", actionRequired: "None", timeframeHours: null, displayOrder: 22, isActive: true },
    { code: "EPC_C", name: "EPC Rating C", severity: "LOW", colorCode: "#22C55E", description: "EPC Rating C (69-80) - good efficiency", actionRequired: "None", timeframeHours: null, displayOrder: 23, isActive: true },
    { code: "EPC_D", name: "EPC Rating D", severity: "MEDIUM", colorCode: "#CA8A04", description: "EPC Rating D (55-68) - average efficiency", actionRequired: "Plan improvements", timeframeHours: null, displayOrder: 24, isActive: true },
    { code: "EPC_E", name: "EPC Rating E", severity: "HIGH", colorCode: "#EA580C", description: "EPC Rating E (39-54) - minimum for rental from 2025", actionRequired: "Improvement works required", timeframeHours: null, displayOrder: 25, isActive: true },
    { code: "EPC_F", name: "EPC Rating F", severity: "CRITICAL", colorCode: "#DC2626", description: "EPC Rating F (21-38) - below rental minimum", actionRequired: "Immediate improvement works", timeframeHours: 2160, displayOrder: 26, isActive: true },
    { code: "EPC_G", name: "EPC Rating G", severity: "CRITICAL", colorCode: "#991B1B", description: "EPC Rating G (1-20) - cannot legally rent", actionRequired: "Urgent improvement works", timeframeHours: 720, displayOrder: 27, isActive: true }
  ];
  
  await db.insert(classificationCodes).values(classificationCodesData);
  console.log("✓ Created classification codes");
  
  // ==================== EXTRACTION SCHEMAS ====================
  const extractionSchemasData = [
    {
      version: "2.0",
      documentType: "GAS_SAFETY",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        gasRegisterId: { type: "string", required: true },
        companyName: { type: "string", required: false },
        issueDate: { type: "date", required: true },
        expiryDate: { type: "date", required: true },
        propertyAddress: { type: "string", required: true },
        appliancesTested: { type: "array", required: true },
        defects: { type: "array", required: false },
        overallResult: { type: "string", required: true, enum: ["PASS", "FAIL", "AT_RISK"] }
      },
      promptTemplate: "Extract all gas safety certificate information including engineer details, appliances tested, and any defects found.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "EICR",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        engineerName: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        nextInspectionDate: { type: "date", required: true },
        propertyAddress: { type: "string", required: true },
        overallAssessment: { type: "string", required: true, enum: ["SATISFACTORY", "UNSATISFACTORY", "FURTHER_INVESTIGATION"] },
        circuitsTested: { type: "number", required: false },
        observations: { type: "array", required: false },
        c1Count: { type: "number", required: false },
        c2Count: { type: "number", required: false },
        c3Count: { type: "number", required: false }
      },
      promptTemplate: "Extract EICR information including overall assessment, observation codes, and circuit details.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "FIRE_RISK",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        riskRating: { type: "string", required: true, enum: ["TRIVIAL", "TOLERABLE", "MODERATE", "SUBSTANTIAL", "INTOLERABLE"] },
        significantFindings: { type: "array", required: false },
        nextReviewDate: { type: "date", required: true }
      },
      promptTemplate: "Extract fire risk assessment details including overall risk rating and significant findings.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "ASBESTOS",
      schemaJson: {
        surveyDate: { type: "date", required: true },
        surveyorName: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        surveyType: { type: "string", required: true, enum: ["MANAGEMENT", "REFURBISHMENT", "DEMOLITION"] },
        acmsIdentified: { type: "array", required: false },
        totalAcmCount: { type: "number", required: false },
        managementPlan: { type: "string", required: false }
      },
      promptTemplate: "Extract asbestos survey information including ACMs identified and their risk levels.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "LEGIONELLA",
      schemaJson: {
        assessmentDate: { type: "date", required: true },
        assessorName: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        riskLevel: { type: "string", required: true, enum: ["LOW", "MEDIUM", "HIGH"] },
        waterSystemsAssessed: { type: "array", required: false },
        controlMeasures: { type: "array", required: false },
        nextAssessmentDate: { type: "date", required: false }
      },
      promptTemplate: "Extract legionella risk assessment details including water systems and control measures.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "LIFT_LOLER",
      schemaJson: {
        examinationDate: { type: "date", required: true },
        engineerName: { type: "string", required: true },
        premisesAddress: { type: "string", required: true },
        liftId: { type: "string", required: true },
        safeForUse: { type: "boolean", required: true },
        defectsFound: { type: "array", required: false },
        nextExaminationDate: { type: "date", required: true }
      },
      promptTemplate: "Extract LOLER lift examination details including safety status and any defects.",
      isActive: true,
      isDeprecated: false
    },
    {
      version: "2.0",
      documentType: "EPC",
      schemaJson: {
        certificateNumber: { type: "string", required: true },
        assessorName: { type: "string", required: true },
        propertyAddress: { type: "string", required: true },
        issueDate: { type: "date", required: true },
        currentRating: { type: "string", required: true, enum: ["A", "B", "C", "D", "E", "F", "G"] },
        potentialRating: { type: "string", required: false },
        currentScore: { type: "number", required: false },
        recommendations: { type: "array", required: false }
      },
      promptTemplate: "Extract EPC details including current and potential ratings, scores, and improvement recommendations.",
      isActive: true,
      isDeprecated: false
    }
  ];
  
  await db.insert(extractionSchemas).values(extractionSchemasData);
  console.log("✓ Created extraction schemas");
  
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
  
  await db.insert(componentTypes).values(componentTypesData);
  console.log("✓ Created component types");
  
  // ==================== COMPLIANCE RULES ====================
  const complianceRulesData = [
    {
      ruleCode: "GAS_EXPIRY_WARN",
      ruleName: "Gas Safety Annual Check",
      documentType: "GAS_SAFETY",
      description: "Properties with gas must have annual safety check",
      conditions: [{ field: "hasGas", operator: "equals", value: true }],
      conditionLogic: "AND",
      action: "WARN",
      severity: "HIGH",
      priority: "P1",
      isActive: true
    },
    {
      ruleCode: "EICR_EXPIRY_WARN",
      ruleName: "EICR 5-Year Check",
      documentType: "EICR",
      description: "Electrical installations must be inspected every 5 years",
      conditions: [{ field: "expiryDays", operator: "less_than", value: 90 }],
      conditionLogic: "AND",
      action: "WARN",
      severity: "HIGH",
      priority: "P2",
      isActive: true
    },
    {
      ruleCode: "FIRE_RISK_REVIEW",
      ruleName: "Fire Risk Annual Review",
      documentType: "FIRE_RISK",
      description: "Fire risk assessments should be reviewed annually",
      conditions: [{ field: "expiryDays", operator: "less_than", value: 60 }],
      conditionLogic: "AND",
      action: "WARN",
      severity: "MEDIUM",
      priority: "P3",
      isActive: true
    },
    {
      ruleCode: "LIFT_LOLER_WARN",
      ruleName: "Lift LOLER 6-Monthly",
      documentType: "LIFT_LOLER",
      description: "Lifts require thorough examination every 6 months",
      conditions: [{ field: "hasLift", operator: "equals", value: true }],
      conditionLogic: "AND",
      action: "WARN",
      severity: "HIGH",
      priority: "P4",
      isActive: true
    }
  ];
  
  await db.insert(complianceRules).values(complianceRulesData);
  console.log("✓ Created compliance rules");
  
  // ==================== NORMALISATION RULES ====================
  const normalisationRulesData = [
    {
      ruleName: "Title Case Engineer Name",
      fieldPath: "engineerName",
      ruleType: "TRANSFORM",
      inputPatterns: ["*"],
      transformFn: "titleCase",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Uppercase Postcode",
      fieldPath: "postcode",
      ruleType: "TRANSFORM",
      inputPatterns: ["*"],
      transformFn: "uppercase",
      priority: 2,
      isActive: true
    },
    {
      ruleName: "Format Issue Date",
      fieldPath: "issueDate",
      ruleType: "TRANSFORM",
      inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"],
      outputValue: "YYYY-MM-DD",
      transformFn: "dateFormat",
      priority: 3,
      isActive: true
    },
    {
      ruleName: "Format Expiry Date",
      fieldPath: "expiryDate",
      ruleType: "TRANSFORM",
      inputPatterns: ["DD/MM/YYYY", "D/M/YYYY"],
      outputValue: "YYYY-MM-DD",
      transformFn: "dateFormat",
      priority: 4,
      isActive: true
    },
    {
      ruleName: "Clean Gas Register ID",
      fieldPath: "gasRegisterId",
      ruleType: "REGEX",
      inputPatterns: ["[^0-9]"],
      outputValue: "",
      priority: 5,
      isActive: true
    }
  ];
  
  await db.insert(normalisationRules).values(normalisationRulesData);
  console.log("✓ Created normalisation rules");
}
