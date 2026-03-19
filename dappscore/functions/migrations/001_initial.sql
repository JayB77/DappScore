-- DappScore VPS Migration: Firestore → PostgreSQL
-- Run once on a fresh database: psql $DATABASE_URL -f 001_initial.sql

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── API Keys ──────────────────────────────────────────────────────────────────
-- Replaces Firestore collection: api_keys/{keyId}
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
-- Replaces Firestore: user_alerts/{userId}/alerts/{alertId}
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
CREATE INDEX IF NOT EXISTS idx_alerts_user       ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_type        ON alerts(user_id, type);

-- ── Alert Preferences ─────────────────────────────────────────────────────────
-- Replaces Firestore: alert_preferences/{userId}
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
-- Replaces Firestore: webhooks/{webhookId}
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
-- Replaces Firestore: webhooks/{webhookId}/logs/{logId}
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
-- Replaces Firestore: feature_flags/{flagId}
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
-- Replaces Firestore: project_overrides/{projectId}
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
-- Replaces Firestore: project_sales/{projectId}
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
-- Replaces Firestore: scam_reports/{id}
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
-- Replaces Firestore: admin_audit_log/{logId}
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action    TEXT NOT NULL,
  payload   JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON admin_audit_log(timestamp DESC);

-- ── Claim Allocations ─────────────────────────────────────────────────────────
-- Replaces Firestore: claim_allocations/{address}
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
-- Replaces Firestore: airdrop_allocations/{address}
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
-- Fallback when Redis is unavailable. Primary cache is Redis.
CREATE TABLE IF NOT EXISTS stats_cache (
  key       TEXT PRIMARY KEY,
  value     JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Whale Tracking ────────────────────────────────────────────────────────────
-- Replaces Firestore: whale_labels/{address}, tracked_tokens/{address}
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
