import { z } from "zod";

/**
 * The only module that reads process.env.
 *
 * - `loadConfig()` validates the boot-time settings once (zod) into a typed AppConfig.
 * - `RuntimeEnv` exposes the settings an operator may change without a restart (AI_* fallback,
 *   Steam Web API key, admin bootstrap, sample demo, Stripe price ids). They are read on every
 *   use, exactly like before the refactor, so tests and operators can flip them live.
 */
type Env = Record<string, string | undefined>;

const DEFAULT_MAX_UPLOAD = 64 * 1024 * 1024;

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
  /** Static development identities (APP_ENV=local + ALLOW_DEV_AUTH=true only). */
  devAuth: DevAuthConfig | undefined;
  storageDir: string;
  parserBin: string;
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
  const allowDev = !production && e.ALLOW_DEV_AUTH === "true";
  if (!databaseUrl && !allowDev)
    throw new Error(
      "DATABASE_URL required; explicit ALLOW_DEV_AUTH=true is available only with APP_ENV=local",
    );
  if (production && e.ALLOW_DEV_AUTH === "true")
    throw new Error("Development authentication forbidden in production");
  if (allowDev && (!e.DEVICE_TOKEN || !e.WEB_TOKEN))
    throw new Error(
      "Explicit development auth requires DEVICE_TOKEN and WEB_TOKEN",
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
  steamWebApiKey(): string | undefined {
    return this.source().STEAM_WEB_API_KEY;
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
