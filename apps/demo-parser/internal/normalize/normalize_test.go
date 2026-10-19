package normalize

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

func roundBuilder() *builder {
	b := newBuilder()
	b.started = true
	b.start(1, []Player{{SteamID: "1", Name: "one"}, {SteamID: "2", Name: "two"}}, []string{"CT", "T"})
	return b
}
func TestCompleteDeterministic(t *testing.T) {
	build := func() Demo {
		b := roundBuilder()
		hs := true
		damage := 40
		b.add(Event{Type: "damage", Tick: 4, AttackerID: "1", VictimID: "2", AttackerTeam: "CT", VictimTeam: "T", HealthDamage: &damage})
		b.add(Event{Type: "kill", Tick: 5, AttackerID: "1", VictimID: "2", AttackerTeam: "CT", VictimTeam: "T", Headshot: &hs})
		b.end(6, "CT")
		b.finished = true
		return b.result()
	}
	a, c := build(), build()
	if !reflect.DeepEqual(a, c) || !a.Complete || !a.Completeness.Damage || len(a.Events) != 3 {
		t.Fatal(a)
	}
	for _, e := range a.Events {
		if len(e.ID) != 35 || e.Round != 1 {
			t.Fatal(e)
		}
	}
}
func TestPartialAndPostRoundExcluded(t *testing.T) {
	b := roundBuilder()
	hs := false
	b.add(Event{Type: "kill", Tick: 1, VictimID: "2", Headshot: &hs})
	b.end(2, "T")
	b.add(Event{Type: "kill", Tick: 3, VictimID: "2", Headshot: &hs})
	b.start(2, []Player{{SteamID: "1"}, {SteamID: "2"}}, []string{"CT", "T"})
	b.add(Event{Type: "kill", Tick: 4, VictimID: "2", Headshot: &hs})
	b.finished = true
	d := b.result()
	if d.Complete || d.Completeness.Kills || len(d.Rounds) != 1 || len(d.Events) != 2 {
		t.Fatal(d)
	}
}
func TestDamageUsesHealthTakenNotArmorOrOverkill(t *testing.T) {
	b := roundBuilder()
	b.hurt(events.PlayerHurt{Player: &common.Player{SteamID64: 2, Team: common.TeamTerrorists}, Attacker: &common.Player{SteamID64: 1, Team: common.TeamCounterTerrorists}, HealthDamage: 150, HealthDamageTaken: 5, ArmorDamageTaken: 80}, 1)
	if *b.pending[0].HealthDamage != 5 {
		t.Fatal(b.pending)
	}
	b.hurt(events.PlayerHurt{Player: &common.Player{SteamID64: 2}, HealthDamageTaken: 150}, 2)
	if *b.pending[1].HealthDamage != 100 || !b.dirty {
		t.Fatal("damage not bounded")
	}
}
func TestDuplicateRoundsAndDrawExcluded(t *testing.T) {
	b := roundBuilder()
	b.end(1, "CT")
	b.start(1, nil, nil)
	if b.active != nil {
		t.Fatal("duplicate round")
	}
	b.start(2, nil, nil)
	b.end(3, "spectator")
	b.finished = true
	d := b.result()
	if d.Complete || len(d.Rounds) != 1 {
		t.Fatal(d)
	}
}
func TestConservativeFlags(t *testing.T) {
	for _, kind := range []string{"no-start", "no-finish", "warning", "pov", "gap"} {
		t.Run(kind, func(t *testing.T) {
			b := roundBuilder()
			b.end(1, "CT")
			b.finished = true
			switch kind {
			case "no-start":
				b.started = false
			case "no-finish":
				b.finished = false
			case "warning":
				b.dirty = true
			case "pov":
				b.pov = true
			case "gap":
				b.start(3, nil, nil)
				b.end(3, "CT")
			}
			if d := b.result(); d.Complete || d.Completeness.Rounds {
				t.Fatal(d)
			}
		})
	}
}
func TestWorldAndMissingVictim(t *testing.T) {
	b := roundBuilder()
	hs := false
	b.add(Event{Type: "kill", Tick: 1, VictimID: "2", Headshot: &hs})
	if len(b.pending) != 1 {
		t.Fatal("world kill missing")
	}
	b.add(Event{Type: "kill", Tick: 2, Headshot: &hs})
	if len(b.pending) != 1 || !b.dirty {
		t.Fatal("unknown victim accepted")
	}
}
func TestCapsAndInvalidInput(t *testing.T) {
	dir := t.TempDir()
	for i, data := range []string{"", "HL2DEMO\x00", "PBDEMS2\x00", "PBDEMS2\x00" + strings.Repeat("\x00", 40), "this is not a demo"} {
		p := filepath.Join(dir, string(rune('a'+i))+".dem")
		os.WriteFile(p, []byte(data), 0600)
		if _, err := ParseFile(p, DefaultMaxBytes); err == nil {
			t.Fatal("corruption succeeded", i)
		}
	}
	p := filepath.Join(dir, "large.dem")
	os.WriteFile(p, make([]byte, 128), 0600)
	if _, err := ParseFile(p, 127); err == nil {
		t.Fatal("cap")
	}
	if _, err := ParseFile(p, MaxBytes+1); err == nil {
		t.Fatal("max cap")
	}
	if _, err := ParseFile(dir, DefaultMaxBytes); err == nil {
		t.Fatal("directory")
	}
	b := roundBuilder()
	b.totalEvents = MaxEvents
	b.add(Event{Type: "kill", Tick: 1, VictimID: "2"})
	if b.limitErr == nil {
		t.Fatal("event cap")
	}
}
func TestSharedNormalizedFixture(t *testing.T) {
	for _, name := range []string{"normalized-demo.json", "normalized-demo-enriched.json"} {
		t.Run(name, func(t *testing.T) { roundTripFixture(t, name) })
	}
}
func roundTripFixture(t *testing.T, name string) {
	data, err := os.ReadFile("../../../../packages/contracts/fixtures/" + name)
	if err != nil {
		t.Fatal(err)
	}
	var d Demo
	if err = json.Unmarshal(data, &d); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var original, roundTrip any
	json.Unmarshal(data, &original)
	json.Unmarshal(encoded, &roundTrip)
	if !reflect.DeepEqual(original, roundTrip) {
		t.Fatalf("shared contract fixture does not roundtrip: %s", encoded)
	}
}

func TestPublicCS2Fixture(t *testing.T) {
	path := os.Getenv("CS2_DEMO_FIXTURE")
	if path == "" {
		t.Skip("set CS2_DEMO_FIXTURE to the pinned public demo after scripts/fetch-fixture.py")
	}
	d, err := ParseFile(path, DefaultMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if d.Map != "de_mirage" || len(d.Players) != 10 || len(d.Rounds) != 10 || len(d.Events) != 1760 || !d.Complete || d.TickRate != 64 {
		t.Fatalf("pinned public fixture changed: map=%s players=%d rounds=%d events=%d complete=%v", d.Map, len(d.Players), len(d.Rounds), len(d.Events), d.Complete)
	}
	counts := map[string]int{}
	ids := map[string]bool{}
	for _, e := range d.Events {
		counts[e.Type]++
		if ids[e.ID] {
			t.Fatal("ID collision")
		}
		ids[e.ID] = true
	}
	if counts["kill"] != 62 || counts["damage"] != 254 || counts["round_end"] != 10 || counts["shot"] != 1159 || counts["grenade"] != 195 || counts["flashed"] != 71 || counts["bomb"] != 9 {
		t.Fatal(counts)
	}
	// Every gun hit lands on the same tick as a recorded shot by the same shooter and weapon.
	shots := map[string]bool{}
	for _, e := range d.Events {
		if e.Type == "shot" {
			shots[fmt.Sprint(e.ShooterID, e.Weapon, e.Tick)] = true
		}
	}
	gunHits := 0
	for _, e := range d.Events {
		switch e.Type {
		case "kill":
			if e.Weapon == "" || e.RoundTime == nil || e.VictimPlace == "" || e.VictimPos == nil || e.Distance == nil || e.VictimGrenades == nil {
				t.Fatalf("kill not enriched: %+v", e)
			}
		case "damage":
			if e.Hitgroup == "" || e.ArmorDamage == nil {
				t.Fatalf("damage not enriched: %+v", e)
			}
			if e.AttackerID != "" && shots[fmt.Sprint(e.AttackerID, e.Weapon, e.Tick)] {
				gunHits++
			}
		}
		if e.RoundTime != nil && (*e.RoundTime < 0 || *e.RoundTime > 200) {
			t.Fatalf("implausible round time %+v", e)
		}
	}
	if gunHits != 199 {
		t.Fatal("gun hits", gunHits)
	}
	for _, r := range d.Rounds[:9] {
		if len(r.Economy) != len(r.Participants) || r.Reason == "" {
			t.Fatalf("round %d economy/reason missing", r.Number)
		}
	}
	again, err := ParseFile(path, DefaultMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(d, again) {
		t.Fatal("real fixture output is not deterministic")
	}
}

func TestEnrichedCombatEvents(t *testing.T) {
	b := roundBuilder()
	b.tickRate = 64
	b.freezeEnd = 100
	ct := &common.Player{SteamID64: 1, Team: common.TeamCounterTerrorists, FlashDuration: 2.5}
	tt := &common.Player{SteamID64: 2, Team: common.TeamTerrorists}
	ak := &common.Equipment{Type: common.EqAK47}
	b.hurt(events.PlayerHurt{Player: ct, Attacker: tt, HealthDamageTaken: 27, ArmorDamageTaken: 120, Weapon: ak, HitGroup: events.HitGroupChest}, 164)
	dmg := b.pending[0]
	if dmg.Weapon != "AK-47" || dmg.Hitgroup != "chest" || *dmg.ArmorDamage != 100 || dmg.RoundTime == nil || *dmg.RoundTime != 1 {
		t.Fatalf("%+v", dmg)
	}
	// Positions on entity-less test players degrade to unknown instead of panicking.
	k := b.kill(events.Kill{Killer: tt, Victim: ct, Weapon: &common.Equipment{Type: common.EqM4A1}, IsHeadshot: true, PenetratedObjects: 1, Distance: 12.345, AssistedFlash: true}, 200)
	if k.Weapon != "M4A1-S" || !*k.Penetrated || !*k.FlashAssist || *k.NoScope || *k.Distance != 12.3 || k.AttackerPos != nil || k.VictimPlace != "" {
		t.Fatalf("%+v", k)
	}
	b.add(k)
	if *b.pending[1].RoundTime != 1.56 {
		t.Fatal(*b.pending[1].RoundTime)
	}
	// Events before freeze end get no round time.
	b.add(Event{Type: "kill", Tick: 50, AttackerID: "2", VictimID: "1", Headshot: boolp(false)})
	if b.pending[2].RoundTime != nil {
		t.Fatal("pre-freeze round time")
	}
	b.flashed(ct, tt, 300)
	if f := b.pending[3]; f.Type != "flashed" || *f.DurationSeconds != 2.5 || f.AttackerID != "2" || f.VictimID != "1" || f.RoundTime != nil {
		t.Fatalf("%+v", f)
	}
	b.flashed(tt, ct, 301) // zero duration: not a flash
	if len(b.pending) != 4 {
		t.Fatal("zero flash recorded")
	}
	b.bomb("plant", events.BombEvent{Player: tt, Site: events.BombsiteB}, 400)
	if bm := b.pending[4]; bm.Site != "B" || bm.PlayerID != "2" || bm.Action != "plant" {
		t.Fatalf("%+v", bm)
	}
	b.end(500, "T", "bomb_exploded")
	b.finished = true
	d := b.result()
	if d.Rounds[0].Reason != "bomb_exploded" || d.TickRate != 64 || d.Events[len(d.Events)-1].Reason != "bomb_exploded" {
		t.Fatalf("%+v", d.Rounds)
	}
}

func TestShotsOnlyForGuns(t *testing.T) {
	b := roundBuilder()
	p := &common.Player{SteamID64: 1, Team: common.TeamCounterTerrorists}
	for _, eq := range []common.EquipmentType{common.EqKnife, common.EqHE, common.EqFlash, common.EqZeus, common.EqBomb, common.EqUnknown} {
		b.shot(events.WeaponFire{Shooter: p, Weapon: &common.Equipment{Type: eq}}, 1)
	}
	b.shot(events.WeaponFire{Shooter: p}, 1)
	b.shot(events.WeaponFire{Weapon: &common.Equipment{Type: common.EqAK47}}, 1)
	if len(b.pending) != 0 {
		t.Fatalf("non-gun shot recorded: %+v", b.pending)
	}
	for _, eq := range []common.EquipmentType{common.EqGlock, common.EqMP9, common.EqNova, common.EqAWP} {
		b.shot(events.WeaponFire{Shooter: p, Weapon: &common.Equipment{Type: eq}}, 2)
	}
	if len(b.pending) != 4 || b.pending[0].ShooterID != "1" || b.pending[0].ShooterTeam != "CT" || b.pending[2].Weapon != "Nova" {
		t.Fatalf("%+v", b.pending)
	}
	b.grenade(common.EqIncendiary, p, r3.Vector{X: 1.26, Y: 2, Z: 3}, 3)
	if g := b.pending[4]; g.Grenade != "molotov" || g.Pos.X != 1.3 || g.ThrowerID != "1" {
		t.Fatalf("%+v", g)
	}
	b.grenade(common.EqHE, nil, r3.Vector{}, 3)
	if len(b.pending) != 5 {
		t.Fatal("thrower-less grenade recorded")
	}
	// A shooter outside the round's participants is added and marks the demo dirty.
	b.shot(events.WeaponFire{Shooter: &common.Player{SteamID64: 9, Team: common.TeamTerrorists}, Weapon: &common.Equipment{Type: common.EqAK47}}, 4)
	if !b.dirty {
		t.Fatal("unknown shooter accepted silently")
	}
}

func TestEconomyRequiresActiveRound(t *testing.T) {
	b := newBuilder()
	b.freeze(10, nil)
	if b.freezeEnd != -1 {
		t.Fatal("freeze outside round")
	}
	b = roundBuilder()
	b.freeze(10, []*common.Player{nil, {SteamID64: 0}, {SteamID64: 3, IsBot: true}})
	if b.freezeEnd != 10 || len(b.active.Economy) != 0 {
		t.Fatal(b.active.Economy)
	}
	b.end(20, "CT")
	b.start(2, []Player{{SteamID: "1"}, {SteamID: "2"}}, []string{"CT", "T"})
	if b.freezeEnd != -1 {
		t.Fatal("freeze end leaked into next round")
	}
}
