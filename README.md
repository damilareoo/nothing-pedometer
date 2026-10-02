# Nothing Pedometer — Interaction Concept

A standalone interaction study: a Nothing Phone pedometer widget that expands
into Apple-style detail, with a Strava-like run view redrawn in Nothing's
dot-matrix design language.

Own repo, own files — nothing shared with any other project.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

On your Nothing Phone (2a): same Wi-Fi, then `pnpm dev --host` and open the
printed Network URL in the phone browser. Full-bleed, 120Hz.

## Flow

- **Home** — small transparent pedometer widget on a Nothing-style homescreen.
- **Tap** — widget morphs (shared element) into a detail dashboard: count-up
  steps, dotted goal progress, distance/kcal/active stats, 7-day dot columns,
  24-hour histogram.
- **Today's run** — dot-matrix GPS trace with KM splits, live runner dot,
  elevation dots, per-KM pace table.

## Checks

```bash
pnpm test    # vitest
pnpm build   # production build
```
