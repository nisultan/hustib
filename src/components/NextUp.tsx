"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { upcoming, Upcoming } from "@/lib/calendar";
import { formatDate, todayISO } from "@/lib/dates";
import { IMPORTANT_KIND_GLYPH, IMPORTANT_KIND_LABEL, Task } from "@/lib/types";
import { SectionTitle } from "./ui";

/**
 * What is closest, at the top of the dashboard.
 *
 * Deadlines and important days are kept apart rather than merged into one
 * sorted list. They are different kinds of fact: a deadline is work that can
 * be brought forward, finished early, or dropped, while an exam or a birthday
 * simply arrives. Merging them also means a busy week of tasks pushes the SAT
 * off the bottom, which is the one thing this is meant to prevent.
 *
 * Both rows are counts of days rather than dates. "In 3 days" is the question
 * someone is actually asking; "22 Sep" makes them do the arithmetic.
 */

const MAX_PER_ROW = 4;

export function NextUp() {
  const store = useStore();
  const today = todayISO();

  const deadlines = useMemo(
    () =>
      upcoming(store, today, { layers: ["task", "university", "goal"], limit: MAX_PER_ROW }),
    [store, today],
  );

  const days = useMemo(
    () => upcoming(store, today, { layers: ["day"], limit: MAX_PER_ROW, within: 400 }),
    [store, today],
  );

  // Overdue work gets its own block rather than a slot in the row beside
  // things that are merely close. A deadline that has passed is a different
  // problem — it is not "how long have I got", it is "this is already late" —
  // and letting it take a countdown slot pushed real upcoming work off the
  // end of the row.
  const overdue = useMemo(
    () =>
      store.tasks
        .filter((t) => t.status !== "completed" && t.dueDate != null && t.dueDate < today)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, MAX_PER_ROW),
    [store.tasks, today],
  );

  if (!store.ready) return null;
  if (deadlines.length === 0 && days.length === 0 && overdue.length === 0) return null;

  return (
    <div className="mb-8 grid gap-6">
      {overdue.length > 0 && <Overdue tasks={overdue} today={today} />}

      {deadlines.length > 0 && (
        <section>
          <SectionTitle
            right={
              <Link href="/tasks?view=upcoming" className="text-xs text-ink-3 hover:text-ink">
                All
              </Link>
            }
          >
            Closest deadlines
          </SectionTitle>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {deadlines.map((entry) => (
              <Card
                key={`${entry.kind}-${entry.id}`}
                href={hrefFor(entry)}
                label={entry.label}
                detail={`${kindLabel(entry)} · ${formatDate(entry.date)}`}
                days={entry.daysLeft}
                tone={`var(--${entry.priority})`}
              />
            ))}
          </div>
        </section>
      )}

      {days.length > 0 && (
        <section>
          <SectionTitle
            right={
              <Link href="/plan?view=month" className="text-xs text-ink-3 hover:text-ink">
                Calendar
              </Link>
            }
          >
            Important days
          </SectionTitle>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {days.map((entry) => (
              <Card
                key={entry.id}
                href="/plan?view=month"
                label={entry.label}
                detail={[
                  IMPORTANT_KIND_LABEL[entry.dayKind ?? "other"],
                  entry.year ? `turns ${entry.year}` : null,
                  formatDate(entry.date),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                days={entry.daysLeft}
                tone="var(--accent)"
                glyph={IMPORTANT_KIND_GLYPH[entry.dayKind ?? "other"]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Work whose deadline has already gone.
 *
 * A list rather than countdown cards, because the number is no longer the
 * useful part — how many days late something is changes nothing about what to
 * do with it. What matters is the choice, so each row offers the two that
 * exist: finish it, or let it go. Clearing one is not deleting it; the task
 * keeps its place in the list, it just stops being late at you.
 */
function Overdue({ tasks, today }: { tasks: Task[]; today: string }) {
  const store = useStore();

  return (
    <section>
      <SectionTitle
        right={
          <Link href="/tasks?view=all" className="text-xs text-ink-3 hover:text-ink">
            All
          </Link>
        }
      >
        <span style={{ color: "var(--urgent)" }}>Overdue · {tasks.length}</span>
      </SectionTitle>

      <div
        className="overflow-hidden rounded-xl border bg-panel shadow-[var(--shadow),var(--edge)]"
        style={{ borderColor: "color-mix(in srgb, var(--urgent) 35%, var(--border))" }}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
          >
            <span
              className="nums w-16 shrink-0 text-xs font-semibold"
              style={{ color: "var(--urgent)" }}
            >
              {Math.abs(daysBetween(today, task.dueDate as string))}d late
            </span>

            <span className="min-w-0 flex-1 truncate text-[13px]">{task.title}</span>

            <button
              onClick={() => store.toggleTask(task.id)}
              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
            >
              Done
            </button>
            <button
              onClick={() => store.updateTask(task.id, { dueDate: today })}
              title="Move it to today and deal with it"
              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
            >
              Today
            </button>
            <button
              onClick={() => store.updateTask(task.id, { dueDate: null })}
              title="Keep the task, drop the deadline"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-3 transition-colors hover:text-ink"
            >
              Clear
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One countdown.
 *
 * The number leads, at a size you can read without stopping, because the count
 * is the reason the card exists — everything else on it is there to say what
 * the number is about.
 */
function Card({
  href,
  label,
  detail,
  days,
  tone,
  glyph,
}: {
  href: string;
  label: string;
  detail: string;
  days: number;
  tone: string;
  glyph?: string;
}) {
  const overdue = days < 0;

  return (
    <Link
      href={href}
      title={`${label} — ${detail}`}
      className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow),var(--edge)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-md),var(--edge)]"
      style={{ borderLeft: `3px solid ${tone}` }}
    >
      <div className="min-w-[46px] shrink-0">
        <p
          className="nums text-xl font-semibold leading-none tracking-tight"
          style={{ color: tone }}
        >
          {count(days)}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-3">{unit(days)}</p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-snug">
          {glyph && (
            <span aria-hidden className="mr-1 text-ink-3">
              {glyph}
            </span>
          )}
          {label}
        </p>
        <p
          className="truncate text-[11px] text-ink-3"
          style={overdue ? { color: "var(--urgent)" } : undefined}
        >
          {detail}
        </p>
      </div>
    </Link>
  );
}

/** Today reads as a word, not as a zero. */
function count(days: number): string {
  if (days === 0) return "Today";
  return String(Math.abs(days));
}

function unit(days: number): string {
  if (days === 0) return "";
  if (days < 0) return Math.abs(days) === 1 ? "day over" : "days over";
  return days === 1 ? "day" : "days";
}

function kindLabel(entry: Upcoming): string {
  if (entry.kind === "university") return "Application";
  if (entry.kind === "goal") return "Goal";
  return "Task";
}

function hrefFor(entry: Upcoming): string {
  if (entry.kind === "university") return "/universities";
  if (entry.kind === "goal") return "/goals";
  return "/tasks?view=upcoming";
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000,
  );
}
