package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"runtime/debug"

	"cs2live/demo-parser/internal/normalize"
)

func run(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("demo-parser", flag.ContinueOnError)
	flags.SetOutput(stderr)
	input := flags.String("input", "", "path to CS2 .dem file")
	max := flags.Int64("max-bytes", normalize.DefaultMaxBytes, "input size cap (default 500 MiB, maximum 1 GiB)")
	output := flags.String("output", "", "optional path for the normalized JSON (default: stdout); large demos produce documents far beyond a pipe buffer")
	replayPath := flags.String("replay", "", "optional path for the gzipped replay artifact (best effort)")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	if *input == "" || flags.NArg() != 0 {
		fmt.Fprintln(stderr, "usage: demo-parser -input /path/match.dem [-max-bytes 524288000] [-output /path/match.json] [-replay /path/match.replay.json.gz]")
		return 2
	}
	out, replay, err := normalize.ParseFileWithReplay(*input, *max, *replayPath != "")
	if err != nil {
		fmt.Fprintln(stderr, "demo-parser:", err)
		return 1
	}
	if *replayPath != "" {
		// The replay is best effort: a failure never affects the normalized document.
		if replay == nil {
			fmt.Fprintln(stderr, "demo-parser: warning: replay unavailable")
		} else if size, werr := normalize.WriteReplay(*replayPath, replay); werr != nil {
			fmt.Fprintln(stderr, "demo-parser: warning: replay not written:", werr)
		} else {
			fmt.Fprintf(stderr, "demo-parser: replay written (%d bytes, %d rounds)\n", size, len(replay.Rounds))
		}
	}
	if *output == "" {
		if err = json.NewEncoder(stdout).Encode(out); err != nil {
			fmt.Fprintln(stderr, "demo-parser: encode:", err)
			return 1
		}
		return 0
	}
	if err = writeJSON(*output, out); err != nil {
		fmt.Fprintln(stderr, "demo-parser: output:", err)
		return 1
	}
	return 0
}

// writeJSON streams the document to a new file (0600) through a buffer, then syncs it.
func writeJSON(path string, v any) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	w := bufio.NewWriterSize(f, 1<<20)
	if err = json.NewEncoder(w).Encode(v); err == nil {
		err = w.Flush()
	}
	if err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(path)
	}
	return err
}

// The soft memory limit makes the GC work harder before the container limit is reached.
func main() { debug.SetMemoryLimit(1 << 30); os.Exit(run(os.Args[1:], os.Stdout, os.Stderr)) }
