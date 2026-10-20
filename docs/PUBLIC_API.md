# Public API

FRAGMIND has a public, versioned HTTP API under `/api/v1`: upload demos from your own tools,
read analyses and player metrics, request AI reviews and get webhooks when work finishes.

- Interactive docs (Swagger UI): `<API_PUBLIC_URL>/api/docs`, for example
  http://127.0.0.1:4000/api/docs in local development.
- OpenAPI 3.1 document: `<API_PUBLIC_URL>/api/v1/openapi.json` (generated from the zod DTOs, with
  examples, scopes per operation, error schemas and the `webhooks` section).

The web app keeps using its internal `/v1` routes through the same-origin proxy; `/api/v1` is
the stable contract for integrations. Admin and internal routes are never exposed under
`/api/v1`.

## Authentication and scopes

Create a key in the app under **Settings, Developers**. The full key (`fm_live_` followed by 32
characters) is shown once; the app only keeps a peppered hash. Send it on every request:

```
Authorization: Bearer fm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Scope             | Allows                                                  |
| ----------------- | ------------------------------------------------------- |
| `matches:read`    | List demos, read status and summary                     |
| `matches:write`   | Upload and delete demos                                 |
| `analyses:read`   | Analyses, player metrics, saved reviews                 |
| `reviews:write`   | Request AI reviews (spends credits)                     |
| `progress:read`   | Progress across your own matches                        |
| `account:read`    | Account, plan, credit balance and ledger                |
| `webhooks:manage` | Create, list, test and delete webhooks, list deliveries |

Up to 10 active keys per account, each with an optional expiry (30, 90 or 365 days). Revoke a
key in the same panel; it stops working immediately (`401 api_key_revoked`).

## Endpoints

| Method and path                            | Scope             | What                                                        |
| ------------------------------------------ | ----------------- | ----------------------------------------------------------- |
| `POST /api/v1/demos`                       | `matches:write`   | Upload a `.dem` (raw body, `X-Filename`, `Idempotency-Key`) |
| `GET /api/v1/demos`                        | `matches:read`    | List, newest first: `cursor`, `limit`, `ownership`, `map`   |
| `GET /api/v1/demos/{id}`                   | `matches:read`    | Status, ownership and match summary                         |
| `DELETE /api/v1/demos/{id}`                | `matches:write`   | Delete the demo and its reviews                             |
| `GET /api/v1/demos/{id}/analysis`          | `analyses:read`   | Players and metrics, rounds, evidence; `include=events`     |
| `GET /api/v1/demos/{id}/players/{steamId}` | `analyses:read`   | One player's metrics and lobby comparison                   |
| `POST /api/v1/demos/{id}/reviews`          | `reviews:write`   | AI review `{steamId, tier: quick, deep or team, lang}`      |
| `GET /api/v1/demos/{id}/reviews`           | `analyses:read`   | Saved reviews of the demo (`steamId` optional)              |
| `GET /api/v1/reviews/{id}`                 | `analyses:read`   | One saved review                                            |
| `GET /api/v1/progress`                     | `progress:read`   | Progress (`map` optional)                                   |
| `GET /api/v1/me`                           | `account:read`    | Account, plan, credits, today's usage                       |
| `GET /api/v1/credits/ledger`               | `account:read`    | Credit movements                                            |
| `GET/POST /api/v1/webhooks`                | `webhooks:manage` | List or register webhooks                                   |
| `DELETE /api/v1/webhooks/{id}`             | `webhooks:manage` | Delete a webhook                                            |
| `POST /api/v1/webhooks/{id}/test`          | `webhooks:manage` | Send a signed `ping` now                                    |
| `GET /api/v1/webhooks/deliveries`          | `webhooks:manage` | Recent deliveries and outcomes                              |

Uploads follow exactly the rules of the web upload: telemetry consent, the plan's daily upload
quota and storage quota, 10 uploads per minute per account and 30 per network, at most 4
concurrent uploads, the admin size limit (500 MB by default) and a CS2 demo signature check on
the bytes. A demo that was already analysed completes immediately. Reviews cost the same credits
as in the app (`402 insufficient_credits` with the balance and packs otherwise) and a failed
review is never charged. An upload over the daily upload or storage quota answers `429 quota_exceeded`;
too many uploads per minute answer `429 upload_rate_limited` with `Retry-After`.

## Errors, rate limits, CORS

Every error has the same shape; `code` is stable, `message` may change:

```json
{
  "error": {
    "code": "insufficient_scope",
    "message": "This API key lacks the account:read scope",
    "details": { "requiredScope": "account:read" },
    "requestId": "1f0c..."
  }
}
```

Every response carries `X-Request-Id` (you may send your own). Each key may make 60 requests
per minute on Free, 120 on Basic and 300 on Pro. Answers carry `RateLimit-Limit`,
`RateLimit-Remaining` and `RateLimit-Reset` (seconds); over the limit you get `429 rate_limited`
with `Retry-After`. CORS allows any origin without credentials (cookies are never read, so
there is no CSRF surface), but never ship a key in a public web page.

## Quick start with curl

```bash
export FRAGMIND=http://127.0.0.1:4000
export KEY=fm_live_...   # Settings, Developers, Create API key

# Upload (retry-safe with an Idempotency-Key)
curl -sS -X POST "$FRAGMIND/api/v1/demos" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/octet-stream" \
  -H "X-Filename: match.dem" \
  -H "Idempotency-Key: match-2026-10-19" \
  --data-binary @match.dem
# {"id":"8d7c...","status":"queued","links":{...}}

# Poll until status is complete (or use a webhook)
curl -sS "$FRAGMIND/api/v1/demos/8d7c..." -H "Authorization: Bearer $KEY"

# Analysis (compressed)
curl -sS --compressed "$FRAGMIND/api/v1/demos/8d7c.../analysis" -H "Authorization: Bearer $KEY"

# AI review of one player (spends credits)
curl -sS -X POST "$FRAGMIND/api/v1/demos/8d7c.../reviews" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"steamId":"76561198000000000","tier":"quick","lang":"en"}'
```

## Python

```python
import os, time, requests

BASE = os.environ.get("FRAGMIND", "http://127.0.0.1:4000") + "/api/v1"
s = requests.Session()
s.headers["Authorization"] = "Bearer " + os.environ["KEY"]

with open("match.dem", "rb") as demo:
    r = s.post(f"{BASE}/demos", data=demo, headers={
        "Content-Type": "application/octet-stream",
        "X-Filename": "match.dem",
        "Idempotency-Key": "match-2026-10-19",
    })
r.raise_for_status()
demo_id = r.json()["id"]

while (status := s.get(f"{BASE}/demos/{demo_id}").json()["status"]) in ("queued", "processing"):
    time.sleep(5)
assert status == "complete", status

analysis = s.get(f"{BASE}/demos/{demo_id}/analysis").json()
player = analysis["players"][0]   # or the player whose steamId is yours
review = s.post(f"{BASE}/demos/{demo_id}/reviews",
                json={"steamId": player["steamId"], "tier": "quick", "lang": "en"},
                timeout=300).json()
print(review["review"]["summary"], "balance:", review["balance"])
```

## JavaScript (Node 20+)

```js
import { readFile } from "node:fs/promises";

const BASE = `${process.env.FRAGMIND ?? "http://127.0.0.1:4000"}/api/v1`;
const auth = { Authorization: `Bearer ${process.env.KEY}` };

const upload = await fetch(`${BASE}/demos`, {
  method: "POST",
  headers: {
    ...auth,
    "Content-Type": "application/octet-stream",
    "X-Filename": "match.dem",
    "Idempotency-Key": "match-2026-10-19",
  },
  body: await readFile("match.dem"),
});
const { id } = await upload.json();

let demo;
do {
  await new Promise((r) => setTimeout(r, 5000));
  demo = await (await fetch(`${BASE}/demos/${id}`, { headers: auth })).json();
} while (demo.status === "queued" || demo.status === "processing");

const analysis = await (
  await fetch(`${BASE}/demos/${id}/analysis`, { headers: auth })
).json();
console.log(analysis.map, analysis.players.length, "players");
```

## Webhooks

Instead of polling, register an https endpoint (in the app or with `POST /api/v1/webhooks`)
for `demo.completed`, `demo.failed` and `review.completed`. The signing secret (`whsec_...`) is
shown once. Each delivery is a JSON `POST`:

```json
{
  "id": "3f0c...",
  "type": "demo.completed",
  "createdAt": "2026-10-19T18:23:42.000Z",
  "data": {
    "demoId": "8d7c...",
    "filename": "match.dem",
    "status": "complete",
    "map": "de_mirage",
    "links": { "demo": "...", "analysis": "..." }
  }
}
```

Headers: `FragMind-Event`, `FragMind-Delivery` (the `id`, stable across retries, use it to
deduplicate) and `FragMind-Signature: t=<unix seconds>,v1=<hex>` where
`v1 = HMAC-SHA256(secret, "<t>.<raw body>")`. Verify it before trusting the body and reject
timestamps older than 5 minutes:

```python
import hmac, hashlib, time

def verify(header: str, secret: str, body: bytes) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    t = int(parts["t"])
    if abs(time.time() - t) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])
```

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(header, secret, rawBody) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}
```

Answer any 2xx within 10 seconds. Other answers, timeouts and network errors are retried with
exponential backoff (30 s, doubling, 8 attempts over about an hour); 20 consecutive failed
attempts disable the webhook (shown in the app). Redirects are not followed. The URL must be
https and resolve to a public address: private, loopback, link-local and cloud metadata
addresses are refused when you register it and again on every delivery (the resolved address
is checked and then used for the connection). In local development (`APP_ENV=local`) http
URLs on localhost are allowed.

## Security notes

- Keys: 190 bits of randomness; only `HMAC-SHA256(pepper, key)` is stored, with the pepper
  derived from `APP_ENCRYPTION_KEY`. Rotating that key invalidates every API key (and the stored
  webhook secrets, which are AES-256-GCM encrypted with it), so keep it stable.
- Last use is recorded per key as a time and an HMAC of the caller's /24 (IPv4) or /48 (IPv6)
  network, never the address itself.
- Key creation, revocation and denied uses (wrong scope, expired or revoked key) are written to
  `api_key_events`; webhook creation and deletion too.
- AI provenance (model and provider) is never returned by the public API, as for non-admin
  users in the app.
