import time
import json
import anthropic
from html import escape as esc
from config import ANTHROPIC_API_KEY, BASE_URL, query, execute
from templates.site_template import build_site_html

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def parse_claude_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def generate_content(lead: dict) -> dict:
    """Ask Claude for website text content only (not HTML)."""
    prompt = f"""Generate website content for this business. Return ONLY valid JSON, no markdown fences.

Business: {lead['business_name']}
Type: {lead.get('niche', 'local business')}
City: {lead.get('city', '')}
Phone: {lead.get('phone', '')}
Address: {lead.get('address', '')}
Rating: {lead.get('google_rating', 'N/A')} ({lead.get('review_count', 0)} reviews)

Return this exact JSON:
{{"tagline":"short tagline under 10 words","about":"2-3 sentences about the business","services":[{{"name":"Service","desc":"One sentence"}},{{"name":"Service","desc":"One sentence"}},{{"name":"Service","desc":"One sentence"}},{{"name":"Service","desc":"One sentence"}},{{"name":"Service","desc":"One sentence"}},{{"name":"Service","desc":"One sentence"}}],"cta_text":"call to action 4-6 words","reviews":[{{"name":"First L.","text":"Short review","stars":5}},{{"name":"First L.","text":"Short review","stars":5}},{{"name":"First L.","text":"Short review","stars":4}}]}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_claude_json(response.content[0].text)


def build_demo_site(lead: dict) -> dict | None:
    """Generate demo site for a lead. Returns {url, id} or None."""
    print(f"  Building site for: {lead['business_name']}")
    try:
        # Step 1: Claude generates text content
        content = generate_content(lead)
        print(f"    → Content generated ({len(content.get('services', []))} services)")

        # Step 2: Inject into professional template
        html = build_site_html(lead, content)
        print(f"    → HTML built ({len(html) // 1024}KB)")

        # Step 3: Save to database (served by FastAPI)
        site_id = f"site_{int(time.time() * 1000)}"
        local_url = f"{BASE_URL}/demo/{site_id}"

        execute("""
            INSERT INTO demo_sites (id, lead_id, html_content, deploy_url, expires_at)
            VALUES (%s, %s, %s, %s, now() + interval '30 days')
        """, (site_id, lead["id"], html, local_url))

        # Step 4: Update lead
        execute("""
            UPDATE leads SET demo_site_url=%s, demo_site_built=true,
            status='demo_built', updated_at=now()
            WHERE id=%s
        """, (local_url, lead["id"]))

        execute("""
            INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
            VALUES ('build', %s, %s, %s, %s)
        """, (lead.get("campaign_id"), lead["id"],
              f"Demo site built: {lead['business_name']}",
              json.dumps({"url": local_url})))

        print(f"    → Deployed: {local_url} ✓")
        return {"url": local_url, "id": site_id}

    except Exception as e:
        print(f"    ✗ Build failed: {e}")
        return None


def build_pending_sites(limit: int = 2) -> int:
    """Build demo sites for qualified leads without demos."""
    leads = query("""
        SELECT * FROM leads
        WHERE qualification='qualified' AND demo_site_built=false
        ORDER BY website_score DESC LIMIT %s
    """, (limit,))

    print(f"[SiteBuilder] Building {len(leads)} demo sites")
    built = 0
    for lead in leads:
        result = build_demo_site(lead)
        if result:
            built += 1
        time.sleep(20)

    print(f"[SiteBuilder] Built {built} sites")
    return built
