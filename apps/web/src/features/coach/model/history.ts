/** History compare chips of a Deep review (Pro): metric now vs your previous matches. */
import { text } from "@/shared/format";
import type { HistoryChip } from "./deepTypes";
import { arr, num, obj, first } from "./parse";

export function parseHistory(raw: unknown): HistoryChip[] {
  return arr(raw)
    .map((h): HistoryChip | null => {
      const o = obj(h);
      const label = o && text(first(o, ["label", "metric", "key"]));
      const current = o && num(o, ["current", "value", "now"]);
      const baseline = o && num(o, ["baseline", "average", "previous", "avg"]);
      if (!o || !label || current === null || baseline === null) return null;
      return {
        key: text(o.key) ?? label,
        label,
        current,
        baseline,
        unit: text(o.unit) ?? "",
        better: o.better === "lower" ? "lower" : "higher",
      };
    })
    .filter((x): x is HistoryChip => !!x)
    .slice(0, 8);
}

/** "better" / "worse" / "same" of a history chip. */
export function trendOf(c: HistoryChip): "better" | "worse" | "same" {
  const d = c.current - c.baseline;
  if (Math.abs(d) < 1e-9) return "same";
  return d < 0 === (c.better === "lower") ? "better" : "worse";
}
