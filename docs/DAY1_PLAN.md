# Day 1 dependency graph

1. Read requirements and audit tools (complete).
2. Initialize isolated repository and workspace (depends 1).
3. Publish ADR and frozen Zod contracts and missing-field fixtures (depends 2).
4. Provision compose/env and CI (depends 3).
5. Collector loopback receiver, validation and capped queue (depends 3).
6. Collector retries, graceful shutdown and mock CLI (depends 5).
7. API auth, schema validation, deduplication and reducer (depends 3).
8. Owner-scoped WS, snapshot, diff and heartbeat (depends 7).
9. Live dashboard, auth cookie, reconnect and stale UX (depends 3,8).
10. Collector/API integration and adversarial tests (depends 6,8).
11. Browser E2E and latency/reconnect proof (depends 9,10).
12. Installation guidance, demonstration evidence, gaps and handoff (depends 11).

Independent owners implement 5–6, 7–8, and 9 after contract freeze. Architect owns 4 and 10–12 integration review. Parser, analytics and AI agents are not activated for Day 1.
