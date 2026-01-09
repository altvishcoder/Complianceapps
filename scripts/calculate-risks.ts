import { db } from '../server/db';
import { properties } from '@shared/schema';
import { calculateAllPropertyRisks } from '../server/services/risk-scoring';

async function main() {
  console.log('Starting risk score calculation...');
  
  try {
    const stats = await calculateAllPropertyRisks('default-org');
    console.log('Risk calculation complete:', stats);
  } catch (error) {
    console.error('Error calculating risks:', error);
  }
  
  process.exit(0);
}

main();
