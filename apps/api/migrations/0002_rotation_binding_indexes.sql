-- Safe upgrade from early Sprint 1 local schemas; existing unbound codes are invalidated.
ALTER TABLE pairing_codes ADD COLUMN IF NOT EXISTS device_id text REFERENCES devices(id) ON DELETE CASCADE;
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS binding_hash text NOT NULL DEFAULT '';
DELETE FROM auth_codes WHERE binding_hash='';
CREATE INDEX IF NOT EXISTS telemetry_events_owner_time ON telemetry_events(owner_id,created_at);
CREATE INDEX IF NOT EXISTS feedback_owner_time ON feedback(owner_id,created_at);
CREATE INDEX IF NOT EXISTS product_events_owner_time ON product_events(owner_id,created_at);
