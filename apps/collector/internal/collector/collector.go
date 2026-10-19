package collector

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

type Config struct {
	APIURL, DeviceToken, DeviceID, GSIToken, SessionID, SequenceFile string
	QueueSize                                                        int
	MaxPayload                                                       int64
	MaxAttempts                                                      int
	RetryBase                                                        time.Duration
	Client                                                           *http.Client
}
type Envelope struct {
	SchemaVersion string         `json:"schemaVersion"`
	EventID       string         `json:"eventId"`
	DeviceID      string         `json:"deviceId"`
	SessionID     string         `json:"sessionId"`
	Sequence      uint64         `json:"sequence"`
	ObservedAt    string         `json:"observedAt"`
	ReceivedAt    string         `json:"receivedAt"`
	Source        string         `json:"source"`
	Visibility    string         `json:"visibility"`
	Payload       map[string]any `json:"payload"`
}
type Collector struct {
	cfg       Config
	queue     chan Envelope
	mu        sync.Mutex
	session   string
	sequence  uint64
	mapName   string
	lastRound float64
	hasRound  bool
	client    *http.Client
	pending   atomic.Int64
}
type persisted struct {
	ConfiguredSessionID string `json:"configuredSessionId"`
	SessionID           string `json:"sessionId"`
	Sequence            uint64 `json:"sequence"`
}

func ID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func ValidateListen(addr string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil || host != "127.0.0.1" {
		return errors.New("listener must bind literal 127.0.0.1")
	}
	return nil
}
func New(cfg Config) (*Collector, error) {
	u, err := url.Parse(cfg.APIURL)
	if err != nil || u.Host == "" || u.User != nil || u.Fragment != "" {
		return nil, errors.New("invalid API URL")
	}
	host := u.Hostname()
	ip := net.ParseIP(host)
	if u.Scheme != "https" && !(u.Scheme == "http" && (host == "localhost" || (ip != nil && ip.IsLoopback()))) {
		return nil, errors.New("API requires HTTPS except loopback development")
	}
	if cfg.DeviceID == "" || len(cfg.DeviceID) > 128 || cfg.DeviceToken == "" || cfg.GSIToken == "" {
		return nil, errors.New("device ID, device token and GSI auth token required")
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 256
	}
	if cfg.MaxPayload <= 0 {
		cfg.MaxPayload = 64 * 1024
	}
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 5
	}
	if cfg.RetryBase <= 0 {
		cfg.RetryBase = 100 * time.Millisecond
	}
	if cfg.SessionID != "" && (len(cfg.SessionID) > 128 || cfg.SequenceFile == "") {
		return nil, errors.New("fixed session requires sequence file and ID <=128 bytes")
	}
	c := &Collector{cfg: cfg, queue: make(chan Envelope, cfg.QueueSize), session: cfg.SessionID}
	if c.session == "" {
		c.session = ID()
	} else {
		data, e := os.ReadFile(cfg.SequenceFile)
		if e == nil {
			var p persisted
			if json.Unmarshal(data, &p) != nil || p.SessionID == "" || (p.ConfiguredSessionID != c.session && !(p.ConfiguredSessionID == "" && p.SessionID == c.session)) {
				return nil, errors.New("sequence file session mismatch or corruption")
			}
			c.session = p.SessionID
			c.sequence = p.Sequence
		} else if !os.IsNotExist(e) {
			return nil, e
		}
	}
	if cfg.Client != nil {
		copyClient := *cfg.Client
		c.client = &copyClient
	} else {
		c.client = &http.Client{Timeout: 5 * time.Second}
	}
	c.client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return c, nil
}
func (c *Collector) persist() error {
	if c.cfg.SequenceFile == "" {
		return nil
	}
	data, _ := json.Marshal(persisted{c.cfg.SessionID, c.session, c.sequence})
	tmp := c.cfg.SequenceFile + ".tmp"
	if err := os.MkdirAll(filepath.Dir(tmp), 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(tmp, c.cfg.SequenceFile); err != nil {
		return err
	}
	dir, err := os.Open(filepath.Dir(c.cfg.SequenceFile))
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}
func (c *Collector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/health" && r.Method == http.MethodGet {
		c.mu.Lock()
		defer c.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"sessionId": c.session, "sequence": c.sequence, "queued": len(c.queue)})
		return
	}
	if r.URL.Path != "/gsi" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", 405)
		return
	}
	var raw map[string]any
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, c.cfg.MaxPayload))
	if err := dec.Decode(&raw); err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			http.Error(w, "payload too large", 413)
		} else {
			http.Error(w, "invalid JSON", 400)
		}
		return
	}
	if dec.Decode(new(any)) != io.EOF {
		http.Error(w, "single JSON object required", 400)
		return
	}
	auth, _ := raw["auth"].(map[string]any)
	token, _ := auth["token"].(string)
	if subtle.ConstantTimeCompare([]byte(token), []byte(c.cfg.GSIToken)) != 1 {
		http.Error(w, "unauthorized", 401)
		return
	}
	payload, err := Validate(raw)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.queue) == cap(c.queue) {
		http.Error(w, "queue full", 503)
		return
	}
	m, _ := payload["map"].(map[string]any)
	name, _ := m["name"].(string)
	round, hasRound := m["round"].(float64)
	if (name != "" && c.mapName != "" && name != c.mapName) || (hasRound && c.hasRound && round < c.lastRound) {
		c.session = ID()
		c.sequence = 0
		c.mapName = ""
		c.hasRound = false
	}
	if name != "" {
		c.mapName = name
	}
	if hasRound {
		c.lastRound = round
		c.hasRound = true
	}
	c.sequence++
	if err := c.persist(); err != nil {
		http.Error(w, "sequence persistence failed", 500)
		return
	}
	now := time.Now().UTC()
	observed := now
	if p, ok := payload["provider"].(map[string]any); ok {
		if stamp, ok := p["timestamp"].(float64); ok {
			observed = time.Unix(int64(stamp), int64((stamp-math.Floor(stamp))*1e9)).UTC()
		}
	}
	c.pending.Add(1)
	c.queue <- Envelope{"1.0", ID(), c.cfg.DeviceID, c.session, c.sequence, observed.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano), "gsi", "own-player", payload}
	w.WriteHeader(http.StatusAccepted)
}
func (c *Collector) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case e := <-c.queue:
			c.forward(ctx, e)
			c.pending.Add(-1)
		}
	}
}
func (c *Collector) forward(ctx context.Context, e Envelope) {
	data, _ := json.Marshal(e)
	for attempt := 0; attempt < c.cfg.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			return
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.APIURL, bytes.NewReader(data))
		if err != nil {
			return
		}
		req.Header.Set("Authorization", "Bearer "+c.cfg.DeviceToken)
		req.Header.Set("Content-Type", "application/json")
		res, err := c.client.Do(req)
		retry := true
		if err == nil {
			io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
			res.Body.Close()
			if res.StatusCode >= 200 && res.StatusCode < 300 {
				return
			}
			retry = res.StatusCode == 429 || res.StatusCode >= 500
		}
		if !retry {
			log.Printf("telemetry rejected: event=%s status=%d", e.EventID, res.StatusCode)
			return
		}
		if attempt+1 == c.cfg.MaxAttempts {
			break
		}
		delay := c.cfg.RetryBase * time.Duration(1<<min(attempt, 6))
		if delay > 5*time.Second {
			delay = 5 * time.Second
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
	log.Printf("telemetry retry limit reached: event=%s", e.EventID)
}

// Validate projects the shared Zod allowlist. Missing optional fields remain absent.
func Validate(raw map[string]any) (map[string]any, error) {
	if raw == nil {
		return nil, errors.New("object required")
	}
	out := map[string]any{}
	spec := map[string]map[string]string{"provider": {"timestamp": "timestamp", "steamid": "string"}, "map": {"name": "128", "mode": "64", "phase": "64", "round": "count", "team_ct": "score", "team_t": "score"}, "round": {"phase": "64"}, "player": {"steamid": "string", "activity": "string", "state": "state", "match_stats": "stats"}}
	for field, fields := range spec {
		v, exists := raw[field]
		if !exists {
			continue
		}
		obj, ok := v.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s must be object", field)
		}
		clean, err := project(obj, fields)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", field, err)
		}
		out[field] = clean
	}
	return out, nil
}
func project(obj map[string]any, spec map[string]string) (map[string]any, error) {
	out := map[string]any{}
	for key, kind := range spec {
		v, exists := obj[key]
		if !exists {
			continue
		}
		switch kind {
		case "score", "state", "stats":
			nested, ok := v.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("%s must be object", key)
			}
			fields := map[string]string{"score": "count"}
			if kind == "state" {
				fields = map[string]string{"health": "100", "armor": "100"}
			}
			if kind == "stats" {
				fields = map[string]string{"kills": "count", "deaths": "count", "assists": "count"}
			}
			clean, err := project(nested, fields)
			if err != nil {
				return nil, err
			}
			out[key] = clean
		case "string", "128", "64":
			s, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be string", key)
			}
			if (kind == "128" && len([]rune(s)) > 128) || (kind == "64" && len([]rune(s)) > 64) {
				return nil, fmt.Errorf("%s too long", key)
			}
			out[key] = s
		default:
			n, ok := v.(float64)
			if !ok || math.IsNaN(n) || math.IsInf(n, 0) || n < 0 || (kind != "timestamp" && (n != math.Floor(n) || n > 9007199254740991)) || (kind == "100" && n > 100) || (kind == "timestamp" && n > 253402300799) {
				return nil, fmt.Errorf("%s invalid number", key)
			}
			out[key] = n
		}
	}
	return out, nil
}

// WaitIdle lets shutdown drain accepted work within its caller deadline.
func (c *Collector) WaitIdle(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for c.pending.Load() > 0 {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
