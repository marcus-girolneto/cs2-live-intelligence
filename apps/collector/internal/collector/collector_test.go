package collector

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func newTest(t *testing.T, cfg Config) *Collector {
	t.Helper()
	if cfg.APIURL == "" {
		cfg.APIURL = "http://127.0.0.1:4000/v1/telemetry/gsi"
	}
	cfg.DeviceID = "device"
	cfg.DeviceToken = "secret"
	cfg.GSIToken = "local"
	c, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return c
}
func post(c *Collector, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c.ServeHTTP(w, httptest.NewRequest("POST", "/gsi", strings.NewReader(body)))
	return w
}
func TestValidationAndPrivacy(t *testing.T) {
	c := newTest(t, Config{})
	valid := `{"auth":{"token":"local"},"provider":{"steamid":"me"},"player":{"steamid":"me","match_stats":{"kills":4}},"allplayers":{"secret":true}}`
	if w := post(c, valid); w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	e := <-c.queue
	if e.Sequence != 1 || e.SchemaVersion != "1.0" || e.ObservedAt == "" {
		t.Fatal(e)
	}
	if _, ok := e.Payload["auth"]; ok {
		t.Fatal("auth leaked")
	}
	if _, ok := e.Payload["allplayers"]; ok {
		t.Fatal("roster leaked")
	}
	for _, body := range []string{`null`, `{"auth":{"token":"local"},"player":{"state":{"health":101}}}`, `{"auth":{"token":"local"},"map":{"round":-1}}`, `{"auth":{"token":"local"},"player":null}`, `{"auth":{"token":"local"}} {}`} {
		if w := post(c, body); w.Code < 400 {
			t.Fatal(body, w.Code)
		}
	}
	if post(c, `{"auth":{"token":"bad"}}`).Code != 401 {
		t.Fatal("auth")
	}
}
func TestLimitsAndBoundaries(t *testing.T) {
	c := newTest(t, Config{QueueSize: 1, MaxPayload: 200})
	if post(c, `{"auth":{"token":"local"}}`).Code != 202 {
		t.Fatal("missing optional")
	}
	if post(c, `{"auth":{"token":"local"}}`).Code != 503 {
		t.Fatal("queue limit")
	}
	if post(c, strings.Repeat(" ", 201)).Code != 413 {
		t.Fatal("size limit")
	}
	<-c.queue
	var prior string
	for i, name := range []string{"de_dust2", "de_mirage"} {
		if post(c, fmt.Sprintf(`{"auth":{"token":"local"},"map":{"name":%q,"round":1}}`, name)).Code != 202 {
			t.Fatal("map")
		}
		e := <-c.queue
		if i == 1 && (e.SessionID == prior || e.Sequence != 1) {
			t.Fatal("map did not reset")
		}
		prior = e.SessionID
	}
}
func TestPersistenceAndRestart(t *testing.T) {
	cfg := Config{SessionID: "fixed", SequenceFile: filepath.Join(t.TempDir(), "seq.json")}
	c := newTest(t, cfg)
	post(c, `{"auth":{"token":"local"}}`)
	c2 := newTest(t, cfg)
	post(c2, `{"auth":{"token":"local"}}`)
	if (<-c2.queue).Sequence != 2 {
		t.Fatal("sequence reused")
	}
	a := newTest(t, Config{})
	b := newTest(t, Config{})
	if a.session == b.session {
		t.Fatal("session reused")
	}
}
func TestRetryIdentityAndShutdown(t *testing.T) {
	var attempts atomic.Int32
	ids := make(chan string, 3)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Error("missing bearer")
		}
		var e Envelope
		json.NewDecoder(r.Body).Decode(&e)
		ids <- e.EventID
		if attempts.Add(1) < 3 {
			w.WriteHeader(503)
		} else {
			w.WriteHeader(202)
		}
	}))
	defer server.Close()
	c := newTest(t, Config{APIURL: server.URL, RetryBase: time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { c.Run(ctx); close(done) }()
	post(c, `{"auth":{"token":"local"}}`)
	var id string
	for i := 0; i < 3; i++ {
		select {
		case got := <-ids:
			if i > 0 && got != id {
				t.Fatal("event changed")
			}
			id = got
		case <-time.After(time.Second):
			t.Fatal("retry timeout")
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("shutdown timeout")
	}
}
func TestRejectInsecureAndExternalListener(t *testing.T) {
	if ValidateListen("0.0.0.0:3002") == nil {
		t.Fatal("public bind")
	}
	for _, u := range []string{"http://example.com/ingest", "ftp://127.0.0.1/a", "https://u:p@example.com"} {
		if _, err := New(Config{APIURL: u}); err == nil {
			t.Fatal(u)
		}
	}
}
func TestNoRedirectCredentialLeak(t *testing.T) {
	var leaked atomic.Bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Store(true) }))
	defer target.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 307) }))
	defer redirect.Close()
	c := newTest(t, Config{APIURL: redirect.URL})
	c.forward(context.Background(), Envelope{})
	if leaked.Load() {
		t.Fatal("followed redirect")
	}
}
func TestRetryBound(t *testing.T) {
	var attempts atomic.Int32
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { attempts.Add(1); w.WriteHeader(503) }))
	defer s.Close()
	c := newTest(t, Config{APIURL: s.URL, MaxAttempts: 2, RetryBase: time.Millisecond})
	c.forward(context.Background(), Envelope{})
	if attempts.Load() != 2 {
		t.Fatal(attempts.Load())
	}
}

func TestConcurrentHundredUniqueSequences(t *testing.T) {
	c := newTest(t, Config{QueueSize: 128})
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if w := post(c, `{"auth":{"token":"local"}}`); w.Code != 202 {
				t.Error(w.Code)
			}
		}()
	}
	wg.Wait()
	seen := map[uint64]bool{}
	for i := 0; i < 100; i++ {
		e := <-c.queue
		if seen[e.Sequence] {
			t.Fatal("duplicate sequence")
		}
		seen[e.Sequence] = true
	}
	if !seen[1] || !seen[100] {
		t.Fatal("sequence range")
	}
}
func TestDrainAndCancel(t *testing.T) {
	delivered := make(chan struct{}, 1)
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { delivered <- struct{}{}; w.WriteHeader(202) }))
	defer s.Close()
	c := newTest(t, Config{APIURL: s.URL})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.Run(ctx)
	post(c, `{"auth":{"token":"local"}}`)
	deadline, done := context.WithTimeout(context.Background(), time.Second)
	defer done()
	c.WaitIdle(deadline)
	if c.pending.Load() != 0 {
		t.Fatal("did not drain")
	}
	select {
	case <-delivered:
	default:
		t.Fatal("not delivered")
	}
	c2 := newTest(t, Config{RetryBase: time.Hour})
	canceled, stop := context.WithCancel(context.Background())
	stop()
	start := time.Now()
	c2.forward(canceled, Envelope{})
	if time.Since(start) > time.Second {
		t.Fatal("cancel blocked")
	}
}
func TestRoundResetNewSession(t *testing.T) {
	c := newTest(t, Config{})
	post(c, `{"auth":{"token":"local"},"map":{"round":15}}`)
	a := <-c.queue
	post(c, `{"auth":{"token":"local"},"map":{"round":0}}`)
	b := <-c.queue
	if a.SessionID == b.SessionID || b.Sequence != 1 {
		t.Fatal("old match leaked")
	}
}

func TestSharedContractFixtures(t *testing.T) {
	for _, name := range []string{"active.json", "minimal.json"} {
		t.Run(name, func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join("../../../../packages/contracts/fixtures", name))
			if err != nil {
				t.Fatal(err)
			}
			var raw map[string]any
			if err = json.Unmarshal(data, &raw); err != nil {
				t.Fatal(err)
			}
			got, err := Validate(raw)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, raw) {
				t.Fatalf("shared fixture changed: %v", got)
			}
		})
	}
}
func TestRotatedFixedSessionRestart(t *testing.T) {
	cfg := Config{SessionID: "fixed", SequenceFile: filepath.Join(t.TempDir(), "seq.json")}
	c := newTest(t, cfg)
	post(c, `{"auth":{"token":"local"},"map":{"name":"a"}}`)
	<-c.queue
	post(c, `{"auth":{"token":"local"},"map":{"name":"b"}}`)
	rotated := <-c.queue
	c2 := newTest(t, cfg)
	post(c2, `{"auth":{"token":"local"},"map":{"name":"b"}}`)
	resumed := <-c2.queue
	if resumed.SessionID != rotated.SessionID || resumed.Sequence != 2 {
		t.Fatal("rotated ID not resumed")
	}
}
