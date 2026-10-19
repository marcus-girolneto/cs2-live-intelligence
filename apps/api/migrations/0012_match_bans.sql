-- Steam ban state of each match's participants (docs/INTEGRITY.md). Per match only: SteamID and
-- ban counts, deleted with the match. Checked after the analysis completes, then again 7 and 30
-- days after the upload (bans arrive later); next_check_at is null once done.
CREATE TABLE IF NOT EXISTS match_bans (
  job_id text PRIMARY KEY REFERENCES demo_jobs(id) ON DELETE CASCADE,
  bans jsonb NOT NULL DEFAULT '[]'::jsonb,
  checks integer NOT NULL DEFAULT 0,
  checked_at timestamptz,
  next_check_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_bans_due ON match_bans(next_check_at) WHERE next_check_at IS NOT NULL;
