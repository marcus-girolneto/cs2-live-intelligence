export function Skeleton({
  lines = 3,
  height,
  className = "",
}: {
  lines?: number;
  height?: number;
  className?: string;
}) {
  return height ? (
    <div className={`skeleton ${className}`} style={{ height }} aria-hidden />
  ) : (
    <div className={`skeleton-lines ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="skeleton"
          style={{ width: `${92 - i * 14}%` }}
        />
      ))}
    </div>
  );
}
