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
    <div className="fade-up">
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
            const avg = courseAverage(store.grades, c.id);
            const courseGrades = store.grades.filter((g) => g.courseId === c.id);
            const t = trend(courseGrades);
            const tasks = store.tasks.filter((x) => x.courseId === c.id);
            const upcoming = tasks.filter(
              (x) => x.status !== "completed" && x.dueDate != null && x.dueDate >= today,
            ).length;

            return (
              <Link key={c.id} href={`/courses/${c.id}`}>
                <Panel className="h-full px-4 py-4 transition-colors hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: courseColor(c.color) }}
                        />
                        {c.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {upcoming}{" "}
                        upcoming · {c.lessons.length}{" "}
                        {c.lessons.length === 1 ? "topic" : "topics"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="nums text-xl font-semibold">
                        {avg.value == null ? "—" : `${avg.value}%`}
                      </div>
                      {t && <TrendLabel direction={t.direction} delta={t.delta} />}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Sparkline points={series(courseGrades)} />
                  </div>
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
