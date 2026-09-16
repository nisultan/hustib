"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { courseAverage, trend } from "@/lib/grades";
import { daysUntil, relativeLabel, todayISO } from "@/lib/dates";
import { PRIORITY_RANK, Task } from "@/lib/types";
import { courseColor } from "@/lib/appearance";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  SectionTitle,
  TrendLabel,
} from "@/components/ui";
import { TaskItem } from "@/components/TaskItem";
import { GradeDialog, WhatIf } from "@/components/GradeDialog";
import { overallAverage, series } from "@/lib/grades";
import { GradeChart } from "@/components/GradeChart";
import { Grade } from "@/lib/types";
import { useState } from "react";

/**
 * Schoolwork, organised the way school actually is: by subject.
 *
 * The task list is a flat list with filters, which is right for "what is due
 * this week" and wrong for "how is Physics going". This page answers the
 * second question — each course with its grade, its trend and its open work in
 * one place, so the subject that is quietly sliding is visible without
 * assembling it from three pages.
 */
export default function SchoolPage() {
  const store = useStore();
  const today = todayISO();
  const [editing, setEditing] = useState<Grade | "new" | null>(null);

  const open = useMemo(
    () => store.tasks.filter((t) => t.status !== "completed"),
    [store.tasks],
  );

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  if (store.courses.length === 0) {
    return (
      <div className="page-in">
        <PageHeader title="School" subtitle="Every subject, with its work and its grade." />
        <EmptyState
          title="No courses yet"
          hint="Add your subjects and this becomes the one place to see how each is going."
          action={
            <Link
              href="/courses"
              className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white"
            >
              Add courses
            </Link>
          }
        />
      </div>
    );
  }

  // Weakest first. The page exists to surface the subject in trouble, and
  // alphabetical order buries it as reliably as not having the page at all.
  const courses = [...store.courses].sort((a, b) => {
    const av = courseAverage(store.grades, a.id).value ?? 101;
    const bv = courseAverage(store.grades, b.id).value ?? 101;
    return av - bv;
  });

  const overdue = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0);

  return (
    <div className="page-in">
      <PageHeader title="School" subtitle="Every subject, with its work and its grade." />

      <Overall />

      {overdue.length > 0 && (
        <Panel className="mb-6 border-[var(--urgent)]/30 bg-[var(--urgent)]/5 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-medium">
              {overdue.length} overdue {overdue.length === 1 ? "task" : "tasks"}.
            </span>{" "}
            <span className="text-ink-2">Clear these before starting anything new.</span>
          </p>
        </Panel>
      )}

      <div className="grid gap-5">
        {courses.map((course) => {
          const avg = courseAverage(store.grades, course.id);
          const courseGrades = store.grades.filter((g) => g.courseId === course.id);
          const t = trend(courseGrades);
          const work = open
            .filter((x) => x.courseId === course.id)
            .sort(byUrgency)
            .slice(0, 6);
          const next = work.find((x) => x.dueDate != null);

          return (
            <Panel key={course.id} className="overflow-hidden">
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3"
                style={{ borderLeft: `3px solid ${courseColor(course.color)}` }}
              >
                <Link
                  href={`/courses/${course.id}`}
                  className="text-sm font-semibold tracking-tight hover:text-accent-text"
                >
                  {course.name}
                </Link>

                {avg.value != null ? (
                  <span className="nums text-sm text-ink-2">{avg.value}%</span>
                ) : (
                  <span className="text-xs text-ink-3">No grades yet</span>
                )}
                {t && <TrendLabel direction={t.direction} delta={t.delta} />}

                <span className="ml-auto text-xs text-ink-3">
                  {work.length === 0
                    ? "Nothing open"
                    : `${work.length} open${next?.dueDate ? ` · next ${relativeLabel(next.dueDate).toLowerCase()}` : ""}`}
                </span>
              </div>

              {work.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink-3">
                  Nothing outstanding in {course.name}.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {work.map((task) => (
                    <TaskItem key={task.id} task={task} showCourse={false} />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                {courseGrades.length > 0 && (
                  <div className="min-w-[120px] flex-1">
                    <GradeChart points={series(courseGrades)} height={44} showAxis={false} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[...courseGrades]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 4)
                    .map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setEditing(g)}
                        title={`${g.assessment} — ${g.date}`}
                        className="nums rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                      >
                        {g.score}%
                      </button>
                    ))}
                  <Button size="sm" onClick={() => setEditing("new")}>
                    Add grade
                  </Button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-8">
        <WhatIf />
      </div>

      <GradeDialog
        open={editing != null}
        grade={editing === "new" ? undefined : (editing ?? undefined)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/** The one figure that answers "how am I doing", above the subject breakdown. */
function Overall() {
  const store = useStore();
  const avg = overallAverage(store.grades, store.courses);
  if (avg.value == null) return null;

  return (
    <Panel className="mb-6 flex items-end gap-3 px-4 py-3">
      <p className="nums text-2xl font-semibold leading-none tracking-tight">{avg.value}%</p>
      <p className="pb-0.5 text-xs text-ink-3">
        across {avg.count} {avg.count === 1 ? "grade" : "grades"}
        {avg.weighted ? ", weighted" : ""}
      </p>
    </Panel>
  );
}

/** Overdue first, then soonest, then by priority — the order a student feels. */
function byUrgency(a: Task, b: Task): number {
  const ad = a.dueDate ? daysUntil(a.dueDate) : Infinity;
  const bd = b.dueDate ? daysUntil(b.dueDate) : Infinity;
  if (ad !== bd) return ad - bd;
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
}
