export function SideTag({ side }: { side: "CT" | "T" | null | undefined }) {
  return (
    <span className={`side-tag ${side ? side.toLowerCase() : "none"}`}>
      {side ?? "–"}
    </span>
  );
}
