import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Port: turns a stored demo into the parser's normalized JSON (validated by the caller). */
export interface DemoParser {
  /** `replayPath`: where to also write the replay artifact. Rejects with a safe message. */
  parse(demoPath: string, replayPath?: string): Promise<unknown>;
}

/** Normalized documents of 500 MB demos are far beyond a pipe buffer: read from a file. */
// Below V8's maximum string length (~512 MiB), since the document is parsed as one string.
export const MAX_PARSER_OUTPUT_BYTES = 480 * 1024 * 1024;
/** The parser accepts inputs up to 1 GiB (uploads are capped before reaching it). */
export const PARSER_MAX_INPUT_BYTES = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
/** Deadline grows with the demo: base + 1 s per MB, at most 30 minutes. */
export function parserDeadlineMs(baseMs: number, demoBytes: number): number {
  return Math.min(
    30 * 60_000,
    Math.max(baseMs, baseMs + Math.ceil(demoBytes / MB) * 1000),
  );
}

/**
 * Adapter over the Go demo-parser binary: no shell, minimal env, hard deadline (SIGKILL) scaled
 * by demo size, normalized JSON written to a private temp file (bounded read, then removed).
 * Error messages never echo parser output.
 */
export class ProcessDemoParser implements DemoParser {
  constructor(
    private readonly binary: string,
    private readonly timeoutMs = 120000,
    /** PATH for the child process (the API process PATH, injected by the container). */
    private readonly path: () => string | undefined = () => undefined,
    private readonly maxOutputBytes = MAX_PARSER_OUTPUT_BYTES,
  ) {}

  async parse(demoPath: string, replayPath?: string): Promise<unknown> {
    const size = await stat(demoPath).then(
      (s) => s.size,
      () => 0,
    );
    const dir = await mkdtemp(join(tmpdir(), "cs2-parse-"));
    const output = join(dir, "normalized.json");
    try {
      await this.run(
        [
          "-input",
          demoPath,
          "-max-bytes",
          String(PARSER_MAX_INPUT_BYTES),
          "-output",
          output,
          ...(replayPath ? ["-replay", replayPath] : []),
        ],
        parserDeadlineMs(this.timeoutMs, size),
      );
      const info = await stat(output).catch(() => undefined);
      if (!info || info.size > this.maxOutputBytes)
        throw new Error("Demo parser rejected input or exceeded output limit");
      try {
        return JSON.parse(await readFile(output, "utf8"));
      } catch {
        throw new Error("Demo parser returned invalid JSON");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[], timeout: number): Promise<void> {
    return new Promise((resolveRun, reject) => {
      execFile(
        this.binary,
        args,
        {
          timeout,
          // Only stderr diagnostics remain on the pipes.
          maxBuffer: 1024 * 1024,
          encoding: "utf8",
          killSignal: "SIGKILL",
          env: { PATH: this.path() ?? "/usr/bin:/bin" },
        },
        (error) => {
          if (!error) return resolveRun();
          reject(
            new Error(
              error.killed
                ? "Demo parser deadline exceeded"
                : "Demo parser rejected input or exceeded output limit",
            ),
          );
        },
      );
    });
  }
}
