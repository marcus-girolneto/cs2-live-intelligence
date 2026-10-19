package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func main() {
	target := flag.String("url", "http://127.0.0.1:3002/gsi", "collector endpoint")
	token := flag.String("token", os.Getenv("GSI_AUTH_TOKEN"), "local GSI token")
	count := flag.Int("count", 100, "update count")
	interval := flag.Duration("interval", 20*time.Millisecond, "time between updates")
	reconnect := flag.Int("reconnect-at", 50, "pause before this update (0 disables)")
	pause := flag.Duration("reconnect-pause", 500*time.Millisecond, "simulated source disconnect")
	flag.Parse()
	if *count < 1 || *token == "" {
		fmt.Fprintln(os.Stderr, "count >=1 and token required")
		os.Exit(1)
	}
	client := &http.Client{Timeout: 5 * time.Second}
	for i := 1; i <= *count; i++ {
		if i == *reconnect {
			time.Sleep(*pause)
			client.CloseIdleConnections()
		}
		phase := "live"
		if i <= 5 {
			phase = "warmup"
		}
		if i > *count-5 {
			phase = "gameover"
		}
		p := map[string]any{"auth": map[string]any{"token": *token}, "provider": map[string]any{"timestamp": float64(time.Now().UnixMilli()) / 1000, "steamid": "76561198000000001"}, "map": map[string]any{"name": "de_dust2", "mode": "competitive", "phase": phase, "round": i / 10, "team_ct": map[string]any{"score": i / 20}, "team_t": map[string]any{"score": i / 25}}, "round": map[string]any{"phase": phase}, "player": map[string]any{"steamid": "76561198000000001", "state": map[string]any{"health": 100, "armor": 75}, "match_stats": map[string]any{"kills": i / 5, "deaths": i / 10, "assists": i / 15}}}
		if i%7 == 0 {
			delete(p, "player")
		}
		data, _ := json.Marshal(p)
		res, err := client.Post(*target, "application/json", bytes.NewReader(data))
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
		if res.StatusCode != 202 {
			fmt.Fprintf(os.Stderr, "update %d returned %d\n", i, res.StatusCode)
			os.Exit(1)
		}
		if *interval > 0 {
			time.Sleep(*interval)
		}
	}
	fmt.Printf("sent %d GSI updates\n", *count)
}
