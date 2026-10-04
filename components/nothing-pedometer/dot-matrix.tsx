/**
 * Dot-matrix type for the Nothing pedometer concept.
 *
 * Nothing's NDot is a licensed 5-dot-wide matrix face. This is a clean-room
 * evocation of it: a 5x7 grid per glyph, lit dots at full ink, unlit dots
 * kept present at a low floor so the matrix reads on any ground.
 *
 * Covers 0-9, A-Z, and the punctuation the concept needs. Widget labels on
 * Nothing OS are dot-matrix capitals ("TOTAL TODAY", "PARTLY SUNNY"), so the
 * full alphabet is load-bearing, not decoration.
 */

const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "°": ["01100", "01100", "00000", "00000", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

/** Every glyph the renderer knows, for tests and callers. */
export const KNOWN_GLYPHS = Object.keys(GLYPHS);

/**
 * Dot-matrix text as raw SVG circles — the same letterforms as <DotText>,
 * for contexts that need an image without a DOM (share posters).
 */
export function dotTextSVG(
  text: string,
  opts: { dot?: number; pitch?: number; color?: string; dimOpacity?: number; x?: number; y?: number } = {},
): string {
  const { dot = 2.4, pitch = 8, color = "#ffffff", dimOpacity = 0.09, x = 0, y = 0 } = opts;
  const upper = text.toUpperCase();
  let s = "";
  upper.split("").forEach((ch, ci) => {
    const glyph = GLYPHS[ch] ?? GLYPHS[" "];
    glyph.forEach((row, r) => {
      row.split("").forEach((bit, c) => {
        s += `<circle cx="${(ci * 6 * pitch + c * pitch + pitch / 2 + x).toFixed(1)}" cy="${(r * pitch + pitch / 2 + y).toFixed(1)}" r="${dot}" fill="${color}" opacity="${bit === "1" ? 1 : dimOpacity}"/>`;
      });
    });
  });
  return s;
}

/** Pixel width of a rendered string at a given pitch. One spacer column per glyph. */
export function dotTextWidth(text: string, pitch: number): number {
  if (text.length === 0) return 0;
  return (text.length * 6 - 1) * pitch;
}

type DotTextProps = {
  text: string;
  /** Dot radius in SVG units. */
  dot?: number;
  /** Grid pitch in SVG units. */
  pitch?: number;
  color?: string;
  /** Opacity of unlit dots — the matrix stays visible without becoming a wash. */
  dimOpacity?: number;
  /** Accessible label; defaults to the raw text. */
  label?: string;
  className?: string;
  /**
   * Reserve width for at least this many glyphs. Count-ups (0 → 24,936)
   * otherwise reflow the layout every frame; the text stays left-aligned
   * in the reserved field so the left edge never moves.
   */
  slots?: number;
};

export function DotText({
  text,
  dot = 2.4,
  pitch = 8,
  color = "#ffffff",
  dimOpacity = 0.09,
  label,
  className,
  slots = 0,
}: DotTextProps) {
  const upper = text.toUpperCase();
  const width = dotTextWidth(upper.padEnd(Math.max(upper.length, slots), " "), pitch);
  const height = 7 * pitch;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label ?? text}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {upper.split("").map((ch, ci) => {
        const glyph = GLYPHS[ch] ?? GLYPHS[" "];
        return glyph.map((row, r) =>
          row.split("").map((bit, c) => (
            <circle
              key={`${ci}-${r}-${c}`}
              cx={ci * 6 * pitch + c * pitch + pitch / 2}
              cy={r * pitch + pitch / 2}
              r={dot}
              fill={color}
              opacity={bit === "1" ? 1 : dimOpacity}
            />
          )),
        );
      })}
    </svg>
  );
}
