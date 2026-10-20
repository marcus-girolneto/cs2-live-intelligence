-- Raw .dem files are only needed to (re)parse a match; the analysis, events and replay are kept.
-- After the raw-demo retention (default 7 days) the file is queued for deletion and the upload
-- stops counting toward the storage quota.
ALTER TABLE uploads ADD COLUMN demo_deleted_at timestamptz;
CREATE INDEX uploads_raw_demo_expiry ON uploads (created_at) WHERE demo_deleted_at IS NULL AND match_id IS NOT NULL;
