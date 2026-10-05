import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "opengraph-image.tsx"), "utf8");

/**
 * The link unfurl carries only the day's count as dot-matrix — no route,
 * no run copy, no labels. The count is live over the fixtures seam.
 */
describe("opengraph image", () => {
  it("renders only the dot-matrix count", () => {
    expect(src).toContain("dotTextDots");
    expect(src).not.toContain("ROUTE");
    expect(src).not.toContain("MORNING RUN");
    expect(src).not.toContain("KILOMETRES");
    expect(src).not.toContain("UNOFFICIAL CONCEPT");
  });

  it("counts the live day, refreshing hourly", () => {
    expect(src).toContain("parseStepsPayload");
    expect(src).toContain("STEPS_API_SECRET");
    expect(src).toContain("revalidate");
  });
});
