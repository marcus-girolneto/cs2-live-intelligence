# Contributing

## Setup

```bash
cp .env.example .env          # fill in local values
pnpm install
pnpm local:up                 # Docker: postgres, api, web, collector, simulator
```

## Architecture

Read `docs/ARCHITECTURE.md`, `docs/ADR-004-architecture.md` (API: modules with
routes → controller → service → repository, DTOs, composition root) and
`docs/ADR-005-web-architecture.md` (web: feature folders with api/hooks/components/model).

## Workflow

- Branch from `main`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`,
  `build`, `ci`, `chore`; scopes such as `api`, `web`, `parser`, `analytics`, `coaching`,
  `contracts`, `collector`, `billing`, `e2e`.
- Before pushing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
  (API tests need Postgres; see `.github/workflows/ci.yaml`) and `pnpm test:e2e` for UI flows.
- Every behaviour change needs tests; every UI string goes through `t()` with a PT translation.
- Never commit `.env`, secrets or private demo files.
