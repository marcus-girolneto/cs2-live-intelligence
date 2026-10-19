/** Removes model identity from stored coaching before it reaches a non-admin viewer. */
export function publicCoaching<T>(coaching: T): T {
  if (!coaching || typeof coaching !== "object") return coaching;
  const c = coaching as Record<string, unknown>;
  const provenance = c.provenance as Record<string, unknown> | undefined;
  if (!provenance || typeof provenance !== "object") return coaching;
  const rest = { ...provenance };
  delete rest.model;
  delete rest.provider;
  const verification = rest.verification as Record<string, unknown> | undefined;
  if (verification && typeof verification === "object") {
    const v = { ...verification };
    delete v.verifierModel;
    rest.verification = v;
  }
  return { ...c, provenance: rest } as T;
}

/**
 * Authorization policy for AI provenance: which model/provider powers the coach is never
 * revealed to non-admins (in analyses, reviews, live calls, call metadata and AI errors).
 */
export class ViewerPolicy {
  private constructor(readonly admin: boolean) {}
  static for(admin: boolean): ViewerPolicy {
    return new ViewerPolicy(admin);
  }
  coaching<T>(coaching: T): T {
    return this.admin ? coaching : publicCoaching(coaching);
  }
  review<T extends { coaching: unknown }>(review: T): T {
    return this.admin
      ? review
      : {
          ...review,
          provider: undefined,
          model: undefined,
          coaching: publicCoaching(review.coaching),
        };
  }
  liveCall<T extends object>(call: T): T {
    return this.admin ? call : { ...call, model: undefined };
  }
  /** Model call metadata: admins see all of it, others only latency and attempts. */
  callMeta<T extends { latencyMs: number; attempts: number }>(
    meta: T,
  ): T | { latencyMs: number; attempts: number } {
    return this.admin
      ? meta
      : { latencyMs: meta.latencyMs, attempts: meta.attempts };
  }
}
