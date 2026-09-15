"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Course } from "@/lib/types";
import { COURSE_COLORS } from "@/lib/appearance";
import { Button, Field, Input, Modal } from "@/components/ui";

export function CourseDialog({
  open,
  course,
  onClose,
}: {
  open: boolean;
  course?: Course;
  onClose: () => void;
}) {
  const store = useStore();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lessons, setLessons] = useState("");
  const [color, setColor] = useState<string>(COURSE_COLORS[0].id);

  // Seed the fields each time the dialog opens.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${open}-${course?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setName(course?.name ?? "");
    setCode(course?.code ?? "");
    setLessons((course?.lessons ?? []).join(", "));
    setColor(course?.color ?? COURSE_COLORS[0].id);
  }

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const payload = {
      name: trimmed,
      // Default the short code to the first word, uppercased.
      code: (code.trim() || trimmed.split(/\s+/)[0]).toUpperCase().slice(0, 6),
      color,
      lessons: lessons
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    };
    if (course) store.updateCourse(course.id, payload);
    else store.addCourse(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={course ? "Edit course" : "New course"}>
      <div className="grid gap-4">
        <Field label="Course name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Math AA HL"
          />
        </Field>
        <Field label="Short code" hint="Shown in tight spaces. Defaults to the first word.">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MATH" />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Colour</span>
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                aria-pressed={color === c.id}
                title={c.label}
                aria-label={c.label}
                className={`grid size-8 place-items-center rounded-lg border transition-colors ${
                  color === c.id ? "border-accent" : "border-line hover:bg-panel-2"
                }`}
              >
                <span className="block size-4 rounded-full" style={{ background: c.value }} />
              </button>
            ))}
          </div>
          <span className="mt-1 block text-xs text-ink-3">
            Used to identify the course across lists and charts.
          </span>
        </div>

        <Field label="Lessons / topics" hint="Comma separated.">
          <Input
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            placeholder="Integration, Probability, Complex numbers"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {course ? (
          <Button
            variant="danger"
            onClick={() => {
              store.deleteCourse(course.id);
              onClose();
            }}
          >
            Delete course
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={name.trim().length === 0}>
            {course ? "Save changes" : "Add course"}
          </Button>
        </div>
      </div>

      {course && (
        <p className="mt-3 text-xs text-ink-3">
          Deleting a course also removes its tasks and grades.
        </p>
      )}
    </Modal>
  );
}
