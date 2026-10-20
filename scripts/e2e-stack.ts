import { spawn, execFile, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { Database } from "../apps/api/src/shared/db/database.js";
import {
  ensureTestDatabase,
  testDatabaseUrl,
} from "../apps/api/test/support/database-url.js";
const run = promisify(execFile);
const children: ChildProcess[] = [];
const sequenceDir = await mkdtemp(join(tmpdir(), "cs2-e2e-"));
const schema = `e2e_${randomUUID().replaceAll("-", "")}`;
// The E2E stack never uses the development database: TEST_DATABASE_URL, or DATABASE_URL with
// the `_test` suffix (cs2live_test), created when missing; one schema per run inside it.
const databaseBase = testDatabaseUrl({
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://cs2:local-development-only@127.0.0.1:55432/cs2live",
})!;
await ensureTestDatabase(databaseBase);
const admin = new Database(databaseBase);
await admin.pool.query(`CREATE SCHEMA "${schema}"`);
const scoped = new URL(databaseBase);
scoped.searchParams.set("options", `-c search_path=${schema}`);
const env = {
  ...process.env,
  API_HOST: "127.0.0.1",
  API_PORT: "4100",
  APP_ENV: "local",
  ALLOW_DEV_AUTH: "true",
  ENABLE_DEV_AUTH: "true",
  DEV_AUTO_LOGIN: "true",
  SAMPLE_DEMO_FILE: join(
    process.cwd(),
    "apps/demo-parser/testdata/public-cs2.dem",
  ),
  DATABASE_URL: scoped.toString(),
  WEB_ORIGIN: "http://127.0.0.1:3100",
  API_PUBLIC_URL: "http://127.0.0.1:4100",
  DEVICE_ID: "dev-device",
  DEVICE_TOKEN: "e2e-device-secret",
  OWNER_ID: "dev-owner",
  WEB_TOKEN: "e2e-browser-secret",
  GSI_AUTH_TOKEN: "e2e-gsi-secret",
  GSI_LISTEN: "127.0.0.1:3102",
  SIMULATOR_URL: "http://127.0.0.1:3110",
  AI_PROVIDER: "e2e-mock",
  AI_BASE_URL: "http://127.0.0.1:3120/v1",
  AI_API_KEY: "e2e-ai-key",
  AI_MODEL: "e2e/mock-model",
  AI_DAILY_LIMIT: "",
  API_URL: "http://127.0.0.1:4100",
  NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:4100",
  NEXT_DIST_DIR: ".next-e2e",
  OBJECT_STORAGE_DIR: join(sequenceDir, "objects"),
  DEMO_PARSER_BIN: join(sequenceDir, "demo-parser"),
  OPENAI_API_KEY: "",
};
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const exited = children.map(
    (child) =>
      new Promise<void>((r) => {
        if (child.exitCode !== null) r();
        else child.once("exit", () => r());
      }),
  );
  for (const child of children)
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* exited */
      }
    }
  await Promise.race([
    Promise.all(exited),
    new Promise((r) => setTimeout(r, 6000)),
  ]);
  for (const child of children)
    if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* exited */
      }
    }
  await admin.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.close();
  await rm(sequenceDir, { recursive: true, force: true });
  process.exit(code);
}
process.on("SIGTERM", () => {
  void stop();
});
process.on("SIGINT", () => {
  void stop();
});
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
  child.on("error", (e) => {
    console.error(e.message);
    void stop(1);
  });
  child.on("exit", (code) => {
    if (code && !stopping) {
      console.error(`${cmd} exited ${code}`);
      void stop(code);
    }
  });
}
async function ready(url: string) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Not ready: ${url}`);
}
try {
  await run("go", ["build", "-o", env.DEMO_PARSER_BIN, "./cmd/demo-parser"], {
    cwd: "apps/demo-parser",
  });
  await run(
    "go",
    ["build", "-o", join(sequenceDir, "collector"), "./cmd/collector"],
    { cwd: "apps/collector" },
  );
  await run(
    "go",
    ["build", "-o", join(sequenceDir, "simulator"), "./cmd/simulator"],
    { cwd: "apps/collector" },
  );
  launch("node", ["--import", "tsx", "scripts/mock-ai-provider.ts"]);
  await ready("http://127.0.0.1:3120/calls");
  launch("pnpm", ["--filter", "@cs2/api", "exec", "tsx", "src/main.ts"]);
  await ready("http://127.0.0.1:4100/ready");
  // The E2E dev owner administers the app (admin.spec); real admins come from Steam sign-in.
  await admin.pool.query(
    `UPDATE "${schema}".users SET role='admin' WHERE id=$1`,
    [env.OWNER_ID],
  );
  launch(
    join(sequenceDir, "collector"),
    [
      "-session-id",
      "dev-session",
      "-sequence-file",
      join(sequenceDir, "seq.json"),
    ],
    undefined,
    { API_URL: "http://127.0.0.1:4100/v1/telemetry/gsi" },
  );
  await ready("http://127.0.0.1:3102/health");
  launch(
    join(sequenceDir, "simulator"),
    ["-url", "http://127.0.0.1:3102/gsi", "-tick", "120ms", "-rounds", "4"],
    undefined,
    { SIMULATOR_LISTEN: "127.0.0.1:3110" },
  );
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
} catch (error) {
  console.error(error);
  await stop(1);
}
