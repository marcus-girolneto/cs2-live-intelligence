import { buildApp } from "./app.js";
const deviceToken = process.env.DEVICE_TOKEN;
const webToken = process.env.WEB_TOKEN;
if (!deviceToken || !webToken)
  throw new Error("DEVICE_TOKEN and WEB_TOKEN must be explicitly configured");
const app = await buildApp({
  devices: [
    {
      deviceId: process.env.DEVICE_ID ?? "dev-device",
      token: deviceToken,
      ownerId: process.env.OWNER_ID ?? "dev-owner",
    },
  ],
  owners: [{ token: webToken, ownerId: process.env.OWNER_ID ?? "dev-owner" }],
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000",
});
await app.listen({
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 4000),
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void app.close();
  });
