# Nothing Pedometer — Interaction Concept

> **Unofficial personal exploration.** Not affiliated with, endorsed by, or
> connected to Nothing Technology Limited. Nothing OS, NDot, and related
> marks belong to their owners. This repo is a design study built from
> screenshots of the author's own Phone (2a), and shares nothing with any
> other project.

## Why this exists

On the Phone (2a) the pedometer story ends early: a daily count, a weekly
view, and a monthly view so dense it stops informing. As a morning runner,
the author wanted the rest of the story — last night's run broken into
kilometres, pace, heart-rate, elevation, and a route trace — told in
Nothing's own aesthetic: dot-matrix type, hairline cards, one red reserved
for the live position, mono captions that read like instrument labels.

So this concept keeps the device's widget wording ("TOTAL TODAY",
"7-DAY AVERAGE") and extends it: tap the widget and it morphs into detail,
detail leads to the run, the run produces shareable posters.

## What it does

- **Home** — pedometer widget on a wallpaper + dock study. Numbers are your
  live Health Connect today/average when the feed is configured, fixtures
  otherwise (never blanks).
- **Detail** — count-up hero with reserved numeral width (no layout shift),
  dotted goal line with a red now-tick, distance/energy/active stats,
  day/week dot-column charts with derived `PEAK/AVG/BEST` captions, and a
  `TODAY'S RUN` entry point.
- **Run** — dot-matrix route trace with a live runner, privacy zone toggle
  (start/finish masked near home, badge travels onto shared posters),
  per-KM splits as a real list, elevation profile with a spoken total.
- **Share** — system-style sheet (`Sharing 1 run` + content preview +
  target grid, after the actual OS 4.1 sheet), real intents for
  X/WhatsApp/Telegram, clipboard for Copy/Instagram captions, and canvas
  posters (Onyx, Bone, Signal, Volt yellow after the Ear (a), Dusk gradient,
  or your photo under an enforced legibility scrim).
- **Accessibility** — every chart has a spoken summary, targets are ≥44px,
  reduced-motion holds truthful static frames, contrast is asserted in
  tests, not hoped for.

## Run it

```bash
pnpm install
pnpm dev -- --port 3001   # http://localhost:3001
pnpm test                 # vitest, 50+ wiring/contract tests
npx tsc --noEmit          # typecheck
```

On your Phone (2a): same Wi-Fi, `pnpm dev --host -- --port 3001`, open the
printed Network URL. Full-bleed at 120Hz.

## Live step count (optional)

Without configuration the concept runs on fixtures. With it, the widget,
hero, and week chart read your Health Connect feed through a proxy that
keeps the secret server-side:

```bash
cp .env.example .env.local   # then fill in your values
```

| Variable          | Value                                              |
| ----------------- | -------------------------------------------------- |
| `STEPS_API_URL`   | Your feed endpoint (e.g. `https://…/api/steps`)    |
| `STEPS_API_SECRET`| Bearer secret for that endpoint (server env only) |

Rules: never commit `.env.local` (already git-ignored); on Vercel set both
as Environment Variables; if a secret ever appears in chat, screenshots, or
logs, rotate it at the source and update both ends. `GET /api/steps` on this
app returns `503` when unconfigured and never leaks the secret.

Upstream shape: `{ today, goal, average7, updatedAt, days: [{ date,
steps | null }] }`. Null days (no data yet) render as zeros. The parser
(`lib/steps.ts`) clamps everything to safe integers and rejects garbage.

## Docs

- [`CASE-STUDY.md`](./CASE-STUDY.md) — feature record, improvement log,
  research basis, and credits.
