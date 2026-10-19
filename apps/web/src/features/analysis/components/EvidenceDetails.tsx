import type { DemoEvent, Evidence } from "@cs2/contracts";
import { describeEvent } from "../model/evidence";

export function EvidenceDetails({
  evidence,
  events,
}: {
  evidence: Evidence;
  events: DemoEvent[];
}) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return (
    <details>
      <summary>Source events ({evidence.eventIds.length})</summary>
      {evidence.eventIds.length === 0 ? (
        <p className="muted">Aggregate evidence; no individual events.</p>
      ) : (
        <ul>
          {evidence.eventIds.map((id) => (
            <li key={id}>
              <code>{id}</code>
              <small>
                {byId.has(id)
                  ? describeEvent(byId.get(id)!)
                  : "Event detail not available in this analysis version."}
              </small>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
