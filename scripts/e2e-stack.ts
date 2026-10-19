import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const children: ChildProcess[] = [];
const sequenceDir = mkdtempSync(join(tmpdir(), "cs2-e2e-"));
const env = {
  ...process.env,
  API_HOST: "127.0.0.1",
  API_PORT: "4100",
  WEB_ORIGIN: "http://127.0.0.1:3100",
  DEVICE_ID: "dev-device",
  DEVICE_TOKEN: "e2e-device-secret",
  OWNER_ID: "dev-owner",
  WEB_TOKEN: "e2e-browser-secret",
  GSI_AUTH_TOKEN: "e2e-gsi-secret",
  GSI_LISTEN: "127.0.0.1:3102",
  API_URL: "http://127.0.0.1:4100",
  NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:4100",
  NEXT_DIST_DIR: ".next-e2e",
};
function launch(
  cmd: string,
  args: string[],
  cwd?: string,
  extra?: NodeJS.ProcessEnv,
) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...env, ...extra },
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code && !stopping) {
      console.error(`${cmd} exited ${code}`);
      stop(code);
    }
  });
}
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already exited */
      }
    }
  }
  setTimeout(() => process.exit(code), 500).unref();
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
async function ready(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Not ready: ${url}`);
}
launch("pnpm", ["--filter", "@cs2/api", "exec", "tsx", "src/server.ts"]);
await ready("http://127.0.0.1:4100/health");
launch(
  "go",
  [
    "run",
    "./cmd/collector",
    "-session-id",
    "dev-session",
    "-sequence-file",
    join(sequenceDir, "seq.json"),
  ],
  "apps/collector",
  { API_URL: "http://127.0.0.1:4100/v1/telemetry/gsi" },
);
await ready("http://127.0.0.1:3102/health");
launch("pnpm", [
  "--filter",
  "@cs2/web",
  "exec",
  "next",
  "dev",
  "--hostname",
  "127.0.0.1",
  "--port",
  "3100",
]);
