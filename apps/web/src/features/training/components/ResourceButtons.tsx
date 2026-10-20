"use client";
import { useI18n } from "@/shared/i18n";
import { External, Play } from "@/shared/icons";
import type { Resource } from "../model/types";
import { CopyButton } from "./CopyButton";

/**
 * Steam buttons of a resource. The browser cannot start a map inside CS2: these open Steam
 * (Workshop page / CS2) and copy the exact console command.
 */
export function ResourceButtons({ r }: { r: Resource }) {
  const { t } = useI18n();
  return (
    <div className="tr-actions">
      {r.steamUrl && (
        <a className="btn btn-primary btn-sm" href={r.steamUrl}>
          <Play size={14} /> {t("Open in Steam")}
        </a>
      )}
      {r.webUrl && (
        <a
          className="btn btn-ghost btn-sm"
          href={r.webUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <External size={14} /> {t("Workshop page")}
        </a>
      )}
      {!r.steamUrl && (
        <a className="btn btn-primary btn-sm" href={r.launchUrl}>
          <Play size={14} /> {t("Launch CS2")}
        </a>
      )}
      {r.command && <CopyButton text={r.command} label={t("Copy command")} />}
    </div>
  );
}
