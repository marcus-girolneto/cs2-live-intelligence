-- Roles: admins manage app-wide AI configuration and settings; users manage only their own coaching.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- AI provider profiles. Secrets (API key, extra headers) are AES-256-GCM ciphertext, never plaintext.
CREATE TABLE IF NOT EXISTS ai_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  base_url text,
  api_key_enc text,
  key_last4 text,
  headers_enc text,
  header_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Which provider profile + model serves each purpose (post-match review, live calls).
CREATE TABLE IF NOT EXISTS ai_assignments (
  purpose text PRIMARY KEY CHECK (purpose IN ('review', 'live')),
  provider_id text NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Single-row app-wide settings; absent fields fall back to environment defaults.
CREATE TABLE IF NOT EXISTS app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Admin actions (never secrets). Kept when the admin account is deleted.
CREATE TABLE IF NOT EXISTS admin_audit (
  id text PRIMARY KEY,
  admin_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(created_at DESC);
