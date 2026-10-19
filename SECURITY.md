# Security Policy

## Reporting a vulnerability

Please report security issues privately to the repository owner through
[GitHub private vulnerability reporting](../../security/advisories/new). Do not open a
public issue. Include steps to reproduce, impact and affected versions. You will get an
acknowledgement within 3 business days.

## Scope and practices

- Secrets live only in `.env` (git-ignored) or the deployment's secret store. Never commit
  keys, tokens, `.dem` files of private matches or database dumps.
- Provider API keys stored by admins are encrypted at rest (AES-256-GCM, `APP_ENCRYPTION_KEY`)
  and are never returned by the API.
- Steam sign-in uses OpenID 2.0 with server-side verification; sessions are HttpOnly cookies.
- Demo files and telemetry are untrusted input: parsed with size/event limits, validated with
  zod, and never interpreted as instructions by the AI coach.
- Fair play: the product never reads game memory, injects into the game or provides hidden
  information during live play.

See `docs/SECURITY_DAY1.md` and `docs/OPERATIONS.md` for operational details.
