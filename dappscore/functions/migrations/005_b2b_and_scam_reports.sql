-- DappScore Migration 005: B2B API Accounts + Community Scam Reports
-- Run: psql $DATABASE_URL -f functions/migrations/005_b2b_and_scam_reports.sql

-- ── B2B Accounts ──────────────────────────────────────────────────────────────
-- Exchanges, wallets, launchpads that pay to query our trust/scam data
CREATE TABLE IF NOT EXISTS b2b_accounts (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  company_name             TEXT NOT NULL,
  contact_name             TEXT,
  email                    TEXT NOT NULL UNIQUE,
  website                  TEXT,
  use_case                 TEXT,
  api_key_hash             TEXT NOT NULL UNIQUE,
  api_key_prefix           TEXT NOT NULL,          -- first 12 chars for display
  tier                     TEXT NOT NULL DEFAULT 'starter'
                             CHECK (tier IN ('starter','professional','enterprise')),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','active','suspended','cancelled')),
  -- Billing / quotas
  monthly_query_limit      INTEGER NOT NULL DEFAULT 1000,
  queries_this_month       INTEGER NOT NULL DEFAULT 0,
  billing_cycle_start      TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
  -- Pricing model: 'per_query' charges per call, 'flat_rate' is unlimited up to tier limit
  pricing_model            TEXT NOT NULL DEFAULT 'per_query'
                             CHECK (pricing_model IN ('per_query','flat_rate')),
  price_per_query_usd      NUMERIC(10,6) DEFAULT 0.005,  -- $0.005/query default
  flat_rate_monthly_usd    NUMERIC(10,2),
  -- Metadata
  admin_notes              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b2b_accounts_status ON b2b_accounts(status);
CREATE INDEX IF NOT EXISTS idx_b2b_accounts_email  ON b2b_accounts(email);
CREATE INDEX IF NOT EXISTS idx_b2b_key_hash        ON b2b_accounts(api_key_hash) WHERE status = 'active';

-- ── B2B Query Logs ────────────────────────────────────────────────────────────
-- Audit trail + billing basis for per-query accounts
CREATE TABLE IF NOT EXISTS b2b_query_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id      TEXT NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  query_type      TEXT NOT NULL
                    CHECK (query_type IN ('wallet_check','contract_check','batch_check','report_feed')),
  address         TEXT NOT NULL,
  chain           TEXT NOT NULL DEFAULT 'ethereum',
  risk_score      INTEGER,          -- cached result summary
  response_cached BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b2b_logs_account     ON b2b_query_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_logs_address     ON b2b_query_logs(address);
-- monthly billing queries use idx_b2b_logs_account (account_id, created_at DESC)

-- ── Community Scam Reports ────────────────────────────────────────────────────
-- Public reports submitted via form or B2B integration
CREATE TABLE IF NOT EXISTS community_scam_reports (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  address           TEXT NOT NULL,
  chain             TEXT NOT NULL DEFAULT 'ethereum',
  report_type       TEXT NOT NULL
                      CHECK (report_type IN ('wallet','contract','exchange','cex','website','other')),
  category          TEXT NOT NULL
                      CHECK (category IN ('rug_pull','phishing','fake_project','ponzi','honeypot',
                                         'exit_scam','fake_team','pump_dump','impersonation','other')),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  evidence          TEXT[] DEFAULT '{}',        -- tx hashes, screenshot URLs, etc.
  reporter_address  TEXT,                        -- wallet address (optional)
  reporter_email    TEXT,                        -- email for follow-up (optional)
  -- Moderation
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','investigating','confirmed','dismissed','spam')),
  severity          TEXT CHECK (severity IN ('low','medium','high','critical')),
  admin_notes       TEXT,
  reviewed_by       TEXT,                        -- admin wallet who reviewed
  -- Community voting on the report itself
  votes_confirm     INTEGER NOT NULL DEFAULT 0,
  votes_dismiss     INTEGER NOT NULL DEFAULT 0,
  -- Timestamps
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scam_reports_address  ON community_scam_reports(address);
CREATE INDEX IF NOT EXISTS idx_scam_reports_status   ON community_scam_reports(status);
CREATE INDEX IF NOT EXISTS idx_scam_reports_chain    ON community_scam_reports(chain, status);
CREATE INDEX IF NOT EXISTS idx_scam_reports_created  ON community_scam_reports(created_at DESC);

-- ── Scam Report Votes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scam_report_votes (
  report_id   TEXT NOT NULL REFERENCES community_scam_reports(id) ON DELETE CASCADE,
  voter_id    TEXT NOT NULL,   -- wallet address
  vote        TEXT NOT NULL CHECK (vote IN ('confirm','dismiss')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_id, voter_id)
);

-- ── Tier quotas reference ─────────────────────────────────────────────────────
-- Not a real table, just for documentation. Enforced in application code.
-- starter:      1,000 queries/month,  per_query  $0.005
-- professional: 50,000 queries/month, flat_rate  $199/month
-- enterprise:   unlimited,            flat_rate  custom
