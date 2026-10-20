import { sql } from "drizzle-orm";
import type { Db } from "../../shared/db/database.js";
import { isoDate, uuidOrNull, type Row } from "../../shared/db/rows.js";

/** A saved AI review of any kind (player quick/deep or team), as the public API lists it. */
export type SavedReview = {
  id: string;
  demoId: string;
  steamId: string;
  tier: "quick" | "deep" | "team";
  lang: string;
  promptVersion: string;
  creditsSpent: number;
  rating: number | null;
  createdAt: string;
  /** The stored coaching (player) or team review document. */
  payload: unknown;
};

/** Read access to an owner's saved reviews by demo or by id (no cost, no AI call). */
export interface ReviewLookup {
  forDemo(
    ownerId: string,
    demoId: string,
    steamId?: string,
  ): Promise<SavedReview[]>;
  byId(ownerId: string, id: string): Promise<SavedReview | undefined>;
}

const COLUMNS = sql.raw(
  `id,upload_id,steam_id,kind,lang,prompt_version,credits_spent,rating,created_at,payload`,
);
function view(row: Row): SavedReview {
  return {
    id: row.id as string,
    demoId: row.upload_id as string,
    steamId: row.steam_id as string,
    tier: row.kind as SavedReview["tier"],
    lang: row.lang as string,
    promptVersion: row.prompt_version as string,
    creditsSpent: Number(row.credits_spent ?? 0),
    rating: (row.rating as number | null) ?? null,
    createdAt: isoDate(row.created_at),
    payload: row.payload,
  };
}

export class PgReviewLookup implements ReviewLookup {
  constructor(private readonly db: Db) {}

  async forDemo(
    ownerId: string,
    demoId: string,
    steamId?: string,
  ): Promise<SavedReview[]> {
    const player = steamId ? sql` and steam_id=${steamId}` : sql``;
    const r = await this.db.execute(
      sql`select ${COLUMNS} from ai_reviews where owner_id=${ownerId} and upload_id=${uuidOrNull(demoId)}${player} order by created_at desc limit 100`,
    );
    return r.rows.map(view);
  }

  async byId(ownerId: string, id: string): Promise<SavedReview | undefined> {
    const r = await this.db.execute(
      sql`select ${COLUMNS} from ai_reviews where owner_id=${ownerId} and id=${uuidOrNull(id)}`,
    );
    return r.rows[0] ? view(r.rows[0]) : undefined;
  }
}
