import { buildApp } from "./app.js";
import { PgRepository } from "./repository.js";
const production = process.env.APP_ENV !== "local";
const allowDev = !production && process.env.ALLOW_DEV_AUTH === "true";
if (!process.env.DATABASE_URL && !allowDev)
  throw new Error(
    "DATABASE_URL required; explicit ALLOW_DEV_AUTH=true is available only with APP_ENV=local",
  );
if (production && process.env.ALLOW_DEV_AUTH === "true")
  throw new Error("Development authentication forbidden in production");
const deviceToken = process.env.DEVICE_TOKEN;
const webToken = process.env.WEB_TOKEN;
if (allowDev && (!deviceToken || !webToken))
  throw new Error(
    "Explicit development auth requires DEVICE_TOKEN and WEB_TOKEN",
  );
const ownerId = process.env.OWNER_ID ?? "dev-owner";
const deviceId = process.env.DEVICE_ID ?? "dev-device";
const repository = process.env.DATABASE_URL
  ? new PgRepository(process.env.DATABASE_URL)
  : undefined;
if (repository) {
  await repository.migrate();
  if (allowDev)
    await repository.seedDev(ownerId, webToken!, deviceId, deviceToken!);
}
const app = await buildApp({
  repository,
  enableLogs: true,
  jobs: repository
    ? {
        storageDir: process.env.OBJECT_STORAGE_DIR ?? ".local/objects",
        parserBin: process.env.DEMO_PARSER_BIN ?? "demo-parser",
        maxUploadBytes: Number(
          process.env.MAX_UPLOAD_BYTES ?? 64 * 1024 * 1024,
        ),
      }
    : undefined,
  devices: allowDev ? [{ deviceId, token: deviceToken!, ownerId }] : [],
  owners: allowDev ? [{ token: webToken!, ownerId }] : [],
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000",
  apiPublicUrl: process.env.API_PUBLIC_URL ?? "http://127.0.0.1:4000",
});
if (repository) app.addHook("onClose", async () => repository.close());
await app.listen({
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 4000),
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void app.close();
  });
