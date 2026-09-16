-- PH Painel — Neon schema
-- Snapshot JSONB do AppState (fonte de verdade actual; domínio mantém-se no TS).

CREATE TABLE IF NOT EXISTS ph_snapshots (
  id TEXT PRIMARY KEY DEFAULT 'default',
  schema_version INTEGER NOT NULL DEFAULT 4,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_snapshots_updated_at_idx ON ph_snapshots (updated_at DESC);
