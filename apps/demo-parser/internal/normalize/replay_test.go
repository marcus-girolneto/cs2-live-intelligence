package normalize

import (
	"compress/gzip"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
)

func TestReplayRecorderLifecycle(t *testing.T) {
	r := newRecorder()
	names := map[string]string{"2": "two", "1": "one"}
	teams := map[string]string{"1": "CT", "2": "T"}
	r.begin(1, 1000, 64, []string{"2", "1"}, names, teams)
	for tick := 1000; tick < 1100; tick++ {
		r.frame(tick, nil)
	}
	if len(r.cur.T) != 13 || r.cur.T[1] != 0.13 || r.step != 8 {
		t.Fatalf("8 Hz sampling at 64 tick: %v step %d", r.cur.T, r.step)
	}
	if r.cur.Tracks[0].P != 0 || r.doc.Players[0].SteamID != "1" || r.cur.Tracks[0].Team != "CT" {
		t.Fatalf("tracks sorted by steam id: %+v %+v", r.cur.Tracks, r.doc.Players)
	}
	for _, tr := range r.cur.Tracks {
		if len(tr.X) != 13 || len(tr.Alive) != 13 || tr.Alive[0] != 0 || tr.W[0] != -1 {
			t.Fatalf("columns aligned and missing players are dead: %+v", tr)
		}
	}
	r.end(1, "CT", 1100)
	// The tail keeps sampling for replayTail seconds after round end, then commits.
	for tick := 1100; tick < 1100+64*4; tick++ {
		r.frame(tick, nil)
	}
	if r.cur != nil || len(r.doc.Rounds) != 1 || r.doc.Rounds[0].Duration != 1.56 || r.doc.Rounds[0].Winner != "CT" {
		t.Fatalf("round committed after tail: %+v", r.doc.Rounds)
	}
	last := r.doc.Rounds[0].T[len(r.doc.Rounds[0].T)-1]
	if last < 1.56+2.8 || last > 1.56+replayTail+0.2 {
		t.Fatalf("tail length %v", last)
	}
	// A round that never ends validly is dropped; a mismatched end drops too.
	r.begin(2, 5000, 64, []string{"1"}, names, teams)
	r.frame(5000, nil)
	r.drop()
	r.begin(3, 6000, 64, []string{"1"}, names, teams)
	r.frame(6000, nil)
	r.end(4, "T", 6100)
	r.begin(5, 7000, 64, []string{"1"}, names, teams)
	r.frame(7000, nil)
	r.end(5, "T", 7010)
	// The next round start commits a round still in its tail.
	r.begin(6, 7020, 64, []string{"1"}, names, teams)
	out := r.result(Demo{Map: "de_test", TickRate: 64, Rounds: []Round{{Number: 1}, {Number: 5}}})
	if len(out.Rounds) != 2 || out.Rounds[0].Number != 1 || out.Rounds[1].Number != 5 || out.Map != "de_test" || out.Version != ReplayVersion {
		t.Fatalf("only normalized rounds are kept: %+v", out.Rounds)
	}
}

func TestReplayGeometryHelpers(t *testing.T) {
	for in, want := range map[float64]int{0: 0, 359.6: 0, -90: 270, 450: 90, math.NaN(): 0, 180.4: 180} {
		if got := normYaw(in); got != want {
			t.Fatalf("normYaw(%v)=%d want %d", in, got, want)
		}
	}
	path := []r3.Vector{}
	for i := 0; i < 100; i++ {
		path = append(path, r3.Vector{X: float64(i) + 1, Y: 1})
	}
	d := downsample(path, 16)
	if len(d) != 16 || d[0][0] != 1 || d[15][0] != 100 {
		t.Fatalf("downsample %v", d)
	}
	if len(downsample(path[:3], 16)) != 3 {
		t.Fatal("short paths are kept")
	}
	r := newRecorder()
	r.visit(10, 10)
	r.visit(20, 20)
	r.visit(-10, 100)
	out := r.result(Demo{})
	if len(out.Outline) != 4 || out.Bounds.MinX != -10 || out.Bounds.MaxY != 100 || out.Outline[0] != 24 || out.Outline[2] != -24 || out.Outline[3] != 120 {
		t.Fatalf("outline cells %v bounds %+v", out.Outline, out.Bounds)
	}
}

func TestReplayEventsOnlyForTrackedPlayers(t *testing.T) {
	r := newRecorder()
	r.begin(1, 0, 64, []string{"7"}, map[string]string{}, map[string]string{"7": "T"})
	stranger := &common.Player{SteamID64: 9}
	r.shot(stranger, "AK-47", 10)
	r.throw(1, common.EqFlash, stranger, r3.Vector{X: 1, Y: 1}, 10)
	r.detonate(1, r3.Vector{X: 2, Y: 2}, nil, 20)
	r.detonate(99, r3.Vector{X: 2, Y: 2}, nil, 20)
	if len(r.cur.Shots) != 0 || len(r.cur.Grenades) != 0 {
		t.Fatalf("untracked events recorded: %+v", r.cur)
	}
	r.bomb("plant", nil, r3.Vector{X: 5, Y: 6}, "A", 64)
	if len(r.cur.Bomb) != 1 || r.cur.Bomb[0].P != -1 || r.cur.Bomb[0].T != 1 || r.cur.Bomb[0].Pos != [2]float64{5, 6} {
		t.Fatalf("bomb %+v", r.cur.Bomb)
	}
}

func TestWriteReplayRoundtrip(t *testing.T) {
	r := newRecorder()
	r.begin(1, 0, 64, []string{"1"}, map[string]string{"1": "one"}, map[string]string{"1": "CT"})
	r.frame(0, nil)
	r.end(1, "CT", 64)
	path := filepath.Join(t.TempDir(), "x.replay.json.gz")
	size, err := WriteReplay(path, r.result(Demo{Map: "de_x", Rounds: []Round{{Number: 1}}}))
	if err != nil || size <= 0 {
		t.Fatal(err)
	}
	f, _ := os.Open(path)
	defer f.Close()
	info, _ := f.Stat()
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode())
	}
	gz, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	var back Replay
	if err = json.NewDecoder(gz).Decode(&back); err != nil || back.Map != "de_x" || len(back.Rounds) != 1 || back.Players[0].Name != "one" {
		t.Fatalf("roundtrip %v %+v", err, back)
	}
	if _, err = WriteReplay(filepath.Join(t.TempDir(), "missing", "x"), r.result(Demo{})); err == nil {
		t.Fatal("unwritable directory must fail")
	}
}

func TestRealFixtureReplay(t *testing.T) {
	path := os.Getenv("CS2_DEMO_FIXTURE")
	if path == "" {
		t.Skip("set CS2_DEMO_FIXTURE to the pinned public demo after scripts/fetch-fixture.py")
	}
	plain, err := ParseFile(path, DefaultMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	d, rp, err := ParseFileWithReplay(path, DefaultMaxBytes, true)
	if err != nil || rp == nil {
		t.Fatal(err)
	}
	a, _ := json.Marshal(plain)
	b, _ := json.Marshal(d)
	if string(a) != string(b) {
		t.Fatal("replay recording changed the normalized document")
	}
	// Round 10 of the fixture has no observed freeze-time end, so it has no replay.
	if rp.Map != "de_mirage" || rp.TickRate != 64 || rp.SampleHz != 8 || len(rp.Rounds) != 9 || len(rp.Players) != 10 {
		t.Fatalf("fixture replay: map=%s tick=%v rounds=%d players=%d", rp.Map, rp.TickRate, len(rp.Rounds), len(rp.Players))
	}
	index := map[string]int{}
	for i, p := range rp.Players {
		index[p.SteamID] = i
	}
	shots := 0
	for _, round := range rp.Rounds {
		shots += len(round.Shots)
		if len(round.T) < 8*int(round.Duration) || len(round.Tracks) != 10 {
			t.Fatalf("round %d samples=%d duration=%v tracks=%d", round.Number, len(round.T), round.Duration, len(round.Tracks))
		}
		for i := 1; i < len(round.T); i++ {
			if dt := round.T[i] - round.T[i-1]; dt < 0.1 || dt > 0.2 {
				t.Fatalf("round %d irregular sampling %v", round.Number, dt)
			}
		}
		byP := map[int]ReplayTrack{}
		for _, tr := range round.Tracks {
			byP[tr.P] = tr
			for i := range round.T {
				if tr.Yaw[i] < 0 || tr.Yaw[i] > 359 || tr.HP[i] < 0 || tr.HP[i] > 100 {
					t.Fatalf("out of range sample %+v", tr)
				}
				if i > 0 && tr.Alive[i] == 1 && tr.Alive[i-1] == 1 && math.Hypot(tr.X[i]-tr.X[i-1], tr.Y[i]-tr.Y[i-1]) > 80 {
					t.Fatalf("round %d player %d teleported at %v", round.Number, tr.P, round.T[i])
				}
				if i > 0 && tr.Alive[i] == 1 && tr.Alive[i-1] == 0 {
					t.Fatalf("round %d player %d revived", round.Number, tr.P)
				}
			}
		}
		for _, e := range d.Events {
			if e.Round != round.Number || e.Type != "kill" || e.RoundTime == nil {
				continue
			}
			tr := byP[index[e.VictimID]]
			before, after := -1, -1
			for i, ts := range round.T {
				if ts <= *e.RoundTime-0.2 {
					before = tr.Alive[i]
				}
				if after < 0 && ts >= *e.RoundTime+0.2 {
					after = tr.Alive[i]
				}
			}
			if before != 1 || after != 0 {
				t.Fatalf("round %d kill at %v: alive before=%d after=%d", round.Number, *e.RoundTime, before, after)
			}
		}
	}
	if shots == 0 || len(rp.Outline) < 1000 || rp.Bounds == nil {
		t.Fatalf("shots=%d outline=%d", shots, len(rp.Outline))
	}
	size, err := WriteReplay(filepath.Join(t.TempDir(), "r.json.gz"), rp)
	if err != nil || size > 600_000 {
		t.Fatalf("replay size %d err %v", size, err)
	}
	_, again, err := ParseFileWithReplay(path, DefaultMaxBytes, true)
	x, _ := json.Marshal(rp)
	y, _ := json.Marshal(again)
	if err != nil || string(x) != string(y) {
		t.Fatal("replay output must be deterministic")
	}
}
