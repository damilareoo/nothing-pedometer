import { dotTextSVG, dotTextWidth } from "@/components/nothing-pedometer/dot-matrix";

/**
 * The share poster as standalone SVG — deterministic bytes with no DOM,
 * no stylesheets, no oklch landmines. What travels over native share is
 * rendered here, in the same dot-matrix letterforms as the screen.
 */

export type PosterSpec = {
  dist: string;
  time: string;
  pace: string;
  kcal: string;
  when: string;
  route: string;
  privacy: boolean;
  bg: string;
  ink: string;
  dot: string;
  dim: string;
  red: string;
  /** Data-URL photo under the scrim. Absent on solid canvases. */
  photo?: string;
};

export const POSTER_W = 1080;
export const POSTER_H = 1350;

function bgDef(bg: string, photo?: string): string {
  if (photo) {
    return (
      `<image href="${photo}" x="0" y="0" width="${POSTER_W}" height="${POSTER_H}" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect width="${POSTER_W}" height="${POSTER_H}" fill="#050508" opacity="0.55"/>`
    );
  }
  const hexes = bg.match(/#[0-9A-Fa-f]{6}/g) ?? [];
  if (hexes.length >= 2) {
    const stops = hexes
      .map((h, i) => `<stop offset="${(i / (hexes.length - 1)).toFixed(2)}" stop-color="${h}"/>`)
      .join("");
    return `<defs><linearGradient id="dusk" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="${POSTER_W}" height="${POSTER_H}" fill="url(#dusk)"/>`;
  }
  return `<rect width="${POSTER_W}" height="${POSTER_H}" fill="${hexes[0] ?? "#0B0B0D"}"/>`;
}

export function sharePosterSVG(p: PosterSpec): string {
  const cx = POSTER_W / 2;
  const pitch = 34;
  const distW = dotTextWidth(p.dist, pitch);
  // On photos the unlit matrix is noise over weather — lit dots only.
  const unlit = p.photo ? 0 : 0.08;
  const mono = (size: number, ls: number) =>
    `font-family="monospace" font-size="${size}" letter-spacing="${ls}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_W}" height="${POSTER_H}" viewBox="0 0 ${POSTER_W} ${POSTER_H}">` +
    bgDef(p.bg, p.photo) +
    `<text x="${cx}" y="150" text-anchor="middle" fill="${p.dim}" ${mono(30, 8)}>MORNING RUN · ${p.when}${p.privacy ? " · HOME HIDDEN" : ""}</text>` +
    dotTextSVG(p.dist, { dot: 11.5, pitch, color: p.dot, dimOpacity: unlit, x: cx - distW / 2, y: 230 }) +
    `<text x="${cx}" y="560" text-anchor="middle" fill="${p.ink}" ${mono(34, 12)}>KILOMETRES</text>` +
    `<g transform="translate(180,620) scale(2)">` +
    `<path d="${p.route}" fill="none" stroke="${p.dot}" stroke-opacity="0.9" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 10"/>` +
    `<circle cx="44" cy="200" r="7" fill="${p.dot}" opacity="${p.privacy ? 0.2 : 1}"/>` +
    `<circle cx="96" cy="200" r="7" fill="${p.red}" opacity="${p.privacy ? 0.2 : 1}"/>` +
    `</g>` +
    `<text x="${cx}" y="1210" text-anchor="middle" fill="${p.ink}" ${mono(40, 4)}>${p.time}   ${p.pace}/KM   ${p.kcal} KCAL</text>` +
    `<text x="${cx}" y="1275" text-anchor="middle" fill="${p.dim}" ${mono(26, 10)}>NOTHING · PEDOMETER</text>` +
    `</svg>`
  );
}
