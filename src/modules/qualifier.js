// ============================================
// MODULE 2: AI LEAD QUALIFIER
// Analyzes websites with Claude, scores 1-10
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../config/db.js';
import { PROMPTS } from '../prompts/index.js';
import 'dotenv/config';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Fetch and parse a website's HTML ---
async function fetchWebsite(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0)' },
    });
    const $ = cheerio.load(res.data);

    // Remove scripts and styles for cleaner analysis
    $('script, style, noscript, iframe').remove();

    return {
      html: $.html().slice(0, 3000), // first 3k chars for Claude
      title: $('title').text().trim(),
      hasHttps: url.startsWith('https'),
      hasMobileViewport: !!$('meta[name="viewport"]').length,
      hasContactInfo: !!($.text().match(/(\d{3}[-.)]\s?\d{3}[-.)]\s?\d{4})|@|contact/i)),
      wordCount: $.text().split(/\s+/).length,
      imageCount: $('img').length,
    };
  } catch (err) {
    return { html: null, error: err.message };
  }
}

// --- Score a single lead with Claude ---
async function qualifyLead(lead) {
  console.log(`  Qualifying: ${lead.business_name}`);

  // Fetch website if it exists
  let websiteData = {};
  if (lead.website_url) {
    websiteData = await fetchWebsite(lead.website_url);
  }

  // Build lead object with website data
  const enrichedLead = {
    ...lead,
    website_html: websiteData.html || null,
  };

  // No website = auto-qualify at 10
  if (!lead.website_url) {
    await query(`
      UPDATE leads SET
        website_score = 10,
        ai_analysis = 'No website exists — highest priority lead',
        qualification = 'qualified',
        status = 'qualified',
        updated_at = now()
      WHERE id = $1
    `, [lead.id]);

    await logActivity('qualify', lead.campaign_id, lead.id,
      `Auto-qualified (no website): ${lead.business_name}`, { score: 10 });
    return { score: 10, qualified: true };
  }

  // Website unreachable = score 9
  if (websiteData.error) {
    await query(`
      UPDATE leads SET
        website_score = 9,
        ai_analysis = $1,
        qualification = 'qualified',
        status = 'qualified',
        updated_at = now()
      WHERE id = $2
    `, [`Website unreachable: ${websiteData.error}`, lead.id]);

    await logActivity('qualify', lead.campaign_id, lead.id,
      `Qualified (site down): ${lead.business_name}`, { score: 9 });
    return { score: 9, qualified: true };
  }

  // Ask Claude to analyze
  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: PROMPTS.qualifyLead(enrichedLead) }],
    });

    let text = response.content[0].text.trim();
    if (text.startsWith('`' + '`' + '`')) {
      text = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const result = JSON.parse(text);

    await query(`
      UPDATE leads SET
        website_score = $1,
        ai_analysis = $2,
        qualification = $3,
        status = $4,
        updated_at = now()
      WHERE id = $5
    `, [
      result.score,
      result.summary,
      result.qualified ? 'qualified' : 'rejected',
      result.qualified ? 'qualified' : 'archived',
      lead.id,
    ]);

    await logActivity('qualify', lead.campaign_id, lead.id,
      `${result.qualified ? 'Qualified' : 'Rejected'} (${result.score}/10): ${lead.business_name}`,
      { score: result.score, issues: result.issues });

    return result;
  } catch (err) {
    console.error(`  Claude error for ${lead.business_name}:`, err.message);
    return { score: 0, qualified: false, error: err.message };
  }
}

// --- Process all unqualified leads ---
export async function qualifyNewLeads(limit = 20) {
  const res = await query(`
    SELECT * FROM leads
    WHERE qualification = 'pending'
    ORDER BY created_at ASC
    LIMIT $1
  `, [limit]);

  console.log(`[Qualifier] Processing ${res.rows.length} leads`);

  let qualified = 0;
  let rejected = 0;

  for (const lead of res.rows) {
    const result = await qualifyLead(lead);
    if (result.qualified) qualified++;
    else rejected++;

    // Small delay between Claude calls
    await new Promise(r => setTimeout(r, 15000)); // 15s delay for rate limit (5 req/min)
  }

  console.log(`[Qualifier] Qualified: ${qualified}, Rejected: ${rejected}`);
  return { qualified, rejected };
}

// --- Get qualified leads ready for demo site ---
export async function getQualifiedLeads(limit = 10) {
  const res = await query(`
    SELECT * FROM leads
    WHERE qualification = 'qualified'
      AND demo_site_built = false
    ORDER BY website_score DESC, created_at ASC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

async function logActivity(type, campaignId, leadId, message, metadata = {}) {
  await query(`
    INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
    VALUES ($1,$2,$3,$4,$5)
  `, [type, campaignId, leadId, message, JSON.stringify(metadata)]);
}

// --- Run standalone ---
if (process.argv[1]?.includes('qualifier')) {
  qualifyNewLeads()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}


