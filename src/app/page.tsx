"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommendations";
import {
  countdownLabel,
  daysUntil,
  formatDate,
  formatTime,
  greeting,
  relativeLabel,
  todayISO,
} from "@/lib/dates";
import { Panel, SectionTitle, EmptyState, Button } from "@/components/ui";
import { NextUp } from "@/components/NextUp";
import { TodayPanel } from "@/components/TodayPanel";
import { GoalsStrip } from "@/components/GoalsStrip";
import { HabitStreaks } from "@/components/HabitStreaks";
import { Spark } from "@/components/Spark";
import { Productivity } from "@/components/Productivity";
import { productivity } from "@/lib/productivity";
import { appliesOn } from "@/lib/habits";
import { TaskList, sortTasks } from "@/components/TaskItem";
import { AddTaskButton } from "@/components/TaskDialog";
import { openTour } from "@/components/Tour";

export default function HomePage() {
  const store = useStore();
  const today = todayISO();

  const open = useMemo(
    () => store.tasks.filter((t) => t.status !== "completed"),
    [store.tasks],
  );

  /*
    Strictly today. Overdue work used to be folded in here so it could not be
    missed, but it now has its own block above with its own choices — leaving
    it in both places listed the same task twice and made "3 due today" a
    number that was not true.
  */
  const todayTasks = useMemo(() => open.filter((t) => t.dueDate === today), [open, today]);

  const upcoming = useMemo(
    () => sortTasks(open.filter((t) => t.dueDate != null && t.dueDate > today)).slice(0, 5),
    [open, today],
  );

  const recs = useMemo(() => recommend(store, 3), [store]);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const overdueCount = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0).length;

  /*
    One line about right now, assembled in order of what would actually change
    someone's next hour. The same greeting every day is furniture; this is the
    only part of the header worth reading twice.
  */
  const streak = productivity(store).streak;
  const dueToday = todayTasks.length;
  const summary = (() => {
    const bits: string[] = [];
    if (overdueCount > 0) {
      bits.push(`${overdueCount} overdue`);
    } else if (dueToday > 0) {
      bits.push(`${dueToday} due today`);
    }

    const next = store.plan
      .filter((p) => p.date === today && !p.done && p.start != null)
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];
    if (next) bits.push(`next up ${formatTime(next.start as string)} — ${next.title}`);

    if (streak > 1) bits.push(`${streak}-day streak`);

    if (bits.length === 0) {
      /*
        Habits count as something on your plate.

        "Nothing on your plate" was printed over a list of six unticked habits,
        because the line only ever looked at tasks. A dashboard that contradicts
        the thing directly beneath it is worse than one that says nothing.
      */
      const left = habitsLeft(store, today);
      if (left > 0) return `${left} habit${left === 1 ? "" : "s"} left today.`;
      return open.length === 0
        ? "Nothing on your plate. Add what's coming up."
        : "Nothing pressing today.";
    }
    // Sentence case, since the first fragment starts the sentence.
    return bits.join(" · ").replace(/^./, (c) => c.toUpperCase());
  })();

  return (
    <div className="page-in">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {store.profile.name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-ink-2">{summary}</p>
        <Spark />
      </header>

      {/*
        Two columns, and which side a thing goes on is the whole argument.

        The left is today: what is late, what is close, what is planned, what
        is left to tick. The right is the longer run — goals, how steadily the
        last fortnight went, what the hub makes of it all. Someone opening this
        between lessons reads the left column and closes it; someone opening it
        on a Sunday reads the right.

        Stacked on narrow screens in that same order, so the phone gets the
        urgent half first.
      */}
      <div className="grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
        <div className="grid min-w-0 gap-8">
          <NextUp />
          <TodayPanel />

          <section>
            <SectionTitle
              right={<span className="text-xs text-ink-3">{todayTasks.length} due</span>}
            >
              Due today
            </SectionTitle>
            <TaskList
              tasks={todayTasks}
              empty={
                <EmptyState
                  title="Nothing due today"
                  hint="Either you're ahead, or today's work isn't captured yet."
                  action={<AddTaskButton variant="secondary" />}
                />
              }
            />
          </section>

          <section>
            <SectionTitle
              right={
                <Link href="/tasks?view=upcoming" className="text-xs text-ink-3 hover:text-ink">
                  All
                </Link>
              }
            >
              Upcoming
            </SectionTitle>
            {upcoming.length === 0 ? (
              <Panel className="px-3.5 py-6 text-center text-sm text-ink-3">
                No future deadlines yet.
              </Panel>
            ) : (
              <Panel>
                {upcoming.map((t) => {
                  const course = store.courses.find((c) => c.id === t.courseId);
                  return (
                    <div
                      key={t.id}
                      className="flex items-baseline gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
                    >
                      <span className="nums w-10 shrink-0 text-xs font-semibold text-ink-2">
                        {daysUntil(t.dueDate as string)}d
                      </span>
                      <span className="hidden w-20 shrink-0 text-xs text-ink-3 sm:block">
                        {relativeLabel(t.dueDate as string)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                      {course && (
                        <span className="hidden shrink-0 text-xs text-ink-3 sm:block">
                          {course.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Panel>
            )}
          </section>
        </div>

        <div className="grid min-w-0 gap-8">
          <GoalsStrip />
          <Productivity compact />
          <HabitStreaks />

          {recs.length > 0 && (
            <section>
              <SectionTitle
                right={
                  <Link href="/recommendations" className="text-xs text-ink-3 hover:text-ink">
                    All
                  </Link>
                }
              >
                Recommended for you
              </SectionTitle>
              <div className="grid gap-2">
                {recs.map((r) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    className="flex items-start gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-3 text-sm shadow-[var(--shadow)] transition-colors hover:border-line-strong"
                  >
                    <span aria-hidden className="mt-px">
                      💡
                    </span>
                    <span className="text-ink-2">{r.text}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {store.courses.length === 0 && (
        <Panel className="mt-8 px-5 py-5">
          <h2 className="text-sm font-semibold">Start here</h2>
          <p className="mt-1 text-sm text-ink-2">
            Add your courses first — tasks and grades hang off them, and the dashboard needs
            them to tell you what to focus on.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/courses">
              <Button variant="primary">Add courses</Button>
            </Link>
            <Button onClick={openTour}>Take the tour</Button>
            <Button variant="ghost" onClick={() => store.resetToSample()}>
              Load sample data
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Habits that apply today and have not been ticked yet. */
function habitsLeft(store: ReturnType<typeof useStore>, today: string): number {
  const done = store.days.find((d) => d.date === today)?.habitsDone ?? [];
  return store.habits.filter(
    (h) => h.archivedAt == null && appliesOn(h, today) && !done.includes(h.id),
  ).length;
}
