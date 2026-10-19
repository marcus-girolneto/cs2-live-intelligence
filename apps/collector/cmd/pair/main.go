package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type credentials struct {
	DeviceID string `json:"deviceId"`
	Token    string `json:"token"`
	APIURL   string `json:"apiUrl"`
}

func claim(base, code, path string) error {
	u, err := url.Parse(base)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return fmt.Errorf("invalid API base URL")
	}
	ip := net.ParseIP(u.Hostname())
	if u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || (ip != nil && ip.IsLoopback()))) {
		return fmt.Errorf("HTTPS required outside loopback")
	}
	if len(code) < 6 || len(code) > 128 {
		return fmt.Errorf("valid pairing code required")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		return fmt.Errorf("credentials output must not already exist")
	}
	body, _ := json.Marshal(map[string]string{"code": code})
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Post(strings.TrimRight(base, "/")+"/v1/devices/claim", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("pairing service unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 && response.StatusCode != 201 {
		return fmt.Errorf("pairing rejected (HTTP %d)", response.StatusCode)
	}
	var value credentials
	if err := json.NewDecoder(io.LimitReader(response.Body, 8192)).Decode(&value); err != nil || value.Token == "" || value.DeviceID == "" {
		return fmt.Errorf("invalid pairing response")
	}
	value.APIURL = strings.TrimRight(base, "/") + "/v1/telemetry/gsi"
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	if _, err = file.Write(append(data, '\n')); err != nil {
		file.Close()
		return err
	}
	return file.Close()
}
func main() {
	base := flag.String("api", "http://127.0.0.1:4000", "API base URL")
	code := flag.String("code", os.Getenv("PAIRING_CODE"), "one-use pairing code (prefer PAIRING_CODE env)")
	path := flag.String("out", "collector-credentials.json", "new private credentials file")
	flag.Parse()
	if err := claim(*base, *code, *path); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("Paired. Credentials saved to %s; keep this file private.\n", *path)
}
