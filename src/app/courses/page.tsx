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
            const upcoming = tasks
              .filter(
                (x) => x.status !== "completed" && x.dueDate != null && x.dueDate >= today,
              )
              .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
            const tint = courseColor(c.color);

            return (
              <Link key={c.id} href={`/courses/${c.id}`} className="group/card">
                <Panel
                  interactive
                  className="relative h-full overflow-hidden px-4 py-4"
                  // A wash of the course colour, strong enough to tell four
                  // cards apart at a glance and weak enough that the text on
                  // top is still text on a panel.
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
                        {tasks.length > 0
                          ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}${
                              upcoming.length > 0 ? ` · ${upcoming.length} upcoming` : ""
                            }`
                          : "No tasks yet"}
                      </p>
                    </div>

                    {avg.value != null && <Ring value={avg.value} color={tint} />}
                  </div>

                  {/* The card earns its lower half by answering the question
                      someone opening a course actually has — what is next —
                      rather than restating what is missing. */}
                  <div className="mt-3 border-t border-line pt-3">
                    {courseGrades.length > 1 ? (
                      <Sparkline points={series(courseGrades)} />
                    ) : c.lessons.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
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
                    ) : (
                      <p className="text-xs text-ink-3">
                        {courseGrades.length === 1
                          ? "One grade so far — a second draws the trend."
                          : "Add topics and grades to fill this out."}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-ink-3">
                        {upcoming.length > 0 ? (
                          <>
                            <span className="text-ink-2">Next</span> {upcoming[0].title} ·{" "}
                            {relativeLabel(upcoming[0].dueDate as string)}
                          </>
                        ) : (
                          "Nothing due"
                        )}
                      </p>
                      {t && <TrendLabel direction={t.direction} delta={t.delta} />}
                    </div>
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
 */
function Ring({ value, color }: { value: number; color: string }) {
  const r = 15.5;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <span className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
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
      </svg>
      <span className="nums relative text-[11px] font-semibold leading-none">
        {Math.round(value)}
      </span>
    </span>
  );
}
