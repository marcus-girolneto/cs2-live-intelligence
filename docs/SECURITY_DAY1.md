# Day 1 security boundaries

The localhost receiver authenticates game messages, caps requests, and forwards an allowlisted payload. It never reads processes or memory. Its queue is bounded; exhausted retries lose telemetry and must be visible through diagnostics.

The API resolves ownership from provisioned device credentials. It rejects identity spoofing and cross-owner session reads and WS access. Browser authentication uses an HttpOnly cookie at the Next server and short-lived single-use WS tickets. Device secrets never enter browser code. Unknown GSI data, local auth tokens and full rosters are stripped. Only matching provider and player Steam IDs allow own stats.

Day 1 credentials are manually provisioned. This is a local demonstration with in-memory state, bounded caches and one API replica. Steam identity, secure pairing, revocation lifecycle, credential rotation, durable consent and deletion are Day 2+ work. Do not deploy this development authentication model publicly. HTTPS is required for non-loopback collector forwarding.

Verification covers malformed/oversized bodies, schema versions, ownership, ticket expiry/reuse, event idempotency, out-of-order events, missing fields, live reconnect and stale UX. Real CS2 payload visibility and install paths still require an actual Windows installation. No external API permissions are assumed.
