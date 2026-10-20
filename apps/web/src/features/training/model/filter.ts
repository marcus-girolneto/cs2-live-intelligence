import type { Resource, Skill } from "./types";

/** Catalog filter: by skill and by map (resources without maps fit every map). */
export function filterResources(
  list: Resource[],
  skill: Skill | "all",
  map: string | "all",
): Resource[] {
  return list.filter(
    (r) =>
      (skill === "all" || r.skill === skill) &&
      (map === "all" || r.maps.length === 0 || r.maps.includes(map)),
  );
}
/** Maps that have a per-map resource, in catalog order. */
export const catalogMaps = (list: Resource[]): string[] => [
  ...new Set(list.flatMap((r) => r.maps)),
];
