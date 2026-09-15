"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useStore } from "@/lib/store";
import { courseAverage, explain, predictFinal, series, sortByDate, trend } from "@/lib/grades";
import { formatDate, todayISO } from "@/lib/dates";
import { Button, EmptyState, Panel, SectionTitle, TrendLabel } from "@/components/ui";
import { TaskList } from "@/components/TaskItem";
import { AddTaskButton } from "@/components/TaskDialog";
import { GradeChart } from "@/components/GradeChart";
import { CourseDialog } from "@/components/CourseDialog";

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const today = todayISO();

  const course = store.courses.find((c) => c.id === id);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  if (!course) {
    return (
      <EmptyState
        title="Course not found"
        hint="It may have been deleted."
        action={
          <Link href="/courses">
            <Button>Back to courses</Button>
          </Link>
        }
      />
    );
  }

  const grades = sortByDate(store.grades.filter((g) => g.courseId === course.id));
  const avg = courseAverage(store.grades, course.id);
  const t = trend(grades);
  const predicted = predictFinal(grades);

  const tasks = store.tasks.filter((x) => x.courseId === course.id);
  const openTasks = tasks.filter((x) => x.status !== "completed");
  const done = tasks.filter((x) => x.status === "completed");
  const upcoming = openTasks.filter((x) => x.dueDate != null && x.dueDate >= today).length;

  // Topics come from the course definition plus anything tasks reference, so a
  // topic typed into a task still shows up here.
  const topics = Array.from(
    new Set([...course.lessons, ...tasks.map((x) => x.lesson).filter(Boolean)]),
  ) as string[];

  const notes = tasks.filter((x) => x.notes.trim().length > 0);

  return (
    <div className="page-in">
      <Link
        href="/courses"
        className="mb-4 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
      >
        <span aria-hidden>←</span> Courses
      </Link>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {upcoming} upcoming ·{" "}
            {grades.length} {grades.length === 1 ? "grade" : "grades"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>Edit course</Button>
          <AddTaskButton courseId={course.id} />
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Panel className="px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Current average</p>
          <p className="nums mt-1 text-2xl font-semibold">
            {avg.value == null ? "—" : `${avg.value}%`}
          </p>
          <p className="mt-1 text-xs text-ink-3">{explain(avg)}</p>
        </Panel>

        <Panel className="px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Trend</p>
          <p className="mt-1 text-2xl font-semibold">
            {t ? (
              <TrendLabel direction={t.direction} delta={t.delta} />
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {t ? `Compared with earlier work this term.` : "Needs at least two grades."}
          </p>
        </Panel>

        <Panel className="px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Predicted final</p>
          <p className="nums mt-1 text-2xl font-semibold">
            {predicted == null ? "—" : `${predicted}%`}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Current average carried forward along the trend.
          </p>
        </Panel>
      </div>

      <section className="mb-8">
        <SectionTitle>Grade over time</SectionTitle>
        <Panel className="px-4 py-4">
          <GradeChart points={series(grades)} height={170} />
        </Panel>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle
            right={<span className="text-xs text-ink-3">{openTasks.length} open</span>}
          >
            Tasks
          </SectionTitle>
          <TaskList
            tasks={openTasks}
            showCourse={false}
            empty={
              <EmptyState
                title="No open tasks"
                action={<AddTaskButton courseId={course.id} variant="secondary" />}
              />
            }
          />
          {done.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">
                {done.length} completed
              </summary>
              <div className="mt-2">
                <TaskList tasks={done} showCourse={false} />
              </div>
            </details>
          )}
        </section>

        <div className="grid gap-8">
          <section>
            <SectionTitle
              right={
                <Link href="/grades" className="text-xs text-ink-3 hover:text-ink">
                  Manage
                </Link>
              }
            >
              Grades
            </SectionTitle>
            {grades.length === 0 ? (
              <Panel className="px-3.5 py-6 text-center text-sm text-ink-3">
                No grades recorded.
              </Panel>
            ) : (
              <Panel>
                {grades.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-baseline gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{g.assessment}</span>
                    <span className="shrink-0 text-xs text-ink-3">{g.type}</span>
                    <span className="nums w-11 shrink-0 text-right text-sm font-medium">
                      {g.score}%
                    </span>
                    <span className="nums hidden w-14 shrink-0 text-right text-xs text-ink-3 sm:block">
                      {formatDate(g.date)}
                    </span>
                  </div>
                ))}
              </Panel>
            )}
          </section>

          <section>
            <SectionTitle>Topics</SectionTitle>
            {topics.length === 0 ? (
              <Panel className="px-3.5 py-6 text-center text-sm text-ink-3">
                No topics yet — add them when editing the course.
              </Panel>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topics.map((topic) => {
                  const count = openTasks.filter((x) => x.lesson === topic).length;
                  return (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs"
                    >
                      {topic}
                      {count > 0 && <span className="nums text-ink-3">{count}</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Notes</SectionTitle>
            {notes.length === 0 ? (
              <Panel className="px-3.5 py-6 text-center text-sm text-ink-3">
                Notes you attach to tasks in this course appear here.
              </Panel>
            ) : (
              <Panel>
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="border-b border-line px-3.5 py-2.5 last:border-b-0"
                  >
                    <p className="text-xs font-medium text-ink-2">{n.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{n.notes}</p>
                  </div>
                ))}
              </Panel>
            )}
          </section>
        </div>
      </div>

      <CourseDialog open={editing} course={course} onClose={() => setEditing(false)} />
    </div>
  );
}
