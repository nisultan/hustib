"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { todayISO } from "@/lib/dates";
import { period, Span } from "@/lib/report";

/**
 * How long until the next report opens, to the second.
 *
 * A report unlocks at 00:00 on its day — Sunday for the week, the last day of
 * the month for the month — and stays open that whole day.
 */

export function unlockAt(span: Span, today = todayISO()): { at: Date; open: boolean } {
  const day = period(span, 0, today).to;
  return { at: new Date(`${day}T00:00:00`), open: day === today };
}

/** Ticks once a second, aligned to the wall clock. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(t);
  }, []);
  return now;
}

export function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** One digit group that flips when it changes. */
function Unit({ value, label, big }: { value: number; label: string; big: boolean }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        className={`nums relative overflow-hidden rounded-lg border border-line bg-panel-2 text-center font-extrabold tabular-nums ${
          big ? "h-14 w-14 text-[28px] leading-[56px]" : "h-9 w-9 text-[17px] leading-9"
        }`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className="block"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className={`mt-1 font-semibold uppercase tracking-wider text-ink-3 ${big ? "text-[10px]" : "text-[9px]"}`}>{label}</span>
    </div>
  );
}

export function TimeLeft({ ms, big = false }: { ms: number; big?: boolean }) {
  const t = split(ms);
  const sep = <span className={`pb-4 font-bold text-ink-3 ${big ? "text-[22px]" : "text-[14px]"}`}>:</span>;
  return (
    <div className={`flex items-center ${big ? "gap-2" : "gap-1"}`} role="timer" aria-label={`${t.d} days ${t.h} hours ${t.m} minutes ${t.s} seconds`}>
      <Unit value={t.d} label="days" big={big} />
      {sep}
      <Unit value={t.h} label="hrs" big={big} />
      {sep}
      <Unit value={t.m} label="min" big={big} />
      {sep}
      <Unit value={t.s} label="sec" big={big} />
    </div>
  );
}

/** Both timers side by side — on home and atop the report page. */
export function ReportTimers({ linked = true }: { linked?: boolean }) {
  const now = useNow();
  const today = todayISO();
  const rows: { span: Span; label: string }[] = [
    { span: "week", label: "Weekly report" },
    { span: "month", label: "Monthly report" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(({ span, label }) => {
        const { at, open } = unlockAt(span, today);
        const body = (
          <div
            className={`flex h-full items-center justify-between gap-3 rounded-xl border bg-panel px-4 py-3 transition-colors ${
              open ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]" : "border-line"
            } ${linked ? "hover:border-line-strong" : ""}`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold">
                {open ? (
                  <span className="text-accent-text">Open now — today only</span>
                ) : (
                  <span className="text-ink-2">
                    unlocks {span === "week" ? "Sunday" : at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </p>
            </div>
            {open ? (
              <motion.span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                  <path d="m7 4.5 6 5.5-6 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.span>
            ) : (
              <TimeLeft ms={at.getTime() - now} />
            )}
          </div>
        );
        return linked ? (
          <Link key={span} href="/report" className="block">
            {body}
          </Link>
        ) : (
          <div key={span}>{body}</div>
        );
      })}
    </div>
  );
}
