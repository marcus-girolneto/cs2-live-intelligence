/** DTO → view model for the training API (defensive: unknown shapes become empty). */
import { isSafeTrainingUrl, LAUNCH_CS2, safeCommand } from "./links";
import {
  SKILLS,
  type Catalog,
  type Clip,
  type DayStep,
  type Plan,
  type PracticeDay,
  type Recommended,
  type Resource,
  type Session,
  type Skill,
  type Step,
  type Teleport,
  type TeleportKind,
} from "./types";

type O = Record<string, unknown>;
const obj = (v: unknown): O =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as O) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max = 400): string | null =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strings = (v: unknown, max = 400) =>
  arr(v)
    .map((x) => str(x, max))
    .filter((x): x is string => x !== null);
const skill = (v: unknown): Skill | null =>
  SKILLS.includes(v as Skill) ? (v as Skill) : null;
const STEPS: Step[] = ["review", "warmup", "habit", "focus", "debrief"];
const step = (v: unknown): Step | null =>
  STEPS.includes(v as Step) ? (v as Step) : null;
const KINDS: TeleportKind[] = [
  "death",
  "enemy",
  "lineup",
  "teamflash",
  "crosshair",
];

export function normalizeResource(v: unknown): Resource | null {
  const o = obj(v);
  const links = obj(o.links);
  const id = str(o.id, 64);
  const s = skill(o.skill);
  const title = str(o.title, 120);
  if (!id || !s || !title) return null;
  const wid = str(o.workshopId, 12);
  return {
    id,
    skill: s,
    title,
    kind: o.kind === "workshop" ? "workshop" : "official",
    workshopId: wid && /^[0-9]{6,12}$/.test(wid) ? wid : null,
    maps: strings(o.maps, 32),
    minutes: num(o.minutesPerSession) ?? 10,
    howTo: strings(o.howTo, 200),
    tags: strings(o.tags, 40),
    steamUrl: isSafeTrainingUrl(links.steam) ? links.steam : null,
    webUrl: isSafeTrainingUrl(links.web) ? links.web : null,
    launchUrl: isSafeTrainingUrl(links.launch) ? links.launch : LAUNCH_CS2,
    command: safeCommand(links.command),
    subscriptions: num(obj(o.verified).subscriptions),
  };
}

export function normalizeCatalog(v: unknown): Catalog {
  const o = obj(v);
  return {
    verifiedAt: str(o.verifiedAt, 40),
    resources: arr(o.entries)
      .map(normalizeResource)
      .filter((r): r is Resource => r !== null),
  };
}

const clip = (v: unknown): Clip | null => {
  const o = obj(v);
  const round = num(o.round);
  const from = num(o.from);
  const to = num(o.to);
  const focus = str(o.focusSteamId, 128);
  if (round === null || from === null || to === null || !focus) return null;
  return {
    round,
    from,
    to,
    focusSteamId: focus,
    eventIds: strings(o.eventIds, 128),
    ...(str(o.label, 200) ? { label: str(o.label, 200)! } : {}),
  };
};

function session(v: unknown): Session | null {
  const o = obj(v);
  const id = str(o.id, 128);
  const st = step(o.step);
  if (!id || !st) return null;
  const params: Record<string, string | number> = {};
  for (const [k, p] of Object.entries(obj(o.params)))
    if (typeof p === "string") params[k] = p.slice(0, 80);
    else if (num(p) !== null) params[k] = p as number;
  return {
    id,
    step: st,
    skill: skill(o.skill),
    code: str(o.code, 40) ?? "",
    params,
    title: str(o.title) ?? "",
    why: str(o.why) ?? "",
    criteria: str(o.successCriteria) ?? "",
    minutes: num(o.minutes) ?? 10,
    resourceIds: strings(o.resourceIds, 128),
    teleportIds: strings(o.teleportIds, 128),
    clips: arr(o.clips)
      .map(clip)
      .filter((c): c is Clip => c !== null),
  };
}

function teleport(v: unknown): Teleport | null {
  const o = obj(v);
  const id = str(o.id, 128);
  const kind = KINDS.includes(o.kind as TeleportKind)
    ? (o.kind as TeleportKind)
    : null;
  const command = safeCommand(o.command);
  const x = num(o.x);
  const y = num(o.y);
  if (!id || !kind || !command || x === null || y === null) return null;
  return {
    id,
    kind,
    round: num(o.round),
    callout: str(o.callout, 64),
    grenade: str(o.grenade, 16),
    command,
    botPlace: safeCommand(o.botPlace),
    crouched: o.crouched === true,
    approximate: o.approximate === true,
    x,
    y,
  };
}

export function normalizePlan(v: unknown): Plan | null {
  const o = obj(v);
  if (o.version !== "training-1") return null;
  const mindset = obj(o.mindset);
  return {
    map: str(o.map, 64),
    side: o.side === "CT" || o.side === "T" ? o.side : null,
    area: str(o.area, 64),
    role: str(o.role, 20),
    focus: arr(o.focus)
      .map(skill)
      .filter((s): s is Skill => s !== null),
    mindset: str(mindset.text) ?? "",
    mindsetCode: skill(mindset.code),
    sessions: arr(o.sessions)
      .map(session)
      .filter((s): s is Session => s !== null),
    practiceConfig: arr(o.practiceConfig)
      .map(safeCommand)
      .filter((c): c is string => c !== null),
    serverSetup: arr(o.serverSetup)
      .map(safeCommand)
      .filter((c): c is string => c !== null),
    teleports: arr(o.teleports)
      .map(teleport)
      .filter((t): t is Teleport => t !== null),
    caveats: strings(o.caveats),
  };
}

const dayStep = (v: unknown): DayStep | null => {
  const o = obj(v);
  const st = step(o.step);
  if (!st) return null;
  return {
    step: st,
    minutes: num(o.minutes) ?? 10,
    skill: skill(o.skill),
    resourceId: str(o.resourceId, 64),
  };
};

export function normalizeWeek(v: unknown): PracticeDay[] {
  return arr(v)
    .map((d) => {
      const o = obj(d);
      const day = num(o.day);
      if (day === null) return null;
      return {
        day,
        rest: o.rest === true,
        focus: skill(o.focus),
        steps: arr(o.steps)
          .map(dayStep)
          .filter((s): s is DayStep => s !== null),
      };
    })
    .filter((d): d is PracticeDay => d !== null);
}

export function normalizeRecommended(v: unknown): Recommended {
  const o = obj(v);
  const latest = obj(o.latest);
  const plan = normalizePlan(latest.training);
  const analysisId = str(latest.analysisId, 64);
  return {
    steamId: str(o.steamId, 64),
    latest:
      plan && analysisId
        ? {
            analysisId,
            createdAt: str(latest.createdAt, 40),
            map: str(latest.map, 64),
            plan,
          }
        : null,
    focus: arr(o.focus)
      .map(skill)
      .filter((s): s is Skill => s !== null),
    week: normalizeWeek(o.week),
  };
}
