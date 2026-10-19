# Day 1 verified results

Completed local mock vertical slice on 2026-10-19, macOS ARM64. Both source documents were read in full before implementation. The architect published the versioned contract and ADR before delegating collector, backend and frontend to three specialists with separate directory ownership. No later sprint features were implemented.

## Acceptance evidence

| Check                                                                  | Actual result                                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile                                         | Passed; lockfile current, four workspace projects                                            |
| docker compose up -d / ps                                              | PostgreSQL 17 healthy at 127.0.0.1:55432                                                     |
| pnpm lint                                                              | Passed, no errors                                                                            |
| pnpm format:check                                                      | Passed                                                                                       |
| pnpm typecheck                                                         | Passed strict package and root scripts/tests checks                                          |
| Clean web typecheck with all generated Next output temporarily removed | Passed, exit 0                                                                               |
| pnpm test                                                              | 22 Vitest tests passed: contracts 4, API 10, web 8; Go race tests passed                     |
| go test -race -count=1 ./... (collector)                               | 12 top-level tests passed, including shared fixture and 100-concurrent-update cases          |
| pnpm build                                                             | Passed Next production build and API/contracts type checks                                   |
| pnpm test:e2e                                                          | One Chromium E2E passed in 16.8s overall; test 11.7s                                         |
| Collector → API → WebSocket → rendered browser                         | 100 simulator events, latest sequence 100 verified; subsequent timed update rendered in 18ms |
| Missing values                                                         | Minimal GSI snapshot cleared map and own statistics to Not available                         |
| Stale state                                                            | Browser showed Stale after five seconds without telemetry                                    |
| Reconnect                                                              | Forced socket close led to a new connection/ticket and latest snapshot/update                |
| Responsive layout                                                      | 390px viewport rendered without horizontal overflow; screenshots inspected                   |
| Cleanup                                                                | E2E application processes stopped after completion; local Compose Postgres remains running   |

18ms is one local transport/render sample measured after warm-up, not a p95 or a real CS2 latency claim. The Next development server is used by E2E; production compilation is a separate successful check. CI configuration is present but no remote CI run has occurred.

Recorded proof: [demo video](../artifacts/day1/video.webm), [desktop screenshot](../artifacts/day1/live-dashboard.png), [mobile screenshot](../artifacts/day1/mobile-dashboard.png), [missing-field screenshot](../artifacts/day1/dashboard.png), [latency measurement](../artifacts/day1/latency.json). Rerunning E2E regenerates proof under test-results; artifacts/day1 preserves this run.

API tests verify device identity, owner isolation for reads and live delivery, ticket replay/expiry/origin checks, 100 updates, deduplication across sessions, out-of-order delivery, schema and payload rejection, missing fields, bounded stores/rates, WebSocket heartbeat and reconnect snapshots. Collector tests verify loopback binding, local auth, allowlisting, shared fixture compatibility, queue/payload limits, stable retry event IDs, bounded retry count, redirect rejection, concurrency, durable sequences, session boundary recovery and graceful shutdown.

## Fixes found during integration

Host port 5432 was occupied; Compose uses configurable 55432. Concurrent build and dev output initially collided; E2E now uses .next-e2e. Login initially rejected the public origin when Next used localhost internally; explicit WEB_ORIGIN validation and three regression tests fixed it. E2E teardown now sends SIGTERM and terminates service process groups, including Go child binaries.

## Blockers and known limits

Real Windows/CS2 is unavailable in this environment. The Valve GSI wiki returned an anti-bot page, so current configuration keys and live field visibility could not be independently verified against that page. Windows instructions locate the installation using Steam Browse with a common-path fallback; the actual installation path, GSI delivery, real visibility and latency still require a Windows tester. This live validation gate remains open.

Development credentials are manually provisioned. API session/event state is bounded and in memory; restart loses it. Deduplication applies within the retained event window. One replica only. The collector queue is volatile; exhausted retries or shutdown deadline can drop telemetry, with diagnostic logs. PostgreSQL is provisioned but intentionally unused until durable sessions in Day 2. No Steam, FACEIT, pairing, parser, history, computed ADR/HS, AI or deployment is implemented. UI uses plain responsive CSS; charting and additional UI/query libraries are deferred until needed.

Next.js reports an advisory about its optional ESLint plugin; repository ESLint passes. API/contracts build commands check TypeScript for the tsx development runtime rather than emitting deployment bundles.

## Next day handoff

1. Validate the supplied GSI config and actual payloads on Windows; record path, fields, mode and end-to-end latency. Keep mocks as fallback.
2. Begin Day 2 only when requested: verified Steam OpenID capability, expiring device pairing and credentials, durable Postgres sessions and consent/settings.
3. Add persistence restart/reconnect integration tests alongside that implementation. Do not start demo parsing or AI before their dependency gates.
