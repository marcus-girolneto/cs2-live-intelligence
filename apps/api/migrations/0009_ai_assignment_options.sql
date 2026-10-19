-- Per-purpose model options (admin assignment): output-token budget and reasoning effort.
-- {} = defaults (provider profile, then the purpose's built-in budget).
ALTER TABLE ai_assignments ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;
