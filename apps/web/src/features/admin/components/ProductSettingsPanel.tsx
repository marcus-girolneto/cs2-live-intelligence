"use client";
import { useMemo } from "react";
import { useI18n } from "@/shared/i18n";
import { Clock } from "@/shared/icons";
import { Panel } from "@/shared/ui";
import {
  productProblems,
  timeZones,
  type ProductSettings,
} from "../model/settings";

/** Time zone, Personal Coach cadence and the demo upload limit. */
export function ProductSettingsPanel({
  value,
  known,
  onChange,
}: {
  value: ProductSettings;
  /** Settings the server reports (fields it doesn't know yet are disabled). */
  known: Record<string, unknown> | undefined;
  onChange: (next: ProductSettings) => void;
}) {
  const { t } = useI18n();
  const zones = useMemo(timeZones, []);
  const problems = productProblems(value);
  const has = (k: string) => !!known && k in known;
  const set = (patch: Partial<ProductSettings>) =>
    onChange({ ...value, ...patch });
  const num = (
    key: "personalCoachIntervalDays" | "personalCoachNewMatches" | "maxDemoMb",
    label: string,
    hint: string,
    min: number,
    max: number,
    serverKey: string,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        disabled={!has(serverKey)}
        value={value[key]}
        aria-invalid={!!problems[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
      <span className={problems[key] ? "field-error" : "field-hint"}>
        {problems[key]
          ? t(problems[key])
          : has(serverKey)
            ? t(hint)
            : t("Not available on this server yet.")}
      </span>
    </label>
  );
  return (
    <Panel
      title={t("Product")}
      icon={<Clock size={20} />}
      sub={t(
        "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.",
      )}
    >
      <label>
        {t("Time zone")}
        <select
          value={value.timezone}
          disabled={!has("timezone")}
          onChange={(e) => set({ timezone: e.target.value })}
        >
          {(zones.includes(value.timezone)
            ? zones
            : [value.timezone, ...zones]
          ).map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="field-hint">
          {has("timezone")
            ? t("Days and months start at midnight in this zone.")
            : t("Not available on this server yet.")}
        </span>
      </label>
      {num(
        "personalCoachIntervalDays",
        t("Personal Coach: days between new plans"),
        "A player can ask for a new plan after this many days.",
        1,
        90,
        "personalCoachIntervalDays",
      )}
      {num(
        "personalCoachNewMatches",
        t("Personal Coach: new matches for a rewrite"),
        "…or sooner after this many new matches (also the automatic rewrite).",
        1,
        50,
        "personalCoachNewMatches",
      )}
      {num(
        "maxDemoMb",
        t("Demo upload limit (MB)"),
        "Default 500 MB. The web proxy streams uploads up to this size.",
        1,
        1024,
        "maxDemoBytes",
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={value.verifierEnabled}
          disabled={!has("verifierEnabled")}
          onChange={(e) => set({ verifierEnabled: e.target.checked })}
        />
        {t("Verify every review's claims with a second AI pass")}
      </label>
      <span className="field-hint">
        {has("verifierEnabled")
          ? t(
              "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.",
            )
          : t("Not available on this server yet.")}
      </span>
    </Panel>
  );
}
