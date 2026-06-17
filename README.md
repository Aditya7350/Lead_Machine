# AI Lead Machine — Python Edition

AI-powered lead generation → website qualification → demo site builder → email outreach.

## Quick Start (10 minutes)

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Setup environment
```bash
copy .env.example .env
# Edit .env in Notepad — add your API keys
```

### 3. Setup database
Already have `ai_lead_machine` database from before? Tables are reused!
```bash
python setup_db.py
python seed_campaigns.py
```

### 4. Launch
```bash
python main.py
```

Open http://localhost:3000 — dashboard loads automatically.
API docs at http://localhost:3000/docs (FastAPI auto-generated).

## Project Structure

```
├── main.py               # FastAPI server + all routes
├── config.py             # Environment + database pool
├── setup_db.py           # Create tables
├── seed_campaigns.py     # Starter campaigns
├── requirements.txt      # Python dependencies
├── .env                  # Your API keys (create from .env.example)
├── modules/
│   ├── scraper.py        # Google Maps lead finder
│   ├── qualifier.py      # Claude AI scoring (1-10)
│   ├── site_builder.py   # Demo website generator
│   └── outreach.py       # Email engine (Resend)
├── templates/
│   └── site_template.py  # Professional HTML template
└── public/
    └── index.html        # React dashboard (same UI)
```

## API Endpoints

All endpoints documented at http://localhost:3000/docs

### Dashboard
- `GET /` — React dashboard
- `GET /demo/{site_id}` — Demo site preview

### Data
- `GET /api/stats` — Pipeline stats
- `GET /api/leads` — All leads with contacts
- `GET /api/leads/{id}` — Lead detail + email history
- `GET /api/campaigns` — All campaigns
- `GET /api/activity` — Activity log

### Actions
- `POST /api/quick-scrape` — Scrape new location (from dashboard form)
- `POST /api/leads/{id}/qualify` — Qualify one lead
- `POST /api/leads/{id}/build-demo` — Build demo for one lead
- `POST /api/leads/{id}/send-email` — Send email to one lead

### Bulk
- `POST /api/run/scrape` — Scrape all campaigns
- `POST /api/run/qualify` — Qualify pending leads
- `POST /api/run/build-sites` — Build all pending demos
- `POST /api/run/outreach` — Send all due emails
- `POST /api/run/full-pipeline` — Run everything

## API Keys

| Service | Free Tier | URL |
|---------|-----------|-----|
| Google Maps | $200/mo free | console.cloud.google.com |
| Anthropic Claude | Pay-per-use | console.anthropic.com |
| Resend | 100 emails/day | resend.com |
