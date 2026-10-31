/**
 * Live step-count contract, proxied from the owner's step feed.
 *
 * Two upstream shapes arrive here:
 *
 *   Legacy Health Connect feed (GET /api/steps, Bearer secret):
 *     { today, goal, average7, updatedAt: number, days: [{ date, steps | null }] }
 *
 *   Current portfolio feed (GET /api/steps):
 *     { date, steps, km, averageKm, average7?, reportedDays?, goal?,
 *       updatedAt: ISO string, source, today?: number | null,
 *       days?: [{ date, steps | null }], hours?: number[] | null }
 *
 * The two are normalized into one snapshot. `null` means "nobody reported
 * this day" and is preserved all the way to the UI — never rewritten as a zero,
 * because a day nobody reported is not a day of no walking.
 */

export type StepsDay = { date: string; steps: number | null };

export type StepsSnapshot = {
  /** Today in Lagos, or null when the feed has no report for today. */
  today: number | null;
  goal: number;
  /** Mean of the reported days in the trailing week, in whole steps. */
  average7: number;
  /** How many of the trailing seven days carried a report. */
  reportedDays: number;
  updatedAt: number;
  /** Seven Lagos days, oldest first; unreported days are null. */
  days: StepsDay[];
  /** The most recent day that actually reported, for honest stale copy. */
  lastReported: { date: string; steps: number } | null;
  /** Real hourly steps for `date` when the feed stores intervals. */
  hours: number[] | null;
  source: "intervals" | "total" | "unknown";
};

export type ReadingStatus = "live" | "stale" | "unreported";

/** A step feed posts every half hour; two quiet hours is already news. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** The stride used only when the upstream gives kilometres but not steps. */
const FALLBACK_STRIDE_M = 0.75;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Lagos calendar day — the day the owner is walking through. */
export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A safe count: finite numbers and numeric strings only. Null stays null. */
function count(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

function dateOnly(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.slice(0, 10);
  return DATE.test(d) ? d : null;
}

/** Seven days ending on `end`, with known values where the feed has them. */
function weekEnding(end: string, known: StepsDay[]): StepsDay[] {
  const anchor = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(anchor)) return known.slice(-7);
  const byDate = new Map(known.map((d) => [d.date, d.steps]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(anchor - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, steps: byDate.get(date) ?? null };
  });
}

function parseDays(raw: unknown): StepsDay[] {
  if (!Array.isArray(raw)) return [];
  const out: StepsDay[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const date = dateOnly(r.date);
    if (!date) continue;
    out.push({ date, steps: r.steps === null ? null : count(r.steps) });
  }
  return out;
}

/** Narrow + sanitize either upstream payload. Returns null when unusable. */
export function parseStepsPayload(json: unknown, now = new Date()): StepsSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;

  const knownDays = parseDays(j.days);
  const summaryDate = dateOnly(j.date);
  const summarySteps = count(j.steps);
  const todayKey = lagosToday(now);

  /* A source that only sends one figure still gets a truthful week: the one
     known day, padded with nulls by weekEnding below. */
  if (knownDays.length === 0 && (!summaryDate || summarySteps === null)) return null;

  const known =
    knownDays.length > 0
      ? knownDays
      : [{ date: summaryDate as string, steps: summarySteps as number }];
  const end = summaryDate ?? known[known.length - 1]?.date ?? todayKey;
  const days = known.length >= 7 ? known.slice(-7) : weekEnding(end, known);

  let today: number | null;
  if (j.today === null) {
    today = null;
  } else if (typeof j.today !== "undefined") {
    today = count(j.today);
  } else if (summaryDate === todayKey) {
    today = summarySteps;
  } else {
    today = days.find((d) => d.date === todayKey)?.steps ?? null;
  }

  let lastReported: { date: string; steps: number } | null = null;
  if (summaryDate && summarySteps !== null) {
    lastReported = { date: summaryDate, steps: summarySteps };
  } else {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].steps !== null) {
        lastReported = { date: days[i].date, steps: days[i].steps as number };
        break;
      }
    }
  }

  const reported = days.filter((d): d is { date: string; steps: number } => d.steps !== null);
  const computedAverage = reported.length
    ? Math.round(reported.reduce((a, d) => a + d.steps, 0) / reported.length)
    : 0;

  const averageKm = typeof j.averageKm === "number" && Number.isFinite(j.averageKm) ? j.averageKm : null;
  const average7 =
    count(j.average7) ??
    (averageKm !== null ? Math.round((averageKm * 1000) / FALLBACK_STRIDE_M) : null) ??
    computedAverage;

  const rawUpdated = j.updatedAt;
  const updatedAt =
    typeof rawUpdated === "number"
      ? rawUpdated
      : typeof rawUpdated === "string"
        ? Date.parse(rawUpdated)
        : 0;

  const rawGoal = count(j.goal);
  const goal = rawGoal && rawGoal > 0 ? rawGoal : 10_000;

  const hours =
    Array.isArray(j.hours) && j.hours.length === 24
      ? j.hours.map((v) => count(v) ?? 0)
      : null;

  return {
    today,
    goal,
    average7,
    reportedDays: count(j.reportedDays) ?? reported.length,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    days,
    lastReported,
    hours,
    source:
      j.source === "intervals" || j.source === "total"
        ? j.source
        : "unknown",
  };
}

/** Classify a resolved snapshot against the wall clock. */
export function readingStatus(s: StepsSnapshot, now = Date.now()): ReadingStatus {
  if (s.today === null) return "unreported";
  if (!s.updatedAt || now - s.updatedAt > STALE_AFTER_MS) return "stale";
  return "live";
}
