-- Coaching (team reviews, verifier, prompt A/B, auto-reviews, match ownership, eval reports).

-- New AI purposes: team review and the claim verifier.
ALTER TABLE ai_assignments DROP CONSTRAINT IF EXISTS ai_assignments_purpose_check;
ALTER TABLE ai_assignments ADD CONSTRAINT ai_assignments_purpose_check CHECK (purpose IN ('review_quick', 'review_deep', 'review_team', 'verify', 'live', 'report', 'personal_coach'));

-- Team reviews are charged like player reviews.
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_reason_check CHECK (reason IN ('welcome', 'plan_grant', 'purchase', 'review_quick', 'review_deep', 'review_team', 'refund', 'admin_adjust', 'expire'));

-- Prompt A/B variant of each review ("a" for every review made before A/B existed).
ALTER TABLE coach_reviews ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'a' CHECK (variant IN ('a', 'b'));

-- One AI call reviewing the requesting player's whole team.
CREATE TABLE IF NOT EXISTS team_reviews (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL REFERENCES demo_jobs(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  variant text NOT NULL DEFAULT 'a' CHECK (variant IN ('a', 'b')),
  lang text NOT NULL,
  review jsonb NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  input_tokens integer,
  output_tokens integer,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_reviews_match ON team_reviews(owner_id, analysis_id, created_at DESC);

-- Auto-review after upload: per-user setting and one row per processed job (idempotent).
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS auto_review jsonb NOT NULL DEFAULT '{"enabled":false,"tier":"quick"}'::jsonb;
CREATE TABLE IF NOT EXISTS auto_reviews (
  job_id text PRIMARY KEY REFERENCES demo_jobs(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'skipped', 'failed')),
  reason text,
  review_id text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auto_reviews_status ON auto_reviews(status, updated_at);

-- Whether a processed demo is the account's own match ("mine") or someone else's ("external"),
-- and which in-demo player the account is. matched_by: steam (account Steam id in the demo),
-- chosen ("this is me"), user (manual override), none.
CREATE TABLE IF NOT EXISTS match_ownership (
  job_id text PRIMARY KEY REFERENCES demo_jobs(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ownership text NOT NULL CHECK (ownership IN ('mine', 'external')),
  player_steam_id text,
  matched_by text NOT NULL CHECK (matched_by IN ('steam', 'chosen', 'user', 'none')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_ownership_owner ON match_ownership(owner_id, ownership);

-- Nightly AI eval summaries (the full report lives in artifacts/eval).
CREATE TABLE IF NOT EXISTS ai_eval_reports (
  id text PRIMARY KEY,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
