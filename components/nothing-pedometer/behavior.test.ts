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
    expect(src).toContain("useCountUp(target, visits)");
    expect(src).toContain("useLiveSteps()");
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
    expect(src).toContain("today={week.length - 1}");
  });

  it("feeds the widget, hero, and week chart from the live snapshot", () => {
    expect(src).toContain('fetch("/api/steps"');
    expect(src).toContain("live?.today ?? STEPS");
    expect(src).toContain("live?.days.map");
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
    expect(src).toContain('role="group" aria-label={`${weekday} ${dayMonth}`}');
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

  it("shows what is being shared before the targets", () => {
    expect(src).toContain("Sharing 1 run");
    expect(src).toContain("Morning run ·");
  });

  it("draws brand marks, never text monograms", () => {
    for (const icon of ["XIcon", "InstagramIcon", "WhatsAppIcon", "TelegramIcon"]) {
      expect(src).toContain(icon);
    }
    expect(src).toContain("<r.Icon");
    expect(src).not.toContain('mark: "IG"');
    expect(src).not.toContain('mark: "WA"');
  });

  it("never fakes social proof on the draft", () => {
    expect(src).toContain("Draft · not yet posted");
    expect(src).not.toContain("@nothing · 2m");
  });

  it("stamps messages with the real send time", () => {
    expect(src).toContain("nowHM()");
    expect(src).not.toContain("06:47");
  });

  it("shows live date, never invented weather", () => {
    expect(src).not.toContain("PARTLY SUNNY");
    expect(src).not.toContain("partly sunny 25 degrees");
  });

  it("copies the real run line to the clipboard", () => {
    expect(src).toContain("navigator.clipboard.writeText(runLine)");
  });

  it("opens real share targets instead of faking a post", () => {
    expect(src).toContain("twitter.com/intent/tweet");
    expect(src).toContain("wa.me/?text=");
    expect(src).toContain("t.me/share/url");
    expect(src).toContain("window.open(url");
    expect(src).not.toContain("POSTED ✓");
  });

  it("explains why Instagram copies instead of posting", () => {
    expect(src).toContain("Instagram accepts no direct shares");
  });

  it("hints the first tap, then gets out of the way", () => {
    expect(src).toContain("TAP THE WIDGET");
    expect(src).toContain("fresh={visits === 0}");
  });

  it("badges privacy on the artifact itself", () => {
    expect(src).toContain("HOME HIDDEN");
    expect(src).toContain("rounded-full px-2 py-0.5");
  });

  it("derives platform preview copy from the run", () => {
    expect(src).not.toContain("5.2 km in 32:14");
    expect(src).not.toContain("MORNING LOOP — 5.2 KM");
  });

  it("clamps the goal line so over-goal never breaks it", () => {
    expect(src).toContain("Math.min(1, Math.max(0, frac))");
  });
});
