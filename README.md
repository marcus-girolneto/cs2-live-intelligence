# FRAGMIND

**The AI coach that reads every frag.** FRAGMIND analyzes your Counter-Strike 2 demos and tells you exactly what is costing you rounds — where your bullets land, where you die, when you peek, how you trade — then turns it into an IGL-style plan, replay clips of the key moments and live calls between rounds on a second screen.

> Proprietary software — see [LICENSE](LICENSE). Not affiliated with Valve Corporation.

## Features

- **Steam sign-in** — your Steam account is your account; profile, avatar, CS2 hours and bans on your dashboard.
- **Deep demo analysis** — accuracy and hit-group body map, weapons, kill/death map plot and callouts, opening timing, utility, economy and round-by-round kill feed. Every number has a formula and cites the demo events it came from.
- **AI Coach** — a dedicated screen: pick a match and a player, get a verdict, deterministic scores per area (aim, positioning, utility, trading, economy, impact), key moments with **2D replay clips** (exportable as video), drills and a plan split into **general** and **map-specific** items. The coach learns from your history and follows the personality you choose (aggressive, passive, tone, role, custom instructions).
- **Second screen** — live HUD from CS2 Game State Integration with between-round AI IGL calls (never during a fight), a match simulator and demo replay mode.
- **Plans** — Free, Basic and Pro with daily quotas; Stripe checkout when configured.
- **Admin area** — AI providers and models (any OpenAI-compatible API, keys encrypted at rest), model per purpose, plans, users and roles, audit log, reprocessing.

## Architecture

pnpm + Turborepo monorepo:

| Path                 | What                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`           | Fastify API — modules with routes → controller → service → repository, DTOs, composition root ([ADR-004](docs/ADR-004-architecture.md)) |
| `apps/web`           | Next.js app — feature folders with api / hooks / components / model ([ADR-005](docs/ADR-005-web-architecture.md))                       |
| `apps/demo-parser`   | Go demo parser (demoinfocs-golang) producing normalized events and replay samples                                                       |
| `apps/collector`     | Go GSI collector, device pairing, match simulator                                                                                       |
| `packages/contracts` | Zod contracts and API DTOs shared by API and web                                                                                        |
| `packages/analytics` | Deterministic metrics with formulas and evidence                                                                                        |
| `packages/coaching`  | Provider-agnostic AI client, versioned IGL prompts, learning and validation                                                             |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

Requires Docker Compose and Python 3.11+.

```sh
cp .env.example .env                       # fill in local values
python3 scripts/local-setup.py --with-demo # builds and starts everything
```

Open **http://127.0.0.1:3000** and sign in with Steam. The first Steam account becomes admin when `ADMIN_BOOTSTRAP=first-login` (or list SteamID64s in `ADMIN_STEAM_IDS`). Configure the AI provider in **Admin → AI providers**, or with `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` in `.env` as a fallback. If your network inspects TLS, point `EXTRA_CA_CERTS_FILE` at its CA certificate. Optional: `STEAM_WEB_API_KEY` for richer profiles, `STRIPE_*` for payments.

`pnpm local:up` / `pnpm local:down` start and stop the stack (volumes are kept). Ports: web 3000, API 4000, Postgres 55432 — all bound to loopback.

## Develop and verify

Requires Node.js 22, pnpm 10.33.0, Go 1.24+, Python 3.11+ and Docker.

```sh
pnpm install --frozen-lockfile
docker compose up -d
python3 apps/demo-parser/scripts/fetch-fixture.py
(cd apps/demo-parser && go build -o /tmp/cs2live-demo-parser ./cmd/demo-parser)
pnpm lint && pnpm format:check && pnpm typecheck
DATABASE_URL=<DB_CONNECTION_STRING>/cs2live \
  DEMO_PARSER_BIN=/tmp/cs2live-demo-parser \
  DEMO_FIXTURE="$PWD/apps/demo-parser/testdata/public-cs2.dem" pnpm test
pnpm build
pnpm exec playwright install chromium && pnpm test:e2e
```

Integration and E2E tests use isolated random Postgres schemas and a local OpenAI-compatible mock provider; they never touch your real account. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow (Conventional Commits).

## Fair play and privacy

FRAGMIND never reads game memory or injects into the game. Live calls use only your own player data and only between rounds. Demo text is treated as untrusted data, never as instructions. See [SECURITY.md](SECURITY.md), [operations](docs/OPERATIONS.md) and `/privacy` in the app.
