"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { completedBy, habitRows, SOURCES, wall, weekly } from "@/lib/activity";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { Heatmap } from "@/components/Heatmap";
import { ActivityTrend } from "@/components/ActivityTrend";
import { Productivity } from "@/components/Productivity";
import { ProgressGuide } from "@/components/ProgressGuide";
import { Button, EmptyState, Panel, PageHeader, SectionTitle, Segmented } from "@/components/ui";

/**
 * The year, seen from above.
 *
 * Every other page in the hub is about what happens next — the plan, the
 * deadlines, the applications. This one is the only place that looks backwards,
 * and it exists because effort is invisible while you are spending it. A term
 * of work leaves no trace anywhere else in the app once the tasks are ticked
 * and archived, which is a strange thing for a system built to keep someone
 * going.
 *
 * Nothing here is a target. There is no goal line on the heatmap and no ideal
 * streak, because a wall chart with a target on it stops being a record and
 * becomes another thing to fail at.
 */

type Range = "13" | "26" | "53";

const RANGES = [
  { id: "13" as Range, label: "3 months" },
  { id: "26" as Range, label: "6 months" },
  { id: "53" as Range, label: "Year" },
];

export default function ProgressPage() {
  const store = useStore();
  const router = useRouter();
  const [range, setRange] = useState<Range>("53");
  const [guide, setGuide] = useState(false);

  const today = todayISO();
  const weeks = Number(range);

  const chart = useMemo(() => wall(store, weeks, today), [store, weeks, today]);
  const bars = useMemo(() => weekly(chart.days, today), [chart.days, today]);

  const from = chart.days[0]?.date ?? today;
  const slices = useMemo(() => completedBy(store, from, today), [store, from, today]);

  // Habits get a shorter window whatever the heatmap is showing: a year of
  // daily squares per habit is a wall nobody reads, and the useful question
  // about a habit is always "am I keeping it lately".
  const habits = useMemo(
    () => habitRows(store, addDays(today, -41), today, today),
    [store, today],
  );

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const totals = SOURCES.map((s) => ({
    ...s,
    count: chart.days.reduce((sum, d) => sum + d.by[s.key], 0),
  })).filter((s) => s.count > 0);

  const busiestSource = Math.max(1, ...totals.map((s) => s.count));

  return (
    <div className="page-in">
      <PageHeader
        title="Progress"
        subtitle="What you have actually done, day by day. Not a target — a record."
        action={
          /* Every figure on this page is counted rather than entered, and a
             derived number nobody can explain is a number nobody believes. */
          <Button size="sm" onClick={() => setGuide(true)}>
            How this works
          </Button>
        }
      />

      <ProgressGuide open={guide} onClose={() => setGuide(false)} />

      {chart.total === 0 ? (
        <EmptyState
          title="Nothing to draw yet"
          hint="Tick off a task, finish a planned block, or keep a habit, and this fills in from the day it happened."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              value={chart.total}
              label={chart.total === 1 ? "thing logged" : "things logged"}
              hint={rangeLabel(weeks)}
            />
            <Stat
              value={chart.activeDays}
              label="active days"
              hint={`of ${chart.days.length} · ${Math.round(
                (chart.activeDays / Math.max(1, chart.days.length)) * 100,
              )}%`}
            />
            <Stat
              value={chart.streak}
              label="day streak"
              hint={chart.streak === 0 ? "start one today" : "running now"}
            />
            <Stat
              value={chart.bestStreak}
              label="best run"
              hint={
                chart.busiest
                  ? `busiest ${formatDate(chart.busiest.date)}`
                  : "days in a row"
              }
            />
          </div>

          <section className="mb-8">
            <SectionTitle
              right={
                <Segmented
                  options={RANGES}
                  value={range}
                  onChange={setRange}
                  label="How far back to show"
                />
              }
            >
              Every day
            </SectionTitle>
            <Panel className="px-4 py-4">
              <Heatmap
                weeks={chart.weeks}
                months={chart.months}
                onPick={(date) => router.push(`/plan?date=${date}`)}
              />
            </Panel>
          </section>

          <section className="mb-8">
            <SectionTitle>Week by week</SectionTitle>
            <Panel className="px-4 py-4">
              <ActivityTrend weeks={bars} />
            </Panel>
          </section>

          <div className="mb-8 grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle>What it was made of</SectionTitle>
              <Panel className="px-4 py-4">
                <div className="grid gap-2.5">
                  {totals.map((source) => (
                    <Row
                      key={source.key}
                      label={source.label}
                      count={source.count}
                      share={source.count / busiestSource}
                      color={source.color}
                    />
                  ))}
                </div>
              </Panel>
            </section>

            <section>
              <SectionTitle>Finished tasks, by subject</SectionTitle>
              <Panel className="px-4 py-4">
                {slices.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-3">
                    No tasks completed in this stretch.
                  </p>
                ) : (
                  <div className="grid gap-2.5">
                    {slices.slice(0, 8).map((slice) => (
                      <Row
                        key={slice.id ?? "none"}
                        label={slice.label}
                        count={slice.count}
                        share={slice.count / slices[0].count}
                        color={slice.color}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </section>
          </div>

          {habits.length > 0 && (
            <section className="mb-8">
              <SectionTitle right={<span className="text-xs text-ink-3">Last six weeks</span>}>
                Habits, one row each
              </SectionTitle>
              <Panel className="overflow-x-auto px-4 py-4">
                <div className="grid gap-2">
                  {habits.map((habit) => (
                    <div key={habit.id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs text-ink-2">
                        {habit.name}
                      </span>
                      <span className="flex gap-[3px]">
                        {habit.marks.map((mark, i) => (
                          <span
                            key={i}
                            aria-hidden
                            className="size-[9px] rounded-[2px]"
                            style={{
                              background:
                                mark === "kept"
                                  ? "var(--up)"
                                  : mark === "missed"
                                    ? "color-mix(in srgb, var(--down) 28%, var(--panel-2))"
                                    : "var(--panel-2)",
                            }}
                          />
                        ))}
                      </span>
                      <span className="nums ml-auto shrink-0 pl-2 text-[11px] text-ink-3">
                        {habit.due === 0
                          ? "not due yet"
                          : `${habit.kept}/${habit.due} kept`}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}
        </>
      )}

      {/* The score, with its working out. It answers a different question from
          everything above — "am I keeping this up" rather than "what did I do" —
          so it sits at the end rather than on top of the record. */}
      <Productivity showStreak={false} />
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <Panel className="px-3.5 py-3">
      <p className="nums text-2xl font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-ink-2">{label}</p>
      <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p>
    </Panel>
  );
}

/**
 * One labelled bar.
 *
 * Scaled against the largest in its own group rather than against the total,
 * so the smaller entries stay visible instead of collapsing into slivers. The
 * number is always printed beside it — the bar is for comparing, the figure is
 * for knowing.
 */
function Row({
  label,
  count,
  share,
  color,
}: {
  label: string;
  count: number;
  share: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs text-ink-2" title={label}>
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, share * 100)}%`, background: color }}
        />
      </span>
      <span className="nums w-8 shrink-0 text-right text-[11px] text-ink-3">{count}</span>
    </div>
  );
}

function rangeLabel(weeks: number): string {
  if (weeks <= 13) return "last 3 months";
  if (weeks <= 26) return "last 6 months";
  return "last 12 months";
}
