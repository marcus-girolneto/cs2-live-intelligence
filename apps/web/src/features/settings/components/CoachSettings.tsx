"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/shared/i18n";
import { Brain } from "@/shared/icons";
import { Callout, Panel, Skeleton } from "@/shared/ui";
import { useSettingsApi } from "../api/context";
import { TONES, ROLES, FOCUS, DETAIL, STYLES } from "../model/coachOptions";
import type { CoachProfile, CoachPreferences } from "../model/types";
export function CoachSettings() {
  const { t } = useI18n();
  const api = useSettingsApi();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .getCoachProfile()
      .then(setProfile)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Request failed."),
      );
  }, [api]);
  if (!profile)
    return (
      <Panel
        id="coach"
        icon={<Brain size={20} />}
        title={t("AI coach personality")}
      >
        {error ? (
          <Callout tone="error" role="alert">
            {t(error)}
          </Callout>
        ) : (
          <Skeleton lines={4} />
        )}
      </Panel>
    );
  const p = profile.preferences;
  const set = (patch: Partial<CoachPreferences>) =>
    setProfile({ ...profile, preferences: { ...p, ...patch } });
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      setProfile(
        await api.saveCoachProfile({
          preferences: profile!.preferences,
          ...(profile!.linkedToSteam
            ? {}
            : { playerSteamId: profile!.playerSteamId || null }),
        }),
      );
      setNotice(
        t("Coach preferences saved. They apply to the next AI request."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      id="coach"
      icon={<Brain size={20} />}
      title={t("AI coach personality")}
      sub={t(
        "The coach reads these preferences on every review and live call, together with what it learned from your matches. Safety and fair-play rules always come first.",
      )}
    >
      <form className="coach-form form-grid" onSubmit={(e) => void save(e)}>
        <fieldset>
          <legend>{t("Play style")}</legend>
          <div className="choice-grid">
            {STYLES.map(([value, label, hint]) => (
              <label
                key={value}
                className={`choice ${p.style === value ? "on" : ""}`}
              >
                <input
                  type="radio"
                  name="style"
                  value={value}
                  checked={p.style === value}
                  onChange={() => set({ style: value })}
                />
                <strong>{t(label)}</strong>
                <small>{t(hint)}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-row">
          <label>
            {t("Tone")}
            <select
              value={p.tone}
              onChange={(e) =>
                set({ tone: e.target.value as CoachPreferences["tone"] })
              }
            >
              {TONES.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Detail")}
            <select
              value={p.detail}
              onChange={(e) =>
                set({ detail: e.target.value as CoachPreferences["detail"] })
              }
            >
              {DETAIL.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Your role")}
            <select
              value={p.role}
              onChange={(e) =>
                set({ role: e.target.value as CoachPreferences["role"] })
              }
            >
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>{t("Focus areas")}</legend>
          <div className="chips">
            {FOCUS.map(([v, l]) => (
              <label
                key={v}
                className={`chip ${p.focusAreas.includes(v) ? "on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={p.focusAreas.includes(v)}
                  onChange={(e) =>
                    set({
                      focusAreas: e.target.checked
                        ? [...p.focusAreas, v]
                        : p.focusAreas.filter((f) => f !== v),
                    })
                  }
                />
                {t(l)}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {t("Custom instructions for your coach")}
          <textarea
            maxLength={1000}
            value={p.instructions}
            placeholder={t(
              "e.g. I play with a fixed five-stack; keep calls short; focus on my T side on Mirage.",
            )}
            onChange={(e) => set({ instructions: e.target.value })}
          />
          <small className="muted">{p.instructions.length}/1000</small>
        </label>
        {!profile.linkedToSteam && (
          <label>
            {t("Your player ID in demos (SteamID64)")}
            <input
              value={profile.playerSteamId ?? ""}
              maxLength={64}
              placeholder="7656119…"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  playerSteamId: e.target.value.trim() || null,
                })
              }
            />
            <small className="muted">
              {t(
                "Used to learn from your matches. Tip: use “This is me” on a demo.",
              )}
            </small>
          </label>
        )}
        {profile.linkedToSteam && (
          <p className="muted small">
            {t(
              "Linked to Steam: the coach learns from you in every demo automatically.",
            )}
          </p>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>
            {t("Save coach preferences")}
          </button>
        </div>
        {notice && (
          <Callout tone="success" role="status">
            {notice}
          </Callout>
        )}
        {error && (
          <Callout tone="error" role="alert">
            {t(error)}
          </Callout>
        )}
      </form>
    </Panel>
  );
}
