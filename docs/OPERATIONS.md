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

Postgres volume holds identity, consent, hashed credentials, sessions, uploads, matches and the job queue. The objects volume holds uploaded demos under opaque UUID filenames, plus, once per parsed match (shared by every upload of the same demo), the analysis (`<matchId>.analysis.json.gz`), events (`<matchId>.events.json.gz`) and replay (`<matchId>.replay.json.gz`). Postgres keeps only a slim match row and per-player numbers (docs/DATABASE.md). No raw demo is sent to the model. Parser work runs in the sandboxed `worker` service (below), never in the API. A durable database lease and fencing token prevent expired workers from overwriting recovered jobs. One worker processes jobs at a time.

Demo uploads default to 500 MB (524288000 bytes; admin setting `maxDemoBytes`, clamped to the `MAX_UPLOAD_BYTES` deployment ceiling, default and maximum 1 GiB). The parser deadline grows with the demo (base + 1 s per MB, at most 30 min) and its normalized output is read from a private temp file (at most 480 MiB). Size the worker container for about 1.5 GiB of memory; quotas bound concurrent and daily work and total retained files. The pinned public fixture is about 60.6 MB. Retention follows the user's 1–90 day setting, enforced at startup and hourly. Account metadata is deleted transactionally (credit ledger, wallet, holds, reports and Personal Coach plans cascade with the account; `welcome_grants` keeps only HMAC-SHA256 of the Steam id and of the sign-in network prefix, never linked to an account, so welcome credits cannot be re-farmed by deleting and recreating an account; rotating `APP_ENCRYPTION_KEY` invalidates those hashes), while raw object deletions enter a durable outbox processed at startup/hourly. A crash between writing a file and recording a job is cleaned after an hour. Backups are separate copies and require operator deletion procedures.

## Demo worker sandbox

Uploaded demos are untrusted binaries (up to 500 MB) parsed by a third-party library, so parsing runs in a dedicated `worker` service (same image as the API, command `node --import tsx src/worker.ts`). The API runs with `DEMO_WORKER=external` and only accepts uploads; without that variable (development, tests, `scripts/e2e-stack.ts`) the API keeps processing demos in-process.

```
browser ──HTTPS──> api (default network: internet for Steam/AI/Stripe)
                    │  writes <uuid>.dem, queues demo_jobs
                    ▼
               postgres  <── parser network (internal: no route out) ──>  worker
                                                                           │ claims jobs, runs
                                                                           ▼ demo-parser-sandbox → demo-parser
                    objects volume: <upload>.dem, <match>.analysis|events|replay.json.gz
```

| Control        | Worker container                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network        | only `parser` (`internal: true`, shared with Postgres): no DNS/route to the internet                                                                                                                                   |
| Filesystem     | `read_only: true`; tmpfs `/tmp` 512 MiB (`noexec,nosuid,nodev`); objects volume read-write (flat layout)                                                                                                               |
| Identity       | user `node`, `cap_drop: [ALL]`, `no-new-privileges`, no tokens or app secrets (`ALLOW_DEV_AUTH=false`)                                                                                                                 |
| Resources      | `mem_limit`/`memswap_limit` 1536m, `cpus: 2`, `pids_limit: 64`; heartbeat healthcheck (`/tmp/worker-heartbeat`)                                                                                                        |
| Parser process | `docker/demo-parser-sandbox.sh`: `ulimit -v 4 GiB -t 3600 s -f 512 MiB -n 64 -c 0`, empty environment, `GOMEMLIMIT=1GiB`, `GOMAXPROCS=2`; Node adds a size-scaled SIGKILL deadline (≤ 30 min) and a 480 MiB output cap |
| Input checks   | API: magic/header/first frame sniffed while streaming; parser: every frame header validated before the library runs (frames ≤ 32 MiB, snappy ≤ 64 MiB)                                                                 |

Measured (parser v5): on the development Mac (`/usr/bin/time -l`) the 218 MB real Dust2 demo parses in 2.4–4.1 s with 114–157 MB peak RSS and the 60.6 MB public fixture in 0.9–2.5 s with 137–151 MB; inside the sandbox (Linux, `/usr/bin/time -v`, read-only, no network, rlimits) 2.9 s / 113 MB and 1.0 s / 141 MB. Through the stack: a fresh 60.6 MB upload completes in 3.5 s, a duplicate 218 MB upload completes by dedupe as soon as the body is stored (1.7 s). Peak memory is dominated by entity state, not demo size, so 1.5 GiB leaves room for 500 MB demos plus the Node process (~200 MB). The objects volume stays read-write for the worker because demos, replays and events share one flat directory (the worker writes artifacts and applies retention); a split layout would allow a read-only demo mount.

Checks: `docker exec cs2-live-intelligence-worker-1 node -e "fetch('https://example.com').then(()=>process.exit(1),()=>process.exit(0))"` exits 0 (no internet); `docker compose ... logs worker` shows JSON lines (`demo worker started`, `demo deduplicated`, `parser upgrade reprocess`, `analysis events migrated to object storage`). Fuzzing of the parser: `pnpm test:fuzz` (see apps/demo-parser/README.md).

## Upload limits, dedupe and reprocessing

- Uploads: 10 per minute per account and 30 per minute per /24 (IPv6 /48) network, on top of the plan's daily quota and 4 concurrent uploads: 429 `upload_rate_limited` with `Retry-After`. The body is sniffed while streaming (content type is not trusted): 400 `not_cs2_demo` (wrong magic, first frame not a CS2 file header), 400 `too_small` (< 64 KiB), 413 `too_large`.
- Dedupe: a demo whose SHA-256 was already analysed by the current parser (any account) completes immediately: the new upload points at the existing match (nothing is copied). Matches are reference counted: deleting one account's upload never affects another account, and a match and its files are deleted once no upload references it. Simultaneous uploads of one new file parse once (claims skip checksums in progress).
- Parser upgrades: at start and daily the worker records its parser version and queues background re-parses of complete analyses made by another version whose demo is still stored (up to 500 per run, behind fresh uploads; the old analysis stays visible and is kept if the re-parse fails). Progress: `GET /v1/admin/analyses/reprocess/status` → `{pending, done, failed, currentVersion}`.
- Retention: account retention (uploads, live sessions and calls, telemetry, feedback) runs hourly in the worker; the API's hourly jobs keep monthly partitions of `telemetry_events`/`product_events` ahead and apply the global retention of append-only tables (telemetry 30 days, product events 180, admin audit 365, usage counters 90, processed file deletions 7; admin setting `retention`).

Before a change, stop application writes and back up BOTH Postgres and object storage. Example: `docker compose exec -T postgres pg_dump -U cs2 -Fc cs2live > backup.dump`; copy the objects volume using a controlled backup container. Protect backups like the originals. Restore into a fresh isolated database/volume, verify migration and object checksums, then switch services. Migrations start from the squashed baseline `0001_baseline.sql` (applied once to an empty database); later breaking migrations require a new migration and explicit rollback procedure. Application rollback: restore previous code/image and matching backup if schema/data changed; never erase live volumes as a rollback shortcut.

## Monitoring and diagnostics

API /health is process liveness; /ready checks database connectivity. /metrics reports request/error/telemetry and worker counters; values reset on API restart and are not a durable billing ledger. Logs contain request IDs, route templates, status and duration; authorization, cookie contents, WS tickets, raw payloads and player names are omitted. Local Compose uses restart policies and health probes. Monitor queue age/failure counts, 5xx rates, disk/volume use and stale/live latency before hosting an alpha. No remote uptime or 99% SLO is claimed from local tests.

## Optional provider

AI providers, keys and models are configured by admins (Admin → AI) and stored encrypted in Postgres; changes apply without a restart. The `AI_*` / `OPENAI_*` variables remain an optional bootstrap fallback for purposes without an assignment when the API runs outside Docker. The adapter uses https://api.openai.com/v1/responses, store=false, a fixed schema, evidence-only input, 768 output tokens, at most two attempts, 15s call deadlines and a per-owner daily quota. Evidence citations are validated. Names and raw events are excluded from prompts. An actual provider call, model access, output quality and account billing require separate validation. Offline tests use controlled responses and cannot prove external availability or semantic faithfulness. Provider failures produce a failed analysis rather than invented coaching.

Official implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs (retrieved 2026-10-19).

## Remaining external release gates

Real Steam account login is not yet exercised; signature/state/nonce/binding/replay defenses have integration tests against controlled verification responses. Official Steam OpenID documentation was retrieved from https://steamcommunity.com/dev. Real Windows CS2 GSI fields, supported modes, configuration path and latency require a Windows session. The collector can be cross-compiled; that is not live game validation. Current parser behavior is verified on the pinned public CS2 fixture, not all CS2 patches or POV formats. FACEIT, automated demo acquisition and historical baseline comparisons remain conditional capabilities; manual demo upload is the implemented acquisition path. No hidden live enemy data is exposed. Economy is unavailable without suitable normalized evidence.

A hosted launch also needs a chosen operator/domain, HTTPS, production APP_ENV with all development auth disabled, backup/restore rehearsal, retention/deletion checks including backups, legal notices/contact, remote CI execution, real LLM evaluation if enabled, and alpha feedback. Docker local is the authorized deployment target. No cloud publication is performed.
