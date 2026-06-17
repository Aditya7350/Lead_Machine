// ============================================
// MODULE 4: OUTREACH ENGINE
// Personalized emails + automated follow-ups
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { query } from '../config/db.js';
import { PROMPTS } from '../prompts/index.js';
import 'dotenv/config';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@youragency.com';
const FROM_NAME = process.env.FROM_NAME || 'Your Agency';
const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '30');

// Stage delays in hours
const STAGE_DELAYS = {
  1: 0,    // immediately after demo is built
  2: 72,   // 3 days after email 1
  3: 168,  // 7 days after email 1 (4 days after email 2)
};

// --- Generate email content using Claude ---
async function generateEmail(lead, stage) {
  const promptFn = {
    1: PROMPTS.emailFirstTouch,
    2: PROMPTS.emailFollowUp1,
    3: PROMPTS.emailFinalFollowUp,
  }[stage];

  if (!promptFn) throw new Error(`Invalid email stage: ${stage}`);

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: promptFn(lead) }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Claude sometimes wraps in markdown
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// --- Find or extract a business email ---
function getLeadEmail(lead) {
  // Priority: stored email > constructed from website domain
  if (lead.email) return lead.email;

  if (lead.website_url) {
    try {
      const domain = new URL(lead.website_url).hostname.replace('www.', '');
      // Common patterns for small businesses
      return `info@${domain}`;
    } catch { /* ignore */ }
  }

  return null;
}

// --- Send a single email via Resend ---
async function sendEmail(lead, emailContent, stage, sequenceId) {
  const toEmail = getLeadEmail(lead);
  if (!toEmail) {
    console.log(`  No email for: ${lead.business_name}, skipping`);
    return null;
  }

  const replyTo = `${process.env.REPLY_TO_PREFIX || 'reply+'}${lead.id}@${FROM_EMAIL.split('@')[1]}`;

  try {
    const sent = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [toEmail],
      subject: emailContent.subject,
      html: emailContent.body,
      replyTo: replyTo,
      tags: [
        { name: 'lead_id', value: lead.id },
        { name: 'stage', value: String(stage) },
        { name: 'campaign_id', value: lead.campaign_id || '' },
      ],
    });

    // Record in DB
    await query(`
      INSERT INTO emails_sent (sequence_id, lead_id, stage, resend_id, subject, body_html, from_email, to_email, reply_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [sequenceId, lead.id, stage, sent.data?.id, emailContent.subject, emailContent.body, FROM_EMAIL, toEmail, replyTo]);

    console.log(`  Sent email #${stage} to ${toEmail} (${lead.business_name})`);
    return sent;
  } catch (err) {
    console.error(`  Send failed for ${lead.business_name}:`, err.message);
    return null;
  }
}

// --- Start a new email sequence for a lead ---
export async function startSequence(lead) {
  // Check if sequence already exists
  const existing = await query('SELECT id FROM email_sequences WHERE lead_id = $1', [lead.id]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  // Create sequence
  const res = await query(`
    INSERT INTO email_sequences (lead_id, campaign_id, current_stage, status, next_send_at)
    VALUES ($1, $2, 1, 'active', now())
    RETURNING id
  `, [lead.id, lead.campaign_id]);

  return res.rows[0].id;
}

// --- Process a single sequence step ---
async function processSequenceStep(sequence) {
  const lead = await query('SELECT * FROM leads WHERE id = $1', [sequence.lead_id]);
  if (!lead.rows.length) return;
  const leadData = lead.rows[0];

  const stage = sequence.current_stage;
  console.log(`  Processing stage ${stage} for: ${leadData.business_name}`);

  // Generate email
  const emailContent = await generateEmail(leadData, stage);

  // Send it
  const sent = await sendEmail(leadData, emailContent, stage, sequence.id);
  if (!sent) {
    // No email or send failed — skip to next stage or complete
    await query(`
      UPDATE email_sequences SET
        current_stage = current_stage + 1,
        status = CASE WHEN current_stage >= max_stages THEN 'completed' ELSE status END,
        next_send_at = CASE WHEN current_stage < max_stages
          THEN now() + ($1 || ' hours')::interval
          ELSE null END,
        updated_at = now()
      WHERE id = $2
    `, [String(STAGE_DELAYS[stage + 1] || 72), sequence.id]);
    return;
  }

  // Update sequence state
  const nextStage = stage + 1;
  const isComplete = nextStage > sequence.max_stages;

  await query(`
    UPDATE email_sequences SET
      current_stage = $1,
      status = $2,
      next_send_at = $3,
      updated_at = now()
    WHERE id = $4
  `, [
    nextStage,
    isComplete ? 'completed' : 'active',
    isComplete ? null : new Date(Date.now() + (STAGE_DELAYS[nextStage] || 72) * 3600000),
    sequence.id,
  ]);

  // Update lead status
  await query("UPDATE leads SET status = 'contacted', updated_at = now() WHERE id = $1", [leadData.id]);

  // Log
  await query(`
    INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
    VALUES ('email', $1, $2, $3, $4)
  `, [leadData.campaign_id, leadData.id,
    `Email #${stage} sent to ${leadData.business_name}`,
    JSON.stringify({ subject: emailContent.subject, stage })]);
}

// --- Process all due sequences ---
export async function processDueEmails() {
  // Check daily limit
  const todayCount = await query(`
    SELECT count(*) FROM emails_sent
    WHERE created_at >= CURRENT_DATE
  `);
  const sentToday = parseInt(todayCount.rows[0].count);

  if (sentToday >= DAILY_LIMIT) {
    console.log(`[Outreach] Daily limit reached (${sentToday}/${DAILY_LIMIT})`);
    return 0;
  }

  const remaining = DAILY_LIMIT - sentToday;

  // Get due sequences
  const res = await query(`
    SELECT * FROM email_sequences
    WHERE status = 'active'
      AND next_send_at <= now()
    ORDER BY next_send_at ASC
    LIMIT $1
  `, [remaining]);

  console.log(`[Outreach] Processing ${res.rows.length} due emails (${sentToday} sent today)`);

  let processed = 0;
  for (const seq of res.rows) {
    await processSequenceStep(seq);
    processed++;
    await new Promise(r => setTimeout(r, 15000)); // 15s delay for rate limit
  }

  return processed;
}

// --- Start sequences for all demo-built leads not yet contacted ---
export async function initNewSequences() {
  const res = await query(`
    SELECT l.* FROM leads l
    LEFT JOIN email_sequences es ON es.lead_id = l.id
    WHERE l.demo_site_built = true
      AND l.status = 'demo_built'
      AND es.id IS NULL
    LIMIT 20
  `);

  console.log(`[Outreach] Starting ${res.rows.length} new sequences`);

  for (const lead of res.rows) {
    await startSequence(lead);
  }
  return res.rows.length;
}

// --- Handle reply webhook (call from Express route) ---
export async function handleReply(leadId) {
  // Pause the sequence
  await query(`
    UPDATE email_sequences SET status = 'replied', updated_at = now()
    WHERE lead_id = $1 AND status = 'active'
  `, [leadId]);

  // Update lead
  await query("UPDATE leads SET status = 'replied', updated_at = now() WHERE id = $1", [leadId]);

  // Log
  const lead = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (lead.rows.length) {
    await query(`
      INSERT INTO activity_log (type, campaign_id, lead_id, message)
      VALUES ('reply', $1, $2, $3)
    `, [lead.rows[0].campaign_id, leadId, `REPLY from ${lead.rows[0].business_name}!`]);
  }

  console.log(`[Outreach] Reply detected for lead ${leadId} — sequence paused`);
}

// --- Handle email tracking webhooks ---
export async function handleWebhook(event) {
  const { type, data } = event;
  const emailId = data?.email_id;
  if (!emailId) return;

  const email = await query('SELECT * FROM emails_sent WHERE resend_id = $1', [emailId]);
  if (!email.rows.length) return;

  const updates = {
    'email.opened': { status: 'opened', field: 'opened_at' },
    'email.clicked': { status: 'clicked', field: 'clicked_at' },
    'email.bounced': { status: 'bounced', field: 'bounced_at' },
  };

  const update = updates[type];
  if (update) {
    await query(`
      UPDATE emails_sent SET status = $1, ${update.field} = now() WHERE resend_id = $2
    `, [update.status, emailId]);
  }
}

// --- Run standalone ---
if (process.argv[1]?.includes('outreach')) {
  (async () => {
    await initNewSequences();
    await processDueEmails();
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
}
