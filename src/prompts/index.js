// ============================================
// CLAUDE PROMPT TEMPLATES
// Used across qualifier, outreach, and siteBuilder
// ============================================

export const PROMPTS = {

  // --- LEAD QUALIFICATION ---
  qualifyLead: (lead) => `You are a web design agency evaluating a local business's online presence.

Business: ${lead.business_name}
Niche: ${lead.niche || 'unknown'}
City: ${lead.city}
Website: ${lead.website_url || 'NO WEBSITE'}
Google Rating: ${lead.google_rating || 'N/A'} (${lead.review_count || 0} reviews)

${lead.website_html ? `Here is their current website HTML (first 3000 chars):
<website>
${lead.website_html.slice(0, 3000)}
</website>` : 'They have no website.'}

Score this business 1-10 on how badly they need a new website:
- 10 = no website at all
- 8-9 = website exists but is terrible (broken, not mobile-friendly, outdated, no HTTPS)
- 6-7 = website is mediocre (basic, slow, poor design, missing key info)
- 4-5 = website is decent but could be improved
- 1-3 = website is already good, skip this lead

Respond in this exact JSON format, nothing else:
{
  "score": <number 1-10>,
  "issues": ["issue1", "issue2", "issue3"],
  "summary": "<1 sentence describing the main problem>",
  "qualified": <true if score >= 6, false otherwise>
}`,

  // --- EMAIL: FIRST TOUCH (Day 0) ---
  emailFirstTouch: (lead) => `Write a cold outreach email for a web design agency.

Target business: ${lead.business_name}
Niche: ${lead.niche}
City: ${lead.city}
Their website: ${lead.website_url || 'They have no website'}
Main issue found: ${lead.ai_analysis || 'No website exists'}
Demo site we built for them: ${lead.demo_site_url}

Rules:
- Under 120 words, 3-4 short paragraphs
- Open with something specific about THEIR business (not generic)
- Mention the specific issue with their current site (or lack of site)
- Drop the demo URL naturally, not salesy
- Sound like a helpful person, not a marketing email
- End with a soft CTA (reply or check the demo)
- No "Dear Sir/Madam", no "I hope this finds you well"
- Use their business name naturally

Respond in this exact JSON format, nothing else:
{
  "subject": "<email subject line, under 8 words, no clickbait>",
  "body": "<full email body as HTML with <p> tags>"
}`,

  // --- EMAIL: FOLLOW-UP #1 (Day 3) ---
  emailFollowUp1: (lead) => `Write follow-up email #1 for a web design agency.

This is a follow-up to an unanswered cold email sent 3 days ago.

Target: ${lead.business_name} (${lead.niche} in ${lead.city})
Demo site: ${lead.demo_site_url}
Original issue: ${lead.ai_analysis || 'No website'}

Rules:
- Under 80 words, 2-3 short paragraphs
- Different angle from the first email — use social proof
- Mention how a similar ${lead.niche} business benefited from a better website
- Keep it casual and brief ("Quick follow-up...")
- Include demo URL again
- Don't guilt-trip about not replying

Respond in this exact JSON format, nothing else:
{
  "subject": "<subject line, can reference previous email>",
  "body": "<email body as HTML>"
}`,

  // --- EMAIL: FINAL FOLLOW-UP (Day 7) ---
  emailFinalFollowUp: (lead) => `Write the FINAL follow-up email for a web design agency.

This is the 3rd and last email. Previous 2 went unanswered.

Target: ${lead.business_name} (${lead.niche} in ${lead.city})
Demo site: ${lead.demo_site_url}

Rules:
- Under 60 words, very short
- Create mild urgency: demo site expires in 7 days
- Frame it as "no hard feelings if not interested"
- One last mention of the demo URL
- Graceful close — leave the door open
- Don't be desperate or pushy

Respond in this exact JSON format, nothing else:
{
  "subject": "<short subject>",
  "body": "<email body as HTML>"
}`,

  // --- DEMO WEBSITE GENERATION ---
  generateWebsite: (lead) => `Generate a complete single-page business website for:

Business: ${lead.business_name}
Type: ${lead.niche}
City: ${lead.city}
Phone: ${lead.phone || 'Not available'}
Address: ${lead.address || ''}
Rating: ${lead.google_rating || 'N/A'} stars (${lead.review_count || 0} reviews)

Create a modern, professional single-page HTML website with:
1. Hero section with business name, tagline, and CTA button
2. About section (write plausible copy based on the business type)
3. Services section (4-6 services typical for this ${lead.niche} type)
4. Testimonials section (3 realistic but clearly marked as placeholder)
5. Contact section with phone, address, and a contact form (non-functional is fine)
6. Footer with business name and copyright

Design requirements:
- Mobile-responsive (use flexbox/grid)
- Modern color scheme appropriate for a ${lead.niche}
- Google Fonts (Inter for body, Playfair Display for headings)
- Smooth scroll navigation
- Clean, professional look — not a template feel
- All CSS inline in a <style> tag
- Add a subtle banner at top: "Preview site built by [Agency] — Want this for your business?"

Return ONLY the complete HTML document, starting with <!DOCTYPE html>. No markdown, no explanation, just the HTML.`,

};

export default PROMPTS;
