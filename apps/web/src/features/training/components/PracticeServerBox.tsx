"use client";
import { useI18n } from "@/shared/i18n";
import { placeName } from "@/shared/format";
import { Play, Server } from "@/shared/icons";
import { LAUNCH_CS2 } from "../model/links";
import { groupTitle, teleportLabel, TELEPORT_GROUPS } from "../model/copy";
import type { Plan } from "../model/types";
import { CopyButton } from "./CopyButton";
import { TeleportMap } from "./TeleportMap";

/**
 * Private practice server: start CS2, paste the config, then teleport to your own spots.
 * Honest about what the browser can do: it copies commands, it cannot start a map in CS2.
 */
export function PracticeServerBox({
  plan,
  analysisId,
}: {
  plan: Plan;
  analysisId: string | null;
}) {
  const { t } = useI18n();
  const place = (p: string) => placeName(p) ?? p;
  const setup = [
    ...plan.serverSetup.filter((c) => c.startsWith("map ")),
    ...plan.practiceConfig,
  ];
  const bots = plan.serverSetup.filter((c) => !c.startsWith("map "));
  const index = new Map(plan.teleports.map((tp, i) => [tp.id, i + 1]));
  return (
    <section
      className="tr-server"
      aria-labelledby="tr-server-title"
      data-testid="practice-server"
    >
      <header className="tr-server-head">
        <h4 id="tr-server-title">
          <Server size={16} /> {t("Practice server")}
        </h4>
        <a className="btn btn-primary btn-sm" href={LAUNCH_CS2}>
          <Play size={14} /> {t("Launch CS2")}
        </a>
      </header>
      <ol className="tr-server-steps">
        <li>
          {t("Start CS2, open Play, Practice, pick the map with bots off.")}
        </li>
        <li>{t("Open the console and paste the config (copy all).")}</li>
        <li>
          {t(
            "Paste one spot at a time. Your browser cannot start a map inside CS2: we copy the exact commands.",
          )}
        </li>
      </ol>
      <div className="tr-code">
        <pre aria-label={t("Practice config")}>{setup.join("\n")}</pre>
        <CopyButton text={setup.join("; ")} label={t("Copy all")} />
      </div>
      {plan.teleports.length > 0 && (
        <div className="tr-spots">
          <TeleportMap analysisId={analysisId} teleports={plan.teleports} />
          <div className="tr-groups">
            {TELEPORT_GROUPS.map((g) => {
              const list = plan.teleports.filter((tp) =>
                g.kinds.includes(tp.kind),
              );
              if (!list.length) return null;
              return (
                <div key={g.key} className="tr-group">
                  <div className="tr-group-head">
                    <h5>{groupTitle(g.key, t)}</h5>
                    <CopyButton
                      text={list.map((tp) => tp.command).join("\n")}
                      label={t("Copy all")}
                    />
                  </div>
                  <ul>
                    {list.map((tp) => (
                      <li key={tp.id} className={`tr-tp ${tp.kind}`}>
                        <span className="tr-tp-n" aria-hidden>
                          {index.get(tp.id)}
                        </span>
                        <div className="tr-tp-body">
                          <span>{teleportLabel(tp, t, place)}</span>
                          <code>{tp.command}</code>
                          {tp.crouched && (
                            <small className="muted">
                              {t("You were crouching here.")}
                            </small>
                          )}
                        </div>
                        <div className="tr-tp-copy">
                          <CopyButton text={tp.command} />
                          {tp.botPlace && (
                            <CopyButton
                              text={tp.botPlace}
                              label={t("Place a bot")}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {bots.length > 0 && plan.teleports.some((tp) => tp.botPlace) && (
              <p className="muted small">
                {t("For bots: paste {cmd} once, then use Place a bot.", {
                  cmd: bots.join("; "),
                })}
              </p>
            )}
          </div>
        </div>
      )}
      {plan.caveats.length > 0 && (
        <ul className="tr-caveats muted small">
          {plan.caveats.map((c) => (
            <li key={c}>{t(c)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
