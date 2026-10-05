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

  it("opens the picker from a real label tap, never a scripted click", () => {
    expect(src).toContain('htmlFor="photo-upload"');
    expect(src).not.toContain("fileRef.current?.click()");
  });

  it("lets every chart speak and derives its words from the data", () => {
    expect(src).toContain("Steps this week, best");
    expect(src).toContain("Steps by hour today, peak");
    expect(src).toContain("today={week.length - 1}");
    expect(src).toContain('role="slider"');
    expect(src).toContain("aria-valuetext");
    expect(src).toContain("DRAG ACROSS THE CHART");
    expect(src).toContain("TAP A DAY");
  });

  it("gives the range switch and week days 44px-class targets", () => {
    expect(src).toContain("min-h-[44px]");
    expect(src).toContain("min-h-[110px]");
    expect(src).toContain("aria-pressed={isSel}");
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

  it("draws official brand marks, never text monograms or redraws", () => {
    for (const icon of ["XIcon", "InstagramIcon", "WhatsAppIcon", "TelegramIcon"]) {
      expect(src).toContain(icon);
    }
    expect(src).toContain("<r.Icon");
    expect(src).not.toContain('mark: "IG"');
    expect(src).not.toContain('mark: "WA"');
    const icons = readFileSync(join(__dirname, "icons.tsx"), "utf8");
    expect(icons).toContain("Simple Icons, CC0");
    for (const mark of ["M14.234 10.162", "M7.0301.084", "M17.472 14.382", "M11.944 0A12"]) {
      expect(icons).toContain(mark);
    }
    expect(icons.match(/<Brand /g)?.length).toBe(4);
  });

  it("shows the privacy zone extent on the map, not just the erasure", () => {
    expect(src).toContain('strokeDasharray="3 4"');
    expect(src).toContain("HOME ZONE HIDDEN");
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

  it("never falls back to text: image or SAVE, no caption", () => {
    expect(src).not.toContain("navigator.clipboard.writeText");
    expect(src).not.toContain("twitter.com/intent/tweet");
    expect(src).not.toContain("wa.me/?text=");
    expect(src).not.toContain("t.me/share/url");
    expect(src).not.toContain("window.open(url");
    expect(src).not.toContain("shareText");
    expect(src).not.toContain("runLine");
  });

  it("offers SAVE as the guaranteed poster path", () => {
    expect(src).toContain("downloadPoster");
    expect(src).toContain('a.download = "morning-run.png"');
    expect(src).toContain('aria-label="Save poster PNG"');
  });

  it("carries the poster image through the native share sheet", () => {
    expect(src).toContain("sharePosterPNG");
    expect(src).toContain("await navigator.share({ files: [file] })");
    expect(src).not.toContain("morning-run.svg");
    expect(src).not.toContain("html-to-image");
    expect(src).not.toContain("files: [file], text:");
  });

  it("hints the first tap, then gets out of the way", () => {
    expect(src).toContain("TAP THE WIDGET");
    expect(src).toContain("fresh={visits === 0}");
  });

  it("badges privacy on the artifact itself", () => {
    expect(src).toContain("HOME HIDDEN");
    expect(src).toContain("rounded-full px-2 py-0.5");
  });

  it("keeps photos legible: flat scrim, no unlit wash", () => {
    expect(src).toContain("rgba(5,5,8,0.55)");
    expect(src).toContain("dimOpacity={canvas.image ? 0 : t.unlit}");
  });

  it("marks the run as sample beside live steps", () => {
    expect(src).toContain("RUN_SAMPLE");
    expect(src).toContain("· sample");
  });

  it("keeps previews card-only: no caption competes with the poster", () => {
    expect(src).not.toContain("5.2 km in 32:14");
    expect(src).not.toContain("MORNING LOOP — 5.2 KM");
    expect(src).not.toContain("Morning loop done");
    expect(src).not.toContain("Morning loop:");
  });

  it("clamps the goal line so over-goal never breaks it", () => {
    expect(src).toContain("Math.min(1, Math.max(0, frac))");
  });

  it("stages the white 2a on a dark studio floor, full-bleed on the real phone", () => {
    expect(src).toContain("stage-studio");
    expect(src).toContain("p-0 sm:p-6");
    expect(src).not.toContain("px-0 pb-16 pt-2 sm:px-6");
  });

  it("floats the chrome beside the device so it never collides with it", () => {
    expect(src).toContain("calc(50% - 440px)");
    expect(src).toContain("min-h-dvh w-full items-center justify-center");
    expect(src).not.toContain("inset-x-0 top-0 z-40");
  });

  it("frames the concept as a Phone 2a, measured off official renders", () => {
    expect(src).toContain("Nothing Phone 2a pedometer concept");
    expect(src).toContain("sm:aspect-[76.32/161.74]");
    expect(src).toContain("sm:w-[min(382px,calc((100dvh-48px)*0.4719),calc(100vw-48px))]");
    expect(src).toContain("top-[7.5%]");
    expect(src).toContain('"#141416"');
    expect(src).toContain('"#E8E8E6"');
    expect(src).not.toContain("sm:max-h-[calc(100dvh-150px)]");
    expect(src).not.toContain("top-[14px]");
    expect(src).not.toContain("Dynamic Island");
    expect(src.toLowerCase()).not.toContain("iphone");
  });

  it("leaves the phone path untouched: base spacing ships, sm: only dresses desktop", () => {
    expect(src).toContain("px-6 pt-4 font-mono");
    expect(src).toContain("sm:pt-[52px]");
    expect(src).toContain("relative h-dvh w-full sm:aspect-");
    expect(src).toContain("whitespace-nowrap font-mono text-[17px]");
  });

  it("clears every in-screen header below the punch-hole on desktop", () => {
    const heads = src.match(/pt-5 sm:pt-\[42px\]/g) ?? [];
    expect(heads.length).toBe(3);
  });

  it("keeps the readout label to one bounded line, never wrapping", () => {
    expect(src).not.toContain(":00 · STEPS");
    expect(src).toContain("whitespace-nowrap pb-1 text-right");
  });

  it("keeps the 44px range target with a slim 34px visual pill", () => {
    expect(src).toContain("min-h-[44px] min-w-[64px]");
    expect(src).toContain("bottom-[5px] top-[5px]");
  });

  it("names the run concept without promising today's data", () => {
    expect(src).toContain("MORNING RUN ·");
    expect(src).toContain('aria-label="View morning run"');
    expect(src).not.toContain("View today's run");
    expect(src).not.toContain("TODAY&apos;S RUN");
    expect(src).not.toContain("SAMPLE RUN ·");
  });
});
