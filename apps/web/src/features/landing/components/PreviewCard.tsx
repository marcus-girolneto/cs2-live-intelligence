"use client";
import { BodyDiagram } from "@/features/analysis";
import { LogoMark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { MapPin, WeaponIcon } from "@/shared/icons";
export function PreviewCard() {
  const { t } = useI18n();
  return (
    <div className="preview" aria-label={t("Example analysis")}>
      <div className="preview-head">
        <span
          className="map-tile map-de_mirage"
          style={{ width: 40, height: 40, fontSize: 13 }}
        >
          <span>MIR</span>
        </span>
        <div>
          <strong>Mirage</strong>
          <small>{t("Example from a real public match")}</small>
        </div>
        <span className="preview-score">
          <b className="ct">2</b>:<b className="t">8</b>
        </span>
      </div>
      <div className="preview-stats">
        <span>
          <b>120.7</b>
          <small>ADR</small>
        </span>
        <span>
          <b>11–5</b>
          <small>{t("K–D")}</small>
        </span>
        <span>
          <b>39%</b>
          <small>{t("Accuracy")}</small>
        </span>
        <span>
          <b>19.7s</b>
          <small>{t("Opening")}</small>
        </span>
      </div>
      <BodyDiagram
        hits={{ head: 5, chest: 10, stomach: 10, arms: 2, legs: 2 }}
        total={29}
        compact
      />
      <div className="preview-feed">
        <span className="pf-row">
          <WeaponIcon cls="sniper" size={14} /> AWP
          <b>6 {t("kills")}</b>
        </span>
        <span className="pf-row">
          <MapPin size={14} /> {t("Middle")}
          <b className="good">3–1</b>
        </span>
        <span className="pf-row">
          <MapPin size={14} /> Bombsite A<b className="bad">2–3</b>
        </span>
      </div>
      <p className="preview-ai">
        <LogoMark size={20} />
        {t(
          "“Your AWP holds mid win the round. Your A-site retakes lose it — wait for the flash.”",
        )}
      </p>
    </div>
  );
}
