// ============================================
// RUN ONCE: node update-server.js
// Adds:
//   1. Quick scrape endpoint (city/country/niche form)
//   2. Single-lead actions (qualify, build, email one lead)
//   3. Removes auto-scheduler (manual only)
// ============================================

import { readFileSync, writeFileSync } from 'fs';
const green = (t) => `\x1b[32m${t}\x1b[0m`;

console.log('\n' + green('=== Updating Server ===') + '\n');

let code = readFileSync('src/index.js', 'utf-8');

// --- 1. Add single-lead imports ---
if (!code.includes('buildDemoSite')) {
  code = code.replace(
    "import { buildPendingSites } from './modules/siteBuilder.js';",
    "import { buildPendingSites, buildDemoSite } from './modules/siteBuilder.js';"
  );
  console.log(green('✓') + ' Added buildDemoSite import');
}

if (!code.includes('qualifyNewLeads, getQualifiedLeads')) {
  code = code.replace(
    "import { qualifyNewLeads } from './modules/qualifier.js';",
    "import { qualifyNewLeads } from './modules/qualifier.js';\nimport { query as dbQuery } from './config/db.js';"
  );
}

// --- 2. Add quick-scrape endpoint ---
const quickScrapeRoute = `
// --- QUICK SCRAPE (from dashboard form) ---
app.post('/api/quick-scrape', async (req, res) => {
  try {
    const { city, country_code, niche, keywords, radius_km } = req.body;
    if (!city || !niche) return res.status(400).json({ error: 'city and niche required' });

    const name = (niche + '-' + city + '-' + country_code).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const kw = keywords || [niche];

    // Create campaign and scrape immediately
    const campaign = await createCampaign({
      name, niche, keywords: kw, city,
      countryCode: country_code || 'US',
      radiusKm: radius_km || 25,
      sendLimit: 15
    });

    res.json({ success: true, campaign, message: 'Scraping started...' });

    // Scrape in background
    scrapeCampaign(campaign).then(() => {
      console.log('[QuickScrape] Done: ' + name);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

if (!code.includes('quick-scrape')) {
  code = code.replace(
    "// --- MANUAL TRIGGERS ---",
    "// --- MANUAL TRIGGERS ---\n" + quickScrapeRoute
  );
  console.log(green('✓') + ' Added /api/quick-scrape endpoint');
}

// --- 3. Add single-lead action endpoints ---
const singleLeadRoutes = `
// --- SINGLE LEAD ACTIONS ---
app.post('/api/leads/:id/qualify', async (req, res) => {
  try {
    const { qualifyNewLeads: qualifyBatch } = await import('./modules/qualifier.js');
    // Mark just this lead as pending, then qualify
    await query("UPDATE leads SET qualification = 'pending' WHERE id = $1", [req.params.id]);
    const result = await qualifyBatch(1);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/:id/build-demo', async (req, res) => {
  try {
    const lead = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const result = await buildDemoSite(lead.rows[0]);
    res.json({ success: true, url: result?.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/:id/send-email', async (req, res) => {
  try {
    const { startSequence, processDueEmails: sendDue } = await import('./modules/outreach.js');
    const lead = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead.rows.length) return res.status(404).json({ error: 'Lead not found' });
    await startSequence(lead.rows[0]);
    const sent = await sendDue();
    res.json({ success: true, emails_sent: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (!lead.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const emails = await query('SELECT * FROM emails_sent WHERE lead_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const demo = await query('SELECT deploy_url, created_at FROM demo_sites WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    res.json({ ...lead.rows[0], emails: emails.rows, demo: demo.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

if (!code.includes("leads/:id/qualify")) {
  code = code.replace(
    "app.post('/api/run/full-pipeline'",
    singleLeadRoutes + "\n\napp.post('/api/run/full-pipeline'"
  );
  console.log(green('✓') + ' Added single-lead action endpoints');
}

// --- 4. Remove auto-scheduler, keep manual routes ---
if (code.includes('startScheduler()')) {
  code = code.replace(
    '    // Start cron scheduler\n    startScheduler();\n',
    '    // Manual mode — no auto-scheduling\n    console.log(\'[Server] Manual mode — use dashboard buttons\');\n'
  );
  console.log(green('✓') + ' Removed auto-scheduler (manual only)');
}

writeFileSync('src/index.js', code);
console.log(green('\n✓ Server updated!') + '\n');
