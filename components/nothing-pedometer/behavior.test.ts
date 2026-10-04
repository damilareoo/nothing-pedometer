import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "experience.tsx"), "utf8");

/**
 * Behavior wiring guards. These assert the wiring exists, not how it
 * renders — rendering lives on-device and on :3001, not in node.
 */
describe("behavior wiring", () => {
  it("keeps privacy zones on by default", () => {
    expect(src).toContain("const [privacy, setPrivacy] = useState(true)");
  });

  it("threads the privacy flag into the trace and every share card", () => {
    expect(src).toContain("privateZones={privacy}");
    const threaded = (src.match(/privateZones=\{privacy\}/g) ?? []).length;
    // RouteMap + ShareCard x3: every trace of home must be maskable.
    expect(threaded).toBeGreaterThanOrEqual(4);
  });

  it("counts the hero steps up on first visit, never statically", () => {
    expect(src).toContain("const steps = useCountUp(STEPS, visits)");
  });
});

describe("reduced motion", () => {
  it("drops the shared-element morph (one stage at a time, no flight)", () => {
    expect(src).toContain('const shellId = reduced ? undefined : "pedometer-shell"');
  });

  it("holds the run trace on a static frame instead of animating it", () => {
    expect(src).toContain("paint(0.55)");
  });

  it("zeroes container transitions and staged offsets", () => {
    expect(src).toContain("duration: reduced ? 0 : DUR.morph");
    expect(src).toContain("y: reduced ? 0");
  });

  it("wires a custom-photo canvas with enforced legibility", () => {
    expect(src).toContain('accept="image/*"');
    expect(src).toContain("URL.createObjectURL");
    expect(src).toContain("URL.revokeObjectURL");
    expect(src).toContain("canvas.image");
  });

  it("lets every chart speak and derives its words from the data", () => {
    expect(src).toContain("Steps this week, best");
    expect(src).toContain("Steps by hour today, peak");
    expect(src).toContain("today={WEEK.length - 1}");
  });

  it("derives every number in the prose from the fixtures", () => {
    for (const token of ["GOAL_PCT", "GOAL_TO_GO", "WEEK_AVG", "WEEK_BEST", "PEAK_HOUR", "PEAK_STEPS", "RUN.dist", "RUN.time", "RUN.kcal", "RUN.pace", "RUN.when"]) {
      expect(src).toContain(token);
    }
    for (const stale of ["AVG 7,305", "73%</span> OF 10,000", "2,716 TO GO", "Morning run · 06:42{"]) {
      expect(src).not.toContain(stale);
    }
  });

  it("announces the share sheet as a dialog without double-speaking", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
  });

  it("speaks system share: target grid, scrim dismiss, no cancel button", () => {
    expect(src).toContain('aria-label="Share targets"');
    expect(src).not.toContain("CANCEL");
  });

  it("groups the date card as one announcement", () => {
    expect(src).toContain("partly sunny 25 degrees");
  });

  it("marks the live position red on the goal line, like the OS range bars", () => {
    expect(src).toContain("isNow ? t.red");
  });

  it("goes back with the OS arrow, never a chevron", () => {
    expect(src).toContain("<ArrowLeft size={20} />");
    expect(src).not.toContain("Chevron");
  });

  it("keeps the hidden-zone label inside the viewport", () => {
    expect(src).toContain("HOME ZONE HIDDEN");
    expect(src).toContain('ends.sx < 80 ? "start" : "middle"');
  });

  it("shows the privacy toggle armed, like the OS master switch", () => {
    expect(src).toContain("{privacy && <span");
  });

  it("gives share a 44px icon-plus-label target", () => {
    expect(src).toContain("min-h-[44px]");
    expect(src).toContain("<ShareIcon size={18} />");
  });

  it("lets elevation speak its total climb", () => {
    expect(src).toContain("ELEV_GAIN");
    expect(src).toContain("Elevation profile, plus");
  });
});
