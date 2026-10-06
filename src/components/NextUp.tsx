"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { upcoming, Upcoming } from "@/lib/calendar";
import { formatDate, todayISO } from "@/lib/dates";
import { IMPORTANT_KIND_GLYPH, IMPORTANT_KIND_LABEL, Priority, Task } from "@/lib/types";
import { PriorityDot, SectionTitle } from "./ui";

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

/**
 * How to lay a row of countdowns out, given how many there are.
 *
 * A fixed four columns was the whole problem: one deadline drew a card in a
 * quarter of the row and three quarters of nothing. Few cards go wide, many
 * cards share — so the row is full either way, and a lonely card reads as the
 * only thing coming up rather than as a layout that gave up.
 */
function rowGrid(count: number, paired: boolean): string {
  const base = "grid items-stretch gap-2.5";
  if (paired) return count > 2 ? `${base} sm:grid-cols-2` : base;
  return count > 2 ? `${base} sm:grid-cols-2 xl:grid-cols-4` : `${base} sm:grid-cols-2`;
}

export function NextUp() {
  const store = useStore();
  const today = todayISO();

  const deadlines = useMemo(
    () =>
      upcoming(store, today, { layers: ["task", "goal"], limit: MAX_PER_ROW }),
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

  /*
    Side by side when there is something in both.

    Full-width rows of four columns each were right for a student mid-term with
    a dozen deadlines, and wrong for everyone else: one goal and two birthdays
    drew two headings stacked down the page, each with a card or two adrift in
    three quarters of empty row, and the "All" link stranded a screen away from
    the thing it belonged to. Paired, the same three cards fill the width and
    each heading sits over its own column.
  */
  const paired = deadlines.length > 0 && days.length > 0;

  return (
    <div className="mb-8 grid gap-6">
      {overdue.length > 0 && <Overdue tasks={overdue} today={today} />}

      <div className={`grid gap-6 ${paired ? "lg:grid-cols-2" : ""}`}>
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

          <div className={rowGrid(deadlines.length, paired)}>
            {deadlines.map((entry) => (
              <Card
                key={`${entry.kind}-${entry.id}`}
                href={hrefFor(entry)}
                label={entry.label}
                detail={`${kindLabel(entry)} · ${formatDate(entry.date)}`}
                days={entry.daysLeft}
                elapsed={entry.elapsed}
                priority={entry.priority}
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

          <div className={rowGrid(days.length, paired)}>
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
                elapsed={entry.elapsed}
                glyph={IMPORTANT_KIND_GLYPH[entry.dayKind ?? "other"]}
              />
            ))}
          </div>
        </section>
      )}
      </div>
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
 * The number is drawn inside a ring, and the ring is the point. "35 days" on
 * its own is a fact with no scale attached: thirty-five days into a six-week
 * goal is nearly out of time, and thirty-five days of a year is barely
 * started. The ring fills with the share of the run-up already spent, so the
 * card answers "how am I doing against this" and not merely "when is it".
 *
 * Colour runs off urgency rather than priority. A row of these should be
 * legible as a shape before any of it is read as words, and the shape worth
 * seeing is which things are close — a low-priority thing due tomorrow still
 * needs doing tomorrow. Priority has not been dropped; it moved to the dot
 * beside the title, where it is information rather than the loudest signal.
 */
function Card({
  href,
  label,
  detail,
  days,
  elapsed,
  priority,
  glyph,
}: {
  href: string;
  label: string;
  detail: string;
  days: number;
  /** 0-1, or undefined when there is no start date to measure from. */
  elapsed?: number;
  /** Omitted for important days, which are not work and have no priority. */
  priority?: Priority;
  glyph?: string;
}) {
  const tone = heat(days);
  const overdue = days < 0;
  const today = days === 0;

  return (
    <Link
      href={href}
      title={`${label} — ${detail}`}
      className="group relative flex h-full items-center gap-3.5 overflow-hidden rounded-xl border border-line bg-panel p-3.5 shadow-[var(--shadow),var(--edge)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md),var(--edge)]"
    >
      {/* A wash bleeding in from the dial, so the card itself carries some of
          the urgency instead of leaving it all to a badge in the corner. It
          is barely there on a distant date and unmistakable on a late one. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120px 80px at 0% 50%, color-mix(in srgb, ${tone} ${
            overdue || today ? 16 : 9
          }%, transparent), transparent 70%)`,
        }}
      />

      <Dial days={days} elapsed={elapsed} tone={tone} />

      <span className="relative flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          {priority && <PriorityDot priority={priority} />}
          <span className="line-clamp-2 text-[13px] font-medium leading-snug">
            {glyph && (
              <span aria-hidden className="mr-1 text-ink-3">
                {glyph}
              </span>
            )}
            {label}
          </span>
        </span>
        <span
          className="truncate text-[11px] text-ink-3"
          style={overdue ? { color: tone } : undefined}
        >
          {detail}
        </span>
      </span>
    </Link>
  );
}

/** Ring geometry, in the SVG's own units. */
const R = 20;
const C = 2 * Math.PI * R;

/**
 * The number, and the ring around it.
 *
 * Drawn as an arc rather than a bar because it has to sit around the figure it
 * belongs to — a bar underneath would be a second thing to read, and the whole
 * point is that one glance gets both. The track stays visible under the arc so
 * a nearly-empty ring still reads as a ring rather than as a stray mark.
 */
function Dial({ days, elapsed, tone }: { days: number; elapsed?: number; tone: string }) {
  const today = days === 0;
  const spent = elapsed ?? 0;

  return (
    <span aria-hidden className="relative grid size-[54px] shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" stroke={tone} strokeWidth="3" opacity="0.14" />
        {elapsed != null && (
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke={tone}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - spent)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>

      <span
        className="relative grid place-items-center text-center leading-none"
        style={{ color: tone }}
      >
        {today ? (
          <span className="text-[11px] font-semibold uppercase tracking-wide">Today</span>
        ) : (
          <>
            <span className="nums text-[19px] font-semibold tracking-tight">
              {Math.abs(days)}
            </span>
            <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wider opacity-70">
              {unit(days)}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * Colour by how close it is, not by how important someone said it was.
 *
 * The thresholds are deliberately uneven. The difference between tomorrow and
 * next week is enormous; the difference between seven weeks and eight is not,
 * and giving those the same spread would make everything beyond a fortnight
 * look identically urgent.
 */
function heat(days: number): string {
  if (days < 0) return "var(--urgent)";
  if (days <= 2) return "var(--urgent)";
  if (days <= 7) return "var(--high)";
  if (days <= 21) return "var(--medium)";
  return "var(--accent)";
}

/** Two lines of badge, so "days over" has to become one short word. */
function unit(days: number): string {
  if (days < 0) return "late";
  return days === 1 ? "day" : "days";
}

function kindLabel(entry: Upcoming): string {
  if (entry.kind === "goal") return "Goal";
  return "Task";
}

function hrefFor(entry: Upcoming): string {
  if (entry.kind === "goal") return "/goals";
  return "/tasks?view=upcoming";
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000,
  );
}
