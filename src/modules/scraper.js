// ============================================
// MODULE 1: LEAD SCRAPER
// Finds local businesses via Google Maps Places API
// ============================================

import axios from 'axios';
import { query } from '../config/db.js';
import 'dotenv/config';

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_URL = 'https://maps.googleapis.com/maps/api/place';

// --- Search for businesses using a keyword + location ---
async function searchPlaces(keyword, city, country, radiusKm = 25) {
  // Step 1: Geocode the city to get lat/lng
  const geoRes = await axios.get(`${PLACES_URL}/findplacefromtext/json`, {
    params: {
      input: `${city}, ${country}`,
      inputtype: 'textquery',
      fields: 'geometry',
      key: MAPS_KEY,
    },
  });

  const location = geoRes.data.candidates?.[0]?.geometry?.location;
  if (!location) {
    console.log(`[Scraper] Could not geocode: ${city}, ${country}`);
    return [];
  }

  // Step 2: Text search for businesses
  const results = [];
  let pageToken = null;

  do {
    const params = {
      query: `${keyword} in ${city}`,
      location: `${location.lat},${location.lng}`,
      radius: radiusKm * 1000,
      key: MAPS_KEY,
    };
    if (pageToken) params.pagetoken = pageToken;

    const res = await axios.get(`${PLACES_URL}/textsearch/json`, { params });
    results.push(...(res.data.results || []));
    pageToken = res.data.next_page_token;

    // Google requires a short delay before using next_page_token
    if (pageToken) await sleep(2000);
  } while (pageToken && results.length < 60); // max ~60 per keyword

  return results;
}

// --- Get detailed info for a single place ---
async function getPlaceDetails(placeId) {
  const res = await axios.get(`${PLACES_URL}/details/json`, {
    params: {
      place_id: placeId,
      fields: 'name,formatted_phone_number,website,formatted_address,geometry,rating,user_ratings_total,business_status',
      key: MAPS_KEY,
    },
  });
  return res.data.result;
}

// --- Main: scrape leads for a campaign ---
export async function scrapeCampaign(campaign) {
  console.log(`[Scraper] Running campaign: ${campaign.name}`);
  const allPlaces = [];

  // Search each keyword variation
  for (const keyword of campaign.keywords) {
    console.log(`  Searching: "${keyword}" in ${campaign.city}, ${campaign.country_code}`);
    const places = await searchPlaces(keyword, campaign.city, campaign.country_code, campaign.radius_km);
    allPlaces.push(...places);
    await sleep(500); // rate limit between keywords
  }

  // Deduplicate by place_id
  const uniquePlaces = new Map();
  for (const place of allPlaces) {
    if (!uniquePlaces.has(place.place_id)) {
      uniquePlaces.set(place.place_id, place);
    }
  }
  console.log(`  Found ${uniquePlaces.size} unique businesses (from ${allPlaces.length} total)`);

  // Store each lead
  let newCount = 0;
  for (const [placeId, place] of uniquePlaces) {
    try {
      // Skip if already in DB
      const existing = await query('SELECT id FROM leads WHERE google_place_id = $1', [placeId]);
      if (existing.rows.length > 0) continue;

      // Get detailed info (phone, website, etc)
      const details = await getPlaceDetails(placeId);
      if (!details) continue;
      if (details.business_status === 'CLOSED_PERMANENTLY') continue;

      await query(`
        INSERT INTO leads (campaign_id, google_place_id, business_name, niche, phone,
          website_url, address, city, country_code, latitude, longitude,
          google_rating, review_count, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'new')
        ON CONFLICT (google_place_id) DO NOTHING
      `, [
        campaign.id,
        placeId,
        details.name,
        campaign.niche,
        details.formatted_phone_number || null,
        details.website || null,
        details.formatted_address || null,
        campaign.city,
        campaign.country_code,
        details.geometry?.location?.lat,
        details.geometry?.location?.lng,
        details.rating || null,
        details.user_ratings_total || 0,
      ]);
      newCount++;

      // Log activity
      await query(`
        INSERT INTO activity_log (type, campaign_id, message, metadata)
        VALUES ('scrape', $1, $2, $3)
      `, [campaign.id, `Found: ${details.name}`, JSON.stringify({ place_id: placeId })]);

      await sleep(200); // rate limit for Place Details API
    } catch (err) {
      console.error(`  Error processing ${place.name}:`, err.message);
    }
  }

  // Update campaign last_run_at
  await query('UPDATE campaigns SET last_run_at = now() WHERE id = $1', [campaign.id]);

  console.log(`  Stored ${newCount} new leads`);
  return newCount;
}

// --- Scrape all active campaigns ---
export async function scrapeAllActive() {
  const res = await query("SELECT * FROM campaigns WHERE status = 'active'");
  let totalNew = 0;
  for (const campaign of res.rows) {
    const count = await scrapeCampaign(campaign);
    totalNew += count;
  }
  console.log(`[Scraper] Total new leads across all campaigns: ${totalNew}`);
  return totalNew;
}

// --- Helper: seed a campaign ---
export async function createCampaign({ name, niche, keywords, city, region, countryCode, radiusKm, sendLimit }) {
  const res = await query(`
    INSERT INTO campaigns (name, niche, keywords, city, region, country_code, radius_km, send_limit)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [name, niche, keywords, city, region || null, countryCode || 'US', radiusKm || 25, sendLimit || 15]);
  console.log(`[Scraper] Created campaign: ${res.rows[0].name}`);
  return res.rows[0];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- Run standalone ---
if (process.argv[1]?.includes('scraper')) {
  scrapeAllActive()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
