-- Cached public Steam profile (display only), refreshed at sign-in and when older than 6 hours.
-- Stored on users so account deletion removes it with the row.
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_profile jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_profile_fetched_at timestamptz;
-- Carry over the name/avatar cached by 0003 so existing accounts keep them until the next refresh.
UPDATE users
SET steam_profile = jsonb_strip_nulls(jsonb_build_object(
  'personaName', display_name,
  'avatarUrl', avatar_url,
  'profileUrl', profile_url,
  'visibility', 'public',
  'fetchedAt', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
))
WHERE steam_profile IS NULL AND display_name IS NOT NULL;
