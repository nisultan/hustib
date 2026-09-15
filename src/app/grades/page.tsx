"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  courseAverage,
  explain,
  overallAverage,
  predictFinal,
  series,
  sortByDate,
  trend,
  whatIf,
} from "@/lib/grades";
import { formatDate, todayISO } from "@/lib/dates";
import { ASSESSMENT_TYPES, AssessmentType, Grade } from "@/lib/types";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  SectionTitle,
  Select,
  TrendLabel,
  ConfirmDeleteButton,
} from "@/components/ui";
import { GradeChart } from "@/components/GradeChart";
import { DateField } from "@/components/DateField";

export default function GradesPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <GradesInner />
    </Suspense>
  );
}

function GradesInner() {
  const store = useStore();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Grade | "new" | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [query, setQuery] = useState(params.get("q") ?? "");

  const overall = overallAverage(store.grades, store.courses);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortByDate(
      store.grades.filter(
        (g) =>
          (courseFilter === "" || g.courseId === courseFilter) &&
          (q.length === 0 ||
            g.assessment.toLowerCase().includes(q) ||
            g.type.toLowerCase().includes(q)),
      ),
    );
  }, [store.grades, courseFilter, query]);

  const courseName = (id: string) => store.courses.find((c) => c.id === id)?.name ?? "—";

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Grades"
        subtitle="Every assessment, with the averages worked out for you."
        action={
          <Button
            variant="primary"
            onClick={() => setEditing("new")}
            disabled={store.courses.length === 0}
          >
            <span aria-hidden>+</span>Add grade
          </Button>
        }
      />

      {store.courses.length === 0 ? (
        <EmptyState
          title="Add a course first"
          hint="Grades belong to a course, so there is nowhere to put one yet."
        />
      ) : (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <Panel className="px-4 py-4">
              <p className="text-[11px] uppercase tracking-wider text-ink-3">
                Overall academic average
              </p>
              <p className="nums mt-1 text-3xl font-semibold tracking-tight">
                {overall.value == null ? "—" : `${overall.value}%`}
              </p>
              <p className="mt-1.5 text-xs text-ink-3">
                {overall.value == null
                  ? "No grades recorded yet."
                  : `Mean of ${overall.count} course ${overall.count === 1 ? "average" : "averages"}, so a course with many small grades does not outweigh the rest.`}
              </p>
            </Panel>

            <Panel className="px-4 py-4">
              <p className="text-[11px] uppercase tracking-wider text-ink-3">Predicted final</p>
              <p className="nums mt-1 text-3xl font-semibold tracking-tight">
                {(() => {
                  const preds = store.courses
                    .map((c) => predictFinal(store.grades.filter((g) => g.courseId === c.id)))
                    .filter((v): v is number => v != null);
                  if (preds.length === 0) return "—";
                  return `${Math.round((preds.reduce((s, v) => s + v, 0) / preds.length) * 10) / 10}%`;
                })()}
              </p>
              <p className="mt-1.5 text-xs text-ink-3">
                Each course average carried forward along its own trend, damped so one strong
                result does not swing the projection.
              </p>
            </Panel>
          </section>

          <section className="mb-8">
            <SectionTitle>By course</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {store.courses.map((c) => {
                const g = store.grades.filter((x) => x.courseId === c.id);
                const avg = courseAverage(store.grades, c.id);
                const t = trend(g);
                return (
                  <Panel key={c.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                        <p className="mt-0.5 text-xs text-ink-3">{explain(avg)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="nums text-2xl font-semibold">
                          {avg.value == null ? "—" : `${avg.value}%`}
                        </p>
                        {t && (
                          <TrendLabel
                            direction={t.direction}
                            delta={t.delta}
                            suffix="this month"
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <GradeChart points={series(g)} height={92} showAxis={false} />
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>

          <WhatIf />

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">
                All assessments
              </h2>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="h-8 w-32 sm:w-40"
                />
                <Select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="h-8 w-auto py-0"
                >
                  <option value="">All courses</option>
                  {store.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title="No grades recorded"
                hint="Add your first assessment to start tracking an average."
                action={
                  <Button variant="primary" onClick={() => setEditing("new")}>
                    Add grade
                  </Button>
                }
              />
            ) : (
              <Panel className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
                        <th className="px-3.5 py-2.5 font-medium">Course</th>
                        <th className="px-3.5 py-2.5 font-medium">Assessment</th>
                        <th className="px-3.5 py-2.5 font-medium">Type</th>
                        <th className="px-3.5 py-2.5 text-right font-medium">Grade</th>
                        <th className="px-3.5 py-2.5 text-right font-medium">Weight</th>
                        <th className="px-3.5 py-2.5 text-right font-medium">Date</th>
                        <th className="px-3.5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((g) => (
                        <tr
                          key={g.id}
                          className="border-b border-line last:border-b-0 hover:bg-panel-2"
                        >
                          <td className="px-3.5 py-2.5 text-ink-2">{courseName(g.courseId)}</td>
                          <td className="px-3.5 py-2.5 font-medium">{g.assessment}</td>
                          <td className="px-3.5 py-2.5 text-ink-2">{g.type}</td>
                          <td className="nums px-3.5 py-2.5 text-right font-medium">
                            {g.score}%
                          </td>
                          <td className="nums px-3.5 py-2.5 text-right text-ink-2">
                            {g.weight == null ? "—" : `${g.weight}%`}
                          </td>
                          <td className="nums px-3.5 py-2.5 text-right text-ink-2">
                            {formatDate(g.date)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditing(g)}
                                className="rounded-md px-1.5 py-0.5 text-xs text-ink-3 hover:bg-panel-2 hover:text-ink"
                              >
                                Edit
                              </button>
                              <ConfirmDeleteButton
                                label={`Delete ${g.assessment}`}
                                onConfirm={() => store.deleteGrade(g.id)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </section>
        </>
      )}

      <GradeDialog
        open={editing != null}
        grade={editing === "new" ? undefined : (editing ?? undefined)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/**
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

function GradeDialog({
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

function clampNum(raw: string, min: number, max: number): number | null {
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}
