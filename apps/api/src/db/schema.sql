-- ── Agents table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT         NOT NULL,
  description       TEXT,

  -- Developer who listed the agent
  developer_wallet  TEXT         NOT NULL,

  -- ERC-20 token that gates access to this agent
  token_address     TEXT         NOT NULL,

  -- CreateOS project internals (stored but NOT exposed to users)
  createos_project_id   TEXT,
  createos_env_id       TEXT,
  createos_deployment_id TEXT,

  -- The actual container URL on CreateOS (HIDDEN from users)
  internal_url      TEXT,

  -- Resource limits used
  cpu_millis        INTEGER      NOT NULL DEFAULT 200,
  memory_mb         INTEGER      NOT NULL DEFAULT 512,

  -- What internal port the agent container listens on
  container_port    INTEGER      NOT NULL DEFAULT 8080,

  -- Current lifecycle status
  status            TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (status IN (
                                   'pending',
                                   'deploying',
                                   'deployed',
                                   'failed',
                                   'stopped'
                                 )),

  error_message     TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Access log (audit trail of who used which agent) ────────────────────────
CREATE TABLE IF NOT EXISTS access_log (
  id              BIGSERIAL    PRIMARY KEY,
  agent_id        UUID         NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address  TEXT         NOT NULL,
  token_balance   TEXT         NOT NULL,  -- stored as string (uint256)
  path            TEXT         NOT NULL,
  method          TEXT         NOT NULL,
  status_code     INTEGER,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agents_token_address ON agents(token_address);
CREATE INDEX IF NOT EXISTS idx_agents_developer    ON agents(developer_wallet);
CREATE INDEX IF NOT EXISTS idx_access_log_agent    ON access_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_access_log_wallet   ON access_log(wallet_address);
