-- DappScore Migration 004: Idempotent full-schema ensure
-- Safe to run at any time — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Run this if you are unsure which earlier migrations have been applied:
--   psql $DATABASE_URL -f 004_ensure_all_tables.sql

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  key_hash      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL,
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL,
  project_id    TEXT,
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  rotated_from  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner_active ON api_keys(owner_id, active);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash         ON api_keys(key_hash) WHERE active = TRUE;

-- ── Alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  data       JSONB,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_user        ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread  ON alerts(user_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_type         ON alerts(user_id, type);

-- ── Alert Preferences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_preferences (
  user_id               TEXT PRIMARY KEY,
  enable_email          BOOLEAN NOT NULL DEFAULT FALSE,
  enable_telegram       BOOLEAN NOT NULL DEFAULT FALSE,
  enable_webhook        BOOLEAN NOT NULL DEFAULT FALSE,
  enable_push           BOOLEAN NOT NULL DEFAULT FALSE,
  trust_change_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
  scam_flag_alerts      BOOLEAN NOT NULL DEFAULT TRUE,
  whale_activity_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  vote_threshold_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  market_alerts         BOOLEAN NOT NULL DEFAULT FALSE,
  min_severity          TEXT NOT NULL DEFAULT 'low'
                          CHECK (min_severity IN ('low','medium','high','critical')),
  telegram_chat_id      TEXT,
  webhook_url           TEXT,
  email_address         TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Webhooks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  url            TEXT NOT NULL,
  events         TEXT[] NOT NULL DEFAULT '{all}',
  secret         TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ,
  last_triggered TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user   ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = TRUE;

-- ── Webhook Delivery Logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event      TEXT NOT NULL,
  status     INTEGER NOT NULL DEFAULT 0,
  ok         BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_wh ON webhook_logs(webhook_id, timestamp DESC);

-- ── Feature Flags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id          TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  rollout     INTEGER CHECK (rollout >= 0 AND rollout <= 100),
  allowlist   TEXT[],
  metadata    JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Project Overrides ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_overrides (
  project_id     TEXT PRIMARY KEY,
  trust_level    INTEGER CHECK (trust_level >= 0 AND trust_level <= 5),
  verified       BOOLEAN,
  scam_flag      BOOLEAN,
  scam_reason    TEXT,
  featured       BOOLEAN,
  banner_message TEXT,
  risk_flags     TEXT[],
  notes          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Project Sales ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_sales (
  project_id       TEXT PRIMARY KEY,
  raised           NUMERIC NOT NULL,
  goal             NUMERIC NOT NULL,
  currency         TEXT NOT NULL,
  token_price      NUMERIC NOT NULL,
  start_date       BIGINT NOT NULL,
  end_date         BIGINT NOT NULL,
  min_contribution NUMERIC,
  max_contribution NUMERIC,
  sale_contract    TEXT,
  network          TEXT,
  updated_at       BIGINT NOT NULL
);

-- ── Scam Reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scam_reports (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','investigating','confirmed','dismissed')),
  resolution TEXT,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scam_reports_status ON scam_reports(status, created_at DESC);

-- ── Admin Audit Log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action    TEXT NOT NULL,
  payload   JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON admin_audit_log(timestamp DESC);

-- ── Claim Allocations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_allocations (
  address    TEXT PRIMARY KEY,
  votes      INTEGER NOT NULL DEFAULT 0,
  score      INTEGER NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claim_score ON claim_allocations(score DESC);

-- ── Airdrop Allocations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS airdrop_allocations (
  address    TEXT PRIMARY KEY,
  votes      INTEGER NOT NULL DEFAULT 0,
  score      INTEGER NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_airdrop_score ON airdrop_allocations(score DESC);

-- ── Stats Cache ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_cache (
  key       TEXT PRIMARY KEY,
  value     JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Whale Tracking ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whale_labels (
  address    TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'whale'
               CHECK (type IN ('whale','exchange','team','fund','bot','other')),
  notes      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracked_tokens (
  token_address TEXT PRIMARY KEY,
  symbol        TEXT NOT NULL DEFAULT '',
  price_usd     NUMERIC NOT NULL DEFAULT 0,
  network       TEXT NOT NULL DEFAULT 'mainnet',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User Watchlist (migration 002) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watchlist (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  token_address TEXT,
  network       TEXT NOT NULL DEFAULT 'mainnet',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_liquidity_drop   BOOLEAN NOT NULL DEFAULT TRUE,
  alert_ownership_xfer   BOOLEAN NOT NULL DEFAULT TRUE,
  alert_trust_change     BOOLEAN NOT NULL DEFAULT TRUE,
  alert_scam_flag        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user  ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_token ON user_watchlist(token_address)
  WHERE token_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS watchlist_lp_snapshots (
  token_address TEXT NOT NULL,
  network       TEXT NOT NULL DEFAULT 'mainnet',
  lp_usd        NUMERIC NOT NULL DEFAULT 0,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_address, network)
);

-- ── Disputes / Appeals (migration 003) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id             BIGSERIAL PRIMARY KEY,
  project_id     TEXT        NOT NULL,
  submitter      TEXT        NOT NULL,
  category       TEXT        NOT NULL
                   CHECK (category IN ('false_flag','stale_data','wrong_score','other')),
  description    TEXT        NOT NULL,
  evidence_urls  TEXT[]      NOT NULL DEFAULT '{}',
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','under_review','upheld','rejected','withdrawn')),
  votes_for      INTEGER     NOT NULL DEFAULT 0,
  votes_against  INTEGER     NOT NULL DEFAULT 0,
  admin_notes    TEXT,
  resolved_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_disputes_project   ON disputes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_submitter ON disputes(submitter);
CREATE INDEX IF NOT EXISTS idx_disputes_status    ON disputes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS dispute_votes (
  dispute_id  BIGINT      NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  voter       TEXT        NOT NULL,
  support     BOOLEAN     NOT NULL,
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dispute_id, voter)
);
CREATE INDEX IF NOT EXISTS idx_dispute_votes_dispute ON dispute_votes(dispute_id);
