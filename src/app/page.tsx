"use client";

import Link from "next/link";
import { ReactNode, useMemo } from "react";
import { useStore } from "@/lib/store";
import { needsVerdict } from "@/lib/types";
import { formatTime, greeting, todayISO } from "@/lib/dates";
import { appliesOn } from "@/lib/habits";
import { productivity } from "@/lib/productivity";
import { Button, Panel } from "@/components/ui";
import { Spark } from "@/components/Spark";
import { Flame } from "@/components/Flame";
import { PrimeMeter } from "@/components/home/PrimeMeter";
import { CheckIn } from "@/components/CheckIn";
import { openTour } from "@/components/Tour";
import { TodayList } from "@/components/home/TodayList";
import { HabitChips } from "@/components/home/HabitChips";
import { ComingUp, GoalsCompact, TodayRing, WeekGlance } from "@/components/home/Rail";

/**
 * Home, built the way the apps people actually open every day are built.
 *
 * The old dashboard was a stack of ten large blocks, each with a heading and a
 * frame, all the same weight: a full-width check-in card, an overdue card, two
 * rows of countdown cards, a plan panel, a habits panel, a due-today list, an
 * upcoming list, goals, a consistency card and recommendations. Everything was
 * shown, so nothing was first.
 *
 * Now there are two things, borrowed from apps that get this right:
 *
 *  - Things and Todoist open on *Today*: one list of what to do, read top to
 *    bottom, with a line at the end to add the next thing. That is the left.
 *  - Health and fitness apps open on a *summary*: a few small widgets you read
 *    in a glance, each opening the detail elsewhere. That is the right — what
 *    is coming, how the goals stand, three numbers about the week.
 *
 * Habits sit under the day as a row of tap targets, the way habit apps do it,
 * and the ring at the top says how much of today is done across all of it.
 * Recommendations, consistency charts and the fortnight of habit history moved
 * to their own pages, where there is room to read them.
 */
export default function HomePage() {
  const store = useStore();
  const today = todayISO();

  const open = useMemo(() => store.tasks.filter((t) => t.status !== "completed"), [store.tasks]);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const overdue = open.filter((t) => t.dueDate != null && t.dueDate < today).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const streak = productivity(store).streak;

  /*
    What is going on right now, as chips you can act on rather than a sentence
    you read: each opens the place that deals with it. Ordered by what would
    change the next hour — late work, the next block, habits left — with the
    streak last as the reward.
  */
  const next = store.plan
    .filter((p) => p.date === today && !p.done && p.start != null)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];
  const left = habitsLeft(store, today);
  const chips: { key: string; label: string; href: string; tone: string; icon?: ReactNode }[] = [];
  const verdicts = store.goals.filter((g) => needsVerdict(g, today)).length;
  if (verdicts > 0)
    chips.push({ key: "verdict", label: `${verdicts} goal deadline${verdicts === 1 ? "" : "s"} passed — did you do it?`, href: "/goals", tone: "var(--high)" });
  if (overdue > 0) chips.push({ key: "late", label: `${overdue} overdue`, href: "/tasks", tone: "var(--urgent)" });
  if (dueToday > 0) chips.push({ key: "due", label: `${dueToday} due today`, href: "/tasks", tone: "var(--high)" });
  if (next) chips.push({ key: "next", label: `${formatTime(next.start as string)} · ${next.title || "Untitled"}`, href: "/plan", tone: "var(--accent)" });
  if (left > 0) chips.push({ key: "habits", label: `${left} habit${left === 1 ? "" : "s"} left`, href: "/plan", tone: "var(--up)" });
  if (streak > 0) chips.push({ key: "streak", label: `${streak}-day streak`, href: "/progress", tone: "var(--high)", icon: <Flame streak={streak} /> });

  const pep =
    overdue > 0
      ? "Clear the late stuff first — then the day is yours."
      : dueToday > 0 || next
        ? "Lock in. One thing at a time."
        : open.length === 0
          ? "Nothing on your plate. Rest, or get ahead."
          : "Nothing pressing today. Good day to get ahead.";

  const date = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-in">
      <header className="mb-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">{date}</p>
          <h1 className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">
            {greeting()}, {store.profile.name}
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-2">{pep}</p>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  className="nums flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-[filter] hover:brightness-110"
                  style={{
                    color: c.tone,
                    borderColor: `color-mix(in srgb, ${c.tone} 30%, transparent)`,
                    background: `color-mix(in srgb, ${c.tone} 10%, transparent)`,
                  }}
                >
                  {c.icon ?? <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: c.tone }} />}
                  <span className="truncate">{c.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <TodayRing />
      </header>

      <Spark />

      <div className="mt-4">
        <PrimeMeter />
      </div>

      <div className="mt-6">
        <CheckIn />
      </div>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-8">
          <TodayList />
          <HabitChips />
        </div>

        <aside className="grid min-w-0 grid-cols-1 gap-6">
          <WeekGlance />
          <ComingUp />
          <GoalsCompact />
        </aside>
      </div>

      {store.courses.length === 0 && (
        <Panel className="mt-10 px-5 py-5">
          <h2 className="text-[15px] font-bold">Start here</h2>
          <p className="mt-1 text-[14px] text-ink-2">
            Add your courses first — tasks hang off them, and the dashboard needs them to tell you
            what to focus on.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/courses">
              <Button variant="primary">Add courses</Button>
            </Link>
            <Button onClick={openTour}>Take the tour</Button>
            <Button variant="ghost" onClick={() => store.resetToSample()}>
              Load sample data
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Habits that apply today and have not been ticked yet. */
function habitsLeft(store: ReturnType<typeof useStore>, today: string): number {
  const done = store.days.find((d) => d.date === today)?.habitsDone ?? [];
  return store.habits.filter(
    (h) => h.archivedAt == null && appliesOn(h, today) && !done.includes(h.id),
  ).length;
}
