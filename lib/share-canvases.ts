/**
 * Share-card canvases: the backgrounds a run poster can sit on.
 *
 * Curated, not a color picker — an open hue wheel is how a concept stops
 * looking like Nothing. Four solid inks plus one image-like gradient;
 * every canvas carries its own ink/dot/dim so contrast is guaranteed
 * rather than hoped for. Onyx is the default: the artifact's identity.
 * Volt is Nothing's Ear (a) yellow — primary, playful, black ink only.
 */

export type ShareCanvas = {
  id: string;
  label: string;
  /** CSS background for the card. */
  bg: string;
  /** Primary text + stat ink on `bg`. */
  ink: string;
  /** Dot-matrix + trace ink on `bg`. */
  dot: string;
  /** Secondary text on `bg`. */
  dim: string;
  /** Picker swatch preview. */
  swatch: string;
  /** Custom photo URL. Present only on the photo canvas. */
  image?: string;
};

export const SHARE_CANVASES: ShareCanvas[] = [
  {
    id: "onyx",
    label: "Onyx",
    bg: "#0B0B0D",
    ink: "#FFFFFF",
    dot: "#FFFFFF",
    dim: "rgba(255,255,255,0.55)",
    swatch: "#0B0B0D",
  },
  {
    id: "bone",
    label: "Bone",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    dot: "#0A0A0A",
    dim: "rgba(10,10,10,0.6)",
    swatch: "#FFFFFF",
  },
  {
    id: "signal",
    label: "Signal",
    bg: "#E11A1B",
    ink: "#FFFFFF",
    dot: "#FFFFFF",
    dim: "rgba(255,255,255,0.78)",
    swatch: "#E11A1B",
  },
  {
    id: "volt",
    label: "Volt",
    bg: "#FFD60A",
    ink: "#0A0A0A",
    dot: "#0A0A0A",
    dim: "rgba(10,10,10,0.62)",
    swatch: "#FFD60A",
  },
  {
    id: "dusk",
    label: "Dusk run",
    bg: "linear-gradient(165deg, #232838 0%, #4A3440 52%, #0C0C10 100%)",
    ink: "#FFFFFF",
    dot: "#FFFFFF",
    dim: "rgba(255,255,255,0.6)",
    swatch: "linear-gradient(165deg, #4A3440 0%, #0C0C10 100%)",
  },
];

/**
 * A custom-photo canvas. The photo always sits under a dark scrim with
 * white ink — uploads vary wildly, so legibility is enforced structurally
 * rather than trusted to the image.
 */
export function photoCanvas(imageUrl: string): ShareCanvas {
  return {
    id: "photo",
    label: "Photo",
    bg: "#0B0B0D",
    ink: "#FFFFFF",
    dot: "#FFFFFF",
    dim: "rgba(255,255,255,0.72)",
    swatch: imageUrl,
    image: imageUrl,
  };
}
