package main

import (
	"context"
	"cs2live/collector/internal/collector"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func main() {
	listen := flag.String("listen", env("GSI_LISTEN", "127.0.0.1:3002"), "IPv4 loopback bind")
	api := flag.String("api-url", env("API_URL", "http://127.0.0.1:4000/v1/telemetry/gsi"), "ingest URL")
	device := flag.String("device-id", env("DEVICE_ID", "dev-device"), "provisioned device ID")
	token := flag.String("device-token", env("DEVICE_TOKEN", ""), "device bearer token")
	gsi := flag.String("gsi-token", env("GSI_AUTH_TOKEN", ""), "local GSI token")
	session := flag.String("session-id", env("SESSION_ID", ""), "optional fixed ID, requires sequence-file")
	seq := flag.String("sequence-file", env("SEQUENCE_FILE", ""), "durable sequence file for fixed ID")
	queue := flag.Int("queue-size", 256, "bounded pending envelopes")
	size := flag.Int64("max-payload", 65536, "maximum GSI bytes")
	flag.Parse()
	if err := collector.ValidateListen(*listen); err != nil {
		log.Fatal(err)
	}
	c, err := collector.New(collector.Config{APIURL: *api, DeviceID: *device, DeviceToken: *token, GSIToken: *gsi, SessionID: *session, SequenceFile: *seq, QueueSize: *queue, MaxPayload: *size})
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workerCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { c.Run(workerCtx); close(done) }()
	server := &http.Server{Addr: *listen, Handler: c, ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192}
	go func() {
		log.Printf("collector listening on http://%s", *listen)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Print(err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, release := context.WithTimeout(context.Background(), 5*time.Second)
	defer release()
	server.Shutdown(shutdown)
	c.WaitIdle(shutdown)
	cancel()
	<-done
}
