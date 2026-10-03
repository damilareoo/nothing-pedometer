import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { KNOWN_GLYPHS, dotTextWidth } from "./dot-matrix";

const LABELS = ["TOTAL TODAY", "7-DAY AVERAGE", "PARTLY SUNNY", "FRIDAY", "162", "7,442", "25°"];

describe("dot-matrix glyphs", () => {
  it("covers every glyph the concept renders", () => {
    for (const word of LABELS) {
      for (const ch of word.toUpperCase()) {
        expect(KNOWN_GLYPHS).toContain(ch);
      }
    }
    for (const ch of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ",", ".", ":", "%", "/", "-", " "]) {
      expect(KNOWN_GLYPHS).toContain(ch);
    }
  });

  it("widths a string as 5 columns plus one spacer per glyph", () => {
    // "7,442" is 5 glyphs: 5*6 - 1 spacer columns, times pitch.
    expect(dotTextWidth("7,442", 8)).toBe(29 * 8);
    expect(dotTextWidth("", 8)).toBe(0);
    expect(dotTextWidth("1", 10)).toBe(5 * 10);
  });

  it("keeps every glyph a clean 5x7 grid", () => {
    expect(KNOWN_GLYPHS).toHaveLength(45);
    const src = readFileSync("components/nothing-pedometer/dot-matrix.tsx", "utf8");
    const grids = src.match(/"[01]{5}"(?:,\s*"[01]{5}"){6}/g) ?? [];
    expect(grids).toHaveLength(45);
  });
});
