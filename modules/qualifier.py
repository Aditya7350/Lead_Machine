import time
import json
import requests
from bs4 import BeautifulSoup
import anthropic
from config import ANTHROPIC_API_KEY, query, execute

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def parse_claude_json(raw: str) -> dict:
    """Safely parse JSON from Claude, stripping markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def fetch_website(url: str) -> dict:
    """Fetch and analyze a business website."""
    try:
        res = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)"
        }, allow_redirects=True)
        soup = BeautifulSoup(res.text, "lxml")

        for tag in soup(["script", "style", "noscript", "iframe"]):
            tag.decompose()

        return {
            "html": str(soup)[:3000],
            "title": soup.title.string.strip() if soup.title and soup.title.string else "",
            "has_https": url.startswith("https"),
            "has_mobile": bool(soup.find("meta", attrs={"name": "viewport"})),
            "error": None,
        }
    except Exception as e:
        return {"html": None, "error": str(e)}


def qualify_single(lead: dict) -> dict:
    """Score a single lead with Claude. Returns {score, qualified, summary}."""
    print(f"  Qualifying: {lead['business_name']}")

    # No website = auto-qualify at 10
    if not lead.get("website_url"):
        execute("""
            UPDATE leads SET website_score=10, ai_analysis='No website exists',
            qualification='qualified', status='qualified', updated_at=now()
            WHERE id=%s
        """, (lead["id"],))
        log_activity("qualify", lead.get("campaign_id"), lead["id"],
                     f"Auto-qualified (no website): {lead['business_name']}", {"score": 10})
        print(f"    → 10/10 (no website) ✓")
        return {"score": 10, "qualified": True}

    # Fetch website
    site = fetch_website(lead["website_url"])

    # Site unreachable = 9
    if site["error"]:
        execute("""
            UPDATE leads SET website_score=9, ai_analysis=%s,
            qualification='qualified', status='qualified', updated_at=now()
            WHERE id=%s
        """, (f"Site unreachable: {site['error']}", lead["id"]))
        log_activity("qualify", lead.get("campaign_id"), lead["id"],
                     f"Qualified (site down): {lead['business_name']}", {"score": 9})
        print(f"    → 9/10 (site unreachable) ✓")
        return {"score": 9, "qualified": True}

    # Ask Claude
    prompt = f"""You are a web design agency evaluating a local business's online presence.

Business: {lead['business_name']}
Niche: {lead.get('niche', 'unknown')}
City: {lead.get('city', '')}
Website: {lead['website_url']}
Rating: {lead.get('google_rating', 'N/A')} ({lead.get('review_count', 0)} reviews)

Website HTML (first 3000 chars):
<website>
{site['html']}
</website>

Score 1-10 on how badly they need a new website:
10 = no website, 8-9 = terrible, 6-7 = mediocre, 4-5 = decent, 1-3 = good

Respond ONLY in this JSON format (no markdown, no extra text):
{{"score": <number>, "issues": ["issue1", "issue2"], "summary": "<one sentence>", "qualified": <true if score >= 6>}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        result = parse_claude_json(response.content[0].text)

        status = "qualified" if result["qualified"] else "archived"
        qual = "qualified" if result["qualified"] else "rejected"

        execute("""
            UPDATE leads SET website_score=%s, ai_analysis=%s,
            qualification=%s, status=%s, updated_at=now()
            WHERE id=%s
        """, (result["score"], result["summary"], qual, status, lead["id"]))

        icon = "✓" if result["qualified"] else "✗"
        print(f"    → {result['score']}/10 ({result['summary']}) {icon}")

        log_activity("qualify", lead.get("campaign_id"), lead["id"],
                     f"{'Qualified' if result['qualified'] else 'Rejected'} ({result['score']}/10): {lead['business_name']}",
                     {"score": result["score"], "issues": result.get("issues", [])})
        return result

    except Exception as e:
        print(f"    ✗ Error: {e}")
        return {"score": 0, "qualified": False, "error": str(e)}


def qualify_new_leads(limit: int = 4) -> dict:
    """Process unqualified leads. Returns {qualified, rejected}."""
    leads = query("SELECT * FROM leads WHERE qualification='pending' ORDER BY created_at LIMIT %s", (limit,))
    print(f"[Qualifier] Processing {len(leads)} leads")

    qualified = 0
    rejected = 0

    for lead in leads:
        result = qualify_single(lead)
        if result.get("qualified"):
            qualified += 1
        else:
            rejected += 1
        time.sleep(15)  # 15s delay — stay under 5 req/min

    print(f"[Qualifier] Done — Qualified: {qualified}, Rejected: {rejected}")
    return {"qualified": qualified, "rejected": rejected}


def log_activity(type_, campaign_id, lead_id, message, metadata=None):
    execute("""
        INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
        VALUES (%s, %s, %s, %s, %s)
    """, (type_, campaign_id, lead_id, message, json.dumps(metadata or {})))
