package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestPlaySendsValidCompetitiveMatch(t *testing.T) {
	var mu sync.Mutex
	var got []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p map[string]any
		if err := json.Unmarshal(body, &p); err != nil {
			t.Error(err)
		}
		mu.Lock()
		got = append(got, p)
		mu.Unlock()
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()
	r := &runner{target: srv.URL, token: "secret", tick: time.Millisecond, rounds: 3, running: true}
	r.play(context.Background())
	if r.running {
		t.Fatal("runner should stop after the match")
	}
	if len(got) < 20 {
		t.Fatalf("expected many snapshots, got %d", len(got))
	}
	last := got[len(got)-1]
	m := last["map"].(map[string]any)
	if m["phase"] != "gameover" || m["round"].(float64) != 3 {
		t.Fatalf("unexpected final map state %v", m)
	}
	score := m["team_ct"].(map[string]any)["score"].(float64) + m["team_t"].(map[string]any)["score"].(float64)
	if score != 3 {
		t.Fatalf("score must equal rounds played, got %v", score)
	}
	for _, p := range got {
		if p["auth"].(map[string]any)["token"] != "secret" {
			t.Fatal("missing GSI auth token")
		}
		h := p["player"].(map[string]any)["state"].(map[string]any)["health"].(float64)
		if h < 0 || h > 100 {
			t.Fatalf("health out of range %v", h)
		}
	}
}

func TestControlRequiresToken(t *testing.T) {
	r := &runner{token: "secret"}
	req := httptest.NewRequest(http.MethodPost, "/start", nil)
	if r.authorized(req) {
		t.Fatal("missing token accepted")
	}
	req.Header.Set("Authorization", "Bearer secret")
	if !r.authorized(req) {
		t.Fatal("valid token rejected")
	}
}
