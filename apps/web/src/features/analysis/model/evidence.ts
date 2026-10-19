import type { DemoEvent } from "@cs2/contracts";

/** One-line, auditable description of a demo event (no translation: raw evidence). */
export function describeEvent(event: DemoEvent) {
  const context = `Tick ${event.tick} · round ${event.round} · ${event.type}`;
  if (event.type === "round_end")
    return `${context} · winner ${event.winner ?? "Not available"}`;
  if (event.type !== "kill" && event.type !== "damage") return context;
  const actors = `${event.attackerId ?? "World / unavailable"} → ${event.victimId}`;
  return event.type === "damage"
    ? `${context} · ${actors} · health damage ${event.healthDamage}`
    : `${context} · ${actors} · headshot ${event.headshot ? "yes" : "no"}`;
}
