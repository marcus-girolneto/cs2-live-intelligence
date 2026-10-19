"use client";
import Link from "next/link";
import { useState } from "react";
import { mapName } from "@/shared/format";
import { GlossaryButton } from "@/shared/glossary";
import { useI18n } from "@/shared/i18n";
import { Chart, Trend, Upload } from "@/shared/icons";
import { Callout, EmptyState, PageHeader, PageLoader } from "@/shared/ui";
import { useJourney } from "../hooks/useJourney";
import { IdentityStep } from "./IdentityStep";
import { JourneySummary } from "./JourneySummary";
import { JourneyTimeline } from "./JourneyTimeline";
import { ProgressHistory } from "./ProgressHistory";

/** /progress: who you are → a plain summary → your matches in order with "did you apply it?". */
export function ProgressScreen() {
  const { t } = useI18n();
  const [map, setMap] = useState<string | null>(null);
  const { data, error, chooseIdentity, rate } = useJourney(map);
  const header = (
    <PageHeader
      eyebrow={t("Your progress")}
      icon={<Trend size={16} />}
      title={t("How you are evolving")}
      lead={t(
        "Your matches in order, what the coach asked you to fix, and whether you did it.",
      )}
      actions={<GlossaryButton />}
    />
  );
  if (error)
    return (
      <main className="page">
        {header}
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      </main>
    );
  if (!data)
    return (
      <main className="page">
        {header}
        <PageLoader />
      </main>
    );
  const { identity, timeline, maps } = data;
  const needsIdentity = identity.status === "missing";
  return (
    <main className="page progress-page">
      {header}
      {needsIdentity && identity.candidates.length > 0 ? (
        <IdentityStep
          candidates={identity.candidates}
          onChoose={chooseIdentity}
        />
      ) : needsIdentity ? (
        <Callout tone="info" title={t("Tell the coach which player you are")}>
          <p>
            {t("Sign in with Steam, or open a demo and press “This is me”.")}
          </p>
          <p>
            <Link href="/history">{t("Open a demo")} →</Link>
          </p>
        </Callout>
      ) : null}

      {!needsIdentity && maps.length > 1 && (
        <div className="chip-filter" role="group" aria-label={t("Map")}>
          <button
            type="button"
            aria-pressed={map === null}
            onClick={() => setMap(null)}
          >
            {t("All maps")}
          </button>
          {maps.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={map === m}
              onClick={() => setMap(m)}
            >
              {mapName(m) ?? m}
            </button>
          ))}
        </div>
      )}

      {!needsIdentity &&
        (timeline.length === 0 ? (
          <EmptyState
            icon={<Chart size={28} />}
            title={
              map
                ? t("No matches on {map} yet", { map: mapName(map) ?? map })
                : t("No matches yet")
            }
            actions={
              <Link className="btn btn-primary" href="/upload">
                <Upload size={16} /> {t("Upload demo")}
              </Link>
            }
          >
            <p>
              {t(
                "Upload a demo you played in. After your second match you'll see whether you applied the coach's plan.",
              )}
            </p>
          </EmptyState>
        ) : (
          <>
            <JourneySummary
              nodes={timeline}
              adherenceRate={data.adherenceRate}
            />
            <JourneyTimeline nodes={timeline} />
            {timeline.length === 1 && (
              <Callout tone="info">
                {t("Upload your next match to see if you applied the plan.")}{" "}
                <Link href="/upload">{t("Upload demo")} →</Link>
              </Callout>
            )}
          </>
        ))}

      <ProgressHistory data={data} rate={rate} />
    </main>
  );
}
