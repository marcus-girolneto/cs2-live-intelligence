"use client";
import { useState } from "react";
import { presence, safeImage } from "../format";
import type { SteamProfile } from "../session/account";

export function Avatar({
  profile,
  size = 40,
  ring = true,
  fallback,
}: {
  profile?: SteamProfile | undefined;
  size?: number;
  ring?: boolean;
  fallback?: string;
}) {
  const src = safeImage(
    size > 64
      ? (profile?.avatarUrl ?? profile?.avatarMediumUrl)
      : (profile?.avatarMediumUrl ?? profile?.avatarUrl),
  );
  const state = presence(profile);
  const [broken, setBroken] = useState(false);
  const initials = (profile?.personaName ?? fallback ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`avatar ${ring ? `ring-${state}` : ""}`}
      style={{ width: size, height: size }}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="avatar-initials" style={{ fontSize: size * 0.38 }}>
          {initials}
        </span>
      )}
    </span>
  );
}
