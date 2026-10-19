# Local operations and release gates

## Start and stop

Python 3.11+ and Docker Compose are sufficient for the container stack. `python3 scripts/local-setup.py --with-demo` creates private random local credentials if .env is absent, builds and starts Postgres/API/web, downloads the checksum-pinned public fixture and queues its real analysis. Existing .env is preserved. Open http://127.0.0.1:3000 and use WEB_TOKEN from .env in the explicitly local identity form. The demo is available at /history. This mode is bound to loopback and is not a public deployment.

`docker compose -f compose.yaml -f compose.local.yaml ps` shows health; `logs --tail=100 api web` shows service diagnostics. `pnpm local:down` stops services without deleting volumes. Avoid `down -v` unless intentionally deleting both database and demos. API is one replica with in-process WebSocket fanout. Do not scale horizontally without shared fanout and coordinated ticket state.

## Collector pairing

In Settings, allow telemetry processing and create a pairing code. In apps/collector run `PAIRING_CODE=<code> go run ./cmd/pair -api http://127.0.0.1:4000 -out collector-credentials.json`. Codes expire after five minutes and are single use. Then run `GSI_AUTH_TOKEN=<local GSI token> go run ./cmd/collector -credentials-file collector-credentials.json`. Store the file privately; it is ignored by Git. Device rotation returns another one-use code to the browser, invalidates the old credential immediately, and must be claimed from the collector. Stop collector and replace its private file intentionally when rotating. Use a new output file to avoid accidental credential overwrite. Revoked devices cannot ingest. Browser session logout revokes that app session and closes live sockets.

## Storage and recovery

Postgres volume holds identity, consent, hashed credentials, sessions, job metadata and analyses. The objects volume holds uploaded demos under opaque UUID filenames. No raw demo is sent to the model. Parser work is a subprocess with timeout/output limits; Compose bounds API memory/CPU/process count. A durable database lease and fencing token prevent expired workers from overwriting recovered jobs. One worker processes jobs at a time.

Demo uploads default to 500 MB (524288000 bytes; admin setting `maxDemoBytes`, clamped to the `MAX_UPLOAD_BYTES` deployment ceiling, default and maximum 1 GiB). The parser deadline grows with the demo (base + 1 s per MB, at most 30 min) and its normalized output is read from a private temp file (at most 480 MiB). Size the parser container for about 1.5 GiB of memory; quotas bound concurrent and daily work and total retained files. The pinned public fixture is about 60.6 MB. Retention follows the user's 1–90 day setting, enforced at startup and hourly. Account metadata is deleted transactionally, while raw object deletions enter a durable outbox processed at startup/hourly. A crash between writing a file and recording a job is cleaned after an hour. Backups are separate copies and require operator deletion procedures.

Before a change, stop application writes and back up BOTH Postgres and object storage. Example: `docker compose exec -T postgres pg_dump -U cs2 -Fc cs2live > backup.dump`; copy the objects volume using a controlled backup container. Protect backups like the originals. Restore into a fresh isolated database/volume, verify migration and object checksums, then switch services. Migration 0001 is idempotent; later breaking migrations require a new migration and explicit rollback procedure. Application rollback: restore previous code/image and matching backup if schema/data changed; never erase live volumes as a rollback shortcut.

## Monitoring and diagnostics

API /health is process liveness; /ready checks database connectivity. /metrics reports request/error/telemetry and worker counters; values reset on API restart and are not a durable billing ledger. Logs contain request IDs, route templates, status and duration; authorization, cookie contents, WS tickets, raw payloads and player names are omitted. Local Compose uses restart policies and health probes. Monitor queue age/failure counts, 5xx rates, disk/volume use and stale/live latency before hosting an alpha. No remote uptime or 99% SLO is claimed from local tests.

## Optional provider

Without OPENAI_API_KEY the app returns explicitly labeled deterministic feedback. To enable model coaching, set a valid OPENAI_API_KEY and explicit OPENAI_MODEL supporting Responses structured outputs, then restart API. The adapter uses https://api.openai.com/v1/responses, store=false, a fixed schema, evidence-only input, 768 output tokens, at most two attempts, 15s call deadlines and a per-owner daily quota. Evidence citations are validated. Names and raw events are excluded from prompts. An actual provider call, model access, output quality and account billing require separate validation. Offline tests use controlled responses and cannot prove external availability or semantic faithfulness. Provider failures produce a failed analysis rather than invented coaching.

Official implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs (retrieved 2026-10-19).

## Remaining external release gates

Real Steam account login is not yet exercised; signature/state/nonce/binding/replay defenses have integration tests against controlled verification responses. Official Steam OpenID documentation was retrieved from https://steamcommunity.com/dev. Real Windows CS2 GSI fields, supported modes, configuration path and latency require a Windows session. The collector can be cross-compiled; that is not live game validation. Current parser behavior is verified on the pinned public CS2 fixture, not all CS2 patches or POV formats. FACEIT, automated demo acquisition and historical baseline comparisons remain conditional capabilities; manual demo upload is the implemented acquisition path. No hidden live enemy data is exposed. Economy is unavailable without suitable normalized evidence.

A hosted launch also needs a chosen operator/domain, HTTPS, production APP_ENV with all development auth disabled, backup/restore rehearsal, retention/deletion checks including backups, legal notices/contact, remote CI execution, real LLM evaluation if enabled, and alpha feedback. Docker local is the authorized deployment target. No cloud publication is performed.
