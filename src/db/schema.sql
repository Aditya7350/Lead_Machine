-- ============================================
-- AI LEAD MACHINE — DATABASE SCHEMA
-- Run: npm run db:setup
-- ============================================

-- Campaigns: niche + location combos
CREATE TABLE IF NOT EXISTS campaigns (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,                    -- "dentists-austin-tx"
  niche         TEXT NOT NULL,                    -- "dentists"
  keywords      TEXT[] NOT NULL DEFAULT '{}',     -- {"dentist","dental clinic","dental office"}
  city          TEXT NOT NULL,
  region        TEXT,                             -- state/province
  country_code  TEXT NOT NULL DEFAULT 'US',
  radius_km     INT NOT NULL DEFAULT 25,
  language      TEXT NOT NULL DEFAULT 'en',
  filters       JSONB NOT NULL DEFAULT '{}',      -- {max_rating, min_reviews, etc}
  send_limit    INT NOT NULL DEFAULT 15,          -- emails per day for this campaign
  status        TEXT NOT NULL DEFAULT 'active',   -- active | paused | completed
  schedule      TEXT DEFAULT 'daily',             -- cron expression or preset
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads: businesses found by scraper
CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id     TEXT REFERENCES campaigns(id),
  google_place_id TEXT UNIQUE,                    -- dedup key
  business_name   TEXT NOT NULL,
  niche           TEXT,
  phone           TEXT,
  email           TEXT,                           -- if found on website
  website_url     TEXT,
  address         TEXT,
  city            TEXT,
  country_code    TEXT,
  latitude        FLOAT,
  longitude       FLOAT,
  google_rating   FLOAT,
  review_count    INT DEFAULT 0,
  -- AI qualification
  website_score   INT,                            -- 1-10 from Claude
  ai_analysis     TEXT,                           -- what Claude found wrong
  qualification   TEXT DEFAULT 'pending',         -- pending | qualified | rejected
  -- Demo site
  demo_site_url   TEXT,
  demo_site_built BOOLEAN DEFAULT false,
  -- Pipeline status
  status          TEXT NOT NULL DEFAULT 'new',    -- new | qualified | demo_built | contacted | replied | converted | archived
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email sequences: tracks drip state per lead
CREATE TABLE IF NOT EXISTS email_sequences (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id       TEXT NOT NULL REFERENCES leads(id),
  campaign_id   TEXT REFERENCES campaigns(id),
  current_stage INT NOT NULL DEFAULT 0,           -- 0=not started, 1,2,3
  max_stages    INT NOT NULL DEFAULT 3,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | active | paused | completed | replied
  next_send_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual emails sent
CREATE TABLE IF NOT EXISTS emails_sent (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sequence_id     TEXT REFERENCES email_sequences(id),
  lead_id         TEXT NOT NULL REFERENCES leads(id),
  stage           INT NOT NULL,                   -- 1, 2, or 3
  resend_id       TEXT,                           -- Resend's email ID
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  to_email        TEXT NOT NULL,
  reply_to        TEXT,
  -- Tracking
  status          TEXT DEFAULT 'sent',            -- sent | delivered | opened | clicked | replied | bounced
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated demo sites
CREATE TABLE IF NOT EXISTS demo_sites (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id       TEXT NOT NULL REFERENCES leads(id),
  html_content  TEXT NOT NULL,
  deploy_url    TEXT,                             -- vercel/netlify URL
  deploy_id     TEXT,                             -- vercel deployment ID
  expires_at    TIMESTAMPTZ,                      -- auto-cleanup
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity log for dashboard
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type        TEXT NOT NULL,                      -- scrape | qualify | build | email | reply | convert
  campaign_id TEXT,
  lead_id     TEXT,
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(google_place_id);
CREATE INDEX IF NOT EXISTS idx_sequences_next_send ON email_sequences(next_send_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sequences_lead ON email_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON emails_sent(resend_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type, created_at DESC);
