import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Port: turns a stored demo into the parser's normalized JSON (validated by the caller). */
export interface DemoParser {
  /** `replayPath`: where to also write the replay artifact. Rejects with a safe message. */
  parse(demoPath: string, replayPath?: string): Promise<unknown>;
  /** The parser's version string (e.g. `demoinfocs-golang/v5@v5.2.0+cs2live.4`). */
  version?(): Promise<string>;
}

/** Normalized documents of 500 MB demos are far beyond a pipe buffer: read from a file. */
// Below V8's maximum string length (~512 MiB), since the document is parsed as one string.
export const MAX_PARSER_OUTPUT_BYTES = 480 * 1024 * 1024;
/** The parser accepts inputs up to 1 GiB (uploads are capped before reaching it). */
export const PARSER_MAX_INPUT_BYTES = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
/**
 * User-safe message for a failed parse, from the parser's stderr. `detail` is the first line of
 * the parser's own error (no stack trace, no paths) for operator logs only.
 */
export function classifyParserFailure(stderr: string): {
  message: string;
  detail: string;
} {
  const first =
    stderr
      .split("\n")
      .map((l) => l.trim())
      .find(
        (l) =>
          l.startsWith("demo-parser:") && !/warning|replay written/.test(l),
      ) ?? "";
  const detail = first.replace(/(\/[\w.-]+)+/g, "<path>").slice(0, 200);
  const message = /invalid CS2 demo header/i.test(first)
    ? "Demo parser: this is not a CS2 demo file"
    : /no fully observed valid live rounds/i.test(first)
      ? "Demo parser: no complete rounds were found in this demo"
      : /exceeds|too large|max-bytes/i.test(first)
        ? "Demo parser: the demo is larger than the allowed size"
        : "Demo parser could not read this demo (unsupported or corrupted file)";
  return { message, detail };
}

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
 * Error messages never echo parser output; the parser's own error line only goes to diagnostics.
 */
export class ProcessDemoParser implements DemoParser {
  constructor(
    private readonly binary: string,
    private readonly timeoutMs = 120000,
    /** PATH for the child process (the API process PATH, injected by the container). */
    private readonly path: () => string | undefined = () => undefined,
    private readonly maxOutputBytes = MAX_PARSER_OUTPUT_BYTES,
    /** Receives the parser's own error line (operator diagnostics; never shown to users). */
    private readonly diagnose: (detail: string) => void = (detail) =>
      console.warn(JSON.stringify({ event: "demo_parser_failed", detail })),
  ) {}

  private cachedVersion: Promise<string> | undefined;

  /** `demo-parser -version`, once per process (the binary does not change while running). */
  version(): Promise<string> {
    this.cachedVersion ??= new Promise<string>((resolveVersion, reject) => {
      execFile(
        this.binary,
        ["-version"],
        {
          timeout: 10_000,
          maxBuffer: 64 * 1024,
          encoding: "utf8",
          env: { PATH: this.path() ?? "/usr/bin:/bin" },
        },
        (error, stdout) => {
          const version = String(stdout).trim();
          if (error || !/^[\w./@+-]{3,128}$/.test(version))
            return reject(new Error("Demo parser version unavailable"));
          resolveVersion(version);
        },
      );
    }).catch((error: unknown) => {
      this.cachedVersion = undefined;
      throw error;
    });
    return this.cachedVersion;
  }

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
        (error, _stdout, stderr) => {
          if (!error) return resolveRun();
          if (error.killed)
            return reject(new Error("Demo parser deadline exceeded"));
          const { message, detail } = classifyParserFailure(String(stderr));
          if (detail) this.diagnose(detail);
          reject(new Error(message));
        },
      );
    });
  }
}
