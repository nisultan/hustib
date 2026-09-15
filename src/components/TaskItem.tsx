"use client";

import { useState } from "react";
import { Task, PRIORITY_LABEL, PRIORITY_RANK } from "@/lib/types";
import { useCourseMap, useStore } from "@/lib/store";
import { daysUntil, formatTime, relativeLabel } from "@/lib/dates";
import { PriorityDot, ConfirmDeleteButton } from "./ui";
import { courseColor } from "@/lib/appearance";
import { TaskDialog } from "./TaskDialog";

/** Sort: overdue first, then soonest deadline, then priority, then title. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad.localeCompare(bd);
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return a.title.localeCompare(b.title);
  });
}

export function TaskItem({ task, showCourse = true }: { task: Task; showCourse?: boolean }) {
  const store = useStore();
  const courses = useCourseMap();
  const [editing, setEditing] = useState(false);

  const done = task.status === "completed";
  const course = task.courseId ? courses.get(task.courseId) : null;
  const overdue = !done && task.dueDate != null && daysUntil(task.dueDate) < 0;

  const meta = [
    showCourse && course ? course.name : null,
    task.lesson,
    task.dueDate ? relativeLabel(task.dueDate) : null,
    task.dueTime ? formatTime(task.dueTime) : null,
    PRIORITY_LABEL[task.priority],
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="group flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0 hover:bg-panel-2">
        <button
          onClick={() => store.toggleTask(task.id)}
          aria-label={
            done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`
          }
          className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors ${
            done
              ? "border-accent bg-accent text-white"
              : "border-line-strong hover:border-accent"
          }`}
        >
          {done && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="m2.5 6.2 2.3 2.3L9.5 3.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <button
          onClick={() => setEditing(true)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit ${task.title}`}
        >
          <span className="flex items-center gap-2">
            {!done && <PriorityDot priority={task.priority} />}
            <span
              className={`truncate text-sm font-medium ${
                done ? "text-ink-3 line-through" : "text-ink"
              }`}
            >
              {task.title}
            </span>
            {task.status === "in_progress" && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-text bg-accent-soft">
                In progress
              </span>
            )}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
            {showCourse && course && (
              <span
                aria-hidden
                className="mr-0.5 inline-block size-1.5 shrink-0 rounded-full"
                style={{ background: courseColor(course.color) }}
              />
            )}
            {meta.map((m, i) => (
              <span key={`${m}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                <span
                  className={
                    overdue && m.includes("overdue")
                      ? "font-medium text-[var(--urgent)]"
                      : undefined
                  }
                >
                  {m}
                </span>
              </span>
            ))}
          </span>

          {task.notes.length > 0 && (
            <span className="mt-1 block truncate text-xs text-ink-3">{task.notes}</span>
          )}
        </button>

        {/* Revealed on hover on a pointer device, and always present for
            keyboard and touch users, who have no hover to reveal it. */}
        <ConfirmDeleteButton
          label={`Delete "${task.title}"`}
          onConfirm={() => store.deleteTask(task.id)}
          className="opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        />
      </div>

      <TaskDialog open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  );
}

export function TaskList({
  tasks,
  showCourse = true,
  empty,
}: {
  tasks: Task[];
  showCourse?: boolean;
  empty?: React.ReactNode;
}) {
  if (tasks.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]">
      {sortTasks(tasks).map((t) => (
        <TaskItem key={t.id} task={t} showCourse={showCourse} />
      ))}
    </div>
  );
}
