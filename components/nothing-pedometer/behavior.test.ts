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
});
