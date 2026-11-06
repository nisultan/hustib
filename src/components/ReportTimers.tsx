"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
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

/**
 * One digit group that rolls when it changes. Both numbers are stacked
 * absolutely in a fixed box, so the roll never shifts the layout.
 */
function Unit({ value, label, big }: { value: number; label: string; big: boolean }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        className={`nums relative overflow-hidden rounded-lg border border-line bg-panel-2 font-extrabold tabular-nums ${
          big ? "h-14 w-14 text-[28px]" : "h-9 w-9 text-[17px]"
        }`}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={text}
            className="absolute inset-0 grid place-items-center"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
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

/** One small rolling box with its unit letter after it. */
function Mini({ value, unit }: { value: number; unit: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <span className="flex items-baseline gap-0.5">
      <span className="nums relative inline-block h-7 w-7 overflow-hidden rounded-md border border-line bg-panel-2 text-[13px] font-bold tabular-nums">
        <AnimatePresence initial={false}>
          <motion.span
            key={text}
            className="absolute inset-0 grid place-items-center"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-[10px] font-semibold text-ink-3">{unit}</span>
    </span>
  );
}

export function TimeLeft({ ms, big = false, compact = false }: { ms: number; big?: boolean; compact?: boolean }) {
  const t = split(ms);
  if (compact) {
    return (
      <div className="flex items-center gap-1.5" role="timer" aria-label={`${t.d} days ${t.h} hours ${t.m} minutes ${t.s} seconds`}>
        <Mini value={t.d} unit="d" />
        <Mini value={t.h} unit="h" />
        <Mini value={t.m} unit="m" />
        <Mini value={t.s} unit="s" />
      </div>
    );
  }
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

/* ------------------------------ Mixed timers ------------------------------ */

interface Countdown {
  id: string;
  kicker: string;
  title: string;
  at: Date;
  href: string;
  /** Shown instead of the clock once it has arrived (e.g. a report day). */
  live?: string;
  color: string;
}

function nextYearly(date: string, today: string): string {
  const [, m, d] = date.split("-");
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${y + 1}-${m}-${d}`;
}

/** Everything worth counting down to, from the reports to real deadlines. */
export function countdowns(data: AppData, today = todayISO()): Countdown[] {
  const out: Countdown[] = [];
  const week = unlockAt("week", today);
  const month = unlockAt("month", today);
  out.push({ id: "r-week", kicker: "Weekly report", title: week.open ? "Open now — today only" : "unlocks Sunday", at: week.at, href: "/report", live: week.open ? "open" : undefined, color: "var(--accent)" });
  out.push({
    id: "r-month",
    kicker: "Monthly report",
    title: month.open ? "Open now — today only" : `unlocks ${month.at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    at: month.at,
    href: "/report",
    live: month.open ? "open" : undefined,
    color: "var(--accent)",
  });

  const horizon = addDays(today, 21);
  for (const t of data.tasks) {
    if (t.status === "completed" || !t.dueDate || t.dueDate < today || t.dueDate > horizon) continue;
    const at = new Date(`${t.dueDate}T${t.dueTime ?? "23:59"}:00`);
    if (at.getTime() < Date.now()) continue;
    out.push({
      id: `t-${t.id}`,
      kicker: `Task · ${t.priority}`,
      title: t.title,
      at,
      href: "/tasks",
      color: t.priority === "urgent" ? "var(--urgent)" : t.priority === "high" ? "var(--high)" : "var(--medium)",
    });
  }

  for (const d of data.importantDays) {
    const day = d.repeatsYearly ? nextYearly(d.date, today) : d.date;
    if (day <= today || day > addDays(today, 99)) continue;
    out.push({
      id: `d-${d.id}`,
      kicker: d.kind === "other" ? "Important day" : d.kind[0].toUpperCase() + d.kind.slice(1),
      title: d.title,
      at: new Date(`${day}T00:00:00`),
      href: "/plan",
      color: d.kind === "exam" ? "var(--urgent)" : d.kind === "birthday" ? "#e879f9" : "var(--up)",
    });
  }
  return out;
}

/**
 * Two countdowns on the home page, a different pair each visit: one of the
 * reports, deadlines and important days you have coming. A deadline inside
 * the next day always gets a slot — that one is not a surprise you want.
 */
export function MixedTimers() {
  const store = useStore();
  const now = useNow();
  const [seed] = useState(() => Math.random());
  const all = useMemo(() => countdowns(store), [store]);

  const picks = useMemo(() => {
    const rand = (i: number) => {
      const x = Math.sin((seed * 1000 + i) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const shuffled = all.map((c, i) => ({ c, r: rand(i) })).sort((a, b) => a.r - b.r).map((x) => x.c);
    const urgent = all.find((c) => c.id.startsWith("t-") && c.at.getTime() - Date.now() < 86_400_000);
    const open = all.find((c) => c.live);
    const first = urgent ?? open;
    const rest = shuffled.filter((c) => c !== first);
    return (first ? [first, ...rest] : rest).slice(0, 2);
    // Re-deal only per visit, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.length, seed]);

  if (!store.ready || picks.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {picks.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }}>
          <Link href={c.href} className="block h-full">
            <div className="relative flex h-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-line bg-panel px-3.5 py-2 transition-colors hover:border-line-strong">
              <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="truncate">
                  {c.id.startsWith("t-") ? (
                    c.title
                  ) : c.id.startsWith("r-") ? (
                    <>
                      {c.kicker} <span className="font-normal text-ink-3">· {c.title}</span>
                    </>
                  ) : (
                    <>
                      {c.title} <span className="font-normal text-ink-3">· {c.kicker}</span>
                    </>
                  )}
                </span>
              </p>
              {c.live ? (
                <motion.span
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-white"
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                    <path d="m7 4.5 6 5.5-6 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              ) : (
                <div className="shrink-0">
                  <TimeLeft ms={c.at.getTime() - now} compact />
                </div>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
