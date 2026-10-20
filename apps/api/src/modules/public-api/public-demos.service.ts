import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import { isUuid } from "../../shared/db/rows.js";
import type { StoredAnalysis } from "../matches/matches.dto.js";
import type {
  DemoCatalog,
  DemoSummary,
  PagedDemo,
} from "../matches/demo-catalog.repository.js";
import type { DemosQuery } from "./public-api.dto.js";

/** Port (analyses): an owner's analysis with offline coaching, redacted for API callers. */
export interface PublicAnalysisSource {
  get(ownerId: string, id: string): Promise<StoredAnalysis>;
}
/** Port (coaching): how one player compares to the lobby (deterministic, free). */
export interface LobbySource {
  lobby(
    ownerId: string,
    analysisId: string,
    steamId: string,
  ): Promise<Record<string, unknown>>;
}

export type PublicDemo = DemoSummary & { links: Record<string, string> };
const withoutPosition = (row: PagedDemo): DemoSummary => {
  const demo: Partial<PagedDemo> = { ...row };
  delete demo.position;
  return demo as DemoSummary;
};
type Doc = Record<string, unknown>;

const notFound = (): NotFoundError =>
  new NotFoundError("Demo not found", { code: "not_found" });

export function encodeCursor(position: string, id: string): string {
  return Buffer.from(`${position}|${id}`, "utf8").toString("base64url");
}
export function decodeCursor(cursor: string): {
  createdAt: string;
  id: string;
} {
  const [createdAt = "", id = ""] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split("|");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(createdAt) ||
    !isUuid(id)
  )
    throw new ValidationError("Invalid cursor", { code: "invalid_cursor" });
  return { createdAt, id };
}

/** Demos on /api/v1: list (cursor pages), status, deletion, analysis and one player's view. */
export class PublicDemosService {
  constructor(
    private readonly catalog: DemoCatalog,
    private readonly analyses: PublicAnalysisSource,
    private readonly lobbies: LobbySource,
    private readonly baseUrl: string,
  ) {}

  links(id: string, status?: string): Record<string, string> {
    const self = `${this.baseUrl}/api/v1/demos/${id}`;
    return {
      self,
      ...(status === undefined || status === "complete"
        ? { analysis: `${self}/analysis`, reviews: `${self}/reviews` }
        : {}),
    };
  }

  private view(demo: DemoSummary): PublicDemo {
    return { ...demo, links: this.links(demo.id, demo.status) };
  }

  async list(
    ownerId: string,
    query: DemosQuery,
  ): Promise<{ data: PublicDemo[]; nextCursor: string | null }> {
    const rows = await this.catalog.page(ownerId, {
      limit: query.limit + 1,
      ...(query.cursor ? { cursor: decodeCursor(query.cursor) } : {}),
      ...(query.ownership ? { ownership: query.ownership } : {}),
      ...(query.map ? { map: query.map } : {}),
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      data: page.map((row) => this.view(withoutPosition(row))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor(last.position, last.id)
          : null,
    };
  }

  async get(ownerId: string, id: string): Promise<PublicDemo> {
    const demo = await this.catalog.summary(ownerId, id);
    if (!demo) throw notFound();
    return this.view(demo);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    if (!(await this.catalog.remove(ownerId, id))) throw notFound();
  }

  /** The analysis document; 409 `demo_not_ready` while the demo is queued or processing. */
  private async stored(ownerId: string, id: string): Promise<StoredAnalysis> {
    const demo = await this.catalog.summary(ownerId, id);
    if (!demo) throw notFound();
    if (demo.status !== "complete")
      throw new ConflictError(
        demo.status === "failed"
          ? "This demo could not be analysed"
          : "This demo is still being analysed",
        { code: "demo_not_ready", details: { status: demo.status } },
      );
    return this.analyses.get(ownerId, id);
  }

  async analysis(
    ownerId: string,
    id: string,
    includeEvents: boolean,
  ): Promise<Doc> {
    const stored = await this.stored(ownerId, id);
    const doc = (stored.analysis ?? {}) as Doc;
    return {
      demoId: id,
      map: (doc.map as string | undefined) ?? null,
      provenance: (doc.provenance as Doc | undefined) ?? null,
      rounds: (doc.roundOutcomes as unknown[] | undefined) ?? [],
      players: (doc.players as unknown[] | undefined) ?? [],
      evidence: (doc.evidence as unknown[] | undefined) ?? [],
      caveats: (doc.caveats as unknown[] | undefined) ?? [],
      integrity: (doc.integrity as Doc | undefined) ?? null,
      coaching: stored.coaching ?? null,
      ...(includeEvents ? { events: (doc.events as unknown[]) ?? [] } : {}),
    };
  }

  async player(ownerId: string, id: string, steamId: string): Promise<Doc> {
    const stored = await this.stored(ownerId, id);
    const players = ((stored.analysis as Doc).players ?? []) as Doc[];
    const player = players.find((p) => p.steamId === steamId);
    if (!player)
      throw new NotFoundError("Player not found in this demo", {
        code: "player_not_found",
      });
    return {
      demoId: id,
      steamId,
      player,
      lobby: await this.lobbies.lobby(ownerId, id, steamId),
    };
  }
}
