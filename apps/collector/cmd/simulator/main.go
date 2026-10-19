// Command simulator plays a scripted competitive match into a local collector, exactly
// as CS2 Game State Integration would, so the live pipeline can be demonstrated without
// the game. It exposes a small authenticated control API (start/stop/status).
package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"flag"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
)

// SteamID used for the simulated own player; never a real account.
const simulatedSteamID = "76561198000000001"

type state struct {
	Round, CT, T, Kills, Deaths, Assists, Health, Armor int
	MapPhase, RoundPhase                                string
}

func payload(token string, s state) map[string]any {
	return map[string]any{
		"auth":     map[string]any{"token": token},
		"provider": map[string]any{"timestamp": float64(time.Now().UnixMilli()) / 1000, "steamid": simulatedSteamID},
		"map": map[string]any{"name": "de_mirage", "mode": "competitive", "phase": s.MapPhase, "round": s.Round,
			"team_ct": map[string]any{"score": s.CT}, "team_t": map[string]any{"score": s.T}},
		"round": map[string]any{"phase": s.RoundPhase},
		"player": map[string]any{"steamid": simulatedSteamID,
			"state":       map[string]any{"health": s.Health, "armor": s.Armor},
			"match_stats": map[string]any{"kills": s.Kills, "deaths": s.Deaths, "assists": s.Assists}},
	}
}

type runner struct {
	mu        sync.Mutex
	cancel    context.CancelFunc
	running   bool
	startedAt time.Time
	last      state
	target    string
	token     string
	tick      time.Duration
	rounds    int
}

func (r *runner) send(ctx context.Context, client *http.Client, s state) error {
	data, _ := json.Marshal(payload(r.token, s))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.target, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, res.Body)
	res.Body.Close()
	r.mu.Lock()
	r.last = s
	r.mu.Unlock()
	return nil
}

// play runs one deterministic-seeded match; each phase emits several snapshots like GSI does.
func (r *runner) play(ctx context.Context) {
	defer func() {
		r.mu.Lock()
		r.running = false
		r.mu.Unlock()
	}()
	client := &http.Client{Timeout: 5 * time.Second}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	s := state{MapPhase: "warmup", RoundPhase: "freezetime", Health: 100, Armor: 0}
	emit := func(n int) bool {
		for i := 0; i < n; i++ {
			if err := r.send(ctx, client, s); err != nil && ctx.Err() == nil {
				log.Printf("send failed: %v", err)
			}
			select {
			case <-ctx.Done():
				return false
			case <-time.After(r.tick):
			}
		}
		return true
	}
	if !emit(4) {
		return
	}
	s.MapPhase = "live"
	for round := 1; round <= r.rounds; round++ {
		s.Round = round
		s.RoundPhase, s.Health = "freezetime", 100
		s.Armor = 100
		if round == 1 || rng.Intn(5) == 0 {
			s.Armor = 0 // pistol or eco round
		}
		if !emit(4) {
			return
		}
		s.RoundPhase = "live"
		alive := true
		for step := 0; step < 14 && alive; step++ {
			switch roll := rng.Intn(100); {
			case roll < 12:
				s.Kills++
			case roll < 16:
				s.Assists++
			case roll < 34:
				dmg := 10 + rng.Intn(45)
				if s.Armor > 0 {
					s.Armor = max(0, s.Armor-dmg/2)
					dmg = dmg * 6 / 10
				}
				s.Health = max(0, s.Health-dmg)
			}
			if s.Health == 0 {
				s.Deaths++
				alive = false
			}
			if !emit(1) {
				return
			}
		}
		won := rng.Intn(100) < 55
		if won {
			s.CT++
		} else {
			s.T++
		}
		s.RoundPhase = "over"
		if !emit(4) {
			return
		}
	}
	s.MapPhase, s.RoundPhase = "gameover", "over"
	emit(6)
}

func (r *runner) authorized(req *http.Request) bool {
	got := []byte(req.Header.Get("Authorization"))
	want := []byte("Bearer " + r.token)
	return subtle.ConstantTimeCompare(got, want) == 1
}

func main() {
	target := flag.String("url", "http://127.0.0.1:3002/gsi", "collector GSI endpoint")
	listen := flag.String("listen", envOr("SIMULATOR_LISTEN", "127.0.0.1:3010"), "control API address")
	tick := flag.Duration("tick", 700*time.Millisecond, "time between GSI snapshots")
	rounds := flag.Int("rounds", 12, "rounds to play")
	flag.Parse()
	token := os.Getenv("GSI_AUTH_TOKEN")
	if token == "" {
		log.Fatal("GSI_AUTH_TOKEN required")
	}
	r := &runner{target: *target, token: token, tick: *tick, rounds: *rounds}
	mux := http.NewServeMux()
	status := func(w http.ResponseWriter) {
		r.mu.Lock()
		defer r.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"running": r.running, "startedAt": r.startedAt, "round": r.last.Round, "rounds": r.rounds})
	}
	mux.HandleFunc("GET /status", func(w http.ResponseWriter, req *http.Request) {
		if !r.authorized(req) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		status(w)
	})
	mux.HandleFunc("POST /start", func(w http.ResponseWriter, req *http.Request) {
		if !r.authorized(req) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		r.mu.Lock()
		if !r.running {
			ctx, cancel := context.WithCancel(context.Background())
			r.cancel, r.running, r.startedAt, r.last = cancel, true, time.Now().UTC(), state{}
			go r.play(ctx)
		}
		r.mu.Unlock()
		status(w)
	})
	mux.HandleFunc("POST /stop", func(w http.ResponseWriter, req *http.Request) {
		if !r.authorized(req) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		r.mu.Lock()
		if r.cancel != nil {
			r.cancel()
		}
		r.mu.Unlock()
		status(w)
	})
	server := &http.Server{Addr: *listen, Handler: http.MaxBytesHandler(mux, 1024), ReadHeaderTimeout: 3 * time.Second}
	log.Printf("simulator control on http://%s", *listen)
	log.Fatal(server.ListenAndServe())
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
