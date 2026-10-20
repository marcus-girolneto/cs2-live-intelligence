package normalize

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// Budgets of one fuzz input. Inputs are small (≤ 2 MiB), so a parse that takes seconds or
// hundreds of MiB means a quadratic path or an allocation driven by attacker-controlled sizes.
const (
	fuzzMaxInput   = 2 << 20
	fuzzMaxElapsed = 10 * time.Second
	fuzzMaxAlloc   = 1 << 30
)

// fixtureHead returns the first n bytes of the public fixture, or nil when it is not present
// (it is fetched by scripts/fetch-fixture.py and ignored by Git).
func fixtureHead(n int) []byte {
	f, err := os.Open(filepath.Join("..", "..", "testdata", "public-cs2.dem"))
	if err != nil {
		return nil
	}
	defer f.Close()
	buf := make([]byte, n)
	read, _ := f.Read(buf)
	return buf[:read]
}

// frameAligned cuts data after its last complete frame, so the library parses whole frames
// and reaches a clean end of input (validateFrames rejects partial frames).
func frameAligned(data []byte) []byte {
	pos, end := headerBytes, headerBytes
	for pos < len(data) {
		r := bytes.NewReader(data[pos:])
		_, err1 := binary.ReadUvarint(r)
		_, err2 := binary.ReadUvarint(r)
		size, err3 := binary.ReadUvarint(r)
		if err1 != nil || err2 != nil || err3 != nil {
			break
		}
		next := len(data) - r.Len() + int(size)
		if next > len(data) {
			break
		}
		pos, end = next, next
	}
	return data[:end]
}

// corrupt flips bytes at a fixed stride (deterministic seeds).
func corrupt(data []byte, stride int, xor byte) []byte {
	out := append([]byte(nil), data...)
	for i := 16; i < len(out); i += stride {
		out[i] ^= xor
	}
	return out
}

// FuzzNormalize feeds arbitrary bytes to the full parse path (library + normalization +
// replay). It must return an error or a document, never panic past ParseFileWithReplay's
// recover boundary, never exceed the time or heap budget. Bounded run:
// `pnpm test:fuzz` (go test -run '^$' -fuzz FuzzNormalize -fuzztime 20s). The checked-in
// regression corpus lives in testdata/fuzz/FuzzNormalize and runs with every `go test`.
func FuzzNormalize(f *testing.F) {
	magic := []byte("PBDEMS2\x00")
	f.Add([]byte{})
	f.Add(magic)
	f.Add(append(append([]byte(nil), magic...), make([]byte, 64)...))
	// Header followed by a frame whose declared size is huge (allocation driven by input).
	f.Add(append(append([]byte(nil), magic...), 0, 0, 0, 0, 0, 0, 0, 0, 1, 0xff, 0xff, 0xff, 0xff, 0x0f, 0xff, 0xff, 0xff, 0xff, 0x07))
	if head := fixtureHead(256 << 10); len(head) > 0 {
		for _, n := range []int{17, 64, 300, 4 << 10, 64 << 10, len(head)} {
			if n <= len(head) {
				f.Add(head[:n])
				f.Add(frameAligned(head[:n]))
			}
		}
		f.Add(corrupt(head, 97, 0xff))
		f.Add(corrupt(head[:64<<10], 13, 0x40))
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) > fuzzMaxInput {
			t.Skip("input above the fuzz budget")
		}
		path := filepath.Join(t.TempDir(), "fuzz.dem")
		if err := os.WriteFile(path, data, 0o600); err != nil {
			t.Fatal(err)
		}
		var before, after runtime.MemStats
		runtime.ReadMemStats(&before)
		start := time.Now()
		out, replay, err := ParseFileWithReplay(path, int64(len(data))+1, true)
		elapsed := time.Since(start)
		runtime.ReadMemStats(&after)
		if elapsed > fuzzMaxElapsed {
			t.Fatalf("parse took %v for %d bytes", elapsed, len(data))
		}
		// Bytes allocated by this parse (cumulative, so it also catches allocate-and-free loops).
		if alloc := after.TotalAlloc - before.TotalAlloc; alloc > fuzzMaxAlloc {
			t.Fatalf("parse allocated %d MiB for %d bytes", alloc>>20, len(data))
		}
		if err != nil {
			if out.ParserVersion != "" || replay != nil {
				t.Fatal("a failed parse must not return a document or replay")
			}
			if strings.Contains(err.Error(), "goroutine ") {
				t.Fatalf("error leaks a stack trace: %.200s", err.Error())
			}
			return
		}
		if out.ParserVersion != Version || len(out.Rounds) == 0 {
			t.Fatalf("a successful parse must be a complete document (rounds=%d)", len(out.Rounds))
		}
	})
}

// A panic raised inside the parse (here: by a net-message handler of ours, the same path a
// library panic takes through its dispatcher goroutines) becomes a one-line error: the
// dispatcher recovers it and ParseToEnd returns it; anything else is caught by the recover
// boundary of ParseFileWithReplay.
func TestPanicBecomesError(t *testing.T) {
	head := frameAligned(fixtureHead(4 << 20))
	if len(head) <= headerBytes {
		t.Skip("public fixture not present")
	}
	path := filepath.Join(t.TempDir(), "head.dem")
	if err := os.WriteFile(path, head, 0o600); err != nil {
		t.Fatal(err)
	}
	panicHook = func() { panic("boom from a handler") }
	defer func() { panicHook = nil }()
	_, replay, err := ParseFileWithReplay(path, int64(len(head))+1, true)
	if err == nil || replay != nil || !strings.Contains(err.Error(), "boom from a handler") || strings.Contains(err.Error(), "goroutine") {
		t.Fatalf("panic not converted: %v", err)
	}
}

func TestValidateFramesRejectsAllocationBombs(t *testing.T) {
	magic := []byte("PBDEMS2\x00\x00\x00\x00\x00\x00\x00\x00\x00")
	for name, tail := range map[string][]byte{
		"2 GiB frame":          {1, 0, 0xff, 0xff, 0xff, 0xff, 0x07},
		"snappy 4 GiB decoded": {1 | 64, 0, 6, 0xff, 0xff, 0xff, 0xff, 0x0f, 0},
		"unknown command":      {0x7f, 0, 1, 0},
	} {
		data := append(append([]byte(nil), magic[:16]...), tail...)
		if err := validateFrames(bytesReader(data), int64(len(data))); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	// A cut recording fails in the library anyway (unexpected end of demo); it is rejected
	// before the library allocates what the partial header declares.
	for _, cut := range [][]byte{{1, 0, 100, 1, 2}, {65, 48, 0xff, 0xff, 0xff, 0xff, 0xfb}} {
		data := append(append([]byte(nil), magic[:16]...), cut...)
		if err := validateFrames(bytesReader(data), int64(len(data))); err == nil {
			t.Errorf("truncated tail %v accepted", cut)
		}
	}
	if head := frameAligned(fixtureHead(8 << 20)); len(head) > headerBytes {
		if err := validateFrames(bytesReader(head), int64(len(head))); err != nil {
			t.Errorf("fixture head rejected: %v", err)
		}
	}
}

func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }
