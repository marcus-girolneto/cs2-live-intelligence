-- Credits wallet, review tiers, welcome credits (anti-farm), credit packs and Pro reports.

-- Append-only ledger: the source of truth for every credit movement. Spends of one review
-- that span buckets use ref "<reviewId>:<bucket>"; plan grants "period:<ISO period start>".
CREATE TABLE IF NOT EXISTS credit_ledger (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('welcome', 'plan_grant', 'purchase', 'review_quick', 'review_deep', 'refund', 'admin_adjust', 'expire')),
  bucket text NOT NULL CHECK (bucket IN ('plan', 'purchased', 'bonus')),
  ref text,
  note text,
  admin_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency ON credit_ledger(owner_id, reason, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_ledger_owner_time ON credit_ledger(owner_id, created_at DESC);

-- Materialized balances, updated in the same transaction as the ledger (SELECT ... FOR UPDATE).
CREATE TABLE IF NOT EXISTS credit_wallets (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_balance integer NOT NULL DEFAULT 0 CHECK (plan_balance >= 0),
  bonus_balance integer NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  purchased_balance integer NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  plan_expires_at timestamptz,
  -- Welcome credits: evaluation state for GET /v1/me (the grant itself is in welcome_grants).
  welcome_status text CHECK (welcome_status IN ('granted', 'ineligible', 'pending')),
  welcome_reason text,
  -- HMAC of the last Steam sign-in network prefix (re-evaluation on profile refresh).
  welcome_ip_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Credits reserved by in-flight AI reviews (reserve → commit/release). Expired holds are ignored.
CREATE TABLE IF NOT EXISTS credit_holds (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan integer NOT NULL DEFAULT 0 CHECK (plan >= 0),
  bonus integer NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  purchased integer NOT NULL DEFAULT 0 CHECK (purchased >= 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_holds_owner ON credit_holds(owner_id);

-- One welcome grant per Steam account EVER. Only an HMAC of the SteamID64 is stored (keyed by a
-- secret derived from APP_ENCRYPTION_KEY) and the row is deliberately NOT deleted with the
-- account, so deleting and re-creating an account cannot farm credits. ip_prefix_hash is an
-- HMAC of the sign-in /24 (IPv4) or /48 (IPv6) prefix, for the per-network limit.
CREATE TABLE IF NOT EXISTS welcome_grants (
  steam_id_hash text PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip_prefix_hash text
);
CREATE INDEX IF NOT EXISTS welcome_grants_network ON welcome_grants(ip_prefix_hash, granted_at);

-- Admin-editable credit settings (single row; absent keys use the code defaults).
CREATE TABLE IF NOT EXISTS credit_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One-time credit packs (Stripe Checkout mode=payment). Prices in minor units.
CREATE TABLE IF NOT EXISTS credit_packs (
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
  ('pro-pack', 'Pro pack', 100, '{"BRL":6990,"USD":1999}'::jsonb, 'best_value', true, 2)
ON CONFLICT (id) DO NOTHING;

-- Review tiers: what each stored review cost.
ALTER TABLE coach_reviews ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'quick';
ALTER TABLE coach_reviews ADD COLUMN IF NOT EXISTS credits_spent integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE coach_reviews ADD CONSTRAINT coach_reviews_tier_check CHECK (tier IN ('quick', 'deep'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS coach_reviews_match ON coach_reviews(owner_id, analysis_id, steam_id, created_at DESC);

-- Pro monthly reports: one scheduled (on the 1st, previous month) and one on-demand per period.
CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS reports_owner_time ON reports(owner_id, created_at DESC);

-- AI purposes: the single "review" assignment becomes review_quick + review_deep; "report" is new.
ALTER TABLE ai_assignments DROP CONSTRAINT IF EXISTS ai_assignments_purpose_check;
INSERT INTO ai_assignments(purpose, provider_id, model, updated_at)
  SELECT p.purpose, a.provider_id, a.model, a.updated_at
  FROM ai_assignments a CROSS JOIN (VALUES ('review_quick'), ('review_deep')) AS p(purpose)
  WHERE a.purpose = 'review'
ON CONFLICT (purpose) DO NOTHING;
DELETE FROM ai_assignments WHERE purpose = 'review';
DO $$ BEGIN
  ALTER TABLE ai_assignments ADD CONSTRAINT ai_assignments_purpose_check CHECK (purpose IN ('review_quick', 'review_deep', 'live', 'report'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Plan defaults for the credits model (prices unchanged; still admin-editable). aiReviewsPerDay
-- is no longer the main limit (null = only the global daily safety cap applies).
UPDATE plans SET limits = '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":0,"uploadsPerDay":2,"retentionDaysMax":30,"monthlyCredits":0,"clipExport":false,"perMapLearning":false,"cheaperDeep":false,"monthlyReport":false,"reel":false,"deepHistory":false,"priorityQueue":false}'::jsonb, updated_at = now() WHERE id = 'free';
UPDATE plans SET limits = '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":1,"uploadsPerDay":5,"retentionDaysMax":90,"monthlyCredits":15,"clipExport":true,"perMapLearning":false,"cheaperDeep":false,"monthlyReport":false,"reel":false,"deepHistory":false,"priorityQueue":false}'::jsonb, updated_at = now() WHERE id = 'basic';
UPDATE plans SET limits = '{"aiReviewsPerDay":null,"liveAiMatchesPerDay":5,"uploadsPerDay":15,"retentionDaysMax":365,"monthlyCredits":45,"clipExport":true,"perMapLearning":true,"cheaperDeep":true,"monthlyReport":true,"reel":true,"deepHistory":true,"priorityQueue":true}'::jsonb, updated_at = now() WHERE id = 'pro';
