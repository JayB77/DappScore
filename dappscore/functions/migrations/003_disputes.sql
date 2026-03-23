-- DappScore Migration 003: Dispute / Appeals System
-- Run: psql $DATABASE_URL -f 003_disputes.sql

-- ── Disputes ──────────────────────────────────────────────────────────────────
-- A dispute is a formal appeal filed by a project owner (or any wallet) when
-- they believe the automated flags or admin overrides for a project are wrong.
-- Lifecycle: pending → under_review → upheld | rejected | withdrawn
CREATE TABLE IF NOT EXISTS disputes (
  id             BIGSERIAL PRIMARY KEY,
  project_id     TEXT        NOT NULL,
  submitter      TEXT        NOT NULL,     -- wallet address
  category       TEXT        NOT NULL
                   CHECK (category IN (
                     'false_flag',         -- automated flag is wrong
                     'stale_data',         -- data is outdated
                     'wrong_score',        -- trust score is unfair
                     'other'
                   )),
  description    TEXT        NOT NULL,     -- project's explanation (2000 chars max)
  evidence_urls  TEXT[]      NOT NULL DEFAULT '{}',  -- supporting links
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','under_review','upheld','rejected','withdrawn')),
  votes_for      INTEGER     NOT NULL DEFAULT 0,   -- community: supports the appeal
  votes_against  INTEGER     NOT NULL DEFAULT 0,   -- community: opposes the appeal
  admin_notes    TEXT,                             -- shown to submitter on resolution
  resolved_by    TEXT,                             -- admin identifier
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_project    ON disputes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_submitter  ON disputes(submitter);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON disputes(status, created_at DESC);

-- ── Dispute Votes ─────────────────────────────────────────────────────────────
-- One vote per wallet per dispute (community sentiment, non-binding).
CREATE TABLE IF NOT EXISTS dispute_votes (
  dispute_id  BIGINT      NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  voter       TEXT        NOT NULL,   -- wallet address
  support     BOOLEAN     NOT NULL,   -- TRUE = supports the appeal, FALSE = opposes
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dispute_id, voter)
);

CREATE INDEX IF NOT EXISTS idx_dispute_votes_dispute ON dispute_votes(dispute_id);
