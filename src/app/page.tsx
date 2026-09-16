"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { courseAverage, overallAverage, trend } from "@/lib/grades";
import { recommend, nextUniDeadline } from "@/lib/recommendations";
import {
  countdownLabel,
  daysUntil,
  formatDate,
  greeting,
  relativeLabel,
  todayISO,
} from "@/lib/dates";
import { UNI_PRIORITIES, UNI_PRIORITY_LABEL } from "@/lib/types";
import { Panel, SectionTitle, EmptyState, Button, TrendLabel } from "@/components/ui";
import { Insights } from "@/components/Insights";
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

  // "Today" carries overdue work too — hiding it until the student visits the
  // tasks page would defeat the point of the dashboard.
  const todayTasks = useMemo(
    () => open.filter((t) => t.dueDate != null && t.dueDate <= today),
    [open, today],
  );

  const upcoming = useMemo(
    () => sortTasks(open.filter((t) => t.dueDate != null && t.dueDate > today)).slice(0, 5),
    [open, today],
  );

  const recs = useMemo(() => recommend(store, 3), [store]);
  const overall = overallAverage(store.grades, store.courses);
  const uni = nextUniDeadline(store);

  const uniCounts = UNI_PRIORITIES.map((p) => ({
    priority: p,
    count: store.universities.filter((u) => u.priority === p).length,
  }));

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const overdueCount = todayTasks.filter(
    (t) => t.dueDate != null && daysUntil(t.dueDate) < 0,
  ).length;

  return (
    <div className="page-in">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {store.profile.name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {open.length === 0
            ? "Nothing on your plate. Add what's coming up."
            : "Here's what needs your attention."}
        </p>
      </header>

      {/* What the hub noticed on its own comes first — it is the part that
          knows this particular student, where the rules below know anyone. */}
      <Insights limit={2} />

      {/* Recommendations sit above the fold: the dashboard should answer
          "what should I focus on" before it shows a list to scan. */}
      {recs.length > 0 && (
        <section className="mb-8">
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

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid gap-8">
          <section>
            <SectionTitle
              right={
                overdueCount > 0 ? (
                  <span className="text-xs font-medium text-[var(--urgent)]">
                    {overdueCount} overdue
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">{todayTasks.length} due</span>
                )
              }
            >
              Today
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
                      <span className="w-24 shrink-0 text-xs font-medium text-ink-2">
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

        <div className="grid gap-8">
          <section>
            <SectionTitle
              right={
                <Link href="/grades" className="text-xs text-ink-3 hover:text-ink">
                  Details
                </Link>
              }
            >
              Academic overview
            </SectionTitle>
            <Panel className="px-4 py-4">
              {overall.value == null ? (
                <p className="py-3 text-center text-sm text-ink-3">
                  Add grades to see your average.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="nums text-3xl font-semibold tracking-tight">
                      {overall.value}%
                    </span>
                    <span className="text-xs text-ink-3">current average</span>
                  </div>
                  <div className="grid gap-2.5">
                    {store.courses.map((c) => {
                      const avg = courseAverage(store.grades, c.id);
                      if (avg.value == null) return null;
                      const t = trend(store.grades.filter((g) => g.courseId === c.id));
                      return (
                        <Link
                          key={c.id}
                          href={`/courses/${c.id}`}
                          className="group flex items-center gap-3"
                        >
                          <span className="w-28 shrink-0 truncate text-sm text-ink-2 group-hover:text-ink">
                            {c.name}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: `${avg.value}%` }}
                            />
                          </span>
                          <span className="nums w-10 shrink-0 text-right text-sm font-medium">
                            {avg.value}%
                          </span>
                          <span className="w-12 shrink-0 text-right">
                            {t && <TrendLabel direction={t.direction} delta={t.delta} />}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </Panel>
          </section>

          <section>
            <SectionTitle
              right={
                <Link href="/universities" className="text-xs text-ink-3 hover:text-ink">
                  All
                </Link>
              }
            >
              Universities
            </SectionTitle>
            <Panel className="px-4 py-4">
              {store.universities.length === 0 ? (
                <p className="py-2 text-center text-sm text-ink-3">
                  No universities on your list yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {uniCounts.map(({ priority, count }) => (
                      <div key={priority} className="rounded-lg bg-panel-2 py-2.5">
                        <div className="nums text-xl font-semibold">{count}</div>
                        <div className="text-[11px] text-ink-3">
                          {UNI_PRIORITY_LABEL[priority]}
                        </div>
                      </div>
                    ))}
                  </div>
                  {uni && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-[11px] uppercase tracking-wider text-ink-3">
                        Next deadline
                      </p>
                      <p className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">
                          {uni.flag} {uni.name}
                        </span>
                        <span className="nums shrink-0 text-ink-2">
                          {formatDate(uni.deadline as string)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        Closes {countdownLabel(uni.deadline as string)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </section>
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
