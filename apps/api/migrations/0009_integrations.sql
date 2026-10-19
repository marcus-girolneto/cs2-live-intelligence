-- Third-party integration credentials managed by admins (Steam Web API, Stripe). Values are
-- AES-256-GCM ciphertext ("v1:" + iv | tag | data, the secret name bound as associated data),
-- never plaintext. Only the last 4 characters are kept in clear for display.
CREATE TABLE IF NOT EXISTS app_secrets (
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9]*\.[a-zA-Z0-9]+$'),
  ciphertext text NOT NULL,
  last4 text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL
);
-- Non-secret integration settings (e.g. Stripe enabled flag, publishable key, payment methods).
CREATE TABLE IF NOT EXISTS integration_settings (
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9]*$'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL
);
