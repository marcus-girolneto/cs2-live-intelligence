"use client";
import { useI18n } from "@/shared/i18n";
import { Alert, Check } from "@/shared/icons";
import type { Point } from "../model/personal";

function Column({
  kind,
  title,
  items,
  empty,
}: {
  kind: "good" | "bad";
  title: string;
  items: Point[];
  empty: string;
}) {
  return (
    <section className={`pc-col ${kind}`}>
      <h3>
        {kind === "good" ? <Check size={16} /> : <Alert size={16} />} {title}
      </h3>
      {items.length ? (
        <ul>
          {items.map((p, i) => (
            <li key={i}>
              <span>{p.text}</span>
              {p.evidence && <small>{p.evidence}</small>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

/** "What's working" next to "What isn't", each point with its evidence. */
export function PointColumns({
  working,
  notWorking,
}: {
  working: Point[];
  notWorking: Point[];
}) {
  const { t } = useI18n();
  return (
    <div className="pc-cols">
      <Column
        kind="good"
        title={t("What's working")}
        items={working}
        empty={t("Nothing stands out yet.")}
      />
      <Column
        kind="bad"
        title={t("What isn't")}
        items={notWorking}
        empty={t("No recurring problems found.")}
      />
    </div>
  );
}
