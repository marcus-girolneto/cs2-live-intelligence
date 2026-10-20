CS2 LIVE INTELLIGENCE: IMPLEMENTATION RUNBOOK

Version 1.0 | Start: 2026-10-19 | Intended for Claude Code / Codex / coding agents

Mission

Build a web-first CS2 second-screen intelligence platform. Never claim hidden enemy data or access that GSI does not provide. Ship a demonstrable vertical slice before adding AI or external APIs.

Day-zero decisions

* Monorepo pnpm/Turborepo; apps/web (Next.js), apps/api (Fastify), apps/collector (Go), apps/demo-parser (Go), packages/contracts, packages/config.
* PostgreSQL and Redis via docker compose; Redis optional on Day 1 (in-memory fanout acceptable for one API replica).
* TypeScript strict; OpenAPI; Go tests; Vitest; Playwright; GitHub Actions.
* Build a GSI mock generator and fixtures BEFORE attempting live CS2 integration.
* Never use game process injection, memory inspection, or cheats.

Tomorrow: exact execution sequence

Block A, 60–90 min: foundation

1. Initialize repo and workspace, lint/format/typecheck/test scripts, docker compose, .env.example, README, ADR-001.
2. Define versioned Zod/TypeBox telemetry contracts and fixtures with missing optional fields.
3. Acceptance: pnpm install && docker compose up -d && pnpm test succeeds.

Block B, 90–120 min: ingestion

4. Go collector binds 127.0.0.1 configurable port; POST /gsi accepts capped JSON, validates, stamps receivedAt, forwards HTTPS to backend; retries with bounded queue.
5. Fastify POST /v1/telemetry/gsi validates device identity and schema, deduplicates, reduces snapshot to session state.
6. Build CLI mock sender simulating phase changes, kills and reconnects.
7. Acceptance: 100 simulated updates ingested, duplicate-safe, missing fields do not crash.

Block C, 90 min: live delivery

8. Implement authenticated WebSocket channel scoped to session owner; on connect send latest snapshot; broadcast state diffs; heartbeat and reconnect.
9. Next.js live screen shows status, map, phase, round, score and own stats ONLY if present, plus last-updated age and source.
10. Acceptance: browser reflects simulator updates in under 2s on local dev machine; disconnect shows stale status.

Block D, 60–90 min: proof and handoff

11. Add end-to-end test for mock collector -> API -> WebSocket -> browser.
12. Write runbook to configure gamestate_integration_cs2live.cfg in CS2 cfg directory, with actual verified install-path instructions and fallback.
13. Record demo, known gaps, next-day tasks. Do not silently fake unavailable statistics.

Implementation order after Day 1

Sprint 1 (days 2–3): Steam OpenID validation, pairing flow, credential rotation, Postgres persistence, consent/settings, integration tests.
Sprint 2 (days 4–6): upload .dem, object storage, parser spike with pinned demoinfocs-golang, event normalization, history pages.
Sprint 3 (days 7–9): metrics engine with explicit denominators, evidence store, async AI coaching, golden-fixture evaluations.
Sprint 4 (days 10–12): deployment, monitoring, retention/deletion, security audit, alpha feedback and product analytics.

Agent roster and task ownership

* Architect agent: owns ADRs, contracts, API versioning, boundaries and integration reviews. No coding in parallel with conflicting contracts.
* Collector agent: owns apps/collector, GSI config examples, buffering, Go unit tests.
* Backend agent: owns apps/api, DB migrations, sessions, auth, WebSockets and API tests.
* Frontend agent: owns apps/web, UX, accessibility and Playwright tests.
* Demo/analytics agent: owns parser, normalized events, metric formulas and fixtures.
* AI agent: owns async coaching, prompts, JSON schema, evals and cost caps. Does not touch live ingest.
* QA/security agent: tests adversarial payloads, ownership, privacy, reconnect, cheating/policy risks.

Coordination protocol for parallel agents

1. Architect publishes packages/contracts and ADR-001 first. All agents treat those as immutable until approved revision.
2. One owner per directory; separate branches/worktrees; PRs must include tests and acceptance proof.
3. Integrate collector + API before UI polish; use contract fixtures for parallel development.
4. Every PR must include: changed files, commands run, results, assumptions, open risks, and screenshots where relevant.
5. Do not invent endpoints, Steam/FACEIT permissions or fields. Mark assumptions and spike them with evidence.

Master prompt to paste into your coding orchestrator

You are the lead implementation orchestrator for CS2 Live Intelligence. Read the attached PRD and this runbook fully. Your objective is to deliver the Day 1 vertical slice first, then execute subsequent sprints in dependency order. Use a TypeScript/Go monorepo with explicit contracts, deterministic data transformations and tests. Assign distinct file ownership to specialist agents. Do not let agents modify shared contracts without an ADR and approval. Never fabricate unavailable GSI data or assume the ten-player roster is available to an active player. Never implement cheats, game process injection or memory reading. Begin by auditing local tooling and drafting a 12-task dependency graph; then implement tasks one by one or in safe parallel groups. At every milestone run lint, typecheck, unit/integration tests and report actual outputs. Require a runnable demo with mock telemetry before adding Steam/FACEIT or AI. For any unknown API capability, write a spike with official docs, an executable verification step, and a fallback. Stop only at completed acceptance criteria or report blockers explicitly.

Agent-specific prompts

Collector agent

Implement Go localhost GSI receiver, configurable port, bounded payload, schema-safe parsing, outbound retry with exponential backoff, bounded local queue and graceful shutdown. Supply mock generator and tests. Do not expose local listener publicly.

Backend agent

Implement Fastify typed telemetry ingest, owner-scoped session state reducer, idempotency, WebSocket fanout, Postgres migrations and tests. Make source/visibility/freshness explicit. Never infer unavailable enemy stats.

Frontend agent

Implement responsive dark live dashboard using Next.js, shadcn/ui and ECharts only where necessary. Use fixtures; show unavailable fields as unavailable, stale data prominently, connection states and accessible controls. Add Playwright happy path.

Analytics agent

Build isolated Go demo parser spike with fixtures; version-pin library. Define typed event schema and metric formulas, completeness flags, and test expected results. Never calculate from insufficient evidence.

AI agent

Implement asynchronous post-match coaching from deterministic evidence, typed structured output, citations to evidence IDs, explicit uncertainty and offline evaluation. No LLM calls per telemetry tick; enforce token budget and retry cap.

QA/security agent

Threat-model local receiver, pairing, API ownership, upload parsing, prompt injection via player names, rate limits and privacy. Add negative tests and document terms-of-service unknowns.

Milestone acceptance checklist

☐ Mock GSI end-to-end demo works
☐ No fabricated missing values
☐ Session owner authorization enforced
☐ Reconnect and deduplication verified
☐ Real CS2 GSI validated on Windows machine
☐ Steam OpenID tested before promising auto-link
☐ Demo parser tested with actual CS2 demo
☐ AI statements linked to evidence
☐ CI, monitoring, retention and deletion documented

Decision gates

Gate 1: verify actual GSI fields and latency in real CS2 before finalizing live feature claims.
Gate 2: verify Steam and FACEIT terms/rate limits before integration.
Gate 3: verify legal and reliable demo acquisition; manual upload is default fallback.
Gate 4: measure alpha retention and willingness to pay before complex infrastructure.