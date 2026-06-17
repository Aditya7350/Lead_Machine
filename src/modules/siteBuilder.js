// ============================================
// MODULE 3: DEMO SITE BUILDER (v2)
//
// NEW APPROACH: Professional HTML template +
// Claude generates ONLY the text content (JSON).
// Result: consistent, beautiful sites every time.
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { query } from '../config/db.js';
import 'dotenv/config';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Niche color themes ---
const NICHE_COLORS = {
  dentists:    { primary: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)', hero_bg: '#f0f9ff' },
  restaurants: { primary: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', hero_bg: '#fef2f2' },
  plumbers:    { primary: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', hero_bg: '#eff6ff' },
  salons:      { primary: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #db2777)', hero_bg: '#fdf2f8' },
  realestate:  { primary: '#059669', gradient: 'linear-gradient(135deg, #059669, #047857)', hero_bg: '#ecfdf5' },
  auto:        { primary: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', hero_bg: '#fffbeb' },
  gyms:        { primary: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', hero_bg: '#f5f3ff' },
  lawyers:     { primary: '#1e293b', gradient: 'linear-gradient(135deg, #1e293b, #334155)', hero_bg: '#f8fafc' },
  vets:        { primary: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)', hero_bg: '#ecfdf5' },
  cleaning:    { primary: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', hero_bg: '#ecfeff' },
  default:     { primary: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', hero_bg: '#eef2ff' },
};

// --- Ask Claude for CONTENT ONLY (not HTML) ---
async function generateContent(lead) {
  const prompt = `Generate website content for this business. Return ONLY valid JSON, no markdown.

Business: ${lead.business_name}
Type: ${lead.niche || 'local business'}
City: ${lead.city || ''}
Phone: ${lead.phone || ''}
Address: ${lead.address || ''}
Rating: ${lead.google_rating || 'N/A'} (${lead.review_count || 0} reviews)

Return this exact JSON structure:
{
  "tagline": "short compelling tagline under 10 words",
  "about": "2-3 sentences about the business, professional tone, mention the city",
  "services": [
    {"name": "Service Name", "desc": "One sentence description"},
    {"name": "Service Name", "desc": "One sentence description"},
    {"name": "Service Name", "desc": "One sentence description"},
    {"name": "Service Name", "desc": "One sentence description"},
    {"name": "Service Name", "desc": "One sentence description"},
    {"name": "Service Name", "desc": "One sentence description"}
  ],
  "cta_text": "short call to action, 4-6 words",
  "reviews": [
    {"name": "First L.", "text": "Short realistic review sentence", "stars": 5},
    {"name": "First L.", "text": "Short realistic review sentence", "stars": 5},
    {"name": "First L.", "text": "Short realistic review sentence", "stars": 4}
  ]
}`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = response.content[0].text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return JSON.parse(text);
}

// --- Build the full HTML from template + content ---
function buildHTML(lead, content) {
  const colors = NICHE_COLORS[lead.niche] || NICHE_COLORS.default;
  const name = lead.business_name;
  const phone = lead.phone || '';
  const address = lead.address || '';
  const city = lead.city || '';

  // Service icons (simple SVG circles with initials)
  const serviceIcons = ['🏥','⭐','🔧','📋','💎','🎯','🛡️','✨'];

  const servicesHTML = (content.services || []).map((s, i) => `
    <div class="service-card">
      <div class="service-icon">${serviceIcons[i % serviceIcons.length]}</div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.desc)}</p>
    </div>`).join('');

  const reviewsHTML = (content.reviews || []).map(r => `
    <div class="review-card">
      <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <p>"${esc(r.text)}"</p>
      <span class="reviewer">— ${esc(r.name)}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)} — ${esc(city)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: ${colors.primary};
    --gradient: ${colors.gradient};
    --hero-bg: ${colors.hero_bg};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; line-height: 1.6; }

  /* Preview banner */
  .preview-banner {
    background: var(--gradient);
    color: white;
    text-align: center;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
  }
  .preview-banner a { color: #fff; text-decoration: underline; }

  /* Nav */
  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 60px;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .logo {
    font-family: 'Playfair Display', serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
  }
  .nav-links { display: flex; align-items: center; gap: 32px; }
  .nav-links a {
    text-decoration: none;
    color: #475569;
    font-size: 15px;
    font-weight: 500;
    transition: color .2s;
  }
  .nav-links a:hover { color: var(--primary); }
  .nav-cta {
    background: var(--gradient) !important;
    color: white !important;
    padding: 10px 24px !important;
    border-radius: 8px;
    font-weight: 600 !important;
    transition: transform .2s, box-shadow .2s;
  }
  .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

  /* Hero */
  .hero {
    background: var(--hero-bg);
    padding: 100px 60px 80px;
    text-align: center;
  }
  .hero h1 {
    font-family: 'Playfair Display', serif;
    font-size: 52px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 16px;
    line-height: 1.15;
  }
  .hero .tagline {
    font-size: 20px;
    color: #64748b;
    max-width: 560px;
    margin: 0 auto 36px;
  }
  .hero-cta {
    display: inline-block;
    background: var(--gradient);
    color: white;
    padding: 16px 40px;
    border-radius: 10px;
    font-size: 17px;
    font-weight: 600;
    text-decoration: none;
    transition: transform .2s, box-shadow .2s;
  }
  .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
  .hero-info {
    margin-top: 40px;
    display: flex;
    justify-content: center;
    gap: 40px;
    color: #64748b;
    font-size: 15px;
  }
  .hero-info span { display: flex; align-items: center; gap: 6px; }

  /* About */
  .about {
    padding: 80px 60px;
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
  }
  .section-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--primary);
    margin-bottom: 12px;
  }
  .about h2 {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    color: #0f172a;
    margin-bottom: 20px;
  }
  .about p {
    font-size: 17px;
    color: #475569;
    line-height: 1.8;
  }

  /* Services */
  .services {
    padding: 80px 60px;
    background: #f8fafc;
  }
  .services h2 {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    text-align: center;
    color: #0f172a;
    margin-bottom: 48px;
  }
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .service-card {
    background: white;
    padding: 32px 28px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    transition: transform .2s, box-shadow .2s;
  }
  .service-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
  .service-icon { font-size: 28px; margin-bottom: 16px; }
  .service-card h3 { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
  .service-card p { font-size: 14px; color: #64748b; }

  /* Reviews */
  .reviews {
    padding: 80px 60px;
    text-align: center;
  }
  .reviews h2 {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    color: #0f172a;
    margin-bottom: 48px;
  }
  .reviews-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    max-width: 1000px;
    margin: 0 auto;
  }
  .review-card {
    background: #f8fafc;
    padding: 28px;
    border-radius: 12px;
    text-align: left;
  }
  .stars { color: #f59e0b; font-size: 18px; margin-bottom: 12px; letter-spacing: 2px; }
  .review-card p { font-size: 15px; color: #334155; font-style: italic; margin-bottom: 12px; }
  .reviewer { font-size: 13px; color: #94a3b8; font-weight: 500; }

  /* Contact */
  .contact {
    padding: 80px 60px;
    background: var(--hero-bg);
  }
  .contact-inner {
    max-width: 900px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }
  .contact h2 {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    color: #0f172a;
    margin-bottom: 20px;
  }
  .contact p { color: #475569; margin-bottom: 24px; }
  .contact-details { display: flex; flex-direction: column; gap: 14px; }
  .contact-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 15px; color: #334155;
  }
  .contact-item span { font-size: 18px; }
  .contact-form { display: flex; flex-direction: column; gap: 14px; }
  .contact-form input, .contact-form textarea {
    padding: 14px 18px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
    transition: border .2s;
  }
  .contact-form input:focus, .contact-form textarea:focus { border-color: var(--primary); }
  .contact-form textarea { min-height: 100px; resize: vertical; }
  .contact-form button {
    background: var(--gradient);
    color: white;
    padding: 14px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform .2s;
  }
  .contact-form button:hover { transform: translateY(-1px); }

  /* Footer */
  footer {
    background: #0f172a;
    color: #94a3b8;
    padding: 40px 60px;
    text-align: center;
    font-size: 14px;
  }
  footer .logo-footer {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    color: white;
    margin-bottom: 12px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    nav { padding: 16px 24px; }
    .nav-links { display: none; }
    .hero { padding: 60px 24px 50px; }
    .hero h1 { font-size: 32px; }
    .hero-info { flex-direction: column; gap: 12px; }
    .about, .services, .reviews, .contact { padding: 50px 24px; }
    .contact-inner { grid-template-columns: 1fr; gap: 30px; }
  }
</style>
</head>
<body>

<div class="preview-banner">
  🟢 Preview site built by <strong>Web Agency</strong> — <a href="mailto:hello@agency.com">Want this for your business? Contact us today</a>
</div>

<nav>
  <div class="logo">${esc(name)}</div>
  <div class="nav-links">
    <a href="#about">About</a>
    <a href="#services">Services</a>
    <a href="#reviews">Reviews</a>
    <a href="#contact">Contact</a>
    <a href="#contact" class="nav-cta">${esc(content.cta_text || 'Get Started')}</a>
  </div>
</nav>

<section class="hero">
  <h1>${esc(name)}</h1>
  <p class="tagline">${esc(content.tagline)}</p>
  <a href="#contact" class="hero-cta">${esc(content.cta_text || 'Book Now')}</a>
  <div class="hero-info">
    ${phone ? `<span>📞 ${esc(phone)}</span>` : ''}
    ${address ? `<span>📍 ${esc(address)}</span>` : `<span>📍 ${esc(city)}</span>`}
    ${lead.google_rating ? `<span>⭐ ${lead.google_rating} rating (${lead.review_count} reviews)</span>` : ''}
  </div>
</section>

<section class="about" id="about">
  <div class="section-label">About Us</div>
  <h2>Welcome to ${esc(name)}</h2>
  <p>${esc(content.about)}</p>
</section>

<section class="services" id="services">
  <div class="section-label" style="text-align:center">What We Offer</div>
  <h2>Our Services</h2>
  <div class="services-grid">
    ${servicesHTML}
  </div>
</section>

<section class="reviews" id="reviews">
  <div class="section-label">Testimonials</div>
  <h2>What Our Clients Say</h2>
  <div class="reviews-grid">
    ${reviewsHTML}
  </div>
</section>

<section class="contact" id="contact">
  <div class="contact-inner">
    <div>
      <div class="section-label">Get in Touch</div>
      <h2>Ready to Get Started?</h2>
      <p>We'd love to hear from you. Reach out today and let us know how we can help.</p>
      <div class="contact-details">
        ${phone ? `<div class="contact-item"><span>📞</span> ${esc(phone)}</div>` : ''}
        ${address ? `<div class="contact-item"><span>📍</span> ${esc(address)}</div>` : ''}
        <div class="contact-item"><span>🕐</span> Mon–Fri: 9:00 AM – 6:00 PM</div>
      </div>
    </div>
    <div class="contact-form">
      <input type="text" placeholder="Your Name" />
      <input type="email" placeholder="Your Email" />
      <input type="tel" placeholder="Your Phone" />
      <textarea placeholder="How can we help you?"></textarea>
      <button type="button">${esc(content.cta_text || 'Send Message')}</button>
    </div>
  </div>
</section>

<footer>
  <div class="logo-footer">${esc(name)}</div>
  <p>© ${new Date().getFullYear()} ${esc(name)}. All rights reserved.</p>
  <p style="margin-top:8px;font-size:12px;color:#475569">Demo website — built with AI by Web Agency</p>
</footer>

</body>
</html>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Build demo site for a single lead ---
export async function buildDemoSite(lead) {
  console.log(`  Building site for: ${lead.business_name}`);
  try {
    // Step 1: Claude generates content (small, fast, reliable)
    const content = await generateContent(lead);
    console.log(`    → Content generated (${content.services?.length || 0} services)`);

    // Step 2: Inject into professional template
    const html = buildHTML(lead, content);
    console.log(`    → HTML built (${(html.length / 1024).toFixed(0)}KB)`);

    // Step 3: Save locally (served by Express)
    const siteId = `site_${Date.now()}`;
    const localUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/demo/${siteId}`;

    await query(`
      INSERT INTO demo_sites (id, lead_id, html_content, deploy_url, expires_at)
      VALUES ($1, $2, $3, $4, now() + interval '30 days')
    `, [siteId, lead.id, html, localUrl]);

    // Step 4: Update lead record
    await query(`
      UPDATE leads SET
        demo_site_url = $1,
        demo_site_built = true,
        status = 'demo_built',
        updated_at = now()
      WHERE id = $2
    `, [localUrl, lead.id]);

    // Log
    await query(`
      INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
      VALUES ('build', $1, $2, $3, $4)
    `, [lead.campaign_id, lead.id, `Demo site built: ${lead.business_name}`,
      JSON.stringify({ url: localUrl })]);

    console.log(`    → Deployed: ${localUrl} ✓`);
    return { url: localUrl, id: siteId };
  } catch (err) {
    console.error(`    ✗ Build failed: ${err.message}`);
    return null;
  }
}

// --- Build sites for all qualified leads without demos ---
export async function buildPendingSites(limit = 2) {
  const res = await query(`
    SELECT * FROM leads
    WHERE qualification = 'qualified'
      AND demo_site_built = false
    ORDER BY website_score DESC
    LIMIT $1
  `, [limit]);

  console.log(`[SiteBuilder] Building ${res.rows.length} demo sites`);

  let built = 0;
  for (const lead of res.rows) {
    const result = await buildDemoSite(lead);
    if (result) built++;
    // 20s delay for rate limits
    await new Promise(r => setTimeout(r, 20000));
  }

  console.log(`[SiteBuilder] Built ${built} sites`);
  return built;
}

// --- Run standalone ---
if (process.argv[1]?.includes('siteBuilder')) {
  buildPendingSites()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}