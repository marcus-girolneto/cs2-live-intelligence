import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { DevAccountSeeder } from "./modules/auth/identity.js";
import { Database } from "./shared/db/database.js";

/** Bootstrap: config → database (migrate, dev seed) → app → listen; graceful shutdown. */
const config = loadConfig();
const database = config.databaseUrl
  ? new Database(config.databaseUrl)
  : undefined;
if (database) {
  await database.migrate();
  if (config.devAuth)
    await new DevAccountSeeder(database.db).seed(config.devAuth);
}
const dev = config.devAuth;
const app = await buildApp({
  database,
  closeDatabaseOnClose: true,
  enableLogs: true,
  jobs: database
    ? {
        storageDir: config.storageDir,
        parserBin: config.parserBin,
        maxUploadBytes: config.maxUploadBytes,
        processing: config.demoWorker,
      }
    : undefined,
  devices: dev
    ? [{ deviceId: dev.deviceId, token: dev.deviceToken, ownerId: dev.ownerId }]
    : [],
  owners: dev ? [{ token: dev.webToken, ownerId: dev.ownerId }] : [],
  webOrigin: config.webOrigin,
  apiPublicUrl: config.apiPublicUrl,
});
await app.listen({ host: config.host, port: config.port });
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void app.close();
  });
