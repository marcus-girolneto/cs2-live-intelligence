# Public CS2 regression fixture

Acquired 2026-10-19 from the public [LaihoE/demoparser](https://github.com/LaihoE/demoparser) repository, commit `45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8`, path `src/parser/test_demo.dem`.

- Immutable URL: https://raw.githubusercontent.com/LaihoE/demoparser/45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8/src/parser/test_demo.dem
- Repository license: [MIT](https://github.com/LaihoE/demoparser/blob/45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8/LICENSE); exact downloaded notice retained in `LICENSE.demoparser`. Repository publishes this test asset with its code; no distinct asset restriction was found. Player names are real fixture content, not application users or identity claims.
- Expected size: `60601900` bytes.
- SHA256: `84a1a4191302bdd2a3bbb5a727842093744b1fb1a228aeec630369e44b622cb2`.
- Header: `PBDEMS2\0`, verified before parsing; this is CS2, not a CS:GO fixture.
- Stored locally as ignored `public-cs2.dem`; reproducible acquisition: `python3 scripts/fetch-fixture.py` from this app directory.

A 60.6 MB standalone demo was selected after inspecting the pinned demoinfocs test submodule, whose CS2 archive `s2.7z` was 267.9 MB compressed. The larger archive was not downloaded. The user's request authorized obtaining a generic public demo.

Actual parse using this implementation (cs2live.2): map `de_mirage`; 10 players; 10 valid rounds; tick rate 64; 1764 events (1159 gun shots, 258 damage, 195 grenades, 71 flashed, 62 kills, 9 bomb, 10 round ends); `complete: true`. The core combat set (258 damage, 62 kills, 10 round ends) is unchanged from cs2live.1. Round 10 ends by CT surrender without an observed freeze-time end, so it has no economy sample. The last round has 9 observed starting participants, which is preserved instead of assuming a full roster. The parser observed start, contiguous live rounds and explicit match finish. Real player identity/Steam ownership and real live GSI remain separate validation gates.

Measured on the development Mac with `/usr/bin/time -l`: 2.32 seconds wall time and 126,500,864 bytes maximum resident set size for the initial parse. This is one fixture, not a throughput guarantee. Unknown-grenade-model diagnostics were emitted by the dependency on stderr and did not prevent combat/round normalization.
