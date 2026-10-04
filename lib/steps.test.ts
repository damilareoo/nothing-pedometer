import { describe, expect, it } from "vitest";
import { parseStepsPayload } from "./steps";

const GOOD = {
  today: 133,
  goal: 10000,
  average7: 8223,
  updatedAt: 1791106577516,
  days: [
    { date: "2026-09-28", steps: 13954 },
    { date: "2026-09-29", steps: 176 },
    { date: "2026-09-30", steps: 2271 },
    { date: "2026-10-01", steps: 8852 },
    { date: "2026-10-02", steps: 24936 },
    { date: "2026-10-03", steps: 7239 },
    { date: "2026-10-04", steps: 133 },
  ],
};

describe("steps contract", () => {
  it("parses the live feed shape", () => {
    const s = parseStepsPayload(GOOD);
    expect(s?.today).toBe(133);
    expect(s?.goal).toBe(10000);
    expect(s?.days).toHaveLength(7);
    expect(s?.days[6].steps).toBe(133);
  });

  it("turns null future days into zeros", () => {
    const s = parseStepsPayload({
      ...GOOD,
      days: [...GOOD.days.slice(0, 5), { date: "2026-10-05", steps: null }, { date: "2026-10-06", steps: null }],
    });
    expect(s?.days[5].steps).toBe(0);
    expect(s?.days[6].steps).toBe(0);
  });

  it("rejects garbage instead of rendering it", () => {
    expect(parseStepsPayload(null)).toBeNull();
    expect(parseStepsPayload({})).toBeNull();
    expect(parseStepsPayload({ today: -50, days: [] })).toBeNull();
  });
});
