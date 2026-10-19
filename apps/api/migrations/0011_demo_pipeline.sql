-- Demo pipeline: checksum dedupe, parser-upgrade reprocessing and events in object storage.
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS parser_version text;
-- events_count is set once the analysis `events` array lives in object storage
-- (<jobId>.events.json.gz) instead of the analysis JSON.
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS events_count integer;
-- Background re-parse of a complete job with an older parser; the analysis stays visible.
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS reprocess_state text CHECK (reprocess_state IN ('queued', 'processing', 'failed'));
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS reprocess_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS reprocess_error text;
-- Job whose analysis/replay/events were copied instead of parsing again (same checksum).
ALTER TABLE demo_jobs ADD COLUMN IF NOT EXISTS deduped_from text;
UPDATE demo_jobs SET parser_version = analysis->'provenance'->>'parserVersion'
  WHERE analysis IS NOT NULL AND parser_version IS NULL;
CREATE INDEX IF NOT EXISTS demo_jobs_dedupe ON demo_jobs(checksum, parser_version) WHERE status = 'complete';
CREATE INDEX IF NOT EXISTS demo_jobs_reprocess ON demo_jobs(reprocess_state, updated_at) WHERE reprocess_state IS NOT NULL;
-- The parser version the worker runs (written by the worker at start; read by dedupe).
CREATE TABLE IF NOT EXISTS parser_runtime (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
