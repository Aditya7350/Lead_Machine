// ============================================
// SCHEDULER: Runs the full pipeline automatically
// ============================================

import { CronJob } from 'cron';
import { scrapeAllActive } from '../modules/scraper.js';
import { qualifyNewLeads } from '../modules/qualifier.js';
import { buildPendingSites } from '../modules/siteBuilder.js';
import { initNewSequences, processDueEmails } from '../modules/outreach.js';

let running = false;

// --- Full pipeline cycle ---
async function runPipeline() {
  if (running) {
    console.log('[Scheduler] Pipeline already running, skipping');
    return;
  }
  running = true;
  const start = Date.now();
  console.log('\n[Scheduler] === Pipeline cycle started ===');

  try {
    // Step 1: Scrape new leads
    console.log('\n[Step 1] Scraping leads...');
    await scrapeAllActive();

    // Step 2: Qualify new leads with AI
    console.log('\n[Step 2] Qualifying leads...');
    await qualifyNewLeads(4); // small batches to stay under rate limits

    // Step 3: Build demo sites
    console.log('\n[Step 3] Building demo sites...');
    await buildPendingSites(2); // small batches for rate limits

    // Step 4: Start new email sequences
    console.log('\n[Step 4] Starting new sequences...');
    await initNewSequences();

    // Step 5: Send due emails
    console.log('\n[Step 5] Sending due emails...');
    await processDueEmails();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n[Scheduler] === Pipeline completed in ${elapsed}s ===\n`);
  } catch (err) {
    console.error('[Scheduler] Pipeline error:', err.message);
  } finally {
    running = false;
  }
}

// --- Just process emails (runs more frequently) ---
async function emailCheck() {
  if (running) return;
  try {
    await processDueEmails();
  } catch (err) {
    console.error('[Scheduler] Email check error:', err.message);
  }
}

// --- Start all cron jobs ---
export function startScheduler() {
  console.log('[Scheduler] Starting cron jobs...');

  // Full pipeline: runs every 6 hours (4x/day)
  const pipelineJob = new CronJob('0 */6 * * *', runPipeline);
  pipelineJob.start();
  console.log('  Pipeline: every 6 hours');

  // Email check: runs every hour (catches due follow-ups)
  const emailJob = new CronJob('0 * * * *', emailCheck);
  emailJob.start();
  console.log('  Email check: every hour');

  // Initial run on startup (after 10s delay for DB connection)
  setTimeout(() => {
    console.log('[Scheduler] Running initial pipeline...');
    runPipeline();
  }, 10000);

  return { pipelineJob, emailJob };
}

// --- Run a manual cycle ---
export { runPipeline };

// Run standalone
if (process.argv[1]?.includes('cron')) {
  startScheduler();
}
