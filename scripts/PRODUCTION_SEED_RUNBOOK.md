# Production Seed Runbook

This document describes how to seed demo/test data into a production or staging environment.

## Overview

The SocialComply platform includes comprehensive seeding infrastructure to generate realistic UK social housing compliance data at scale. This includes:

- **Properties**: UKHDS 5-level hierarchy (Scheme → Block → Property → Space → Component)
- **Certificates**: Compliance certificates across 16 streams (Gas, Electrical, Fire, Asbestos, etc.)
- **Remedial Actions**: Actions linked to certificates with UK legislation references
- **Risk Snapshots**: Pre-calculated risk scores for each property
- **Contractors & Staff**: Service providers and housing staff

## Seed Tiers

| Tier   | Properties | Components | Certificates | Remedials | Est. Time |
|--------|-----------|------------|--------------|-----------|-----------|
| Small  | ~2,000    | ~8,000     | ~6,000       | ~4,800    | ~2 min    |
| Medium | ~10,000   | ~50,000    | ~100,000     | ~75,000   | ~5 min    |
| Large  | ~50,000   | ~500,000   | ~1,000,000   | ~750,000  | ~30 min   |

## Prerequisites

1. **Database Access**: Ensure DATABASE_URL is set to your target database
2. **Organisation**: The `default-org` organisation must exist
3. **Node.js**: Ensure tsx is available (`npx tsx`)

## Seeding Commands

### Option 1: Via Admin UI (Recommended)

1. Log in as Super Admin: `superadmin@complianceai.co.uk / SuperAdmin2025!`
2. Navigate to **Admin → Factory Settings → Demo Data**
3. Select desired tier (Small/Medium/Large)
4. Click **Start Bulk Seeding**
5. Monitor progress in the UI

### Option 2: Via CLI Script

```bash
# Set the target database
export DATABASE_URL="your-production-database-url"
export NODE_ENV=production

# Run bulk seed with specific tier (small/medium/large)
npx tsx server/run-bulk-seed.ts --tier=large

# For deterministic seeding (reproducible results)
npx tsx server/run-bulk-seed.ts --tier=medium --seed=prod2026
```

### Option 3: Direct API Call

```bash
# Start bulk seeding (requires authentication)
curl -X POST "https://your-app.replit.app/api/admin/bulk-seed/start" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"tier": "medium"}'

# Check progress
curl "https://your-app.replit.app/api/admin/bulk-seed/progress" \
  -H "Cookie: your-session-cookie"
```

## Adding Missing Data

If you need to add specific missing data types without full re-seed:

```bash
# Add missing spaces to existing properties
curl -X POST "https://your-app.replit.app/api/admin/seed-spaces" \
  -H "Cookie: your-session-cookie"
```

## Data Wipe (Caution)

To clear all data before fresh seeding:

```bash
# Via UI: Admin → Factory Settings → Demo Data → Wipe All Data
# Via API:
curl -X POST "https://your-app.replit.app/api/admin/wipe?includeProperties=true" \
  -H "Cookie: your-session-cookie"
```

## Post-Seeding Steps

After seeding, you should:

1. **Calculate Risk Scores**: Navigate to Risk Radar → Click "Recalculate All"
2. **Refresh Materialized Views**: Admin → System Health → Database Optimization → Refresh All Views
3. **Verify Data**: Check Property Hierarchy page shows expected counts

## Seed Files Location

Key seeding files in the codebase:

| File | Purpose |
|------|---------|
| `server/demo-data/bulk-seeder.ts` | Main bulk seeding logic with tier configs |
| `server/run-bulk-seed.ts` | CLI script for running bulk seed |
| `server/seed.ts` | Database initialization and config seeding |
| `server/demo-data/comprehensive-seed.ts` | Small demo data generation |

## Deterministic Seeding

For reproducible test data (same data every time):

1. Pass `--seed=<value>` parameter to CLI script
2. All random values will be deterministic based on seed
3. Useful for regression testing and consistent staging environments

## Troubleshooting

### "Organisation not found"
Run the base seed first: `npx tsx server/seed.ts`

### Seeding too slow
- Use smaller tier for initial testing
- Increase database connection pool size
- Consider running during off-peak hours

### Out of memory
- Use streaming/batched approach (already implemented)
- Reduce batch size in bulk-seeder.ts

## Contact

For issues with seeding infrastructure, check the system logs at Admin → Monitoring → System Health.
