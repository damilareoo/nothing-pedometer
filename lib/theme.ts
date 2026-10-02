/**
 * Nothing OS 4.1 tokens, sampled from the owner's Phone (2a).
 *
 * Dark values are measured — averaged regions of on-device screenshots:
 * widget black, settings ground/cards, and the red dot at full saturation:
 *   red        #E11A1B  (clock-widget dot core, both homescreens agree)
 *   widget     #1B1A1F  (pedometer card interior)
 *   ground     #232228  (About-phone ground, JPEG lift removed)
 *   card       #333237  (About-phone cards)
 *   wallpaper  navy -> mauve -> pale glow (status-quo gradient behind widgets)
 * Light values are inferred — no light-mode reference was supplied — from
 * Nothing's light language (white cards, black dots, grey ground). They are
 * marked as such so a light screenshot can correct them later.
 */

export type ThemeName = "dark" | "light";

export type Tokens = {
  /** Settings-style ground behind detail/run. */
  ground: string;
  /** Raised cards on the ground. */
  card: string;
  /** Widget black on the wallpaper. */
  widget: string;
  ink: string;
  dim: string;
  faint: string;
  /** The one red. Live position, finish, goal marker — nothing else. */
  red: string;
  /** Dot-matrix ink. */
  dot: string;
  /** Optical correction: light-mode dots render slightly smaller to match
      dark-mode weight (bright-on-dark always reads larger). */
  dotScale: number;
  /** Opacity of unlit matrix dots. */
  unlit: number;
  /** Homescreen wallpaper behind widgets. */
  wallpaper: string;
  /** Dock discs stay black in both themes; only their glyphs adapt. */
  dock: string;
  /** Glyph ink on the dock discs. */
  onDock: string;
  /** Display serif for OS 4.1 page titles ("About phone"). */
  serif: string;
  /** Hairline edge so white surfaces read on pale wallpaper. Transparent in dark. */
  edge: string;
  /** Soft lift for widgets in light. None in dark. */
  pop: string;
};

const SERIF = "Georgia, 'Times New Roman', serif";

export const THEMES: Record<ThemeName, Tokens> = {
  dark: {
    ground: "#232228",
    card: "#333237",
    widget: "#1B1A1F",
    ink: "#FFFFFF",
    dim: "rgba(255,255,255,0.6)",
    faint: "rgba(255,255,255,0.14)",
    red: "#E11A1B",
    dot: "#FFFFFF",
    dotScale: 1,
    unlit: 0.05,
    wallpaper:
      "radial-gradient(120% 90% at 85% 0%, #343B52 0%, transparent 55%), radial-gradient(110% 85% at 90% 55%, #4A3440 0%, transparent 60%), radial-gradient(90% 70% at 8% 100%, #83838B 0%, transparent 55%), #101014",
    dock: "#1B1A1F",
    onDock: "rgba(255,255,255,0.85)",
    serif: SERIF,
    edge: "transparent",
    pop: "none",
  },
  light: {
    ground: "#E9E9EC",
    card: "#FFFFFF",
    widget: "#FFFFFF",
    ink: "#0A0A0A",
    dim: "rgba(10,10,10,0.62)",
    faint: "rgba(10,10,10,0.12)",
    red: "#E11A1B",
    dot: "#2B2B30",
    dotScale: 0.86,
    unlit: 0.08,
    wallpaper:
      "radial-gradient(120% 90% at 85% 0%, #C3CEE8 0%, transparent 55%), radial-gradient(110% 85% at 90% 55%, #E6C6D2 0%, transparent 60%), radial-gradient(90% 70% at 8% 100%, #FFFFFF 0%, transparent 55%), #D8DBE1",
    dock: "#1B1A1F",
    onDock: "#FFFFFF",
    serif: SERIF,
    edge: "rgba(10,10,10,0.10)",
    pop: "0 10px 28px rgba(10,10,10,0.10)",
  },
};
