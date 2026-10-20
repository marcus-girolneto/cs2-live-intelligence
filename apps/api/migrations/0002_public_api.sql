-- Public API (/api/v1): personal API keys, their audit trail, idempotent uploads and webhooks.
-- See docs/PUBLIC_API.md and docs/DATABASE.md.

-- Personal API keys. Only an HMAC-SHA256 of the full key is stored (server pepper derived from
-- APP_ENCRYPTION_KEY); `prefix` (fm_live_ + 4 characters) is shown in lists to tell keys apart.
CREATE TABLE api_keys (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL CHECK (cardinality(scopes) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  -- HMAC of the caller's /24 (IPv4) or /48 (IPv6) network, never the address itself.
  last_used_ip_hash text,
  expires_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX api_keys_owner ON api_keys(owner_id, created_at DESC);

-- Key lifecycle and denied uses (create, revoke, wrong scope, expired or revoked key).
CREATE TABLE api_key_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_key_events_owner ON api_key_events(owner_id, created_at DESC);
CREATE INDEX api_key_events_key ON api_key_events(key_id);

-- Idempotency-Key of POST /api/v1/demos: the first response is replayed for 24 hours.
CREATE TABLE api_idempotency (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  status integer,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, key)
);
CREATE INDEX api_idempotency_time ON api_idempotency(created_at);

-- Webhook endpoints. The signing secret is stored encrypted (AES-256-GCM): it is needed to
-- sign every delivery. Disabled automatically after repeated failed attempts.
CREATE TABLE webhooks (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (char_length(url) <= 2048),
  events text[] NOT NULL CHECK (cardinality(events) BETWEEN 1 AND 8),
  secret_ciphertext text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  consecutive_failures integer NOT NULL DEFAULT 0,
  disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhooks_owner ON webhooks(owner_id, created_at DESC);
CREATE INDEX webhooks_active ON webhooks(owner_id) WHERE active;

-- Delivery outbox: one row per (webhook, event, subject); retried with exponential backoff by
-- the API process. Kept 30 days.
CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event text NOT NULL,
  ref text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (webhook_id, event, ref)
);
CREATE INDEX webhook_deliveries_owner ON webhook_deliveries(owner_id, created_at DESC);
CREATE INDEX webhook_deliveries_due ON webhook_deliveries(next_attempt_at) WHERE status = 'pending';
CREATE INDEX webhook_deliveries_time ON webhook_deliveries(created_at);
