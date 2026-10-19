package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestCLIErrorIsolation(t *testing.T) {
	p := filepath.Join(t.TempDir(), "bad.dem")
	os.WriteFile(p, []byte("bad demo"), 0600)
	replay := filepath.Join(t.TempDir(), "x.replay.json.gz")
	for _, args := range [][]string{{}, {"-input", p}, {"-input", p, "unexpected"}, {"-unknown"}, {"-input", p, "-replay", replay}, {"-replay", replay}} {
		var stdout, stderr bytes.Buffer
		if code := run(args, &stdout, &stderr); code == 0 || stdout.Len() != 0 || stderr.Len() == 0 {
			t.Fatalf("args %v result stdout=%q stderr=%q", args, stdout.String(), stderr.String())
		}
	}
	if _, err := os.Stat(replay); !os.IsNotExist(err) {
		t.Fatal("no replay may be written when parsing fails")
	}
}
