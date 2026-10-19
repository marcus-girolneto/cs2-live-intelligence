-- Pro "Personal Coach": long-term improvement plans built from the whole match history.
CREATE TABLE IF NOT EXISTS personal_coach_plans (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  steam_id text NOT NULL,
  lang text NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('manual', 'auto')),
  plan jsonb NOT NULL,
  based_on_matches integer NOT NULL,
  -- created_at of the newest analysis included (auto-regeneration counts analyses after it).
  last_analysis_at timestamptz,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_coach_owner_time ON personal_coach_plans(owner_id, created_at DESC);

ALTER TABLE ai_assignments DROP CONSTRAINT IF EXISTS ai_assignments_purpose_check;
DO $$ BEGIN
  ALTER TABLE ai_assignments ADD CONSTRAINT ai_assignments_purpose_check CHECK (purpose IN ('review_quick', 'review_deep', 'live', 'report', 'personal_coach'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE plans SET limits = limits || jsonb_build_object('personalCoach', id = 'pro'), updated_at = now()
  WHERE id IN ('free', 'basic', 'pro') AND NOT (limits ? 'personalCoach');
