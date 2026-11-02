"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { upcoming, Upcoming } from "@/lib/calendar";
import { appliesOn } from "@/lib/habits";
import { formatDate, todayISO } from "@/lib/dates";
import { IMPORTANT_KIND_LABEL } from "@/lib/types";
import { progressOf } from "@/lib/goals/tracker";
import { useGoalReadings } from "@/lib/goals/judge";
import { productivity } from "@/lib/productivity";
import { habitPatterns } from "@/lib/consistency";
import { Flame } from "../Flame";

/*
  The right-hand rail: things to know, not things to do. Modelled on the
  summary screens of health and fitness apps — a few small widgets you read in
  a glance, each opening the page with the detail, rather than full-size cards
  competing with the day's work for attention.
*/

/** Colour by how close it is: late and today red, this week amber, later calm. */
function heat(days: number): string {
  if (days <= 2) return "var(--urgent)";
  if (days <= 7) return "var(--high)";
  if (days <= 21) return "var(--medium)";
  return "var(--accent)";
}

const R = 14;
const C = 2 * Math.PI * R;

/**
 * Deadlines, goal dates and important days, merged into one short list.
 *
 * Two rows of large countdown cards became one list of six lines — the way a
 * calendar widget shows what is coming. Each keeps the ring from the old cards,
 * shrunk to a badge: the number of days inside, the share of the run-up already
 * spent around it.
 */
export function ComingUp() {
  const store = useStore();
  const today = todayISO();
  const items = useMemo(() => {
    // Today's tasks are already the list on the left; repeating them here as
    // "now" spent half the widget saying the same thing twice.
    const deadlines = upcoming(store, today, { layers: ["task", "goal"], limit: 12, within: 120 })
      .filter((u) => u.kind !== "task" || u.daysLeft > 0)
      .slice(0, 4);
    /*
      Important days get their own two places. Sorted in with everything else,
      a busy week of homework pushed a birthday or an exam a fortnight out off
      the bottom — which is the one thing a "coming up" list must not do.
    */
    const days = upcoming(store, today, { layers: ["day"], limit: 2, within: 400 });
    return [...deadlines, ...days].sort((a, b) => a.daysLeft - b.daysLeft);
  }, [store, today]);

  return (
    <Widget title="Coming up" href="/plan?view=month" link="Calendar">
      {items.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-ink-3">Nothing on the horizon.</p>
      ) : (
        <ul>
          {items.map((u) => (
            <li key={`${u.kind}-${u.id}`}>
              <Link
                href={hrefFor(u)}
                className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-panel-2"
              >
                <Badge days={u.daysLeft} elapsed={u.elapsed} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{u.label}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {kindLabel(u)} · {formatDate(u.date)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

function Badge({ days, elapsed }: { days: number; elapsed?: number }) {
  const tone = heat(days);
  return (
    <span className="relative grid size-[34px] shrink-0 place-items-center" style={{ color: tone }}>
      <svg viewBox="0 0 34 34" aria-hidden className="absolute inset-0 -rotate-90">
        <circle cx="17" cy="17" r={R} fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.16" />
        {elapsed != null && (
          <circle
            cx="17"
            cy="17"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - elapsed)}
          />
        )}
      </svg>
      <span className={`nums relative font-bold leading-none ${days === 0 ? "text-[8.5px]" : "text-[11.5px]"}`}>
        {days === 0 ? "today" : `${days}d`}
      </span>
    </span>
  );
}

function hrefFor(u: Upcoming): string {
  if (u.kind === "goal") return "/goals";
  if (u.kind === "day") return "/plan?view=month";
  return "/tasks?view=upcoming";
}

function kindLabel(u: Upcoming): string {
  if (u.kind === "goal") return "Goal";
  if (u.kind === "day") return IMPORTANT_KIND_LABEL[u.dayKind ?? "other"];
  return "Task";
}

/** Active goals as compact rows: picture, name, bar. */
export function GoalsCompact() {
  const store = useStore();
  // Keeps journal-read goals current from the dashboard too; a no-op when fresh.
  useGoalReadings();
  const goals = useMemo(
    () =>
      store.goals
        .filter((g) => g.status === "active")
        .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.position - b.position)
        .slice(0, 4),
    [store.goals],
  );
  if (goals.length === 0) return null;

  return (
    <Widget title="Goals" href="/goals" link="All">
      <ul className="grid gap-1">
        {goals.map((g) => {
          const { value } = progressOf(g, store);
          return (
            <li key={g.id}>
              <Link href="/goals" className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-panel-2">
                {g.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.image} alt="" className="size-[34px] shrink-0 rounded-lg object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-[34px] shrink-0 place-items-center rounded-lg text-[14px]"
                    style={{
                      background: `color-mix(in srgb, var(--${g.priority}) 14%, transparent)`,
                      color: `var(--${g.priority})`,
                    }}
                  >
                    ◎
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{g.title}</span>
                  {value != null ? (
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
                      </span>
                      <span className="nums text-[11px] text-ink-3">{value}%</span>
                    </span>
                  ) : (
                    <span className="block text-[11.5px] text-ink-3">No progress tracked</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

/** Three numbers about the week, each opening the page that explains it. */
export function WeekGlance() {
  const store = useStore();
  const today = todayISO();
  const score = useMemo(() => productivity(store), [store]);
  const kept = useMemo(() => {
    let k = 0;
    let n = 0;
    for (const h of habitPatterns(store, today)) {
      if (h.recent == null) continue;
      const due = h.due / 2;
      k += h.recent * due;
      n += due;
    }
    return n === 0 ? null : Math.round((k / n) * 100);
  }, [store, today]);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile href="/progress" label="day streak">
        <span className="inline-flex items-center gap-1">
          {score.streak}
          {score.streak > 0 && <Flame streak={score.streak} />}
        </span>
      </Tile>
      <Tile href="/recommendations" label="habits kept">
        {kept == null ? "—" : `${kept}%`}
      </Tile>
      <Tile href="/recommendations" label="consistency">
        {score.score ?? "—"}
      </Tile>
    </div>
  );
}

function Tile({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-panel px-3 py-2.5 transition-colors hover:bg-panel-2"
    >
      <span className="nums block text-[20px] font-bold leading-none tracking-tight">{children}</span>
      <span className="mt-1 block text-[11.5px] text-ink-3">{label}</span>
    </Link>
  );
}

/**
 * How much of today is done, as one ring — the activity-ring idea.
 *
 * Tasks due today, scheduled blocks and habits due today, together. One number
 * for "how is today going" is what someone glancing at the page between
 * lessons actually wants, and it moves as they tick things anywhere.
 */
export function TodayRing() {
  const store = useStore();
  const today = todayISO();

  const tasks = store.tasks.filter((t) => t.dueDate === today);
  const plan = store.plan.filter((p) => p.date === today);
  const habits = store.habits.filter((h) => h.archivedAt == null && appliesOn(h, today));
  const ticked = store.days.find((d) => d.date === today)?.habitsDone ?? [];

  const total = tasks.length + plan.length + habits.length;
  if (total === 0) return null;
  const done =
    tasks.filter((t) => t.status === "completed").length +
    plan.filter((p) => p.done).length +
    habits.filter((h) => ticked.includes(h.id)).length;
  const share = done / total;
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-3" title={`${done} of ${total} things done today`}>
      <span className="relative grid size-[64px] place-items-center text-accent">
        <svg viewBox="0 0 64 64" aria-hidden className="absolute inset-0 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" opacity="0.14" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - share)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="nums relative text-[14px] font-bold text-ink">
          {done}/{total}
        </span>
      </span>
      <span className="hidden text-[12.5px] leading-tight text-ink-3 sm:block">
        done
        <br />
        today
      </span>
    </div>
  );
}

function Widget({
  title,
  href,
  link,
  children,
}: {
  title: string;
  href: string;
  link: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        <Link href={href} className="text-[12.5px] text-ink-3 hover:text-ink">
          {link}
        </Link>
      </div>
      <div className="rounded-xl border border-line bg-panel p-1.5">{children}</div>
    </section>
  );
}
