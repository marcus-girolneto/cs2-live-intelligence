import { execFile } from "node:child_process";

/** Port: turns a stored demo into the parser's normalized JSON (validated by the caller). */
export interface DemoParser {
  /** `replayPath`: where to also write the replay artifact. Rejects with a safe message. */
  parse(demoPath: string, replayPath?: string): Promise<unknown>;
}

/**
 * Adapter over the Go demo-parser binary: no shell, minimal env, hard deadline (SIGKILL) and
 * bounded stdout. Error messages never echo parser output.
 */
export class ProcessDemoParser implements DemoParser {
  constructor(
    private readonly binary: string,
    private readonly timeoutMs = 120000,
    /** PATH for the child process (the API process PATH, injected by the container). */
    private readonly path: () => string | undefined = () => undefined,
  ) {}
  parse(demoPath: string, replayPath?: string): Promise<unknown> {
    return new Promise((resolveResult, reject) => {
      execFile(
        this.binary,
        ["-input", demoPath, ...(replayPath ? ["-replay", replayPath] : [])],
        {
          timeout: this.timeoutMs,
          maxBuffer: 16 * 1024 * 1024,
          encoding: "utf8",
          killSignal: "SIGKILL",
          env: { PATH: this.path() ?? "/usr/bin:/bin" },
        },
        (error, stdout) => {
          if (error) {
            reject(
              new Error(
                error.killed
                  ? "Demo parser deadline exceeded"
                  : "Demo parser rejected input or exceeded output limit",
              ),
            );
            return;
          }
          try {
            resolveResult(JSON.parse(stdout));
          } catch {
            reject(new Error("Demo parser returned invalid JSON"));
          }
        },
      );
    });
  }
}
