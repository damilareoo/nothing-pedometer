"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_OUT, useReducedMotion } from "@/lib/motion";
import { THEMES, type ThemeName, type Tokens } from "@/lib/theme";
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

const STEPS = 7284;
const GOAL = 10000;
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

const HOURLY = [0, 0, 0, 0, 0, 0, 120, 680, 420, 180, 240, 310, 520, 280, 190, 340, 410, 860, 1240, 540, 220, 90, 20, 0];

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
const SANS_LABEL = "text-[12px] font-medium";

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

/** A dotted progress line: lit dots up to `frac`, dim matrix after. */
function DottedLine({ frac, total = 30, t }: { frac: number; total?: number; t: Tokens }) {
  const on = Math.round(frac * total);
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[4px] w-[4px] rounded-full"
          style={{ background: i < on ? t.dot : t.faint }}
        />
      ))}
    </div>
  );
}

/** 7-day activity as dot columns. Today reads by brightness, never hue. */
function WeekDots({ today, t }: { today: number; t: Tokens }) {
  const max = Math.max(...WEEK.map((w) => w.v));
  const ROWS = 14;
  return (
    <div className="flex items-stretch justify-between gap-1">
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
                  style={{ background: r < lit ? (isToday ? t.dot : t.faint) : t.faint, opacity: r < lit && !isToday ? 0.7 : 1 }}
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

/** 24-hour step histogram. Peak reads by height; the ink stays monochrome. */
function HourlyBars({ t }: { t: Tokens }) {
  const max = Math.max(...HOURLY);
  return (
    <div className="flex h-[64px] items-end gap-[3px]" aria-hidden>
      {HOURLY.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: v === 0 ? t.faint : t.dot, opacity: v === 0 || v === max ? 1 : 0.55 }}
        />
      ))}
    </div>
  );
}

/** One chart, two ranges — Apple's Day/Week switcher in Nothing's language. */
function ActivityCard({ t }: { t: Tokens }) {
  const [range, setRange] = useState<"day" | "week">("day");
  const reduced = useReducedMotion();
  return (
    <div className="rounded-[20px] p-[18px]" style={{ background: t.card }}>
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
            {range === "day" ? <HourlyBars t={t} /> : <WeekDots today={6} t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2.5 font-mono text-[10px] tracking-[0.14em]" style={{ color: t.dim }}>
        {range === "day" ? "PEAK 18:00 · 1,240 STEPS" : "AVG 7,305 · BEST THU 10,240"}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, t }: { label: string; value: string; sub?: string; t: Tokens }) {
  return (
    <div className="rounded-[18px] p-3.5" style={{ background: t.card }}>
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
function RouteMap({ reduced, t }: { reduced: boolean; t: Tokens }) {
  const pathRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const [marks, setMarks] = useState<{ x: number; y: number }[]>([]);
  const [ends, setEnds] = useState({ sx: 44, sy: 200, ex: 96, ey: 200 });

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const measure = () => {
      const L = p.getTotalLength();
      const at = (f: number) => {
        const pt = p.getPointAtLength(L * f);
        return { x: pt.x, y: pt.y };
      };
      setMarks([0.2, 0.4, 0.6, 0.8].map(at));
      const s = at(0);
      const e = at(0.999);
      setEnds({ sx: s.x, sy: s.y, ex: e.x, ey: e.y });
      return { at };
    };
    if (reduced) {
      const { at } = measure();
      const mid = at(0.55);
      runnerRef.current?.setAttribute("cx", String(mid.x));
      runnerRef.current?.setAttribute("cy", String(mid.y));
      haloRef.current?.setAttribute("cx", String(mid.x));
      haloRef.current?.setAttribute("cy", String(mid.y));
      return;
    }
    const { at } = measure();
    let raf = 0;
    const t0 = performance.now();
    const LOOP = 7000;
    const tick = (now: number) => {
      const pt = at(((now - t0) % LOOP) / LOOP);
      runnerRef.current?.setAttribute("cx", String(pt.x));
      runnerRef.current?.setAttribute("cy", String(pt.y));
      haloRef.current?.setAttribute("cx", String(pt.x));
      haloRef.current?.setAttribute("cy", String(pt.y));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <svg viewBox="0 0 360 250" className="h-auto w-full" role="img" aria-label="5.2 kilometre run route as a dotted trace">
      {Array.from({ length: 12 }).map((_, r) =>
        Array.from({ length: 18 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={10 + c * 20} cy={8 + r * 21} r={0.8} fill={t.faint} />
        )),
      )}
      <path d={ROUTE} fill="none" stroke={t.faint} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 9" />
      <path ref={pathRef} d={ROUTE} fill="none" stroke={t.dot} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 9" />
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r={7} fill={t.card} stroke={t.dot} strokeWidth={2} opacity={0.9} />
          <text x={m.x} y={m.y - 12} textAnchor="middle" fill={t.dot} fontSize={10} fontFamily="monospace" letterSpacing={1}>
            {`KM${i + 1}`}
          </text>
        </g>
      ))}
      <circle cx={ends.sx} cy={ends.sy} r={5} fill={t.dot} />
      <text x={ends.sx} y={ends.sy - 12} textAnchor="middle" fill={t.dot} fontSize={10} fontFamily="monospace" letterSpacing={1}>
        START
      </text>
      <circle cx={ends.ex} cy={ends.ey} r={5} fill={t.red} />
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
    <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" role="img" aria-label={`Analog clock showing ${time}`}>
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
    <div className="flex flex-1 flex-col justify-center gap-[8px] rounded-[24px] p-4" style={{ background: t.widget }}>
      <DotText text={weekday} dot={2.2} pitch={5.4} color={t.dot} dimOpacity={t.unlit} />
      <DotText text={dayMonth} dot={2.2} pitch={5.4} color={t.dot} dimOpacity={t.unlit} />
      <DotText text="PARTLY SUNNY" dot={1.2} pitch={2.8} color={t.dot} dimOpacity={t.unlit} />
      <DotText text="25°" dot={2.2} pitch={5.4} color={t.dot} dimOpacity={t.unlit} />
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
      transition={{ duration: DUR.base, ease: EASE_OUT }}
      aria-label="Open pedometer details: 162 total today, 7,442 seven-day average"
      className="block w-[184px] rounded-[24px] p-[15px] text-left"
      style={{ background: t.widget }}
    >
      <DotText text="162" dot={2.1} pitch={5.2} color={t.dot} dimOpacity={t.unlit} label="162" />
      <span className={`${row} mt-[7px]`}>
        <DotText text="TOTAL TODAY" dot={0.75} pitch={1.65} color={t.dot} dimOpacity={t.unlit} />
        <span className="font-mono text-[10px]" style={{ color: t.dim }}>
          1%
        </span>
      </span>
      <span className="my-[11px] block h-px" style={{ background: t.faint }} aria-hidden />
      <DotText text="7,442" dot={2.1} pitch={5.2} color={t.dot} dimOpacity={t.unlit} label="7,442" />
      <span className={`${row} mt-[7px]`}>
        <DotText text="7-DAY AVERAGE" dot={0.75} pitch={1.65} color={t.dot} dimOpacity={t.unlit} />
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
        {["PHO", "MSG", "CAM", "SET"].map((a) => (
          <div key={a} className="flex items-center justify-center rounded-full" style={{ background: t.dock, aspectRatio: "1" }}>
            <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: t.dim }}>
              {a}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-full px-4 py-3" style={{ background: t.widget }}>
        <svg width={15} height={15} viewBox="0 0 16 16" aria-hidden>
          <circle cx={7} cy={7} r={5} fill="none" stroke={t.dim} strokeWidth={1.8} />
          <line x1={11} y1={11} x2={14.5} y2={14.5} stroke={t.dim} strokeWidth={1.8} strokeLinecap="round" />
        </svg>
        <span className="text-[14px]" style={{ color: t.dim }}>
          Search
        </span>
      </div>
      <div className="mx-auto mb-1.5 mt-3.5 h-[4px] w-[120px] rounded-full" style={{ background: t.faint }} />
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
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
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
      transition={{ duration: DUR.base, ease: EASE_OUT }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: t.ground }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-9">
        <div className="flex items-center gap-4 px-5 pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to home screen"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[17px]"
            style={{ color: t.ink }}
          >
            ←
          </button>
        </div>
        <h1 className="px-5 pt-2 text-[34px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Today
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          Pedometer
        </p>

        <div className="px-4 pt-4">
          <div className="rounded-[20px] p-[18px]" style={{ background: t.card }}>
            <DotText text={steps.toLocaleString("en-US")} dot={2.9} pitch={10.5} color={t.dot} dimOpacity={t.unlit} label={`${steps} steps`} />
            <div className="mt-3.5">
              <DottedLine frac={STEPS / GOAL} total={32} t={t} />
            </div>
            <p className="mt-2.5 font-mono text-[10px] tracking-[0.16em]" style={{ color: t.dim }}>
              <span style={{ color: t.ink }}>73%</span> OF 10,000 GOAL · 2,716 TO GO
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-4 pt-2.5">
          <Stat label="Distance" value={String(KM)} sub="KM" t={t} />
          <Stat label="Energy" value={String(KCAL)} sub="KCAL" t={t} />
          <Stat label="Active" value={String(ACTIVE_MIN)} sub="MIN" t={t} />
        </div>

        <div className="px-4 pt-2.5">
          <ActivityCard t={t} />
        </div>

        <div className="px-4 pt-2.5">
          <motion.button
            type="button"
            onClick={onRun}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-between rounded-[20px] px-5 py-4 font-mono text-[12px] tracking-[0.18em]"
            style={{ background: t.ink, color: t.ground }}
            aria-label="View today's run"
          >
            <span>TODAY&apos;S RUN · 5.2 KM</span>
            <span aria-hidden>→</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- run ------------------------------------ */

function RunScreen({ onBack, t }: { onBack: () => void; t: Tokens }) {
  const reduced = useReducedMotion();
  const max = Math.max(...ELEV);
  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ background: t.ground }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto pb-9">
        <div className="flex items-center gap-4 px-5 pt-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to step details"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[17px]"
            style={{ color: t.ink }}
          >
            ←
          </button>
        </div>
        <h1 className="px-5 pt-2 text-[34px] leading-none" style={{ fontFamily: t.serif, color: t.ink }}>
          Morning run
        </h1>
        <p className={`${MICRO} px-5 pt-2`} style={{ color: t.dim }}>
          06:42 · 5.2 kilometres
        </p>

        <div className="px-4 pt-4">
          <DotText text={RUN.dist} dot={3.2} pitch={12} color={t.dot} dimOpacity={t.unlit} label={`${RUN.dist} kilometres`} />
        </div>

        <div className="px-4 pt-3">
          <div className="overflow-hidden rounded-[20px]" style={{ background: t.card }}>
            <RouteMap reduced={reduced} t={t} />
            <div className="flex items-center justify-between border-t px-4 py-2.5 font-mono text-[9px] tracking-[0.18em]" style={{ borderColor: t.faint, color: t.dim }}>
              <span>TRACE</span>
              <span>
                <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-baseline" style={{ background: t.red }} />
                YOU · LIVE
              </span>
              <span>DOT-MATRIX GPS</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-4 pt-2.5">
          <Stat label="Time" value={RUN.time} t={t} />
          <Stat label="Pace" value={RUN.pace} sub="/KM" t={t} />
          <Stat label="Energy" value={RUN.kcal} sub="KCAL" t={t} />
        </div>

        <div className="px-4 pt-2.5">
          <div className="rounded-[20px] p-[18px]" style={{ background: t.card }}>
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
        </div>

        <div className="px-4 pt-2.5">
          <div className="overflow-hidden rounded-[20px]" style={{ background: t.card }}>
            {SPLITS.map((s, i) => (
              <div
                key={s.km}
                className="flex items-center justify-between px-[18px] py-3 font-mono text-[12px]"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${t.faint}`, color: t.ink }}
              >
                <span className="tracking-[0.14em]">KM {s.km}</span>
                <span>{s.pace}</span>
                <span style={{ color: t.dim }}>{s.hr} BPM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------- root ----------------------------------- */

export function PedometerExperience() {
  const [stage, setStage] = useState<"home" | "detail" | "run">("home");
  const [visits, setVisits] = useState(0);
  const [theme, setTheme] = useState<ThemeName>("dark");
  const reduced = useReducedMotion();
  const now = useNow();
  const t = THEMES[theme];
  const shellId = reduced ? undefined : "pedometer-shell";

  const open = () => {
    setVisits((v) => v + 1);
    setStage("detail");
  };

  /* System-back mirror: Esc walks the stack back, exactly one level per press. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setStage((s) => (s === "run" ? "detail" : s === "detail" ? "home" : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-black text-white">
      <div className="flex items-center gap-2 pt-6" role="group" aria-label="Theme">
        {(["dark", "light"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTheme(m)}
            aria-pressed={theme === m}
            className="rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{
              borderColor: "rgba(255,255,255,0.2)",
              background: theme === m ? "#fff" : "transparent",
              color: theme === m ? "#000" : "rgba(255,255,255,0.6)",
            }}
          >
            {m}
          </button>
        ))}
        <span className="pl-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.35)" }}>
          OS 4.1 tokens
        </span>
      </div>
      <div className="flex w-full flex-1 items-center justify-center sm:py-6">
        <div
          className="relative h-dvh w-full overflow-hidden sm:h-[860px] sm:w-[400px] sm:rounded-[40px] sm:ring-1 sm:ring-white/15"
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
            {stage === "run" && <RunScreen key="run" onBack={() => setStage("detail")} t={t} />}
          </AnimatePresence>
        </div>
      </div>
      <p className="hidden pb-6 font-mono text-[10px] tracking-[0.2em] sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>
        WIDGET → DETAIL → RUN · ONE BACK PER LEVEL
      </p>
    </main>
  );
}
