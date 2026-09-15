"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { courseAverage, series, trend } from "@/lib/grades";
import { todayISO } from "@/lib/dates";
import { Course } from "@/lib/types";
import { courseColor } from "@/lib/appearance";
import { Button, EmptyState, PageHeader, Panel, TrendLabel } from "@/components/ui";
import { Sparkline } from "@/components/GradeChart";
import { CourseDialog } from "@/components/CourseDialog";

export default function CoursesPage() {
  const store = useStore();
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const today = todayISO();

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Courses"
        subtitle="Each course collects its own tasks, topics and grades."
        action={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <span aria-hidden>+</span>Add course
          </Button>
        }
      />

      {store.courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          hint="Add your subjects first — tasks and grades attach to them."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Add your first course
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {store.courses.map((c) => {
            const courseGrades = store.grades.filter((g) => g.courseId === c.id);
            const avg = courseAverage(store.grades, c.id);
            const t = trend(courseGrades);
            const tasks = store.tasks.filter((x) => x.courseId === c.id);
            const upcoming = tasks.filter(
              (x) => x.status !== "completed" && x.dueDate != null && x.dueDate >= today,
            ).length;

            // Only the facts that are actually true of this course. A card
            // reading "0 topics" spends a line telling you about something
            // that is not there.
            const meta = [
              tasks.length > 0 && `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
              upcoming > 0 && `${upcoming} upcoming`,
              c.lessons.length > 0 &&
                `${c.lessons.length} ${c.lessons.length === 1 ? "topic" : "topics"}`,
            ].filter(Boolean) as string[];

            return (
              <Link key={c.id} href={`/courses/${c.id}`} className="group/card">
                <Panel interactive className="relative h-full overflow-hidden px-4 py-3.5">
                  {/* The course colour as an edge rather than a dot: it reads
                      at a glance down a column of cards, where a 10px dot
                      beside a heading does not. */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] transition-[width] duration-200 group-hover/card:w-[5px]"
                    style={{ background: courseColor(c.color) }}
                  />

                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{c.name}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
                        {c.code && (
                          <span className="rounded bg-panel-2 px-1.5 py-0.5 font-medium text-ink-2">
                            {c.code}
                          </span>
                        )}
                        {meta.length > 0 ? meta.join(" · ") : "Nothing attached yet"}
                      </p>
                    </div>

                    {avg.value != null && (
                      <div className="shrink-0 text-right">
                        <div className="nums text-xl font-semibold leading-none">
                          {avg.value}%
                        </div>
                        {t && (
                          <div className="mt-1">
                            <TrendLabel direction={t.direction} delta={t.delta} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* A line needs two points. One grade gets the number above
                      and no chart, rather than a dashed box standing in for
                      a trend that does not exist yet. */}
                  {courseGrades.length > 1 ? (
                    <div className="mt-3 pl-2">
                      <Sparkline points={series(courseGrades)} />
                    </div>
                  ) : (
                    <p className="mt-2.5 pl-2 text-xs text-ink-3">
                      {courseGrades.length === 0
                        ? "No grades yet — add one to start the average."
                        : "One grade so far. A second draws the trend."}
                    </p>
                  )}
                </Panel>
              </Link>
            );
          })}
        </div>
      )}

      <CourseDialog
        open={editing != null}
        course={editing === "new" ? undefined : (editing ?? undefined)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
