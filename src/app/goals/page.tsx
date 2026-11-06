"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { extrasOf, Goal, needsVerdict, PRIORITY_LABEL } from "@/lib/types";
import { daysUntil, formatDate, todayISO } from "@/lib/dates";
import { courseColor } from "@/lib/appearance";
import { progressOf } from "@/lib/goals/tracker";
import { daysSince, lastTouched, paceOf, picturesOf, pushStreak, remindersOf, spotlight } from "@/lib/goals/pulse";
import { ClockText, Cover, Flame, PaceBars, ReminderTicker, Tint } from "@/components/goals/parts";
import { TimeLeft, useNow } from "@/components/ReportTimers";
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
          <TodaysPush goals={active} />
          {active.length > 0 && (
            <SectionTitle right={<span className="text-xs text-ink-3">{active.length}</span>}>Working on it</SectionTitle>
          )}
          <Grid goals={active} onAchieved={setCelebrating} />

          {paused.length > 0 && (
            <section className="mt-10">
              <SectionTitle>On hold</SectionTitle>
              <Grid goals={paused} onAchieved={setCelebrating} muted />
            </section>
          )}

          {achieved.length > 0 && (
            <section className="mt-10">
              <SectionTitle
                right={<span className="text-xs text-ink-3">{achieved.length}</span>}
              >
                Achieved
              </SectionTitle>
              <Grid goals={achieved} onAchieved={setCelebrating} muted />
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
  onAchieved,
  muted = false,
}: {
  goals: Goal[];
  onAchieved: (title: string) => void;
  muted?: boolean;
}) {
  if (goals.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {goals.map((goal, i) => (
        <motion.div
          key={goal.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card goal={goal} onAchieved={onAchieved} muted={muted} />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Today's push: one goal, full width, a different one each day — leaning
 * towards the one you've neglected or whose deadline is closing in. Its
 * pictures drift, your own reasons rotate over them, and the clock runs.
 */
function TodaysPush({ goals }: { goals: Goal[] }) {
  const store = useStore();
  const router = useRouter();
  const now = useNow();
  const today = todayISO();
  const order = useMemo(() => spotlight(goals, today), [goals, today]);
  const [skip, setSkip] = useState(0);
  if (order.length === 0) return null;
  const goal = order[skip % order.length];
  const ex = extrasOf(goal);
  const pics = picturesOf(goal, ex);
  const reminders = remindersOf(goal, ex);
  const { value } = progressOf(goal, store);
  const pace = paceOf(goal, value, now);
  const pushed = ex.pushes.includes(today);
  const streak = pushStreak(ex.pushes, today);
  const quiet = daysSince(lastTouched(goal, ex), today);
  const next = ex.milestones.find((m) => !m.done);

  const togglePush = () => {
    const pushes = pushed ? ex.pushes.filter((d) => d !== today) : [...ex.pushes, today].slice(-400);
    store.updateGoal(goal.id, { extras: { ...ex, pushes } });
  };

  return (
    <section className="relative mb-8 min-h-[340px] overflow-hidden rounded-3xl border border-line shadow-[var(--shadow-md)]">
      {pics.length > 0 ? (
        <Cover key={goal.id} pictures={pics} y={ex.coverY} className="absolute inset-0" interval={7000} />
      ) : (
        <Tint color={ex.color} className="absolute inset-0" />
      )}
      <div
        className={`absolute inset-0 bg-gradient-to-t ${
          pics.length > 0 ? "from-black/85 via-black/45 to-black/25" : "from-black/60 via-black/20 to-transparent"
        }`}
      />

      <div className="relative z-[1] flex min-h-[340px] flex-col justify-between gap-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
            Today&apos;s push
          </span>
          {quiet >= 5 && (
            <span className="rounded-full bg-[var(--urgent)]/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              untouched for {quiet} days
            </span>
          )}
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-[#fbbf24] backdrop-blur-md">
              <Flame /> {streak}-day push streak
            </span>
          )}
          {order.length > 1 && (
            <button
              type="button"
              onClick={() => setSkip((x) => x + 1)}
              className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white"
            >
              Another goal →
            </button>
          )}
        </div>

        <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0 max-w-2xl">
            <motion.h2
              key={goal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[30px] font-extrabold leading-[1.1] tracking-tight text-white drop-shadow sm:text-[38px]"
            >
              {goal.title}
            </motion.h2>
            <div className="mt-4 min-h-[64px]">
              {reminders.length > 0 ? (
                <ReminderTicker key={goal.id} reminders={reminders} big />
              ) : (
                <p className="text-[14px] text-white/70">
                  Write down why this matters — open the goal and fill in your reasons. They&apos;ll rotate here.
                </p>
              )}
            </div>
            {next && (
              <p className="mt-3 text-[13px] text-white/80">
                <span className="font-semibold text-white">Next step:</span> {next.text}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {goal.deadline && (
              <div className="rounded-xl bg-black/35 p-3 backdrop-blur-md">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/70">Time left</p>
                <TimeLeft ms={new Date(`${goal.deadline}T23:59:59`).getTime() - now} />
              </div>
            )}
            {pace?.verdict && (
              <p className="text-[12px] font-semibold text-white/85">
                {Math.round(pace.time * 100)}% of the time gone · {Math.round((pace.done ?? 0) * 100)}% done
              </p>
            )}
            <div className="flex gap-2">
              <motion.button
                type="button"
                onClick={togglePush}
                whileTap={{ scale: 0.94 }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold shadow-lg transition-colors ${
                  pushed ? "bg-[var(--up)] text-white" : "bg-white text-black hover:bg-white/90"
                }`}
              >
                <Flame />
                {pushed ? "Pushed today" : "I pushed today"}
              </motion.button>
              <button
                type="button"
                onClick={() => router.push(`/goals/${goal.id}`)}
                className="rounded-xl bg-white/15 px-4 py-2.5 text-[13.5px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ goal, onAchieved, muted }: { goal: Goal; onAchieved: (title: string) => void; muted: boolean }) {
  const store = useStore();
  const router = useRouter();
  const now = useNow();
  const today = todayISO();
  const ex = extrasOf(goal);
  const pics = picturesOf(goal, ex);
  const reminders = remindersOf(goal, ex);
  const category = store.categories.find((c) => c.id === goal.categoryId);
  const { value: progress, tracked } = progressOf(goal, store);
  const pace = paceOf(goal, progress, now);
  const due = goal.deadline ? daysUntil(goal.deadline) : null;
  const overdue = due != null && due < 0 && goal.status === "active";
  const quiet = goal.status === "active" ? daysSince(lastTouched(goal, ex), today) : 0;
  const dusty = quiet >= 7;
  const pushed = ex.pushes.includes(today);
  const streak = pushStreak(ex.pushes, today);
  const doneMs = ex.milestones.filter((m) => m.done).length;
  const tint = ex.color ? courseColor(ex.color) : null;

  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const togglePush = () => {
    const pushes = pushed ? ex.pushes.filter((d) => d !== today) : [...ex.pushes, today].slice(-400);
    store.updateGoal(goal.id, { extras: { ...ex, pushes } });
  };

  const header = (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="absolute left-3 top-3 z-[2] flex gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-md">
          <span className="size-1.5 rounded-full" style={{ background: `var(--${goal.priority})` }} />
          {PRIORITY_LABEL[goal.priority]}
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-bold text-[#fbbf24] backdrop-blur-md">
            <Flame className="size-3" /> {streak}
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[2] p-4">
        {dusty && (
          <p className="mb-1.5 inline-block rounded-md bg-[var(--urgent)]/85 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
            Untouched for {quiet} days
          </p>
        )}
        <h3 className="text-[18px] font-bold leading-snug tracking-tight text-white drop-shadow">{goal.title}</h3>
      </div>
    </>
  );

  return (
    <article
      onClick={() => router.push(`/goals/${goal.id}`)}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-panel shadow-[var(--shadow),var(--edge)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md),var(--edge)] ${
        overdue ? "border-[var(--urgent)]/50" : "border-line hover:border-line-strong"
      } ${muted ? "opacity-75 hover:opacity-100" : ""}`}
    >
      {tint && <span aria-hidden className="absolute inset-x-0 top-0 z-[3] h-1" style={{ background: tint }} />}
      {pics.length > 0 ? (
        <Cover pictures={pics} y={ex.coverY} dim={dusty} className="aspect-[16/10] w-full">
          {header}
        </Cover>
      ) : (
        <Tint color={ex.color} className="aspect-[16/10] w-full">
          {header}
        </Tint>
      )}

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        {reminders.length > 0 && <ReminderTicker reminders={reminders} interval={6500} />}

        {pace ? (
          <PaceBars time={pace.time} done={pace.done} verdict={pace.verdict} />
        ) : (
          progress != null && <PaceBars time={0} done={progress / 100} verdict={null} hideTime />
        )}
        {tracked && <p className="-mt-2 text-[10.5px] leading-relaxed text-ink-3">{tracked.summary}</p>}

        {ex.milestones.length > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-[10.5px] text-ink-3">
              <span>Milestones</span>
              <span className="nums font-semibold text-ink-2">
                {doneMs}/{ex.milestones.length}
              </span>
            </div>
            <div className="flex gap-1">
              {ex.milestones.map((m) => (
                <span key={m.id} className="h-1.5 flex-1 rounded-full" style={{ background: m.done ? "var(--up)" : "var(--panel-2)" }} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5 text-[11px]">
          {category && (
            <span className="inline-flex items-center gap-1.5 text-ink-3">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: courseColor(category.color) }} />
              {category.name}
            </span>
          )}
          {goal.status === "achieved" ? (
            <span className="ml-auto font-medium text-[var(--up)]">
              {goal.achievedAt ? `Done ${formatDate(goal.achievedAt)}` : "Achieved"}
            </span>
          ) : goal.deadline ? (
            <span className="ml-auto text-ink-2" style={overdue ? { color: "var(--urgent)" } : undefined} title={formatDate(goal.deadline)}>
              {overdue ? `${-(due as number)}d over` : <ClockText ms={new Date(`${goal.deadline}T23:59:59`).getTime() - now} />}
            </span>
          ) : (
            <span className="ml-auto text-ink-3">no deadline</span>
          )}
        </div>
      </div>

      {goal.status !== "achieved" && (
        <div className="flex items-center gap-1 border-t border-line px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
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
              <button onClick={() => setArmed(false)} className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-3 hover:bg-panel-2 hover:text-ink">
                Not yet
              </button>
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={togglePush}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  pushed ? "bg-[color-mix(in_srgb,var(--up)_16%,transparent)] text-[var(--up)]" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <Flame className="size-3" />
                {pushed ? "Pushed today" : "Push today"}
              </motion.button>
              <button onClick={() => setArmed(true)} className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-ink-3 hover:bg-panel-2 hover:text-ink">
                Achieved?
              </button>
              <button
                onClick={() => store.setGoalStatus(goal.id, goal.status === "paused" ? "active" : "paused")}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-3 hover:bg-panel-2 hover:text-ink"
              >
                {goal.status === "paused" ? "Resume" : "Hold"}
              </button>
            </>
          )}
        </div>
      )}
    </article>
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
