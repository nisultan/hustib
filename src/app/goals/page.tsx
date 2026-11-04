"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Goal, GOAL_STATUS_LABEL, GoalStatus, needsVerdict, PRIORITY_LABEL } from "@/lib/types";
import { countdownLabel, daysUntil, formatDate, todayISO } from "@/lib/dates";
import { courseColor } from "@/lib/appearance";
import { progressOf, TrackedProgress } from "@/lib/goals/tracker";
import { PageHeader, Panel, SectionTitle } from "@/components/ui";
import { GoalDialog } from "@/components/GoalDialog";
import { Celebration } from "@/components/Celebration";
import { useGoalReadings } from "@/lib/goals/judge";

/**
 * What the student is actually aiming at.
 *
 * Everything else in the hub is this week — deadlines, blocks, a habit ticked
 * this morning. This page is the only one that holds the reason for any of it,
 * so it is built to be looked at rather than processed: pictures, few numbers,
 * and no table.
 *
 * Achieved goals stay, below. Deleting the record of something you managed is
 * the wrong default, and a page that only shows what is unfinished tells a
 * flattering-to-nobody story about a year's work.
 */
export default function GoalsPage() {
  const store = useStore();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);

  const today = todayISO();
  const { active, achieved, paused, verdicts, missed } = useMemo(() => {
    const sorted = [...store.goals].sort((a, b) => a.position - b.position);
    const due = sorted.filter((g) => needsVerdict(g, today));
    const open = (g: Goal) => !due.includes(g);
    return {
      active: sorted.filter((g) => g.status === "active" && open(g)),
      achieved: sorted.filter((g) => g.status === "achieved"),
      paused: sorted.filter((g) => g.status === "paused" && open(g)),
      verdicts: due,
      missed: sorted.filter((g) => g.status === "missed").length,
    };
  }, [store.goals, today]);

  // Re-reads journal-tracked goals whose reading has gone stale. Cheap when
  // nothing is stale — it checks a date and returns.
  const readings = useGoalReadings();

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Goals"
        subtitle="The things the rest of this is for."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/goals/archive"
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Archive{missed > 0 ? ` · ${missed}` : ""}
            </Link>
            <button
              onClick={() => setEditing("new")}
              className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              New goal
            </button>
          </div>
        }
      />

      {verdicts.map((g) => (
        <Verdict key={g.id} goal={g} onAchieved={setCelebrating} />
      ))}

      {readings.count > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-panel px-4 py-2.5 text-[12.5px] text-ink-2 shadow-[var(--shadow),var(--edge)]">
          <span aria-hidden className="text-accent-text">∿</span>
          <span>
            {readings.count === 1 ? "One goal is" : `${readings.count} goals are`} tracked by reading your
            journal — refreshed every few days.
          </span>
          <button
            type="button"
            onClick={() => void readings.refresh()}
            disabled={readings.busy}
            className="ml-auto font-medium text-accent-text transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {readings.busy ? "Reading…" : "Read again now"}
          </button>
          {readings.error && <span className="w-full text-[11.5px] text-[var(--urgent)]">{readings.error}</span>}
        </div>
      )}

      {store.goals.length === 0 ? (
        <Empty onAdd={() => setEditing("new")} />
      ) : (
        <>
          <Grid goals={active} onOpen={setEditing} onAchieved={setCelebrating} />

          {paused.length > 0 && (
            <section className="mt-10">
              <SectionTitle>On hold</SectionTitle>
              <Grid goals={paused} onOpen={setEditing} onAchieved={setCelebrating} muted />
            </section>
          )}

          {achieved.length > 0 && (
            <section className="mt-10">
              <SectionTitle
                right={<span className="text-xs text-ink-3">{achieved.length}</span>}
              >
                Achieved
              </SectionTitle>
              <Grid goals={achieved} onOpen={setEditing} onAchieved={setCelebrating} muted />
            </section>
          )}
        </>
      )}

      <GoalDialog
        open={editing != null}
        goal={editing === "new" ? undefined : (editing ?? undefined)}
        onClose={() => setEditing(null)}
      />

      {celebrating != null && (
        <Celebration title={celebrating} onDone={() => setCelebrating(null)} />
      )}
    </div>
  );
}

/**
 * The deadline has passed: did you do it?
 *
 * Asked once, plainly, at the top of the page. "Yes" is the normal achieved
 * path, celebration and all. "No" asks again — it is final — and then closes
 * the goal as missed: read-only, off this page, into the archive.
 */
function Verdict({ goal, onAchieved }: { goal: Goal; onAchieved: (title: string) => void }) {
  const store = useStore();
  const [sure, setSure] = useState(false);
  return (
    <section className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-[var(--high)]/40 bg-[color-mix(in_srgb,var(--high)_8%,var(--panel))] px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[var(--high)]">
          Deadline passed · {formatDate(goal.deadline as string)}
        </p>
        <p className="mt-0.5 text-[15px] font-semibold">Did you achieve “{goal.title}”?</p>
      </div>
      {sure ? (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-ink-2">Final — it locks and goes to the archive.</span>
          <button
            onClick={() => store.setGoalStatus(goal.id, "missed")}
            className="rounded-lg bg-[var(--urgent)] px-3 py-1.5 text-[13px] font-semibold text-white"
          >
            Yes, close it
          </button>
          <button onClick={() => setSure(false)} className="rounded-lg px-2 py-1.5 text-[13px] text-ink-3 hover:text-ink">
            Back
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              store.setGoalStatus(goal.id, "achieved");
              onAchieved(goal.title);
            }}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white"
            style={{ background: "var(--up)" }}
          >
            Yes, I did
          </button>
          <button
            onClick={() => setSure(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:border-line-strong hover:text-ink"
          >
            No, I didn&apos;t
          </button>
        </div>
      )}
    </section>
  );
}

function Grid({
  goals,
  onOpen,
  onAchieved,
  muted = false,
}: {
  goals: Goal[];
  onOpen: (goal: Goal) => void;
  onAchieved: (title: string) => void;
  muted?: boolean;
}) {
  if (goals.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {goals.map((goal) => (
        <Card
          key={goal.id}
          goal={goal}
          onOpen={() => onOpen(goal)}
          onAchieved={onAchieved}
          muted={muted}
        />
      ))}
    </div>
  );
}

function Card({
  goal,
  onOpen,
  onAchieved,
  muted,
}: {
  goal: Goal;
  onOpen: () => void;
  onAchieved: (title: string) => void;
  muted: boolean;
}) {
  const store = useStore();

  /*
    Marking something achieved asks once first.

    The three status buttons sit a few pixels apart on a card you also click to
    open, and "achieved" is the one of the three that is a claim about the
    world rather than a filing decision. It is undoable — but undoing it after
    a mis-tap means watching a celebration for something you have not done,
    which is worse than the extra click.
  */
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    disarm.current = setTimeout(() => setArmed(false), 4000);
    return () => {
      if (disarm.current) clearTimeout(disarm.current);
    };
  }, [armed]);
  const category = store.categories.find((c) => c.id === goal.categoryId);
  const { value: progress, tracked } = progressOf(goal, store);
  const due = goal.deadline ? daysUntil(goal.deadline) : null;
  const overdue = due != null && due < 0 && goal.status === "active";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow),var(--edge)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--edge)] ${
        overdue ? "border-[var(--urgent)]/40" : "border-line hover:border-line-strong"
      } ${muted ? "opacity-75 hover:opacity-100" : ""}`}
    >
      <button onClick={onOpen} className="flex flex-1 flex-col text-left">
        {goal.image ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-panel-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={goal.image}
              alt=""
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* A wash rather than a hard overlay: it has to sit on any photo
                without turning a bright one grey or a dark one black. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <h3 className="absolute inset-x-0 bottom-0 p-3.5 text-[15px] font-semibold leading-snug tracking-tight text-white drop-shadow-sm">
              {goal.title}
            </h3>
          </div>
        ) : (
          <div className="px-4 pt-4">
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
              {goal.title}
            </h3>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-3 p-4">
          {goal.note.trim() !== "" && (
            <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-2">{goal.note}</p>
          )}

          {progress != null && <Progress value={progress} tracked={tracked} />}

          <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: `var(--${goal.priority})` }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: `var(--${goal.priority})` }}
              />
              {PRIORITY_LABEL[goal.priority]}
            </span>

            {category && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: courseColor(category.color) }}
                />
                {category.name}
              </span>
            )}

            {goal.status === "achieved" ? (
              <span className="ml-auto text-[11px] font-medium text-[var(--up)]">
                {goal.achievedAt ? `Done ${formatDate(goal.achievedAt)}` : "Achieved"}
              </span>
            ) : (
              goal.deadline && (
                <span
                  className="nums ml-auto text-[11px]"
                  style={overdue ? { color: "var(--urgent)" } : undefined}
                  title={formatDate(goal.deadline)}
                >
                  {overdue ? `${-(due as number)}d over` : countdownLabel(goal.deadline)}
                </span>
              )
            )}
          </div>
        </div>
      </button>

      {/* Status lives on the card, because moving a goal to achieved is the
          one thing you come to this page to do and it should not need a
          dialog. */}
      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        {armed ? (
          <>
            <span className="px-1 text-[11px] text-ink-2">Really done?</span>
            <button
              onClick={() => {
                setArmed(false);
                store.setGoalStatus(goal.id, "achieved");
                onAchieved(goal.title);
              }}
              autoFocus
              className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-white"
              style={{ background: "var(--up)" }}
            >
              Yes, achieved
            </button>
            <button
              onClick={() => setArmed(false)}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-3 hover:bg-panel-2 hover:text-ink"
            >
              Not yet
            </button>
          </>
        ) : (
          (["active", "achieved", "paused"] as GoalStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => {
                // Already achieved: the button is just the current state, and
                // re-confirming it would replay the confetti for nothing.
                if (status === "achieved" && goal.status !== "achieved") {
                  setArmed(true);
                  return;
                }
                store.setGoalStatus(goal.id, status);
              }}
              aria-pressed={goal.status === status}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                goal.status === status
                  ? "bg-accent-soft text-accent-text"
                  : "text-ink-3 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {GOAL_STATUS_LABEL[status]}
            </button>
          ))
        )}
      </div>
    </article>
  );
}

/**
 * A bar, the number beside it, and — when the hub worked the number out — what
 * it counted to get there.
 *
 * A computed bar has to show its working or it is just a more confident version
 * of the one someone dragged. The count under it is the difference between
 * "62%" and "18 of 28 habit ticks, last 28 days", and only the second one tells
 * you what to do this evening.
 */
function Progress({ value, tracked }: { value: number; tracked: TrackedProgress | null }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
        <span className="nums w-8 shrink-0 text-right text-[11px] text-ink-3">{value}%</span>
      </div>

      {tracked && (
        <p className="text-[10.5px] leading-relaxed text-ink-3">{tracked.summary}</p>
      )}
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <Panel className="px-6 py-14 text-center">
      <p className="text-[15px] font-semibold tracking-tight">Nothing set down yet.</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-2">
        A goal is the thing your tasks and habits are for — a university, a grade, a language, a
        distance. Add a picture if it helps you want it.
      </p>
      <button
        onClick={onAdd}
        className="mt-5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
      >
        Add your first goal
      </button>
    </Panel>
  );
}
