-- Plans, subscriptions, per-day usage counters and billing webhook idempotency.
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_-]{0,31}$'),
  name text NOT NULL,
  -- {"BRL": {"month": 1490, "year": 14900}, "USD": {...}} in minor units (cents).
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {"aiReviewsPerDay", "liveAiMatchesPerDay", "uploadsPerDay", "retentionDaysMax", "clipExport", "perMapLearning"}; null = unlimited.
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional Stripe price ids keyed "<CURRENCY>_<interval>", e.g. {"BRL_month": "price_..."}.
  stripe_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO plans(id, name, prices, limits, active, sort) VALUES
  ('free', 'Free', '{}'::jsonb,
   '{"aiReviewsPerDay":1,"liveAiMatchesPerDay":0,"uploadsPerDay":2,"retentionDaysMax":30,"clipExport":false,"perMapLearning":false}'::jsonb, true, 0),
  ('basic', 'Basic', '{"BRL":{"month":1490,"year":14900},"USD":{"month":499,"year":4990}}'::jsonb,
   '{"aiReviewsPerDay":3,"liveAiMatchesPerDay":1,"uploadsPerDay":5,"retentionDaysMax":90,"clipExport":true,"perMapLearning":false}'::jsonb, true, 1),
  ('pro', 'Pro', '{"BRL":{"month":2990,"year":29900},"USD":{"month":999,"year":9990}}'::jsonb,
   '{"aiReviewsPerDay":8,"liveAiMatchesPerDay":5,"uploadsPerDay":15,"retentionDaysMax":365,"clipExport":true,"perMapLearning":true}'::jsonb, true, 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  owner_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  source text NOT NULL CHECK (source IN ('admin', 'stripe')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);

-- Daily counters ("day" is the local calendar day in APP_TIMEZONE).
CREATE TABLE IF NOT EXISTS usage_counters (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ai_review', 'upload')),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (owner_id, day, kind)
);
-- Live AI matches: one row per (day, match) that received at least one successful AI call.
CREATE TABLE IF NOT EXISTS usage_live_matches (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  match_key text NOT NULL,
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (owner_id, day, match_key)
);
CREATE TABLE IF NOT EXISTS billing_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Paid plans allow longer retention (the effective maximum is clamped to the plan).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_retention_days_check;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_retention_days_check CHECK (retention_days BETWEEN 1 AND 365);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
