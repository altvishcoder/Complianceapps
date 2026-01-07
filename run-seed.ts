import { runBulkSeed, getProgress, VOLUME_CONFIGS, calculateTotals } from './server/demo-data/bulk-seeder';
import { storage } from './server/storage';

async function main() {
  const tier = 'medium';
  const config = VOLUME_CONFIGS[tier];
  const totals = calculateTotals(config);
  
  console.log('Wiping existing data first...');
  await storage.wipeData(true);
  console.log('Data wiped successfully.');
  console.log('');
  
  console.log('Starting medium tier bulk seeding...');
  console.log(`This will generate ~${totals.total.toLocaleString()} records.`);
  console.log('');
  
  // Monitor progress in background
  const interval = setInterval(() => {
    const progress = getProgress();
    if (progress.status === 'running') {
      const eta = progress.estimatedTimeRemaining 
        ? `ETA: ${Math.floor(progress.estimatedTimeRemaining / 60)}m ${progress.estimatedTimeRemaining % 60}s`
        : '';
      console.log(`[${progress.percentage}%] ${progress.currentEntity}: ${progress.currentCount.toLocaleString()}/${progress.totalCount.toLocaleString()} ${eta}`);
    }
  }, 10000);
  
  try {
    await runBulkSeed(tier, 'default-org');
    clearInterval(interval);
    
    const progress = getProgress();
    console.log('');
    console.log('✅ Bulk seeding completed successfully!');
    console.log('Entity counts:');
    Object.entries(progress.entities).forEach(([key, val]) => {
      console.log(`  ${key}: ${val.done.toLocaleString()}`);
    });
    process.exit(0);
  } catch (error) {
    clearInterval(interval);
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

main();
