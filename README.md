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

## Stage background (recording)

The desktop stage paints `public/stage-bg.jpg` (cover) over the studio
gradient with a 42% dark scrim, so a screen recording already sits on your
presentation bg — no keying black out later. No file yet? The gradient
shows; nothing breaks.

```bash
# drop your presentation photo here, then redeploy
public/stage-bg.jpg
```

Record chrome-free: open `https://nothing-pedometer.vercel.app/?clean=1`
(chrome, floor glow, and phone drop shadow off — no dark halo when you
composite). `html` ground is `#0e0e11` (studio floor), not pure black, so
edges blend instead of crushing.

## Live step count (optional)

Without configuration the concept runs on fixtures. With it, the widget,
hero, and week chart read your Health Connect feed through a proxy that
keeps the secret server-side. The owner's feed is currently switched off in
`components/nothing-pedometer/experience.tsx` (`LIVE_FEED_ENABLED`) while a
replacement phone is sourced, so the deployed concept runs on fixtures
labelled `SAMPLE` — never a dash:

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

Upstream shape: `{ today: number | null, goal, average7, reportedDays,
updatedAt, days: [{ date, steps | null }], hours: number[] | null,
lastReported }`. The parser (`lib/steps.ts`) clamps everything to safe
integers, rejects garbage, and preserves nulls: `today: null` means no
report, so the widget shows a dash and `NO REPORT TODAY` — never a fake
zero. Null week days render hollow, not as zero-height bars. `average7` is
the mean of reported days in the trailing seven days; `reportedDays` is the
denominator and the detail chart states it (`4/7 REPORTED`). `hours` is
null when the day has no interval fine enough to support an honest hourly
shape. `updatedAt` is the last step count, so the UI says `LAST STEP`, not
`SYNCED`; a count older than two hours is labelled `NO NEW STEPS`.

## Docs

- [`CASE-STUDY.md`](./CASE-STUDY.md) — extended feature record, improvement
  log, research basis, and credits. The short version lives below, so this
  file reads as the case study on its own.

## Trying it (send testers this)

Live link: `https://nothing-pedometer.vercel.app` — no scroll, the phone
frame fits the window like a SwiftUI preview. Where to tap:

1. Home shows `TAP THE WIDGET ↑` until the first tap — tap the step widget.
2. Detail counts up the live steps; toggle `DAY/WEEK`. The week is the
   truthful view when the day has no fine-grained intervals: hollow days
   mean no report. Tap `MORNING RUN` when today has steps.
3. Run screen: flip the privacy zone, watch the trace mask; tap `SHARE`.
4. Sheet → pick a platform → poster preview with canvas picker (Onyx, Bone,
   Signal, Volt, Dusk, photo). X/WhatsApp/Telegram open real share
   targets; Instagram copies the caption (it accepts no direct web shares).

Step counts are fixtures while the feed is switched off (see above), and
were the owner's live Health Connect feed when it ran. A day with no report
shows a dash, never a fake zero; when the feed is unreachable the fixtures
are explicitly labelled `SAMPLE`. Everything else is a curated sample
dataset until the feed gains a run object (stated, not hidden).

## Case study (short)

**Gap.** Nothing OS 4.1 on the Phone (2a) ends the fitness story early:
daily count, weekly view, monthly view too dense to read. The morning run —
splits, heart-rate, elevation, route — has no home in the system language.

**Response.** Extend the existing widget, don't replace it. Keep its exact
wording, then continue the story: widget → detail → run → share posters.

**Decisions worth defending.** Brightness, never hue, encodes "today" so
the one red keeps its monopoly on live position. Every chart states its
takeaway (`PEAK/AVG/BEST`) because shapes without numbers make users
guess. The first custom share sheet lost to device screenshots — the OS
uses a titled sheet with content preview, so fidelity won. Anything with
no real source (weather, social counts) was removed, not invented.

**Credits.** Design language: Nothing Technology Limited (reference only,
no affiliation). Line icons: Feather Icons (ISC). Type: system serif +
mono + a clean-room 5×7 dot-matrix (an evocation of NDot, not the licensed
face). Motion: `motion` library. Data: Google Health Connect via the
owner's feed. Built stepwise with OpenCode: tests + typecheck + localhost
check per commit.
