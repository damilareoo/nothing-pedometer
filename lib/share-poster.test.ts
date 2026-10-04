import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { POSTER_H, POSTER_W, sharePosterSVG, type PosterSpec } from "./share-poster";

const posterSrc = readFileSync(join(__dirname, "share-poster.ts"), "utf8");

const SPEC: PosterSpec = {
  dist: "5.2",
  time: "32:14",
  pace: "6'12''",
  kcal: "268",
  when: "06:42",
  route: "M44 200L96 200",
  privacy: true,
  bg: "#0B0B0D",
  ink: "#FFFFFF",
  dot: "#FFFFFF",
  dim: "rgba(255,255,255,0.55)",
  red: "#E11A1B",
};

describe("share poster", () => {
  it("renders a 4:5 poster with the run's words", () => {
    expect(POSTER_W / POSTER_H).toBeCloseTo(0.8);
    const svg = sharePosterSVG(SPEC);
    expect(svg).toContain("KILOMETRES");
    expect(svg).toContain("32:14");
    expect(svg).toContain("HOME HIDDEN");
    expect(svg).toContain("M44 200L96 200");
  });

  it("masks endpoints and drops the badge when privacy is off", () => {
    const svg = sharePosterSVG({ ...SPEC, privacy: false });
    expect(svg).not.toContain("HOME HIDDEN");
    expect(svg).toContain('opacity="1"');
  });

  it("paints gradients and photos without trusting them for legibility", () => {
    const dusk = sharePosterSVG({ ...SPEC, bg: "linear-gradient(165deg, #232838 0%, #0C0C10 100%)" });
    expect(dusk).toContain("linearGradient");
    const photo = sharePosterSVG({ ...SPEC, photo: "data:image/png;base64,AAA" });
    expect(photo).toContain("<image");
    expect(photo).toContain('opacity="0.55"');
    expect(photo).not.toContain('opacity="0.08"');
  });

  it("emits no modern color functions a sharer could choke on", () => {
    const svg = sharePosterSVG(SPEC);
    expect(svg).not.toMatch(/oklch|color-mix/i);
  });

  it("rasterizes to a PNG file social targets accept, never SVG", () => {
    expect(posterSrc).toContain("morning-run.png");
    expect(posterSrc).toContain('"image/png"');
    expect(posterSrc).not.toContain("morning-run.svg");
  });
});
