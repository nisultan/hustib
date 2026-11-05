"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/store";
import { formatDate, todayISO } from "@/lib/dates";
import { RANKS } from "@/lib/prime";
import { SOURCES } from "@/lib/activity";
import {
  buildReport,
  Fact,
  firstActiveDay,
  period,
  Report,
  Span,
  SPAN_LABEL,
  Visual,
} from "@/lib/report";
import { Button, PageHeader, Segmented } from "@/components/ui";

/**
 * Reports: a sealed card per week, fortnight or month. Opening it reveals the
 * rank that period earned, then five facts about you. Above Mid it rains
 * confetti; at Mid or below the crowd boos.
 */

const SPANS = [
  { id: "week" as Span, label: "Week" },
  { id: "fortnight" as Span, label: "2 weeks" },
  { id: "month" as Span, label: "Month" },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const SEEN_KEY = "lockedin.reports.opened";

function useCount(to: number, delay = 0, duration = 1.3) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration, delay, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [to, delay, duration]);
  return v;
}

function toneColor(tone: Fact["tone"]) {
  return tone === "good" ? "var(--up)" : tone === "bad" ? "var(--urgent)" : "var(--accent)";
}

function scoreColor(score: number) {
  if (score >= 75) return "var(--up)";
  if (score >= 55) return "var(--accent)";
  if (score >= 40) return "var(--high)";
  return "var(--urgent)";
}

export default function ReportPage() {
  const store = useStore();
  const today = todayISO();
  const [span, setSpan] = useState<Span>("week");
  // On the closing day the fresh report is the one to open; otherwise the
  // last finished one.
  const latest = (sp: Span) => (today >= period(sp, 0, today).to ? 0 : 1);
  const [offset, setOffset] = useState(() => latest("week"));
  const [phase, setPhase] = useState<"sealed" | "counting" | "open">("sealed");
  const opened = phase === "open";
  const setOpened = (v: boolean) => setPhase(v ? "open" : "sealed");
  const [run, setRun] = useState(0);

  const p = useMemo(() => period(span, offset, today), [span, offset, today]);
  const report = useMemo(() => buildReport(store, p, span, today), [store, p, span, today]);
  const start = useMemo(() => firstActiveDay(store, today), [store, today]);
  const canBack = start != null && p.from > start;
  /*
    Reports are a ritual, not a dashboard: weekly and two-week reports open
    only on Sunday, monthly ones only on the last day of the month. A report
    you opened on its day stays open to you afterwards.
  */
  const nextUnlock = period(span, 0, today).to;
  const unlockDay = today === nextUnlock;
  const seenKey = `${span}:${p.from}`;
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const markSeen = () => {
    if (seen.includes(seenKey)) return;
    const next = [...seen, seenKey].slice(-200);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // Private mode: remembered for this visit only.
    }
  };
  const locked = p.to > today || !(unlockDay || seen.includes(seenKey));

  // A new period is a new sealed card. Reset in the same update as the
  // period change, so the card swap is a single transition.
  const go = (next: { span?: Span; offset: number }) => {
    setOpened(false);
    if (next.span) setSpan(next.span);
    setOffset(next.offset);
  };

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Report"
        subtitle="Who you were, period by period — ranked, explained, no sugar-coating."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={SPANS}
          value={span}
          onChange={(s) => go({ span: s, offset: latest(s) })}
          label="Report length"
        />
        <div className="flex items-center gap-1">
          <NavArrow dir="left" disabled={!canBack} onClick={() => go({ offset: offset + 1 })} />
          <span className="nums min-w-[150px] text-center text-[13.5px] font-semibold">
            {p.label}
            {p.current && (
              <span className="ml-1.5 text-[11px] font-medium text-ink-3">so far</span>
            )}
          </span>
          <NavArrow
            dir="right"
            disabled={offset === 0}
            onClick={() => go({ offset: Math.max(0, offset - 1) })}
          />
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "sealed" ? (
            <Sealed
              key="sealed"
              label={p.label}
              span={span}
              empty={report.total === 0}
              unlocks={locked ? nextUnlock : null}
              today={today}
              onOpen={() => {
                markSeen();
                setPhase("counting");
              }}
            />
          ) : phase === "counting" ? (
            <Countdown
              key="counting"
              onDone={() => {
                setRun((r) => r + 1);
                setPhase("open");
              }}
            />
          ) : (
            <motion.div
              key={`open-${run}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <ReportView
                report={report}
                onReplay={() => setRun((r) => r + 1)}
                onClose={() => setOpened(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Earlier" : "Later"}
      className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-panel-2 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path
          d={dir === "left" ? "M10 3 5 8l5 5" : "m6 3 5 5-5 5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* --------------------------------- Sealed --------------------------------- */

function unlockLabel(date: string, today: string): string {
  const days = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
      86_400_000,
  );
  const wd = WEEKDAYS_LONG[new Date(`${date}T12:00:00`).getDay()];
  if (days === 1) return `Unlocks tomorrow — ${wd}`;
  if (days < 7) return `Unlocks ${wd} · in ${days} days`;
  return `Unlocks ${formatDate(date)} · in ${days} days`;
}

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function Sealed({
  label,
  span,
  empty,
  unlocks,
  today,
  onOpen,
}: {
  label: string;
  span: Span;
  empty: boolean;
  unlocks: string | null;
  today: string;
  onOpen: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-14 text-center"
    >
      {/* Slow-turning glow behind the seal. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "conic-gradient(from 0deg, var(--accent), #f43f5e, #f59e0b, #22c55e, var(--accent))",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative">
        <motion.div
          className="mx-auto mb-5 w-[132px]"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <SealMark empty={empty || unlocks != null} />
        </motion.div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Your {SPAN_LABEL[span]} report
        </p>
        <p className="mt-1 text-[24px] font-bold tracking-tight">{label}</p>
        <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-2">
          {unlocks
            ? span === "month"
              ? "Monthly reports open on the last day of the month. Come back then."
              : "Reports open on Sundays only. Finish the week, then come back for the verdict."
            : empty
              ? "Nothing was logged in this stretch — there's nothing to judge yet."
              : "Sealed. Your rank, your best and worst, and five things you probably didn't notice."}
        </p>
        {unlocks ? (
          <div className="mt-6 inline-flex flex-col items-center gap-2">
            <button
              type="button"
              disabled
              aria-disabled
              className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-line bg-panel-2 px-6 py-3 text-[15px] font-semibold text-ink-3"
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <rect
                  x="4.5"
                  y="9"
                  width="11"
                  height="8"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M7 9V6.5a3 3 0 0 1 6 0V9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              Open report
            </button>
            <span className="text-[12.5px] font-medium text-ink-3">
              {unlockLabel(unlocks, today)}
            </span>
          </div>
        ) : (
          !empty && (
            <motion.div
              className="mt-6 inline-block"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <button
                type="button"
                onClick={onOpen}
                className="relative overflow-hidden rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent)]"
              >
                <span className="relative">Open report</span>
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/25"
                  initial={{ left: "-40%" }}
                  animate={{ left: "140%" }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    repeatDelay: 1.2,
                    ease: "easeInOut",
                  }}
                />
              </button>
            </motion.div>
          )
        )}
      </div>
    </motion.div>
  );
}

/**
 * The sealed report: two sheets, a little chart on the top one, and a wax
 * seal stamped with the app's lock. Drawn, not an emoji.
 */
function SealMark({ empty }: { empty: boolean }) {
  const bars = [14, 22, 17, 30, 24];
  const seal = empty ? "var(--text-3)" : "var(--accent)";
  return (
    <svg viewBox="0 0 132 120" className="w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="seal-wax" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={seal} stopOpacity="1" />
          <stop offset="1" stopColor={seal} stopOpacity="0.72" />
        </linearGradient>
        <filter id="seal-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Back sheet */}
      <motion.g
        initial={{ rotate: -4 }}
        animate={{ rotate: [-4, -8, -4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "60px 100px" }}
      >
        <rect
          x="30"
          y="10"
          width="64"
          height="84"
          rx="9"
          fill="var(--panel-2)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
      </motion.g>

      {/* Front sheet */}
      <g filter="url(#seal-shadow)">
        <rect
          x="38"
          y="16"
          width="64"
          height="84"
          rx="9"
          fill="var(--panel)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
        />
      </g>
      <rect x="48" y="27" width="26" height="4" rx="2" fill="var(--text-3)" opacity="0.7" />
      <rect x="48" y="36" width="40" height="3" rx="1.5" fill="var(--text-3)" opacity="0.35" />
      <rect x="48" y="43" width="32" height="3" rx="1.5" fill="var(--text-3)" opacity="0.35" />
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={49 + i * 8}
          width="5"
          rx="1.5"
          fill={
            empty
              ? "var(--text-3)"
              : i === 3
                ? "var(--accent)"
                : "color-mix(in srgb, var(--accent) 45%, var(--panel-2))"
          }
          initial={{ height: 0, y: 88 }}
          animate={{ height: empty ? 3 : h, y: 88 - (empty ? 3 : h) }}
          transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: EASE }}
        />
      ))}

      {/* Wax seal */}
      <motion.g
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 13 }}
        style={{ transformOrigin: "98px 92px" }}
      >
        {!empty && (
          <motion.circle
            cx="98"
            cy="92"
            r="20"
            fill={seal}
            animate={{ opacity: [0.25, 0, 0.25], scale: [1, 1.35, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: "98px 92px" }}
          />
        )}
        <path d="M90 104 86 118 93 114 97 119 99 106Z" fill={seal} opacity="0.85" />
        <path d="M106 104 110 118 103 114 99 119 97 106Z" fill={seal} opacity="0.7" />
        {/* Scalloped wax edge */}
        <path
          d={
            Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const r = i % 2 === 0 ? 17 : 15;
              return `${i === 0 ? "M" : "L"}${(98 + Math.cos(a) * r).toFixed(1)} ${(92 + Math.sin(a) * r).toFixed(1)}`;
            }).join(" ") + "Z"
          }
          fill="url(#seal-wax)"
        />
        <circle
          cx="98"
          cy="92"
          r="11"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />
        {/* Lock */}
        <path
          d="M94.5 91v-2.5a3.5 3.5 0 0 1 7 0V91"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect x="93" y="90.5" width="10" height="7.5" rx="1.8" fill="#fff" />
        <circle cx="98" cy="94.2" r="1.1" fill={seal} />
      </motion.g>
    </svg>
  );
}

/* -------------------------------- Countdown ------------------------------- */

const TEASERS = [
  "Counting your blocks…",
  "Weighing your habits…",
  "Reading your journal…",
  "Judging your week…",
];

/** 3 · 2 · 1 before the reveal. The pause is the point. */
function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  // One schedule, set once: parent re-renders must not restart the clock.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const ticks = [1, 2, 3].map((k) => setTimeout(() => setN(3 - k), k * 1000));
    const end = setTimeout(() => done.current(), 3600);
    return () => {
      ticks.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, []);

  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(8px)" }}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative grid min-h-[380px] place-items-center overflow-hidden rounded-2xl border border-line bg-panel px-6 py-12"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
        animate={{ opacity: [0.15, 0.4, 0.15], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex flex-col items-center">
        <div className="relative size-[170px]">
          <svg viewBox="0 0 170 170" className="absolute inset-0 -rotate-90">
            <circle cx="85" cy="85" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="6" />
            <motion.circle
              cx="85"
              cy="85"
              r={R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={n}
                initial={{ opacity: 0, scale: 2.2, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.4, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="nums text-[78px] font-extrabold leading-none"
                style={{ color: n === 0 ? "var(--accent)" : "var(--text)" }}
              >
                {n === 0 ? "!" : n}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="shimmer-text mt-6 text-[15px] font-semibold"
          >
            {TEASERS[3 - n] ?? TEASERS[3]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* --------------------------------- Report --------------------------------- */

const PILLAR_ICON: Record<string, string> = {
  execution: "M4 10.5 8 14.5 16 5.5",
  consistency: "M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3",
  momentum: "M3 14 8 9l3 3 6-6M12.5 6H17v4.5",
  mind: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5",
  body: "M10 16.5s-6-3.6-6-8a3.4 3.4 0 0 1 6-2.2 3.4 3.4 0 0 1 6 2.2c0 4.4-6 8-6 8z",
  goals: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
};

function Glyph({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </p>
  );
}

function ReportView({
  report,
  onReplay,
  onClose,
}: {
  report: Report;
  onReplay: () => void;
  onClose: () => void;
}) {
  const { reading, previous } = report;
  const [effect, setEffect] = useState<"party" | "boo" | null>(null);
  const [shake, setShake] = useState(0);
  const endEffect = useCallback(() => setEffect(null), []);

  useEffect(() => {
    if (report.good == null) return;
    const t = setTimeout(() => {
      setEffect(report.good ? "party" : "boo");
      if (!report.good) setShake((s) => s + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [report.good]);

  const pillars = reading.pillars.filter((p) => p.score != null) as {
    key: string;
    label: string;
    score: number;
    why: string;
  }[];
  const ladder = [...RANKS].reverse();
  const rankIndex = reading.rank ? ladder.findIndex((r) => r.key === reading.rank!.key) : -1;
  const prevIndex = previous?.rank
    ? ladder.findIndex((r) => r.key === previous.rank!.key)
    : null;
  const moved = prevIndex == null || rankIndex < 0 ? 0 : rankIndex - prevIndex;
  const color = reading.rank?.color ?? "var(--text-3)";
  const change =
    report.prevTotal > 0
      ? Math.round(((report.total - report.prevTotal) / report.prevTotal) * 100)
      : null;
  const sources = SOURCES.map((s) => ({
    ...s,
    n: report.days.reduce((a, d) => a + d.by[s.key], 0),
  })).filter((s) => s.n > 0);

  return (
    <div className="grid gap-4">
      {effect === "party" && <Confetti onDone={endEffect} />}
      {effect === "boo" && <Boos rank={reading.rank?.key ?? "drifting"} onDone={endEffect} />}

      {/* ------------------------------ Verdict ------------------------------ */}
      <motion.section
        key={shake}
        animate={shake ? { x: [0, -12, 12, -9, 9, -5, 5, 0] } : undefined}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-line px-6 pb-6 pt-7"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 13%, var(--panel)), var(--panel) 55%)`,
        }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-28 size-96 rounded-full blur-3xl"
          style={{ background: color }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.22, scale: 1 }}
          transition={{ delay: 1.2, duration: 1.2, ease: EASE }}
        />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
          <ScoreRing score={reading.score} color={color} />
          <div className="min-w-[220px] flex-1">
            <Label>This {SPAN_LABEL[report.span]} you were</Label>
            {reading.rank ? (
              <>
                <motion.p
                  initial={{ opacity: 0, scale: 0.5, y: 14, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 1.3, type: "spring", stiffness: 240, damping: 13 }}
                  className="origin-left text-[46px] font-extrabold leading-[1.05] tracking-tight"
                  style={{ color }}
                >
                  {reading.rank.name}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.7 }}
                  className="mt-2 max-w-md text-[14.5px] leading-relaxed text-ink-2"
                >
                  {reading.rank.line}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.9 }}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {previous?.rank && (
                    <Chip
                      color={
                        moved > 0 ? "var(--up)" : moved < 0 ? "var(--urgent)" : "var(--text-3)"
                      }
                    >
                      {moved > 0 ? "▲ Up" : moved < 0 ? "▼ Down" : "= Same as"}{" "}
                      {moved !== 0 ? "from" : ""} {previous.rank.name}
                    </Chip>
                  )}
                  {reading.strongest && (
                    <Chip color="var(--up)">
                      Carried by {reading.strongest.label.toLowerCase()}
                    </Chip>
                  )}
                  {reading.weakest && (
                    <Chip color="var(--urgent)">
                      Dragged by {reading.weakest.label.toLowerCase()}
                    </Chip>
                  )}
                </motion.div>
              </>
            ) : (
              <p className="mt-1 text-[18px] font-semibold text-ink-2">
                Not enough to rank — but here&apos;s what happened.
              </p>
            )}
          </div>
        </div>

        {reading.rank && reading.score != null && (
          <Ladder ladder={ladder} rankIndex={rankIndex} score={reading.score} />
        )}
      </motion.section>

      {/* ------------------------------- Stats ------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          delay={0.3}
          icon="M4 10.5 8 14.5 16 5.5"
          value={report.total}
          label="things done"
          foot={
            change == null ? (
              <span className="text-ink-3">first {SPAN_LABEL[report.span]} on record</span>
            ) : (
              <span style={{ color: change >= 0 ? "var(--up)" : "var(--urgent)" }}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs before
              </span>
            )
          }
        >
          <SourceBar sources={sources} delay={0.6} />
        </StatTile>
        <StatTile
          delay={0.38}
          icon="M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3"
          value={report.activeDays}
          suffix={`/${report.days.length}`}
          label="days active"
          foot={
            <span className="text-ink-3">
              {Math.round((report.activeDays / Math.max(1, report.days.length)) * 100)}% showed
              up
            </span>
          }
        >
          <DayPips days={report.days.map((d) => d.total > 0)} delay={0.6} />
        </StatTile>
        <StatTile
          delay={0.46}
          icon="M8.5 11.5l3-3M7 9.5 5.5 11a2.5 2.5 0 0 0 3.5 3.5L10.5 13M13 10.5l1.5-1.5A2.5 2.5 0 0 0 11 5.5L9.5 7"
          value={report.bestRun}
          label="best run, days"
          foot={
            <span className="text-ink-3">
              {report.bestRun >= 5
                ? "proper streak"
                : report.bestRun >= 3
                  ? "building"
                  : "keep the chain"}
            </span>
          }
        >
          <RunBar run={report.bestRun} of={report.days.length} delay={0.6} />
        </StatTile>
        <StatTile
          delay={0.54}
          icon="M3 14 8 9l3 3 6-6M12.5 6H17v4.5"
          value={reading.score ?? 0}
          suffix="/100"
          label="form score"
          foot={
            previous?.score != null && reading.score != null ? (
              <span
                style={{
                  color: reading.score >= previous.score ? "var(--up)" : "var(--urgent)",
                }}
              >
                {reading.score >= previous.score ? "▲" : "▼"}{" "}
                {Math.abs(reading.score - previous.score)} pts vs before
              </span>
            ) : (
              <span className="text-ink-3">no earlier score</span>
            )
          }
        >
          <RunBar run={reading.score ?? 0} of={100} delay={0.6} color={color} />
        </StatTile>
      </div>

      {/* ------------------------------ Pillars ------------------------------ */}
      {pillars.length >= 3 && (
        <section className="rounded-2xl border border-line bg-panel px-5 py-5">
          <div className="mb-4 flex items-baseline justify-between">
            <Label>Your shape this {SPAN_LABEL[report.span]}</Label>
            <span className="text-[11.5px] text-ink-3">six sides of the score</span>
          </div>
          <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
            <Radar pillars={pillars} color={color} />
            <div className="grid gap-3.5">
              {pillars.map((p, i) => (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, ease: EASE }}
                  className="group"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-lg"
                      style={{
                        color: scoreColor(p.score),
                        background: `color-mix(in srgb, ${scoreColor(p.score)} 14%, transparent)`,
                      }}
                    >
                      <Glyph d={PILLAR_ICON[p.key]} className="size-3.5" />
                    </span>
                    <span className="w-24 shrink-0 text-[13px] font-semibold">{p.label}</span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: scoreColor(p.score) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${p.score}%` }}
                        transition={{ delay: 0.6 + i * 0.08, duration: 1, ease: EASE }}
                      />
                    </div>
                    <span
                      className="nums w-8 text-right text-[13px] font-bold"
                      style={{ color: scoreColor(p.score) }}
                    >
                      <Count to={p.score} delay={0.6 + i * 0.08} />
                    </span>
                  </div>
                  <p className="ml-[38px] mt-1 text-[11.5px] text-ink-3">{p.why}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------- Facts ------------------------------- */}
      {report.facts.length > 0 && (
        <section className="mt-2">
          <div className="mb-3 flex items-baseline justify-between">
            <Label>
              {report.facts.length} things about you this {SPAN_LABEL[report.span]}
            </Label>
            <span className="text-[11.5px] text-ink-3">
              {report.facts.filter((f) => f.tone === "good").length} good ·{" "}
              {report.facts.filter((f) => f.tone === "bad").length} to fix
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {report.facts.map((f, i) => (
              <FactCard
                key={f.id}
                fact={f}
                n={i + 1}
                delay={i * 0.08}
                wide={i === 0 && report.facts.length % 2 === 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------- Day by day ---------------------------- */}
      <section className="rounded-2xl border border-line bg-panel px-5 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <Label>Day by day</Label>
          <div className="flex flex-wrap gap-3">
            {sources.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label} <span className="nums font-semibold text-ink-2">{s.n}</span>
              </span>
            ))}
          </div>
        </div>
        <DailyChart report={report} />
      </section>

      <div className="flex justify-center gap-2 pb-4 pt-1">
        <Button onClick={onReplay}>Replay</Button>
        <Button variant="ghost" onClick={onClose}>
          Seal it again
        </Button>
      </div>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}
    >
      {children}
    </span>
  );
}

function Count({ to, delay = 0 }: { to: number; delay?: number }) {
  return <>{Math.round(useCount(to, delay, 1))}</>;
}

/** Six steps with a marker that slides to where the score sits. */
function Ladder({
  ladder,
  rankIndex,
  score,
}: {
  ladder: typeof RANKS;
  rankIndex: number;
  score: number;
}) {
  // Position inside the ladder: each rank gets an equal sixth, the score
  // places the marker within its own step.
  const r = ladder[rankIndex];
  const next = ladder[rankIndex + 1];
  const within = next
    ? (score - r.min) / Math.max(1, next.min - r.min)
    : Math.min(1, (score - r.min) / 20);
  const pos = ((rankIndex + Math.max(0.08, Math.min(0.92, within))) / ladder.length) * 100;
  return (
    <div className="relative mt-7">
      <div className="flex gap-1">
        {ladder.map((step, i) => (
          <motion.div
            key={step.key}
            className="h-2 flex-1 rounded-full"
            style={{ background: step.color }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: i === rankIndex ? 1 : i < rankIndex ? 0.45 : 0.16, scaleX: 1 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: EASE }}
          />
        ))}
      </div>
      <motion.div
        className="absolute -top-1.5 size-5 -translate-x-1/2 rounded-full border-[3px] border-[var(--panel)] shadow-lg"
        style={{ background: r.color }}
        initial={{ left: "0%" }}
        animate={{ left: `${pos}%` }}
        transition={{ delay: 0.2, duration: 1.3, ease: EASE }}
      />
      <div className="mt-2 flex gap-1">
        {ladder.map((step, i) => (
          <p
            key={step.key}
            className={`flex-1 truncate text-center text-[10.5px] ${i === rankIndex ? "font-bold" : "text-ink-3"}`}
            style={i === rankIndex ? { color: step.color } : undefined}
          >
            {step.name}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  delay,
  icon,
  value,
  suffix = "",
  label,
  foot,
  children,
}: {
  delay: number;
  icon: string;
  value: number;
  suffix?: string;
  label: string;
  foot: React.ReactNode;
  children: React.ReactNode;
}) {
  const v = useCount(value, delay, 1.1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      whileHover={{ y: -3 }}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-panel px-4 py-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-3">{label}</span>
        <span className="grid size-7 place-items-center rounded-lg bg-panel-2 text-ink-2">
          <Glyph d={icon} className="size-3.5" />
        </span>
      </div>
      <p className="nums text-[30px] font-extrabold leading-none tracking-tight">
        {Math.round(v)}
        <span className="ml-0.5 text-[14px] font-semibold text-ink-3">{suffix}</span>
      </p>
      {children}
      <p className="text-[11.5px] font-medium">{foot}</p>
    </motion.div>
  );
}

function SourceBar({
  sources,
  delay,
}: {
  sources: { key: string; color: string; n: number }[];
  delay: number;
}) {
  const total = Math.max(
    1,
    sources.reduce((a, s) => a + s.n, 0),
  );
  return (
    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-panel-2">
      {sources.map((s, i) => (
        <motion.span
          key={s.key}
          className="h-full rounded-full"
          style={{ background: s.color }}
          initial={{ width: 0 }}
          animate={{ width: `${(s.n / total) * 100}%` }}
          transition={{ delay: delay + i * 0.08, duration: 0.7, ease: EASE }}
        />
      ))}
    </div>
  );
}

function DayPips({ days, delay }: { days: boolean[]; delay: number }) {
  return (
    <div className="flex h-1.5 gap-[3px]">
      {days.map((on, i) => (
        <motion.span
          key={i}
          className="h-full flex-1 rounded-full"
          style={{ background: on ? "var(--up)" : "var(--panel-2)" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: delay + i * 0.03 }}
        />
      ))}
    </div>
  );
}

function RunBar({
  run,
  of,
  delay,
  color = "var(--accent)",
}: {
  run: number;
  of: number;
  delay: number;
  color?: string;
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${(run / Math.max(1, of)) * 100}%` }}
        transition={{ delay, duration: 0.9, ease: EASE }}
      />
    </div>
  );
}

/** Hexagon of the six pillars: the shape of the period at a glance. */
function Radar({
  pillars,
  color,
}: {
  pillars: { key: string; label: string; score: number }[];
  color: string;
}) {
  const S = 260;
  const c = S / 2;
  const R = 92;
  const n = pillars.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const poly = (scale: (i: number) => number) =>
    pillars
      .map((_, i) =>
        pt(i, scale(i))
          .map((x) => x.toFixed(1))
          .join(","),
      )
      .join(" ");
  const shape = poly((i) => (Math.max(4, pillars[i].score) / 100) * R);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[260px] overflow-visible">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={poly(() => R * k)}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {pillars.map((_, i) => {
        const [x, y] = pt(i, R);
        return (
          <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />
        );
      })}
      <motion.polygon
        points={shape}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ transformOrigin: `${c}px ${c}px` }}
        transition={{ delay: 0.5, duration: 1.2, ease: EASE }}
        fill={`color-mix(in srgb, ${color} 28%, transparent)`}
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {pillars.map((p, i) => {
        const [x, y] = pt(i, (Math.max(4, p.score) / 100) * R);
        const [lx, ly] = pt(i, R + 20);
        return (
          <g key={p.key}>
            <motion.circle
              cx={x}
              cy={y}
              r="4"
              fill={scoreColor(p.score)}
              stroke="var(--panel)"
              strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 1.2 + i * 0.06,
                type: "spring",
                stiffness: 400,
                damping: 14,
              }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--text-3)] text-[10.5px] font-semibold"
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScoreRing({ score, color }: { score: number | null; color: string }) {
  const value = useCount(score ?? 0, 0.1, 1.3);
  const R = 58;
  const C = 2 * Math.PI * R;
  const ticks = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="relative size-[150px] shrink-0">
      <motion.div
        aria-hidden
        className="absolute inset-3 rounded-full blur-2xl"
        style={{ background: color }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      />
      <svg viewBox="0 0 150 150" className="relative size-full -rotate-90">
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={75 + Math.cos(a) * 70}
              y1={75 + Math.sin(a) * 70}
              x2={75 + Math.cos(a) * 73}
              y2={75 + Math.sin(a) * 73}
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          );
        })}
        <circle cx="75" cy="75" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="10" />
        <motion.circle
          cx="75"
          cy="75"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - (score ?? 0) / 100) }}
          transition={{ delay: 0.1, duration: 1.3, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="nums text-[42px] font-extrabold leading-none" style={{ color }}>
            {score == null ? "–" : Math.round(value)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            form
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Facts --------------------------------- */

/** Line icons per fact. Same stroke language as the rest of the app. */
const FACT_ICON: Record<string, string> = {
  "best-pillar": "M11 2.5 4.5 11h5l-1 6.5 7-9h-5z",
  "worst-pillar": "M10 3.5 2.8 16h14.4zM10 8.5v3.2M10 14v.01",
  "best-day":
    "M10 17a5 5 0 0 0 5-5c0-3-2-4.5-3-7-1 2-2 2.5-3 4-.7-1-1-1.5-1-3-2 1.5-3 3.5-3 6a5 5 0 0 0 5 5z",
  blank: "M3.5 5h13v11h-13zM3.5 8.5h13M8 11l4 3.5M12 11l-4 3.5",
  "no-blank":
    "M8.5 11.5l3-3M7 9.5 5.5 11a2.5 2.5 0 0 0 3.5 3.5L10.5 13M13 10.5l1.5-1.5A2.5 2.5 0 0 0 11 5.5L9.5 7",
  plan: "M4 5.5h7M4 10h5M4 14.5h4M12 12.5l2 2 3.5-4",
  tasks: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM7 10.2l2 2 4-4.2",
  "habit-best":
    "M6.5 3.5h7v3.5a3.5 3.5 0 0 1-7 0zM6.5 5H4a2.5 2.5 0 0 0 2.6 3M13.5 5H16a2.5 2.5 0 0 1-2.6 3M10 10.5v3M7 16.5h6",
  "habit-worst": "M3 6l5 5 3-3 6 6M17 9.5V14h-4.5",
  journal: "M13.5 3.5l3 3L7 16H4v-3z",
  weight: "M4.5 6.5h11l1.2 9a1 1 0 0 1-1 1.1H4.3a1 1 0 0 1-1-1.1zM10 9.5v2.2M10 11.7l1.8-1.4",
  versus: "M3 14 8 9l3 3 6-6M12.5 6H17v4.5",
  weekend: "M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8z",
  run: "M8.5 11.5l3-3M7 9.5 5.5 11a2.5 2.5 0 0 0 3.5 3.5L10.5 13M13 10.5l1.5-1.5A2.5 2.5 0 0 0 11 5.5L9.5 7",
};
const DOWN_TREND = "M3 6l5 5 3-3 6 6M17 9.5V14h-4.5";

function FactCard({
  fact,
  n,
  delay,
  wide,
}: {
  fact: Fact;
  n: number;
  delay: number;
  wide: boolean;
}) {
  const color = toneColor(fact.tone);
  const icon =
    fact.id === "versus" && fact.tone === "bad"
      ? DOWN_TREND
      : (FACT_ICON[fact.id] ?? FACT_ICON.versus);
  return (
    <motion.article
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, duration: 0.55, ease: EASE }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden rounded-2xl border border-line bg-panel px-5 py-5 transition-colors hover:border-line-strong ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      {/* Tone wash, brighter on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: color }}
      />
      <span className="nums pointer-events-none absolute right-4 top-2 text-[44px] font-extrabold leading-none text-ink-3 opacity-[0.09]">
        {String(n).padStart(2, "0")}
      </span>
      <div className={`relative ${wide ? "md:flex md:items-center md:gap-8" : ""}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <motion.span
              className="grid size-9 shrink-0 place-items-center rounded-xl"
              style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
              initial={{ scale: 0, rotate: -45 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: delay + 0.15, type: "spring", stiffness: 320, damping: 13 }}
              whileHover={{ rotate: [0, -12, 12, 0], transition: { duration: 0.5 } }}
            >
              <Glyph d={icon} className="size-[18px]" />
            </motion.span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color }}
            >
              {fact.tone === "good"
                ? "Good at"
                : fact.tone === "bad"
                  ? "Work on"
                  : "Worth knowing"}
            </span>
          </div>
          <h3 className="mt-3 text-[17px] font-bold leading-snug tracking-tight">
            {fact.title}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{fact.body}</p>
        </div>
        {fact.visual && (
          <div className={`mt-4 ${wide ? "md:mt-0 md:w-[42%] md:shrink-0" : ""}`}>
            <FactVisual v={fact.visual} color={color} delay={delay + 0.25} />
          </div>
        )}
      </div>
    </motion.article>
  );
}

function FactVisual({ v, color, delay }: { v: Visual; color: string; delay: number }) {
  if (v.kind === "ring") return <MiniRing value={v.value} color={color} delay={delay} />;
  if (v.kind === "bars") {
    const max = Math.max(1, ...v.values);
    return (
      <div className="flex h-20 items-end justify-between gap-1">
        {v.values.map((x, i) => (
          <div
            key={i}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <motion.div
              className="w-full max-w-[10px] rounded-full"
              style={{
                background:
                  i === v.highlight
                    ? color
                    : "color-mix(in srgb, var(--text-3) 30%, transparent)",
              }}
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(x > 0 ? 8 : 3, (x / max) * 56)}px` }}
              viewport={{ once: true }}
              transition={{ delay: delay + i * 0.04, duration: 0.7, ease: EASE }}
            />
            {v.values.length <= 14 && (
              <span
                className={`text-[9.5px] ${i === v.highlight ? "font-bold" : "text-ink-3"}`}
                style={i === v.highlight ? { color } : undefined}
              >
                {v.labels[i]}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (v.kind === "dots") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {v.hits.map((hit, i) => (
          <motion.span
            key={i}
            className="size-4 rounded-md"
            style={{
              background: hit ? color : "transparent",
              boxShadow: hit
                ? `0 0 10px -2px ${color}`
                : "inset 0 0 0 1.5px var(--border-strong)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              delay: delay + i * 0.05,
              type: "spring",
              stiffness: 420,
              damping: 15,
            }}
          />
        ))}
      </div>
    );
  }
  if (v.kind === "versus") {
    const max = Math.max(1, v.now, v.before);
    return (
      <div className="grid gap-2">
        {[
          {
            label: v.beforeLabel,
            value: v.before,
            c: "color-mix(in srgb, var(--text-3) 40%, transparent)",
          },
          { label: v.nowLabel, value: v.now, c: color },
        ].map((row, i) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[11.5px] text-ink-3">{row.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.c }}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ delay: delay + i * 0.15, duration: 0.9, ease: EASE }}
              />
            </div>
            <span className="nums w-8 text-right text-[12.5px] font-bold">{row.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return <Delta value={v.value} unit={v.unit} color={color} delay={delay} />;
}

function MiniRing({ value, color, delay }: { value: number; color: string; delay: number }) {
  const v = useCount(value, delay, 1);
  const R = 20;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 50 50" className="size-12 -rotate-90">
        <circle cx="25" cy="25" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="4.5" />
        <motion.circle
          cx="25"
          cy="25"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - value / 100) }}
          transition={{ delay, duration: 1.1, ease: EASE }}
        />
      </svg>
      <div>
        <p className="nums text-[22px] font-extrabold leading-none" style={{ color }}>
          {Math.round(v)}%
        </p>
        <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-panel-2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ delay, duration: 1.1, ease: EASE }}
          />
        </div>
      </div>
    </div>
  );
}

function Delta({
  value,
  unit,
  color,
  delay,
}: {
  value: number;
  unit: string;
  color: string;
  delay: number;
}) {
  const v = useCount(Math.abs(value), delay, 1);
  return (
    <p className="nums text-[24px] font-extrabold" style={{ color }}>
      {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
      {v.toFixed(1)} <span className="text-[14px] font-semibold text-ink-3">{unit}</span>
    </p>
  );
}

/* ------------------------------- Day by day ------------------------------- */

function DailyChart({ report }: { report: Report }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = report.days;
  const max = Math.max(1, ...days.map((d) => d.total));
  const avg = days.reduce((a, d) => a + d.total, 0) / Math.max(1, days.length);
  const best = days.reduce((b, d, i) => (d.total > days[b].total ? i : b), 0);
  const H = 150;
  const short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);
  const step = Math.ceil(max / 3);
  const grid = [step, step * 2, step * 3].filter((g) => g <= max * 1.15);
  const scale = (n: number) => (n / Math.max(max, grid[grid.length - 1] ?? max)) * H;

  return (
    <div className="relative">
      <div className="relative" style={{ height: H }}>
        {/* Gridlines */}
        {grid.map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: scale(g) }}
          >
            <span className="nums w-5 text-right text-[9.5px] text-ink-3">{g}</span>
            <span className="h-px flex-1 bg-[var(--border)] opacity-60" />
          </div>
        ))}
        {/* Average */}
        {avg > 0 && (
          <motion.div
            className="absolute left-7 right-0 flex items-center"
            style={{ bottom: scale(avg) }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 1.4, duration: 0.8, ease: EASE }}
          >
            <span
              className="h-0 flex-1 border-t border-dashed"
              style={{ borderColor: "var(--accent)" }}
            />
            <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold text-accent-text">
              avg {avg.toFixed(1)}
            </span>
          </motion.div>
        )}
        {/* Bars */}
        <div className="absolute inset-y-0 left-7 right-12 flex items-end justify-around">
          {days.map((d, i) => {
            const h = d.total === 0 ? 3 : Math.max(8, scale(d.total));
            const on = hover === i;
            return (
              <div
                key={d.date}
                className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {d.total > 0 && (
                  <motion.span
                    className="nums mb-1 text-[10.5px] font-bold"
                    style={{ color: i === best ? "var(--accent)" : "var(--text-2)" }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: days.length <= 14 || on || i === best ? 1 : 0, y: 0 }}
                    transition={{ delay: hover == null ? 1 + i * 0.04 : 0 }}
                  >
                    {i === best ? `★ ${d.total}` : d.total}
                  </motion.span>
                )}
                <motion.div
                  className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-full"
                  style={{
                    maxWidth: days.length <= 14 ? 16 : 9,
                    background: d.total === 0 ? "var(--panel-2)" : undefined,
                    boxShadow: on
                      ? "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)"
                      : undefined,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: h, opacity: hover == null || on ? 1 : 0.45 }}
                  transition={{
                    height: { delay: 0.7 + i * 0.04, duration: 0.8, ease: EASE },
                    opacity: { duration: 0.15 },
                  }}
                >
                  {SOURCES.map((s) =>
                    d.by[s.key] > 0 ? (
                      <div
                        key={s.key}
                        style={{ flex: d.by[s.key], background: s.color, minHeight: 2 }}
                      />
                    ) : null,
                  )}
                </motion.div>
                <AnimatePresence>
                  {on && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11.5px] shadow-lg"
                      style={{ bottom: h + 26 }}
                    >
                      <p className="font-bold">
                        {short[dateOf(d.date).getDay()]} {formatDate(d.date)} · {d.total}
                      </p>
                      {SOURCES.filter((s) => d.by[s.key] > 0).map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5 text-ink-2">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: s.color }}
                          />
                          {d.by[s.key]} {s.label.toLowerCase()}
                        </p>
                      ))}
                      {d.total === 0 && <p className="text-ink-3">nothing logged</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-7 mr-12 mt-2 flex justify-around">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={`flex-1 text-center text-[10px] ${i === best ? "font-bold text-accent-text" : hover === i ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            {days.length <= 14
              ? short[dateOf(d.date).getDay()].slice(0, days.length <= 7 ? 3 : 1)
              : dateOf(d.date).getDate() % 5 === 1 || i === best
                ? dateOf(d.date).getDate()
                : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Effects --------------------------------- */

const CONFETTI = ["#7c6bf0", "#f43f5e", "#f59e0b", "#22c55e", "#0ea5e9", "#e879f9", "#fbbf24"];

function Confetti({ onDone }: { onDone: () => void }) {
  const calm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);
  const pieces = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      // Two cannons from the bottom corners, arcing up and falling down.
      const x0 = fromLeft ? -20 : w + 20;
      const peakX = fromLeft ? Math.random() * w * 0.75 : w - Math.random() * w * 0.75;
      return {
        x: [x0, peakX, peakX + (Math.random() - 0.5) * 200],
        y: [h + 20, h * (0.05 + Math.random() * 0.35), h + 60],
        rotate: [0, Math.random() * 720 - 360, Math.random() * 1080],
        color: CONFETTI[i % CONFETTI.length],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        round: Math.random() > 0.7,
        delay: Math.random() * 0.35,
        duration: 2.6 + Math.random() * 1.6,
      };
    });
  }, []);
  if (!mounted || calm) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-0 top-0"
          style={{
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            borderRadius: p.round ? 999 : 2,
          }}
          initial={{ x: p.x[0], y: p.y[0], opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: [1, 1, 0.9] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            times: [0, 0.35, 1],
            ease: ["easeOut", "easeIn"],
          }}
        />
      ))}
      <motion.div
        className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-2xl border border-line bg-panel px-6 py-3 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.6, y: -20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.05, 1, 0.95], y: [-20, 0, 0, -10] }}
        transition={{ duration: 3.2, times: [0, 0.15, 0.8, 1] }}
      >
        <p className="text-[28px]">🎉</p>
        <p className="text-[16px] font-bold">Above Mid. Let&apos;s go.</p>
      </motion.div>
    </div>,
    document.body,
  );
}

function Boos({ rank, onDone }: { rank: string; onDone: () => void }) {
  const calm = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(onDone, 4800);
    return () => clearTimeout(t);
  }, [onDone]);
  const pool =
    rank === "anti"
      ? ["👎", "💀", "👎", "🥀", "👎"]
      : rank === "slump"
        ? ["👎", "🥶", "👎", "😬", "👎"]
        : ["👎", "😐", "👎", "🥱", "👎"];
  const pieces = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return Array.from({ length: 34 }, (_, i) => {
      const x = Math.random() * w;
      return {
        emoji: pool[i % pool.length],
        x: [x, x + (Math.random() - 0.5) * 80, x + (Math.random() - 0.5) * 120],
        y: [h + 40, h * 0.45, -80],
        rotate: [0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 70],
        size: 22 + Math.random() * 22,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 1.4,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!mounted || calm) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--urgent) 35%, transparent), transparent 60%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 3.5 }}
      />
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-0 top-0 select-none"
          style={{ fontSize: p.size }}
          initial={{ x: p.x[0], y: p.y[0], opacity: 0 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: [0, 1, 0.6] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        >
          {p.emoji}
        </motion.span>
      ))}
      <motion.div
        className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-2xl border border-line bg-panel px-6 py-3 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.05, 1, 0.95], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 3.2, times: [0, 0.15, 0.8, 1] }}
      >
        <p className="text-[28px]">👎</p>
        <p className="text-[16px] font-bold">Mid or worse. The crowd is not impressed.</p>
        <p className="text-[12.5px] text-ink-3">
          Read the weak spot below and flip it next time.
        </p>
      </motion.div>
    </div>,
    document.body,
  );
}
