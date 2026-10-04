import { describe, expect, it } from "vitest";
import { SHARE_CANVASES, photoCanvas } from "./share-canvases";

function lum(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i + 1, i + 3), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Solid-bg canvases only — gradients carry their own dark base. */
const SOLID = SHARE_CANVASES.filter((c) => c.bg.startsWith("#"));

describe("share canvases", () => {
  it("offers a tight curated set with unique ids", () => {
    expect(SHARE_CANVASES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(SHARE_CANVASES.map((c) => c.id)).size).toBe(SHARE_CANVASES.length);
  });

  it("opens on Onyx — the artifact's identity", () => {
    expect(SHARE_CANVASES[0].id).toBe("onyx");
  });

  it("keeps dot-matrix ink legible on every solid canvas", () => {
    for (const c of SOLID) {
      // Large dot numerals: 3:1 floor, monochrome pairings far above it.
      expect(contrast(c.dot, c.bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the red reserved: only Signal spends the hue", () => {
    const hueSpenders = SHARE_CANVASES.filter((c) => c.bg.toUpperCase().includes("E11A1B"));
    expect(hueSpenders.map((c) => c.id)).toEqual(["signal"]);
  });

  it("builds a legible photo canvas: white ink over scrim, never trusted to the image", () => {
    const c = photoCanvas("blob:photo");
    expect(c.id).toBe("photo");
    expect(c.image).toBe("blob:photo");
    expect(c.ink).toBe("#FFFFFF");
    expect(c.dot).toBe("#FFFFFF");
  });

  it("stays legible even when the photo URL is empty", () => {
    const c = photoCanvas("");
    expect(c.ink).toBe("#FFFFFF");
    expect(c.dot).toBe("#FFFFFF");
    expect(c.bg).toBe("#0B0B0D");
  });
});
