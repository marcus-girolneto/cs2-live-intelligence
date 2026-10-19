package normalize

import (
	"math"
	"sort"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

// Enrichment helpers (cs2live.2). Every value read from live entities goes through safe so a
// missing property degrades to "unknown" instead of failing the whole parse.

func round1(v float64) float64 { return math.Round(v*10) / 10 }
func round2(v float64) float64 { return math.Round(v*100) / 100 }

func safe[T any](fallback T, read func() T) (out T) {
	defer func() {
		if recover() != nil {
			out = fallback
		}
	}()
	return read()
}

// roundTime is seconds since the active round's freeze time ended, or nil when unknown.
func (b *builder) roundTime(tick int) *float64 {
	if b.freezeEnd < 0 || b.tickRate <= 0 || tick < b.freezeEnd {
		return nil
	}
	v := round2(float64(tick-b.freezeEnd) / b.tickRate)
	return &v
}

func vecOf(v r3.Vector) *Vec {
	if v.X == 0 && v.Y == 0 && v.Z == 0 {
		return nil
	}
	if math.IsNaN(v.X) || math.IsNaN(v.Y) || math.IsNaN(v.Z) || math.IsInf(v.X, 0) || math.IsInf(v.Y, 0) || math.IsInf(v.Z, 0) {
		return nil
	}
	return &Vec{round1(v.X), round1(v.Y), round1(v.Z)}
}

func playerPos(p *common.Player) *Vec {
	if p == nil {
		return nil
	}
	return safe(nil, func() *Vec { return vecOf(p.Position()) })
}

func playerPlace(p *common.Player) string {
	if p == nil {
		return ""
	}
	return truncate(safe("", p.LastPlaceName), 64)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

// weaponName is the display name of a weapon; the silenced M4 is labelled M4A1-S.
func weaponName(e *common.Equipment) string {
	if e == nil || e.Type == common.EqUnknown {
		return ""
	}
	if e.Type == common.EqM4A1 {
		return "M4A1-S"
	}
	return truncate(e.Type.String(), 64)
}

// isGun reports firearms (pistols, SMGs, heavy, rifles). Knife, Zeus, grenades and C4 are excluded.
func isGun(e *common.Equipment) bool {
	if e == nil {
		return false
	}
	switch e.Type.Class() {
	case common.EqClassPistols, common.EqClassSMG, common.EqClassHeavy, common.EqClassRifle:
		return true
	}
	return false
}

func hitgroupName(h events.HitGroup) string {
	switch h {
	case events.HitGroupHead:
		return "head"
	case events.HitGroupChest:
		return "chest"
	case events.HitGroupStomach:
		return "stomach"
	case events.HitGroupLeftArm:
		return "left_arm"
	case events.HitGroupRightArm:
		return "right_arm"
	case events.HitGroupLeftLeg:
		return "left_leg"
	case events.HitGroupRightLeg:
		return "right_leg"
	case events.HitGroupNeck:
		return "neck"
	case events.HitGroupGeneric:
		return "generic"
	}
	return ""
}

func reasonName(r events.RoundEndReason) string {
	switch r {
	case events.RoundEndReasonTargetBombed:
		return "bomb_exploded"
	case events.RoundEndReasonBombDefused:
		return "bomb_defused"
	case events.RoundEndReasonCTWin:
		return "t_eliminated"
	case events.RoundEndReasonTerroristsWin:
		return "ct_eliminated"
	case events.RoundEndReasonTargetSaved:
		return "time_ran_out"
	case events.RoundEndReasonTerroristsSurrender:
		return "t_surrender"
	case events.RoundEndReasonCTSurrender:
		return "ct_surrender"
	case events.RoundEndReasonDraw:
		return "draw"
	}
	return ""
}

func grenadeName(t common.EquipmentType) string {
	switch t {
	case common.EqFlash:
		return "flash"
	case common.EqHE:
		return "he"
	case common.EqSmoke:
		return "smoke"
	case common.EqMolotov, common.EqIncendiary:
		return "molotov"
	case common.EqDecoy:
		return "decoy"
	}
	return ""
}

func boolp(v bool) *bool { return &v }
func intp(v int) *int    { return &v }

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func (b *builder) kill(e events.Kill, tick int) Event {
	hs := e.IsHeadshot
	ev := Event{Type: "kill", Tick: tick, AttackerID: b.player(e.Killer), VictimID: b.player(e.Victim), AttackerTeam: playerTeam(e.Killer), VictimTeam: playerTeam(e.Victim), Headshot: &hs}
	ev.Weapon = weaponName(e.Weapon)
	if e.Assister != nil && e.Assister != e.Killer {
		ev.AssisterID = b.player(e.Assister)
	}
	ev.FlashAssist = boolp(e.AssistedFlash)
	ev.Penetrated = boolp(e.PenetratedObjects > 0)
	ev.NoScope = boolp(e.NoScope)
	ev.ThroughSmoke = boolp(e.ThroughSmoke)
	ev.AttackerBlind = boolp(e.AttackerBlind)
	if d := float64(e.Distance); d > 0 && !math.IsInf(d, 0) && !math.IsNaN(d) {
		v := round1(d)
		ev.Distance = &v
	}
	if e.Killer != nil && e.Killer != e.Victim {
		ev.AttackerPos = playerPos(e.Killer)
		ev.AttackerPlace = playerPlace(e.Killer)
	}
	ev.VictimPos = playerPos(e.Victim)
	ev.VictimPlace = playerPlace(e.Victim)
	ev.VictimGrenades = grenadesHeld(e.Victim)
	return ev
}

// grenadesHeld lists the grenade types in a player's inventory (sorted), nil when unreadable.
func grenadesHeld(p *common.Player) *[]string {
	if p == nil {
		return nil
	}
	weapons := safe(nil, p.Weapons)
	if weapons == nil {
		return nil
	}
	out := []string{}
	for _, w := range weapons {
		if w == nil {
			continue
		}
		if name := grenadeName(w.Type); name != "" {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return &out
}

func (b *builder) shot(e events.WeaponFire, tick int) {
	if e.Shooter == nil || !isGun(e.Weapon) {
		return
	}
	id := b.player(e.Shooter)
	if id == "" {
		return
	}
	b.add(Event{Type: "shot", Tick: tick, ShooterID: id, ShooterTeam: playerTeam(e.Shooter), Weapon: weaponName(e.Weapon)})
}

func (b *builder) grenade(kind common.EquipmentType, thrower *common.Player, pos r3.Vector, tick int) {
	name := grenadeName(kind)
	if name == "" || thrower == nil {
		return
	}
	id := b.player(thrower)
	if id == "" {
		return
	}
	b.add(Event{Type: "grenade", Tick: tick, ThrowerID: id, ThrowerTeam: playerTeam(thrower), Grenade: name, Pos: vecOf(pos), Place: playerPlace(thrower)})
}

func (b *builder) flashed(victim, attacker *common.Player, tick int) {
	// Dead players are sometimes reported as flashed; only living victims count. Without a pawn
	// entity liveness is unknown (v5 would report "dead"), so the flash is kept.
	if victim == nil || attacker == nil {
		return
	}
	if !safe(true, func() bool { return victim.PlayerPawnEntity() == nil || victim.IsAlive() }) {
		return
	}
	duration := safe(0.0, func() float64 { return float64(victim.FlashDuration) })
	if !(duration > 0) || math.IsInf(duration, 0) {
		return
	}
	if duration > 10 {
		duration = 10
	}
	victimID, attackerID := b.player(victim), b.player(attacker)
	if victimID == "" || attackerID == "" {
		return
	}
	d := round2(duration)
	b.add(Event{Type: "flashed", Tick: tick, AttackerID: attackerID, VictimID: victimID, AttackerTeam: playerTeam(attacker), VictimTeam: playerTeam(victim), DurationSeconds: &d})
}

func (b *builder) bomb(action string, e events.BombEvent, tick int) {
	ev := Event{Type: "bomb", Tick: tick, Action: action}
	if e.Player != nil {
		ev.PlayerID = b.player(e.Player)
	}
	if e.Site == events.BombsiteA || e.Site == events.BombsiteB {
		ev.Site = string(rune(e.Site))
	}
	b.add(ev)
}

// freeze records the freeze-time end tick and samples each participant's economy.
func (b *builder) freeze(tick int, players []*common.Player) {
	if b.active == nil {
		return
	}
	b.freezeEnd = tick
	economy := []Economy{}
	for _, pl := range players {
		if pl == nil || pl.SteamID64 == 0 || pl.IsBot {
			continue
		}
		id := b.player(pl)
		if id == "" {
			continue
		}
		row := Economy{SteamID: id, Team: playerTeam(pl)}
		row.EquipmentValue = clampInt(safe(0, pl.EquipmentValueCurrent), 0, 1<<20)
		row.Money = intp(clampInt(safe(0, pl.Money), 0, 1<<20))
		row.Armor = intp(clampInt(safe(0, pl.Armor), 0, 100))
		row.Helmet = boolp(safe(false, pl.HasHelmet))
		for _, w := range safe(nil, pl.Weapons) {
			if w == nil {
				continue
			}
			switch w.Type.Class() {
			case common.EqClassSMG, common.EqClassHeavy, common.EqClassRifle:
				if row.Primary == "" {
					row.Primary = weaponName(w)
				}
			}
		}
		economy = append(economy, row)
		if len(economy) >= 128 {
			break
		}
	}
	sortEconomy(economy)
	b.active.Economy = economy
}
