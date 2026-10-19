import { finite } from "../format";

export function Meter({
  value,
  max = 100,
  tone = "accent",
  label,
}: {
  value: number | null;
  max?: number;
  tone?: "accent" | "good" | "bad" | "ct" | "t" | "muted";
  label?: string;
}) {
  const v = finite(value);
  const w =
    v === null || max <= 0 ? 0 : Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <span
      className={`meter tone-${tone}`}
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuenow={v ?? undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
    >
      <i style={{ width: `${w}%` }} />
    </span>
  );
}
