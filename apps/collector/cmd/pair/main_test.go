package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestClaimCredentialsPrivateAndNotOverwritten(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/devices/claim" {
			t.Error(r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]string{"deviceId": "paired-device", "token": "private-token"})
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "credentials.json")
	if err := claim(server.URL, "ABCDEF", path); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatal("credentials exposed")
	}
	if err := claim(server.URL, "ABCDEF", path); err == nil {
		t.Fatal("overwrote credentials")
	}
}
func TestClaimRejectsRemoteHTTPAndFailedCodes(t *testing.T) {
	if claim("http://example.com", "ABCDEF", filepath.Join(t.TempDir(), "creds")) == nil {
		t.Fatal("insecure endpoint accepted")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401) }))
	defer server.Close()
	if claim(server.URL, "ABCDEF", filepath.Join(t.TempDir(), "creds")) == nil {
		t.Fatal("bad code accepted")
	}
}
