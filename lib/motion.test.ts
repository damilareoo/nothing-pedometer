import { describe, expect, it } from "vitest";
import { DUR, EASE_EMPHASIZED, EASE_OUT, STAGGER } from "./motion";

/**
 * Motion discipline: two curves, five durations, one stagger gap.
 * A component that needs a timing reaches for one of these — there is
 * no sixth duration and no third curve.
 */
describe("motion tokens", () => {
  it("holds exactly two cubic-bezier curves", () => {
    for (const curve of [EASE_OUT, EASE_EMPHASIZED]) {
      expect(curve).toHaveLength(4);
      for (const v of curve) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(EASE_EMPHASIZED).not.toEqual(EASE_OUT);
  });

  it("orders durations from feedback-fast to entrance-slow", () => {
    expect(DUR.micro).toBeLessThan(DUR.fast);
    expect(DUR.fast).toBeLessThan(DUR.base);
    expect(DUR.base).toBeLessThan(DUR.staged);
    expect(DUR.staged).toBeLessThan(DUR.entrance);
    expect(DUR.morph).toBeGreaterThan(DUR.fast);
  });

  it("keeps every duration inside a 120Hz-readable budget", () => {
    for (const d of Object.values(DUR)) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(1.2);
    }
    expect(STAGGER).toBeGreaterThan(0);
    expect(STAGGER).toBeLessThan(DUR.micro);
  });

  it("exposes no duration outside the known set", () => {
    expect(Object.keys(DUR).sort()).toEqual(
      ["base", "entrance", "fast", "micro", "morph", "staged"].sort(),
    );
  });
});
