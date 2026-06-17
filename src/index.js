// ============================================
// AI LEAD MACHINE — Main Server
// ============================================

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import 'dotenv/config';

import pool, { setupDatabase, query } from './config/db.js';
import { createCampaign, scrapeCampaign } from './modules/scraper.js';
import { qualifyNewLeads } from './modules/qualifier.js';
import { query as dbQuery } from './config/db.js';
import { buildPendingSites, buildDemoSite } from './modules/siteBuilder.js';
import { initNewSequences, processDueEmails, handleWebhook, handleReply } from './modules/outreach.js';
import { startScheduler, runPipeline } from './scheduler/cron.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// ==========================================
// API ROUTES
// ==========================================

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- CAMPAIGNS ---
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaign = await createCampaign(req.body);
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/campaigns', async (req, res) => {
  const result = await query('SELECT * FROM campaigns ORDER BY created_at DESC');
  res.json(result.rows);
});

// --- LEADS ---
app.get('/api/leads', async (req, res) => {
  const { status, campaign_id, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];

  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  if (campaign_id) { params.push(campaign_id); sql += ` AND campaign_id = $${params.length}`; }

  sql += ' ORDER BY updated_at DESC';
  params.push(parseInt(limit)); sql += ` LIMIT $${params.length}`;
  params.push(parseInt(offset)); sql += ` OFFSET $${params.length}`;

  const result = await query(sql, params);
  res.json(result.rows);
});

// --- DASHBOARD STATS ---
app.get('/api/stats', async (req, res) => {
  try {
    const [leads, qualified, demos, contacted, replied, today] = await Promise.all([
      query('SELECT count(*) FROM leads'),
      query("SELECT count(*) FROM leads WHERE qualification = 'qualified'"),
      query('SELECT count(*) FROM leads WHERE demo_site_built = true'),
      query("SELECT count(*) FROM leads WHERE status = 'contacted'"),
      query("SELECT count(*) FROM leads WHERE status = 'replied'"),
      query('SELECT count(*) FROM emails_sent WHERE created_at >= CURRENT_DATE'),
    ]);

    res.json({
      total_leads: parseInt(leads.rows[0].count),
      qualified: parseInt(qualified.rows[0].count),
      demos_built: parseInt(demos.rows[0].count),
      contacted: parseInt(contacted.rows[0].count),
      replied: parseInt(replied.rows[0].count),
      emails_today: parseInt(today.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ACTIVITY LOG ---
app.get('/api/activity', async (req, res) => {
  const { limit = 50 } = req.query;
  const result = await query(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1',
    [parseInt(limit)]
  );
  res.json(result.rows);
});

// --- MANUAL TRIGGERS ---

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
});
app.post('/api/run/scrape', async (req, res) => {
  try {
    const { campaign_id } = req.body;
    if (campaign_id) {
      const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaign_id]);
      if (campaign.rows.length) {
        await scrapeCampaign(campaign.rows[0]);
        return res.json({ success: true, message: 'Campaign scraped' });
      }
    }
    res.json({ success: true, message: 'Use campaign_id to scrape a specific campaign' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run/qualify', async (req, res) => {
  try {
    const result = await qualifyNewLeads(req.body.limit || 20);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run/build-sites', async (req, res) => {
  try {
    const count = await buildPendingSites(req.body.limit || 5);
    res.json({ success: true, built: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/run/outreach', async (req, res) => {
  try {
    const newSeqs = await initNewSequences();
    const sent = await processDueEmails();
    res.json({ success: true, new_sequences: newSeqs, emails_sent: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


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
});

app.post('/api/run/full-pipeline', async (req, res) => {
  try {
    res.json({ success: true, message: 'Pipeline started in background' });
    runPipeline(); // runs async in background
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// WEBHOOKS (Resend)
// ==========================================

app.post('/webhooks/resend', async (req, res) => {
  try {
    await handleWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Inbound email handler (reply detection)
app.post('/webhooks/reply', async (req, res) => {
  try {
    // Extract lead ID from the reply-to address
    const to = req.body.to || '';
    const match = to.match(/reply\+([a-z0-9-]+)@/);
    if (match) {
      await handleReply(match[1]);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Reply error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DEMO SITE SERVING (fallback when no Vercel)
// ==========================================

app.get('/demo/:siteId', async (req, res) => {
  try {
    const result = await query(
      'SELECT html_content, expires_at FROM demo_sites WHERE id = $1',
      [req.params.siteId]
    );

    if (!result.rows.length) {
      return res.status(404).send('<h1>Demo site not found</h1>');
    }

    const site = result.rows[0];
    if (site.expires_at && new Date(site.expires_at) < new Date()) {
      return res.status(410).send('<h1>This demo has expired</h1>');
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(site.html_content);
  } catch (err) {
    res.status(500).send('Error loading demo site');
  }
});

// ==========================================
// START SERVER
// ==========================================

async function start() {
  try {
    // Setup database tables
    await setupDatabase();
    console.log('[Server] Database ready');

    // Start Express
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] API docs:`);
      console.log(`  GET  /api/health          - Health check`);
      console.log(`  GET  /api/stats           - Dashboard stats`);
      console.log(`  GET  /api/leads           - List leads`);
      console.log(`  GET  /api/campaigns       - List campaigns`);
      console.log(`  GET  /api/activity        - Activity log`);
      console.log(`  POST /api/campaigns       - Create campaign`);
      console.log(`  POST /api/run/scrape      - Manual scrape`);
      console.log(`  POST /api/run/qualify      - Manual qualify`);
      console.log(`  POST /api/run/build-sites  - Manual site build`);
      console.log(`  POST /api/run/outreach     - Manual outreach`);
      console.log(`  POST /api/run/full-pipeline - Run full pipeline`);
    });

    // Manual mode — no auto-scheduling
    console.log('[Server] Manual mode — use dashboard buttons');

  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
