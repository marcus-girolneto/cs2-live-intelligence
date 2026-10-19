-- Steam-based accounts: public profile cached at sign-in (display only).
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
-- Coach personalization. player_steam_id is the in-demo identity used for learning when the
-- account is not Steam-linked (local accounts); Steam accounts always use users.steam_id.
CREATE TABLE IF NOT EXISTS coach_profiles (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  player_steam_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Every AI post-match review: what the coach said and how it was produced.
CREATE TABLE IF NOT EXISTS coach_reviews (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL REFERENCES demo_jobs(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  lang text NOT NULL,
  preferences jsonb NOT NULL,
  coaching jsonb NOT NULL,
  latency_ms integer NOT NULL,
  input_tokens integer,
  output_tokens integer,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_reviews_owner_time ON coach_reviews(owner_id, created_at DESC);
-- Every live between-round call.
CREATE TABLE IF NOT EXISTS coach_live_calls (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id text,
  round integer,
  call jsonb NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_live_calls_owner_time ON coach_live_calls(owner_id, created_at DESC);
