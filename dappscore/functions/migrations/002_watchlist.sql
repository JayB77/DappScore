-- DappScore: User watchlist + per-project alert preferences
-- Run after 001_initial.sql: psql $DATABASE_URL -f 002_watchlist.sql

-- ── User Watchlist ─────────────────────────────────────────────────────────────
-- Stores projects a user is watching (off-chain, keyed by wallet address).
-- token_address + network allow the monitor service to poll on-chain state.
CREATE TABLE IF NOT EXISTS user_watchlist (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL,           -- wallet address
  project_id    TEXT NOT NULL,           -- project registry ID
  token_address TEXT,                    -- ERC-20 token contract address (nullable until known)
  network       TEXT NOT NULL DEFAULT 'mainnet',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Per-project alert overrides (all on by default)
  alert_liquidity_drop   BOOLEAN NOT NULL DEFAULT TRUE,
  alert_ownership_xfer   BOOLEAN NOT NULL DEFAULT TRUE,
  alert_trust_change     BOOLEAN NOT NULL DEFAULT TRUE,
  alert_scam_flag        BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user  ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_token ON user_watchlist(token_address)
  WHERE token_address IS NOT NULL;

-- ── Watchlist LP Snapshots ─────────────────────────────────────────────────────
-- Stores the last known LP reserve value per watched token so the hourly
-- monitor can detect >50% drops without re-fetching full history every run.
CREATE TABLE IF NOT EXISTS watchlist_lp_snapshots (
  token_address TEXT NOT NULL,
  network       TEXT NOT NULL DEFAULT 'mainnet',
  lp_usd        NUMERIC NOT NULL DEFAULT 0,    -- last observed LP value in USD
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_address, network)
);
