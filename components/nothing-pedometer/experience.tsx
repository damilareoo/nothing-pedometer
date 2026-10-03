"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_EMPHASIZED, EASE_OUT, STAGGER, useReducedMotion } from "@/lib/motion";
import { THEMES, type ThemeName, type Tokens } from "@/lib/theme";
import { SHARE_CANVASES, photoCanvas, type ShareCanvas } from "@/lib/share-canvases";
import { ArrowLeft, ArrowRight, CameraIcon, GearIcon, MessageIcon, PhoneIcon, SearchIcon } from "./icons";
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

const SPLITS = [
  { km: "01", pace: "6'05''", hr: "146" },
  { km: "02", pace: "6'10''", hr: "151" },
  { km: "03", pace: "6'18''", hr: "154" },
  { km: "04", pace: "6'14''", hr: "157" },
  { km: "05", pace: "6'02''", hr: "161" },
];

const ELEV = [4, 6, 8, 7, 10, 12, 11, 14, 16, 15, 18, 22, 20, 24, 21, 26, 24, 28, 25, 22, 18, 14, 10, 8, 6, 5, 4, 3];

const ROUTE =
  "M 44 200 C 44 150 80 130 116 138 C 152 146 156 106 194 100 C 232 94 246 126 284 120 C 316 115 328 142 314 168 C 300 194 270 188 262 208 C 256 224 230 232 210 224 C 180 240 140 238 118 224 C 104 215 96 208 96 200";

const MICRO = "font-mono text-[10px] uppercase tracking-[0.22em]";
const SANS_LABEL = "text-[14px] font-medium";

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
function Matrix({ t, text, dot = 2.4, pitch = 8, label }: { t: Tokens; text: string; dot?: number; pitch?: number; label?: string }) {
  return <DotText text={text} dot={dot * t.dotScale} pitch={pitch} color={t.dot} dimOpacity={t.unlit} label={label} />;
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
  const on = Math.round(frac * total);
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

/** 7-day activity as dot columns. Today reads by brightness, never hue. */
function WeekDots({ today, t }: { today: number; t: Tokens }) {
  const max = Math.max(...WEEK.map((w) => w.v));
  const ROWS = 14;
  return (
    <div className="flex items-stretch justify-between gap-1" role="img" aria-label={`Steps this week, best ${WEEK_BEST}`}>
      {WEEK.map((b, i) => {
        const lit = Math.max(1, Math.round((b.v / max) * ROWS));
        const isToday = i === today;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[76px] flex-col-reverse justify-start gap-[4px]">
              {Array.from({ length: ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: r < lit ? (isToday ? t.dot : t.dim) : t.faint }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: isToday ? t.ink : t.dim }}>
              {b.d}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 24-hour activity as dot columns — the same language as the week view. */
function HourlyDots({ t }: { t: Tokens }) {
  const max = Math.max(...HOURLY);
  const ROWS = 12;
  return (
    <div role="img" aria-label={`Steps by hour today, peak ${PEAK_HOUR}:00`}>
      <div className="flex h-[76px] items-end gap-[2.5px]" aria-hidden>
        {HOURLY.map((v, i) => {
          const lit = Math.round((v / max) * ROWS);
          return (
            <div key={i} className="flex flex-1 flex-col-reverse justify-start gap-[3px]">
              {Array.from({ length: ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="mx-auto h-[2px] w-[2px] rounded-full"
                  style={{ background: r < lit ? t.dot : t.faint }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between pt-1.5 font-mono text-[8px] tracking-[0.14em]" style={{ color: t.dim }}>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

/** One chart, two ranges — Apple's Day/Week switcher in Nothing's language. */
function ActivityCard({ t }: { t: Tokens }) {
  const [range, setRange] = useState<"day" | "week">("day");
  const reduced = useReducedMotion();
  return (
    <div className="rounded-[20px] p-[18px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <div className="flex items-center justify-between">
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
      <div className="mt-3 min-h-[104px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={range}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -8 }}
            transition={{ duration: DUR.micro, ease: EASE_OUT }}
          >
            {range === "day" ? <HourlyDots t={t} /> : <WeekDots today={WEEK.length - 1} t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2.5 font-mono text-[10px] tracking-[0.14em]" style={{ color: t.dim }}>
        {range === "day" ? `PEAK ${PEAK_HOUR}:00 · ${PEAK_STEPS} STEPS` : `AVG ${WEEK_AVG} · BEST ${WEEK_BEST}`}
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
        <text x={ends.sx} y={ends.sy + 20} textAnchor="middle" fill={t.dim} fontSize={9} fontFamily="monospace" letterSpacing={2}>
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
    <div className="flex items-center justify-between px-6 pt-4 font-mono text-[12px] tracking-[0.02em]" style={{ color: onWidget ? "#fff" : t.ink }}>
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

/** Date + weather squircle, dot-matrix capitals exactly like the device. */
function DateCard({ weekday, dayMonth, t }: { weekday: string; dayMonth: string; t: Tokens }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[8px] rounded-[28px] p-4" role="group" aria-label={`${weekday} ${dayMonth}, partly sunny 25 degrees`} style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
      <Matrix t={t} text={weekday} dot={1.15} pitch={2.6} />
      <Matrix t={t} text={dayMonth} dot={1.15} pitch={2.6} />
      <Matrix t={t} text="PARTLY SUNNY" dot={1} pitch={2.3} />
      <Matrix t={t} text="25°" dot={1.15} pitch={2.6} />
    </div>
  );
}

/**
 * The real pedometer widget: "162 / TOTAL TODAY / 1 %" over
 * "7,442 / 7-DAY AVERAGE / 74 %". Tapping expands it into detail.
 */
function PedoWidget({ onOpen, shellId, t }: { onOpen: () => void; shellId?: string; t: Tokens }) {
  const row = "flex items-baseline justify-between gap-2";
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layoutId={shellId}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: DUR.morph, ease: EASE_EMPHASIZED }}
      aria-label="Open pedometer details: 162 total today, 7,442 seven-day average"
      className="block w-[184px] rounded-[28px] p-[15px] text-left"
      style={{ background: t.widget, border: `1px solid ${t.edge}`, boxShadow: t.pop }}
    >
      <Matrix t={t} text="162" dot={1.8} pitch={4.1} label="162" />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="TOTAL TODAY" dot={0.7} pitch={1.6} />
        <span className="font-mono text-[10px]" style={{ color: t.dim }}>
          1%
        </span>
      </span>
      <span className="my-[11px] block h-px" style={{ background: t.faint }} aria-hidden />
      <Matrix t={t} text="7,442" dot={1.8} pitch={4.1} label="7,442" />
      <span className={`${row} mt-[7px]`}>
        <Matrix t={t} text="7-DAY AVERAGE" dot={0.7} pitch={1.6} />
        <span className="font-mono text-[10px]" style={{ color: t.dim }}>
          74%
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
        ].map(({ id, Icon }, i, arr) => {
          const last = i === arr.length - 1;
          return (
            <div
              key={id}
              className="flex items-center justify-center rounded-full"
              style={{ background: last ? t.dockAlt : t.dock, aspectRatio: "1", color: last ? t.onDockAlt : t.onDock }}
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
}: {
  now: { time: string; dateLine: string; weekday: string; dayMonth: string };
  onOpen: () => void;
  shellId?: string;
  t: Tokens;
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
        <PedoWidget onOpen={onOpen} shellId={shellId} t={t} />
      </div>
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
}: {
  onClose: () => void;
  onRun: () => void;
  visits: number;
  shellId?: string;
  t: Tokens;
}) {
  const steps = useCountUp(STEPS, visits);
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
            <Matrix t={t} text={steps.toLocaleString("en-US")} dot={3.2} pitch={8} label={`${steps} steps`} />
            <div className="mt-3.5">
              <DottedLine frac={STEPS / GOAL} total={32} t={t} />
            </div>
            <p className="mt-2.5 font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
              <span style={{ color: t.ink }}>{GOAL_PCT}%</span> OF {GOAL_FMT} GOAL · {GOAL_TO_GO} TO GO
            </p>
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.16em]" style={{ color: t.dim }}>
              COUNTED ON-DEVICE · SYNCED JUST NOW
            </p>
          </div>
        </Rise>

        <Rise index={1} className="grid grid-cols-3 gap-2.5 px-4 pt-2.5">
          <Stat label="Distance" value={String(KM)} sub="KM" t={t} />
          <Stat label="Energy" value={String(KCAL)} sub="KCAL" t={t} />
          <Stat label="Active" value={String(ACTIVE_MIN)} sub="MIN" t={t} />
        </Rise>

        <Rise index={2} className="px-4 pt-2.5">
          <ActivityCard t={t} />
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
            className={MICRO}
            style={{ color: t.dim }}
          >
            SHARE
          </button>
        </div>
        <h1 className="px-5 pt-2 text-[46px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Morning run
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          {RUN.when} · {RUN.dist} kilometres
        </p>

        <div className="px-4 pt-4">
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
              <span>DOT-MATRIX GPS</span>
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
          <div className="rounded-[20px] p-[18px]" style={{ background: t.card, border: `1px solid ${t.edge}`, boxShadow: t.pop }}>
            <div className="flex items-baseline justify-between">
              <p className={SANS_LABEL} style={{ color: t.dim }}>
                Elevation
              </p>
              <p className="font-mono text-[10px]" style={{ color: t.dim }}>
                +86 M
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

type ShareTarget = "sheet" | "x" | "instagram" | "whatsapp";

/** The artifact: what actually travels when a run is shared. Canvas-styled. */
function ShareCard({ t, privateZones, canvas }: { t: Tokens; privateZones: boolean; canvas: ShareCanvas }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] p-4" style={{ background: canvas.bg, boxShadow: t.pop }}>
      {canvas.image && (
        <>
          <div className="absolute inset-0" style={{ background: `url(${canvas.image}) center/cover` }} aria-hidden />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(5,5,8,0.62) 0%, rgba(5,5,8,0.28) 45%, rgba(5,5,8,0.66) 100%)" }}
            aria-hidden
          />
        </>
      )}
      <div className="relative">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: canvas.dim }}>
        Morning run · {RUN.when}{privateZones ? " · HOME HIDDEN" : ""}
      </p>
      <div className="mt-1.5">
        <DotText text={RUN.dist} dot={3.4 * t.dotScale} pitch={10.5} color={canvas.dot} dimOpacity={t.unlit} label={`${RUN.dist} kilometres`} />
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

function ShareSheet({ t, onPick, onClose }: { t: Tokens; onPick: (p: Exclude<ShareTarget, "sheet"> | "copy") => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);
  const rows = [
    { id: "x", label: "X POST", mark: "X" },
    { id: "instagram", label: "INSTAGRAM STORY", mark: "IG" },
    { id: "whatsapp", label: "WHATSAPP", mark: "WA" },
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
        <div className="mx-auto h-[4px] w-[40px] rounded-full" style={{ background: t.faint }} />
        <p className="pt-3 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: t.dim }}>
          Share run
        </p>
        <div className="pt-1">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => onPick(r.id)} className="flex w-full items-center gap-3.5 py-3 text-left">
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full font-mono text-[10px]" style={{ background: t.faint, color: t.ink }}>
                {r.mark}
              </span>
              <span className="font-mono text-[12px] tracking-[0.16em]" style={{ color: t.ink }}>
                {r.label}
              </span>
              <span className="ml-auto flex" style={{ color: t.dim }} aria-hidden>
                <ArrowRight size={15} />
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setCopied(true); onPick("copy"); }}
            className="flex w-full items-center gap-3.5 py-3 text-left"
          >
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full font-mono text-[10px]" style={{ background: t.faint, color: t.ink }}>
              {copied ? "✓" : "URL"}
            </span>
            <span className="font-mono text-[12px] tracking-[0.16em]" style={{ color: t.ink }}>
              {copied ? "LINK COPIED" : "COPY LINK"}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl py-3 font-mono text-[12px] tracking-[0.18em]"
          style={{ background: t.faint, color: t.ink }}
        >
          CANCEL
        </button>
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
            @nothing · 2m
          </p>
        </div>
      </div>
      <p className="pt-2.5 text-[13px] text-white">Morning loop: 5.2 km in 32:14.</p>
      <div className="pt-2.5">
        <ShareCard t={t} canvas={canvas} privateZones={privacy} />
      </div>
      <div className="flex gap-6 pt-3 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
        <span>12</span>
        <span>48</span>
        <span>312</span>
      </div>
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
      <p className="px-4 pt-4 font-mono text-[11px] tracking-[0.2em] text-white">MORNING LOOP — 5.2 KM</p>
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
        <ShareCard t={t} canvas={canvas} privateZones={privacy} />
        <p className="px-1 pb-0.5 pt-1.5 text-[12px] text-white">Morning loop done. 5.2 km in 32:14.</p>
        <p className="px-1 text-right font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          06:47 ✓✓
        </p>
      </div>
    </div>
  );
}

function SharePreview({ platform, privacy, t, onBack }: { platform: Exclude<ShareTarget, "sheet">; privacy: boolean; onBack: () => void; t: Tokens }) {
  const reduced = useReducedMotion();
  const [posted, setPosted] = useState(false);
  useEffect(() => {
    if (!posted) return;
    const id = setTimeout(() => setPosted(false), 1600);
    return () => clearTimeout(id);
  }, [posted]);
  const names = { x: "X POST", instagram: "INSTAGRAM STORY", whatsapp: "WHATSAPP" } as const;
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
  const pickPhoto = () => {
    if (canvasId !== "photo" && photo) {
      setCanvasId("photo");
      return;
    }
    fileRef.current?.click();
    setCanvasId("photo");
  };
  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(URL.createObjectURL(file));
    e.target.value = "";
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
        <button
          type="button"
          onClick={() => setPosted(true)}
          className="font-mono text-[11px] tracking-[0.18em]"
          style={{ color: posted ? t.dim : t.ink }}
        >
          {posted ? "POSTED ✓" : "POST"}
        </button>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-4">
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
            <motion.button
              type="button"
              onClick={pickPhoto}
              aria-pressed={canvasId === "photo"}
              aria-label={photo ? "Photo canvas" : "Add a photo canvas"}
              whileTap={{ scale: 0.88 }}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: photo ? `url(${photo}) center/cover` : "transparent",
                border: `1px dashed ${t.dim}`,
                color: t.dim,
                boxShadow: canvasId === "photo" ? `0 0 0 2px ${t.ground}, 0 0 0 3.5px ${t.ink}` : "none",
              }}
            >
              {!photo && <CameraIcon size={13} />}
            </motion.button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhotoFile} aria-label="Upload a photo background" />
        {platform === "x" && <XPost t={t} privacy={privacy} canvas={canvas} />}
        {platform === "instagram" && <StoryPreview t={t} privacy={privacy} canvas={canvas} />}
        {platform === "whatsapp" && <WAPreview t={t} privacy={privacy} canvas={canvas} />}
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
    <main className="flex min-h-dvh flex-col items-center" style={{ background: t.ground, color: t.ink }}>
      <div className="flex items-center gap-2 pt-6" role="group" aria-label="Theme">
        {(["dark", "light"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTheme(m)}
            aria-pressed={theme === m}
            className="rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{
              borderColor: t.faint,
              background: theme === m ? t.ink : "transparent",
              color: theme === m ? t.ground : t.dim,
            }}
          >
            {m}
          </button>
        ))}
        <span className="pl-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: t.dim }}>
          OS 4.1 tokens
        </span>
      </div>
      <div className="flex h-8 items-start justify-center overflow-hidden pt-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DUR.micro, ease: EASE_OUT }}
            className="text-center font-mono text-[10px] uppercase tracking-[0.24em]"
            style={{ color: t.dim }}
          >
            {STAGE_LINE[stage]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex w-full flex-1 items-center justify-center sm:py-6">
        <div
          className="relative h-dvh w-full overflow-hidden sm:h-[860px] sm:w-[400px] sm:rounded-[40px] sm:ring-1 sm:ring-white/15"
          style={{ boxShadow: t.pop }}
          role="region"
          aria-label="Nothing Phone pedometer concept"
        >
          <AnimatePresence>
            {stage === "home" && <HomeScreen key="home" now={now} onOpen={open} shellId={shellId} t={t} />}
            {stage === "detail" && (
              <DetailScreen key="detail" onClose={() => setStage("home")} onRun={() => setStage("run")} visits={visits} shellId={shellId} t={t} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stage === "run" && (
              <RunScreen key="run" onBack={() => setStage("detail")} onShare={() => setShare("sheet")} privacy={privacy} setPrivacy={setPrivacy} t={t} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stage === "run" && share === "sheet" && (
              <ShareSheet key="sheet" t={t} onPick={(p) => setShare(p === "copy" ? "sheet" : p)} onClose={() => setShare(null)} />
            )}
            {stage === "run" && share !== null && share !== "sheet" && (
              <SharePreview key={share} platform={share} onBack={() => setShare("sheet")} privacy={privacy} t={t} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
