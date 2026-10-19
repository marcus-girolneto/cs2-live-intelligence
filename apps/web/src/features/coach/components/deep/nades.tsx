import { Flashbang, HeGrenade, Molotov, Smoke } from "@/shared/icons";
import type { NadeType } from "../../model/deep";

export const NADE_LABEL: Record<NadeType, string> = {
  flash: "Flashbang",
  smoke: "Smoke",
  he: "HE grenade",
  molotov: "Molotov",
  decoy: "Decoy",
};
export function NadeIcon({
  type,
  size = 18,
}: {
  type: NadeType;
  size?: number;
}) {
  const I =
    type === "flash"
      ? Flashbang
      : type === "he"
        ? HeGrenade
        : type === "molotov"
          ? Molotov
          : Smoke;
  return (
    <span className={`nade-ic ${type}`} aria-hidden>
      <I size={size} />
    </span>
  );
}
export const clock = (s: number | null) =>
  s === null
    ? null
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
