import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { THEMES } from "./theme";

/**
 * Light truth, locked from the owner's two light screenshots (weather app +
 * homescreen). If any of these fail, a token drifted off-device again.
 */
describe("Nothing OS 4.1 light truth", () => {
  const light = THEMES.light;
  const dark = THEMES.dark;

  it("renders white widgets and dock discs with near-black ink", () => {
    expect(light.widget).toBe("#FFFFFF");
    expect(light.card).toBe("#FFFFFF");
    expect(light.dock).toBe("#FFFFFF");
    expect(light.onDock).toBe("#0A0A0A");
    expect(light.dot).toBe("#0A0A0A");
    expect(light.ink).toBe("#0A0A0A");
  });

  it("keeps the wallpaper dark in both themes (theme-independent)", () => {
    expect(light.wallpaper).toBe(dark.wallpaper);
    expect(light.wallpaper).toContain("#101014");
  });

  it("keeps the one red identical across themes", () => {
    expect(light.red).toBe("#E11A1B");
    expect(dark.red).toBe("#E11A1B");
  });

  it("keeps dark tokens untouched", () => {
    expect(dark.widget).toBe("#1B1A1F");
    expect(dark.dock).toBe("#1B1A1F");
    expect(dark.dot).toBe("#FFFFFF");
  });

  it("renders every dock disc from the same tokens — no exceptions", () => {
    expect(THEMES.light.dock).toBe("#FFFFFF");
    expect(THEMES.light.onDock).toBe("#0A0A0A");
  });
});

describe("share artifact follows the theme", () => {
  const src = readFileSync(
    join(__dirname, "..", "components", "nothing-pedometer", "experience.tsx"),
    "utf8",
  );

  it("has no hard-coded black share card left", () => {
    expect(src).not.toContain("bg-[#0B0B0D]");
  });

  it("threads tokens into the share card and its previews", () => {
    expect(src).toContain("function ShareCard({ t,");
    expect(src).toContain("<ShareCard t={t}");
  });

  it("keeps no per-disc dock exception in the render", () => {
    expect(src).not.toContain("dockAlt");
  });
});
