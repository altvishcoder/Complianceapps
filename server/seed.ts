// Seed script for initial ComplianceAI data
import { db } from "./db";
import { organisations, schemes, blocks, properties, users, certificateTypes, classificationCodes, extractionSchemas, complianceRules, normalisationRules, componentTypes } from "@shared/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "default-org";
const SUPER_ADMIN_ID = "super-admin-user";

export async function seedDatabase() {
  try {
    // Check if org AND users exist (more robust check)
    const [existingOrg] = await db.select().from(organisations).limit(1);
    const [existingUser] = await db.select().from(users).limit(1);
    const [existingProperty] = await db.select().from(properties).limit(1);
    
    if (existingOrg && existingUser && existingProperty) {
      console.log("✓ Database already seeded");
      // Still seed configuration if missing
      await seedConfiguration();
      return;
    }
    
    // If org exists but data was wiped, delete and reseed
    if (existingOrg && (!existingUser || !existingProperty)) {
      console.log("🔄 Partial data detected, reseeding...");
    }
    
    console.log("🌱 Seeding database...");
    
    // Create or get organisation
    let org = existingOrg;
    if (!org) {
      const [newOrg] = await db.insert(organisations).values({
        id: ORG_ID,
        name: "Demo Housing Association",
        slug: "demo-ha",
        settings: { timezone: "Europe/London" }
      }).returning();
      org = newOrg;
      console.log("✓ Created organisation:", org.name);
    } else {
      console.log("✓ Using existing organisation:", org.name);
    }
    
    // Create super admin user
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
          organisationId: org.id
        });
      }
    }
    console.log("✓ Created demo users");
    
    // Create schemes if needed
    const existingSchemes = await db.select().from(schemes).where(eq(schemes.organisationId, org.id));
    let scheme1, scheme2;
    
    if (existingSchemes.length === 0) {
      [scheme1] = await db.insert(schemes).values({
        organisationId: org.id,
        name: "Oak Estate",
        reference: "SCH001",
        complianceStatus: "COMPLIANT"
      }).returning();
      
      [scheme2] = await db.insert(schemes).values({
        organisationId: org.id,
        name: "Riverside Gardens",
        reference: "SCH002",
        complianceStatus: "EXPIRING_SOON"
      }).returning();
      
      console.log("✓ Created schemes");
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
      
      console.log("✓ Created blocks");
    } else {
      const allBlocks = await db.select().from(blocks);
      block1 = allBlocks[0];
      block2 = allBlocks[1] || allBlocks[0];
      console.log("✓ Using existing blocks");
    }
    
    // Create properties if needed
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
      
      console.log("✓ Created properties");
    } else {
      console.log("✓ Using existing properties");
    }
    
    // Seed configuration data
    await seedConfiguration();
    
    console.log("🎉 Database seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
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
        currentScore: { type: "number", required: false },
        potentialRating: { type: "string", required: false },
        recommendations: { type: "array", required: false }
      },
      promptTemplate: "Extract EPC information including energy rating and improvement recommendations.",
      isActive: true,
      isDeprecated: false
    }
  ];
  
  await db.insert(extractionSchemas).values(extractionSchemasData);
  console.log("✓ Created extraction schemas");
  
  // ==================== COMPLIANCE RULES ====================
  const complianceRulesData = [
    {
      ruleCode: "GAS_C1_IMMEDIATE",
      ruleName: "Gas C1 Immediate Danger",
      documentType: "GAS_SAFETY",
      conditions: [{ field: "defects.code", operator: "equals", value: "C1" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P1",
      description: "C1 defects require immediate action - gas supply must be disconnected.",
      legislation: "Gas Safety (Installation and Use) Regulations 1998",
      isActive: true
    },
    {
      ruleCode: "GAS_C2_ATRISK",
      ruleName: "Gas C2 At Risk",
      documentType: "GAS_SAFETY",
      conditions: [{ field: "defects.code", operator: "equals", value: "C2" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P2",
      description: "C2 defects are at risk - repair required within 28 days.",
      legislation: "Gas Safety (Installation and Use) Regulations 1998",
      isActive: true
    },
    {
      ruleCode: "EICR_UNSATISFACTORY",
      ruleName: "EICR Unsatisfactory Result",
      documentType: "EICR",
      conditions: [{ field: "overallAssessment", operator: "equals", value: "UNSATISFACTORY" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P1",
      description: "Unsatisfactory EICR requires remedial works within 28 days.",
      legislation: "Electrical Safety Standards (England) Regulations 2020",
      isActive: true
    },
    {
      ruleCode: "EICR_C1_DANGER",
      ruleName: "EICR C1 Danger Present",
      documentType: "EICR",
      conditions: [{ field: "observations.code", operator: "equals", value: "C1" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P1",
      description: "C1 electrical defects are immediately dangerous.",
      legislation: "Electrical Safety Standards (England) Regulations 2020",
      isActive: true
    },
    {
      ruleCode: "FIRE_INTOLERABLE",
      ruleName: "Fire Risk Intolerable Rating",
      documentType: "FIRE_RISK",
      conditions: [{ field: "riskRating", operator: "equals", value: "INTOLERABLE" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P1",
      description: "Intolerable fire risk requires immediate evacuation consideration.",
      legislation: "Regulatory Reform (Fire Safety) Order 2005",
      isActive: true
    },
    {
      ruleCode: "FIRE_SUBSTANTIAL",
      ruleName: "Fire Risk Substantial Rating",
      documentType: "FIRE_RISK",
      conditions: [{ field: "riskRating", operator: "equals", value: "SUBSTANTIAL" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P2",
      description: "Substantial fire risk requires action within 30 days.",
      legislation: "Regulatory Reform (Fire Safety) Order 2005",
      isActive: true
    },
    {
      ruleCode: "ASBESTOS_HIGH",
      ruleName: "Asbestos High Risk ACM",
      documentType: "ASBESTOS",
      conditions: [{ field: "acmsIdentified.priority", operator: "equals", value: "HIGH" }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P2",
      description: "High risk ACMs require removal or encapsulation within 3 months.",
      legislation: "Control of Asbestos Regulations 2012",
      isActive: true
    },
    {
      ruleCode: "LIFT_DANGEROUS",
      ruleName: "Lift Dangerous Defect",
      documentType: "LIFT_LOLER",
      conditions: [{ field: "safeForUse", operator: "equals", value: false }],
      conditionLogic: "AND",
      action: "FLAG_URGENT",
      priority: "P1",
      description: "Dangerous lift defects require immediate isolation.",
      legislation: "LOLER 1998",
      isActive: true
    },
    {
      ruleCode: "EPC_BELOW_E",
      ruleName: "EPC Below Minimum Standard",
      documentType: "EPC",
      conditions: [{ field: "currentRating", operator: "in", value: ["F", "G"] }],
      conditionLogic: "AND",
      action: "MARK_INCOMPLETE",
      priority: "P2",
      description: "Properties rated F or G cannot legally be rented from April 2025.",
      legislation: "Energy Efficiency Regulations",
      isActive: true
    }
  ];
  
  await db.insert(complianceRules).values(complianceRulesData);
  console.log("✓ Created compliance rules");
  
  // ==================== NORMALISATION RULES ====================
  const normalisationRulesData = [
    {
      ruleName: "Gas ID to C1",
      fieldPath: "defects.code",
      ruleType: "MAPPING",
      inputPatterns: ["ID", "immediately dangerous", "IMMEDIATELY DANGEROUS"],
      outputValue: "C1",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Gas AR to C2",
      fieldPath: "defects.code",
      ruleType: "MAPPING",
      inputPatterns: ["AR", "at risk", "AT RISK"],
      outputValue: "C2",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "UK Date Format",
      fieldPath: "issueDate",
      ruleType: "REGEX",
      inputPatterns: ["^(\\d{1,2})/(\\d{1,2})/(\\d{4})$"],
      outputValue: "ISO8601",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Gas Safe ID Cleanup",
      fieldPath: "gasRegisterId",
      ruleType: "REGEX",
      inputPatterns: ["^(\\d{3})[\\s-]?(\\d{4})$"],
      outputValue: "$1$2",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Postcode Format",
      fieldPath: "postcode",
      ruleType: "REGEX",
      inputPatterns: ["^([A-Z]{1,2}\\d[A-Z\\d]?)\\s*(\\d[A-Z]{2})$"],
      outputValue: "$1 $2",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "EICR Pass to Satisfactory",
      fieldPath: "overallAssessment",
      ruleType: "MAPPING",
      inputPatterns: ["PASS", "pass", "Pass", "SAT", "Sat"],
      outputValue: "SATISFACTORY",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "EICR Fail to Unsatisfactory",
      fieldPath: "overallAssessment",
      ruleType: "MAPPING",
      inputPatterns: ["FAIL", "fail", "Fail", "UNSAT", "Unsat"],
      outputValue: "UNSATISFACTORY",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "EPC Rating Uppercase",
      fieldPath: "currentRating",
      ruleType: "TRANSFORM",
      inputPatterns: ["^[a-g]$"],
      transformFn: "UPPERCASE",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "White Asbestos to Chrysotile",
      fieldPath: "asbestosType",
      ruleType: "MAPPING",
      inputPatterns: ["white", "WHITE", "White"],
      outputValue: "CHRYSOTILE",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Brown Asbestos to Amosite",
      fieldPath: "asbestosType",
      ruleType: "MAPPING",
      inputPatterns: ["brown", "BROWN", "Brown"],
      outputValue: "AMOSITE",
      priority: 1,
      isActive: true
    },
    {
      ruleName: "Blue Asbestos to Crocidolite",
      fieldPath: "asbestosType",
      ruleType: "MAPPING",
      inputPatterns: ["blue", "BLUE", "Blue"],
      outputValue: "CROCIDOLITE",
      priority: 1,
      isActive: true
    }
  ];
  
  await db.insert(normalisationRules).values(normalisationRulesData);
  console.log("✓ Created normalisation rules");
  
  // Seed Component Types for HACT-aligned asset management
  const [existingComponentType] = await db.select().from(componentTypes).limit(1);
  if (!existingComponentType) {
    const componentTypesData: Array<{
      code: string;
      name: string;
      category: "HEATING" | "ELECTRICAL" | "FIRE_SAFETY" | "WATER" | "VENTILATION" | "STRUCTURE" | "ACCESS" | "SECURITY" | "EXTERNAL" | "OTHER";
      description: string;
      hactElementCode: string;
      expectedLifespanYears: number;
      relatedCertificateTypes: string[];
      inspectionFrequencyMonths: number;
      isHighRisk: boolean;
      buildingSafetyRelevant: boolean;
      displayOrder: number;
      isActive: boolean;
    }> = [
      // Heating Components
      { code: "GAS_BOILER", name: "Gas Boiler", category: "HEATING", description: "Domestic gas boiler for heating and hot water", hactElementCode: "HE-01", expectedLifespanYears: 15, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 1, isActive: true },
      { code: "CENTRAL_HEATING", name: "Central Heating System", category: "HEATING", description: "Complete central heating system including radiators", hactElementCode: "HE-02", expectedLifespanYears: 20, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 2, isActive: true },
      { code: "STORAGE_HEATER", name: "Storage Heater", category: "HEATING", description: "Electric storage heater", hactElementCode: "HE-03", expectedLifespanYears: 15, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 3, isActive: true },
      
      // Electrical Components
      { code: "CONSUMER_UNIT", name: "Consumer Unit", category: "ELECTRICAL", description: "Main electrical consumer unit (fuse box)", hactElementCode: "EL-01", expectedLifespanYears: 25, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 10, isActive: true },
      { code: "ELECTRICAL_WIRING", name: "Electrical Wiring", category: "ELECTRICAL", description: "Fixed electrical wiring installation", hactElementCode: "EL-02", expectedLifespanYears: 30, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 11, isActive: true },
      { code: "SMOKE_DETECTOR", name: "Smoke Detector", category: "ELECTRICAL", description: "Smoke/heat detector (mains or battery)", hactElementCode: "EL-03", expectedLifespanYears: 10, relatedCertificateTypes: ["EICR", "FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 12, isActive: true },
      { code: "CO_DETECTOR", name: "Carbon Monoxide Detector", category: "ELECTRICAL", description: "Carbon monoxide detector", hactElementCode: "EL-04", expectedLifespanYears: 7, relatedCertificateTypes: ["GAS_SAFETY"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 13, isActive: true },
      
      // Fire Safety Components
      { code: "FIRE_DOOR", name: "Fire Door", category: "FIRE_SAFETY", description: "Fire-rated door assembly", hactElementCode: "FS-01", expectedLifespanYears: 25, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 20, isActive: true },
      { code: "FIRE_ALARM", name: "Fire Alarm System", category: "FIRE_SAFETY", description: "Fire alarm detection and warning system", hactElementCode: "FS-02", expectedLifespanYears: 15, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 21, isActive: true },
      { code: "EMERGENCY_LIGHTING", name: "Emergency Lighting", category: "FIRE_SAFETY", description: "Emergency escape lighting", hactElementCode: "FS-03", expectedLifespanYears: 10, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 22, isActive: true },
      { code: "FIRE_EXTINGUISHER", name: "Fire Extinguisher", category: "FIRE_SAFETY", description: "Portable fire extinguisher", hactElementCode: "FS-04", expectedLifespanYears: 5, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 23, isActive: true },
      { code: "DRY_RISER", name: "Dry Riser", category: "FIRE_SAFETY", description: "Dry riser system for fire brigade access", hactElementCode: "FS-05", expectedLifespanYears: 30, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 6, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 24, isActive: true },
      { code: "SPRINKLER", name: "Sprinkler System", category: "FIRE_SAFETY", description: "Automatic fire sprinkler system", hactElementCode: "FS-06", expectedLifespanYears: 30, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 25, isActive: true },
      
      // Water Components
      { code: "WATER_TANK", name: "Cold Water Storage Tank", category: "WATER", description: "Cold water storage tank", hactElementCode: "WA-01", expectedLifespanYears: 25, relatedCertificateTypes: ["LEGIONELLA"], inspectionFrequencyMonths: 24, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 30, isActive: true },
      { code: "HOT_WATER_CYLINDER", name: "Hot Water Cylinder", category: "WATER", description: "Hot water storage cylinder", hactElementCode: "WA-02", expectedLifespanYears: 15, relatedCertificateTypes: ["LEGIONELLA"], inspectionFrequencyMonths: 24, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 31, isActive: true },
      
      // Access/Lifts
      { code: "PASSENGER_LIFT", name: "Passenger Lift", category: "ACCESS", description: "Passenger lift/elevator", hactElementCode: "AC-01", expectedLifespanYears: 25, relatedCertificateTypes: ["LOLER"], inspectionFrequencyMonths: 6, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 40, isActive: true },
      { code: "STAIRLIFT", name: "Stairlift", category: "ACCESS", description: "Domestic stairlift", hactElementCode: "AC-02", expectedLifespanYears: 15, relatedCertificateTypes: ["LOLER"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 41, isActive: true },
      
      // Ventilation
      { code: "EXTRACTOR_FAN", name: "Extractor Fan", category: "VENTILATION", description: "Bathroom/kitchen extractor fan", hactElementCode: "VE-01", expectedLifespanYears: 10, relatedCertificateTypes: ["EICR"], inspectionFrequencyMonths: 60, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 50, isActive: true },
      { code: "COMMUNAL_VENTILATION", name: "Communal Ventilation System", category: "VENTILATION", description: "Communal mechanical ventilation system", hactElementCode: "VE-02", expectedLifespanYears: 20, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 51, isActive: true },
      
      // Structure/External
      { code: "EXTERNAL_CLADDING", name: "External Cladding", category: "EXTERNAL", description: "External wall cladding system", hactElementCode: "EX-01", expectedLifespanYears: 30, relatedCertificateTypes: ["FIRE_RISK_ASSESSMENT"], inspectionFrequencyMonths: 12, isHighRisk: true, buildingSafetyRelevant: true, displayOrder: 60, isActive: true },
      { code: "BALCONY", name: "Balcony", category: "EXTERNAL", description: "External balcony structure", hactElementCode: "EX-02", expectedLifespanYears: 40, relatedCertificateTypes: [], inspectionFrequencyMonths: 60, isHighRisk: false, buildingSafetyRelevant: true, displayOrder: 61, isActive: true },
      
      // Security
      { code: "DOOR_ENTRY", name: "Door Entry System", category: "SECURITY", description: "Communal door entry/intercom system", hactElementCode: "SE-01", expectedLifespanYears: 15, relatedCertificateTypes: [], inspectionFrequencyMonths: 12, isHighRisk: false, buildingSafetyRelevant: false, displayOrder: 70, isActive: true },
    ];
    
    await db.insert(componentTypes).values(componentTypesData);
    console.log("✓ Created component types");
  }
  
  console.log("✓ Configuration data seeded successfully!");
}

// Seed is exported for use by routes - do not auto-run
// To seed manually, call the /api/seed endpoint or import and call seedDatabase()
