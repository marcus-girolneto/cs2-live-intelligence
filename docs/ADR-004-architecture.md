# ADR-004: Layered modular monolith for the API

- Status: Accepted
- Date: 2026-10-19
- Scope: `apps/api` (plus additive DTOs in `packages/contracts/src/api`)

## Context

The API had grown into a few god files: `jobs.ts` (~1050 lines: uploads, matches, analyses,
coaching, live calls, progress, sample import, feedback, events, reprocessing and the worker),
`repository.ts` (~900 lines, one `PgRepository` class holding every SQL statement),
`platform.ts` (auth, me, devices, settings, account), `admin.ts` (~630), `steam.ts` (~730),
`app.ts` (~560, including the whole live/WebSocket path) and `openapi.ts`. Route handlers mixed
HTTP parsing, authentication, business rules, SQL and response shaping; every handler
re-implemented `owner(request)` / `isAdmin()`; `process.env` was read all over the code; the
only seam for tests was the full Postgres repository.

The product owner's verdict: "The code is not structured in layers: Routes / Controller /
Services / Repository, DTOs. Where are the design patterns, where is scalable code with
interfaces?"

Constraints: the HTTP contract (routes, status codes, bodies, headers, cookies, rate limits),
the SQL semantics (atomic quota consumption, advisory locks, ownership checks) and the
migrations must stay identical, because the web app, the collector and the E2E suite depend on
them.

## Decision

Restructure the API as a **layered modular monolith**: one folder per bounded context under
`apps/api/src/modules/<context>/`, each with the same layers:

| Layer         | File                         | Responsibility                                                         |
| ------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Routes        | `<ctx>.routes.ts`            | Route table only: method, path, guard preHandlers, hook/limit options. |
| Controller    | `<ctx>.controller.ts`        | Parse request DTOs (zod), call a service, return the response DTO.     |
| Service       | `<ctx>.service.ts`           | Business rules. Depends only on interfaces (ports).                    |
| Repository    | `<ctx>.repository.ts`        | `interface XRepository` + `PgXRepository implements XRepository`.      |
| DTO           | `<ctx>.dto.ts`               | zod request schemas and response types.                                |
| Mapper/Policy | `*.mapper.ts`, `*.policy.ts` | Non-trivial entity → DTO mapping and pure decision objects.            |

Cross-cutting code lives in `shared/` (errors + the single error handler, HTTP guards, DTO
validation, cookies, rate limiter, DB/migrations/unit of work, crypto, clock, logging, ports).
External systems sit behind ports in `infrastructure/` (Steam, Stripe, the demo parser, the
filesystem, the AI provider library, AES-GCM secrets, WebSockets). Background jobs live in
`workers/`. A **composition root** (`container.ts` + `composition/*.ts`) instantiates
everything with constructor injection; `app.ts` only builds the Fastify instance, installs
plugins and the error handler and registers each module's route table; `main.ts` is the
bootstrap (config → database → app → listen → graceful shutdown) and the only entry point
(Dockerfile and `scripts/e2e-stack.ts` launch it).

Modules communicate only through small interfaces declared by the consumer (e.g. coaching
declares `AnalysisHistory`, `CoachingQuota`, `AiAccess`), implemented by another module and
wired in the composition root. No module imports another module's `Pg*` class.

Rules enforced by review: no file over ~300 lines, small functions, no `any`, explicit return
types on public methods, and `process.env` read only in `config/env.ts` (`loadConfig()` for
boot settings validated with zod; `RuntimeEnv` for settings operators change without a
restart: AI\_\* fallback, Steam Web API key, admin bootstrap, sample demo, Stripe price ids).

## Patterns (and where)

- **Repository** — every `modules/*/*.repository.ts`: `AuthRepository`/`PgAuthRepository`,
  `UsersRepository`, `DevicesRepository`, `PrivacyRepository`, `LiveSessionStore`
  (`PgLiveSessionStore` + `InMemoryLiveSessionStore`), `MatchesRepository`,
  `JobQueueRepository`, `RetentionRepository`, `CoachingRepository`, `CoachPlansRepository`,
  `AiConfigRepository`, `AdminRepository`, `FeedbackRepository`, `PlansRepository`,
  `UsageRepository`, `BillingRepository`, `ReplayRepository`. SQL is copied verbatim from the
  old `PgRepository`.
- **Service Layer** — `*.service.ts` in each module (`AuthService`, `UsersService`,
  `DevicesService`, `PrivacyService`, `TelemetryService`, `LiveService`, `UploadService`,
  `SampleDemoService`, `MatchesService`, `AnalysesService`, `ReviewService`,
  `LiveCallService`, `ProgressService`, `CoachProfileService`, `PersonalizationService`,
  `AiAccessService`, `AiProviderAdminService`, `AppSettingsService`, `AdminService`,
  `FeedbackService`, `PlansService`, `QuotaService`, `BillingService`, `ReplayService`).
- **DTO + Mapper** — `*.dto.ts` per module (zod schemas + inferred types);
  `ai-config/ai-config.mapper.ts` (`providerView`); `matches/matches.repository.ts`
  (`matchView`); `coaching/viewer.policy.ts` (`publicCoaching`); the web-facing types are
  mirrored in `packages/contracts/src/api/*` (exported as the `api` namespace).
- **Dependency Injection via a composition root** — `container.ts`, `composition/live.ts`,
  `composition/platform.ts`, `composition/jobs.ts`. `ApiConfig` (`config/api-config.ts`) lets
  tests override any infrastructure dependency: `database`, `paymentGateway`, `clock`,
  `steamFetch`, `env`, `aiGateway`, `logger`, `overrides.jobQueue`, `overrides.demoParser`.
- **Adapter** — `infrastructure/steam/http-steam-client.ts` (OpenID verification + profile),
  `infrastructure/billing/stripe-payment-gateway.ts`, `infrastructure/parser/demo-parser.ts`
  (`ProcessDemoParser`), `infrastructure/storage/object-storage.ts` (`FsObjectStorage`) and
  `replay-storage.ts` (`FileReplayStorage`), `infrastructure/ai/coaching-ai-gateway.ts`
  (`CoachingAiGateway` over `@cs2/coaching`), `infrastructure/ai/model-catalog.ts`
  (`HttpModelCatalog`), `infrastructure/secrets/aes-gcm-secret-cipher.ts`
  (`AesGcmSecretCipher`), `infrastructure/realtime/live-broadcaster.ts`
  (`WebSocketBroadcaster`). Cross-module adapters: `plans/plans.extras.ts`
  (`PlanAccountExtras`), `replay/replay.repository.ts` (`MatchesReplayRepository`).
- **Strategy** — `ai-config/ai-settings.service.ts`: an ordered chain of `AiConfigSource`
  strategies (`AssignedProviderSource`, then `EnvironmentSource`); `PaymentGateway`
  implementations (Stripe, Null, test fakes); the provider wire style (chat vs responses API,
  JSON mode) selected inside `@cs2/coaching` from the `AiConfig`.
- **Factory** — `ai-config/ai-config.factory.ts` (`AiConfigFactory`: every `AiConfig` from
  DB or env goes through `loadAiConfig`); `infrastructure/billing/payment-gateway-factory.ts`
  (`createPaymentGateway`).
- **Null Object** — `infrastructure/billing/null-payment-gateway.ts`: billing disabled answers
  503 `billing_disabled` without `if (gateway)` checks.
- **Unit of Work** — `shared/db/unit-of-work.ts` (`PgUnitOfWork`, `DirectUnitOfWork` for
  fakes). Used by `PlansService.grant` (subscription + retention clamp + audit),
  `PlansService.applyProviderState`, `PlansService.updatePlan` (plan + audit) and
  `AdminService.changeRole` (role change + audit).
- **Guard / Middleware chain** — `shared/http/guards.ts` (`AuthGuards.requireUser`,
  `requireAdmin`, `requireDevice` preHandlers that decorate `request.principal` /
  `request.device`); the per-IP auth rate-limit hook in `auth/auth.routes.ts`
  (`installAuthRateLimit`, using `shared/http/rate-limit.ts`).
- **Policy objects** — `plans/plan.policy.ts` (`PlanPolicy`: entitlement, applicable plan,
  admin plan, retention clamp, upgrade path — pure and unit-tested);
  `coaching/viewer.policy.ts` (`ViewerPolicy`: what non-admins may see of AI provenance).
- **Observer** — `live/owner-invalidation.ts` (`OwnerInvalidationBus`): logout, device
  rotation/revocation, consent withdrawal and account deletion publish; the live module closes
  the owner's sockets and pending tickets.

### Why quota reservations are not a database transaction

AI reviews and live calls consume a plan unit **before** a model call that can take tens of
seconds. Holding a transaction (and its row locks) open across that call would serialize a
user's requests and exhaust the pool. Instead `QuotaService` performs an atomic
check-and-consume (single conditional upsert, or an advisory-locked transaction for live
matches) and returns a `Reservation`; services `release()` it on any failure, so only
successful work counts. The Unit of Work is used where all writes are local and fast.

## Preserved legacy quirks (intentional)

- **Error bodies.** Most routes answer failures with `{ "error": "..." }` only; the plans,
  billing, replay and AI endpoints always sent `{ "error", "code", ... }`. `AppError.code` is
  therefore optional, and `AuthGuards` has a `"plain"` and a `"coded"` style
  (`guards.withStyle("coded")` for plans, billing and replay) so 401/403 bodies stay
  byte-identical per route group.
- Errors raised while streaming an upload body keep Fastify's generic bodies
  (`"Invalid request"`, `"Payload exceeds size limit"`), exactly as before.
- Memory mode (no `DATABASE_URL`, local dev only) keeps its static tokens and in-process
  sessions; `/v1/auth/logout` revokes the static token for the process lifetime.

## Intentional behaviour change

One, requested with the refactor: **AI key-moment outcome consistency** (in
`packages/coaching`). Key-moment candidates now state the outcome explicitly ("YOU KILLED …" /
"YOU DIED to …"), the moment `kind` is forced from the event (the player's kill → highlight,
the player's death → mistake), and moments whose text contradicts the outcome (EN/PT keyword
check) are dropped. Everything else is behaviour-preserving.

## Consequences

- Each concern has one home; a new endpoint touches a route table, a controller method, a
  service method and (maybe) a repository method.
- Services are unit-testable with in-memory fakes (no database, no network).
- More files and some interface boilerplate; module boundaries must be respected in review.
- The composition root is plain TypeScript: explicit, type-checked, no decorators/reflection.

## Alternatives considered

- **NestJS or a DI-container library (tsyringe, inversify, awilix).** Rejected: a framework
  rewrite risks the byte-identical HTTP contract, adds decorators/reflection metadata and a
  second lifecycle on top of Fastify. Manual constructor injection in one composition root
  gives the same testability with no magic.
- **Microservices.** Rejected: one team, one database, strong transactional coupling (quota +
  review, consent + jobs). Network boundaries would add latency and failure modes without a
  scaling need. Bounded-context modules keep the option open.
- **Keep the god files and add tests.** Rejected: it does not fix the coupling of HTTP, rules
  and SQL that made changes risky, and it does not address the reviewer's request.
