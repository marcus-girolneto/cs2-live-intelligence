package main

import (
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
	max := flags.Int64("max-bytes", normalize.DefaultMaxBytes, "input size cap (maximum 512 MiB)")
	replayPath := flags.String("replay", "", "optional path for the gzipped replay artifact (best effort)")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	if *input == "" || flags.NArg() != 0 {
		fmt.Fprintln(stderr, "usage: demo-parser -input /path/match.dem [-max-bytes 268435456] [-replay /path/match.replay.json.gz]")
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
	if err = json.NewEncoder(stdout).Encode(out); err != nil {
		fmt.Fprintln(stderr, "demo-parser: encode:", err)
		return 1
	}
	return 0
}
func main() { debug.SetMemoryLimit(512 << 20); os.Exit(run(os.Args[1:], os.Stdout, os.Stderr)) }
