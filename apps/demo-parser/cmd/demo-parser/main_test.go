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

func TestCLISizeLimitsAndOutputFile(t *testing.T) {
	dir := t.TempDir()
	// A sparse 600 MiB file: rejected by the 500 MiB default before any parsing.
	big := filepath.Join(dir, "big.dem")
	f, err := os.Create(big)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Truncate(600 << 20); err != nil {
		t.Fatal(err)
	}
	f.Close()
	var stdout, stderr bytes.Buffer
	if code := run([]string{"-input", big}, &stdout, &stderr); code == 0 || !bytes.Contains(stderr.Bytes(), []byte("exceeds input size limit")) {
		t.Fatalf("600 MiB must exceed the default cap: %d %q", code, stderr.String())
	}
	// -max-bytes accepts 500 MB demos and refuses caps above 1 GiB.
	stderr.Reset()
	if code := run([]string{"-input", big, "-max-bytes", "2147483648"}, &stdout, &stderr); code == 0 {
		t.Fatal("caps above 1 GiB must be rejected")
	}
	fixture := filepath.Join("..", "..", "testdata", "public-cs2.dem")
	if _, err := os.Stat(fixture); err != nil {
		t.Skip("public fixture not downloaded")
	}
	out := filepath.Join(dir, "out.json")
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"-input", fixture, "-max-bytes", "524288000", "-output", out}, &stdout, &stderr); code != 0 {
		t.Fatalf("parse failed: %s", stderr.String())
	}
	if stdout.Len() != 0 {
		t.Fatal("with -output nothing is written to stdout")
	}
	body, err := os.ReadFile(out)
	if err != nil || !bytes.HasPrefix(body, []byte("{")) || !bytes.Contains(body, []byte(`"parserVersion"`)) {
		t.Fatalf("output file: %v %.80s", err, body)
	}
	info, _ := os.Stat(out)
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("output mode %v", info.Mode().Perm())
	}
}
