"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { AssessmentType, ASSESSMENT_TYPES, Grade } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { courseAverage, overallAverage, whatIf } from "@/lib/grades";
import { Button, Field, Input, Modal, Panel, Select, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";

/**
 * Recording a grade, and asking what one more would do to the average.
 *
 * Lifted out of the grades page when that page was removed: the numbers now
 * live on School, beside the subject they belong to, but there still has to be
 * somewhere to type one in.
 */
export function GradeDialog({
  open,
  grade,
  onClose,
}: {
  open: boolean;
  grade?: Grade;
  onClose: () => void;
}) {
  const store = useStore();
  const [courseId, setCourseId] = useState("");
  const [assessment, setAssessment] = useState("");
  const [type, setType] = useState<AssessmentType>("Test");
  const [score, setScore] = useState("");
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${open}-${grade?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setCourseId(grade?.courseId ?? store.courses[0]?.id ?? "");
    setAssessment(grade?.assessment ?? "");
    setType(grade?.type ?? "Test");
    setScore(grade ? String(grade.score) : "");
    setWeight(grade?.weight != null ? String(grade.weight) : "");
    setDate(grade?.date ?? todayISO());
  }

  const parsedScore = clampNum(score, 0, 100);
  const valid = courseId !== "" && assessment.trim().length > 0 && parsedScore != null;

  const save = () => {
    if (!valid || parsedScore == null) return;
    const payload = {
      courseId,
      assessment: assessment.trim(),
      type,
      score: parsedScore,
      weight: weight.trim() === "" ? null : clampNum(weight, 0, 100),
      date,
    };
    if (grade) store.updateGrade(grade.id, payload);
    else store.addGrade(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={grade ? "Edit grade" : "Add grade"}>
      <div className="grid gap-4">
        <Field label="Course">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {store.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Assessment">
          <Input
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Test 1"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as AssessmentType)}>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="92"
            />
          </Field>
          <Field label="Weight (%)" hint="Optional — leave blank for a plain average.">
            <Input
              type="number"
              min={0}
              max={100}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="20"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {grade ? (
          <Button
            variant="danger"
            onClick={() => {
              store.deleteGrade(grade.id);
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
          <Button variant="primary" onClick={save} disabled={!valid}>
            {grade ? "Save changes" : "Add grade"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export /**
 * "What if?" calculator. Deliberately concrete: pick a course, name a score,
 * and see the projected average — a number the student can act on, rather
 * than a guess produced somewhere they cannot inspect.
 */
function WhatIf() {
  const store = useStore();
  const [courseId, setCourseId] = useState("");
  const [score, setScore] = useState("95");
  const [weight, setWeight] = useState("20");

  const active = courseId || store.courses[0]?.id || "";
  const grades = store.grades.filter((g) => g.courseId === active);
  const current = courseAverage(store.grades, active);

  const parsedScore = clampNum(score, 0, 100);
  const parsedWeight = weight.trim() === "" ? null : clampNum(weight, 0, 100);
  const projectedCourse =
    parsedScore == null ? null : whatIf(grades, parsedScore, parsedWeight);

  // Overall moves too, since one course average feeds the mean of all of them.
  const projectedOverall = useMemo(() => {
    if (projectedCourse == null) return null;
    const values = store.courses.map((c) =>
      c.id === active ? projectedCourse : courseAverage(store.grades, c.id).value,
    );
    const present = values.filter((v): v is number => v != null);
    if (present.length === 0) return null;
    return Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 10) / 10;
  }, [projectedCourse, store.courses, store.grades, active]);

  const overallNow = overallAverage(store.grades, store.courses).value;

  if (store.courses.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionTitle>What if?</SectionTitle>
      <Panel className="px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Course">
            <Select value={active} onChange={(e) => setCourseId(e.target.value)}>
              {store.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="I score">
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </Field>
          <Field label="Worth (%)" hint="Leave blank for an unweighted assessment.">
            <Input
              type="number"
              min={0}
              max={100}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-3">Course now</p>
            <p className="nums mt-1 text-xl font-semibold">
              {current.value == null ? "—" : `${current.value}%`}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-3">Course after</p>
            <p className="nums mt-1 text-xl font-semibold text-accent-text">
              {projectedCourse == null ? "—" : `${projectedCourse}%`}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-3">Overall after</p>
            <p className="nums mt-1 text-xl font-semibold">
              {projectedOverall == null ? "—" : `${projectedOverall}%`}
              {overallNow != null && projectedOverall != null && (
                <span
                  className="ml-1.5 text-xs font-medium"
                  style={{
                    color: projectedOverall >= overallNow ? "var(--up)" : "var(--down)",
                  }}
                >
                  {projectedOverall >= overallNow ? "+" : ""}
                  {(projectedOverall - overallNow).toFixed(1)}
                </span>
              )}
            </p>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function clampNum(raw: string, min: number, max: number): number | null {
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}
