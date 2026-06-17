// ============================================
// RUN ONCE: node fix-issues.js
// Fixes:
//   1. JSON parsing (Claude wraps in ```json)
//   2. Rate limiting (increase delay to 15s)
//   3. Vercel errors (skip if no valid token)
// ============================================

import { readFileSync, writeFileSync } from 'fs';

const green = (t) => `\x1b[32m${t}\x1b[0m`;

function patch(file, find, replace, label) {
  let code = readFileSync(file, 'utf-8');
  if (code.includes(find)) {
    code = code.replace(find, replace);
    writeFileSync(file, code);
    console.log(green('✓') + ' ' + label);
    return true;
  }
  console.log('  ⊘ ' + label + ' (already patched)');
  return false;
}

console.log('\n' + green('=== Fixing all 3 issues ===') + '\n');

// -----------------------------------------------
// FIX 1: qualifier.js — JSON parsing + rate limit
// -----------------------------------------------
console.log('--- qualifier.js ---');

// Fix JSON parsing: clean markdown fences before JSON.parse
patch(
  'src/modules/qualifier.js',
  `    const text = response.content[0].text.trim();
    const result = JSON.parse(text);`,
  `    let text = response.content[0].text.trim();
    // Strip markdown fences Claude sometimes adds
    if (text.startsWith('\`\`\`')) {
      text = text.replace(/^\`\`\`json?\\n?/, '').replace(/\\n?\`\`\`$/, '').trim();
    }
    const result = JSON.parse(text);`,
  'Fix 1a: JSON parsing (strip markdown fences)'
);

// Fix rate limit: increase delay from 300ms to 15s
patch(
  'src/modules/qualifier.js',
  'await new Promise(r => setTimeout(r, 300));',
  'await new Promise(r => setTimeout(r, 15000)); // 15s delay for rate limit (5 req/min)',
  'Fix 1b: Rate limit delay (300ms → 15s)'
);

// -----------------------------------------------
// FIX 2: siteBuilder.js — rate limit
// -----------------------------------------------
console.log('\n--- siteBuilder.js ---');

// Fix rate limit: increase delay from 2s to 20s
patch(
  'src/modules/siteBuilder.js',
  'await new Promise(r => setTimeout(r, 2000));',
  'await new Promise(r => setTimeout(r, 20000)); // 20s delay for rate limit (large output)',
  'Fix 2a: Rate limit delay (2s → 20s)'
);

// Fix Vercel: skip deploy if no valid token
patch(
  'src/modules/siteBuilder.js',
  `    if (process.env.VERCEL_TOKEN) {`,
  `    if (process.env.VERCEL_TOKEN && process.env.VERCEL_TOKEN !== 'your_vercel_token') {`,
  'Fix 2b: Skip Vercel if placeholder token'
);

// -----------------------------------------------
// FIX 3: outreach.js — JSON parsing + rate limit
// -----------------------------------------------
console.log('\n--- outreach.js ---');

// Fix rate limit: increase delay from 1s to 15s
patch(
  'src/modules/outreach.js',
  'await new Promise(r => setTimeout(r, 1000)); // rate limit',
  'await new Promise(r => setTimeout(r, 15000)); // 15s delay for rate limit',
  'Fix 3a: Rate limit delay (1s → 15s)'
);

// -----------------------------------------------
// FIX 4: scheduler — reduce batch sizes
// -----------------------------------------------
console.log('\n--- scheduler/cron.js ---');

patch(
  'src/scheduler/cron.js',
  'await qualifyNewLeads(20);',
  'await qualifyNewLeads(4); // small batches to stay under rate limits',
  'Fix 4a: Reduce qualify batch (20 → 4)'
);

patch(
  'src/scheduler/cron.js',
  'await buildPendingSites(5);',
  'await buildPendingSites(2); // small batches for rate limits',
  'Fix 4b: Reduce build batch (5 → 2)'
);

console.log('\n' + green('All fixes applied!'));
console.log('Run: npm start\n');
