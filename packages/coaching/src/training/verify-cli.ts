/**
 * pnpm training:verify: asks Steam about every Workshop id of the catalog and writes
 * catalog.verified.json next to this file. Exits 1 when any entry fails verification.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TRAINING_CATALOG } from "./catalog.js";
import {
  asciiJson,
  detailsRequestBody,
  STEAM_DETAILS_URL,
  verifyEntry,
  type SteamFileDetails,
  type VerifiedSnapshot,
} from "./verify.js";

const entries = TRAINING_CATALOG.filter((e) => e.workshopId);
const ids = entries.map((e) => e.workshopId!);
const response = await fetch(STEAM_DETAILS_URL, {
  method: "POST",
  body: detailsRequestBody(ids),
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error(`Steam answered ${response.status}`);
const json = (await response.json()) as {
  response?: { publishedfiledetails?: SteamFileDetails[] };
};
const byId = new Map(
  (json.response?.publishedfiledetails ?? []).map((d) => [
    d.publishedfileid,
    d,
  ]),
);
const records = entries.map((e) => verifyEntry(e, byId.get(e.workshopId!)));
const snapshot: VerifiedSnapshot = {
  source: STEAM_DETAILS_URL,
  verifiedAt: new Date().toISOString(),
  records,
};
const out = fileURLToPath(new URL("./catalog.verified.json", import.meta.url));
writeFileSync(out, asciiJson(snapshot));
for (const r of records)
  console.log(
    `${r.ok ? "ok  " : "FAIL"} ${r.workshopId} ${r.title}${r.problems.length ? ` (${r.problems.join("; ")})` : ""}`,
  );
const failed = records.filter((r) => !r.ok).length;
console.log(`${records.length - failed}/${records.length} verified -> ${out}`);
if (failed) process.exit(1);
