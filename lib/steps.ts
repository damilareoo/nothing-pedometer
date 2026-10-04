/**
 * Live step-count contract, proxied from the owner's Health Connect feed.
 *
 * Upstream shape (GET upstream /api/steps, Bearer secret):
 *   { today, goal, average7, updatedAt, days: [{ date, steps | null }] }
 * Null means "no data yet" (future days) — never a negative, never a string.
 * The parser clamps everything into safe integers so a bad payload
 * degrades to zeros instead of breaking the widget.
 */

export type StepsDay = { date: string; steps: number };

export type StepsSnapshot = {
  today: number;
  goal: number;
  average7: number;
  updatedAt: number;
  days: StepsDay[];
};

const cleanCount = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
};

/** Narrow + sanitize an upstream payload. Returns null when unusable. */
export function parseStepsPayload(json: unknown): StepsSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const rawDays = Array.isArray(j.days) ? j.days : [];
  if (rawDays.length === 0) return null;
  const days: StepsDay[] = rawDays.slice(-7).map((d) => {
    const r = (d ?? {}) as Record<string, unknown>;
    return {
      date: typeof r.date === "string" ? r.date : "",
      steps: cleanCount(r.steps),
    };
  });
  return {
    today: cleanCount(j.today),
    goal: typeof j.goal === "number" && j.goal > 0 ? Math.floor(j.goal) : 10000,
    average7: cleanCount(j.average7),
    updatedAt: typeof j.updatedAt === "number" ? j.updatedAt : 0,
    days,
  };
}
