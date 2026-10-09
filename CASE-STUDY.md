# Case study: a Nothing pedometer that finishes the story

## The gap

Nothing OS 4.1 on the Phone (2a) gives runners a daily count, a weekly
view, and a monthly view too dense to read at a glance. The morning run —
distance, splits, heart-rate, elevation, route — has no home in the
system's visual language. Third-party apps (notably Strava) answer the
data question but abandon the aesthetic: the dot-matrix numerals, the
restraint, the single red.

## The concept

Extend the existing widget instead of replacing it. Keep its exact wording
("TOTAL TODAY" over "7-DAY AVERAGE", sampled from the device), then let one
tap morph it into detail, detail into the
run, and the run into shareable posters. Nothing new to learn; the story
just continues. One today figure persists across every surface — widget,
detail, and stats — and the day chart never shows hours that have not
happened yet.

## Feature record and why each exists

| Feature | Why |
| ------- | --- |
| Widget keeps device wording | Continuity beats novelty; the concept must feel shipped, not skinned. |
| Detail hero with count-up + red now-tick | Progress needs a live edge; the red mirrors the OS forecast bars, where red always means "you are here". |
| Day/week dot columns, never hue for meaning | Brightness encodes today; hue is spent nowhere else, so the one red keeps its monopoly. |
| Derived captions (`PEAK/AVG/BEST`) | A shape without a number makes users guess. Every chart states its takeaway in plain words. |
| Run trace with live runner | A static route is a receipt; a travelling dot replays the effort. Reduced-motion users get the honest mid-run frame. |
| Privacy zone toggle, armed wash + poster badge | Home addresses leak through route endpoints (the Strava problem). Masking must be visible on the artifact itself, not just the screen. |
| Elevation with spoken total | Bars alone are decoration; `+86 M` plus an accessible summary makes them information. |
| System-style share sheet | The first custom sheet was invention; device screenshots proved the OS uses a titled sheet with content preview. Fidelity won. |
| Real share intents + clipboard | A `POSTED ✓` that posts nothing is a lie. X/WhatsApp/Telegram open real targets; Instagram/Copy write the real caption. |
| Volt yellow canvas | Nothing's own Ear (a) yellow — primary, playful, documented by the industrial design team as deliberate fun. Black ink only, contrast-tested. |
| Live Health Connect steps | Fixtures demonstrate; the feed convinces. Widget, hero, and week chart read the owner's feed with fixture fallback, secret server-side. |
| Dropped weather, dropped fake counts | No weather API and no social backend exist here, so both were removed rather than invented. |

## Research basis (honest)

- Device truth: 6+ screenshots of the owner's Phone (2a) — light tokens, dock exception, serif rhythm, back-arrow shape, share-sheet anatomy.
- Platform conventions: Android/Material share-sheet anatomy (title + preview + target grid), WCAG 2.2 contrast and target-size floors, `prefers-reduced-motion` guidance.
- Domain patterns: Strava's run detail and privacy zones, Apple Health's day/week switcher.
- No formal user testing has been run. The clarity bar is therefore structural: every visualization pairs with a plain-language caption and a screen-reader summary, so comprehension never depends on decoding dots.

## Credits

- Design language: Nothing Technology Limited (reference only; no affiliation).
- Line icons: Feather Icons (ISC license) — closest open set to the Nothing geometric line style; brand marks redrawn as silhouettes.
- Type: system serif for OS-style titles, monospace for instrument labels, custom 5×7 dot-matrix drawn clean-room (an evocation of NDot, not the licensed face).
- Motion: `motion` (formerly Framer Motion) library.
- Data: Google Health Connect via the owner's personal feed; Ear (a) yellow story via Nothing's product team interviews.
- Built with OpenCode (Muse Spark) in small verified steps: tests + typecheck + localhost check per commit.
