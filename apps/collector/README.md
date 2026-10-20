# Day 1 GSI collector

Go standard library only. Authenticated CS2 GSI on IPv4 loopback, shared allowlist projection (auth and roster never forwarded), stamped envelopes, bounded queue and device bearer forwarding. No game process access.

From this directory with the API on port 4000:

```sh
GSI_AUTH_TOKEN=local-gsi-secret DEVICE_TOKEN=dev-device-token go run ./cmd/collector
go run ./cmd/mock -token local-gsi-secret -count 100 -interval 20ms -reconnect-at 50 -reconnect-pause 500ms
curl http://127.0.0.1:3002/health
```

| Environment    | Flag           | Default                                |
| -------------- | -------------- | -------------------------------------- |
| GSI_LISTEN     | -listen        | 127.0.0.1:3002                         |
| API_URL        | -api-url       | http://127.0.0.1:4000/v1/telemetry/gsi |
| DEVICE_ID      | -device-id     | dev-device                             |
| DEVICE_TOKEN   | -device-token  | required                               |
| GSI_AUTH_TOKEN | -gsi-token     | required                               |
| SESSION_ID     | -session-id    | fresh random ID per process            |
| SEQUENCE_FILE  | -sequence-file | required for fixed session ID          |
| n/a            | -queue-size    | 256                                    |
| n/a            | -max-payload   | 65536 bytes                            |

Prefer environment variables for tokens to avoid process arguments. Integration can use `-session-id dev-session -sequence-file /tmp/cs2live-sequence.json`. Sequences persist before acceptance, allowing gaps on failure but preventing reuse on restart. Keep the sequence file for the life of a fixed session and run one collector per file; deleting it requires a new session ID. Map changes or decreasing round counts start a random session; the sequence file stores both configured ID and rotated active ID so the same startup flags resume the latest active session. `/health` returns `sessionId`, `sequence` and `queued`.

Only literal `127.0.0.1` binds are allowed. Remote APIs require HTTPS; HTTP is allowed only for loopback development. Redirects are rejected. Invalid allowed fields return 400, bad GSI auth 401, oversized bodies 413, full queue 503. Successful admission returns 202 and does not guarantee upstream delivery.

The single worker preserves ordering. Network failures, 429 and 5xx retry up to five attempts, with 100ms exponential delay capped at 5s. Other HTTP failures and exhausted retries drop events with an event-ID-only log. The bounded queue is volatile. SIGINT/SIGTERM stops admission and allows five seconds for pending delivery before canceling; process failure or exhausted shutdown deadline can lose pending events. API deduplication protects against retries.

Mock flags: `-url`, `-token`, `-count`, `-interval`, `-reconnect-at` (0 disables), `-reconnect-pause`. It emits warmup/live/gameover, increasing kills, every seventh player omitted, and a source gap plus connection recreation. Browser/API disconnect coverage belongs to integration tests. Run `go test -race ./...`.

## Windows CS2 configuration

1. Steam Library → right-click Counter-Strike 2 → Properties → Installed Files → Browse discovers the actual installation.
2. Locate `game\csgo\cfg` beneath that installation root. A common default is `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg`; custom libraries differ.
3. Copy `gamestate_integration_cs2live.cfg` there, preserving the prefix and `.cfg` extension. Set its token to the collector's `GSI_AUTH_TOKEN` and keep the config private.
4. Start collector and API, restart CS2, enter a match, and inspect `/health` sequence and dashboard. Verify real fields and latency before asserting game support.
5. If the path differs, start at Steam Browse and locate `game\csgo\cfg`; check hidden extensions did not create `.cfg.txt`. Continue using the mock if live GSI fails, recording the installation path and observed HTTP behavior for investigation.

Reference: [Valve GSI wiki](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration). Retrieval returned an anti-bot page in this environment; the example and installation procedure remain pending validation on real Windows CS2. No Windows/CS2 installation was available. Own-player stats still require matching provider/player Steam IDs in the API; no roster or hidden enemy data is requested.
