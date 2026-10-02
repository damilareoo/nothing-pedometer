"use client";

import { useEffect, useState } from "react";

/**
 * The only motion tokens in this repo.
 *
 * Two curves, five durations. A component that needs a timing reaches for one
 * of these — there is no sixth duration and no third curve.
 */
export const EASE_OUT = [0.22, 0.61, 0.36, 1] as const satisfies readonly [number, number, number, number];

/**
 * Container morphs, measured on-device (Nothing OS 4.1, 74fps capture):
 * widget-tap expand bursts ~430ms, front-loaded with a soft landing.
 * This is Android's emphasized decelerate, not our default ease.
 */
export const EASE_EMPHASIZED = [0.05, 0.7, 0.1, 1] as const satisfies readonly [number, number, number, number];

export const DUR = {
  /** Hover, press, feedback. Fast enough to read as response, not motion. */
  micro: 0.18,
  /** Exits and collapses. Measured ~200ms on-device for app-close. */
  fast: 0.24,
  /** Container morphs. Measured ~430ms on-device for widget-tap expand. */
  morph: 0.43,
  /** The default. Container entrances and staged reveals. */
  base: 0.42,
  /** Staged reveals where the stagger needs room to be legible. */
  staged: 0.72,
  /** Entrances. The only budget this long. */
  entrance: 1.2,
} as const;

/** The gap between one staged item arriving and the next. */
export const STAGGER = 0.06;
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
