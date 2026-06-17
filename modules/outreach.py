import time
import json
from urllib.parse import urlparse
import anthropic
import resend
from config import ANTHROPIC_API_KEY, RESEND_API_KEY, FROM_EMAIL, FROM_NAME, DAILY_EMAIL_LIMIT, query, execute

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
resend.api_key = RESEND_API_KEY

STAGE_DELAYS_HOURS = {1: 0, 2: 72, 3: 168}

PROMPTS = {
    1: """Write a cold outreach email for a web design agency.
Target: {name} ({niche} in {city})
Their website: {website}
Issue: {analysis}
Demo site we built: {demo_url}

Rules: Under 120 words, 3-4 paragraphs. Mention something specific about THEIR business.
Drop the demo URL naturally. Sound human, not salesy. No "Dear Sir/Madam".

Respond ONLY in JSON (no markdown): {{"subject":"under 8 words","body":"HTML with <p> tags"}}""",

    2: """Write follow-up email #1 (3 days after first email, no reply yet).
Target: {name} ({niche} in {city})
Demo: {demo_url}

Rules: Under 80 words, different angle — use social proof. Casual. Include demo URL.
JSON only: {{"subject":"short subject","body":"HTML"}}""",

    3: """Write FINAL follow-up (7 days, last email).
Target: {name} ({niche} in {city})
Demo: {demo_url}

Rules: Under 60 words. Demo expires in 7 days. Graceful close.
JSON only: {{"subject":"short subject","body":"HTML"}}""",
}


def parse_claude_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def get_lead_email(lead: dict) -> str | None:
    """Get business email — stored or constructed from domain."""
    if lead.get("email"):
        return lead["email"]
    if lead.get("website_url"):
        try:
            domain = urlparse(lead["website_url"]).hostname
            if domain:
                domain = domain.replace("www.", "")
                return f"info@{domain}"
        except Exception:
            pass
    return None


def generate_email(lead: dict, stage: int) -> dict:
    """Generate email content with Claude."""
    prompt = PROMPTS[stage].format(
        name=lead["business_name"],
        niche=lead.get("niche", ""),
        city=lead.get("city", ""),
        website=lead.get("website_url", "No website"),
        analysis=lead.get("ai_analysis", "No website"),
        demo_url=lead.get("demo_site_url", ""),
    )
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_claude_json(response.content[0].text)


def send_email(lead: dict, content: dict, stage: int, sequence_id: str) -> bool:
    """Send an email via Resend."""
    to_email = get_lead_email(lead)
    if not to_email:
        print(f"    No email for {lead['business_name']}, skipping")
        return False

    try:
        sent = resend.Emails.send({
            "from": f"{FROM_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": content["subject"],
            "html": content["body"],
        })

        execute("""
            INSERT INTO emails_sent (sequence_id, lead_id, stage, resend_id, subject, body_html, from_email, to_email)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (sequence_id, lead["id"], stage, sent.get("id"), content["subject"], content["body"], FROM_EMAIL, to_email))

        print(f"    Sent email #{stage} to {to_email} ({lead['business_name']})")
        return True
    except Exception as e:
        print(f"    Send failed: {e}")
        return False


def start_sequence(lead: dict) -> str:
    """Start a new email sequence for a lead."""
    existing = query("SELECT id FROM email_sequences WHERE lead_id=%s", (lead["id"],))
    if existing:
        return existing[0]["id"]

    execute("""
        INSERT INTO email_sequences (lead_id, campaign_id, current_stage, status, next_send_at)
        VALUES (%s, %s, 1, 'active', now())
    """, (lead["id"], lead.get("campaign_id")))

    result = query("SELECT id FROM email_sequences WHERE lead_id=%s", (lead["id"],))
    return result[0]["id"] if result else ""


def process_due_emails() -> int:
    """Send all due emails (respecting daily limit)."""
    today_count = query("SELECT count(*) as cnt FROM emails_sent WHERE created_at >= CURRENT_DATE")
    sent_today = int(today_count[0]["cnt"]) if today_count else 0

    if sent_today >= DAILY_EMAIL_LIMIT:
        print(f"[Outreach] Daily limit reached ({sent_today}/{DAILY_EMAIL_LIMIT})")
        return 0

    remaining = DAILY_EMAIL_LIMIT - sent_today
    sequences = query("""
        SELECT * FROM email_sequences
        WHERE status='active' AND next_send_at <= now()
        ORDER BY next_send_at LIMIT %s
    """, (remaining,))

    print(f"[Outreach] Processing {len(sequences)} due emails ({sent_today} sent today)")

    processed = 0
    for seq in sequences:
        lead_rows = query("SELECT * FROM leads WHERE id=%s", (seq["lead_id"],))
        if not lead_rows:
            continue
        lead = lead_rows[0]
        stage = seq["current_stage"]

        try:
            content = generate_email(lead, stage)
            sent = send_email(lead, content, stage, seq["id"])

            next_stage = stage + 1
            is_done = next_stage > seq["max_stages"]

            if is_done or not sent:
                execute("UPDATE email_sequences SET current_stage=%s, status='completed', updated_at=now() WHERE id=%s",
                        (next_stage, seq["id"]))
            else:
                hours = STAGE_DELAYS_HOURS.get(next_stage, 72)
                execute("""
                    UPDATE email_sequences SET current_stage=%s, status='active',
                    next_send_at=now()+(%s||' hours')::interval, updated_at=now() WHERE id=%s
                """, (next_stage, str(hours), seq["id"]))

            if sent:
                execute("UPDATE leads SET status='contacted', updated_at=now() WHERE id=%s", (lead["id"],))
                execute("""
                    INSERT INTO activity_log (type, campaign_id, lead_id, message, metadata)
                    VALUES ('email', %s, %s, %s, %s)
                """, (lead.get("campaign_id"), lead["id"],
                      f"Email #{stage} sent to {lead['business_name']}",
                      json.dumps({"subject": content["subject"], "stage": stage})))

            processed += 1
            time.sleep(15)
        except Exception as e:
            print(f"    Error: {e}")

    return processed


def init_new_sequences() -> int:
    """Start sequences for leads with demos but not yet contacted."""
    leads = query("""
        SELECT l.* FROM leads l
        LEFT JOIN email_sequences es ON es.lead_id = l.id
        WHERE l.demo_site_built=true AND l.status='demo_built' AND es.id IS NULL
        LIMIT 20
    """)
    print(f"[Outreach] Starting {len(leads)} new sequences")
    for lead in leads:
        start_sequence(lead)
    return len(leads)
