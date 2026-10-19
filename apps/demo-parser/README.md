# CS2 demo parser

A real CS2 `.dem` parser built with pinned [`demoinfocs-golang/v5 v5.2.0`](https://github.com/markus-wa/demoinfocs-golang/tree/v5.2.0), MIT license (notice retained in `LICENSE.demoinfocs-golang`). `go.mod` and `go.sum` pin direct and transitive dependencies. It does not obtain game files or call Steam/FACEIT/AI.

```sh
go build -o /tmp/cs2live-demo-parser ./cmd/demo-parser
/tmp/cs2live-demo-parser -input /absolute/path/match.dem

go test -race -count=1 ./...
python3 scripts/fetch-fixture.py
CS2_DEMO_FIXTURE="$PWD/testdata/public-cs2.dem" go test -race -count=1 ./...
```

The executable writes exactly one `normalizedDemoSchema` JSON object plus newline to stdout on success, or to the file named by `-output` (mode 0600; the API always uses it because documents of large demos exceed a pipe buffer). Diagnostics/errors go to stderr; malformed input exits 1 and argument errors exit 2. No JSON is written on parse failure. `-input` is required. `-max-bytes` defaults to 524288000 (500 MiB, the product's upload limit), with an absolute ceiling of 1073741824 (1 GiB). Only regular files with the CS2 `PBDEMS2\0` magic are accepted. CS:GO `HL2DEMO` files are rejected. Empty, truncated, malformed demos, and demos without any fully observed valid live round fail.

## Normalization and completeness

Only an observed live `RoundStart` outside warmup and after the game reports match started opens a round. Its number comes from `TotalRoundsPlayed()+1`. Only a corresponding `RoundEnd` with a CT or T winner commits that round and its pending events. Warmup, mid-round recordings before the first observed start, unfinished trailing rounds, draw/restart rounds, and events after `RoundEnd` are excluded. Duplicate round numbers are discarded and invalidate completeness; gaps invalidate completeness. Noncompetitive formats lacking these signals may fail or remain incomplete rather than being labeled as full matches.

Players and round participants use actual nonzero human Steam IDs. Bots and unidentified players are excluded and make the demo incomplete. Participants are the observed CT/T players at round start, sorted by ID; a new participant appearing in a round event is included but invalidates completeness because full participation is uncertain. Names are optional display data, bounded to the contract's 128 UTF-16 units. CT/T affiliations are captured separately on each event, so side switches do not assign a permanent team to a player. Nil attackers are world/unknown events with no fabricated attacker ID. Missing victims invalidate completeness and their events are discarded.

Damage uses the dependency's `PlayerHurt.HealthDamageTaken` (health actually lost), not raw weapon damage or armor damage. Unexpected values are clamped to 0–100 and invalidate completeness. Kills carry the observed headshot flag. Round-end events carry the observed CT/T winner. Events are sorted by round and tick, retaining dispatch order for ties. IDs are SHA256 hashes of canonical event content plus ordinal, truncated to 128 bits; identical input yields identical IDs and repeated same-tick events remain distinct. Players and participants have deterministic ID order.

`complete` and all three completeness flags become true only when an explicit match start at round zero, a match-finish signal (`AnnouncementWinPanelMatch` or final game phase), contiguous committed rounds, both playing teams, no dangling round, no parser warning, no POV recording signal, and no unresolved participants were observed. Clean EOF alone does not prove a finished match. Missing finish signals may conservatively mark an otherwise valid demo incomplete. No full-demo metric should be labeled complete unless these flags are true. Partial documents retain only valid observed rounds/events for consumers that explicitly present incomplete evidence. The executable computes no metrics.

## Enrichment (cs2live.2)

All enrichment fields are optional and omitted when the dependency cannot provide them; consumers must treat absence as "unknown", never as zero.

- `tickRate` (document) from the server info; `roundTime` on events = (tick − freeze-time-end tick) / tickRate, in seconds, omitted before freeze end or when unknown.
- Kills: `weapon`, `assisterId`, `flashAssist`, `penetrated` (wallbang), `noScope`, `throughSmoke`, `attackerBlind`, `distance` (game-reported, meters), `attackerPos`/`victimPos` (world units, 0.1 precision) and `attackerPlace`/`victimPlace` (the game's callout names, e.g. `TopofMid`).
- Damage: `weapon`, `hitgroup`, `armorDamage` (armor actually lost, clamped 0–100) and `attackerPlace`.
- `shot`: one per trigger pull of a firearm (pistol, SMG, heavy, rifle). Knife, Zeus, grenades and C4 are excluded. On the public fixture every gun damage event shares its tick with a recorded shot by the same shooter and weapon.
- `grenade`: flash/HE detonation, smoke/decoy start and inferno start (molotov and incendiary both map to `molotov`), with thrower, position and the thrower's callout.
- `flashed`: living victims blinded by a flashbang, with `durationSeconds` (capped at 10).
- `bomb`: plant/defuse/explode with player and site.
- Rounds: `reason` (e.g. `bomb_exploded`, `t_eliminated`) and `economy` sampled at freeze-time end per participant (`equipmentValue`, `money`, `primary`, `armor`, `helmet`). Items bought later in the buy period are not reflected.

- cs2live.3: kills carry `victimGrenades` (sorted grenade types the victim still carried when killed; `[]` = none, absent = inventory unreadable). Smoke/inferno durations are not emitted: the expiry events of the dependency report entity lifetimes (constant ~22 s / ~20 s on the fixture), not the visible effect, so area denial time is not derivable.

The M4A1-S is labelled `M4A1-S` (the dependency names it `M4A1`). Enrichment never changes round assignment, completeness or the core kill/damage semantics; it counts toward the event limit.

## Replay artifact (replay-1)

`-replay /path/<jobId>.replay.json.gz` additionally writes a gzipped JSON replay document for visual clips. It is separate from the normalized document (stdout is byte-identical with or without the flag), written atomically (temporary file in the same directory + rename, mode 0600) and best effort: a replay failure only prints a warning to stderr and still exits 0. The API stores it next to the `.dem` and deletes it with the job.

- Sampling: from freeze-time end of every committed round, every `round(tickRate/8)` ticks (8 Hz at 64 tick) on `FrameDone`, until 3 s after the round end. Rounds the normalizer discards (warmup, draw/restart, unfinished) and rounds without an observed freeze-time end have no replay.
- Document: `version`, `map`, `tickRate`, `sampleHz`, `players[{steamId,name}]`, `weapons[]` (dictionary for weapon indexes), `bounds{minX,maxX,minY,maxY}`, `cell` (48) and `outline` (flat `[x0,y0,x1,y1,...]` centers of 48-unit cells visited by living players; draws the map silhouette without radar images).
- Rounds: `number`, `freezeTick` (event time = (tick − freezeTick)/tickRate), `duration` (freeze end → round end, s), `winner`, `t[]` (seconds since freeze end, 0.01) and columnar `tracks[{p, team, x[], y[] (0.1 units), z[] (whole units, cs2live.3), yaw[] (0..359°), pitch[] (−90..90°, positive = looking down, cs2live.3), duck[] (1 while crouched, cs2live.3), hp[], armor[], w[] (weapon index, −1 none), fl[] (1 while blinded), alive[]}]` for the participants at freeze end (sorted by Steam ID). Dead players keep their last living position with hp 0.
- `shots[[t, playerIndex, x, y, yaw, weaponIndex]]` for gun shots, `grenades[{type, p, t0, from[x,y], t1, to[x,y], path[[x,y]] ≤16}]` (throw → detonation/expiry from projectile entities) and `bomb[{t, action, p, pos, site}]`.
- Output is deterministic. Public fixture (9 replayable rounds, 631 s of play): 295 KB gzipped with the cs2live.3 columns (251 KB before; ~33 KB per round), so a 24-round match is about 0.8–1.0 MB gzipped. The fixture test checks that the killer's last sample faces the victim (median yaw offset ≤ 15°), which pins the yaw/pitch conventions used by the deep review.

## Limits and isolation

Limits: 128 players, 1000 rounds, 5,000,000 normalized pending/committed events, and capped input size. Input is streamed. Dependency protobuf/entity allocations are not bounded by file size and the Go 1 GiB soft memory target is not a hard sandbox. Run as the API's separate worker process with an OS/container memory limit, subprocess deadline, bounded stdout/stderr capture, no network requirement and an immutable uploaded file. Parser panics on malformed data are converted to failures where recoverable; process crashes/OOM must be treated as failed jobs by the caller. Do not run parsing in the live ingest path.

## Verification

Unit tests cover deterministic normalization, complete/partial flags, post-round exclusion, duplicate rounds, missing/world actors, health damage versus overkill/armor, event and file limits, CLI stderr/stdout separation, corrupt headers and direct roundtrip against `packages/contracts/fixtures/normalized-demo.json`. The optional real fixture test checks the public demo's actual map, player/round/event counts and unique event IDs.

Real CS2 parse is verified with a public generic fixture. [Provenance, license, checksum and measurements](testdata/PROVENANCE.md) describe the source and observed output. The large binary and generated JSON are ignored; use the pinned fetch script to reproduce. This single fixture does not validate every CS2 patch or competitive demo format.

## Library version notes

- v5.2.0 (parser `cs2live.4`) is required for CS2 demos recorded after the late-2026 game updates;
  v4.5.1 failed on them with `unable to find existing entity`.
- v5 does not report C4 explosion damage (no attacker) as player-hurt events. Player metrics are
  unaffected: ADR and every damage metric only count damage dealt by players.
