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
 * Light values are measured from the two supplied light screenshots:
 * weather app (light grey ground, white cards, black dots) and homescreen
 * (white widgets + white dock discs on the dark wallpaper):
 *   ground     #E9E9EC  (weather ground, confirmed)
 *   card/widget #FFFFFF  (hourly card + homescreen widgets)
 *   dot/ink    #0A0A0A  (dot-matrix + icon ink, near-black)
 *   dock       #FFFFFF with #0A0A0A glyphs (3 of 4 discs; 4th is a black exception)
 *   wallpaper  dark navy -> mauve (same as dark; wallpaper is theme-independent).
 */

export type ThemeName = "dark" | "light";

export type Tokens = {
  /** Settings-style ground behind detail/run. */
  ground: string;
  /** Raised cards on the ground. */
  card: string;
  /** Widget surface on the wallpaper. Black in dark, white in light. */
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
  /** Homescreen wallpaper behind widgets. Theme-independent: stays dark. */
  wallpaper: string;
  /** Dock discs: black in dark, white in light (4th black disc is an exception). */
  dock: string;
  /** Launcher exception: the one black disc on the light dock. Same as dock in dark. */
  dockAlt: string;
  /** Glyph ink on the exception disc. */
  onDockAlt: string;
  /** Glyph ink on the dock discs. */
  onDock: string;
  /** Display serif for OS 4.1 page titles ("About phone"). */
  serif: string;
  /** Hairline edge so white cards read on the light ground. Transparent in dark. */
  edge: string;
  /** Soft lift for cards in light. None in dark. */
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
    dockAlt: "#1B1A1F",
    onDockAlt: "rgba(255,255,255,0.85)",
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
    dot: "#0A0A0A",
    dotScale: 0.86,
    unlit: 0.08,
    wallpaper:
      "radial-gradient(120% 90% at 85% 0%, #343B52 0%, transparent 55%), radial-gradient(110% 85% at 90% 55%, #4A3440 0%, transparent 60%), radial-gradient(90% 70% at 8% 100%, #83838B 0%, transparent 55%), #101014",
    dock: "#FFFFFF",
    onDock: "#0A0A0A",
    dockAlt: "#1B1A1F",
    onDockAlt: "#FFFFFF",
    serif: SERIF,
    edge: "rgba(10,10,10,0.10)",
    pop: "0 10px 28px rgba(10,10,10,0.10)",
  },
};
