// ============================================
// SEED: Create starter campaigns for testing
// Run: node src/db/seed.js
// ============================================

import { createCampaign } from '../modules/scraper.js';
import { setupDatabase } from '../config/db.js';
import 'dotenv/config';

const STARTER_CAMPAIGNS = [
  {
    name: 'dentists-austin-tx',
    niche: 'dentists',
    keywords: ['dentist', 'dental clinic', 'dental office', 'family dentist', 'cosmetic dentist'],
    city: 'Austin',
    region: 'TX',
    countryCode: 'US',
    radiusKm: 25,
    sendLimit: 15,
  },
  {
    name: 'plumbers-exeter-uk',
    niche: 'plumbers',
    keywords: ['plumber', 'plumbing services', 'emergency plumber', 'heating engineer'],
    city: 'Exeter',
    region: 'Devon',
    countryCode: 'GB',
    radiusKm: 20,
    sendLimit: 10,
  },
  {
    name: 'restaurants-nashik-in',
    niche: 'restaurants',
    keywords: ['restaurant', 'cafe', 'dining', 'family restaurant'],
    city: 'Nashik',
    region: 'Maharashtra',
    countryCode: 'IN',
    radiusKm: 15,
    sendLimit: 10,
  },
];

async function seed() {
  await setupDatabase();
  console.log('\n[Seed] Creating starter campaigns...\n');

  for (const config of STARTER_CAMPAIGNS) {
    const campaign = await createCampaign(config);
    console.log(`  Created: ${campaign.name} (${campaign.id})`);
  }

  console.log('\n[Seed] Done! Run `npm start` to begin the pipeline.\n');
}

seed()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
