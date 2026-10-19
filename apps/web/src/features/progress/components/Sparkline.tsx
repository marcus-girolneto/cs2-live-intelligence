/** Tiny single-series trend line (decorative; the numbers are shown next to it). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 96;
  const H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (W - 4) + 2,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const last = pts[pts.length - 1]!;
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden
    >
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" />
    </svg>
  );
}
