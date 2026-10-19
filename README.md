# CS2 Live Intelligence

Day 1 local vertical slice: mock GSI → loopback Go collector → authenticated Fastify ingest → owner-scoped WebSocket → Next.js dashboard. Displays source, freshness and available own-player fields. Missing statistics are unavailable.

## Requirements

Node.js 22, pnpm 10.33.0, Go 1.24+, Docker Compose. Tested local tooling: Node 22.22.0, pnpm 10.33.0, Go 1.27.2 and Docker Compose 2.29.2 on macOS ARM64.

## Start locally

```sh
pnpm install
cp .env.example .env
# Replace the three credential values in .env with local random secrets.
docker compose up -d
```

Postgres binds loopback port 55432 (override POSTGRES_PORT); it is provisioned for Day 2, while Day 1 state is in memory. In three terminals, load the local environment and start the services:

```sh
set -a
source .env
set +a
pnpm --filter @cs2/api dev
```

```sh
set -a
source .env
set +a
cd apps/collector
go run ./cmd/collector -session-id dev-session -sequence-file /tmp/cs2live-dev-sequence.json
```

```sh
set -a
source .env
set +a
# Next server uses API base URL, collector uses the full ingest route.
API_URL=http://127.0.0.1:4000 pnpm --filter @cs2/web dev
```

Open http://127.0.0.1:3000, authenticate with WEB_TOKEN, and connect to dev-session. Send simulated telemetry from another terminal:

```sh
set -a
source .env
set +a
cd apps/collector
go run ./cmd/mock -url http://127.0.0.1:3002/gsi -token "$GSI_AUTH_TOKEN" -count 100 -interval 100ms -reconnect-at 50 -reconnect-pause 500ms
```

Use a fresh session ID for a new match. The sequence file prevents reused sequence numbers after a collector restart. Keep the browser's hostname exactly 127.0.0.1 to match WEB_ORIGIN. No device token is sent to browser code.

## Verify

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E starts isolated API (4100), collector (3102), browser app (3100), and its own temporary sequence file. Playwright saves a video; failures retain traces and screenshots. CI installs Chromium dependencies and runs the same checks. API schema is available from GET http://127.0.0.1:4000/openapi.json.

## Boundaries and handoff

See [architecture](docs/ADR-001.md), [12-task dependency graph](docs/DAY1_PLAN.md), [security boundaries](docs/SECURITY_DAY1.md), collector installation guidance in apps/collector, and [verified results](docs/DAY1_RESULTS.md).

Day 1 has manually provisioned development credentials, one API replica, bounded in-memory session/deduplication stores, and an in-memory collector queue. API restart loses sessions; exhausted retries can lose queued updates. Real Windows CS2 GSI verification is required before live feature claims. Steam sign-in, pairing/rotation, database persistence, history, demo parsing, metrics, AI and production deployment are future sprint work.

To stop local infrastructure, run docker compose down (add -v only if intentionally deleting the local database). Stop application terminals with Ctrl+C. Revert application files to roll back; there are no database migrations in Day 1.
