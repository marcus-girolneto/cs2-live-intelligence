# ADR-005: Feature-based architecture for the web app

- Status: Accepted
- Date: 2026-10-19
- Scope: `apps/web`

## Context

`apps/web` had grown around a `components/` + `lib/` split: screens lived in `app/**/page.tsx`
(up to ~600 lines), `components/analysis-view.tsx` and `components/admin/providers.tsx` were
over 1,000 lines, `fetch()` and an `api()` helper were called from every component, and the
PT dictionary was one 1,400-line file. Nothing stopped a component from reaching into another
area's internals.

## Decision

Organise the web app by **feature**, with three layers and enforced dependency rules:

```
app/ (routes)  →  src/composition  →  src/features/<feature>  →  src/shared
app/api/**     →  src/server (route handlers, proxy allowlist, session, origin checks)
```

- **`app/`**: thin route files only (≤ 60 lines): a page renders one screen exported by a
  feature (`<HistoryScreen />`), a layout keeps its `metadata`, `app/api/**` delegates to
  `src/server/handlers`. Global CSS stays in `app/styles/*` (class names are the contract).
- **`src/composition/`**: the root: `AppProviders` (language + merged dictionaries),
  `AppGate` (auth state → landing / public shell / app shell with `AccountProvider` and
  `UpgradeProvider`) and `locales/` (one dictionary bundle per language, loaded lazily).
- **`src/features/<name>/`**: `api/` (interface + HTTP implementation + DI context),
  `hooks/`, `components/`, `model/` (pure, unit-tested), `i18n/<lang>.ts`, `index.ts` (the only
  import surface for other features and routes). Features: `auth`, `shell`, `landing`,
  `privacy`, `dashboard`, `matches`, `analysis`, `coach`, `replay`, `maps` (per-map progress
  and plans), `progress`, `live`, `settings`, `billing`, `admin`.
- **`src/shared/`**: framework-level building blocks with no feature knowledge: `http`
  (`HttpClient`, `ApiError`, `FakeHttpClient`), `i18n` core/provider + shared PT strings,
  `ui` primitives, `icons`, `format`, `hooks`, `session` (account context, "this is me"),
  `di`, `brand`, `api-types` (DTOs from `@cs2/contracts`), `config`.

### Patterns

- **API interface + default implementation + DI context.** Each feature declares
  `interface XApi`, `createXApi(http = platformHttp)` and `XApiProvider/useXApi` built with
  `createApiContext`. Hooks read the API from context, so tests and previews inject fakes;
  API modules are tested against `FakeHttpClient` (paths, methods, bodies, timeouts).
  `fetch(` exists only in `src/shared/http` and `src/server` (lint rule).
- **Container / presentational.** `*Screen` components and hooks own state and data; leaf
  components receive props (or one typed view model, e.g. `AnalysisVM`, `SettingsVM`) and
  render. Large screens are split by section/tab (analysis: `OverviewTab`, `AimTab`,
  `MapTab`, `RoundsTab`, `DataTab`; admin: `ProvidersList` → `ProviderCard`,
  `ProviderEditor` → `ProviderKeyField`/`ProviderAdvanced`).
- **Mappers / view models in `model/`.** DTO → view model normalisation is pure and tested
  (`normalizeCoaching`, `normalizePlans`, `playerInsight`, `playerView`, `buildReplay`,
  `buildMatchCards`, `mapsOf`).
- **State machines.** `authReducer` (loading → signed-in | signed-out | error), the coach
  flow (`useCoachSession`: match → player → saved review | run → report), the live
  connection (`useLiveSession`: disconnected ⇄ connecting → connected with backoff) and the
  clip player playback model.
- **i18n.** English source strings are keys; each feature owns `i18n/<lang>.ts` for the 8
  non-English languages (pt, es, ru, zh, de, fr, pl, tr). `scripts/i18n-registry.mjs` writes
  `src/composition/locales/<lang>.ts`, one lazily loaded chunk per language; the root layout
  loads only the request's language on the server (cookie, else Accept-Language) and the client
  loads others on demand. `useI18n()` exposes `lang`, `setLang`, `t` (ICU plurals, numbers in the
  locale's style) and `fmt` (Intl numbers, percent, currency, dates, relative time). The
  language selector (`shell/LanguageSelect`) syncs the choice to the account (`PUT /me/language`).
  `src/composition/i18n.test.ts` requires every key in every language, fails on stale keys and
  checks placeholders; per-language glossaries are in `docs/i18n/`.

### Enforcement

`src/architecture.test.ts` (no `lib/`/`components/`, files ≤ 300 lines, thin routes,
shared independent of features, cross-feature imports only through `index.ts`, relative
imports stay inside the feature, acyclic feature graph, every feature has an index) and
`eslint.config.mjs` (no `fetch`, no deep feature imports, no server/composition imports from
features, shared isolation).

## Consequences

- Screens are found by route → feature; a feature can be tested in isolation with a fake API.
- Cross-feature reuse is explicit (`@/features/analysis` exports `AnalysisView`, `KillFeed`,
  `metricValue` …) and the dependency graph stays acyclic.
- Client-only modules that create React contexts (`api/context.ts`) are marked `"use client"`
  so server route files can import feature indexes.
- The UI is pixel-identical to the pre-refactor build (31 screens × EN/PT compared).
