import { z } from "zod";

/**
 * The only module that reads process.env.
 *
 * The environment holds bootstrap/infrastructure settings only (see .env.example). Everything
 * an operator tunes lives in Postgres and is edited by admins in the app (AI providers, app
 * settings incl. time zone, Steam/Stripe integrations) — it survives restarts and redeploys.
 *
 * - `loadConfig()` validates the boot-time settings once (zod) into a typed AppConfig.
 * - `RuntimeEnv` exposes optional bootstrap fallbacks that the database overrides (AI_*,
 *   STEAM_WEB_API_KEY / STRIPE_* via the integrations module, APP_TIMEZONE), the admin
 *   bootstrap and the sample demo path. They are read on every use.
 */
type Env = Record<string, string | undefined>;

/** Deployment ceiling for uploads; the admin setting maxDemoBytes (default 500 MB) applies below it. */
const DEFAULT_MAX_UPLOAD = 1024 * 1024 * 1024;

const bootSchema = z.object({
  APP_ENV: z.string().optional(),
  ALLOW_DEV_AUTH: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DEVICE_TOKEN: z.string().optional(),
  WEB_TOKEN: z.string().optional(),
  OWNER_ID: z.string().default("dev-owner"),
  DEVICE_ID: z.string().default("dev-device"),
  OBJECT_STORAGE_DIR: z.string().default(".local/objects"),
  DEMO_PARSER_BIN: z.string().default("demo-parser"),
  /** `external`: demos are parsed by the sandboxed worker service (src/worker.ts), not the API. */
  DEMO_WORKER: z.enum(["in-process", "external"]).default("in-process"),
  MAX_UPLOAD_BYTES: z.string().optional(),
  WEB_ORIGIN: z.string().default("http://127.0.0.1:3000"),
  API_PUBLIC_URL: z.string().default("http://127.0.0.1:4000"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.string().optional(),
});

export interface DevAuthConfig {
  ownerId: string;
  webToken: string;
  deviceId: string;
  deviceToken: string;
}
export interface AppConfig {
  production: boolean;
  databaseUrl: string | undefined;
  /** Static development identities (APP_ENV=local, unless ALLOW_DEV_AUTH=false). */
  devAuth: DevAuthConfig | undefined;
  storageDir: string;
  parserBin: string;
  /** Where demos are processed: in this process (dev/tests) or by the dedicated worker. */
  demoWorker: "in-process" | "external";
  maxUploadBytes: number;
  webOrigin: string;
  apiPublicUrl: string;
  host: string;
  port: number;
}

/** Boot configuration; throws the same messages the server always used for unsafe setups. */
export function loadConfig(env: Env = process.env): AppConfig {
  const e = bootSchema.parse(env);
  const production = e.APP_ENV !== "local";
  const databaseUrl = e.DATABASE_URL || undefined;
  // Static development identities follow APP_ENV=local unless ALLOW_DEV_AUTH=false.
  const allowDev =
    !production && (e.ALLOW_DEV_AUTH ?? "true").trim() !== "false";
  if (!databaseUrl && !allowDev)
    throw new Error(
      "DATABASE_URL required; development auth is available only with APP_ENV=local",
    );
  if (production && e.ALLOW_DEV_AUTH === "true")
    throw new Error("Development authentication forbidden in production");
  if (allowDev && (!e.DEVICE_TOKEN || !e.WEB_TOKEN))
    throw new Error(
      "Development auth (APP_ENV=local) requires DEVICE_TOKEN and WEB_TOKEN; set ALLOW_DEV_AUTH=false to disable it",
    );
  return {
    production,
    databaseUrl,
    devAuth: allowDev
      ? {
          ownerId: e.OWNER_ID,
          webToken: e.WEB_TOKEN!,
          deviceId: e.DEVICE_ID,
          deviceToken: e.DEVICE_TOKEN!,
        }
      : undefined,
    storageDir: e.OBJECT_STORAGE_DIR,
    parserBin: e.DEMO_PARSER_BIN,
    demoWorker: e.DEMO_WORKER,
    maxUploadBytes: Number(e.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD),
    webOrigin: e.WEB_ORIGIN,
    apiPublicUrl: e.API_PUBLIC_URL,
    host: e.API_HOST,
    port: Number(e.API_PORT ?? 4000),
  };
}

/** Environment keys of the AI_* fallback configuration (see ai-config). */
export const AI_ENV_KEYS = [
  "AI_PROVIDER",
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_API_STYLE",
  "AI_JSON_MODE",
  "AI_MAX_TOKENS_PARAM",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_TIMEOUT_MS",
  "AI_MAX_ATTEMPTS",
  "AI_TEMPERATURE",
  "AI_HEADERS",
  "AI_EXTRA_BODY",
  "AI_DAILY_LIMIT",
  "AI_MAX_INPUT_BYTES",
  "AI_ALLOW_HTTP",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

export interface AdminBootstrap {
  steamIds: Set<string>;
  firstLogin: boolean;
}

/** Live view of operator-tunable settings; `source` is re-read on every call. */
export class RuntimeEnv {
  constructor(private readonly source: () => Env = () => process.env) {}

  /** The current environment object (Stripe price ids are looked up by key pattern). */
  raw(): Env {
    return this.source();
  }
  aiFallback(): Env {
    const env = this.source();
    return Object.fromEntries(AI_ENV_KEYS.map((key) => [key, env[key]]));
  }
  aiDailyLimit(): string | undefined {
    return this.source().AI_DAILY_LIMIT;
  }
  aiMaxInputBytes(): string | undefined {
    return this.source().AI_MAX_INPUT_BYTES;
  }
  sampleDemoFile(): string | undefined {
    return this.source().SAMPLE_DEMO_FILE;
  }
  timeZone(): string | undefined {
    return this.source().APP_TIMEZONE;
  }
  /** ADMIN_STEAM_IDS (17-digit ids) and ADMIN_BOOTSTRAP=first-login. */
  adminBootstrap(): AdminBootstrap {
    const env = this.source();
    return {
      steamIds: new Set(
        (env.ADMIN_STEAM_IDS ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter((v) => /^[0-9]{17}$/.test(v)),
      ),
      firstLogin: env.ADMIN_BOOTSTRAP?.trim() === "first-login",
    };
  }
}
