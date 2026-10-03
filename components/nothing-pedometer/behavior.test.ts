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
