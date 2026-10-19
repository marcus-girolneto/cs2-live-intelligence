// Package normalize converts parser events to the frozen NormalizedDemo wire contract.
package normalize

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
	dem "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

const Version = "demoinfocs-golang/v4@v4.5.1+cs2live.3"
const DefaultMaxBytes int64 = 256 << 20
const MaxBytes int64 = 512 << 20
const MaxEvents = 1_000_000

type Completeness struct {
	Kills  bool `json:"kills"`
	Damage bool `json:"damage"`
	Rounds bool `json:"rounds"`
}
type Player struct {
	SteamID string `json:"steamId"`
	Name    string `json:"name,omitempty"`
}
type Round struct {
	Number       int      `json:"number"`
	Participants []string `json:"participants"`
	Winner       string   `json:"winner,omitempty"`
	Reason       string   `json:"reason,omitempty"`
	// Economy is sampled for every known participant when freeze time ends.
	Economy []Economy `json:"economy,omitempty"`
}

// Economy is one player's state at freeze-time end.
type Economy struct {
	SteamID        string `json:"steamId"`
	Team           string `json:"team,omitempty"`
	EquipmentValue int    `json:"equipmentValue"`
	Money          *int   `json:"money,omitempty"`
	Primary        string `json:"primary,omitempty"`
	Armor          *int   `json:"armor,omitempty"`
	Helmet         *bool  `json:"helmet,omitempty"`
}

// Vec is a world position rounded to 0.1 units.
type Vec struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}
type Event struct {
	ID           string `json:"id"`
	Tick         int    `json:"tick"`
	Round        int    `json:"round"`
	Type         string `json:"type"`
	AttackerID   string `json:"attackerId,omitempty"`
	VictimID     string `json:"victimId,omitempty"`
	AttackerTeam string `json:"attackerTeam,omitempty"`
	VictimTeam   string `json:"victimTeam,omitempty"`
	Headshot     *bool  `json:"headshot,omitempty"`
	HealthDamage *int   `json:"healthDamage,omitempty"`
	Winner       string `json:"winner,omitempty"`
	// Enrichment (cs2live.2+). Every field is optional and omitted when unknown.
	Weapon          string   `json:"weapon,omitempty"`
	AssisterID      string   `json:"assisterId,omitempty"`
	FlashAssist     *bool    `json:"flashAssist,omitempty"`
	Penetrated      *bool    `json:"penetrated,omitempty"`
	NoScope         *bool    `json:"noScope,omitempty"`
	ThroughSmoke    *bool    `json:"throughSmoke,omitempty"`
	AttackerBlind   *bool    `json:"attackerBlind,omitempty"`
	Distance        *float64 `json:"distance,omitempty"`
	AttackerPos     *Vec     `json:"attackerPos,omitempty"`
	VictimPos       *Vec     `json:"victimPos,omitempty"`
	AttackerPlace   string   `json:"attackerPlace,omitempty"`
	VictimPlace     string   `json:"victimPlace,omitempty"`
	ArmorDamage     *int     `json:"armorDamage,omitempty"`
	Hitgroup        string   `json:"hitgroup,omitempty"`
	Reason          string   `json:"reason,omitempty"`
	ShooterID       string   `json:"shooterId,omitempty"`
	ShooterTeam     string   `json:"shooterTeam,omitempty"`
	ThrowerID       string   `json:"throwerId,omitempty"`
	ThrowerTeam     string   `json:"throwerTeam,omitempty"`
	Grenade         string   `json:"grenade,omitempty"`
	Pos             *Vec     `json:"pos,omitempty"`
	Place           string   `json:"place,omitempty"`
	DurationSeconds *float64 `json:"durationSeconds,omitempty"`
	Action          string   `json:"action,omitempty"`
	PlayerID        string   `json:"playerId,omitempty"`
	Site            string   `json:"site,omitempty"`
	RoundTime       *float64 `json:"roundTime,omitempty"`
	// VictimGrenades lists the grenades the victim still carried when killed (cs2live.3+;
	// absent when the inventory could not be read).
	VictimGrenades *[]string `json:"victimGrenades,omitempty"`
}
type Demo struct {
	SchemaVersion string       `json:"schemaVersion"`
	ParserVersion string       `json:"parserVersion"`
	Map           string       `json:"map,omitempty"`
	Complete      bool         `json:"complete"`
	Completeness  Completeness `json:"completeness"`
	Players       []Player     `json:"players"`
	Rounds        []Round      `json:"rounds"`
	TickRate      float64      `json:"tickRate,omitempty"`
	Events        []Event      `json:"events"`
}
type builder struct {
	doc                           Demo
	players                       map[string]Player
	active                        *Round
	pending                       []Event
	started, finished, dirty, pov bool
	lastNumber                    int
	totalEvents                   int
	limitErr                      error
	// freezeEnd is the tick at which the active round's freeze time ended (-1 = unknown).
	freezeEnd int
	tickRate  float64
	// rec samples replay data when a replay artifact was requested (nil otherwise).
	rec *recorder
}

func newBuilder() *builder {
	return &builder{doc: Demo{SchemaVersion: "1.0", ParserVersion: Version, Players: []Player{}, Rounds: []Round{}, Events: []Event{}}, players: map[string]Player{}, pending: []Event{}, freezeEnd: -1}
}
func team(t common.Team) string {
	switch t {
	case common.TeamCounterTerrorists:
		return "CT"
	case common.TeamTerrorists:
		return "T"
	case common.TeamSpectators:
		return "spectator"
	default:
		return "unassigned"
	}
}
func (b *builder) player(p *common.Player) string {
	if p == nil {
		return ""
	}
	if p.SteamID64 == 0 || p.IsBot {
		b.dirty = true
		return ""
	}
	id := strconv.FormatUint(p.SteamID64, 10)
	name := []rune(strings.ToValidUTF8(p.Name, "�"))
	units, keep := 0, 0
	for _, r := range name {
		size := 1
		if r > 0xFFFF {
			size = 2
		}
		if units+size > 128 {
			break
		}
		units += size
		keep++
	}
	name = name[:keep]
	if _, ok := b.players[id]; !ok && len(b.players) >= 128 {
		b.limitErr = errors.New("participant limit exceeded")
		return ""
	}
	b.players[id] = Player{id, string(name)}
	return id
}
func (b *builder) start(number int, participants []Player, teams []string) {
	if b.active != nil {
		b.dirty = true
	}
	b.active = nil
	b.pending = []Event{}
	b.freezeEnd = -1
	if b.rec != nil {
		b.rec.drop()
	}
	if number < 1 || number > 1000 {
		b.limitErr = errors.New("round limit exceeded")
		return
	}
	if number != b.lastNumber+1 {
		b.dirty = true
	}
	if number <= b.lastNumber {
		return
	}
	ids := map[string]bool{}
	ct, t := false, false
	for i, p := range participants {
		if p.SteamID == "" {
			b.dirty = true
			continue
		}
		if i < len(teams) {
			ct = ct || teams[i] == "CT"
			t = t || teams[i] == "T"
		}
		ids[p.SteamID] = true
		b.players[p.SteamID] = p
	}
	if len(ids) > 128 || len(b.players) > 128 {
		b.limitErr = errors.New("participant limit exceeded")
		return
	}
	if !ct || !t {
		b.dirty = true
	}
	list := make([]string, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	sort.Strings(list)
	b.active = &Round{Number: number, Participants: list}
}
func (b *builder) add(e Event) {
	if b.active == nil {
		return
	}
	if e.Tick < 0 {
		b.dirty = true
		return
	}
	if e.VictimID == "" && (e.Type == "kill" || e.Type == "damage") {
		b.dirty = true
		return
	}
	for _, id := range []string{e.AttackerID, e.VictimID, e.ShooterID, e.ThrowerID, e.PlayerID} {
		if id == "" {
			continue
		}
		found := false
		for _, existing := range b.active.Participants {
			if existing == id {
				found = true
				break
			}
		}
		if !found {
			b.active.Participants = append(b.active.Participants, id)
			sort.Strings(b.active.Participants)
			b.dirty = true
		}
	}
	e.Round = b.active.Number
	if e.RoundTime == nil && e.Type != "round_end" && e.Type != "flashed" {
		e.RoundTime = b.roundTime(e.Tick)
	}
	b.totalEvents++
	if b.totalEvents > MaxEvents {
		b.limitErr = errors.New("event limit exceeded")
		return
	}
	b.pending = append(b.pending, e)
}
func (b *builder) end(tick int, winner string, reason ...string) {
	if b.active == nil {
		return
	}
	if winner != "CT" && winner != "T" {
		if b.rec != nil {
			b.rec.drop()
		}
		b.dirty = true
		b.active = nil
		b.pending = []Event{}
		return
	}
	b.active.Winner = winner
	r := ""
	if len(reason) > 0 {
		r = reason[0]
	}
	b.active.Reason = r
	b.add(Event{Type: "round_end", Tick: tick, Winner: winner, Reason: r})
	if b.rec != nil {
		b.rec.end(b.active.Number, winner, tick)
	}
	b.doc.Rounds = append(b.doc.Rounds, *b.active)
	b.doc.Events = append(b.doc.Events, b.pending...)
	b.lastNumber = b.active.Number
	b.active = nil
	b.pending = []Event{}
	b.freezeEnd = -1
}
func (b *builder) result() Demo {
	if b.active != nil {
		b.dirty = true
	}
	for _, p := range b.players {
		b.doc.Players = append(b.doc.Players, p)
	}
	sort.Slice(b.doc.Players, func(i, j int) bool { return b.doc.Players[i].SteamID < b.doc.Players[j].SteamID })
	sort.SliceStable(b.doc.Events, func(i, j int) bool {
		a, c := b.doc.Events[i], b.doc.Events[j]
		if a.Round != c.Round {
			return a.Round < c.Round
		}
		return a.Tick < c.Tick
	})
	// Hash canonical event content and stable ordinal to distinguish repeated identical events.
	for i := range b.doc.Events {
		canonical, _ := json.Marshal(b.doc.Events[i])
		sum := sha256.Sum256(append(canonical, []byte(fmt.Sprintf("#%d", i))...))
		b.doc.Events[i].ID = "ev_" + hex.EncodeToString(sum[:16])
	}
	b.doc.Complete = b.started && b.finished && !b.dirty && !b.pov && len(b.doc.Rounds) > 0
	b.doc.Completeness = Completeness{b.doc.Complete, b.doc.Complete, b.doc.Complete}
	if b.tickRate > 0 && b.tickRate <= 1024 {
		b.doc.TickRate = round1(b.tickRate)
	}
	return b.doc
}

// ParseFile uses a streaming file reader; library entity/protobuf memory still requires a process limit.
func ParseFile(path string, maxBytes int64) (Demo, error) {
	out, _, err := ParseFileWithReplay(path, maxBytes, false)
	return out, err
}

// ParseFileWithReplay also returns the replay artifact when wantReplay is set. The normalized
// document is identical either way.
func ParseFileWithReplay(path string, maxBytes int64, wantReplay bool) (out Demo, replay *Replay, err error) {
	defer func() {
		if r := recover(); r != nil {
			out = Demo{}
			replay = nil
			err = fmt.Errorf("invalid or unsupported demo: %v", r)
		}
	}()
	out, replay, err = parseFile(path, maxBytes, wantReplay)
	return
}

func parseFile(path string, maxBytes int64, wantReplay bool) (out Demo, replay *Replay, err error) {
	if maxBytes <= 0 || maxBytes > MaxBytes {
		return out, nil, errors.New("max-bytes must be between 1 and 536870912")
	}
	f, err := os.Open(path)
	if err != nil {
		return out, nil, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return out, nil, err
	}
	if !info.Mode().IsRegular() {
		return out, nil, errors.New("regular demo file required")
	}
	if info.Size() > maxBytes {
		return out, nil, errors.New("demo exceeds input size limit")
	}
	reader := bufio.NewReader(io.LimitReader(f, maxBytes+1))
	magic, err := reader.Peek(8)
	if err != nil || string(magic) != "PBDEMS2\x00" {
		return out, nil, errors.New("invalid CS2 demo header: expected PBDEMS2")
	}
	p := dem.NewParser(reader)
	defer p.Close()
	if _, err = p.ParseHeader(); err != nil {
		return out, nil, fmt.Errorf("demo header: %w", err)
	}
	b := newBuilder()
	if wantReplay {
		b.rec = newRecorder()
	}
	tick := func() int { return p.GameState().IngameTick() }
	playing := func() bool { gs := p.GameState(); return !gs.IsWarmupPeriod() && gs.IsMatchStarted() && !b.finished }
	markStart := func() {
		if p.GameState().TotalRoundsPlayed() == 0 {
			b.started = true
		}
	}
	p.RegisterEventHandler(func(events.MatchStart) { markStart() })
	p.RegisterEventHandler(func(e events.MatchStartedChanged) {
		if e.NewIsStarted {
			markStart()
		}
	})
	p.RegisterEventHandler(func(events.AnnouncementWinPanelMatch) { b.finished = true })
	p.RegisterEventHandler(func(e events.GamePhaseChanged) {
		if e.NewGamePhase == common.GamePhaseGameEnded || e.NewGamePhase == common.GamePhaseGameOver {
			b.finished = true
		}
	})
	p.RegisterEventHandler(func(events.POVRecordingPlayerDetected) { b.pov = true })
	p.RegisterEventHandler(func(events.ParserWarn) { b.dirty = true })
	p.RegisterEventHandler(func(events.RoundStart) {
		if !playing() {
			return
		}
		participants := []Player{}
		teams := []string{}
		for _, pl := range p.GameState().Participants().Playing() {
			id := b.player(pl)
			if id != "" {
				participants = append(participants, b.players[id])
				teams = append(teams, team(pl.Team))
			}
		}
		b.start(p.GameState().TotalRoundsPlayed()+1, participants, teams)
	})
	p.RegisterEventHandler(func(e events.Kill) {
		if b.active == nil || !playing() {
			return
		}
		b.add(b.kill(e, tick()))
		if b.limitErr != nil {
			p.Cancel()
		}
	})
	b.tickRate = safe(0.0, p.TickRate)
	// cancel stops parsing once a builder limit is hit.
	cancel := func() {
		if b.limitErr != nil {
			p.Cancel()
		}
	}
	live := func() bool { return b.active != nil && playing() }
	p.RegisterEventHandler(func(events.RoundFreezetimeEnd) {
		if !live() {
			return
		}
		if r := safe(0.0, p.TickRate); r > 0 {
			b.tickRate = r
		}
		b.freeze(tick(), p.GameState().Participants().Playing())
		if b.rec != nil && b.active != nil {
			b.recordBegin(tick(), p.GameState().Participants().Playing())
		}
		cancel()
	})
	p.RegisterEventHandler(func(e events.WeaponFire) {
		if live() {
			b.shot(e, tick())
			if b.rec != nil && isGun(e.Weapon) {
				b.rec.shot(e.Shooter, weaponName(e.Weapon), tick())
			}
			cancel()
		}
	})
	if b.rec != nil {
		p.RegisterEventHandler(func(events.FrameDone) {
			b.rec.frame(tick(), safe(nil, p.GameState().Participants().Playing))
		})
		p.RegisterEventHandler(func(e events.GrenadeProjectileThrow) {
			if e.Projectile == nil || !live() {
				return
			}
			kind := safe(common.EqUnknown, func() common.EquipmentType { return e.Projectile.WeaponInstance.Type })
			b.rec.throw(e.Projectile.UniqueID(), kind, e.Projectile.Thrower, safe(r3.Vector{}, e.Projectile.Position), tick())
		})
		p.RegisterEventHandler(func(e events.GrenadeProjectileDestroy) {
			if e.Projectile == nil {
				return
			}
			path := []r3.Vector{}
			for _, t := range e.Projectile.Trajectory2 {
				path = append(path, t.Position)
			}
			b.rec.detonate(e.Projectile.UniqueID(), safe(r3.Vector{}, e.Projectile.Position), path, tick())
		})
	}
	nade := func(e events.GrenadeEvent) {
		if live() {
			b.grenade(e.GrenadeType, e.Thrower, e.Position, tick())
			cancel()
		}
	}
	p.RegisterEventHandler(func(e events.FlashExplode) { nade(e.GrenadeEvent) })
	p.RegisterEventHandler(func(e events.HeExplode) { nade(e.GrenadeEvent) })
	p.RegisterEventHandler(func(e events.SmokeStart) { nade(e.GrenadeEvent) })
	p.RegisterEventHandler(func(e events.DecoyStart) { nade(e.GrenadeEvent) })
	p.RegisterEventHandler(func(e events.InfernoStart) {
		if !live() || e.Inferno == nil {
			return
		}
		thrower := safe(nil, e.Inferno.Thrower)
		pos := safe(r3.Vector{}, func() r3.Vector { return e.Inferno.Entity.Position() })
		b.grenade(common.EqMolotov, thrower, pos, tick())
		cancel()
	})
	p.RegisterEventHandler(func(e events.PlayerFlashed) {
		if live() {
			b.flashed(e.Player, e.Attacker, tick())
			cancel()
		}
	})
	p.RegisterEventHandler(func(e events.BombPlanted) {
		if live() {
			b.bomb("plant", e.BombEvent, tick())
			if b.rec != nil {
				b.recordBomb("plant", e.BombEvent, safe(r3.Vector{}, func() r3.Vector { return p.GameState().Bomb().Position() }), tick())
			}
			cancel()
		}
	})
	p.RegisterEventHandler(func(e events.BombDefused) {
		if live() {
			b.bomb("defuse", e.BombEvent, tick())
			if b.rec != nil {
				b.recordBomb("defuse", e.BombEvent, safe(r3.Vector{}, func() r3.Vector { return p.GameState().Bomb().Position() }), tick())
			}
			cancel()
		}
	})
	p.RegisterEventHandler(func(e events.BombExplode) {
		if live() {
			b.bomb("explode", e.BombEvent, tick())
			if b.rec != nil {
				b.recordBomb("explode", e.BombEvent, safe(r3.Vector{}, func() r3.Vector { return p.GameState().Bomb().Position() }), tick())
			}
			cancel()
		}
	})
	p.RegisterEventHandler(func(e events.PlayerHurt) {
		if b.active == nil || !playing() {
			return
		}
		b.hurt(e, tick())
		if b.limitErr != nil {
			p.Cancel()
		}
	})
	p.RegisterEventHandler(func(e events.RoundEnd) {
		if b.active == nil {
			return
		}
		if p.GameState().IsWarmupPeriod() {
			if b.rec != nil {
				b.rec.drop()
			}
			b.active = nil
			b.pending = []Event{}
			b.dirty = true
			return
		}
		b.end(tick(), team(e.Winner), reasonName(e.Reason))
		if b.limitErr != nil {
			p.Cancel()
		}
	})
	if err = p.ParseToEnd(); err != nil {
		if b.limitErr != nil {
			return out, nil, b.limitErr
		}
		return out, nil, fmt.Errorf("demo parse: %w", err)
	}
	if b.limitErr != nil {
		return out, nil, b.limitErr
	}
	if len(b.doc.Rounds) == 0 {
		return out, nil, errors.New("demo contains no fully observed valid live rounds")
	}
	b.doc.Map = p.Header().MapName
	doc := b.result()
	if b.rec != nil {
		replay = b.rec.result(doc)
	}
	return doc, replay, nil
}
func playerTeam(p *common.Player) string {
	if p == nil {
		return ""
	}
	return team(p.Team)
}

func (b *builder) hurt(e events.PlayerHurt, tick int) {
	damage := e.HealthDamageTaken
	if damage < 0 {
		damage = 0
		b.dirty = true
	}
	if damage > 100 {
		damage = 100
		b.dirty = true
	}
	ev := Event{Type: "damage", Tick: tick, AttackerID: b.player(e.Attacker), VictimID: b.player(e.Player), AttackerTeam: playerTeam(e.Attacker), VictimTeam: playerTeam(e.Player), HealthDamage: &damage}
	ev.ArmorDamage = intp(clampInt(e.ArmorDamageTaken, 0, 100))
	ev.Weapon = weaponName(e.Weapon)
	ev.Hitgroup = hitgroupName(e.HitGroup)
	if e.Attacker != nil && e.Attacker != e.Player {
		ev.AttackerPlace = playerPlace(e.Attacker)
	}
	b.add(ev)
}

func sortEconomy(rows []Economy) {
	sort.Slice(rows, func(i, j int) bool { return rows[i].SteamID < rows[j].SteamID })
}
