"""Run once: python setup_db.py"""
from config import execute

SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  niche         TEXT NOT NULL,
  keywords      TEXT[] NOT NULL DEFAULT '{}',
  city          TEXT NOT NULL,
  region        TEXT,
  country_code  TEXT NOT NULL DEFAULT 'US',
  radius_km     INT NOT NULL DEFAULT 25,
  language      TEXT NOT NULL DEFAULT 'en',
  filters       JSONB NOT NULL DEFAULT '{}',
  send_limit    INT NOT NULL DEFAULT 15,
  status        TEXT NOT NULL DEFAULT 'active',
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id     TEXT REFERENCES campaigns(id),
  google_place_id TEXT UNIQUE,
  business_name   TEXT NOT NULL,
  niche           TEXT,
  phone           TEXT,
  email           TEXT,
  website_url     TEXT,
  address         TEXT,
  city            TEXT,
  country_code    TEXT,
  latitude        FLOAT,
  longitude       FLOAT,
  google_rating   FLOAT,
  review_count    INT DEFAULT 0,
  website_score   INT,
  ai_analysis     TEXT,
  qualification   TEXT DEFAULT 'pending',
  demo_site_url   TEXT,
  demo_site_built BOOLEAN DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sequences (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id       TEXT NOT NULL REFERENCES leads(id),
  campaign_id   TEXT REFERENCES campaigns(id),
  current_stage INT NOT NULL DEFAULT 0,
  max_stages    INT NOT NULL DEFAULT 3,
  status        TEXT NOT NULL DEFAULT 'pending',
  next_send_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails_sent (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sequence_id     TEXT REFERENCES email_sequences(id),
  lead_id         TEXT NOT NULL REFERENCES leads(id),
  stage           INT NOT NULL,
  resend_id       TEXT,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  to_email        TEXT NOT NULL,
  status          TEXT DEFAULT 'sent',
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_sites (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id       TEXT NOT NULL REFERENCES leads(id),
  html_content  TEXT NOT NULL,
  deploy_url    TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type        TEXT NOT NULL,
  campaign_id TEXT,
  lead_id     TEXT,
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(google_place_id);
CREATE INDEX IF NOT EXISTS idx_sequences_next_send ON email_sequences(next_send_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON emails_sent(resend_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type, created_at DESC);
"""

if __name__ == "__main__":
    for statement in SCHEMA.split(";"):
        stmt = statement.strip()
        if stmt:
            execute(stmt + ";")
    print("✓ Database setup complete!")
