import { describe, expect, it } from "vitest";
import { KNOWN_GLYPHS, dotTextWidth } from "./dot-matrix";

describe("dot-matrix glyphs", () => {
  it("covers every glyph the concept renders", () => {
    for (const ch of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ",", ".", ":", "%", "/", " "]) {
      expect(KNOWN_GLYPHS).toContain(ch);
    }
  });

  it("widths a string as 5 columns plus one spacer per glyph", () => {
    // "7,284" is 5 glyphs: 5*6 - 1 spacer columns, times pitch.
    expect(dotTextWidth("7,284", 8)).toBe(29 * 8);
    expect(dotTextWidth("", 8)).toBe(0);
    expect(dotTextWidth("1", 10)).toBe(5 * 10);
  });
});
