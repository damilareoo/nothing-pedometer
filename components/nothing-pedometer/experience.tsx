"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_EMPHASIZED, EASE_OUT, STAGGER, useReducedMotion } from "@/lib/motion";
import { THEMES, type ThemeName, type Tokens } from "@/lib/theme";
import { SHARE_CANVASES, photoCanvas, type ShareCanvas } from "@/lib/share-canvases";
import { sharePosterPNG, sharePosterSVG } from "@/lib/share-poster";
import { ROUTE } from "@/lib/route";
import { lagosToday, parseStepsPayload, readingStatus, type StepsSnapshot } from "@/lib/steps";
import { ArrowLeft, ArrowRight, CameraIcon, GearIcon, InstagramIcon, MessageIcon, PhoneIcon, SearchIcon, TelegramIcon, WhatsAppIcon, XIcon } from "./icons";
import { DotText } from "./dot-matrix";

/**
 * Nothing pedometer — interaction concept, drawn in the owner's Nothing OS 4.1
 * language (Phone 2a, dark daily driver + inferred light).
 *
 * Measured tokens (lib/theme.ts): widget black #1B1A1F, settings ground
 * #232228 / cards #333237, the one red #E11A1B. Widget copy is the real
 * thing — "TOTAL TODAY" over "7-DAY AVERAGE", one today figure everywhere.
 *
 * Three stages: homescreen widget -> tap expands (shared element) into a
 * settings-language dashboard -> run trace. Back is always one level per
 * gesture: chevron, collapse, Esc-as-back. Native widgets never explain
 * themselves, so there is no "tap to expand" hint.
 */

/* --------------------------------- fixtures ---------------------------------- */
/* Concept fixtures, one block, one seam: every number below is static demo
   data. A live source (Health Connect post, at-home mock) replaces this block
   whole — no component reaches past it for a number. The device wording
   ("TOTAL TODAY" over "7-DAY AVERAGE") stays even when values go live; the
   fixture today is STEPS everywhere, so widget and detail can never disagree. */

const STEPS = 7284;
const GOAL = 10000;

/**
 * The counting phone is gone (Phone 2a stolen), so the feed can only answer
 * "nothing reported today" — which is true but reads as a broken screen.
 * Until a device posts again, the fixtures carry every face. Flip to true
 * when the feed is back; no other change needed.
 */
const LIVE_FEED_ENABLED = false;
const GOAL_PCT = Math.round((STEPS / GOAL) * 100);
const GOAL_TO_GO = (GOAL - STEPS).toLocaleString("en-US");
const GOAL_FMT = GOAL.toLocaleString("en-US");
const KCAL = 312;
const ACTIVE_MIN = 48;
/** Average adult stride: the standard pedometer assumption behind every
    step-to-distance readout. Disclosed here, not hidden in the math. */
const STRIDE_M = 0.75;

/** Step-to-km readout, one formula everywhere steps meet kilometres. */
const kmOf = (steps: number) => ((steps * STRIDE_M) / 1000).toFixed(1);

const WEEK = [
  { d: "M", v: 5120 },
  { d: "T", v: 8430 },
  { d: "W", v: 3980 },
  { d: "T", v: 10240 },
  { d: "F", v: 6890 },
  { d: "S", v: 9140 },
  { d: "S", v: STEPS },
];

/** Caption math, derived so the words can never disagree with the columns. */
const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEK_AVG_NUM = Math.round(WEEK.reduce((a, b) => a + b.v, 0) / WEEK.length);
const WEEK_AVG = WEEK_AVG_NUM.toLocaleString("en-US");
const BEST_IDX = WEEK.reduce((bi, b, i) => (b.v > WEEK[bi].v ? i : bi), 0);
const WEEK_BEST = `${WEEK_DAYS[BEST_IDX]} ${WEEK[BEST_IDX].v.toLocaleString("en-US")}`;

/** Session anchors: start, duration, and energy come from the session record
    (a live ExerciseSession tomorrow, the curated record today). Distance and
    pace never live here — they convert from detected steps. */
const RUN = { time: "32:14", kcal: "268", when: "06:42" };
/** The run is a curated sample until the feed serves ExerciseSessions. */
const RUN_SAMPLE = true;
/** The curated workout's own anchors: 32:14 over 5.2 km burns 268 kcal. */
const RUN_BASE_SEC = 32 * 60 + 14;
const RUN_BASE_DIST = 5.2;
const RUN_BASE_KCAL = 268;

/**
 * Run detection: the biggest contiguous block of sustained effort in the
 * morning window (04:00–12:00). Anything above the brisk-effort floor for
 * consecutive hours is the run; anything else is the day. Steps inside the
 * window are the run's steps — distance, pace, and energy all convert from
 * there, so the run can never disagree with the day that contains it. A live
 * ExerciseSession will supply this window (plus exact start/duration/kcal);
 * until then the anchors below stand in as the session record.
 */
const RUN_EFFORT_FLOOR = 500;
function detectRunWindow(hours: number[]): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  let cur: { start: number; end: number } | null = null;
  for (let h = 4; h <= 12; h++) {
    if (hours[h] > RUN_EFFORT_FLOOR) {
      cur = cur ?? { start: h, end: h + 1 };
      cur.end = h + 1;
    } else {
      if (cur && (!best || cur.end - cur.start > best.end - best.start)) best = cur;
      cur = null;
    }
  }
  if (cur && (!best || cur.end - cur.start > best.end - best.start)) best = cur;
  return best;
}
const RUN_STEPS = Math.round((RUN_BASE_DIST * 1000) / STRIDE_M);
/* Session shape: the run's steps land in its hours — elapsed bars always sum to today. */
const RUN_H6_FRAC = ((60 - Number(RUN.when.split(":")[1])) * 60) / RUN_BASE_SEC;
const RUN_H6 = Math.round(RUN_STEPS * RUN_H6_FRAC);
const RUN_H7 = RUN_STEPS - RUN_H6;
const BG_REST = STEPS - RUN_STEPS;
const BG_SCALE = BG_REST / (420 + 180 + 240);
const HOURLY = [
  0, 0, 0, 0, 0, 0, RUN_H6, RUN_H7,
  Math.round(420 * BG_SCALE),
  Math.round(180 * BG_SCALE),
  BG_REST - Math.round(420 * BG_SCALE) - Math.round(180 * BG_SCALE),
  310, 520, 280, 190, 340, 410, 860, 1240, 540, 220, 90, 20, 0,
];

/** The detected run: window from the data, figures converted from its steps.
    Distance is pure conversion (steps × stride); pace is session duration
    over that distance. Data always wins over anchors. */
const RUN_WINDOW = detectRunWindow(HOURLY) ?? { start: 6, end: 8 };
const RUN_WINDOW_STEPS = HOURLY.slice(RUN_WINDOW.start, RUN_WINDOW.end).reduce((a, b) => a + b, 0);
const RUN_DIST = kmOf(RUN_WINDOW_STEPS);
const RUN_PACE_SEC = RUN_BASE_SEC / parseFloat(RUN_DIST);
const RUN_PACE = (() => {
  const m = Math.floor(RUN_PACE_SEC / 60);
  let s = Math.round(RUN_PACE_SEC % 60);
  let mm = m;
  if (s === 60) {
    mm += 1;
    s = 0;
  }
  return `${mm}'${String(s).padStart(2, "0")}''`;
})();

function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(Math.round(totalSec % 60)).padStart(2, "0")}`;
}

type RunFigures = { dist: string; time: string; kcal: string };

/**
 * The day's distance is live (steps × stride); the workout scales with it
 * so pace, time, and energy always reconcile with the daily read. Offline
 * the detected window converts exactly. Time/kcal stay session-anchored
 * (badged wherever shown) until ExerciseSessions land.
 *
 * `fallback` is for the run/share screens, which are curated samples by
 * definition. The detail screen passes false: a day nobody reported must not
 * grow a run button just because the fixture has one.
 */
function runFigures(live: StepsSnapshot | null, fallback = true): RunFigures | null {
  const sample: RunFigures = { dist: RUN_DIST, time: RUN.time, kcal: RUN.kcal };
  if (!live || live.today === null || live.today <= 0) return fallback ? sample : null;
  const dist = (live.today * STRIDE_M) / 1000;
  const f = dist / RUN_BASE_DIST;
  return {
    dist: dist.toFixed(1),
    time: fmtDuration(RUN_BASE_SEC * f),
    kcal: String(Math.round(RUN_BASE_KCAL * f)),
  };
}

const SPLITS = [
  { km: "01", pace: "6'05''", hr: "146" },
  { km: "02", pace: "6'10''", hr: "151" },
  { km: "03", pace: "6'18''", hr: "154" },
  { km: "04", pace: "6'14''", hr: "157" },
  { km: "05", pace: "6'02''", hr: "161" },
];

const ELEV = [4, 6, 8, 7, 10, 12, 11, 14, 16, 15, 18, 22, 20, 24, 21, 26, 24, 28, 25, 22, 18, 14, 10, 8, 6, 5, 4, 3];
const ELEV_GAIN = 86;

/** Caption math, derived so the words can never disagree with the shapes. */
function paceSec(p: string): number {
  const m = p.match(/(\d+)'(\d+)''/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
const SPLIT_SECS = SPLITS.map((s) => paceSec(s.pace));
const FASTEST_SPLIT = SPLITS[SPLIT_SECS.indexOf(Math.min(...SPLIT_SECS))];
const SPLIT_LINE = `FASTEST KM ${FASTEST_SPLIT.km} · ${FASTEST_SPLIT.pace} · HR ${SPLITS[0].hr}→${SPLITS[SPLITS.length - 1].hr}`;
const ELEV_PEAK_KM = Math.max(
  1,
  Math.round(((ELEV.indexOf(Math.max(...ELEV)) + 0.5) / ELEV.length) * parseFloat(RUN_DIST)),
);
const ELEV_LINE = `PEAK NEAR KM ${String(ELEV_PEAK_KM).padStart(2, "0")}`;

const MICRO = "whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.22em]";
const SANS_LABEL = "text-[14px] font-medium";

/** Send-time stamp: the message goes out now, so it reads now. */
function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------------------------------- hooks --------------------------------- */

function useNow(): { time: string; dateLine: string; weekday: string; dayMonth: string } {
  const fmt = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    const wd = get("weekday");
    const dm = `${get("day")} ${get("month")}`;
    return {
      time: `${get("hour")}:${get("minute")}`,
      dateLine: `${wd} · ${dm}`,
      weekday: wd,
      dayMonth: dm,
    };
  };
  const [now, setNow] = useState({ time: "9:41", dateLine: "Fri · 2 Oct", weekday: "Fri", dayMonth: "2 Oct" });
  useEffect(() => {
    setNow(fmt(new Date()));
    const id = setInterval(() => setNow(fmt(new Date())), 10_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ------------------------------- feed state -------------------------------- */

type FeedStatus = "loading" | "live" | "stale" | "unreported" | "offline";
type Feed = { live: StepsSnapshot | null; status: FeedStatus };

/** Lagos wall-clock helpers: the feed's day is the owner's day, not the viewer's. */
function lagosHM(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Lagos",
  });
}
function lagosShortDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Lagos",
  })
    .format(new Date(ms))
    .toUpperCase()
    .replace(",", "");
}
function lagosHour(now = new Date()): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: "Africa/Lagos",
      }).format(now),
    ) % 24
  );
}
/** How long ago the feed last counted, in the shortest honest form. */
function ageLabel(ms: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60_000));
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}
/** The status line under the hero: date-aware, so yesterday cannot read as now. */
function syncLine(live: StepsSnapshot | null, status: FeedStatus): string {
  if (status === "offline") return "SAMPLE DATA · FEED OFFLINE";
  if (status === "loading") return "SAMPLE DATA · CONNECTING";
  if (!live) return "NO FEED";
  if (!live.updatedAt) return "STEP TIME UNKNOWN";
  const time = lagosHM(live.updatedAt);
  if (lagosToday(new Date(live.updatedAt)) === lagosToday()) {
    return status === "stale" ? `LAST STEP ${time} · ${ageLabel(live.updatedAt)}` : `LAST STEP ${time}`;
  }
  return `LAST STEP ${lagosShortDate(live.updatedAt)} · ${time}`;
}
/** The one line under the widget: honest about samples, quiet when live. */
function homeNote(live: StepsSnapshot | null, status: FeedStatus, fresh: boolean): string {
  if (status === "offline") return "SAMPLE DATA · TAP THE WIDGET ↑";
  if (status === "loading") return "SAMPLE DATA · CONNECTING";
  if (status === "unreported") return "NO REPORT TODAY";
  if (status === "stale") return "NO NEW STEPS";
  return fresh ? "TAP THE WIDGET ↑" : "·";
}

/**
 * Live feed via our own proxy (`/api/steps` keeps the Bearer secret
 * server-side). The status is as important as the snapshot: `unreported`
 * means the feed is healthy but today has no report, `offline` means the
 * fixtures are standing in, and `stale` means today reported but has not
 * updated recently.
 */
function useLiveSteps(): Feed {
  const [feed, setFeed] = useState<Feed>({
    live: null,
    status: LIVE_FEED_ENABLED ? "loading" : "offline",
  });
  useEffect(() => {
    if (!LIVE_FEED_ENABLED) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/steps", { cache: "no-store" });
        if (!res.ok) throw new Error("feed rejected");
        const json = await res.json();
        const snap = parseStepsPayload(json);
        if (!alive) return;
        if (!snap) throw new Error("feed malformed");
        setFeed({ live: snap, status: readingStatus(snap) });
      } catch {
        if (!alive) return;
        /* A failed poll never erases a good reading; it simply ages it. */
        setFeed((prev) => ({
          live: prev.live,
          status: prev.live ? readingStatus(prev.live) : "offline",
        }));
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return feed;
}

/** Weekday initial for a YYYY-MM-DD day, noon-anchored against TZ edges. */
function dayInitial(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return "SMTWTFS"[d.getDay()] ?? "";
}

/** Full weekday name for a YYYY-MM-DD day, for the BEST caption. */
function dayName(date: string): string {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${date}T12:00:00`).getDay()] ?? "";
}

/** Counts 0 -> target when `go` changes, once per visit. */
function useCountUp(target: number, go: number): number {
  const [val, setVal] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (go === 0 || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, target, reduced]);
  return reduced && go > 0 ? target : val;
}

/* -------------------------------- components ------------------------------- */

/** Themed dot-matrix: ink, unlit floor, and optical size all come from tokens. */
function Matrix({ t, text, dot = 2.4, pitch = 8, label, slots = 0 }: { t: Tokens; text: string; dot?: number; pitch?: number; label?: string; slots?: number }) {
  return <DotText text={text} dot={dot * t.dotScale} pitch={pitch} color={t.dot} dimOpacity={t.unlit} label={label} slots={slots} />;
}

/** Staged arrival: content settles in just after the sheet morph lands. */
function Rise({ index = 0, className, children }: { index?: number; className?: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE_OUT, delay: reduced ? 0 : 0.12 + index * STAGGER }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A dotted progress line: lit dots up to `frac`, dim matrix after.
 * The boundary dot burns red — the device marks the live position the same
 * way on its forecast range bars, and red is live position in this system.
 */
function DottedLine({ frac, total = 30, t }: { frac: number; total?: number; t: Tokens }) {
  const clamped = Math.min(1, Math.max(0, frac));
  const on = Math.round(clamped * total);
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const isNow = i === on - 1 && on > 0;
        return (
          <span
            key={i}
            className="h-[4px] w-[4px] rounded-full"
            style={{ background: isNow ? t.red : i < on ? t.dot : t.faint }}
          />
        );
      })}
    </div>
  );
}

/** 7-day activity as tappable dot columns. Tap a day to read it — today stays marked red, like the OS live position. A hollow column is a day nobody reported, not a zero. */
function WeekDots({ week, today, selected, onSelect, t }: { week: { d: string; v: number | null }[]; today: number; selected: number; onSelect: (i: number) => void; t: Tokens }) {
  const max = Math.max(...week.map((w) => w.v ?? 0), 1);
  const best = week.reduce((bi, b, i) => {
    const current = week[bi]?.v;
    if (b.v === null) return bi;
    return current === null || current === undefined || b.v > current ? i : bi;
  }, 0);
  const bestValue = week[best]?.v;
  const ROWS = 14;
  return (
    <div className="flex items-stretch justify-between gap-1" role="img" aria-label={`Steps this week, best ${bestValue === null || bestValue === undefined ? "not reported" : bestValue.toLocaleString("en-US")}`}>
      {week.map((b, i) => {
        const lit = b.v === null ? 0 : Math.max(1, Math.round((b.v / max) * ROWS));
        const isToday = i === today;
        const isSel = i === selected;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={isSel}
            aria-label={`${b.d} ${b.v === null ? "not reported" : `${b.v.toLocaleString("en-US")} steps`}${isToday ? ", today" : ""}`}
            className="flex min-h-[110px] flex-1 flex-col items-center justify-end gap-2 rounded-[12px] pb-1 pt-2"
            style={{ background: isSel ? t.faint : "transparent" }}
          >
            <div className="flex h-[76px] flex-col-reverse justify-start gap-[4px]" aria-hidden>
              {Array.from({ length: ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="h-[4px] w-[4px] rounded-full"
                  style={{ background: r < lit ? (isSel || isToday ? t.dot : t.dim) : t.faint }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: isSel || isToday ? t.ink : t.dim }}>
              {b.d}
            </span>
            <span className="h-[3px] w-[14px] rounded-full" style={{ background: isToday ? t.red : "transparent" }} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** 24-hour activity as a scrub strip — drag across it like the sample chart. Same dot language, pointer-driven readout. Hours after now are unlit: the future has no steps yet, and selection clamps to the clock. */
function HourlyDots({ hours, selected, onSelect, t, nowHour, peakHour }: { hours: number[]; selected: number; onSelect: (i: number) => void; t: Tokens; nowHour: number; peakHour: number }) {
  const max = Math.max(...hours, 1);
  const ROWS = 12;
  const ref = useRef<HTMLDivElement>(null);
  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSelect(Math.min(nowHour, Math.max(0, Math.floor(f * 24))));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={`Steps by hour today, peak ${peakHour}:00 so far`}
      aria-valuemin={0}
      aria-valuemax={nowHour}
      aria-valuenow={selected}
      aria-valuetext={`${String(selected).padStart(2, "0")}:00, ${(hours[selected] ?? 0).toLocaleString("en-US")} steps`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) pick(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSelect(Math.max(0, selected - 1));
        if (e.key === "ArrowRight") onSelect(Math.min(nowHour, selected + 1));
      }}
      className="relative select-none outline-none"
      style={{ touchAction: "none", minHeight: 132 }}
    >
      {/* time pill, pinned above the finger — the sample's 11:45PM chip, in Nothing mono */}
      <div className="relative mb-1 h-[22px]" aria-hidden>
        <span
          className="absolute top-0 rounded-full px-2 py-[3px] font-mono text-[9px] tracking-[0.14em]"
          style={{
            background: t.dot,
            color: t.ground,
            left: `${((selected + 0.5) / 24) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {String(selected).padStart(2, "0")}:00
        </span>
      </div>
      <div className="relative flex h-[88px] items-end gap-[3px]" aria-hidden>
        {/* vertical guide through the selected hour */}
        <span
          className="pointer-events-none absolute bottom-0 top-0 w-px"
          style={{ background: t.faint, left: `${((selected + 0.5) / 24) * 100}%` }}
        />
        {hours.map((v, i) => {
          const lit = Math.round((v / max) * ROWS);
          const isSel = i === selected;
          const future = i > nowHour;
          return (
            <div key={i} className="flex flex-1 flex-col-reverse justify-start gap-[3px]">
              {Array.from({ length: ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="mx-auto rounded-full"
                  style={{
                    width: isSel ? 4 : 3,
                    height: isSel ? 4 : 3,
                    background: future ? t.faint : r < lit ? (isSel ? t.dot : t.dim) : t.faint,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between pt-1.5 font-mono text-[8px] tracking-[0.14em]" style={{ color: t.dim }} aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

/** One chart, two ranges — the sample's scrub + pill switcher, in Nothing's dot language. The day view is real only when the feed stored intervals for today; otherwise it says so and offers the week, which is always real. */
function ActivityCard({ t, live, status }: { t: Tokens; live: StepsSnapshot | null; status: FeedStatus }) {
  const sample = status === "loading" || status === "offline";
  const todayKey = lagosToday();
  const hoursToday = !sample && live?.today !== null && live?.lastReported?.date === todayKey;
  const hours = sample ? HOURLY : hoursToday ? live?.hours ?? null : null;
  const week = sample || !live ? WEEK : live.days.map((d) => ({ d: dayInitial(d.date), v: d.steps }));
  const names = sample || !live ? WEEK_DAYS : live.days.map((d) => dayName(d.date));
  const [range, setRange] = useState<"day" | "week">(hours ? "day" : "week");
  const reduced = useReducedMotion();
  /* The chart lives on the owner's clock: future hours are unlit, the peak
     counts elapsed hours only, and selection starts at now. */
  const nowHour = lagosHour();
  const elapsed = hours ? hours.slice(0, nowHour + 1) : [];
  const peakHour = elapsed.length ? elapsed.indexOf(Math.max(...elapsed)) : 0;
  const peakSteps = elapsed.length ? Math.max(...elapsed).toLocaleString("en-US") : "—";
  const today = week.length - 1;
  const [selDay, setSelDay] = useState(today);
  const [selHour, setSelHour] = useState(nowHour);
  const day = Math.min(selDay, week.length - 1);
  const avg = live && !sample ? live.average7.toLocaleString("en-US") : WEEK_AVG;
  const bestIdx = week.reduce((bi, b, i) => {
    const current = week[bi]?.v;
    if (b.v === null) return bi;
    return current === null || current === undefined || b.v > current ? i : bi;
  }, 0);
  const bestValue = week[bestIdx]?.v ?? null;
  const best = live && !sample ? (bestValue === null ? "—" : `${names[bestIdx]} ${bestValue.toLocaleString("en-US")}`) : WEEK_BEST;
  const hourValue = hours ? hours[Math.min(selHour, 23)] : null;
  const dayValue = week[day]?.v ?? null;
  const readout = range === "day" ? hourValue : dayValue;
  const readoutText = readout === null ? "--" : readout.toLocaleString("en-US");
  const unit =
    range === "day"
      ? "STEPS"
      : day === today
        ? `${names[day]} · TODAY`
        : day === bestIdx && bestValue !== null
          ? `${names[day]} · BEST`
          : names[day];
  const tick = (i: number, set: (n: number) => void) => (n: number) => {
    if (n !== i) {
      set(n);
      try {
        (navigator as Navigator & { vibrate?: (p: number) => void }).vibrate?.(3);
      } catch {
        /* haptics unavailable — selection still lands */
      }
    }
  };
  return (
    <div className="rounded-[20px] p-[18px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className={SANS_LABEL} style={{ color: t.dim }}>
            Activity
          </p>
          {sample && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.16em]" style={{ background: t.faint, color: t.dim }}>
              SAMPLE
            </span>
          )}
        </div>
        <div className="flex rounded-full p-[3px]" style={{ background: t.faint }} role="group" aria-label="Chart range">
          {(["day", "week"] as const).map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={active}
                className="relative rounded-full px-3 py-1 font-mono text-[9px] tracking-[0.16em]"
                style={{ color: active ? t.ground : t.dim }}
              >
                {active && (
                  <motion.span
                    layoutId="range-thumb"
                    className="absolute inset-0 rounded-full"
                    style={{ background: t.dot }}
                    transition={{ duration: DUR.base, ease: EASE_OUT }}
                  />
                )}
                <span className="relative">{r === "day" ? "DAY" : "WEEK"}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* live readout — the sample's big number, in dot-matrix */}
      <div className="flex items-end justify-between gap-3 pt-3">
        <Matrix
          t={t}
          text={readoutText}
          dot={2.2}
          pitch={5.4}
          label={readout === null ? "No steps reported" : `${readout.toLocaleString("en-US")} steps`}
          slots={6}
        />
        {/* unit for the big number (the hour lives in the pill below, so it
            is not repeated here); day name wins over BEST so the line has a
            bounded length and can never wrap. */}
        <p className="whitespace-nowrap pb-1 text-right font-mono text-[9px] tracking-[0.18em]" style={{ color: t.dim }}>
          {unit}
        </p>
      </div>
      <div className="mt-2 min-h-[150px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={range}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -8 }}
            transition={{ duration: DUR.micro, ease: EASE_OUT }}
          >
            {range === "day" ? (
              hours ? (
                <HourlyDots
                  hours={hours}
                  t={t}
                  selected={Math.min(selHour, nowHour)}
                  onSelect={tick(selHour, (n) => setSelHour(Math.min(n, nowHour)))}
                  nowHour={nowHour}
                  peakHour={peakHour}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <p className="font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
                    NO HOURLY REPORT TODAY
                  </p>
                  <button
                    type="button"
                    onClick={() => setRange("week")}
                    className="rounded-full px-3 py-1 font-mono text-[9px] tracking-[0.16em]"
                    style={{ background: t.faint, color: t.ink }}
                  >
                    SEE THE WEEK
                  </button>
                </div>
              )
            ) : (
              <WeekDots week={week} today={week.length - 1} selected={day} onSelect={tick(day, setSelDay)} t={t} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2.5 whitespace-nowrap font-mono text-[10px] tracking-[0.14em]" style={{ color: t.dim }}>
        {range === "day"
          ? hours
            ? `PEAK ${peakHour}:00 · ${peakSteps} STEPS · SO FAR`
            : "HOURLY NOT REPORTED"
          : `AVG ${avg} · BEST ${best}`}
      </p>
      {range === "day" ? (
        <p className="mt-1 whitespace-nowrap font-mono text-[9px] tracking-[0.18em]" style={{ color: t.dim }}>
          {hours ? "DRAG ACROSS THE CHART" : "SWITCH TO WEEK FOR REPORTED DAYS"}
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 font-mono text-[9px] tracking-[0.14em]" style={{ color: t.dim }}>
          <span className="whitespace-nowrap">{live && !sample ? `${live.reportedDays}/7 REPORTED` : "SAMPLE DATA"}</span>
          <span className="whitespace-nowrap">{week.some((w) => w.v === null) ? "TAP A DAY · HOLLOW = NO REPORT" : "TAP A DAY"}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, t }: { label: string; value: string; sub?: string; t: Tokens }) {
  return (
    <div className="rounded-[18px] p-3" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <p className="text-[13px] font-medium" style={{ color: t.dim }}>
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap font-mono text-[16px] tracking-tight" style={{ color: t.ink }}>
        {value}
      </p>
      {sub ? (
        <p className="whitespace-nowrap pt-0.5 font-mono text-[10px] tracking-[0.14em]" style={{ color: t.dim }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Strava route redrawn as a Nothing dot-matrix trace with a live runner. */
function RouteMap({ reduced, t, privateZones, dist }: { reduced: boolean; t: Tokens; privateZones: boolean; dist: string }) {
  const pathRef = useRef<SVGPathElement>(null);
  const travelledRef = useRef<SVGPathElement>(null);
  const zoneARef = useRef<SVGPathElement>(null);
  const zoneBRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const progressRef = useRef<SVGTextElement>(null);
  const ringRefs = useRef<(SVGGElement | null)[]>([]);
  const [marks, setMarks] = useState<{ x: number; y: number }[]>([]);
  const [ends, setEnds] = useState({ sx: 44, sy: 200, ex: 96, ey: 200 });

  const FRACTIONS = [0.2, 0.4, 0.6, 0.8];
  const SAMPLES = 240;

  useEffect(() => {
    const p = pathRef.current;
    const travelled = travelledRef.current;
    const zoneA = zoneARef.current;
    const zoneB = zoneBRef.current;
    if (!p || !travelled || !zoneA || !zoneB) return;
    const L = p.getTotalLength();
    const at = (f: number) => {
      const pt = p.getPointAtLength(L * Math.min(1, Math.max(0, f)));
      return { x: pt.x, y: pt.y };
    };
    /* A static subpath between two fractions — used for privacy masking. */
    const section = (a: number, b: number, steps = 24) => {
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const pt = at(a + ((b - a) * i) / steps);
        d += `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      }
      return d;
    };
    /* The travelled trace: a subpath sampled from 0 to the live fraction. */
    const paint = (f: number) => {
      let d = "";
      for (let i = 0; i <= SAMPLES; i++) {
        const pt = at((f * i) / SAMPLES);
        d += `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      }
      travelled.setAttribute("d", d);
      const tip = at(f);
      runnerRef.current?.setAttribute("cx", String(tip.x));
      runnerRef.current?.setAttribute("cy", String(tip.y));
      haloRef.current?.setAttribute("cx", String(tip.x));
      haloRef.current?.setAttribute("cy", String(tip.y));
      /* Live progress readout, written straight to the DOM so the 60fps
         loop never re-renders React. Fraction of path ≈ fraction of run. */
      if (progressRef.current) {
        progressRef.current.textContent = `KM ${(f * parseFloat(dist)).toFixed(1)} / ${dist}`;
      }
      FRACTIONS.forEach((fr, i) => {
        ringRefs.current[i]?.setAttribute("opacity", fr <= f ? "1" : "0.25");
      });
    };
    setMarks(FRACTIONS.map(at));
    const s = at(0);
    const e = at(0.999);
    setEnds({ sx: s.x, sy: s.y, ex: e.x, ey: e.y });
    /* Privacy mask: card-ink dots erase the travelled trace near home. */
    zoneA.setAttribute("d", privateZones ? section(0, 0.08) : "");
    zoneB.setAttribute("d", privateZones ? section(0.92, 1) : "");
    if (reduced) {
      paint(0.55);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ADVANCE = 7500;
    const DWELL = 1500;
    const tick = (now: number) => {
      const elapsed = (now - t0) % (ADVANCE + DWELL);
      paint(Math.min(1, elapsed / ADVANCE));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, privateZones]);

  /* Knockout halo so type never clashes with the trace. */
  const halo = { paintOrder: "stroke" as const, stroke: t.card, strokeWidth: 5 };

  return (
    <svg viewBox="0 0 360 250" className="h-auto w-full" role="img" aria-label={`${dist} kilometre run route as a dotted trace`}>
      {Array.from({ length: 12 }).map((_, r) =>
        Array.from({ length: 18 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={10 + c * 20} cy={8 + r * 21} r={0.8} fill={t.faint} />
        )),
      )}
      {/* the plan: full route, dim */}
      <path ref={pathRef} d={ROUTE} fill="none" stroke={t.faint} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 10" />
      {/* the truth: only what has actually been run */}
      <path ref={travelledRef} d="" fill="none" stroke={t.dot} strokeOpacity={0.9} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 10" />
      {/* privacy mask: card ink erases the trace near home — same period so mask dots stay phase-aligned, no fringing */}
      <path ref={zoneARef} d="" fill="none" stroke={t.card} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 10" />
      <path ref={zoneBRef} d="" fill="none" stroke={t.card} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 10" />
      {marks.map((m, i) => (
        <g key={i} ref={(el) => { ringRefs.current[i] = el; }}>
          <circle cx={m.x} cy={m.y} r={7} fill={t.card} stroke={t.dot} strokeWidth={2} opacity={0.9} />
          <text x={m.x} y={m.y - 12} textAnchor="middle" fill={t.dot} fontSize={10} fontFamily="monospace" letterSpacing={1} {...halo}>
            {`KM${i + 1}`}
          </text>
        </g>
      ))}
      <g opacity={privateZones ? 0.15 : 1}>
        <circle cx={ends.sx} cy={ends.sy} r={5} fill={t.dot} />
        <text x={ends.sx} y={ends.sy - 12} textAnchor="middle" fill={t.dot} fontSize={10} fontFamily="monospace" letterSpacing={1} {...halo}>
          START
        </text>
        <circle cx={ends.ex} cy={ends.ey} r={5} fill={t.red} />
        <text x={ends.ex} y={ends.ey - 12} textAnchor="middle" fill={t.red} fontSize={10} fontFamily="monospace" letterSpacing={1} {...halo}>
          FINISH
        </text>
      </g>
      {privateZones && (
        <>
          {/* zone extent: dashed rings show how much of each end stays home.
              The label sits bottom-right, off the route, so it can never
              overlap the trace, the KM rings, or the progress readout. */}
          <circle cx={ends.sx} cy={ends.sy} r={16} fill="none" stroke={t.dim} strokeWidth={1} strokeDasharray="3 4" opacity={0.8} />
          <circle cx={ends.ex} cy={ends.ey} r={16} fill="none" stroke={t.dim} strokeWidth={1} strokeDasharray="3 4" opacity={0.8} />
          <text
            x={350}
            y={242}
            textAnchor="end"
            fill={t.dim}
            fontSize={9}
            fontFamily="monospace"
            letterSpacing={2}
            {...halo}
          >
            HOME ZONE HIDDEN
          </text>
        </>
      )}
      <circle ref={haloRef} r={11} fill="none" stroke={t.red} strokeWidth={1.5} opacity={0.5} />
      <circle ref={runnerRef} r={4.5} fill={t.red} stroke={t.card} strokeWidth={1.5} />
      <text ref={progressRef} x={10} y={242} fill={t.ink} fontSize={10} fontFamily="monospace" letterSpacing={1} {...halo}>
        {`KM 0.0 / ${dist}`}
      </text>
    </svg>
  );
}

/* --------------------------------- home ------------------------------------ */

function StatusBar({ time, t, onWidget }: { time: string; t: Tokens; onWidget: boolean }) {
  return (
    /* One line on both platforms: official render centres time and hole on
       the same row just under the bezel — pt-[3%] of screen width tracks the
       hole line at every size, phone and preview share it exactly. */
    <div className="flex items-center justify-between px-6 pt-[3%] font-mono text-[12px] tracking-[0.02em]" style={{ color: onWidget ? "#fff" : t.ink }}>
      <span>{time}</span>
      <span className="flex items-center gap-1.5" aria-label="Signal, wifi, battery">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden>
          {[3, 5, 8, 11].map((h, i) => (
            <rect key={i} x={i * 4.4} y={11 - h} width={3} rx={0.8} height={h} fill={onWidget ? "#fff" : t.ink} />
          ))}
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 12" aria-hidden>
          <path d="M1 4.5C4.5 1.5 11.5 1.5 15 4.5M4 7.5c2.4-2 5.6-2 8 0M7 10.2c.6-.5 1.4-.5 2 0" stroke={onWidget ? "#fff" : t.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </svg>
        <span className="ml-0.5 inline-block h-[12px] w-[25px] rounded-[4px] border p-[1.5px]" style={{ borderColor: onWidget ? "rgba(255,255,255,0.5)" : t.dim }}>
          <span className="block h-full rounded-[1.5px]" style={{ width: "82%", background: onWidget ? "#fff" : t.ink }} />
        </span>
      </span>
    </div>
  );
}

/** The circular clock widget: white hands, one red dot at six. */
function ClockFace({ time, t }: { time: string; t: Tokens }) {
  const [h, m] = time.split(":").map(Number);
  const ha = ((h % 12) + m / 60) * 30;
  const ma = m * 6;
  const hand = (angle: number, len: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x2: 60 + len * Math.cos(a), y2: 60 + len * Math.sin(a) };
  };
  const hh = hand(ha, 24);
  const mh = hand(ma, 36);
  return (
    <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" role="img" aria-label={`Analog clock showing ${time}`} style={{ borderRadius: "50%", border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <circle cx={60} cy={60} r={58} fill={t.widget} />
      <line x1={60} y1={60} {...hh} stroke={t.dot} strokeWidth={9} strokeLinecap="round" />
      <line x1={60} y1={60} {...mh} stroke={t.dim} strokeWidth={4} strokeLinecap="round" />
      <circle cx={60} cy={60} r={3.5} fill={t.dot} />
      <circle cx={60} cy={112} r={4} fill={t.red} />
    </svg>
  );
}

/** Date squircle, dot-matrix capitals exactly like the device. Live date only — no invented weather. */
function DateCard({ weekday, dayMonth, t }: { weekday: string; dayMonth: string; t: Tokens }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[8px] rounded-[28px] p-4" role="group" aria-label={`${weekday} ${dayMonth}`} style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <Matrix t={t} text={weekday} dot={1.15} pitch={2.6} />
      <Matrix t={t} text={dayMonth} dot={1.15} pitch={2.6} />
    </div>
  );
}

/**
 * The pedometer widget: live today over live 7-day average, with the
 * device's own wording. Fixtures stand in only until the feed resolves; a
 * healthy feed with no report today shows a dash and NO REPORT, never a zero.
 */
function PedoWidget({ onOpen, shellId, t, live, status }: { onOpen: () => void; shellId?: string; t: Tokens; live: StepsSnapshot | null; status: FeedStatus }) {
  const row = "flex items-baseline justify-between gap-2";
  const sample = status === "loading" || status === "offline";
  const today = sample ? STEPS : live?.today ?? null;
  const avg = live ? live.average7 : WEEK_AVG_NUM;
  const goal = live?.goal ?? GOAL;
  const todayPct = today === null ? null : Math.max(0, Math.round((today / goal) * 100));
  const avgPct = Math.max(0, Math.round((avg / goal) * 100));
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layoutId={shellId}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      aria-label={
        today === null
          ? `Open pedometer details: no steps reported today, ${avg.toLocaleString("en-US")} seven-day average`
          : `Open pedometer details: ${today.toLocaleString("en-US")} total today, ${avg.toLocaleString("en-US")} seven-day average`
      }
      className="block w-[184px] rounded-[28px] p-[15px] text-left"
      style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop }}
    >
      <Matrix t={t} text={today === null ? "--" : today.toLocaleString("en-US")} dot={1.8} pitch={4.1} label={today === null ? "No steps reported today" : `${today}`} slots={6} />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="TOTAL TODAY" dot={0.7} pitch={1.6} />
        <span className="font-mono whitespace-nowrap text-[10px]" style={{ color: t.dim }}>
          {today === null || todayPct === null ? "NO REPORT" : `${todayPct}%`}
        </span>
      </span>
      <span className="my-[11px] block h-px" style={{ background: t.faint }} aria-hidden />
      <Matrix t={t} text={avg.toLocaleString("en-US")} dot={1.8} pitch={4.1} label={`${avg}`} slots={6} />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="7-DAY AVERAGE" dot={0.7} pitch={1.6} />
        <span className="font-mono whitespace-nowrap text-[10px]" style={{ color: t.dim }}>
          {avgPct}%
        </span>
      </span>
    </motion.button>
  );
}

function Dock({ t }: { t: Tokens }) {
  return (
    <div className="mt-auto px-7 pb-2">
      <div className="grid grid-cols-4 gap-4">
        {[
          { id: "phone", Icon: PhoneIcon },
          { id: "messages", Icon: MessageIcon },
          { id: "camera", Icon: CameraIcon },
          { id: "settings", Icon: GearIcon },
        ].map(({ id, Icon }) => {
          return (
            <div
              key={id}
              className="flex items-center justify-center rounded-full"
              style={{ background: t.dock, aspectRatio: "1", color: t.onDock }}
            >
              <Icon size={22} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-full px-4 py-3" style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop, color: t.dim }}>
        <SearchIcon size={15} />
        <span className="text-[14px]" style={{ color: t.dim }}>
          Search
        </span>
      </div>
      <div className="mx-auto mb-1.5 mt-3.5 h-[4px] w-[120px] rounded-full" style={{ background: t.faint }} aria-hidden />
    </div>
  );
}

function HomeScreen({
  now,
  onOpen,
  shellId,
  t,
  live,
  status,
  fresh,
}: {
  now: { time: string; dateLine: string; weekday: string; dayMonth: string };
  onOpen: () => void;
  shellId?: string;
  t: Tokens;
  live: StepsSnapshot | null;
  status: FeedStatus;
  fresh: boolean;
}) {
  const note = homeNote(live, status, fresh);
  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ background: t.wallpaper }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: DUR.fast, ease: EASE_OUT } }}
    >
      <StatusBar time={now.time} t={t} onWidget={false} />
      <div className="flex items-start gap-3 px-4 pt-4">
        <DateCard weekday={now.weekday} dayMonth={now.dayMonth} t={t} />
        <ClockFace time={now.time} t={t} />
      </div>
      <div className="flex justify-end px-4 pt-3">
        <PedoWidget onOpen={onOpen} shellId={shellId} t={t} live={live} status={status} />
      </div>
      <p className="px-4 whitespace-nowrap pt-2 text-right font-mono text-[9px] tracking-[0.2em]" style={{ color: note === "·" ? "transparent" : t.dim }} aria-hidden={note === "·"}>
        {note}
      </p>
      <Dock t={t} />
    </motion.div>
  );
}

/* -------------------------------- detail ----------------------------------- */

function DetailScreen({
  onClose,
  onRun,
  visits,
  shellId,
  t,
  live,
  status,
}: {
  onClose: () => void;
  onRun: () => void;
  visits: number;
  shellId?: string;
  t: Tokens;
  live: StepsSnapshot | null;
  status: FeedStatus;
}) {
  const sample = status === "loading" || status === "offline";
  const target = sample ? STEPS : live?.today ?? null;
  const goal = live?.goal ?? GOAL;
  const run = runFigures(live, sample);
  const steps = useCountUp(target ?? 0, visits);
  /* Tap-to-decode: the hero numerals flip to plain figures and back.
     Everything morphs on tap in this concept, so numerals do too. */
  const [decoded, setDecoded] = useState(false);
  const pct = target === null ? 0 : Math.max(0, Math.round((target / goal) * 100));
  const toGo = Math.max(0, goal - (target ?? 0)).toLocaleString("en-US");
  const goalFmt = goal.toLocaleString("en-US");
  const distance = target === null ? "—" : kmOf(target);
  const energy = target === null ? "—" : String(Math.round((target * KCAL) / STEPS));
  const active = target === null ? "—" : String(Math.round((target * ACTIVE_MIN) / STEPS));
  const feedLine = syncLine(live, status);
  return (
    <motion.div
      layoutId={shellId}
      transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: t.ground }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-9">
        {/* base pt-5 is the phone — untouched. */}
        <div className="flex items-center gap-4 px-5 pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to home screen"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: t.ink }}
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <h1 className="px-5 pt-2 text-balance text-[34px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Today
        </h1>

        <Rise index={0} className="px-4 pt-4">
          <div className="rounded-[20px] p-[18px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <button
              type="button"
              onClick={() => setDecoded((d) => !d)}
              disabled={target === null}
              aria-pressed={decoded}
              aria-label={
                target === null
                  ? "No steps reported today"
                  : decoded
                    ? "Show dot-matrix numerals"
                    : `Show ${steps.toLocaleString("en-US")} as plain numbers`
              }
              className="block w-full cursor-pointer text-left disabled:cursor-default"
            >
              {target !== null && decoded ? (
                <p className="font-mono font-medium tabular-nums" style={{ color: t.ink, fontSize: 44, lineHeight: 1.15 }}>
                  {steps.toLocaleString("en-US")}
                </p>
              ) : target !== null ? (
                <Matrix t={t} text={steps.toLocaleString("en-US")} dot={3.2} pitch={8} label={`${steps} steps`} slots={6} />
              ) : (
                <Matrix t={t} text="--" dot={3.2} pitch={8} label="No steps reported today" slots={6} />
              )}
            </button>
            <div className="mt-3.5">
              <DottedLine frac={target === null ? 0 : target / goal} total={32} t={t} />
            </div>
            <p className="mt-2.5 whitespace-nowrap font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
              {target === null ? (
                <>NO REPORT TODAY · {goalFmt} GOAL</>
              ) : (
                <>
                  <span style={{ color: t.ink }}>{pct}%</span> OF {goalFmt} · {toGo} TO GO
                </>
              )}
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[9px] tracking-[0.16em]" style={{ color: t.dim }}>
              {!sample && <span className="whitespace-nowrap">COUNTED ON-DEVICE ·</span>}
              <span className="whitespace-nowrap">{feedLine}</span>
            </p>
          </div>
        </Rise>

        <Rise index={1} className="grid grid-cols-3 gap-2 px-4 pt-2.5">
          <Stat label="Distance" value={distance} sub={target === null ? undefined : "KM"} t={t} />
          <Stat label="Energy" value={energy} sub={target === null ? undefined : "KCAL"} t={t} />
          <Stat label="Active" value={active} sub={target === null ? undefined : "MIN"} t={t} />
        </Rise>

        <Rise index={2} className="px-4 pt-2.5">
          <ActivityCard t={t} live={live} status={status} />
        </Rise>

        <Rise index={3} className="px-4 pt-2.5">
          <motion.button
            type="button"
            onClick={run ? onRun : undefined}
            disabled={!run}
            whileTap={run ? { scale: 0.98 } : undefined}
            className="flex w-full items-center justify-between rounded-[20px] px-5 py-4 font-mono text-[12px] tracking-[0.18em]"
            /* Fixed black in both themes — never a theme token. */
            style={{ background: "#0A0A0A", color: "#FFFFFF", opacity: run ? 1 : 0.5 }}
            aria-label={run ? "View morning run" : "No run reported today"}
            aria-disabled={!run}
          >
            <span>{run ? `MORNING RUN · ${run.dist} KM` : "MORNING RUN · NO RUN TODAY"}</span>
            <span aria-hidden>
              <ArrowRight size={16} />
            </span>
          </motion.button>
          <p className="pt-3 whitespace-nowrap text-center font-mono text-[9px] tracking-[0.2em]" style={{ color: t.dim }}>
            EVERY STAT FREE · NOTHING UPLOADED
          </p>
        </Rise>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- run ------------------------------------ */

function RunScreen({ onBack, onShare, privacy, setPrivacy, t, live }: { onBack: () => void; onShare: () => void; privacy: boolean; setPrivacy: (v: boolean) => void; t: Tokens; live: StepsSnapshot | null }) {
  const reduced = useReducedMotion();
  const max = Math.max(...ELEV);
  const run = runFigures(live) ?? { dist: RUN_DIST, time: RUN.time, kcal: RUN.kcal };
  const [decoded, setDecoded] = useState(false);
  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ background: t.ground }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
      transition={{ duration: reduced ? 0 : DUR.morph, ease: EASE_EMPHASIZED }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-9">
        {/* base pt-5 is the phone — untouched. */}
        <div className="flex items-center justify-between px-5 pt-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to step details"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: t.ink }}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this run"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 font-mono whitespace-nowrap text-[10px] uppercase tracking-[0.22em]"
            style={{ color: t.dim }}
          >
            SHARE
          </button>
        </div>
        <h1 className="px-5 pt-2 text-balance text-[34px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Morning run
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          {RUN.when} · {run.dist} kilometres{RUN_SAMPLE ? " · sample" : ""}
        </p>

        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={() => setDecoded((d) => !d)}
            aria-pressed={decoded}
            aria-label={decoded ? "Show dot-matrix numerals" : `Show ${run.dist} kilometres as plain numbers`}
            className="block w-full cursor-pointer text-left"
          >
            {decoded ? (
              <p className="font-mono font-medium tabular-nums" style={{ color: t.ink, fontSize: 40, lineHeight: 1.15 }}>
                {run.dist} <span className="text-[0.45em] tracking-[0.18em]" style={{ color: t.dim }}>KM</span>
              </p>
            ) : (
              <Matrix t={t} text={run.dist} dot={2.6} pitch={6.5} label={`${run.dist} kilometres`} />
            )}
          </button>
        </div>

        <Rise index={0} className="px-4 pt-3">
          <div className="overflow-hidden rounded-[20px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <RouteMap reduced={reduced} t={t} privateZones={privacy} dist={run.dist} />
            <div className="flex items-center justify-between border-t px-4 py-2.5 font-mono text-[9px] tracking-[0.18em]" style={{ borderColor: t.faint, color: t.dim }}>
              <span>TRACE</span>
              <span>
                <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-baseline" style={{ background: t.red }} />
                YOU · LIVE
              </span>
              <span>DOTTED ROUTE</span>
            </div>
          </div>
        </Rise>

        <Rise index={1} className="px-4 pt-2.5">
          <button
            type="button"
            onClick={() => setPrivacy(!privacy)}
            aria-pressed={privacy}
            aria-label="Privacy zone: hide start and finish near home"
            className="relative flex w-full items-center justify-between overflow-hidden rounded-[20px] px-[18px] py-3.5"
            style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}
          >
            {privacy && <span className="absolute inset-0" style={{ background: t.faint, opacity: 0.45 }} aria-hidden />}
            <span className="text-left">
              <span className="block text-[13px] font-medium" style={{ color: t.ink }}>
                Privacy zone {privacy ? "on" : "off"}
              </span>
              <span className="block pt-0.5 font-mono text-[9px] tracking-[0.16em]" style={{ color: t.dim }}>
                HIDES START + FINISH NEAR HOME
              </span>
            </span>
            <span
              className="flex h-7 w-12 shrink-0 items-center rounded-full p-[2px]"
              style={{ background: privacy ? t.dot : t.faint }}
              aria-hidden
            >
              <motion.span
                className="block h-6 w-6 rounded-full"
                style={{ background: privacy ? t.card : t.dim }}
                animate={{ x: privacy ? 20 : 0 }}
                transition={{ duration: DUR.micro, ease: EASE_OUT }}
              />
            </span>
          </button>
        </Rise>

        <Rise index={2} className="grid grid-cols-3 gap-2 px-4 pt-2.5">
          <Stat label="Time" value={run.time} t={t} />
          <Stat label="Pace" value={RUN_PACE} sub="/KM" t={t} />
          <Stat label="Energy" value={run.kcal} sub="KCAL" t={t} />
        </Rise>

        <Rise index={3} className="px-4 pt-2.5">
          <div className="rounded-[20px] p-[18px]" role="img" aria-label={`Elevation profile, plus ${ELEV_GAIN} metres total climb`} style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <div className="flex items-baseline justify-between">
              <p className={SANS_LABEL} style={{ color: t.dim }}>
                Elevation
              </p>
              <p className="font-mono whitespace-nowrap text-[10px]" style={{ color: t.dim }}>
                +{ELEV_GAIN} M
              </p>
            </div>
            <div className="mt-3 flex h-[52px] items-end gap-[3px]" aria-hidden>
              {ELEV.map((e, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{ height: `${(e / max) * 100}%`, background: t.dot, opacity: e === max ? 1 : 0.45 }}
                />
              ))}
            </div>
            <p className="mt-2.5 whitespace-nowrap font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
              {ELEV_LINE}
            </p>
          </div>
        </Rise>

        <Rise index={4} className="px-4 pt-2.5">
          <div className="overflow-hidden rounded-[20px]" role="list" aria-label="Kilometre splits" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            {SPLITS.map((s, i) => (
              <div
                key={s.km}
                role="listitem"
                className="flex items-center justify-between px-[18px] py-3 font-mono text-[12px]"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${t.faint}`, color: t.ink }}
              >
                <span className="tracking-[0.14em]">KM {s.km}</span>
                <span>{s.pace}</span>
                <span style={{ color: t.dim }}>{s.hr} BPM</span>
              </div>
            ))}
            <p className="border-t px-[18px] py-3 font-mono text-[10px] tracking-[0.16em]" style={{ borderColor: t.faint, color: t.dim }}>
              {SPLIT_LINE}
            </p>
          </div>
        </Rise>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- share ----------------------------------- */

type ShareTarget = "sheet" | "x" | "instagram" | "whatsapp" | "telegram";

/** The artifact: what actually travels when a run is shared. Canvas-styled. */
function ShareCard({ t, privateZones, canvas, run }: { t: Tokens; privateZones: boolean; canvas: ShareCanvas; run: { dist: string; time: string; kcal: string } }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] px-4 py-5" style={{ background: canvas.bg, boxShadow: t.pop }}>
      {canvas.image && (
        <>
          <div className="absolute inset-0" style={{ background: `url(${canvas.image}) center/cover` }} aria-hidden />
          <div className="absolute inset-0" style={{ background: "rgba(5,5,8,0.55)" }} aria-hidden />
        </>
      )}
      <div className="relative flex flex-col items-center text-center">
      <p className="max-w-full text-balance font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: canvas.dim }}>
        Morning run · {RUN.when}{RUN_SAMPLE ? " · sample" : ""}
      </p>
      {privateZones && (
        <p className="mt-2 shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.18em]" style={{ background: canvas.chip, color: canvas.onChip }}>
          HOME HIDDEN
        </p>
      )}
      <div className="mt-3 flex justify-center">
        <DotText text={run.dist} dot={3.4 * t.dotScale} pitch={10.5} color={canvas.dot} dimOpacity={canvas.image ? 0 : t.unlit} label={`${run.dist} kilometres`} />
      </div>
      <p className="mt-1 font-mono whitespace-nowrap text-[10px] tracking-[0.24em]" style={{ color: canvas.ink }}>KILOMETRES</p>
      <svg viewBox="0 0 360 250" className="mt-4 h-auto w-full" role="img" aria-label="Run route">
        <path d={ROUTE} fill="none" stroke={canvas.dot} strokeOpacity={0.9} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 10" />
        {/* hidden means hidden: endpoints are removed from the artifact, not ghosted */}
        <circle cx={44} cy={200} r={7} fill={canvas.dot} opacity={privateZones ? 0 : 1} />
        <circle cx={96} cy={200} r={7} fill={t.red} opacity={privateZones ? 0 : 1} />
      </svg>
      <div className="mt-3 flex items-center justify-center gap-5 font-mono text-[11px]" style={{ color: canvas.ink }}>
        <span>{run.time}</span>
        <span>{RUN_PACE}/KM</span>
        <span>{run.kcal} KCAL</span>
      </div>
      <p className="mt-2.5 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.26em]" style={{ color: canvas.dim }}>
        Nothing · Pedometer
      </p>
      </div>
    </div>
  );
}

function ShareSheet({ t, privacy, onPick, onClose, live }: { t: Tokens; privacy: boolean; onPick: (p: Exclude<ShareTarget, "sheet">) => void; onClose: () => void; live: StepsSnapshot | null }) {
  const run = runFigures(live) ?? { dist: RUN_DIST, time: RUN.time, kcal: RUN.kcal };
  /* Target tiles wear the platforms' real colors (Simple Icons hexes —
     no house tints. Instagram's real color is its brand gradient). */
  const targets = [
    { id: "x", label: "X", bg: "#000000", fg: "#FFFFFF", Icon: XIcon, size: 26 },
    { id: "instagram", label: "Instagram", bg: "linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)", fg: "#FFFFFF", Icon: InstagramIcon, size: 22 },
    { id: "whatsapp", label: "WhatsApp", bg: "#25D366", fg: "#FFFFFF", Icon: WhatsAppIcon, size: 22 },
    { id: "telegram", label: "Telegram", bg: "#26A5E4", fg: "#FFFFFF", Icon: TelegramIcon, size: 22 },
  ] as const;
  const reduced = useReducedMotion();
  return (
    <>
      <motion.button
        type="button"
        aria-label="Close share"
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] px-5 pb-7 pt-3"
        style={{ background: t.card, touchAction: "pan-x" }}
        role="dialog"
        aria-modal="true"
        aria-label="Share run"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
        transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
        drag={reduced ? false : "y"}
        dragConstraints={{ top: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div className="mx-auto h-[4px] w-[40px] rounded-full" style={{ background: t.faint }} aria-hidden />
        <p className="pt-3 text-[17px] font-normal" style={{ color: t.ink }}>
          Sharing 1 run
        </p>
        <div className="mt-2.5 flex items-center gap-3 rounded-[18px] px-4 py-3.5" style={{ background: t.faint }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: t.dot, color: t.ground }} aria-hidden>
            <span className="font-mono whitespace-nowrap text-[10px]">{run.dist}K</span>
          </span>
          <p className="truncate text-[12px]" style={{ color: t.ink }}>
            Morning run · {run.time}{privacy ? " · home hidden" : ""}{RUN_SAMPLE ? " · sample" : ""}
          </p>
        </div>
        <div className="mt-3 border-t pt-3" style={{ borderColor: t.faint }}>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Share targets">
          {targets.map((r) => (
            <button key={r.id} type="button" onClick={() => onPick(r.id)} className="flex min-h-[64px] flex-col items-center gap-2 py-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: r.bg, color: r.fg }} aria-hidden>
                <r.Icon size={r.size} />
              </span>
              <span className="text-[12px]" style={{ color: t.ink }}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
        </div>
        <div className="mx-auto mt-4 h-[4px] w-[120px] rounded-full" style={{ background: t.faint }} aria-hidden />
      </motion.div>
    </>
  );
}

function XPost({ t, privacy, canvas, run }: { t: Tokens; privacy: boolean; canvas: ShareCanvas; run: { dist: string; time: string; kcal: string } }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E11A1B] font-mono text-[11px] text-white">
          N
        </span>
        <div>
          <p className="text-[13px] font-bold text-white">Pedometer</p>
          <p className="font-mono whitespace-nowrap text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            Draft · not yet posted
          </p>
        </div>
      </div>
      <div className="pt-2.5">
        <ShareCard t={t} canvas={canvas} privateZones={privacy} run={run} />
      </div>
      <p className="pt-3 text-pretty font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
        Replies and reposts appear after posting
      </p>
    </div>
  );
}

function StoryPreview({ t, privacy, canvas, run }: { t: Tokens; privacy: boolean; canvas: ShareCanvas; run: { dist: string; time: string; kcal: string } }) {
  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: "linear-gradient(170deg, #1A1C26 0%, #3A2E38 55%, #101014 100%)", aspectRatio: "9/16" }}>
      <div className="mx-auto mt-2 h-[3px] w-16 rounded-full bg-white/40" />
      <div className="px-4 pt-6">
        <ShareCard t={t} canvas={canvas} privateZones={privacy} run={run} />
      </div>
    </div>
  );
}

function WAPreview({ t, privacy, canvas, run }: { t: Tokens; privacy: boolean; canvas: ShareCanvas; run: { dist: string; time: string; kcal: string } }) {
  return (
    <div className="rounded-[20px] p-4" style={{ background: "#0B141A" }}>
      <p className="text-center font-mono text-[9px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        TODAY
      </p>
      <div className="ml-auto mt-2 w-[94%] rounded-[14px] rounded-tr-[4px] p-2" style={{ background: "#005C4B" }}>
        <div>
          <ShareCard t={t} canvas={canvas} privateZones={privacy} run={run} />
        </div>
        <p className="px-1 whitespace-nowrap text-right font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          {nowHM()} ✓✓
        </p>
      </div>
    </div>
  );
}

function TelegramPreview({ t, privacy, canvas, run }: { t: Tokens; privacy: boolean; canvas: ShareCanvas; run: { dist: string; time: string; kcal: string } }) {
  return (
    <div className="rounded-[20px] p-4" style={{ background: "#0E1621" }}>
      <p className="text-center font-mono text-[9px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        TODAY
      </p>
      <div className="ml-auto mt-2 w-[94%] rounded-[14px] rounded-tr-[4px] p-2" style={{ background: "#2AABEE" }}>
        <div>
          <ShareCard t={t} canvas={canvas} privateZones={privacy} run={run} />
        </div>
        <p className="px-1 whitespace-nowrap text-right font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.8)" }}>
          {nowHM()} ✓✓
        </p>
      </div>
    </div>
  );
}

function SharePreview({ platform, privacy, t, onBack, live }: { platform: Exclude<ShareTarget, "sheet">; privacy: boolean; onBack: () => void; t: Tokens; live: StepsSnapshot | null }) {
  const reduced = useReducedMotion();
  const run = runFigures(live) ?? { dist: RUN_DIST, time: RUN.time, kcal: RUN.kcal };
  const [shared, setShared] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!shared) return;
    const id = setTimeout(() => setShared(false), 1600);
    return () => clearTimeout(id);
  }, [shared]);
  const names = { x: "X POST", instagram: "INSTAGRAM STORY", whatsapp: "WHATSAPP", telegram: "TELEGRAM" } as const;
  const [canvasId, setCanvasId] = useState(SHARE_CANVASES[0].id);
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);
  const canvas =
    canvasId === "photo"
      ? photo
        ? photoCanvas(photo)
        : SHARE_CANVASES[0]
      : (SHARE_CANVASES.find((c) => c.id === canvasId) ?? SHARE_CANVASES[0]);
  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
    setCanvasId("photo");
    e.target.value = "";
  };
  /** Rasterized poster file — shared natively or saved for manual attach. */
  const buildPosterFile = async (): Promise<File> => {
    let photo: string | undefined;
    if (canvas.image) {
      const blob = await (await fetch(canvas.image)).blob();
      photo = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    }
    const svg = sharePosterSVG({
      dist: run.dist,
      time: run.time,
      pace: RUN_PACE,
      kcal: run.kcal,
      when: RUN.when,
      route: ROUTE,
      privacy,
      bg: canvas.bg,
      ink: canvas.ink,
      dot: canvas.dot,
      dim: canvas.dim,
      red: t.red,
      photo,
    });
    return sharePosterPNG(svg);
  };
  /** The poster as PNG bytes over native share — SVGs fail canShare on phones. */
  const tryImageShare = async (): Promise<boolean> => {
    try {
      const file = await buildPosterFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return true;
      }
    } catch {
      /* native image share unavailable — SAVE is the path */
    }
    return false;
  };
  /** Guaranteed path: save the PNG, attach it manually in any app. */
  const downloadPoster = async () => {
    try {
      const file = await buildPosterFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = "morning-run.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setShared(true);
    } catch {
      /* download unavailable — previews still show the card */
    }
  };
  const doShare = async () => {
    if (await tryImageShare()) {
      setUnavailable(false);
      setShared(true);
    } else {
      // Image or nothing: no caption fallback, SAVE carries the poster.
      setUnavailable(true);
      setShared(false);
    }
  };
  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ background: t.ground }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
      transition={{ duration: reduced ? 0 : DUR.morph, ease: EASE_EMPHASIZED }}
    >
      {/* base pt-5 is the phone — untouched. */}
      <div className="flex items-center justify-between px-5 pt-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to share options"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: t.ink }}
        >
          <ArrowLeft size={20} />
        </button>
        <p className={MICRO} style={{ color: t.dim }}>
          {names[platform]}
        </p>
        <div className="flex min-h-[44px] items-center gap-4">
          <button
            type="button"
            onClick={downloadPoster}
            className="font-mono text-[11px] tracking-[0.18em]"
            style={{ color: t.dim }}
            aria-label="Save poster PNG"
          >
            SAVE
          </button>
          <button
            type="button"
            onClick={doShare}
            className="font-mono text-[11px] tracking-[0.18em]"
            style={{ color: shared ? t.dim : t.ink }}
          >
            {shared ? "SHARED ✓" : "SHARE"}
          </button>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {unavailable && (
          <p className="pb-3 text-pretty text-[13px]" style={{ color: t.dim }}>
            System share isn&apos;t available here — SAVE the PNG and attach it manually.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pb-3">
          <p className={MICRO} style={{ color: t.dim }}>
            Canvas · {canvasId === "photo" ? "Photo" : canvas.label}
          </p>
          <div className="flex gap-2" role="group" aria-label="Share card canvas">
            {SHARE_CANVASES.map((c) => {
              const active = c.id === canvasId;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  onClick={() => setCanvasId(c.id)}
                  aria-pressed={active}
                  aria-label={`${c.label} canvas`}
                  whileTap={{ scale: 0.88 }}
                  className="h-7 w-7 rounded-full"
                  style={{
                    background: c.swatch,
                    border: `1px solid ${t.faint}`,
                    boxShadow: active ? `0 0 0 2px ${t.ground}, 0 0 0 3.5px ${t.ink}` : "none",
                  }}
                />
              );
            })}
            <motion.label
              htmlFor="photo-upload"
              onClick={(e) => {
                if (canvasId !== "photo" && photo) {
                  e.preventDefault();
                  setCanvasId("photo");
                }
              }}
              aria-label={photo ? "Photo canvas" : "Add a photo canvas"}
              whileTap={{ scale: 0.88 }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full"
              style={{
                background: photo ? `url(${photo}) center/cover` : "transparent",
                border: `1px dashed ${t.dim}`,
                color: t.dim,
                boxShadow: canvasId === "photo" ? `0 0 0 2px ${t.ground}, 0 0 0 3.5px ${t.ink}` : "none",
              }}
            >
              {!photo && <CameraIcon size={13} />}
            </motion.label>
          </div>
        </div>
        <input id="photo-upload" ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPhotoFile} aria-label="Upload a photo background" />
        {platform === "x" && <XPost t={t} privacy={privacy} canvas={canvas} run={run} />}
        {platform === "instagram" && <StoryPreview t={t} privacy={privacy} canvas={canvas} run={run} />}
        {platform === "whatsapp" && <WAPreview t={t} privacy={privacy} canvas={canvas} run={run} />}
        {platform === "telegram" && <TelegramPreview t={t} privacy={privacy} canvas={canvas} run={run} />}
      </div>
    </motion.div>
  );
}

/* ---------------------------------- root ----------------------------------- */

const STAGE_LINE = {
  home: "THE WIDGET, EXACTLY AS IT SHIPS — TAP IT",
  detail: "ONE TAP — EVERYTHING IT ALREADY KNOWS",
  run: "THE RUN, IN NOTHING'S LANGUAGE",
} as const;

export function PedometerExperience() {
  const [stage, setStage] = useState<"home" | "detail" | "run">("home");
  const [visits, setVisits] = useState(0);
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [share, setShareState] = useState<null | ShareTarget>(null);
  const [privacy, setPrivacy] = useState(false);
  /* Record mode (?clean=1): hides the floating chrome + floor glow + phone
     drop shadow so a screen recording composites over any presentation bg
     without a dark halo. Effect-set to avoid an SSR hydration mismatch. */
  const [clean, setClean] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("clean") === "1") setClean(true);
  }, []);
  const reduced = useReducedMotion();
  const now = useNow();
  const { live, status } = useLiveSteps();
  const t = THEMES[theme];
  const shellId = reduced ? undefined : "pedometer-shell";

  const open = () => {
    setVisits((v) => v + 1);
    setStage("detail");
  };

  /* Share overlay with a ref mirror so Esc can read it synchronously. */
  const shareRef = useRef(share);
  const setShare = (v: null | ShareTarget) => {
    shareRef.current = v;
    setShareState(v);
  };

  /* System-back mirror: Esc closes share first, then walks the stack back. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const sh = shareRef.current;
      if (sh) {
        setShare(sh === "sheet" ? null : "sheet");
        return;
      }
      setStage((s) => (s === "run" ? "detail" : s === "detail" ? "home" : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-x-clip" style={{ background: t.ground, color: t.ink }}>
      {/* Floating chrome: docked left of the device (never above it, so it
          can never collide with the frame, the hole, or in-screen headers).
          Zero flow height — the full viewport belongs to the device. Only on
          wide screens (lg); smaller viewports and the phone get no chrome.
          Floor-lit (not theme-lit): the floor is always dark.
          Hidden in record mode (?clean=1) so recordings stay chrome-free. */}
      {!clean && (
      <div
        className="pointer-events-none absolute z-40 hidden lg:block"
        style={{ left: "max(24px, calc(50% - 440px))", top: "50%", transform: "translateY(-50%)" }}
      >
        <div className="pointer-events-auto flex max-w-[210px] flex-col items-start gap-3">
          <div className="flex items-center gap-2" role="group" aria-label="Theme">
            {(["dark", "light"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTheme(m)}
                aria-pressed={theme === m}
                className="rounded-full border px-4 py-1.5 font-mono whitespace-nowrap text-[10px] uppercase tracking-[0.22em]"
                style={{
                  borderColor: "rgba(255,255,255,0.2)",
                  background: theme === m ? "#FFFFFF" : "transparent",
                  color: theme === m ? "#0A0A0A" : "rgba(255,255,255,0.6)",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="font-mono text-pretty text-[10px] uppercase leading-relaxed tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            OS 4.1 tokens
          </p>
          <div className="flex min-h-6 items-start justify-start overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: DUR.micro, ease: EASE_OUT }}
                className="font-mono text-pretty text-[10px] uppercase leading-relaxed tracking-[0.24em]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {STAGE_LINE[stage]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
      )}
      {/* web stage: full viewport height, device centred. The chrome floats,
          so the only budget off the viewport is breathing air (48px) — on a
          14" MacBook that resolves to exactly true size. Mobile stays
          full-bleed (the real 2a).
          Drop a presentation photo at public/stage-bg.jpg and the stage shows
          it (cover) over the studio gradient with a legibility scrim — record
          straight over your final bg instead of keying black out later.
          Missing file degrades to the gradient; nothing 404s visibly. */}
      <div className="stage-studio relative flex min-h-dvh w-full items-center justify-center p-0 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/stage-bg.jpg)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "rgba(8,8,10,0.42)" }}
        />
        {!clean && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 sm:block"
          aria-hidden
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.07), transparent 70%)" }}
        />
        )}
        {/* Phone (2a) in white, measured off Nothing's official front render:
            76.32 × 161.74mm footprint (aspect-locked), uniform slim bezels,
            hole centre 2.8% of the screen with the status row on its line,
            two separate black volume keys left + black power right, body
            corners ~11% of width. True size default (382px); shorter
            viewports shrink the whole device. Desktop preview only. */}
        <div className="relative h-dvh w-full sm:aspect-[76.32/161.74] sm:h-auto sm:w-[max(320px,min(382px,calc((100dvh-48px)*0.4719),calc(100vw-48px)))]">
          <div className="absolute -left-[4px] top-[30%] hidden h-[7%] w-[4px] rounded-l-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div className="absolute -left-[4px] top-[39%] hidden h-[7%] w-[4px] rounded-l-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div className="absolute -right-[4px] top-[34%] hidden h-[8%] w-[4px] rounded-r-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div
            className="relative h-full w-full overflow-hidden sm:rounded-[42px] sm:p-[3px] sm:ring-1 sm:ring-black/20"
            style={{
              background: "#E8E8E6",
              boxShadow: clean
                ? "inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.12)"
                : "0 50px 100px -24px rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.12)",
            }}
            role="region"
            aria-label="Nothing Phone 2a pedometer concept"
          >
            <div className="relative h-full w-full overflow-hidden bg-black sm:rounded-[39px] sm:p-[12px]">
              <div className="relative h-full w-full overflow-hidden sm:rounded-[27px]">
                {/* punch-hole camera: preview-only. Official render: centre
                    2.8% of the screen, Ø ~2.7% of width, status row aligned. */}
                <div className="pointer-events-none absolute left-1/2 top-[2.8%] z-30 hidden -translate-x-1/2 -translate-y-1/2 sm:block" aria-hidden>
                  <div className="flex h-[12px] w-[12px] items-center justify-center rounded-full bg-black" style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.9), inset 0 0 2px rgba(80,120,200,0.5)" }}>
                    <div className="h-[5px] w-[5px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #24365e 0%, #050507 70%)" }} />
                  </div>
                </div>
                {/* glass: barely-there diagonal sheen for the photoreal read, never over content */}
                <div className="pointer-events-none absolute inset-0 z-30 hidden sm:block" aria-hidden style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, transparent 28%)" }} />
                <AnimatePresence>
                  {stage === "home" && <HomeScreen key="home" now={now} onOpen={open} shellId={shellId} t={t} live={live} status={status} fresh={visits === 0} />}
                  {stage === "detail" && (
                    <DetailScreen key="detail" onClose={() => setStage("home")} onRun={() => setStage("run")} visits={visits} shellId={shellId} t={t} live={live} status={status} />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {stage === "run" && (
                    <RunScreen key="run" onBack={() => setStage("detail")} onShare={() => setShare("sheet")} privacy={privacy} setPrivacy={setPrivacy} t={t} live={live} />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {stage === "run" && share === "sheet" && (
                    <ShareSheet key="sheet" t={t} privacy={privacy} onPick={(p) => setShare(p)} onClose={() => setShare(null)} live={live} />
                  )}
                  {stage === "run" && share !== null && share !== "sheet" && (
                    <SharePreview key={share} platform={share} onBack={() => setShare("sheet")} privacy={privacy} t={t} live={live} />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
