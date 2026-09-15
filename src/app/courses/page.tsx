"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { courseAverage, series, trend } from "@/lib/grades";
import { relativeLabel, todayISO } from "@/lib/dates";
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
            const done = tasks.filter((x) => x.status === "completed").length;
            const next = tasks
              .filter(
                (x) => x.status !== "completed" && x.dueDate != null && x.dueDate >= today,
              )
              .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
            const tint = courseColor(c.color);

            return (
              <Link key={c.id} href={`/courses/${c.id}`} className="group/card">
                <Panel
                  interactive
                  className="relative flex h-full flex-col overflow-hidden px-4 py-4"
                  // A wash of the course colour: enough to tell four cards
                  // apart at a glance, weak enough that the text on top is
                  // still text on a panel.
                  style={{
                    backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${tint}1f, transparent 60%)`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold tracking-wide text-white shadow-[var(--shadow),inset_0_1px_0_rgba(255,255,255,0.22)] transition-transform duration-200 group-hover/card:-rotate-3"
                      style={{ background: tint }}
                    >
                      {badge(c)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">{c.name}</h2>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {tasks.length === 0
                          ? "No tasks yet"
                          : `${done} of ${tasks.length} done`}
                        {courseGrades.length > 0 &&
                          ` · ${courseGrades.length} ${courseGrades.length === 1 ? "grade" : "grades"}`}
                      </p>
                    </div>

                    {/* The ring renders either way. A card missing its ring
                        would break the row of them, and an empty one is
                        itself the honest reading: nothing measured yet. */}
                    <Ring value={avg.value} color={tint} />
                  </div>

                  {/* Grades draw a trend; tasks draw progress. Something
                      always occupies this line, and it is always a fact about
                      the course rather than a note about what is absent. */}
                  <div className="mt-3.5">
                    {courseGrades.length > 1 ? (
                      <Sparkline points={series(courseGrades)} />
                    ) : (
                      <ProgressBar done={done} total={tasks.length} color={tint} />
                    )}
                  </div>

                  {c.lessons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.lessons.slice(0, 3).map((lesson) => (
                        <span
                          key={lesson}
                          className="truncate rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-ink-2"
                        >
                          {lesson}
                        </span>
                      ))}
                      {c.lessons.length > 3 && (
                        <span className="px-1 py-0.5 text-[11px] text-ink-3">
                          +{c.lessons.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pinned to the bottom, so cards of different heights still
                      line their deadlines up with each other. */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {next ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: tint }}
                        />
                        <span className="truncate text-ink-2">{next.title}</span>
                        <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
                          {relativeLabel(next.dueDate as string)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">Nothing due</span>
                    )}
                    {t && <TrendLabel direction={t.direction} delta={t.delta} />}
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

/** The code if there is one, otherwise initials — never an empty tile. */
function badge(course: Course): string {
  if (course.code) return course.code.slice(0, 4);
  // Skipping the joining words, or "Theory of Knowledge" initialises to "TO".
  const words = course.name.split(/\s+/).filter((w) => !/^(of|the|and|for|in|to)$/i.test(w));
  return (words.length > 0 ? words : course.name.split(/\s+/))
    .slice(0, 3)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * The average as a ring.
 *
 * A percentage is a proportion, and a ring says so in the shape itself — four
 * cards side by side compare at a glance in a way four numbers do not. The
 * number stays in the middle, because the ring is the comparison and the
 * digits are the answer.
 *
 * With nothing to show it draws the track alone. Hiding it would leave a hole
 * where every other card has a ring, and the empty track reads correctly:
 * there is a measurement here, and it has not been taken.
 */
function Ring({ value, color }: { value: number | null; color: string }) {
  const r = 15.5;
  const circumference = 2 * Math.PI * r;
  const filled = value == null ? 0 : (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <span className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        {value != null && (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
      </svg>
      <span
        className={`nums relative text-[11px] font-semibold leading-none ${
          value == null ? "text-ink-3" : ""
        }`}
      >
        {value == null ? "–" : Math.round(value)}
      </span>
    </span>
  );
}

/**
 * Tasks finished against tasks set.
 *
 * Stands in for the trend line on a course too new to have one, so the card
 * keeps its shape from the day it is created. A course with no tasks at all
 * gets the empty track, which is the same argument as the empty ring.
 */
function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  );
}
