package normalize

import (
	"math"
	"strconv"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
)

// Aim is the attacker's view at full tick rate for the 0.5 s before the first shot of an
// engagement (cs2live.5+), attached to the first gun damage or kill of that engagement. It lets
// the analytics measure flick speed and how exactly the crosshair settled on the target. Angles
// are degrees (2 decimals); pitch is positive looking down, as in the game.
type Aim struct {
	FirstShotTick int `json:"firstShotTick"`
	// Dt are tick offsets of the samples relative to FirstShotTick (≤ 0, ascending).
	Dt    []int     `json:"dt"`
	Yaw   []float64 `json:"yaw"`
	Pitch []float64 `json:"pitch"`
	// Direction from the attacker's eyes to the victim's head (and chest pitch) at the first shot.
	TargetYaw   float64 `json:"targetYaw"`
	TargetPitch float64 `json:"targetPitch"`
	BodyPitch   float64 `json:"bodyPitch"`
}

const (
	// aimRing keeps ~8 s of per-tick samples at 64 tick (4 s at 128): long sprays still find
	// the samples before their first shot.
	aimRing = 512
	// aimWindowSeconds of view samples before the first shot.
	aimWindowSeconds = 0.5
	// burstGapSeconds: shots further apart start a new engagement.
	burstGapSeconds = 0.5
	// maxAimPerMatch bounds the document (a long match has a few hundred engagements).
	maxAimPerMatch = 4000
)

type aimSample struct {
	tick       int
	yaw, pitch float64
	eye, pos   r3.Vector
	duck, ok   bool
}

type aimTrack struct {
	buf        [aimRing]aimSample
	n          int
	lastShot   int
	burstStart int
}

func (t *aimTrack) push(s aimSample) {
	t.buf[t.n%aimRing] = s
	t.n++
}

// at returns the latest sample at or before tick (ok=false when none is buffered).
func (t *aimTrack) at(tick int) (aimSample, bool) {
	for i := 0; i < aimRing && i < t.n; i++ {
		s := t.buf[(t.n-1-i)%aimRing]
		if s.tick <= tick {
			return s, s.ok
		}
	}
	return aimSample{}, false
}

// window returns the samples with from ≤ tick ≤ to in ascending order.
func (t *aimTrack) window(from, to int) []aimSample {
	out := []aimSample{}
	for i := 0; i < aimRing && i < t.n; i++ {
		s := t.buf[(t.n-1-i)%aimRing]
		if s.tick < from {
			break
		}
		if s.tick <= to && s.ok {
			out = append(out, s)
		}
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

type aimKey struct {
	attacker, victim string
	first            int
}

// aimID is the Steam id of a human player without builder side effects ("" otherwise).
func aimID(p *common.Player) string {
	if p == nil || p.IsBot || p.SteamID64 == 0 {
		return ""
	}
	return strconv.FormatUint(p.SteamID64, 10)
}

// aimTracker samples every playing player's view each frame and remembers shot bursts.
type aimTracker struct {
	tracks   map[string]*aimTrack
	recorded map[aimKey]bool
	count    int
}

func newAimTracker() *aimTracker {
	return &aimTracker{tracks: map[string]*aimTrack{}, recorded: map[aimKey]bool{}}
}

func (a *aimTracker) track(id string) *aimTrack {
	t := a.tracks[id]
	if t == nil {
		t = &aimTrack{lastShot: -1 << 30, burstStart: -1 << 30}
		a.tracks[id] = t
	}
	return t
}

func readAim(p *common.Player, tick int) aimSample {
	s := aimSample{tick: tick}
	if !safe(false, p.IsAlive) {
		return s
	}
	pos := safe(r3.Vector{}, p.Position)
	if !finite(pos.X) || !finite(pos.Y) || !finite(pos.Z) || (pos.X == 0 && pos.Y == 0 && pos.Z == 0) {
		return s
	}
	yaw := float64(safe(float32(0), p.ViewDirectionX))
	pitch := float64(safe(float32(0), p.ViewDirectionY))
	if !finite(yaw) || !finite(pitch) {
		return s
	}
	if pitch > 180 {
		pitch -= 360
	}
	s.duck = safe(false, p.IsDucking)
	eye, withOffset := safe2(p.PositionEyes)
	if !withOffset || !finite(eye.Z) {
		eye = pos
		if s.duck {
			eye.Z += 46
		} else {
			eye.Z += 64
		}
	}
	s.yaw, s.pitch, s.eye, s.pos, s.ok = yaw, pitch, eye, pos, true
	return s
}

// safe2 is safe() for the (vector, bool) eye position reader.
func safe2(read func() (r3.Vector, bool)) (v r3.Vector, ok bool) {
	defer func() {
		if recover() != nil {
			v, ok = r3.Vector{}, false
		}
	}()
	return read()
}

func (a *aimTracker) frame(tick int, players []*common.Player) {
	for _, p := range players {
		if key := aimID(p); key != "" {
			a.track(key).push(readAim(p, tick))
		}
	}
}

func (a *aimTracker) shot(id string, tick int, tickRate float64) {
	t := a.track(id)
	if float64(tick-t.lastShot) > burstGapSeconds*tickRate {
		t.burstStart = tick
	}
	t.lastShot = tick
}

// angles from one point to another: yaw (atan2 in the XY plane) and pitch (positive = down).
func angles(from, to r3.Vector) (yaw, pitch float64) {
	d := to.Sub(from)
	yaw = math.Atan2(d.Y, d.X) * 180 / math.Pi
	if yaw < 0 {
		yaw += 360
	}
	pitch = -math.Atan2(d.Z, math.Hypot(d.X, d.Y)) * 180 / math.Pi
	return yaw, pitch
}

// engagement returns the aim window of the attacker's current burst against the victim, once
// per (attacker, victim, burst); nil when already recorded or the samples are missing.
func (a *aimTracker) engagement(attacker, victim string, tick int, tickRate float64) *Aim {
	if attacker == "" || victim == "" || attacker == victim || tickRate <= 0 || a.count >= maxAimPerMatch {
		return nil
	}
	t := a.tracks[attacker]
	v := a.tracks[victim]
	if t == nil || v == nil || float64(tick-t.lastShot) > tickRate || t.burstStart > tick {
		return nil
	}
	first := t.burstStart
	key := aimKey{attacker, victim, first}
	if a.recorded[key] {
		return nil
	}
	samples := t.window(first-int(math.Ceil(aimWindowSeconds*tickRate)), first)
	at, ok := t.at(first)
	target, vok := v.at(first)
	if len(samples) < 2 || !ok || !vok {
		return nil
	}
	a.recorded[key] = true
	a.count++
	head := target.eye
	chest := target.pos
	chest.Z += 0.72 * (target.eye.Z - target.pos.Z)
	out := &Aim{FirstShotTick: first, Dt: make([]int, 0, len(samples)), Yaw: make([]float64, 0, len(samples)), Pitch: make([]float64, 0, len(samples))}
	for _, s := range samples {
		out.Dt = append(out.Dt, s.tick-first)
		out.Yaw = append(out.Yaw, round2(s.yaw))
		out.Pitch = append(out.Pitch, round2(s.pitch))
	}
	ty, tp := angles(at.eye, head)
	_, bp := angles(at.eye, chest)
	out.TargetYaw, out.TargetPitch, out.BodyPitch = round2(ty), round2(tp), round2(bp)
	return out
}
