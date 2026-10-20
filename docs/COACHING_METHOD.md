# Coaching method: the pro-team practice session

FRAGMIND's training layer (packages/coaching/src/training) turns every review into practice
that follows how professional Counter-Strike teams train. The product calls it the
"pro-team method" and never names a real coach.

## The session (in this order)

| Step          | Minutes  | What the player does                                                                                                                         | Success criterion (checked by the next review)      |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Review        | 20       | One precise question ("why did I die at Jungle twice on T?"). Only your deaths in lost rounds, 30 to 60 minutes after the match, with notes. | One written sentence: what you will do differently  |
| Warmup        | 10 to 15 | Short mechanical warmup (Aim Botz at head height, or spray control). Never a long unfocused deathmatch.                                      | A fixed count (100 kills), then stop                |
| Area habit    | 10 to 20 | The exact map, side, area and role where you fight: your own teleports, the map's prefire route or utility map.                              | A rep target (on target in 8 of 10, 4 of 5 lineups) |
| Focused block | 30       | Queue, scrim or deathmatch with ONE objective tied to the review's target metric.                                                            | The metric moves in the next review                 |
| Debrief       | 5        | Three lines: what improved, what to keep, the question for the next review.                                                                  | Three lines written                                 |

Principles:

- Every session names the map, side, area and role (role is a modest guess from one match:
  entry, support, lurker or rifler).
- Every session has a measurable success criterion; plan items carry a `targetMetric` and the
  next review measures adherence.
- Deathmatch alone does not fix utility, economy or positioning, so those focus blocks are
  played in real rounds.
- Confidence comes from preparation: one short mindset cue per plan ("Play your angle with
  confidence: you have seen it from both sides."), no therapy talk. Sleep, water and breaks
  appear once, briefly, in the weekly layout.
- The week: five practice days that each follow the session above (alternating the two
  weakest skills) and two rest days.

The method is exported as `PRO_COACH_METHOD` / `PRO_COACH_METHOD_TEXT`
(packages/coaching/src/training/method.ts) so AI prompts can reference the same structure.

## What is deterministic

Resources, Workshop ids, console commands and coordinates never come from a model:

- Catalog: `packages/coaching/src/training/catalog.ts`. `pnpm training:verify` asks Steam's
  public `ISteamRemoteStorage/GetPublishedFileDetails/v1` (POST, no key) about every Workshop
  id and writes `catalog.verified.json` (title match, `consumer_app_id` 730, not banned or
  removed, CS2 tag). A unit test fails if an entry has no passing record, and the API serves
  only verified entries.
- Teleports: kill events give the exact death and killer positions (world units, origin at
  the feet); the replay samples give view angles and throw positions (whole degrees, a few
  samples per second, so they are labelled approximate). Angles use the game's convention:
  pitch positive looks down, yaw 0 is +X, 90 is +Y.
- Plans: `buildTrainingPlan` ranks weak skills from the review (plan target metrics, drill
  areas, lowest score) and the deep modules (crosshair on target, isolation, trades, flashes).

## Console commands and sources

Every command was checked against the CS2 command and convar dump published by SteamDB
(`DumpSource2/commands.txt` and `convars.txt` in
https://github.com/SteamDatabase/GameTracking-CS2):

- Practice config: `sv_cheats 1; bot_kick; mp_warmup_end; mp_freezetime 0;
mp_roundtime_defuse 60; mp_buy_anywhere 1; mp_buytime 9999; mp_maxmoney 60000;
mp_startmoney 60000; sv_infinite_ammo 1; ammo_grenade_limit_total 5;
sv_grenade_trajectory_prac_pipreview 1; sv_showimpacts 1; mp_restartgame 1`.
- Teleports: `setpos_exact x y z` ("Move player to an exact specified origin") and
  `setang pitch yaw 0`. Plain `setpos` is not used because `getpos` and `setpos` pairs work
  with the eye position in some builds. The origin is lifted 2 units because the demo heights
  are rounded to whole units.
- Bots: `bot_add_t` / `bot_add_ct`, `bot_stop 1`, `bot_dont_shoot 1`, then `bot_place`
  ("Places a bot from the map at where the local player is pointing") from your death spot,
  looking at the enemy's feet.
- Workshop maps: `host_workshop_map <id>` ("Get the latest version of the map and host it on
  this server"), after subscribing; otherwise Play, Workshop Maps. `map <name>` starts an
  official map.
- Steam links: `steam://url/CommunityFilePage/<id>`, the https fallback
  `https://steamcommunity.com/sharedfiles/filedetails/?id=<id>` and `steam://rungameid/730`.
  The browser cannot start a map inside CS2: the UI opens Steam and copies the commands.

## Sources (practice culture)

- https://ggscore.com/en/csgo/news/74302
- https://navi.gg/en/publications/6851-cs-b1ad3-year-coach
- https://invenglobal.com/articles/8484/navi-reveals-esports-camp-partners-and-website
- https://esports.gg/news/counter-strike-2/furia-sidde-betboom-dacha-we-aimed-for-top-4/
- https://pley.gg/?p=42698
- https://guildorder.com/games/csgo/guides/demo-review-workflow
- https://tradeupacademy.org/articles/cs2-ranked-practice-routine-2026
- https://community.skin.club/en/news/scrim-culture-in-counter-strike-how-pro-teams-improve-faster-by-golden
