"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_OUT, useReducedMotion } from "@/lib/motion";
import { DotText } from "./dot-matrix";

/**
 * Nothing pedometer — interaction concept.
 *
 * Three stages inside a Phone (2a) frame (1084x2412, 20:9):
 *   home   — small transparent pedometer widget on a Nothing-style homescreen
 *   detail — tap morphs the widget (shared layoutId) into an Apple-Fitness-like
 *            dashboard: count-up steps, goal, stats, 7-day + hourly activity
 *   run    — Strava-like run view, but in Nothing's language: the route is a
 *            dot-matrix trace with KM splits, elevation dots, mono stats
 *
 * Nothing OS rules honoured throughout: pure black ground, white ink, one red
 * reserved for goal/progress, uppercase mono micro-labels, dot fields instead
 * of solid fills, and this repo's own motion tokens (DUR/EASE_OUT).
 */

const RED = "#D92323";
const DIM = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.14)";

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

/* ---------------------------------- hooks --------------------------------- */

function useNow(): { time: string; dateLine: string } {
  const fmt = (d: Date) => ({
    time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
    dateLine: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} · ${String(d.getDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`,
  });
  const [now, setNow] = useState({ time: "9:41", dateLine: "Fri · 02 Oct" });
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
function DottedLine({ frac, total = 30, lit = "#ffffff" }: { frac: number; total?: number; lit?: string }) {
  const on = Math.round(frac * total);
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[4px] w-[4px] rounded-full"
          style={{ background: i < on ? lit : "rgba(255,255,255,0.12)" }}
        />
      ))}
    </div>
  );
}

/** 7-day activity as dot columns — Apple bars redrawn in NDot language. */
function WeekDots({ today }: { today: number }) {
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
                  style={{ background: r < lit ? (isToday ? "#fff" : "rgba(255,255,255,0.45)") : "rgba(255,255,255,0.10)" }}
                />
              ))}
            </div>
            <span
              className="font-mono text-[9px] tracking-[0.18em]"
              style={{ color: isToday ? "#fff" : "rgba(255,255,255,0.45)" }}
            >
              {b.d}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 24-hour step histogram, thin mono bars with the peak in red. */
function HourlyBars() {
  const max = Math.max(...HOURLY);
  return (
    <div className="flex h-[64px] items-end gap-[3px]" aria-hidden>
      {HOURLY.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: v === max ? "#fff" : v === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.45)",
          }}
        />
      ))}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: FAINT, background: "#0b0b0b" }}>
      <p className={MICRO} style={{ color: DIM }}>
        {label}
      </p>
      <p className="mt-1 font-mono text-[17px] tracking-tight text-white">
        {value} {sub ? <span className="text-[10px]" style={{ color: DIM }}>{sub}</span> : null}
      </p>
    </div>
  );
}

/** Strava route redrawn as a Nothing dot-matrix trace with a live runner. */
function RouteMap({ reduced }: { reduced: boolean }) {
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
      return { L, at };
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
    const tick = (t: number) => {
      const pt = at(((t - t0) % LOOP) / LOOP);
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
          <circle key={`${r}-${c}`} cx={10 + c * 20} cy={8 + r * 21} r={0.8} fill="rgba(255,255,255,0.07)" />
        )),
      )}
      <path d={ROUTE} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 9" />
      <path
        ref={pathRef}
        d={ROUTE}
        fill="none"
        stroke="#ffffff"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="0.1 9"
      />
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r={7} fill="#000" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
          <text x={m.x} y={m.y - 12} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="monospace" letterSpacing={1}>
            {`KM${i + 1}`}
          </text>
        </g>
      ))}
      <circle cx={ends.sx} cy={ends.sy} r={5} fill="#fff" />
      <text x={ends.sx} y={ends.sy - 12} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="monospace" letterSpacing={1}>
        START
      </text>
      <circle cx={ends.ex} cy={ends.ey} r={5} fill={RED} />
      <circle ref={haloRef} r={11} fill="none" stroke={RED} strokeWidth={1.5} opacity={0.5} />
      <circle ref={runnerRef} r={4.5} fill={RED} stroke="#000" strokeWidth={1.5} />
    </svg>
  );
}

/* --------------------------------- screens --------------------------------- */

function StatusBar({ time }: { time: string }) {
  return (
    <div className="flex items-center justify-between px-6 pt-4 font-mono text-[11px] tracking-[0.08em] text-white">
      <span>{time}</span>
      <span className="flex items-center gap-1.5" aria-label="5G, battery 87 percent">
        <span className="flex items-end gap-[2px]" aria-hidden>
          {[3, 5, 7, 9].map((h) => (
            <span key={h} className="w-[3px] rounded-[1px] bg-white" style={{ height: h }} />
          ))}
        </span>
        <span style={{ color: DIM }}>5G</span>
        <span className="ml-1 inline-block h-[11px] w-[22px] rounded-[3px] border border-white/60 p-[1.5px]">
          <span className="block h-full rounded-[1px] bg-white" style={{ width: "87%" }} />
        </span>
      </span>
    </div>
  );
}

function HomeScreen({ now, onOpen, shellId }: { now: { time: string; dateLine: string }; onOpen: () => void; shellId?: string }) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col bg-black"
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
    >
      <div className="mx-auto mt-2.5 h-[22px] w-[110px] rounded-full bg-black ring-1 ring-white/10" aria-hidden />
      <StatusBar time={now.time} />
      <p className={`${MICRO} px-6 pt-5`} style={{ color: DIM }}>
        {now.dateLine}
      </p>
      <div className="px-6 pt-1">
        <DotText text={now.time} dot={2.6} pitch={10} label={`Time ${now.time}`} />
      </div>

      <div className="px-4 pt-4">
        <motion.button
          type="button"
          onClick={onOpen}
          layoutId={shellId}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: DUR.base, ease: EASE_OUT }}
          aria-label="Open pedometer details"
          className="block w-full rounded-[26px] border p-4 text-left"
          style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }}
        >
          <span className="flex items-center justify-between">
            <span className={MICRO} style={{ color: DIM }}>
              Pedometer
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em]" style={{ color: DIM }}>
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: RED }} />
              GOAL 10K
            </span>
          </span>
          <span className="mt-2 block">
            <DotText text={STEPS.toLocaleString("en-US")} dot={2.5} pitch={9.5} label={`${STEPS} steps`} />
          </span>
          <span className="mt-3 block">
            <DottedLine frac={STEPS / GOAL} />
          </span>
          <span className="mt-2.5 flex items-center justify-between font-mono text-[10px] tracking-[0.14em]">
            <span style={{ color: DIM }}>73% OF GOAL</span>
            <span className="text-white" aria-hidden>
              TAP TO EXPAND ›
            </span>
          </span>
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        {[
          { k: "Weather", v: "21°", s: "CLEAR" },
          { k: "Glyph", v: "87%", s: "BATTERY" },
        ].map((w) => (
          <div key={w.k} className="rounded-[22px] border p-3.5" style={{ borderColor: FAINT, background: "rgba(255,255,255,0.02)" }}>
            <p className={MICRO} style={{ color: DIM }}>
              {w.k}
            </p>
            <p className="mt-1 font-mono text-[19px] text-white">
              {w.v} <span className="text-[9px] tracking-[0.18em]" style={{ color: DIM }}>{w.s}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto px-8 pb-2">
        <div className="grid grid-cols-4 gap-3">
          {["PHO", "MSG", "CAM", "SET"].map((a) => (
            <div key={a} className="flex flex-col items-center gap-1.5">
              <div className="h-[52px] w-[52px] rounded-[16px] border" style={{ borderColor: FAINT, background: "#101010" }} />
              <span className="font-mono text-[8px] tracking-[0.2em]" style={{ color: DIM }}>
                {a}
              </span>
            </div>
          ))}
        </div>
        <div className="mx-auto mb-1.5 mt-4 h-[4px] w-[120px] rounded-full bg-white/25" />
      </div>
    </motion.div>
  );
}

function DetailScreen({
  onClose,
  onRun,
  visits,
  shellId,
}: {
  onClose: () => void;
  onRun: () => void;
  visits: number;
  shellId?: string;
}) {
  const steps = useCountUp(STEPS, visits);
  return (
    <motion.div
      layoutId={shellId}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
      className="absolute inset-0 flex flex-col overflow-hidden bg-black"
    >
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto mt-2.5 h-[4px] w-[40px] rounded-full bg-white/25" />
        <div className="flex items-center justify-between px-5 pt-3">
          <p className={MICRO} style={{ color: DIM }}>
            Pedometer · Today
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to home screen"
            className="flex h-8 w-8 items-center justify-center rounded-full border text-[15px] text-white"
            style={{ borderColor: FAINT }}
          >
            ←
          </button>
        </div>

        <div className="px-5 pt-4">
          <p className={MICRO} style={{ color: DIM }}>
            Steps
          </p>
          <div className="mt-2">
            <DotText text={steps.toLocaleString("en-US")} dot={3} pitch={11} label={`${steps} steps`} />
          </div>
          <div className="mt-3">
            <DottedLine frac={STEPS / GOAL} total={34} />
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-[0.16em]" style={{ color: DIM }}>
            <span className="text-white">73%</span> OF 10,000 GOAL · 2,716 TO GO
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-5 pt-4">
          <Stat label="Distance" value={String(KM)} sub="KM" />
          <Stat label="Energy" value={String(KCAL)} sub="KCAL" />
          <Stat label="Active" value={String(ACTIVE_MIN)} sub="MIN" />
        </div>

        <div className="px-5 pt-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: FAINT, background: "#0b0b0b" }}>
            <div className="flex items-baseline justify-between">
              <p className={MICRO} style={{ color: DIM }}>
                7-day steps
              </p>
              <p className="font-mono text-[10px]" style={{ color: DIM }}>
                AVG 7,305
              </p>
            </div>
            <div className="mt-3">
              <WeekDots today={6} />
            </div>
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: FAINT, background: "#0b0b0b" }}>
            <div className="flex items-baseline justify-between">
              <p className={MICRO} style={{ color: DIM }}>
                Today · hourly
              </p>
              <p className="font-mono text-[10px]" style={{ color: DIM }}>
                PEAK 18:00
              </p>
            </div>
            <div className="mt-3">
              <HourlyBars />
            </div>
          </div>
        </div>

        <div className="px-5 pb-8 pt-3">
          <motion.button
            type="button"
            onClick={onRun}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-between rounded-[20px] px-5 py-4 font-mono text-[12px] tracking-[0.18em] text-black"
            style={{ background: "#fff" }}
            aria-label="View today's run"
          >
            <span>TODAY&apos;S RUN · 5.2 KM</span>
            <span aria-hidden>→</span>
          </motion.button>
          <p className="pt-3 text-center font-mono text-[9px] tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>
            CONCEPT · NOTHING × STRAVA LANGUAGE
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function RunScreen({ onBack }: { onBack: () => void }) {
  const reduced = useReducedMotion();
  const max = Math.max(...ELEV);
  return (
    <motion.div
      className="absolute inset-0 flex flex-col bg-black"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT }}
    >
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to step details"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-[16px] text-white"
            style={{ borderColor: FAINT }}
          >
            ←
          </button>
          <p className={MICRO} style={{ color: DIM }}>
            Morning run · {RUN.when}
          </p>
          <span className={MICRO} style={{ color: DIM }}>
            SHARE
          </span>
        </div>

        <div className="px-5 pt-3">
          <DotText text={RUN.dist} dot={3.4} pitch={12.5} label={`${RUN.dist} kilometres`} />
          <p className="mt-1 font-mono text-[11px] tracking-[0.24em] text-white">
            KILOMETRES <span style={{ color: DIM }}>· MORNING LOOP</span>
          </p>
        </div>

        <div className="px-4 pt-3">
          <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: FAINT, background: "#070707" }}>
            <RouteMap reduced={reduced} />
            <div className="flex items-center justify-between border-t px-4 py-2.5 font-mono text-[9px] tracking-[0.18em]" style={{ borderColor: FAINT, color: DIM }}>
              <span>
                <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-white align-baseline" />
                TRACE
              </span>
              <span>
                <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-baseline" style={{ background: RED }} />
                YOU · LIVE
              </span>
              <span>DOT-MATRIX GPS</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-5 pt-3">
          <Stat label="Time" value={RUN.time} />
          <Stat label="Pace" value={RUN.pace} sub="/KM" />
          <Stat label="Energy" value={RUN.kcal} sub="KCAL" />
        </div>

        <div className="px-5 pt-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: FAINT, background: "#0b0b0b" }}>
            <div className="flex items-baseline justify-between">
              <p className={MICRO} style={{ color: DIM }}>
                Elevation
              </p>
              <p className="font-mono text-[10px]" style={{ color: DIM }}>
                +86 M
              </p>
            </div>
            <div className="mt-3 flex h-[52px] items-end gap-[3px]" aria-hidden>
              {ELEV.map((e, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    height: `${(e / max) * 100}%`,
                    background: e === max ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-8 pt-3">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: FAINT }}>
            {SPLITS.map((s, i) => (
              <div
                key={s.km}
                className="flex items-center justify-between px-4 py-3 font-mono text-[12px]"
                style={{
                  background: i % 2 === 0 ? "#0b0b0b" : "#000",
                  borderTop: i === 0 ? "none" : `1px solid ${FAINT}`,
                }}
              >
                <span className="tracking-[0.14em] text-white">
                  KM {s.km}
                </span>
                <span className="text-white">{s.pace}</span>
                <span style={{ color: DIM }}>{s.hr} BPM</span>
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
  const reduced = useReducedMotion();
  const now = useNow();
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
      <p className="hidden pt-6 font-mono text-[10px] uppercase tracking-[0.28em] sm:block" style={{ color: DIM }}>
        Pedometer · interaction study · Nothing OS language
      </p>
      <div className="flex w-full flex-1 items-center justify-center sm:py-6">
        <div
          className="relative h-dvh w-full overflow-hidden bg-black sm:h-[860px] sm:w-[400px] sm:rounded-[40px] sm:ring-1 sm:ring-white/15"
          role="region"
          aria-label="Nothing Phone pedometer concept"
        >
          <AnimatePresence>
            {stage === "home" && <HomeScreen key="home" now={now} onOpen={open} shellId={shellId} />}
            {stage === "detail" && (
              <DetailScreen key="detail" onClose={() => setStage("home")} onRun={() => setStage("run")} visits={visits} shellId={shellId} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stage === "run" && <RunScreen key="run" onBack={() => setStage("detail")} />}
          </AnimatePresence>
        </div>
      </div>
      <p className="hidden pb-6 font-mono text-[10px] tracking-[0.2em] sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>
        OPEN THIS PAGE ON YOUR 2A TO FEEL IT AT 120HZ
      </p>
    </main>
  );
}
