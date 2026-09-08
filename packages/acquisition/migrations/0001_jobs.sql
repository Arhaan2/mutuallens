PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS capacity (
  period TEXT PRIMARY KEY,
  ceiling INTEGER NOT NULL CHECK(ceiling >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0),
  spent INTEGER NOT NULL DEFAULT 0 CHECK(spent >= 0)
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  request_key TEXT NOT NULL,
  period TEXT NOT NULL REFERENCES capacity(period),
  reservation INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  UNIQUE(session_hash, request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_scan ON jobs(active) WHERE active = 1;
CREATE INDEX IF NOT EXISTS expiring_jobs ON jobs(expires_at);
CREATE TABLE IF NOT EXISTS records (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('followers','following')),
  identity TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(job_id, direction, identity)
);
CREATE TABLE IF NOT EXISTS receipts (
  session_hash TEXT NOT NULL,
  request_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(session_hash, request_key)
);
-- Expired graphs are erased even if remote deletion is unavailable. No account,
-- session, relationship, or cursor data is retained in this retry queue.
CREATE TABLE IF NOT EXISTS remote_cleanup (
  run_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0
);
