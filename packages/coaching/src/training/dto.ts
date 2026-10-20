/** Catalog as served by GET /v1/training/catalog (links built here, verification attached). */
import type { CatalogEntryDto } from "@cs2/contracts";
import { TRAINING_CATALOG, type CatalogEntry } from "./catalog.js";
import { resourceLinks } from "./links.js";
import snapshot from "./catalog.verified.json" with { type: "json" };
import type { VerifiedSnapshot } from "./verify.js";

export const VERIFIED: VerifiedSnapshot = snapshot as VerifiedSnapshot;

export function catalogEntryDto(entry: CatalogEntry): CatalogEntryDto {
  const record = VERIFIED.records.find(
    (r) => r.workshopId === entry.workshopId && r.ok,
  );
  return {
    id: entry.id,
    skill: entry.skill,
    title: entry.title,
    kind: entry.kind,
    ...(entry.workshopId ? { workshopId: entry.workshopId } : {}),
    ...(entry.mapName ? { mapName: entry.mapName } : {}),
    ...(entry.maps ? { maps: [...entry.maps] } : {}),
    url: entry.url,
    minutesPerSession: entry.minutesPerSession,
    howTo: [...entry.howTo],
    tags: [...entry.tags],
    links: resourceLinks(entry),
    ...(record
      ? {
          verified: {
            at: VERIFIED.verifiedAt,
            subscriptions: record.subscriptions,
          },
        }
      : {}),
  };
}

/**
 * Only entries that verified (official entries need no Workshop record). An unverified
 * Workshop id is never served, even if the test that guards the snapshot was skipped.
 */
export const trainingCatalog = (): CatalogEntryDto[] =>
  TRAINING_CATALOG.filter(
    (e) =>
      !e.workshopId ||
      VERIFIED.records.some((r) => r.workshopId === e.workshopId && r.ok),
  ).map(catalogEntryDto);
