# Release results — local MVP (2026-10-19)

Everything below was executed on the local Docker stack and developer machine. Nothing here claims a hosted release, a real Windows CS2 session, a real Steam account sign-in or a real language-model call.

## Automated checks

| Check                                                                                                                         | Command                             | Result    |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------- |
| Lint                                                                                                                          | `pnpm lint`                         | pass      |
| Formatting                                                                                                                    | `pnpm format:check`                 | pass      |
| Typecheck (8 packages)                                                                                                        | `pnpm typecheck`                    | pass      |
| Contracts unit tests                                                                                                          | `pnpm test`                         | 4 passed  |
| Analytics (incl. advanced metrics, name isolation)                                                                            | `pnpm test`                         | 10 passed |
| Coaching (per-player, provider isolation, PT parity)                                                                          | `pnpm test`                         | 10 passed |
| API integration (real demo, coaching endpoint, ownership)                                                                     | `pnpm test` with Postgres + fixture | 28 passed |
| Web unit (format, i18n coverage, live coach, replay, routes)                                                                  | `pnpm test`                         | 53 passed |
| Go collector, pairing, simulator (race detector)                                                                              | `go test -race ./...`               | pass      |
| Go demo parser                                                                                                                | `pnpm test`                         | pass      |
| E2E: 100 mock GSI updates → collector → API → WebSocket → browser                                                             | `pnpm test:e2e`                     | pass      |
| E2E: "Simulate a match" through the real pipeline into the second screen                                                      | `pnpm test:e2e`                     | pass      |
| E2E: pairing, real demo upload, analysis tabs, AI coach, evidence → rounds, "This is me", replay, feedback, consent, deletion | `pnpm test:e2e`                     | pass      |

## Manual browser verification

Desktop (1440×900) and mobile (390×844), English and Portuguese: home, sample demo (overview, AI Coach, rounds, data), history, upload, second screen (simulated live match and demo replay), settings. No `NaN`, `undefined`, `null` or `Infinity` rendered; numbers cross-checked against the API response for the public Mirage demo.

## Still pending (external)

- Real CS2 GSI on Windows (collector config path, field coverage, latency).
- Real Steam OpenID sign-in with an account (the redirect to steamcommunity.com and the verification endpoint were reached from the local stack).
- A real language-model call with a paid provider key (set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`) and a faithfulness evaluation. The E2E and integration suites use an OpenAI-compatible HTTP mock.
- Hosted deployment, remote CI run and alpha feedback.
