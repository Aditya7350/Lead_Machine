"""
AI Lead Machine — FastAPI Backend
Run: uvicorn main:app --host 0.0.0.0 --port 3000 --reload
"""
from config import init_db
init_db()
import json
import threading
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

print("Loading config...")
from config import query, query_one, execute, PORT
print("Config loaded")

print("Loading scraper...")
from modules.scraper import scrape_campaign, create_campaign, scrape_all_active
print("Scraper loaded")

print("Loading qualifier...")
from modules.qualifier import qualify_new_leads, qualify_single
print("Qualifier loaded")

print("Loading site builder...")
from modules.site_builder import build_demo_site, build_pending_sites
print("Site builder loaded")

print("Loading outreach...")
from modules.outreach import init_new_sequences, process_due_emails
print("Outreach loaded")

print("Loading auth...")
from modules.auth import (
    get_user_by_email,
    create_user,
    verify_password,
    create_token,
    verify_token,
    setup_default_admin,
)
print("Auth loaded")
from modules.scraper import scrape_campaign, create_campaign, scrape_all_active
from modules.qualifier import qualify_new_leads, qualify_single
from modules.site_builder import build_demo_site, build_pending_sites
from modules.outreach import init_new_sequences, process_due_emails
from modules.auth import get_user_by_email, create_user, verify_password, create_token, verify_token, setup_default_admin

app = FastAPI(title="AI Lead Machine", version="2.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Serve React dashboard (SPA)
app.mount("/assets", StaticFiles(directory="public/assets"), name="assets")


# =============================================
# PYDANTIC MODELS
# =============================================

class QuickScrapeRequest(BaseModel):
    city: str
    country_code: str = "US"
    niche: str
    keywords: Optional[list[str]] = None
    radius_km: int = 25


class CampaignRequest(BaseModel):
    name: str
    niche: str
    keywords: list[str]
    city: str
    country_code: str = "US"
    region: Optional[str] = None
    radius_km: int = 25
    send_limit: int = 15


# =============================================
# DASHBOARD (serve index.html at root)
# =============================================

@app.get("/", response_class=HTMLResponse)
def serve_landing():
    with open("public/landing.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/app", response_class=HTMLResponse)
def serve_dashboard():
    with open("public/index.html", "r", encoding="utf-8") as f:
        return f.read()


# =============================================
# LOGIN PAGE
# =============================================

@app.get("/login", response_class=HTMLResponse)
def serve_login():
    with open("public/login.html", "r", encoding="utf-8") as f:
        return f.read()


# =============================================
# AUTH API
# =============================================

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(400, "Email already registered")
    user = create_user(req.email, req.password, req.name)
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.get("/api/auth/me")
def get_me(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
    payload = verify_token(token)
    if not payload:
        raise HTTPException(401, "Not authenticated")
    user = get_user_by_email(payload["email"])
    if not user:
        raise HTTPException(401, "User not found")
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


# =============================================
# API: HEALTH + STATS
# =============================================

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/stats")
def stats():
    def count(sql):
        r = query(sql)
        return int(r[0]["count"]) if r else 0

    return {
        "total_leads": count("SELECT count(*) FROM leads"),
        "qualified": count("SELECT count(*) FROM leads WHERE qualification='qualified'"),
        "demos_built": count("SELECT count(*) FROM leads WHERE demo_site_built=true"),
        "contacted": count("SELECT count(*) FROM leads WHERE status='contacted'"),
        "replied": count("SELECT count(*) FROM leads WHERE status='replied'"),
        "emails_today": count("SELECT count(*) FROM emails_sent WHERE created_at >= CURRENT_DATE"),
    }


# =============================================
# API: CAMPAIGNS
# =============================================

@app.get("/api/campaigns")
def list_campaigns():
    return query("SELECT * FROM campaigns ORDER BY created_at DESC")


@app.post("/api/campaigns")
def create_campaign_api(req: CampaignRequest):
    c = create_campaign(req.name, req.niche, req.keywords, req.city,
                        req.country_code, req.region, req.radius_km, req.send_limit)
    return {"success": True, "campaign": c}


# =============================================
# API: LEADS
# =============================================

@app.get("/api/leads")
def list_leads(status: Optional[str] = None, campaign_id: Optional[str] = None,
               limit: int = 100, offset: int = 0):
    sql = "SELECT * FROM leads WHERE 1=1"
    params = []

    if status:
        params.append(status)
        sql += f" AND status = %s"
    if campaign_id:
        params.append(campaign_id)
        sql += f" AND campaign_id = %s"

    sql += " ORDER BY updated_at DESC"
    params.extend([limit, offset])
    sql += " LIMIT %s OFFSET %s"

    return query(sql, tuple(params))


@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: str):
    lead = query_one("SELECT * FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        raise HTTPException(404, "Lead not found")
    emails = query("SELECT * FROM emails_sent WHERE lead_id=%s ORDER BY created_at DESC", (lead_id,))
    demo = query_one("SELECT deploy_url, created_at FROM demo_sites WHERE lead_id=%s ORDER BY created_at DESC LIMIT 1", (lead_id,))
    return {**lead, "emails": emails, "demo": demo}


# =============================================
# API: ACTIVITY LOG
# =============================================

@app.get("/api/activity")
def list_activity(limit: int = 50):
    return query("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT %s", (limit,))


# =============================================
# API: QUICK SCRAPE (from dashboard form)
# =============================================

@app.post("/api/quick-scrape")
def quick_scrape(req: QuickScrapeRequest, background: BackgroundTasks):
    name = f"{req.niche}-{req.city}-{req.country_code}".lower()
    name = "".join(c if c.isalnum() or c == "-" else "-" for c in name)
    keywords = req.keywords or [req.niche]

    campaign = create_campaign(name, req.niche, keywords, req.city,
                               req.country_code, radius_km=req.radius_km)

    # Scrape in background so API responds immediately
    background.add_task(scrape_campaign, campaign)
    return {"success": True, "campaign": campaign, "message": f"Scraping {req.city}..."}


# =============================================
# API: SINGLE LEAD ACTIONS
# =============================================

@app.post("/api/leads/{lead_id}/qualify")
def qualify_lead_api(lead_id: str, background: BackgroundTasks):
    lead = query_one("SELECT * FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        raise HTTPException(404, "Lead not found")
    execute("UPDATE leads SET qualification='pending' WHERE id=%s", (lead_id,))

    def do_qualify():
        leads = query("SELECT * FROM leads WHERE id=%s", (lead_id,))
        if leads:
            qualify_single(leads[0])

    background.add_task(do_qualify)
    return {"success": True, "message": f"Qualifying {lead['business_name']}..."}


@app.post("/api/leads/{lead_id}/build-demo")
def build_demo_api(lead_id: str, background: BackgroundTasks):
    lead = query_one("SELECT * FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        raise HTTPException(404, "Lead not found")

    background.add_task(build_demo_site, lead)
    return {"success": True, "message": f"Building demo for {lead['business_name']}..."}


@app.post("/api/leads/{lead_id}/send-email")
def send_email_api(lead_id: str, background: BackgroundTasks):
    lead = query_one("SELECT * FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        raise HTTPException(404, "Lead not found")

    def do_send():
        from modules.outreach import start_sequence, process_due_emails
        start_sequence(lead)
        process_due_emails()

    background.add_task(do_send)
    return {"success": True, "message": f"Sending email to {lead['business_name']}..."}


# =============================================
# API: BULK ACTIONS
# =============================================

@app.post("/api/run/scrape")
def run_scrape(background: BackgroundTasks):
    background.add_task(scrape_all_active)
    return {"success": True, "message": "Scraping all campaigns..."}


@app.post("/api/run/qualify")
def run_qualify(background: BackgroundTasks):
    background.add_task(qualify_new_leads, 4)
    return {"success": True, "message": "Qualifying leads..."}


@app.post("/api/run/build-sites")
def run_build(background: BackgroundTasks):
    background.add_task(build_pending_sites, 2)
    return {"success": True, "message": "Building demo sites..."}


@app.post("/api/run/outreach")
def run_outreach(background: BackgroundTasks):
    def do_outreach():
        init_new_sequences()
        process_due_emails()
    background.add_task(do_outreach)
    return {"success": True, "message": "Running outreach..."}


@app.post("/api/run/full-pipeline")
def run_pipeline(background: BackgroundTasks):
    def do_pipeline():
        print("\n[Pipeline] === Started ===")
        scrape_all_active()
        qualify_new_leads(4)
        build_pending_sites(2)
        init_new_sequences()
        process_due_emails()
        print("[Pipeline] === Done ===\n")
    background.add_task(do_pipeline)
    return {"success": True, "message": "Full pipeline started..."}


# =============================================
# DEMO SITE SERVING
# =============================================

@app.get("/demo/{site_id}", response_class=HTMLResponse)
def serve_demo(site_id: str):
    site = query_one("SELECT html_content, expires_at FROM demo_sites WHERE id=%s", (site_id,))
    if not site:
        return HTMLResponse("<h1>Demo site not found</h1>", status_code=404)
    return site["html_content"]


# =============================================
# WEBHOOKS
# =============================================

@app.post("/webhooks/resend")
async def resend_webhook(request: Request):
    body = await request.json()
    event_type = body.get("type", "")
    email_id = body.get("data", {}).get("email_id")

    if not email_id:
        return {"received": True}

    updates = {
        "email.opened": ("opened", "opened_at"),
        "email.clicked": ("clicked", "clicked_at"),
        "email.bounced": ("bounced", "bounced_at"),
    }
    if event_type in updates:
        status, field = updates[event_type]
        execute(f"UPDATE emails_sent SET status=%s, {field}=now() WHERE resend_id=%s", (status, email_id))

    return {"received": True}


# =============================================
# START
# =============================================

if __name__ == "__main__":
    import uvicorn
    # Setup database on first run
    from setup_db import SCHEMA
    for stmt in SCHEMA.split(";"):
        s = stmt.strip()
        if s:
            try:
                execute(s + ";")
            except Exception:
                pass
    print("✓ Database ready")
    setup_default_admin()
    print(f"✓ Dashboard: http://localhost:{PORT}")
    print(f"✓ Login:     http://localhost:{PORT}/login")
    print(f"✓ API docs:  http://localhost:{PORT}/docs")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
