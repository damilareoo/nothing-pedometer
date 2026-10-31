import { describe, expect, it } from "vitest";
import {
  lagosToday,
  parseStepsPayload,
  readingStatus,
  STALE_AFTER_MS,
} from "./steps";

const NOW = new Date("2026-10-21T09:00:00+01:00");

const LEGACY = {
  today: 133,
  goal: 10000,
  average7: 8223,
  updatedAt: 1791106577516,
  days: [
    { date: "2026-10-15", steps: 13954 },
    { date: "2026-10-16", steps: 176 },
    { date: "2026-10-17", steps: 2271 },
    { date: "2026-10-18", steps: 8852 },
    { date: "2026-10-19", steps: 24936 },
    { date: "2026-10-20", steps: 7239 },
    { date: "2026-10-21", steps: 133 },
  ],
};

const CURRENT = {
  configured: true,
  date: "2026-10-21",
  steps: 5622,
  km: 4.28,
  averageKm: 7.51,
  average7: 10013,
  reportedDays: 7,
  goal: 10000,
  today: 5622,
  days: [
    { date: "2026-10-15", steps: 280 },
    { date: "2026-10-16", steps: 6662 },
    { date: "2026-10-17", steps: 10865 },
    { date: "2026-10-18", steps: 3389 },
    { date: "2026-10-19", steps: null },
    { date: "2026-10-20", steps: null },
    { date: "2026-10-21", steps: 5622 },
  ],
  hours: Array.from({ length: 24 }, (_, i) => (i === 8 ? 5622 : 0)),
  updatedAt: "2026-10-21T07:25:33.289Z",
  source: "intervals",
};

describe("steps contract", () => {
  it("parses the legacy feed shape", () => {
    const s = parseStepsPayload(LEGACY, NOW);
    expect(s?.today).toBe(133);
    expect(s?.goal).toBe(10000);
    expect(s?.days).toHaveLength(7);
    expect(s?.days[6].steps).toBe(133);
    expect(s?.average7).toBe(8223);
    expect(s?.updatedAt).toBe(1791106577516);
    expect(s?.lastReported).toEqual({ date: "2026-10-21", steps: 133 });
  });

  it("parses the current portfolio summary shape", () => {
    const s = parseStepsPayload(CURRENT, NOW);
    expect(s?.today).toBe(5622);
    expect(s?.goal).toBe(10000);
    expect(s?.average7).toBe(10013);
    expect(s?.reportedDays).toBe(7);
    expect(s?.updatedAt).toBe(Date.parse("2026-10-21T07:25:33.289Z"));
    expect(s?.hours?.[8]).toBe(5622);
    expect(s?.source).toBe("intervals");
    expect(s?.lastReported).toEqual({ date: "2026-10-21", steps: 5622 });
  });

  it("keeps a day nobody reported null, never zero", () => {
    const s = parseStepsPayload(
      {
        ...CURRENT,
        date: "2026-10-18",
        steps: 3389,
        today: null,
        days: [
          ...CURRENT.days.slice(0, 4),
          { date: "2026-10-19", steps: null },
          { date: "2026-10-20", steps: null },
          { date: "2026-10-21", steps: null },
        ],
      },
      NOW,
    );
    expect(s?.today).toBeNull();
    expect(s?.days[4].steps).toBeNull();
    expect(s?.lastReported).toEqual({ date: "2026-10-18", steps: 3389 });
  });

  it("accepts a summary with no days and fills a truthful week", () => {
    const s = parseStepsPayload(
      {
        date: "2026-10-20",
        steps: 4000,
        averageKm: 6,
        updatedAt: "2026-10-20T18:00:00Z",
      },
      NOW,
    );
    expect(s?.days).toHaveLength(7);
    expect(s?.days[6]).toEqual({ date: "2026-10-20", steps: 4000 });
    expect(s?.days[5]).toEqual({ date: "2026-10-19", steps: null });
    expect(s?.today).toBeNull();
    expect(s?.average7).toBe(8000);
    expect(s?.lastReported).toEqual({ date: "2026-10-20", steps: 4000 });
  });

  it("classifies live, stale, and unreported", () => {
    const live = parseStepsPayload(CURRENT, NOW)!;
    expect(readingStatus(live, NOW.getTime() + 1000)).toBe("live");
    expect(readingStatus(live, NOW.getTime() + STALE_AFTER_MS + 1)).toBe("stale");
    expect(readingStatus({ ...live, today: null }, NOW.getTime())).toBe("unreported");
  });

  it("uses Lagos for the day boundary", () => {
    expect(lagosToday(new Date("2026-10-20T23:30:00Z"))).toBe("2026-10-21");
    expect(lagosToday(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-20");
  });

  it("rejects garbage instead of rendering it", () => {
    expect(parseStepsPayload(null)).toBeNull();
    expect(parseStepsPayload({})).toBeNull();
    expect(parseStepsPayload({ today: -50, days: [] })).toBeNull();
    expect(parseStepsPayload({ days: [{ nope: true }] })).toBeNull();
  });
});
