"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_EMPHASIZED, EASE_OUT, STAGGER, useReducedMotion } from "@/lib/motion";
import { THEMES, type ThemeName, type Tokens } from "@/lib/theme";
import { SHARE_CANVASES, photoCanvas, type ShareCanvas } from "@/lib/share-canvases";
import { sharePosterPNG, sharePosterSVG } from "@/lib/share-poster";
import { ROUTE } from "@/lib/route";
import type { StepsSnapshot } from "@/lib/steps";
import { ArrowLeft, ArrowRight, CameraIcon, GearIcon, InstagramIcon, MessageIcon, PhoneIcon, SearchIcon, ShareIcon, TelegramIcon, WhatsAppIcon, XIcon } from "./icons";
import { DotText } from "./dot-matrix";

/**
 * Nothing pedometer — interaction concept, drawn in the owner's Nothing OS 4.1
 * language (Phone 2a, dark daily driver + inferred light).
 *
 * Measured tokens (lib/theme.ts): widget black #1B1A1F, settings ground
 * #232228 / cards #333237, the one red #E11A1B. Widget copy is the real
 * thing — "162 / TOTAL TODAY / 1 %" over "7,442 / 7-DAY AVERAGE / 74 %".
 *
 * Three stages: homescreen widget -> tap expands (shared element) into a
 * settings-language dashboard -> run trace. Back is always one level per
 * gesture: chevron, collapse, Esc-as-back. Native widgets never explain
 * themselves, so there is no "tap to expand" hint.
 */

/* --------------------------------- fixtures ---------------------------------- */
/* Concept fixtures, one block, one seam: every number below is static demo
   data. A live source (Health Connect post, at-home mock) replaces this block
   whole — no component reaches past it for a number. Widget copy ("162 /
   7,442") is the real device wording and stays even when values go live. */

const STEPS = 7284;
const GOAL = 10000;
const GOAL_PCT = Math.round((STEPS / GOAL) * 100);
const GOAL_TO_GO = (GOAL - STEPS).toLocaleString("en-US");
const GOAL_FMT = GOAL.toLocaleString("en-US");
const KM = 5.2;
const KCAL = 312;
const ACTIVE_MIN = 48;

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
const WEEK_AVG = Math.round(WEEK.reduce((a, b) => a + b.v, 0) / WEEK.length).toLocaleString("en-US");
const BEST_IDX = WEEK.reduce((bi, b, i) => (b.v > WEEK[bi].v ? i : bi), 0);
const WEEK_BEST = `${WEEK_DAYS[BEST_IDX]} ${WEEK[BEST_IDX].v.toLocaleString("en-US")}`;

const HOURLY = [0, 0, 0, 0, 0, 0, 120, 680, 420, 180, 240, 310, 520, 280, 190, 340, 410, 860, 1240, 540, 220, 90, 20, 0];
const PEAK_HOUR = HOURLY.indexOf(Math.max(...HOURLY));
const PEAK_STEPS = Math.max(...HOURLY).toLocaleString("en-US");

const RUN = { dist: "5.2", time: "32:14", pace: "6'12''", kcal: "268", when: "06:42" };
/** The run is a curated sample until the feed serves ExerciseSessions. */
const RUN_SAMPLE = true;

const SPLITS = [
  { km: "01", pace: "6'05''", hr: "146" },
  { km: "02", pace: "6'10''", hr: "151" },
  { km: "03", pace: "6'18''", hr: "154" },
  { km: "04", pace: "6'14''", hr: "157" },
  { km: "05", pace: "6'02''", hr: "161" },
];

const ELEV = [4, 6, 8, 7, 10, 12, 11, 14, 16, 15, 18, 22, 20, 24, 21, 26, 24, 28, 25, 22, 18, 14, 10, 8, 6, 5, 4, 3];
const ELEV_GAIN = 86;

const MICRO = "font-mono text-[10px] uppercase tracking-[0.22em]";
const SANS_LABEL = "text-[14px] font-medium";

/** Send-time stamp: the message goes out now, so it reads now. */
function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------------------------------- hooks --------------------------------- */

function useNow(): { time: string; dateLine: string; weekday: string; dayMonth: string } {
  const WDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (d: Date) => {
    const wd = WDays[d.getDay()];
    const dm = `${d.getDate()} ${months[d.getMonth()]}`;
    return {
      time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
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

/**
 * Live Health Connect snapshot via our own proxy (`/api/steps` keeps the
 * Bearer secret server-side). Null until the first fetch resolves or when
 * offline — every consumer falls back to the fixtures, never to blanks.
 */
function useLiveSteps(): StepsSnapshot | null {
  const [snap, setSnap] = useState<StepsSnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/steps", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!alive || !json || typeof json.today !== "number" || !Array.isArray(json.days)) return;
        setSnap(json as StepsSnapshot);
      } catch {
        /* offline — fixtures stand in */
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return snap;
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

/** 7-day activity as tappable dot columns. Tap a day to read it — today stays marked red, like the OS live position. */
function WeekDots({ week, today, selected, onSelect, t }: { week: { d: string; v: number }[]; today: number; selected: number; onSelect: (i: number) => void; t: Tokens }) {
  const max = Math.max(...week.map((w) => w.v), 1);
  const best = week.reduce((bi, b, i) => (b.v > week[bi].v ? i : bi), 0);
  const ROWS = 14;
  return (
    <div className="flex items-stretch justify-between gap-1" role="img" aria-label={`Steps this week, best ${week[best].v.toLocaleString("en-US")}`}>
      {week.map((b, i) => {
        const lit = Math.max(1, Math.round((b.v / max) * ROWS));
        const isToday = i === today;
        const isSel = i === selected;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={isSel}
            aria-label={`${b.d} ${b.v.toLocaleString("en-US")} steps${isToday ? ", today" : ""}`}
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

/** 24-hour activity as a scrub strip — drag across it like the sample chart. Same dot language, pointer-driven readout. */
function HourlyDots({ selected, onSelect, t }: { selected: number; onSelect: (i: number) => void; t: Tokens }) {
  const max = Math.max(...HOURLY);
  const ROWS = 12;
  const ref = useRef<HTMLDivElement>(null);
  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSelect(Math.min(23, Math.max(0, Math.floor(f * 24))));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={`Steps by hour today, peak ${PEAK_HOUR}:00`}
      aria-valuemin={0}
      aria-valuemax={23}
      aria-valuenow={selected}
      aria-valuetext={`${String(selected).padStart(2, "0")}:00, ${HOURLY[selected].toLocaleString("en-US")} steps`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) pick(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSelect(Math.max(0, selected - 1));
        if (e.key === "ArrowRight") onSelect(Math.min(23, selected + 1));
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
        {HOURLY.map((v, i) => {
          const lit = Math.round((v / max) * ROWS);
          const isSel = i === selected;
          return (
            <div key={i} className="flex flex-1 flex-col-reverse justify-start gap-[3px]">
              {Array.from({ length: ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="mx-auto rounded-full"
                  style={{
                    width: isSel ? 4 : 3,
                    height: isSel ? 4 : 3,
                    background: r < lit ? (isSel ? t.dot : t.dim) : t.faint,
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

/** One chart, two ranges — the sample's scrub + pill switcher, in Nothing's dot language. */
function ActivityCard({ t, live }: { t: Tokens; live: StepsSnapshot | null }) {
  const [range, setRange] = useState<"day" | "week">("day");
  const reduced = useReducedMotion();
  const week = live?.days.map((d) => ({ d: dayInitial(d.date), v: d.steps })) ?? WEEK;
  const names = live?.days.map((d) => dayName(d.date)) ?? WEEK_DAYS;
  const today = week.length - 1;
  const [selDay, setSelDay] = useState(today);
  const [selHour, setSelHour] = useState(PEAK_HOUR);
  const day = Math.min(selDay, week.length - 1);
  const avg = live ? Math.round(live.average7).toLocaleString("en-US") : WEEK_AVG;
  const bestIdx = week.reduce((bi, b, i) => (b.v > week[bi].v ? i : bi), 0);
  const best = live
    ? `${dayName(live.days[bestIdx].date)} ${week[bestIdx].v.toLocaleString("en-US")}`
    : WEEK_BEST;
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
        <p className={SANS_LABEL} style={{ color: t.dim }}>
          Activity
        </p>
        <div className="flex rounded-full p-[3px]" style={{ background: t.faint }} role="group" aria-label="Chart range">
          {(["day", "week"] as const).map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={active}
                className="relative min-h-[44px] min-w-[64px] rounded-full px-4 font-mono text-[10px] tracking-[0.16em]"
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
          text={(range === "day" ? HOURLY[selHour] : week[day].v).toLocaleString("en-US")}
          dot={2.2}
          pitch={5.4}
          label={`${(range === "day" ? HOURLY[selHour] : week[day].v).toLocaleString("en-US")} steps`}
          slots={6}
        />
        <p className="pb-1 text-right font-mono text-[9px] tracking-[0.18em]" style={{ color: t.dim }}>
          {range === "day" ? `${String(selHour).padStart(2, "0")}:00 · STEPS` : `${names[day]}${day === today ? " · TODAY" : ""}${day === bestIdx ? " · BEST" : ""}`}
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
              <HourlyDots t={t} selected={selHour} onSelect={tick(selHour, setSelHour)} />
            ) : (
              <WeekDots week={week} today={week.length - 1} selected={day} onSelect={tick(day, setSelDay)} t={t} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2.5 font-mono text-[10px] tracking-[0.14em]" style={{ color: t.dim }}>
        {range === "day" ? `PEAK ${PEAK_HOUR}:00 · ${PEAK_STEPS} STEPS` : `AVG ${avg} · BEST ${best}`}
      </p>
      <p className="mt-1 font-mono text-[9px] tracking-[0.18em]" style={{ color: t.dim }}>
        {range === "day" ? "DRAG ACROSS THE CHART" : "TAP A DAY"}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, t }: { label: string; value: string; sub?: string; t: Tokens }) {
  return (
    <div className="rounded-[18px] p-3.5" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <p className={SANS_LABEL} style={{ color: t.dim }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-[17px] tracking-tight" style={{ color: t.ink }}>
        {value} {sub ? <span className="text-[10px]" style={{ color: t.dim }}>{sub}</span> : null}
      </p>
    </div>
  );
}

/** Strava route redrawn as a Nothing dot-matrix trace with a live runner. */
function RouteMap({ reduced, t, privateZones }: { reduced: boolean; t: Tokens; privateZones: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const travelledRef = useRef<SVGPathElement>(null);
  const zoneARef = useRef<SVGPathElement>(null);
  const zoneBRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const ringRefs = useRef<(SVGGElement | null)[]>([]);
  const [marks, setMarks] = useState<{ x: number; y: number }[]>([]);
  const [ends, setEnds] = useState({ sx: 44, sy: 200, ex: 96, ey: 200 });

  const FRACTIONS = [0.2, 0.4, 0.6, 0.8];
  const SAMPLES = 160;

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
    <svg viewBox="0 0 360 250" className="h-auto w-full" role="img" aria-label={`${RUN.dist} kilometre run route as a dotted trace`}>
      {Array.from({ length: 12 }).map((_, r) =>
        Array.from({ length: 18 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={10 + c * 20} cy={8 + r * 21} r={0.8} fill={t.faint} />
        )),
      )}
      {/* the plan: full route, dim */}
      <path ref={pathRef} d={ROUTE} fill="none" stroke={t.faint} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 9" />
      {/* the truth: only what has actually been run */}
      <path ref={travelledRef} d="" fill="none" stroke={t.dot} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 9" />
      {/* privacy mask: card ink erases the trace near home */}
      <path ref={zoneARef} d="" fill="none" stroke={t.card} strokeWidth={7} strokeLinecap="round" strokeDasharray="0.1 9.5" />
      <path ref={zoneBRef} d="" fill="none" stroke={t.card} strokeWidth={7} strokeLinecap="round" strokeDasharray="0.1 9.5" />
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
      </g>
      {privateZones && (
        <text
          x={ends.sx < 80 ? ends.sx + 10 : ends.sx}
          y={ends.sy + 20}
          textAnchor={ends.sx < 80 ? "start" : "middle"}
          fill={t.dim}
          fontSize={9}
          fontFamily="monospace"
          letterSpacing={2}
        >
          HOME ZONE HIDDEN
        </text>
      )}
      <circle ref={haloRef} r={11} fill="none" stroke={t.red} strokeWidth={1.5} opacity={0.5} />
      <circle ref={runnerRef} r={4.5} fill={t.red} stroke={t.card} strokeWidth={1.5} />
    </svg>
  );
}

/* --------------------------------- home ------------------------------------ */

function StatusBar({ time, t, onWidget }: { time: string; t: Tokens; onWidget: boolean }) {
  return (
    /* base pt-4 is the phone as-shipped — untouched. sm:pt drops the desktop
       preview row onto the punch-hole line, per official renders. */
    <div className="flex items-center justify-between px-6 pt-4 font-mono text-[12px] tracking-[0.02em] sm:pt-[40px]" style={{ color: onWidget ? "#fff" : t.ink }}>
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
 * device's own wording. Fixtures stand in only until the feed resolves.
 */
function PedoWidget({ onOpen, shellId, t, live }: { onOpen: () => void; shellId?: string; t: Tokens; live: StepsSnapshot | null }) {
  const row = "flex items-baseline justify-between gap-2";
  const today = live?.today ?? 162;
  const avg = live ? Math.round(live.average7) : 7442;
  const goal = live?.goal ?? GOAL;
  const todayPct = Math.max(0, Math.round((today / goal) * 100));
  const avgPct = Math.max(0, Math.round((avg / goal) * 100));
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layoutId={shellId}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      aria-label={`Open pedometer details: ${today.toLocaleString("en-US")} total today, ${avg.toLocaleString("en-US")} seven-day average`}
      className="block w-[184px] rounded-[28px] p-[15px] text-left"
      style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop }}
    >
      <Matrix t={t} text={today.toLocaleString("en-US")} dot={1.8} pitch={4.1} label={`${today}`} slots={6} />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="TOTAL TODAY" dot={0.7} pitch={1.6} />
        <span className="font-mono text-[10px]" style={{ color: t.dim }}>
          {todayPct}%
        </span>
      </span>
      <span className="my-[11px] block h-px" style={{ background: t.faint }} aria-hidden />
      <Matrix t={t} text={avg.toLocaleString("en-US")} dot={1.8} pitch={4.1} label={`${avg}`} slots={6} />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="7-DAY AVERAGE" dot={0.7} pitch={1.6} />
        <span className="font-mono text-[10px]" style={{ color: t.dim }}>
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
  fresh,
}: {
  now: { time: string; dateLine: string; weekday: string; dayMonth: string };
  onOpen: () => void;
  shellId?: string;
  t: Tokens;
  live: StepsSnapshot | null;
  fresh: boolean;
}) {
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
        <PedoWidget onOpen={onOpen} shellId={shellId} t={t} live={live} />
      </div>
      <p className="px-4 pt-2 text-right font-mono text-[9px] tracking-[0.2em]" style={{ color: fresh ? t.dim : "transparent" }} aria-hidden={!fresh}>
        {fresh ? "TAP THE WIDGET ↑" : "·"}
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
}: {
  onClose: () => void;
  onRun: () => void;
  visits: number;
  shellId?: string;
  t: Tokens;
  live: StepsSnapshot | null;
}) {
  const target = live?.today ?? STEPS;
  const goal = live?.goal ?? GOAL;
  const steps = useCountUp(target, visits);
  const pct = Math.max(0, Math.round((target / goal) * 100));
  const toGo = Math.max(0, goal - target).toLocaleString("en-US");
  const goalFmt = goal.toLocaleString("en-US");
  const synced = live
    ? new Date(live.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;
  return (
    <motion.div
      layoutId={shellId}
      transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: t.ground }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-9">
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
        <h1 className="px-5 pt-2 text-[46px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Today
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          Pedometer
        </p>

        <Rise index={0} className="px-4 pt-4">
          <div className="rounded-[20px] p-[18px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <Matrix t={t} text={steps.toLocaleString("en-US")} dot={3.2} pitch={8} label={`${steps} steps`} slots={6} />
            <div className="mt-3.5">
              <DottedLine frac={target / goal} total={32} t={t} />
            </div>
            <p className="mt-2.5 font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
              <span style={{ color: t.ink }}>{pct}%</span> OF {goalFmt} GOAL · {toGo} TO GO
            </p>
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.16em]" style={{ color: t.dim }}>
              COUNTED ON-DEVICE · {synced ? `SYNCED ${synced}` : "SYNCED JUST NOW"}
            </p>
          </div>
        </Rise>

        <Rise index={1} className="grid grid-cols-3 gap-2.5 px-4 pt-2.5">
          <Stat label="Distance" value={String(KM)} sub="KM" t={t} />
          <Stat label="Energy" value={String(KCAL)} sub="KCAL" t={t} />
          <Stat label="Active" value={String(ACTIVE_MIN)} sub="MIN" t={t} />
        </Rise>

        <Rise index={2} className="px-4 pt-2.5">
          <ActivityCard t={t} live={live} />
        </Rise>

        <Rise index={3} className="px-4 pt-2.5">
          <motion.button
            type="button"
            onClick={onRun}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-between rounded-[20px] px-5 py-4 font-mono text-[12px] tracking-[0.18em]"
            style={{ background: t.ink, color: t.ground }}
            aria-label="View today's run"
          >
            <span>TODAY&apos;S RUN · {RUN.dist} KM</span>
            <span aria-hidden>
              <ArrowRight size={16} />
            </span>
          </motion.button>
          <p className="pt-3 text-center font-mono text-[9px] tracking-[0.2em]" style={{ color: t.dim }}>
            EVERY STAT FREE · NOTHING UPLOADED
          </p>
        </Rise>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- run ------------------------------------ */

function RunScreen({ onBack, onShare, privacy, setPrivacy, t }: { onBack: () => void; onShare: () => void; privacy: boolean; setPrivacy: (v: boolean) => void; t: Tokens }) {
  const reduced = useReducedMotion();
  const max = Math.max(...ELEV);
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: t.dim }}
          >
            <span aria-hidden className="flex">
              <ShareIcon size={18} />
            </span>
            SHARE
          </button>
        </div>
        <h1 className="px-5 pt-2 text-[46px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Morning run
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          {RUN.when} · {RUN.dist} kilometres{RUN_SAMPLE ? " · sample" : ""}
        </p>

        <div className="px-5 pt-4">
          <Matrix t={t} text={RUN.dist} dot={2.6} pitch={6.5} label={`${RUN.dist} kilometres`} />
        </div>

        <Rise index={0} className="px-4 pt-3">
          <div className="overflow-hidden rounded-[20px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <RouteMap reduced={reduced} t={t} privateZones={privacy} />
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

        <Rise index={2} className="grid grid-cols-3 gap-2.5 px-4 pt-2.5">
          <Stat label="Time" value={RUN.time} t={t} />
          <Stat label="Pace" value={RUN.pace} sub="/KM" t={t} />
          <Stat label="Energy" value={RUN.kcal} sub="KCAL" t={t} />
        </Rise>

        <Rise index={3} className="px-4 pt-2.5">
          <div className="rounded-[20px] p-[18px]" role="img" aria-label={`Elevation profile, plus ${ELEV_GAIN} metres total climb`} style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <div className="flex items-baseline justify-between">
              <p className={SANS_LABEL} style={{ color: t.dim }}>
                Elevation
              </p>
              <p className="font-mono text-[10px]" style={{ color: t.dim }}>
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
          </div>
        </Rise>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- share ----------------------------------- */

type ShareTarget = "sheet" | "x" | "instagram" | "whatsapp" | "telegram";

/** The artifact: what actually travels when a run is shared. Canvas-styled. */
function ShareCard({ t, privateZones, canvas }: { t: Tokens; privateZones: boolean; canvas: ShareCanvas }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] p-4" style={{ background: canvas.bg, boxShadow: t.pop }}>
      {canvas.image && (
        <>
          <div className="absolute inset-0" style={{ background: `url(${canvas.image}) center/cover` }} aria-hidden />
          <div className="absolute inset-0" style={{ background: "rgba(5,5,8,0.55)" }} aria-hidden />
        </>
      )}
      <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: canvas.dim }}>
          Morning run · {RUN.when}{RUN_SAMPLE ? " · sample" : ""}
        </p>
        {privateZones && (
          <p className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.18em]" style={{ background: canvas.chip, color: canvas.onChip }}>
            HOME HIDDEN
          </p>
        )}
      </div>
      <div className="mt-1.5">
        <DotText text={RUN.dist} dot={3.4 * t.dotScale} pitch={10.5} color={canvas.dot} dimOpacity={canvas.image ? 0 : t.unlit} label={`${RUN.dist} kilometres`} />
      </div>
      <p className="mt-1 font-mono text-[10px] tracking-[0.24em]" style={{ color: canvas.ink }}>KILOMETRES</p>
      <svg viewBox="0 0 360 250" className="mt-2 h-auto w-full" role="img" aria-label="Run route">
        <path d={ROUTE} fill="none" stroke={canvas.dot} strokeOpacity={0.9} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 10" />
        <circle cx={44} cy={200} r={7} fill={canvas.dot} opacity={privateZones ? 0.2 : 1} />
        <circle cx={96} cy={200} r={7} fill={t.red} opacity={privateZones ? 0.2 : 1} />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px]" style={{ color: canvas.ink }}>
        <span>{RUN.time}</span>
        <span>{RUN.pace}/KM</span>
        <span>{RUN.kcal} KCAL</span>
      </div>
      <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.26em]" style={{ color: canvas.dim }}>
        Nothing · Pedometer
      </p>
      </div>
    </div>
  );
}

function ShareSheet({ t, privacy, onPick, onClose }: { t: Tokens; privacy: boolean; onPick: (p: Exclude<ShareTarget, "sheet">) => void; onClose: () => void }) {
  const targets = [
    { id: "x", label: "X", bg: "#000000", fg: "#FFFFFF", Icon: XIcon },
    { id: "instagram", label: "Instagram", bg: "#E1306C", fg: "#FFFFFF", Icon: InstagramIcon },
    { id: "whatsapp", label: "WhatsApp", bg: "#25D366", fg: "#FFFFFF", Icon: WhatsAppIcon },
    { id: "telegram", label: "Telegram", bg: "#229ED9", fg: "#FFFFFF", Icon: TelegramIcon },
  ] as const;
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
        style={{ background: t.card }}
        role="dialog"
        aria-modal="true"
        aria-label="Share run"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: DUR.fast, ease: EASE_OUT } }}
        transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      >
        <div className="mx-auto h-[4px] w-[40px] rounded-full" style={{ background: t.faint }} aria-hidden />
        <p className="pt-3 text-[17px] font-normal" style={{ color: t.ink }}>
          Sharing 1 run
        </p>
        <div className="mt-2.5 flex items-center gap-3 rounded-[18px] px-4 py-3.5" style={{ background: t.faint }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: t.dot, color: t.ground }} aria-hidden>
            <span className="font-mono text-[10px]">5K</span>
          </span>
          <p className="truncate text-[13px]" style={{ color: t.ink }}>
            Morning run · {RUN.dist} km in {RUN.time}{privacy ? " · home hidden" : ""}{RUN_SAMPLE ? " · sample" : ""}
          </p>
        </div>
        <div className="mt-3 border-t pt-3" style={{ borderColor: t.faint }}>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Share targets">
          {targets.map((r) => (
            <button key={r.id} type="button" onClick={() => onPick(r.id)} className="flex min-h-[64px] flex-col items-center gap-2 py-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: r.bg, color: r.fg }} aria-hidden>
                <r.Icon size={22} />
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

function XPost({ t, privacy, canvas }: { t: Tokens; privacy: boolean; canvas: ShareCanvas }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E11A1B] font-mono text-[11px] text-white">
          N
        </span>
        <div>
          <p className="text-[13px] font-bold text-white">Pedometer</p>
          <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            Draft · not yet posted
          </p>
        </div>
      </div>
      <div className="pt-2.5">
        <ShareCard t={t} canvas={canvas} privateZones={privacy} />
      </div>
      <p className="pt-3 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
        Replies and reposts appear after posting
      </p>
    </div>
  );
}

function StoryPreview({ t, privacy, canvas }: { t: Tokens; privacy: boolean; canvas: ShareCanvas }) {
  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: "linear-gradient(170deg, #1A1C26 0%, #3A2E38 55%, #101014 100%)", aspectRatio: "9/16" }}>
      <div className="mx-auto mt-2 h-[3px] w-16 rounded-full bg-white/40" />
      <div className="px-4 pt-6">
        <ShareCard t={t} canvas={canvas} privateZones={privacy} />
      </div>
    </div>
  );
}

function WAPreview({ t, privacy, canvas }: { t: Tokens; privacy: boolean; canvas: ShareCanvas }) {
  return (
    <div className="rounded-[20px] p-4" style={{ background: "#0B141A" }}>
      <p className="text-center font-mono text-[9px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        TODAY
      </p>
      <div className="ml-auto mt-2 w-[94%] rounded-[14px] rounded-tr-[4px] p-2" style={{ background: "#005C4B" }}>
        <div>
          <ShareCard t={t} canvas={canvas} privateZones={privacy} />
        </div>
        <p className="px-1 text-right font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          {nowHM()} ✓✓
        </p>
      </div>
    </div>
  );
}

function TelegramPreview({ t, privacy, canvas }: { t: Tokens; privacy: boolean; canvas: ShareCanvas }) {
  return (
    <div className="rounded-[20px] p-4" style={{ background: "#0E1621" }}>
      <p className="text-center font-mono text-[9px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        TODAY
      </p>
      <div className="ml-auto mt-2 w-[94%] rounded-[14px] rounded-tr-[4px] p-2" style={{ background: "#2AABEE" }}>
        <div>
          <ShareCard t={t} canvas={canvas} privateZones={privacy} />
        </div>
        <p className="px-1 text-right font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.8)" }}>
          {nowHM()} ✓✓
        </p>
      </div>
    </div>
  );
}

function SharePreview({ platform, privacy, t, onBack }: { platform: Exclude<ShareTarget, "sheet">; privacy: boolean; onBack: () => void; t: Tokens }) {
  const reduced = useReducedMotion();
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
      dist: RUN.dist,
      time: RUN.time,
      pace: RUN.pace,
      kcal: RUN.kcal,
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
          <p className="pb-3 text-[13px]" style={{ color: t.dim }}>
            System share isn&apos;t available here — SAVE the PNG and attach it manually.
          </p>
        )}
        <div className="flex items-center justify-between pb-3">
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
        {platform === "x" && <XPost t={t} privacy={privacy} canvas={canvas} />}
        {platform === "instagram" && <StoryPreview t={t} privacy={privacy} canvas={canvas} />}
        {platform === "whatsapp" && <WAPreview t={t} privacy={privacy} canvas={canvas} />}
        {platform === "telegram" && <TelegramPreview t={t} privacy={privacy} canvas={canvas} />}
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
  const [privacy, setPrivacy] = useState(true);
  const reduced = useReducedMotion();
  const now = useNow();
  const live = useLiveSteps();
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
      {/* Floating chrome: overlays the studio, zero flow height, so the full
          viewport belongs to the device — that is what lets true size fit.
          Floor-lit (not theme-lit): the floor is always dark. Mobile has no
          chrome at all and stays full-bleed. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden flex-col items-center gap-2 px-6 pt-5 sm:flex">
        <div className="pointer-events-auto flex items-center gap-2" role="group" aria-label="Theme">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTheme(m)}
              aria-pressed={theme === m}
              className="rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                background: theme === m ? "#FFFFFF" : "transparent",
                color: theme === m ? "#0A0A0A" : "rgba(255,255,255,0.6)",
              }}
            >
              {m}
            </button>
          ))}
          <span className="pl-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            OS 4.1 tokens
          </span>
        </div>
        <div className="flex h-6 items-start justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DUR.micro, ease: EASE_OUT }}
              className="text-center font-mono text-[10px] uppercase tracking-[0.24em]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {STAGE_LINE[stage]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      {/* web stage: full viewport height, device centred. The chrome floats,
          so the only budget off the viewport is breathing air (48px) — on a
          14" MacBook that resolves to exactly true size. Mobile stays
          full-bleed (the real 2a). */}
      <div className="stage-studio relative flex min-h-dvh w-full items-center justify-center p-0 sm:p-6">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 sm:block"
          aria-hidden
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.07), transparent 70%)" }}
        />
        {/* Phone (2a) in white, measured off Nothing's official front renders:
            76.32 × 161.74mm footprint (aspect-locked), uniform slim bezels
            (no chin — renders confirm symmetry), centred hole at ~7.5% of
            height, two separate black volume keys left + black power right
            (white unit ships contrasting keys), warm-white body. True size
            default: 76.32mm at 127 CSS PPI (MacBook-class retina) = 382px;
            shorter viewports shrink the whole device instead of cramping it.
            Budget is air only (48px) because the chrome floats.
            Desktop preview only — the phone stays full-bleed. */}
        <div className="relative h-dvh w-full sm:aspect-[76.32/161.74] sm:h-auto sm:w-[min(382px,calc((100dvh-48px)*0.4719),calc(100vw-48px))]">
          <div className="absolute -left-[4px] top-[30%] hidden h-[7%] w-[4px] rounded-l-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div className="absolute -left-[4px] top-[39%] hidden h-[7%] w-[4px] rounded-l-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div className="absolute -right-[4px] top-[34%] hidden h-[8%] w-[4px] rounded-r-md sm:block" style={{ background: "#141416", boxShadow: "inset 0 0 1px rgba(255,255,255,0.25)" }} aria-hidden />
          <div
            className="relative h-full w-full overflow-hidden sm:rounded-[54px] sm:p-[3px] sm:ring-1 sm:ring-black/20"
            style={{
              background: "#E8E8E6",
              boxShadow:
                "0 50px 100px -24px rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.12)",
            }}
            role="region"
            aria-label="Nothing Phone 2a pedometer concept"
          >
            <div className="relative h-full w-full overflow-hidden bg-black sm:rounded-[51px] sm:p-[10px]">
              <div className="relative h-full w-full overflow-hidden sm:rounded-[41px]">
                {/* punch-hole camera: preview-only, centre ~7.5% of body height
                    per official renders — the status row sits on the same line */}
                <div className="pointer-events-none absolute left-1/2 top-[7.5%] z-30 hidden -translate-x-1/2 -translate-y-1/2 sm:block" aria-hidden>
                  <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-black" style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.9), inset 0 0 2px rgba(80,120,200,0.5)" }}>
                    <div className="h-[6px] w-[6px] rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #24365e 0%, #050507 70%)" }} />
                  </div>
                </div>
                {/* glass: barely-there diagonal sheen for the photoreal read, never over content */}
                <div className="pointer-events-none absolute inset-0 z-30 hidden sm:block" aria-hidden style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, transparent 28%)" }} />
                <AnimatePresence>
                  {stage === "home" && <HomeScreen key="home" now={now} onOpen={open} shellId={shellId} t={t} live={live} fresh={visits === 0} />}
                  {stage === "detail" && (
                    <DetailScreen key="detail" onClose={() => setStage("home")} onRun={() => setStage("run")} visits={visits} shellId={shellId} t={t} live={live} />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {stage === "run" && (
                    <RunScreen key="run" onBack={() => setStage("detail")} onShare={() => setShare("sheet")} privacy={privacy} setPrivacy={setPrivacy} t={t} />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {stage === "run" && share === "sheet" && (
                    <ShareSheet key="sheet" t={t} privacy={privacy} onPick={(p) => setShare(p)} onClose={() => setShare(null)} />
                  )}
                  {stage === "run" && share !== null && share !== "sheet" && (
                    <SharePreview key={share} platform={share} onBack={() => setShare("sheet")} privacy={privacy} t={t} />
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
