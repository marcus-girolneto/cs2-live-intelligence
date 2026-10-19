# Match integrity signals

FRAGMIND shows the uploader of a match where play in that match was **statistically unusual**,
and which participants received a **Steam ban after the match**. It exists so a player can put a
bad result in context (and so the coach does not hold deaths to such opponents against them). It
is not an anti-cheat and it never decides that anyone cheated.

## Product and legal rules

- Never label anyone a cheater. Wording is fixed: "statistically unusual" for the signals and
  "account banned after this match" for bans. No "cheater", "hacker", "suspect", "aimbot" or
  similar words in the UI, the API or AI output (the coaching prompts also forbid claiming or
  speculating that anyone cheats).
- Visible only to the uploader of that match: `GET /v1/analyses/:id/integrity` and the
  `analysis.integrity` field are owner-scoped (404 for any other account). A demo uploaded by
  several accounts produces one independent copy per account.
- No public profile or score per player, no aggregation across matches or accounts. Signals are
  stored per match (inside the analysis) and Steam ban rows per match (`match_bans`); both are
  deleted with the match (retention, match or account deletion).
- No report data: Valve does not expose report counts through any API, so none are shown or
  approximated.
- Ban data stored: SteamID, VAC ban count, game ban count, days since the last ban, and the
  derived `bannedAfterMatch` flag. Nothing else from the Steam response is kept.

## API

`GET /v1/analyses/:id/integrity` (signed-in uploader of the match):

```json
{
  "players": [
    {
      "steamId": "7656119…",
      "level": "none",
      "reasons": []
    },
    {
      "steamId": "7656119…",
      "level": "low",
      "reasons": [
        { "code": "inhuman_snaps", "value": 3, "threshold": 2, "n": 14 }
      ]
    }
  ],
  "bannedAfterMatch": [
    {
      "steamId": "7656119…",
      "vacBans": 1,
      "gameBans": 0,
      "daysSinceLastBan": 1,
      "bannedAfterMatch": true
    }
  ],
  "checkedAt": "2026-10-19T21:00:00.000Z"
}
```

`level` is `none` by default. It counts the reasons that fired: one → `low`, two → `elevated`,
three or more → `high`. A reason only exists when its sample size `n` is sufficient and its
value passes the threshold; `value`, `threshold` and `n` are always shown together.

## Signals and thresholds

Computed deterministically from the demo by `packages/analytics/src/anomaly.ts`
(`INTEGRITY_THRESHOLDS`). Only events between opposing teams count.

| Code                 | What is measured                                                                                                                                                                                                                                                                        | Fires when (conservative)                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `inhuman_snaps`      | Per engagement (first gun hit of an attacker/victim/shot burst, parser cs2live.5+): the attacker's view at full tick rate for 0.5 s before the first shot. A snap = peak angular speed ≥ 1500°/s and ≥ 20° travelled in the last 100 ms, ending < 1° from the victim's head–chest line. | ≥ 2 snaps, ≥ 10% of the player's measured engagements, ≥ 10 engagements |
| `headshot_rate`      | Headshot kills / kills, one-sided binomial z-score against the rest of the lobby.                                                                                                                                                                                                       | z ≥ 4 with ≥ 15 kills                                                   |
| `head_hits_per_shot` | Head hits / gun shots fired, z-score against the lobby.                                                                                                                                                                                                                                 | z ≥ 4 with ≥ 100 shots                                                  |
| `reaction_time`      | Reaction proxy: after the first hit a player receives from an opponent (per round and pair) while not already firing in the previous second, the time until they first damage that opponent back (within 1 s). Median.                                                                  | median < 0.15 s with ≥ 10 samples                                       |
| `smoke_wall_kills`   | Kills through smoke or after penetrating an object / kills, z-score against the lobby.                                                                                                                                                                                                  | ratio ≥ 0.3, z ≥ 4, ≥ 12 kills                                          |

Not measured, never claimed: pre-aiming or tracking through walls and cover. That requires map
geometry and visibility, which demos do not contain.

Calibration (parser cs2live.5): on the pinned public fixture (de_mirage, 10 rounds, 79 aim
windows) and a real 23-round de_dust2 match (252 aim windows) every player scores `none`. The
fastest flicks observed were 1157°/s and 594°/s, and none of them ended within 1° of the target;
median end offsets were 1.8° and 1.3°. The highest lobby headshot z-score was 3.43 (25 kills),
which is why the headshot threshold is 4 rather than 3.5; reaction samples per player were at
most 4, far below the minimum of 10. Thresholds can only be loosened with new calibration data
and a documented review.

## Steam bans after the match

- Source: `ISteamUser/GetPlayerBans/v1` with the Steam Web API key managed by admins
  (Admin → Integrations; `STEAM_WEB_API_KEY` as bootstrap fallback). Without a key nothing is
  checked and `bannedAfterMatch` stays empty.
- When: the API's hourly account job checks each complete match once, then again 7 and 30 days
  after the upload (bans arrive later). The sandboxed demo worker has no internet and never calls
  Steam.
- Limits: up to 100 SteamIDs per call (one call per match), a 24 h in-memory cache per SteamID,
  calls at least 1.1 s apart and at most 600 per hour.
- `bannedAfterMatch = (vacBans + gameBans > 0) and daysSinceLastBan < days since the match`. The
  match date is approximated by the upload date (a demo is uploaded after it is played), which
  errs towards not flagging.

## How it is used

- The uploader sees the signals with their numbers, thresholds and sample sizes, plus bans after
  the match, worded as above.
- The AI review never sees who was flagged or why: deaths to an opponent with level `high` or
  banned after the match are excluded from what the review counts against the player, and one
  neutral caveat is added (`packages/coaching/src/integrity.ts`).
