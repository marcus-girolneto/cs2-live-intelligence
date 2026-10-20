-- FRAGMIND baseline schema (squashes migrations 0001–0012; see docs/DATABASE.md).
-- Conventions: every row that belongs to a player hangs off users.id with ON DELETE CASCADE;
-- generated ids are uuid (users.id stays text: the local development identity is 'dev-owner');
-- every foreign-key column is the leading column of an index (test/schema.test.ts checks it);
-- bulky match artifacts live in object storage (<matchId>.analysis|events|replay.json.gz).
-- Unqualified names: tests apply this file inside a per-test schema (search_path).

-- ─── Accounts, sessions, devices ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id text PRIMARY KEY,
  steam_id text UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  telemetry_consent boolean NOT NULL DEFAULT false,
  analytics_consent boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30 CONSTRAINT users_retention_days_check CHECK (retention_days BETWEEN 1 AND 365),
  -- Cached public Steam profile (display only), refreshed at sign-in and when older than 6 hours.
  steam_profile jsonb,
  steam_profile_fetched_at timestamptz,
  display_name text,
  avatar_url text,
  profile_url text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_sessions (
  token_hash text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX app_sessions_owner ON app_sessions(owner_id);
CREATE INDEX app_sessions_expires ON app_sessions(expires_at);
CREATE TABLE auth_codes (
  code_hash text PRIMARY KEY,
  binding_hash text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_codes_owner ON auth_codes(owner_id);
CREATE TABLE openid_states (state_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE INDEX openid_states_expires ON openid_states(expires_at);
CREATE TABLE openid_nonces (nonce text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX openid_nonces_time ON openid_nonces(created_at);
CREATE TABLE devices (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX devices_owner ON devices(owner_id);
CREATE TABLE pairing_codes (
  code_hash text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  device_id text REFERENCES devices(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX pairing_codes_owner ON pairing_codes(owner_id);
CREATE INDEX pairing_codes_device ON pairing_codes(device_id);
CREATE TABLE live_sessions (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_sessions_owner_time ON live_sessions(owner_id, updated_at DESC);
CREATE INDEX live_sessions_device ON live_sessions(device_id);

-- Collector event ids (idempotency of GSI ingestion). Append-only, partitioned by month; global
-- retention (default 30 days) drops whole partitions. Dedupe runs under the device row lock.
CREATE TABLE telemetry_events (
  device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, event_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX telemetry_events_owner_time ON telemetry_events(owner_id, created_at);

CREATE TABLE coach_profiles (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- In-demo identity for accounts not linked to Steam ("this is me").
  player_steam_id text,
  auto_review jsonb NOT NULL DEFAULT '{"enabled":false,"tier":"quick"}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE feedback (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_owner_time ON feedback(owner_id, created_at);
-- Product analytics (consented). Partitioned by month; global retention default 180 days.
CREATE TABLE product_events (
  id uuid NOT NULL,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  properties jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX product_events_owner_time ON product_events(owner_id, created_at);

-- ─── Matches ────────────────────────────────────────────────────────────────────────────────
-- One parsed demo per (checksum, parser version), shared by every upload of the same bytes.
-- The full analysis (players, evidence, integrity…) is <id>.analysis.json.gz in object storage;
-- events and the 2D replay are <id>.events.json.gz / <id>.replay.json.gz. Deleted (with its
-- files, through file_deletions) once no upload references it.
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  checksum text NOT NULL,
  parser_version text,
  map text,
  -- Upload time of the first upload until demos carry a reliable match date.
  played_at timestamptz NOT NULL DEFAULT now(),
  played_at_source text NOT NULL DEFAULT 'upload' CHECK (played_at_source IN ('upload', 'demo')),
  tick_rate integer,
  rounds_count integer NOT NULL DEFAULT 0,
  score_ct integer,
  score_t integer,
  -- Slim: schemaVersion, source, map, provenance, roundOutcomes, caveats.
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Offline (non-AI) coaching computed with the analysis.
  coaching jsonb,
  analysis_key text NOT NULL,
  events_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checksum, parser_version)
);
-- One row per player per match: the numbers progress, lobby, ownership and ban checks need.
CREATE TABLE match_players (
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  name text,
  team_start text CHECK (team_start IN ('CT', 'T')),
  kills integer,
  deaths integer,
  assists integer,
  adr real,
  kast real,
  hs_pct real,
  accuracy real,
  traded_deaths_pct real,
  opening_win_pct real,
  utility_damage_per_round real,
  -- From deep reviews (crosshair placement / positioning), filled when a deep review is saved.
  crosshair_median_deg real,
  isolated_deaths_pct real,
  rounds_played integer NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, steam_id)
);
CREATE INDEX match_players_steam ON match_players(steam_id, match_id);

-- An account's upload of a demo (the id is the analysis id used by every URL). Replaces
-- match_ownership. match_id is null until the demo is parsed or deduplicated.
CREATE TABLE uploads (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE RESTRICT,
  checksum text NOT NULL,
  filename text NOT NULL,
  object_key text NOT NULL UNIQUE,
  size bigint NOT NULL,
  -- Whether the match is the account's own ("mine") or someone else's ("external").
  ownership text CHECK (ownership IN ('mine', 'external')),
  player_steam_id text,
  matched_by text CHECK (matched_by IN ('steam', 'chosen', 'user', 'none')),
  ownership_updated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uploads_owner_time ON uploads(owner_id, created_at DESC);
CREATE INDEX uploads_match ON uploads(match_id);
CREATE INDEX uploads_checksum ON uploads(checksum);
CREATE INDEX uploads_unclassified ON uploads(completed_at) WHERE match_id IS NOT NULL AND ownership IS NULL;

-- Work queue: the current job of each upload. kind: parse (fresh upload, deduplicated when the
-- match exists), reparse (admin re-run: analysis hidden until done), reprocess (parser upgrade
-- in the background: the current analysis stays visible). Two attempts, leased + fenced.
CREATE TABLE demo_jobs (
  upload_id uuid PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'parse' CHECK (kind IN ('parse', 'reparse', 'reprocess')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  -- 0 = admins and plans with priorityQueue (Pro), 1 = everyone else.
  priority smallint NOT NULL DEFAULT 1,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  lease_token text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_jobs_queue ON demo_jobs(status, priority, created_at) WHERE status IN ('queued', 'processing');
CREATE TABLE parser_runtime (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Steam ban state of a match's participants (docs/INTEGRITY.md), checked after the match is
-- parsed and again 7 and 30 days later; next_check_at null once done.
CREATE TABLE match_bans (
  match_id uuid PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  bans jsonb NOT NULL DEFAULT '[]'::jsonb,
  checks integer NOT NULL DEFAULT 0,
  checked_at timestamptz,
  next_check_at timestamptz DEFAULT now()
);
CREATE INDEX match_bans_due ON match_bans(next_check_at) WHERE next_check_at IS NOT NULL;
-- Object storage deletion outbox (demos and match artifacts); processed rows are kept 7 days.
CREATE TABLE file_deletions (
  object_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX file_deletions_pending ON file_deletions(created_at) WHERE processed_at IS NULL;
CREATE INDEX file_deletions_processed ON file_deletions(processed_at) WHERE processed_at IS NOT NULL;

-- ─── AI reviews and coaching history ────────────────────────────────────────────────────────
-- Every AI post-match review: player reviews (quick, deep) and team reviews in one table.
CREATE TABLE ai_reviews (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('quick', 'deep', 'team')),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  variant text NOT NULL DEFAULT 'a' CHECK (variant IN ('a', 'b')),
  lang text NOT NULL,
  -- Coaching preferences used (player reviews only).
  preferences jsonb,
  payload jsonb NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  input_tokens integer,
  output_tokens integer,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reviews_owner_time ON ai_reviews(owner_id, created_at DESC);
CREATE INDEX ai_reviews_upload ON ai_reviews(upload_id, steam_id, created_at DESC);
CREATE INDEX ai_reviews_ratings ON ai_reviews(kind, prompt_version, variant);
-- Auto-review after processing: one row per upload (idempotent claim).
CREATE TABLE auto_reviews (
  upload_id uuid PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'skipped', 'failed')),
  reason text,
  review_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auto_reviews_owner ON auto_reviews(owner_id);
CREATE INDEX auto_reviews_status ON auto_reviews(status, updated_at);
-- Every live between-round call (follows the account's retention).
CREATE TABLE coach_live_calls (
  id uuid PRIMARY KEY,
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
CREATE INDEX coach_live_calls_owner_time ON coach_live_calls(owner_id, created_at DESC);
-- Pro "Personal Coach" plans built from the whole match history.
CREATE TABLE personal_coach_plans (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  lang text NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('manual', 'auto')),
  plan jsonb NOT NULL,
  based_on_matches integer NOT NULL,
  last_analysis_at timestamptz,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_coach_owner_time ON personal_coach_plans(owner_id, created_at DESC);
-- Pro monthly reports: one scheduled and one on-demand per period.
CREATE TABLE reports (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  source text NOT NULL CHECK (source IN ('scheduled', 'on_demand')),
  steam_id text,
  report jsonb NOT NULL,
  provider text,
  model text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, period, source)
);
CREATE INDEX reports_owner_time ON reports(owner_id, created_at DESC);

-- ─── AI configuration and app settings ──────────────────────────────────────────────────────
-- Secrets (API key, extra headers) are AES-256-GCM ciphertext, never plaintext.
CREATE TABLE ai_providers (
  id uuid PRIMARY KEY,
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
CREATE TABLE ai_assignments (
  purpose text PRIMARY KEY CHECK (purpose IN ('review_quick', 'review_deep', 'review_team', 'verify', 'live', 'report', 'personal_coach')),
  provider_id uuid NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
  model text NOT NULL,
  -- Per-purpose options (output-token budget, reasoning effort); {} = defaults.
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_assignments_provider ON ai_assignments(provider_id);
CREATE TABLE ai_eval_reports (
  id uuid PRIMARY KEY,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_eval_reports_time ON ai_eval_reports(created_at DESC);
-- Single-row app settings (absent keys use code defaults; `retention` holds the global
-- retention of append-only tables).
CREATE TABLE app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Admin actions (never secrets). Kept when the admin account is deleted; 365-day retention.
CREATE TABLE admin_audit (
  id uuid PRIMARY KEY,
  admin_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_time ON admin_audit(created_at DESC);
CREATE INDEX admin_audit_admin ON admin_audit(admin_id);
-- Third-party integration credentials (AES-256-GCM, secret name bound as associated data).
CREATE TABLE app_secrets (
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9]*\.[a-zA-Z0-9]+$'),
  ciphertext text NOT NULL,
  last4 text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX app_secrets_updated_by ON app_secrets(updated_by);
CREATE TABLE integration_settings (
  name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9]*$'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX integration_settings_updated_by ON integration_settings(updated_by);

-- ─── Plans, usage, billing, credits ─────────────────────────────────────────────────────────
CREATE TABLE plans (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{0,31}$'),
  name text NOT NULL,
  -- {"BRL": {"month": 1490, "year": 14900}, ...} in minor units.
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional Stripe price ids keyed "<CURRENCY>_<interval>".
  stripe_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO plans(id, name, prices, limits, active, sort) VALUES
  ('free', 'Free', '{}'::jsonb,
   '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":0,"uploadsPerDay":2,"retentionDaysMax":30,"monthlyCredits":0,"clipExport":false,"perMapLearning":false,"cheaperDeep":false,"monthlyReport":false,"reel":false,"deepHistory":false,"priorityQueue":false,"personalCoach":false}'::jsonb, true, 0),
  ('basic', 'Basic', '{"BRL":{"month":1490,"year":14900},"USD":{"month":499,"year":4990}}'::jsonb,
   '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":1,"uploadsPerDay":5,"retentionDaysMax":90,"monthlyCredits":15,"clipExport":true,"perMapLearning":false,"cheaperDeep":false,"monthlyReport":false,"reel":false,"deepHistory":false,"priorityQueue":false,"personalCoach":false}'::jsonb, true, 1),
  ('pro', 'Pro', '{"BRL":{"month":2990,"year":29900},"USD":{"month":999,"year":9990}}'::jsonb,
   '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":5,"uploadsPerDay":15,"retentionDaysMax":365,"monthlyCredits":45,"clipExport":true,"perMapLearning":true,"cheaperDeep":true,"monthlyReport":true,"reel":true,"deepHistory":true,"priorityQueue":true,"personalCoach":true}'::jsonb, true, 2);
CREATE TABLE subscriptions (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  source text NOT NULL CHECK (source IN ('admin', 'stripe')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
-- Daily counters ("day" is the local calendar day of the app time zone); 90-day retention.
CREATE TABLE usage_counters (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ai_review', 'upload')),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (owner_id, day, kind)
);
CREATE INDEX usage_counters_day ON usage_counters(day);
CREATE TABLE usage_live_matches (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  match_key text NOT NULL,
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (owner_id, day, match_key)
);
CREATE INDEX usage_live_matches_day ON usage_live_matches(day);
CREATE TABLE provider_usage (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, day)
);
CREATE INDEX provider_usage_day ON provider_usage(day);
CREATE TABLE billing_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Append-only ledger: the source of truth for every credit movement (unique per owner+reason+ref).
CREATE TABLE credit_ledger (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('welcome', 'plan_grant', 'purchase', 'review_quick', 'review_deep', 'review_team', 'refund', 'admin_adjust', 'expire')),
  bucket text NOT NULL CHECK (bucket IN ('plan', 'purchased', 'bonus')),
  ref text,
  note text,
  admin_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX credit_ledger_idempotency ON credit_ledger(owner_id, reason, ref) WHERE ref IS NOT NULL;
CREATE INDEX credit_ledger_owner_time ON credit_ledger(owner_id, created_at DESC);
-- Materialized balances, updated in the same transaction as the ledger.
CREATE TABLE credit_wallets (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_balance integer NOT NULL DEFAULT 0 CHECK (plan_balance >= 0),
  bonus_balance integer NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  purchased_balance integer NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  plan_expires_at timestamptz,
  welcome_status text CHECK (welcome_status IN ('granted', 'ineligible', 'pending')),
  welcome_reason text,
  welcome_ip_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Credits reserved by in-flight AI reviews (reserve → commit/release); expired holds are ignored.
CREATE TABLE credit_holds (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan integer NOT NULL DEFAULT 0 CHECK (plan >= 0),
  bonus integer NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  purchased integer NOT NULL DEFAULT 0 CHECK (purchased >= 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX credit_holds_owner ON credit_holds(owner_id);
CREATE INDEX credit_holds_expires ON credit_holds(expires_at);
-- One welcome grant per Steam account ever: HMAC of the SteamID64, not linked to the account.
CREATE TABLE welcome_grants (
  steam_id_hash text PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip_prefix_hash text
);
CREATE INDEX welcome_grants_network ON welcome_grants(ip_prefix_hash, granted_at);
CREATE TABLE credit_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credit_packs (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{0,31}$'),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge text,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO credit_packs(id, name, credits, prices, badge, active, sort) VALUES
  ('starter', 'Starter', 10, '{"BRL":990,"USD":299}'::jsonb, NULL, true, 0),
  ('standard', 'Standard', 30, '{"BRL":2490,"USD":749}'::jsonb, 'popular', true, 1),
  ('pro-pack', 'Pro pack', 100, '{"BRL":6990,"USD":1999}'::jsonb, 'best_value', true, 2);

-- Deletes matches no upload references any more (account deletion, retention, an upload moved
-- to a newer parse) unless an upload of the same demo still has queued/processing work, and
-- schedules their object-storage artifacts for deletion. Returns how many matches went away.
-- A match shared with another account is referenced by that account's upload and survives.
-- `only_checksum` limits the scan to one demo (after a job finished); null = every match.
CREATE FUNCTION delete_unreferenced_matches(only_checksum text DEFAULT NULL) RETURNS integer
LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM matches m
    WHERE (only_checksum IS NULL OR m.checksum = only_checksum)
      AND NOT EXISTS (SELECT 1 FROM uploads u WHERE u.match_id = m.id)
      AND NOT EXISTS (
        SELECT 1 FROM uploads u JOIN demo_jobs j ON j.upload_id = u.id
        WHERE u.checksum = m.checksum AND j.status IN ('queued', 'processing'))
    RETURNING m.id
  ), files AS (
    INSERT INTO file_deletions(object_key)
    SELECT g.id::text || s.suffix FROM gone g
    CROSS JOIN (VALUES ('.analysis.json.gz'), ('.events.json.gz'), ('.replay.json.gz')) AS s(suffix)
    ON CONFLICT (object_key) DO UPDATE SET processed_at = NULL, created_at = now()
  )
  SELECT count(*)::integer FROM gone
$$;

-- ─── Monthly partitions ─────────────────────────────────────────────────────────────────────
-- Creates the monthly partitions of `parent` from the current month to `months_ahead` months
-- ahead (idempotent). Run after every migration and by the daily maintenance job; retention
-- drops whole partitions older than the table's retention. Partitions live in the parent's
-- schema and are named <parent>_pYYYYMM.
CREATE FUNCTION ensure_month_partitions(parent text, months_ahead integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  nsp text;
  start_month date := date_trunc('month', now())::date;
  m date;
  created integer := 0;
  part text;
BEGIN
  SELECT n.nspname INTO nsp FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.oid = to_regclass(parent);
  IF nsp IS NULL THEN RAISE EXCEPTION 'unknown table %', parent; END IF;
  FOR i IN 0..months_ahead LOOP
    m := (start_month + make_interval(months => i))::date;
    part := parent || '_p' || to_char(m, 'YYYYMM');
    IF to_regclass(format('%I.%I', nsp, part)) IS NULL THEN
      EXECUTE format('CREATE TABLE %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
        nsp, part, nsp, parent, m, (m + interval '1 month')::date);
      created := created + 1;
    END IF;
  END LOOP;
  RETURN created;
END $$;
SELECT ensure_month_partitions('telemetry_events', 2);
SELECT ensure_month_partitions('product_events', 2);
