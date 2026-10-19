# Local operations and release gates

## Start and stop

Python 3.11+ and Docker Compose are sufficient for the container stack. `python3 scripts/local-setup.py --with-demo` creates private random local credentials if .env is absent, builds and starts Postgres/API/web, downloads the checksum-pinned public fixture and queues its real analysis. Existing .env is preserved. Open http://127.0.0.1:3000 and sign in with Steam (`ADMIN_STEAM_IDS` makes you admin). The demo is available at /history. This mode is bound to loopback and is not a public deployment.

`docker compose -f compose.yaml -f compose.local.yaml ps` shows health; `logs --tail=100 api web` shows service diagnostics. `pnpm local:down` stops services without deleting volumes. Avoid `down -v` unless intentionally deleting both database and demos. API is one replica with in-process WebSocket fanout. Do not scale horizontally without shared fanout and coordinated ticket state.

## Configuration: environment vs admin

The environment is bootstrap/infrastructure only. `scripts/local-setup.py` writes exactly these to a new `.env`; compose derives the rest (`DATABASE_URL` from `POSTGRES_PASSWORD`, ports, URLs, storage and parser paths, the sample demo path, and development auth from `APP_ENV=local`).

| Variable                                      | Purpose                                                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                     | `local` enables the development identities and simulator; anything else is production.                                                             |
| `POSTGRES_PASSWORD`                           | Database password; compose builds `DATABASE_URL`.                                                                                                  |
| `APP_ENCRYPTION_KEY`                          | 32 random bytes (base64) encrypting stored credentials (AES-256-GCM). Never change it after secrets are stored (empty = legacy WEB_TOKEN-derived). |
| `WEB_TOKEN`, `DEVICE_TOKEN`, `GSI_AUTH_TOKEN` | Local session, collector device and Game State Integration secrets.                                                                                |
| `OWNER_ID`, `DEVICE_ID`                       | Ids of the local development identity.                                                                                                             |
| `ADMIN_STEAM_IDS`                             | SteamID64s promoted to admin when they sign in with Steam.                                                                                         |
| `EXTRA_CA_CERTS_FILE`                         | Optional, machine-specific CA (PEM) for TLS-inspecting networks.                                                                                   |

Optional overrides with defaults: `DEV_AUTO_LOGIN=false`, `POSTGRES_PORT=55432`, `API_PUBLIC_URL`, `WEB_ORIGIN`, `ALLOW_DEV_AUTH=false` (disables development identities even with `APP_ENV=local`).

Everything else is stored in Postgres, edited by admins and applied without a restart:

| What                                                                                      | Where (admin UI / API)                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| AI providers, keys (encrypted) and model per purpose                                      | Admin → AI · `/v1/admin/ai/providers`, `/v1/admin/ai/assignments` |
| Daily AI cap, AI input size, sample demo, upload limit, Personal Coach cadence, time zone | Admin → Settings · `GET/PUT /v1/admin/settings`                   |
| Steam Web API key                                                                         | Admin → Integrations · `PUT /v1/admin/integrations/steam`         |
| Stripe secret key, webhook secret, publishable key, enabled switch, payment methods       | Admin → Integrations · `PUT /v1/admin/integrations/stripe`        |
| Plan prices and Stripe price ids, credit packs                                            | Admin → Plans / Credits                                           |

Integration secrets live in `app_secrets` as AES-256-GCM ciphertext bound to the secret name; they are write-only (the API returns `configured`, `source` and the last 4 characters) and every change is audited without values. `POST /v1/admin/integrations/{steam|stripe}/test` checks the credential in effect (Steam: GetPlayerSummaries for the admin's own SteamID; Stripe: `GET /v1/balance`). Stripe billing is active when it is enabled and both the secret key and the webhook secret are set; the webhook endpoint is `<API_PUBLIC_URL>/v1/billing/webhook` (events `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`).

Legacy bootstrap fallbacks are still read by the API when present in its environment (the database value always wins and the admin view shows `source: "env"`): `STEAM_WEB_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PAYMENT_METHODS_<CUR>`, `STRIPE_PRICE_*`, `APP_TIMEZONE`, `AI_*`/`OPENAI_*`, `ADMIN_BOOTSTRAP`. Compose no longer passes them to the container; move such values into the database with the admin API instead.

## Collector pairing

In Settings, allow telemetry processing and create a pairing code. In apps/collector run `PAIRING_CODE=<code> go run ./cmd/pair -api http://127.0.0.1:4000 -out collector-credentials.json`. Codes expire after five minutes and are single use. Then run `GSI_AUTH_TOKEN=<local GSI token> go run ./cmd/collector -credentials-file collector-credentials.json`. Store the file privately; it is ignored by Git. Device rotation returns another one-use code to the browser, invalidates the old credential immediately, and must be claimed from the collector. Stop collector and replace its private file intentionally when rotating. Use a new output file to avoid accidental credential overwrite. Revoked devices cannot ingest. Browser session logout revokes that app session and closes live sockets.

## Storage and recovery

Postgres volume holds identity, consent, hashed credentials, sessions, job metadata and analyses. The objects volume holds uploaded demos under opaque UUID filenames. No raw demo is sent to the model. Parser work is a subprocess with timeout/output limits; Compose bounds API memory/CPU/process count. A durable database lease and fencing token prevent expired workers from overwriting recovered jobs. One worker processes jobs at a time.

Demo uploads default to 500 MB (524288000 bytes; admin setting `maxDemoBytes`, clamped to the `MAX_UPLOAD_BYTES` deployment ceiling, default and maximum 1 GiB). The parser deadline grows with the demo (base + 1 s per MB, at most 30 min) and its normalized output is read from a private temp file (at most 480 MiB). Size the parser container for about 1.5 GiB of memory; quotas bound concurrent and daily work and total retained files. The pinned public fixture is about 60.6 MB. Retention follows the user's 1–90 day setting, enforced at startup and hourly. Account metadata is deleted transactionally (credit ledger, wallet, holds, reports and Personal Coach plans cascade with the account; `welcome_grants` keeps only HMAC-SHA256 of the Steam id and of the sign-in network prefix, never linked to an account, so welcome credits cannot be re-farmed by deleting and recreating an account; rotating `APP_ENCRYPTION_KEY` invalidates those hashes), while raw object deletions enter a durable outbox processed at startup/hourly. A crash between writing a file and recording a job is cleaned after an hour. Backups are separate copies and require operator deletion procedures.

Before a change, stop application writes and back up BOTH Postgres and object storage. Example: `docker compose exec -T postgres pg_dump -U cs2 -Fc cs2live > backup.dump`; copy the objects volume using a controlled backup container. Protect backups like the originals. Restore into a fresh isolated database/volume, verify migration and object checksums, then switch services. Migration 0001 is idempotent; later breaking migrations require a new migration and explicit rollback procedure. Application rollback: restore previous code/image and matching backup if schema/data changed; never erase live volumes as a rollback shortcut.

## Monitoring and diagnostics

API /health is process liveness; /ready checks database connectivity. /metrics reports request/error/telemetry and worker counters; values reset on API restart and are not a durable billing ledger. Logs contain request IDs, route templates, status and duration; authorization, cookie contents, WS tickets, raw payloads and player names are omitted. Local Compose uses restart policies and health probes. Monitor queue age/failure counts, 5xx rates, disk/volume use and stale/live latency before hosting an alpha. No remote uptime or 99% SLO is claimed from local tests.

## Optional provider

AI providers, keys and models are configured by admins (Admin → AI) and stored encrypted in Postgres; changes apply without a restart. The `AI_*` / `OPENAI_*` variables remain an optional bootstrap fallback for purposes without an assignment when the API runs outside Docker. The adapter uses https://api.openai.com/v1/responses, store=false, a fixed schema, evidence-only input, 768 output tokens, at most two attempts, 15s call deadlines and a per-owner daily quota. Evidence citations are validated. Names and raw events are excluded from prompts. An actual provider call, model access, output quality and account billing require separate validation. Offline tests use controlled responses and cannot prove external availability or semantic faithfulness. Provider failures produce a failed analysis rather than invented coaching.

Official implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs (retrieved 2026-10-19).

## Remaining external release gates

Real Steam account login is not yet exercised; signature/state/nonce/binding/replay defenses have integration tests against controlled verification responses. Official Steam OpenID documentation was retrieved from https://steamcommunity.com/dev. Real Windows CS2 GSI fields, supported modes, configuration path and latency require a Windows session. The collector can be cross-compiled; that is not live game validation. Current parser behavior is verified on the pinned public CS2 fixture, not all CS2 patches or POV formats. FACEIT, automated demo acquisition and historical baseline comparisons remain conditional capabilities; manual demo upload is the implemented acquisition path. No hidden live enemy data is exposed. Economy is unavailable without suitable normalized evidence.

A hosted launch also needs a chosen operator/domain, HTTPS, production APP_ENV with all development auth disabled, backup/restore rehearsal, retention/deletion checks including backups, legal notices/contact, remote CI execution, real LLM evaluation if enabled, and alpha feedback. Docker local is the authorized deployment target. No cloud publication is performed.
