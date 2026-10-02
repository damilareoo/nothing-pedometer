/**
 * Dot-matrix type for the Nothing pedometer concept.
 *
 * Nothing's NDot is a licensed 5-dot-wide matrix face. This is a clean-room
 * evocation of it: a 5x7 grid per glyph, lit dots at full ink, unlit dots
 * kept present at a low floor so the matrix reads on pure black.
 *
 * Only the glyphs the concept needs are drawn: numerals, comma, period,
 * colon, percent, slash, space. Labels stay in uppercase system mono.
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
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

/** Every glyph the renderer knows, for tests and callers. */
export const KNOWN_GLYPHS = Object.keys(GLYPHS);

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
};

export function DotText({
  text,
  dot = 2.4,
  pitch = 8,
  color = "#ffffff",
  dimOpacity = 0.09,
  label,
  className,
}: DotTextProps) {
  const width = dotTextWidth(text, pitch);
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
      {text.split("").map((ch, ci) => {
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
