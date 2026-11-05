"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { RANKS } from "@/lib/prime";
import { SOURCES } from "@/lib/activity";
import { buildReport, Fact, firstActiveDay, period, Report, Span, SPAN_LABEL, Visual } from "@/lib/report";
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
  const [offset, setOffset] = useState(1);
  const [opened, setOpened] = useState(false);
  const [run, setRun] = useState(0);

  const p = useMemo(() => period(span, offset, today), [span, offset, today]);
  const report = useMemo(() => buildReport(store, p, span, today), [store, p, span, today]);
  const start = useMemo(() => firstActiveDay(store, today), [store, today]);
  const canBack = start != null && p.from > start;

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
      <PageHeader title="Report" subtitle="Who you were, period by period — ranked, explained, no sugar-coating." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={SPANS}
          value={span}
          onChange={(s) => go({ span: s, offset: 1 })}
          label="Report length"
        />
        <div className="flex items-center gap-1">
          <NavArrow dir="left" disabled={!canBack} onClick={() => go({ offset: offset + 1 })} />
          <span className="nums min-w-[150px] text-center text-[13.5px] font-semibold">
            {p.label}
            {p.current && <span className="ml-1.5 text-[11px] font-medium text-ink-3">so far</span>}
          </span>
          <NavArrow dir="right" disabled={offset === 0} onClick={() => go({ offset: Math.max(0, offset - 1) })} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!opened ? (
          <Sealed
            key="sealed"
            label={p.label}
            span={span}
            empty={report.total === 0}
            onOpen={() => {
              setOpened(true);
              setRun((r) => r + 1);
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
            <ReportView report={report} onReplay={() => setRun((r) => r + 1)} onClose={() => setOpened(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavArrow({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Earlier" : "Later"}
      className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-panel-2 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path d={dir === "left" ? "M10 3 5 8l5 5" : "m6 3 5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* --------------------------------- Sealed --------------------------------- */

function Sealed({ label, span, empty, onOpen }: { label: string; span: Span; empty: boolean; onOpen: () => void }) {
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
        style={{ background: "conic-gradient(from 0deg, var(--accent), #f43f5e, #f59e0b, #22c55e, var(--accent))" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative">
        <motion.div
          className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl border border-line bg-panel-2 text-[40px] shadow-lg"
          animate={{ y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {empty ? "📭" : "✉️"}
        </motion.div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3">Your {SPAN_LABEL[span]} report</p>
        <p className="mt-1 text-[24px] font-bold tracking-tight">{label}</p>
        <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-2">
          {empty
            ? "Nothing was logged in this stretch — there's nothing to judge yet."
            : "Sealed. Your rank, your best and worst, and five things you probably didn't notice."}
        </p>
        {!empty && (
          <motion.div className="mt-6 inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
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
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
              />
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* --------------------------------- Report --------------------------------- */

function ReportView({ report, onReplay, onClose }: { report: Report; onReplay: () => void; onClose: () => void }) {
  const { reading, previous } = report;
  const [effect, setEffect] = useState<"party" | "boo" | null>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (report.good == null) return;
    const t = setTimeout(() => {
      setEffect(report.good ? "party" : "boo");
      if (!report.good) setShake((s) => s + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [report.good]);

  const pillars = reading.pillars.filter((p) => p.score != null) as { key: string; label: string; score: number }[];
  const ladder = [...RANKS].reverse();
  const rankIndex = reading.rank ? ladder.findIndex((r) => r.key === reading.rank!.key) : -1;
  const prevIndex = previous?.rank ? ladder.findIndex((r) => r.key === previous.rank!.key) : null;
  const moved = prevIndex == null || rankIndex < 0 ? 0 : rankIndex - prevIndex;

  return (
    <div className="grid gap-5">
      {effect === "party" && <Confetti onDone={() => setEffect(null)} />}
      {effect === "boo" && <Boos rank={reading.rank?.key ?? "drifting"} onDone={() => setEffect(null)} />}

      {/* Hero: the verdict */}
      <motion.section
        key={shake}
        animate={shake ? { x: [0, -12, 12, -9, 9, -5, 5, 0] } : undefined}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7"
      >
        {reading.rank && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
            style={{ background: reading.rank.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            transition={{ delay: 1.3, duration: 1 }}
          />
        )}
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
          <ScoreRing score={reading.score} color={reading.rank?.color ?? "var(--text-3)"} />
          <div className="min-w-[220px] flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3">This {SPAN_LABEL[report.span]} you were</p>
            {reading.rank ? (
              <>
                <motion.p
                  initial={{ opacity: 0, scale: 0.6, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.3, type: "spring", stiffness: 260, damping: 14 }}
                  className="origin-left text-[40px] font-extrabold leading-tight tracking-tight"
                  style={{ color: reading.rank.color }}
                >
                  {reading.rank.name}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.7 }}
                  className="mt-1 text-[14.5px] text-ink-2"
                >
                  {reading.rank.line}
                  {previous?.rank && moved !== 0 && (
                    <span className="ml-2 font-semibold" style={{ color: moved > 0 ? "var(--up)" : "var(--urgent)" }}>
                      {moved > 0 ? "▲ up" : "▼ down"} from {previous.rank.name}
                    </span>
                  )}
                  {previous?.rank && moved === 0 && <span className="ml-2 text-ink-3">Same as the {SPAN_LABEL[report.span]} before.</span>}
                </motion.p>
              </>
            ) : (
              <p className="mt-1 text-[18px] font-semibold text-ink-2">Not enough to rank — but here&apos;s what happened.</p>
            )}
          </div>
        </div>

        {/* Ladder */}
        {reading.rank && (
          <div className="relative mt-6 grid grid-cols-6 gap-1.5">
            {ladder.map((r, i) => (
              <motion.div
                key={r.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07 }}
                className="text-center"
              >
                <div
                  className="h-1.5 rounded-full"
                  style={{ background: i <= rankIndex ? r.color : "var(--panel-2)", opacity: i === rankIndex ? 1 : i < rankIndex ? 0.45 : 1 }}
                />
                <p
                  className={`mt-1.5 truncate text-[10.5px] ${i === rankIndex ? "font-bold" : "text-ink-3"}`}
                  style={i === rankIndex ? { color: r.color } : undefined}
                >
                  {r.name}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter value={report.total} label="things done" delay={0.3} />
        <Counter value={report.activeDays} label={`active of ${report.days.length} days`} delay={0.4} />
        <Counter value={report.bestRun} label="best run, days" delay={0.5} />
        <Counter value={reading.score ?? 0} label="form score" delay={0.6} suffix="/100" />
      </div>

      {/* Pillars */}
      {pillars.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel px-5 py-5">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Where the score came from</p>
          <div className="grid gap-3">
            {pillars.map((p, i) => (
              <div key={p.key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] font-medium text-ink-2">{p.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: scoreColor(p.score) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.score}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 1, ease: EASE }}
                  />
                </div>
                <span className="nums w-8 text-right text-[13px] font-semibold">{p.score}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Facts */}
      {report.facts.length > 0 && (
        <section>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {report.facts.length} things about you this {SPAN_LABEL[report.span]}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {report.facts.map((f, i) => (
              <FactCard key={f.id} fact={f} n={i + 1} delay={1.9 + i * 0.18} wide={i === 0 && report.facts.length % 2 === 1} />
            ))}
          </div>
        </section>
      )}

      {/* Daily strip */}
      <section className="rounded-2xl border border-line bg-panel px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Day by day</p>
          <div className="flex flex-wrap gap-3">
            {SOURCES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <DailyStack report={report} />
      </section>

      <div className="flex justify-center gap-2 pb-4">
        <Button onClick={onReplay}>Replay</Button>
        <Button variant="ghost" onClick={onClose}>
          Seal it again
        </Button>
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number | null; color: string }) {
  const value = useCount(score ?? 0, 0.1, 1.3);
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative size-[136px] shrink-0">
      <svg viewBox="0 0 136 136" className="size-full -rotate-90">
        <circle cx="68" cy="68" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="11" />
        <motion.circle
          cx="68"
          cy="68"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - (score ?? 0) / 100) }}
          transition={{ delay: 0.1, duration: 1.3, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="nums text-[38px] font-extrabold leading-none" style={{ color }}>
            {score == null ? "–" : Math.round(value)}
          </p>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">form</p>
        </div>
      </div>
    </div>
  );
}

function Counter({ value, label, delay, suffix = "" }: { value: number; label: string; delay: number; suffix?: string }) {
  const v = useCount(value, delay, 1.1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      className="rounded-xl border border-line bg-panel px-4 py-3"
    >
      <p className="nums text-[26px] font-bold leading-tight">
        {Math.round(v)}
        <span className="text-[13px] font-medium text-ink-3">{suffix}</span>
      </p>
      <p className="text-[12px] text-ink-3">{label}</p>
    </motion.div>
  );
}

/* ---------------------------------- Facts --------------------------------- */

function FactCard({ fact, n, delay, wide }: { fact: Fact; n: number; delay: number; wide: boolean }) {
  const color = toneColor(fact.tone);
  return (
    <motion.article
      initial={{ opacity: 0, y: 24, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay, duration: 0.55, ease: EASE }}
      whileHover={{ y: -3 }}
      className={`relative overflow-hidden rounded-2xl border border-line bg-panel px-5 py-4 ${wide ? "md:col-span-2" : ""}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="flex items-start gap-4">
        <motion.span
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[22px]"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.2, type: "spring", stiffness: 300, damping: 12 }}
        >
          {fact.emoji}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
            #{n} · {fact.tone === "good" ? "good at" : fact.tone === "bad" ? "work on" : "worth knowing"}
          </p>
          <h3 className="mt-0.5 text-[16px] font-bold leading-snug">{fact.title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{fact.body}</p>
          {fact.visual && (
            <div className="mt-3">
              <FactVisual v={fact.visual} color={color} delay={delay + 0.3} />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function FactVisual({ v, color, delay }: { v: Visual; color: string; delay: number }) {
  if (v.kind === "ring") return <MiniRing value={v.value} color={color} delay={delay} />;
  if (v.kind === "bars") {
    const max = Math.max(1, ...v.values);
    return (
      <div className="flex h-16 items-end gap-[3px]">
        {v.values.map((x, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-[3px]"
              style={{ background: i === v.highlight ? color : "color-mix(in srgb, var(--text-3) 35%, transparent)" }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(x > 0 ? 8 : 2, (x / max) * 44)}px` }}
              transition={{ delay: delay + i * 0.03, duration: 0.6, ease: EASE }}
            />
            {v.values.length <= 14 && <span className="text-[9.5px] text-ink-3">{v.labels[i]}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (v.kind === "dots") {
    return (
      <div className="flex flex-wrap gap-1">
        {v.hits.map((hit, i) => (
          <motion.span
            key={i}
            className="size-3.5 rounded-full"
            style={{ background: hit ? color : "transparent", boxShadow: hit ? "none" : "inset 0 0 0 1.5px var(--border-strong)" }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + i * 0.04, type: "spring", stiffness: 400, damping: 15 }}
          />
        ))}
      </div>
    );
  }
  if (v.kind === "versus") {
    const max = Math.max(1, v.now, v.before);
    return (
      <div className="grid gap-1.5">
        {[
          { label: v.beforeLabel, value: v.before, c: "color-mix(in srgb, var(--text-3) 45%, transparent)" },
          { label: v.nowLabel, value: v.now, c: color },
        ].map((row, i) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11.5px] text-ink-3">{row.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.c }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ delay: delay + i * 0.15, duration: 0.8, ease: EASE }}
              />
            </div>
            <span className="nums w-8 text-right text-[12px] font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return <Delta value={v.value} unit={v.unit} color={color} delay={delay} />;
}

function MiniRing({ value, color, delay }: { value: number; color: string; delay: number }) {
  const v = useCount(value, delay, 1);
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
        <circle cx="22" cy="22" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="5" />
        <motion.circle
          cx="22"
          cy="22"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - value / 100) }}
          transition={{ delay, duration: 1, ease: EASE }}
        />
      </svg>
      <span className="nums text-[20px] font-bold" style={{ color }}>
        {Math.round(v)}%
      </span>
    </div>
  );
}

function Delta({ value, unit, color, delay }: { value: number; unit: string; color: string; delay: number }) {
  const v = useCount(Math.abs(value), delay, 1);
  return (
    <p className="nums text-[22px] font-bold" style={{ color }}>
      {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
      {v.toFixed(1)} {unit}
    </p>
  );
}

function DailyStack({ report }: { report: Report }) {
  const max = Math.max(1, ...report.days.map((d) => d.total));
  const short = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="flex h-36 items-end gap-1">
      {report.days.map((d, i) => (
        <div key={d.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${d.date}: ${d.total}`}>
          <motion.div
            className="flex w-full flex-col-reverse overflow-hidden rounded-md"
            initial={{ height: 0 }}
            animate={{ height: `${d.total === 0 ? 3 : Math.max(10, (d.total / max) * 108)}px` }}
            transition={{ delay: 0.8 + i * 0.035, duration: 0.7, ease: EASE }}
            style={{ background: d.total === 0 ? "var(--panel-2)" : undefined }}
          >
            {SOURCES.map((s) =>
              d.by[s.key] > 0 ? <div key={s.key} style={{ flex: d.by[s.key], background: s.color }} /> : null,
            )}
          </motion.div>
          <span className="text-[9.5px] text-ink-3">
            {report.days.length <= 14 ? short[new Date(`${d.date}T12:00:00`).getDay()] : new Date(`${d.date}T12:00:00`).getDate()}
          </span>
        </div>
      ))}
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
          style={{ width: p.w, height: p.round ? p.w : p.h, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: p.x[0], y: p.y[0], opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: [1, 1, 0.9] }}
          transition={{ duration: p.duration, delay: p.delay, times: [0, 0.35, 1], ease: ["easeOut", "easeIn"] }}
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
  const pool = rank === "anti" ? ["👎", "💀", "👎", "🥀", "👎"] : rank === "slump" ? ["👎", "🥶", "👎", "😬", "👎"] : ["👎", "😐", "👎", "🥱", "👎"];
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
        style={{ background: "radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--urgent) 35%, transparent), transparent 60%)" }}
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
        <p className="text-[12.5px] text-ink-3">Read the weak spot below and flip it next time.</p>
      </motion.div>
    </div>,
    document.body,
  );
}
