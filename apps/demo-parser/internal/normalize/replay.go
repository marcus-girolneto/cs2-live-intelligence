package normalize

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/golang/geo/r3"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

// Replay artifact (replay-1): compact, columnar per-round player samples for visual clips.
// It is a separate document from the normalized demo and never affects it.
const ReplayVersion = "replay-1"
const ReplaySampleHz = 8
const ReplayCell = 48

// replayTail is how long sampling continues after a committed round ends, in seconds.
const replayTail = 3.0

// replayMaxSamples bounds samples per round (about 8 minutes at 8 Hz) so a stuck round
// cannot grow the artifact without limit.
const replayMaxSamples = 4000

type ReplayPlayer struct {
	SteamID string `json:"steamId"`
	Name    string `json:"name,omitempty"`
}

// ReplayTrack holds one player's columns for a round; every slice has len(Round.T) entries.
// X/Y are world units with 0.1 precision, Yaw is 0..359 degrees, W indexes Replay.Weapons
// (-1 = none), Fl is 1 while blinded by a flashbang, Alive is 1 while alive. Dead players keep
// their last living position with hp 0.
type ReplayTrack struct {
	P     int       `json:"p"`
	Team  string    `json:"team,omitempty"`
	X     []float64 `json:"x"`
	Y     []float64 `json:"y"`
	Yaw   []int     `json:"yaw"`
	HP    []int     `json:"hp"`
	Armor []int     `json:"armor"`
	W     []int     `json:"w"`
	Fl    []int     `json:"fl"`
	Alive []int     `json:"alive"`
}

// ReplayGrenade is one thrown projectile from throw to detonation/expiry.
type ReplayGrenade struct {
	Type string       `json:"type"`
	P    int          `json:"p"`
	T0   float64      `json:"t0"`
	From [2]float64   `json:"from"`
	T1   float64      `json:"t1"`
	To   [2]float64   `json:"to"`
	Path [][2]float64 `json:"path,omitempty"`
}

// ReplayBomb is a plant/defuse/explode with its world position.
type ReplayBomb struct {
	T      float64    `json:"t"`
	Action string     `json:"action"`
	P      int        `json:"p"`
	Pos    [2]float64 `json:"pos"`
	Site   string     `json:"site,omitempty"`
}

type ReplayRound struct {
	Number int `json:"number"`
	// FreezeTick is the tick at which freeze time ended; every t is (tick - FreezeTick) / tickRate.
	FreezeTick int `json:"freezeTick"`
	// Duration is seconds from freeze-time end to round end; samples continue up to replayTail after it.
	Duration float64       `json:"duration"`
	Winner   string        `json:"winner,omitempty"`
	T        []float64     `json:"t"`
	Tracks   []ReplayTrack `json:"tracks"`
	// Shots are [t, playerIndex, x, y, yaw, weaponIndex].
	Shots    [][6]float64    `json:"shots"`
	Grenades []ReplayGrenade `json:"grenades"`
	Bomb     []ReplayBomb    `json:"bomb,omitempty"`
}

type ReplayBounds struct {
	MinX float64 `json:"minX"`
	MaxX float64 `json:"maxX"`
	MinY float64 `json:"minY"`
	MaxY float64 `json:"maxY"`
}

type Replay struct {
	Version  string         `json:"version"`
	Map      string         `json:"map,omitempty"`
	TickRate float64        `json:"tickRate"`
	SampleHz int            `json:"sampleHz"`
	Players  []ReplayPlayer `json:"players"`
	Weapons  []string       `json:"weapons"`
	Rounds   []ReplayRound  `json:"rounds"`
	Bounds   *ReplayBounds  `json:"bounds,omitempty"`
	Cell     int            `json:"cell"`
	// Outline is a flat [x0,y0,x1,y1,...] list of cell centers visited by living players.
	Outline []int `json:"outline"`
}

type pendingGrenade struct {
	g     ReplayGrenade
	round int
}

type recorder struct {
	doc       Replay
	playerIdx map[string]int
	weaponIdx map[string]int
	cur       *ReplayRound
	byID      map[string]int // steamId → track index in cur
	freeze    int
	step      int
	next      int
	endTick   int // -1 while the round is live
	lastPos   map[string][2]float64
	cells     map[[2]int]bool
	grenades  map[int64]*pendingGrenade
	bounds    *ReplayBounds
}

func newRecorder() *recorder {
	return &recorder{
		doc:       Replay{Version: ReplayVersion, SampleHz: ReplaySampleHz, Cell: ReplayCell, Players: []ReplayPlayer{}, Weapons: []string{}, Rounds: []ReplayRound{}, Outline: []int{}},
		playerIdx: map[string]int{},
		weaponIdx: map[string]int{},
		cells:     map[[2]int]bool{},
		grenades:  map[int64]*pendingGrenade{},
		endTick:   -1,
	}
}

func (r *recorder) playerIndex(id, name string) int {
	if i, ok := r.playerIdx[id]; ok {
		if name != "" && r.doc.Players[i].Name == "" {
			r.doc.Players[i].Name = name
		}
		return i
	}
	r.playerIdx[id] = len(r.doc.Players)
	r.doc.Players = append(r.doc.Players, ReplayPlayer{SteamID: id, Name: name})
	return r.playerIdx[id]
}

func (r *recorder) weapon(name string) int {
	if name == "" {
		return -1
	}
	if i, ok := r.weaponIdx[name]; ok {
		return i
	}
	r.weaponIdx[name] = len(r.doc.Weapons)
	r.doc.Weapons = append(r.doc.Weapons, name)
	return r.weaponIdx[name]
}

// begin opens a round at freeze-time end with the given participants (id → team).
func (r *recorder) begin(number, tick int, tickRate float64, ids []string, names map[string]string, teams map[string]string) {
	r.drop()
	if tickRate <= 0 || tickRate > 1024 {
		return
	}
	if r.doc.TickRate == 0 {
		r.doc.TickRate = round1(tickRate)
	}
	r.step = int(math.Round(tickRate / ReplaySampleHz))
	if r.step < 1 {
		r.step = 1
	}
	r.freeze, r.next, r.endTick = tick, tick, -1
	r.cur = &ReplayRound{Number: number, FreezeTick: tick, T: []float64{}, Tracks: []ReplayTrack{}, Shots: [][6]float64{}, Grenades: []ReplayGrenade{}}
	r.byID = map[string]int{}
	r.lastPos = map[string][2]float64{}
	sort.Strings(ids)
	for _, id := range ids {
		r.byID[id] = len(r.cur.Tracks)
		r.cur.Tracks = append(r.cur.Tracks, ReplayTrack{P: r.playerIndex(id, names[id]), Team: teams[id], X: []float64{}, Y: []float64{}, Yaw: []int{}, HP: []int{}, Armor: []int{}, W: []int{}, Fl: []int{}, Alive: []int{}})
	}
}

func (r *recorder) time(tick int) float64 {
	if r.doc.TickRate <= 0 {
		return 0
	}
	return round2(float64(tick-r.freeze) / r.doc.TickRate)
}

// playerSample is the state read from one player entity.
type playerSample struct {
	x, y          float64
	ok            bool
	yaw, hp, arm  int
	weapon        string
	flashed, live bool
}

func readPlayer(p *common.Player) playerSample {
	s := playerSample{}
	s.live = safe(false, p.IsAlive)
	if pos := safe(r3.Vector{}, p.Position); finite(pos.X) && finite(pos.Y) && !(pos.X == 0 && pos.Y == 0 && pos.Z == 0) {
		s.x, s.y, s.ok = round1(pos.X), round1(pos.Y), true
	}
	s.yaw = normYaw(float64(safe(float32(0), p.ViewDirectionX)))
	s.hp = clampInt(safe(0, p.Health), 0, 100)
	s.arm = clampInt(safe(0, p.Armor), 0, 100)
	s.weapon = safe("", func() string { return weaponName(p.ActiveWeapon()) })
	s.flashed = safe(int64(0), func() int64 { return int64(p.FlashDurationTimeRemaining()) }) > 0
	return s
}

func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }

func normYaw(v float64) int {
	if !finite(v) {
		return 0
	}
	d := int(math.Round(math.Mod(v, 360)))
	if d < 0 {
		d += 360
	}
	return d % 360
}

// frame samples every tracked player when the next sample tick is reached.
func (r *recorder) frame(tick int, players []*common.Player) {
	if r.cur == nil || tick < r.next {
		return
	}
	if r.endTick >= 0 && float64(tick-r.endTick) > replayTail*r.doc.TickRate {
		r.commit()
		return
	}
	if len(r.cur.T) >= replayMaxSamples {
		return
	}
	r.next = tick + r.step
	byID := map[string]*common.Player{}
	for _, p := range players {
		if p != nil && p.SteamID64 != 0 && !p.IsBot {
			byID[strconv.FormatUint(p.SteamID64, 10)] = p
		}
	}
	r.cur.T = append(r.cur.T, r.time(tick))
	// Tracks are visited in their fixed order so the weapon dictionary is deterministic.
	for i := range r.cur.Tracks {
		tr := &r.cur.Tracks[i]
		id := r.doc.Players[tr.P].SteamID
		s := playerSample{}
		if p := byID[id]; p != nil {
			s = readPlayer(p)
		}
		last, had := r.lastPos[id]
		if s.live && s.ok {
			r.lastPos[id] = [2]float64{s.x, s.y}
			r.visit(s.x, s.y)
		} else if had {
			s.x, s.y = last[0], last[1]
		}
		if !s.live {
			s.hp, s.flashed = 0, false
		}
		tr.X = append(tr.X, s.x)
		tr.Y = append(tr.Y, s.y)
		tr.Yaw = append(tr.Yaw, s.yaw)
		tr.HP = append(tr.HP, s.hp)
		tr.Armor = append(tr.Armor, s.arm)
		tr.W = append(tr.W, r.weapon(s.weapon))
		tr.Fl = append(tr.Fl, b2i(s.flashed))
		tr.Alive = append(tr.Alive, b2i(s.live))
	}
}

func b2i(v bool) int {
	if v {
		return 1
	}
	return 0
}

func (r *recorder) visit(x, y float64) {
	c := [2]int{int(math.Floor(x / ReplayCell)), int(math.Floor(y / ReplayCell))}
	r.cells[c] = true
	if r.bounds == nil {
		r.bounds = &ReplayBounds{x, x, y, y}
		return
	}
	r.bounds.MinX, r.bounds.MaxX = math.Min(r.bounds.MinX, x), math.Max(r.bounds.MaxX, x)
	r.bounds.MinY, r.bounds.MaxY = math.Min(r.bounds.MinY, y), math.Max(r.bounds.MaxY, y)
}

// shot records a gun shot of a tracked player while a round is being recorded.
func (r *recorder) shot(p *common.Player, weapon string, tick int) {
	if r.cur == nil || p == nil || r.endTick >= 0 {
		return
	}
	id := strconv.FormatUint(p.SteamID64, 10)
	if _, ok := r.byID[id]; !ok {
		return
	}
	s := readPlayer(p)
	if !s.ok {
		return
	}
	r.cur.Shots = append(r.cur.Shots, [6]float64{r.time(tick), float64(r.playerIdx[id]), s.x, s.y, float64(s.yaw), float64(r.weapon(weapon))})
}

func xy(v r3.Vector) ([2]float64, bool) {
	if !finite(v.X) || !finite(v.Y) || (v.X == 0 && v.Y == 0) {
		return [2]float64{}, false
	}
	return [2]float64{round1(v.X), round1(v.Y)}, true
}

func (r *recorder) throw(uid int64, kind common.EquipmentType, thrower *common.Player, pos r3.Vector, tick int) {
	name := grenadeName(kind)
	if r.cur == nil || r.endTick >= 0 || name == "" || thrower == nil {
		return
	}
	id := strconv.FormatUint(thrower.SteamID64, 10)
	if _, ok := r.byID[id]; !ok {
		return
	}
	from, ok := xy(pos)
	if !ok {
		from, ok = xy(safe(r3.Vector{}, thrower.Position))
	}
	if !ok {
		return
	}
	if len(r.grenades) > 512 {
		return
	}
	r.grenades[uid] = &pendingGrenade{g: ReplayGrenade{Type: name, P: r.playerIdx[id], T0: r.time(tick), From: from}, round: r.cur.Number}
}

func (r *recorder) detonate(uid int64, pos r3.Vector, path []r3.Vector, tick int) {
	pg := r.grenades[uid]
	delete(r.grenades, uid)
	if pg == nil || r.cur == nil || pg.round != r.cur.Number {
		return
	}
	to, ok := xy(pos)
	if !ok && len(path) > 0 {
		to, ok = xy(path[len(path)-1])
	}
	if !ok {
		return
	}
	g := pg.g
	g.T1, g.To = r.time(tick), to
	g.Path = downsample(path, 16)
	r.cur.Grenades = append(r.cur.Grenades, g)
}

// downsample drops repeated points and keeps at most n evenly spaced valid points, always including the last one.
func downsample(path []r3.Vector, n int) [][2]float64 {
	pts := [][2]float64{}
	for _, v := range path {
		if p, ok := xy(v); ok && (len(pts) == 0 || pts[len(pts)-1] != p) {
			pts = append(pts, p)
		}
	}
	if len(pts) <= n {
		return pts
	}
	out := make([][2]float64, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, pts[i*(len(pts)-1)/(n-1)])
	}
	return out
}

func (r *recorder) bomb(action string, p *common.Player, pos r3.Vector, site string, tick int) {
	if r.cur == nil {
		return
	}
	at, ok := xy(pos)
	if !ok && p != nil {
		at, ok = xy(safe(r3.Vector{}, p.Position))
	}
	if !ok {
		return
	}
	idx := -1
	if p != nil && p.SteamID64 != 0 {
		if i, found := r.playerIdx[strconv.FormatUint(p.SteamID64, 10)]; found {
			idx = i
		}
	}
	r.cur.Bomb = append(r.cur.Bomb, ReplayBomb{T: r.time(tick), Action: action, P: idx, Pos: at, Site: site})
}

// end marks the round as committed by the normalizer; sampling continues for replayTail seconds.
func (r *recorder) end(number int, winner string, tick int) {
	if r.cur == nil || r.cur.Number != number {
		r.drop()
		return
	}
	r.cur.Duration = r.time(tick)
	r.cur.Winner = winner
	r.endTick = tick
}

// commit stores an ended round; drop discards a round that never ended validly.
func (r *recorder) commit() {
	if r.cur != nil && r.endTick >= 0 && len(r.cur.T) > 0 {
		r.doc.Rounds = append(r.doc.Rounds, *r.cur)
	}
	r.cur, r.endTick = nil, -1
	r.grenades = map[int64]*pendingGrenade{}
}

func (r *recorder) drop() {
	if r.cur != nil && r.endTick >= 0 {
		r.commit()
		return
	}
	r.cur, r.endTick = nil, -1
	r.grenades = map[int64]*pendingGrenade{}
}

// result finalizes the artifact keeping only rounds present in the normalized demo.
func (r *recorder) result(doc Demo) *Replay {
	r.drop()
	valid := map[int]bool{}
	for _, round := range doc.Rounds {
		valid[round.Number] = true
	}
	kept := []ReplayRound{}
	seen := map[int]bool{}
	for _, round := range r.doc.Rounds {
		if valid[round.Number] && !seen[round.Number] {
			kept = append(kept, round)
			seen[round.Number] = true
		}
	}
	r.doc.Rounds = kept
	r.doc.Map = doc.Map
	if doc.TickRate > 0 {
		r.doc.TickRate = doc.TickRate
	}
	r.doc.Bounds = r.bounds
	cells := make([][2]int, 0, len(r.cells))
	for c := range r.cells {
		cells = append(cells, c)
	}
	sort.Slice(cells, func(i, j int) bool {
		if cells[i][1] != cells[j][1] {
			return cells[i][1] < cells[j][1]
		}
		return cells[i][0] < cells[j][0]
	})
	for _, c := range cells {
		r.doc.Outline = append(r.doc.Outline, c[0]*ReplayCell+ReplayCell/2, c[1]*ReplayCell+ReplayCell/2)
	}
	out := r.doc
	return &out
}

// WriteReplay writes the artifact gzipped to path atomically (temporary file + rename).
func WriteReplay(path string, replay *Replay) (int64, error) {
	if replay == nil {
		return 0, errors.New("no replay")
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".replay-*.tmp")
	if err != nil {
		return 0, err
	}
	defer os.Remove(tmp.Name())
	gz, err := gzip.NewWriterLevel(tmp, gzip.BestCompression)
	if err != nil {
		tmp.Close()
		return 0, err
	}
	if err = json.NewEncoder(gz).Encode(replay); err != nil {
		tmp.Close()
		return 0, err
	}
	if err = gz.Close(); err != nil {
		tmp.Close()
		return 0, err
	}
	info, err := tmp.Stat()
	if err != nil {
		tmp.Close()
		return 0, err
	}
	if err = tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return 0, err
	}
	if err = tmp.Close(); err != nil {
		return 0, err
	}
	return info.Size(), os.Rename(tmp.Name(), path)
}

// recordBegin starts replay sampling for the active round at freeze-time end.
func (b *builder) recordBegin(tick int, players []*common.Player) {
	ids, names, teams := []string{}, map[string]string{}, map[string]string{}
	for _, pl := range players {
		if pl == nil || pl.SteamID64 == 0 || pl.IsBot {
			continue
		}
		id := strconv.FormatUint(pl.SteamID64, 10)
		if _, dup := names[id]; dup {
			continue
		}
		ids = append(ids, id)
		names[id] = b.players[id].Name
		teams[id] = playerTeam(pl)
		if len(ids) >= 128 {
			break
		}
	}
	b.rec.begin(b.active.Number, tick, b.tickRate, ids, names, teams)
}

func (b *builder) recordBomb(action string, e events.BombEvent, pos r3.Vector, tick int) {
	site := ""
	if e.Site == events.BombsiteA || e.Site == events.BombsiteB {
		site = string(rune(e.Site))
	}
	b.rec.bomb(action, e.Player, pos, site, tick)
}
