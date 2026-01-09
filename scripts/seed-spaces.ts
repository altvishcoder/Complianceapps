import { db } from "../server/db";
import { spaces, schemes, blocks, properties } from "@shared/schema";

const SPACE_TYPES = ["ROOM", "COMMUNAL_AREA", "UTILITY", "CIRCULATION", "STORAGE", "OTHER"] as const;
const SPACE_NAMES = ["Living Room", "Kitchen", "Bathroom", "Bedroom", "Hallway", "Utility"];
const BLOCK_COMMUNAL_SPACES = [
  { name: "Main Stairwell", type: "CIRCULATION" as const },
  { name: "Plant Room", type: "UTILITY" as const },
  { name: "Lobby", type: "COMMUNAL_AREA" as const },
];
const SCHEME_COMMUNAL_SPACES = [
  { name: "Community Hall", type: "COMMUNAL_AREA" as const },
  { name: "Estate Grounds", type: "OTHER" as const },
];

const BATCH_SIZE = 500;

async function main() {
  console.log("Starting spaces seeding...");
  
  const allSchemes = await db.select({ id: schemes.id }).from(schemes);
  const allBlocks = await db.select({ id: blocks.id }).from(blocks);
  const allProperties = await db.select({ id: properties.id }).from(properties);
  
  console.log(`Found: ${allSchemes.length} schemes, ${allBlocks.length} blocks, ${allProperties.length} properties`);
  
  const values: any[] = [];
  
  for (const scheme of allSchemes) {
    for (const template of SCHEME_COMMUNAL_SPACES) {
      values.push({
        schemeId: scheme.id,
        propertyId: null,
        blockId: null,
        name: template.name,
        spaceType: template.type,
        description: `Estate-wide ${template.name.toLowerCase()}`,
        areaSqMeters: Math.floor(Math.random() * 200) + 50,
      });
    }
  }
  console.log(`Prepared ${allSchemes.length * 2} scheme-level spaces`);
  
  for (const block of allBlocks) {
    for (let i = 0; i < BLOCK_COMMUNAL_SPACES.length; i++) {
      const template = BLOCK_COMMUNAL_SPACES[i];
      values.push({
        blockId: block.id,
        propertyId: null,
        schemeId: null,
        name: template.name,
        spaceType: template.type,
        floor: i === 0 ? "All Floors" : "Ground",
        description: `Building communal ${template.name.toLowerCase()}`,
        areaSqMeters: Math.floor(Math.random() * 30) + 10,
      });
    }
  }
  console.log(`Prepared ${allBlocks.length * 3} block-level spaces`);
  
  const spacesPerProperty = 3;
  for (const property of allProperties) {
    for (let s = 0; s < spacesPerProperty; s++) {
      values.push({
        propertyId: property.id,
        blockId: null,
        schemeId: null,
        name: SPACE_NAMES[s % SPACE_NAMES.length],
        spaceType: SPACE_TYPES[s % SPACE_TYPES.length],
        floor: String(Math.floor(s / 3)),
        areaSqMeters: Math.floor(Math.random() * 20) + 8,
      });
    }
  }
  console.log(`Prepared ${allProperties.length * spacesPerProperty} property-level spaces`);
  
  console.log(`Inserting ${values.length} total spaces in batches of ${BATCH_SIZE}...`);
  let inserted = 0;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(spaces).values(batch);
    inserted += batch.length;
    if (inserted % 5000 === 0) {
      console.log(`  Inserted ${inserted}/${values.length}`);
    }
  }
  
  console.log(`✓ Inserted ${inserted} spaces total`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
