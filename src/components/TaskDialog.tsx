"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  Priority,
  Status,
  Task,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
} from "@/lib/types";
import { parseQuickAdd } from "@/lib/quickparse";
import { formatDate, relativeLabel } from "@/lib/dates";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";

interface Draft {
  title: string;
  courseId: string;
  lesson: string;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  status: Status;
  notes: string;
}

function emptyDraft(courseId = ""): Draft {
  return {
    title: "",
    courseId,
    lesson: "",
    dueDate: "",
    dueTime: "",
    priority: "medium",
    status: "not_started",
    notes: "",
  };
}

function toDraft(t: Task): Draft {
  return {
    title: t.title,
    courseId: t.courseId ?? "",
    lesson: t.lesson ?? "",
    dueDate: t.dueDate ?? "",
    dueTime: t.dueTime ?? "",
    priority: t.priority,
    status: t.status,
    notes: t.notes,
  };
}

export function TaskDialog({
  open,
  onClose,
  task,
  defaultCourseId = "",
}: {
  open: boolean;
  onClose: () => void;
  /** Present when editing; absent when creating. */
  task?: Task;
  defaultCourseId?: string;
}) {
  const store = useStore();
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultCourseId));
  const [quick, setQuick] = useState("");
  const [extracted, setExtracted] = useState<string[] | null>(null);

  // Reset whenever the dialog opens so a previous draft never leaks in.
  useEffect(() => {
    if (!open) return;
    setDraft(task ? toDraft(task) : emptyDraft(defaultCourseId));
    setQuick("");
    setExtracted(null);
  }, [open, task, defaultCourseId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const runQuickAdd = () => {
    if (quick.trim().length === 0) return;
    const parsed = parseQuickAdd(quick, store.courses);

    setDraft((d) => ({
      ...d,
      title: parsed.title || d.title,
      courseId: parsed.courseId ?? d.courseId,
      dueDate: parsed.dueDate ?? d.dueDate,
      dueTime: parsed.dueTime ?? d.dueTime,
      priority: parsed.priority,
    }));

    // Report exactly what was understood, so the student knows what to check.
    const found: string[] = [];
    if (parsed.matched.course) {
      const c = store.courses.find((x) => x.id === parsed.courseId);
      if (c) found.push(`Course: ${c.name}`);
    }
    if (parsed.matched.date && parsed.dueDate) {
      found.push(`Deadline: ${relativeLabel(parsed.dueDate)} (${formatDate(parsed.dueDate)})`);
    }
    if (parsed.matched.time && parsed.dueTime) found.push(`Time: ${parsed.dueTime}`);
    if (parsed.matched.priority) found.push(`Priority: ${PRIORITY_LABEL[parsed.priority]}`);
    setExtracted(found);
    setQuick("");
  };

  const save = () => {
    const title = draft.title.trim();
    if (title.length === 0) return;

    const payload = {
      title,
      courseId: draft.courseId || null,
      lesson: draft.lesson.trim() || null,
      dueDate: draft.dueDate || null,
      // A time without a date has nothing to anchor to, so it is dropped.
      dueTime: draft.dueDate ? draft.dueTime || null : null,
      priority: draft.priority,
      status: draft.status,
      notes: draft.notes,
    };

    if (task) {
      store.updateTask(task.id, {
        ...payload,
        completedAt:
          payload.status === "completed"
            ? (task.completedAt ?? new Date().toISOString().slice(0, 10))
            : null,
      });
    } else {
      store.addTask(payload);
    }
    onClose();
  };

  const course = store.courses.find((c) => c.id === draft.courseId);

  return (
    <Modal open={open} onClose={onClose} title={task ? "Edit task" : "New task"} wide>
      {!task && (
        <div className="mb-5 rounded-xl border border-line bg-panel-2 p-3">
          <p className="mb-2 text-xs font-medium text-ink-2">
            Quick add — write it the way you would say it
          </p>
          <div className="flex gap-2">
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runQuickAdd();
                }
              }}
              placeholder="Finish physics worksheet tomorrow, high priority"
              className="min-w-0 flex-1 bg-panel"
            />
            <Button onClick={runQuickAdd} disabled={quick.trim().length === 0}>
              Extract
            </Button>
          </div>

          {extracted != null && (
            <div className="mt-2.5 text-xs">
              {extracted.length > 0 ? (
                <>
                  <span className="text-ink-2">
                    Filled in below — edit anything before saving:
                  </span>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-accent-text">
                    {extracted.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="text-ink-3">Only a title was found — set the rest below.</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4">
        <Field label="Title">
          <Input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Finish integration exercises"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course">
            <Select value={draft.courseId} onChange={(e) => set("courseId", e.target.value)}>
              <option value="">No course</option>
              {store.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Lesson / Topic">
            <Input
              value={draft.lesson}
              onChange={(e) => set("lesson", e.target.value)}
              list="lesson-options"
              placeholder={course?.lessons[0] ?? "Integration"}
            />
            <datalist id="lesson-options">
              {(course?.lessons ?? []).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline">
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </Field>

          <Field label="Time (optional)">
            <Input
              type="time"
              value={draft.dueTime}
              disabled={draft.dueDate === ""}
              onChange={(e) => set("dueTime", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set("status", e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Need to complete exercises 5–12"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {task ? (
          <Button
            variant="danger"
            onClick={() => {
              store.deleteTask(task.id);
              onClose();
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={draft.title.trim().length === 0}>
            {task ? "Save changes" : "Add task"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** "+ Add" trigger plus its dialog, so pages only need one element. */
export function AddTaskButton({
  courseId = "",
  label = "Add task",
  variant = "primary",
  compact = false,
}: {
  courseId?: string;
  label?: string;
  variant?: "primary" | "secondary";
  /** Drops to a bare "+" on small screens, for the crowded app header. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} aria-label={label}>
        <span aria-hidden>+</span>
        <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
      </Button>
      <TaskDialog open={open} onClose={() => setOpen(false)} defaultCourseId={courseId} />
    </>
  );
}
